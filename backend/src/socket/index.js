const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const env = require('../config/env');
const { corsOrigins, nodeEnv } = env;

const setupSocket = (httpServer) => {
  // CORS allowlist giống HTTP layer: NEXT_PUBLIC_APP_URL + CORS_ALLOWED_ORIGINS.
  // Dev: reflect mọi origin (LAN testing); production: chỉ allowlist.
  const devOrigins = ['http://localhost:3000', 'http://localhost:5173', 'http://localhost', 'http://127.0.0.1'];
  const socketOrigins = [...new Set([...corsOrigins, ...devOrigins].filter(Boolean))];

  const io = new Server(httpServer, {
    cors: {
      origin: (requestOrigin, callback) => {
        if (!requestOrigin) return callback(null, true);
        if (socketOrigins.includes(requestOrigin)) return callback(null, true);
        if (nodeEnv !== 'production') return callback(null, requestOrigin);
        console.warn(`[Socket CORS] Rejected origin: ${requestOrigin}`);
        return callback(null, false);
      },
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

    // If admin/staff/moderator, join admin rooms for CSKH notifications
    if (['ADMIN', 'STAFF', 'MODERATOR'].includes(socket.user.role)) {
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

        const isStaff = ['ADMIN', 'STAFF', 'MODERATOR'].includes(socket.user.role);
        const isParticipant = room.participants.some(p => p.userId === userId);
        if (!isStaff && !isParticipant) {
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
        const { content, attachments = [] } = data;
        let { roomId } = data;
        if (!content) return socket.emit('chat:error', { code: 'INVALID_INPUT', message: 'roomId and content required' });
        if (content.length > 2000) return socket.emit('chat:error', { code: 'CONTENT_TOO_LONG', message: 'Message too long' });
        if (checkRateLimit(userId) === false) return socket.emit('chat:error', { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many messages' });

        // Lazy room creation: first message from the storefront widget
        // persists the general support room at send time (never on open).
        if (!roomId) {
          const existing = await prisma.chatRoom.findFirst({
            where: { userId, orderId: null, subject: 'General Support', status: 'OPEN' },
            orderBy: { updatedAt: 'desc' }
          });
          if (existing) {
            roomId = existing.id;
          } else {
            const created = await prisma.chatRoom.create({
              data: {
                userId,
                orderId: null,
                subject: 'General Support',
                status: 'OPEN',
                participants: { create: { userId } }
              }
            });
            roomId = created.id;
            io.to('admin:chat').emit('chat:new_room', {
              room: {
                id: created.id,
                subject: created.subject,
                userId: created.userId,
                createdAt: created.createdAt
              }
            });
          }
          socket.join(`chat:${roomId}`);
        }

        // Verify access
        const room = await prisma.chatRoom.findUnique({
          where: { id: roomId },
          include: { participants: true }
        });
        if (!room) return socket.emit('chat:error', { code: 'ROOM_NOT_FOUND', message: 'Room not found' });

        const isStaff = ['ADMIN', 'STAFF', 'MODERATOR'].includes(socket.user.role);
        const isParticipant = room.participants.some(p => p.userId === userId);
        if (!isStaff && !isParticipant) return socket.emit('chat:error', { code: 'UNAUTHORIZED', message: 'Not participant' });

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