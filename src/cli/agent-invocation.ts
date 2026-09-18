import { existsSync } from 'node:fs';
import { delimiter, dirname, join } from 'node:path';

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
