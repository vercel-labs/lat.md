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

const ALIAS_DIVIDER = '|';
const OPEN = '[[';
const CLOSE = ']]';

function tokenize(
  this: TokenizeContext,
  effects: Effects,
  ok: State,
  nok: State,
): State {
  let openCursor = 0;
  let closeCursor = 0;
  let aliasCursor = 0;
  let hasData = false;
  let hasAlias = false;

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
      return consumeDataStart(code);
    }
    if (code !== OPEN.charCodeAt(openCursor)) return nok(code);
    effects.consume(code);
    openCursor++;
    return consumeOpen;
  }

  function consumeDataStart(code: Code): State | undefined {
    if (code === null || code < -2) return nok(code);
    effects.enter('wikiLinkData');
    effects.enter('wikiLinkTarget');
    return consumeTarget(code);
  }

  function consumeTarget(code: Code): State | undefined {
    if (code === ALIAS_DIVIDER.charCodeAt(aliasCursor)) {
      if (!hasData) return nok(code);
      effects.exit('wikiLinkTarget');
      effects.enter('wikiLinkAliasMarker');
      return consumeAliasMarker(code);
    }

    if (code === CLOSE.charCodeAt(closeCursor)) {
      if (!hasData) return nok(code);
      effects.exit('wikiLinkTarget');
      effects.exit('wikiLinkData');
      effects.enter('wikiLinkMarker');
      return consumeClose(code);
    }

    // No line endings or EOF inside wiki links
    if (code === null || code < -2) return nok(code);

    if (code !== -2 && code !== -1 && code !== 32) {
      hasData = true;
    }

    effects.consume(code);
    return consumeTarget;
  }

  function consumeAliasMarker(code: Code): State | undefined {
    if (aliasCursor === ALIAS_DIVIDER.length) {
      effects.exit('wikiLinkAliasMarker');
      effects.enter('wikiLinkAlias');
      return consumeAlias(code);
    }
    if (code !== ALIAS_DIVIDER.charCodeAt(aliasCursor)) return nok(code);
    effects.consume(code);
    aliasCursor++;
    return consumeAliasMarker;
  }

  function consumeAlias(code: Code): State | undefined {
    if (code === CLOSE.charCodeAt(closeCursor)) {
      if (!hasAlias) return nok(code);
      effects.exit('wikiLinkAlias');
      effects.exit('wikiLinkData');
      effects.enter('wikiLinkMarker');
      return consumeClose(code);
    }

    if (code === null || code < -2) return nok(code);

    if (code !== -2 && code !== -1 && code !== 32) {
      hasAlias = true;
    }

    effects.consume(code);
    return consumeAlias;
  }

  function consumeClose(code: Code): State | undefined {
    if (closeCursor === CLOSE.length) {
      effects.exit('wikiLinkMarker');
      effects.exit('wikiLink');
      return ok(code);
    }
    if (code !== CLOSE.charCodeAt(closeCursor)) return nok(code);
    effects.consume(code);
    closeCursor++;
    return consumeClose;
  }
}

export function wikiLinkSyntax(): Extension {
  return {
    text: {
      91: { tokenize }, // '[' character code
    },
  };
}
