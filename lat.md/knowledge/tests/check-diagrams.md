---
lat:
  require-code-mention: true
---

# Mermaid Readability Tests

These tests verify deterministic flowchart complexity limits and horizontal readability estimates using Mermaid's parser and imported Dagre layout without a browser.

## Counts distinct boxes independently of layout

Box counts deduplicate repeated references and include vertical layouts, cycles, disconnected nodes, style statements, and subgraphs without counting the group containers as boxes.

## Detects shrinking horizontal labels

Adding a sequential box to a near-threshold chart lowers estimated fitted font size enough to fail. Both horizontal directions are handled, while compact charts retain their nominal font size.

## Estimates graph columns and label widths

Dagre handles branching and cycles. Explicit line breaks, final node labels, edge labels, and longer links affect estimated dimensions. Upstream source configuration affects layout and resets between diagrams.

## Skips layouts outside the estimate

Vertical charts, other diagram types, subgraphs, custom styles, alternate layouts, and auto-wrapped labels skip font estimates while flowchart boxes still count. Malformed syntax and oversized source return errors.

## Extracts real Mermaid fences

Markdown analysis records source and opening line only for actual Mermaid code nodes, including blockquotes, without interpreting examples inside other code fences as diagrams.

## Reports CLI errors

Full and diagrams-only checks fail on small estimated fonts or more than fifteen boxes. Errors retain locations and corrective suggestions through cached facts and explicit directories; valid charts pass and ordinary errors remain visible.

## Isolates the upstream runtime

Concurrent analyses use isolated DOM and Mermaid configuration state, preserve host globals, and terminate their workers. Empty batches skip runtime startup; configuration from one chart does not leak into another.
