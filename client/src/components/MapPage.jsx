import { useState, useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import * as api from '../api';
import { 
    DEFAULT_MAP_CENTER, 
    DEFAULT_MAP_ZOOM,
    POLLING_INTERVAL 
} from '../config';
import TruckListPanel from './TruckListPanel';
import SimulationSidebar from './SimulationSidebar';

// Fix Leaflet default icon issue with Vite/Webpack bundlers
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconUrl: markerIcon,
    iconRetinaUrl: markerIcon2x,
    shadowUrl: markerShadow,
});

// Custom truck icon (blue)
const createTruckIcon = (isSelected = false) => {
    return L.divIcon({
        className: 'custom-truck-marker',
        html: `<div style="
            width: ${isSelected ? 32 : 24}px;
            height: ${isSelected ? 32 : 24}px;
            background: ${isSelected ? '#22c55e' : '#3b82f6'};
            border: 2px solid #1a1d27;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: ${isSelected ? 16 : 12}px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            transition: all 0.2s ease;
        ">🚛</div>`,
        iconSize: [isSelected ? 32 : 24, isSelected ? 32 : 24],
        iconAnchor: [isSelected ? 16 : 12, isSelected ? 16 : 12],
        popupAnchor: [0, isSelected ? -16 : -12],
    });
};

/**
 * Process GPS events to get latest location per truck
 * Groups by truckId and keeps only the most recent timestamp
 */
function processGpsEvents(events) {
    const latestByTruck = {};
    
    events.forEach(event => {
        const existing = latestByTruck[event.truckId];
        const eventTime = new Date(event.timestamp).getTime();
        
        if (!existing || eventTime > new Date(existing.timestamp).getTime()) {
            latestByTruck[event.truckId] = {
                truckId: event.truckId,
                latitude: event.latitude,
                longitude: event.longitude,
                accuracy: event.accuracy,
                timestamp: event.timestamp
            };
        }
    });
    
    return latestByTruck;
}

/**
 * MapPage - Main map view with Leaflet + OpenStreetMap and sidebar
 */
function MapPage({
    session,
    allSessions,
    loading,
    onSelectTruck,
    onStart,
    onTare,
    onGross,
    onDock,
    onInvoice,
    onExit
}) {
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const markersRef = useRef({}); // Dictionary: truckId -> L.marker
    
    const [truckLocations, setTruckLocations] = useState({});
    const [selectedTruckId, setSelectedTruckId] = useState(null);
    const [mapLoaded, setMapLoaded] = useState(false);
    const [mapError, setMapError] = useState(null);
    const [sidebarTab, setSidebarTab] = useState('trucks'); // 'trucks' | 'simulation'

    // Initialize Leaflet map
    useEffect(() => {
        if (!mapRef.current || mapInstanceRef.current) return;

        try {
            // Create Leaflet map
            const map = L.map(mapRef.current).setView(
                [DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng],
                DEFAULT_MAP_ZOOM
            );

            // Add OpenStreetMap tile layer with dark theme
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
                subdomains: 'abcd',
                maxZoom: 19
            }).addTo(map);

            mapInstanceRef.current = map;
            setMapLoaded(true);
        } catch (error) {
            console.error('Failed to initialize map:', error);
            setMapError('Failed to initialize map.');
        }

        // Cleanup on unmount
        return () => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
            }
        };
    }, []);

    // Fetch GPS events and update markers
    const fetchAndUpdateLocations = useCallback(async () => {
        const res = await api.getGpsEvents();
        
        if (res.success && Array.isArray(res.data)) {
            const latestLocations = processGpsEvents(res.data);
            setTruckLocations(latestLocations);
            
            // Update markers on map
            if (mapInstanceRef.current) {
                updateMarkers(latestLocations);
            }
        }
    }, []);

    // Update markers based on latest locations
    const updateMarkers = useCallback((locations) => {
        const map = mapInstanceRef.current;
        if (!map) return;
        
        const currentTruckIds = new Set(Object.keys(locations));
        
        // Update or create markers for each truck
        Object.entries(locations).forEach(([truckId, location]) => {
            const latLng = [location.latitude, location.longitude];
            
            if (markersRef.current[truckId]) {
                // Marker exists - update position (no flicker)
                markersRef.current[truckId].setLatLng(latLng);
            } else {
                // Create new marker with Leaflet
                const marker = L.marker(latLng, {
                    icon: createTruckIcon(false),
                    title: truckId
                }).addTo(map);
                
                // Bind popup with truck info
                const popupContent = createPopupContent(truckId, location, allSessions);
                marker.bindPopup(popupContent);
                
                // Add click listener
                marker.on('click', () => {
                    setSelectedTruckId(truckId);
                    highlightMarker(truckId);
                });
                
                markersRef.current[truckId] = marker;
            }
        });
        
        // Remove markers for trucks that no longer have location data
        Object.keys(markersRef.current).forEach(truckId => {
            if (!currentTruckIds.has(truckId)) {
                map.removeLayer(markersRef.current[truckId]);
                delete markersRef.current[truckId];
            }
        });
    }, [allSessions]);

    // Create popup content for a marker
    const createPopupContent = useCallback((truckId, location, sessions) => {
        const session = sessions.find(s => s.truckId === truckId);
        const stateText = session?.state || 'Unknown';
        const time = new Date(location.timestamp).toLocaleString();
        
        return `
            <div style="color: #1a1d27; padding: 8px; min-width: 160px;">
                <strong style="font-size: 14px;">🚛 ${truckId}</strong>
                <div style="margin-top: 6px; font-size: 12px;">
                    <div><strong>Status:</strong> ${stateText}</div>
                    <div><strong>Lat:</strong> ${location.latitude.toFixed(6)}</div>
                    <div><strong>Lng:</strong> ${location.longitude.toFixed(6)}</div>
                    <div style="color: #666; margin-top: 4px;">${time}</div>
                </div>
            </div>
        `;
    }, []);

    // Highlight selected marker
    const highlightMarker = useCallback((truckId) => {
        Object.entries(markersRef.current).forEach(([id, marker]) => {
            const isSelected = id === truckId;
            marker.setIcon(createTruckIcon(isSelected));
            if (isSelected) {
                marker.setZIndexOffset(1000);
            } else {
                marker.setZIndexOffset(0);
            }
        });
    }, []);

    // Handle truck selection from list
    const handleTruckSelect = useCallback((truckId) => {
        const location = truckLocations[truckId];
        if (!location || !mapInstanceRef.current) return;
        
        // Center map on truck with smooth animation
        mapInstanceRef.current.setView(
            [location.latitude, location.longitude],
            12,
            { animate: true }
        );
        
        // Update popup content and open it
        const marker = markersRef.current[truckId];
        if (marker) {
            const popupContent = createPopupContent(truckId, location, allSessions);
            marker.setPopupContent(popupContent);
            marker.openPopup();
        }
        
        setSelectedTruckId(truckId);
        highlightMarker(truckId);
    }, [truckLocations, allSessions, createPopupContent, highlightMarker]);

    // Initial fetch and polling setup
    useEffect(() => {
        if (!mapLoaded) return;
        
        // Initial fetch
        fetchAndUpdateLocations();
        
        // Set up polling every 5 seconds
        const interval = setInterval(fetchAndUpdateLocations, POLLING_INTERVAL);
        
        return () => clearInterval(interval);
    }, [mapLoaded, fetchAndUpdateLocations]);

    // Cleanup markers on unmount (map cleanup handled in initialization effect)
    useEffect(() => {
        return () => {
            if (mapInstanceRef.current) {
                Object.values(markersRef.current).forEach(marker => {
                    mapInstanceRef.current.removeLayer(marker);
                });
            }
            markersRef.current = {};
        };
    }, []);

    return (
        <div className="map-page">
            {/* Sidebar */}
            <div className="map-sidebar">
                {/* Sidebar Tab Toggle */}
                <div className="sidebar-tabs">
                    <button 
                        className={`sidebar-tab ${sidebarTab === 'trucks' ? 'active' : ''}`}
                        onClick={() => setSidebarTab('trucks')}
                    >
                        📍 Trucks
                    </button>
                    <button 
                        className={`sidebar-tab ${sidebarTab === 'simulation' ? 'active' : ''}`}
                        onClick={() => setSidebarTab('simulation')}
                    >
                        🔧 Simulation
                    </button>
                </div>
                
                {/* Sidebar Content */}
                <div className="sidebar-content">
                    {sidebarTab === 'trucks' ? (
                        <TruckListPanel
                            truckLocations={truckLocations}
                            sessions={allSessions}
                            selectedTruckId={selectedTruckId}
                            onSelectTruck={handleTruckSelect}
                        />
                    ) : (
                        <SimulationSidebar
                            session={session}
                            allSessions={allSessions}
                            loading={loading}
                            onSelectTruck={onSelectTruck}
                            onStart={onStart}
                            onTare={onTare}
                            onGross={onGross}
                            onDock={onDock}
                            onInvoice={onInvoice}
                            onExit={onExit}
                        />
                    )}
                </div>
            </div>

            {/* Map Container */}
            <div className="map-container">
                {mapError ? (
                    <div className="map-error">
                        <div className="map-error-icon">⚠️</div>
                        <div className="map-error-text">{mapError}</div>
                    </div>
                ) : (
                    <div ref={mapRef} className="map-canvas" />
                )}
            </div>
        </div>
    );
}

export default MapPage;
