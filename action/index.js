import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const runtime = new URL('../runtime/', import.meta.url);
const manifest = JSON.parse(
  readFileSync(new URL('package.json', runtime), 'utf8'),
);
console.log(`Lat core ${manifest.version}`);
const cwd = resolve(
  process.env.GITHUB_WORKSPACE || process.cwd(),
  process.env['INPUT_WORKING-DIRECTORY'] || '.',
);
const profile = process.env.INPUT_PROFILE || 'false';
if (!['true', 'false'].includes(profile)) {
  console.error('profile must be true or false');
  process.exitCode = 1;
} else {
  const result = spawnSync(
    process.execPath,
    [
      fileURLToPath(new URL('dist/cli/index.js', runtime)),
      'check',
      ...(profile === 'true' ? ['--profile'] : []),
    ],
    { cwd, stdio: 'inherit', env: { ...process.env, NO_COLOR: '1' } },
  );
  if (result.error) console.error(result.error.message);
  process.exitCode = result.status ?? 1;
}
