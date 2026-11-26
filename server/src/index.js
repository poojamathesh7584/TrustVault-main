const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
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

// Middlewares
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(cookieParser());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

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

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('API Error:', err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});

let currentServer = null;

// Start HTTP server immediately and connect to MongoDB in background
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
      console.warn(`[TrustVault] Notice: Port ${port} is occupied. Attempting port ${nextPort}...`);
      try { server.close(); } catch {}
      setTimeout(() => startServer(nextPort), 600);
    } else {
      console.error('[TrustVault] Server error:', err.message);
    }
  });

  process.once('SIGTERM', () => {
    try { server.close(); } catch {}
  });
  process.once('SIGINT', () => {
    try { server.close(); } catch {}
  });

  try {
    console.log(`[TrustVault] Connecting to MongoDB at: ${config.mongoUri}...`);
    await mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 5000
    });
    console.log('[TrustVault] MongoDB connection established successfully!');
  } catch (err) {
    console.warn(`[TrustVault] Notice: MongoDB connection could not be established (${err.message}).`);
    console.warn('[TrustVault] Please ensure MongoDB service is running or configure MONGO_URI in server/.env');
  }

  return server;
}

startServer();

module.exports = app;
