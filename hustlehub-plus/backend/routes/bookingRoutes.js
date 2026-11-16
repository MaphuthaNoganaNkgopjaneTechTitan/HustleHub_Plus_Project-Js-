const express = require('express');

const router = express.Router();

const {
  createBookingController,
  getMyBookings,
  getFreelancerBookings,
  getFreelancerIncome,
  getBookingById,
} = require('../controllers/bookingController');

const {
  protect,
  authorize,
} = require('../middleware/authMiddleware');

const {
  bookingValidationRules,
  handleValidationErrors,
} = require('../middleware/validators');

const { bookingLimiter } = require('../middleware/rateLimiter');

// Every booking route requires a valid JWT.
router.use(protect);

// Client creates a booking.
router.post(
  '/',
  authorize('client'),
  bookingLimiter,
  bookingValidationRules,
  handleValidationErrors,
  createBookingController
);

// Client views their own bookings.
router.get(
  '/mine',
  authorize('client'),
  getMyBookings
);

// Freelancer views bookings received for their gigs.
router.get(
  '/freelancer/received',
  authorize('freelancer'),
  getFreelancerBookings
);

// Freelancer views income from successful transactions.
router.get(
  '/freelancer/income',
  authorize('freelancer'),
  getFreelancerIncome
);

// Client, freelancer, or admin can view an authorised booking.
router.get(
  '/:id',
  getBookingById
);

module.exports = router;