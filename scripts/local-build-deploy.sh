#!/bin/bash
# 本地构建 + 生产部署脚本
# 解决生产服务器内存不足问题的最佳方案

set -e

echo "🏗️ EDM前端本地构建部署器 v1.0"
echo "================================="

# 配置参数
PROD_SERVER="ubuntu@43.135.38.15"
REMOTE_DIR="/opt/edm"
BACKUP_DIR="/home/ubuntu/edm-backups"

# 检查本地环境
check_local_env() {
    echo "🔍 1. 检查本地环境..."
    
    if [ ! -d "src/frontend" ]; then
        echo "❌ 错误：未找到前端目录 src/frontend"
        echo "💡 请在EDM项目根目录执行此脚本"
        exit 1
    fi
    
    cd src/frontend
    
    if [ ! -f "package.json" ]; then
        echo "❌ 错误：未找到 package.json"
        exit 1
    fi
    
    # 检查Node.js和npm
    if ! command -v node &> /dev/null; then
        echo "❌ 错误：Node.js未安装"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        echo "❌ 错误：npm未安装"
        exit 1
    fi
    
    echo "✅ 本地环境检查通过"
    echo "   - Node.js: $(node --version)"
    echo "   - npm: $(npm --version)"
    echo "   - 项目目录: $(pwd)"
}

# 本地构建
build_frontend() {
    echo "🏗️ 2. 开始本地构建..."
    
    # 清理旧构建
    echo "清理旧构建..."
    rm -rf build/
    
    # 安装依赖（如果需要）
    if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
        echo "安装/更新依赖..."
        npm install
    fi
    
    # 设置生产环境变量
    echo "设置生产环境变量..."
    export REACT_APP_API_BASE_URL=/api
    export REACT_APP_TRACKING_BASE_URL=https://tkmail.fun
    export REACT_APP_IMAGE_BASE_URL=https://tkmail.fun/uploads
    export GENERATE_SOURCEMAP=false
    
    # 开始构建
    echo "开始React构建..."
    npm run build
    
    # 验证构建结果
    if [ ! -d "build" ]; then
        echo "❌ 构建失败：未找到build目录"
        exit 1
    fi
    
    BUILD_SIZE=$(du -sh build | cut -f1)
    echo "✅ 构建完成！构建大小: $BUILD_SIZE"
}

# 打包构建结果
package_build() {
    echo "📦 3. 打包构建结果..."
    
    # 创建时间戳
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    PACKAGE_NAME="frontend-build-${TIMESTAMP}.tar.gz"
    
    # 打包
    cd build
    tar -czf "../${PACKAGE_NAME}" .
    cd ..
    
    echo "✅ 打包完成: ${PACKAGE_NAME}"
    echo "   文件大小: $(du -sh ${PACKAGE_NAME} | cut -f1)"
}

# 上传到生产服务器
upload_to_production() {
    echo "🚀 4. 上传到生产服务器..."
    
    # 上传构建包
    echo "上传构建包..."
    scp "${PACKAGE_NAME}" "${PROD_SERVER}:/tmp/"
    
    echo "✅ 上传完成"
}

# 在生产服务器上部署
deploy_on_production() {
    echo "🎯 5. 生产服务器部署..."
    
    ssh "${PROD_SERVER}" << EOF
set -e

echo "=== 生产服务器部署开始 ==="

# 创建备份目录
mkdir -p ${BACKUP_DIR}

# 停止frontend-mount容器（如果存在）
echo "停止现有前端容器..."
docker stop edm-frontend-mount 2>/dev/null || true
docker rm edm-frontend-mount 2>/dev/null || true

# 备份现有构建（如果存在）
if [ -d "${REMOTE_DIR}/frontend-build" ]; then
    echo "备份现有构建..."
    cp -r ${REMOTE_DIR}/frontend-build ${BACKUP_DIR}/frontend-build.backup.$(date +%Y%m%d_%H%M%S)
fi

# 创建构建目录
mkdir -p ${REMOTE_DIR}/frontend-build

# 解压新构建
echo "部署新构建..."
cd ${REMOTE_DIR}
tar -xzf /tmp/${PACKAGE_NAME} -C frontend-build/

# 启动frontend-mount容器
echo "启动前端容器..."
cd ${REMOTE_DIR}
docker run -d \\
  --name edm-frontend-mount \\
  --network edm-network \\
  -p 3000:80 \\
  -v \$(pwd)/frontend-build:/usr/share/nginx/html:ro \\
  -v \$(pwd)/deploy/nginx/frontend-mount.conf:/etc/nginx/conf.d/default.conf:ro \\
  --restart unless-stopped \\
  nginx:alpine

# 等待容器启动
sleep 3

# 检查容器状态
if docker ps | grep -q edm-frontend-mount; then
    echo "✅ 前端容器启动成功"
else
    echo "❌ 前端容器启动失败"
    docker logs edm-frontend-mount
    exit 1
fi

# 清理临时文件
rm /tmp/${PACKAGE_NAME}

echo "=== 部署完成 ==="
echo "🌐 网站访问: https://tkmail.fun"

# 快速健康检查
echo "快速健康检查..."
curl -s -o /dev/null -w "响应时间: %{time_total}s\\n" http://localhost || echo "⚠️ 本地检查失败，请检查nginx配置"

EOF
}

# 清理本地临时文件
cleanup() {
    echo "🧹 6. 清理临时文件..."
    
    cd ../../  # 回到项目根目录
    rm -f "src/frontend/${PACKAGE_NAME}"
    
    echo "✅ 清理完成"
}

# 验证部署结果
verify_deployment() {
    echo "🔍 7. 验证部署结果..."
    
    echo "测试网站访问..."
    RESPONSE_TIME=$(curl -s -o /dev/null -w "%{time_total}" https://tkmail.fun)
    
    if [ $? -eq 0 ]; then
        echo "✅ 网站访问正常"
        echo "   响应时间: ${RESPONSE_TIME}s"
    else
        echo "⚠️ 网站访问测试失败，请手动检查"
    fi
    
    echo "检查生产服务器容器状态..."
    ssh "${PROD_SERVER}" "docker ps --format 'table {{.Names}}\t{{.Status}}' | grep frontend"
}

# 主函数
main() {
    echo "🎯 开始本地构建部署流程..."
    echo ""
    
    # 记录开始时间
    START_TIME=$(date +%s)
    
    # 执行部署流程
    check_local_env
    build_frontend
    package_build
    upload_to_production
    deploy_on_production
    cleanup
    verify_deployment
    
    # 计算总时间
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    
    echo ""
    echo "🎉 部署完成！"
    echo "================================="
    echo "✅ 总耗时: ${DURATION}秒"
    echo "✅ 构建方式: 本地构建（零服务器内存消耗）"
    echo "✅ 部署方式: 挂载静态文件"
    echo "✅ 网站地址: https://tkmail.fun"
    echo ""
    echo "💡 以后更新前端只需要运行："
    echo "   ./scripts/local-build-deploy.sh"
    echo "💡 回滚到上一版本："
    echo "   ssh ${PROD_SERVER} 'ls ${BACKUP_DIR}'"
}

# 错误处理
trap 'echo "❌ 脚本执行失败，请检查错误信息"; exit 1' ERR

# 如果直接运行此脚本
if [ "$0" = "${BASH_SOURCE[0]}" ]; then
    main "$@"
fi 