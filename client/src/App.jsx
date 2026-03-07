import { useState, useCallback, useEffect } from 'react';
import * as api from './api';
import ViolationModal from './components/ViolationModal';
import Toast from './components/Toast';
import FleetOverview from './components/FleetOverview';
import MapPage from './components/MapPage';
import TruckLifecyclePanel from './components/TruckLifecyclePanel';
import RfidSessionsPage from './components/RfidSessionsPage';

function App() {
    const [view, setView] = useState('map'); // 'map' | 'lifecycle' | 'fleet' | 'rfid'
    const [allSessions, setAllSessions] = useState([]);
    const [violationMessage, setViolationMessage] = useState('');
    const [toastMessage, setToastMessage] = useState('');

    // Fetch all sessions
    const refreshAllSessions = useCallback(async () => {
        const res = await api.getAllSessions();
        if (res.success) {
            setAllSessions(res.data);
        }
    }, []);

    // Load all sessions on mount
    useEffect(() => {
        refreshAllSessions();
        const interval = setInterval(refreshAllSessions, 15000);
        return () => clearInterval(interval);
    }, [refreshAllSessions]);

    // Handle truck selection from fleet view
    const handleSelectTruck = useCallback(async (truckId) => {
        if (!truckId) return;
        // Navigate to lifecycle view
        setView('lifecycle');
    }, []);

    return (
        <div className="app">
            <header className="app-header">
                <span className="header-icon">🚛</span>
                <h1>Truck Monitoring System</h1>
                <span>Hybrid RFID + Camera Detection</span>
                <nav className="header-nav">
                    <button
                        className={`nav-btn ${view === 'map' ? 'nav-btn-active' : ''}`}
                        onClick={() => setView('map')}
                    >
                        Live Map
                    </button>
                    <button
                        className={`nav-btn ${view === 'lifecycle' ? 'nav-btn-active' : ''}`}
                        onClick={() => setView('lifecycle')}
                    >
                        Truck Lifecycle
                    </button>
                    <button
                        className={`nav-btn ${view === 'fleet' ? 'nav-btn-active' : ''}`}
                        onClick={() => setView('fleet')}
                    >
                        Fleet Overview
                    </button>
                    <button
                        className={`nav-btn ${view === 'rfid' ? 'nav-btn-active' : ''}`}
                        onClick={() => setView('rfid')}
                    >
                        RFID Sessions
                    </button>
                </nav>
            </header>

            {view === 'map' && (
                <MapPage
                    allSessions={allSessions}
                    onSelectTruck={handleSelectTruck}
                />
            )}

            {view === 'lifecycle' && (
                <div className="lifecycle-view">
                    <TruckLifecyclePanel />
                </div>
            )}

            {view === 'fleet' && (
                <FleetOverview onSelectTruck={handleSelectTruck} />
            )}

            {view === 'rfid' && (
                <RfidSessionsPage />
            )}

            {/* Violation Modal */}
            <ViolationModal
                message={violationMessage}
                onClose={() => setViolationMessage('')}
            />

            {/* Toast */}
            <Toast
                message={toastMessage}
                onClose={() => setToastMessage('')}
            />
        </div>
    );
}

export default App;
