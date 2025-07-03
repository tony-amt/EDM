/**
 * 图片清理脚本
 * 用于清理孤立的上传图片文件（已上传但未被任何模板引用）
 * 
 * 用法: node cleanupImages.js [--dry-run] [--days=30]
 */
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const dotenv = require('dotenv');
const { Op } = require('sequelize');
const { Template } = require('../src/models');
const { sequelize } = require('../src/models');
const logger = require('../src/utils/logger');

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../.env') });

// 将fs函数转换为Promise版本
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const unlink = promisify(fs.unlink);

// 配置
const UPLOADS_BASE_DIR = path.join(__dirname, '../public/uploads/images');
const DRY_RUN = process.argv.includes('--dry-run');
const DAYS_ARG = process.argv.find(arg => arg.startsWith('--days='));
const DAYS_OLD = DAYS_ARG ? parseInt(DAYS_ARG.split('=')[1], 10) : 30;
const MAX_AGE_MS = DAYS_OLD * 24 * 60 * 60 * 1000;

// 正则表达式，用于从HTML内容中提取图片URL
const IMAGE_URL_REGEX = /\/uploads\/images\/([0-9]{8}\/[^/]+\/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|gif|webp))/g;

/**
 * 递归获取指定目录中的所有图片文件
 */
async function getImageFilesRecursive(dir) {
  const imageFiles = [];
  
  // 确保目录存在
  if (!fs.existsSync(dir)) {
    logger.info(`目录不存在: ${dir}`);
    return imageFiles;
  }
  
  // 读取目录内容
  const items = await readdir(dir);
  
  // 处理每个条目
  for (const item of items) {
    const itemPath = path.join(dir, item);
    const itemStat = await stat(itemPath);
    
    if (itemStat.isDirectory()) {
      // 如果是目录，递归处理
      const subDirFiles = await getImageFilesRecursive(itemPath);
      imageFiles.push(...subDirFiles);
    } else if (itemStat.isFile() && /\.(jpg|jpeg|png|gif|webp)$/i.test(item)) {
      // 如果是图片文件
      const relativePath = path.relative(path.join(__dirname, '../public'), itemPath);
      const urlPath = relativePath.split(path.sep).join('/');
      
      imageFiles.push({
        name: item,
        path: itemPath,
        url_path: urlPath,
        size: itemStat.size,
        mtime: itemStat.mtime,
        age: Date.now() - itemStat.mtime.getTime()
      });
    }
  }
  
  return imageFiles;
}

/**
 * 从数据库中获取所有模板引用的图片URL
 */
async function getReferencedImages() {
  try {
    // 查询所有模板内容
    const templates = await Template.findAll({
      attributes: ['body']
    });

    const referencedImages = new Set();
    
    // 从模板内容中提取图片URL
    templates.forEach(template => {
      if (!template.body) return;
      
      const matches = template.body.matchAll(IMAGE_URL_REGEX);
      for (const match of matches) {
        referencedImages.add(match[1]);
      }
    });

    logger.info(`找到 ${referencedImages.size} 个被引用的图片`);
    return referencedImages;
  } catch (error) {
    logger.error('获取引用图片时出错:', error);
    throw error;
  }
}

/**
 * 查找EventLog中引用的图片
 */
async function getImagesFromEventLogs() {
  try {
    // 直接使用SQL查询，因为我们需要在JSON字段中搜索
    const [results] = await sequelize.query(`
      SELECT DISTINCT payload::text 
      FROM "EventLogs" 
      WHERE payload::text LIKE '%/uploads/images/%'
    `);

    const referencedImages = new Set();
    
    // 从日志内容中提取图片URL
    results.forEach(row => {
      if (!row.payload) return;
      
      const matches = row.payload.matchAll(IMAGE_URL_REGEX);
      for (const match of matches) {
        referencedImages.add(match[1]);
      }
    });

    logger.info(`在事件日志中找到 ${referencedImages.size} 个被引用的图片`);
    return referencedImages;
  } catch (error) {
    logger.error('获取事件日志图片时出错:', error);
    return new Set(); // 返回空集合，不影响主流程
  }
}

/**
 * 清理空目录
 */
async function cleanEmptyDirectories(dir) {
  if (!fs.existsSync(dir)) return;
  
  const items = await readdir(dir);
  
  // 先递归处理子目录
  for (const item of items) {
    const itemPath = path.join(dir, item);
    const stats = await stat(itemPath);
    
    if (stats.isDirectory()) {
      await cleanEmptyDirectories(itemPath);
    }
  }
  
  // 再次读取目录，检查是否为空
  const remainingItems = await readdir(dir);
  if (remainingItems.length === 0 && dir !== UPLOADS_BASE_DIR) {
    if (DRY_RUN) {
      logger.info(`将删除空目录: ${dir}`);
    } else {
      fs.rmdirSync(dir);
      logger.info(`删除空目录: ${dir}`);
    }
  }
}

/**
 * 主函数
 */
async function main() {
  try {
    logger.info('===== 开始图片清理 =====');
    logger.info(`模式: ${DRY_RUN ? '模拟运行' : '实际删除'}`);
    logger.info(`清理 ${DAYS_OLD} 天前未引用的图片`);

    // 获取所有图片文件
    const imageFiles = await getImageFilesRecursive(UPLOADS_BASE_DIR);
    logger.info(`找到 ${imageFiles.length} 个图片文件`);
    
    // 获取所有被引用的图片
    const referencedImagesFromTemplates = await getReferencedImages();
    const referencedImagesFromLogs = await getImagesFromEventLogs();
    
    // 合并两个引用集合
    const referencedImages = new Set([
      ...referencedImagesFromTemplates,
      ...referencedImagesFromLogs
    ]);

    // 找出未引用的图片
    const unreferencedImages = imageFiles.filter(file => {
      return !referencedImages.has(file.url_path);
    });

    // 找出足够老的未引用图片
    const oldUnreferencedImages = unreferencedImages.filter(file => 
      file.age > MAX_AGE_MS
    );

    logger.info(`找到 ${oldUnreferencedImages.length} 个${DAYS_OLD}天前未引用的图片`);

    // 清理未引用图片
    let deletedCount = 0;
    let deletedSize = 0;

    for (const file of oldUnreferencedImages) {
      logger.info(`${DRY_RUN ? '将删除' : '删除'}: ${file.url_path} (${(file.size/1024).toFixed(2)} KB, ${Math.floor(file.age / (24 * 60 * 60 * 1000))}天前)`);
      
      if (!DRY_RUN) {
        await unlink(file.path);
        deletedCount++;
        deletedSize += file.size;
      }
    }

    // 清理空目录
    if (!DRY_RUN) {
      await cleanEmptyDirectories(UPLOADS_BASE_DIR);
    }

    // 打印结果
    if (DRY_RUN) {
      logger.info(`模拟运行完成，将删除 ${oldUnreferencedImages.length} 个文件，共 ${(oldUnreferencedImages.reduce((sum, file) => sum + file.size, 0)/1024/1024).toFixed(2)} MB`);
    } else {
      logger.info(`清理完成，已删除 ${deletedCount} 个文件，释放 ${(deletedSize/1024/1024).toFixed(2)} MB 空间`);
    }

    logger.info('===== 图片清理完成 =====');
    process.exit(0);
  } catch (error) {
    logger.error('图片清理过程中发生错误:', error);
    process.exit(1);
  }
}

// 执行主函数
main(); 