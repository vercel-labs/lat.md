import { dirname } from 'node:path';
import { findLatticeDir } from '@lat.md/core/project-discovery';
import { plainStyler, type CmdContext } from '@lat.md/core/context';
import { runSearch } from './search.js';
import { DEFAULT_SEARCH_LIMIT } from '../search/search.js';
import { getSection, formatSectionOutput } from '@lat.md/core/cli/section';
import { commandProjectAnalysis } from '@lat.md/core/project-analysis';

function outputPromptSubmit(context: string): void {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit',
        additionalContext: context,
      },
    }),
  );
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

function makeHookCtx(latDir: string): CmdContext {
  return {
    latDir,
    projectRoot: dirname(latDir),
    styler: plainStyler,
    mode: 'cli',
  };
}

async function searchContextForPrompt(
  ctx: CmdContext,
  userPrompt: string,
): Promise<string | null> {
  let result;
  try {
    // Read-only: search an existing index but never build/update it here. A fresh
    // repo's first prompt must not trigger a full local embed pass — that's what
    // `lat search` / `lat reindex` are for. Returns no matches until then.
    result = await runSearch(
      ctx.latDir,
      userPrompt,
      DEFAULT_SEARCH_LIMIT,
      undefined,
      {
        buildIndex: false,
        project: await commandProjectAnalysis(ctx),
      },
    );
  } catch {
    // No usable backend (e.g. reindex required, key rejected) — skip semantic
    // enrichment silently rather than blocking the user's prompt.
    return null;
  }
  if (result.matches.length === 0) return null;

  const parts: string[] = [
    `Search results for the user prompt (${result.matches.length} matches):`,
    '',
  ];

  for (const match of result.matches) {
    const sectionResult = await getSection(ctx, match.section.id);
    if (sectionResult.kind === 'found') {
      parts.push(formatSectionOutput(ctx, sectionResult));
      parts.push('');
    }
  }

  return parts.join('\n');
}

async function handleUserPromptSubmit(): Promise<void> {
  let userPrompt = '';
  try {
    const raw = await readStdin();
    const input = JSON.parse(raw);
    userPrompt = input.user_prompt ?? input.prompt ?? '';
  } catch {
    // If we can't parse stdin, still emit the reminder
  }

  const parts: string[] = [];

  parts.push(
    "Before starting work, run `lat search` with one or more queries describing the user's intent.",
    'ALWAYS do this, even when the task seems straightforward — search results may reveal critical design details, protocols, or constraints.',
    'Use `lat section` to read the full content of relevant matches.',
    'Do not read files, write code, or run commands until you have searched.',
    '',
    'Remember: `lat.md/` must stay in sync with meaningful codebase state. If you change implemented behavior, architecture, or tests, update the relevant current-state sections and stage the relevant documentation before committing. Agent commits are validated by `lat hook git-pre-commit`; fix reported errors and stage the fixes before retrying. Do not bypass validation with `--no-verify`. Plans may be drafted in `lat.md/` alongside implementation, with the intent that by commit time they describe what was implemented. Otherwise, keep proposals, hypothetical designs, and future work outside `lat.md/` unless the user explicitly requests them there. Do not use `lat.md/` as a journal/changelog or add notes for insignificant details.',
  );

  const latDir = findLatticeDir();
  if (latDir && userPrompt) {
    const ctx = makeHookCtx(latDir);

    // Search for relevant sections and include their full content
    try {
      const searchContext = await searchContextForPrompt(ctx, userPrompt);
      if (searchContext) {
        parts.push('', searchContext);
      }
    } catch {
      // Search failed (no key, index error, etc.) — agent can search manually
    }
  }

  outputPromptSubmit(parts.join('\n'));
}

/** Old stop commands stay harmless while users migrate their agent settings. */
export async function hookCmd(hook: string, event?: string): Promise<void> {
  if (hook === 'git-pre-commit' && event === undefined) {
    const { gitPreCommit } = await import('./git-hook.js');
    process.exitCode = await gitPreCommit();
    return;
  }
  if ((hook === 'claude' || hook === 'codex') && event === 'UserPromptSubmit') {
    await handleUserPromptSubmit();
    return;
  }
  if (
    ((hook === 'claude' || hook === 'codex') && event === 'Stop') ||
    (hook === 'cursor' && event === 'stop')
  )
    return;
  console.error(
    `Unknown hook: ${hook}${event ? ` ${event}` : ''}. Supported: git-pre-commit, claude UserPromptSubmit, codex UserPromptSubmit`,
  );
  process.exitCode = 1;
}
