import mongoose from 'mongoose';

// QR expiration time in minutes
const QR_EXPIRATION_MINUTES = 15;

const truckSessionSchema = new mongoose.Schema(
  {
    truckId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    state: {
      type: String,
      enum: ['ENTRY', 'TARE_DONE', 'DOCK', 'GROSS_DONE', 'INVOICE_GENERATED', 'EXITED'],
      default: 'ENTRY',
    },
    // RFID/FastTag metadata
    fastTagId: {
      type: String,
      trim: true,
      index: true,
    },
    vehicleRegistration: {
      type: String,
      trim: true,
    },
    yardId: {
      type: String,
      default: 'DEFAULT_YARD',
    },
    entryTimestamp: {
      type: Date,
      default: Date.now,
    },
    startedBy: {
      type: String,
      enum: ['RFID', 'MANUAL', 'FASTAG', 'SIMULATION'],
      default: 'MANUAL',
    },
    tareWeight: {
      type: Number,
      default: null,
    },
    grossWeight: {
      type: Number,
      default: null,
    },
    invoiceStatus: {
      type: String,
      enum: ['NONE', 'GENERATED'],
      default: 'NONE',
    },
    movementLock: {
      type: Boolean,
      default: false,
    },
    visitCount: {
      type: Number,
      default: 0,
    },
    // QR expiration fields
    qrCreatedAt: {
      type: Date,
      default: Date.now,
    },
    qrExpiresAt: {
      type: Date,
      default: function() {
        return new Date(Date.now() + QR_EXPIRATION_MINUTES * 60 * 1000);
      },
    },
    // Driver QR scan binding (Fix #3)
    driverLinked: {
      type: Boolean,
      default: false,
    },
    driverLinkedAt: {
      type: Date,
      default: null,
    },
    // Exit tracking fields (Fix #4)
    exitTimestamp: {
      type: Date,
      default: null,
    },
    exitGate: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

/**
 * Check if QR code is expired
 */
truckSessionSchema.methods.isQrExpired = function() {
  return this.qrExpiresAt && new Date() > this.qrExpiresAt;
};

/**
 * Regenerate QR expiration (extends by another QR_EXPIRATION_MINUTES)
 */
truckSessionSchema.methods.regenerateQrExpiration = function() {
  this.qrCreatedAt = new Date();
  this.qrExpiresAt = new Date(Date.now() + QR_EXPIRATION_MINUTES * 60 * 1000);
};

const TruckSession = mongoose.model('TruckSession', truckSessionSchema);

export default TruckSession;
export { QR_EXPIRATION_MINUTES };
