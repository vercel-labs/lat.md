import { existsSync } from 'node:fs';
import { delimiter, dirname, join, resolve } from 'node:path';

export interface AgentInvocation {
  command: string;
  args: string[];
}

/** Generated tools pass user input as argv, never as shell program text. */
export function agentInvocation(
  style: 'local' | 'global' | 'npx',
  local: AgentInvocation,
  platform = process.platform,
): AgentInvocation {
  if (style === 'local') return local;
  // Windows npm command shims require cmd.exe. Use the installed entry point
  // directly instead, retaining the Node launcher and its loader arguments.
  if (style === 'global')
    return platform === 'win32' ? local : { command: 'lat', args: [] };
  if (platform !== 'win32') return { command: 'npx', args: ['lat.md@latest'] };

  const directories = [
    dirname(process.execPath),
    ...(process.env.PATH ?? '').split(delimiter),
  ];
  for (const directory of directories) {
    const cli = join(directory, 'node_modules', 'npm', 'bin', 'npx-cli.js');
    if (existsSync(cli))
      return { command: process.execPath, args: [cli, 'lat.md@latest'] };
  }
  throw new Error(
    'Cannot find the npm npx entry point. Choose the local command style or install npm.',
  );
}

/**
 * Return the loader-related flags from `process.execArgv`, stripping
 * `--eval`/`-e`/`--print`/`-p` and their value arguments (those only
 * appear when the process was started with `node -e`/`-p`).
 */
function loaderExecArgs(): string[] {
  const raw = process.execArgv;
  const args: string[] = [];
  for (let i = 0; i < raw.length; i++) {
    if (
      raw[i] === '--eval' ||
      raw[i] === '-e' ||
      raw[i] === '--print' ||
      raw[i] === '-p'
    ) {
      i++; // skip the value argument
    } else {
      args.push(raw[i]);
    }
  }
  return args;
}

/**
 * Reconstruct the executable and arguments used to invoke this process.
 *
 * Node script entry points must keep their Node launcher. Build output from
 * `tsc` is not executable by default, even when it retains a shebang.
 *
 * When running via a TypeScript loader like tsx, the script itself can't be
 * executed directly — we need to replay the same node flags that loaded tsx.
 * Wrapper scripts and standalone binaries are already executable and can be
 * invoked directly.
 */
export function resolveLatInvocation(): { command: string; args: string[] } {
  const script = resolve(process.argv[1]);
  const isTypeScript = /\.[cm]?ts$/.test(script);
  const isJavaScript = /\.[cm]?js$/.test(script);
  if (!isTypeScript && !isJavaScript) {
    return { command: script, args: [] };
  }

  return {
    command: process.execPath,
    args: [...(isTypeScript ? loaderExecArgs() : []), script],
  };
}
