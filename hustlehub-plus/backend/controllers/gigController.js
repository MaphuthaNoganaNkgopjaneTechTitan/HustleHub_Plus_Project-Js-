const Gig = require('../models/gigModel');

// Create a gig owned by the signed-in freelancer.
async function createGig(req, res, next) {
  try {
    const { title, description, price } = req.body;

    const gig = await Gig.create({
      freelancerId: req.user.id,
      title,
      description,
      price,
    });

    return res.status(201).json({
      success: true,
      message: 'Gig created successfully.',
      data: { gig },
    });
  } catch (error) {
    next(error);
  }
}

// Browse gigs available for booking.
async function browseGigs(req, res, next) {
  try {
    const gigs = await Gig.find({ isAvailable: true })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: { gigs },
    });
  } catch (error) {
    next(error);
  }
}

// View all gigs belonging to the signed-in freelancer.
async function getMyGigs(req, res, next) {
  try {
    const gigs = await Gig.find({
      freelancerId: req.user.id,
    })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: { gigs },
    });
  } catch (error) {
    next(error);
  }
}
// Update only a gig owned by the signed-in freelancer.
async function updateGig(req, res, next) {
  try {
    const { title, description, price, isAvailable } = req.body;
    const changes = {};

    if (title !== undefined) changes.title = title;
    if (description !== undefined) changes.description = description;
    if (price !== undefined) changes.price = price;
    if (isAvailable !== undefined) changes.isAvailable = isAvailable;

    const gig = await Gig.findOneAndUpdate(
      {
        _id: req.params.id,
        freelancerId: req.user.id,
      },
      { $set: changes },
      { new: true, runValidators: true }
    );

    if (!gig) {
      return res.status(404).json({
        success: false,
        message: 'Gig not found or you do not have access.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Gig updated successfully.',
      data: { gig },
    });
  } catch (error) {
    next(error);
  }
}

// Delete only a gig owned by the signed-in freelancer.
async function deleteGig(req, res, next) {
  try {
    const gig = await Gig.findOneAndDelete({
      _id: req.params.id,
      freelancerId: req.user.id,
    });

    if (!gig) {
      return res.status(404).json({
        success: false,
        message: 'Gig not found or you do not have access.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Gig deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createGig,
  browseGigs,
  getMyGigs,
  updateGig,
  deleteGig,
};