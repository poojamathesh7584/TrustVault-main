const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const config = require('./config');

// Prevent Mongoose from buffering commands when MongoDB is disconnected
mongoose.set('bufferCommands', false);

const authRoutes = require('./routes/auth');
const documentRoutes = require('./routes/documents');
const recordRoutes = require('./routes/records');
const accessRoutes = require('./routes/access');
const shareRoutes = require('./routes/shares');
const adminRoutes = require('./routes/admin');

const app = express();

// --- Security Middlewares ---

// Helmet for security headers (XSS protection, content-type sniffing, etc.)
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false // Disable CSP in dev (React dev server needs it)
}));

// CORS — allow configured clientOrigin as well as localhost / LAN Vite dev origins
const allowedOrigins = new Set([
  config.clientOrigin || 'http://localhost:5173',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
]);
if (process.env.VERCEL_URL) {
  allowedOrigins.add(`https://${process.env.VERCEL_URL}`);
}
if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
  allowedOrigins.add(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
}

app.use(cors({
  origin: (origin, callback) => {
    if (
      !origin ||
      allowedOrigins.has(origin) ||
      /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin) ||
      /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/.test(origin)
    ) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(cookieParser());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Disable X-Powered-By header
app.disable('x-powered-by');

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/records', recordRoutes);
app.use('/api/access', accessRoutes);
app.use('/api/shares', shareRoutes);
app.use('/api/admin', adminRoutes);

// Global Error Handler — don't leak stack traces in production
app.use((err, req, res, next) => {
  console.error('API Error:', err.stack);
  const message = config.env === 'production'
    ? 'Internal Server Error'
    : (err.message || 'Internal Server Error');
  res.status(err.status || 500).json({ error: message });
});

let dbConnectPromise = null;

async function ensureDbConnected() {
  if (mongoose.connection.readyState === 1) return;
  if (!dbConnectPromise) {
    console.log('[TrustVault] Connecting to MongoDB...');
    dbConnectPromise = mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 5000
    }).then(async () => {
      console.log('[TrustVault] MongoDB connection established successfully!');
      try {
        const User = require('./models/User');
        const { hashPassword } = require('./lib/crypto');
        const adminEmail = 'poojamatheshwaran6363@gmail.com';
        const existingAdmin = await User.findOne({ email: adminEmail });
        if (!existingAdmin) {
          await User.create({
            name: 'Pooja Matheshwaran',
            email: adminEmail,
            password: await hashPassword(process.env.ADMIN_INIT_PASSWORD || 'TrustVault@2026'),
            role: 'admin',
            roll: 'ADM-01',
            dept: 'Central Examination & Verification Cell',
            hasVaultPin: false
          });
          console.log(`[TrustVault] Primary admin ensured: ${adminEmail}`);
        }
      } catch (seedErr) {
        console.warn('[TrustVault] Admin bootstrap check skipped:', seedErr.message);
      }
    }).catch((err) => {
      dbConnectPromise = null;
      console.warn(`[TrustVault] MongoDB connection failed: ${err.message}`);
      console.warn('[TrustVault] Please ensure MongoDB service is running or configure MONGO_URI in server/.env');
    });
  }
  return dbConnectPromise;
}

if (process.env.VERCEL) {
  app.use('/api', async (req, res, next) => {
    await ensureDbConnected();
    next();
  });
}

let currentServer = null;

async function startServer(port = Number(config.port) || 5000) {
  if (currentServer) {
    try { currentServer.close(); } catch {}
  }

  const server = app.listen(port, () => {
    console.log(`[TrustVault] Backend API server running on http://localhost:${port}`);
  });
  currentServer = server;

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      const nextPort = Number(port) + 1;
      console.warn(`[TrustVault] Port ${port} is occupied. Trying port ${nextPort}...`);
      try { server.close(); } catch {}
      setTimeout(() => startServer(nextPort), 600);
    } else {
      console.error('[TrustVault] Server error:', err.message);
    }
  });

  process.once('SIGTERM', () => { try { server.close(); } catch {} });
  process.once('SIGINT', () => { try { server.close(); } catch {} });

  await ensureDbConnected();

  return server;
}

if (!process.env.VERCEL) {
  startServer();
}

module.exports = app;
