const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      unique: true,
      immutable: true,
    },
    clientId: {
      type: String,
      required: true,
      immutable: true,
      index: true,
    },
    freelancerId: {
      type: String,
      required: true,
      immutable: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
      immutable: true,
      validate: {
        validator: (value) =>
          Number.isFinite(value) &&
          Number.isSafeInteger(Math.round(value * 100)) &&
          Math.abs(value * 100 - Math.round(value * 100)) < 0.000001,
        message: 'Amount must have no more than two decimal places.',
      },
    },
    currency: {
      type: String,
      enum: ['ZAR'],
      default: 'ZAR',
      immutable: true,
    },
    status: {
      type: String,
      enum: ['completed', 'refunded'],
      default: 'completed',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Transaction', transactionSchema);