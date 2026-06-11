"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export default function IslandMap({ geometry, lat, lng }: { geometry: string | null; lat: number | null; lng: number | null }) {
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
            tiles: ["https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
            tileSize: 256,
            attribution: "Imagery © Esri, Maxar, Earthstar Geographics",
          },
        },
        layers: [{ id: "base", type: "raster", source: "base" }],
      },
      center: lng != null && lat != null ? [lng, lat] : [73.4, 3.9],
      zoom: 12,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.on("load", () => {
      if (geometry) {
        try {
          const geom = JSON.parse(geometry);
          map.addSource("island", { type: "geojson", data: { type: "Feature", properties: {}, geometry: geom } });
          map.addLayer({ id: "island-fill", type: "fill", source: "island", paint: { "fill-color": "#00CED1", "fill-opacity": 0.15 } });
          map.addLayer({ id: "island-line", type: "line", source: "island", paint: { "line-color": "#00CED1", "line-width": 2.5 } });
          const bounds = new maplibregl.LngLatBounds();
          const add = (c: unknown): void => {
            if (typeof (c as number[])[0] === "number") bounds.extend(c as [number, number]);
            else (c as unknown[]).forEach(add);
          };
          add(geom.coordinates);
          map.fitBounds(bounds, { padding: 40, maxZoom: 15 });
        } catch { /* invalid geometry — point fallback already applied */ }
      } else if (lat != null && lng != null) {
        new maplibregl.Marker({ color: "#00CED1" }).setLngLat([lng, lat]).addTo(map);
      }
    });
    return () => map.remove();
  }, [geometry, lat, lng]);

  return <div ref={ref} className="h-[300px] md:h-[420px] w-full rounded-lg overflow-hidden border border-border-subtle" />;
}
