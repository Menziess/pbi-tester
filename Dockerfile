FROM node:14

WORKDIR /app

COPY package*.json .

RUN npm install

COPY src/ src/
COPY public/ public/

EXPOSE 2222 80 443

CMD [ "node", "src/server.js" ]
