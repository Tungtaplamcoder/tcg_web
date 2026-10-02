const express = require('express');
const multer = require('multer');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const voucherAdminController = require('../controllers/voucher.admin.controller');
const validate = require('../middlewares/validate');
const { authenticate, authorize, requirePermission } = require('../middlewares/auth');
const { apiLimiter } = require('../middlewares/rateLimiters');
const {
  updateUserRoleSchema, updateUserStatusSchema, updateUserPermissionsSchema, changeUserPasswordSchema,
  createProductSchema, updateProductSchema,
  categorySchema, updateCategorySchema,
  createSetSchema, updateSetSchema,
  createRaritySchema, updateRaritySchema,
  createPostSchema, updatePostSchema, listPostsQuerySchema,
  updateOrderStatusSchema, listOrdersQuerySchema, reconcilePaymentSchema, listPaymentLogsQuerySchema,
  listUsersQuerySchema,
  createVirtualBoxSchema, updateVirtualBoxSchema, listVirtualBoxesQuerySchema,
  sepaySettingsSchema,
  shopSettingsSchema,
  shippingSettingsSchema,
  siteSettingsSchema,
  createVoucherSchema,
  updateVoucherSchema,
  listVouchersQuerySchema,
  toggleVoucherSchema,
  allocateVoucherSchema
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
router.get('/users/:id', apiLimiter, authorize('ADMIN'), adminController.getUserDetail);
router.patch('/users/:id/role', apiLimiter, authorize('ADMIN'), validate(updateUserRoleSchema), adminController.updateUserRole);
router.patch('/users/:id/status', apiLimiter, authorize('ADMIN'), validate(updateUserStatusSchema), adminController.updateUserStatus);
router.patch('/users/:id/permissions', apiLimiter, authorize('ADMIN'), validate(updateUserPermissionsSchema), adminController.updateUserPermissions);
// PUT alias — same granular permission persistence (task contract names PUT).
router.put('/users/:id/permissions', apiLimiter, authorize('ADMIN'), validate(updateUserPermissionsSchema), adminController.updateUserPermissions);
router.patch('/users/:id/password', apiLimiter, authorize('ADMIN'), validate(changeUserPasswordSchema), adminController.changeUserPassword);
router.delete('/users/:id', apiLimiter, authorize('ADMIN'), adminController.deleteUser);

// ==================== SET MANAGEMENT (Sản phẩm) ====================
const managementRoles = ['ADMIN', 'STAFF', 'MODERATOR'];

router.get('/sets', apiLimiter, authorize(...managementRoles), adminController.listSets);
router.post('/sets', apiLimiter, authorize(...managementRoles), validate(createSetSchema), adminController.createSet);
router.patch('/sets/:id', apiLimiter, authorize(...managementRoles), validate(updateSetSchema), adminController.updateSet);
router.delete('/sets/:id', apiLimiter, authorize('ADMIN'), adminController.deleteSet);

// ==================== RARITY MANAGEMENT (Độ hiếm) ====================
// Dynamic rarity options — CRUD parity with Sets/Categories. GET returns all
// rows so the catalog settings page can manage disabled options too; the
// product modal uses the public /rarities endpoint (active only).
router.get('/rarities', apiLimiter, authorize(...managementRoles), adminController.listRarities);
router.post('/rarities', apiLimiter, authorize(...managementRoles), validate(createRaritySchema), adminController.createRarity);
router.put('/rarities/:id', apiLimiter, authorize(...managementRoles), validate(updateRaritySchema), adminController.updateRarity);
router.patch('/rarities/:id', apiLimiter, authorize(...managementRoles), validate(updateRaritySchema), adminController.updateRarity);
router.delete('/rarities/:id', apiLimiter, authorize('ADMIN', 'STAFF'), adminController.deleteRarity);

// ==================== VIRTUAL BOX MANAGEMENT ====================
router.get('/virtual-boxes', apiLimiter, authorize(...managementRoles), requirePermission('virtual_box'), validate(listVirtualBoxesQuerySchema, 'query'), adminController.listVirtualBoxes);
router.post('/virtual-boxes', apiLimiter, authorize(...managementRoles), requirePermission('virtual_box'), validate(createVirtualBoxSchema), adminController.createVirtualBox);
router.put('/virtual-boxes/:id', apiLimiter, authorize(...managementRoles), requirePermission('virtual_box'), validate(updateVirtualBoxSchema), adminController.updateVirtualBox);
router.delete('/virtual-boxes/:id', apiLimiter, authorize('ADMIN', 'STAFF'), requirePermission('virtual_box'), adminController.deleteVirtualBox);

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
router.delete('/posts/:id', apiLimiter, authorize('ADMIN', 'STAFF'), adminController.deletePost);

// ==================== ORDER MANAGEMENT ====================
// ADMIN + STAFF may view and manage orders (MODERATOR read-only is
// intentionally excluded; elevate via updateUserPermissions if needed).
router.get('/orders', apiLimiter, authorize('ADMIN', 'STAFF'), requirePermission('orders'), validate(listOrdersQuerySchema, 'query'), adminController.listOrders);
router.patch('/orders/:id/status', apiLimiter, authorize('ADMIN', 'STAFF'), requirePermission('orders'), validate(updateOrderStatusSchema), adminController.updateOrderStatus);

// ==================== PAYMENTS (ADMIN ONLY) ====================
router.get('/payments/logs', apiLimiter, authorize('ADMIN'), validate(listPaymentLogsQuerySchema, 'query'), adminController.listPaymentLogs);
router.post('/payments/reconcile', apiLimiter, authorize('ADMIN'), validate(reconcilePaymentSchema), adminController.reconcilePayment);

// ==================== VOUCHER MANAGEMENT ====================
router.get('/vouchers', apiLimiter, authorize(...managementRoles), requirePermission('vouchers'), validate(listVouchersQuerySchema, 'query'), voucherAdminController.listVouchers);
router.post('/vouchers', apiLimiter, authorize(...managementRoles), requirePermission('vouchers'), validate(createVoucherSchema), voucherAdminController.createVoucher);
router.post('/vouchers/allocate', apiLimiter, authorize(...managementRoles), requirePermission('vouchers'), validate(allocateVoucherSchema), voucherAdminController.allocateVoucher);
router.get('/vouchers/:id', apiLimiter, authorize(...managementRoles), requirePermission('vouchers'), voucherAdminController.getVoucher);
router.put('/vouchers/:id', apiLimiter, authorize(...managementRoles), requirePermission('vouchers'), validate(updateVoucherSchema), voucherAdminController.updateVoucher);
router.patch('/vouchers/:id/toggle', apiLimiter, authorize(...managementRoles), requirePermission('vouchers'), validate(toggleVoucherSchema), voucherAdminController.toggleVoucher);
router.delete('/vouchers/:id', apiLimiter, authorize('ADMIN', 'STAFF'), requirePermission('vouchers'), voucherAdminController.deleteVoucher);
router.get('/vouchers/:id/holders', apiLimiter, authorize(...managementRoles), requirePermission('vouchers'), voucherAdminController.listVoucherHolders);

// ==================== DASHBOARD ====================
router.get('/dashboard/stats', apiLimiter, authorize(...managementRoles), adminController.getDashboardStats);

// ==================== SETTINGS (ADMIN ONLY) ====================
router.get('/settings/sepay', apiLimiter, authorize('ADMIN'), adminController.getSepaySettings);
router.put('/settings/sepay', apiLimiter, authorize('ADMIN'), validate(sepaySettingsSchema), adminController.updateSepaySettings);

router.get('/settings/shop', apiLimiter, authorize('ADMIN'), adminController.getShopSettings);
router.put('/settings/shop', apiLimiter, authorize('ADMIN'), validate(shopSettingsSchema), adminController.updateShopSettings);

router.get('/settings/shipping', apiLimiter, authorize('ADMIN'), adminController.getShippingSettings);
router.put('/settings/shipping', apiLimiter, authorize('ADMIN'), validate(shippingSettingsSchema), adminController.updateShippingSettings);

// ==================== SITE SETTINGS (ADMIN ONLY) ====================
router.get('/settings/site', apiLimiter, authorize('ADMIN'), adminController.getSiteSettings);
router.put('/settings/site', apiLimiter, authorize('ADMIN'), validate(siteSettingsSchema), adminController.updateSiteSettings);

module.exports = router;