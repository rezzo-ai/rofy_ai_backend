import { Controller, Get, Logger } from '@nestjs/common';

@Controller()
export class HealthController {
    private readonly logger = new Logger(HealthController.name);

    @Get('health')
    healthCheck() {
        this.logger.log('Health check endpoint accessed');
        return {
            success: true,
            status: 'healthy',
            timestamp: new Date().toISOString(),
            service: 'rofy-ai-backend',
            version: '1.0.0',
            environment: process.env.NODE_ENV || 'development'
        };
    }

    @Get()
    root() {
        return {
            success: true,
            message: 'Rofy AI Backend API is running',
            timestamp: new Date().toISOString(),
            endpoints: {
                health: '/health',
                users: '/users',
                documentation: '/api-docs'
            }
        };
    }
}
