const { z } = require('zod');

const listVirtualBoxesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20)
});

module.exports = {
  listVirtualBoxesQuerySchema
};
