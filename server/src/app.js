import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import sessionRoutes, { getAllSessions } from './routes/sessionRoutes.js';
import eventRoutes from './routes/eventRoutes.js';
import locationRoutes from './routes/locationRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';

// ============ NEW MODULE ROUTES ============
import fastagRoutes from './routes/fastagRoutes.js';
import vehicleRoutes from './routes/vehicleRoutes.js';
import zoneRoutes from './routes/zoneRoutes.js';
import alertsRoutes from './routes/alertsRoutes.js';
import rfidRoutes from './routes/rfidRoutes.js';
import yardConfigRoutes from './routes/yardConfigRoutes.js';

const app = express();
const PORT = process.env.PORT || 5000;

// --- CORS ---
const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    process.env.FRONTEND_URL,
].filter(Boolean);

app.use(
    cors({
        origin: (origin, callback) => {
            // Allow requests with no origin (mobile apps, Postman, curl)
            if (!origin) return callback(null, true);
            // Allow if origin is in allowed list
            if (allowedOrigins.includes(origin)) return callback(null, true);
            // Allow any .onrender.com domain
            if (origin.endsWith('.onrender.com')) return callback(null, true);
            // Block others
            callback(new Error('Not allowed by CORS'));
        },
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
        credentials: true,
    })
);

// --- Body parser ---
app.use(express.json());

// --- API v1 Routes (versioned - recommended for new clients) ---
app.use('/api/v1/session', sessionRoutes);
app.use('/api/v1/events', eventRoutes);
app.use('/api/v1/location', locationRoutes);
app.get('/api/v1/sessions', getAllSessions);
app.use('/api/v1/fastag', fastagRoutes);
app.use('/api/v1/vehicles', vehicleRoutes);
app.use('/api/v1/zones', zoneRoutes);
app.use('/api/v1/alerts', alertsRoutes);
app.use('/api/v1/rfid', rfidRoutes);
app.use('/api/v1/yard-config', yardConfigRoutes);

// --- Legacy Routes (backward compatibility - will be deprecated) ---
app.use('/api/session', sessionRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/location', locationRoutes);
app.get('/api/sessions', getAllSessions);

// --- NEW MODULE ROUTES ---
app.use('/api/fastag', fastagRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/zones', zoneRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/rfid', rfidRoutes);
app.use('/api/yard-config', yardConfigRoutes);

// --- Health check ---
app.get('/api/health', (_req, res) => {
    res.json({ success: true, data: null, message: 'Server is running' });
});
app.get('/api/v1/health', (_req, res) => {
    res.json({ success: true, data: null, message: 'API v1 is running', version: '1.0.0' });
});

// --- Global error handler ---
app.use(errorHandler);

// --- Connect to MongoDB Atlas and start server ---
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('FATAL: MONGODB_URI is not defined in .env');
    process.exit(1);
}

mongoose
    .connect(MONGODB_URI)
    .then(() => {
        console.log('✓ Connected to MongoDB Atlas');
        app.listen(PORT, () => {
            console.log(`✓ Server running on http://localhost:${PORT}`);
        });
    })
    .catch((err) => {
        console.error('✗ MongoDB connection failed:', err.message);
        process.exit(1);
    });
