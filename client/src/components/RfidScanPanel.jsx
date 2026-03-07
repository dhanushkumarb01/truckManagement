/**
 * RfidScanPanel - RFID/FastTag Gate Scan Simulation
 * 
 * Allows gate operators to simulate RFID scans:
 * 1. Enter FastTag ID and Vehicle Registration
 * 2. Click "Simulate RFID Scan"
 * 3. Backend creates session and generates QR
 * 4. QR displayed in modal for driver to scan
 * 
 * Production-ready: Same endpoint can receive real RFID webhooks.
 */

import { useState } from 'react';
import * as api from '../api';

function RfidScanPanel() {
    const [fastTagId, setFastTagId] = useState('');
    const [vehicleRegistration, setVehicleRegistration] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [scanResult, setScanResult] = useState(null);
    const [showModal, setShowModal] = useState(false);

    const handleScan = async () => {
        if (!fastTagId.trim() || !vehicleRegistration.trim()) {
            setError('Please enter both FastTag ID and Vehicle Registration');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const res = await api.rfidScan({
                fastTagId: fastTagId.trim(),
                vehicleRegistration: vehicleRegistration.trim(),
                yardId: 'YARD-01',
            });

            if (res.success) {
                setScanResult(res.data);
                setShowModal(true);
                // Reset form
                setFastTagId('');
                setVehicleRegistration('');
            } else {
                setError(res.message || 'RFID scan failed');
            }
        } catch (err) {
            console.error('RFID scan error:', err);
            setError('Failed to process RFID scan');
        }

        setLoading(false);
    };

    const closeModal = () => {
        setShowModal(false);
        setScanResult(null);
    };

    return (
        <>
            <div className="card rfid-scan-panel">
                <div className="card-title">📡 RFID Gate Scan</div>
                
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

                <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '4px' }}>
                        FastTag ID
                    </label>
                    <input
                        type="text"
                        value={fastTagId}
                        onChange={(e) => setFastTagId(e.target.value)}
                        placeholder="e.g., FT12345"
                        disabled={loading}
                        style={{
                            width: '100%',
                            padding: '8px',
                            border: '1px solid #374151',
                            borderRadius: '4px',
                            background: '#1f2937',
                            color: '#fff',
                            fontSize: '14px'
                        }}
                    />
                </div>

                <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '4px' }}>
                        Vehicle Registration
                    </label>
                    <input
                        type="text"
                        value={vehicleRegistration}
                        onChange={(e) => setVehicleRegistration(e.target.value)}
                        placeholder="e.g., TS09AB1234"
                        disabled={loading}
                        style={{
                            width: '100%',
                            padding: '8px',
                            border: '1px solid #374151',
                            borderRadius: '4px',
                            background: '#1f2937',
                            color: '#fff',
                            fontSize: '14px'
                        }}
                    />
                </div>

                <button
                    className="btn btn-primary"
                    onClick={handleScan}
                    disabled={loading || !fastTagId.trim() || !vehicleRegistration.trim()}
                    style={{ width: '100%' }}
                >
                    {loading ? '⏳ Processing...' : '📡 Simulate RFID Scan'}
                </button>

                <div style={{ marginTop: '12px', fontSize: '11px', color: '#6b7280' }}>
                    Simulates gate RFID reader scanning a vehicle's FastTag.
                    Generates QR for driver to scan with mobile app.
                </div>
            </div>

            {/* QR Code Modal */}
            {showModal && scanResult && (
                <div className="rfid-modal-overlay" onClick={closeModal}>
                    <div className="rfid-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="rfid-modal-header">
                            <h3>✅ RFID Scan Successful</h3>
                            <button className="rfid-modal-close" onClick={closeModal}>✕</button>
                        </div>
                        
                        <div className="rfid-modal-body">
                            <div className="rfid-qr-container">
                                <img 
                                    src={scanResult.qrImage} 
                                    alt="Session QR Code"
                                    className="rfid-qr-image"
                                />
                            </div>

                            <div className="rfid-session-info">
                                <div className="rfid-info-row">
                                    <span className="rfid-info-label">Session ID:</span>
                                    <span className="rfid-info-value">{scanResult.sessionId}</span>
                                </div>
                                <div className="rfid-info-row">
                                    <span className="rfid-info-label">Truck ID:</span>
                                    <span className="rfid-info-value">{scanResult.truckId}</span>
                                </div>
                                <div className="rfid-info-row">
                                    <span className="rfid-info-label">FastTag:</span>
                                    <span className="rfid-info-value">{scanResult.fastTagId}</span>
                                </div>
                            </div>

                            <div className="rfid-status-badge">
                                📱 Awaiting Driver QR Scan
                            </div>

                            <p className="rfid-instructions">
                                Driver should scan this QR code with the mobile app to activate GPS tracking.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .rfid-modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.75);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10000;
                }

                .rfid-modal {
                    background: #1f2937;
                    border-radius: 12px;
                    max-width: 400px;
                    width: 90%;
                    border: 1px solid #374151;
                    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
                }

                .rfid-modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 16px 20px;
                    border-bottom: 1px solid #374151;
                }

                .rfid-modal-header h3 {
                    margin: 0;
                    font-size: 18px;
                    color: #22c55e;
                }

                .rfid-modal-close {
                    background: none;
                    border: none;
                    color: #9ca3af;
                    font-size: 20px;
                    cursor: pointer;
                    padding: 4px 8px;
                }

                .rfid-modal-close:hover {
                    color: #fff;
                }

                .rfid-modal-body {
                    padding: 20px;
                }

                .rfid-qr-container {
                    display: flex;
                    justify-content: center;
                    margin-bottom: 20px;
                }

                .rfid-qr-image {
                    width: 250px;
                    height: 250px;
                    border-radius: 8px;
                    background: #fff;
                    padding: 8px;
                }

                .rfid-session-info {
                    background: rgba(0, 0, 0, 0.3);
                    border-radius: 8px;
                    padding: 12px;
                    margin-bottom: 16px;
                }

                .rfid-info-row {
                    display: flex;
                    justify-content: space-between;
                    padding: 4px 0;
                    font-size: 13px;
                }

                .rfid-info-label {
                    color: #9ca3af;
                }

                .rfid-info-value {
                    color: #fff;
                    font-family: monospace;
                    font-size: 12px;
                }

                .rfid-status-badge {
                    background: rgba(59, 130, 246, 0.2);
                    color: #60a5fa;
                    padding: 10px;
                    border-radius: 6px;
                    text-align: center;
                    font-weight: 500;
                    margin-bottom: 12px;
                }

                .rfid-instructions {
                    color: #9ca3af;
                    font-size: 12px;
                    text-align: center;
                    margin: 0;
                }
            `}</style>
        </>
    );
}

export default RfidScanPanel;
