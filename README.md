# Real-time drone tracking UI built with React + Mapbox GL.

# Connects to a provided Socket.IO backend that streams drones as GeoJSON once per second.

Features

Live map of drones with oriented arrows (yaw)

Green if allowed to fly, red otherwise (rule: reg suffix starts with B)

Paths drawn from page load (session only)

Hover: popup with flight time and altitude

Click on map ↔ highlight in list; click in list ↔ map flyTo

Side panel with red-only counter

Dashboard: currently flying, seen in last 24h, inactive (24h), compliance, recent

Handles high message rates smoothly (rAF batching, efficient Mapbox updates)

Responsive layout; accessible colors and interactions

Tech Stack

React (Vite)

Mapbox GL JS (WebGL rendering)

Socket.IO client (long-polling to match backend)

Plain CSS (no framework; easy to read)

LocalStorage for lightweight 24h history persistence

# running locally :

# Run the following commands:

# ---- npm install ----

# ---- npm run dev ----
