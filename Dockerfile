FROM node:16-alpine

WORKDIR /app

ADD package*.json /app/
RUN npm ci

COPY . /app/

CMD npm start