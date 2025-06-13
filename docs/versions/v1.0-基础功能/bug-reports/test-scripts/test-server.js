// 简单的测试服务器脚本
const express = require('express');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

// 创建一个简单的mock模板API
app.post('/api/templates', (req, res) => {
  console.log('POST /api/templates', req.body);
  res.status(201).json({
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: req.body.name,
    subject: req.body.subject,
    body: req.body.body,
    created_by: 'user-123',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });
});

app.get('/api/templates', (req, res) => {
  console.log('GET /api/templates', req.query);
  res.status(200).json({
    total_items: 1,
    total_pages: 1,
    current_page: 1,
    limit: 20,
    items: [
      {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Template',
        subject: 'Test Subject',
        created_by: 'user-123',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ]
  });
});

// 启动服务器
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`测试服务器运行在 http://localhost:${PORT}`);
}); 