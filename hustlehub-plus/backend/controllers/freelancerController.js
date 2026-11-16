const Booking = require('../models/bookingModel');
const Transaction = require('../models/transactionModel');

// View only bookings belonging to the signed-in freelancer.
async function getMyBookings(req, res, next) {
  try {
    const bookings = await Booking.find({
      freelancerId: req.user.id,
    })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: { bookings },
    });
  } catch (error) {
    next(error);
  }
}

// Calculate income only from this freelancer's completed transactions.
async function getMyIncome(req, res, next) {
  try {
    const [summary] = await Transaction.aggregate([
      {
        $match: {
          freelancerId: req.user.id,
          status: 'completed',
          currency: 'ZAR',
        },
      },
      {
        $group: {
          _id: null,
          totalCents: {
            $sum: {
              $round: [{ $multiply: ['$amount', 100] }, 0],
            },
          },
          transactionCount: { $sum: 1 },
        },
      },
    ]);

    return res.status(200).json({
      success: true,
      data: {
        currency: 'ZAR',
        totalIncome: summary ? summary.totalCents / 100 : 0,
        transactionCount: summary ? summary.transactionCount : 0,
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getMyBookings,
  getMyIncome,
};