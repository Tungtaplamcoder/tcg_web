const { z } = require('zod');

const createRoomSchema = z.object({
  subject: z.string().min(2).max(200).default('General Support'),
  orderId: z.string().uuid().optional()
});

const roomIdParamSchema = z.object({
  id: z.string().uuid('Invalid room id')
});

const sendMessageSchema = z.object({
  content: z.string().min(1).max(2000),
  roomId: z.string().uuid().optional(),
  attachments: z.array(z.string().url()).max(10).optional()
});

const updateRoomStatusSchema = z.object({
  status: z.enum(['OPEN', 'CLOSED'])
});

const listMessagesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50)
});

module.exports = {
  createRoomSchema,
  roomIdParamSchema,
  sendMessageSchema,
  updateRoomStatusSchema,
  listMessagesQuerySchema
};