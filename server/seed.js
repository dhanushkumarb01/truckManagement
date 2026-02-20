import 'dotenv/config';
import mongoose from 'mongoose';
import TruckSession from './src/models/TruckSession.js';
import EventLog from './src/models/EventLog.js';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('FATAL: MONGODB_URI is not defined in .env');
    process.exit(1);
}

// Mask connection string for logs
const maskedUri = MONGODB_URI.replace(
    /\/\/([^:]+):([^@]+)@/,
    '//$1:****@'
);

const TRUCKS = [
    {
        truckId: 'TRUCK-101',
        state: 'ENTRY',
        tareWeight: null,
        grossWeight: null,
        invoiceStatus: 'NONE',
        movementLock: false,
        visitCount: 0,
    },
    {
        truckId: 'TRUCK-102',
        state: 'TARE_DONE',
        tareWeight: 12500,
        grossWeight: null,
        invoiceStatus: 'NONE',
        movementLock: false,
        visitCount: 0,
    },
    {
        truckId: 'TRUCK-103',
        state: 'DOCK',
        tareWeight: 13200,
        grossWeight: null,
        invoiceStatus: 'NONE',
        movementLock: false,
        visitCount: 1,
    },
    {
        truckId: 'TRUCK-104',
        state: 'INVOICE_GENERATED',
        tareWeight: 11800,
        grossWeight: 28500,
        invoiceStatus: 'GENERATED',
        movementLock: true,
        visitCount: 2,
    },
    {
        truckId: 'TRUCK-105',
        state: 'EXITED',
        tareWeight: 14000,
        grossWeight: 31200,
        invoiceStatus: 'GENERATED',
        movementLock: true,
        visitCount: 1,
    },
];

const EVENTS_MAP = {
    'TRUCK-101': [
        { eventType: 'SESSION_START', message: 'Session started for truck TRUCK-101' },
    ],
    'TRUCK-102': [
        { eventType: 'SESSION_START', message: 'Session started for truck TRUCK-102' },
        { eventType: 'TARE_RECORDED', message: 'Tare weight recorded: 12500 kg' },
    ],
    'TRUCK-103': [
        { eventType: 'SESSION_START', message: 'Session started for truck TRUCK-103' },
        { eventType: 'TARE_RECORDED', message: 'Tare weight recorded: 13200 kg' },
        { eventType: 'DOCK_ENTRY', message: 'Entered loading dock (visit #1). RFID verified. Camera confirmed.' },
    ],
    'TRUCK-104': [
        { eventType: 'SESSION_START', message: 'Session started for truck TRUCK-104' },
        { eventType: 'TARE_RECORDED', message: 'Tare weight recorded: 11800 kg' },
        { eventType: 'DOCK_ENTRY', message: 'Entered loading dock (visit #1). RFID verified. Camera confirmed.' },
        { eventType: 'GROSS_RECORDED', message: 'Gross weight recorded: 28500 kg (Net: 16700 kg)' },
        { eventType: 'DOCK_ENTRY', message: 'Entered loading dock (visit #2). RFID verified. Camera confirmed.' },
        { eventType: 'GROSS_RECORDED', message: 'Gross weight recorded: 28500 kg (Net: 16700 kg)' },
        { eventType: 'INVOICE_GENERATED', message: 'Invoice generated. Net weight: 16700 kg. Movement locked.' },
    ],
    'TRUCK-105': [
        { eventType: 'SESSION_START', message: 'Session started for truck TRUCK-105' },
        { eventType: 'TARE_RECORDED', message: 'Tare weight recorded: 14000 kg' },
        { eventType: 'DOCK_ENTRY', message: 'Entered loading dock (visit #1). RFID verified. Camera confirmed.' },
        { eventType: 'GROSS_RECORDED', message: 'Gross weight recorded: 31200 kg (Net: 17200 kg)' },
        { eventType: 'INVOICE_GENERATED', message: 'Invoice generated. Net weight: 17200 kg. Movement locked.' },
        { eventType: 'SESSION_EXIT', message: 'Truck TRUCK-105 exited the facility. Session complete.' },
    ],
};

async function seed() {
    console.log(`Connecting to MongoDB Atlas: ${maskedUri}`);

    await mongoose.connect(MONGODB_URI);
    console.log('✓ Connected to MongoDB Atlas');

    // Check for --clean flag
    const shouldClean = process.argv.includes('--clean');

    if (shouldClean) {
        await TruckSession.deleteMany({});
        await EventLog.deleteMany({});
        console.log('✓ Cleared existing data');
    }

    let insertedSessions = 0;
    let insertedEvents = 0;

    for (const truck of TRUCKS) {
        // Skip if session already exists (don't crash if data exists)
        const existing = await TruckSession.findOne({ truckId: truck.truckId });
        if (existing) {
            console.log(`  ⊘ ${truck.truckId} already exists, skipping`);
            continue;
        }

        const now = new Date();
        await TruckSession.create(truck);
        insertedSessions++;

        // Insert events with staggered timestamps
        const events = EVENTS_MAP[truck.truckId] || [];
        for (let i = 0; i < events.length; i++) {
            await EventLog.create({
                truckId: truck.truckId,
                eventType: events[i].eventType,
                message: events[i].message,
                timestamp: new Date(now.getTime() - (events.length - i) * 60000),
            });
            insertedEvents++;
        }

        console.log(`  ✓ ${truck.truckId} (${truck.state}) — ${events.length} events`);
    }

    console.log(`\n✓ Seed complete: ${insertedSessions} sessions, ${insertedEvents} events`);

    await mongoose.disconnect();
    process.exit(0);
}

seed().catch((err) => {
    console.error('✗ Seed failed:', err.message);
    process.exit(1);
});
