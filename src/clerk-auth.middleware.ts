import { Request, Response, NextFunction } from 'express';
import { Logger } from '@nestjs/common';
import { verifyToken } from '@clerk/backend';

const logger = new Logger('ClerkAuthMiddleware');

// Define interface for user payload
interface ClerkUser {
    sub: string;
    email?: string;
    [key: string]: any;
}

// Extend Request interface
declare global {
    namespace Express {
        interface Request {
            user?: ClerkUser;
        }
    }
}

export async function clerkAuthMiddleware(req: Request, res: Response, next: NextFunction) {
    // Skip authentication for public endpoints
    const publicPaths = ['/health', '/', '/favicon.ico', '/api-docs'];
    if (publicPaths.includes(req.path)) {
        return next();
    }

    try {
        const authHeader = req.headers['authorization'] || req.headers['Authorization'];

        if (!authHeader || typeof authHeader !== 'string') {
            logger.warn(`Authentication failed: No authorization header for ${req.path}`);
            return res.status(401).json({
                success: false,
                message: 'Authorization header is required'
            });
        }

        const match = authHeader.match(/^Bearer (.+)$/);
        if (!match) {
            logger.warn(`Authentication failed: Malformed authorization header for ${req.path}`);
            return res.status(401).json({
                success: false,
                message: 'Malformed authorization header. Expected: Bearer <token>'
            });
        }

        const token = match[1];
        logger.log(`Attempting to verify JWT token for ${req.path}`);

        console.log(process.env.CLERK_SECRET_KEY);

        // Use Clerk's verifyToken function
        const payload = await verifyToken(token, {
            secretKey: process.env.CLERK_SECRET_KEY!
        });

        req.user = payload as ClerkUser;
        logger.log(`User authenticated: ${req.user.sub} for ${req.method} ${req.path}`);
        next();

    } catch (error: any) {
        logger.warn(`Token verification failed for ${req.path}:`, error.message);
        return res.status(401).json({
            success: false,
            message: 'Invalid or expired token',
            ...(process.env.NODE_ENV === 'development' && { error: error.message })
        });
    }
}
