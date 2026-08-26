const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const prisma = require('../config/prisma');
const env = require('../config/env');
const { AppError, ValidationError, AuthenticationError, ConflictError, NotFoundError } = require('../utils/errors');
const { sendEmail } = require('../utils/email');

const generateAccessToken = (user) => {
  return jwt.sign(
    { sub: user.id, role: user.role, email: user.email },
    env.jwtAccessSecret,
    { expiresIn: env.jwtAccessExpiresIn }
  );
};

const generateRefreshToken = () => {
  return jwt.sign(
    { type: 'refresh' },
    env.jwtRefreshSecret,
    { expiresIn: env.jwtRefreshExpiresIn }
  );
};

const hashPassword = async (password) => {
  return bcrypt.hash(password, 12);
};

const verifyPassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};

const createTokens = async (user, ipAddress = null) => {
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken();

  const savedToken = await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdByIp: ipAddress
    }
  });

  return { accessToken, refreshToken: savedToken.token };
};

const register = async (data, ipAddress) => {
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) {
    throw new ConflictError('Email already registered');
  }

  const passwordHash = await hashPassword(data.password);

  const user = await prisma.user.create({
    data: {
      email: data.email,
      passwordHash,
      fullName: data.fullName,
      phone: data.phone || null,
      address: data.address || null
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      avatarUrl: true,
      canManageInventory: true,
      canManagePosts: true,
      canAccessChat: true,
      createdAt: true
    }
  });

  const tokens = await createTokens(user, ipAddress);
  return { user, ...tokens };
};

const login = async (data, ipAddress) => {
  const user = await prisma.user.findUnique({ where: { email: data.email } });
  if (!user) {
    throw new AuthenticationError('Invalid credentials');
  }

  const valid = await verifyPassword(data.password, user.passwordHash);
  if (!valid) {
    throw new AuthenticationError('Invalid credentials');
  }

  if (user.status === 'BANNED') {
    throw new AuthenticationError('Account is banned');
  }
  if (user.status === 'DELETED') {
    throw new AuthenticationError('Account is deleted');
  }

  const userData = {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    avatarUrl: user.avatarUrl,
    canManageInventory: user.canManageInventory,
    canManagePosts: user.canManagePosts,
    canAccessChat: user.canAccessChat
  };

  const tokens = await createTokens(userData, ipAddress);
  return { user: userData, ...tokens };
};

const refresh = async (token, ipAddress) => {
  const storedToken = await prisma.refreshToken.findUnique({ where: { token } });
  if (!storedToken || storedToken.revoked || storedToken.expiresAt < new Date()) {
    throw new AuthenticationError('Invalid or expired refresh token');
  }

  let decoded;
  try {
    decoded = jwt.verify(token, env.jwtRefreshSecret);
  } catch (error) {
    throw new AuthenticationError('Invalid or expired refresh token');
  }

  const user = await prisma.user.findUnique({ where: { id: storedToken.userId } });
  if (!user) {
    throw new AuthenticationError('User not found');
  }

  // Rotate: revoke old token
  await prisma.refreshToken.update({
    where: { id: storedToken.id },
    data: { revoked: true, replacedByToken: null }
  });

  const userData = {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    avatarUrl: user.avatarUrl,
    canManageInventory: user.canManageInventory,
    canManagePosts: user.canManagePosts,
    canAccessChat: user.canAccessChat
  };

  const tokens = await createTokens(userData, ipAddress);
  return { user: userData, ...tokens };
};

const logout = async (token) => {
  await prisma.refreshToken.updateMany({
    where: { token, revoked: false },
    data: { revoked: true }
  });
  return { success: true };
};

const getMe = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      fullName: true,
      phone: true,
      address: true,
      avatarUrl: true,
      role: true,
      status: true,
      canManageInventory: true,
      canManagePosts: true,
      canAccessChat: true,
      createdAt: true,
      updatedAt: true
    }
  });
  if (!user) throw new NotFoundError('User not found');
  return user;
};

const updateMe = async (userId, data) => {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      fullName: data.fullName,
      phone: data.phone,
      address: data.address,
      avatarUrl: data.avatarUrl
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      phone: true,
      address: true,
      avatarUrl: true,
      role: true,
      status: true,
      canManageInventory: true,
      canManagePosts: true,
      canAccessChat: true,
      createdAt: true,
      updatedAt: true
    }
  });
  return user;
};

const changePassword = async (userId, currentPassword, newPassword) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError('User not found');

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) throw new AuthenticationError('Current password is incorrect');

  const newHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: newHash }
  });

  await prisma.refreshToken.updateMany({
    where: { userId, revoked: false },
    data: { revoked: true }
  });

  return { success: true };
};

const forgotPassword = async (email) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return { success: true, message: 'If email exists, reset instructions sent.' };
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

  await prisma.passwordResetToken.create({
    data: {
      token,
      userId: user.id,
      expiresAt
    }
  });

  const resetUrl = `${env.frontendUrl}/reset-password?token=${token}`;
  const html = `<p>You requested a password reset. Click <a href="${resetUrl}">here</a> to reset your password. This link expires in 30 minutes.</p>`;

  await sendEmail({
    to: user.email,
    subject: 'Password Reset Request',
    html,
    text: `Reset your password: ${resetUrl}`
  });

  return { success: true, message: 'If email exists, reset instructions sent.' };
};

const resetPassword = async (token, newPassword) => {
  const resetRecord = await prisma.passwordResetToken.findUnique({
    where: { token },
    include: { user: true }
  });

  if (!resetRecord || resetRecord.used || resetRecord.expiresAt < new Date()) {
    throw new ValidationError('Invalid or expired reset token');
  }

  const newHash = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetRecord.userId },
      data: { passwordHash: newHash }
    }),
    prisma.passwordResetToken.update({
      where: { id: resetRecord.id },
      data: { used: true }
    }),
    prisma.refreshToken.updateMany({
      where: { userId: resetRecord.userId, revoked: false },
      data: { revoked: true }
    })
  ]);

  return { success: true, message: 'Password has been reset successfully' };
};

module.exports = {
  register,
  login,
  refresh,
  logout,
  getMe,
  updateMe,
  changePassword,
  forgotPassword,
  resetPassword
};