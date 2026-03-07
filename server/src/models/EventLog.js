import mongoose from 'mongoose';

const eventLogSchema = new mongoose.Schema({
    truckId: {
        type: String,
        required: true,
        index: true,
    },
    sessionId: {
        type: String,
        index: true,
    },
    eventType: {
        type: String,
        required: true,
        index: true,
    },
    severity: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium',
    },
    message: {
        type: String,
        required: true,
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
    },
    acknowledged: {
        type: Boolean,
        default: false,
    },
    acknowledgedBy: {
        type: String,
    },
    acknowledgedAt: {
        type: Date,
    },
    timestamp: {
        type: Date,
        default: Date.now,
    },
});

const EventLog = mongoose.model('EventLog', eventLogSchema);

export default EventLog;
