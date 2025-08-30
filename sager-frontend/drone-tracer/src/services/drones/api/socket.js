// src/services/drones/api/socket.js
// -----------------------------------------------------------------------------
// Robust Socket.IO client for receiving GeoJSON FeatureCollections.
// - Singleton connection (no duplicates)
// - Reference counting (auto-close when no subscribers remain)
// - Rich status reporting (connect/disconnect/errors)
// - Defensive payload validation
// - Polling-only transport to match your backend configuration
// -----------------------------------------------------------------------------

import { io } from "socket.io-client";
import { SOCKET_URL } from "../../../shared/config/env";

// Singleton socket + simple reference counting so we can close the connection
// when nobody is listening anymore.
let socket = null;
let refCount = 0;

// Default client options
const DEFAULT_SOCKET_OPTIONS = {
  url: SOCKET_URL,
  transports: ["polling"], // because back end uses polling
  upgrade: false,
  reconnection: true, //Socket.IO will automatically reconnect; these settings keep it gentle and resilient.
  reconnectionAttempts: Infinity,
  reconnectionDelay: 500,
  reconnectionDelayMax: 5000,
  timeout: 10000, //  connection timeout in ms (Connection attempt timeout—helps surface status quickly if the server is down or blocked.)
};

/** Create or return the singleton socket. */
function ensureSocket(customOptions) {
  if (socket) return socket; // reuse existing connection
  const opts = { ...DEFAULT_SOCKET_OPTIONS, ...(customOptions || {}) };
  socket = io(opts.url, opts); // open the connection if there is no connection opened
  return socket;
}

/** Minimal shape check for GeoJSON FeatureCollection payloads. */
function isFeatureCollection(payload) {
  return !!(
    payload &&
    payload.type === "FeatureCollection" &&
    Array.isArray(payload.features)
  );
} //prevents crashes if the server ever sends something else.

/**
 * Subscribe to the drone stream.
 *
 * Signature (non-breaking):
 *   subscribeToDrones(onData, onStatus?, options?)
 *
 * @param {(fc:Object)=>void} onData
 *        Called on every valid GeoJSON FeatureCollection.
 *
 * @param {(status:{connected:boolean, attempts:number, reason?:string, error?:string})=>void} [onStatus]
 *        Called on connect/disconnect/errors and immediately with current status.
 *
 * @param {Object} [options]
 *        Optional low-level socket overrides (e.g., { transports:['webSocket'] }).
 */
export function subscribeToDrones(onData, onStatus, options) {
  if (typeof onData !== "function") {
    throw new Error("subscribeToDrones requires an onData(fc) callback");
  }

  const s = ensureSocket(options);
  refCount++; // track active subscribers

  // Individual subscriber handlers (so we can remove exactly these later)
  const handleConnect = () => {
    onStatus?.({
      connected: true,
      attempts: s.io?.engine?.attempts ?? 0, // how many reconnect attempts happened
    });
  };

  const handleDisconnect = (reason) => {
    onStatus?.({
      connected: false,
      attempts: s.io?.engine?.attempts ?? 0,
      reason, // e.g. "transport close", "io client disconnect"
    });
  };

  const handleError = (err) => {
    onStatus?.({
      connected: false,
      attempts: s.io?.engine?.attempts ?? 0,
      error: err?.message || String(err), // surface message (CORS, timeout, etc.)
    });
  };

  const handleMessage = (payload) => {
    if (!isFeatureCollection(payload)) return;
    onData(payload);
  };

  // Wire up this subscriber’s listeners
  s.on("connect", handleConnect);
  s.on("disconnect", handleDisconnect);
  s.on("connect_error", handleError);
  s.on("error", handleError);
  s.on("message", handleMessage);

  // Fire initial status immediately so UI reflects the real state on mount
  onStatus?.({
    connected: s.connected,
    attempts: s.io?.engine?.attempts ?? 0,
  });

  // Unsubscribe: remove ONLY the handlers we added; close socket if unused
  return () => {
    if (!socket) return;
    s.off("connect", handleConnect);
    s.off("disconnect", handleDisconnect);
    s.off("connect_error", handleError);
    s.off("error", handleError);
    s.off("message", handleMessage);

    refCount = Math.max(0, refCount - 1);
    if (refCount === 0) {
      // no subscribers → shut down
      try {
        s.close(); // terminates connection + timers
      } finally {
        socket = null;
      }
    }
  };
}

/** Optional helpers for manual control. */
export function connectSocket(options) {
  return ensureSocket(options);
}
export function disconnectSocket() {
  if (socket) {
    try {
      socket.close();
    } finally {
      socket = null;
      refCount = 0;
    }
  }
}
export function getSocket() {
  return socket;
}
