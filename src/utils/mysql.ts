import * as mysql from 'mysql2/promise';
import { Logger } from '@nestjs/common';

const logger = new Logger('MySQL');

// Validate required MySQL environment variables
const requiredEnvVars = [
    'DB_HOST',
    'DB_USER',
    'DB_PASSWORD',
    'DB_NAME',
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
    throw new Error(`Missing required MySQL environment variables: ${missingVars.join(', ')}`);
}

const dbConfig: mysql.PoolOptions = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT || '3306'),
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
    connectionLimit: 10,
};

let pool: mysql.Pool;

try {
    pool = mysql.createPool(dbConfig);
    logger.log('MySQL pool initialized successfully');
} catch (error) {
    logger.error('Failed to initialize MySQL pool:', error);
    throw new Error('MySQL pool initialization failed');
}

export { pool };
