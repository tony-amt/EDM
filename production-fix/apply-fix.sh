#!/bin/bash

# EDM系统生产环境快速修复脚本
# 修复邮件任务创建失败问题

echo "🔧 开始应用EDM系统修复补丁..."

# 设置容器名称
BACKEND_CONTAINER="edm-backend-prod"

# 检查容器是否运行
echo "📋 检查容器状态..."
if ! docker ps | grep -q $BACKEND_CONTAINER; then
    echo "❌ 错误：容器 $BACKEND_CONTAINER 未运行"
    exit 1
fi

echo "✅ 容器 $BACKEND_CONTAINER 运行正常"

# 1. 修复contact.service.js中的JSONB查询问题
echo "🔧 修复contact.service.js中的JSONB查询问题..."
docker exec $BACKEND_CONTAINER bash -c "
# 备份原文件
cp /app/src/services/core/contact.service.js /app/src/services/core/contact.service.js.backup

# 修复Op.overlap查询
sed -i 's/\[Op\.overlap\]: includeTagIds/[Op.overlap]: Sequelize.cast(JSON.stringify(includeTagIds), \"jsonb\")/g' /app/src/services/core/contact.service.js
sed -i 's/\[Op\.overlap\]: excludeTagIds/[Op.overlap]: Sequelize.cast(JSON.stringify(excludeTagIds), \"jsonb\")/g' /app/src/services/core/contact.service.js

# 添加Sequelize导入（如果没有）
if ! grep -q 'const { Op, Sequelize }' /app/src/services/core/contact.service.js; then
    sed -i '1i const { Op, Sequelize } = require(\"sequelize\");' /app/src/services/core/contact.service.js
fi
"

# 2. 修复QueueScheduler.js中的JSONB查询问题
echo "🔧 修复QueueScheduler.js中的JSONB查询问题..."
docker exec $BACKEND_CONTAINER bash -c "
# 备份原文件
cp /app/src/services/infrastructure/QueueScheduler.js /app/src/services/infrastructure/QueueScheduler.js.backup

# 修复Op.overlap查询
sed -i 's/\[Op\.overlap\]: include_tags/[Op.overlap]: Sequelize.cast(JSON.stringify(include_tags), \"jsonb\")/g' /app/src/services/infrastructure/QueueScheduler.js
sed -i 's/\[Op\.overlap\]: exclude_tags/[Op.overlap]: Sequelize.cast(JSON.stringify(exclude_tags), \"jsonb\")/g' /app/src/services/infrastructure/QueueScheduler.js

# 添加Sequelize导入（如果没有）
if ! grep -q 'const { Op, Sequelize }' /app/src/services/infrastructure/QueueScheduler.js; then
    sed -i '1i const { Op, Sequelize } = require(\"sequelize\");' /app/src/services/infrastructure/QueueScheduler.js
fi
"

# 3. 修复task.service.js中的关联问题
echo "🔧 修复task.service.js中的关联问题..."
docker exec $BACKEND_CONTAINER bash -c "
# 备份原文件
cp /app/src/services/core/task.service.js /app/src/services/core/task.service.js.backup

# 移除可能导致问题的Tag include
sed -i '/include.*Tag/d' /app/src/services/core/task.service.js
sed -i '/include.*models\.Tag/d' /app/src/services/core/task.service.js
"

# 4. 创建修复后的查询函数
echo "🔧 创建优化的查询函数..."
docker exec $BACKEND_CONTAINER bash -c "
cat > /app/src/utils/tagQueryHelper.js << 'EOF'
const { Op, Sequelize } = require('sequelize');

/**
 * 修复后的标签查询辅助函数
 */
const buildTagQueryClause = (includeTagIds = [], excludeTagIds = []) => {
  let whereClause = {};
  
  if (includeTagIds && includeTagIds.length > 0) {
    // 使用原生SQL进行JSONB数组查询
    const tagIds = includeTagIds.map(id => \`'\${id}'\`).join(',');
    whereClause[Op.and] = whereClause[Op.and] || [];
    whereClause[Op.and].push(
      Sequelize.literal(\`tags ?| array[\${tagIds}]\`)
    );
  }
  
  if (excludeTagIds && excludeTagIds.length > 0) {
    const excludeIds = excludeTagIds.map(id => \`'\${id}'\`).join(',');
    whereClause[Op.and] = whereClause[Op.and] || [];
    whereClause[Op.and].push(
      Sequelize.literal(\`NOT (tags ?| array[\${excludeIds}])\`)
    );
  }
  
  return whereClause;
};

module.exports = { buildTagQueryClause };
EOF
"

# 5. 重启容器应用修复
echo "🔄 重启后端容器应用修复..."
docker restart $BACKEND_CONTAINER

# 等待容器启动
echo "⏳ 等待容器重启..."
sleep 10

# 检查容器状态
if docker ps | grep -q $BACKEND_CONTAINER; then
    echo "✅ 容器重启成功"
else
    echo "❌ 容器重启失败，正在回滚..."
    
    # 回滚修改
    docker exec $BACKEND_CONTAINER bash -c "
    if [ -f /app/src/services/core/contact.service.js.backup ]; then
        mv /app/src/services/core/contact.service.js.backup /app/src/services/core/contact.service.js
    fi
    if [ -f /app/src/services/infrastructure/QueueScheduler.js.backup ]; then
        mv /app/src/services/infrastructure/QueueScheduler.js.backup /app/src/services/infrastructure/QueueScheduler.js
    fi
    if [ -f /app/src/services/core/task.service.js.backup ]; then
        mv /app/src/services/core/task.service.js.backup /app/src/services/core/task.service.js
    fi
    "
    
    docker restart $BACKEND_CONTAINER
    echo "🔄 已回滚修改并重启容器"
    exit 1
fi

# 6. 验证修复
echo "🧪 验证修复结果..."
sleep 5

# 检查日志是否还有错误
echo "📋 检查最新日志..."
RECENT_ERRORS=$(docker logs --tail=20 $BACKEND_CONTAINER | grep -i "error\|operator does not exist\|not associated" | wc -l)

if [ $RECENT_ERRORS -gt 0 ]; then
    echo "⚠️  警告：日志中仍有错误，请手动检查"
    docker logs --tail=20 $BACKEND_CONTAINER | grep -i "error\|operator does not exist\|not associated"
else
    echo "✅ 未发现新的错误日志"
fi

echo ""
echo "🎉 修复脚本执行完成！"
echo ""
echo "📋 修复总结："
echo "   ✅ 修复了JSONB查询操作符问题"
echo "   ✅ 添加了类型转换处理"
echo "   ✅ 移除了有问题的模型关联"
echo "   ✅ 创建了查询辅助函数"
echo ""
echo "🔍 下一步："
echo "   1. 在Web界面测试创建任务"
echo "   2. 监控后端日志确认无错误"
echo "   3. 如有问题，备份文件可用于回滚"
echo ""
echo "📁 备份文件位置："
echo "   - /app/src/services/core/contact.service.js.backup"
echo "   - /app/src/services/infrastructure/QueueScheduler.js.backup"  
echo "   - /app/src/services/core/task.service.js.backup" 