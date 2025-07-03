/**
 * 配置管理核心服务
 * Phase 2: 配置管理系统
 */

const { SystemConfig, ConfigChangeHistory, ConfigCategory } = require('../../models/index');
const logger = require('../../utils/logger');
const AppError = require('../../utils/appError');

class ConfigManagerService {
  constructor() {
    this.configCache = new Map();
    this.cacheExpiry = new Map();
    this.cacheTTL = 300000; // 5分钟缓存
  }

  /**
   * 获取配置值
   * @param {string} category - 配置分类
   * @param {string} configKey - 配置键名
   * @param {string} environment - 环境
   * @param {any} defaultValue - 默认值
   * @returns {Promise<any>} 配置值
   */
  async getConfig(category, configKey, environment = 'all', defaultValue = null) {
    try {
      const cacheKey = `${category}:${configKey}:${environment}`;

      // 检查缓存
      if (this.isValidCache(cacheKey)) {
        return this.configCache.get(cacheKey);
      }

      const config = await SystemConfig.getByKey(category, configKey, environment);

      if (!config) {
        logger.warn(`配置项不存在: ${category}.${configKey}, 使用默认值: ${defaultValue}`);
        return defaultValue;
      }

      const value = config.getParsedValue();

      // 更新缓存
      this.updateCache(cacheKey, value);

      return value;
    } catch (error) {
      logger.error('获取配置失败:', error);
      return defaultValue;
    }
  }

  /**
   * 更新配置
   * @param {string} category - 配置分类
   * @param {string} configKey - 配置键名
   * @param {any} newValue - 新值
   * @param {string} userId - 用户ID
   * @param {object} options - 选项
   * @returns {Promise<object>} 更新结果
   */
  async updateConfig(category, configKey, newValue, userId, options = {}) {
    try {
      const config = await SystemConfig.getByKey(category, configKey, options.environment || 'all');

      if (!config) {
        throw new AppError('配置项不存在', 404);
      }

      if (!config.isEditable) {
        throw new AppError('此配置项不可编辑', 403);
      }

      // 验证新值
      const validation = config.validateValue(newValue);
      if (!validation.valid) {
        throw new AppError(validation.error, 400);
      }

      const oldValue = config.getParsedValue();

      // 更新配置
      await config.update({
        configValue: newValue.toString(),
        updatedBy: userId
      });

      // 记录变更历史
      await ConfigChangeHistory.recordChange(
        config.id,
        'update',
        oldValue,
        newValue,
        userId,
        {
          reason: options.reason,
          source: options.source,
          ipAddress: options.ipAddress,
          userAgent: options.userAgent
        }
      );

      // 清除缓存
      this.clearCache(category, configKey, options.environment || 'all');

      // 触发配置变更事件
      await this.triggerConfigChangeEvent(category, configKey, oldValue, newValue);

      logger.info(`配置已更新: ${category}.${configKey} = ${newValue} by ${userId}`);

      return {
        success: true,
        config: {
          category,
          configKey,
          oldValue,
          newValue,
          updatedAt: config.updated_at
        }
      };
    } catch (error) {
      logger.error('更新配置失败:', error);
      throw error;
    }
  }

  /**
   * 批量更新配置
   * @param {Array} updates - 更新列表
   * @param {string} userId - 用户ID
   * @param {object} options - 选项
   * @returns {Promise<object>} 批量更新结果
   */
  async batchUpdateConfigs(updates, userId, options = {}) {
    const results = [];
    const errors = [];

    for (const update of updates) {
      try {
        const result = await this.updateConfig(
          update.category,
          update.configKey,
          update.newValue,
          userId,
          { ...options, reason: update.reason }
        );
        results.push({ ...update, status: 'success', result });
      } catch (error) {
        errors.push({ ...update, status: 'error', error: error.message });
      }
    }

    return {
      success: errors.length === 0,
      results,
      errors,
      summary: {
        total: updates.length,
        successful: results.length,
        failed: errors.length
      }
    };
  }

  /**
   * 获取分类下的所有配置
   * @param {string} category - 配置分类
   * @param {string} environment - 环境
   * @returns {Promise<Array>} 配置列表
   */
  async getConfigsByCategory(category, environment = 'all') {
    try {
      const configs = await SystemConfig.getByCategory(category, environment);

      return configs.map(config => ({
        id: config.id,
        category: config.category,
        configKey: config.configKey,
        configValue: config.getParsedValue(),
        dataType: config.dataType,
        description: config.description,
        isSensitive: config.isSensitive,
        isEditable: config.isEditable,
        validationRules: config.validationRules,
        defaultValue: config.defaultValue,
        environment: config.environment,
        updatedAt: config.updated_at
      }));
    } catch (error) {
      logger.error('获取分类配置失败:', error);
      throw error;
    }
  }

  /**
   * 获取配置变更历史
   * @param {string} configId - 配置ID
   * @param {number} limit - 限制数量
   * @returns {Promise<Array>} 变更历史
   */
  async getConfigHistory(configId, limit = 50) {
    try {
      return await ConfigChangeHistory.getHistory(configId, limit);
    } catch (error) {
      logger.error('获取配置历史失败:', error);
      throw error;
    }
  }

  /**
   * 验证配置值
   * @param {string} category - 配置分类
   * @param {string} configKey - 配置键名
   * @param {any} value - 值
   * @returns {Promise<object>} 验证结果
   */
  async validateConfig(category, configKey, value) {
    try {
      const config = await SystemConfig.getByKey(category, configKey);

      if (!config) {
        return { valid: false, error: '配置项不存在' };
      }

      return config.validateValue(value);
    } catch (error) {
      logger.error('验证配置失败:', error);
      return { valid: false, error: '验证失败' };
    }
  }

  /**
   * 获取所有配置分类
   * @returns {Promise<Array>} 分类列表
   */
  async getCategories() {
    try {
      return await ConfigCategory.getActiveCategories();
    } catch (error) {
      logger.error('获取配置分类失败:', error);
      throw error;
    }
  }

  /**
   * 获取分类树形结构
   * @returns {Promise<Array>} 分类树
   */
  async getCategoryTree() {
    try {
      return await ConfigCategory.getCategoryTree();
    } catch (error) {
      logger.error('获取分类树失败:', error);
      throw error;
    }
  }

  /**
   * 检查缓存是否有效
   * @param {string} cacheKey - 缓存键
   * @returns {boolean} 是否有效
   */
  isValidCache(cacheKey) {
    if (!this.configCache.has(cacheKey)) {
      return false;
    }

    const expiry = this.cacheExpiry.get(cacheKey);
    if (!expiry || Date.now() > expiry) {
      this.configCache.delete(cacheKey);
      this.cacheExpiry.delete(cacheKey);
      return false;
    }

    return true;
  }

  /**
   * 更新缓存
   * @param {string} cacheKey - 缓存键
   * @param {any} value - 值
   */
  updateCache(cacheKey, value) {
    this.configCache.set(cacheKey, value);
    this.cacheExpiry.set(cacheKey, Date.now() + this.cacheTTL);
  }

  /**
   * 清除缓存
   * @param {string} category - 配置分类
   * @param {string} configKey - 配置键名
   * @param {string} environment - 环境
   */
  clearCache(category, configKey, environment) {
    const cacheKey = `${category}:${configKey}:${environment}`;
    this.configCache.delete(cacheKey);
    this.cacheExpiry.delete(cacheKey);
  }

  /**
   * 清除所有缓存
   */
  clearAllCache() {
    this.configCache.clear();
    this.cacheExpiry.clear();
  }

  /**
   * 触发配置变更事件
   * @param {string} category - 配置分类
   * @param {string} configKey - 配置键名
   * @param {any} oldValue - 旧值
   * @param {any} newValue - 新值
   */
  async triggerConfigChangeEvent(category, configKey, oldValue, newValue) {
    try {
      // 这里可以添加配置变更的事件处理
      // 例如：通知其他服务、重新加载配置等

      logger.info(`配置变更事件: ${category}.${configKey}`, {
        oldValue,
        newValue,
        timestamp: new Date().toISOString()
      });

      // 特殊配置的处理
      await this.handleSpecialConfigChange(category, configKey, newValue);
    } catch (error) {
      logger.error('处理配置变更事件失败:', error);
    }
  }

  /**
   * 处理特殊配置变更
   * @param {string} category - 配置分类
   * @param {string} configKey - 配置键名
   * @param {any} newValue - 新值
   */
  async handleSpecialConfigChange(category, configKey, newValue) {
    // 队列配置变更
    if (category === 'queue') {
      // 通知队列调度器重新加载配置
      // 这里可以发送事件或调用相关服务
    }

    // 邮件配置变更
    if (category === 'email') {
      // 重新初始化邮件服务配置
    }

    // 监控配置变更
    if (category === 'monitoring') {
      // 更新监控阈值和规则
    }
  }
}

module.exports = new ConfigManagerService(); 