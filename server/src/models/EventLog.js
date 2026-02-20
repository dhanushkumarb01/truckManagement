import mongoose from 'mongoose';

const eventLogSchema = new mongoose.Schema({
    truckId: {
        type: String,
        required: true,
        index: true,
    },
    eventType: {
        type: String,
        required: true,
    },
    message: {
        type: String,
        required: true,
    },
    timestamp: {
        type: Date,
        default: Date.now,
    },
});

const EventLog = mongoose.model('EventLog', eventLogSchema);

export default EventLog;
