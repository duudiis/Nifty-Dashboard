# ---- Build stage ----
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .
RUN npm run build

# ---- Runtime stage ----
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

# Only what the custom server needs at runtime.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/src ./src
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.js ./next.config.js

EXPOSE 3000

CMD ["npm", "run", "start"]
