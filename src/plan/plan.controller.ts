import {
    Controller,
    Post,
    Body,
    Req,
    UnauthorizedException,
    BadRequestException,
    Sse,
    MessageEvent,
    Query,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { getSystemPrompt } from '../utils/getSystemPrompt';
import { createRandomId } from '../utils/createRandomId';
import { db } from '../utils/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { updateAppDoc } from '../utils/updateAppDoc';
import { emitAppPlanTool, AppPlan } from '../claudeTools/emitAppPlan.tool';
import { sendMessageStream } from 'src/utils/sendMessage';

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

    // SSE streaming endpoint
    @Sse('get')
    sseGetPlan(@Query('chatId') chatId: string, @Req() req: any): Observable<MessageEvent> {
        const userId = req?.userId;
        if (!userId || typeof userId !== 'string') throw new UnauthorizedException('User not found.');
        if (!chatId || typeof chatId !== 'string') throw new BadRequestException('chatId is required.');

        return new Observable<MessageEvent>((observer) => {
            (async () => {
                const firestore = await import('firebase/firestore');

                // 1) Load chat + ownership
                const chatRef = collection(db, 'chats');
                const chatSnap = await firestore.getDoc(firestore.doc(chatRef, chatId));
                if (!chatSnap.exists()) throw new BadRequestException('Chat not found.');
                const chatData = chatSnap.data();
                if (chatData.user_id !== userId) throw new UnauthorizedException('You do not have access to this chat.');

                // 2) planMessages ref
                const planMessagesRef = collection(db, 'chats', chatId, 'planMessages');

                // 3) Find the latest APP_INTENT plan for CURRENT_PLAN
                const recentMsgsSnap = await firestore.getDocs(
                    firestore.query(planMessagesRef, firestore.orderBy('created_at', 'desc'), firestore.limit(40))
                );
                const recentMsgs = recentMsgsSnap.docs.map((d) => d.data());
                const latestPlanObj = recentMsgs.find(
                    (m: any) => m?.role === 'assistant' && typeof m.message === 'object' && m.message?.intent === 'APP_INTENT'
                )?.message as AppPlan | undefined;

                // 4) Build system prompt (embed CURRENT_PLAN if present)
                const baseSystem = getSystemPrompt('makePlan'); // your tool-aware prompt with "suggestions" branch
                const systemPrompt = latestPlanObj
                    ? `${baseSystem}\n\n<BEGIN_CURRENT_PLAN>\n${JSON.stringify(latestPlanObj, null, 2)}\n<END_CURRENT_PLAN>`
                    : baseSystem;

                const userPrompt: string = chatData.initial_prompt || '';

                // 5) Start streaming via shared helper (omit tool_choice to allow suggestions)
                const stream = await sendMessageStream({
                    system: systemPrompt,
                    userPrompt,
                    tools: [emitAppPlanTool],
                    // tool_choice: { type: 'tool', name: 'emit_app_plan' }, // keep OMITTED for suggestions path
                    temperature: 0.3,
                    max_tokens: 4000,
                });

                // Accumulators
                let sawTool = false;
                let toolName: string | null = null;
                let jsonText = '';
                let suggestionsText = '';

                // Forward Anthropic events as SSE
                stream.on('streamEvent', async (ev: any) => {
                    try {
                        switch (ev.type) {
                            case 'content_block_start': {
                                if (ev.content_block?.type === 'tool_use') {
                                    sawTool = true;
                                    toolName = ev.content_block?.name || null;
                                }
                                break;
                            }

                            case 'input_json_delta': {
                                const delta = ev.delta ?? '';
                                jsonText += delta;
                                observer.next({ data: { type: 'json_delta', delta } });
                                break;
                            }

                            case 'content_block_delta': {
                                const d = ev.delta;
                                if (d?.type === 'text_delta' && typeof d?.text === 'string' && !sawTool) {
                                    suggestionsText += d.text;
                                    observer.next({ data: { type: 'suggestions_delta', delta: d.text } });
                                }
                                break;
                            }

                            case 'message_stop': {
                                await finalize();
                                break;
                            }

                            case 'error': {
                                observer.next({ data: { type: 'error', message: String(ev.error || 'Unknown error') } });
                                break;
                            }

                            default:
                                break;
                        }
                    } catch (e: any) {
                        observer.next({ data: { type: 'error', message: e?.message || 'Stream handler error' } });
                    }
                });

                // Finalize → persist + end SSE
                const finalize = async () => {
                    try {
                        const final = await stream.finalMessage();

                        if (sawTool && toolName === 'emit_app_plan') {
                            // PLAN: extract tool payload
                            const toolUse = final.content.find(
                                (b: any) => b.type === 'tool_use' && b.name === 'emit_app_plan'
                            ) as { type: 'tool_use'; name: string; input: AppPlan } | undefined;

                            const plan = toolUse?.input;
                            if (!plan) throw new Error('Tool finished without payload');

                            // Save plan
                            await addDoc(planMessagesRef, {
                                created_at: serverTimestamp(),
                                role: 'assistant',
                                message: plan,
                                id: final.id,
                                message_index: 1,
                                kind: 'plan',
                            });

                            // Update parent chat doc
                            await updateAppDoc(chatId, {
                                app_name: plan.appName || '',
                                app_description: plan.description || '',
                                app_icon: plan.icon || '',
                                app_initial_version: plan.initialVersion ? JSON.stringify(plan.initialVersion) : '',
                                app_later_version: plan.laterVersion ? JSON.stringify(plan.laterVersion) : '',
                                app_design_language: plan.designLanguage ? JSON.stringify(plan.designLanguage) : '',
                            });

                            observer.next({ data: { type: 'done' } });
                            observer.complete();
                            return;
                        }

                        // Else: suggestions or NON_INTENT/POLICY JSON
                        const textBlock = final.content.find(
                            (b: any) => b.type === 'text'
                        ) as { type: 'text'; text: string } | undefined;
                        const fullText = (textBlock?.text || suggestionsText || '').trim();

                        // Try NON_INTENT / POLICY JSON
                        const brace = fullText.indexOf('{');
                        if (brace >= 0) {
                            let blob = fullText
                                .slice(brace)
                                .replace(/^\s*```json\s*/i, '')
                                .replace(/\s*```+\s*$/i, '')
                                .trim();
                            let obj: any = null;
                            try {
                                obj = JSON.parse(blob);
                            } catch {
                                const last = blob.lastIndexOf('}');
                                if (last > 0) {
                                    try {
                                        obj = JSON.parse(blob.slice(0, last + 1));
                                    } catch { }
                                }
                            }

                            if (obj && (obj.intent === 'NON_INTENT' || obj.intent === 'POLICY_BLOCK')) {
                                await addDoc(planMessagesRef, {
                                    created_at: serverTimestamp(),
                                    role: 'assistant',
                                    message: obj,
                                    id: `${final.id}_json`,
                                    message_index: 1,
                                    kind: obj.intent.toLowerCase(),
                                });
                                observer.next({
                                    data: {
                                        type: obj.intent === 'NON_INTENT' ? 'non_intent' : 'policy_block',
                                        payload: obj,
                                    },
                                });
                                observer.next({ data: { type: 'done' } });
                                observer.complete();
                                return;
                            }
                        }

                        // Fall back to suggestions
                        await addDoc(planMessagesRef, {
                            created_at: serverTimestamp(),
                            role: 'assistant',
                            message: fullText,
                            id: `${final.id}_suggestions`,
                            message_index: 1,
                            kind: 'suggestions',
                        });
                        observer.next({ data: { type: 'suggestions', text: fullText } });
                        observer.next({ data: { type: 'done' } });
                        observer.complete();
                    } catch (e: any) {
                        observer.next({ data: { type: 'error', message: e?.message || 'Finalize error' } });
                        observer.complete();
                    }
                };
            })().catch((e) => {
                observer.next({ data: { type: 'error', message: String(e) } });
                observer.complete();
            });
        });
    }
}
