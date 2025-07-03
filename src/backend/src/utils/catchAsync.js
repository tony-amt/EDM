/**
 * V2.0 异步错误捕获中间件
 * 用于包装异步路由处理器，自动捕获异常
 */
const catchAsync = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = catchAsync; 