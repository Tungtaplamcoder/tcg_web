import { io } from 'socket.io-client';
import { useAuthStore } from '../store/useAuthStore';

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

  // Use environment variable for socket URL, fallback to default for development
  const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000';

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