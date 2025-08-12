# Production deployment script for PM2 (Windows PowerShell)
Write-Host "🚀 Starting Rofy AI Backend with PM2..." -ForegroundColor Green

# Ensure we have the latest build
Write-Host "📦 Building application..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}

# Check if PM2 is installed
try {
    pm2 --version | Out-Null
    Write-Host "✅ PM2 found" -ForegroundColor Green
} catch {
    Write-Host "⚠️  PM2 not found. Installing globally..." -ForegroundColor Yellow
    npm install -g pm2
}

# Start the application with PM2
Write-Host "🔧 Starting PM2 in production mode..." -ForegroundColor Yellow
npm run pm2:start:prod

# Show status
Write-Host "✅ Deployment complete! Application status:" -ForegroundColor Green
npm run pm2:status

Write-Host ""
Write-Host "📊 Useful commands:" -ForegroundColor Cyan
Write-Host "  - View logs: npm run pm2:logs" -ForegroundColor White
Write-Host "  - Monitor: npm run pm2:monit" -ForegroundColor White
Write-Host "  - Stop: npm run pm2:stop" -ForegroundColor White
Write-Host "  - Restart: npm run pm2:restart" -ForegroundColor White
