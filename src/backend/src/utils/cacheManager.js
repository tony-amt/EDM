const logger = require('./logger');

/**
 * 智能缓存管理器
 * 支持按模式清除相关缓存，解决联系人更新后标签统计不准确的问题
 */
class CacheManager {
  constructor() {
    this.cache = new Map();
    this.CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存
  }

  /**
   * 设置缓存
   * @param {string} key - 缓存键
   * @param {any} data - 缓存数据
   * @param {number} ttl - 过期时间（毫秒），可选
   */
  set(key, data, ttl = this.CACHE_TTL) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
    logger.debug(`[CACHE] Set cache key: ${key}`);
  }

  /**
   * 获取缓存
   * @param {string} key - 缓存键
   * @returns {any|null} 缓存数据或null
   */
  get(key) {
    if (!this.cache.has(key)) {
      return null;
    }

    const cached = this.cache.get(key);
    if (Date.now() - cached.timestamp > cached.ttl) {
      this.cache.delete(key);
      logger.debug(`[CACHE] Cache expired and deleted: ${key}`);
      return null;
    }

    logger.debug(`[CACHE] Cache hit: ${key}`);
    return cached.data;
  }

  /**
   * 删除单个缓存
   * @param {string} key - 缓存键
   */
  delete(key) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
      logger.debug(`[CACHE] Deleted cache key: ${key}`);
    }
  }

  /**
   * 按模式清除缓存
   * @param {string} pattern - 匹配模式（支持通配符*）
   */
  clearByPattern(pattern) {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    const keysToDelete = [];

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => {
      this.cache.delete(key);
    });

    if (keysToDelete.length > 0) {
      logger.info(`[CACHE] Cleared ${keysToDelete.length} cache entries matching pattern: ${pattern}`);
      logger.debug(`[CACHE] Cleared keys: ${keysToDelete.join(', ')}`);
    }
  }

  /**
   * 清除用户相关的所有标签缓存
   * @param {string} userId - 用户ID
   */
  clearUserTagCache(userId) {
    const patterns = [
      `tags_${userId}_*`,      // 标签列表缓存
      `tag_tree_${userId}`,    // 标签树缓存
    ];

    patterns.forEach(pattern => {
      this.clearByPattern(pattern);
    });

    logger.info(`[CACHE] Cleared all tag cache for user: ${userId}`);
  }

  /**
   * 清除特定标签相关的缓存
   * @param {string} userId - 用户ID
   * @param {string[]} tagIds - 标签ID数组
   */
  clearTagRelatedCache(userId, tagIds = []) {
    // 清除用户的所有标签缓存（因为标签统计可能受影响）
    this.clearUserTagCache(userId);

    // 如果有具体的标签ID，可以在此添加更精细的缓存清除逻辑
    if (tagIds.length > 0) {
      logger.info(`[CACHE] Cleared cache for tags: ${tagIds.join(', ')} (user: ${userId})`);
    }
  }

  /**
   * 清除联系人相关的缓存
   * @param {string} userId - 用户ID
   * @param {string[]} tagIds - 受影响的标签ID数组
   */
  clearContactRelatedCache(userId, tagIds = []) {
    // 清除标签相关缓存（因为联系人数量统计会变化）
    this.clearTagRelatedCache(userId, tagIds);

    // 可以在此添加联系人列表缓存清除逻辑
    // 例如: this.clearByPattern(`contacts_${userId}_*`);

    logger.info(`[CACHE] Cleared contact-related cache for user: ${userId}`);
  }

  /**
   * 获取缓存统计信息
   */
  getStats() {
    const now = Date.now();
    let validCount = 0;
    let expiredCount = 0;

    for (const [key, cached] of this.cache.entries()) {
      if (now - cached.timestamp > cached.ttl) {
        expiredCount++;
      } else {
        validCount++;
      }
    }

    return {
      total: this.cache.size,
      valid: validCount,
      expired: expiredCount
    };
  }

  /**
   * 清理过期缓存
   */
  cleanup() {
    const now = Date.now();
    const keysToDelete = [];

    for (const [key, cached] of this.cache.entries()) {
      if (now - cached.timestamp > cached.ttl) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => {
      this.cache.delete(key);
    });

    if (keysToDelete.length > 0) {
      logger.info(`[CACHE] Cleaned up ${keysToDelete.length} expired cache entries`);
    }

    return keysToDelete.length;
  }

  /**
   * 清除所有缓存
   */
  clear() {
    const size = this.cache.size;
    this.cache.clear();
    logger.info(`[CACHE] Cleared all cache (${size} entries)`);
  }
}

// 创建全局缓存管理器实例
const cacheManager = new CacheManager();

// 定期清理过期缓存（每10分钟）
setInterval(() => {
  cacheManager.cleanup();
}, 10 * 60 * 1000);

module.exports = cacheManager; 