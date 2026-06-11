# Maldives Island Registry

**Open data registry, archive, map explorer and correction system for every island in the Maldives** — built by the Coalition for Open Governance.

> “Open Data redistributes power that has been consolidated by a few. Those who benefit from secrecy will fight it. They will lose. Open Data is inevitable, question is will you proactively embrace it?” — *Ahmed Afrah Ismail, Coalition for Open Governance*

The registry consolidates four live sources — **OneMap Maldives** (1,561 island polygons), **Census 2022** island tables, **MBS StatsMap** (population + EPA protected areas, reefs, wetlands) and the **Atolls of Maldives** archive (469 island pages with environment, infrastructure and history) — into one source-first database. Every public value keeps its original source record; when sources disagree, the conflict is published, never overwritten.

For every island the public can answer: **What do we know? Where did it come from? Which sources disagree? What needs review?**

## Tech stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Prisma · SQLite (local) / PostgreSQL+PostGIS (production) · MapLibre GL JS · Recharts · Cheerio · SheetJS · Vitest · Playwright · GitHub Actions.

## Local development (SQLite — no Docker, no admin rights needed)

Everything runs with a user-level Node.js ≥20 install. Docker is **not** required locally.

```bash
npm install
cp .env.example .env          # DATABASE_URL defaults to SQLite at data/registry.db
npx prisma migrate dev        # create the database
npm run db:seed               # register the source registry
npm run dev                   # http://localhost:3000
```

The app works with an empty database (pages show clearly-labeled empty states). To load real data, either **restore the committed snapshot** (fastest, no scraping):

```bash
npm run snapshot:restore -- 2026-06-11
```

…or run the full pipeline yourself:

```bash
npm run scrape:onemap         # ArcGIS island polygons (~1 min)
npm run scrape:statsmap       # StatsMap layers incl. census values (~1 min)
npm run scrape:mbs            # Census 2022 XLSX tables (~1 min)
npm run scrape:atolls         # 469 island pages, rate-limited (~13 min)
npm run etl:normalize         # rebuild registry from raw archives
npm run etl:match-islands     # cross-source matching (FCODE → name → fuzzy → spatial)
npm run etl:detect-conflicts  # conflicts, canonical selection, completeness scores
```

All scrapers cache responses on disk — re-runs never re-hit the sources. Each source can fail independently; the registry runs on whatever data exists.

## Environment variables (`.env.example`)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | `file:../data/registry.db` (SQLite) or a PostgreSQL URL |
| `NEXT_PUBLIC_BASE_URL` | Public base URL for exports/docs |
| `ADMIN_TOKEN` | Token for the placeholder admin login |
| `SCRAPER_DELAY_MS` / `SCRAPER_MAX_RETRIES` | Scraper politeness |
| `SNAPSHOT_DATE` / `SCRAPE_LIMIT` | Pipeline overrides |

## Commands

| Command | What it does |
|---|---|
| `npm run scrape:{onemap,statsmap,mbs,atolls}` | Scrape one source (raw data archived first) |
| `npm run etl:{normalize,match-islands,detect-conflicts}` | ETL pipeline |
| `npm run db:seed` / `npm run db:reset` | Seed / wipe-and-reseed |
| `npm run export:csv` / `export:geojson` | Write datasets to `data/exports/` |
| `npm run snapshot:create` | Build `data/snapshots/<date>/` (raw + processed + metadata + SQLite + Postgres dump + checksums) |
| `npm run snapshot:validate -- <date>` | Verify structure, manifest and SHA-256 checksums |
| `npm run snapshot:export -- <date>` | Zip the snapshot for release |
| `npm run snapshot:release -- <date>` | Create GitHub release + attach the zip (`gh` CLI) |
| `npm run snapshot:restore -- <date>` | Restore the local DB from a snapshot |
| `npm test` / `npm run test:e2e` | Vitest unit tests / Playwright mobile+desktop tests |

## Restoring the dataset from GitHub

The repository commits full snapshots under [`data/snapshots/2026-06-11/`](data/snapshots/2026-06-11/):

```
raw/            untouched source archives (HTML, GeoJSON, XLSX)
processed/      islands_canonical.{csv,geojson}, islands_all_source_values.csv,
                islands_conflicts.csv, atolls.csv, population.csv, source_registry.csv
metadata/       snapshot_manifest.json, data_dictionary.md, source_inventory.md,
                scrape_report.md, conflict_report.md, checksums.sha256
database/       registry_snapshot_2026-06-11.sqlite, postgres_dump_2026-06-11.sql
```

- **SQLite (no extra software):** `npm run snapshot:restore -- 2026-06-11`
- **PostgreSQL:** `createdb island_registry && psql island_registry -f data/snapshots/2026-06-11/database/postgres_dump_2026-06-11.sql`
- **Verify integrity:** `npm run snapshot:validate -- 2026-06-11` (recomputes all SHA-256 checksums)

A weekly GitHub Actions workflow ([`.github/workflows/data-snapshot.yml`](.github/workflows/data-snapshot.yml)) re-scrapes all sources, rebuilds the registry, commits dated snapshots and attaches zips to GitHub Releases. It fails loudly if the backbone source (OneMap) fails and saves partial results when a secondary source fails.

## Data sources & disclosure

| Source | What it provides | Priority |
|---|---|---|
| Manual verification | Reviewed corrections (audited) | 5 |
| OneMap Maldives (ArcGIS) | Island polygons, names, Dhivehi names, categories — the registry backbone | 10 |
| Census 2022 (MBS) | Resident population by island & sex | 20 |
| MBS StatsMap | Population layer, EPA protected areas, reefs, wetlands | 30 |
| Indicator sheets (MBS) | Island/atoll indicators | 40 |
| Atolls of Maldives | Environment, infrastructure, history, images | 50 |

Every field value is stored in the universal `field_values` table with raw value, normalized value, confidence, verification status, scrape/publish/verify dates and source URL. The **canonical** display value is chosen by source priority — the choice and its reason are stored, and *lower-priority values are never deleted*. Conflict detection compares values across sources (name/atoll/status/coordinate/area/population mismatches, duplicates, missing-in-source, census-without-geometry) with severity levels low → critical. See `/sources`, `/conflicts` and [docs/data-dictionary.md](docs/data-dictionary.md).

## Production deployment (optional, on a server — not needed locally)

`docker-compose up` builds the app and a PostGIS database (see `docker-compose.yml`, `Dockerfile`). Alternatively deploy to any Node host with a `DATABASE_URL` pointing at Postgres and run `npx prisma migrate deploy`. To use Postgres, switch the `provider` in `prisma/schema.prisma` to `postgresql` and re-generate.

## Known limitations

- 429 of 1,561 OneMap features have no island name and are kept only in raw archives.
- Census island tables cover administrative islands (~190); resorts/industrial islands have no published island-level population.
- Malé wards and a few special census rows (e.g. "Non-admin islands") are intentionally unmatched — listed in scrape/ETL logs.
- StatsMap male/female semantics (`v02`/`v03`) were verified against Census P5 but remain a derived interpretation; raw values are preserved.
- Atolls of Maldives data is historical: coordinates/areas/statuses can be outdated (priority-ranked below current registries; valuable for history/environment).
- Admin authentication is a placeholder token; replace before multi-user production use.
- PDF island summaries and EPA/Tourism Ministry datasets are planned, clearly labeled as such in the UI.

## Contributing

1. Fork, branch, `npm install`, restore the snapshot.
2. Scrapers must follow the politeness rules in [docs/scrapers.md](docs/scrapers.md); raw data is always archived before parsing and never discarded.
3. Never auto-resolve conflicts; corrections go through the admin correction workflow with an audit log.
4. `npm test && npx tsc --noEmit` must pass; add Playwright coverage for new pages (mobile + desktop).

Further docs: [data dictionary](docs/data-dictionary.md) · [source recon](docs/source-recon.md) · [scrapers](docs/scrapers.md) · [project brief](docs/project_brief_maldives_island_registry.md) · API docs at `/api-docs`.
