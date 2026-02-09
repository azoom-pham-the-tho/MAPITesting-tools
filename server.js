/**
 * Server Entry Point
 *
 * Main Express server for MAPI Testing Tool
 * Handles HTTP requests, serves static files, and manages API routes
 *
 * Security Features:
 * - Body size limits (50MB)
 * - Compression middleware
 * - Local/External access detection
 * - Path security validation
 */

const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const { exec } = require('child_process');
const os = require('os');
const compression = require('compression');

// Internal services
const storageService = require('./src/services/storage.service');

// Application instance
const app = express();
const PORT = 8888;

// Environment detection
const isElectron = process.versions && process.versions.electron;

/**
 * Middleware Configuration
 */

// JSON body parser with size limit (prevents DoS attacks)
app.use(express.json({ limit: '50mb' }));

// URL-encoded body parser
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Compression middleware (optimizes bandwidth)
app.use(compression({
  // Allow disabling compression via header
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
  // Compression level (0-9, 6 is balanced)
  level: 6
}));

/**
 * Static File Serving
 */

// Public directory (frontend assets)
app.use(express.static(path.join(__dirname, 'public')));

// Initialize storage directory
const storageDir = storageService.getStoragePath();
fs.ensureDirSync(storageDir);

// Serve storage files (captured data, screenshots, etc.)
app.use('/storage', express.static(storageDir));

/**
 * API Configuration
 */

// API endpoint to get storage path
app.get('/api/storage-path', (req, res) => {
  res.json({ path: storageDir });
});

/**
 * Route Imports & Registration
 */

// Import route modules
const projectRoutes = require('./src/routes/project.routes');
const unifiedCaptureRoutes = require('./src/routes/unified-capture.routes');
const unifiedReplayRoutes = require('./src/routes/unified-replay.routes');
const compareRoutes = require('./src/routes/compare.routes');
const mergeRoutes = require('./src/routes/merge.routes');
const authRoutes = require('./src/routes/auth.routes');
const shareRoutes = require('./src/routes/share.routes');
const gdriveRoutes = require('./src/routes/gdrive.routes');
const documentRoutes = require('./src/routes/document.routes');
const testRunnerRoutes = require('./src/routes/test-runner.routes');
const reportRoutes = require('./src/routes/report.routes');
const commentRoutes = require('./src/routes/comment.routes');
const versionRoutes = require('./src/routes/version.routes');

// Register API routes
app.use('/api/projects', projectRoutes);
app.use('/api/capture', unifiedCaptureRoutes);
app.use('/api/replay', unifiedReplayRoutes);
app.use('/api/compare', compareRoutes);
app.use('/api/merge', mergeRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/share', shareRoutes);
app.use('/api/gdrive', gdriveRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/test-runner', testRunnerRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/versions', versionRoutes);

/**
 * HTML Page Routes
 */

// Share download page (token-based access)
app.get('/share/:token', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'share.html'));
});

// Share listing page (for external users)
app.get('/shared', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'share-list.html'));
});

// Explicit app route (always serves full application)
app.get('/app', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/**
 * Root Route Handler
 *
 * Smart routing based on client IP:
 * - Local users (127.0.0.1): Full application
 * - External users: Share listing page only
 */
app.get('/', (req, res) => {
  const ip = req.ip || req.connection.remoteAddress || '';
  const isLocal = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip === 'localhost';

  if (isLocal) {
    // Local user → full application
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    // External user → share listing only
    res.sendFile(path.join(__dirname, 'public', 'share-list.html'));
  }
});

/**
 * Error Handling Middleware
 *
 * Catches all errors and returns JSON response
 * Logs error details for debugging
 */
app.use((err, req, res, next) => {
  console.error('Error Details:', err.stack || err.message);
  res.status(500).json({
    error: err.message,
    // Hide stack trace in production
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

/**
 * Server Startup
 */
function startServer() {
  app.listen(PORT, '0.0.0.0', () => {
    const url = `http://localhost:${PORT}`;
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║     UI & API Reconstruction Testing Tool                      ║
║     Server running at ${url}                   ║
║     Storage: ${storageDir}
╚═══════════════════════════════════════════════════════════════╝
        `);

    // Auto-open browser (only in standalone mode, not Electron)
    if (!isElectron) {
      const start = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
      exec(`${start} ${url}`);
    }
  });
}

// Start server if run directly or required by Electron
if (require.main === module) {
  startServer();
} else {
  // Running as module (from Electron)
  startServer();
}

module.exports = app;
