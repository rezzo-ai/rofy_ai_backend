import Anthropic from "@anthropic-ai/sdk";
import { Logger } from '@nestjs/common';

const logger = new Logger('SendMessage');

if (!process.env.ANTHROPIC_KEY) {
    throw new Error('ANTHROPIC_KEY must be set in environment variables');
}

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_KEY,
});

export async function sendMessage(
    prompt: string,
    systemPrompt: string,
    chatId?: string,
    model: string = "claude-sonnet-4-20250514"
) {
    if (!prompt || !systemPrompt) {
        throw new Error('Prompt and system prompt are required');
    }

    try {
        logger.log(`Sending message to Anthropic API${chatId ? ` for chat ${chatId}` : ''}`);

        const response = await anthropic.messages.create({
            model: model,
            max_tokens: 8000,
            temperature: 0.5,
            system: systemPrompt,
            messages: [
                {
                    role: "user",
                    content: prompt,
                },
            ],
        });

        logger.log(`Message sent successfully${chatId ? ` for chat ${chatId}` : ''}`);
        return response;
    } catch (error: any) {
        logger.error('Failed to send message to Anthropic API:', error);
        throw new Error(`Failed to send message: ${error.message}`);
    }
}
