# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Install PM2 globally
RUN npm install pm2 -g

# Create app directory
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nestjs -u 1001

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prompts ./prompts

# Copy PM2 ecosystem file
COPY ecosystem.config.js ./

# Create logs directory
RUN mkdir -p logs

# Change ownership to non-root user
RUN chown -R nestjs:nodejs /app
USER nestjs

# Expose port
EXPOSE 5000

# Health check - updated to work with PM2
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD pm2 ping || exit 1

# Start the application with PM2
CMD ["pm2-runtime", "start", "ecosystem.config.js", "--env", "production"]
