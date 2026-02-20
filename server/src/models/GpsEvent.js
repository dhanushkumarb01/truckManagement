import mongoose from 'mongoose';

const gpsEventSchema = new mongoose.Schema(
    {
        truckId: {
            type: String,
            required: true,
            index: true,
        },
        latitude: {
            type: Number,
            required: true,
        },
        longitude: {
            type: Number,
            required: true,
        },
        accuracy: {
            type: Number,
            required: true,
        },
        timestamp: {
            type: Date,
            required: true,
        },
        eventType: {
            type: String,
            default: 'GPS_UPDATE',
        },
    },
    { timestamps: true }
);

const GpsEvent = mongoose.model('GpsEvent', gpsEventSchema);

export default GpsEvent;
