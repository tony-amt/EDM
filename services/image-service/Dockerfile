FROM node:18-alpine

# 安装构建依赖和vips
RUN apk add --no-cache \
    vips-dev \
    make \
    g++ \
    python3 \
    py3-pip \
    binutils-gold \
    gnupg \
    libstdc++

WORKDIR /app

COPY package*.json ./
RUN npm install --only=production

COPY . .

RUN mkdir -p /app/uploads

EXPOSE 8082

CMD ["npm", "start"] 