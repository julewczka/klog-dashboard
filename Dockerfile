# Build stage
FROM node:20-alpine@sha256:f598378b5240225e6beab68fa9f356db1fb8efe55173e6d4d8153113bb8f333c AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --no-audit

COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine@sha256:f598378b5240225e6beab68fa9f356db1fb8efe55173e6d4d8153113bb8f333c

WORKDIR /app

# Copy standalone server
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Default data directory (mount your klog files here)
ENV KLOG_DATA_DIR=/data
RUN mkdir -p /data

EXPOSE 3000

CMD ["node", "server.js"]
