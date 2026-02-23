import { useState, useCallback, useEffect } from 'react';
import * as api from './api';
import StartSession from './components/StartSession';
import WeighbridgePanel from './components/WeighbridgePanel';
import DockPanel from './components/DockPanel';
import InvoicePanel from './components/InvoicePanel';
import StatusDisplay from './components/StatusDisplay';
import EventLog from './components/EventLog';
import ViolationModal from './components/ViolationModal';
import Toast from './components/Toast';
import TruckSelector from './components/TruckSelector';
import FleetOverview from './components/FleetOverview';
import MapPage from './components/MapPage';

function App() {
    const [view, setView] = useState('map'); // 'map' | 'simulation' | 'fleet'
    const [session, setSession] = useState(null);
    const [events, setEvents] = useState([]);
    const [allSessions, setAllSessions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [violationMessage, setViolationMessage] = useState('');
    const [toastMessage, setToastMessage] = useState('');

    // Fetch all sessions for the truck selector
    const refreshAllSessions = useCallback(async () => {
        const res = await api.getAllSessions();
        if (res.success) {
            setAllSessions(res.data);
        }
    }, []);

    // Load all sessions on mount
    useEffect(() => {
        refreshAllSessions();
    }, [refreshAllSessions]);

    const refreshEvents = useCallback(async (truckId) => {
        const res = await api.getEvents(truckId);
        if (res.success) {
            setEvents(res.data);
        }
    }, []);

    const handleError = useCallback((res) => {
        if (!res.success) {
            if (res.message?.includes('Backend connection failed')) {
                setToastMessage(res.message);
                return true;
            }
        }
        return false;
    }, []);

    // Select an existing truck from selector or fleet
    const handleSelectTruck = useCallback(async (truckId) => {
        if (!truckId) {
            setSession(null);
            setEvents([]);
            return;
        }
        setLoading(true);
        const res = await api.getSession(truckId);
        setLoading(false);

        if (res.success) {
            setSession(res.data);
            await refreshEvents(truckId);
            setView('simulation');
        } else {
            setToastMessage(res.message);
        }
    }, [refreshEvents]);

    const handleStart = useCallback(async (truckId) => {
        setLoading(true);
        const res = await api.startSession(truckId);
        setLoading(false);

        if (handleError(res)) return;

        if (res.success) {
            setSession(res.data);
            setEvents([]);
            await refreshEvents(truckId);
            await refreshAllSessions();
        } else {
            setToastMessage(res.message);
        }
    }, [handleError, refreshEvents, refreshAllSessions]);

    const handleTare = useCallback(async (weight) => {
        if (!session) return;
        setLoading(true);
        const res = await api.recordTare(session.truckId, weight);
        setLoading(false);

        if (handleError(res)) return;

        if (res.success) {
            setSession(res.data);
            await refreshEvents(session.truckId);
            await refreshAllSessions();
        } else {
            setToastMessage(res.message);
        }
    }, [session, handleError, refreshEvents, refreshAllSessions]);

    const handleDock = useCallback(async () => {
        if (!session) return;
        setLoading(true);
        const res = await api.enterDock(session.truckId);
        setLoading(false);

        if (handleError(res)) return;

        if (res.success) {
            setSession(res.data);
            await refreshEvents(session.truckId);
            await refreshAllSessions();
        } else {
            setViolationMessage(res.message);
            await refreshEvents(session.truckId);
        }
    }, [session, handleError, refreshEvents, refreshAllSessions]);

    const handleGross = useCallback(async (weight) => {
        if (!session) return;
        setLoading(true);
        const res = await api.recordGross(session.truckId, weight);
        setLoading(false);

        if (handleError(res)) return;

        if (res.success) {
            setSession(res.data);
            await refreshEvents(session.truckId);
            await refreshAllSessions();
        } else {
            setToastMessage(res.message);
        }
    }, [session, handleError, refreshEvents, refreshAllSessions]);

    const handleInvoice = useCallback(async () => {
        if (!session) return;
        setLoading(true);
        const res = await api.generateInvoice(session.truckId);
        setLoading(false);

        if (handleError(res)) return;

        if (res.success) {
            setSession(res.data);
            await refreshEvents(session.truckId);
            await refreshAllSessions();
        } else {
            setToastMessage(res.message);
        }
    }, [session, handleError, refreshEvents, refreshAllSessions]);

    const handleExit = useCallback(async () => {
        if (!session) return;
        setLoading(true);
        const res = await api.exitSession(session.truckId);
        setLoading(false);

        if (handleError(res)) return;

        if (res.success) {
            setSession(res.data);
            await refreshEvents(session.truckId);
            await refreshAllSessions();
        } else {
            setToastMessage(res.message);
        }
    }, [session, handleError, refreshEvents, refreshAllSessions]);

    const isSessionActive = session && session.state !== 'EXITED';

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
                        className={`nav-btn ${view === 'simulation' ? 'nav-btn-active' : ''}`}
                        onClick={() => setView('simulation')}
                    >
                        Simulation
                    </button>
                    <button
                        className={`nav-btn ${view === 'fleet' ? 'nav-btn-active' : ''}`}
                        onClick={() => setView('fleet')}
                    >
                        Fleet Overview
                    </button>
                </nav>
            </header>

            {view === 'map' ? (
                <MapPage
                    session={session}
                    allSessions={allSessions}
                    loading={loading}
                    onSelectTruck={handleSelectTruck}
                    onStart={handleStart}
                    onTare={handleTare}
                    onGross={handleGross}
                    onDock={handleDock}
                    onInvoice={handleInvoice}
                    onExit={handleExit}
                />
            ) : view === 'simulation' ? (
                <div className="app-grid">
                    {/* Left Column — Controls */}
                    <div className="panel-stack">
                        <TruckSelector
                            sessions={allSessions}
                            selectedTruckId={session?.truckId || ''}
                            onSelect={handleSelectTruck}
                        />
                        <StartSession
                            onStart={handleStart}
                            loading={loading && !session}
                            disabled={isSessionActive}
                        />

                        {isSessionActive && (
                            <>
                                <WeighbridgePanel
                                    session={session}
                                    onTare={handleTare}
                                    onGross={handleGross}
                                    loading={loading}
                                />
                                <DockPanel
                                    session={session}
                                    onDock={handleDock}
                                    loading={loading}
                                />
                                <InvoicePanel
                                    session={session}
                                    onInvoice={handleInvoice}
                                    onExit={handleExit}
                                    loading={loading}
                                />
                            </>
                        )}
                    </div>

                    {/* Center Column — Status */}
                    <div>
                        <StatusDisplay session={session} />
                    </div>

                    {/* Right Column — Event Log */}
                    <div>
                        <EventLog events={events} />
                    </div>
                </div>
            ) : (
                <FleetOverview onSelectTruck={handleSelectTruck} />
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
