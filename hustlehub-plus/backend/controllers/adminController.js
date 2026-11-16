const userModel = require('../models/userModel');

async function getUsers(req, res, next) {
  try {
    const users = await userModel.readUsers();

    return res.status(200).json({
      success: true,
      data: {
        users: users.map((user) => userModel.toSafeUser(user)),
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { getUsers };