import { extname } from 'node:path';
import type { ElementContent } from 'hast';
import { createLowlight } from 'lowlight';
import hljs from 'highlight.js';
import { textDocumentTree, toViewDocumentTree } from './document-tree.js';
import type { ViewDocumentTree } from './protocol.js';

const lowlight = createLowlight();
// Use Highlight.js directly: Lowlight's bundled registry can lag behind it.
for (const language of hljs.listLanguages()) {
  const definition = hljs.getLanguage(language)?.rawDefinition;
  if (definition) lowlight.register(language, definition);
}

// Preserve Lat's shell-script interpretation of this label.
const languageAliases = new Map([['shell', 'bash']]);

export type HighlightedCodeTree = {
  type: 'root';
  children: ElementContent[];
};

/** Highlight a supported fenced-code language into a safe HAST fragment. */
export function highlightCode(
  language: string,
  content: string,
): HighlightedCodeTree | null {
  const label = language.toLowerCase();
  const registeredLanguage = languageAliases.get(label) ?? label;
  if (!lowlight.registered(registeredLanguage)) return null;
  const tree = lowlight.highlight(registeredLanguage, content);
  return {
    type: 'root',
    children: tree.children.filter(
      (node): node is ElementContent => node.type !== 'doctype',
    ),
  };
}

function splitHighlightedNode(node: ElementContent): ElementContent[][] {
  if (node.type !== 'element') {
    return node.value.split('\n').map((value) => [{ ...node, value }]);
  }
  return splitHighlightedNodes(node.children).map((children) => [
    { ...node, properties: { ...node.properties }, children },
  ]);
}

/** Split a HAST fragment at text newlines while cloning spanning elements. */
function splitHighlightedNodes(
  nodes: readonly ElementContent[],
): ElementContent[][] {
  const lines: ElementContent[][] = [[]];
  for (const node of nodes) {
    const fragments = splitHighlightedNode(node);
    lines[lines.length - 1].push(...fragments[0]);
    for (const fragment of fragments.slice(1)) lines.push(fragment);
  }
  return lines;
}

/** Highlight source directly into independently renderable document trees. */
export function highlightSource(
  path: string,
  content: string,
): ViewDocumentTree[] {
  const normalized = content.replaceAll('\r\n', '\n');
  const language = extname(path).slice(1);
  if (!language) return normalized.split('\n').map(textDocumentTree);
  const highlighted = highlightCode(language, normalized);
  if (!highlighted) return normalized.split('\n').map(textDocumentTree);
  return splitHighlightedNodes(highlighted.children).map((children) =>
    toViewDocumentTree({ type: 'root', children }),
  );
}
