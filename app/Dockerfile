FROM node:alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY tsconfig.json ./
COPY src ./src
COPY files ./files

RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
