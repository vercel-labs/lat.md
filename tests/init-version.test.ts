import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  INIT_VERSION,
  readInitVersion,
  readFileHash,
  contentHash,
  writeInitMeta,
} from '@lat.md/core/init-version';

describe('init-version', () => {
  let latDir: string;

  beforeEach(() => {
    latDir = join(tmpdir(), `lat-test-${Date.now()}-${Math.random()}`);
    mkdirSync(latDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(latDir, { recursive: true, force: true });
  });

  it('readInitVersion returns null when no cache exists', () => {
    expect(readInitVersion(latDir)).toBeNull();
  });

  it('writeInitMeta creates cache dir and writes version', () => {
    writeInitMeta(latDir, {});
    expect(readInitVersion(latDir)).toBe(INIT_VERSION);
  });

  it('stores and retrieves file hashes', () => {
    const hashes = { 'CLAUDE.md': 'abc123', 'AGENTS.md': 'def456' };
    writeInitMeta(latDir, hashes);

    expect(readFileHash(latDir, 'CLAUDE.md')).toBe('abc123');
    expect(readFileHash(latDir, 'AGENTS.md')).toBe('def456');
    expect(readFileHash(latDir, 'missing.md')).toBeNull();
  });

  it('merges hashes across multiple writes', () => {
    writeInitMeta(latDir, { 'CLAUDE.md': 'hash1' });
    writeInitMeta(latDir, { '.cursor/rules/lat.md': 'hash2' });

    expect(readFileHash(latDir, 'CLAUDE.md')).toBe('hash1');
    expect(readFileHash(latDir, '.cursor/rules/lat.md')).toBe('hash2');
  });

  it('overwrites existing hash for same path', () => {
    writeInitMeta(latDir, { 'CLAUDE.md': 'old' });
    writeInitMeta(latDir, { 'CLAUDE.md': 'new' });

    expect(readFileHash(latDir, 'CLAUDE.md')).toBe('new');
  });

  it('contentHash returns consistent SHA-256', () => {
    const hash1 = contentHash('hello world');
    const hash2 = contentHash('hello world');
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 hex

    const different = contentHash('hello world!');
    expect(different).not.toBe(hash1);
  });

  it('readInitVersion handles corrupt JSON gracefully', () => {
    const cacheDir = join(latDir, '.cache');
    mkdirSync(cacheDir, { recursive: true });
    writeFileSync(join(cacheDir, 'lat_init.json'), 'not json');

    expect(readInitVersion(latDir)).toBeNull();
    expect(readFileHash(latDir, 'CLAUDE.md')).toBeNull();
  });
});
