const winston = require('winston');
const path = require('path');
const config = require('../config');

// 确保日志级别有效
const level = config.logger?.level || 'info';

// 创建日志目录
const logDir = path.join(__dirname, '../../logs');

// 创建winston日志记录器
const logger = winston.createLogger({
  level,
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'amt-mail-system' },
  transports: [
    // 写入所有日志到文件
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error'
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log')
    })
  ]
});

// 在开发环境中，同时将日志输出到控制台
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

module.exports = logger; 