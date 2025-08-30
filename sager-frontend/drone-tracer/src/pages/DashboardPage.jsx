import React from "react";
import Dashboard from "../feature/drones/ui/Dashboard.jsx";

export default function DashboardPage({ stats, drones }) {
  return (
    <div className="page page--center">
      <Dashboard stats={stats} drones={drones} />
    </div>
  );
}
