import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { Logger } from '@nestjs/common';

const logger = new Logger('Firebase');

// Validate required Firebase environment variables
const requiredEnvVars = [
    'FIREBASE_API_KEY',
    'FIREBASE_AUTH_DOMAIN',
    'FIREBASE_PROJECT_ID',
    'FIREBASE_STORAGE_BUCKET',
    'FIREBASE_MESSAGING_SENDER_ID',
    'FIREBASE_APP_ID'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
    throw new Error(`Missing required Firebase environment variables: ${missingVars.join(', ')}`);
}

const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY!,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN!,
    projectId: process.env.FIREBASE_PROJECT_ID!,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET!,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID!,
    appId: process.env.FIREBASE_APP_ID!,
    measurementId: process.env.FIREBASE_MEASUREMENT_ID,
};

let app;
let db;

try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    logger.log('Firebase initialized successfully');
} catch (error) {
    logger.error('Failed to initialize Firebase:', error);
    throw new Error('Firebase initialization failed');
}

export { db };
