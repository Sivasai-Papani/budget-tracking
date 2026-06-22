FROM node:20-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY src ./src

RUN mkdir -p /app/data

ENV PORT=5001
EXPOSE 5001

CMD ["npm", "start"]
