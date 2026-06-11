"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export default function EnvironmentMap() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const map = new maplibregl.Map({
      container: ref.current,
      style: {
        version: 8,
        sources: {
          base: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "© OpenStreetMap contributors",
          },
        },
        layers: [{ id: "base", type: "raster", source: "base" }],
      },
      center: [73.4, 3.9],
      zoom: 5.2,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.on("load", async () => {
      for (const [name, color] of [["reefs", "#00CED1"], ["protected-areas", "#228B22"]] as const) {
        try {
          const res = await fetch(`/api/layers/${name}`);
          if (!res.ok) continue;
          map.addSource(name, { type: "geojson", data: await res.json() });
          map.addLayer({ id: `${name}-fill`, type: "fill", source: name, paint: { "fill-color": color, "fill-opacity": 0.35 } });
          map.addLayer({ id: `${name}-line`, type: "line", source: name, paint: { "line-color": color, "line-width": 1 } });
        } catch { /* layer unavailable — labeled in UI */ }
      }
    });
    return () => map.remove();
  }, []);

  return <div ref={ref} className="h-[360px] md:h-[420px] w-full" />;
}
