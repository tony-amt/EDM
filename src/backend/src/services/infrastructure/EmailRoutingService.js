const { EmailService, UserServiceMapping, ServiceStatusLog } = require('../../models');
const db = require('../../models');
const { sequelize, Sequelize } = db;
const { Op } = Sequelize;

class EmailRoutingService {
  constructor() {
    this.lastUsedServiceIndex = new Map(); // 每个用户的轮询索引
  }

  /**
   * 智能路由选择发信服务
   * @param {string} userId - 用户ID
   * @param {number} requiredQuota - 需要的额度
   * @returns {Promise<Object|null>} 选中的服务或null
   */
  async selectEmailService(userId, requiredQuota = 1) {
    try {
      // 1. 获取用户可用的发信服务
      const availableServices = await this.getUserAvailableServices(userId);
      
      if (availableServices.length === 0) {
        console.warn(`用户 ${userId} 没有可用的发信服务`);
        return null;
      }

      // 2. 按优先级过滤和排序服务
      const prioritizedServices = this.prioritizeServices(availableServices);

      // 3. 多层轮询选择服务
      const selectedService = this.selectServiceWithRotation(userId, prioritizedServices, requiredQuota);

      if (!selectedService) {
        console.warn(`用户 ${userId} 的所有服务都不满足额度要求 ${requiredQuota}`);
        return null;
      }

      // 4. 预扣减服务额度
      const quotaDeducted = await this.preDeductServiceQuota(selectedService.id, requiredQuota);
      
      if (!quotaDeducted) {
        console.warn(`服务 ${selectedService.id} 额度预扣减失败`);
        
        // 标记服务失败并重试其他服务
        await this.markServiceFailure(selectedService.id, 'Quota deduction failed');
        
        // 递归重试（避免无限循环）
        const remainingServices = prioritizedServices.filter(s => s.id !== selectedService.id);
        if (remainingServices.length > 0) {
          return this.selectEmailService(userId, requiredQuota);
        }
        
        return null;
      }

      console.log(`为用户 ${userId} 选择了服务：${selectedService.name} (${selectedService.id})`);
      
      return {
        ...selectedService,
        allocated_quota: requiredQuota
      };

    } catch (error) {
      console.error('选择发信服务失败:', error);
      return null;
    }
  }

  /**
   * 获取用户可用的发信服务
   * @param {string} userId - 用户ID
   * @returns {Promise<Array>} 可用服务列表
   */
  async getUserAvailableServices(userId) {
    const services = await EmailService.findAll({
      include: [
        {
          model: UserServiceMapping,
          as: 'userMappings',
          where: {
            user_id: userId,
            is_active: true
          },
          required: true
        }
      ],
      where: {
        is_enabled: true,
        is_frozen: false,
        [Op.or]: [
          { frozen_until: null },
          { frozen_until: { [Op.lt]: new Date() } }
        ]
      },
      order: [['sending_rate', 'DESC']] // 优先选择发送速率高的服务
    });

    return services.map(service => ({
      id: service.id,
      name: service.name,
      provider: service.provider,
      domain: service.domain,
      daily_quota: service.daily_quota,
      used_quota: service.used_quota,
      available_quota: service.daily_quota - service.used_quota,
      sending_rate: service.sending_rate,
      consecutive_failures: service.consecutive_failures,
      api_key: service.api_key,
      api_secret: service.api_secret
    }));
  }

  /**
   * 服务优先级排序
   * @param {Array} services - 服务列表
   * @returns {Array} 排序后的服务列表
   */
  prioritizeServices(services) {
    return services
      .filter(service => service.available_quota > 0) // 过滤掉额度用完的服务
      .sort((a, b) => {
        // 1. 优先级：失败次数少的服务
        if (a.consecutive_failures !== b.consecutive_failures) {
          return a.consecutive_failures - b.consecutive_failures;
        }

        // 2. 优先级：剩余额度比例高的服务
        const aUsageRate = a.used_quota / a.daily_quota;
        const bUsageRate = b.used_quota / b.daily_quota;
        
        if (Math.abs(aUsageRate - bUsageRate) > 0.1) {
          return aUsageRate - bUsageRate;
        }

        // 3. 优先级：发送速率高的服务
        return b.sending_rate - a.sending_rate;
      });
  }

  /**
   * 多层轮询选择服务
   * @param {string} userId - 用户ID
   * @param {Array} services - 优先级排序的服务列表
   * @param {number} requiredQuota - 需要的额度
   * @returns {Object|null} 选中的服务
   */
  selectServiceWithRotation(userId, services, requiredQuota) {
    if (services.length === 0) return null;

    // 过滤出满足额度要求的服务
    const suitableServices = services.filter(service => 
      service.available_quota >= requiredQuota
    );

    if (suitableServices.length === 0) return null;

    // 获取用户上次使用的服务索引
    const lastIndex = this.lastUsedServiceIndex.get(userId) || 0;
    
    // 轮询选择下一个服务
    const nextIndex = (lastIndex + 1) % suitableServices.length;
    const selectedService = suitableServices[nextIndex];

    // 更新轮询索引
    this.lastUsedServiceIndex.set(userId, nextIndex);

    return selectedService;
  }

  /**
   * 预扣减服务额度
   * @param {string} serviceId - 服务ID
   * @param {number} amount - 扣减数量
   * @returns {Promise<boolean>} 是否成功
   */
  async preDeductServiceQuota(serviceId, amount) {
    try {
      // 先查询当前额度
      const service = await EmailService.findByPk(serviceId);
      if (!service) {
        console.error('服务不存在:', serviceId);
        return false;
      }

      // 检查额度是否足够
      if (service.used_quota + amount > service.daily_quota) {
        console.warn(`服务 ${serviceId} 额度不足: ${service.used_quota}/${service.daily_quota}, 需要: ${amount}`);
        return false;
      }

      // 更新额度
      const updatedService = await service.update({
        used_quota: service.used_quota + amount
      });

      console.log(`服务 ${serviceId} 额度扣减成功: ${service.used_quota} -> ${updatedService.used_quota}`);
      return true;
    } catch (error) {
      console.error('预扣减服务额度失败:', error);
      return false;
    }
  }

  /**
   * 标记服务失败
   * @param {string} serviceId - 服务ID
   * @param {string} reason - 失败原因
   */
  async markServiceFailure(serviceId, reason = 'Service failure') {
    try {
      // 简化实现：增加连续失败次数
      await sequelize.query(
        'UPDATE email_services SET consecutive_failures = consecutive_failures + 1 WHERE id = :serviceId',
        {
          replacements: { serviceId },
          type: sequelize.QueryTypes.UPDATE
        }
      );
      
      console.log(`服务 ${serviceId} 失败计数已增加，原因: ${reason}`);
    } catch (error) {
      console.error('标记服务失败错误:', error);
    }
  }

  /**
   * 重置服务失败计数
   * @param {string} serviceId - 服务ID
   */
  async resetServiceFailures(serviceId) {
    try {
      await sequelize.query(
        'UPDATE email_services SET consecutive_failures = 0 WHERE id = :serviceId',
        {
          replacements: { serviceId },
          type: sequelize.QueryTypes.UPDATE
        }
      );
      
      console.log(`服务 ${serviceId} 失败计数已重置`);
    } catch (error) {
      console.error('重置服务失败计数错误:', error);
    }
  }

  /**
   * 检查服务健康状态
   * @param {string} serviceId - 服务ID
   * @returns {Promise<Object>} 健康状态信息
   */
  async checkServiceHealth(serviceId) {
    try {
      const service = await EmailService.findByPk(serviceId);
      
      if (!service) {
        return { healthy: false, reason: 'Service not found' };
      }

      const checks = {
        enabled: service.is_enabled,
        not_frozen: !service.is_frozen,
        has_quota: service.used_quota < service.daily_quota,
        low_failures: service.consecutive_failures < 3
      };

      const healthy = Object.values(checks).every(check => check);

      return {
        healthy,
        checks,
        service: {
          id: service.id,
          name: service.name,
          usage_rate: (service.used_quota / service.daily_quota * 100).toFixed(2) + '%',
          consecutive_failures: service.consecutive_failures
        }
      };
    } catch (error) {
      console.error('检查服务健康状态失败:', error);
      return { healthy: false, reason: 'Health check failed' };
    }
  }

  /**
   * 获取路由统计信息
   * @param {string} userId - 用户ID (可选)
   * @returns {Promise<Object>} 统计信息
   */
  async getRoutingStats(userId = null) {
    try {
      let whereCondition = {
        is_enabled: true
      };

      if (userId) {
        // 获取特定用户的服务使用统计
        whereCondition.id = {
          [Op.in]: sequelize.literal(`
            (SELECT service_id FROM user_service_mappings 
             WHERE user_id = '${userId}' AND is_active = true)
          `)
        };
      }

      const services = await EmailService.findAll({
        where: whereCondition,
        attributes: [
          'id', 'name', 'daily_quota', 'used_quota', 
          'is_frozen', 'consecutive_failures'
        ]
      });

      const stats = {
        total_services: services.length,
        available_services: services.filter(s => !s.is_frozen && s.used_quota < s.daily_quota).length,
        frozen_services: services.filter(s => s.is_frozen).length,
        total_quota: services.reduce((sum, s) => sum + s.daily_quota, 0),
        used_quota: services.reduce((sum, s) => sum + s.used_quota, 0),
        services_detail: services.map(s => ({
          id: s.id,
          name: s.name,
          usage_rate: ((s.used_quota / s.daily_quota) * 100).toFixed(2) + '%',
          status: s.is_frozen ? 'frozen' : (s.used_quota >= s.daily_quota ? 'quota_full' : 'available'),
          failures: s.consecutive_failures
        }))
      };

      stats.overall_usage_rate = stats.total_quota > 0 ? 
        ((stats.used_quota / stats.total_quota) * 100).toFixed(2) + '%' : '0%';

      return stats;
    } catch (error) {
      console.error('获取路由统计失败:', error);
      return null;
    }
  }
}

module.exports = new EmailRoutingService(); 