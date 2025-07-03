const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8082;

// 配置
const UPLOAD_PATH = process.env.UPLOAD_PATH || '/app/uploads';
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = (process.env.ALLOWED_TYPES || 'jpg,jpeg,png,gif,webp').split(',');
const THUMBNAIL_SIZES = (process.env.THUMBNAIL_SIZES || '150x150,300x300,600x600').split(',');

// 中间件
app.use(cors());
app.use(express.json());

/**
 * 确保上传目录存在
 */
async function ensureUploadDir() {
  try {
    await fs.access(UPLOAD_PATH);
  } catch {
    await fs.mkdir(UPLOAD_PATH, { recursive: true });
  }
  
  // 创建缩略图目录
  for (const size of THUMBNAIL_SIZES) {
    const thumbDir = path.join(UPLOAD_PATH, 'thumbnails', size);
    try {
      await fs.access(thumbDir);
    } catch {
      await fs.mkdir(thumbDir, { recursive: true });
    }
  }
}

/**
 * 生成唯一文件名
 */
function generateUniqueFilename(originalname) {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  const ext = path.extname(originalname);
  return `${timestamp}-${random}${ext}`;
}

/**
 * 检查文件类型
 */
function isAllowedFileType(filename) {
  const ext = path.extname(filename).toLowerCase().slice(1);
  return ALLOWED_TYPES.includes(ext);
}

/**
 * 生成缩略图
 */
async function generateThumbnails(inputPath, filename) {
  const thumbnails = [];
  
  for (const sizeStr of THUMBNAIL_SIZES) {
    try {
      const [width, height] = sizeStr.split('x').map(Number);
      const thumbFilename = `thumb_${sizeStr}_${filename}`;
      const thumbPath = path.join(UPLOAD_PATH, 'thumbnails', sizeStr, thumbFilename);
      
      await sharp(inputPath)
        .resize(width, height, {
          fit: 'cover',
          position: 'center'
        })
        .jpeg({ quality: 80 })
        .toFile(thumbPath);
      
      thumbnails.push({
        size: sizeStr,
        filename: thumbFilename,
        url: `/uploads/thumbnails/${sizeStr}/${thumbFilename}`
      });
      
    } catch (error) {
      console.error(`生成 ${sizeStr} 缩略图失败:`, error);
    }
  }
  
  return thumbnails;
}

/**
 * 获取图片元信息
 */
async function getImageMetadata(filePath) {
  try {
    const metadata = await sharp(filePath).metadata();
    return {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      size: metadata.size
    };
  } catch (error) {
    console.error('获取图片元信息失败:', error);
    return null;
  }
}

// 配置multer存储
const storage = multer.diskStorage({
  destination: UPLOAD_PATH,
  filename: (req, file, cb) => {
    const uniqueName = generateUniqueFilename(file.originalname);
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE
  },
  fileFilter: (req, file, cb) => {
    if (isAllowedFileType(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error(`不支持的文件类型。支持的类型: ${ALLOWED_TYPES.join(', ')}`));
    }
  }
});

/**
 * 上传单个图片
 * POST /upload
 */
app.post('/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '没有上传文件'
      });
    }
    
    const filePath = req.file.path;
    const filename = req.file.filename;
    
    // 获取图片元信息
    const metadata = await getImageMetadata(filePath);
    
    // 生成缩略图
    const thumbnails = await generateThumbnails(filePath, filename);
    
    const result = {
      success: true,
      data: {
        filename,
        originalName: req.file.originalname,
        url: `/uploads/${filename}`,
        size: req.file.size,
        metadata,
        thumbnails,
        uploadedAt: new Date().toISOString()
      }
    };
    
    console.log('✅ 图片上传成功:', filename);
    res.json(result);
    
  } catch (error) {
    console.error('❌ 图片上传失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 上传多个图片
 * POST /upload/multiple
 */
app.post('/upload/multiple', upload.array('images', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: '没有上传文件'
      });
    }
    
    const results = [];
    
    for (const file of req.files) {
      try {
        const filePath = file.path;
        const filename = file.filename;
        
        // 获取图片元信息
        const metadata = await getImageMetadata(filePath);
        
        // 生成缩略图
        const thumbnails = await generateThumbnails(filePath, filename);
        
        results.push({
          filename,
          originalName: file.originalname,
          url: `/uploads/${filename}`,
          size: file.size,
          metadata,
          thumbnails,
          uploadedAt: new Date().toISOString()
        });
        
      } catch (error) {
        console.error(`处理文件 ${file.originalname} 失败:`, error);
        results.push({
          originalName: file.originalname,
          error: error.message
        });
      }
    }
    
    console.log(`✅ 批量上传完成: ${results.length} 个文件`);
    res.json({
      success: true,
      data: results
    });
    
  } catch (error) {
    console.error('❌ 批量上传失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 图片处理 - 调整大小、格式转换等
 * POST /process
 */
app.post('/process', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '没有上传文件'
      });
    }
    
    const {
      width,
      height,
      quality = 80,
      format = 'jpeg',
      fit = 'cover'
    } = req.body;
    
    const inputPath = req.file.path;
    const processedFilename = `processed_${Date.now()}_${req.file.filename}`;
    const outputPath = path.join(UPLOAD_PATH, processedFilename);
    
    let processor = sharp(inputPath);
    
    // 调整大小
    if (width || height) {
      processor = processor.resize(
        width ? parseInt(width) : undefined,
        height ? parseInt(height) : undefined,
        { fit }
      );
    }
    
    // 格式转换和质量设置
    switch (format.toLowerCase()) {
      case 'jpeg':
      case 'jpg':
        processor = processor.jpeg({ quality: parseInt(quality) });
        break;
      case 'png':
        processor = processor.png({ quality: parseInt(quality) });
        break;
      case 'webp':
        processor = processor.webp({ quality: parseInt(quality) });
        break;
    }
    
    await processor.toFile(outputPath);
    
    // 获取处理后的图片信息
    const metadata = await getImageMetadata(outputPath);
    
    // 删除原始临时文件
    await fs.unlink(inputPath);
    
    console.log('✅ 图片处理成功:', processedFilename);
    res.json({
      success: true,
      data: {
        filename: processedFilename,
        url: `/uploads/${processedFilename}`,
        metadata,
        processedAt: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ 图片处理失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 删除图片
 * DELETE /delete/:filename
 */
app.delete('/delete/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(UPLOAD_PATH, filename);
    
    // 删除原图
    try {
      await fs.unlink(filePath);
    } catch (error) {
      console.warn('原图删除失败:', error.message);
    }
    
    // 删除相关缩略图
    for (const size of THUMBNAIL_SIZES) {
      const thumbPath = path.join(UPLOAD_PATH, 'thumbnails', size, `thumb_${size}_${filename}`);
      try {
        await fs.unlink(thumbPath);
      } catch (error) {
        // 缩略图可能不存在，忽略错误
      }
    }
    
    console.log('✅ 图片删除成功:', filename);
    res.json({
      success: true,
      message: '图片删除成功'
    });
    
  } catch (error) {
    console.error('❌ 图片删除失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取图片列表
 * GET /list
 */
app.get('/list', async (req, res) => {
  try {
    const files = await fs.readdir(UPLOAD_PATH);
    const imageFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase().slice(1);
      return ALLOWED_TYPES.includes(ext) && !file.startsWith('processed_');
    });
    
    const imageList = [];
    
    for (const file of imageFiles) {
      try {
        const filePath = path.join(UPLOAD_PATH, file);
        const stats = await fs.stat(filePath);
        const metadata = await getImageMetadata(filePath);
        
        imageList.push({
          filename: file,
          url: `/uploads/${file}`,
          size: stats.size,
          metadata,
          uploadedAt: stats.birthtime.toISOString()
        });
      } catch (error) {
        console.warn(`获取文件 ${file} 信息失败:`, error.message);
      }
    }
    
    res.json({
      success: true,
      data: imageList,
      total: imageList.length
    });
    
  } catch (error) {
    console.error('❌ 获取图片列表失败:', error);
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
    service: 'image-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    config: {
      uploadPath: UPLOAD_PATH,
      maxFileSize: MAX_FILE_SIZE,
      allowedTypes: ALLOWED_TYPES,
      thumbnailSizes: THUMBNAIL_SIZES
    }
  });
});

/**
 * 错误处理中间件
 */
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: `文件太大，最大支持 ${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB`
      });
    }
  }
  
  console.error('服务错误:', error);
  res.status(500).json({
    success: false,
    error: error.message || '服务器内部错误'
  });
});

/**
 * 初始化服务
 */
async function initializeService() {
  try {
    // 确保上传目录存在
    await ensureUploadDir();
    console.log('✅ 上传目录初始化成功');
    
    // 启动服务
    app.listen(PORT, () => {
      console.log(`🚀 图片处理服务启动成功`);
      console.log(`📡 监听端口: ${PORT}`);
      console.log(`📁 上传目录: ${UPLOAD_PATH}`);
      console.log(`📐 缩略图尺寸: ${THUMBNAIL_SIZES.join(', ')}`);
      console.log(`📄 支持格式: ${ALLOWED_TYPES.join(', ')}`);
      console.log(`📏 最大文件: ${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB`);
    });
    
  } catch (error) {
    console.error('❌ 服务初始化失败:', error);
    process.exit(1);
  }
}

// 启动服务
initializeService();

module.exports = app; 