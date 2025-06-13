const { Sequelize } = require('sequelize');
const logger = require('./logger');
const { AppError } = require('./errorHandler');

/**
 * 数据库错误处理工具
 * 提供统一的错误处理机制，将Sequelize错误转换为应用错误
 */
class DatabaseErrorHandler {
  /**
   * 处理数据库错误
   * @param {Error} error - 捕获的错误对象
   * @param {string} context - 错误发生的上下文
   * @returns {AppError} - 应用错误对象
   */
  static handleError(error, context = '数据库操作') {
    // 记录原始错误
    logger.error(`数据库错误 (${context}):`, error);
    
    if (error instanceof Sequelize.ValidationError) {
      // 验证错误
      const messages = error.errors.map(e => `${e.path}: ${e.message}`).join('; ');
      return new AppError(`验证失败: ${messages}`, 400);
    } 
    else if (error instanceof Sequelize.UniqueConstraintError) {
      // 唯一约束错误
      const field = error.errors[0]?.path || '未知字段';
      return new AppError(`${field}已存在，请使用其他值`, 400);
    } 
    else if (error instanceof Sequelize.ForeignKeyConstraintError) {
      // 外键约束错误
      return new AppError(`引用的关联数据不存在或无法删除存在引用的数据`, 400);
    } 
    else if (error instanceof Sequelize.ExclusionConstraintError) {
      // 排除约束错误
      return new AppError(`数据冲突，无法满足排除约束`, 400);
    } 
    else if (error instanceof Sequelize.ConnectionError) {
      // 连接错误
      return new AppError(`数据库连接失败，请稍后重试`, 503);
    } 
    else if (error instanceof Sequelize.ConnectionRefusedError) {
      // 连接被拒绝
      return new AppError(`数据库连接被拒绝，请联系管理员`, 503);
    } 
    else if (error instanceof Sequelize.ConnectionTimedOutError) {
      // 连接超时
      return new AppError(`数据库连接超时，请稍后重试`, 503);
    } 
    else if (error instanceof Sequelize.TimeoutError) {
      // 查询超时
      return new AppError(`数据库查询超时，请稍后重试或优化查询`, 503);
    } 
    else if (error instanceof Sequelize.DatabaseError) {
      // 一般数据库错误
      return new AppError(`数据库错误: ${error.message}`, 500);
    } 
    else if (error instanceof AppError) {
      // 已经是应用错误，直接返回
      return error;
    } 
    else {
      // 未知错误
      return new AppError(`操作失败: ${error.message}`, 500);
    }
  }
  
  /**
   * 包装异步数据库操作，统一处理错误
   * @param {Function} asyncFn - 异步操作函数
   * @param {string} context - 操作上下文
   * @returns {Function} - 包装后的异步函数
   */
  static wrapAsync(asyncFn, context) {
    return async (...args) => {
      try {
        return await asyncFn(...args);
      } catch (error) {
        throw DatabaseErrorHandler.handleError(error, context);
      }
    };
  }
  
  /**
   * 将数据库操作包装在事务中执行
   * @param {Object} db - 数据库对象
   * @param {Function} asyncFn - 要在事务中执行的异步函数
   * @param {string} context - 操作上下文
   * @returns {Promise<any>} - 操作结果
   */
  static async withTransaction(db, asyncFn, context = '事务操作') {
    return db.transaction(async (transaction) => {
      try {
        return await asyncFn(transaction);
      } catch (error) {
        throw DatabaseErrorHandler.handleError(error, context);
      }
    });
  }
  
  /**
   * 检查数据库记录是否存在
   * @param {Object} model - Sequelize模型
   * @param {Object} where - 查询条件
   * @param {string} errorMessage - 记录不存在时的错误消息
   * @returns {Promise<Object>} - 存在的记录
   * @throws {AppError} - 记录不存在时抛出错误
   */
  static async checkExists(model, where, errorMessage) {
    const record = await model.findOne({ where });
    if (!record) {
      throw new AppError(errorMessage, 404);
    }
    return record;
  }
}

module.exports = DatabaseErrorHandler; 