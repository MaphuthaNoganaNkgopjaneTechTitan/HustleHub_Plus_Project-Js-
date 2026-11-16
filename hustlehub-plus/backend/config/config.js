require('dotenv').config();

// Centralising config means secrets/settings are read from environment
// variables in one place, rather than scattered through the codebase.
// Fail fast if a critical secret is missing so the app never silently
// runs with an insecure default JWT secret.
const requiredVars = ['JWT_SECRET'];

requiredVars.forEach((key) => {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
});

module.exports = {
  port: process.env.PORT || 5000,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
  nodeEnv: process.env.NODE_ENV || 'development',
};