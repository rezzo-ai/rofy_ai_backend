
import { Injectable, NestMiddleware, UnauthorizedException, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '@clerk/backend';

const logger = new Logger('ClerkAuthMiddleware');

@Injectable()
export class ClerkAuthMiddleware implements NestMiddleware {
    async use(req: Request, res: Response, next: NextFunction) {
        // Skip authentication for public endpoints
        const publicPaths = ['/health', '/', '/favicon.ico', '/api-docs'];
        if (publicPaths.includes(req.path)) {
            return next();
        }

        try {
            const authHeader = req.headers['authorization'] || req.headers['Authorization'];

            if (!authHeader || typeof authHeader !== 'string') {
                logger.warn(`Authentication failed: No authorization header for ${req.path}`);
                throw new UnauthorizedException('Authorization header is required');
            }

            const match = authHeader.match(/^Bearer (.+)$/);
            if (!match) {
                logger.warn(`Authentication failed: Malformed authorization header for ${req.path}`);
                throw new UnauthorizedException('Malformed authorization header. Expected: Bearer <token>');
            }

            const token = match[1];
            logger.log(`Attempting to verify JWT token for ${req.path}`);

            // Use Clerk's verifyToken function
            const payload = await verifyToken(token, {
                secretKey: process.env.CLERK_SECRET_KEY!
            });

            // Attach userId for controller access
            (req as any).userId = payload.sub;
            (req as any).user = payload;
            logger.log(`User authenticated: ${payload.sub} for ${req.method} ${req.path}`);
            next();

        } catch (error: any) {
            logger.warn(`Token verification failed for ${req.path}:`, error?.message);
            throw new UnauthorizedException('Invalid or expired token');
        }
    }
}
