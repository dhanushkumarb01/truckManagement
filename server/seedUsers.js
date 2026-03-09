import 'dotenv/config';
import mongoose from 'mongoose';
import User from './src/models/User.js';

/**
 * Seed Users for Authentication & RBAC Testing
 * 
 * Creates test users:
 * - admin@test.com (admin role) - Full access
 * - gate1@test.com (gatekeeper role) - RFID Sessions only
 * 
 * Usage:
 *   npm run seed:users           - Add users if not exists
 *   npm run seed:users -- --clean - Clear and recreate users
 */

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

// Test users to seed
const TEST_USERS = [
    {
        name: 'System Admin',
        email: 'admin@test.com',
        password: 'admin123', // Will be hashed by User model
        role: 'admin',
    },
    {
        name: 'Gate Supervisor 1',
        email: 'gate1@test.com',
        password: 'gate123', // Will be hashed by User model
        role: 'gatekeeper',
    },
    {
        name: 'Gate Supervisor 2',
        email: 'gate2@test.com',
        password: 'gate123',
        role: 'gatekeeper',
    },
];

async function seedUsers() {
    console.log('=== User Seed Script ===');
    console.log(`Connecting to MongoDB Atlas: ${maskedUri}`);

    await mongoose.connect(MONGODB_URI);
    console.log('✓ Connected to MongoDB Atlas');

    // Check for --clean flag
    const shouldClean = process.argv.includes('--clean');

    if (shouldClean) {
        await User.deleteMany({});
        console.log('✓ Cleared existing users');
    }

    let insertedCount = 0;
    let skippedCount = 0;

    for (const userData of TEST_USERS) {
        // Check if user already exists
        const existing = await User.findOne({ email: userData.email });
        if (existing) {
            console.log(`  ⊘ ${userData.email} (${userData.role}) already exists, skipping`);
            skippedCount++;
            continue;
        }

        // Create user (password is hashed automatically by pre-save hook)
        await User.create(userData);
        console.log(`  ✓ ${userData.email} (${userData.role}) created`);
        insertedCount++;
    }

    console.log(`\n✓ Seed complete: ${insertedCount} users created, ${skippedCount} skipped`);
    console.log('\nTest Credentials:');
    console.log('  Admin:      admin@test.com / admin123');
    console.log('  Gatekeeper: gate1@test.com / gate123');
    console.log('  Gatekeeper: gate2@test.com / gate123');

    await mongoose.disconnect();
    process.exit(0);
}

seedUsers().catch((err) => {
    console.error('✗ User seed failed:', err.message);
    process.exit(1);
});
