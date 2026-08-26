const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const env = require('../config/env');
const { AuthenticationError, AuthorizationError } = require('../utils/errors');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('No token provided');
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, env.jwtAccessSecret);
    } catch (error) {
      throw new AuthenticationError('Invalid or expired token');
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        avatarUrl: true,
        canManageInventory: true,
        canManagePosts: true,
        canAccessChat: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) {
      throw new AuthenticationError('User not found');
    }

    if (user.status === 'BANNED') {
      throw new AuthorizationError('Account is banned');
    }

    if (user.status === 'DELETED') {
      throw new AuthenticationError('Account is deleted');
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AuthenticationError('Authentication required'));
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(new AuthorizationError('Insufficient permissions'));
    }
    next();
  };
};

const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AuthenticationError('Authentication required'));
    }
    if (req.user.role === 'ADMIN') return next();

    const permissionMap = {
      inventory: req.user.canManageInventory,
      posts: req.user.canManagePosts,
      chat: req.user.canAccessChat,
    };

    if (permissionMap[permission]) return next();
    return next(new AuthorizationError('Bạn không có quyền truy cập tính năng này'));
  };
};

module.exports = {
  authenticate,
  authorize,
  requirePermission
};