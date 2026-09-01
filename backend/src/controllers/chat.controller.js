const chatService = require('../services/chat.service');

const createRoom = async (req, res, next) => {
  try {
    const room = await chatService.createRoom(req.user.id, req.body);
    res.status(201).json({
      success: true,
      data: { room },
      message: 'Chat room created'
    });
  } catch (error) {
    next(error);
  }
};

const listRooms = async (req, res, next) => {
  try {
    const rooms = await chatService.listUserRooms(req.user.id);
    res.status(200).json({
      success: true,
      data: rooms,
      message: 'Chat rooms retrieved'
    });
  } catch (error) {
    next(error);
  }
};

const getRoom = async (req, res, next) => {
  try {
    const room = await chatService.getRoomById(req.params.id, req.user.id);
    res.status(200).json({
      success: true,
      data: room,
      message: 'Chat room retrieved'
    });
  } catch (error) {
    next(error);
  }
};

const listMessages = async (req, res, next) => {
  try {
    const result = await chatService.listRoomMessages(req.params.id, req.user.id, req.query);
    res.status(200).json({
      success: true,
      data: result,
      message: 'Messages retrieved'
    });
  } catch (error) {
    next(error);
  }
};

const sendMessage = async (req, res, next) => {
  try {
    const { roomId, ...payload } = req.body;
    const message = await chatService.sendMessage(req.user.id, {
      ...payload,
      // Lazy creation: no roomId means the first message creates the room
      roomId: req.params.id || roomId || null
    });
    res.status(201).json({
      success: true,
      data: message,
      message: 'Message sent'
    });
  } catch (error) {
    next(error);
  }
};

const updateRoomStatus = async (req, res, next) => {
  try {
    const room = await chatService.updateRoomStatus(req.params.id, req.user.id, req.body.status);
    res.status(200).json({
      success: true,
      data: room,
      message: 'Chat room status updated'
    });
  } catch (error) {
    next(error);
  }
};

const closeRoom = async (req, res, next) => {
  try {
    const room = await chatService.closeRoom(req.params.id, req.user.id);
    res.status(200).json({
      success: true,
      data: room,
      message: 'Chat room closed'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createRoom,
  listRooms,
  getRoom,
  listMessages,
  sendMessage,
  updateRoomStatus,
  closeRoom
};