import mongoose from 'mongoose';

/**
 * Vehicle Master Collection
 * Stores registered vehicles with their FastTag identity
 * 
 * NOTE: This does NOT replace existing TruckSession model.
 * TruckSession handles workflow state (ENTRY -> EXITED).
 * Vehicle is the master identity registry for FastTag binding.
 */
const vehicleSchema = new mongoose.Schema(
    {
        vehicleNumber: {
            type: String,
            required: true,
            unique: true,
            uppercase: true,
            trim: true,
            index: true,
        },
        fastTagId: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            index: true,
        },
        vehicleType: {
            type: String,
            enum: ['TRUCK', 'TRAILER', 'TANKER', 'CONTAINER', 'OTHER'],
            default: 'TRUCK',
        },
        status: {
            type: String,
            enum: ['ACTIVE', 'INACTIVE', 'BLOCKED'],
            default: 'ACTIVE',
        },
        // Additional metadata for production use
        ownerName: {
            type: String,
            trim: true,
        },
        transporterCode: {
            type: String,
            trim: true,
        },
    },
    { timestamps: true }
);

// Compound index for efficient lookups
vehicleSchema.index({ fastTagId: 1, status: 1 });

const Vehicle = mongoose.model('Vehicle', vehicleSchema);

export default Vehicle;
