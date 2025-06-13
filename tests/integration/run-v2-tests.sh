#!/bin/bash

echo "🚀 V2.0 集成测试快速启动"
echo "=========================================="

# 检查Docker环境
echo "🔧 检查Docker环境..."
if ! curl -f http://localhost:3000/health >/dev/null 2>&1; then
    echo "❌ Docker环境未就绪，请先启动系统："
    echo "   ./start-edm-system.sh"
    exit 1
fi
echo "✅ Docker环境健康检查通过"

# 进入测试目录
cd "$(dirname "$0")"

echo ""
echo "📋 运行 V2.0 集成测试套件..."
echo "------------------------------------------"

# 设置测试环境变量
export NODE_ENV=test

# 测试计数器
total_tests=0
passed_tests=0
failed_tests=0

# 运行发信人管理测试
echo ""
echo "📊 [1/3] 测试发信人管理功能..."
if node -e "
const { spawn } = require('child_process');
const jest = spawn('npx', ['jest', 'v2-senders.test.js', '--verbose', '--testTimeout=300000'], { stdio: 'inherit' });
jest.on('close', (code) => process.exit(code));
"; then
    echo "✅ 发信人管理测试 - PASS"
    ((passed_tests++))
else
    echo "❌ 发信人管理测试 - FAIL"
    ((failed_tests++))
fi
((total_tests++))

# 运行发信服务管理测试
echo ""
echo "📊 [2/3] 测试发信服务管理功能..."
if node -e "
const { spawn } = require('child_process');
const jest = spawn('npx', ['jest', 'v2-email-services.test.js', '--verbose', '--testTimeout=300000'], { stdio: 'inherit' });
jest.on('close', (code) => process.exit(code));
"; then
    echo "✅ 发信服务管理测试 - PASS"
    ((passed_tests++))
else
    echo "❌ 发信服务管理测试 - FAIL"
    ((failed_tests++))
fi
((total_tests++))

# 运行用户额度管理测试
echo ""
echo "📊 [3/3] 测试用户额度管理功能..."
if node -e "
const { spawn } = require('child_process');
const jest = spawn('npx', ['jest', 'v2-user-quota.test.js', '--verbose', '--testTimeout=300000'], { stdio: 'inherit' });
jest.on('close', (code) => process.exit(code));
"; then
    echo "✅ 用户额度管理测试 - PASS"
    ((passed_tests++))
else
    echo "❌ 用户额度管理测试 - FAIL"
    ((failed_tests++))
fi
((total_tests++))

# 测试结果汇总
echo ""
echo "🏁 V2.0 集成测试完成"
echo "=========================================="
echo "📊 测试统计:"
echo "   总计: $total_tests 个测试套件"
echo "   通过: $passed_tests 个"
echo "   失败: $failed_tests 个"

if [ $failed_tests -eq 0 ]; then
    echo ""
    echo "🎉 所有 V2.0 集成测试通过！"
    exit 0
else
    echo ""
    echo "💥 部分 V2.0 集成测试失败！"
    exit 1
fi 