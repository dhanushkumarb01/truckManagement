# Smart Yard Monitoring System — Production Module Extensions

## Overview

This document details the 4 production-grade modules added to the existing Smart Yard Monitoring System. These extensions are **additive** and do not modify the existing working flows.

---

## 1️⃣ High-Level Architecture Additions

```
                         ┌─────────────────────────────────┐
                         │       FastTag Reader            │
                         │    (External Hardware)          │
                         └─────────────┬───────────────────┘
                                       │ Webhook
                                       ▼
┌─────────────────┐         ┌─────────────────────────────────────────────┐
│   Mobile App    │         │              Node.js Backend                │
│   (Kotlin)      │         │                                             │
│   ┌──────────┐  │         │  ┌────────────────┐  ┌──────────────────┐  │
│   │ GPS      │──┼─────────┼──► Location API   │  │ FastTag API      │  │
│   │ (5s)     │  │         │  │ + Zone Detect  │  │ /api/fastag/*    │  │
│   └──────────┘  │         │  │ + Anomaly Det  │  └──────────────────┘  │
│   ┌──────────┐  │         │  │ + BLE Validate │                        │
│   │ BLE      │──┼─────────┼──►               │  ┌──────────────────┐  │
│   │ (opt)    │  │         │  └────────────────┘  │ Zone API         │  │
│   └──────────┘  │         │                       │ /api/zones/*     │  │
└─────────────────┘         │  ┌────────────────┐  └──────────────────┘  │
                            │  │ Alerts API     │                        │
                            │  │ /api/alerts/*  │  ┌──────────────────┐  │
                            │  └────────────────┘  │ Vehicles API     │  │
                            │                       │ /api/vehicles/*  │  │
                            │                       └──────────────────┘  │
                            └─────────────────────────────────────────────┘
                                           │
                                           ▼
                            ┌─────────────────────────────────┐
                            │         MongoDB Atlas           │
                            │  ┌───────────┐ ┌─────────────┐  │
                            │  │ Vehicle   │ │ YardSession │  │
                            │  └───────────┘ └─────────────┘  │
                            │  ┌───────────┐ ┌─────────────┐  │
                            │  │ Zone      │ │ZoneTransit  │  │
                            │  └───────────┘ └─────────────┘  │
                            │  ┌───────────┐ ┌─────────────┐  │
                            │  │Proximity  │ │AnomalyEvent │  │
                            │  │Event      │ │             │  │
                            │  └───────────┘ └─────────────┘  │
                            └─────────────────────────────────┘
```

---

## 2️⃣ Database Schema Changes

### NEW Collections

#### Vehicle (Master Registry)
```javascript
{
    vehicleNumber: String,    // "MH12AB1234" (unique, indexed)
    fastTagId: String,        // From FastTag RFID (unique, indexed)
    vehicleType: String,      // TRUCK | TRAILER | TANKER | CONTAINER | OTHER
    status: String,           // ACTIVE | INACTIVE | BLOCKED
    ownerName: String,
    transporterCode: String,
    createdAt: Date,
    updatedAt: Date
}
```

#### YardSession (FastTag-bound sessions)
```javascript
{
    sessionId: String,        // UUID (unique, indexed)
    vehicleNumber: String,    // Links to Vehicle
    fastTagId: String,        // From FastTag reader
    sessionStatus: String,    // ACTIVE | CLOSED | EXPIRED | CANCELLED
    startTime: Date,
    endTime: Date,
    truckSessionId: ObjectId, // Links to existing TruckSession
    entryGate: String,
    entryTimestamp: Date,
    exitGate: String,
    exitTimestamp: Date,
    totalDuration: Number,    // Minutes
    zoneVisits: [{
        zoneName: String,
        enterTime: Date,
        exitTime: Date,
        duration: Number
    }],
    anomalyCount: Number,
    proximityViolationCount: Number
}
```

#### Zone (Geofence definitions)
```javascript
{
    zoneId: String,           // UUID
    zoneName: String,
    zoneType: String,         // ENTRY_GATE | EXIT_GATE | WEIGHBRIDGE | DOCK | etc.
    geoJsonPolygon: {         // GeoJSON format for MongoDB geospatial
        type: "Polygon",
        coordinates: [[[lng, lat], ...]]
    },
    leafletCoordinates: [[lat, lng], ...],  // For frontend
    yardId: String,
    color: String,
    fillOpacity: Number,
    rules: {
        maxDwellTime: Number,
        requiredForWorkflow: Boolean,
        sequenceOrder: Number
    },
    isActive: Boolean,
    createdBy: String
}
```

#### ZoneTransition (Audit log)
```javascript
{
    sessionId: String,
    truckId: String,
    transitionType: String,   // ZONE_ENTER | ZONE_EXIT
    zoneName: String,
    zoneId: String,
    zoneType: String,
    latitude: Number,
    longitude: Number,
    previousZone: String,
    dwellTime: Number,        // Seconds in zone (for exits)
    timestamp: Date
}
```

#### ProximityEvent (BLE violations)
```javascript
{
    sessionId: String,
    truckId: String,
    violationType: String,    // WEAK_SIGNAL | SIGNAL_LOST | BEACON_MISMATCH | etc.
    severity: String,         // LOW | MEDIUM | HIGH | CRITICAL
    bleDeviceId: String,
    bleSignalStrength: Number,// RSSI in dBm
    latitude: Number,
    longitude: Number,
    currentZone: String,
    acknowledged: Boolean,
    acknowledgedBy: String,
    acknowledgedAt: Date,
    notes: String,
    timestamp: Date
}
```

#### AnomalyEvent (GPS anomalies)
```javascript
{
    sessionId: String,
    truckId: String,
    anomalyType: String,      // SPEED_VIOLATION | TELEPORT | OUT_OF_BOUNDS | etc.
    severity: String,
    calculatedSpeed: Number,  // km/h
    distance: Number,         // meters
    timeDelta: Number,        // seconds
    latitude: Number,
    longitude: Number,
    accuracy: Number,
    previousLatitude: Number,
    previousLongitude: Number,
    thresholdUsed: {
        speedThreshold: Number,
        distanceThreshold: Number,
        accuracyThreshold: Number
    },
    acknowledged: Boolean,
    autoResolved: Boolean,
    timestamp: Date
}
```

### EXISTING Collections (Unchanged)
- `TruckSession` — Workflow state machine (unchanged)
- `GpsEvent` — Raw GPS events (unchanged)
- `EventLog` — Event logging (unchanged)

---

## 3️⃣ Backend Route Additions

### FastTag Routes
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/fastag/entry` | Create session from FastTag entry |
| POST | `/api/fastag/exit` | Close session on exit |
| GET | `/api/fastag/session/:sessionId` | Get session details |
| GET | `/api/fastag/active` | List active sessions |
| POST | `/api/fastag/validate` | Validate session is active |

### Vehicle Routes
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/vehicles` | Register new vehicle |
| GET | `/api/vehicles` | List all vehicles |
| GET | `/api/vehicles/:identifier` | Get by vehicleNumber or fastTagId |
| PUT | `/api/vehicles/:vehicleNumber` | Update vehicle |
| PATCH | `/api/vehicles/:vehicleNumber/status` | Update status |
| DELETE | `/api/vehicles/:vehicleNumber` | Soft delete (deactivate) |

### Zone Routes
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/zones` | Create zone |
| GET | `/api/zones` | List zones |
| GET | `/api/zones/current` | Get current zone per truck |
| GET | `/api/zones/transitions/recent` | Recent transitions |
| GET | `/api/zones/:zoneId` | Get zone details |
| PUT | `/api/zones/:zoneId` | Update zone |
| DELETE | `/api/zones/:zoneId` | Soft delete zone |
| POST | `/api/zones/:zoneId/restore` | Restore zone |

### Alerts Routes
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/alerts/dashboard` | Combined alert summary |
| GET | `/api/alerts/proximity` | List proximity alerts |
| GET | `/api/alerts/proximity/stats` | Proximity statistics |
| POST | `/api/alerts/proximity/:id/acknowledge` | Acknowledge alert |
| GET | `/api/alerts/anomalies` | List anomaly alerts |
| GET | `/api/alerts/anomalies/stats` | Anomaly statistics |
| POST | `/api/alerts/anomalies/:id/acknowledge` | Acknowledge alert |
| POST | `/api/alerts/acknowledge-batch` | Batch acknowledge |

---

## 4️⃣ Middleware & Service Additions

### New Services
| File | Purpose |
|------|---------|
| `services/anomalyDetection.js` | Haversine distance, speed calculation, anomaly detection |
| `services/zoneDetection.js` | Point-in-polygon, zone caching, transition logging |
| `services/proximityValidation.js` | BLE RSSI validation, proximity status |

### Updated Location Controller
The existing `POST /api/location` endpoint now includes:
1. **Anomaly Detection** — Runs before saving GPS event
2. **Zone Transition Detection** — Runs after saving
3. **BLE Proximity Validation** — Runs if BLE data present

**Backward Compatibility:**
- Session validation is "soft" (logs warning, doesn't reject)
- BLE fields are optional
- Existing mobile flow continues unchanged

---

## 5️⃣ Frontend Changes

### New Components
| Component | Purpose |
|-----------|---------|
| `ZoneDrawPanel.jsx` | Interactive zone creation with Leaflet Draw |
| `AlertsPanel.jsx` | Real-time proximity & anomaly alerts |
| `VehiclePanel.jsx` | Vehicle registration & management |

### MapPage Updates
- Added 3 new sidebar tabs: Zones, Alerts, Vehicles
- Integrated new panels into existing sidebar structure

### New Dependencies
```json
{
    "leaflet-draw": "^1.0.4"
}
```

---

## 6️⃣ Integration Steps (Safe Deployment Plan)

### Phase 1: Install Dependencies
```bash
# Server
cd server
npm install uuid

# Client
cd client
npm install leaflet-draw
```

### Phase 2: Database Indexes
Run in MongoDB Atlas shell:
```javascript
// Vehicle indexes
db.vehicles.createIndex({ vehicleNumber: 1 }, { unique: true });
db.vehicles.createIndex({ fastTagId: 1 }, { unique: true });

// YardSession indexes
db.yardsessions.createIndex({ sessionId: 1 }, { unique: true });
db.yardsessions.createIndex({ sessionStatus: 1, startTime: -1 });
db.yardsessions.createIndex({ vehicleNumber: 1, startTime: -1 });

// Zone indexes
db.zones.createIndex({ zoneId: 1 }, { unique: true });
db.zones.createIndex({ geoJsonPolygon: "2dsphere" });
db.zones.createIndex({ yardId: 1, isActive: 1 });

// ZoneTransition indexes
db.zonetransitions.createIndex({ sessionId: 1, timestamp: -1 });
db.zonetransitions.createIndex({ zoneId: 1, timestamp: -1 });

// ProximityEvent indexes
db.proximityevents.createIndex({ sessionId: 1, timestamp: -1 });
db.proximityevents.createIndex({ acknowledged: 1, timestamp: -1 });

// AnomalyEvent indexes
db.anomalyevents.createIndex({ sessionId: 1, timestamp: -1 });
db.anomalyevents.createIndex({ acknowledged: 1, autoResolved: 1, timestamp: -1 });
```

### Phase 3: Deploy Backend
1. Deploy updated server code
2. Verify health endpoint: `GET /api/health`
3. Test new endpoints with Postman

### Phase 4: Register Test Vehicle
```bash
curl -X POST https://your-api.com/api/vehicles \
  -H "Content-Type: application/json" \
  -d '{
    "vehicleNumber": "TEST001",
    "fastTagId": "FT-TEST-001",
    "vehicleType": "TRUCK"
  }'
```

### Phase 5: Create Test Zones
```bash
curl -X POST https://your-api.com/api/zones \
  -H "Content-Type: application/json" \
  -d '{
    "zoneName": "Entry Gate",
    "zoneType": "ENTRY_GATE",
    "coordinates": [
      [28.248830, 76.810912],
      [28.249022, 76.811500],
      [28.248500, 76.811500],
      [28.248500, 76.810912]
    ]
  }'
```

### Phase 6: Deploy Frontend
1. Build: `npm run build`
2. Deploy to hosting
3. Verify new sidebar tabs appear

### Phase 7: Mobile App Integration (Optional)
If using FastTag flow, update mobile app to:
1. Scan QR code containing `sessionId`
2. Use `sessionId` as `truckId` in GPS requests
3. Optionally add BLE fields:
```json
{
    "truckId": "session-uuid",
    "latitude": 28.248,
    "longitude": 76.811,
    "accuracy": 5,
    "timestamp": "2026-03-02T10:30:00.000Z",
    "sessionId": "session-uuid",
    "bleSignalStrength": -65,
    "bleDeviceId": "beacon-001"
}
```

---

## 7️⃣ Risk Considerations

### Low Risk
- All changes are additive
- Existing endpoints unchanged
- Existing mobile flow works without modification

### Medium Risk
- New dependencies (`uuid`, `leaflet-draw`)
- New database collections (no schema changes to existing)

### Monitoring Recommendations
1. **Watch for anomaly false positives** — Initial speed threshold (60 km/h) may need tuning
2. **Monitor zone detection performance** — Cache TTL set to 60s
3. **BLE integration** — Currently optional, no enforcement

### Rollback Plan
1. Remove new routes from `app.js`
2. Frontend will show "connection failed" for new features
3. Existing functionality continues working

---

## File Summary

### NEW Backend Files
```
server/src/
├── models/
│   ├── Vehicle.js
│   ├── YardSession.js
│   ├── Zone.js
│   ├── ZoneTransition.js
│   ├── ProximityEvent.js
│   └── AnomalyEvent.js
├── controllers/
│   ├── fastagController.js
│   ├── vehicleController.js
│   ├── zoneController.js
│   └── alertsController.js
├── routes/
│   ├── fastagRoutes.js
│   ├── vehicleRoutes.js
│   ├── zoneRoutes.js
│   └── alertsRoutes.js
└── services/
    ├── anomalyDetection.js
    ├── zoneDetection.js
    └── proximityValidation.js
```

### MODIFIED Backend Files
```
server/src/
├── app.js                    # Added new route imports
├── controllers/
│   └── locationController.js # Integrated new services
└── package.json              # Added uuid dependency
```

### NEW Frontend Files
```
client/src/
├── components/
│   ├── ZoneDrawPanel.jsx
│   ├── AlertsPanel.jsx
│   └── VehiclePanel.jsx
```

### MODIFIED Frontend Files
```
client/src/
├── api.js           # Added new API functions
├── index.css        # Added new styles
├── package.json     # Added leaflet-draw
└── components/
    └── MapPage.jsx  # Added new sidebar tabs
```

---

## Production Checklist

- [ ] Dependencies installed (server + client)
- [ ] MongoDB indexes created
- [ ] Backend deployed and health verified
- [ ] Test vehicle registered
- [ ] Test zones created via dashboard
- [ ] Frontend deployed
- [ ] New sidebar tabs functional
- [ ] GPS tracking still works (backward compat)
- [ ] Alerts showing (may be empty initially)
- [ ] Documentation reviewed by team
