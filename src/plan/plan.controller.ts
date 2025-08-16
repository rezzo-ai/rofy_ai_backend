import { Controller, Post, Body, Req, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { getSystemPrompt } from '../utils/getSystemPrompt';
import { createRandomId } from '../utils/createRandomId';
import { db } from '../utils/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { updateAppDoc } from '../utils/updateAppDoc';
import { emitAppPlanTool, AppPlan } from '../claudeTools/emitAppPlan.tool';

@Controller('plan')
export class PlanController {
    @Post('create')
    async createPlan(@Body() body: any, @Req() req: any) {
        // Get userId from middleware
        const userId = req?.userId;
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
                app_name: '',
                app_description: '',
                app_icon: '',
                app_initial_version: null,
                app_later_version: null,
                app_design_language: ''
            });
            // Add initial message to planMessages subcollection
            await addDoc(collection(docRef, 'planMessages'), {
                created_at: serverTimestamp(),
                message: userPrompt,
                role: 'user',
                user_id: userId,
                id: `msg_${createRandomId()}`, // message_id
                session_id: null
            });
            return { id: docRef.id };
        }

        // Store the prompt as the first message in Firestore
        const chatDoc = await createChat(userId, userPrompt);
        return chatDoc.id ? { chatId: chatDoc.id } : { error: 'Failed to create chat' };
    }

    // @Post('get')
    // async getPlan(@Body() body: any, @Req() req: any) {
    //     // Get userId from middleware
    //     const userId = req?.userId;
    //     if (!userId || typeof userId !== 'string') {
    //         throw new UnauthorizedException('User not found.');
    //     }
    //     const { chatId } = body;
    //     if (!chatId || typeof chatId !== 'string') {
    //         throw new BadRequestException('chatId is required.');
    //     }

    //     try {
    //         const firestore = await import('firebase/firestore');

    //         // Load chat + ownership
    //         const chatRef = collection(db, 'chats');
    //         const docSnap = await firestore.getDoc(firestore.doc(chatRef, chatId));
    //         if (!docSnap.exists()) {
    //             throw new BadRequestException('Chat not found.');
    //         }
    //         const chatData = docSnap.data();
    //         if (chatData.user_id !== userId) {
    //             throw new UnauthorizedException('You do not have access to this chat.');
    //         }

    //         // planMessages ref
    //         const planMessagesRef = collection(db, 'chats', chatId, 'planMessages');

    //         // Idempotency: if last message is already from assistant, return all
    //         const lastMsgQuery = firestore.query(
    //             planMessagesRef,
    //             firestore.orderBy('created_at', 'desc'),
    //             firestore.limit(1)
    //         );
    //         const lastMsgSnap = await firestore.getDocs(lastMsgQuery);
    //         const lastMsgDoc = lastMsgSnap.docs[0];
    //         if (lastMsgDoc?.exists()) {
    //             const lastMsgData = lastMsgDoc.data();
    //             if (lastMsgData.role === 'assistant') {
    //                 const allMsgsSnap = await firestore.getDocs(planMessagesRef);
    //                 return allMsgsSnap.docs.map(doc => doc.data());
    //             }
    //         }

    //         // Get last ~40 messages to find latest plan object (APP_INTENT)
    //         const recentMsgsSnap = await firestore.getDocs(
    //             firestore.query(planMessagesRef, firestore.orderBy('created_at', 'desc'), firestore.limit(40))
    //         );
    //         const recentMsgs = recentMsgsSnap.docs.map(d => d.data());

    //         const latestPlanObj = recentMsgs.find(
    //             (m: any) => m?.role === 'assistant' && typeof m.message === 'object' && m.message?.intent === 'APP_INTENT'
    //         )?.message as AppPlan | undefined;

    //         // Build system prompt (no history; include CURRENT_PLAN if present)
    //         // Use sendMessage.ts for streaming or message handling
    //         const { sendMessage } = await import('../utils/sendMessage');
    //         const baseSystem = getSystemPrompt('makePlan');
    //         const systemPrompt = latestPlanObj
    //             ? `${baseSystem}\n\n<BEGIN_CURRENT_PLAN>\n${JSON.stringify(latestPlanObj, null, 2)}\n<END_CURRENT_PLAN>`
    //             : baseSystem;
    //         const userPrompt: string = chatData.initial_prompt || '';
    //         // You may need to adjust sendMessage params to match your needs

    //         const response = await sendMessage({
    //             system: systemPrompt,
    //             userPrompt,
    //             tools: [emitAppPlanTool],
    //             tool_choice: { type: 'tool', name: 'emit_app_plan' },
    //             model: process.env.PLAN_CREATION_MODEL || 'claude-3-7-sonnet-20250219',
    //         });

    //         // Prefer tool output (plan). If absent, handle text/JSON branches.
    //         const toolUse = (Array.isArray(response.content)
    //             ? response.content.find((b: any) => b.type === 'tool_use' && b.name === 'emit_app_plan')
    //             : null) as { type: 'tool_use'; name: string; input: AppPlan } | null;

    //         if (toolUse?.input) {
    //             // === CASE 1: Plan object (new or edited) ===
    //             const plan = toolUse.input;

    //             // Update parent chat doc (also keeps your existing helper)
    //             if (plan.intent === 'APP_INTENT') {
    //                 await updateAppDoc(chatId, {
    //                     app_name: plan.appName || '',
    //                     app_description: plan.description || '',
    //                     app_icon: plan.icon || '',
    //                     app_initial_version: plan.initialVersion || '',
    //                     app_later_version: plan.laterVersion || '',
    //                     app_design_language: plan.designLanguage ? JSON.stringify(plan.designLanguage) : '',
    //                 });
    //             }

    //             // Store assistant message (structured plan)
    //             await addDoc(planMessagesRef, {
    //                 created_at: serverTimestamp(),
    //                 role: 'assistant',
    //                 message: plan,            // store structured JSON object
    //                 id: response.id,
    //                 intent: 'plan',
    //             });

    //             // Return all messages
    //             const allMsgsSnap = await firestore.getDocs(planMessagesRef);
    //             return allMsgsSnap.docs.map(doc => doc.data());
    //         }

    //         // No tool output → try to read text block
    //         const textBlock = Array.isArray(response?.content)
    //             ? response.content.find((b: any) => b.type === 'text' && typeof b.text === 'string')
    //             : null;

    //         if (!textBlock) {
    //             // Unexpected: nothing to store
    //             const allMsgsSnap = await firestore.getDocs(planMessagesRef);
    //             return allMsgsSnap.docs.map(doc => doc.data());
    //         }

    //         const full = (textBlock as any).text.trim();

    //         // Try detecting NON_INTENT / POLICY_BLOCK JSON (prompt says: return JSON only for those)
    //         const firstBrace = full.indexOf('{');
    //         if (firstBrace >= 0) {
    //             let jsonText = full
    //                 .slice(firstBrace)
    //                 .replace(/^\s*```json\s*/i, '')
    //                 .replace(/\s*```+\s*$/i, '')
    //                 .trim();

    //             let obj: any = null;
    //             try {
    //                 obj = JSON.parse(jsonText);
    //             } catch {
    //                 const lastBrace = jsonText.lastIndexOf('}');
    //                 if (lastBrace > 0) {
    //                     const candidate = jsonText.slice(0, lastBrace + 1);
    //                     try {
    //                         obj = JSON.parse(candidate);
    //                     } catch {
    //                         obj = null;
    //                     }
    //                 }
    //             }

    //             if (obj && (obj.intent === 'NON_INTENT' || obj.intent === 'POLICY_BLOCK')) {
    //                 // === CASE 2: NON_INTENT / POLICY_BLOCK JSON ===
    //                 await addDoc(planMessagesRef, {
    //                     created_at: serverTimestamp(),
    //                     role: 'assistant',
    //                     message: obj, // store JSON blob as-is
    //                     id: `${response.id}_json`,
    //                     intent: obj.intent.toLowerCase(),
    //                 });

    //                 const allMsgsSnap = await firestore.getDocs(planMessagesRef);
    //                 return allMsgsSnap.docs.map(doc => doc.data());
    //             }
    //         }

    //         // === CASE 3: Suggestions branch (fresh start, insufficient detail) ===
    //         await addDoc(planMessagesRef, {
    //             created_at: serverTimestamp(),
    //             role: 'assistant',
    //             message: full, // 4–6 suggestions in user's language (no JSON)
    //             id: `${response.id}_suggestions`,
    //             intent: 'suggestions',
    //         });

    //         const allMsgsSnap = await firestore.getDocs(planMessagesRef);
    //         return allMsgsSnap.docs.map(doc => doc.data());
    //     } catch (err) {
    //         throw err;
    //     }
    // }
}
