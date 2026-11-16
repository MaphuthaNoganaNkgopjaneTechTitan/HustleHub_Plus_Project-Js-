const jwt = require('jsonwebtoken');
const { jwtSecret, jwtExpiresIn } = require('../config/config');

// Payload only ever contains non-sensitive identifiers (id, role).
// Never put passwords, tokens, or other secrets inside a JWT payload,
// since the payload is base64-encoded, not encrypted, and can be
// decoded by anyone who has the token.
function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
    },
    jwtSecret,
    { expiresIn: jwtExpiresIn }
  );
}

module.exports = generateToken;