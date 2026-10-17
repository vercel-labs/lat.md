/**
 * Micromark syntax extension for wiki links: [[target]] and [[target|alias]].
 *
 * Produces the following token types:
 *   - wikiLink          (the entire construct)
 *   - wikiLinkMarker    ([[ and ]])
 *   - wikiLinkData      (everything between markers)
 *   - wikiLinkTarget    (the target portion)
 *   - wikiLinkAliasMarker (the | divider)
 *   - wikiLinkAlias     (the alias portion)
 */

import type {
  Extension,
  Effects,
  State,
  Code,
  TokenizeContext,
} from 'micromark-util-types';
import './types.js';
import { WikiLinkBodyParser } from './body-parser.js';

const OPEN = '[[';

function tokenize(
  this: TokenizeContext,
  effects: Effects,
  ok: State,
  nok: State,
): State {
  let openCursor = 0;
  const body = new WikiLinkBodyParser();
  let contentToken: 'wikiLinkTarget' | 'wikiLinkAlias' = 'wikiLinkTarget';

  return start;

  function start(code: Code): State | undefined {
    if (code !== OPEN.charCodeAt(openCursor)) return nok(code);
    effects.enter('wikiLink');
    effects.enter('wikiLinkMarker');
    return consumeOpen(code);
  }

  function consumeOpen(code: Code): State | undefined {
    if (openCursor === OPEN.length) {
      effects.exit('wikiLinkMarker');
      effects.enter('wikiLinkData');
      effects.enter(contentToken);
      return consumeBody(code);
    }
    if (code !== OPEN.charCodeAt(openCursor)) return nok(code);
    effects.consume(code);
    openCursor++;
    return consumeOpen;
  }

  function consumeBody(code: Code): State | undefined {
    // Micromark represents tabs and line endings with virtual character codes.
    const character =
      code === -2 || code === -1 ? 9 : code !== null && code < -2 ? 10 : code;
    switch (body.consume(character)) {
      case 'invalid':
        return nok(code);
      case 'alias-marker':
        effects.exit(contentToken);
        effects.enter('wikiLinkAliasMarker');
        effects.consume(code);
        effects.exit('wikiLinkAliasMarker');
        contentToken = 'wikiLinkAlias';
        effects.enter(contentToken);
        return consumeBody;
      case 'close':
        effects.exit(contentToken);
        effects.exit('wikiLinkData');
        effects.enter('wikiLinkMarker');
        effects.consume(code);
        return consumeBody;
      case 'end':
        effects.consume(code);
        effects.exit('wikiLinkMarker');
        effects.exit('wikiLink');
        return ok;
      case 'data':
        effects.consume(code);
        return consumeBody;
    }
  }
}

export function wikiLinkSyntax(): Extension {
  return {
    text: {
      91: { tokenize }, // '[' character code
    },
  };
}
