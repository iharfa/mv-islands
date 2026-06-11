/**
 * Atolls of Maldives scraper.
 * Crawls www.atollsofmaldives.gov.mv via its sitemap: 20 atoll pages and ~469
 * island pages. Each island page is a tabbed label/value table covering
 * geography, environment, infrastructure and history. Raw HTML is archived
 * before parsing; responses are cached so re-runs do not re-hit the site.
 */
import * as cheerio from "cheerio";
import { politeFetch, archiveRaw, safeFilename } from "../lib/http";
import { startRun, prisma } from "../lib/runlog";

const SITEMAP = "https://www.atollsofmaldives.gov.mv/sitemap.xml";

export interface ParsedIslandPage {
  url: string;
  name: string;
  statusCode: string | null; // I | U | R from the page title
  atollName: string | null;
  fields: Record<string, string>; // section-prefixed label -> value
  sections: Record<string, string[]>; // section -> free-text paragraphs
  images: string[];
}

export function parseIslandPage(html: string, url: string): ParsedIslandPage {
  const $ = cheerio.load(html);
  const h1 = $(".block-title h1").first().text().trim();
  // "Alidhoo (R) - [ Thiladhunmathi Uthuruburi (Haa Alifu Atoll) ]"
  const m = h1.match(/^(.*?)\s*\(([IUR])\)\s*-\s*\[\s*(.*?)\s*\]/i);
  const name = m ? m[1].trim() : h1.replace(/\s*-.*$/, "").trim();
  const statusCode = m ? m[2].toUpperCase() : null;
  const atollName = m ? m[3].trim() : null;

  const fields: Record<string, string> = {};
  const sections: Record<string, string[]> = {};
  $(".form_container").each((_, container) => {
    const section = $(container).find("h3").first().text().trim() || "General";
    $(container)
      .find("table tr")
      .each((_, tr) => {
        const tds = $(tr).find("td");
        if (tds.length >= 2) {
          const label = $(tds[0]).text().trim().replace(/\s+/g, " ");
          const value = $(tds[1]).text().trim().replace(/\s+/g, " ");
          if (label && value) fields[`${section} :: ${label}`] = value;
        }
      });
    const paras: string[] = [];
    $(container)
      .find("p")
      .each((_, p) => {
        const t = $(p).text().trim();
        if (t && t !== "Enter the island description") paras.push(t);
      });
    if (paras.length) sections[section] = paras;
  });

  const images: string[] = [];
  $("a.lightbox, a[href*='/files/'], img[src*='/files/']").each((_, el) => {
    const href = $(el).attr("href") ?? $(el).attr("src");
    if (href && /\.(jpe?g|png|gif)$/i.test(href)) {
      images.push(new URL(href, url).href);
    }
  });

  return { url, name, statusCode, atollName, fields, sections, images: [...new Set(images)] };
}

async function main() {
  const limit = process.env.SCRAPE_LIMIT ? Number(process.env.SCRAPE_LIMIT) : Infinity;
  const run = await startRun("atolls-of-maldives");
  try {
    const sitemap = await politeFetch(SITEMAP);
    run.page();
    archiveRaw("atollsofmaldives", "sitemap.xml", sitemap.body);
    const urls = [...sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    const islandUrls = urls.filter((u) => /\/atolls\/.+\/.+\/\d+$/.test(u));
    const atollUrls = urls.filter((u) => /\/atolls\/[^/]+$/.test(u) && !/\/atolls$/.test(u));
    run.log(`Sitemap: ${atollUrls.length} atoll pages, ${islandUrls.length} island pages`);

    const parsedIslands: ParsedIslandPage[] = [];
    const parsedAtolls: { url: string; name: string }[] = [];

    for (const url of atollUrls) {
      try {
        const enc = encodeURI(url);
        const res = await politeFetch(enc);
        run.page();
        if (res.status !== 200) { run.fail(url, `HTTP ${res.status}`); continue; }
        archiveRaw("atollsofmaldives/atoll-pages", safeFilename(url) + ".html", res.body);
        const $ = cheerio.load(res.body);
        parsedAtolls.push({ url, name: $(".block-title h1").first().text().trim() || decodeURIComponent(url.split("/").pop() ?? "") });
      } catch (e) {
        run.fail(url, String(e));
      }
    }

    let i = 0;
    for (const url of islandUrls) {
      if (i >= limit) break;
      i++;
      try {
        const enc = encodeURI(url);
        const res = await politeFetch(enc);
        run.page();
        if (res.status !== 200) { run.fail(url, `HTTP ${res.status}`); continue; }
        archiveRaw("atollsofmaldives/island-pages", safeFilename(url) + ".html", res.body);
        const parsed = parseIslandPage(res.body, url);
        parsedIslands.push(parsed);
        run.record();
        if (i % 25 === 0) run.log(`Parsed ${i}/${Math.min(limit, islandUrls.length)} island pages`);
      } catch (e) {
        run.fail(url, String(e));
      }
    }

    archiveRaw("atollsofmaldives", "parsed_islands.json", JSON.stringify(parsedIslands, null, 2));
    archiveRaw("atollsofmaldives", "parsed_atolls.json", JSON.stringify(parsedAtolls, null, 2));

    await prisma.sourceDocument.create({
      data: {
        sourceId: run.source.id,
        url: SITEMAP,
        title: "Atolls of Maldives full crawl",
        docType: "html-page",
        rawPath: "data/raw/atollsofmaldives/parsed_islands.json",
        fetchedAt: new Date(),
        httpStatus: 200,
      },
    });
    await run.finish();
  } catch (e) {
    run.log(`FATAL: ${e}`);
    await run.finish("failed");
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) main();
