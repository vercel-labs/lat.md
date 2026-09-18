import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import { resolveCheckContext, resolveContext } from './context.js';
import type { CmdResult } from '../context.js';

type CheckTargetArgs = { args: string[]; target?: string };
/** Reserve `-- <directory>` for an explicit check target. */
function splitCheckTarget(args: string[], name: string): CheckTargetArgs {
  let commandIndex = -1;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--dir') {
      i++;
      continue;
    }
    if (arg.startsWith('--dir=')) continue;
    if (arg.startsWith('-')) continue;
    commandIndex = i;
    break;
  }

  if (commandIndex === -1 || args[commandIndex] !== 'check') {
    return { args };
  }

  const separatorIndex = args.indexOf('--', commandIndex + 1);
  if (separatorIndex === -1) return { args };

  const targets = args.slice(separatorIndex + 1);
  if (targets.length !== 1 || targets[0] === '') {
    console.error(
      `error: \`${name} check --\` expects exactly one directory after \`--\``,
    );
    process.exit(1);
  }

  return {
    args: args.slice(0, separatorIndex),
    target: targets[0],
  };
}

export function packageVersion(moduleUrl: string): string {
  let dir = dirname(fileURLToPath(moduleUrl));
  while (true) {
    const candidate = join(dir, 'package.json');
    try {
      return JSON.parse(readFileSync(candidate, 'utf-8')).version;
    } catch {}
    const parent = dirname(dir);
    if (parent === dir) return '0.0.0';
    dir = parent;
  }
}

export function handleResult(result: CmdResult): void {
  if (result.isError) {
    console.error(result.output);
    process.exit(1);
  }
  if (result.output) console.log(result.output);
}

export function createCli({
  name,
  version,
  args = process.argv.slice(2),
  search = false,
}: {
  name: string;
  version: string;
  args?: string[];
  search?: boolean;
}) {
  if (args.includes('--verbose')) process.noDeprecation = false;
  else process.noDeprecation = true;
  const checkTargetArgs = splitCheckTarget(args, name);
  const program = new Command();

  program
    .name(name)
    .description(
      'Anchor source code to high-level concepts defined in markdown',
    )
    .version(version)
    .option('--dir <path>', 'project root to look for lat.md in (default: cwd)')
    .option('--no-color', 'disable color output')
    .option('--verbose', 'show deprecation warnings and extra diagnostics');

  program
    .command('locate')
    .description('Find sections by id')
    .argument('<query>', 'section id to search for')
    .action(async (query: string) => {
      const ctx = {
        ...resolveContext(program.opts()),
        cliName: name,
        searchAvailable: search,
      };
      const { locateCommand } = await import('./locate.js');
      handleResult(await locateCommand(ctx, query));
    });

  program
    .command('section')
    .description(
      'Show a section with its content, outgoing refs, and incoming refs',
    )
    .argument('<query>', 'section id to look up')
    .action(async (query: string) => {
      const ctx = {
        ...resolveContext(program.opts()),
        cliName: name,
        searchAvailable: search,
      };
      const { sectionCommand } = await import('./section.js');
      handleResult(await sectionCommand(ctx, query));
    });

  program
    .command('refs')
    .description('Find references to a section')
    .argument('<query>', 'section id to find references for')
    .option(
      '--scope <scope>',
      'where to search: md, code, or md+code',
      'md+code',
    )
    .action(async (query: string, opts: { scope: string }) => {
      const scope = opts.scope;
      if (scope !== 'md' && scope !== 'code' && scope !== 'md+code') {
        console.error(`Unknown scope: ${scope}. Use md, code, or md+code.`);
        process.exit(1);
      }
      const ctx = {
        ...resolveContext(program.opts()),
        cliName: name,
        searchAvailable: search,
      };
      const { refsCommand } = await import('./refs.js');
      handleResult(await refsCommand(ctx, query, scope));
    });

  const external = program
    .command('external')
    .description('Manage pinned external source repositories');

  external
    .command('add')
    .argument('[handle]', 'stable external source handle')
    .argument('[repo]', 'canonical HTTPS Git repository')
    .option('--commit <commit-or-ref>', 'commit, branch, or tag to pin')
    .option('--prefix <path>', 'repository path prefix')
    .option(
      '--default-file-extension <extension>',
      'extension for external paths that omit one',
    )
    .option('--strategy <strategy>', 'retrieval strategy: fetch or checkout')
    .option('--fetch-url <template>', 'raw-file URL template')
    .action(
      async (
        handle: string | undefined,
        repo: string | undefined,
        opts: {
          commit?: string;
          prefix?: string;
          defaultFileExtension?: string;
          strategy?: string;
          fetchUrl?: string;
        },
      ) => {
        const ctx = {
          ...resolveContext(program.opts()),
          cliName: name,
          searchAvailable: search,
        };
        const { externalAddCommand } = await import('./external.js');
        handleResult(await externalAddCommand(ctx, handle, repo, opts));
      },
    );

  external
    .command('show')
    .argument('<source>', 'handle or exact external target')
    .option('--json', 'emit structured JSON')
    .action(async (source: string, opts: { json?: boolean }) => {
      const ctx = {
        ...resolveContext(program.opts()),
        cliName: name,
        searchAvailable: search,
      };
      const { externalShowCommand } = await import('./external.js');
      handleResult(await externalShowCommand(ctx, source, !!opts.json));
    });

  external
    .command('list')
    .option('--json', 'emit structured JSON')
    .action(async (opts: { json?: boolean }) => {
      const ctx = {
        ...resolveContext(program.opts()),
        cliName: name,
        searchAvailable: search,
      };
      const { externalListCommand } = await import('./external.js');
      handleResult(await externalListCommand(ctx, !!opts.json));
    });

  const check = program
    .command('check')
    .usage('[subcommand] [-- <directory>]')
    .description('Validate markdown, links, code references, and structure')
    .option('--profile', 'show detailed validation timing')
    .action(async (opts: { profile?: boolean }) => {
      const ctx = resolveCheckContext(program.opts(), checkTargetArgs.target);
      const { checkAllCommand } = await import('./check.js');
      handleResult(await checkAllCommand(ctx, { profile: !!opts.profile }));
    });

  check
    .command('md')
    .usage('[-- <directory>]')
    .description('Validate wiki links in markdown files')
    .action(async () => {
      const ctx = resolveCheckContext(program.opts(), checkTargetArgs.target);
      const { checkMdCommand } = await import('./check.js');
      handleResult(await checkMdCommand(ctx));
    });

  check
    .command('links')
    .usage('[-- <directory>]')
    .description('Validate relative markdown links')
    .action(async () => {
      const ctx = resolveCheckContext(program.opts(), checkTargetArgs.target);
      const { checkLinksCommand } = await import('./check.js');
      handleResult(await checkLinksCommand(ctx));
    });

  check
    .command('code-refs')
    .usage('[-- <directory>]')
    .description('Validate @lat code references and coverage')
    .action(async () => {
      const ctx = resolveCheckContext(program.opts(), checkTargetArgs.target);
      const { checkCodeRefsCommand } = await import('./check.js');
      handleResult(await checkCodeRefsCommand(ctx));
    });

  check
    .command('index')
    .usage('[-- <directory>]')
    .description('Validate directory index files')
    .action(async () => {
      const ctx = resolveCheckContext(program.opts(), checkTargetArgs.target);
      const { checkIndexCommand } = await import('./check.js');
      handleResult(await checkIndexCommand(ctx));
    });

  check
    .command('sections')
    .usage('[-- <directory>]')
    .description('Validate section leading paragraphs')
    .action(async () => {
      const ctx = resolveCheckContext(program.opts(), checkTargetArgs.target);
      const { checkSectionsCommand } = await import('./check.js');
      handleResult(await checkSectionsCommand(ctx));
    });

  async function runExpand(
    text: string | undefined,
    opts: { stdin?: boolean },
  ): Promise<void> {
    if (opts.stdin) {
      const chunks: Buffer[] = [];
      for await (const chunk of process.stdin) {
        chunks.push(chunk);
      }
      text = Buffer.concat(chunks).toString('utf-8');
    }
    if (!text) {
      console.error('Provide text as an argument or use --stdin');
      process.exit(1);
    }
    const ctx = {
      ...resolveContext(program.opts()),
      cliName: name,
      searchAvailable: search,
    };
    const { expandCommand } = await import('./expand.js');
    const result = await expandCommand(ctx, text);
    if (result.isError) {
      console.error(result.output);
      process.exit(1);
    }
    // Use stdout.write (no trailing newline) for piping
    process.stdout.write(result.output);
  }

  program
    .command('expand')
    .description('Expand [[refs]] in text to lat.md section locations')
    .argument('[text]', 'text containing [[refs]]')
    .option('--stdin', 'read text from stdin')
    .action(runExpand);

  // Deprecated alias — hidden from --help
  program
    .command('prompt', { hidden: true })
    .argument('[text]')
    .option('--stdin')
    .action(async (text: string | undefined, opts: { stdin?: boolean }) => {
      console.error(
        `Warning: \`${name} prompt\` is deprecated, use \`${name} expand\` instead.`,
      );
      await runExpand(text, opts);
    });

  program
    .command('paths')
    .description('Show configuration, cache, and temporary file locations')
    .option('--config', 'show only the user configuration file path')
    .action(async (options: { config?: boolean }) => {
      const { pathsCommand } = await import('./paths.js');
      console.log(pathsCommand({ ...program.opts(), ...options, search }));
    });

  program
    .command('config', { hidden: true })
    .description('Alias for paths --config')
    .action(async () => {
      const { pathsCommand } = await import('./paths.js');
      console.log(pathsCommand({ config: true }));
    });

  return { program, args: checkTargetArgs.args };
}
