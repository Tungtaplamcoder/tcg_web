const { LRUCache } = require('lru-cache');

const cache = new LRUCache({
  max: 500,
  ttl: 1000 * 60 * 5,
  updateAgeOnGet: true,
  allowStale: false,
});

const cacheWithTTL = (key, value, ttlMs = 1000 * 60 * 5) => {
  cache.set(key, value, { ttl: ttlMs });
};

const getCache = (key) => {
  return cache.get(key);
};

const deleteCache = (key) => {
  cache.delete(key);
};

const clearCache = () => {
  cache.clear();
};

const invalidatePattern = (pattern) => {
  const regex = new RegExp(pattern);
  for (const key of cache.keys()) {
    if (regex.test(key)) {
      cache.delete(key);
    }
  }
};

const getCacheStats = () => {
  return {
    size: cache.size,
    maxSize: cache.max,
    calculatedSize: cache.calculatedSize,
  };
};

module.exports = {
  cache,
  setCache: cacheWithTTL,
  getCache,
  deleteCache,
  clearCache,
  invalidatePattern,
  getCacheStats,
};