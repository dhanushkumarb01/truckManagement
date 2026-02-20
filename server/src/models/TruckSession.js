import mongoose from 'mongoose';

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
  },
  { timestamps: true }
);

const TruckSession = mongoose.model('TruckSession', truckSessionSchema);

export default TruckSession;
