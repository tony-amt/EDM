const fetch = (...args) => import('node-fetch').then(mod => mod.default(...args));
const config = require('../../config');
const logger = require('../../utils/logger');

/**
 * 邮件服务类 - 封装极光邮件API
 */
class MailService {
  /**
   * 构造函数
   * @param {Object} serviceConfig - 邮件服务配置对象（可选，使用EmailService实例的配置）
   */
  constructor(serviceConfig = null) {
    logger.info(`[DEBUG] MailService构造函数调用，serviceConfig: ${JSON.stringify(serviceConfig)}`);
    
    if (serviceConfig) {
      // 使用传入的服务配置（从EmailService实例）
      // 🔧 字段映射：api_key -> API_USER, api_secret -> API_KEY（适配EngageLab API要求）
      this.apiUser = serviceConfig.api_key; // EngageLab的API_USER
      this.apiKey = serviceConfig.api_secret; // EngageLab的API_KEY
      this.baseUrl = config.engagelab.baseUrl || 'https://api.engagelab.com/v1';
      this.domain = serviceConfig.domain;
      this.serviceName = serviceConfig.name;
      
      logger.info(`[DEBUG] 使用服务配置 - apiUser: ${this.apiUser}, apiKey: ${this.apiKey ? this.apiKey.substring(0, 8) + '***' : 'null'}, domain: ${this.domain}`);
    } else {
      // 使用全局配置（向后兼容）
      this.apiUser = config.engagelab.apiUser;
      this.apiKey = config.engagelab.apiKey;
      this.baseUrl = config.engagelab.baseUrl;
      
      logger.info(`[DEBUG] 使用全局配置 - apiUser: ${this.apiUser}, apiKey: ${this.apiKey ? this.apiKey.substring(0, 8) + '***' : 'null'}`);
    }

    logger.info(`[DEBUG] 最终配置检查 - apiUser: "${this.apiUser}", apiKey存在: ${!!this.apiKey}, baseUrl: ${this.baseUrl}`);

    if (!this.apiUser || !this.apiKey) {
      logger.warn('EngageLab API User 或 API Key 未配置，MailService 可能无法正常工作。');
      logger.warn(`[DEBUG] apiUser: "${this.apiUser}", apiKey长度: ${this.apiKey ? this.apiKey.length : 0}`);
      this.auth = ''; // 确保 auth 在未配置时为空字符串
    } else {
      // EngageLab API 使用 Basic Auth：API_USER:API_KEY
      this.auth = Buffer.from(`${this.apiUser}:${this.apiKey}`).toString('base64');
      logger.info(`[DEBUG] Auth字符串已生成，长度: ${this.auth.length}, 前10位: ${this.auth.substring(0, 10)}...`);
    }
  }

  /**
   * 发送邮件 - 增强版本，包含完整的调用日志
   * @param {Object} mailOptions - 邮件选项
   * @returns {Promise<Object>} 发送结果
   */
  async sendMail(mailOptions) {
    const requestId = mailOptions.request_id || `mail_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    
    // 记录请求开始
    logger.info(`📤 [${requestId}] 开始发送邮件`, {
      requestId,
      service: this.serviceName || 'EngageLab',
      domain: this.domain,
      apiUser: this.apiUser,
      baseUrl: this.baseUrl,
      to: mailOptions.to,
      subject: mailOptions.body?.subject,
      timestamp: new Date().toISOString()
    });

    if (!this.auth) {
      const errorMsg = '邮件服务未配置API凭证，无法发送邮件。';
      logger.error(`❌ [${requestId}] ${errorMsg}`);
      throw new Error(errorMsg);
    }

    let response = null;
    let responseText = null;
    let responseData = null;

    try {
      // 记录请求详情
      logger.info(`🔗 [${requestId}] 发送API请求`, {
        requestId,
        url: `${this.baseUrl}/mail/send`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${this.auth.substring(0, 20)}...`
        },
        bodySize: JSON.stringify(mailOptions).length,
        mailOptions: {
          from: mailOptions.from,
          to: mailOptions.to,
          subject: mailOptions.body?.subject,
          customArgs: mailOptions.custom_args,
          requestId: mailOptions.request_id
        }
      });

      // 发送请求
      response = await fetch(`${this.baseUrl}/mail/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${this.auth}`
        },
        body: JSON.stringify(mailOptions)
      });

      // 获取响应文本
      responseText = await response.text();
      const duration = Date.now() - startTime;

      // 记录响应详情
      logger.info(`📥 [${requestId}] 收到API响应`, {
        requestId,
        statusCode: response.status,
        statusText: response.statusText,
        duration: `${duration}ms`,
        responseSize: responseText.length,
        headers: Object.fromEntries(response.headers.entries()),
        timestamp: new Date().toISOString()
      });

      // 解析响应数据
      try {
        responseData = JSON.parse(responseText);
      } catch (parseError) {
        logger.warn(`⚠️ [${requestId}] 响应不是有效JSON`, {
          requestId,
          parseError: parseError.message,
          rawResponse: responseText.substring(0, 500)
        });
        responseData = { rawResponse: responseText };
      }

      // 记录完整响应数据
      logger.info(`📊 [${requestId}] 完整响应数据`, {
        requestId,
        responseData,
        timestamp: new Date().toISOString()
      });

      if (!response.ok) {
        const errorMsg = `邮件发送API错误: ${responseData.message || response.statusText || '未知错误'}`;
        logger.error(`❌ [${requestId}] 邮件发送失败`, {
          requestId,
          statusCode: response.status,
          error: errorMsg,
          responseData,
          duration: `${duration}ms`
        });
        throw new Error(errorMsg);
      }
      
      logger.info(`✅ [${requestId}] 邮件发送成功`, {
        requestId,
        statusCode: response.status,
        responseData,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString()
      });

      // 返回增强的响应数据
      return {
        ...responseData,
        _metadata: {
          requestId,
          duration,
          statusCode: response.status,
          timestamp: new Date().toISOString(),
          service: this.serviceName || 'EngageLab',
          domain: this.domain
        }
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error(`💥 [${requestId}] 邮件发送异常`, {
        requestId,
        error: error.message,
        stack: error.stack,
        duration: `${duration}ms`,
        responseStatus: response?.status,
        responseText: responseText?.substring(0, 500),
        timestamp: new Date().toISOString()
      });

      // 抛出增强的错误信息
      const enhancedError = new Error(error.message);
      enhancedError.requestId = requestId;
      enhancedError.duration = duration;
      enhancedError.responseStatus = response?.status;
      enhancedError.responseData = responseData;
      throw enhancedError;
    }
  }

  /**
   * 构建邮件选项
   * @param {Object} options - 邮件配置选项
   * @returns {Object} 格式化的邮件选项
   */
  buildMailOptions({
    from,
    to,
    cc = [],
    bcc = [],
    replyTo = [],
    subject,
    html,
    text = '',
    previewText = '',
    variables = {},
    attachments = [],
    labelId = '',
    labelName = '',
    headers = {},
    sendMode = 0,
    openTracking = true,
    clickTracking = true,
    unsubscribeTracking = true,
    customArgs = {},
    requestId = '',
  }) {
    return {
      from,
      to: Array.isArray(to) ? to : [to],
      body: {
        cc: Array.isArray(cc) ? cc : [],
        bcc: Array.isArray(bcc) ? bcc : [],
        reply_to: Array.isArray(replyTo) ? replyTo : [],
        subject,
        content: {
          html,
          text,
          preview_text: previewText,
        },
        vars: variables,
        label_id: labelId,
        label_name: labelName,
        headers,
        attachments,
        settings: {
          send_mode: sendMode,
          return_email_id: true,
          sandbox: false,
          notification: false,
          open_tracking: openTracking,
          click_tracking: clickTracking,
          unsubscribe_tracking: unsubscribeTracking,
        },
      },
      custom_args: customArgs,
      request_id: requestId,
    };
  }

  /**
   * 测试API连接 - 发送实际测试邮件
   * @returns {Promise<{success: boolean, error?: string, response?: any, statusCode?: number}>} 详细的测试结果
   */
  async testConnection() {
    if (!this.auth) {
      const errorMsg = '邮件服务未配置API凭证，无法测试连接。';
      logger.warn(errorMsg);
      return { success: false, error: errorMsg };
    }
    
    try {
      // 发送测试邮件到指定邮箱
      logger.info(`发送测试邮件: ${this.baseUrl}/mail/send`);
      logger.info(`API认证: API_USER=${this.apiUser}, API_KEY=${this.apiKey ? this.apiKey.substring(0, 8) + '***' : 'null'}`);
      
      const testEmailData = {
        from: `EDM系统测试 <noreply@${this.domain}>`,
        to: ['376101593@qq.com'],
        body: {
          subject: "EDM邮件服务连接测试",
          content: {
            html: `
              <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
                <div style="background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  <h2 style="color: #333; margin-bottom: 20px;">📧 EDM邮件服务测试成功</h2>
                  <p style="color: #666; line-height: 1.6;">
                    您好！这是一封来自EDM系统的测试邮件。
                  </p>
                  <div style="background-color: #f8f9fa; padding: 15px; border-radius: 4px; margin: 20px 0;">
                    <p style="margin: 0; color: #495057;"><strong>服务信息：</strong></p>
                    <p style="margin: 5px 0; color: #6c757d;">• 发信域名: ${this.domain}</p>
                    <p style="margin: 5px 0; color: #6c757d;">• 服务提供商: EngageLab</p>
                    <p style="margin: 5px 0; color: #6c757d;">• 测试时间: ${new Date().toLocaleString('zh-CN')}</p>
                  </div>
                  <p style="color: #28a745; font-weight: bold;">
                    ✅ 如果您收到这封邮件，说明邮件服务配置正确，可以正常发送邮件。
                  </p>
                  <hr style="border: none; border-top: 1px solid #e9ecef; margin: 20px 0;">
                  <p style="color: #999; font-size: 12px;">
                    这是系统自动发送的测试邮件，请勿回复。
                  </p>
                </div>
              </div>
            `,
            text: `EDM邮件服务测试成功\n\n您好！这是一封来自EDM系统的测试邮件。\n\n服务信息：\n• 发信域名: ${this.domain}\n• 服务提供商: EngageLab\n• 测试时间: ${new Date().toLocaleString('zh-CN')}\n\n✅ 如果您收到这封邮件，说明邮件服务配置正确，可以正常发送邮件。`
          },
          settings: {
            send_mode: 0,
            return_email_id: true,
            sandbox: false
          }
        }
      };

      logger.info(`发送的测试邮件数据: ${JSON.stringify(testEmailData, null, 2)}`);

      const response = await fetch(`${this.baseUrl}/mail/send`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${this.auth}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testEmailData)
      });

      const responseText = await response.text();
      logger.info(`测试邮件发送响应状态: ${response.status}`);
      logger.info(`测试邮件发送响应头: ${JSON.stringify([...response.headers])}`);
      logger.info(`测试邮件发送完整响应内容: ${responseText}`);

      let responseData = null;
      try {
        responseData = JSON.parse(responseText);
      } catch (parseError) {
        logger.warn(`响应内容不是有效JSON: ${parseError.message}`);
        responseData = { rawResponse: responseText };
      }

      if (response.status >= 200 && response.status < 300) {
        logger.info('测试邮件发送成功');
        return { 
          success: true, 
          response: responseData,
          statusCode: response.status
        };
      } else {
        const errorMsg = `测试邮件发送失败，状态码: ${response.status}`;
        logger.error(`${errorMsg}, 响应: ${responseText}`);
        return { 
          success: false, 
          error: errorMsg,
          response: responseData,
          statusCode: response.status,
          rawResponse: responseText
        };
      }
      
    } catch (error) {
      const errorMsg = `测试邮件发送异常: ${error.message}`;
      logger.error(errorMsg);
      logger.error(`异常堆栈: ${error.stack}`);
      return { 
        success: false, 
        error: errorMsg,
        exception: error.message,
        stack: error.stack
      };
    }
  }
}

module.exports = MailService; 