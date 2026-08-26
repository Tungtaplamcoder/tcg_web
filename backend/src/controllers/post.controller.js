const postService = require('../services/post.service');

const listPosts = async (req, res, next) => {
  try {
    const result = await postService.listPosts(req.query);
    res.status(200).json({
      success: true,
      data: result,
      message: 'Posts retrieved'
    });
  } catch (error) {
    next(error);
  }
};

const getPost = async (req, res, next) => {
  try {
    const post = await postService.getPostById(req.params.id);
    res.status(200).json({
      success: true,
      data: post,
      message: 'Post retrieved'
    });
  } catch (error) {
    next(error);
  }
};

const createPost = async (req, res, next) => {
  try {
    const post = await postService.createPost(req.user.id, req.body);
    res.status(201).json({
      success: true,
      data: post,
      message: 'Post created'
    });
  } catch (error) {
    next(error);
  }
};

const updatePost = async (req, res, next) => {
  try {
    const post = await postService.updatePost(req.params.id, req.body);
    res.status(200).json({
      success: true,
      data: post,
      message: 'Post updated'
    });
  } catch (error) {
    next(error);
  }
};

const deletePost = async (req, res, next) => {
  try {
    const result = await postService.deletePost(req.params.id);
    res.status(200).json({
      success: true,
      data: result,
      message: 'Post deleted'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listPosts,
  getPost,
  createPost,
  updatePost,
  deletePost
};