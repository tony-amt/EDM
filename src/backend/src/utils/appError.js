/**
 * V2.0 应用错误类
 * 统一的错误处理机制
 */
class AppError extends Error {
  constructor(message, statusCode, errors = null) {
    super(message);
    
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    this.errors = errors; // 用于验证错误等详细信息
    
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError; 