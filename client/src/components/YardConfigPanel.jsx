import { useState, useEffect } from 'react';

const YARD_CONFIG_KEY = 'yardConfig';

/**
 * Get yard configuration from localStorage
 * Returns { coordinates: [[lat1, lng1], [lat2, lng2], [lat3, lng3], [lat4, lng4]] } or null
 */
export function getYardConfig() {
    try {
        const stored = localStorage.getItem(YARD_CONFIG_KEY);
        if (stored) {
            const config = JSON.parse(stored);
            // Validate the parsed config - must have 4 coordinate pairs
            if (
                Array.isArray(config.coordinates) &&
                config.coordinates.length === 4 &&
                config.coordinates.every(coord => 
                    Array.isArray(coord) &&
                    coord.length === 2 &&
                    typeof coord[0] === 'number' &&
                    typeof coord[1] === 'number' &&
                    coord[0] >= -90 && coord[0] <= 90 &&
                    coord[1] >= -180 && coord[1] <= 180
                )
            ) {
                return config;
            }
        }
    } catch (e) {
        console.error('Failed to parse yard config:', e);
    }
    return null;
}

/**
 * Save yard configuration to localStorage
 */
export function saveYardConfig(config) {
    localStorage.setItem(YARD_CONFIG_KEY, JSON.stringify(config));
}

/**
 * Clear yard configuration from localStorage
 */
export function clearYardConfig() {
    localStorage.removeItem(YARD_CONFIG_KEY);
}

/**
 * YardConfigPanel - Panel to configure yard boundaries using 4 polygon corners
 */
function YardConfigPanel({ onConfigSaved, currentConfig }) {
    // State for 4 coordinate pairs
    const [coords, setCoords] = useState([
        { lat: '', lng: '' },
        { lat: '', lng: '' },
        { lat: '', lng: '' },
        { lat: '', lng: '' }
    ]);
    const [errors, setErrors] = useState({});
    const [successMessage, setSuccessMessage] = useState('');

    // Load existing config on mount
    useEffect(() => {
        if (currentConfig && currentConfig.coordinates) {
            setCoords(currentConfig.coordinates.map(([lat, lng]) => ({
                lat: lat.toString(),
                lng: lng.toString()
            })));
        }
    }, [currentConfig]);

    // Clear success message after 3 seconds
    useEffect(() => {
        if (successMessage) {
            const timer = setTimeout(() => setSuccessMessage(''), 3000);
            return () => clearTimeout(timer);
        }
    }, [successMessage]);

    const updateCoord = (index, field, value) => {
        setCoords(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            return updated;
        });
    };

    const validate = () => {
        const newErrors = {};
        
        coords.forEach((coord, i) => {
            const lat = parseFloat(coord.lat);
            const lng = parseFloat(coord.lng);
            
            if (isNaN(lat) || lat < -90 || lat > 90) {
                newErrors[`lat${i}`] = 'Lat must be -90 to 90';
            }
            if (isNaN(lng) || lng < -180 || lng > 180) {
                newErrors[`lng${i}`] = 'Lng must be -180 to 180';
            }
        });

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSave = () => {
        if (!validate()) return;

        const config = {
            coordinates: coords.map(coord => [
                parseFloat(coord.lat),
                parseFloat(coord.lng)
            ])
        };

        saveYardConfig(config);
        setSuccessMessage('Yard configuration saved!');
        
        if (onConfigSaved) {
            onConfigSaved(config);
        }
    };

    const handleClear = () => {
        clearYardConfig();
        setCoords([
            { lat: '', lng: '' },
            { lat: '', lng: '' },
            { lat: '', lng: '' },
            { lat: '', lng: '' }
        ]);
        setErrors({});
        setSuccessMessage('Yard configuration cleared!');
        
        if (onConfigSaved) {
            onConfigSaved(null);
        }
    };

    const cornerLabels = ['Top-Left', 'Top-Right', 'Bottom-Right', 'Bottom-Left'];

    return (
        <div className="card yard-config-panel">
            <div className="card-title">🏭 Yard Configuration (Polygon)</div>
            
            <div className="yard-config-form">
                {coords.map((coord, i) => (
                    <div key={i} className="yard-coord-row">
                        <div className="yard-coord-label">{cornerLabels[i]}</div>
                        <div className="yard-coord-inputs">
                            <div className="yard-coord-input">
                                <input
                                    id={`yardLat${i}`}
                                    className={`input-field ${errors[`lat${i}`] ? 'input-error' : ''}`}
                                    type="number"
                                    step="any"
                                    placeholder="Lat"
                                    value={coord.lat}
                                    onChange={(e) => updateCoord(i, 'lat', e.target.value)}
                                />
                                {errors[`lat${i}`] && (
                                    <span className="error-text">{errors[`lat${i}`]}</span>
                                )}
                            </div>
                            <div className="yard-coord-input">
                                <input
                                    id={`yardLng${i}`}
                                    className={`input-field ${errors[`lng${i}`] ? 'input-error' : ''}`}
                                    type="number"
                                    step="any"
                                    placeholder="Lng"
                                    value={coord.lng}
                                    onChange={(e) => updateCoord(i, 'lng', e.target.value)}
                                />
                                {errors[`lng${i}`] && (
                                    <span className="error-text">{errors[`lng${i}`]}</span>
                                )}
                            </div>
                        </div>
                    </div>
                ))}

                {/* Buttons */}
                <div className="yard-config-buttons">
                    <button
                        className="btn btn-primary"
                        onClick={handleSave}
                    >
                        💾 Save Configuration
                    </button>
                    <button
                        className="btn btn-danger"
                        onClick={handleClear}
                        style={{ marginTop: 8 }}
                    >
                        🗑️ Clear & Reset
                    </button>
                </div>

                {/* Success Message */}
                {successMessage && (
                    <div className="yard-config-success">
                        ✅ {successMessage}
                    </div>
                )}
            </div>

            {/* Current Config Display */}
            {currentConfig && currentConfig.coordinates && (
                <div className="yard-config-current">
                    <div className="card-title" style={{ fontSize: '0.7rem', marginBottom: 8 }}>
                        📍 Active Yard Boundary
                    </div>
                    <div className="yard-config-info">
                        {currentConfig.coordinates.map((coord, i) => (
                            <span key={i}>
                                {cornerLabels[i]}: {coord[0].toFixed(6)}, {coord[1].toFixed(6)}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default YardConfigPanel;
