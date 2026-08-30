const { z } = require('zod');

const checkoutItemSchema = z.object({
  productId: z.string().uuid().optional(),
  variantId: z.string().uuid().optional(),
  cardId: z.string().uuid().optional(),
  quantity: z.number().int().min(1).max(10).default(1)
}).refine((data) => data.productId || data.cardId, {
  message: 'Either productId or cardId is required'
});

const shippingAddressSchema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  phone: z.string().min(8, 'Phone is required'),
  addressLine1: z.string().min(5, 'Address is required'),
  addressLine2: z.string().optional(),
  city: z.string().min(2, 'City is required'),
  state: z.string().optional(),
  country: z.string().min(2, 'Country is required'),
  zipCode: z.string().optional(),
  provinceCode: z.string().optional(),
  wardCode: z.string().optional(),
  provinceName: z.string().optional(),
  wardName: z.string().optional()
});

const checkoutSchema = z.object({
  items: z.array(checkoutItemSchema).min(1, 'At least one item is required').max(50),
  shippingAddress: shippingAddressSchema,
  paymentMethod: z.enum(['SEPAY', 'SEPA', 'SEPAy']).default('SEPAY')
});

const orderQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  status: z.enum(['PENDING', 'CANCELLED', 'PACKAGING', 'SHIPPING', 'DELIVERED']).optional()
});

const idParamSchema = z.object({
  id: z.string().uuid('Invalid order id')
});

module.exports = {
  checkoutSchema,
  orderQuerySchema,
  idParamSchema
};