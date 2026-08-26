const { z } = require('zod');

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

// Phải khớp với enum CardCondition trong prisma/schema.prisma
const cardConditionEnum = z.enum([
  'MINT',
  'NEAR_MINT',
  'LIGHTLY_PLAYED',
  'MODERATELY_PLAYED',
  'HEAVILY_PLAYED',
  'EXCELLENT',
  'GOOD',
  'POOR'
]);

// Mỗi biến thể (variant) của sản phẩm — lưu giá và tồn kho theo condition
const productVariantSchema = z.object({
  id: z.string().uuid().optional(),
  condition: cardConditionEnum.default('NEAR_MINT'),
  variant: z.string().max(100).optional().default('Normal'),
  price: z.coerce.number().min(0, 'Giá phải là số >= 0'),
  stockQuantity: z.coerce.number().int().min(0, 'Tồn kho phải là số nguyên >= 0').default(0)
});

const createProductSchema = z.object({
  name: z.string().min(2).max(200),
  shortName: z.string().max(100).optional().nullable(), // Cho phép rỗng/null
  slug: z.string().min(2).max(200).optional(),
  description: z.string().optional(),
  setIds: z.array(z.string().uuid()).optional(),
  cardNumber: z.string().optional(),
  rarity: z.string().optional(),
  images: z.array(z.string().url()).max(10).optional(),
  backImage: z.string().url().optional().nullable(),
  attributes: z.record(z.any()).optional(),
  tcgplayerId: z.string().optional().nullable(),
  variants: z.array(productVariantSchema).optional()
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

// ==================== SET SCHEMAS (Sản phẩm) ====================

const createSetSchema = z.object({
  name: z.string().min(2).max(200)
});

const updateSetSchema = createSetSchema.partial();

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
  status: z.enum(['CANCELLED', 'PACKAGING', 'SHIPPING', 'DELIVERED']),
  note: z.string().optional()
});

const listOrdersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['PENDING', 'CANCELLED', 'PACKAGING', 'SHIPPING', 'DELIVERED']).optional(),
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
    'PENDING', 'COMPLETED', 'MISMATCH', 'SIGNATURE_MISMATCH', 'INVALID_PAYLOAD',
    'AMOUNT_MISMATCH', 'DUPLICATE', 'ERROR'
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
  createSetSchema,
  updateSetSchema,
  createPostSchema,
  updatePostSchema,
  listPostsQuerySchema,
  updateOrderStatusSchema,
  listOrdersQuerySchema,
  reconcilePaymentSchema,
  listPaymentLogsQuerySchema,
  listUsersQuerySchema
};