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
  for (const name of ['pi-extension.ts', 'opencode-plugin.ts']) {
    let template = readFileSync(
      join(import.meta.dirname, '..', 'templates', name),
      'utf8',
    );
    template = template.replace('__LAT_INVOCATION__', () =>
      JSON.stringify({ command: process.execPath, args: [entry] }),
    );
    // Stub only the agent UI SDK; execute the generated callbacks and real child processes.
    template = template.replace(
      /^import[\s\S]*?from ["'][^"']+["'];?\s*$/gm,
      '',
    );
    template = template
      .replace('export default function', 'function register')
      .replace('export const LatPlugin', 'const LatPlugin');
    const callbacks: Record<string, any> = {};
    const tool = Object.assign((value: unknown) => value, {
      schema: { string: () => ({}), optional: () => ({}), number: () => ({}) },
    });
    const sandbox = {
      require: createRequire(import.meta.url),
      process,
      tool,
      execFileSync: createRequire(import.meta.url)('node:child_process')
        .execFileSync,
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
    if (name.startsWith('pi'))
      runInNewContext(code + '\nregister(pi);', sandbox);
    else
      Object.assign(
        callbacks,
        (await runInNewContext(code + '\nLatPlugin({});', sandbox)).tool,
      );
    for (const command of ['search', 'section', 'locate', 'expand', 'refs']) {
      const args = command === 'expand' ? { text: input } : { query: input };
      const result = name.startsWith('pi')
        ? (await callbacks[`lat_${command}`].execute('test', args)).content[0]
            .text
        : await callbacks[`lat_${command}`].execute(args);
      expect(JSON.parse(result)).toEqual([command, input]);
    }
    expect(existsSync(marker)).toBe(false);
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
