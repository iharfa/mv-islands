# Source inventory — snapshot 2026-06-11

## OneMap Maldives (National Geospatial Portal)
- Organization: Ministry of National Planning / National GIS
- URL: https://onemap.mv/
- Type/access: geospatial via arcgis-rest
- Canonical priority: 10
- License: Public government geospatial data; terms not formally published.
- Limitations: Service availability varies; attribute completeness differs by layer. Geometry is authoritative; thematic attributes may lag.
- Raw archive: data/raw/onemap
- Processing script: scripts/scrape/onemap.ts
- Last run: success (1561 records, 2026-06-11T06:23:17.226Z)

## Maldives Population & Housing Census 2022
- Organization: Maldives Bureau of Statistics
- URL: https://census.gov.mv/2022/
- Type/access: statistical via file-download
- Canonical priority: 20
- License: Official statistics; free reuse with attribution.
- Limitations: Island-level tables cover administrative islands only; resorts/industrial islands are aggregated separately.
- Raw archive: data/raw/mbs
- Processing script: scripts/scrape/mbs.ts
- Last run: success (389 records, 2026-06-11T06:36:15.323Z)

## MBS StatsMap (GIS population map)
- Organization: Maldives Bureau of Statistics
- URL: https://statisticsmaldives.gov.mv/gismaps/statsmap/
- Type/access: geospatial via playwright-network
- Canonical priority: 30
- License: Official statistics; free reuse with attribution.
- Limitations: Derived web-map dataset; values can lag the published census tables it visualises.
- Raw archive: data/raw/statsmap
- Processing script: scripts/scrape/statsmap.ts
- Last run: success (7086 records, 2026-06-11T06:24:08.234Z)

## Island & Atoll Level Indicator Sheets
- Organization: Maldives Bureau of Statistics
- URL: https://statisticsmaldives.gov.mv/
- Type/access: statistical via file-download
- Canonical priority: 40
- License: Official statistics; free reuse with attribution.
- Limitations: Published as XLSX sheets; coverage and vintage varies by indicator.
- Raw archive: data/raw/mbs
- Processing script: scripts/scrape/mbs.ts
- Last run: success (3 records, 2026-06-11T06:36:15.336Z)

## Atolls of Maldives
- Organization: Government of Maldives (heritage/encyclopedic site)
- URL: https://www.atollsofmaldives.gov.mv/
- Type/access: encyclopedic via scrape-html
- Canonical priority: 50
- License: Public government website; terms not formally published.
- Limitations: Historical/encyclopedic record. Coordinates, areas and statuses can be outdated; valuable for history, environment notes and Dhivehi names.
- Raw archive: data/raw/atollsofmaldives
- Processing script: scripts/scrape/atolls.ts
- Last run: success (469 records, 2026-06-11T06:36:32.718Z)

## Manual verification & corrections
- Organization: Coalition for Open Governance
- URL: https://github.com/coalition-for-open-governance/maldives-island-registry
- Type/access: registry via manual
- Canonical priority: 5
- License: CC0
- Limitations: Only applied through the admin correction workflow with an audit trail.
- Raw archive: data/raw/manual
- Processing script: scripts/etl/apply-corrections.ts
- Last run: never

## EPA Protected Areas (planned)
- Organization: Environmental Protection Agency, Maldives
- URL: https://www.epa.gov.mv/
- Type/access: geospatial via file-download
- Canonical priority: 60
- License: not formally published
- Limitations: Not yet ingested. Placeholder registered for upcoming protected-area dataset.
- Raw archive: —
- Processing script: —
- Last run: never

## Ministry of Tourism resort registry (planned)
- Organization: Ministry of Tourism, Maldives
- URL: https://www.tourism.gov.mv/
- Type/access: registry via file-download
- Canonical priority: 60
- License: not formally published
- Limitations: Not yet ingested. Placeholder for resort/guesthouse registry.
- Raw archive: —
- Processing script: —
- Last run: never
