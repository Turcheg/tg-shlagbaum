FROM node:16-alpine

WORKDIR /app

ADD package*.json /app/
RUN npm ci

COPY . /app/
RUN npm run build

CMD npm start