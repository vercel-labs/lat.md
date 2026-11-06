import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
/** Walk up from this file to find the nearest package.json version. */
export function getLocalVersion() {
    let dir = dirname(fileURLToPath(import.meta.url));
    while (true) {
        const candidate = join(dir, 'package.json');
        try {
            return JSON.parse(readFileSync(candidate, 'utf-8')).version;
        }
        catch { }
        const parent = dirname(dir);
        if (parent === dir)
            return '0.0.0';
        dir = parent;
    }
}
/**
 * Fetch the latest published version of `lat.md` from the npm registry.
 * Returns null if the fetch fails or times out (3s).
 */
export async function fetchLatestVersion() {
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3000);
        const res = await fetch('https://registry.npmjs.org/lat.md/latest', {
            signal: controller.signal,
        });
        clearTimeout(timer);
        if (!res.ok)
            return null;
        const data = (await res.json());
        return data.version ?? null;
    }
    catch {
        return null;
    }
}
