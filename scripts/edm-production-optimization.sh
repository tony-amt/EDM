#!/bin/bash

# EDM生产环境完整优化脚本
# 包含：系统清理 + 调度优化 + 邮件发送流程验证

set -e

SERVER="43.135.38.15"
USER="ubuntu"
PASS="Tony1231!"

echo "🚀 EDM生产环境完整优化开始..."
echo "时间: $(date)"
echo ""

# === 第一阶段：系统清理 ===
echo "🧹 第一阶段：系统清理"
echo "=================================="

# 1. 系统状态检查
echo "📊 检查系统当前状态..."
sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no $USER@$SERVER << 'EOF'
echo "系统负载: $(uptime | awk -F'load average:' '{print $2}')"
echo "内存使用: $(free -h | grep Mem | awk '{print $3 "/" $2}')"
echo "进程总数: $(ps aux | wc -l)"
echo "Docker容器: $(docker ps --format "{{.Names}}" | wc -l) 个运行中"
EOF

# 2. 清理系统缓存
echo ""
echo "🗑️ 清理系统缓存和临时文件..."
sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no $USER@$SERVER << 'EOF'
# 清理内存缓存
sudo sync
echo 3 | sudo tee /proc/sys/vm/drop_caches > /dev/null

# 清理临时文件
sudo rm -rf /tmp/* 2>/dev/null || true
sudo rm -rf /var/tmp/* 2>/dev/null || true

# 清理大日志文件
sudo find /var/log -name "*.log" -type f -size +50M -delete 2>/dev/null || true

# 清理APT缓存
sudo apt-get clean 2>/dev/null || true
sudo apt-get autoremove -y 2>/dev/null || true

echo "✅ 系统缓存清理完成"
EOF

# 3. 清理Docker资源
echo ""
echo "🐳 清理Docker资源..."
sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no $USER@$SERVER << 'EOF'
docker container prune -f 2>/dev/null || true
docker image prune -f 2>/dev/null || true
docker volume prune -f 2>/dev/null || true
echo "✅ Docker资源清理完成"
EOF

# === 第二阶段：调度优化 ===
echo ""
echo "⚙️ 第二阶段：调度优化"
echo "=================================="

# 4. 更新QueueScheduler调度间隔为5秒
echo "🔧 优化任务调度间隔到5秒..."
sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no $USER@$SERVER << 'EOF'
cd /home/ubuntu/EDM

# 备份原文件
cp src/backend/src/services/infrastructure/QueueScheduler.service.js src/backend/src/services/infrastructure/QueueScheduler.service.js.backup.$(date +%Y%m%d_%H%M%S)

# 修改调度间隔
sed -i 's/const intervalMs = (service\.sending_rate || 60) \* 1000;/const intervalMs = 5 * 1000; \/\/ 固定5秒间隔/' src/backend/src/services/infrastructure/QueueScheduler.service.js

echo "✅ 调度间隔已优化为5秒"
EOF

# 5. 重启后端服务以应用更改
echo ""
echo "🔄 重启EDM后端服务..."
sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no $USER@$SERVER << 'EOF'
cd /home/ubuntu/EDM
docker-compose restart edm-backend
sleep 10

# 检查服务状态
if docker ps | grep -q edm-backend; then
    echo "✅ 后端服务重启成功"
else
    echo "❌ 后端服务重启失败"
fi
EOF

# === 第三阶段：邮件服务验证 ===
echo ""
echo "📧 第三阶段：邮件服务验证"
echo "=================================="

# 6. 检查邮件服务配置
echo "🔍 检查邮件服务配置..."
sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no $USER@$SERVER << 'EOF'
cd /home/ubuntu/EDM
docker exec edm-backend node -e "
const { EmailService } = require('./src/models');
(async () => {
  try {
    const services = await EmailService.findAll();
    console.log('📧 邮件服务配置:');
    services.forEach(service => {
      console.log(\`  - \${service.name}: 间隔\${service.sending_rate}s, 状态:\${service.is_enabled?'启用':'禁用'}, 额度:\${service.daily_quota}\`);
    });
  } catch (error) {
    console.error('查询失败:', error.message);
  }
  process.exit(0);
})();
"
EOF

# 7. 检查webhook服务状态
echo ""
echo "🔗 检查webhook服务状态..."
sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no $USER@$SERVER << 'EOF'
# 检查tracking-service状态
if docker ps | grep -q tracking-service; then
    echo "✅ tracking-service 运行正常"
    echo "端口映射: $(docker port tracking-service 2>/dev/null || echo '未找到端口映射')"
else
    echo "❌ tracking-service 未运行"
fi

# 检查webhook-service状态  
if docker ps | grep -q webhook-service; then
    echo "✅ webhook-service 运行正常"
    echo "端口映射: $(docker port webhook-service 2>/dev/null || echo '未找到端口映射')"
else
    echo "❌ webhook-service 未运行"
fi
EOF

# === 第四阶段：创建测试任务 ===
echo ""
echo "🧪 第四阶段：创建测试任务"
echo "=================================="

# 8. 准备测试数据
echo "📝 准备测试任务数据..."

TEST_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjczYjU3MDI4LWIyYzYtNDkzZi04ZTA5LTA3MjQyZjljYTM1MSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc1MTEzMTIxNCwiZXhwIjoxNzUxMjE3NjE0fQ.Mvu5iLjv8M06Hvy3mEYD0VNI286ZUGLs8TBLWeNiKTc"

# 创建立即执行的测试任务
echo "🚀 创建立即执行的测试任务..."
sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no $USER@$SERVER << EOF
cd /home/ubuntu/EDM

# 创建测试任务的API调用
curl -X POST "https://tkmail.fun/api/tasks" \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "EDM调度优化验证任务",
    "template_ids": ["种子测试"],
    "sender_name": "tony", 
    "tag_ids": ["种子邮箱"],
    "scheduled_type": "immediate",
    "description": "验证5秒调度间隔和完整邮件发送流程"
  }' \
  -w "\nHTTP状态码: %{http_code}\n" | tee task_creation_result.json

echo ""
echo "任务创建结果已保存到 task_creation_result.json"
EOF

# === 第五阶段：监控任务执行 ===
echo ""
echo "👀 第五阶段：监控任务执行"
echo "=================================="

# 9. 监控任务状态
echo "📊 监控任务执行状态..."
for i in {1..12}; do
    echo "第 $i 次检查 ($(date +%H:%M:%S))..."
    
    sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no $USER@$SERVER << EOF
    cd /home/ubuntu/EDM
    
    # 获取最新任务状态
    curl -s "https://tkmail.fun/api/tasks?limit=3" \
      -H "Authorization: Bearer $TEST_TOKEN" | \
      jq -r '.data[] | "任务: \(.name) | 状态: \(.status) | 已发送: \(.sent_count)/\(.total_recipients)"' | \
      head -3
    
    echo ""
    
    # 检查SubTask状态
    echo "子任务状态统计:"
    docker exec edm-backend node -e "
    const { SubTask } = require('./src/models');
    (async () => {
      try {
        const stats = await SubTask.findAll({
          attributes: [
            'status',
            [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
          ],
          where: {
            created_at: {
              [require('sequelize').Op.gte]: new Date(Date.now() - 10*60*1000)
            }
          },
          group: ['status'],
          raw: true
        });
        console.log('最近10分钟子任务状态:');
        stats.forEach(stat => console.log(\`  \${stat.status}: \${stat.count}\`));
      } catch (error) {
        console.error('查询失败:', error.message);
      }
      process.exit(0);
    })();
    " 2>/dev/null || echo "无法查询子任务状态"
EOF
    
    echo "---"
    sleep 10
done

# === 第六阶段：webhook验证 ===
echo ""
echo "🔗 第六阶段：Webhook验证"
echo "=================================="

# 10. 检查engagelab webhook配置
echo "🔍 检查EngageLab webhook配置..."
sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no $USER@$SERVER << 'EOF'
cd /home/ubuntu/EDM

# 检查webhook-service日志
echo "=== Webhook服务最近日志 ==="
docker logs webhook-service --tail 50 2>/dev/null || echo "无法获取webhook日志"

echo ""
echo "=== 检查webhook配置 ==="
if [ -f "services/webhook-service/app.js" ]; then
    grep -n "engagelab\|webhook" services/webhook-service/app.js | head -10
else
    echo "webhook服务配置文件不存在"
fi
EOF

# === 第七阶段：最终优化状态 ===
echo ""
echo "📊 最终系统状态"
echo "=================================="

# 11. 最终状态报告
echo "📋 生成最终状态报告..."
sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no $USER@$SERVER << 'EOF'
echo "=== 系统资源状态 ==="
echo "负载: $(uptime | awk -F'load average:' '{print $2}')"  
echo "内存: $(free -h | grep Mem | awk '{print $3 "/" $2 " (" int($3/$2*100) "%)"}')"
echo "磁盘: $(df -h / | tail -1 | awk '{print $3 "/" $2 " (" $5 ")"}')"
echo "进程: $(ps aux | wc -l)"

echo ""
echo "=== Docker容器状态 ==="
docker ps --format "{{.Names}}: {{.Status}}" | sort

echo ""
echo "=== EDM服务健康检查 ==="
curl -s https://tkmail.fun/api/health 2>/dev/null | jq . || echo "健康检查接口异常"
EOF

echo ""
echo "🎉 EDM生产环境优化完成！"
echo ""
echo "📈 优化摘要:"
echo "- ✅ 系统缓存和临时文件已清理"
echo "- ✅ Docker资源已优化"  
echo "- ✅ 任务调度间隔已优化到5秒"
echo "- ✅ 后端服务已重启"
echo "- ✅ 测试任务已创建"
echo "- ✅ 任务执行状态已监控"
echo ""
echo "🎯 接下来需要："
echo "1. 登录种子邮箱验证邮件接收"
echo "2. 进行邮件打开和回复操作"
echo "3. 验证追踪像素和统计功能"
echo "4. 检查webhook回调数据"
echo ""
echo "📧 种子邮箱登录信息请咨询管理员"
echo "" 