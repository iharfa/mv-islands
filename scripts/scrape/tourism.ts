/**
 * Scrape + ingest the Ministry of Tourism registered facilities (resorts).
 *
 * Source: https://www.tourism.gov.mv/en/registered/facilities/filter-t1
 * (operational resorts). The page exposes a CSV export of the full
 * registered-resort table: name, atoll, island, rooms, beds, contacts,
 * operator, owner/lessee, management, state (Operating / Not Operating).
 *
 * Per registry rules the raw payload is archived under data/raw/tourism/
 * before parsing. Re-runs replace previously ingested tourism-ministry
 * field values and island matches (the CSV is a full snapshot, not a delta).
 *
 * Steward context (2026-06-12): this source exists to provide *current*
 * ground truth for resort/use status conflicts where OneMap and the
 * historical AoM archive disagree.
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import Papa from "papaparse";
import { resolveAtoll, normalizeName, nameSimilarity } from "../lib/normalize";

const prisma = new PrismaClient();

const LIST_URL = "https://www.tourism.gov.mv/en/registered/facilities/filter-t1";
const RAW_DIR = path.join(process.cwd(), "data", "raw", "tourism");
const DELAY_MS = Number(process.env.SCRAPER_DELAY_MS ?? 1500);
const SOURCE_SLUG = "tourism-ministry";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface ResortRow {
  "#": string;
  Name: string;
  Atoll: string;
  Island: string;
  Rooms: string;
  Beds: string;
  Operator: string;
  "Owner/Lesse": string;
  Management: string;
  State: string;
}

function firstLine(s: string | undefined): string {
  return (s ?? "").split(/\r?\n/)[0].trim();
}

async function main() {
  const source = await prisma.source.findUnique({ where: { slug: SOURCE_SLUG } });
  if (!source) throw new Error(`Source ${SOURCE_SLUG} not registered — run db:seed first`);

  const run = await prisma.scrapeRun.create({
    data: { sourceId: source.id, startedAt: new Date(), status: "running" },
  });
  const failures: string[] = [];

  try {
    mkdirSync(RAW_DIR, { recursive: true });
    const stamp = new Date().toISOString().slice(0, 10);

    // 1. Fetch the listing page and locate the CSV export link (hash segment rotates).
    const pageRes = await fetch(LIST_URL, { headers: { "User-Agent": "maldives-island-registry scraper" } });
    const pageHtml = await pageRes.text();
    writeFileSync(path.join(RAW_DIR, `facilities_filter-t1_${stamp}.html`), pageHtml);
    const csvHref = pageHtml.match(/href="([^"]+\.csv)"/)?.[1];
    if (!csvHref) throw new Error("No CSV export link found on the facilities page");
    const csvUrl = csvHref.startsWith("http") ? csvHref : `https://www.tourism.gov.mv${csvHref}`;

    await sleep(DELAY_MS);

    // 2. Download + archive the CSV.
    const csvRes = await fetch(csvUrl, { headers: { "User-Agent": "maldives-island-registry scraper" } });
    const csvText = await csvRes.text();
    const rawPath = path.join("data", "raw", "tourism", `registered_resorts_${stamp}.csv`);
    writeFileSync(path.join(process.cwd(), rawPath), csvText);

    await prisma.sourceDocument.create({
      data: {
        sourceId: source.id,
        url: csvUrl,
        title: "Registered tourist resorts (CSV export)",
        docType: "csv",
        rawPath,
        contentHash: createHash("sha256").update(csvText).digest("hex"),
        fetchedAt: new Date(),
        httpStatus: csvRes.status,
      },
    });

    // 3. Parse.
    const parsed = Papa.parse<ResortRow>(csvText, { header: true, skipEmptyLines: true });
    const resorts = parsed.data.filter((r) => r.Name?.trim());
    console.log(`Parsed ${resorts.length} registered resorts.`);

    // 4. Replace previous tourism-ministry ingestion (full-snapshot source).
    await prisma.fieldValue.deleteMany({ where: { sourceId: source.id } });
    await prisma.islandMatch.deleteMany({ where: { sourceSlug: SOURCE_SLUG } });

    // 5. Match each resort to a registry island (atoll + normalized name; fuzzy fallback).
    const atolls = await prisma.atoll.findMany();
    const atollIdByCode = new Map(atolls.map((a) => [a.code, a.id]));
    const islands = await prisma.island.findMany({ select: { id: true, name: true, slug: true, atollId: true } });
    const byAtoll = new Map<string, typeof islands>();
    for (const i of islands) {
      if (!i.atollId) continue;
      byAtoll.set(i.atollId, [...(byAtoll.get(i.atollId) ?? []), i]);
    }

    let matched = 0;
    const unmatched: { resort: string; atoll: string; island: string }[] = [];
    const matchedRows: Record<string, unknown>[] = [];

    for (const r of resorts) {
      const atoll = resolveAtoll(r.Atoll);
      const atollId = atoll ? atollIdByCode.get(atoll.code) : undefined;
      const candidates = atollId ? (byAtoll.get(atollId) ?? []) : [];
      // Resort "islands" sometimes span several islets ("X Finolhu and X Huraa") — try each part.
      const parts = r.Island.split(/\s+(?:and|&)\s+/i).map((p) => p.trim()).filter(Boolean);
      let best: { island: (typeof islands)[number]; score: number; part: string } | null = null;
      for (const part of parts.length ? parts : [r.Island]) {
        for (const isl of candidates) {
          const score = nameSimilarity(part, isl.name);
          if (!best || score > best.score) best = { island: isl, score, part };
        }
      }
      if (!best || best.score < 0.85) {
        unmatched.push({ resort: r.Name, atoll: r.Atoll, island: r.Island });
        continue;
      }
      matched++;
      const exact = normalizeName(best.part) === normalizeName(best.island.name);
      await prisma.islandMatch.create({
        data: {
          islandId: best.island.id,
          sourceSlug: SOURCE_SLUG,
          sourceRecordKey: `resort:${r.Name}`,
          matchMethod: exact ? "atoll-plus-name" : "fuzzy-name",
          confidence: exact ? 0.97 : best.score,
          needsReview: !exact && best.score < 0.92,
        },
      });
      const fields: [string, string][] = [
        ["resort_name", r.Name.trim()],
        ["resort_operating_state", r.State?.trim() || "Operating"],
        ["resort_rooms", r.Rooms?.trim() ?? ""],
        ["resort_beds", r.Beds?.trim() ?? ""],
        ["resort_operator", firstLine(r.Operator)],
        ["resort_owner", firstLine(r["Owner/Lesse"])],
      ];
      for (const [fieldName, value] of fields) {
        if (!value) continue;
        await prisma.fieldValue.create({
          data: {
            entityType: "island",
            entityId: best.island.id,
            fieldName,
            sourceId: source.id,
            rawValue: value,
            normalizedValue: value,
            isCanonical: true, // tourism-ministry is the only source for resort_* fields
            canonicalReason: "Only source providing registered-resort facility data",
            selectedBy: "scrape:tourism",
            dateSelected: new Date(),
            confidenceScore: exact ? 0.97 : best.score,
            verificationStatus: "verified",
            dateVerified: new Date(),
            dateScraped: new Date(),
            sourceUrl: LIST_URL,
          },
        });
      }
      matchedRows.push({ resort: r.Name, island_slug: best.island.slug, score: Math.round(best.score * 100) / 100, state: r.State });
    }

    writeFileSync(
      path.join(RAW_DIR, "parsed_resorts.json"),
      JSON.stringify({ fetchedAt: new Date().toISOString(), total: resorts.length, matched, unmatched, matches: matchedRows }, null, 2),
    );

    await prisma.scrapeRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        status: unmatched.length ? "partial" : "success",
        recordsFound: resorts.length,
        pagesFetched: 2,
        failures: unmatched.length,
        failedUrls: JSON.stringify(unmatched.map((u) => `${u.resort} (${u.atoll}. ${u.island})`)),
        log: `Matched ${matched}/${resorts.length} resorts to registry islands; ${unmatched.length} unmatched (kept in parsed_resorts.json).`,
      },
    });
    await prisma.auditLog.create({
      data: {
        actor: "system",
        action: "scrape:tourism",
        detail: `Ingested ${resorts.length} registered resorts from tourism.gov.mv; matched ${matched} to islands, ${unmatched.length} unmatched.`,
      },
    });
    console.log(`Done. Matched ${matched}/${resorts.length}; unmatched: ${unmatched.length}`);
    if (unmatched.length) for (const u of unmatched) console.log(`  unmatched: ${u.resort} — ${u.atoll}. ${u.island}`);
  } catch (e) {
    failures.push(String(e));
    await prisma.scrapeRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), status: "failed", log: failures.join("\n") },
    });
    throw e;
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
