import { afterEach, expect, it } from 'vitest';
import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  rmSync,
  existsSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import { agentInvocation } from '../src/cli/agent-invocation.js';

const directories: string[] = [];
afterEach(() =>
  directories
    .splice(0)
    .forEach((path) => rmSync(path, { recursive: true, force: true })),
);

/** Load a generated template's tool callbacks, stubbing only the agent UI SDK. */
async function loadTools(name: string, entry: string, searchTimeout?: number) {
  let template = readFileSync(
    join(import.meta.dirname, '..', 'templates', name),
    'utf8',
  );
  if (searchTimeout !== undefined) {
    expect(template).toContain('SEARCH_TIMEOUT_MS = 120_000');
    template = template.replace(
      'SEARCH_TIMEOUT_MS = 120_000',
      `SEARCH_TIMEOUT_MS = ${searchTimeout}`,
    );
  }
  template = template.replace('__LAT_INVOCATION__', () =>
    JSON.stringify({ command: process.execPath, args: [entry] }),
  );
  template = template.replace(/^import[\s\S]*?from ["'][^"']+["'];?\s*$/gm, '');
  template = template
    .replace('export default function', 'function register')
    .replace('export const LatPlugin', 'const LatPlugin');
  const callbacks: Record<string, any> = {};
  const tool = Object.assign((value: unknown) => value, {
    schema: { string: () => ({}), optional: () => ({}), number: () => ({}) },
  });
  const childProcess = createRequire(import.meta.url)('node:child_process');
  const sandbox = {
    require: createRequire(import.meta.url),
    process,
    tool,
    execFile: childProcess.execFile,
    execFileSync: childProcess.execFileSync,
    Type: {
      Object: () => ({}),
      String: () => ({}),
      Optional: () => ({}),
      Number: () => ({}),
    },
    pi: {
      registerTool: (value: any) => {
        callbacks[value.name] = value;
      },
      registerMessageRenderer() {},
      on() {},
    },
  };
  const code = stripTypeScriptTypes(template);
  const pi = name.endsWith('pi-extension.ts');
  if (pi) runInNewContext(code + '\nregister(pi);', sandbox);
  else
    Object.assign(
      callbacks,
      (await runInNewContext(code + '\nLatPlugin({});', sandbox)).tool,
    );
  // Both agents run real child processes; only the result envelope differs.
  return async (command: string, args: object): Promise<string> =>
    pi
      ? (await callbacks[`lat_${command}`].execute('test', args)).content[0]
          .text
      : callbacks[`lat_${command}`].execute(args);
}

const templates = ['pi-extension.ts', 'opencode-plugin.ts'];
const commands = ['search', 'section', 'locate', 'expand', 'refs'];
const argsFor = (command: string, input: string) =>
  command === 'expand' ? { text: input } : { query: input };

// @lat: [[tests/init#Generated tools preserve literal arguments]]
it('runs every generated query tool without shell evaluation', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'lat argv '));
  directories.push(directory);
  const entry = join(directory, 'echo args.cjs');
  writeFileSync(
    entry,
    'process.stdout.write(JSON.stringify(process.argv.slice(2)))',
  );
  const marker = join(directory, 'injected');
  const input = `quotes " ' spaces\n$(touch '${marker}') \`touch '${marker}'\` \\`;
  for (const name of templates) {
    const call = await loadTools(name, entry);
    for (const command of commands)
      expect(JSON.parse(await call(command, argsFor(command, input)))).toEqual([
        command,
        input,
      ]);
    expect(existsSync(marker)).toBe(false);
  }
});

// @lat: [[tests/init#Generated tools report CLI failures]]
it('rejects with the CLI message when a generated query tool fails', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'lat fail '));
  directories.push(directory);
  const entry = join(directory, 'fail.cjs');
  writeFileSync(
    entry,
    'process.stderr.write("Building index...key was rejected (401)\\n"); process.exit(1)',
  );
  for (const name of templates) {
    const call = await loadTools(name, entry);
    for (const command of commands)
      await expect(call(command, argsFor(command, 'q'))).rejects.toThrow(
        'Building index...key was rejected (401)',
      );
  }
  // An index build cut off by the timeout must not read as an empty search.
  const slow = join(directory, 'slow.cjs');
  writeFileSync(
    slow,
    'process.stderr.write("Building index..."); setTimeout(() => {}, 60_000)',
  );
  for (const name of templates) {
    const call = await loadTools(name, slow, 500);
    await expect(call('search', { query: 'q' })).rejects.toThrow(
      /lat search timed out after 0\.5s\..*lat search.*\nBuilding index\.\.\./s,
    );
  }
});

it('preserves launcher arguments and command styles without parsing shell strings', () => {
  const local = {
    command: '/node with spaces',
    args: ['--import', 'tsx', '/lat path/index.ts'],
  };
  expect(agentInvocation('local', local)).toEqual(local);
  expect(agentInvocation('global', local, 'linux')).toEqual({
    command: 'lat',
    args: [],
  });
  expect(agentInvocation('global', local, 'win32')).toEqual(local);
  expect(agentInvocation('npx', local, 'linux')).toEqual({
    command: 'npx',
    args: ['lat.md@latest'],
  });
});
