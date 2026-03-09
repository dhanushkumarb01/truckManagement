import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import * as api from '../api';
import './LoginPage.css';

/**
 * Login/Signup Page Component
 * 
 * Handles both login and signup flows.
 * On success, stores JWT and user info via AuthContext.
 */
function LoginPage() {
    const { login } = useAuth();
    const [isSignup, setIsSignup] = useState(false); // Toggle between login/signup
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [role, setRole] = useState('gatekeeper'); // RBAC: Role selector for signup
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Reset form when switching modes
    const handleModeSwitch = () => {
        setIsSignup(!isSignup);
        setError('');
        setName('');
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        setRole('gatekeeper'); // Reset role to default
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        // Basic validation
        if (!email.trim() || !password.trim()) {
            setError('Please enter both email and password.');
            return;
        }

        if (isSignup) {
            // Signup validation
            if (!name.trim()) {
                setError('Please enter your name.');
                return;
            }
            if (password.length < 6) {
                setError('Password must be at least 6 characters.');
                return;
            }
            if (password !== confirmPassword) {
                setError('Passwords do not match.');
                return;
            }
        }

        setLoading(true);

        try {
            let response;
            
            if (isSignup) {
                // Register new user with selected role
                response = await api.registerUser({
                    name: name.trim(),
                    email: email.trim(),
                    password,
                    role: role, // RBAC: Use selected role instead of hardcoded
                });
            } else {
                // Login existing user
                response = await api.loginUser(email, password);
            }

            if (response.success && response.data) {
                // Success - store credentials and redirect
                login(response.data.user, response.data.token);
            } else {
                // Failed
                setError(response.message || `${isSignup ? 'Signup' : 'Login'} failed. Please try again.`);
            }
        } catch (err) {
            console.error(`${isSignup ? 'Signup' : 'Login'} error:`, err);
            setError('Connection failed. Please check your network.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-container">
                <div className="login-header">
                    <span className="login-icon">🚛</span>
                    <h1>Truck Monitoring System</h1>
                    <p>{isSignup ? 'Create an account' : 'Sign in to continue'}</p>
                </div>

                <form className="login-form" onSubmit={handleSubmit}>
                    {error && (
                        <div className="login-error">
                            {error}
                        </div>
                    )}

                    {/* Name field - only for signup */}
                    {isSignup && (
                        <div className="form-group">
                            <label htmlFor="name">Full Name</label>
                            <input
                                type="text"
                                id="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Enter your full name"
                                disabled={loading}
                                autoComplete="name"
                                autoFocus
                            />
                        </div>
                    )}

                    <div className="form-group">
                        <label htmlFor="email">Email</label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Enter your email"
                            disabled={loading}
                            autoComplete="email"
                            autoFocus={!isSignup}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder={isSignup ? 'Create a password (min 6 chars)' : 'Enter your password'}
                            disabled={loading}
                            autoComplete={isSignup ? 'new-password' : 'current-password'}
                        />
                    </div>

                    {/* Confirm password - only for signup */}
                    {isSignup && (
                        <div className="form-group">
                            <label htmlFor="confirmPassword">Confirm Password</label>
                            <input
                                type="password"
                                id="confirmPassword"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Confirm your password"
                                disabled={loading}
                                autoComplete="new-password"
                            />
                        </div>
                    )}

                    {/* RBAC: Role selector - only for signup */}
                    {isSignup && (
                        <div className="form-group">
                            <label htmlFor="role">Account Type</label>
                            <select
                                id="role"
                                value={role}
                                onChange={(e) => setRole(e.target.value)}
                                disabled={loading}
                                className="role-select"
                            >
                                <option value="gatekeeper">GateKeeper</option>
                                <option value="admin">Admin</option>
                                <option value="superadmin">Super Admin</option>
                            </select>
                            <span className="role-hint">
                                {role === 'superadmin'
                                    ? 'System-wide management across all yards'
                                    : role === 'admin' 
                                        ? 'Full access to all system features' 
                                        : 'Access to RFID Sessions only'}
                            </span>
                        </div>
                    )}

                    <button
                        type="submit"
                        className="login-button"
                        disabled={loading}
                    >
                        {loading 
                            ? (isSignup ? 'Creating account...' : 'Signing in...') 
                            : (isSignup ? 'Create Account' : 'Sign In')
                        }
                    </button>
                </form>

                {/* Toggle between login and signup */}
                <div className="auth-toggle">
                    <p>
                        {isSignup ? 'Already have an account?' : "Don't have an account?"}
                        <button
                            type="button"
                            className="toggle-btn"
                            onClick={handleModeSwitch}
                            disabled={loading}
                        >
                            {isSignup ? 'Sign In' : 'Sign Up'}
                        </button>
                    </p>
                </div>

                <div className="login-footer">
                    <p>Smart Yard Monitoring System</p>
                </div>
            </div>
        </div>
    );
}

export default LoginPage;
