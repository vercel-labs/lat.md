import { rm } from 'node:fs/promises';
// Remove modules moved between workspace packages as well as obsolete UI assets.
await rm(new URL('../dist/', import.meta.url), { recursive: true, force: true });
