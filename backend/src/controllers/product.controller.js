const productService = require('../services/product.service');

const listProducts = async (req, res, next) => {
  try {
    const result = await productService.listProducts(req.query);
    res.status(200).json({
      success: true,
      data: result,
      message: 'Products retrieved'
    });
  } catch (error) {
    next(error);
  }
};

const getProduct = async (req, res, next) => {
  try {
    const product = await productService.getProductById(req.params.id);
    res.status(200).json({
      success: true,
      data: product,
      message: 'Product retrieved'
    });
  } catch (error) {
    next(error);
  }
};

const getProductStock = async (req, res, next) => {
  try {
    const stock = await productService.getProductStock(req.params.id);
    res.status(200).json({
      success: true,
      data: stock,
      message: 'Stock retrieved'
    });
  } catch (error) {
    next(error);
  }
};

const listCategories = async (req, res, next) => {
  try {
    const categories = await productService.listCategories(req.query.activeOnly === 'true');
    res.status(200).json({
      success: true,
      data: categories,
      message: 'Categories retrieved'
    });
  } catch (error) {
    next(error);
  }
};

const listSets = async (req, res, next) => {
  try {
    const sets = await productService.listSets();
    res.status(200).json({
      success: true,
      data: sets,
      message: 'Sets retrieved'
    });
  } catch (error) {
    next(error);
  }
};

const listCards = async (req, res, next) => {
  try {
    const result = await productService.listCards(req.query);
    res.status(200).json({
      success: true,
      data: result,
      message: 'Cards retrieved'
    });
  } catch (error) {
    next(error);
  }
};

const getCard = async (req, res, next) => {
  try {
    const card = await productService.getCardById(req.params.id);
    res.status(200).json({
      success: true,
      data: card,
      message: 'Card retrieved'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listProducts,
  getProduct,
  getProductStock,
  listCategories,
  listSets,
  listCards,
  getCard
};