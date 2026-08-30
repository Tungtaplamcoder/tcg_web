const express = require('express');
const multer = require('multer');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const validate = require('../middlewares/validate');
const { authenticate, authorize, requirePermission } = require('../middlewares/auth');
const { apiLimiter } = require('../middlewares/rateLimiters');
const {
  updateUserRoleSchema, updateUserStatusSchema, updateUserPermissionsSchema, changeUserPasswordSchema,
  createProductSchema, updateProductSchema,
  categorySchema, updateCategorySchema,
  createSetSchema, updateSetSchema,
  createPostSchema, updatePostSchema, listPostsQuerySchema,
  updateOrderStatusSchema, listOrdersQuerySchema, reconcilePaymentSchema, listPaymentLogsQuerySchema,
  listUsersQuerySchema,
  createVirtualBoxSchema, updateVirtualBoxSchema, listVirtualBoxesQuerySchema
} = require('../schemas/admin.schema');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  }
});

router.use(authenticate);

// ==================== USER MANAGEMENT (ADMIN ONLY) ====================
router.get('/users', apiLimiter, authorize('ADMIN'), validate(listUsersQuerySchema, 'query'), adminController.listUsers);
router.patch('/users/:id/role', apiLimiter, authorize('ADMIN'), validate(updateUserRoleSchema), adminController.updateUserRole);
router.patch('/users/:id/status', apiLimiter, authorize('ADMIN'), validate(updateUserStatusSchema), adminController.updateUserStatus);
router.patch('/users/:id/permissions', apiLimiter, authorize('ADMIN'), validate(updateUserPermissionsSchema), adminController.updateUserPermissions);
router.patch('/users/:id/password', apiLimiter, authorize('ADMIN'), validate(changeUserPasswordSchema), adminController.changeUserPassword);

// ==================== SET MANAGEMENT (Sản phẩm) ====================
const managementRoles = ['ADMIN', 'STAFF', 'MODERATOR'];

router.get('/sets', apiLimiter, authorize(...managementRoles), adminController.listSets);
router.post('/sets', apiLimiter, authorize(...managementRoles), validate(createSetSchema), adminController.createSet);
router.patch('/sets/:id', apiLimiter, authorize(...managementRoles), validate(updateSetSchema), adminController.updateSet);
router.delete('/sets/:id', apiLimiter, authorize('ADMIN'), adminController.deleteSet);

// ==================== VIRTUAL BOX MANAGEMENT ====================
router.get('/virtual-boxes', apiLimiter, authorize(...managementRoles), validate(listVirtualBoxesQuerySchema, 'query'), adminController.listVirtualBoxes);
router.post('/virtual-boxes', apiLimiter, authorize(...managementRoles), validate(createVirtualBoxSchema), adminController.createVirtualBox);
router.put('/virtual-boxes/:id', apiLimiter, authorize(...managementRoles), validate(updateVirtualBoxSchema), adminController.updateVirtualBox);
router.delete('/virtual-boxes/:id', apiLimiter, authorize('ADMIN'), adminController.deleteVirtualBox);

// ==================== PRODUCT MANAGEMENT ====================
router.get('/products', apiLimiter, authorize(...managementRoles), requirePermission('inventory'), adminController.listProducts);
router.post('/products', apiLimiter, authorize(...managementRoles), requirePermission('inventory'), validate(createProductSchema), adminController.createProduct);
router.patch('/products/:id', apiLimiter, authorize(...managementRoles), requirePermission('inventory'), validate(updateProductSchema), adminController.updateProduct);
router.delete('/products/:id', apiLimiter, authorize(...managementRoles), requirePermission('inventory'), adminController.deleteProduct);
router.post('/upload-image', apiLimiter, authorize(...managementRoles), requirePermission('inventory'), upload.single('image'), adminController.uploadImage);

// ==================== CATEGORY MANAGEMENT ====================
router.get('/categories', apiLimiter, authorize(...managementRoles), adminController.listCategories);
router.post('/categories', apiLimiter, authorize(...managementRoles), validate(categorySchema), adminController.createCategory);
router.patch('/categories/:id', apiLimiter, authorize(...managementRoles), validate(updateCategorySchema), adminController.updateCategory);
router.delete('/categories/:id', apiLimiter, authorize('ADMIN'), adminController.deleteCategory);

// ==================== POST MANAGEMENT ====================
router.get('/posts', apiLimiter, authorize(...managementRoles), requirePermission('posts'), validate(listPostsQuerySchema, 'query'), adminController.listPosts);
router.post('/posts', apiLimiter, authorize(...managementRoles), requirePermission('posts'), validate(createPostSchema), adminController.createPost);
router.patch('/posts/:id', apiLimiter, authorize(...managementRoles), requirePermission('posts'), validate(updatePostSchema), adminController.updatePost);
router.delete('/posts/:id', apiLimiter, authorize('ADMIN'), adminController.deletePost);

// ==================== CHAT MANAGEMENT ====================
router.get('/chat/rooms', apiLimiter, authorize(...managementRoles), requirePermission('chat'), adminController.listChatRooms);
router.get('/chat/rooms/:id/messages', apiLimiter, authorize(...managementRoles), requirePermission('chat'), adminController.getChatRoomMessages);

// ==================== ORDER MANAGEMENT ====================
router.get('/orders', apiLimiter, authorize(...managementRoles), validate(listOrdersQuerySchema, 'query'), adminController.listOrders);
router.patch('/orders/:id/status', apiLimiter, authorize(...managementRoles), validate(updateOrderStatusSchema), adminController.updateOrderStatus);

// ==================== PAYMENTS (ADMIN ONLY) ====================
router.get('/payments/logs', apiLimiter, authorize('ADMIN'), validate(listPaymentLogsQuerySchema, 'query'), adminController.listPaymentLogs);
router.post('/payments/reconcile', apiLimiter, authorize('ADMIN'), validate(reconcilePaymentSchema), adminController.reconcilePayment);

// ==================== DASHBOARD ====================
router.get('/dashboard/stats', apiLimiter, authorize(...managementRoles), adminController.getDashboardStats);

module.exports = router;