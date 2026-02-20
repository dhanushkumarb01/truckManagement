import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import sessionRoutes, { getAllSessions } from './routes/sessionRoutes.js';
import eventRoutes from './routes/eventRoutes.js';
import locationRoutes from './routes/locationRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';

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
        methods: ['GET', 'POST'],
        credentials: true,
    })
);

// --- Body parser ---
app.use(express.json());

// --- Routes ---
app.use('/api/session', sessionRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/location', locationRoutes);
app.get('/api/sessions', getAllSessions);

// --- Health check ---
app.get('/api/health', (_req, res) => {
    res.json({ success: true, data: null, message: 'Server is running' });
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
