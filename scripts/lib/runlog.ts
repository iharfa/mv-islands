import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

/** Start a scrape run for a source slug; returns helpers to log + finish. */
export async function startRun(sourceSlug: string) {
  const source = await prisma.source.findUnique({ where: { slug: sourceSlug } });
  if (!source) throw new Error(`Unknown source slug ${sourceSlug}. Run npm run db:seed first.`);
  const run = await prisma.scrapeRun.create({
    data: { sourceId: source.id, startedAt: new Date(), status: "running" },
  });
  const lines: string[] = [];
  const failedUrls: string[] = [];
  let pagesFetched = 0;
  let recordsFound = 0;

  return {
    source,
    run,
    log(msg: string) {
      const line = `[${new Date().toISOString()}] ${msg}`;
      lines.push(line);
      console.log(line);
    },
    fail(url: string, reason: string) {
      failedUrls.push(url);
      this.log(`FAIL ${url} — ${reason}`);
    },
    page() {
      pagesFetched++;
    },
    record(n = 1) {
      recordsFound += n;
    },
    async finish(status?: "success" | "partial" | "failed") {
      const final =
        status ?? (failedUrls.length === 0 ? "success" : recordsFound > 0 ? "partial" : "failed");
      await prisma.scrapeRun.update({
        where: { id: run.id },
        data: {
          finishedAt: new Date(),
          status: final,
          pagesFetched,
          recordsFound,
          failures: failedUrls.length,
          failedUrls: JSON.stringify(failedUrls),
          log: lines.join("\n"),
        },
      });
      this.log(`Run finished: ${final} (${recordsFound} records, ${pagesFetched} pages, ${failedUrls.length} failures)`);
      return final;
    },
  };
}
