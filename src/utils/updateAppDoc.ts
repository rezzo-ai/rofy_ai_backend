import { db } from './firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

export async function updateAppDoc(chatId: string, details: {
    app_name: string;
    app_description: string;
    app_icon: string;
    app_initial_version: string;
    app_later_version: string;
    app_design_language: string;
}) {
    console.log('updateAppDoc called with:', { chatId, details });
    const docRef = doc(db, 'chats', chatId);
    try {
        await updateDoc(docRef, {
            ...details,
            updated_at: serverTimestamp(),
        });
        console.log('Document updated successfully');
    } catch (error) {
        console.error('Error updating document:', error);
        throw error;
    }
}
