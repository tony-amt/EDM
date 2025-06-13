const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const { AppError } = require('../utils/errorHandler');
const config = require('../config');
const logger = require('../utils/logger');
const sharp = require('sharp');

// 获取今天的日期格式化为YYYYMMDD
const getDateFolder = () => {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
};

// 创建上传目录函数
const createUploadDir = (userId = 'anonymous') => {
  // 基础上传目录
  const baseUploadDir = path.join(__dirname, '../../public/uploads/images');
  
  // 按日期和用户ID组织目录
  const dateFolder = getDateFolder();
  const userFolder = userId.toString().replace(/[^a-zA-Z0-9-_]/g, '_');
  
  // 完整目录路径
  const fullDir = path.join(baseUploadDir, dateFolder, userFolder);
  
  // 确保目录存在
  if (!fs.existsSync(fullDir)) {
    fs.mkdirSync(fullDir, { recursive: true });
    logger.info(`创建上传目录: ${fullDir}`);
  }
  
  return fullDir;
};

// 配置multer存储
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // 获取用户ID（如果已认证）
    const userId = req.user ? req.user.id : 'anonymous';
    
    // 创建并返回目录
    const uploadDir = createUploadDir(userId);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = uuidv4();
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    
    if (!allowedExtensions.includes(ext)) {
      return cb(new AppError('不支持的文件类型，仅支持jpg、jpeg、png、gif和webp格式', 400));
    }
    
    cb(null, `${uniqueSuffix}${ext}`);
  }
});

// 过滤文件类型
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError('不支持的文件类型，仅支持jpg、jpeg、png、gif和webp格式', 400), false);
  }
};

// 文件大小限制（5MB）
const limits = {
  fileSize: 5 * 1024 * 1024
};

// 创建上传中间件
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: limits
});

// 图片上传控制器
class UploadController {
  /**
   * 上传图片
   */
  async uploadImage(req, res, next) {
    // upload.single中间件在路由中处理
    try {
      // 确保文件已上传
      if (!req.file) {
        throw new AppError('请选择要上传的图片', 400);
      }

      const { filename, path: filePath, size } = req.file;
      
      // 获取原始文件大小
      const originalSize = size;
      
      // 提取目录信息，用于构建URL
      const relativePath = path.relative(path.join(__dirname, '../../public'), filePath);
      const urlPath = relativePath.split(path.sep).join('/');

      // 使用Sharp优化图片（如果不是GIF）
      if (!filename.endsWith('.gif')) {
        try {
          // 优化为WebP格式，更小的文件大小并保持较高的质量
          const webpFilename = `${path.parse(filename).name}.webp`;
          const webpOutputPath = path.join(path.dirname(filePath), webpFilename);
          
          await sharp(filePath)
            .webp({ quality: 80 }) // 80%的质量通常是良好的平衡
            .toFile(webpOutputPath);

          // 删除原始文件
          fs.unlinkSync(filePath);

          // 获取优化后的文件大小
          const optimizedSize = fs.statSync(webpOutputPath).size;
          const compressionRate = Math.round((1 - (optimizedSize / originalSize)) * 100);

          // 生成URL（使用相对路径）
          const baseUrl = req.protocol + '://' + req.get('host');
          const relativeWebpPath = path.relative(path.join(__dirname, '../../public'), webpOutputPath);
          const webpUrlPath = relativeWebpPath.split(path.sep).join('/');
          const imageUrl = `${baseUrl}/${webpUrlPath}`;

          logger.info(`图片上传成功: ${imageUrl}, 原始大小: ${originalSize}字节, 优化后: ${optimizedSize}字节, 压缩率: ${compressionRate}%`);
          
          return res.status(201).json({
            success: true,
            url: imageUrl,
            filename: webpFilename,
            path: webpUrlPath,
            original_size: originalSize,
            optimized_size: optimizedSize,
            compression_rate: `${compressionRate}%`
          });
        } catch (optimizeError) {
          logger.error('图片优化失败，使用原图:', optimizeError);
          
          // 如果优化失败，使用原始文件
          const baseUrl = req.protocol + '://' + req.get('host');
          const imageUrl = `${baseUrl}/${urlPath}`;
          
          logger.info(`图片上传成功(未优化): ${imageUrl}, 大小: ${originalSize}字节`);
          
          return res.status(201).json({
            success: true,
            url: imageUrl,
            filename: filename,
            path: urlPath,
            size: originalSize
          });
        }
      } else {
        // GIF文件不进行优化
        const baseUrl = req.protocol + '://' + req.get('host');
        const imageUrl = `${baseUrl}/${urlPath}`;
        
        logger.info(`GIF图片上传成功: ${imageUrl}, 大小: ${originalSize}字节`);
        
        return res.status(201).json({
          success: true,
          url: imageUrl,
          filename: filename,
          path: urlPath,
          size: originalSize
        });
      }
    } catch (error) {
      // 清理临时文件
      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      next(error);
    }
  }
}

module.exports = {
  UploadController: new UploadController(),
  uploadMiddleware: upload.single('image')
}; 