import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createClerkClient, verifyToken } from '@clerk/backend';
import * as mysql from 'mysql2/promise';
import { ClerkRequest } from '@clerk/backend/dist/tokens/clerkRequest';

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });

const pool = mysql.createPool({
    host: 'dev-rofy-mysql-nyc1-79282-do-user-6349949-0.i.db.ondigitalocean.com',
    user: 'doadmin',
    password: 'AVNS_Ga8bZ-17NpOnSnNdPrm',
    database: 'defaultdb',
    port: 25060,
    ssl: { rejectUnauthorized: false },
});

@Injectable()
export class UsersService {
    async registerUser(authorization: string, email: string) {
        const token = typeof authorization === 'string' && authorization.startsWith('Bearer ')
            ? authorization.slice(7)
            : authorization;
        let userId = '';
        try {
            const { sub, email_address } = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY });
            console.log('Token payload:', sub, process.env.CLERK_SECRET_KEY, token);
            // userId = (payload as { sub: string }).sub;
        } catch (err) {
            throw new UnauthorizedException('Invalid authorization token.');
        }
        const conn = await pool.getConnection();
        try {
            await conn.query(`CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        clerk_id VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);
            await conn.query(
                'INSERT INTO users (clerk_id, email) VALUES (?, ?)',
                [userId, email]
            );
        } finally {
            conn.release();
        }
        return { userId, email };
    }
}
