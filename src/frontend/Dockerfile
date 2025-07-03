# 使用Node.js 18版本进行开发模式
FROM node:18

# 设置工作目录
WORKDIR /app

# 复制package文件
COPY package*.json ./

# 安装依赖
RUN npm install

# 设置环境变量
ENV REACT_APP_API_BASE_URL=/api
ENV PORT=3001

# 复制源代码
COPY . .

# 暴露端口
EXPOSE 3001

# 启动开发服务器
CMD ["npm", "start"] 