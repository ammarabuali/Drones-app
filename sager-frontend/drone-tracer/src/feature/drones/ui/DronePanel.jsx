import React, { useMemo, useEffect } from "react";
import { isAllowed } from "../model/useDrones";
export default function DronePanel({
  connected,
  drones,
  selectedId,
  onSelect,
}) {
  useEffect(() => {
    if (!selectedId) return;
    const el = document.querySelector(
      `[data-drone-id="${CSS.escape(selectedId)}"]`
    );
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedId]);

  const redCount = useMemo(
    () => drones.reduce((n, d) => n + (isAllowed(d.registration) ? 0 : 1), 0),
    [drones]
  );

  return (
    <div className="panel">
      <header className="panel__header">
        <div className="panel__title">
          <span className={`dot ${connected ? "dot--on" : "dot--off"}`} />
          <span>Drones</span>
        </div>
        <div className="panel__meta" aria-label={`Red drones: ${redCount}`}>
          <span style={{ color: "#991b1b", fontWeight: 600 }}>{redCount}</span>
        </div>
      </header>

      <div className="panel__list" role="list" aria-label="Drones list">
        {drones.map((d) => {
          const allowed = isAllowed(d.registration);
          const isSelected = selectedId === d.id;
          return (
            <div
              key={d.id}
              data-drone-id={d.id}
              role="listitem"
              className={`panel__item ${
                isSelected ? "panel__item--selected" : ""
              }`}
              onClick={() => onSelect?.(d.id)}
            >
              <div className="row">
                <div className="id">{d.id}</div>
                <span
                  className={`badge ${allowed ? "badge--green" : "badge--red"}`}
                >
                  {d.registration || "—"}
                </span>
              </div>
              <div className="sub">
                Alt {Math.round(d.altitude)} m · Yaw {Math.round(d.yaw)}° ·{" "}
                {d.name || "—"}
              </div>
            </div>
          );
        })}
        {drones.length === 0 && (
          <div className="panel__empty">Waiting for data…</div>
        )}
      </div>
    </div>
  );
}
