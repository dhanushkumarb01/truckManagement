import { Component } from 'react';

/**
 * Global Error Boundary
 * Catches React component errors and prevents entire dashboard from crashing.
 */
class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { 
            hasError: false, 
            error: null, 
            errorInfo: null 
        };
    }

    static getDerivedStateFromError(error) {
        // Update state so next render shows fallback UI
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        // Log error for debugging
        console.error('ErrorBoundary caught an error:', error);
        console.error('Component stack:', errorInfo?.componentStack);
        
        this.setState({ errorInfo });
        
        // In production, you might want to send this to an error tracking service
        // e.g., Sentry, LogRocket, etc.
    }

    handleReload = () => {
        window.location.reload();
    };

    handleReset = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="error-boundary-fallback">
                    <div className="error-boundary-content">
                        <div className="error-boundary-icon">⚠️</div>
                        <h1>Something went wrong</h1>
                        <p className="error-boundary-message">
                            The dashboard encountered an unexpected error. 
                            This has been logged for investigation.
                        </p>
                        
                        <div className="error-boundary-actions">
                            <button 
                                className="btn btn-primary"
                                onClick={this.handleReload}
                            >
                                🔄 Reload Dashboard
                            </button>
                            <button 
                                className="btn btn-secondary"
                                onClick={this.handleReset}
                            >
                                ↩️ Try Again
                            </button>
                        </div>

                        {/* Show error details in development */}
                        {import.meta.env.DEV && this.state.error && (
                            <details className="error-boundary-details">
                                <summary>Error Details (Development Only)</summary>
                                <pre>
                                    {this.state.error.toString()}
                                    {this.state.errorInfo?.componentStack}
                                </pre>
                            </details>
                        )}
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
