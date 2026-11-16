require('dotenv').config();

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const userModel = require('../models/userModel');

async function migrateUsers() {
  try {
    await connectDB();

    const filePath = path.join(__dirname, '..', 'data', 'users.json');
    const users = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    if (!Array.isArray(users)) {
      throw new Error('users.json must contain an array.');
    }

    let imported = 0;
    let skipped = 0;

    for (const oldUser of users) {
      const valid =
        typeof oldUser.id === 'string' &&
        typeof oldUser.name === 'string' &&
        typeof oldUser.email === 'string' &&
        typeof oldUser.passwordHash === 'string' &&
        /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(oldUser.passwordHash) &&
        ['client', 'freelancer', 'admin'].includes(oldUser.role);

      if (!valid) {
        throw new Error('An old account has missing or invalid fields.');
      }

      const byEmail = await userModel.findByEmail(oldUser.email);
      const byId = await userModel.findById(oldUser.id);

      if (byEmail || byId) {
        if (
          byEmail &&
          byId &&
          byEmail.id === oldUser.id &&
          byId.email === oldUser.email.trim().toLowerCase()
        ) {
          skipped++;
          continue;
        }

        throw new Error(
          'An account has a conflicting ID or email. Migration stopped.'
        );
      }

      const User = mongoose.model('User');

      await User.create({
        id: oldUser.id,
        name: oldUser.name,
        email: oldUser.email,
        passwordHash: oldUser.passwordHash,
        role: oldUser.role,
        createdAt: oldUser.createdAt || new Date(),
      });

      imported++;
    }

    console.log(`Migration finished: ${imported} imported, ${skipped} skipped.`);
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

migrateUsers();