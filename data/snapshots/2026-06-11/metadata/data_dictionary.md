# Data dictionary

## islands_canonical.csv
One row per island in the registry (backbone: OneMap island layer).

- `slug` — stable registry identifier (`<atoll-code>-<normalized-name>`)
- `name` — official island name (canonical value)
- `dhivehi_name` — Dhivehi (Thaana) name where available
- `atoll_code` / `atoll_name` — administrative atoll
- `status` — inhabited | uninhabited | resort | industrial | airport | agricultural
- `island_type` — original source category string
- `use_category` — declared usage (e.g. Resort, Agriculture)
- `lat` / `lng` — decimal degrees (WGS84), converted from source DMS
- `area_sq_km` — land area (OneMap `Area_ha` / 100)
- `overall_completeness` — 0–100 composite completeness score
- `unresolved_conflicts` — count of open cross-source conflicts
- `last_updated` — last ETL touch (ISO 8601)

## islands_all_source_values.csv
The full source-first value store. One row per (island, field, source).

- `island_slug`, `field_name`
- `source` — source slug (see source_registry.csv)
- `raw_value` — value exactly as published by the source
- `normalized_value` — value after unit/format normalization
- `is_canonical` — whether this row is the displayed value
- `confidence_score` — 0–1 (includes match confidence)
- `verification_status` — unverified | verified | disputed | outdated
- `date_scraped` / `date_published` / `date_verified`
- `source_url` — direct link to the source record
- `notes`

Field-name conventions: plain names (`population_total`, `lat`, `area_ha`) are
normalized registry fields; prefixed names (`env :: …`, `infra :: …`,
`history :: …`, `notes :: …`, `other :: …`) preserve the original section and
label from the Atolls of Maldives archive.

## islands_conflicts.csv
One row per detected cross-source disagreement.

- `conflict_id`, `island`, `island_slug`, `atoll`, `field_name`
- `conflict_type` — value-mismatch | missing-in-source | duplicate | no-census-match | …
- `severity` — low | medium | high | critical
- `status` — unresolved | under_review | resolved | source_outdated | needs_external_confirmation
- `canonical_value` — currently displayed value
- `source_values` — JSON array `[{source, rawValue, normalizedValue, url, dateScraped, confidence}]`
- `confidence_score`, `reviewer_note`, `detected_at`, `reviewed_at`

Severity rules: spelling variation → low; population/area/coordinate mismatch →
medium (coordinates >5 km → high, >55 km → critical); atoll mismatch or island
missing from an official layer → high; same name on different geometry → critical.

## population.csv
One row per (island, source) population record.

- `island_slug`, `island_name`, `atoll`, `source`, `census_year`
- `total`, `male`, `female`, `resident_maldivian`, `households`
- `fetched_at`

## atolls.csv
- `code` — administrative code (HA … S, Male)
- `name` — administrative name
- `natural_atoll` — traditional/natural atoll name
- `island_count`

## source_registry.csv
- `slug`, `name`, `organization`, `url`, `dataset_type`, `access_method`, `category`
- `priority` — canonical priority (lower wins): manual 5 → OneMap 10 → Census 20 → StatsMap 30 → indicators 40 → Atolls of Maldives 50
- `license`, `limitations`, `archive_path`, `processing_script`
- `last_scrape`, `last_scrape_status`, `records_collected`, `field_values`, `documents`

## islands_canonical.geojson
FeatureCollection (WGS84). Polygon geometry from OneMap (point fallback).
Properties: `slug`, `name`, `dhivehiName`, `atoll`, `status`, `areaSqKm`,
`completeness`, `conflicts`.

## Database snapshots
- `registry_snapshot_<date>.sqlite` — full SQLite database, usable directly
  (`DATABASE_URL=file:../data/registry.db`)
- `postgres_dump_<date>.sql` — PostgreSQL-compatible dump
  (`createdb island_registry && psql island_registry -f <file>`)
