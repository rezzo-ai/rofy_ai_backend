
import { sendMessage } from '../utils/sendMessage';
import { getSystemPrompt } from '../utils/getSystemPrompt';
import { db } from '../utils/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { updateAppDoc } from '../utils/updateAppDoc';
import express, { Request, Response, NextFunction } from 'express';
import { createClerkClient } from '@clerk/backend';

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });

// Clerk auth middleware for Express
async function clerkAuthMiddleware(req: Request, res: Response, next: NextFunction) {
    try {
        const authHeader = req.headers['authorization'] || '';
        const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
            ? authHeader.slice(7)
            : null;
        if (!token) return res.status(401).json({ error: 'Unauthorized' });
        // Verify the token & extract auth
        const { payload } = await clerk.verifyToken(token);
        const userId = payload.sub;
        // Optional: confirm the user exists (and fetch details)
        const user = await clerk.users.getUser(userId);
        // Attach userId and user to request for downstream handlers
        (req as any).userId = userId;
        (req as any).clerkUser = user;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
}

const router = express.Router();

// POST /create-plan (protected)
router.post('/', clerkAuthMiddleware, async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    console.log('User ID:', userId);
    if (!userId || typeof userId !== 'string') {
        return res.status(401).json({ error: 'User not found.' });
    }

    try {
        const { prompt } = req.body;
        if (!prompt || typeof prompt !== 'string') {
            return res.status(400).json({ error: 'Prompt is required.' });
        }

        // Helper to create a chat document in Firestore
        async function createChat(userId: string, message: string) {
            const docRef = await addDoc(collection(db, 'chats'), {
                created_at: serverTimestamp(),
                updated_at: serverTimestamp(),
                initial_prompt: prompt,
                user_id: userId,
                app_name: "",
                app_description: "",
                app_icon: "",
                app_initial_version: "",
                app_later_version: "",
                app_design_language: ""
            });
            return { id: docRef.id };
        }

        // Store the prompt as the first message in Firestore
        const chatDoc = await createChat(userId, prompt);

        // Call Anthropic API
        const systemPrompt = getSystemPrompt('makePlan');
        const anthropicResponse = await sendMessage(prompt, systemPrompt, chatDoc.id);
        console.log('Anthropic response:', anthropicResponse);

        // Update the app document with values from the response
        if (anthropicResponse && anthropicResponse.content && anthropicResponse.content[0].text) {
            let contentText = anthropicResponse.content[0].text;

            try {
                if (typeof contentText === 'string') {
                    // Remove Markdown code block markers if present
                    contentText = contentText.replace(/```json|```/g, '').trim();
                    contentText = JSON.parse(contentText);
                }
            } catch (e) {
                console.error('Failed to parse contentText as JSON:', e, contentText);
                contentText = {};
            }

            await updateAppDoc(chatDoc.id, {
                app_name: contentText.appName || '',
                app_description: contentText.description || '',
                app_icon: contentText.icon || '',
                app_initial_version: contentText.initialVersion || '',
                app_later_version: contentText.laterVersion || '',
                app_design_language: contentText.designLanguage ? JSON.stringify(contentText.designLanguage) : '',
            });
        }

        // If response has a 'content' property, return only that
        if (anthropicResponse && anthropicResponse.content) {
            return res.json({ chatId: chatDoc.id });
        }
        return res.json({ ...anthropicResponse, chatId: chatDoc.id });
    } catch (error) {
        return res.status(400).json({ error: 'Invalid request.' });
    }
});

export default router;
