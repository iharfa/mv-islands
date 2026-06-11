# Scraper documentation

All scrapers are rate-limited (default 1.5 s between requests), disk-cached
(`data/cache/` — re-runs never re-hit sources), retried with exponential
backoff, and log every run to the `scrape_runs` table. Raw payloads are
archived under `data/raw/<source>/` **before** any parsing. Failures are
recorded per-URL and never abort the rest of a run.

## npm run scrape:onemap (`scripts/scrape/onemap.ts`)
Pulls the OneMap island polygon layer (`island_20240509/FeatureServer/0`,
1,561 features) via paginated GeoJSON queries, plus the published island list
CSV and metadata for supporting layers (reef, bathymetry, Onemap_Latest).
Archives: `island_features_offset_*.geojson`, `islands_all.geojson`,
`IslandList_20211101.csv`, layer metadata JSON.

## npm run scrape:statsmap (`scripts/scrape/statsmap.ts`)
The MBS StatsMap app is a qgis2web export whose layers are static GeoJSON
wrapped in JS assignments. Downloads 22 layers (admin islands with census
values, uninhabited, resorts, reefs, wetlands, vegetation, EPA protected
areas, atoll boundaries, schools, airports…). Heavy parcel-level layers are
skipped for politeness. Archives both the raw `.js` and extracted `.geojson`.
Field semantics on `AdministrativeIsland_2`: `v01`=total, `v02`=female,
`v03`=male, `v04`=Maldivian resident, `v07`=households (verified against
Census Table P5).

## npm run scrape:mbs (`scripts/scrape/mbs.ts`)
Downloads Census 2022 XLSX tables P1–P8 and H1–H6 from census.gov.mv plus the
island/atoll indicator sheets from statisticsmaldives.gov.mv. Parses Table P5
(resident population by island & sex) and P3 (2014/2022 comparison) into
`census_population_by_island.json`. All XLSX files are archived unmodified.

## npm run scrape:atolls (`scripts/scrape/atolls.ts`)
Crawls www.atollsofmaldives.gov.mv via its sitemap (robots.txt allows all):
20 atoll pages + 469 island pages. Each island page is a tabbed label/value
document covering geography, environment (vegetation, wetlands, protected
areas, birds, invasive species), infrastructure, history and a photo gallery.
Raw HTML for every page is archived; parsed output goes to
`parsed_islands.json`. Set `SCRAPE_LIMIT=25` for a quick partial crawl.

## Respectful scraping rules (enforced in `scripts/lib/http.ts`)
- ≥1.5 s between requests (configurable `SCRAPER_DELAY_MS`)
- on-disk response cache; reruns are free
- exponential backoff, max 3 retries (`SCRAPER_MAX_RETRIES`)
- descriptive User-Agent identifying the project
- no authentication bypass, no private areas, public pages only
