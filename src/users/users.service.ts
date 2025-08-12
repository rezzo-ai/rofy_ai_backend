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
        let firstName = '';
        let lastName = '';

        try {
            // Fetch user details from Clerk to get the email and names
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

            // Fetch first name and last name from Clerk user object
            firstName = clerkUser.firstName || '';
            lastName = clerkUser.lastName || '';

            logger.log(`Fetched user from Clerk: ${clerkUserId} - ${userEmail}, ${firstName} ${lastName}`);
        } catch (err: any) {
            if (err.status === 404) {
                logger.error(`User not found in Clerk: ${clerkUserId}`);
                throw new UnauthorizedException('User not found in Clerk');
            }
            logger.error('Failed to fetch user from Clerk:', err);
            throw new UnauthorizedException('Failed to fetch user details from Clerk');
        }

        // Use Prisma Client for user registration
        // Import prisma client
        const prisma = (await import('../utils/prisma')).default;
        try {
            // Check if user already exists by clerk_id or email
            const existingUser = await prisma.users.findFirst({
                where: {
                    OR: [
                        { clerk_id: clerkUserId },
                        { email: userEmail }
                    ]
                }
            });

            if (existingUser) {
                logger.warn(`User already exists: ${clerkUserId}`);
                return {
                    success: true,
                    message: 'User already registered',
                    user: {
                        id: existingUser.id,
                        clerkId: existingUser.clerk_id,
                        email: existingUser.email,
                        firstName: existingUser.first_name,
                        lastName: existingUser.last_name,
                        createdAt: existingUser.created_at,
                        updatedAt: existingUser.updated_at
                    }
                };
            }

            // Create new user
            const newUser = await prisma.users.create({
                data: {
                    clerk_id: clerkUserId,
                    email: userEmail,
                    first_name: firstName,
                    last_name: lastName
                }
            });

            logger.log(`User registered successfully: ${clerkUserId}`);

            return {
                success: true,
                message: 'User registered successfully',
                user: {
                    id: newUser.id,
                    clerkId: newUser.clerk_id,
                    email: newUser.email,
                    firstName: newUser.first_name,
                    lastName: newUser.last_name,
                    createdAt: newUser.created_at,
                    updatedAt: newUser.updated_at
                }
            };

        } catch (dbError: any) {
            logger.error('Database error during user registration:', dbError);
            throw new InternalServerErrorException('Failed to register user. Please try again.');
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
