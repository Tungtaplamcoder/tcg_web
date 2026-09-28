/**
 * app.js — cPanel / Phusion Passenger entry point (Application startup file).
 *
 * Topology: Passenger mounts this app at the domain root. This entry:
 *   1) Serves the built SPA + uploaded images statically from ./public
 *   2) Falls back to index.html for client-side routes (BrowserRouter)
 *   3) Delegates /api/v1, /uploads, /health to the Express API
 *   4) Boots the order cron exactly like src/server.js
 *
 * Passenger intercepts http.Server.listen(), so the port below is only a
 * local-dev fallback. All configuration comes from ./.env (never hardcoded).
 */
const express = require('express');
const path = require('path');
const fs = require('fs');

// Loads ./.env and validates required variables before anything else.
const env = require('./src/config/env');
const prisma = require('./src/config/prisma');
const app = require('./src/app'); // existing Express API (exports the app, no listen)
const { startOrderCron } = require('./src/cron/orderCron');

const PUBLIC_DIR = path.join(__dirname, 'public');
const INDEX_HTML = path.join(PUBLIC_DIR, 'index.html');

const root = express();
root.set('trust proxy', 1); // behind Apache + Passenger

// 1) Static assets: SPA build (index.html, assets/) and public/uploads
root.use(express.static(PUBLIC_DIR));

// 2) SPA fallback — any non-API GET without a matching file serves index.html
root.get('*', (req, res, next) => {
  if (req.method !== 'GET') return next();
  if (/^\/(api|uploads|health)(\/|$)/.test(req.path)) return next();
  if (fs.existsSync(INDEX_HTML)) return res.sendFile(INDEX_HTML);
  next();
});

// 3) REST API + webhooks + health
root.use(app);

const startServer = async () => {
  await prisma.$connect();
  console.log('✅ Database connected successfully');

  const server = root.listen(process.env.PORT || env.port, () => {
    console.log(`🚀 TCG app running on port ${process.env.PORT || env.port} [${env.nodeEnv}]`);
  });

  startOrderCron();
};

startServer().catch(async (err) => {
  console.error('❌ Startup failed:', err);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
