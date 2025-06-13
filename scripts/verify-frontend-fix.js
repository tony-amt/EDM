#!/usr/bin/env node

/**
 * 验证前端是否发送正确的字段名
 * 通过拦截HTTP请求直接检查
 */

const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

let interceptedRequest = null;

// 模拟后端登录接口，记录收到的请求
app.post('/api/auth/login', (req, res) => {
  interceptedRequest = req.body;
  
  console.log('🔍 收到前端登录请求:');
  console.log('📤 请求体:', JSON.stringify(req.body, null, 2));
  
  // 检查字段名
  if (req.body.hasOwnProperty('usernameOrEmail')) {
    console.log('✅ 前端发送了正确的字段名: usernameOrEmail');
    res.json({
      success: true,
      message: '字段名正确',
      token: 'fake-token',
      data: { username: 'admin' }
    });
  } else if (req.body.hasOwnProperty('username')) {
    console.log('❌ 前端发送了错误的字段名: username (应该是 usernameOrEmail)');
    res.status(400).json({
      success: false,
      message: '字段名错误',
      errors: [{ field: 'usernameOrEmail', message: '字段名应该是 usernameOrEmail' }]
    });
  } else {
    console.log('⚠️ 前端没有发送用户名字段');
    res.status(400).json({
      success: false,
      message: '缺少必填字段',
      errors: [{ field: 'usernameOrEmail', message: '用户名或邮箱不能为空' }]
    });
  }
});

const server = app.listen(4000, () => {
  console.log('🔧 前端字段验证服务器启动在端口 4000');
  console.log('📋 请修改前端API配置指向 http://localhost:4000 来测试');
  console.log('💡 或者直接用curl测试:');
  console.log('   curl -X POST http://localhost:4000/api/auth/login -H "Content-Type: application/json" -d \'{"usernameOrEmail":"test","password":"test"}\'');
});

// 10分钟后自动关闭
setTimeout(() => {
  console.log('🕐 验证服务器自动关闭');
  server.close();
  process.exit(0);
}, 10 * 60 * 1000);

module.exports = { interceptedRequest }; 