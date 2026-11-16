const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'users.json');

// Ensure the data file exists before we ever try to read it.
function ensureDataFile() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2));
  }
}

function readUsers() {
  ensureDataFile();
  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  try {
    return JSON.parse(raw);
  } catch (err) {
    // Corrupt or empty file: fail safe rather than crash the server.
    return [];
  }
}

function writeUsers(users) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(users, null, 2));
}

function findByEmail(email) {
  const users = readUsers();
  return users.find((u) => u.email.toLowerCase() === email.toLowerCase());
}

function findById(id) {
  const users = readUsers();
  return users.find((u) => u.id === id);
}

function createUser({ id, name, email, passwordHash, role }) {
  const users = readUsers();
  const newUser = {
    id,
    name,
    email,
    passwordHash, // NEVER store or return the plain-text password
    role: role || 'client',
    createdAt: new Date().toISOString(),
  };
  users.push(newUser);
  writeUsers(users);
  return newUser;
}

// Strips sensitive fields before a user object is ever sent in a response.
function toSafeUser(user) {
  if (!user) return null;
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

module.exports = {
  readUsers,
  findByEmail,
  findById,
  createUser,
  toSafeUser,
};