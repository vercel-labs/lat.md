/**
 * mdast-util extension to serialize wiki-link nodes back to markdown.
 */

import type { Parents } from 'mdast';
import type { Options, State, Info } from 'mdast-util-to-markdown';
import type { WikiLink } from './types.js';

function handler(
  node: WikiLink,
  _parent: Parents | undefined,
  state: State,
  _info: Info,
): string {
  const exit = state.enter('wikiLink');
  const target = state.safe(node.value, { before: '[', after: ']' });

  let value: string;
  if (node.data.alias) {
    const alias = state.safe(node.data.alias, { before: '[', after: ']' });
    value = `[[${target}|${alias}]]`;
  } else {
    value = `[[${target}]]`;
  }

  exit();
  return value;
}

export function wikiLinkToMarkdown(): Options {
  return {
    unsafe: [
      { character: '[', inConstruct: ['phrasing', 'label', 'reference'] },
      { character: ']', inConstruct: ['label', 'reference'] },
    ],
    handlers: {
      wikiLink: handler,
    },
  };
}
