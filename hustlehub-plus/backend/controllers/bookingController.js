const Booking = require('../models/bookingModel');
const Transaction = require('../models/transactionModel');
const Gig = require('../models/gigModel');

async function createBookingController(req, res, next) {
  try {
    const { gigId } = req.body;

    // The client ID comes from the verified JWT,
    // not from the request body.
    const clientId = req.user.id;

    if (!gigId) {
      return res.status(400).json({
        success: false,
        message: 'gigId is required.',
      });
    }

    // Find the gig in MongoDB.
    const gig = await Gig.findById(gigId);

    if (!gig) {
      return res.status(404).json({
        success: false,
        message: 'Gig not found.',
      });
    }

    // Prevent a freelancer from booking their own gig.
    if (gig.freelancerId === clientId) {
      return res.status(403).json({
        success: false,
        message: 'You cannot book your own gig.',
      });
    }

    // Prevent booking unavailable gigs.
    if (gig.isAvailable !== true) {
      return res.status(409).json({
        success: false,
        message: 'This gig is not currently available.',
      });
    }

    // The price comes from the gig.
    // We do NOT trust a client-supplied amount.
    const amount = Number(gig.price);

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(500).json({
        success: false,
        message: 'Gig has an invalid price.',
      });
    }

    const booking = await Booking.create({
      clientId,
      freelancerId: gig.freelancerId,
      gigId: gig._id,
      gigTitle: gig.title,
      amount,
      currency: 'ZAR',
      status: 'confirmed',
    });

    // Simulated successful payment.
    const transaction = await Transaction.create({
      bookingId: booking._id,
      clientId,
      freelancerId: gig.freelancerId,
      amount,
      currency: 'ZAR',
      status: 'completed',
    });

    return res.status(201).json({
      success: true,
      message: 'Booking created and payment simulated successfully.',
      booking,
      transaction,
    });
  } catch (error) {
    next(error);
  }
}

async function getMyBookings(req, res, next) {
  try {
    const bookings = await Booking.find({
      clientId: req.user.id,
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: bookings.length,
      bookings,
    });
  } catch (error) {
    next(error);
  }
}

async function getFreelancerBookings(req, res, next) {
  try {
    const bookings = await Booking.find({
      freelancerId: req.user.id,
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: bookings.length,
      bookings,
    });
  } catch (error) {
    next(error);
  }
}

async function getFreelancerIncome(req, res, next) {
  try {
    const transactions = await Transaction.find({
      freelancerId: req.user.id,
      status: 'completed',
    });

    const income = transactions.reduce(
      (total, transaction) => total + Number(transaction.amount),
      0
    );

    return res.status(200).json({
      success: true,
      freelancerId: req.user.id,
      successfulIncome: income,
      transactionCount: transactions.length,
      currency: 'ZAR',
    });
  } catch (error) {
    next(error);
  }
}

async function getBookingById(req, res, next) {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found.',
      });
    }

    // Only the client, freelancer, or admin associated
    // with the booking may view it.
    const isClient = booking.clientId === req.user.id;
    const isFreelancer = booking.freelancerId === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isClient && !isFreelancer && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorised to view this booking.',
      });
    }

    return res.status(200).json({
      success: true,
      booking,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createBookingController,
  getMyBookings,
  getFreelancerBookings,
  getFreelancerIncome,
  getBookingById,
};