#!/bin/bash
# 本地运行脚本
# 用于快速启动完整系统并进行验收

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 确保在backend目录下
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd $DIR

# 显示欢迎信息
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}A.MT邮件系统本地验收环境启动脚本${NC}"
echo -e "${BLUE}========================================${NC}"

# 检查环境变量文件
if [ ! -f .env ]; then
  echo -e "${YELLOW}环境变量文件不存在，创建示例配置...${NC}"
  cp .env.example .env 2>/dev/null || {
    echo -e "${RED}错误: 无法找到.env.example文件${NC}"
    echo -e "${YELLOW}创建基本.env文件...${NC}"
    cat > .env << EOF
# 基础配置
PORT=3000
NODE_ENV=development

# 数据库配置
DB_HOST=localhost
DB_PORT=5432
DB_NAME=amt_mail_system
DB_USER=postgres
DB_PASSWORD=postgres

# JWT配置
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=1d

# 极光API配置
ENGAGELAB_BASE_URL=https://email.api.engagelab.cc/v1
ENGAGELAB_API_USER=your-api-user
ENGAGELAB_API_KEY=your-api-key

# 邮件配置
EMAIL_FROM=noreply@example.com
EMAIL_FROM_NAME=A.MT邮件系统

# 日志配置
LOG_LEVEL=info
EOF
  }
  echo -e "${GREEN}已创建基本.env文件，请根据需要修改配置${NC}"
  echo ""
  echo -e "${YELLOW}提示: 请确保设置了极光API凭证才能发送邮件${NC}"
  echo ""
  sleep 2
fi

# 检查依赖
echo -e "${BLUE}检查依赖...${NC}"
if ! command -v npm &> /dev/null; then
  echo -e "${RED}错误: 未找到npm命令，请安装Node.js${NC}"
  exit 1
fi

# 安装依赖
echo -e "${BLUE}安装依赖...${NC}"
npm install

# 检查数据库
echo -e "${BLUE}检查数据库连接...${NC}"
source .env
if command -v pg_isready &> /dev/null; then
  if pg_isready -h $DB_HOST -p $DB_PORT -U $DB_USER > /dev/null 2>&1; then
    echo -e "${GREEN}数据库连接正常${NC}"
  else
    echo -e "${YELLOW}警告: 无法连接到数据库，请确保PostgreSQL正在运行${NC}"
    echo -e "${YELLOW}请在另一个终端窗口启动PostgreSQL${NC}"
    echo -e "${YELLOW}可能的命令: brew services start postgresql (macOS)${NC}"
    echo -e "${YELLOW}或: sudo service postgresql start (Linux)${NC}"
    echo ""
    echo -e "${YELLOW}您也可以修改.env文件中的数据库配置${NC}"
    echo ""
    sleep 2
  fi
else
  echo -e "${YELLOW}提示: pg_isready命令不可用，跳过数据库连接检查${NC}"
  echo -e "${YELLOW}请确保PostgreSQL已安装并运行${NC}"
  sleep 2
fi

# 创建管理员用户
echo -e "${BLUE}检查管理员用户...${NC}"
node -e "
try {
  const { User } = require('./src/models');
  User.findOne({ where: { email: 'admin@example.com' } }).then(user => {
    if (!user) {
      console.log('管理员用户不存在，将创建默认管理员用户');
      require('./src/utils/createAdmin');
    } else {
      console.log('管理员用户已存在');
    }
  });
} catch (err) {
  console.log('检查管理员用户时出错，可能是数据库未连接: ' + err.message);
  process.exit(0);
}
"

# 打印可用命令
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}系统就绪! 可用命令:${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${GREEN}npm run dev${NC} - 启动开发服务器"
echo -e "${GREEN}npm run worker:mail${NC} - 启动邮件处理工作进程"
echo -e "${GREEN}npm run test:endpoints${NC} - 运行端到端测试"
echo -e "${GREEN}npm run send-test-email <邮箱地址>${NC} - 发送测试邮件"
echo -e "${GREEN}npm run send-multiple-test-emails <邮箱1> <邮箱2>${NC} - 批量发送测试邮件"
echo -e "${GREEN}npm run backup:full${NC} - 执行完整备份"
echo -e "${GREEN}npm run cleanup:images:dry${NC} - 检查需要清理的图片（仅打印）"
echo ""
echo -e "${YELLOW}提示: 首次运行时，数据库表将自动创建${NC}"
echo -e "${YELLOW}提示: 请确保已在.env中配置了正确的数据库连接信息${NC}"
echo ""
echo -e "${BLUE}使用 Ctrl+C 终止服务器进程${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 启动开发服务器
echo -e "${GREEN}启动开发服务器...${NC}"
echo ""
npm run dev 