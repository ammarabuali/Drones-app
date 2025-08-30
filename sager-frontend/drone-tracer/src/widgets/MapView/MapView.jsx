import React, { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { MAPBOX_TOKEN } from "../../shared/config/env.js";
import { isAllowed } from "../../feature/drones/model/useDrones.js";

const DRONES_SOURCE = "drones-src";
const DRONES_LAYER = "drones-layer";
const PATHS_SOURCE = "paths-src";
const PATHS_LAYER = "paths-layer";

export default function MapView({ drones, selectedId, onSelect }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const [ready, setReady] = useState(false);

  const pathsRef = useRef(new Map());

  useEffect(() => {
    const byId = pathsRef.current;
    for (const d of drones) {
      const path = byId.get(d.id) || [];
      const last = path[path.length - 1];
      const next = [d.lon, d.lat];
      if (!last || last[0] !== next[0] || last[1] !== next[1]) {
        path.push(next);
        byId.set(d.id, path);
      }
    }
    const visible = new Set(drones.map((d) => d.id));
    for (const id of Array.from(byId.keys())) {
      if (!visible.has(id)) byId.delete(id);
    }
  }, [drones]);

  // Points GeoJSON
  const pointsFC = useMemo(
    () => ({
      type: "FeatureCollection",
      features: drones.map((d) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [d.lon, d.lat] },
        properties: {
          id: d.id,
          reg: d.registration,
          alt: d.altitude,
          yaw: d.yaw,
          firstSeenAt: d.firstSeenAt,
          allowed: isAllowed(d.registration),
        },
      })),
    }),
    [drones]
  );

  // Paths GeoJSON
  const pathsFC = useMemo(
    () => ({
      type: "FeatureCollection",
      features: Array.from(pathsRef.current.entries()).map(([id, coords]) => ({
        type: "Feature",
        geometry: { type: "LineString", coordinates: coords },
        properties: { id },
      })),
    }),
    [drones]
  );

  // Init map + layers
  useEffect(() => {
    if (!MAPBOX_TOKEN) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: [35.9313, 31.9488],
      zoom: 10,
      attributionControl: true,
    });
    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    mapRef.current = map;

    map.on("load", () => {
      map.addSource(DRONES_SOURCE, {
        type: "geojson",
        data: pointsFC,
        promoteId: "id",
      });
      map.addSource(PATHS_SOURCE, { type: "geojson", data: pathsFC });

      map.addLayer({
        id: DRONES_LAYER,
        type: "symbol",
        source: DRONES_SOURCE,
        layout: {
          "text-field": "▲",
          "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
          "text-size": 16,
          "text-rotate": ["get", "yaw"],
          "text-rotation-alignment": "map",
          "text-allow-overlap": true,
        },
        paint: {
          "text-color": [
            "case",
            ["boolean", ["get", "allowed"], false],
            "#16a34a",
            "#dc2626",
          ],
          "text-halo-color": "#ffffff",
          "text-halo-width": 0.75,
        },
      });

      // Hover popup (flight time + altitude)
      const popup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 8,
      });
      function fmt(seconds) {
        if (seconds < 60) return `${seconds}s`;
        const m = Math.floor(seconds / 60),
          s = seconds % 60;
        return `${m}:${String(s).padStart(2, "0")}`;
      }
      map.on("mousemove", DRONES_LAYER, (e) => {
        const f = e.features && e.features[0];
        if (!f) return;
        const props = f.properties || {};
        const firstSeenAt = Number(props.firstSeenAt || 0);
        const flightSec = firstSeenAt
          ? Math.max(0, Math.floor((Date.now() - firstSeenAt) / 1000))
          : 0;
        const alt = Math.round(Number(props.alt || 0));
        popup
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="font-family: system-ui, -apple-system, Segoe UI, Roboto; font-size:12px; line-height:1.2">
             <div><strong>${props.id || ""}</strong> · ${props.reg || ""}</div>
             <div>Flight time: ${fmt(flightSec)}</div>
             <div>Altitude: ${alt} m</div>
           </div>`
          )
          .addTo(map);
      });
      map.on("mouseleave", DRONES_LAYER, () => popup.remove());

      // Click → select (map -> list highlight)
      map.on(
        "mouseenter",
        DRONES_LAYER,
        () => (map.getCanvas().style.cursor = "pointer")
      );
      map.on(
        "mouseleave",
        DRONES_LAYER,
        () => (map.getCanvas().style.cursor = "")
      );
      map.on("click", DRONES_LAYER, (e) => {
        const f = e.features && e.features[0];
        const id = f?.properties?.id;
        if (id) onSelect?.(id);
      });

      // Paths
      map.addLayer({
        id: PATHS_LAYER,
        type: "line",
        source: PATHS_SOURCE,
        paint: {
          "line-color": "#6b7280",
          "line-width": 2,
          "line-opacity": 0.6,
        },
      });

      setReady(true);
    });

    return () => map.remove();
  }, []);

  // Fly to selection (list -> map)
  useEffect(() => {
    if (!ready || !selectedId) return;
    const d = drones.find((x) => x.id === selectedId);
    if (!d) return;
    const map = mapRef.current;
    map.flyTo({
      center: [d.lon, d.lat],
      zoom: Math.max(map.getZoom(), 12),
      speed: 0.8,
    });
  }, [selectedId, ready, drones]);

  // Keep sources fresh
  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    const src = map.getSource(DRONES_SOURCE);
    if (src && src.setData) src.setData(pointsFC);
  }, [pointsFC, ready]);

  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    const src = map.getSource(PATHS_SOURCE);
    if (src && src.setData) src.setData(pathsFC);
  }, [pathsFC, ready]);

  return <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />;
}
