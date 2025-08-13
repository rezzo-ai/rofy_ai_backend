

import { Controller, Post, Body, Req, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { sendMessage } from '../utils/sendMessage';
import { getSystemPrompt } from '../utils/getSystemPrompt';
import { db } from '../utils/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { updateAppDoc } from '../utils/updateAppDoc';
import { verifyToken } from '@clerk/backend';

@Controller('plan')
export class PlanController {
    @Post('create')
    async createPlan(@Body() body: any, @Req() req: any) {
        // Get userId from middleware
        const userId = req?.userId;
        console.log('User ID:', userId);
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
                app_initial_version: null,
                app_later_version: null,
                app_design_language: ""
            });
            // Add initial message to planMessages subcollection
            await addDoc(collection(docRef, 'planMessages'), {
                created_at: serverTimestamp(),
                message: userPrompt,
                role: "user",
                id: userId,
                session_id: null
            });
            return { id: docRef.id };
        }
        // Store the prompt as the first message in Firestore
        const chatDoc = await createChat(userId, userPrompt);

        return chatDoc.id;
    }

    @Post('get')
    async getPlan(@Body() body: any, @Req() req: any) {
        // Get userId from middleware
        const userId = req?.userId;
        console.log('User ID:', userId);
        if (!userId || typeof userId !== 'string') {
            throw new UnauthorizedException('User not found.');
        }
        const { chatId } = body;
        if (!chatId || typeof chatId !== 'string') {
            throw new BadRequestException('chatId is required.');
        }
        // Fetch chat document from Firestore
        try {
            const chatRef = collection(db, 'chats');
            const { getDoc, doc } = await import('firebase/firestore');
            const docSnap = await getDoc(doc(chatRef, chatId));
            if (!docSnap.exists()) {
                throw new BadRequestException('Chat not found.');
            }
            const chatData = docSnap.data();
            // Optionally, check if chatData.user_id matches userId for security
            if (chatData.user_id !== userId) {
                throw new UnauthorizedException('You do not have access to this chat.');
            }

            //Call Anthropic API
            const systemPrompt = getSystemPrompt('makePlan');
            const anthropicResponse = await sendMessage(chatData.initial_prompt, systemPrompt, chatId, process.env.PLAN_CREATION_MODEL);

            // // Update the app document with values from the response
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
                        await updateAppDoc(chatId, {
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
                return anthropicResponse.content;
            }
        } catch (error) {
            throw error;
        }
    }
}
