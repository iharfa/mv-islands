# Source reconnaissance (2026-06-11)

Verified live endpoints used by the scrapers.

## 1. OneMap Maldives (ArcGIS Online, org `maldives-mlsa`)
- App: https://onemap.mv/ (Esri Web AppBuilder; config at /config.json)
- Portal: https://maldives-mlsa.maps.arcgis.com (webmap item 577c922690e74253aa03e18ce443cebc)
- **Island polygons**: `https://services7.arcgis.com/yvCbn3q8PPtPLZIM/arcgis/rest/services/island_20240509/FeatureServer/0`
  - 1,561 polygon features, maxRecordCount 1000 (paginate with resultOffset)
  - Fields: OBJECTID, FCODE, atoll, islandName, capital, islandNa_1 (Dhivehi name), longitude (DMS), latitude (DMS), Area_ha, category, Sector, Usage, PrimAgency
- Other layers: `Onemap_Latest/FeatureServer/0..2`, `reef/FeatureServer/0`, `bathymetry/MapServer/0`
- **Island list CSV**: https://readme.onemap.mv/csv/IslandList_20211101.csv (same schema, 2021 vintage)

## 2. MBS StatsMap (qgis2web static export — no Playwright needed)
- App: https://statisticsmaldives.gov.mv/gismaps/statsmap/
- Layers are static GeoJSON-in-JS at `layers/<Name>_<n>.js` (`var json_<Name>_<n> = {FeatureCollection}`)
- 26 layers incl: Reef_0, AdministrativeIsland_2, veg_3, wetland_6, Airport_10,
  Uninhabited_11, OtherInhabited_12, AtollCapital_13, Hotels_14, GuestHouse_15, Resort_16,
  AtollBoundaryLine_20, AdministrativeAtoll_21, IslandName_23, ProtectedAreaEPA_25
- AdministrativeIsland_2 properties: FCODE, IslandName, Atoll (code), islandCode,
  longitude, latitude, v01..v07 (census population values: v01 total, v02 male, v03 female,
  v04 Maldivian resident, v07 households — verify against census tables), category, capital, fname
- **FCODE is shared with OneMap → primary join key.**
- EPA protected-area layer is attributed to EPA in the site disclaimer.

## 3. Census 2022 tables (census.gov.mv)
- Listing page: https://statisticsmaldives.gov.mv/census-2022/
- XLSX tables at https://census.gov.mv/2022/wp-content/uploads/2023/03/Table-P1.xlsx … P8, H1…H6
  (plus amended/final versions under uploads/2023/07/)
- Indicator sheets: https://statisticsmaldives.gov.mv/mbs/wp-content/uploads/2025/08/parliment_indicator-pop.xlsx (-edu, -emp)

## 4. Atolls of Maldives (www.atollsofmaldives.gov.mv)
- robots.txt: `Disallow:` (everything allowed); sitemap.xml lists 500 URLs
- 20 atoll pages: `/atolls/<Atoll-Name>` ; 469 island pages: `/atolls/<Atoll>/<Island>-%28I|U|R%29/<id>`
  (I=inhabited, U=uninhabited, R=resort)
- Island page: `h1` in `.block-title` = "Name (R) - [ Atoll Name (X Atoll) ]";
  zozoTabs sections with `h3` headings (General Information, Soil Details, Land - Natural
  Vegetation, Wet Lands, Costal/Beach Area, Vegetation, Aquatic, Field Area, Animal Husbandry,
  Processing, Protected & Sensitive, Historical Data, Infrastructure, Invasive Species,
  Local birds in the island, Migratory Birds, Other Feature, Island Gallery)
- Fields are `<table><tr><td>label</td><td>value</td>` pairs: DMS Latitude/Longitude, Area (ha),
  Length (m), Width (m), Island status, Leased info, nearest airport/island/resort + proximities,
  bait/reef fish, purpose, protected area, invasive species, mangroves, soil metrics, etc.
- Gallery images via fancybox/lightbox links.
