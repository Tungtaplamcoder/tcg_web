const { z } = require('zod');

const productQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  category: z.string().optional(),
  set: z.string().optional(),
  rarity: z.string().optional(),
  condition: z.string().optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  inStock: z.coerce.boolean().optional(),
  sortBy: z.enum(['price', 'name', 'createdAt', 'stockQuantity']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc')
});

const categoryQuerySchema = z.object({
  activeOnly: z.coerce.boolean().default(true)
});

const cardQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().optional(),
  sku: z.string().optional(),
  productId: z.string().uuid().optional()
});

module.exports = {
  productQuerySchema,
  categoryQuerySchema,
  cardQuerySchema
};