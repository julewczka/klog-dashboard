# Build stage
FROM node:24-alpine@sha256:01743339035a5c3c11a373cd7c83aeab6ed1457b55da6a69e014a95ac4e4700b AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --no-audit

COPY . .
RUN npm run build

# Production stage
FROM node:24-alpine@sha256:01743339035a5c3c11a373cd7c83aeab6ed1457b55da6a69e014a95ac4e4700b

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
