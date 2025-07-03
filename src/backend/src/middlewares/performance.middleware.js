const logger = require('../utils/logger');

// 简单的内存缓存
const cache = new Map();
const CACHE_TTL = 3 * 60 * 1000; // 3分钟缓存

/**
 * 性能优化中间件
 */
const performanceMiddleware = {
  // 响应时间监控
  responseTime: (req, res, next) => {
    const startTime = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - startTime;

      // 记录慢请求
      if (duration > 1000) {
        logger.warn(`Slow request detected: ${req.method} ${req.path} - ${duration}ms`, {
          method: req.method,
          path: req.path,
          duration,
          userAgent: req.get('User-Agent'),
          ip: req.ip
        });
      }

      // 添加响应头
      res.set('X-Response-Time', `${duration}ms`);
    });

    next();
  },

  // 简单缓存中间件（仅用于GET请求）
  cache: (ttl = CACHE_TTL) => {
    return (req, res, next) => {
      // 只缓存GET请求
      if (req.method !== 'GET') {
        return next();
      }

      // 生成缓存键
      const cacheKey = `${req.user?.id || 'anonymous'}_${req.originalUrl}`;

      // 检查缓存
      if (cache.has(cacheKey)) {
        const cached = cache.get(cacheKey);
        if (Date.now() - cached.timestamp < ttl) {
          res.set('X-Cache', 'HIT');
          res.set('X-Cache-Age', Math.floor((Date.now() - cached.timestamp) / 1000));
          return res.json(cached.data);
        }
        cache.delete(cacheKey);
      }

      // 拦截原始的json方法
      const originalJson = res.json;
      res.json = function (data) {
        // 只缓存成功的响应
        if (res.statusCode === 200 && data) {
          cache.set(cacheKey, {
            data: data,
            timestamp: Date.now()
          });

          // 清理过期缓存（简单的LRU）
          if (cache.size > 1000) {
            const keys = Array.from(cache.keys());
            const oldestKey = keys[0];
            cache.delete(oldestKey);
          }
        }

        res.set('X-Cache', 'MISS');
        return originalJson.call(this, data);
      };

      next();
    };
  },

  // 数据压缩优化
  compress: (req, res, next) => {
    // 设置压缩相关头部
    const acceptEncoding = req.get('Accept-Encoding') || '';

    if (acceptEncoding.includes('gzip')) {
      res.set('Content-Encoding', 'gzip');
    }

    next();
  },

  // 数据库连接池优化
  dbOptimization: (req, res, next) => {
    // 为频繁查询设置连接提示
    req.dbHints = {
      useReadReplica: req.method === 'GET',
      enableCache: true,
      timeout: 5000
    };

    next();
  }
};

module.exports = performanceMiddleware; 