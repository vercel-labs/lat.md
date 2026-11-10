import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const fragment = (path) =>
  /^\.changeset\/[^./][^/]*\.md$/.test(path) &&
  !/^\.changeset\/(README|AGENTS|CLAUDE|GEMINI)\.md$/i.test(path);

// @lat: [[lat.md/knowledge/dev-process#Dev Process#Publishing#Changeset enforcement]]
export function checkChangesets(base, cwd = process.cwd()) {
  const git = (...args) =>
    execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  const mergeBase = git('merge-base', base, 'HEAD');
  const names = (filter) =>
    git(
      'diff',
      '--no-renames',
      '--name-only',
      `--diff-filter=${filter}`,
      mergeBase,
      '--',
    )
      .split('\n')
      .filter(Boolean);
  const added = [
    ...names('A'),
    ...git('ls-files', '--others', '--exclude-standard').split('\n'),
  ].filter(fragment);
  const read = (path) => readFileSync(`${cwd}/${path}`, 'utf8');

  if (added.length) {
    for (const path of added) {
      const match =
        read(path).match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/) ??
        read(path).match(/^---\r?\n()---\r?\n([\s\S]*)$/);
      if (!match || !match[2].trim()) {
        throw new Error(
          `${path}: include a summary, or explain why no release is needed.`,
        );
      }
      const releases = parse(match[1]);
      if (
        releases !== null &&
        (typeof releases !== 'object' ||
          Array.isArray(releases) ||
          Object.values(releases).some(
            (type) => !['patch', 'minor', 'major'].includes(type),
          ))
      ) {
        throw new Error(
          `${path}: expected package names mapped to patch, minor, or major.`,
        );
      }
    }
    return 'New changeset found.';
  }

  // Versioning consumes fragments. Only release metadata may accompany that deletion.
  const changed = names('ACDMRT');
  const removed = names('D').filter(fragment);
  const manifest = /^(?:packages\/[^/]+\/)?package\.json$/;
  const metadata =
    /^(?:(?:packages\/[^/]+\/)?CHANGELOG\.md|pnpm-lock\.yaml|lat\.md\/changelog\.md)$/;
  if (
    removed.length &&
    changed.every(
      (path) =>
        removed.includes(path) || manifest.test(path) || metadata.test(path),
    )
  ) {
    const bumped = new Set();
    for (const path of changed.filter((path) => manifest.test(path))) {
      const before = JSON.parse(git('show', `${mergeBase}:${path}`));
      const after = JSON.parse(read(path));
      const delta = after.version
        .split('.')
        .map(
          (part, index) =>
            Number(part) - Number(before.version.split('.')[index]),
        )
        .find((part) => part !== 0);
      if (!/^\d+\.\d+\.\d+$/.test(after.version) || !(delta > 0)) {
        throw new Error(
          `${path}: a release must increase the package version.`,
        );
      }
      bumped.add(after.name);
      delete before.version;
      delete after.version;
      if (JSON.stringify(before) !== JSON.stringify(after)) {
        throw new Error(
          `${path}: keep non-version package changes in a separate PR with a changeset.`,
        );
      }
    }
    for (const path of removed) {
      const content = git('show', `${mergeBase}:${path}`);
      const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      for (const name of Object.keys(
        frontmatter ? (parse(frontmatter[1]) ?? {}) : {},
      )) {
        if (!bumped.has(name))
          throw new Error(
            `${path}: consumed changeset requires a version bump for ${name}.`,
          );
      }
    }
    return 'Release-only changes consume existing changesets.';
  }
  throw new Error(
    'Add a new changeset with pnpm changeset. For changes needing no release, use pnpm changeset --empty and explain why.',
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const result = checkChangesets(process.argv[2] ?? 'main');
    console.log(result);
    if (result === 'New changeset found.') {
      execFileSync(
        process.execPath,
        [
          fileURLToPath(import.meta.resolve('@changesets/cli/bin.js')),
          'status',
        ],
        { stdio: 'inherit' },
      );
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
