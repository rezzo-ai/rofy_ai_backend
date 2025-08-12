import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { Logger } from '@nestjs/common';

const logger = new Logger('GetSystemPrompt');

const promptFiles: Record<string, string> = {
    makePlan: 'make-plan.txt',
    executePlan: 'execute-plan.txt',
    buildFeature: 'build-feature.txt',
    orchestrator: 'orchestrator.txt',
    // Add more keys and prompt files as needed
};

export function getSystemPrompt(key: string): string {
    if (!key) {
        throw new Error('Prompt key is required');
    }

    const fileName = promptFiles[key];
    if (!fileName) {
        logger.error(`Prompt key '${key}' not found. Available keys: ${Object.keys(promptFiles).join(', ')}`);
        throw new Error(`Prompt for key '${key}' not found. Available keys: ${Object.keys(promptFiles).join(', ')}`);
    }

    const promptPath = join(process.cwd(), 'prompts', fileName);

    if (!existsSync(promptPath)) {
        logger.error(`Prompt file not found at path: ${promptPath}`);
        throw new Error(`Prompt file '${fileName}' not found at path: ${promptPath}`);
    }

    try {
        const content = readFileSync(promptPath, 'utf-8');
        logger.log(`Successfully loaded prompt: ${key}`);
        return content;
    } catch (error: any) {
        logger.error(`Failed to read prompt file '${fileName}':`, error);
        throw new Error(`Failed to read prompt file '${fileName}': ${error.message}`);
    }
}

export function getAvailablePrompts(): string[] {
    return Object.keys(promptFiles);
}
