const { z } = require('zod');
const { PRODUCT_CATEGORY_ENUM } = require('../constants/productCategories');

// ==================== USER SCHEMAS ====================

const updateUserRoleSchema = z.object({
  role: z.enum(['CUSTOMER', 'ADMIN', 'MODERATOR', 'STAFF'])
});

const updateUserStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'BANNED', 'DELETED'])
});

const updateUserPermissionsSchema = z.object({
  canManageInventory: z.boolean().optional(),
  canManagePosts: z.boolean().optional(),
  canAccessChat: z.boolean().optional()
});

const changeUserPasswordSchema = z.object({
  newPassword: z.string().min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain uppercase')
    .regex(/[a-z]/, 'Must contain lowercase')
    .regex(/[0-9]/, 'Must contain number')
});

// ==================== PRODUCT SCHEMAS ====================

const createProductSchema = z.object({
  name: z.string().min(2).max(200),
  slug: z.string().min(2).max(200).optional(),
  description: z.string().optional(),
  category: z.enum(PRODUCT_CATEGORY_ENUM).optional(), // Binary: Box (Sealed Boxes) or Card (Single Cards)
  setId: z.string().uuid().optional(),
  cardNumber: z.string().optional(),
  rarity: z.string().optional(),
  condition: z.enum(['MINT', 'NEAR_MINT', 'EXCELLENT', 'GOOD', 'POOR']).default('NEAR_MINT'),
  price: z.number().min(0),
  stockQuantity: z.number().int().min(0).default(0),
  images: z.array(z.string().url()).max(10).optional(),
  backImage: z.string().url().optional(),
  attributes: z.record(z.any()).optional()
});

const updateProductSchema = createProductSchema.partial();

const addCardsSchema = z.object({
  cards: z.array(z.object({
    sku: z.string().min(1).max(100),
    condition: z.enum(['MINT', 'NEAR_MINT', 'EXCELLENT', 'GOOD', 'POOR']).default('NEAR_MINT'),
    purchasePrice: z.number().min(0).optional(),
    notes: z.string().optional()
  })).min(1).max(100)
});

const updateCardSchema = z.object({
  condition: z.enum(['MINT', 'NEAR_MINT', 'EXCELLENT', 'GOOD', 'POOR']).optional(),
  status: z.enum(['AVAILABLE', 'RESERVED', 'SOLD', 'INACTIVE']).optional(),
  purchasePrice: z.number().min(0).nullable().optional(),
  notes: z.string().nullable().optional()
});

// ==================== POST SCHEMAS ====================

const createPostSchema = z.object({
  title: z.string().min(2).max(200),
  content: z.string().min(1),
  excerpt: z.string().max(500).optional(),
  thumbnailUrl: z.string().url().optional()
});

const updatePostSchema = createPostSchema.partial();

const listPostsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10)
});

// ==================== ORDER SCHEMAS ====================

const updateOrderStatusSchema = z.object({
  status: z.enum(['COMPLETED', 'CANCELLED', 'REFUNDED']),
  note: z.string().optional()
});

const listOrdersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['PENDING', 'PAID', 'COMPLETED', 'CANCELLED', 'REFUNDED', 'FAILED']).optional(),
  userId: z.string().uuid().optional(),
  search: z.string().optional()
});

// ==================== PAYMENT SCHEMAS ====================

const reconcilePaymentSchema = z.object({
  paymentLogId: z.string().uuid(),
  action: z.enum(['MARK_AS_COMPLETED', 'MARK_AS_MISMATCH']),
  note: z.string().optional()
});

const listPaymentLogsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum([
    'PENDING',
    'COMPLETED',
    'MISMATCH',
    'SIGNATURE_MISMATCH',
    'INVALID_PAYLOAD',
    'AMOUNT_MISMATCH',
    'DUPLICATE',
    'ERROR'
  ]).optional()
});

// ==================== USER LIST SCHEMA ====================

const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  role: z.enum(['CUSTOMER', 'ADMIN', 'MODERATOR', 'STAFF']).optional(),
  status: z.enum(['ACTIVE', 'BANNED', 'DELETED']).optional(),
  search: z.string().optional()
});

// ==================== EXPORTS ====================

module.exports = {
  updateUserRoleSchema,
  updateUserStatusSchema,
  updateUserPermissionsSchema,
  changeUserPasswordSchema,
  createProductSchema,
  updateProductSchema,
  addCardsSchema,
  updateCardSchema,
  createPostSchema,
  updatePostSchema,
  listPostsQuerySchema,
  updateOrderStatusSchema,
  listOrdersQuerySchema,
  reconcilePaymentSchema,
  listPaymentLogsQuerySchema,
  listUsersQuerySchema
};