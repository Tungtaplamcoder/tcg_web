const { z } = require('zod');

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

module.exports = {
  createPostSchema,
  updatePostSchema,
  listPostsQuerySchema
};