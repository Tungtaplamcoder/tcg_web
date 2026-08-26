const express = require('express');
const router = express.Router();
const postController = require('../controllers/post.controller');
const validate = require('../middlewares/validate');
const { authenticate, authorize } = require('../middlewares/auth');
const { apiLimiter } = require('../middlewares/rateLimiters');
const {
  createPostSchema,
  updatePostSchema,
  listPostsQuerySchema
} = require('../schemas/post.schema');

// Public routes
router.get('/news', apiLimiter, validate(listPostsQuerySchema, 'query'), postController.listPosts);
router.get('/news/:id', apiLimiter, postController.getPost);

// Admin routes
const adminRouter = express.Router();
adminRouter.use(authenticate);
adminRouter.use(authorize('ADMIN', 'STAFF'));

adminRouter.get('/', apiLimiter, validate(listPostsQuerySchema, 'query'), postController.listPosts);
adminRouter.post('/', apiLimiter, validate(createPostSchema), postController.createPost);
adminRouter.patch('/:id', apiLimiter, validate(updatePostSchema), postController.updatePost);
adminRouter.delete('/:id', apiLimiter, authorize('ADMIN'), postController.deletePost);

module.exports = { router, adminRouter };