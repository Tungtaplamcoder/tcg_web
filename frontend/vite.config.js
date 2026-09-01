import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Use environment variables for backend URLs
const API_TARGET = process.env.VITE_API_PROXY_TARGET || 'http://localhost:4000';
const SOCKET_TARGET = process.env.VITE_SOCKET_PROXY_TARGET || 'http://localhost:4000';
// Hosts được phép truy cập dev server (VD: tunnel dev) — cấu hình qua env,
// phân tách bằng dấu phẩy. Không hardcode domain nào.
const ALLOWED_HOSTS = (process.env.VITE_ALLOWED_HOSTS || '')
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean);

export default defineConfig({
  plugins: [react()],
  // Expose both Next-style NEXT_PUBLIC_* and native VITE_* variables to the
  // client bundle (see src/config/env.js). No domains are hardcoded — every
  // base URL is resolved from environment variables at build time.
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  server: {
    port: parseInt(process.env.VITE_PORT) || 3000,
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
        secure: false
      },
      '/uploads': {
        target: API_TARGET,
        changeOrigin: true,
        secure: false
      },
      '/socket.io': {
        target: SOCKET_TARGET,
        ws: true,
        changeOrigin: true
      }
    },
    ...(ALLOWED_HOSTS.length > 0 ? { allowedHosts: ALLOWED_HOSTS } : {})
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  }
});