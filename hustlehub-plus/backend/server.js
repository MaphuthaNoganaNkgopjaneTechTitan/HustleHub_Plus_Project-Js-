const fs = require('fs');
const https = require('https');
const path = require('path');
const express = require('express');
const cors = require('cors');

const { port } = require('./config/config');
const authRoutes = require('./routes/authRoutes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

// --- Core middleware ---
app.use(cors());
app.use(express.json({ limit: '10kb' })); // limit body size as a basic DoS guard
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// --- Routes ---
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'HustleHub+ API is running securely over HTTPS.',
  });
});

app.use('/api/auth', authRoutes);

// --- Error handling (must be registered last) ---
app.use(notFound);
app.use(errorHandler);

// --- HTTPS setup ---
// The API must be served over HTTPS using a locally configured SSL
// certificate (see certs/ - generated via npm run generate-cert).
// Loading them here, outside of any request handler, means a missing/bad
// certificate fails the server at startup rather than leaking a plaintext
// fallback silently.
const keyPath = path.join(__dirname, 'certs', 'key.pem');
const certPath = path.join(__dirname, 'certs', 'cert.pem');

if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
  console.error(
    'SSL certificate/key not found in backend/certs/. Run "npm run generate-cert" first.'
  );
  process.exit(1);
}

const httpsOptions = {
  key: fs.readFileSync(keyPath),
  cert: fs.readFileSync(certPath),
};

https.createServer(httpsOptions, app).listen(port, () => {
  console.log(`HustleHub+ API listening securely on https://localhost:${port}`);
});