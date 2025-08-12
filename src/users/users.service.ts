import { Injectable, UnauthorizedException, InternalServerErrorException, Logger } from '@nestjs/common';
import { createClerkClient, verifyToken } from '@clerk/backend';



import { pool as mysqlPool } from '../utils/mysql';
import * as mysql from 'mysql2/promise';
const logger = new Logger('UsersService');

@Injectable()
export class UsersService {
    private clerk: any;


    constructor() {
        // Validate required environment variables
        if (!process.env.CLERK_SECRET_KEY) {
            throw new Error('CLERK_SECRET_KEY must be set in environment variables');
        }

        this.clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
    }

    async registerUser(clerkUserId: string, providedEmail?: string) {
        if (!clerkUserId) {
            throw new UnauthorizedException('Clerk user ID is required');
        }

        let userEmail = '';

        try {
            // Fetch user details from Clerk to get the email
            const clerkUser = await this.clerk.users.getUser(clerkUserId);

            // Get the primary email from Clerk
            const primaryEmail = clerkUser.emailAddresses?.find((email: any) => email.id === clerkUser.primaryEmailAddressId);
            userEmail = primaryEmail?.emailAddress || providedEmail;

            if (!userEmail) {
                throw new UnauthorizedException('No email address found for user');
            }

            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(userEmail)) {
                throw new UnauthorizedException('Invalid email format');
            }

            logger.log(`Fetched email from Clerk for user: ${clerkUserId} - ${userEmail}`);
        } catch (err: any) {
            if (err.status === 404) {
                logger.error(`User not found in Clerk: ${clerkUserId}`);
                throw new UnauthorizedException('User not found in Clerk');
            }
            logger.error('Failed to fetch user from Clerk:', err);
            throw new UnauthorizedException('Failed to fetch user details from Clerk');
        }

        const conn = await mysqlPool.getConnection();
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
                [clerkUserId, userEmail]
            );

            if (Array.isArray(existingUser) && existingUser.length > 0) {
                logger.warn(`User already exists: ${clerkUserId}`);
                return {
                    success: true,
                    message: 'User already registered',
                    user: {
                        id: (existingUser[0] as any).id,
                        clerkId: clerkUserId,
                        email: userEmail
                    }
                };
            }

            // Insert new user
            const [result] = await conn.query(
                'INSERT INTO users (clerk_id, email) VALUES (?, ?)',
                [clerkUserId, userEmail]
            );

            const insertResult = result as mysql.ResultSetHeader;

            logger.log(`User registered successfully: ${clerkUserId}`);

            return {
                success: true,
                message: 'User registered successfully',
                user: {
                    id: insertResult.insertId,
                    clerkId: clerkUserId,
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

        const conn = await mysqlPool.getConnection();
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
