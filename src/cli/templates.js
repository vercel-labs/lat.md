import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
export function findTemplatesDir() {
    let dir = dirname(fileURLToPath(import.meta.url));
    while (true) {
        const candidate = join(dir, 'templates');
        if (existsSync(candidate))
            return candidate;
        const parent = dirname(dir);
        if (parent === dir)
            throw new Error('templates directory not found');
        dir = parent;
    }
}
