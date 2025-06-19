const express = require('express');
const redis = require('redis');
const { Sequelize, DataTypes } = require('sequelize');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8081;

// 数据库配置
const sequelize = new Sequelize({
  dialect: 'postgres',
  host: process.env.DB_HOST || 'postgres',
  port: process.env.DB_PORT || 5432,
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'amt_mail_system',
  logging: false
});

// Redis配置
const redisClient = redis.createClient({
  url: `redis://${process.env.REDIS_HOST || 'redis'}:${process.env.REDIS_PORT || 6379}`
});

// 1x1 透明像素图片 (base64编码)
const TRACKING_PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);

/**
 * 邮件追踪记录模型
 */
const EmailTracking = sequelize.define('EmailTracking', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  message_id: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '邮件消息ID'
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '接收者邮箱'
  },
  tracking_type: {
    type: DataTypes.ENUM('open', 'click', 'bounce', 'delivered', 'complained'),
    allowNull: false,
    comment: '追踪类型'
  },
  ip_address: {
    type: DataTypes.INET,
    comment: 'IP地址'
  },
  user_agent: {
    type: DataTypes.TEXT,
    comment: '用户代理'
  },
  referer: {
    type: DataTypes.STRING,
    comment: '来源页面'
  },
  timestamp: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    comment: '追踪时间'
  },
  additional_data: {
    type: DataTypes.JSONB,
    comment: '额外数据'
  }
}, {
  tableName: 'email_tracking',
  indexes: [
    { fields: ['message_id'] },
    { fields: ['email'] },
    { fields: ['tracking_type'] },
    { fields: ['timestamp'] }
  ]
});

/**
 * 记录追踪事件
 */
async function recordTrackingEvent(trackingData) {
  try {
    const record = await EmailTracking.create(trackingData);
    
    // 同时在Redis中记录（用于实时统计）
    const redisKey = `tracking:${trackingData.message_id}:${trackingData.tracking_type}`;
    await redisClient.incr(redisKey);
    await redisClient.expire(redisKey, 86400 * 30); // 30天过期
    
    console.log('✅ 追踪事件记录成功:', {
      id: record.id,
      message_id: trackingData.message_id,
      type: trackingData.tracking_type,
      email: trackingData.email
    });
    
    return record;
  } catch (error) {
    console.error('❌ 记录追踪事件失败:', error);
    throw error;
  }
}

/**
 * 获取客户端IP地址
 */
function getClientIP(req) {
  return req.headers['x-forwarded-for'] ||
         req.headers['x-real-ip'] ||
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         req.ip ||
         'unknown';
}

/**
 * 解析追踪参数
 */
function parseTrackingParams(req) {
  const { mid, email, type = 'open', campaign, template } = req.query;
  
  if (!mid || !email) {
    throw new Error('缺少必要的追踪参数');
  }
  
  return {
    message_id: mid,
    email: decodeURIComponent(email),
    tracking_type: type,
    campaign_id: campaign,
    template_id: template
  };
}

/**
 * 邮件打开追踪 - 像素图片
 * GET /track/pixel?mid=<message_id>&email=<email>
 */
app.get('/track/pixel', async (req, res) => {
  try {
    const trackingParams = parseTrackingParams(req);
    
    // 记录打开事件
    await recordTrackingEvent({
      ...trackingParams,
      tracking_type: 'open',
      ip_address: getClientIP(req),
      user_agent: req.headers['user-agent'],
      referer: req.headers['referer'],
      additional_data: {
        campaign_id: trackingParams.campaign_id,
        template_id: trackingParams.template_id
      }
    });
    
    // 返回1x1透明像素
    res.set({
      'Content-Type': 'image/png',
      'Content-Length': TRACKING_PIXEL.length,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    
    res.send(TRACKING_PIXEL);
    
  } catch (error) {
    console.error('像素追踪失败:', error);
    
    // 即使出错也要返回像素图片，避免邮件显示异常
    res.set({
      'Content-Type': 'image/png',
      'Content-Length': TRACKING_PIXEL.length,
      'Cache-Control': 'no-cache'
    });
    res.send(TRACKING_PIXEL);
  }
});

/**
 * 链接点击追踪
 * GET /track/click?mid=<message_id>&email=<email>&url=<target_url>
 */
app.get('/track/click', async (req, res) => {
  try {
    const trackingParams = parseTrackingParams(req);
    const targetUrl = req.query.url;
    
    if (!targetUrl) {
      return res.status(400).json({ error: '缺少目标URL' });
    }
    
    // 记录点击事件
    await recordTrackingEvent({
      ...trackingParams,
      tracking_type: 'click',
      ip_address: getClientIP(req),
      user_agent: req.headers['user-agent'],
      referer: req.headers['referer'],
      additional_data: {
        target_url: targetUrl,
        campaign_id: trackingParams.campaign_id,
        template_id: trackingParams.template_id
      }
    });
    
    // 重定向到目标URL
    res.redirect(302, decodeURIComponent(targetUrl));
    
  } catch (error) {
    console.error('点击追踪失败:', error);
    
    // 如果追踪失败，仍然要重定向
    const targetUrl = req.query.url;
    if (targetUrl) {
      res.redirect(302, decodeURIComponent(targetUrl));
    } else {
      res.status(400).json({ error: '追踪失败' });
    }
  }
});

/**
 * 接收邮件状态更新
 * POST /track/email-status
 */
app.use(express.json());

app.post('/track/email-status', async (req, res) => {
  try {
    const {
      message_id,
      email,
      status,
      timestamp,
      reason,
      source = 'system'
    } = req.body;
    
    if (!message_id || !email || !status) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    // 记录状态更新事件
    await recordTrackingEvent({
      message_id,
      email,
      tracking_type: status, // delivered, bounced, complained等
      ip_address: getClientIP(req),
      user_agent: req.headers['user-agent'],
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      additional_data: {
        reason,
        source
      }
    });
    
    res.json({
      success: true,
      message: '状态更新记录成功'
    });
    
  } catch (error) {
    console.error('状态更新记录失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取追踪统计
 * GET /track/stats?mid=<message_id>
 */
app.get('/track/stats', async (req, res) => {
  try {
    const { mid: message_id, email, from_date, to_date } = req.query;
    
    if (!message_id && !email) {
      return res.status(400).json({ error: '需要提供message_id或email参数' });
    }
    
    const whereClause = {};
    if (message_id) whereClause.message_id = message_id;
    if (email) whereClause.email = email;
    if (from_date && to_date) {
      whereClause.timestamp = {
        [Sequelize.Op.between]: [new Date(from_date), new Date(to_date)]
      };
    }
    
    // 统计各类事件数量
    const stats = await EmailTracking.findAll({
      where: whereClause,
      attributes: [
        'tracking_type',
        [sequelize.fn('COUNT', '*'), 'count'],
        [sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('email'))), 'unique_count']
      ],
      group: ['tracking_type']
    });
    
    const result = {
      message_id,
      email,
      stats: stats.reduce((acc, stat) => {
        acc[stat.tracking_type] = {
          count: parseInt(stat.dataValues.count),
          unique_count: parseInt(stat.dataValues.unique_count)
        };
        return acc;
      }, {}),
      total_events: stats.reduce((sum, stat) => sum + parseInt(stat.dataValues.count), 0)
    };
    
    res.json(result);
    
  } catch (error) {
    console.error('获取统计失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 健康检查
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'tracking-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

/**
 * 初始化服务
 */
async function initializeService() {
  try {
    // 连接数据库
    await sequelize.authenticate();
    console.log('✅ 数据库连接成功');
    
    // 同步模型
    await EmailTracking.sync();
    console.log('✅ 数据模型同步成功');
    
    // 连接Redis
    await redisClient.connect();
    console.log('✅ Redis连接成功');
    
    // 启动服务
    app.listen(PORT, () => {
      console.log(`🚀 邮件追踪服务启动成功`);
      console.log(`📡 监听端口: ${PORT}`);
      console.log(`🔗 像素追踪: http://localhost:${PORT}/track/pixel`);
      console.log(`🔗 点击追踪: http://localhost:${PORT}/track/click`);
      console.log(`📊 统计查询: http://localhost:${PORT}/track/stats`);
    });
    
  } catch (error) {
    console.error('❌ 服务初始化失败:', error);
    process.exit(1);
  }
}

// 优雅关闭
process.on('SIGTERM', async () => {
  console.log('收到SIGTERM信号，正在关闭服务...');
  await sequelize.close();
  await redisClient.quit();
  process.exit(0);
});

// 启动服务
initializeService();

module.exports = app; 