FROM node:16-alpine

WORKDIR /app

ADD package*.json /app/
RUN npm ci

CMD npm start