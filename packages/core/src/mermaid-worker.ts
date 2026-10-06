import { parentPort, workerData } from 'node:worker_threads';
import { JSDOM } from 'jsdom';
import { Graph } from 'dagre-d3-es/src/graphlib/index.js';
import { layout } from 'dagre-d3-es/src/dagre/index.js';
import type { FlowDB } from 'mermaid/dist/diagrams/flowchart/flowDb.js';
import {
  MERMAID_CONTENT_WIDTH,
  MERMAID_MAX_BOXES,
  MERMAID_MAX_SOURCE_LENGTH,
  type MermaidAnalysis,
  type MermaidReadability,
} from './mermaid-readability.js';

// Mermaid's sanitizer requires a DOM at import time. Keep it out of the host's
// globals; JSDOM neither runs scripts nor loads remote resources by default.
const dom = new JSDOM('');
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
});
const { default: mermaid } = await import('mermaid');

/** Approximate text dimensions only; Mermaid parses labels and Dagre lays out graphs. */
function labelSize(
  label: string,
  fontSize: number,
): { width: number; height: number } {
  const element = dom.window.document.createElement('div');
  element.innerHTML = label;
  for (const br of element.querySelectorAll('br')) br.replaceWith('\n');
  const lines = (element.textContent ?? '').split('\n');
  const width = Math.max(
    0,
    ...lines.map((line) =>
      [...line].reduce((sum, char) => {
        const em = /[ilI.,'!:;|\s]/u.test(char)
          ? 0.25
          : /[MW@%]/u.test(char)
            ? 0.85
            : /[^\u0000-\u024f]/u.test(char)
              ? 1
              : 0.5;
        return sum + em * fontSize;
      }, 0),
    ),
  );
  return { width, height: lines.length * fontSize * 1.5 };
}

function estimateReadability(db: FlowDB): MermaidReadability | null {
  const direction = db.getDirection();
  if (direction !== 'LR' && direction !== 'RL') return null;
  const { nodes, edges, config } = db.getData();
  // Keep uncertainty in text/shape metrics explicit rather than reimplementing
  // Mermaid's CSS, Markdown wrapping, nested cluster renderer, or alternate layouts.
  if ((config.layout && config.layout !== 'dagre') || config.themeCSS)
    return null;
  if (
    nodes.some(
      (node) =>
        node.isGroup ||
        node.labelType === 'markdown' ||
        node.img ||
        node.icon ||
        node.cssStyles?.length ||
        node.labelStyle ||
        node.cssCompiledStyles?.length,
    ) ||
    edges.some(
      (edge) =>
        edge.labelType === 'markdown' ||
        edge.cssCompiledStyles?.length ||
        edge.style?.length ||
        edge.labelStyle?.length,
    )
  )
    return null;
  const configuredFont = String(
    config.themeVariables?.fontSize ?? config.fontSize ?? 16,
  );
  if (!/^\d+(?:\.\d+)?(?:px)?$/.test(configuredFont)) return null;
  const fontSize = Number.parseFloat(configuredFont);
  if (!Number.isFinite(fontSize) || fontSize <= 0) return null;
  const flowchart = config.flowchart;
  const graph = new Graph({ multigraph: true });
  graph.setGraph({
    rankdir: direction,
    nodesep: flowchart?.nodeSpacing ?? 50,
    ranksep: flowchart?.rankSpacing ?? 50,
    marginx: flowchart?.diagramPadding ?? 8,
    marginy: flowchart?.diagramPadding ?? 8,
  });
  for (const node of nodes) {
    const size = labelSize(node.label ?? node.id, fontSize);
    const padding = (node.padding ?? 15) * 2;
    graph.setNode(node.id, {
      width: (size.width + padding) * (node.shape === 'diamond' ? 1.5 : 1),
      height: size.height + padding,
    });
  }
  for (const [index, edge] of edges.entries()) {
    if (!edge.start || !edge.end) return null;
    const size = edge.label
      ? labelSize(edge.label, fontSize)
      : { width: 0, height: 0 };
    graph.setEdge(
      edge.start,
      edge.end,
      { ...size, minlen: edge.minlen ?? 1, labelpos: 'c' },
      String(index),
    );
  }
  layout(graph, {});
  const estimatedWidth = graph.graph().width as number;
  if (!Number.isFinite(estimatedWidth) || estimatedWidth <= 0) return null;
  return {
    direction,
    estimatedWidth,
    estimatedFontSize:
      fontSize * Math.min(1, MERMAID_CONTENT_WIDTH / estimatedWidth),
  };
}

async function analyze(source: string): Promise<MermaidAnalysis> {
  if (source.length > MERMAID_MAX_SOURCE_LENGTH)
    return {
      boxes: null,
      estimate: null,
      error: `Mermaid source exceeds ${MERMAID_MAX_SOURCE_LENGTH} characters; split it into smaller diagrams.`,
    };
  try {
    // Reset per diagram: Mermaid owns mutable configuration and parser state.
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: 'neutral',
      maxTextSize: MERMAID_MAX_SOURCE_LENGTH,
      suppressErrorRendering: true,
    });
    const parsed = await mermaid.parse(source);
    if (!parsed || !['flowchart', 'flowchart-v2'].includes(parsed.diagramType))
      return { boxes: null, estimate: null };
    // Public parse() validates/applies source configuration but doesn't expose
    // graph data. Keep the pinned Mermaid DB adapter confined to this worker.
    const diagram = await mermaid.mermaidAPI.getDiagramFromText(source);
    const db = diagram.db as FlowDB;
    const groups = new Set(db.getSubGraphs().map((group) => group.id));
    const boxes = [...db.getVertices().keys()].filter(
      (id) => !groups.has(id),
    ).length;
    return {
      boxes,
      estimate: boxes > MERMAID_MAX_BOXES ? null : estimateReadability(db),
    };
  } catch (error) {
    return {
      boxes: null,
      estimate: null,
      error: `Mermaid parse/layout failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

if (!parentPort) throw new Error('Mermaid worker needs a parent port');
const results: MermaidAnalysis[] = [];
for (const source of workerData as string[])
  results.push(await analyze(source));
dom.window.close();
parentPort.postMessage(results);
parentPort.close();
