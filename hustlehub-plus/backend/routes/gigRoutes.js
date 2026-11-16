const express = require('express');

const {
  createGig,
  browseGigs,
  getMyGigs,
  updateGig,
  deleteGig,
} = require('../controllers/gigController');

const {
  protect,
  authorize,
} = require('../middleware/authMiddleware');

const {
  createGigValidationRules,
  gigIdValidationRules,
  updateGigValidationRules,
  handleValidationErrors,
} = require('../middleware/validators');

const router = express.Router();

router.get('/', browseGigs);

router.get(
  '/mine',
  protect,
  authorize('freelancer'),
  getMyGigs
);

router.post(
  '/',
  protect,
  authorize('freelancer'),
  createGigValidationRules,
  handleValidationErrors,
  createGig
);

router.patch(
  '/:id',
  protect,
  authorize('freelancer'),
  gigIdValidationRules,
  updateGigValidationRules,
  handleValidationErrors,
  updateGig
);

router.delete(
  '/:id',
  protect,
  authorize('freelancer'),
  gigIdValidationRules,
  handleValidationErrors,
  deleteGig
);

module.exports = router;