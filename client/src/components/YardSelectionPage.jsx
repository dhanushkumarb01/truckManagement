/**
 * YardSelectionPage - Super Admin Yard Selection
 * 
 * Displays available yards for superadmin to select.
 * Clicking a yard navigates to the dashboard for that yard.
 */

import './YardSelectionPage.css';

// Static yard data (will be fetched from API in future)
const YARDS = [
    {
        id: 'hyd-steel-yard',
        name: 'Hyderabad Steel Yard',
        location: 'Hyderabad, Telangana',
        status: 'active',
        activeTrucks: 18,
        totalCapacity: 50,
        alerts: 2,
    },
    // Future yards can be added here
    // {
    //     id: 'mum-logistics',
    //     name: 'Mumbai Logistics Hub',
    //     location: 'Mumbai, Maharashtra',
    //     status: 'active',
    //     activeTrucks: 12,
    //     totalCapacity: 30,
    //     alerts: 0,
    // },
];

function YardSelectionPage({ onSelectYard }) {
    return (
        <div className="yard-selection-page">
            <div className="yard-selection-header">
                <h1>🏭 Select Yard</h1>
                <p>Choose a yard to monitor and manage</p>
            </div>

            <div className="yards-grid">
                {YARDS.map((yard) => (
                    <div 
                        key={yard.id} 
                        className={`yard-card ${yard.status}`}
                        onClick={() => onSelectYard(yard.id)}
                    >
                        <div className="yard-card-header">
                            <h2>{yard.name}</h2>
                            <span className={`status-badge ${yard.status}`}>
                                {yard.status === 'active' ? '🟢 Active' : '🔴 Offline'}
                            </span>
                        </div>

                        <div className="yard-card-body">
                            <div className="yard-location">
                                <span className="icon">📍</span>
                                <span>{yard.location}</span>
                            </div>

                            <div className="yard-stats">
                                <div className="stat">
                                    <span className="stat-value">{yard.activeTrucks}</span>
                                    <span className="stat-label">Active Trucks</span>
                                </div>
                                <div className="stat">
                                    <span className="stat-value">{yard.totalCapacity}</span>
                                    <span className="stat-label">Capacity</span>
                                </div>
                                <div className={`stat ${yard.alerts > 0 ? 'alert' : ''}`}>
                                    <span className="stat-value">{yard.alerts}</span>
                                    <span className="stat-label">Alerts</span>
                                </div>
                            </div>
                        </div>

                        <div className="yard-card-footer">
                            <button className="enter-yard-btn">
                                Enter Yard →
                            </button>
                        </div>
                    </div>
                ))}

                {/* Placeholder for adding new yards */}
                <div className="yard-card add-yard disabled">
                    <div className="add-yard-content">
                        <span className="add-icon">+</span>
                        <span>Add New Yard</span>
                        <span className="coming-soon">Coming Soon</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default YardSelectionPage;
