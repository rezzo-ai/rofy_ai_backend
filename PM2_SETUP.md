# PM2 Production Setup

This project uses PM2 for process management in production environments. PM2 provides features like automatic restarts, load balancing, monitoring, and logging.

## Quick Start

### Development
```bash
npm run build
npm run pm2:start
```

### Production
```bash
npm run build
npm run pm2:start:prod
```

## PM2 Commands

| Command | Description |
|---------|-------------|
| `npm run pm2:start` | Start the application in development mode |
| `npm run pm2:start:prod` | Start the application in production mode |
| `npm run pm2:stop` | Stop the application |
| `npm run pm2:restart` | Restart the application |
| `npm run pm2:reload` | Gracefully reload the application (zero downtime) |
| `npm run pm2:delete` | Delete the application from PM2 |
| `npm run pm2:logs` | View application logs |
| `npm run pm2:status` | Check application status |
| `npm run pm2:monit` | Open PM2 monitoring dashboard |

## Configuration

The PM2 configuration is defined in `ecosystem.config.js`:

- **Clustering**: Uses all available CPU cores (`instances: 'max'`)
- **Auto-restart**: Automatically restarts on crashes
- **Memory limit**: Restarts if memory usage exceeds 1GB
- **Logging**: Centralized logging to `logs/` directory
- **Health checks**: Built-in health monitoring

## Production Features

### Load Balancing
PM2 automatically load balances requests across multiple Node.js instances using cluster mode.

### Graceful Shutdown
The application handles graceful shutdowns with a 5-second timeout for ongoing requests.

### Log Management
- Combined logs: `logs/combined.log`
- Output logs: `logs/out.log`
- Error logs: `logs/error.log`

### Memory Management
Automatic restart when memory usage exceeds 1GB to prevent memory leaks.

## Docker with PM2

The Dockerfile is configured to use PM2 in production:

```dockerfile
CMD ["pm2-runtime", "start", "ecosystem.config.js", "--env", "production"]
```

This ensures:
- Container doesn't exit when PM2 starts
- Proper signal handling for container orchestration
- Health checks work correctly

## Monitoring

### Status Check
```bash
npm run pm2:status
```

### Real-time Monitoring
```bash
npm run pm2:monit
```

### View Logs
```bash
npm run pm2:logs
```

## Deployment

For production deployment, the ecosystem.config.js includes a deployment configuration section that can be customized for your server setup.

## Environment Variables

PM2 supports different environment configurations:
- Development: Default environment variables
- Production: Optimized for production with `NODE_ENV=production`

## Troubleshooting

### Application won't start
1. Check if the build completed successfully: `npm run build`
2. Verify the dist folder exists and contains main.js
3. Check PM2 status: `npm run pm2:status`

### High memory usage
PM2 will automatically restart the application if memory exceeds 1GB. Check logs for memory-related issues.

### Port conflicts
Ensure port 5000 is available or update the PORT environment variable in ecosystem.config.js.
