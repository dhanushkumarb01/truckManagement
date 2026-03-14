import { useMemo, useState } from 'react';

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function getRiskTone(risk) {
    if (risk === 'HIGH') return 'danger';
    if (risk === 'MEDIUM') return 'warning';
    return 'success';
}

function buildInsights({ predictedStress, predictedDwell, congestionRisk, gateProcessingTime, dockCount }) {
    const insights = [];

    if (predictedStress > 70) {
        insights.push('The yard may become very crowded with this change. You may want to open more loading docks or reduce incoming trucks.');
    }

    if (predictedDwell > 40) {
        insights.push('Trucks may have to wait longer before loading. Reducing loading time or increasing dock availability could help.');
    }

    if (congestionRisk === 'HIGH') {
        insights.push('More trucks may enter the yard than it can handle smoothly. Staggering truck arrivals could reduce congestion.');
    }

    if (gateProcessingTime >= 7) {
        insights.push('The entry gate may become slow with this many trucks. Speeding up gate checks or adding another entry lane could help.');
    }

    if (dockCount <= 2) {
        insights.push('There may not be enough loading docks for this plan. Opening more docks could help trucks move through faster.');
    }

    if (insights.length === 0) {
        insights.push('This plan looks manageable for the yard right now. Current dock and gate capacity should be enough for this change.');
    }

    return insights;
}

function WhatIfSimulationPage({ sessions = [] }) {
    const [truckIncrease, setTruckIncrease] = useState(20);
    const [dockCount, setDockCount] = useState(3);
    const [gateProcessingTime, setGateProcessingTime] = useState(5);
    const [loadingTime, setLoadingTime] = useState(25);

    const activeSessions = useMemo(
        () => sessions.filter((session) => session.state !== 'EXITED'),
        [sessions]
    );

    const baseline = useMemo(() => {
        const activeTruckCount = activeSessions.length;
        const currentStress = clamp(activeTruckCount * 4, 0, 100);

        return {
            activeTruckCount,
            currentStress,
        };
    }, [activeSessions]);

    const [results, setResults] = useState(() => {
        const predictedTruckCount = baseline.activeTruckCount + truckIncrease;
        const predictedStress = clamp(
            baseline.currentStress + (truckIncrease * 1.5) - (dockCount * 2),
            0,
            100
        );
        const congestionRisk = predictedTruckCount > 30 ? 'HIGH' : predictedTruckCount >= 15 ? 'MEDIUM' : 'LOW';
        const predictedDwell = Math.round((loadingTime * predictedTruckCount) / Math.max(dockCount, 1));

        return {
            predictedStress,
            predictedTruckCount,
            congestionRisk,
            predictedDwell,
            insightMessages: buildInsights({
                predictedStress,
                predictedDwell,
                congestionRisk,
                gateProcessingTime,
                dockCount,
            }),
        };
    });

    const runSimulation = () => {
        const predictedTruckCount = baseline.activeTruckCount + truckIncrease;
        const predictedStress = clamp(
            baseline.currentStress + (truckIncrease * 1.5) - (dockCount * 2),
            0,
            100
        );
        const congestionRisk = predictedTruckCount > 30 ? 'HIGH' : predictedTruckCount >= 15 ? 'MEDIUM' : 'LOW';
        const predictedDwell = Math.round((loadingTime * predictedTruckCount) / Math.max(dockCount, 1));

        setResults({
            predictedStress,
            predictedTruckCount,
            congestionRisk,
            predictedDwell,
            insightMessages: buildInsights({
                predictedStress,
                predictedDwell,
                congestionRisk,
                gateProcessingTime,
                dockCount,
            }),
        });
    };

    const stressTone = results.predictedStress > 70 ? 'danger' : results.predictedStress >= 40 ? 'warning' : 'success';
    const delayTone = results.predictedDwell > 40 ? 'danger' : results.predictedDwell >= 25 ? 'warning' : 'success';
    const congestionTone = getRiskTone(results.congestionRisk);

    return (
        <div className="what-if-page">
            <div className="what-if-header card">
                <div className="card-title">🧠 What-If Simulation</div>
                <div className="what-if-subtitle">
                    Test yard changes before rollout and predict the operational impact using current live session volume as baseline.
                </div>
                <div className="what-if-baseline">
                    <span>Active Trucks: {baseline.activeTruckCount}</span>
                    <span>Current Stress Baseline: {baseline.currentStress}/100</span>
                </div>
            </div>

            <div className="what-if-layout">
                <div className="what-if-controls card">
                    <div className="card-title">🎛️ Simulation Inputs</div>

                    <div className="input-group">
                        <label htmlFor="truckIncrease">Additional Trucks</label>
                        <div className="what-if-input-row">
                            <input
                                id="truckIncrease"
                                type="range"
                                min="0"
                                max="50"
                                value={truckIncrease}
                                onChange={(event) => setTruckIncrease(Number(event.target.value))}
                            />
                            <input
                                className="input-field what-if-number"
                                type="number"
                                min="0"
                                max="50"
                                value={truckIncrease}
                                onChange={(event) => setTruckIncrease(clamp(Number(event.target.value) || 0, 0, 50))}
                            />
                        </div>
                        <div className="what-if-help">Scenario change: +{truckIncrease} trucks</div>
                    </div>

                    <div className="input-group">
                        <label htmlFor="dockCount">Available Loading Docks</label>
                        <div className="what-if-input-row">
                            <input
                                id="dockCount"
                                type="range"
                                min="1"
                                max="10"
                                value={dockCount}
                                onChange={(event) => setDockCount(Number(event.target.value))}
                            />
                            <input
                                className="input-field what-if-number"
                                type="number"
                                min="1"
                                max="10"
                                value={dockCount}
                                onChange={(event) => setDockCount(clamp(Number(event.target.value) || 1, 1, 10))}
                            />
                        </div>
                    </div>

                    <div className="input-group">
                        <label htmlFor="gateProcessingTime">Gate Processing Time</label>
                        <div className="what-if-input-row">
                            <input
                                id="gateProcessingTime"
                                type="range"
                                min="1"
                                max="10"
                                value={gateProcessingTime}
                                onChange={(event) => setGateProcessingTime(Number(event.target.value))}
                            />
                            <input
                                className="input-field what-if-number"
                                type="number"
                                min="1"
                                max="10"
                                value={gateProcessingTime}
                                onChange={(event) => setGateProcessingTime(clamp(Number(event.target.value) || 1, 1, 10))}
                            />
                        </div>
                        <div className="what-if-help">Estimated processing time: {gateProcessingTime} min per truck</div>
                    </div>

                    <div className="input-group">
                        <label htmlFor="loadingTime">Loading Time Per Truck</label>
                        <div className="what-if-input-row">
                            <input
                                id="loadingTime"
                                type="range"
                                min="10"
                                max="60"
                                value={loadingTime}
                                onChange={(event) => setLoadingTime(Number(event.target.value))}
                            />
                            <input
                                className="input-field what-if-number"
                                type="number"
                                min="10"
                                max="60"
                                value={loadingTime}
                                onChange={(event) => setLoadingTime(clamp(Number(event.target.value) || 10, 10, 60))}
                            />
                        </div>
                        <div className="what-if-help">Average loading duration: {loadingTime} min</div>
                    </div>

                    <button className="btn btn-primary what-if-run" onClick={runSimulation}>
                        Run Simulation
                    </button>
                </div>

                <div className="what-if-results panel-stack">
                    <div className="card">
                        <div className="card-title">📈 Predicted Results</div>
                        <div className="what-if-result-grid">
                            <div className={`what-if-metric what-if-metric-${stressTone}`}>
                                <div className="what-if-metric-label">Predicted Yard Stress</div>
                                <div className="what-if-metric-value">{results.predictedStress} / 100</div>
                                <div className="what-if-metric-meta">
                                    {results.predictedStress > 70 ? 'HIGH STRESS' : results.predictedStress >= 40 ? 'MODERATE STRESS' : 'LOW STRESS'}
                                </div>
                            </div>

                            <div className={`what-if-metric what-if-metric-${congestionTone}`}>
                                <div className="what-if-metric-label">Congestion Risk</div>
                                <div className="what-if-metric-value">{results.congestionRisk}</div>
                                <div className="what-if-metric-meta">Predicted trucks: {results.predictedTruckCount}</div>
                            </div>

                            <div className={`what-if-metric what-if-metric-${delayTone}`}>
                                <div className="what-if-metric-label">Predicted Delay</div>
                                <div className="what-if-metric-value">{results.predictedDwell} min</div>
                                <div className="what-if-metric-meta">Based on dock capacity and loading time</div>
                            </div>
                        </div>
                    </div>

                    <div className="card">
                        <div className="card-title">🎚️ Stress Gauge</div>
                        <div className="what-if-gauge-scale">
                            <span>0</span>
                            <span>50</span>
                            <span>100</span>
                        </div>
                        <div className="what-if-gauge-track">
                            <div
                                className={`what-if-gauge-fill what-if-gauge-fill-${stressTone}`}
                                style={{ width: `${results.predictedStress}%` }}
                            />
                            <div
                                className="what-if-gauge-marker"
                                style={{ left: `calc(${results.predictedStress}% - 7px)` }}
                            />
                        </div>
                        <div className="what-if-gauge-caption">Predicted stress score under the selected operating scenario</div>
                    </div>

                    <div className="card">
                        <div className="card-title">💡 AI Insight</div>
                        <div className="what-if-insights">
                            {results.insightMessages.map((message, index) => (
                                <div key={`${message}-${index}`} className="what-if-insight-item">
                                    {message}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default WhatIfSimulationPage;