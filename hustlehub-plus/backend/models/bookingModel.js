const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    gigId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Gig',
      required: true,
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
    gigTitle: {
      type: String,
      required: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
      validate: {
        validator: Number.isFinite,
        message: 'Amount must be a finite number.',
      },
    },
    currency: {
      type: String,
      enum: ['ZAR'],
      default: 'ZAR',
    },
    status: {
      type: String,
      enum: ['confirmed', 'cancelled'],
      default: 'confirmed',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Booking', bookingSchema);