# Multi-stage build for production optimization
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    gcc \
    libc-dev \
    pkgconfig

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./

# Install dependencies
RUN npm ci && npm cache clean --force

# Copy source code
COPY src ./src

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine AS production

# Create app directory
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nestjs -u 1001

# Install curl for healthcheck and build dependencies for native modules
RUN apk add --no-cache \
    curl \
    python3 \
    make \
    g++ \
    gcc \
    libc-dev \
    pkgconfig

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Copy environment files (optional for local development)
COPY .env* ./

# Change ownership to non-root user
RUN chown -R nestjs:nodejs /app
USER nestjs

# Expose port (Cloud Run uses PORT env var)
EXPOSE 8080
ENV PORT=8080

# Start the application
CMD ["node", "dist/main.js"]