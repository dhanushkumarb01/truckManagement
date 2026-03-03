/**
 * ZoneDrawPanel - Interactive Zone Management Component
 * 
 * Allows yard managers to:
 * - Draw new zones on the map using Leaflet Draw
 * - Edit existing zone polygons
 * - Delete zones
 * - Configure zone properties (name, type, color)
 * 
 * INTEGRATION:
 * - Uses Leaflet Draw plugin for polygon drawing
 * - Saves zones via API to database
 * - Zones are rendered on the main map
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import L from 'leaflet';
import 'leaflet-draw';
import 'leaflet-draw/dist/leaflet.draw.css';
import * as api from '../api';

// Zone type options
const ZONE_TYPES = [
    { value: 'ENTRY_GATE', label: 'Entry Gate', color: '#22c55e' },
    { value: 'EXIT_GATE', label: 'Exit Gate', color: '#ef4444' },
    { value: 'WEIGHBRIDGE', label: 'Weighbridge', color: '#f59e0b' },
    { value: 'DOCK', label: 'Loading Dock', color: '#3b82f6' },
    { value: 'PARKING', label: 'Parking', color: '#8b5cf6' },
    { value: 'RESTRICTED', label: 'Restricted', color: '#dc2626' },
    { value: 'LOADING', label: 'Loading Area', color: '#0891b2' },
    { value: 'UNLOADING', label: 'Unloading Area', color: '#059669' },
    { value: 'INSPECTION', label: 'Inspection', color: '#7c3aed' },
    { value: 'CUSTOM', label: 'Custom', color: '#6b7280' },
];

function ZoneDrawPanel({ 
    map, 
    onZonesChange, 
    zones: externalZones,
    onClose 
}) {
    const [zones, setZones] = useState([]);
    const [isDrawing, setIsDrawing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [newZoneName, setNewZoneName] = useState('');
    const [newZoneType, setNewZoneType] = useState('CUSTOM');
    const [drawnPolygon, setDrawnPolygon] = useState(null);
    const [editingZone, setEditingZone] = useState(null);
    
    const drawControlRef = useRef(null);
    const drawnLayerRef = useRef(null);
    const zoneLayersRef = useRef({});

    // Load zones from API
    const loadZones = useCallback(async () => {
        setLoading(true);
        setError(null);
        
        const res = await api.getZones();
        
        if (res.success) {
            setZones(res.data);
            if (onZonesChange) {
                onZonesChange(res.data);
            }
        } else {
            setError(res.message);
        }
        
        setLoading(false);
    }, [onZonesChange]);

    // Initialize on mount
    useEffect(() => {
        if (externalZones) {
            setZones(externalZones);
        } else {
            loadZones();
        }
    }, [loadZones, externalZones]);

    // Initialize Leaflet Draw
    useEffect(() => {
        if (!map) return;

        // Create drawn items layer
        const drawnItems = new L.FeatureGroup();
        map.addLayer(drawnItems);
        drawnLayerRef.current = drawnItems;

        // Create draw control
        const drawControl = new L.Control.Draw({
            draw: {
                polygon: {
                    allowIntersection: false,
                    drawError: {
                        color: '#e1e100',
                        message: '<strong>Error:</strong> Shape edges cannot cross!'
                    },
                    shapeOptions: {
                        color: '#3b82f6',
                        fillColor: '#3b82f6',
                        fillOpacity: 0.3,
                    }
                },
                polyline: false,
                circle: false,
                rectangle: false,
                marker: false,
                circlemarker: false,
            },
            edit: {
                featureGroup: drawnItems,
                remove: false,
            }
        });

        drawControlRef.current = drawControl;

        // Handle draw created - immediately save to backend
        const onDrawCreated = async (e) => {
            const layer = e.layer;
            
            try {
                // Prompt for zone name
                const name = prompt("Enter zone name:");
                if (!name || !name.trim()) {
                    // User cancelled - remove the drawn layer
                    return;
                }

                // Get coordinates in [lat, lng] format for backend
                const coords = layer.getLatLngs()[0].map(latlng => [
                    latlng.lat,
                    latlng.lng
                ]);

                // Create payload matching backend expectations
                // Backend generates zoneId and converts to GeoJSON automatically
                const payload = {
                    zoneName: name.trim(),
                    zoneType: 'CUSTOM',
                    coordinates: coords,
                    yardId: 'DEFAULT_YARD',
                    color: '#3b82f6'
                };

                // Call backend API
                const res = await api.createZone(payload);

                if (res.success) {
                    // Clear temporary drawn layer
                    drawnItems.clearLayers();
                    
                    // Refresh zones from backend (zones always render from state)
                    await loadZones();
                    
                    // Remove draw control after successful save
                    if (map && drawControlRef.current) {
                        try {
                            map.removeControl(drawControlRef.current);
                        } catch {
                            // Ignore
                        }
                    }
                    
                    setIsDrawing(false);
                    setDrawnPolygon(null);
                } else {
                    console.error('Failed to create zone:', res.message);
                    alert(`Failed to save zone: ${res.message}`);
                }
            } catch (err) {
                console.error('Error creating zone:', err);
                alert('Error saving zone. Check console for details.');
            }
        };

        map.on(L.Draw.Event.CREATED, onDrawCreated);

        return () => {
            map.off(L.Draw.Event.CREATED, onDrawCreated);
            if (drawnLayerRef.current) {
                map.removeLayer(drawnLayerRef.current);
            }
        };
    }, [map, loadZones]);

    // Start drawing mode
    const handleStartDrawing = useCallback(() => {
        if (!map || !drawControlRef.current) return;
        
        map.addControl(drawControlRef.current);
        setIsDrawing(true);
        setNewZoneName('');
        setNewZoneType('CUSTOM');
        setDrawnPolygon(null);
    }, [map]);

    // Cancel drawing
    const handleCancelDrawing = useCallback(() => {
        if (map && drawControlRef.current) {
            try {
                map.removeControl(drawControlRef.current);
            } catch {
                // Control might not be added
            }
        }
        
        if (drawnLayerRef.current) {
            drawnLayerRef.current.clearLayers();
        }
        
        setIsDrawing(false);
        setDrawnPolygon(null);
        setNewZoneName('');
        setNewZoneType('CUSTOM');
    }, [map]);

    // Save new zone
    const handleSaveZone = useCallback(async () => {
        if (!drawnPolygon || !newZoneName.trim()) {
            setError('Please draw a polygon and enter a zone name');
            return;
        }

        setLoading(true);
        setError(null);

        const zoneType = ZONE_TYPES.find(t => t.value === newZoneType);
        
        const res = await api.createZone({
            zoneName: newZoneName.trim(),
            zoneType: newZoneType,
            coordinates: drawnPolygon.coordinates,
            color: zoneType?.color || '#3b82f6',
        });

        if (res.success) {
            // Clear drawn polygon
            if (drawnLayerRef.current) {
                drawnLayerRef.current.clearLayers();
            }
            
            // Remove draw control
            if (map && drawControlRef.current) {
                try {
                    map.removeControl(drawControlRef.current);
                } catch {
                    // Ignore
                }
            }
            
            // Refresh zones
            await loadZones();
            
            setIsDrawing(false);
            setDrawnPolygon(null);
            setNewZoneName('');
            setNewZoneType('CUSTOM');
        } else {
            setError(res.message);
        }

        setLoading(false);
    }, [drawnPolygon, newZoneName, newZoneType, map, loadZones]);

    // Delete zone
    const handleDeleteZone = useCallback(async (zoneId) => {
        if (!confirm('Are you sure you want to delete this zone?')) {
            return;
        }

        setLoading(true);
        const res = await api.deleteZone(zoneId);
        
        if (res.success) {
            await loadZones();
        } else {
            setError(res.message);
        }
        
        setLoading(false);
    }, [loadZones]);

    // Render zone on map
    const flyToZone = useCallback((zone) => {
        if (!map || !zone.coordinates) return;
        
        const bounds = L.latLngBounds(zone.coordinates);
        map.fitBounds(bounds, { padding: [50, 50] });
    }, [map]);

    return (
        <div className="card zone-draw-panel">
            <div className="card-title">
                🗺️ Zone Management
                {onClose && (
                    <button className="btn btn-sm" onClick={onClose} style={{ float: 'right' }}>
                        ✕
                    </button>
                )}
            </div>

            {error && (
                <div className="error-message" style={{ 
                    color: '#ef4444', 
                    padding: '8px', 
                    marginBottom: '8px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    borderRadius: '4px',
                    fontSize: '12px'
                }}>
                    {error}
                </div>
            )}

            {/* Drawing Controls */}
            {!isDrawing ? (
                <button 
                    className="btn btn-primary"
                    onClick={handleStartDrawing}
                    disabled={loading}
                    style={{ width: '100%', marginBottom: '12px' }}
                >
                    ✏️ Draw New Zone
                </button>
            ) : (
                <div className="draw-form" style={{ marginBottom: '12px' }}>
                    {!drawnPolygon ? (
                        <div className="draw-instructions" style={{
                            padding: '12px',
                            background: 'rgba(59, 130, 246, 0.1)',
                            borderRadius: '4px',
                            fontSize: '13px',
                            marginBottom: '8px'
                        }}>
                            <p>📍 <strong>Click on the map</strong> to add polygon vertices.</p>
                            <p>🔄 <strong>Double-click</strong> to close the polygon.</p>
                        </div>
                    ) : (
                        <div className="zone-form" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <input
                                type="text"
                                placeholder="Zone Name"
                                value={newZoneName}
                                onChange={(e) => setNewZoneName(e.target.value)}
                                className="form-input"
                                style={{
                                    padding: '8px',
                                    border: '1px solid #374151',
                                    borderRadius: '4px',
                                    background: '#1f2937',
                                    color: '#fff'
                                }}
                            />
                            <select
                                value={newZoneType}
                                onChange={(e) => setNewZoneType(e.target.value)}
                                className="form-select"
                                style={{
                                    padding: '8px',
                                    border: '1px solid #374151',
                                    borderRadius: '4px',
                                    background: '#1f2937',
                                    color: '#fff'
                                }}
                            >
                                {ZONE_TYPES.map(type => (
                                    <option key={type.value} value={type.value}>
                                        {type.label}
                                    </option>
                                ))}
                            </select>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    className="btn btn-primary"
                                    onClick={handleSaveZone}
                                    disabled={loading || !newZoneName.trim()}
                                    style={{ flex: 1 }}
                                >
                                    {loading ? 'Saving...' : '💾 Save Zone'}
                                </button>
                                <button
                                    className="btn btn-secondary"
                                    onClick={handleCancelDrawing}
                                    style={{ flex: 1 }}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                    
                    {!drawnPolygon && (
                        <button
                            className="btn btn-secondary"
                            onClick={handleCancelDrawing}
                            style={{ width: '100%' }}
                        >
                            Cancel Drawing
                        </button>
                    )}
                </div>
            )}

            {/* Zones List */}
            <div className="zones-list">
                <div className="list-header" style={{ 
                    fontWeight: '600',
                    marginBottom: '8px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <span>Active Zones ({zones.length})</span>
                    <button 
                        className="btn btn-sm"
                        onClick={loadZones}
                        disabled={loading}
                        style={{ fontSize: '12px' }}
                    >
                        🔄
                    </button>
                </div>

                {loading && zones.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px', color: '#9ca3af' }}>
                        Loading zones...
                    </div>
                ) : zones.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px', color: '#9ca3af' }}>
                        No zones defined yet.
                    </div>
                ) : (
                    <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                        {zones.map(zone => (
                            <div 
                                key={zone.zoneId}
                                className="zone-item"
                                style={{
                                    padding: '8px 12px',
                                    marginBottom: '4px',
                                    background: 'rgba(255,255,255,0.05)',
                                    borderRadius: '4px',
                                    borderLeft: `3px solid ${zone.color || '#3b82f6'}`,
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}
                            >
                                <div>
                                    <div style={{ fontWeight: '500' }}>{zone.zoneName}</div>
                                    <div style={{ fontSize: '11px', color: '#9ca3af' }}>
                                        {zone.zoneType}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                    <button
                                        className="btn btn-sm"
                                        onClick={() => flyToZone(zone)}
                                        title="Show on map"
                                        style={{ padding: '4px 8px' }}
                                    >
                                        👁️
                                    </button>
                                    <button
                                        className="btn btn-sm"
                                        onClick={() => handleDeleteZone(zone.zoneId)}
                                        title="Delete zone"
                                        style={{ padding: '4px 8px', color: '#ef4444' }}
                                    >
                                        🗑️
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default ZoneDrawPanel;
