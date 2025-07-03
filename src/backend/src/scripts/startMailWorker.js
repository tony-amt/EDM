#!/usr/bin/env node

/**
 * 邮件发送Worker启动脚本
 * 
 * 用法: 
 *   node src/scripts/startMailWorker.js
 *   或
 *   npm run worker:mail
 */

require('dotenv').config();
const MailWorker = require('../services/mailWorker.service');
const logger = require('../utils/logger');
const config = require('../config');

// 捕获未处理的异常
process.on('uncaughtException', (error) => {
  logger.error('未捕获的异常，Worker将继续运行:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('未处理的Promise拒绝，Worker将继续运行:', reason);
});

// 处理终止信号
process.on('SIGTERM', async () => {
  logger.info('收到SIGTERM信号，Worker正在优雅关闭...');
  await shutdown();
});

process.on('SIGINT', async () => {
  logger.info('收到SIGINT信号，Worker正在优雅关闭...');
  await shutdown();
});

// 优雅关闭函数
async function shutdown() {
  try {
    // 停止邮件Worker
    if (MailWorker.isRunning) {
      MailWorker.stop();
      logger.info('邮件Worker已停止');
    }
    
    // 等待一些时间以完成正在处理的任务
    setTimeout(() => {
      logger.info('邮件Worker关闭完成');
      process.exit(0);
    }, 3000);
  } catch (error) {
    logger.error('Worker关闭时出错:', error);
    process.exit(1);
  }
}

// 启动Worker
async function startWorker() {
  try {
    logger.info('正在启动邮件发送Worker...');
    logger.info(`环境: ${config.server.env}`);
    
    // 初始化并启动Worker
    await MailWorker.start();
    
    logger.info('邮件发送Worker已成功启动');
  } catch (error) {
    logger.error('启动邮件发送Worker失败:', error);
    process.exit(1);
  }
}

// 执行启动
startWorker(); 