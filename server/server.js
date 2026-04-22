const express      = require('express');
const cors         = require('cors');
const morgan       = require('morgan');
const rateLimit    = require('express-rate-limit');
const path         = require('path');
const { createServer } = require('http');
const { Server }   = require('socket.io');
require('dotenv').config();

const { connectDB }    = require('./config/db');
const errorHandler     = require('./middleware/errorHandler');

const authRoutes       = require('./routes/authRoutes');
const auctionRoutes    = require('./routes/auctionRoutes');
const bidRoutes        = require('./routes/bidRoutes');
const userRoutes       = require('./routes/userRoutes');
const paymentRoutes    = require('./routes/paymentRoutes');
const { startAuctionCron } = require('./controllers/auctionCron');

// ─────────────────────────────────────────────
// App & HTTP server
// ─────────────────────────────────────────────
const app        = express();
const httpServer = createServer(app);

// ─────────────────────────────────────────────
// Socket.io
// ─────────────────────────────────────────────
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL,
    methods: ['GET', 'POST'],
  },
});

// Attach io to every request so controllers can emit events
app.use((req, res, next) => {
  req.io = io;
  next();
});

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Join an auction room
  socket.on('auction:join', (auctionId) => {
    socket.join(`auction:${auctionId}`);
    console.log(`Socket ${socket.id} joined auction:${auctionId}`);
  });

  // Leave an auction room
  socket.on('auction:leave', (auctionId) => {
    socket.leave(`auction:${auctionId}`);
    console.log(`Socket ${socket.id} left auction:${auctionId}`);
  });

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

// Make io accessible globally (used in Phase 6 cron jobs)
global.io = io;

// ─────────────────────────────────────────────
// Core Middleware
// ─────────────────────────────────────────────
app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Serve uploaded product images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─────────────────────────────────────────────
// Rate Limiting
// ─────────────────────────────────────────────

// General API limiter — 100 requests per 15 minutes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please try again after 15 minutes.',
  },
});

// Stricter limiter for auth routes — 10 attempts per 15 minutes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts. Please try again after 15 minutes.',
  },
});

// Bid limiter — 30 bids per minute (prevent bid spamming)
const bidLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: {
    success: false,
    message: 'Too many bids placed. Please slow down.',
  },
});

// ─────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────
app.use('/api/auth',     authLimiter,  authRoutes);
app.use('/api/auctions', apiLimiter,   auctionRoutes);
app.use('/api/bids',     bidLimiter,   bidRoutes);
app.use('/api/users',    apiLimiter,   userRoutes);
app.use('/api/payments', apiLimiter,   paymentRoutes);

// ─────────────────────────────────────────────
// Health Check
// ─────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Smart Hammer API is running',
    version: '1.0.0',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/health', async (req, res) => {
  try {
    const { query } = require('./config/db');
    await query('SELECT 1');
    res.json({
      success: true,
      status: 'healthy',
      database: 'connected',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      database: 'disconnected',
    });
  }
});

// ─────────────────────────────────────────────
// 404 Handler
// ─────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
});

// ─────────────────────────────────────────────
// Global Error Handler
// ─────────────────────────────────────────────
app.use(errorHandler);

// ─────────────────────────────────────────────
// Start Server
// ─────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB(); // wait for DB before accepting requests
  startAuctionCron();
  httpServer.listen(PORT, () => {
    console.log('─────────────────────────────────────');
    console.log(`  Smart Hammer API`);
    console.log(`  Running on   : http://localhost:${PORT}`);
    console.log(`  Environment  : ${process.env.NODE_ENV}`);
    console.log(`  Client URL   : ${process.env.CLIENT_URL}`);
    console.log('─────────────────────────────────────');
  });
};

startServer();