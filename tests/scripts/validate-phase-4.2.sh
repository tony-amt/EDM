#!/bin/bash

# Phase 4.2 故障恢复系统验证脚本
# 验证故障恢复服务、contact.tags移除、系统稳定性

set -e

# 配置
BASE_URL="http://localhost:3002"
TEST_TOKEN="dev-permanent-test-token-admin-2025"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 统计变量
TOTAL_COUNT=0
PASS_COUNT=0
FAIL_COUNT=0

echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}🔍 Phase 4.2 故障恢复系统验证测试${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""

# 测试函数
test_api() {
    local method=$1
    local endpoint=$2
    local expected_status=$3
    local description=$4
    local data=$5
    local auth_required=${6:-true}
    
    echo -n "测试: $description ... "
    
    local curl_cmd="curl -s -w '%{http_code}' -X $method"
    
    if [ "$auth_required" = true ]; then
        curl_cmd="$curl_cmd -H 'Authorization: Bearer $TEST_TOKEN'"
    fi
    
    curl_cmd="$curl_cmd -H 'Content-Type: application/json'"
    
    if [ -n "$data" ]; then
        curl_cmd="$curl_cmd -d '$data'"
    fi
    
    curl_cmd="$curl_cmd $BASE_URL$endpoint"
    
    local response=$(eval $curl_cmd)
    local status_code="${response: -3}"
    local body="${response%???}"
    
    TOTAL_COUNT=$((TOTAL_COUNT + 1))
    
    if [ "$status_code" = "$expected_status" ]; then
        echo -e "${GREEN}✅ PASS${NC}"
        PASS_COUNT=$((PASS_COUNT + 1))
        return 0
    else
        echo -e "${RED}❌ FAIL (期望: $expected_status, 实际: $status_code)${NC}"
        echo -e "${RED}   响应: $body${NC}"
        FAIL_COUNT=$((FAIL_COUNT + 1))
        return 1
    fi
}

# 等待服务启动
echo -e "${YELLOW}⏳ 等待服务启动...${NC}"
sleep 5

echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}📋 阶段1: 故障恢复服务API测试${NC}"
echo -e "${BLUE}============================================================${NC}"

# 1. 健康检查
test_api "GET" "/api/failure-recovery/health" "200" "故障恢复服务健康检查" "" false

# 2. 获取服务状态
test_api "GET" "/api/failure-recovery/status" "200" "获取故障恢复服务状态"

# 3. 启动故障恢复服务
test_api "POST" "/api/failure-recovery/start" "200" "启动故障恢复服务"

# 4. 获取详细报告
test_api "GET" "/api/failure-recovery/report" "200" "获取故障恢复详细报告"

# 5. 手动触发故障恢复
test_api "POST" "/api/failure-recovery/trigger" "200" "手动触发故障恢复"

# 6. 重置统计
test_api "POST" "/api/failure-recovery/reset-stats" "200" "重置故障恢复统计"

# 7. 停止故障恢复服务
test_api "POST" "/api/failure-recovery/stop" "200" "停止故障恢复服务"

echo ""
echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}📋 阶段2: 故障恢复功能测试${NC}"
echo -e "${BLUE}============================================================${NC}"

# 8. 验证服务启动后的状态
echo -n "测试: 验证故障恢复服务启动状态 ... "
start_response=$(curl -s -H "Authorization: Bearer $TEST_TOKEN" -X POST $BASE_URL/api/failure-recovery/start)
if echo "$start_response" | grep -q "故障恢复服务已启动\|故障恢复服务已在运行中"; then
    echo -e "${GREEN}✅ PASS${NC}"
    PASS_COUNT=$((PASS_COUNT + 1))
else
    echo -e "${RED}❌ FAIL${NC}"
    echo -e "${RED}   响应: $start_response${NC}"
    FAIL_COUNT=$((FAIL_COUNT + 1))
fi
TOTAL_COUNT=$((TOTAL_COUNT + 1))

# 9. 验证服务统计信息
echo -n "测试: 验证故障恢复统计信息 ... "
stats_response=$(curl -s -H "Authorization: Bearer $TEST_TOKEN" $BASE_URL/api/failure-recovery/status)
if echo "$stats_response" | grep -q "totalChecks\|config\|isRunning"; then
    echo -e "${GREEN}✅ PASS${NC}"
    PASS_COUNT=$((PASS_COUNT + 1))
else
    echo -e "${RED}❌ FAIL${NC}"
    echo -e "${RED}   响应: $stats_response${NC}"
    FAIL_COUNT=$((FAIL_COUNT + 1))
fi
TOTAL_COUNT=$((TOTAL_COUNT + 1))

# 10. 验证详细报告内容
echo -n "测试: 验证故障恢复详细报告内容 ... "
report_response=$(curl -s -H "Authorization: Bearer $TEST_TOKEN" $BASE_URL/api/failure-recovery/report)
if echo "$report_response" | grep -q "statistics\|timeline\|health\|successRate"; then
    echo -e "${GREEN}✅ PASS${NC}"
    PASS_COUNT=$((PASS_COUNT + 1))
else
    echo -e "${RED}❌ FAIL${NC}"
    echo -e "${RED}   响应: $report_response${NC}"
    FAIL_COUNT=$((FAIL_COUNT + 1))
fi
TOTAL_COUNT=$((TOTAL_COUNT + 1))

echo ""
echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}📋 阶段3: contact.tags移除验证${NC}"
echo -e "${BLUE}============================================================${NC}"

# 11. 验证contact.tags字段已移除
echo -n "测试: 验证contact.tags字段已移除 ... "
contacts_response=$(curl -s -H "Authorization: Bearer $TEST_TOKEN" "$BASE_URL/api/contacts?limit=1")
if echo "$contacts_response" | grep -q '"tags"'; then
    echo -e "${RED}❌ FAIL (contact.tags字段仍然存在)${NC}"
    FAIL_COUNT=$((FAIL_COUNT + 1))
else
    echo -e "${GREEN}✅ PASS${NC}"
    PASS_COUNT=$((PASS_COUNT + 1))
fi
TOTAL_COUNT=$((TOTAL_COUNT + 1))

# 12. 验证标签功能仍然正常
echo -n "测试: 验证标签功能仍然正常 ... "
tag_create_response=$(curl -s -H "Authorization: Bearer $TEST_TOKEN" -H "Content-Type: application/json" -X POST -d '{"name":"test-tag-phase42","description":"Phase 4.2测试标签"}' $BASE_URL/api/tags)
if echo "$tag_create_response" | grep -q "test-tag-phase42"; then
    # 获取标签ID并删除测试标签
    tag_id=$(echo "$tag_create_response" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
    if [ -n "$tag_id" ]; then
        curl -s -H "Authorization: Bearer $TEST_TOKEN" -X DELETE $BASE_URL/api/tags/$tag_id > /dev/null
    fi
    echo -e "${GREEN}✅ PASS${NC}"
    PASS_COUNT=$((PASS_COUNT + 1))
else
    echo -e "${RED}❌ FAIL${NC}"
    echo -e "${RED}   响应: $tag_create_response${NC}"
    FAIL_COUNT=$((FAIL_COUNT + 1))
fi
TOTAL_COUNT=$((TOTAL_COUNT + 1))

echo ""
echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}📋 阶段4: 系统集成验证${NC}"
echo -e "${BLUE}============================================================${NC}"

# 13. 验证Phase 4.1队列调度系统集成
echo -n "测试: 验证队列调度系统V2集成 ... "
queue_health_response=$(curl -s $BASE_URL/api/queue-v2/health)
if echo "$queue_health_response" | grep -q "QueueSchedulerV2\|healthy"; then
    echo -e "${GREEN}✅ PASS${NC}"
    PASS_COUNT=$((PASS_COUNT + 1))
else
    echo -e "${RED}❌ FAIL${NC}"
    echo -e "${RED}   响应: $queue_health_response${NC}"
    FAIL_COUNT=$((FAIL_COUNT + 1))
fi
TOTAL_COUNT=$((TOTAL_COUNT + 1))

# 14. 验证监控系统集成
echo -n "测试: 验证监控系统集成 ... "
monitoring_response=$(curl -s -H "Authorization: Bearer $TEST_TOKEN" $BASE_URL/api/monitoring/system-health)
if echo "$monitoring_response" | grep -q "healthy\|status"; then
    echo -e "${GREEN}✅ PASS${NC}"
    PASS_COUNT=$((PASS_COUNT + 1))
else
    echo -e "${RED}❌ FAIL${NC}"
    echo -e "${RED}   响应: $monitoring_response${NC}"
    FAIL_COUNT=$((FAIL_COUNT + 1))
fi
TOTAL_COUNT=$((TOTAL_COUNT + 1))

# 15. 验证配置管理集成
echo -n "测试: 验证配置管理集成 ... "
config_response=$(curl -s -H "Authorization: Bearer $TEST_TOKEN" $BASE_URL/api/system-config/)
if echo "$config_response" | grep -q "queue\|email\|system"; then
    echo -e "${GREEN}✅ PASS${NC}"
    PASS_COUNT=$((PASS_COUNT + 1))
else
    echo -e "${RED}❌ FAIL${NC}"
    echo -e "${RED}   响应: $config_response${NC}"
    FAIL_COUNT=$((FAIL_COUNT + 1))
fi
TOTAL_COUNT=$((TOTAL_COUNT + 1))

echo ""
echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}📋 阶段5: 性能和稳定性测试${NC}"
echo -e "${BLUE}============================================================${NC}"

# 16. 故障恢复性能测试
echo -n "测试: 故障恢复性能测试 ... "
start_time=$(date +%s%3N)
trigger_response=$(curl -s -H "Authorization: Bearer $TEST_TOKEN" -X POST $BASE_URL/api/failure-recovery/trigger)
end_time=$(date +%s%3N)
duration=$((end_time - start_time))

if [ $duration -lt 5000 ] && echo "$trigger_response" | grep -q "故障恢复已手动触发"; then
    echo -e "${GREEN}✅ PASS (${duration}ms)${NC}"
    PASS_COUNT=$((PASS_COUNT + 1))
else
    echo -e "${RED}❌ FAIL (${duration}ms)${NC}"
    FAIL_COUNT=$((FAIL_COUNT + 1))
fi
TOTAL_COUNT=$((TOTAL_COUNT + 1))

# 17. 故障恢复服务稳定性测试
echo -n "测试: 故障恢复服务稳定性测试 ... "
# 启动服务
curl -s -H "Authorization: Bearer $TEST_TOKEN" -X POST $BASE_URL/api/failure-recovery/start > /dev/null

# 等待10秒
sleep 10

# 检查服务状态
stability_response=$(curl -s -H "Authorization: Bearer $TEST_TOKEN" $BASE_URL/api/failure-recovery/status)
if echo "$stability_response" | grep -q '"isRunning":true'; then
    echo -e "${GREEN}✅ PASS${NC}"
    PASS_COUNT=$((PASS_COUNT + 1))
else
    echo -e "${RED}❌ FAIL${NC}"
    echo -e "${RED}   响应: $stability_response${NC}"
    FAIL_COUNT=$((FAIL_COUNT + 1))
fi
TOTAL_COUNT=$((TOTAL_COUNT + 1))

# 停止服务
curl -s -H "Authorization: Bearer $TEST_TOKEN" -X POST $BASE_URL/api/failure-recovery/stop > /dev/null

echo ""
echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}📋 阶段6: 错误处理测试${NC}"
echo -e "${BLUE}============================================================${NC}"

# 18. 无效认证处理
test_api "GET" "/api/failure-recovery/status" "401" "无效认证处理" "" false

echo ""
echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}🎉 Phase 4.2 验证测试完成${NC}"
echo -e "${BLUE}============================================================${NC}"

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
    echo -e "   ${GREEN}✅ 所有测试通过，Phase 4.2系统状态优秀${NC}"
    echo -e "   ${GREEN}✅ 故障恢复系统验证成功${NC}"
    echo -e "   ${GREEN}✅ contact.tags移除验证成功${NC}"
    echo -e "   ${GREEN}✅ 系统可以进入Phase 4.3阶段${NC}"
    exit 0
elif [ $FAIL_COUNT -le 2 ]; then
    echo -e "   ${YELLOW}⚠️  少量测试失败，系统基本正常${NC}"
    echo -e "   ${YELLOW}📋 建议检查失败的测试项并修复${NC}"
    exit 1
else
    echo -e "   ${RED}❌ 多项测试失败，系统存在问题${NC}"
    echo -e "   ${RED}🔧 需要修复问题后重新测试${NC}"
    exit 2
fi 