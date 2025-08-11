import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_KEY || "",
});

export async function sendMessage(prompt: string, systemPrompt: string, chatId?: string) {
    const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 40000,
        temperature: 0.3,
        system: systemPrompt,
        messages: [
            {
                role: "user",
                content: prompt,
            },
        ],
    });
    return response;
}
