const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const dataDir = path.join(__dirname, '..', 'data');
const dataFile = path.join(dataDir, 'bookings.json');

function ensureDataFile() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, '[]', 'utf8');
  }
}

function readBookings() {
  ensureDataFile();

  try {
    const data = fs.readFileSync(dataFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    throw new Error('Unable to read booking data.');
  }
}

function writeBookings(bookings) {
  ensureDataFile();

  try {
    fs.writeFileSync(
      dataFile,
      JSON.stringify(bookings, null, 2),
      'utf8'
    );
  } catch (error) {
    throw new Error('Unable to save booking data.');
  }
}

function createBooking({
  clientId,
  freelancerId,
  gigId,
  amount,
}) {
  const bookings = readBookings();

  const booking = {
    id: crypto.randomUUID(),
    clientId,
    freelancerId,
    gigId,
    amount,
    status: 'confirmed',
    confirmationCode: `HH-${crypto
      .randomBytes(4)
      .toString('hex')
      .toUpperCase()}`,
    createdAt: new Date().toISOString(),
  };

  bookings.push(booking);
  writeBookings(bookings);

  return booking;
}

function findBookingById(id) {
  return readBookings().find((booking) => booking.id === id);
}

function findBookingsByClient(clientId) {
  return readBookings().filter(
    (booking) => booking.clientId === clientId
  );
}

function findBookingsByFreelancer(freelancerId) {
  return readBookings().filter(
    (booking) => booking.freelancerId === freelancerId
  );
}

module.exports = {
  createBooking,
  findBookingById,
  findBookingsByClient,
  findBookingsByFreelancer,
};