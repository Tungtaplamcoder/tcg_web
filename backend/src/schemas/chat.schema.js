const { z } = require('zod');

const createRoomSchema = z.object({
  subject: z.string().min(2).max(200),
  orderId: z.string().uuid().optional()
});

const roomIdParamSchema = z.object({
  id: z.string().uuid('Invalid room id')
});

const sendMessageSchema = z.object({
  content: z.string().min(1).max(2000),
  attachments: z.array(z.string().url()).max(10).optional()
});

const listMessagesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50)
});

module.exports = {
  createRoomSchema,
  roomIdParamSchema,
  sendMessageSchema,
  listMessagesQuerySchema
};