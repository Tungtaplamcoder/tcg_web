const productService = require('../services/product.service');
const { isDatabaseError, emptyPage, sendDbEmpty } = require('../utils/dbGuard');

const listProducts = async (req, res, next) => {
  try {
    const result = await productService.listProducts(req.query);
    res.status(200).json({
      success: true,
      data: result,
      message: 'Products retrieved'
    });
  } catch (error) {
    if (isDatabaseError(error)) {
      // DB down/degraded: return an empty page so the catalog renders its
      // empty state instead of a hard error screen.
      return sendDbEmpty(res, 'product.listProducts', error, emptyPage(req.query?.page, req.query?.limit));
    }
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
    if (isDatabaseError(error)) {
      // ProductDetail already treats a null payload as "not found" — a
      // clean 200 keeps the page from crashing on a DB hiccup.
      return sendDbEmpty(res, 'product.getProduct', error, null);
    }
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
    if (isDatabaseError(error)) {
      return sendDbEmpty(res, 'product.getProductStock', error, { productId: req.params.id, stockQuantity: 0 });
    }
    next(error);
  }
};

const getProductFacets = async (req, res, next) => {
  try {
    const facets = await productService.getProductFacets(req.query);
    res.status(200).json({
      success: true,
      data: facets,
      message: 'Product facets retrieved'
    });
  } catch (error) {
    if (isDatabaseError(error)) {
      // Empty facets degrade the filter rail to plain selects without counts
      return sendDbEmpty(res, 'product.getProductFacets', error, { languages: [], rarities: [], cardSets: [], sets: [], categories: [] });
    }
    next(error);
  }
};

const listCategories = async (req, res, next) => {
  try {
    // activeOnly arrives coerced to a boolean by categoryQuerySchema
    const categories = await productService.listCategories(req.query.activeOnly !== false);
    res.status(200).json({
      success: true,
      data: categories,
      message: 'Categories retrieved'
    });
  } catch (error) {
    if (isDatabaseError(error)) {
      // Home/footer consume this via `response.data.data || []` — an empty
      // array is a safe degradation for both.
      return sendDbEmpty(res, 'product.listCategories', error, []);
    }
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
    if (isDatabaseError(error)) {
      return sendDbEmpty(res, 'product.listSets', error, []);
    }
    next(error);
  }
};

const listRarities = async (req, res, next) => {
  try {
    const rarities = await productService.listRarities();
    res.status(200).json({
      success: true,
      data: rarities,
      message: 'Rarities retrieved'
    });
  } catch (error) {
    if (isDatabaseError(error)) {
      return sendDbEmpty(res, 'product.listRarities', error, []);
    }
    next(error);
  }
};

const listCards = async (req, res, next) => {  try {
    const result = await productService.listCards(req.query);
    res.status(200).json({
      success: true,
      data: result,
      message: 'Cards retrieved'
    });
  } catch (error) {
    if (isDatabaseError(error)) {
      return sendDbEmpty(res, 'product.listCards', error, emptyPage(req.query?.page, req.query?.limit));
    }
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
    if (isDatabaseError(error)) {
      return sendDbEmpty(res, 'product.getCard', error, null);
    }
    next(error);
  }
};

module.exports = {
  listProducts,
  getProduct,
  getProductStock,
  getProductFacets,
  listCategories,
  listSets,
  listRarities,
  listCards,
  getCard
};
