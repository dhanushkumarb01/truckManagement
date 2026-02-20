function InvoicePanel({ session, onInvoice, onExit, loading }) {
    const state = session?.state;
    const canInvoice = state === 'GROSS_DONE' && !loading;
    const canExit = state === 'INVOICE_GENERATED' && !loading;
    const invoiceGenerated = session?.invoiceStatus === 'GENERATED';

    if (!session || state === 'EXITED') return null;

    return (
        <div className="card">
            <div className="card-title">📄 Invoice & Exit</div>

            <button
                className="btn btn-primary"
                style={{ width: '100%', marginBottom: 12 }}
                onClick={onInvoice}
                disabled={!canInvoice}
            >
                {loading && state === 'GROSS_DONE' ? <span className="spinner" /> : null}
                {loading && state === 'GROSS_DONE' ? 'Generating...' : 'Generate Invoice'}
            </button>

            {invoiceGenerated && (
                <div className="badge badge-red" style={{ marginBottom: 12 }}>
                    🔒 Movement Locked
                </div>
            )}

            <button
                className="btn btn-danger"
                style={{ width: '100%' }}
                onClick={onExit}
                disabled={!canExit}
            >
                {loading && state === 'INVOICE_GENERATED' ? <span className="spinner" /> : null}
                {loading && state === 'INVOICE_GENERATED' ? 'Exiting...' : '🚪 Exit Facility'}
            </button>
        </div>
    );
}

export default InvoicePanel;
