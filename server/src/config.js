const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Validate critical environment variables in production
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  console.error('[SECURITY] JWT_SECRET must be set to a strong secret (32+ chars) in production!');
  process.exit(1);
}

if (isProduction && !process.env.MONGO_URI) {
  console.error('[SECURITY] MONGO_URI must be set in production!');
  process.exit(1);
}

module.exports = {
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/trustvault',
  jwtSecret: process.env.JWT_SECRET || 'dev_only_change_in_production_' + require('crypto').randomBytes(16).toString('hex'),
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  env: process.env.NODE_ENV || 'development'
};
