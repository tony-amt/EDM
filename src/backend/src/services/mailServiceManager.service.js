const { EmailService } = require('../models/index');
const MailService = require('./third-party/mail.service');
const logger = require('../utils/logger');

/**
 * 邮件服务管理器 - 管理多个邮件服务实例
 */
class MailServiceManager {
  constructor() {
    this.serviceClients = new Map();
  }

  /**
   * 根据服务ID获取或创建邮件服务客户端
   * @param {string} serviceId - 邮件服务ID
   * @returns {Promise<MailService>} 邮件服务客户端
   */
  async getMailServiceClient(serviceId) {
    // 如果已有缓存的客户端，直接返回
    if (this.serviceClients.has(serviceId)) {
      return this.serviceClients.get(serviceId);
    }

    try {
      // 从数据库获取邮件服务配置
      const emailService = await EmailService.findByPk(serviceId);
      
      if (!emailService) {
        throw new Error(`邮件服务不存在：${serviceId}`);
      }

      if (!emailService.is_enabled) {
        throw new Error(`邮件服务已禁用：${emailService.name}`);
      }

      if (emailService.is_frozen) {
        throw new Error(`邮件服务已冻结：${emailService.name}`);
      }

      // 创建MailService实例，传入服务配置
      const mailClient = new MailService({
        api_key: emailService.api_key,
        api_secret: emailService.api_secret,
        domain: emailService.domain,
        name: emailService.name
      });

      // 缓存客户端
      this.serviceClients.set(serviceId, {
        client: mailClient,
        service: emailService
      });

      logger.info(`邮件服务客户端创建成功：${emailService.name} (${serviceId})`);
      
      return {
        client: mailClient,
        service: emailService
      };
    } catch (error) {
      logger.error(`创建邮件服务客户端失败：${error.message}`);
      throw error;
    }
  }

  /**
   * 获取默认的邮件服务客户端（第一个启用的服务）
   * @returns {Promise<MailService>} 默认邮件服务客户端
   */
  async getDefaultMailServiceClient() {
    try {
      const defaultService = await EmailService.findOne({
        where: {
          is_enabled: true,
          is_frozen: false
        },
        order: [['created_at', 'ASC']]
      });

      if (!defaultService) {
        throw new Error('没有可用的邮件服务');
      }

      return this.getMailServiceClient(defaultService.id);
    } catch (error) {
      logger.error(`获取默认邮件服务失败：${error.message}`);
      throw error;
    }
  }

  /**
   * 测试邮件服务连接
   * @param {string} serviceId - 邮件服务ID
   * @returns {Promise<boolean>} 连接测试结果
   */
  async testServiceConnection(serviceId) {
    try {
      const { client } = await this.getMailServiceClient(serviceId);
      return await client.testConnection();
    } catch (error) {
      logger.error(`测试邮件服务连接失败：${error.message}`);
      return false;
    }
  }

  /**
   * 清除缓存的服务客户端
   * @param {string} serviceId - 邮件服务ID（可选，不传则清除所有）
   */
  clearCache(serviceId = null) {
    if (serviceId) {
      this.serviceClients.delete(serviceId);
      logger.info(`已清除邮件服务缓存：${serviceId}`);
    } else {
      this.serviceClients.clear();
      logger.info('已清除所有邮件服务缓存');
    }
  }

  /**
   * 获取所有可用的邮件服务
   * @returns {Promise<Array>} 可用的邮件服务列表
   */
  async getAvailableServices() {
    try {
      return await EmailService.findAll({
        where: {
          is_enabled: true,
          is_frozen: false
        },
        order: [['created_at', 'ASC']]
      });
    } catch (error) {
      logger.error(`获取可用邮件服务失败：${error.message}`);
      throw error;
    }
  }
}

// 导出单例实例
module.exports = new MailServiceManager(); 