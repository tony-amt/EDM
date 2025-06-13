const http = require('http');

// 健康检查
const healthCheck = () => {
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/health',
    method: 'GET'
  };

  const req = http.request(options, res => {
    console.log(`状态码: ${res.statusCode}`);
    
    res.on('data', d => {
      const data = JSON.parse(d);
      console.log('健康检查响应:', data);
      
      if (res.statusCode === 200 && data.status === 'ok') {
        console.log('✅ 服务器正常运行!');
      } else {
        console.log('❌ 服务器状态异常!');
      }
    });
  });

  req.on('error', error => {
    console.error('❌ 服务器连接失败:', error.message);
  });

  req.end();
};

// 执行健康检查
healthCheck(); 