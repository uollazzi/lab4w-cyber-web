FROM node:alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY tsconfig.json ./
COPY src ./src
COPY files ./files
COPY user-files ./user-files

RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
