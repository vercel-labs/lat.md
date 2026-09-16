#!/usr/bin/env node
import { Command, InvalidArgumentError } from 'commander';
import { createCli, handleResult, packageVersion } from '@lat.md/core/cli';
import { resolveContext } from '@lat.md/core/cli/context';
import {
  DEFAULT_SEARCH_LIMIT,
  DEFAULT_MIN_SIMILARITY,
} from '../search/search.js';
function parsePort(value: string): number {
  if (!/^\d+$/.test(value)) {
    throw new InvalidArgumentError('port must be an integer from 1 to 65535');
  }
  const port = Number(value);
  if (port < 1 || port > 65_535) {
    throw new InvalidArgumentError('port must be an integer from 1 to 65535');
  }
  return port;
}

type UiRunOptions = {
  git: boolean;
  logoText?: string;
  port?: number;
};

type UiServerBuildTarget = 'node' | 'vercel';

function parseUiServerBuildTarget(value: string): UiServerBuildTarget {
  if (value !== 'node' && value !== 'vercel') {
    throw new InvalidArgumentError('target must be node or vercel');
  }
  return value;
}

function configureUiRun(command: Command): Command {
  return command
    .option('--logo-text <text>', 'top-left logo text')
    .option('--no-git', 'disable Git working-tree integration')
    .option(
      '--port <number>',
      'server port (default: 4242; explicit ports are strict)',
      parsePort,
    );
}

function parseSimilarityThreshold(value: string): number {
  const threshold = Number(value);
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
    throw new InvalidArgumentError(
      'min-similarity must be a number from 0 to 1',
    );
  }
  return threshold;
}

const { program, args } = createCli({
  name: 'lat',
  search: true,
  version: packageVersion(import.meta.url),
});
async function runUi(opts: UiRunOptions): Promise<void> {
  const ctx = resolveContext(program.opts());
  const { uiCommand } = await import('./ui.js');
  handleResult(
    await uiCommand(ctx, {
      git: opts.git,
      logoText: opts.logoText,
      port: opts.port,
    }),
  );
}

const ui = configureUiRun(
  program.command('ui').description('Run or build the Lat UI'),
).action(runUi);

configureUiRun(
  ui.command('run').description('Run the local Lat UI server'),
).action(async (opts: UiRunOptions) => {
  await runUi(opts);
});

const uiBuild = ui.command('build').description('Build a deployable Lat UI');

uiBuild
  .command('static')
  .description('Build a fully static, read-only Lat UI')
  .argument(
    '[output]',
    'output directory relative to the project (default: .lat-build/static)',
    '.lat-build/static',
  )
  .option('--base <path>', 'deployment base path', '/')
  .option('--force', 'replace an existing output path')
  .option('--logo-text <text>', 'top-left logo text')
  .action(
    async (
      output: string,
      opts: { base: string; force?: boolean; logoText?: string },
    ) => {
      const ctx = resolveContext(program.opts());
      const { uiBuildCommand } = await import('./ui-build.js');
      handleResult(
        await uiBuildCommand(ctx, output, {
          basePath: opts.base,
          force: opts.force,
          logoText:
            opts.logoText ?? (ui.opts() as { logoText?: string }).logoText,
        }),
      );
    },
  );

uiBuild
  .command('server')
  .description('Build a static Lat UI with a portable search server')
  .argument(
    '[output]',
    'output directory (default: .lat-build/server for node, .vercel/output for vercel)',
  )
  .option('--base <path>', 'deployment base path', '/')
  .option('--force', 'replace an existing output path')
  .option('--logo-text <text>', 'top-left logo text')
  .option(
    '--target <target>',
    'deployment target: node or vercel',
    parseUiServerBuildTarget,
    'node',
  )
  .action(
    async (
      output: string | undefined,
      opts: {
        base: string;
        force?: boolean;
        logoText?: string;
        target: UiServerBuildTarget;
      },
    ) => {
      const ctx = resolveContext(program.opts());
      const { uiBuildServerCommand } = await import('./ui-build-server.js');
      handleResult(
        await uiBuildServerCommand(ctx, output, {
          basePath: opts.base,
          force: opts.force,
          logoText:
            opts.logoText ?? (ui.opts() as { logoText?: string }).logoText,
          target: opts.target,
        }),
      );
    },
  );

program
  .command('search')
  .description('Hybrid search across lat.md sections')
  .argument('[query]', 'search query in plain English')
  .option(
    '--limit <n>',
    `max results (default: ${DEFAULT_SEARCH_LIMIT})`,
    String(DEFAULT_SEARCH_LIMIT),
  )
  .option(
    '--preview <variant>',
    'preview passage, intro, or both',
    (value: string) => {
      if (!['passage', 'intro', 'both'].includes(value))
        throw new InvalidArgumentError(
          'preview must be passage, intro, or both',
        );
      return value;
    },
    'passage',
  )
  .option('--debug', 'show retrieval scores and candidate diagnostics')
  .option(
    '--min-similarity <score>',
    `minimum cosine similarity score (default: ${DEFAULT_MIN_SIMILARITY})`,
    parseSimilarityThreshold,
  )
  .action(
    async (
      query: string | undefined,
      opts: {
        limit: string;
        debug?: boolean;
        minSimilarity?: number;
        preview?: 'passage' | 'intro' | 'both';
      },
    ) => {
      const ctx = resolveContext(program.opts());
      const { searchCommand, cliProgress } = await import('./search.js');
      const progress = cliProgress(ctx.styler);
      const result = await searchCommand(
        ctx,
        query,
        {
          limit: parseInt(opts.limit),
          debug: opts.debug,
          minSimilarity: opts.minSimilarity,
          preview: opts.preview,
        },
        progress,
      );
      handleResult(result);
    },
  );

program
  .command('reindex')
  .description('Rebuild the embedding index; switch backends if needed')
  .option('--local', 'use the local offline model (ignore LAT_LLM_KEY)')
  .option(
    '--remote',
    'use the hosted API from LAT_LLM_KEY (override a local pin)',
  )
  .option('--yes', 'assume yes to prompts (non-interactive)')
  .action(
    async (opts: { local?: boolean; remote?: boolean; yes?: boolean }) => {
      const ctx = resolveContext(program.opts());
      const { reindexCommand } = await import('./reindex.js');
      handleResult(await reindexCommand(ctx, opts));
    },
  );

program
  .command('gen')
  .description(
    'Generate a file to stdout (agents.md, claude.md, cursor-rules.md)',
  )
  .argument(
    '<target>',
    'file to generate: agents.md, claude.md, cursor-rules.md',
  )
  .action(async (target: string) => {
    const { genCmd } = await import('./gen.js');
    await genCmd(target);
  });

program
  .command('init')
  .description('Initialize a lat.md directory')
  .argument('[dir]', 'target directory (default: cwd)')
  .action(async (dir?: string) => {
    const { initCmd } = await import('./init.js');
    await initCmd(dir);
  });

program
  .command('hook')
  .description('Handle agent hook events (called by agent hooks, not directly)')
  .argument('<agent>', 'agent name (claude, cursor)')
  .argument(
    '<event>',
    'hook event (claude: UserPromptSubmit|Stop, cursor: stop)',
  )
  .action(async (agent: string, event: string) => {
    const { hookCmd } = await import('./hook.js');
    await hookCmd(agent, event);
  });

program
  .command('mcp')
  .description('Start the MCP server (stdio transport)')
  .action(async () => {
    const { startMcpServer } = await import('../mcp/server.js');
    await startMcpServer();
  });

await program.parseAsync(args, { from: 'user' });
