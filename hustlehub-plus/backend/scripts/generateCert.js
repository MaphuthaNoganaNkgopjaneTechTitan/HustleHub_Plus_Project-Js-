// Generates a local self-signed SSL certificate for development HTTPS.
// Works cross-platform (Windows/macOS/Linux) since it doesn't rely on the
// OpenSSL CLI being installed - useful when developing in PowerShell.
//
// Run with: npm run generate-cert
const fs = require('fs');
const path = require('path');
const selfsigned = require('selfsigned');

async function main() {
  const attrs = [{ name: 'commonName', value: 'localhost' }];

  // selfsigned v3+ generate() is async and returns a Promise.
  const pems = await selfsigned.generate(attrs, {
    keySize: 2048,
    notAfterDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
    extensions: [
      {
        name: 'subjectAltName',
        altNames: [
          { type: 2, value: 'localhost' }, // DNS
          { type: 7, ip: '127.0.0.1' }, // IP
        ],
      },
    ],
  });

  const certsDir = path.join(__dirname, '..', 'certs');
  if (!fs.existsSync(certsDir)) {
    fs.mkdirSync(certsDir);
  }

  fs.writeFileSync(path.join(certsDir, 'key.pem'), pems.private);
  fs.writeFileSync(path.join(certsDir, 'cert.pem'), pems.cert);

  console.log('Self-signed certificate generated at backend/certs/ (key.pem, cert.pem)');
  console.log('Your browser/Postman will warn this cert is untrusted - that is expected for a local dev cert.');
}

main().catch((err) => {
  console.error('Certificate generation failed:', err.message);
  process.exit(1);
});