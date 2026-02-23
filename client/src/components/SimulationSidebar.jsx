import TruckSelector from './TruckSelector';
import StartSession from './StartSession';
import WeighbridgePanel from './WeighbridgePanel';
import DockPanel from './DockPanel';
import InvoicePanel from './InvoicePanel';

/**
 * SimulationSidebar - Contains the stage simulation controls
 * Extracted from App.jsx for use in the sidebar layout
 */
function SimulationSidebar({
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
    const isSessionActive = session && session.state !== 'EXITED';

    return (
        <div className="panel-stack">
            <TruckSelector
                sessions={allSessions}
                selectedTruckId={session?.truckId || ''}
                onSelect={onSelectTruck}
            />
            <StartSession
                onStart={onStart}
                loading={loading && !session}
                disabled={isSessionActive}
            />

            {isSessionActive && (
                <>
                    <WeighbridgePanel
                        session={session}
                        onTare={onTare}
                        onGross={onGross}
                        loading={loading}
                    />
                    <DockPanel
                        session={session}
                        onDock={onDock}
                        loading={loading}
                    />
                    <InvoicePanel
                        session={session}
                        onInvoice={onInvoice}
                        onExit={onExit}
                        loading={loading}
                    />
                </>
            )}
        </div>
    );
}

export default SimulationSidebar;
