// src/feature/drones/model/useDrones.js
import { useEffect, useRef, useState } from "react";
import { subscribeToDrones } from "../../../services/drones/api/socket.js";

const DEFAULT_TTL = Number(import.meta.env.VITE_DRONE_TTL_MS ?? 15000);
const DEFAULT_HISTORY_WINDOW = Number(
  import.meta.env.VITE_HISTORY_WINDOW_MS ?? 24 * 60 * 60 * 1000
);
const LS_KEY = "droneSeen24h";

// --- ID & policy helpers
function regKey(reg = "") {
  const part = String(reg).includes("-") ? reg.split("-").pop() : reg;
  return String(part || "")
    .trim()
    .toUpperCase();
} //normalizes the registration suffix ("SG-BA" → "BA").
function defaultIdFromFeature(p, coords) {
  return regKey(p.registration) || p.serial || `${coords[0]},${coords[1]}`;
}
export function isAllowed(reg) {
  return regKey(reg).startsWith("B");
} //encodes the business rule

// --- Storage helpers ----
function safeGet(key) {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    console.error("error :>> ", e);
    return null;
  }
}
function safeSet(key, val) {
  try {
    localStorage.setItem(key, val);
  } catch (e) {
    console.error("error :>> ", e);
  }
}
export function clearDroneHistory24h() {
  try {
    localStorage.removeItem(LS_KEY);
  } catch (e) {
    console.error("error :>> ", e);
  }
}

// --- 24h histogram (derived from last-seen timestamps)
function buildHistogram24h(seenMap, now) {
  const out = new Array(24).fill(0);
  // index 0 => 24h ago ... index 23 => current hour
  for (const [, ts] of seenMap) {
    const delta = now - ts;
    if (delta < 0 || delta > 24 * 60 * 60 * 1000) continue;
    const hoursAgo = Math.floor(delta / (60 * 60 * 1000));
    const idx = 23 - Math.min(hoursAgo, 23);
    out[idx] += 1;
  }
  return out;
}

// --- Main hook
/**
 * useDrones(options?)
 * options.ttlMs        -> override TTL window for "currently flying"
 * options.windowMs     -> override 24h history window
 * options.idFromFeature(p, coords) -> custom identity strategy
 */
export function useDrones(options = {}) {
  const TTL = Number(options.ttlMs ?? DEFAULT_TTL);
  const WINDOW = Number(options.windowMs ?? DEFAULT_HISTORY_WINDOW);
  const idFromFeature = options.idFromFeature || defaultIdFromFeature;

  const [connected, setConnected] = useState(false);
  const [drones, setDrones] = useState([]);
  const [stats, setStats] = useState({
    total24h: 0,
    current: 0,
    inactive: 0,
    allowedNow: 0,
    redNow: 0,
    histogram24h: new Array(24).fill(0),
  });

  // Mutable stores that don't trigger re-renders on every mutation
  const byIdRef = useRef(new Map()); // Map<id, Drone>
  const seen24hRef = useRef(new Map()); // Map<id, lastSeenMs>

  // 1) Rehydrate 24h history from storage on mount (window-aware)
  useEffect(() => {
    try {
      const raw = safeGet(LS_KEY);
      if (!raw) return;
      const arr = JSON.parse(raw);
      const now = Date.now();
      for (const [id, ts] of arr) {
        const n = Number(ts);
        if (Number.isFinite(n) && now - n <= WINDOW) {
          //ensures it’s a real number && keeps only entries seen within the configured 24h
          seen24hRef.current.set(id, n);
        }
      }
    } catch (e) {
      console.error("error :>> ", e);
    }
  }, [WINDOW]);

  // 2) Subscribe to the socket (with rAF batching)
  useEffect(() => {
    let raf = 0;
    let pending = null;

    const unsubscribe = subscribeToDrones(
      // onData (GeoJSON FeatureCollection)
      (fc) => {
        pending = fc;
        if (raf) return; // batch multiple frames in one paint
        raf = requestAnimationFrame(() => {
          raf = 0;
          if (!pending) return;
          ingestFeatureCollection(pending);
          pending = null;
        });
      },
      // onStatus (from enhanced socket: object => boolean)
      (s) => setConnected(!!(s && s.connected)),
      // explicit: match backend's polling-only config
      { transports: ["polling"], upgrade: false }
    );

    // Core ingestion logic
    function ingestFeatureCollection(fc) {
      const now = Date.now();
      const byId = byIdRef.current;
      const seen = seen24hRef.current;

      const feats = Array.isArray(fc?.features) ? fc.features : [];
      for (const f of feats) {
        const p = f?.properties;
        const g = f?.geometry;
        if (!p || !g || !Array.isArray(g.coordinates)) continue;
        const coords = g.coordinates;

        const id = idFromFeature(p, coords) || `${coords[0]},${coords[1]}`;
        const prev = byId.get(id);
        const ts = Number(p.ts ?? fc.ts ?? now);

        const drone = {
          id,
          serial: p.serial ?? null,
          registration: p.registration ?? "",
          name: p.Name ?? "",
          altitude: Number(p.altitude ?? 0),
          pilot: p.pilot ?? "",
          organization: p.organization ?? "",
          yaw: Number(p.yaw ?? 0),
          lon: Number(coords[0] ?? 0),
          lat: Number(coords[1] ?? 0),
          firstSeenAt: prev?.firstSeenAt ?? ts,
          updatedAt: ts,
        };

        byId.set(id, drone); // current snapshot
        seen.set(id, ts); // 24h last-seen
      }

      // Time-to-Live pruning: if a drone hasn’t updated within the TTL window, it’s no longer “currently flying.
      for (const [id, d] of byId) {
        if (now - d.updatedAt > TTL) byId.delete(id);
      }
      // 24h window pruning: keep the persisted history bounded and accurate.
      for (const [id, ts] of seen) {
        if (now - ts > WINDOW) seen.delete(id);
      }

      // Publish current array (sorted newest first)
      const currentArr = Array.from(byId.values());
      currentArr.sort((a, b) => b.updatedAt - a.updatedAt);
      setDrones(currentArr);

      // Compute stats (now + 24h)
      const current = byId.size;
      const total24h = seen.size;
      const inactive = Math.max(0, total24h - current);

      let allowedNow = 0;
      for (const d of currentArr) if (isAllowed(d.registration)) allowedNow++;
      const redNow = current - allowedNow;

      const histogram24h = buildHistogram24h(seen, now);

      setStats({
        total24h,
        current,
        inactive,
        allowedNow,
        redNow,
        histogram24h,
      });

      // save to local-storage last 24-hours
      safeSet(LS_KEY, JSON.stringify(Array.from(seen.entries())));
    }

    return () => {
      if (raf) cancelAnimationFrame(raf);
      unsubscribe();
    };
  }, [TTL, WINDOW, idFromFeature]);

  return { connected, drones, stats, clearHistory24h: clearDroneHistory24h };
}
