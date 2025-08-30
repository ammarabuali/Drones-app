import { useState, useCallback } from "react";
import DashboardPage from "../pages/DashboardPage.jsx";
import { useDrones } from "../feature/drones/model/useDrones.js";
import Home from "../pages/home.jsx";

export default function App() {
  const { connected, drones, stats } = useDrones();
  const [selectedId, setSelectedId] = useState(null);
  const handleSelect = useCallback((id) => setSelectedId(id), []);
  const [tab, setTab] = useState("live");

  return (
    <div className="app">
      <nav className="tabs">
        <button
          className={`tab ${tab === "live" ? "tab--active" : ""}`}
          onClick={() => setTab("live")}
        >
          Live
        </button>
        <button
          className={`tab ${tab === "dashboard" ? "tab--active" : ""}`}
          onClick={() => setTab("dashboard")}
        >
          Dashboard
        </button>
        <div className="tabs__status">
          <span className={`dot ${connected ? "dot--on" : "dot--off"}`} />
          {connected ? "connected" : "disconnected"}
        </div>
      </nav>

      {tab === "live" ? (
        <Home
          connected={connected}
          drones={drones}
          selectedId={selectedId}
          onSelect={handleSelect}
        />
      ) : (
        <DashboardPage stats={stats} drones={drones} />
      )}
    </div>
  );
}
