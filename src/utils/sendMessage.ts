// utils/sendMessage.ts
import Anthropic from '@anthropic-ai/sdk';

if (!process.env.ANTHROPIC_KEY) {
    throw new Error('ANTHROPIC_KEY must be set in environment variables');
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_KEY });

export type ClaudeMsg = { role: 'user' | 'assistant'; content: string };

export type SendMessageArgs = {
    system: string;
    userPrompt?: string;                   // for simple one-turn calls
    messages?: ClaudeMsg[];                // optional: full convo you construct
    model?: string;
    tools?: any[];
    tool_choice?: any;
    temperature?: number;
    max_tokens?: number;
};

// Single-shot (no streaming)
export async function sendMessage({
    system,
    userPrompt,
    messages,
    model = process.env.PLAN_CREATION_MODEL || 'claude-3-7-sonnet-20250219',
    tools,
    tool_choice,
    temperature = 0.3,
    max_tokens = 4000,
}: SendMessageArgs) {
    if (!userPrompt && (!messages || messages.length === 0)) {
        throw new Error('sendMessage: Provide userPrompt or messages');
    }

    const payload: any = {
        model,
        temperature,
        max_tokens,
        system,
        messages: messages ?? [{ role: 'user', content: userPrompt! }],
    };

    if (tools) payload.tools = tools;
    if (tool_choice) payload.tool_choice = tool_choice;

    return anthropic.messages.create(payload);
}

// Streaming variant (returns Anthropic stream instance)
export async function sendMessageStream({
    system,
    userPrompt,
    messages,
    model = process.env.PLAN_CREATION_MODEL || 'claude-3-7-sonnet-20250219',
    tools,
    tool_choice, // usually omit to allow suggestions branch
    temperature = 0.3,
    max_tokens = 4000,
}: SendMessageArgs) {
    if (!userPrompt && (!messages || messages.length === 0)) {
        throw new Error('sendMessageStream: Provide userPrompt or messages');
    }

    const payload: any = {
        model,
        temperature,
        max_tokens,
        system,
        messages: messages ?? [{ role: 'user', content: userPrompt! }],
    };

    if (tools) payload.tools = tools;
    if (tool_choice) payload.tool_choice = tool_choice;

    const stream = await anthropic.messages.stream(payload);
    return stream;
}
