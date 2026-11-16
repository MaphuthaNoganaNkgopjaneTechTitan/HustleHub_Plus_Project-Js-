const mongoose = require('mongoose');

const gigSchema = new mongoose.Schema(
  {
    freelancerId: {
      type: String,
      required: true,
      immutable: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    price: {
      type: Number,
      required: true,
      min: 0.01,
      validate: {
        validator: Number.isFinite,
        message: 'Price must be a finite number.',
      },
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Gig', gigSchema);