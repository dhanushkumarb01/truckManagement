# Hybrid Truck Monitoring System

A production-quality POC for monitoring hybrid truck operations using RFID and camera-based detection, built with Node.js, Express, React 18, and MongoDB Atlas.

## Features

- **Live Map**: Real-time Leaflet + OpenStreetMap view showing all truck locations with unique markers
- **Truck Stage Simulation**: Manual simulation of truck workflow stages
- **Fleet Overview**: Dashboard showing all truck sessions and their status
- **GPS Tracking**: Backend support for receiving GPS updates from Android devices

## Architecture

```
server/               → Express + Mongoose backend
├── src/
│   ├── app.js        → Entry point (dotenv, CORS, routes)
│   ├── models/       → TruckSession, EventLog, GpsEvent schemas
│   ├── services/     → Rule engine (state transitions, dock enforcement)
│   ├── controllers/  → Session, event, & location handlers
│   ├── routes/       → API route definitions
│   └── middleware/   → Error handler
client/               → Vite + React 18 frontend
├── src/
│   ├── App.jsx       → Main layout (map, simulation, fleet views)
│   ├── api.js        → Fetch API service layer
│   ├── config.js     → App configuration (map settings)
│   ├── components/   → UI components
│   │   ├── MapPage.jsx         → Live map with marker management
│   │   ├── TruckListPanel.jsx  → Sidebar truck list
│   │   ├── SimulationSidebar.jsx → Stage simulation controls
│   │   └── ...
│   └── index.css     → Design system
```

## Setup

### 1. MongoDB Atlas

Create a free cluster at [MongoDB Atlas](https://cloud.mongodb.com) and get your connection string.

### 2. Backend

```bash
cd server
cp .env.example .env
# Edit .env with your MONGODB_URI
npm install
npm run dev
```

### 3. Frontend

```bash
cd client
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

> **Note**: The map uses Leaflet with OpenStreetMap tiles - no API key required!

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/session/start` | Start a truck session |
| POST | `/api/session/tare` | Record tare weight |
| POST | `/api/session/dock` | Enter loading dock |
| POST | `/api/session/gross` | Record gross weight |
| POST | `/api/session/invoice` | Generate invoice |
| POST | `/api/session/exit` | Exit facility |
| GET | `/api/session/:truckId` | Get active session |
| GET | `/api/events/:truckId` | Get truck event log |
| GET | `/api/events` | Get all GPS location events |
| POST | `/api/location` | Receive GPS location from Android |
| GET | `/api/sessions` | Get all truck sessions |

## Business Rules

- **Before invoice**: Dock entry allowed unlimited times
- **After invoice**: Dock re-entry is blocked, creates a VIOLATION event
- **State flow**: ENTRY → TARE_DONE → DOCK → GROSS_DONE → INVOICE_GENERATED → EXITED
- All transitions are validated server-side; invalid actions are rejected with clear reasons
