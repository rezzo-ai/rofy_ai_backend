#!/bin/bash

# Production deployment script for PM2
echo "🚀 Starting Rofy AI Backend with PM2..."

# Ensure we have the latest build
echo "📦 Building application..."
npm run build

# Check if PM2 is installed globally
if ! command -v pm2 &> /dev/null; then
    echo "⚠️  PM2 not found globally. Installing..."
    npm install -g pm2
fi

# Start the application with PM2
echo "🔧 Starting PM2 in production mode..."
npm run pm2:start:prod

# Show status
echo "✅ Deployment complete! Application status:"
npm run pm2:status

echo ""
echo "📊 Useful commands:"
echo "  - View logs: npm run pm2:logs"
echo "  - Monitor: npm run pm2:monit"
echo "  - Stop: npm run pm2:stop"
echo "  - Restart: npm run pm2:restart"
