"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import maplibregl, { Map as MlMap, MapMouseEvent } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import Link from "next/link";
import { CompletenessBar, ConflictBadge, StatusBadge, SourceLine } from "@/components/ui";

interface IslandProps {
  slug: string; name: string; dhivehiName: string | null; atoll: string | null;
  status: string | null; areaSqKm: number | null; completeness: number; conflicts: number;
}
interface AtollOpt { code: string; name: string }

const STATUS_COLORS: Record<string, string> = {
  inhabited: "#01579B", resort: "#E65100", uninhabited: "#737780",
  industrial: "#6A1B9A", airport: "#00696b", agricultural: "#228B22",
};

const OVERLAYS: { id: string; label: string; source: string; color: string; attribution: string; url: string }[] = [
  { id: "protected-areas", label: "Protected areas (EPA)", source: "EPA via MBS StatsMap", color: "#228B22", attribution: "https://statisticsmaldives.gov.mv/gismaps/statsmap/", url: "/api/layers/protected-areas" },
  { id: "reefs", label: "Coral reefs", source: "MBS StatsMap", color: "#00CED1", attribution: "https://statisticsmaldives.gov.mv/gismaps/statsmap/", url: "/api/layers/reefs" },
  { id: "wetlands", label: "Wetlands", source: "MBS StatsMap", color: "#01579B", attribution: "https://statisticsmaldives.gov.mv/gismaps/statsmap/", url: "/api/layers/wetlands" },
];

const baseStyle = (satellite: boolean): maplibregl.StyleSpecification => ({
  version: 8,
  sources: {
    base: {
      type: "raster",
      tiles: [
        satellite
          ? "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          : "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution: satellite
        ? "Imagery © Esri, Maxar, Earthstar Geographics"
        : "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "base", type: "raster", source: "base" }],
});

export default function MapExplorer() {
  const mapRef = useRef<MlMap | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [satellite, setSatellite] = useState(false);
  const [theme, setTheme] = useState<"status" | "completeness" | "conflicts">("status");
  const [selected, setSelected] = useState<IslandProps | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<GeoJSON.Feature | null>(null);
  const [panelOpen, setPanelOpen] = useState(false); // mobile filter drawer
  const [atolls, setAtolls] = useState<AtollOpt[]>([]);
  const [atollFilter, setAtollFilter] = useState("");
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [conflictsOnly, setConflictsOnly] = useState(false);
  const [minCompleteness, setMinCompleteness] = useState(0);
  const [overlays, setOverlays] = useState<Record<string, boolean>>({});
  const [overlayErrors, setOverlayErrors] = useState<Record<string, boolean>>({});
  const [coords, setCoords] = useState<string>("");
  const [measurePts, setMeasurePts] = useState<[number, number][]>([]);
  const [measuring, setMeasuring] = useState(false);
  const [q, setQ] = useState("");
  const dataRef = useRef<GeoJSON.FeatureCollection | null>(null);

  const applyIslandLayers = useCallback((map: MlMap) => {
    if (!map.getSource("islands") && dataRef.current) {
      map.addSource("islands", { type: "geojson", data: dataRef.current });
    }
    if (!map.getSource("islands")) return;
    for (const id of ["islands-fill", "islands-outline", "islands-conflict", "islands-label"]) {
      if (map.getLayer(id)) map.removeLayer(id);
    }
    const fillColor: maplibregl.ExpressionSpecification | string =
      theme === "status"
        ? ["match", ["get", "status"],
            "inhabited", STATUS_COLORS.inhabited, "resort", STATUS_COLORS.resort,
            "industrial", STATUS_COLORS.industrial, "airport", STATUS_COLORS.airport,
            "agricultural", STATUS_COLORS.agricultural, STATUS_COLORS.uninhabited]
        : theme === "completeness"
        ? ["interpolate", ["linear"], ["get", "completeness"], 0, "#B71C1C", 50, "#E65100", 80, "#228B22"]
        : ["case", [">", ["get", "conflicts"], 0], "#B71C1C", "#737780"];

    map.addLayer({ id: "islands-fill", type: "fill", source: "islands",
      paint: { "fill-color": fillColor as never, "fill-opacity": 0.65 } });
    map.addLayer({ id: "islands-outline", type: "line", source: "islands",
      paint: { "line-color": "#003366", "line-width": 0.6 } });
    map.addLayer({ id: "islands-conflict", type: "line", source: "islands",
      filter: [">", ["get", "conflicts"], 0],
      paint: { "line-color": "#B71C1C", "line-width": 2 } });
    map.addLayer({ id: "islands-label", type: "symbol", source: "islands", minzoom: 10,
      layout: { "text-field": ["get", "name"], "text-size": 11, "text-anchor": "center" },
      paint: { "text-color": "#003366", "text-halo-color": "#ffffff", "text-halo-width": 1.5 } });
  }, [theme]);

  // Init map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: baseStyle(false),
      center: [73.4, 3.9],
      zoom: 5.5,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    mapRef.current = map;

    map.on("load", async () => {
      try {
        const res = await fetch("/api/downloads/islands.geojson");
        dataRef.current = await res.json();
        applyIslandLayers(map);
      } catch { /* islands unavailable — base map still works */ }
    });

    map.on("mousemove", (e: MapMouseEvent) => {
      setCoords(`${e.lngLat.lat.toFixed(5)}°, ${e.lngLat.lng.toFixed(5)}°`);
    });

    const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 8 });
    map.on("mousemove", "islands-fill", (e) => {
      map.getCanvas().style.cursor = "pointer";
      const f = e.features?.[0];
      if (!f) return;
      const p = f.properties as unknown as IslandProps;
      popup.setLngLat(e.lngLat).setHTML(
        `<div style="font-family:Inter,sans-serif;background:#003366;color:#fff;margin:-10px -10px;padding:8px 12px;border-radius:4px;font-size:12px">
          <strong>${p.name}</strong> · ${p.atoll ?? ""}<br/>${p.status ?? "unknown"} · ${p.completeness}% complete${p.conflicts ? ` · ⚠ ${p.conflicts}` : ""}
        </div>`,
      ).addTo(map);
    });
    map.on("mouseleave", "islands-fill", () => { map.getCanvas().style.cursor = ""; popup.remove(); });

    return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Click handling (selection or measuring)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const onClick = (e: MapMouseEvent) => {
      if (measuring) {
        setMeasurePts((pts) => [...pts, [e.lngLat.lng, e.lngLat.lat]]);
        return;
      }
      const feats = map.queryRenderedFeatures(e.point, { layers: map.getLayer("islands-fill") ? ["islands-fill"] : [] });
      if (feats.length) {
        const f = feats[0];
        setSelected(f.properties as unknown as IslandProps);
        setSelectedFeature({ type: "Feature", properties: f.properties, geometry: f.geometry } as GeoJSON.Feature);
      } else {
        setSelected(null);
        setSelectedFeature(null);
      }
    };
    map.on("click", onClick);
    return () => { map.off("click", onClick); };
  }, [measuring]);

  // Theme/style changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (map.isStyleLoaded()) applyIslandLayers(map);
  }, [theme, applyIslandLayers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setStyle(baseStyle(satellite));
    map.once("styledata", () => {
      applyIslandLayers(map);
      // re-add active overlays
      for (const ov of OVERLAYS) if (overlays[ov.id]) void addOverlay(map, ov.id);
      applyFilter(map);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [satellite]);

  // Filters
  const applyFilter = useCallback((map: MlMap) => {
    if (!map.getLayer("islands-fill")) return;
    const conds: unknown[] = ["all"];
    if (atollFilter) conds.push(["==", ["get", "atoll"], atollFilter]);
    if (statusFilters.length) conds.push(["in", ["get", "status"], ["literal", statusFilters]]);
    if (conflictsOnly) conds.push([">", ["get", "conflicts"], 0]);
    if (minCompleteness > 0) conds.push([">=", ["get", "completeness"], minCompleteness]);
    const filter = conds.length > 1 ? (conds as never) : null;
    for (const id of ["islands-fill", "islands-outline", "islands-label"]) map.setFilter(id, filter);
    if (map.getLayer("islands-conflict"))
      map.setFilter("islands-conflict", filter
        ? (["all", filter, [">", ["get", "conflicts"], 0]] as never)
        : ([">", ["get", "conflicts"], 0] as never));
  }, [atollFilter, statusFilters, conflictsOnly, minCompleteness]);

  useEffect(() => {
    const map = mapRef.current;
    if (map?.isStyleLoaded()) applyFilter(map);
  }, [applyFilter]);

  // Overlays
  async function addOverlay(map: MlMap, id: string) {
    const ov = OVERLAYS.find((o) => o.id === id)!;
    try {
      if (!map.getSource(`ov-${id}`)) {
        const res = await fetch(ov.url);
        if (!res.ok) throw new Error("unavailable");
        const data = await res.json();
        map.addSource(`ov-${id}`, { type: "geojson", data });
      }
      if (!map.getLayer(`ov-${id}-fill`)) {
        map.addLayer({ id: `ov-${id}-fill`, type: "fill", source: `ov-${id}`,
          paint: { "fill-color": ov.color, "fill-opacity": 0.3 } });
        map.addLayer({ id: `ov-${id}-line`, type: "line", source: `ov-${id}`,
          paint: { "line-color": ov.color, "line-width": 1 } });
      }
    } catch {
      setOverlayErrors((e) => ({ ...e, [id]: true }));
      setOverlays((o) => ({ ...o, [id]: false }));
    }
  }
  function toggleOverlay(id: string) {
    const map = mapRef.current;
    if (!map) return;
    const next = !overlays[id];
    setOverlays((o) => ({ ...o, [id]: next }));
    if (next) void addOverlay(map, id);
    else for (const lid of [`ov-${id}-fill`, `ov-${id}-line`]) if (map.getLayer(lid)) map.removeLayer(lid);
  }

  // Measurement
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const src = map.getSource("measure") as maplibregl.GeoJSONSource | undefined;
    const data: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: measurePts.length > 1
        ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: measurePts } }]
        : [],
    };
    if (src) src.setData(data);
    else if (measurePts.length > 1) {
      map.addSource("measure", { type: "geojson", data });
      map.addLayer({ id: "measure-line", type: "line", source: "measure",
        paint: { "line-color": "#E65100", "line-width": 2.5, "line-dasharray": [2, 1] } });
    }
  }, [measurePts]);

  const measureKm = measurePts.reduce((sum, pt, idx) => {
    if (idx === 0) return 0;
    const [lng1, lat1] = measurePts[idx - 1];
    const [lng2, lat2] = pt;
    const R = 6371, dLat = ((lat2 - lat1) * Math.PI) / 180, dLon = ((lng2 - lng1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    return sum + 2 * R * Math.asin(Math.sqrt(a));
  }, 0);

  // Search jump
  async function handleSearch(value: string) {
    setQ(value);
    if (!value.trim() || !dataRef.current) return;
  }
  function jumpToIsland(name: string) {
    const map = mapRef.current;
    const f = dataRef.current?.features.find(
      (ft) => (ft.properties as IslandProps).name.toLowerCase().includes(name.toLowerCase()),
    );
    if (f && map) {
      const p = f.properties as unknown as IslandProps;
      const bounds = new maplibregl.LngLatBounds();
      const addCoords = (c: unknown): void => {
        if (typeof (c as number[])[0] === "number") bounds.extend(c as [number, number]);
        else (c as unknown[]).forEach(addCoords);
      };
      addCoords((f.geometry as GeoJSON.Polygon).coordinates);
      map.fitBounds(bounds, { padding: 80, maxZoom: 13 });
      setSelected(p);
      setSelectedFeature(f);
    }
  }

  function downloadFeature() {
    if (!selectedFeature || !selected) return;
    const blob = new Blob([JSON.stringify(selectedFeature, null, 2)], { type: "application/geo+json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${selected.slug}.geojson`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  useEffect(() => {
    fetch("/api/atolls").then((r) => r.json()).then((d) => setAtolls(d.atolls ?? [])).catch(() => {});
  }, []);

  const filterPanel = (
    <div className="space-y-4 text-sm">
      <div>
        <label className="label-md text-ink-soft block mb-1" htmlFor="map-search">Island search</label>
        <div className="flex gap-2">
          <input id="map-search" value={q} onChange={(e) => void handleSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && jumpToIsland(q)}
            placeholder="e.g. Maafushi" className="flex-1 border border-border-subtle rounded px-3 py-2.5 min-h-[44px] focus:border-reef outline-none" />
          <button className="btn btn-ocean" onClick={() => jumpToIsland(q)} aria-label="Search">Go</button>
        </div>
      </div>
      <div>
        <label className="label-md text-ink-soft block mb-1" htmlFor="map-atoll">Atoll</label>
        <select id="map-atoll" value={atollFilter} onChange={(e) => setAtollFilter(e.target.value)}
          className="w-full border border-border-subtle rounded px-3 py-2.5 min-h-[44px] bg-white">
          <option value="">All atolls</option>
          {atolls.map((a) => <option key={a.code} value={a.code}>{a.name} ({a.code})</option>)}
        </select>
      </div>
      <fieldset>
        <legend className="label-md text-ink-soft mb-1">Island status</legend>
        <div className="flex flex-wrap gap-1.5">
          {Object.keys(STATUS_COLORS).map((s) => (
            <button key={s} type="button"
              onClick={() => setStatusFilters((f) => f.includes(s) ? f.filter((x) => x !== s) : [...f, s])}
              className={`badge min-h-[32px] px-3 cursor-pointer border ${statusFilters.includes(s) ? "border-ocean bg-ocean text-white" : "border-border-subtle bg-white text-ink-soft"}`}>
              <span className="w-2 h-2 rounded-full inline-block" style={{ background: STATUS_COLORS[s] }} />{s}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="flex items-center justify-between gap-2">
        <label className="text-sm" htmlFor="map-conf">Only islands with conflicts</label>
        <input id="map-conf" type="checkbox" checked={conflictsOnly} onChange={(e) => setConflictsOnly(e.target.checked)} className="w-5 h-5 accent-[#003366]" />
      </div>
      <div>
        <label className="label-md text-ink-soft block mb-1" htmlFor="map-comp">Min completeness: {minCompleteness}%</label>
        <input id="map-comp" type="range" min={0} max={100} step={5} value={minCompleteness}
          onChange={(e) => setMinCompleteness(Number(e.target.value))} className="w-full accent-[#00CED1]" />
      </div>
      <div>
        <p className="label-md text-ink-soft mb-1">Color theme</p>
        <div className="flex gap-1.5 flex-wrap">
          {(["status", "completeness", "conflicts"] as const).map((t) => (
            <button key={t} onClick={() => setTheme(t)}
              className={`btn min-h-[36px] px-3 py-1 text-xs ${theme === t ? "btn-ocean" : "btn-secondary"}`}>{t}</button>
          ))}
        </div>
      </div>
      <div>
        <p className="label-md text-ink-soft mb-1">Overlay layers</p>
        {OVERLAYS.map((ov) => (
          <div key={ov.id} className="py-1.5 border-b border-border-subtle last:border-0">
            <label className="flex items-center justify-between gap-2 min-h-[36px]">
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm inline-block" style={{ background: ov.color }} />
                {ov.label}
              </span>
              <input type="checkbox" checked={!!overlays[ov.id]} onChange={() => toggleOverlay(ov.id)} className="w-5 h-5 accent-[#003366]" />
            </label>
            {overlayErrors[ov.id]
              ? <p className="text-[11px] text-danger">Data not yet available</p>
              : <SourceLine sourceName={ov.source} sourceUrl={ov.attribution} dateScraped={new Date()} />}
          </div>
        ))}
        <div className="py-1.5">
          <p className="text-xs text-ink-soft">Environmental & tourism datasets beyond these are <em>planned</em> — see <Link href="/sources" className="underline">source registry</Link>.</p>
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={() => setSatellite(!satellite)} className="btn btn-secondary flex-1">
          {satellite ? "Light base map" : "Satellite imagery"}
        </button>
        <button onClick={() => { setMeasuring(!measuring); if (measuring) setMeasurePts([]); }}
          className={`btn flex-1 ${measuring ? "btn-ocean" : "btn-secondary"}`}>
          {measuring ? `Measuring: ${measureKm.toFixed(2)} km (stop)` : "Measure"}
        </button>
      </div>
    </div>
  );

  const selectedPanel = selected && (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-bold text-ocean text-lg leading-tight">{selected.name}</h2>
          <p className="text-xs text-ink-soft">{selected.dhivehiName ?? ""} {selected.atoll ? `· ${selected.atoll}` : ""}</p>
        </div>
        <button aria-label="Close" onClick={() => setSelected(null)} className="p-2 min-h-[44px] min-w-[44px] text-ink-soft">✕</button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <StatusBadge status={selected.status} />
        <ConflictBadge count={selected.conflicts} />
        {selected.areaSqKm != null && <span className="badge badge-neutral">{Number(selected.areaSqKm).toFixed(2)} km²</span>}
      </div>
      <CompletenessBar score={selected.completeness} label="complete" />
      <div className="flex gap-2 pt-1">
        <Link href={`/islands/${selected.slug}`} className="btn btn-ocean flex-1">Open profile</Link>
        <button onClick={downloadFeature} className="btn btn-secondary flex-1">Download GeoJSON</button>
      </div>
    </div>
  );

  return (
    <div className="absolute inset-0 flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-[360px] shrink-0 bg-white border-r border-border-subtle overflow-y-auto p-5">
        <h1 className="font-bold text-ocean text-lg mb-4">Map Explorer</h1>
        {filterPanel}
      </aside>

      {/* Map canvas */}
      <div className="relative flex-1">
        <div ref={containerRef} className="absolute inset-0" />

        {/* Mobile top bar */}
        <div className="lg:hidden absolute top-3 left-3 right-14 flex gap-2 z-10">
          <input value={q} onChange={(e) => void handleSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && jumpToIsland(q)}
            placeholder="Search island…" aria-label="Search island"
            className="flex-1 bg-white border border-border-subtle rounded-full px-4 py-2.5 min-h-[44px] shadow-float text-sm outline-none focus:border-reef" />
          <button onClick={() => setPanelOpen(true)} aria-label="Open filters"
            className="bg-white border border-border-subtle rounded-full min-h-[44px] min-w-[44px] shadow-float text-ocean font-bold">⚙</button>
        </div>

        {/* Coordinates (desktop only) */}
        <div className="hidden md:block absolute bottom-2 right-2 z-10 bg-white/90 border border-border-subtle rounded px-2 py-1 text-[11px] tabular-nums text-ink-soft">
          {coords || "—"}
        </div>

        {measuring && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-ocean text-white rounded-full px-4 py-2 text-xs shadow-float">
            Click to measure · {measureKm.toFixed(2)} km
            <button className="ml-3 underline" onClick={() => setMeasurePts([])}>clear</button>
          </div>
        )}

        {/* Desktop selected island panel */}
        {selected && (
          <div className="hidden lg:block absolute bottom-4 left-4 z-10 card p-4 w-[340px] shadow-float">
            {selectedPanel}
          </div>
        )}

        {/* Mobile bottom sheet */}
        {selected && (
          <div className="lg:hidden absolute bottom-0 left-0 right-0 z-20 bg-white rounded-t-2xl border-t border-border-subtle shadow-float max-h-[45%] overflow-y-auto p-4 pb-6">
            <div className="w-10 h-1 rounded-full bg-border-subtle mx-auto mb-3" aria-hidden />
            {selectedPanel}
          </div>
        )}

        {/* Mobile filter drawer */}
        {panelOpen && (
          <div className="lg:hidden absolute inset-0 z-30 bg-black/40" onClick={() => setPanelOpen(false)}>
            <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[85%] overflow-y-auto p-5 pb-8"
              onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-ocean">Filters & layers</h2>
                <button aria-label="Close filters" onClick={() => setPanelOpen(false)} className="p-2 min-h-[44px] min-w-[44px]">✕</button>
              </div>
              {filterPanel}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
