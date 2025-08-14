

import { Controller, Post, Body, Req, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { sendMessage } from '../utils/sendMessage';
import { getSystemPrompt } from '../utils/getSystemPrompt';
import { db } from '../utils/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { updateAppDoc } from '../utils/updateAppDoc';

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
        const { createRandomId } = await import('../utils/createRandomId');
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
                user_id: userId,
                id: `msg_${createRandomId()}`, //message_id
                session_id: null,
                message_index: 0
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
        try {
            const chatRef = collection(db, 'chats');
            const firestore = await import('firebase/firestore');
            const docSnap = await firestore.getDoc(firestore.doc(chatRef, chatId));
            if (!docSnap.exists()) {
                throw new BadRequestException('Chat not found.');
            }
            const chatData = docSnap.data();
            if (chatData.user_id !== userId) {
                throw new UnauthorizedException('You do not have access to this chat.');
            }

            // Get the last message from planMessages subcollection
            const planMessagesRef = collection(db, 'chats', chatId, 'planMessages');
            const lastMsgQuery = firestore.query(planMessagesRef, firestore.orderBy('created_at', 'desc'), firestore.limit(1));
            const lastMsgSnap = await firestore.getDocs(lastMsgQuery);
            const lastMsgDoc = lastMsgSnap.docs[0];

            // If last message is from assistant, return all planMessages
            if (lastMsgDoc && lastMsgDoc.exists()) {
                const lastMsgData = lastMsgDoc.data();
                if (lastMsgData.role === 'assistant') {
                    const allMsgsSnap = await firestore.getDocs(planMessagesRef);
                    return allMsgsSnap.docs.map(doc => doc.data());
                }
            }

            // Proceed with Claude API and Firestore update
            const systemPrompt = getSystemPrompt('makePlan');
            const anthropicResponse = await sendMessage(chatData.initial_prompt, systemPrompt, chatId, process.env.PLAN_CREATION_MODEL);

            if (anthropicResponse && anthropicResponse.content && Array.isArray(anthropicResponse.content)) {
                const textBlock = anthropicResponse.content.find((block: any) => block.type === 'text' && 'text' in block && typeof block.text === 'string');
                let parsed: any = null;

                if (textBlock && 'text' in textBlock && typeof textBlock.text === 'string') {
                    let contentText = textBlock.text;
                    try {
                        const cleaned = contentText.replace(/```json|```/g, '').trim();
                        parsed = JSON.parse(cleaned);
                    } catch (e) {
                        parsed = null;
                    }
                    if (parsed && typeof parsed === 'object') {
                        if (parsed.intent == "APP_INTENT") {
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

                    // Add message to planMessages subcollection
                    await addDoc(collection(db, 'chats', chatId, 'planMessages'), {
                        created_at: serverTimestamp(),
                        message: parsed ? parsed : textBlock.text,
                        role: anthropicResponse.role,
                        id: anthropicResponse.id,
                        message_index: 1
                    });

                    // After insertion, return all planMessages
                    const allMsgsSnap = await firestore.getDocs(planMessagesRef);
                    return allMsgsSnap.docs.map(doc => doc.data());
                }
            }

            // If response has a 'content' property, return all planMessages
            if (anthropicResponse && anthropicResponse.content) {
                const allMsgsSnap = await firestore.getDocs(planMessagesRef);
                return allMsgsSnap.docs.map(doc => doc.data());
            }
        } catch (err) {
            throw err;
        }
    }
}
