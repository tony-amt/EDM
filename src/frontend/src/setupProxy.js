const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // 只代理API请求到后端
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://backend:3000',
      changeOrigin: true,
    })
  );
}; 