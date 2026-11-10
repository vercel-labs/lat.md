import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// @lat: [[lat.md/knowledge/dev-process#Dev Process#Publishing#Release Process]]
export function syncChangelog(generated, history) {
  const releases = generated.split(/(?=^## \d+\.\d+\.\d+\s*$)/m).slice(1);
  const additions = releases.filter(
    (entry) => !history.includes(entry.split('\n')[0] + '\n'),
  );
  if (!additions.length) return history;
  const notes = additions
    .map((entry) =>
      entry.trim().replace(/^(#{2,3}) (.+)$/gm, (heading, level, title) => {
        const description =
          level === '##'
            ? `Changes included in Lat ${title}.`
            : {
                'Major Changes': 'Breaking changes in this release.',
                'Minor Changes':
                  'New features and improvements in this release.',
                'Patch Changes':
                  'Fixes and dependency updates in this release.',
              }[title];
        if (!description)
          throw new Error(`Unexpected changelog heading: ${heading}`);
        return `${heading}\n\n${description}`;
      }),
    )
    .join('\n\n');
  const firstRelease = history.search(/^## /m);
  if (firstRelease < 0)
    throw new Error('Public changelog has no release headings.');
  return (
    history.slice(0, firstRelease) +
    notes +
    '\n\n' +
    history.slice(firstRelease)
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const path = 'lat.md/changelog.md';
  writeFileSync(
    path,
    syncChangelog(
      readFileSync('CHANGELOG.md', 'utf8'),
      readFileSync(path, 'utf8'),
    ),
  );
}
