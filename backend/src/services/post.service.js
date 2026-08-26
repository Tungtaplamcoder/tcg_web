const prisma = require('../config/prisma');
const { NotFoundError, AppError } = require('../utils/errors');

const listPosts = async (query) => {
  const { page, limit } = query;
  const skip = (page - 1) * limit;
  const take = limit;

  const [items, totalItems] = await Promise.all([
    prisma.post.findMany({
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        author: {
          select: { id: true, email: true, fullName: true }
        }
      }
    }),
    prisma.post.count()
  ]);

  return {
    items,
    meta: {
      page,
      limit,
      totalItems,
      totalPages: Math.ceil(totalItems / limit)
    }
  };
};

const getPostById = async (id) => {
  const post = await prisma.post.findUnique({
    where: { id },
    include: {
      author: {
        select: { id: true, email: true, fullName: true }
      }
    }
  });
  if (!post) throw new NotFoundError('Post not found');
  return post;
};

const createPost = async (authorId, data) => {
  return prisma.post.create({
    data: {
      title: data.title,
      content: data.content,
      excerpt: data.excerpt || null,
      thumbnailUrl: data.thumbnailUrl || null,
      authorId
    },
    include: {
      author: { select: { id: true, email: true, fullName: true } }
    }
  });
};

const updatePost = async (id, data) => {
  const existing = await prisma.post.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Post not found');
  return prisma.post.update({
    where: { id },
    data: {
      title: data.title,
      content: data.content,
      excerpt: data.excerpt,
      thumbnailUrl: data.thumbnailUrl
    },
    include: {
      author: { select: { id: true, email: true, fullName: true } }
    }
  });
};

const deletePost = async (id) => {
  const existing = await prisma.post.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Post not found');
  await prisma.post.delete({ where: { id } });
  return { success: true };
};

module.exports = {
  listPosts,
  getPostById,
  createPost,
  updatePost,
  deletePost
};