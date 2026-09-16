/**
 * mdast-util extension to turn wiki-link micromark tokens into mdast nodes.
 */

import type { CompileContext, Extension } from 'mdast-util-from-markdown';
import type { Token } from 'micromark-util-types';
import type { WikiLink } from './types.js';

function enterWikiLink(this: CompileContext, token: Token) {
  const node: WikiLink = {
    type: 'wikiLink',
    value: '',
    data: { alias: null },
  };
  this.enter(node, token);
}

function exitWikiLinkTarget(this: CompileContext, token: Token) {
  const target = this.sliceSerialize(token);
  const node = this.stack[this.stack.length - 1] as WikiLink;
  node.value = target;
}

function exitWikiLinkAlias(this: CompileContext, token: Token) {
  const alias = this.sliceSerialize(token);
  const node = this.stack[this.stack.length - 1] as WikiLink;
  node.data.alias = alias;
}

function exitWikiLink(this: CompileContext, token: Token) {
  this.exit(token);
}

export function wikiLinkFromMarkdown(): Extension {
  return {
    enter: { wikiLink: enterWikiLink },
    exit: {
      wikiLinkTarget: exitWikiLinkTarget,
      wikiLinkAlias: exitWikiLinkAlias,
      wikiLink: exitWikiLink,
    },
  };
}
