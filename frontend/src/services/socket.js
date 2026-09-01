import { io } from 'socket.io-client';
import { useAuthStore } from '../store/useAuthStore';
import { SOCKET_URL } from '../config/env';

let socket = null;

export const initializeSocket = () => {
  const { accessToken, logout } = useAuthStore.getState();

  if (!accessToken) {
    console.warn('No access token, cannot initialize socket');
    return null;
  }

  if (socket && socket.connected) {
    return socket;
  }

  // Socket origin from NEXT_PUBLIC_SOCKET_URL / VITE_SOCKET_URL; empty means
  // "same origin as the page" — the correct default behind the Nginx
  // reverse proxy, under whatever production domain serves the app.
  const socketUrl = SOCKET_URL || window.location.origin;

  socket = io(socketUrl, {
    auth: {
      token: `Bearer ${accessToken}`
    },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
  });

  socket.on('connect', () => {
    console.log('Socket connected');
  });

  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error.message);
    if (error.message.includes('Authentication')) {
      logout();
      window.location.href = '/login';
    }
  });

  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', reason);
  });

  return socket;
};

export const getSocket = () => {
  if (!socket) {
    return initializeSocket();
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const onSocketEvent = (event, handler) => {
  const s = getSocket();
  if (s) {
    s.on(event, handler);
    return () => s.off(event, handler);
  }
  return () => {};
};

export const emitSocketEvent = (event, data) => {
  const s = getSocket();
  if (s) {
    s.emit(event, data);
  }
};