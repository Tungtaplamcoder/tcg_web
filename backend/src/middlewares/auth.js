const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const env = require('../config/env');
const { AuthenticationError, AuthorizationError } = require('../utils/errors');
const { permissionSelect, FLAG_TO_COLUMN } = require('../utils/permissions');

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
        ...permissionSelect,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) {
      throw new AuthenticationError('Account no longer exists');
    }

    if (user.status === 'BANNED') {
      throw new AuthorizationError('Account is banned');
    }

    if (user.status === 'DELETED') {
      throw new AuthenticationError('Account no longer exists');
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

const ROLE_DEFAULT_PERMISSIONS = {
  ADMIN: ['orders', 'inventory', 'virtual_box', 'posts', 'vouchers'],
  MODERATOR: ['posts']
};

const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AuthenticationError('Authentication required'));
    }
    // Admins always retain full access to every module.
    if (req.user.role === 'ADMIN') return next();

    // Staff (and every non-admin) permissions are driven by the granular
    // per-account boolean flags toggled from /admin/users — the same source
    // of truth the Staff Panel sidebar uses.
    const column = FLAG_TO_COLUMN[permission];
    if (column && req.user[column]) return next();

    // MODERATOR keeps its read-only default (posts) unless the account has
    // been explicitly elevated through the granular flags above.
    const roleDefaults = ROLE_DEFAULT_PERMISSIONS[req.user.role] || [];
    if (roleDefaults.includes(permission)) return next();

    return next(new AuthorizationError('Bạn không có quyền truy cập tính năng này'));
  };
};

module.exports = {
  authenticate,
  authorize,
  requirePermission
};