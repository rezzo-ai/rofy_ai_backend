import { readFileSync } from 'fs';
import { join } from 'path';

const promptFiles: Record<string, string> = {
    makePlan: 'make-plan.txt',
    executePlan: 'execute-plan.txt',
    buildFeature: 'build-feature.txt',
    // Add more keys and prompt files as needed
};

export function getSystemPrompt(key: string): string {
    const fileName = promptFiles[key];
    if (!fileName) {
        throw new Error(`Prompt for key '${key}' not found.`);
    }
    const promptPath = join(process.cwd(), 'src', 'prompts', fileName);
    return readFileSync(promptPath, 'utf-8');
}
