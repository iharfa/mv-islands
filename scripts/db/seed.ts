import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Source registry. Priority: lower number = higher canonical priority.
const SOURCES = [
  {
    slug: "onemap",
    name: "OneMap Maldives (National Geospatial Portal)",
    organization: "Ministry of National Planning / National GIS",
    url: "https://onemap.mv/",
    datasetType: "geospatial",
    accessMethod: "arcgis-rest",
    category: "onemap",
    priority: 10,
    license: "Public government geospatial data; terms not formally published.",
    limitations:
      "Service availability varies; attribute completeness differs by layer. Geometry is authoritative; thematic attributes may lag.",
    archivePath: "data/raw/onemap",
    processingScript: "scripts/scrape/onemap.ts",
  },
  {
    slug: "census-2022",
    name: "Maldives Population & Housing Census 2022",
    organization: "Maldives Bureau of Statistics",
    url: "https://census.gov.mv/2022/",
    datasetType: "statistical",
    accessMethod: "file-download",
    category: "census",
    priority: 20,
    license: "Official statistics; free reuse with attribution.",
    limitations:
      "Island-level tables cover administrative islands only; resorts/industrial islands are aggregated separately. Registry policy: the published census is the verified primary source for population values; StatsMap (same publisher) is treated as a derived visualisation that may lag it.",
    archivePath: "data/raw/mbs",
    processingScript: "scripts/scrape/mbs.ts",
  },
  {
    slug: "statsmap",
    name: "MBS StatsMap (GIS population map)",
    organization: "Maldives Bureau of Statistics",
    url: "https://statisticsmaldives.gov.mv/gismaps/statsmap/",
    datasetType: "geospatial",
    accessMethod: "playwright-network",
    category: "statsmap",
    priority: 30,
    license: "Official statistics; free reuse with attribution.",
    limitations:
      "Derived web-map dataset; values can lag the published census tables it visualises.",
    archivePath: "data/raw/statsmap",
    processingScript: "scripts/scrape/statsmap.ts",
  },
  {
    slug: "mbs-indicators",
    name: "Island & Atoll Level Indicator Sheets",
    organization: "Maldives Bureau of Statistics",
    url: "https://statisticsmaldives.gov.mv/",
    datasetType: "statistical",
    accessMethod: "file-download",
    category: "indicators",
    priority: 40,
    license: "Official statistics; free reuse with attribution.",
    limitations: "Published as XLSX sheets; coverage and vintage varies by indicator.",
    archivePath: "data/raw/mbs",
    processingScript: "scripts/scrape/mbs.ts",
  },
  {
    slug: "atolls-of-maldives",
    name: "Atolls of Maldives",
    organization: "Government of Maldives (heritage/encyclopedic site)",
    url: "https://www.atollsofmaldives.gov.mv/",
    datasetType: "encyclopedic",
    accessMethod: "scrape-html",
    category: "atolls",
    priority: 50,
    license: "Public government website; terms not formally published.",
    limitations:
      "Historical/encyclopedic archive. The site platform dates to 2013 and the last observable record update is August 2024; many island entries are far older. Island status, use and ownership (resort, agricultural and industrial leases) may have changed since publication. Valuable for history, environment notes and Dhivehi names.",
    archivePath: "data/raw/atollsofmaldives",
    processingScript: "scripts/scrape/atolls.ts",
  },
  {
    slug: "manual-verification",
    name: "Manual verification & corrections",
    organization: "Coalition for Open Governance",
    url: "https://github.com/coalition-for-open-governance/maldives-island-registry",
    datasetType: "registry",
    accessMethod: "manual",
    category: "manual",
    priority: 5,
    license: "CC0",
    limitations: "Only applied through the admin correction workflow with an audit trail.",
    archivePath: "data/raw/manual",
    processingScript: "scripts/etl/apply-corrections.ts",
  },
  // Future sources — registered now so the UI can disclose planned coverage.
  {
    slug: "epa-protected-areas",
    name: "EPA Protected Areas (planned)",
    organization: "Environmental Protection Agency, Maldives",
    url: "https://www.epa.gov.mv/",
    datasetType: "geospatial",
    accessMethod: "file-download",
    category: "future",
    priority: 60,
    limitations: "Not yet ingested. Placeholder registered for upcoming protected-area dataset.",
  },
  {
    slug: "tourism-ministry",
    name: "Ministry of Tourism resort registry (planned)",
    organization: "Ministry of Tourism, Maldives",
    url: "https://www.tourism.gov.mv/",
    datasetType: "registry",
    accessMethod: "file-download",
    category: "future",
    priority: 60,
    limitations: "Not yet ingested. Placeholder for resort/guesthouse registry.",
  },
];

async function main() {
  for (const s of SOURCES) {
    await prisma.source.upsert({
      where: { slug: s.slug },
      create: s,
      update: s,
    });
    console.log(`Seeded source: ${s.slug}`);
  }
  await prisma.auditLog.create({
    data: { actor: "system", action: "db:seed", detail: `Seeded ${SOURCES.length} sources` },
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
