/**
 * VehiclePanel - Vehicle Registration & FastTag Management
 * 
 * Allows yard administrators to:
 * - Register new vehicles with FastTag
 * - View registered vehicles
 * - Update vehicle status (ACTIVE/INACTIVE/BLOCKED)
 * - Search vehicles
 */

import { useState, useEffect, useCallback } from 'react';
import * as api from '../api';

// Vehicle types
const VEHICLE_TYPES = [
    { value: 'TRUCK', label: 'Truck' },
    { value: 'TRAILER', label: 'Trailer' },
    { value: 'TANKER', label: 'Tanker' },
    { value: 'CONTAINER', label: 'Container' },
    { value: 'OTHER', label: 'Other' },
];

// Status colors
const STATUS_COLORS = {
    ACTIVE: '#22c55e',
    INACTIVE: '#6b7280',
    BLOCKED: '#ef4444',
};

function VehiclePanel({ onClose }) {
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);
    
    // New vehicle form state
    const [newVehicle, setNewVehicle] = useState({
        vehicleNumber: '',
        fastTagId: '',
        vehicleType: 'TRUCK',
        ownerName: '',
        transporterCode: '',
    });

    // Load vehicles
    const loadVehicles = useCallback(async () => {
        setLoading(true);
        setError(null);
        
        const res = await api.getVehicles({ search: searchTerm });
        
        if (res.success) {
            setVehicles(res.data);
        } else {
            setError(res.message);
        }
        
        setLoading(false);
    }, [searchTerm]);

    // Initial load
    useEffect(() => {
        loadVehicles();
    }, [loadVehicles]);

    // Handle form input change
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setNewVehicle(prev => ({
            ...prev,
            [name]: value,
        }));
    };

    // Register new vehicle
    const handleRegisterVehicle = async (e) => {
        e.preventDefault();
        
        if (!newVehicle.vehicleNumber.trim() || !newVehicle.fastTagId.trim()) {
            setError('Vehicle number and FastTag ID are required');
            return;
        }
        
        setLoading(true);
        setError(null);
        
        const res = await api.createVehicle(newVehicle);
        
        if (res.success) {
            setNewVehicle({
                vehicleNumber: '',
                fastTagId: '',
                vehicleType: 'TRUCK',
                ownerName: '',
                transporterCode: '',
            });
            setShowAddForm(false);
            await loadVehicles();
        } else {
            setError(res.message);
        }
        
        setLoading(false);
    };

    // Update vehicle status
    const handleStatusChange = async (vehicleNumber, newStatus) => {
        const res = await api.updateVehicle(vehicleNumber, { status: newStatus });
        
        if (res.success) {
            await loadVehicles();
        } else {
            setError(res.message);
        }
    };

    return (
        <div className="card vehicle-panel">
            <div className="card-title">
                🚛 Vehicle Management
                {onClose && (
                    <button 
                        className="btn btn-sm" 
                        onClick={onClose}
                        style={{ float: 'right' }}
                    >
                        ✕
                    </button>
                )}
            </div>

            {error && (
                <div style={{
                    color: '#ef4444',
                    padding: '8px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    borderRadius: '4px',
                    marginBottom: '8px',
                    fontSize: '12px',
                }}>
                    {error}
                    <button 
                        onClick={() => setError(null)}
                        style={{ 
                            float: 'right', 
                            background: 'none', 
                            border: 'none',
                            color: '#ef4444',
                            cursor: 'pointer'
                        }}
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* Search Bar */}
            <div style={{ marginBottom: '12px', display: 'flex', gap: '8px' }}>
                <input
                    type="text"
                    placeholder="Search vehicles..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{
                        flex: 1,
                        padding: '8px',
                        border: '1px solid #374151',
                        borderRadius: '4px',
                        background: '#1f2937',
                        color: '#fff',
                    }}
                />
                <button
                    className="btn btn-primary"
                    onClick={() => setShowAddForm(!showAddForm)}
                >
                    {showAddForm ? 'Cancel' : '+ Add'}
                </button>
            </div>

            {/* Add Vehicle Form */}
            {showAddForm && (
                <form 
                    onSubmit={handleRegisterVehicle}
                    style={{
                        padding: '12px',
                        background: 'rgba(59, 130, 246, 0.1)',
                        borderRadius: '6px',
                        marginBottom: '12px',
                    }}
                >
                    <div style={{ marginBottom: '8px', fontWeight: '600' }}>
                        Register New Vehicle
                    </div>
                    
                    <div style={{ display: 'grid', gap: '8px' }}>
                        <input
                            type="text"
                            name="vehicleNumber"
                            placeholder="Vehicle Number (e.g., MH12AB1234)"
                            value={newVehicle.vehicleNumber}
                            onChange={handleInputChange}
                            required
                            style={{
                                padding: '8px',
                                border: '1px solid #374151',
                                borderRadius: '4px',
                                background: '#1f2937',
                                color: '#fff',
                            }}
                        />
                        <input
                            type="text"
                            name="fastTagId"
                            placeholder="FastTag ID"
                            value={newVehicle.fastTagId}
                            onChange={handleInputChange}
                            required
                            style={{
                                padding: '8px',
                                border: '1px solid #374151',
                                borderRadius: '4px',
                                background: '#1f2937',
                                color: '#fff',
                            }}
                        />
                        <select
                            name="vehicleType"
                            value={newVehicle.vehicleType}
                            onChange={handleInputChange}
                            style={{
                                padding: '8px',
                                border: '1px solid #374151',
                                borderRadius: '4px',
                                background: '#1f2937',
                                color: '#fff',
                            }}
                        >
                            {VEHICLE_TYPES.map(type => (
                                <option key={type.value} value={type.value}>
                                    {type.label}
                                </option>
                            ))}
                        </select>
                        <input
                            type="text"
                            name="ownerName"
                            placeholder="Owner Name (optional)"
                            value={newVehicle.ownerName}
                            onChange={handleInputChange}
                            style={{
                                padding: '8px',
                                border: '1px solid #374151',
                                borderRadius: '4px',
                                background: '#1f2937',
                                color: '#fff',
                            }}
                        />
                        <input
                            type="text"
                            name="transporterCode"
                            placeholder="Transporter Code (optional)"
                            value={newVehicle.transporterCode}
                            onChange={handleInputChange}
                            style={{
                                padding: '8px',
                                border: '1px solid #374151',
                                borderRadius: '4px',
                                background: '#1f2937',
                                color: '#fff',
                            }}
                        />
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={loading}
                        >
                            {loading ? 'Registering...' : '✓ Register Vehicle'}
                        </button>
                    </div>
                </form>
            )}

            {/* Vehicles List */}
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {loading && vehicles.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px', color: '#9ca3af' }}>
                        Loading vehicles...
                    </div>
                ) : vehicles.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px', color: '#9ca3af' }}>
                        No vehicles registered yet.
                    </div>
                ) : (
                    vehicles.map(vehicle => (
                        <div
                            key={vehicle._id}
                            style={{
                                padding: '12px',
                                marginBottom: '8px',
                                background: 'rgba(255, 255, 255, 0.05)',
                                borderRadius: '6px',
                                borderLeft: `3px solid ${STATUS_COLORS[vehicle.status]}`,
                            }}
                        >
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'flex-start',
                            }}>
                                <div>
                                    <div style={{ fontWeight: '600', fontSize: '14px' }}>
                                        🚛 {vehicle.vehicleNumber}
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
                                        <div>📱 FastTag: {vehicle.fastTagId}</div>
                                        <div>📦 Type: {vehicle.vehicleType}</div>
                                        {vehicle.ownerName && (
                                            <div>👤 Owner: {vehicle.ownerName}</div>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <select
                                        value={vehicle.status}
                                        onChange={(e) => handleStatusChange(vehicle.vehicleNumber, e.target.value)}
                                        style={{
                                            padding: '4px 8px',
                                            fontSize: '11px',
                                            border: `1px solid ${STATUS_COLORS[vehicle.status]}`,
                                            borderRadius: '4px',
                                            background: 'transparent',
                                            color: STATUS_COLORS[vehicle.status],
                                            cursor: 'pointer',
                                        }}
                                    >
                                        <option value="ACTIVE">ACTIVE</option>
                                        <option value="INACTIVE">INACTIVE</option>
                                        <option value="BLOCKED">BLOCKED</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Stats */}
            <div style={{
                marginTop: '12px',
                padding: '8px',
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '4px',
                display: 'flex',
                justifyContent: 'space-around',
                fontSize: '12px',
            }}>
                <div>
                    <span style={{ color: '#22c55e' }}>●</span> Active: {vehicles.filter(v => v.status === 'ACTIVE').length}
                </div>
                <div>
                    <span style={{ color: '#6b7280' }}>●</span> Inactive: {vehicles.filter(v => v.status === 'INACTIVE').length}
                </div>
                <div>
                    <span style={{ color: '#ef4444' }}>●</span> Blocked: {vehicles.filter(v => v.status === 'BLOCKED').length}
                </div>
            </div>
        </div>
    );
}

export default VehiclePanel;
