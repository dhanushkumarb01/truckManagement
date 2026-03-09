import { useState, useCallback, useEffect } from 'react';
import * as api from './api';
import { useAuth, canAccessView, getDefaultViewForRole } from './context/AuthContext';
import ViolationModal from './components/ViolationModal';
import Toast from './components/Toast';
import FleetOverview from './components/FleetOverview';
import MapPage from './components/MapPage';
import TruckLifecyclePanel from './components/TruckLifecyclePanel';
import RfidSessionsPage from './components/RfidSessionsPage';
import YardSelectionPage from './components/YardSelectionPage';
import LoginPage from './components/LoginPage';

function App() {
    const { isAuthenticated, user, loading, logout, isGatekeeper } = useAuth();
    
    // RBAC: Initialize view based on user role
    const [view, setView] = useState('map');
    const [allSessions, setAllSessions] = useState([]);
    const [violationMessage, setViolationMessage] = useState('');
    const [toastMessage, setToastMessage] = useState('');

    // RBAC: Set default view when user logs in
    useEffect(() => {
        if (isAuthenticated && user?.role) {
            const defaultView = getDefaultViewForRole(user.role);
            setView(defaultView);
        }
    }, [isAuthenticated, user?.role]);

    // RBAC: Handle view change with role validation
    const handleViewChange = useCallback((newView) => {
        if (!user?.role) return;
        
        // Check if user can access the requested view
        if (canAccessView(user.role, newView)) {
            setView(newView);
        } else {
            // Redirect to allowed view (gatekeeper -> rfid)
            const allowedView = getDefaultViewForRole(user.role);
            setView(allowedView);
            setToastMessage('Access restricted. Redirecting to allowed page.');
        }
    }, [user?.role]);

    // Fetch all sessions
    const refreshAllSessions = useCallback(async () => {
        const res = await api.getAllSessions();
        if (res.success) {
            setAllSessions(res.data);
        }
    }, []);

    // Load all sessions on mount (only if authenticated)
    useEffect(() => {
        if (!isAuthenticated) return;
        
        refreshAllSessions();
        const interval = setInterval(refreshAllSessions, 15000);
        return () => clearInterval(interval);
    }, [refreshAllSessions, isAuthenticated]);

    // Handle truck selection from fleet view
    const handleSelectTruck = useCallback(async (truckId) => {
        if (!truckId) return;
        // Navigate to lifecycle view (if allowed)
        handleViewChange('lifecycle');
    }, [handleViewChange]);

    // Handle logout
    const handleLogout = useCallback(() => {
        logout();
        setView('map'); // Reset view
    }, [logout]);

    // Show loading spinner while checking auth state
    if (loading) {
        return (
            <div className="app" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
                <div>Loading...</div>
            </div>
        );
    }

    // RBAC: Show login page if not authenticated
    if (!isAuthenticated) {
        return <LoginPage />;
    }

    return (
        <div className="app">
            <header className="app-header">
                <span className="header-icon">🚛</span>
                <h1>Truck Monitoring System</h1>
                <span>Hybrid RFID + Camera Detection</span>
                <nav className="header-nav">
                    {/* RBAC: Only show navigation buttons for accessible views */}
                    {canAccessView(user?.role, 'yards') && (
                        <button
                            className={`nav-btn ${view === 'yards' ? 'nav-btn-active' : ''}`}
                            onClick={() => handleViewChange('yards')}
                        >
                            Yard Selection
                        </button>
                    )}
                    {canAccessView(user?.role, 'map') && (
                        <button
                            className={`nav-btn ${view === 'map' ? 'nav-btn-active' : ''}`}
                            onClick={() => handleViewChange('map')}
                        >
                            Live Map
                        </button>
                    )}
                    {canAccessView(user?.role, 'lifecycle') && (
                        <button
                            className={`nav-btn ${view === 'lifecycle' ? 'nav-btn-active' : ''}`}
                            onClick={() => handleViewChange('lifecycle')}
                        >
                            Truck Lifecycle
                        </button>
                    )}
                    {canAccessView(user?.role, 'fleet') && (
                        <button
                            className={`nav-btn ${view === 'fleet' ? 'nav-btn-active' : ''}`}
                            onClick={() => handleViewChange('fleet')}
                        >
                            Fleet Overview
                        </button>
                    )}
                    {canAccessView(user?.role, 'rfid') && (
                        <button
                            className={`nav-btn ${view === 'rfid' ? 'nav-btn-active' : ''}`}
                            onClick={() => handleViewChange('rfid')}
                        >
                            RFID Sessions
                        </button>
                    )}
                </nav>
                {/* RBAC: User info and logout */}
                <div className="header-user">
                    <span className="user-info">
                        {user?.name} ({user?.role})
                    </span>
                    <button className="logout-btn" onClick={handleLogout}>
                        Logout
                    </button>
                </div>
            </header>

            {/* RBAC: Render views based on role permissions */}
            {view === 'yards' && canAccessView(user?.role, 'yards') && (
                <YardSelectionPage 
                    onSelectYard={(yardId) => {
                        // Navigate to map view after selecting yard
                        console.log('Selected yard:', yardId);
                        handleViewChange('map');
                    }} 
                />
            )}

            {view === 'map' && canAccessView(user?.role, 'map') && (
                <MapPage
                    allSessions={allSessions}
                    onSelectTruck={handleSelectTruck}
                />
            )}

            {view === 'lifecycle' && canAccessView(user?.role, 'lifecycle') && (
                <div className="lifecycle-view">
                    <TruckLifecyclePanel />
                </div>
            )}

            {view === 'fleet' && canAccessView(user?.role, 'fleet') && (
                <FleetOverview onSelectTruck={handleSelectTruck} />
            )}

            {view === 'rfid' && canAccessView(user?.role, 'rfid') && (
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
