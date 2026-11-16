const express = require('express');

const {
  getMyBookings,
  getMyIncome,
} = require('../controllers/freelancerController');

const {
  protect,
  authorize,
} = require('../middleware/authMiddleware');

const router = express.Router();

// Every route here requires a signed-in freelancer.
router.use(protect, authorize('freelancer'));

router.get('/bookings', getMyBookings);
router.get('/income', getMyIncome);

module.exports = router;