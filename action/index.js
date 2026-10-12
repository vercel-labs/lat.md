import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';

// Find npm's JavaScript entry point so Windows never needs shell interpolation.
function npmCli() {
  for (const directory of (process.env.PATH || '').split(delimiter)) {
    if (!directory) continue;
    const executable = join(
      directory,
      process.platform === 'win32' ? 'npm.cmd' : 'npm',
    );
    if (!existsSync(executable)) continue;
    const actual = realpathSync(executable);
    const candidates = [
      join(dirname(actual), 'node_modules/npm/bin/npm-cli.js'),
      actual.endsWith('npm-cli.js') ? actual : '',
      join(dirname(actual), '../lib/node_modules/npm/bin/npm-cli.js'),
    ];
    for (const candidate of candidates)
      if (candidate && existsSync(candidate)) return candidate;
  }
  throw new Error(
    'npm is required on PATH. Add actions/setup-node before Lat check.',
  );
}

let installation;
try {
  const version = process.env.INPUT_VERSION || 'latest';
  // Accept registry tags and exact versions, never URLs, paths, or package aliases.
  if (
    !/^(?:[A-Za-z][A-Za-z0-9._-]*|\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?)$/.test(
      version,
    )
  ) {
    throw new Error(
      'version must be an exact npm version or a distribution tag such as latest',
    );
  }
  const profile = process.env.INPUT_PROFILE || 'false';
  if (!['true', 'false'].includes(profile))
    throw new Error('profile must be true or false');
  const cwd = resolve(
    process.env.GITHUB_WORKSPACE || process.cwd(),
    process.env['INPUT_WORKING-DIRECTORY'] || '.',
  );
  installation = mkdtempSync(
    join(process.env.RUNNER_TEMP || tmpdir(), 'lat-core-'),
  );
  const installed = spawnSync(
    process.execPath,
    [
      npmCli(),
      'install',
      '--prefix',
      installation,
      '--no-save',
      '--package-lock=false',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--prefer-online',
      '--registry=https://registry.npmjs.org',
      `@lat.md/core@${version}`,
    ],
    { cwd: installation, stdio: 'inherit' },
  );
  if (installed.error) throw installed.error;
  if (installed.status !== 0)
    throw new Error(`Core installation failed (exit ${installed.status})`);
  const runtime = join(installation, 'node_modules/@lat.md/core');
  const manifest = JSON.parse(
    readFileSync(join(runtime, 'package.json'), 'utf8'),
  );
  console.log(`Lat core ${manifest.version}`);
  const result = spawnSync(
    process.execPath,
    [
      join(runtime, 'dist/cli/index.js'),
      'check',
      ...(profile === 'true' ? ['--profile'] : []),
    ],
    {
      cwd,
      stdio: 'inherit',
      env: { ...process.env, NO_COLOR: '1' },
    },
  );
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (installation)
    rmSync(installation, { recursive: true, force: true, maxRetries: 3 });
}
