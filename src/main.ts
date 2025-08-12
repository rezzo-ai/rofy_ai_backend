
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ClerkAuthMiddleware } from './clerk-auth.middleware';
import helmet from 'helmet';
import compression from 'compression';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    const logger = new Logger('Bootstrap');

    // Security middleware
    app.use(helmet());
    app.use(compression());

    // Enable CORS for frontend communication
    app.enableCors({
        origin: process.env.FRONTEND_URL || ['http://localhost:3000', 'http://localhost:3001'],
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
        credentials: true,
    });

    // Global validation pipe with detailed error messages
    app.useGlobalPipes(new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
            enableImplicitConversion: true,
        },
        errorHttpStatusCode: 400,
        exceptionFactory: (errors) => {
            const messages = errors.map(error =>
                Object.values(error.constraints || {}).join(', ')
            ).join('; ');
            return new Error(`Validation failed: ${messages}`);
        },
    }));

    // Apply authentication middleware globally
    const clerkAuth = new ClerkAuthMiddleware();
    app.use(clerkAuth.use.bind(clerkAuth));


    // Graceful shutdown
    process.on('SIGTERM', () => {
        logger.log('SIGTERM received, shutting down gracefully');
        app.close();
    });
    process.on('SIGINT', () => {
        logger.log('SIGINT received, shutting down gracefully');
        app.close();
    });

    const port = 5001;
    app.listen(port);
    logger.log(`🚀 Application is running on: http://localhost:${port}`);
    logger.log(`📊 Health check available at: http://localhost:${port}/health`);
    logger.log(`👤 Users API available at: http://localhost:${port}/users`);
    logger.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
}

bootstrap().catch((error) => {
    console.error('❌ Error starting the application:', error);
    process.exit(1);
});
