const bcrypt = require('bcrypt');
const crypto = require('crypto');
const userModel = require('../models/userModel');
const generateToken = require('../utils/generateToken');

const SALT_ROUNDS = 12; // higher cost factor = slower brute force, still fast enough for UX

// @route  POST /api/auth/register
// @access Public
async function register(req, res, next) {
  try {
    const { name, email, password, role } = req.body;

    const existingUser = userModel.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists.',
      });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const newUser = userModel.createUser({
      id: crypto.randomUUID(),
      name,
      email,
      passwordHash,
      role,
    });

    const token = generateToken(newUser);

    return res.status(201).json({
      success: true,
      message: 'User registered successfully.',
      data: {
        user: userModel.toSafeUser(newUser),
        token,
      },
    });
  } catch (err) {
    next(err); // hand off to centralised error handler (built in Step 9)
  }
}

// @route  POST /api/auth/login
// @access Public
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const user = userModel.findByEmail(email);

    // Deliberately identical response whether the email doesn't exist or the
    // password is wrong. Distinguishing the two lets an attacker enumerate
    // valid accounts.
    const invalidCredentialsResponse = () =>
      res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });

    if (!user) {
      return invalidCredentialsResponse();
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      return invalidCredentialsResponse();
    }

    const token = generateToken(user);

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      data: {
        user: userModel.toSafeUser(user),
        token,
      },
    });
  } catch (err) {
    next(err);
  }
}

// @route  GET /api/auth/me
// @access Private (JWT required) - demonstrates route protection beyond login
async function getMe(req, res) {
  return res.status(200).json({
    success: true,
    data: { user: req.user },
  });
}

module.exports = { register, login, getMe };