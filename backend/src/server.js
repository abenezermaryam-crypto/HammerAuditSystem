const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { filterXSS } = require('xss');
const path = require('path');
const fs = require('fs');
const { getJwtSecret, getAllowedOrigins } = require('./config/security');
const { pool, migrateUserSchema } = require('./config/database');
const { startBusinessDayScheduler } = require('./services/businessDayScheduler');

getJwtSecret();

const app = express();
const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === 'production';
const allowedOrigins = getAllowedOrigins();
const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);
if (!Number.isInteger(trustProxyHops) || trustProxyHops < 0) {
  throw new Error('TRUST_PROXY_HOPS must be a non-negative integer.');
}
app.set('trust proxy', trustProxyHops);

// ─── Security Headers (helmet) ────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false,
}));

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(cors({
  origin(origin, callback) {
    if (!isProduction) {
      return callback(null, true);
    }
    callback(null, !origin || allowedOrigins.includes(origin));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// ─── Global API Rate Limiter (Critical) ──────────────────────────────────────
// Protects all API endpoints: max 120 requests per 1 minute per IP
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,       // 1 minute
  max: 120,                  // allow 120 requests per window per IP
  standardHeaders: true,     // Return rate limit info in RateLimit-* headers
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests from this device. Please wait a moment and try again.'
  }
});
app.use('/api/', globalLimiter);

// Tighter limiter for sensitive auth endpoints (login, register, password reset)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 20,                   // max 20 auth attempts per 15 min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many authentication attempts. Please wait 15 minutes and try again.'
  }
});
app.use('/api/v1/auth/', authLimiter);

// ─── Request Body Size Limit (Critical) ──────────────────────────────────────
// Prevents large payload attacks (default is unlimited in Express)
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// ─── XSS Sanitization Middleware (Important) ─────────────────────────────────
// Strips dangerous HTML/script tags from all incoming string fields
function sanitizeObject(obj) {
  if (typeof obj === 'string') return filterXSS(obj);
  if (Array.isArray(obj)) return obj.map(sanitizeObject);
  if (obj !== null && typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized;
  }
  return obj;
}

app.use((req, _res, next) => {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  next();
});

// ─── Request Logging (Morgan) ─────────────────────────────────────────────────
// Use compact format in production, verbose in development
app.use(morgan(isProduction ? 'combined' : 'dev'));

// ─── Route Imports ────────────────────────────────────────────────────────────
const authRoutes = require('./routes/authRoutes');
const businessDayRoutes = require('./routes/businessDayRoutes');
const incomeRoutes = require('./routes/incomeRoutes');
const expenseRoutes = require('./routes/expenseRoutes');
const closingRoutes = require('./routes/closingRoutes');
const auditRoutes = require('./routes/auditRoutes');
const discrepancyRoutes = require('./routes/discrepancyRoutes');
const adjustmentRoutes = require('./routes/adjustmentRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const reportRoutes = require('./routes/reportRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const userRoutes = require('./routes/userRoutes');

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      status: 'UP',
      system: 'Hamer Shop Financial Control & Three-Day Audit API',
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(503).json({ status: 'DOWN', error: err.message });
  }
});

// ─── Mount API Routes ─────────────────────────────────────────────────────────
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/business-days', businessDayRoutes);
app.use('/api/v1/incomes', incomeRoutes);
app.use('/api/v1/expenses', expenseRoutes);
app.use('/api/v1/closings', closingRoutes);
app.use('/api/v1/audits', auditRoutes);
app.use('/api/v1/discrepancies', discrepancyRoutes);
app.use('/api/v1/adjustments', adjustmentRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/analytics', analyticsRoutes);

// ─── Serve Built Mobile Web Client (if exported) ──────────────────────────────
const mobileDistDir = path.join(__dirname, '../../mobile/dist');
if (fs.existsSync(mobileDistDir)) {
  app.use(express.static(mobileDistDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(mobileDistDir, 'index.html'));
  });
}

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, error: `Endpoint ${req.originalUrl} not found.` });
});

// ─── Centralized Error Handler ────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled Exception:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal Server Error',
    // Never expose stack traces in production
    stack: isProduction ? undefined : err.stack
  });
});

// ─── Server Startup ───────────────────────────────────────────────────────────
let serverInstance = null;

async function startServer() {
  const missingSmtpSettings = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD']
    .filter((name) => !process.env[name]);
  if (missingSmtpSettings.length > 0) {
    console.warn(
      `⚠️  Password recovery email is disabled. Configure ${missingSmtpSettings.join(', ')} in backend/.env.`
    );
  }
  if (!process.env.PASSWORD_RESET_URL) {
    console.warn(
      '⚠️  PASSWORD_RESET_URL is unset; reset links will target http://localhost:8081 and only work for a local Expo web app.'
    );
  }

  let schemaReady = false;
  try {
    await migrateUserSchema(pool);
    schemaReady = true;
    console.log('✅ User account schema is current.');
  } catch (err) {
    if (err.code === 'ECONNREFUSED' || err.code === 'ER_BAD_DB_ERROR') {
      console.warn('⚠️  User schema migration deferred. Start MySQL and run "npm run db:init" before registration.');
    } else {
      console.error('❌ User schema migration failed. Run "npm run db:init" from backend before starting the API:', err.message);
      process.exitCode = 1;
      return;
    }
  }

  if (schemaReady) startBusinessDayScheduler();

  serverInstance = app.listen(PORT, () => {
    console.log(`
============================================================
🚀 HAMER SHOP FINANCIAL CONTROL & AUDIT SERVER RUNNING
🌐 Base URL: http://localhost:${PORT}/api/v1
🔒 Environment: ${process.env.NODE_ENV || 'development'}
📅 Started at: ${new Date().toISOString()}
============================================================
  `);
  });

  serverInstance.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ Cannot start: port ${PORT} is already in use.`);
      console.error('Stop the other process using this port, or change PORT in .env');
    } else {
      console.error('❌ Cannot start the API:', err);
    }
    process.exitCode = 1;
  });
}

// ─── Graceful Shutdown (Important) ───────────────────────────────────────────
// Ensures in-flight requests finish and DB connections close cleanly on restart
function gracefulShutdown(signal) {
  console.log(`\n⚠️  Received ${signal}. Shutting down gracefully...`);
  if (serverInstance) {
    serverInstance.close(async () => {
      console.log('✅ HTTP server closed. No new connections accepted.');
      try {
        await pool.end();
        console.log('✅ MySQL connection pool closed.');
      } catch (err) {
        console.error('⚠️  Error closing MySQL pool:', err.message);
      }
      console.log('👋 Hamer Shop server shutdown complete.');
      process.exit(0);
    });
    // Force kill after 10 seconds if still hanging
    setTimeout(() => {
      console.error('❌ Forced shutdown after timeout.');
      process.exit(1);
    }, 10000).unref();
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));

// Catch unhandled promise rejections (prevent silent crashes)
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  gracefulShutdown('uncaughtException');
});

startServer();

module.exports = app;
