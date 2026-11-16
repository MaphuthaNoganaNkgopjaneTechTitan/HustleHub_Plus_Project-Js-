require('dotenv').config();

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const userModel = require('../models/userModel');
const Gig = require('../models/gigModel');
const Booking = require('../models/bookingModel');
const Transaction = require('../models/transactionModel');

async function seedTestData() {
  try {
    await connectDB();

    const client = await userModel.findByEmail('client.part2@example.com');
    const first = await userModel.findByEmail('freelancer.part2@example.com');
    const second = await userModel.findByEmail('freelancer2.part2@example.com');

    if (!client || !first || !second) {
      throw new Error('The three test accounts must exist first.');
    }

    const cases = [
      {
        title: '[Member1 Test] First freelancer completed',
        freelancer: first,
        amount: 650,
        status: 'completed',
      },
      {
        title: '[Member1 Test] First freelancer refunded',
        freelancer: first,
        amount: 100,
        status: 'refunded',
      },
      {
        title: '[Member1 Test] Second freelancer completed',
        freelancer: second,
        amount: 900,
        status: 'completed',
      },
    ];

    for (const test of cases) {
      const existing = await Gig.findOne({
        title: test.title,
        freelancerId: test.freelancer.id,
      });

      if (existing) {
        throw new Error(
          'Test data already exists. Do not run this script again.'
        );
      }
    }

    for (const test of cases) {
      const gig = await Gig.create({
        freelancerId: test.freelancer.id,
        title: test.title,
        description: 'Test data for Member 1 income and ownership checks.',
        price: test.amount,
        isAvailable: false,
      });

      const booking = await Booking.create({
        gigId: gig._id,
        clientId: client.id,
        freelancerId: test.freelancer.id,
        gigTitle: gig.title,
        amount: test.amount,
        currency: 'ZAR',
        status: test.status === 'refunded' ? 'cancelled' : 'confirmed',
      });

      await Transaction.create({
        bookingId: booking._id,
        clientId: client.id,
        freelancerId: test.freelancer.id,
        amount: test.amount,
        currency: 'ZAR',
        status: test.status,
      });
    }

    console.log('Member 1 test data created successfully.');
  } catch (error) {
    console.error('Test setup failed:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

seedTestData();