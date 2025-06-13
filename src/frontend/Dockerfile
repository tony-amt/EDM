# 使用Node.js 18作为基础镜像
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 复制package文件
COPY package*.json ./

# 安装依赖 (包括开发依赖，因为React需要)
RUN npm ci

# 复制源代码
COPY . .

# 暴露端口
EXPOSE 3001

# 设置环境变量
ENV PORT=3001
ENV REACT_APP_API_BASE_URL=http://localhost:3000/api

# 启动应用
CMD ["npm", "start"] 