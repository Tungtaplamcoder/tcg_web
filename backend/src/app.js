const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
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
const tcgplayerRoutes = require('./routes/tcgplayer.routes'); // MỚI

const app = express();

// Trust proxy để express-rate-limit nhận đúng IP qua X-Forwarded-For khi chạy sau ngrok
app.set('trust proxy', 1);

// Security headers
app.use(helmet());

// CORS
app.use(
  cors({
    origin: frontendUrl,
    credentials: true,
    optionsSuccessStatus: 200
  })
);

// Logging
if (nodeEnv !== 'test') {
  app.use(morgan('combined'));
}

// Body parsing
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

// Mount routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1', productRoutes); // products, categories, sets, cards
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/webhooks', webhookRoutes);
app.use('/api/v1/chat', chatRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1', postRoutes); // public news routes
app.use('/api/v1/admin/posts', adminPostRoutes); // admin post management
app.use('/api/v1/tcgplayer', tcgplayerRoutes); // MỚI

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