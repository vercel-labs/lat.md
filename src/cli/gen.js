import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { findTemplatesDir } from './templates.js';
export function readAgentsTemplate() {
    return readFileSync(join(findTemplatesDir(), 'AGENTS.md'), 'utf-8');
}
export function readCursorRulesTemplate() {
    return readFileSync(join(findTemplatesDir(), 'cursor-rules.md'), 'utf-8');
}
export function readPiExtensionTemplate() {
    return readFileSync(join(findTemplatesDir(), 'pi-extension.ts'), 'utf-8');
}
export function readOpenCodePluginTemplate() {
    return readFileSync(join(findTemplatesDir(), 'opencode-plugin.ts'), 'utf-8');
}
export function readSkillTemplate() {
    return readFileSync(join(findTemplatesDir(), 'skill', 'SKILL.md'), 'utf-8');
}
export async function genCmd(target) {
    const normalized = target.toLowerCase();
    switch (normalized) {
        case 'agents.md':
        case 'claude.md':
            process.stdout.write(readAgentsTemplate());
            break;
        case 'cursor-rules.md':
            process.stdout.write(readCursorRulesTemplate());
            break;
        case 'pi-extension.ts':
            process.stdout.write(readPiExtensionTemplate());
            break;
        case 'opencode-plugin.ts':
            process.stdout.write(readOpenCodePluginTemplate());
            break;
        case 'skill.md':
            process.stdout.write(readSkillTemplate());
            break;
        default:
            console.error(`Unknown target: ${target}. Supported: agents.md, claude.md, cursor-rules.md, pi-extension.ts, opencode-plugin.ts, skill.md`);
            process.exit(1);
    }
}
