# 使用Node.js 18版本
FROM node:18

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY src/ .

EXPOSE 3000

CMD ["npm", "run", "dev"] 