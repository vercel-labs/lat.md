import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execSync } from 'child_process';
import { parse, toMarkdown } from '@lat.md/core/parser';
import { visit } from 'unist-util-visit';
import type { WikiLink } from '@lat.md/core/extensions/wiki-link/index';

describe('typecheck', () => {
  it('passes tsc --noEmit on the entire codebase', () => {
    execSync('pnpm typecheck', { cwd: import.meta.dirname + '/..' });
  });
});

describe('prettier', () => {
  it('ensures all source files are formatted', () => {
    execSync('pnpm format:check', { cwd: import.meta.dirname + '/..' });
  });
});

describe('lat check', () => {
  it('passes all checks (wiki links + code refs)', () => {
    execSync('node dist/src/cli/index.js check', {
      cwd: import.meta.dirname + '/..',
    });
  });
});

describe('parse', () => {
  it('parses a simple paragraph', () => {
    const tree = parse('Hello world');
    expect(tree.type).toBe('root');
    expect(tree.children).toHaveLength(1);
    expect(tree.children[0].type).toBe('paragraph');
  });

  it('parses headings', () => {
    const tree = parse('# Title\n\n## Subtitle');
    expect(tree.children).toHaveLength(2);
    expect(tree.children[0]).toMatchObject({ type: 'heading', depth: 1 });
    expect(tree.children[1]).toMatchObject({ type: 'heading', depth: 2 });
  });

  it('parses a wiki link', () => {
    const tree = parse('See [[Some Page]]');
    const wikiLinks: WikiLink[] = [];
    visit(tree, 'wikiLink', (node) => {
      wikiLinks.push(node as WikiLink);
    });

    expect(wikiLinks).toHaveLength(1);
    expect(wikiLinks[0].value).toBe('Some Page');
    expect(wikiLinks[0].data.alias).toBeNull();
  });

  it('parses a wiki link with alias', () => {
    const tree = parse('See [[Some Page|display text]]');
    const wikiLinks: WikiLink[] = [];
    visit(tree, 'wikiLink', (node) => {
      wikiLinks.push(node as WikiLink);
    });

    expect(wikiLinks).toHaveLength(1);
    expect(wikiLinks[0].value).toBe('Some Page');
    expect(wikiLinks[0].data.alias).toBe('display text');
  });

  it('parses a wiki link with section path', () => {
    const tree = parse('See [[Tests#Billing#Cancel mid-month]]');
    const wikiLinks: WikiLink[] = [];
    visit(tree, 'wikiLink', (node) => {
      wikiLinks.push(node as WikiLink);
    });

    expect(wikiLinks).toHaveLength(1);
    expect(wikiLinks[0].value).toBe('Tests#Billing#Cancel mid-month');
  });

  it('parses multiple wiki links in one paragraph', () => {
    const tree = parse('See [[Page A]] and [[Page B]]');
    const wikiLinks: WikiLink[] = [];
    visit(tree, 'wikiLink', (node) => {
      wikiLinks.push(node as WikiLink);
    });

    expect(wikiLinks).toHaveLength(2);
    expect(wikiLinks[0].value).toBe('Page A');
    expect(wikiLinks[1].value).toBe('Page B');
  });

  it('does not parse incomplete wiki links', () => {
    const tree = parse('See [not a link] and [[also not');
    const wikiLinks: WikiLink[] = [];
    visit(tree, 'wikiLink', (node) => {
      wikiLinks.push(node as WikiLink);
    });
    expect(wikiLinks).toHaveLength(0);
  });
});

describe('toMarkdown', () => {
  it('round-trips a wiki link', () => {
    const input = 'See [[Some Page]]\n';
    const tree = parse(input);
    const output = toMarkdown(tree);
    expect(output).toBe(input);
  });

  it('round-trips a wiki link with alias', () => {
    const input = 'See [[Some Page|display text]]\n';
    const tree = parse(input);
    const output = toMarkdown(tree);
    expect(output).toBe(input);
  });

  it('round-trips a document with headings and wiki links', () => {
    const input = `# Tests

## Billing

See [[Billing#Cancellation policy]] for details.
`;
    const tree = parse(input);
    const output = toMarkdown(tree);
    expect(output).toBe(input);
  });

  it('round-trips a comprehensive markdown file with all features', async () => {
    const input = await readFile(
      join(import.meta.dirname, 'roundtrip.md'),
      'utf-8',
    );
    const tree = parse(input);
    const output = toMarkdown(tree);
    expect(output).toBe(input);
  });
});
