const prisma = require('../config/prisma');
const { NotFoundError, AuthorizationError, AppError } = require('../utils/errors');

const createRoom = async (userId, data) => {
  // Check if user already has a room for this order
  if (data.orderId) {
    const existing = await prisma.chatRoom.findUnique({
      where: { orderId: data.orderId }
    });
    if (existing) {
      return existing;
    }
    // Verify order belongs to user
    const order = await prisma.order.findFirst({
      where: { id: data.orderId, userId }
    });
    if (!order) throw new AuthorizationError('Order not found or not owned by user');
  }

  const room = await prisma.chatRoom.create({
    data: {
      userId,
      orderId: data.orderId || null,
      subject: data.subject,
      status: 'OPEN',
      participants: {
        create: { userId }
      }
    },
    include: {
      participants: true
    }
  });

  // Emit new room event to admin chat room
  const io = global.io;
  if (io) {
    io.to('admin:chat').emit('chat:new_room', {
      room: {
        id: room.id,
        subject: room.subject,
        userId: room.userId,
        createdAt: room.createdAt
      }
    });
  }

  return room;
};

const listUserRooms = async (userId) => {
  return prisma.chatRoom.findMany({
    where: {
      participants: {
        some: { userId }
      }
    },
    include: {
      participants: {
        include: { user: { select: { id: true, fullName: true, avatarUrl: true } } }
      },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    },
    orderBy: { updatedAt: 'desc' }
  });
};

const isStaffUser = (user) => Boolean(user && ['ADMIN', 'STAFF', 'MODERATOR'].includes(user.role));

const getRoomById = async (roomId, userId) => {
  const room = await prisma.chatRoom.findUnique({
    where: { id: roomId },
    include: {
      participants: {
        include: { user: { select: { id: true, fullName: true, avatarUrl: true, role: true } } }
      },
      order: {
        select: { id: true, orderCode: true, status: true }
      }
    }
  });

  if (!room) throw new NotFoundError('Chat room not found');

  return room;
};

const listRoomMessages = async (roomId, userId, query) => {
  // Verify access
  const room = await prisma.chatRoom.findUnique({
    where: { id: roomId },
    include: { participants: true }
  });
  if (!room) throw new NotFoundError('Chat room not found');

  const requester = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  const isStaff = isStaffUser(requester);
  const isParticipant = room.participants.some(p => p.userId === userId);
  if (!isStaff && !isParticipant) throw new AuthorizationError('Not participant of this room');

  const skip = (query.page - 1) * query.limit;
  const take = query.limit;

  const [items, totalItems] = await Promise.all([
    prisma.chatMessage.findMany({
      where: { roomId },
      skip,
      take,
      orderBy: { createdAt: 'asc' },
      include: {
        sender: {
          select: { id: true, fullName: true, avatarUrl: true, role: true }
        }
      }
    }),
    prisma.chatMessage.count({ where: { roomId } })
  ]);

  return {
    items,
    meta: {
      page: query.page,
      limit: query.limit,
      totalItems,
      totalPages: Math.ceil(totalItems / query.limit)
    }
  };
};

const sendMessage = async (roomId, userId, data) => {
  const room = await prisma.chatRoom.findUnique({
    where: { id: roomId },
    include: { participants: true }
  });
  if (!room) throw new NotFoundError('Chat room not found');

  const isParticipant = room.participants.some(p => p.userId === userId);
  if (!isParticipant) {
    // Staff (admin/staff/moderator) may reply inside any support room
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!isStaffUser(user)) {
      throw new AuthorizationError('Not participant of this room');
    }
  }

  const message = await prisma.chatMessage.create({
    data: {
      roomId,
      senderId: userId,
      content: data.content,
      type: 'TEXT',
      attachments: data.attachments || []
    },
    include: {
      sender: {
        select: { id: true, fullName: true, avatarUrl: true, role: true }
      }
    }
  });

  // Emit via socket
  const io = global.io;
  if (io) {
    io.to(`chat:${roomId}`).emit('chat:message', {
      id: message.id,
      roomId: message.roomId,
      sender: message.sender,
      content: message.content,
      attachments: message.attachments,
      createdAt: message.createdAt
    });
  }

  // Update room updatedAt
  await prisma.chatRoom.update({
    where: { id: roomId },
    data: { updatedAt: new Date() }
  });

  return message;
};

const closeRoom = async (roomId, userId) => {
  const room = await prisma.chatRoom.findUnique({ where: { id: roomId } });
  if (!room) throw new NotFoundError('Chat room not found');

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!isStaffUser(user)) {
    throw new AuthorizationError('Only admin or staff can close room');
  }

  const updated = await prisma.chatRoom.update({
    where: { id: roomId },
    data: { status: 'CLOSED' }
  });
  return updated;
};

module.exports = {
  createRoom,
  listUserRooms,
  getRoomById,
  listRoomMessages,
  sendMessage,
  closeRoom
};