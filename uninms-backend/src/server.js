require('dotenv').config();

const path    = require('path');
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');

const { pool }        = require('./config/database');
const { connectRedis } = require('./config/redis');
const logger          = require('./utils/logger');
const { AppError }    = require('./utils/AppError');

// ── Routes ────────────────────────────────────────────────────────────────────
const authRouter          = require('./routes/auth');
const documentsRouter     = require('./routes/documents');
const searchRouter        = require('./routes/search');
const usersRouter         = require('./routes/users');
const analyticsRouter     = require('./routes/analytics');
const notificationsRouter = require('./routes/notifications');
const forumsRouter        = require('./routes/forums');
const intelligenceRouter  = require('./routes/intelligence');
const adminRouter         = require('./routes/admin');
const plagiarismRouter    = require('./routes/plagiarism');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin:      process.env.FRONTEND_URL || 'http://localhost:3001',
  credentials: true,
  methods:     ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ── Static files — uploaded manuscripts ──────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      status:    'ok',
      timestamp: new Date().toISOString(),
      database:  'connected',
      redis:     'connected',
      version:   '1.0.0',
    });
  } catch (err) {
    res.status(503).json({ status: 'error', database: 'disconnected' });
  }
});

// ── API Routes ────────────────────────────────────────────────────────────────
const API = '/api/v1';
app.use(`${API}/auth`,          authRouter);
app.use(`${API}/documents`,     documentsRouter);
app.use(`${API}/search`,        searchRouter);
app.use(`${API}/users`,         usersRouter);
app.use(`${API}/analytics`,     analyticsRouter);
app.use(`${API}/notifications`, notificationsRouter);
app.use(`${API}/forums`,        forumsRouter);
app.use(`${API}/intelligence`,  intelligenceRouter);
app.use(`${API}/admin`,         adminRouter);          // Admin2: university IT
app.use(`${API}/platform`,      require('./routes/platform')); // Admin1: UniNMS operator
app.use(`${API}/plagiarism`,    plagiarismRouter);
app.use(`${API}/billing`,          require('./routes/billing'));
app.use(`${API}/journal-billing`,  require('./routes/journal-billing'));
app.use(`${API}/journals`,         require('./routes/journals'));
app.use(`${API}/tetfund`,       require('./routes/tetfund'));
app.use(`${API}/community`,     require('./routes/community'));

// Placeholder routes — return empty data so frontend doesn't 404
const placeholder = (resource) => (req, res) => res.json({ success: true, data: [], message: `${resource} endpoint — coming in full build` });
app.use(`${API}/mentorship`,    require('./routes/mentorship'));
app.use(`${API}/handover`,      require('./routes/handover'));
app.use(`${API}/claims`,        require('./routes/claims'));
app.use(`${API}/groups`,        require('./routes/groups'));
app.use(`${API}/research`,      require('./routes/research'));
app.use(`${API}/national`,      placeholder('National'));
app.use(`${API}/courses`,       require('./routes/courses'));
app.use(`${API}`,               require('./routes/assignments'));

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` } });
});

// ── Global error handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  const status  = err.statusCode || 500;
  const code    = err.code       || 'INTERNAL_ERROR';
  const message = err.isOperational ? err.message : 'An unexpected error occurred';

  if (!err.isOperational) logger.error(err.message, { stack: err.stack, path: req.path });

  res.status(status).json({
    success: false,
    error:   { code, message, details: err.details || undefined },
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────
const start = async () => {
  try {
    // Test DB connection
    await pool.query('SELECT 1');
    logger.info('[database] Connected to PostgreSQL');

    // Connect Redis
    await connectRedis();
    logger.info('[redis] Connected');

    app.listen(PORT, () => {
      logger.info(`[server] UniNMS API running on http://localhost:${PORT}`);
      logger.info(`[server] Health: http://localhost:${PORT}/health`);
      logger.info(`[server] Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (err) {
    logger.error('Failed to start server:', err.message);
    logger.error('Make sure Docker is running: docker compose up postgres redis -d');
    process.exit(1);
  }
};

start();

module.exports = app;
