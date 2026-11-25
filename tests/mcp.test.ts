import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { mkdtempSync, cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { rmDirBestEffort } from './util.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { startReplayServer, hasReplayData } from './rag-replay-server.js';
import type { Server } from 'node:http';

const casesDir = join(import.meta.dirname, 'cases');
const cliPath = join(
  import.meta.dirname,
  '..',
  'dist',
  'src',
  'cli',
  'index.js',
);

describe('mcp', () => {
  let client: Client;

  beforeAll(async () => {
    const transport = new StdioClientTransport({
      command: 'node',
      args: [cliPath, 'mcp'],
      cwd: join(casesDir, 'basic-project'),
    });
    client = new Client({ name: 'test', version: '0.1' });
    await client.connect(transport);
  });

  afterAll(async () => {
    await client.close();
  });

  // @lat: [[tests/mcp#Lists all tools]]
  it('lists all tools', async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual([
      'lat_check',
      'lat_expand',
      'lat_external_list',
      'lat_external_show',
      'lat_locate',
      'lat_refs',
      'lat_search',
      'lat_section',
    ]);
  });

  // @lat: [[tests/mcp#lat_locate finds a section]]
  it('lat_locate finds a section', async () => {
    const result = await client.callTool({
      name: 'lat_locate',
      arguments: { query: 'Testing' },
    });
    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(text).toContain('lat.md/dev-process#Dev Process#Testing');
  });

  // @lat: [[tests/mcp#lat_locate returns message for missing section]]
  it('lat_locate returns message for missing section', async () => {
    const result = await client.callTool({
      name: 'lat_locate',
      arguments: { query: 'nonexistent-section-xyz' },
    });
    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(text).toContain('No sections matching');
  });

  // @lat: [[tests/mcp#lat_expand expands refs]]
  it('lat_expand expands refs', async () => {
    const result = await client.callTool({
      name: 'lat_expand',
      arguments: { text: 'Tell me about [[dev-process#Testing]]' },
    });
    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(text).toContain('<lat-context>');
    expect(text).toContain('dev-process#Testing');
  });

  // @lat: [[tests/mcp#lat_expand passes through text without refs]]
  it('lat_expand passes through text without refs', async () => {
    const result = await client.callTool({
      name: 'lat_expand',
      arguments: { text: 'No refs here' },
    });
    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(text).toBe('No refs here');
  });

  // @lat: [[tests/mcp#lat_section shows section content]]
  it('lat_section shows section content with refs', async () => {
    const result = await client.callTool({
      name: 'lat_section',
      arguments: { query: 'notes#Second Topic' },
    });
    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(text).toContain('lat.md/notes#Notes#Second Topic');
    expect(text).toContain('See [[dev-process#Testing]]');
    expect(text).toContain('This section references:');
    expect(text).toContain('lat.md/dev-process#Dev Process#Testing');
  });

  // @lat: [[tests/mcp#lat_section returns message for missing section]]
  it('lat_section returns message for missing section', async () => {
    const result = await client.callTool({
      name: 'lat_section',
      arguments: { query: 'nonexistent-section-xyz' },
    });
    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(text).toContain('No sections matching');
  });

  // @lat: [[tests/mcp#lat_check reports errors]]
  it('lat_check reports errors', async () => {
    const result = await client.callTool({
      name: 'lat_check',
      arguments: {},
    });
    const text = (result.content as { type: string; text: string }[])[0].text;
    // basic-project has no index file, so check should report that
    expect(text).toContain('error');
    expect(result.isError).toBe(true);
  });
});

// @lat: [[tests/mcp#Selects a workspace vault from the Git root]]
it('selects one workspace vault for CLI and MCP commands launched at the Git root', async () => {
  const root = mkdtempSync(join(tmpdir(), 'lat-workspace-mcp-'));
  const client = new Client({ name: 'test', version: '0.1' });
  const target = 'lat.md/lat.md#Overview';
  const api = join('packages', 'api service');
  const web = join('packages', 'web');
  const cli = (args: string[], cwd = root) =>
    spawnSync(process.execPath, [cliPath, '--no-color', ...args], {
      cwd,
      encoding: 'utf8',
    });
  const git = (args: string[]) => execFileSync('git', args, { cwd: root });
  try {
    git(['-c', 'init.templateDir=', 'init', '--quiet']);
    for (const [member, description] of [
      [api, 'API member details.'],
      [web, 'Web member details.'],
    ]) {
      const project = join(root, member);
      mkdirSync(join(project, 'lat.md'), { recursive: true });
      mkdirSync(join(project, 'src'));
      writeFileSync(
        join(project, 'lat.md', 'lat.md'),
        `# Overview\n\n${description} See [[src/app.ts#serve]].\n`,
      );
      const codeRef = ['// @lat:', `[[${target}]]`].join(' ');
      writeFileSync(
        join(project, 'src', 'app.ts'),
        `${codeRef}\nexport function serve() { return ${JSON.stringify(description)}; }\n`,
      );
    }
    git(['add', '-f', '--', 'packages']);

    const missing = cli(['check']);
    expect(missing.status).toBe(1);
    expect(missing.stderr).toContain('--dir <member>');
    const checked = cli(['--dir', api, 'check']);
    expect(checked.status, checked.stdout + checked.stderr).toBe(0);
    expect(checked.stdout).toContain('All checks passed');
    expect(cli(['section', target], join(root, api, 'src')).stdout).toContain(
      'API member details.',
    );
    expect(cli(['--dir', web, 'section', target]).stdout).toContain(
      'Web member details.',
    );

    mkdirSync(join(root, 'lat.md'));
    writeFileSync(
      join(root, 'lat.md', 'lat.md'),
      '# Overview\n\nRoot vault details.\n',
    );
    expect(cli(['section', target]).stdout).toContain('Root vault details.');
    await client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [cliPath, '--dir', api, 'mcp'],
        cwd: root,
      }),
    );
    const section = await client.callTool({
      name: 'lat_section',
      arguments: { query: target },
    });
    expect(section.isError).toBeFalsy();
    const [{ text }] = section.content as { text: string }[];
    expect(text).toContain('API member details.');
    expect(text).not.toMatch(/Web member details|Root vault details/);
    expect(text).toContain('[[src/app.ts#serve]] (src/app.ts:');
    expect(text).toContain('## Referenced by code:');
    expect(text).toContain(join(api, 'src', 'app.ts'));
  } finally {
    await client.close();
    rmDirBestEffort(root);
  }
});

// --- MCP search via RAG replay ---

const replayDir = join(casesDir, 'rag', 'replay-data');
const canRunSearch = hasReplayData(replayDir);

describe('mcp search (rag)', () => {
  let client: Client;
  let server: Server | undefined;
  let tmp: string;

  beforeAll(async () => {
    // Copy rag fixture to tmp so .cache doesn't pollute the repo
    tmp = mkdtempSync(join(tmpdir(), 'lat-mcp-rag-'));
    cpSync(join(casesDir, 'rag'), tmp, { recursive: true });

    const transport = new StdioClientTransport({
      command: 'node',
      args: [cliPath, 'mcp'],
      cwd: tmp,
      env: {
        ...process.env,
        LAT_LLM_KEY: '',
        LAT_LLM_KEY_FILE: '',
        LAT_LLM_KEY_HELPER: '',
        XDG_CONFIG_HOME: tmp,
      },
    });
    client = new Client({ name: 'test', version: '0.1' });
    await client.connect(transport);
  });

  afterAll(async () => {
    await client.close();
    if (server) server.close();
    if (tmp) rmDirBestEffort(tmp);
  });

  // @lat: [[tests/mcp#lat_search finds auth section]]
  it('lat_search finds auth section', async () => {
    const result = await client.callTool({
      name: 'lat_search',
      arguments: { query: 'how do we handle user login and security?' },
    });
    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(text).toContain('Authentication');
  });

  // @lat: [[tests/mcp#lat_search finds performance section]]
  it('lat_search finds performance section', async () => {
    const result = await client.callTool({
      name: 'lat_search',
      arguments: { query: 'what tools do we use to measure response times?' },
    });
    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(text).toContain('Performance');
  });

  // @lat: [[tests/mcp#lat_search works offline without a key]]
  it('lat_search works offline (local model) when no key is set', async () => {
    // Fresh fixture (the shared `tmp` was already indexed remotely by the replay
    // group; a remote index with no key would correctly require a reindex).
    const tmp2 = mkdtempSync(join(tmpdir(), 'lat-mcp-local-'));
    cpSync(join(casesDir, 'rag'), tmp2, { recursive: true });

    const transport2 = new StdioClientTransport({
      command: 'node',
      args: [cliPath, 'mcp'],
      cwd: tmp2,
      env: {
        ...process.env,
        LAT_LLM_KEY: '',
        LAT_LLM_KEY_FILE: '',
        LAT_LLM_KEY_HELPER: '',
        XDG_CONFIG_HOME: tmp2,
      },
    });
    const client2 = new Client({ name: 'test2', version: '0.1' });
    await client2.connect(transport2);

    const result = await client2.callTool({
      name: 'lat_search',
      arguments: { query: 'How are users authenticated with JWT tokens?' },
    });
    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(result.isError).toBeFalsy();
    expect(text).toContain('Authentication');

    await client2.close();
    rmDirBestEffort(tmp2);
  });
});
