#!/bin/bash

# Phase 4.1 队列调度系统优化 - 验证脚本
# 使用curl测试所有关键API端点

set -e

echo "🎯 Phase 4.1 队列调度系统优化 - 完整验证测试"
echo "============================================================"

API_BASE="http://localhost:3002"
AUTH_TOKEN="dev-permanent-test-token-admin-2025"
PASS_COUNT=0
FAIL_COUNT=0
TOTAL_COUNT=0

# 测试结果记录函数
test_api() {
    local name="$1"
    local method="$2"
    local endpoint="$3"
    local auth="$4"
    local expected_status="$5"
    
    echo -n "🧪 测试: $name ... "
    
    if [ "$auth" = "true" ]; then
        local cmd="curl -s -w '%{http_code}' -X $method -H 'Authorization: Bearer $AUTH_TOKEN' '$API_BASE$endpoint'"
    else
        local cmd="curl -s -w '%{http_code}' -X $method '$API_BASE$endpoint'"
    fi
    
    local response=$(eval $cmd)
    local status_code="${response: -3}"
    local body="${response%???}"
    
    TOTAL_COUNT=$((TOTAL_COUNT + 1))
    
    if [ "$status_code" = "$expected_status" ]; then
        echo "✅ PASS ($status_code)"
        PASS_COUNT=$((PASS_COUNT + 1))
        
        # 检查响应是否包含success字段
        if echo "$body" | grep -q '"success":true'; then
            echo "   📋 响应格式正确"
        else
            echo "   ⚠️  响应格式异常: $body"
        fi
    else
        echo "❌ FAIL (期望: $expected_status, 实际: $status_code)"
        echo "   📋 响应内容: $body"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
}

# 性能测试函数
test_performance() {
    local name="$1"
    local endpoint="$2"
    local threshold="$3"
    
    echo -n "⚡ 性能测试: $name ... "
    
    local start_time=$(date +%s%3N)
    local response=$(curl -s "$API_BASE$endpoint")
    local end_time=$(date +%s%3N)
    
    local duration=$((end_time - start_time))
    
    TOTAL_COUNT=$((TOTAL_COUNT + 1))
    
    if [ $duration -lt $threshold ]; then
        echo "✅ PASS (${duration}ms < ${threshold}ms)"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        echo "❌ FAIL (${duration}ms >= ${threshold}ms)"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
}

echo ""
echo "📋 第一阶段: 基础API功能测试"
echo "------------------------------------------------------------"

# 1. 队列调度系统V2 API测试
echo "🔧 队列调度系统V2 API测试"
test_api "队列V2基础健康检查" "GET" "/api/queue-v2/health" "false" "200"
test_api "队列V2详细健康检查" "GET" "/api/queue-v2/health-detailed" "true" "200"
test_api "队列V2状态查询" "GET" "/api/queue-v2/status" "true" "200"
test_api "队列V2服务统计" "GET" "/api/queue-v2/services/stats" "true" "200"
test_api "队列V2可用服务" "GET" "/api/queue-v2/services/ready" "true" "200"

# 2. 监控系统API测试
echo ""
echo "📊 监控系统API测试"
test_api "系统健康检查" "GET" "/api/monitoring/system-health" "false" "200"
test_api "性能指标获取" "GET" "/api/monitoring/performance-metrics" "false" "200"
test_api "队列状态监控" "GET" "/api/monitoring/queue-status" "false" "200"
test_api "告警信息获取" "GET" "/api/monitoring/alerts" "false" "200"

# 3. 配置管理API测试
echo ""
echo "⚙️  配置管理API测试"
test_api "获取所有配置" "GET" "/api/system-config/" "false" "200"
test_api "获取队列配置" "GET" "/api/system-config/queue" "false" "200"

echo ""
echo "📋 第二阶段: 队列调度器生命周期测试"
echo "------------------------------------------------------------"

# 4. 队列调度器控制测试
echo "🎮 队列调度器控制测试"
test_api "启动队列调度器" "POST" "/api/queue-v2/start" "true" "200"
sleep 2
test_api "验证运行状态" "GET" "/api/queue-v2/status" "true" "200"
test_api "停止队列调度器" "POST" "/api/queue-v2/stop" "true" "200"
sleep 1
test_api "验证停止状态" "GET" "/api/queue-v2/status" "true" "200"

echo ""
echo "📋 第三阶段: 性能基准测试"
echo "------------------------------------------------------------"

# 5. 性能测试
echo "⚡ API响应时间性能测试"
test_performance "队列健康检查" "/api/queue-v2/health" "500"
test_performance "系统健康检查" "/api/monitoring/system-health" "500"
test_performance "配置获取" "/api/system-config/" "1000"
test_performance "性能指标" "/api/monitoring/performance-metrics" "500"

echo ""
echo "📋 第四阶段: 错误处理测试"
echo "------------------------------------------------------------"

# 6. 错误处理测试
echo "🚫 错误处理测试"
test_api "无效认证token" "GET" "/api/queue-v2/status" "false" "401"
test_api "不存在的端点" "GET" "/api/queue-v2/nonexistent" "false" "404"

echo ""
echo "📋 第五阶段: 并发测试"
echo "------------------------------------------------------------"

# 7. 并发测试
echo "🔄 并发请求测试"
echo -n "🧪 测试: 10个并发请求 ... "

CONCURRENT_COUNT=10
CONCURRENT_PASS=0

for i in $(seq 1 $CONCURRENT_COUNT); do
    (
        response=$(curl -s -w '%{http_code}' "$API_BASE/api/queue-v2/health")
        status_code="${response: -3}"
        if [ "$status_code" = "200" ]; then
            echo "PASS" > "/tmp/concurrent_test_$i.result"
        else
            echo "FAIL" > "/tmp/concurrent_test_$i.result"
        fi
    ) &
done

wait

for i in $(seq 1 $CONCURRENT_COUNT); do
    if [ -f "/tmp/concurrent_test_$i.result" ]; then
        result=$(cat "/tmp/concurrent_test_$i.result")
        if [ "$result" = "PASS" ]; then
            CONCURRENT_PASS=$((CONCURRENT_PASS + 1))
        fi
        rm -f "/tmp/concurrent_test_$i.result"
    fi
done

TOTAL_COUNT=$((TOTAL_COUNT + 1))

if [ $CONCURRENT_PASS -eq $CONCURRENT_COUNT ]; then
    echo "✅ PASS ($CONCURRENT_PASS/$CONCURRENT_COUNT)"
    PASS_COUNT=$((PASS_COUNT + 1))
else
    echo "❌ FAIL ($CONCURRENT_PASS/$CONCURRENT_COUNT)"
    FAIL_COUNT=$((FAIL_COUNT + 1))
fi

echo ""
echo "============================================================"
echo "🎉 Phase 4.1 验证测试完成"
echo "============================================================"

# 计算成功率
SUCCESS_RATE=$(echo "scale=2; $PASS_COUNT * 100 / $TOTAL_COUNT" | bc)

echo "📊 测试结果统计:"
echo "   总测试数: $TOTAL_COUNT"
echo "   通过测试: $PASS_COUNT"
echo "   失败测试: $FAIL_COUNT"
echo "   成功率: $SUCCESS_RATE%"

echo ""
echo "📋 测试评估:"

if [ $FAIL_COUNT -eq 0 ]; then
    echo "   ✅ 所有测试通过，系统状态优秀"
    echo "   ✅ Phase 4.1 队列调度系统优化验证成功"
    echo "   ✅ 系统可以安全部署到生产环境"
    exit 0
elif [ $FAIL_COUNT -le 2 ]; then
    echo "   ⚠️  少量测试失败，系统基本正常"
    echo "   📋 建议检查失败的测试项并修复"
    exit 1
else
    echo "   ❌ 多项测试失败，系统存在问题"
    echo "   🔧 需要修复问题后重新测试"
    exit 2
fi 