const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chat.controller');
const validate = require('../middlewares/validate');
const { authenticate } = require('../middlewares/auth');
const { apiLimiter } = require('../middlewares/rateLimiters');
const {
  createRoomSchema,
  roomIdParamSchema,
  sendMessageSchema,
  listMessagesQuerySchema
} = require('../schemas/chat.schema');

router.use(authenticate);

router.post('/rooms', apiLimiter, validate(createRoomSchema), chatController.createRoom);
router.get('/rooms', apiLimiter, chatController.listRooms);
router.get('/rooms/:id', apiLimiter, validate(roomIdParamSchema, 'params'), chatController.getRoom);
router.get('/rooms/:id/messages', apiLimiter, validate(roomIdParamSchema, 'params'), validate(listMessagesQuerySchema, 'query'), chatController.listMessages);
router.post('/rooms/:id/messages', apiLimiter, validate(roomIdParamSchema, 'params'), validate(sendMessageSchema), chatController.sendMessage);
router.post('/rooms/:id/close', apiLimiter, validate(roomIdParamSchema, 'params'), chatController.closeRoom);

module.exports = router;