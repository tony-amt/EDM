const AlertRules = require('../../models/index');
const AlertHistory = require('../../models/index');
const SystemPerformanceMetrics = require('../../models/index');

/**
 * 告警管理服务
 * 负责告警规则管理、告警检测和通知发送
 */
class AlertManagerService {
  constructor() {
    this.alertingEnabled = true;
    this.checkInterval = 60 * 1000; // 1分钟检查一次
    this.activeAlerts = new Map(); // 缓存活跃告警
    this.suppressedAlerts = new Set(); // 抑制的告警
    this.notificationHandlers = new Map();

    // 初始化通知处理器
    this.initializeNotificationHandlers();
  }

  /**
   * 启动告警管理服务
   */
  async start() {
    console.log('🚨 告警管理服务启动');

    // 初始化默认告警规则
    await this.initializeDefaultRules();

    // 加载活跃告警到缓存
    await this.loadActiveAlerts();

    // 启动定期检查定时器
    this.alertCheckTimer = setInterval(() => {
      this.checkAllAlerts().catch(error => {
        console.error('检查告警时出错:', error);
      });
    }, this.checkInterval);

    console.log('✅ 告警管理服务已启动');
  }

  /**
   * 停止告警管理服务
   */
  stop() {
    console.log('🛑 告警管理服务停止');

    if (this.alertCheckTimer) {
      clearInterval(this.alertCheckTimer);
    }
  }

  /**
   * 初始化通知处理器
   */
  initializeNotificationHandlers() {
    // 邮件通知处理器
    this.notificationHandlers.set('email', async (config, alertData) => {
      try {
        // 这里应该集成实际的邮件发送服务
        console.log(`📧 发送邮件告警通知:`, {
          recipients: config.recipients,
          subject: `[${alertData.severity.toUpperCase()}] ${alertData.rule_name}`,
          message: alertData.message
        });

        // 模拟邮件发送
        return { success: true, method: 'email' };
      } catch (error) {
        console.error('发送邮件告警失败:', error);
        return { success: false, method: 'email', error: error.message };
      }
    });

    // Webhook通知处理器
    this.notificationHandlers.set('webhook', async (config, alertData) => {
      try {
        // 这里应该集成实际的HTTP请求库
        console.log(`🔗 发送Webhook告警通知:`, {
          url: config.url,
          payload: alertData
        });

        // 模拟Webhook发送
        return { success: true, method: 'webhook' };
      } catch (error) {
        console.error('发送Webhook告警失败:', error);
        return { success: false, method: 'webhook', error: error.message };
      }
    });

    // Slack通知处理器
    this.notificationHandlers.set('slack', async (config, alertData) => {
      try {
        console.log(`💬 发送Slack告警通知:`, {
          channel: config.channel,
          message: `🚨 *${alertData.severity.toUpperCase()}* ${alertData.rule_name}\n${alertData.message}`
        });

        // 模拟Slack发送
        return { success: true, method: 'slack' };
      } catch (error) {
        console.error('发送Slack告警失败:', error);
        return { success: false, method: 'slack', error: error.message };
      }
    });
  }

  /**
   * 初始化默认告警规则
   */
  async initializeDefaultRules() {
    try {
      const results = await AlertRules.initializeDefaultRules();
      const createdCount = results.filter(r => r.created).length;
      console.log(`📋 初始化告警规则完成，新创建 ${createdCount} 个规则`);
      return results;
    } catch (error) {
      console.error('初始化默认告警规则失败:', error);
      return [];
    }
  }

  /**
   * 加载活跃告警到缓存
   */
  async loadActiveAlerts() {
    try {
      const activeAlerts = await AlertHistory.getActiveAlerts();
      this.activeAlerts.clear();

      activeAlerts.forEach(alert => {
        this.activeAlerts.set(alert.id, {
          id: alert.id,
          rule_id: alert.rule_id,
          triggered_at: alert.triggered_at,
          trigger_value: alert.trigger_value,
          rule_name: alert.alert_rule?.name || 'Unknown',
          severity: alert.alert_rule?.severity || 'warning'
        });
      });

      console.log(`💾 加载了 ${activeAlerts.length} 个活跃告警到缓存`);
    } catch (error) {
      console.error('加载活跃告警失败:', error);
    }
  }

  /**
   * 检查指定指标是否触发告警
   */
  async checkMetric(metricName, metricValue, metadata = {}) {
    if (!this.alertingEnabled) return;

    try {
      // 获取该指标的所有活跃规则
      const rules = await AlertRules.getRulesByMetric(metricName);

      for (const rule of rules) {
        const isTriggered = rule.checkCondition(metricValue);

        if (isTriggered) {
          await this.handleTriggeredAlert(rule, metricValue, metadata);
        }
      }
    } catch (error) {
      console.error(`检查指标 ${metricName} 告警时出错:`, error);
    }
  }

  /**
   * 处理触发的告警
   */
  async handleTriggeredAlert(rule, triggerValue, metadata = {}) {
    try {
      // 检查是否已有活跃告警
      const existingAlert = Array.from(this.activeAlerts.values())
        .find(alert => alert.rule_id === rule.id);

      if (existingAlert) {
        // 更新现有告警的触发值
        console.log(`🔄 更新现有告警: ${rule.name}, 新值: ${triggerValue}`);
        return;
      }

      // 检查是否被抑制
      if (this.suppressedAlerts.has(rule.id)) {
        console.log(`🔇 告警被抑制: ${rule.name}`);
        return;
      }

      // 创建新告警
      const message = this.generateAlertMessage(rule, triggerValue, metadata);
      const alert = await AlertHistory.createAlert(rule.id, triggerValue, message, metadata);

      // 添加到活跃告警缓存
      this.activeAlerts.set(alert.id, {
        id: alert.id,
        rule_id: rule.id,
        triggered_at: alert.triggered_at,
        trigger_value: triggerValue,
        rule_name: rule.name,
        severity: rule.severity
      });

      console.log(`🚨 新告警触发: ${rule.name} (${rule.severity}), 值: ${triggerValue}`);

      // 发送通知
      await this.sendNotifications(rule, alert, triggerValue, metadata);

    } catch (error) {
      console.error('处理触发告警时出错:', error);
    }
  }

  /**
   * 生成告警消息
   */
  generateAlertMessage(rule, triggerValue, metadata = {}) {
    const timestamp = new Date().toLocaleString('zh-CN');
    let message = `告警规则: ${rule.name}\n`;
    message += `描述: ${rule.description || '无描述'}\n`;
    message += `触发条件: ${rule.metric_name} ${rule.comparison_operator} ${rule.threshold_value}\n`;
    message += `当前值: ${triggerValue}\n`;
    message += `严重程度: ${rule.severity}\n`;
    message += `触发时间: ${timestamp}\n`;

    // 添加元数据信息
    if (Object.keys(metadata).length > 0) {
      message += `\n额外信息:\n`;
      Object.entries(metadata).forEach(([key, value]) => {
        message += `- ${key}: ${value}\n`;
      });
    }

    return message;
  }

  /**
   * 发送通知
   */
  async sendNotifications(rule, alert, triggerValue, metadata = {}) {
    try {
      const notificationChannels = rule.getNotificationConfig();

      if (notificationChannels.length === 0) {
        console.log(`⚠️  告警规则 ${rule.name} 未配置通知渠道`);
        return;
      }

      const alertData = {
        rule_id: rule.id,
        rule_name: rule.name,
        severity: rule.severity,
        metric_name: rule.metric_name,
        trigger_value: triggerValue,
        threshold_value: rule.threshold_value,
        message: alert.message,
        triggered_at: alert.triggered_at,
        metadata
      };

      const notificationResults = [];

      for (const channel of notificationChannels) {
        try {
          const handler = this.notificationHandlers.get(channel.type);
          if (!handler) {
            console.error(`未知的通知类型: ${channel.type}`);
            continue;
          }

          const result = await handler(channel.config, alertData);
          notificationResults.push(result);

          if (result.success) {
            console.log(`✅ 通知发送成功: ${channel.type}`);
          } else {
            console.error(`❌ 通知发送失败: ${channel.type}, 错误: ${result.error}`);
          }
        } catch (error) {
          console.error(`发送 ${channel.type} 通知时出错:`, error);
          notificationResults.push({
            success: false,
            method: channel.type,
            error: error.message
          });
        }
      }

      // 更新告警记录的通知状态
      await alert.update({
        metadata: {
          ...alert.metadata,
          notifications_sent: notificationResults,
          notification_timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('发送通知时出错:', error);
    }
  }

  /**
   * 检查所有告警规则
   */
  async checkAllAlerts() {
    try {
      const rules = await AlertRules.getActiveRules();

      for (const rule of rules) {
        try {
          await this.checkRuleCondition(rule);
        } catch (error) {
          console.error(`检查规则 ${rule.name} 时出错:`, error);
        }
      }
    } catch (error) {
      console.error('检查所有告警规则时出错:', error);
    }
  }

  /**
   * 检查单个规则条件
   */
  async checkRuleCondition(rule) {
    const timeWindow = new Date(Date.now() - rule.time_window_minutes * 60 * 1000);

    // 获取时间窗口内的最新指标值
    const metrics = await SystemPerformanceMetrics.getMetricsByName(
      rule.metric_name,
      timeWindow,
      new Date()
    );

    if (metrics.length === 0) {
      // 如果是缺失类型的告警，触发告警
      if (rule.condition_type === 'absence') {
        await this.handleTriggeredAlert(rule, null, {
          reason: 'metric_absence',
          time_window_minutes: rule.time_window_minutes
        });
      }
      return;
    }

    // 获取最新的指标值
    const latestMetric = metrics[metrics.length - 1];
    const currentValue = parseFloat(latestMetric.metric_value);

    // 对于变化率类型的告警，需要前一个值
    let previousValue = null;
    if (rule.condition_type === 'rate' && metrics.length > 1) {
      previousValue = parseFloat(metrics[metrics.length - 2].metric_value);
    }

    // 检查条件
    const isTriggered = rule.checkCondition(currentValue, previousValue);

    if (isTriggered) {
      await this.handleTriggeredAlert(rule, currentValue, {
        metric_timestamp: latestMetric.timestamp,
        previous_value: previousValue
      });
    } else {
      // 检查是否有需要解决的告警
      await this.checkForResolution(rule, currentValue);
    }
  }

  /**
   * 检查告警是否应该被解决
   */
  async checkForResolution(rule, currentValue) {
    const activeAlert = Array.from(this.activeAlerts.values())
      .find(alert => alert.rule_id === rule.id);

    if (!activeAlert) return;

    // 简单的解决逻辑：如果当前值不再触发条件，则解决告警
    const isStillTriggered = rule.checkCondition(currentValue);

    if (!isStillTriggered) {
      await this.resolveAlert(activeAlert.id, 'system', '条件不再满足，自动解决');
    }
  }

  /**
   * 解决告警
   */
  async resolveAlert(alertId, resolvedBy = 'system', resolutionMessage = '') {
    try {
      const alert = await AlertHistory.findByPk(alertId);
      if (!alert || alert.status !== 'active') {
        return false;
      }

      await alert.resolve(resolvedBy, resolutionMessage);

      // 从活跃告警缓存中移除
      this.activeAlerts.delete(alertId);

      console.log(`✅ 告警已解决: ${alertId}, 解决者: ${resolvedBy}`);
      return true;
    } catch (error) {
      console.error('解决告警时出错:', error);
      return false;
    }
  }

  /**
   * 抑制告警
   */
  async suppressAlert(alertId, suppressedBy = 'system', reason = '') {
    try {
      const alert = await AlertHistory.findByPk(alertId);
      if (!alert || alert.status !== 'active') {
        return false;
      }

      await alert.suppress(suppressedBy, reason);

      // 从活跃告警缓存中移除
      this.activeAlerts.delete(alertId);

      // 添加到抑制列表
      this.suppressedAlerts.add(alert.rule_id);

      console.log(`🔇 告警已抑制: ${alertId}, 抑制者: ${suppressedBy}`);
      return true;
    } catch (error) {
      console.error('抑制告警时出错:', error);
      return false;
    }
  }

  /**
   * 批量解决告警
   */
  async resolveMultipleAlerts(alertIds, resolvedBy = 'system', resolutionMessage = '') {
    try {
      const count = await AlertHistory.resolveMultipleAlerts(alertIds, resolvedBy, resolutionMessage);

      // 从缓存中移除
      alertIds.forEach(id => this.activeAlerts.delete(id));

      console.log(`✅ 批量解决了 ${count} 个告警`);
      return count;
    } catch (error) {
      console.error('批量解决告警时出错:', error);
      return 0;
    }
  }

  /**
   * 创建告警规则
   */
  async createAlertRule(ruleData) {
    try {
      const rule = await AlertRules.createRule(ruleData);
      console.log(`📋 创建告警规则: ${rule.name}`);
      return rule;
    } catch (error) {
      console.error('创建告警规则时出错:', error);
      throw error;
    }
  }

  /**
   * 更新告警规则
   */
  async updateAlertRule(ruleId, updateData) {
    try {
      const [updatedCount] = await AlertRules.update(updateData, {
        where: { id: ruleId }
      });

      if (updatedCount > 0) {
        console.log(`📝 更新告警规则: ${ruleId}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error('更新告警规则时出错:', error);
      throw error;
    }
  }

  /**
   * 删除告警规则
   */
  async deleteAlertRule(ruleId) {
    try {
      const deletedCount = await AlertRules.destroy({
        where: { id: ruleId }
      });

      if (deletedCount > 0) {
        console.log(`🗑️  删除告警规则: ${ruleId}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error('删除告警规则时出错:', error);
      throw error;
    }
  }

  /**
   * 获取告警统计
   */
  async getAlertStatistics(startTime, endTime) {
    try {
      const stats = await AlertHistory.getAlertStatistics(startTime, endTime);

      // 添加当前活跃告警数量
      stats.current_active_alerts = this.activeAlerts.size;
      stats.suppressed_rules = this.suppressedAlerts.size;

      return stats;
    } catch (error) {
      console.error('获取告警统计时出错:', error);
      return null;
    }
  }

  /**
   * 获取活跃告警列表
   */
  getActiveAlerts() {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * 设置告警配置
   */
  setConfig(config) {
    if (config.enabled !== undefined) {
      this.alertingEnabled = config.enabled;
    }

    if (config.checkInterval !== undefined) {
      this.checkInterval = config.checkInterval;

      // 重启检查定时器
      if (this.alertCheckTimer) {
        clearInterval(this.alertCheckTimer);
        this.alertCheckTimer = setInterval(() => {
          this.checkAllAlerts().catch(error => {
            console.error('检查告警时出错:', error);
          });
        }, this.checkInterval);
      }
    }
  }

  /**
   * 获取当前配置
   */
  getConfig() {
    return {
      alertingEnabled: this.alertingEnabled,
      checkInterval: this.checkInterval,
      activeAlertsCount: this.activeAlerts.size,
      suppressedRulesCount: this.suppressedAlerts.size,
      notificationHandlers: Array.from(this.notificationHandlers.keys())
    };
  }
}

module.exports = AlertManagerService; 