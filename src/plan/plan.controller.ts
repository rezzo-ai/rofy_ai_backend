

import { Controller, Post, Body, Req, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { sendMessage } from '../utils/sendMessage';
import { getSystemPrompt } from '../utils/getSystemPrompt';
import { db } from '../utils/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { updateAppDoc } from '../utils/updateAppDoc';
import { verifyToken } from '@clerk/backend';

@Controller('create-plan')
export class PlanController {
    @Post()
    async createPlan(@Body() body: any, @Req() req: any) {
        // Extract access token from Authorization header
        const authHeader = req.headers['authorization'] || req.headers['Authorization'];
        if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
            throw new UnauthorizedException('Missing or invalid Authorization header.');
        }
        const token = authHeader.slice(7);
        let userId: string | undefined;
        try {
            const payload = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY! });
            userId = payload.sub;
        } catch (err) {
            throw new UnauthorizedException('Invalid or expired token.');
        }
        if (!userId || typeof userId !== 'string') {
            throw new UnauthorizedException('User not found.');
        }
        const { userPrompt } = body;
        if (!userPrompt || typeof userPrompt !== 'string') {
            throw new BadRequestException('userPrompt is required.');
        }
        // Helper to create a chat document in Firestore
        async function createChat(userId: string, userPrompt: string) {
            const docRef = await addDoc(collection(db, 'chats'), {
                created_at: serverTimestamp(),
                updated_at: serverTimestamp(),
                initial_prompt: userPrompt,
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
        const chatDoc = await createChat(userId, userPrompt);
        // Call Anthropic API
        const systemPrompt = getSystemPrompt('makePlan');
        const anthropicResponse = await sendMessage(userPrompt, systemPrompt, chatDoc.id);
        // Update the app document with values from the response
        if (anthropicResponse && anthropicResponse.content && Array.isArray(anthropicResponse.content)) {
            // Find the first content block with type 'text'
            const textBlock = anthropicResponse.content.find((block: any) => block.type === 'text' && typeof block.text === 'string');
            if (textBlock) {
                let contentText = (textBlock as { text: string }).text;
                let parsed: any = null;
                try {
                    // Remove Markdown code block markers if present
                    const cleaned = contentText.replace(/```json|```/g, '').trim();
                    parsed = JSON.parse(cleaned);
                } catch (e) {
                    parsed = null;
                }
                if (parsed && typeof parsed === 'object') {
                    await updateAppDoc(chatDoc.id, {
                        app_name: parsed.appName || '',
                        app_description: parsed.description || '',
                        app_icon: parsed.icon || '',
                        app_initial_version: parsed.initialVersion || '',
                        app_later_version: parsed.laterVersion || '',
                        app_design_language: parsed.designLanguage ? JSON.stringify(parsed.designLanguage) : '',
                    });
                }
            }
        }
        // If response has a 'content' property, return only that
        if (anthropicResponse && anthropicResponse.content) {
            return { chatId: chatDoc.id };
        }
        return { ...anthropicResponse, chatId: chatDoc.id };
    }
}
