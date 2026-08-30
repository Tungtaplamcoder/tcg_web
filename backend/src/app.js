const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const path = require('path');
const { frontendUrl, nodeEnv } = require('./config/env');
const errorHandler = require('./middlewares/errorHandler');

// Route imports
const authRoutes = require('./routes/auth.routes');
const productRoutes = require('./routes/product.routes');
const orderRoutes = require('./routes/order.routes');
const webhookRoutes = require('./routes/webhook.routes');
const chatRoutes = require('./routes/chat.routes');
const adminRoutes = require('./routes/admin.routes');
const { router: postRoutes, adminRouter: adminPostRoutes } = require('./routes/post.routes');
const tcgplayerRoutes = require('./routes/tcgplayer.routes');
const gachaRoutes = require('./routes/gacha.routes');

const app = express();

// Trust proxy để express-rate-limit nhận đúng IP qua X-Forwarded-For khi chạy sau ngrok/load balancer
app.set('trust proxy', 1);

// Security headers - Helmet
app.use(helmet({
  contentSecurityPolicy: nodeEnv === 'production' ? undefined : false, // Disable CSP in dev for Vite HMR
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  }
}));

// Compression middleware for HTTP responses
app.use(compression({
  level: 6, // Balance between compression ratio and CPU usage
  threshold: 1024, // Only compress responses > 1KB
  filter: (req, res) => {
    // Don't compress responses with this header
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  }
}));

// CORS
// Allow the configured frontend origin AND reflect any requesting origin so
// browsers on the LAN (or other origins) can call the API. `credentials: true`
// requires the echoed origin to match, so we reflect it dynamically.
const allowedCorsOrigins = [frontendUrl, 'http://localhost', 'http://127.0.0.1'].filter(Boolean);

app.use(
  cors({
    origin: (requestOrigin, callback) => {
      // No origin (same-origin, curl, mobile) or explicitly allowed -> allow
      if (!requestOrigin || allowedCorsOrigins.includes(requestOrigin)) {
        return callback(null, true);
      }
      // Otherwise reflect the requesting origin (enables LAN access)
      return callback(null, requestOrigin);
    },
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  })
);

// Logging
if (nodeEnv !== 'test') {
  app.use(morgan('combined'));
}

// Body parsing with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    data: { status: 'ok', timestamp: new Date().toISOString() },
    message: 'Server is running'
  });
});

// Serve locally-stored uploaded images (fallback storage)
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// Mount routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1', productRoutes); // products, categories, sets, cards
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/webhooks', webhookRoutes);
app.use('/api/v1/chat', chatRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1', postRoutes); // public news routes
app.use('/api/v1/admin/posts', adminPostRoutes); // admin post management
app.use('/api/v1/tcgplayer', tcgplayerRoutes);
app.use('/api/v1', gachaRoutes); // virtual boxes & gacha opening

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route not found: ${req.method} ${req.originalUrl}`
    },
    timestamp: new Date().toISOString()
  });
});

// Global error handler
app.use(errorHandler);

module.exports = app;