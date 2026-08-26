import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Use environment variables for backend URLs
const API_TARGET = process.env.VITE_API_PROXY_TARGET || 'http://localhost:4000';
const SOCKET_TARGET = process.env.VITE_SOCKET_PROXY_TARGET || 'http://localhost:4000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: parseInt(process.env.VITE_PORT) || 3000,
    proxy: {
      '/api': {
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
    allowedHosts: [
      '2b88-27-76-19-52.ngrok-free.app',
      '.ngrok-free.app'
    ]
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  }
});