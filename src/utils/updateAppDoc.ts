import { db } from './firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Logger } from '@nestjs/common';

const logger = new Logger('UpdateAppDoc');

interface AppDetails {
    app_name: string;
    app_description: string;
    app_icon: string;
    app_initial_version: string;
    app_later_version: string;
    app_design_language: string;
}

export async function updateAppDoc(chatId: string, details: AppDetails) {
    if (!chatId) {
        throw new Error('Chat ID is required');
    }

    if (!details || typeof details !== 'object') {
        throw new Error('App details are required and must be an object');
    }

    // Validate required fields
    const requiredFields = ['app_name', 'app_description', 'app_icon', 'app_initial_version', 'app_later_version', 'app_design_language'];
    const missingFields = requiredFields.filter(field => !details[field as keyof AppDetails]);

    if (missingFields.length > 0) {
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    logger.log(`Updating app document for chat: ${chatId}`);

    const docRef = doc(db, 'chats', chatId);

    try {
        await updateDoc(docRef, {
            ...details,
            updated_at: serverTimestamp(),
        });

        logger.log(`App document updated successfully for chat: ${chatId}`);
        return { success: true, message: 'Document updated successfully' };
    } catch (error: any) {
        logger.error(`Error updating app document for chat ${chatId}:`, error);
        throw new Error(`Failed to update document: ${error.message}`);
    }
}
