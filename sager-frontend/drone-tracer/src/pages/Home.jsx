import React from "react";
import DronePanel from "../feature/drones/ui/DronePanel";
import MapView from "../widgets/MapView/MapView";

export default function Home({ connected, drones, selectedId, onSelect }) {
  return (
    <div className="layout">
      <aside className="layout__side">
        <DronePanel
          connected={connected}
          drones={drones}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      </aside>
      <main className="layout__main">
        <MapView drones={drones} selectedId={selectedId} onSelect={onSelect} />
      </main>
    </div>
  );
}
