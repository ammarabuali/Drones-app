import React, { useMemo } from "react";
import { isAllowed } from "../model/useDrones.js";

export default function Dashboard({ stats, drones }) {
  const { total24h = 0, current = 0, inactive = 0 } = stats || {};

  const { allowedNow, redNow } = useMemo(() => {
    let a = 0,
      r = 0;
    for (const d of drones) isAllowed(d.registration) ? a++ : r++;
    return { allowedNow: a, redNow: r };
  }, [drones]);
  const compliance = drones.length
    ? Math.round((allowedNow / drones.length) * 100)
    : 0;

  const activity24h = useMemo(
    () => [
      5, 9, 12, 7, 3, 2, 4, 6, 8, 10, 12, 14, 16, 13, 11, 9, 8, 7, 6, 8, 10, 12,
      9, 6,
    ],
    []
  );
  const max = Math.max(...activity24h, 1);

  const recent = useMemo(() => {
    const arr = [...drones]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 6);
    return arr;
  }, [drones]);

  return (
    <div className="dashv2">
      <div className="dashv2__title">Flight Operations Dashboard</div>

      <div className="dashv2__grid">
        <Card
          tone="indigo"
          title="Total (24h)"
          value={total24h}
          sub="Unique drones seen in the last 24 hours"
        />
        <Card
          tone="emerald"
          title="Currently flying"
          value={current}
          sub="Within the live TTL window"
        />
        <Card
          tone="slate"
          title="Not flying (24h)"
          value={inactive}
          sub="Seen in 24h but inactive now"
        />
        <Card
          tone="amber"
          title="Compliance"
          value={`${compliance}%`}
          sub={`${allowedNow} green · ${redNow} red now`}
        />
      </div>

      <div className="dashv2__charts">
        <div className="panel-card">
          <div className="panel-card__title">Activity (last 24h)</div>
          <div className="bars">
            {activity24h.map((v, i) => (
              <div key={i} className="bar">
                <div
                  className="bar__fill"
                  style={{ height: `${(v / max) * 100}%` }}
                />
              </div>
            ))}
          </div>
          <div className="bars__legend">
            <span>24h ago</span>
            <span>now</span>
          </div>
        </div>

        <div className="panel-card">
          <div className="panel-card__title">Airspace compliance (now)</div>
          <div className="donut-wrap">
            <div
              className="donut"
              style={{
                background: `conic-gradient(#16a34a 0 ${compliance}%, #dc2626 ${compliance}% 100%)`,
              }}
            >
              <div className="donut__center">
                <div className="donut__value">{compliance}%</div>
                <div className="donut__label">compliant</div>
              </div>
            </div>
            <div className="legend">
              <span className="legend__item">
                <i className="dot dot--green" /> Allowed ({allowedNow})
              </span>
              <span className="legend__item">
                <i className="dot dot--off" style={{ background: "#dc2626" }} />{" "}
                Red ({redNow})
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="panel-card">
        <div className="panel-card__title">Recent drones</div>
        <div className="recent">
          {recent.map((d) => {
            const allowed = isAllowed(d.registration);
            return (
              <div key={d.id} className="recent__row">
                <div className="recent__id">{d.id}</div>
                <div
                  className={`badge ${allowed ? "badge--green" : "badge--red"}`}
                >
                  {d.registration || "—"}
                </div>
                <div className="recent__meta">
                  Alt {Math.round(d.altitude)}m · Yaw {Math.round(d.yaw)}°
                </div>
              </div>
            );
          })}
          {recent.length === 0 && (
            <div className="panel__empty">No data yet…</div>
          )}
        </div>
      </div>
    </div>
  );
}

function Card({ tone = "slate", title, value, sub }) {
  return (
    <div className={`kpi kpi--${tone}`}>
      <div className="kpi__title">{title}</div>
      <div className="kpi__value">{value}</div>
      {sub && <div className="kpi__sub">{sub}</div>}
    </div>
  );
}
