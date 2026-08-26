const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const env = require('../config/env');

const setupSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: env.frontendUrl,
      credentials: true
    }
  });

  // Make io globally available for services to emit events
  global.io = io;

  // Socket authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        return next(new Error('Authentication required'));
      }

      const accessToken = token.startsWith('Bearer ') ? token.split(' ')[1] : token;
      let decoded;
      try {
        decoded = jwt.verify(accessToken, env.jwtAccessSecret);
      } catch (error) {
        return next(new Error('Invalid or expired token'));
      }

      const user = await prisma.user.findUnique({
        where: { id: decoded.sub },
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          status: true,
          avatarUrl: true
        }
      });

      if (!user || user.status !== 'ACTIVE') {
        return next(new Error('User not found or inactive'));
      }

      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  // Rate limiting per socket (simple in-memory)
  const messageRateMap = new Map();

  const checkRateLimit = (userId) => {
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute
    const maxMessages = 30;

    if (!messageRateMap.has(userId)) {
      messageRateMap.set(userId, []);
    }
    const timestamps = messageRateMap.get(userId).filter(ts => now - ts < windowMs);
    timestamps.push(now);
    messageRateMap.set(userId, timestamps);
    return timestamps.length <= maxMessages;
  };

  io.on('connection', (socket) => {
    const userId = socket.user.id;
    console.log(`Socket connected: ${userId}`);

    // Join personal room
    socket.join(`user:${userId}`);

    // If admin/moderator, join admin rooms
    if (socket.user.role === 'ADMIN' || socket.user.role === 'MODERATOR') {
      socket.join('admin:chat');
    }

    // Chat events
    socket.on('chat:join', async (data) => {
      try {
        const { roomId } = data;
        if (!roomId) return socket.emit('chat:error', { code: 'INVALID_ROOM', message: 'roomId is required' });

        // Verify user is participant or admin
        const room = await prisma.chatRoom.findUnique({
          where: { id: roomId },
          include: { participants: true }
        });
        if (!room) return socket.emit('chat:error', { code: 'ROOM_NOT_FOUND', message: 'Room not found' });

        const isAdmin = socket.user.role === 'ADMIN' || socket.user.role === 'MODERATOR';
        const isParticipant = room.participants.some(p => p.userId === userId);
        if (!isAdmin && !isParticipant) {
          return socket.emit('chat:error', { code: 'UNAUTHORIZED', message: 'Not participant of this room' });
        }

        socket.join(`chat:${roomId}`);
        socket.emit('chat:joined', { roomId });
      } catch (error) {
        socket.emit('chat:error', { code: 'SERVER_ERROR', message: 'Failed to join room' });
      }
    });

    socket.on('chat:leave', (data) => {
      const { roomId } = data;
      if (roomId) socket.leave(`chat:${roomId}`);
      socket.emit('chat:left', { roomId });
    });

    socket.on('chat:message', async (data) => {
      try {
        const { roomId, content, attachments = [] } = data;
        if (!roomId || !content) return socket.emit('chat:error', { code: 'INVALID_INPUT', message: 'roomId and content required' });
        if (content.length > 2000) return socket.emit('chat:error', { code: 'CONTENT_TOO_LONG', message: 'Message too long' });
        if (!checkRateLimit(userId)) return socket.emit('chat:error', { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many messages' });

        // Verify access
        const room = await prisma.chatRoom.findUnique({
          where: { id: roomId },
          include: { participants: true }
        });
        if (!room) return socket.emit('chat:error', { code: 'ROOM_NOT_FOUND', message: 'Room not found' });

        const isAdmin = socket.user.role === 'ADMIN' || socket.user.role === 'MODERATOR';
        const isParticipant = room.participants.some(p => p.userId === userId);
        if (!isAdmin && !isParticipant) return socket.emit('chat:error', { code: 'UNAUTHORIZED', message: 'Not participant' });

        const message = await prisma.chatMessage.create({
          data: {
            roomId,
            senderId: userId,
            content,
            type: 'TEXT',
            attachments: attachments || []
          },
          include: {
            sender: {
              select: { id: true, fullName: true, avatarUrl: true, role: true }
            }
          }
        });

        const messagePayload = {
          id: message.id,
          roomId: message.roomId,
          sender: message.sender,
          content: message.content,
          attachments: message.attachments,
          createdAt: message.createdAt
        };

        io.to(`chat:${roomId}`).emit('chat:message', messagePayload);
      } catch (error) {
        socket.emit('chat:error', { code: 'SERVER_ERROR', message: 'Failed to send message' });
      }
    });

    socket.on('chat:typing', (data) => {
      const { roomId, isTyping } = data;
      if (roomId) {
        socket.to(`chat:${roomId}`).emit('chat:typing', { roomId, userId, isTyping });
      }
    });

    socket.on('chat:read', async (data) => {
      try {
        const { roomId, messageIds } = data;
        if (!roomId || !messageIds || !Array.isArray(messageIds)) return;

        await prisma.chatMessage.updateMany({
          where: {
            id: { in: messageIds },
            roomId,
            isRead: false
          },
          data: {
            isRead: true,
            readAt: new Date()
          }
        });

        io.to(`chat:${roomId}`).emit('chat:read', { roomId, userId, messageIds });
      } catch (error) {
        // Ignore read errors
      }
    });

    socket.on('order:subscribe', (data) => {
      const { orderId } = data;
      if (orderId) {
        socket.join(`order:${orderId}`);
      }
    });

    socket.on('presence:update', (data) => {
      const status = ['online', 'away', 'offline'].includes(data?.status) ? data.status : 'online';
      io.emit('presence:update', { userId, status });
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${userId}`);
      io.emit('presence:update', { userId, status: 'offline' });
    });
  });

  return io;
};

module.exports = setupSocket;