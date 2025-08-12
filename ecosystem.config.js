module.exports = {
    apps: [
        {
            name: 'rofy-ai-backend',
            script: './dist/main.js',
            instances: 'max', // Use all available CPU cores
            exec_mode: 'cluster',
            env: {
                NODE_ENV: 'development',
                PORT: 5000
            },
            env_production: {
                NODE_ENV: 'production',
                PORT: 5001
            },
            // Logging
            log_file: './logs/combined.log',
            out_file: './logs/out.log',
            error_file: './logs/error.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

            // Advanced PM2 features
            max_memory_restart: '1G',
            autorestart: true,
            watch: false,
            max_restarts: 10,
            min_uptime: '10s',

            // Health check
            health_check_grace_period: 3000,

            // Environment variables
            source_map_support: true,

            // Graceful shutdown
            kill_timeout: 5000,
            listen_timeout: 3000,

            // Process monitoring
            pmx: true,

            // Merge logs from all instances
            merge_logs: true,

            // Time zone
            time_zone: 'UTC'
        }
    ],

    // Deployment configuration (optional)
    deploy: {
        production: {
            user: 'deploy',
            host: ['your-server.com'],
            ref: 'origin/main',
            repo: 'git@github.com:rezzo-ai/rofy_ai_backend.git',
            path: '/var/www/rofy-ai-backend',
            'pre-deploy-local': '',
            'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
            'pre-setup': ''
        }
    }
};
