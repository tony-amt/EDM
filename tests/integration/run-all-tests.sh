#!/bin/bash

# 设置环境变量
export NODE_ENV=test
export DB_HOST_TEST=localhost

# 显示测试开始
echo "🚀 开始运行EDM系统集成测试..."

# 准备测试数据库
echo "⏳ 确保测试数据库存在..."
docker exec -it edm-postgres psql -U postgres -c "CREATE DATABASE IF NOT EXISTS amt_mail_test;" || true

# 进入项目目录
cd "$(dirname "$0")/../.."

# 运行各测试文件
echo "⏳ 运行认证相关测试..."
jest tests/integration/auth.test.js --forceExit

echo "⏳ 运行联系人相关测试..."
jest tests/integration/contacts.test.js --forceExit

echo "⏳ 运行标签相关测试..."
jest tests/integration/tags.test.js --forceExit

echo "⏳ 运行模板相关测试..."
jest tests/integration/templates.test.js --forceExit

echo "⏳ 运行模板集相关测试..."
jest tests/integration/template-sets.test.js --forceExit

echo "⏳ 运行邮件变量相关测试..."
jest tests/integration/email-variables.test.js --forceExit

echo "⏳ 运行活动相关测试..."
jest tests/integration/campaigns.test.js --forceExit

echo "⏳ 运行任务相关测试..."
jest tests/integration/tasks.test.js --forceExit

echo "✅ 所有集成测试完成！" 