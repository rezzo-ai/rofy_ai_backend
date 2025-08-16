
import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { getSystemPrompt } from '../utils/getSystemPrompt';
import { emitAppPlanTool, AppPlan } from '../claudeTools/emitAppPlan.tool';
import { sendMessageStream } from '../utils/sendMessage';
import { db } from '../utils/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { updateAppDoc } from '../utils/updateAppDoc';

@WebSocketGateway({ namespace: '/plan' })
export class PlanGateway {
    @WebSocketServer()
    server: Server;

    @SubscribeMessage('getPlan')
    async handleGetPlan(@MessageBody() data: { chatId: string }, client: Socket) {
        const chatId = data.chatId;
        // You may want to add userId validation here if needed
        const firestore = await import('firebase/firestore');
        const chatRef = collection(db, 'chats');
        const chatSnap = await firestore.getDoc(firestore.doc(chatRef, chatId));
        if (!chatSnap.exists()) {
            client.emit('planData', { error: 'Chat not found.' });
            return;
        }
        const chatData = chatSnap.data();
        const planMessagesRef = collection(db, 'chats', chatId, 'planMessages');
        const recentMsgsSnap = await firestore.getDocs(
            firestore.query(planMessagesRef, firestore.orderBy('created_at', 'desc'), firestore.limit(40))
        );
        const recentMsgs = recentMsgsSnap.docs.map((d: any) => d.data());
        const latestPlanObj = recentMsgs.find(
            (m: any) => m?.role === 'assistant' && typeof m.message === 'object' && m.message?.intent === 'APP_INTENT'
        )?.message as AppPlan | undefined;

        // Build system prompt (embed CURRENT_PLAN if present)
        const baseSystem = getSystemPrompt('makePlan');
        const systemPrompt = latestPlanObj
            ? `${baseSystem}\n\n<BEGIN_CURRENT_PLAN>\n${JSON.stringify(latestPlanObj, null, 2)}\n<END_CURRENT_PLAN>`
            : baseSystem;

        const userPrompt: string = chatData.initial_prompt || '';

        // Start streaming via shared helper (omit tool_choice to allow suggestions)
        const stream = await sendMessageStream({
            system: systemPrompt,
            userPrompt,
            tools: [emitAppPlanTool],
            temperature: 0.3,
            max_tokens: 4000,
        });

        let sawTool = false;
        let toolName: string | null = null;
        let jsonText = '';
        let suggestionsText = '';

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
                        client.emit('planData', { type: 'json_delta', delta });
                        break;
                    }
                    case 'content_block_delta': {
                        const d = ev.delta;
                        if (d?.type === 'text_delta' && typeof d?.text === 'string' && !sawTool) {
                            suggestionsText += d.text;
                            client.emit('planData', { type: 'suggestions_delta', delta: d.text });
                        }
                        break;
                    }
                    case 'message_stop': {
                        await finalize();
                        break;
                    }
                    case 'error': {
                        client.emit('planData', { type: 'error', message: String(ev.error || 'Unknown error') });
                        break;
                    }
                    default:
                        break;
                }
            } catch (e: any) {
                client.emit('planData', { type: 'error', message: e?.message || 'Stream handler error' });
            }
        });

        // Finalize → persist + end
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

                    client.emit('planData', { type: 'done' });
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
                        client.emit('planData', {
                            type: obj.intent === 'NON_INTENT' ? 'non_intent' : 'policy_block',
                            payload: obj,
                        });
                        client.emit('planData', { type: 'done' });
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
                client.emit('planData', { type: 'suggestions', text: fullText });
                client.emit('planData', { type: 'done' });
            } catch (e: any) {
                client.emit('planData', { type: 'error', message: e?.message || 'Finalize error' });
            }
        };
    }
}