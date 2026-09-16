import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const { parse, stringify } = createRequire(
  new URL('../packages/core/package.json', import.meta.url),
)('yaml');

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, process.argv[2] || '.lat-build/check-action');
// Stage outside the workspace so installing the action cannot install the full CLI.
const stage = await mkdtemp(join(tmpdir(), 'lat-check-action-'));
try {
  const runtime = join(stage, 'runtime');
  await mkdir(runtime);
  await cp(join(root, 'packages/core/dist'), join(runtime, 'dist'), {
    recursive: true,
  });
  await cp(
    join(root, 'packages/core/package.json'),
    join(runtime, 'package.json'),
  );
  const lock = parse(await readFile(join(root, 'pnpm-lock.yaml'), 'utf8'));
  lock.importers = { '.': lock.importers['packages/core'] };
  await writeFile(join(runtime, 'pnpm-lock.yaml'), stringify(lock));
  const runner = process.env.npm_execpath;
  const result = spawnSync(
    runner
      ? process.execPath
      : process.platform === 'win32'
        ? 'pnpm.cmd'
        : 'pnpm',
    [
      ...(runner ? [runner] : []),
      'install',
      '--prod',
      '--frozen-lockfile',
      '--ignore-scripts',
      '--config.node-linker=hoisted',
      '--registry=https://registry.npmjs.org',
    ],
    {
      cwd: runtime,
      stdio: 'inherit',
      shell: !runner && process.platform === 'win32',
    },
  );
  if (result.status !== 0)
    throw result.error || new Error('Action runtime installation failed');
  await rm(join(runtime, 'node_modules/.bin'), {
    recursive: true,
    force: true,
  });
  await rm(join(runtime, 'node_modules/.modules.yaml'), { force: true });
  await rm(join(runtime, 'pnpm-lock.yaml'));
  await cp(join(root, 'action'), join(stage, 'action'), { recursive: true });
  await cp(join(root, 'action.yml'), join(stage, 'action.yml'));
  await cp(join(root, 'LICENSE'), join(stage, 'LICENSE'));
  await writeFile(
    join(stage, 'package.json'),
    JSON.stringify({ private: true, type: 'module' }) + '\n',
  );
  await writeFile(
    join(stage, '.lat-check-action.json'),
    JSON.stringify({ format: 1 }) + '\n',
  );
  // Replace only a known generated artifact directory.
  try {
    const prior = JSON.parse(
      await readFile(join(output, '.lat-check-action.json'), 'utf8'),
    );
    if (prior.format !== 1)
      throw new Error(`Not an action artifact: ${output}`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    if (existsSync(output))
      throw new Error(`Refusing to replace an unmarked directory: ${output}`);
  }
  await rm(output, { recursive: true, force: true });
  await cp(stage, output, { recursive: true });
  console.log(`Built portable check action: ${output}`);
} finally {
  await rm(stage, { recursive: true, force: true });
}
