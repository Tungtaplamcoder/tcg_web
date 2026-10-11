/**
 * In-Memory Cache Utility for TCG Web Backend
 * Zero-dependency, lightweight TTL cache built on native Map.
 * Optimized for CloudLinux cPanel environments with strict RAM (1.5GB) and NPROC limits.
 */

class MemoryCache {
  constructor(maxEntries = 500) {
    this.cache = new Map();
    this.maxEntries = maxEntries;

    // Periodic sweep every 60s to evict expired entries without blocking the event loop
    this.sweepInterval = setInterval(() => this.evictExpired(), 60 * 1000);
    if (this.sweepInterval.unref) {
      this.sweepInterval.unref(); // Do not hold the Node process open
    }
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return undefined;

    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    return item.value;
  }

  set(key, value, ttlSeconds = 60) {
    // Guard against memory bloat: evict oldest entry if size exceeds maxEntries
    if (this.cache.size >= this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000
    });
  }

  del(key) {
    return this.cache.delete(key);
  }

  delByPrefix(prefix) {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  clear() {
    this.cache.clear();
  }

  size() {
    return this.cache.size;
  }

  evictExpired() {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}

// Global cache singleton instance
const globalCache = new MemoryCache(500);

/**
 * Express middleware for caching read-only GET requests
 * @param {number} ttlSeconds - Cache TTL in seconds (default: 60)
 * @param {string} keyPrefix - Optional prefix for grouping keys
 */
const cacheMiddleware = (ttlSeconds = 60, keyPrefix = '') => {
  return (req, res, next) => {
    // Only cache GET or HEAD requests
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return next();
    }

    // Skip caching if authenticated user header or authorization present if needed,
    // but for public catalog routes, cache by originalUrl
    const cacheKey = `${keyPrefix ? keyPrefix + ':' : ''}${req.originalUrl || req.url}`;
    const cachedResponse = globalCache.get(cacheKey);

    if (cachedResponse) {
      res.set('X-Cache', 'HIT');
      return res.status(cachedResponse.status || 200).json(cachedResponse.body);
    }

    res.set('X-Cache', 'MISS');

    // Intercept res.json to store successful response in memory
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      // Only cache 2xx responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        globalCache.set(cacheKey, { status: res.statusCode, body }, ttlSeconds);
      }
      return originalJson(body);
    };

    next();
  };
};

/**
 * Flush all catalog-related cached data
 * Triggered on Admin create/update/delete operations
 */
const clearCatalogCache = () => {
  // Clear all cached public endpoints
  globalCache.clear();
};

module.exports = {
  MemoryCache,
  globalCache,
  cacheMiddleware,
  clearCatalogCache
};