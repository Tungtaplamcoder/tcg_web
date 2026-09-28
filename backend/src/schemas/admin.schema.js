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
  canManagePosts: z.boolean().optional()
});

const changeUserPasswordSchema = z.object({
  newPassword: z.string().min(8, 'Password must be at least 8 characters')
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

// Mỗi biến thể (variant) của sản phẩm — lưu giá và tồn kho theo condition.
// `condition` is optional/nullable: Sealed Products (BOX) submit an empty
// string for condition and the controller falls back to 'NEAR_MINT' when
// saving, so the enum must accept '', null, and undefined without throwing.
const productVariantSchema = z.object({
  id: z.string().uuid().optional(),
  condition: cardConditionEnum.optional().nullable().or(z.literal('')),
  variant: z.string().max(100).optional().default('Normal'),
  price: z.coerce.number().min(0, 'Giá phải là số >= 0'),
  stockQuantity: z.coerce.number().int().min(0, 'Tồn kho phải là số nguyên >= 0').default(0)
});

// A free-form category reference resolved by the controller: a semantic
// bucket key (BOX/CARD), an existing category id/slug/name at any level
// of the tree, or a brand-new category name (creatable-select flow) which
// the controller creates on the fly.
const productCategoryRef = z.string().trim().min(2).max(200);

const createProductSchema = z.object({
  name: z.string().min(2).max(200),
  shortName: z.string().max(100).optional().nullable(), // Cho phép rỗng/null
  slug: z.string().min(2).max(200).optional(),
  description: z.string().optional(),
  category: productCategoryRef,
  // Cascading path from the product form's creatable selects — e.g.
  // ["CARD", "TempSeries123", "TempSet123"] — each segment a bucket key or
  // category name/slug. The server creates and CORRECTLY NESTS any missing
  // segments so the tree, the pruning rollups and edit-hydration all work.
  categoryPath: z.array(z.string().trim().min(2).max(200)).max(3).optional(),
  // Creatable-set flow: when the admin types a new expansion set name that
  // does not exist yet, it is created and linked automatically.
  newSetName: z.string().trim().min(2).max(200).optional().nullable(),
  // TCG illustrator name, e.g. "Yuka Morii"
  artist: z.string().trim().max(200).optional().nullable(),
  setIds: z.array(z.string().trim().min(1)).optional(),
  cardNumber: z.string().optional(),
  // TCG rarity — nullable so Box products (no rarity) can explicitly clear it
  rarity: z.string().trim().max(100).optional().nullable(),
  // TCG metadata (single cards): language of the print (JP, ENG, …)
  language: z.string().trim().max(32).optional().nullable(),
  // TCG metadata (single cards): card set / expansion name
  cardSet: z.string().trim().max(200).optional().nullable(),
  images: z.array(z.string().url()).max(10).optional(),
  backImage: z.string().url().optional().nullable(),
  attributes: z.record(z.any()).optional(),
  tcgplayerId: z.string().optional().nullable(),
  variants: z.array(productVariantSchema).optional()
});

const updateProductSchema = createProductSchema.partial().extend({
  status: z.enum(['ACTIVE', 'INACTIVE', 'DRAFT', 'DELETED']).optional()
});

// ==================== CATEGORY SCHEMAS ====================
const categorySchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(100).optional(),
  description: z.string().optional(),
  imageUrl: z.string().url().optional().nullable(),
  isActive: z.boolean().optional(),
  // Hierarchical tree: null/omitted = root level (Single Cards, …).
  // Note: rows may use dashless UUIDs (MariaDB dumps), so don't enforce
  // strict UUID formatting here.
  parentId: z.string().trim().min(1).optional().nullable()
});

const updateCategorySchema = categorySchema.partial();

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
  name: z.string().min(2).max(200),
  // Short expansion code, e.g. "S12a", "SVI" — powers ?set=<code>
  // filtering. Optional; uniqueness is enforced by the controller.
  code: z.string().trim().min(1).max(32).optional().nullable()
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
  note: z.string().optional(),
  trackingNumber: z.string().trim().min(1, 'Mã vận đơn không được để trống').max(100, 'Mã vận đơn tối đa 100 ký tự').optional()
}).refine((data) => data.status !== 'SHIPPING' || !!data.trackingNumber, {
  message: 'Mã vận đơn là bắt buộc khi bắt đầu vận chuyển',
  path: ['trackingNumber']
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

// ==================== VIRTUAL BOX SCHEMAS ====================

const gachaRarityEnum = z.enum(['COMMON', 'RARE', 'EPIC', 'LEGENDARY']);

// Uploaded artwork is either an absolute URL (ImgBB) or a relative path
// (/uploads/<file>) served by the local storage fallback — z.string().url()
// would reject the latter.
const imageSourceSchema = z.string().trim().max(2048).refine(
  (value) => /^(https?:\/\/|\/)/i.test(value),
  { message: 'Image URL must be an absolute http(s) URL or a relative path starting with "/"' }
);

// Accept `image` as an alias for `imageUrl` (box cover and pool entries)
// so either field name persists.
const withImageAlias = (schema) => z.preprocess((data) => {
  if (data && typeof data === 'object' && !('imageUrl' in data) && 'image' in data) {
    const { image, ...rest } = data;
    return { ...rest, imageUrl: image };
  }
  return data;
}, schema);

const virtualBoxDropRateSchema = z.object({
  rarity: gachaRarityEnum,
  rate: z.coerce.number().min(0).max(100)
});

// A pool entry IS a gacha card definition — the gacha ecosystem is fully
// decoupled from the shop inventory, so entries reference GachaCard rows
// (by id) or define a new card inline (name + artwork + rarity + set code).
// `dropRate` is the per-card weight inside its rarity tier.
const virtualBoxPoolEntrySchema = withImageAlias(z.object({
  gachaCardId: z.string().uuid().optional(),
  name: z.string().min(1).max(200).optional(),
  imageUrl: imageSourceSchema.optional().nullable(),
  rarity: z.string().min(1).max(50).optional(),
  setCode: z.string().trim().max(32).optional().nullable(),
  dropRate: z.coerce.number().min(0).max(100).optional()
}).refine((entry) => Boolean(entry.gachaCardId || entry.name), {
  message: 'Each pool entry requires a gachaCardId or a card name'
}));

const dropRatesValid = (data) => {
  if (!data.dropRates || data.dropRates.length === 0) return true;
  const total = data.dropRates.reduce((sum, item) => sum + Number(item.rate || 0), 0);
  return Math.abs(total - 100) <= 0.01;
};

const dropRatesMessage = {
  message: 'Drop rates must total exactly 100%',
  path: ['dropRates']
};

const baseVirtualBoxSchema = z.object({
  name: z.string().min(2).max(200),
  slug: z.string().min(2).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  imageUrl: imageSourceSchema.optional().nullable(),
  gradient: z.string().max(200).optional().nullable(),
  // Price is no longer edited in the admin modal; defaults to 0 (free entry)
  price: z.coerce.number().min(0).optional().default(0),
  status: z.enum(['ACTIVE', 'DRAFT', 'ARCHIVED']).optional(),
  dropRates: z.array(virtualBoxDropRateSchema).min(1).max(20).optional(),
  pool: z.array(virtualBoxPoolEntrySchema).max(500).optional()
});

const createVirtualBoxSchema = withImageAlias(baseVirtualBoxSchema.refine(dropRatesValid, dropRatesMessage));

const updateVirtualBoxSchema = withImageAlias(baseVirtualBoxSchema.partial().refine(dropRatesValid, dropRatesMessage));

const listVirtualBoxesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['ACTIVE', 'DRAFT', 'ARCHIVED']).optional(),
  search: z.string().optional()
});

// ==================== SEPAY SETTINGS SCHEMA ====================

const sepaySettingsSchema = z.object({
  apiUrl: z.string().url('API URL must be a valid URL'),
  webhookUrl: z.string().optional().refine(
    (v) => !v || v.trim() === '' || /^(https?:\/\/|\/)/.test(v.trim()),
    'Webhook URL must be an absolute http(s) URL or a relative path starting with /'
  ),
  webhookSecret: z.string().min(1, 'Webhook secret is required'),
  accountNumber: z.string().min(1, 'Account number is required'),
  accountName: z.string().min(1, 'Account name is required')
});

// ==================== SHOP SETTINGS SCHEMA ====================

const shopSettingsSchema = z.object({
  shop_name: z.string().trim().min(1, 'Shop name is required').max(200),
  // Logo accepts an absolute URL (ImgBB) or a relative path (/uploads/<file>), same as virtual box images
  shop_logo_url: z.string().trim().max(2048).refine(
    (v) => v === '' || /^(https?:\/\/|\/)/i.test(v),
    'Shop logo must be an absolute http(s) URL or a relative path starting with "/"'
  ).optional().default(''),
  support_email: z.string().trim().email('Support email must be a valid email address').max(255),
  support_phone: z.string().trim().min(1, 'Support phone is required').max(50),
  support_address: z.string().trim().min(1, 'Support address is required').max(500)
});

// ==================== SHIPPING SETTINGS SCHEMA ====================

// Phí vận chuyển mặc định (VND): số nguyên >= 0 — 0 là hợp lệ (miễn phí ship)
const shippingSettingsSchema = z.object({
  defaultShippingFee: z.number({ invalid_type_error: 'Shipping fee must be a number' })
    .int('Shipping fee must be an integer (VND)')
    .min(0, 'Shipping fee must be >= 0')
    .max(1000000000, 'Shipping fee is unreasonably large')
});

// ==================== SITE SETTINGS SCHEMA ====================

// Site identity & support chat config (site title, favicon, support chat URL).
// All fields optional on update so the admin can patch a single key; the
// service applies defaults for anything missing.
const siteSettingsSchema = z.object({
  site_title: z.string().trim().min(1, 'Site title is required').max(200),
  site_favicon_url: z.string().trim().max(2048).refine(
    (v) => v === '' || /^(https?:\/\/|\/)/i.test(v),
    'Favicon must be an absolute http(s) URL or a relative path starting with "/"'
  ).optional().default(''),
  support_chat_url: z.string().trim().max(2048).refine(
    (v) => v === '' || /^(https?:\/\/|\/)/i.test(v),
    'Support chat URL must be an absolute http(s) URL or a relative path starting with "/"'
  ).optional().default('')
});

// ==================== VOUCHER SCHEMAS ====================

const voucherDiscountValueSchema = z.coerce.number().min(0, 'Giá trị giảm phải >= 0')
  .refine((v) => v === 0 || v > 0, 'Giá trị giảm phải lớn hơn 0');

const baseVoucherSchema = z.object({
  code: z.string().trim().min(3, 'Mã voucher tối thiểu 3 ký tự').max(50)
    .transform((v) => v.toUpperCase()),
  title: z.string().trim().min(2, 'Tên voucher tối thiểu 2 ký tự').max(200),
  discountType: z.enum(['PERCENT', 'FIXED']),
  discountValue: voucherDiscountValueSchema,
  maxDiscountAmount: z.coerce.number().min(0).nullable().optional(),
  minOrderAmount: z.coerce.number().min(0).default(0),
  totalQuantity: z.coerce.number().int().min(1).nullable().optional(),
  limitPerUser: z.coerce.number().int().min(1).default(1),
  startAt: z.string().datetime({ offset: true }).nullable().optional()
    .or(z.literal(null)).transform((v) => (v ? new Date(v) : null)),
  endAt: z.string().datetime({ offset: true }).nullable().optional()
    .or(z.literal(null)).transform((v) => (v ? new Date(v) : null)),
  isActive: z.boolean().optional().default(true),
  scope: z.enum(['ALL', 'CATEGORY', 'PRODUCT']).default('ALL'),
  scopeIds: z.array(z.string().uuid()).max(200).optional().default([])
});

const createVoucherSchema = baseVoucherSchema.refine(
  (data) => data.discountType !== 'PERCENT' || (data.discountValue >= 0 && data.discountValue <= 100),
  { message: 'Giá trị PERCENT phải từ 0 đến 100', path: ['discountValue'] }
).refine(
  (data) => data.scope === 'ALL' || (data.scopeIds && data.scopeIds.length > 0),
  { message: 'Cần chọn ít nhất một danh mục/sản phẩm khi scope khác ALL', path: ['scopeIds'] }
).refine(
  (data) => !data.startAt || !data.endAt || data.startAt < data.endAt,
  { message: 'Ngày bắt đầu phải trước ngày kết thúc', path: ['startAt'] }
);

const updateVoucherSchema = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  discountType: z.enum(['PERCENT', 'FIXED']).optional(),
  discountValue: z.coerce.number().min(0).optional(),
  maxDiscountAmount: z.coerce.number().min(0).nullable().optional(),
  minOrderAmount: z.coerce.number().min(0).optional(),
  totalQuantity: z.coerce.number().int().min(1).nullable().optional(),
  limitPerUser: z.coerce.number().int().min(1).optional(),
  startAt: z.string().datetime({ offset: true }).nullable().optional()
    .or(z.literal(null)).transform((v) => (v ? new Date(v) : null)).optional(),
  endAt: z.string().datetime({ offset: true }).nullable().optional()
    .or(z.literal(null)).transform((v) => (v ? new Date(v) : null)).optional(),
  isActive: z.boolean().optional(),
  scope: z.enum(['ALL', 'CATEGORY', 'PRODUCT']).optional(),
  scopeIds: z.array(z.string().uuid()).max(200).optional()
}).refine(
  (data) => !data.startAt || !data.endAt || data.startAt < data.endAt,
  { message: 'Ngày bắt đầu phải trước ngày kết thúc', path: ['startAt'] }
);

const listVouchersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  isActive: z.enum(['true', 'false']).optional()
});

const toggleVoucherSchema = z.object({
  isActive: z.boolean()
});

// Cấp voucher trực tiếp: danh sách user id cụ thể, hoặc ALL_USERS
const allocateVoucherSchema = z.object({
  voucherId: z.string().uuid('voucherId phải là UUID'),
  userIds: z.array(z.string().uuid()).max(1000).optional(),
  allUsers: z.boolean().optional()
}).refine((data) => data.allUsers || (data.userIds && data.userIds.length > 0), {
  message: 'Cần cung cấp userIds hoặc allUsers = true',
  path: ['userIds']
});

// ==================== EXPORTS ====================

module.exports = {
  productCategoryRef,
  productCategoryEnum: productCategoryRef, // backwards-compatible alias
  updateUserRoleSchema,
  updateUserStatusSchema,
  updateUserPermissionsSchema,
  changeUserPasswordSchema,
  createProductSchema,
  updateProductSchema,
  categorySchema,
  updateCategorySchema,
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
  listUsersQuerySchema,
  gachaRarityEnum,
  createVirtualBoxSchema,
  updateVirtualBoxSchema,
  listVirtualBoxesQuerySchema,
  sepaySettingsSchema,
  shopSettingsSchema,
  shippingSettingsSchema,
  siteSettingsSchema,
  createVoucherSchema,
  updateVoucherSchema,
  listVouchersQuerySchema,
  toggleVoucherSchema,
  allocateVoucherSchema
};