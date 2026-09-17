import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { parse } from 'yaml';
import { getConfigPath } from '../config.js';
import { managedCacheBase, managedCacheRoot } from '../cache-path.js';
import { findLatticeDir } from '../project-discovery.js';

/** Describe storage without creating caches, resolving credentials, or invoking Git. */
export function pathsCommand(options: {
  dir?: string;
  config?: boolean;
  search?: boolean;
}): string {
  const lines: string[] = [];
  const code = (value: string) => {
    const text = value.replaceAll('\n', '\\n').replaceAll('\r', '\\r');
    const fence = '`'.repeat(
      Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length)) + 1,
    );
    const padding = text.startsWith('`') || text.endsWith('`') ? ' ' : '';
    return `${fence}${padding}${text}${padding}${fence}`;
  };
  const location = (label: string, path: string, pattern = false) =>
    `- **${label}:** ${code(path)}${pattern || existsSync(path) ? '' : ' (not found)'}`;
  const entry = (
    label: string,
    path: string,
    description: string,
    pattern = false,
  ) => {
    lines.push(location(label, path, pattern));
    lines.push(`  ${description}`);
  };
  const config = getConfigPath();
  if (options.config) {
    return location('Config file', config);
  }
  lines.push('# Paths', '', '## User', '');
  entry(
    'Config file',
    config,
    'User settings: embedding preferences and an optional hosted API key.',
  );
  if (process.env.LAT_LLM_KEY_FILE) {
    entry(
      'API key file',
      resolve(process.env.LAT_LLM_KEY_FILE),
      'Hosted API key selected by LAT_LLM_KEY_FILE; contents are not displayed.',
    );
  }
  entry(
    'Managed Git cache',
    managedCacheBase(),
    'External Git repositories, metadata, and locks, grouped by project hash.',
  );

  const latDir = findLatticeDir(options.dir);
  if (latDir) {
    const projectRoot = dirname(latDir);
    lines.push('', '## Project', '');
    entry('Documentation', latDir, 'Project knowledge graph.');
    entry(
      'Project config',
      join(latDir, 'lat.md'),
      'Canonical external-source configuration in document frontmatter.',
    );
    const localConfig = join(latDir, 'config.local.yaml');
    entry(
      'Local config',
      localConfig,
      'Machine-local external-source checkout and commit overrides.',
    );
    try {
      const local = existsSync(localConfig)
        ? parse(readFileSync(localConfig, 'utf8'))
        : null;
      for (const [handle, value] of Object.entries(
        local?.['external-sources'] ?? {},
      )) {
        const path = (value as { 'local-path'?: unknown } | null)?.[
          'local-path'
        ];
        if (typeof path !== 'string') continue;
        const expanded =
          path === '~'
            ? homedir()
            : path.startsWith('~/')
              ? join(homedir(), path.slice(2))
              : path;
        entry(
          `Local checkout (${handle})`,
          isAbsolute(expanded) ? expanded : resolve(projectRoot, expanded),
          'Configured external working tree; validity is not checked by paths.',
        );
      }
    } catch (error) {
      lines.push(
        `- **Local overrides error:** ${code((error as Error).message)}`,
      );
    }
    try {
      entry(
        'Project Git cache',
        managedCacheRoot(latDir, projectRoot),
        'This project’s managed external Git repositories, <source>.json metadata, and <source>.json.lock directories.',
      );
    } catch (error) {
      lines.push(
        `- **Project Git cache:** unavailable (${code((error as Error).message)})`,
      );
    }
    const cache = join(latDir, '.cache');
    entry(
      'Parsed cache',
      join(cache, 'parsed'),
      'Disposable Markdown, source-code, and external-document parser results.',
    );
    entry(
      'Fetched external files',
      join(cache, 'external'),
      'Downloaded files, <source>.json metadata, and transient <source>.json.lock directories.',
    );
    if (options.search) {
      entry(
        'Search database',
        join(cache, 'search.db'),
        'Published text and embedding index.',
      );
      entry(
        'Search database WAL',
        join(cache, 'search.db-wal'),
        'Turso write-ahead log; checkpointed before database access is released. An empty file may remain.',
      );
      entry(
        'Search staging database',
        join(cache, '_search.db'),
        'Replacement index built before publication.',
      );
      entry(
        'Search writer lock',
        join(cache, 'search-write.lock'),
        'OS lock used to serialize index writers; the file may remain after release.',
      );
      entry(
        'Search access lock',
        join(cache, 'search-access.lock'),
        'Coordinates database queries, incremental copies, and publication; Turso 0.7.2 queries require exclusive access.',
      );
      entry(
        'Search access turnstile',
        join(cache, 'search-access-gate.lock'),
        'Stops new readers bypassing an exclusive accessor waiting for active readers.',
      );
      entry(
        'Initialization state',
        join(cache, 'lat_init.json'),
        'Agent integration version and generated-file hashes.',
      );
      entry(
        'Static UI output',
        join(projectRoot, '.lat-build/static'),
        'Default output of ui build; a custom destination may be specified.',
      );
      entry(
        'Server UI output',
        join(projectRoot, '.lat-build/server'),
        'Default Node output of ui build server; a custom destination may be specified.',
      );
      entry(
        'Vercel UI output',
        join(projectRoot, '.vercel/output'),
        'Default Vercel output of ui build server --target vercel.',
      );
    }
  } else {
    lines.push('', 'No lat.md directory found; project paths are unavailable.');
  }
  return lines.join('\n');
}
