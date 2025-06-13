const { validationResult } = require('express-validator');

/**
 * 请求验证中间件
 * 用于验证express-validator的结果
 */
exports.validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array().map(err => ({
        field: err.param,
        message: err.msg
      }))
    });
  }
  next();
}; 