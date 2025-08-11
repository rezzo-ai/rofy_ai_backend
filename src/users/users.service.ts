import { Injectable, UnauthorizedException, InternalServerErrorException, Logger } from '@nestjs/common';
import { createClerkClient, verifyToken } from '@clerk/backend';
import * as mysql from 'mysql2/promise';

const logger = new Logger('UsersService');

@Injectable()
export class UsersService {
    private clerk: any;
    private pool: mysql.Pool;

    constructor() {
        // Validate required environment variables
        if (!process.env.CLERK_SECRET_KEY) {
            throw new Error('CLERK_SECRET_KEY must be set in environment variables');
        }

        this.clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

        // Database configuration from environment variables
        const dbConfig: mysql.PoolOptions = {
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: parseInt(process.env.DB_PORT || '3306'),
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
            connectionLimit: 10,
        };

        // Validate database configuration
        if (!dbConfig.host || !dbConfig.user || !dbConfig.password || !dbConfig.database) {
            throw new Error('Database configuration incomplete. Please check DB_HOST, DB_USER, DB_PASSWORD, and DB_NAME environment variables');
        }

        this.pool = mysql.createPool(dbConfig);
    }

    async registerUser(authorization: string, email: string) {
        if (!authorization || !email) {
            throw new UnauthorizedException('Authorization token and email are required');
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            throw new UnauthorizedException('Invalid email format');
        }

        const token = typeof authorization === 'string' && authorization.startsWith('Bearer ')
            ? authorization.slice(7)
            : authorization;

        let userId = '';
        let userEmail = '';

        try {
            const tokenPayload = await verifyToken(token, {
                secretKey: process.env.CLERK_SECRET_KEY!
            });

            userId = tokenPayload.sub;
            userEmail = (tokenPayload as any).email || email;

            logger.log(`Token verified for user: ${userId}`);
        } catch (err) {
            logger.error('Token verification failed:', err);
            throw new UnauthorizedException('Invalid or expired authorization token');
        }

        const conn = await this.pool.getConnection();
        try {
            // Create users table if it doesn't exist
            await conn.query(`
                CREATE TABLE IF NOT EXISTS users (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    clerk_id VARCHAR(255) NOT NULL UNIQUE,
                    email VARCHAR(255) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_clerk_id (clerk_id),
                    INDEX idx_email (email)
                )
            `);

            // Check if user already exists
            const [existingUser] = await conn.query(
                'SELECT id, clerk_id, email FROM users WHERE clerk_id = ? OR email = ?',
                [userId, userEmail]
            );

            if (Array.isArray(existingUser) && existingUser.length > 0) {
                logger.warn(`User already exists: ${userId}`);
                return {
                    success: true,
                    message: 'User already registered',
                    user: {
                        id: (existingUser[0] as any).id,
                        clerkId: userId,
                        email: userEmail
                    }
                };
            }

            // Insert new user
            const [result] = await conn.query(
                'INSERT INTO users (clerk_id, email) VALUES (?, ?)',
                [userId, userEmail]
            );

            const insertResult = result as mysql.ResultSetHeader;

            logger.log(`User registered successfully: ${userId}`);

            return {
                success: true,
                message: 'User registered successfully',
                user: {
                    id: insertResult.insertId,
                    clerkId: userId,
                    email: userEmail
                }
            };

        } catch (dbError: any) {
            logger.error('Database error during user registration:', dbError);
            throw new InternalServerErrorException('Failed to register user. Please try again.');
        } finally {
            conn.release();
        }
    }

    async getUserByClerkId(clerkId: string) {
        if (!clerkId) {
            throw new UnauthorizedException('Clerk ID is required');
        }

        const conn = await this.pool.getConnection();
        try {
            const [rows] = await conn.query(
                'SELECT id, clerk_id, email, created_at, updated_at FROM users WHERE clerk_id = ?',
                [clerkId]
            );

            const users = rows as any[];
            if (users.length === 0) {
                return null;
            }

            return {
                success: true,
                message: 'User profile fetched successfully',
                user: {
                    id: users[0].id,
                    clerkId: users[0].clerk_id,
                    email: users[0].email,
                    createdAt: users[0].created_at,
                    updatedAt: users[0].updated_at
                }
            };

        } catch (dbError: any) {
            logger.error('Database error fetching user:', dbError);
            throw new InternalServerErrorException('Failed to fetch user data');
        } finally {
            conn.release();
        }
    }
}
