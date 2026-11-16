const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/config');
const userModel = require('../models/userModel');

// Protects any route it's attached to. Expects: Authorization: Bearer <token>
async function protect(req, res, next) {
  let token;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorised. No token provided.',
    });
  }

  try {
    const decoded = jwt.verify(token, jwtSecret);

    // Re-fetch the user so downstream handlers always have current data,
    // and so a deleted/disabled user can't keep using an old valid token.
    const user = userModel.findById(decoded.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorised. User no longer exists.',
      });
    }

    req.user = userModel.toSafeUser(user);
    next();
  } catch (err) {
    // Deliberately generic: never reveal whether the token was expired,
    // malformed, or tampered with — that detail is not useful to a client
    // and is useful to an attacker.
    return res.status(401).json({
      success: false,
      message: 'Not authorised. Invalid or expired token.',
    });
  }
}

// Optional role guard, ready to use in Part 2 for RBAC (e.g. protect, authorize('freelancer'))
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You do not have permission to perform this action.',
      });
    }
    next();
  };
}

module.exports = { protect, authorize };