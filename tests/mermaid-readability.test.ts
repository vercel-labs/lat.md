import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import {
  analyzeMermaidDiagrams,
  MERMAID_MAX_BOXES,
  MERMAID_MIN_READABLE_FONT_SIZE,
} from '@lat.md/core/mermaid-readability';
import { analyzeMarkdownFile } from '@lat.md/core/markdown-analysis';
import {
  checkAllCommand,
  checkDiagrams,
  checkDiagramsCommand,
} from '@lat.md/core/cli/check';
import { plainStyler, type CmdContext } from '@lat.md/core/context';

const demo =
  'A[Markdown source] --> B[Shared parser] --> C[Sanitized HTML] --> D[lat ui] --> E[Highlighted code]';
const wider = `${demo} --> F[Additional processing]`;
const temporaryRoots: string[] = [];
afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe('Mermaid readability', () => {
  // @lat: [[tests/check-diagrams#Counts distinct boxes independently of layout]]
  it('uses Mermaid to count unique nodes across directions, subgraphs, metadata, and styles', async () => {
    const nodes = Array.from({ length: 16 }, (_, i) => `N${i}[Box ${i}]`);
    const directions = ['LR', 'RL', 'TB', 'TD', 'BT'];
    const counts = await analyzeMermaidDiagrams(
      directions.flatMap((direction) => [
        `flowchart ${direction}; ${nodes.slice(0, 15).join('-->')}`,
        `graph ${direction}; ${nodes.join('-->')}; N15-->N0; N0-->N1; N1[Renamed]`,
      ]),
    );
    expect(counts.map((result) => result.boxes)).toEqual(
      directions.flatMap(() => [MERMAID_MAX_BOXES, 16]),
    );
    expect(counts.every((result) => !result.error)).toBe(true);
    const other = await analyzeMermaidDiagrams([
      `flowchart TB; subgraph group[Group]; ${nodes.join('-->')}; end; group-->N0; style N0 fill:red; classDef highlight font-size:20px; class N1 highlight`,
      'flowchart TB; A:::highlight & B@{ shape: rect, label: "Box" } --> C["`Markdown label`"]',
      'flowchart LR; A<-->B; B--oC; C--xA',
      'flowchart TB; A>Asymmetric shape]; B[/Slanted/]; C((Circle))',
    ]);
    expect(other.map((result) => result.boxes)).toEqual([16, 3, 3, 3]);
  });

  // @lat: [[tests/check-diagrams#Detects shrinking horizontal labels]]
  it('crosses the readability threshold as the horizontal demo gains another box', async () => {
    const [current, expanded, reversed, short, cycle] =
      await analyzeMermaidDiagrams([
        `flowchart LR; ${demo}`,
        `flowchart LR; ${wider}`,
        `graph RL; ${wider}`,
        'flowchart LR; A --> B',
        'flowchart LR; A --> B --> A',
      ]);
    expect(current.estimate!.estimatedFontSize).toBeGreaterThanOrEqual(
      MERMAID_MIN_READABLE_FONT_SIZE,
    );
    expect(expanded.estimate!.estimatedFontSize).toBeLessThan(
      MERMAID_MIN_READABLE_FONT_SIZE,
    );
    expect(expanded.estimate!.estimatedWidth).toBeGreaterThan(
      current.estimate!.estimatedWidth,
    );
    expect(reversed.estimate).toEqual({
      ...expanded.estimate,
      direction: 'RL',
    });
    expect(short.estimate!.estimatedFontSize).toBe(16);
    expect(cycle.estimate!.estimatedFontSize).toBe(16);
  });

  // @lat: [[tests/check-diagrams#Estimates graph columns and label widths]]
  it('uses upstream graph layout, labels, and source configuration without leaking state', async () => {
    const [
      chain,
      branch,
      plain,
      multiline,
      redeclared,
      short,
      longLink,
      edgeLabel,
      alternateEdgeLabel,
      configured,
      reset,
    ] = await analyzeMermaidDiagrams([
      `flowchart LR; ${wider}`,
      'flowchart LR; A[Markdown source] --> B[Shared parser] & C[Sanitized HTML] & D[lat ui] & E[Highlighted code] & F[Additional processing]',
      'flowchart LR; A[Long first line and second line] --> B',
      'flowchart LR; A["Long first line<br/>and second line"] --> B',
      'flowchart LR; A --> B; A["Long first line<br/>and second line"]',
      'flowchart LR; A --> B',
      'flowchart LR; A ----> B',
      'flowchart LR; A -->|A very long descriptive edge label| B',
      'flowchart LR; A -- A very long descriptive edge label --> B',
      '---\nconfig:\n  flowchart:\n    rankSpacing: 150\n---\nflowchart LR; A-->B',
      'flowchart LR; A-->B',
    ]);
    expect(branch.estimate!.estimatedFontSize).toBeGreaterThan(
      chain.estimate!.estimatedFontSize,
    );
    expect(multiline.estimate!.estimatedWidth).toBeLessThan(
      plain.estimate!.estimatedWidth,
    );
    expect(redeclared.estimate).toEqual(multiline.estimate);
    expect(longLink.estimate!.estimatedWidth).toBeGreaterThan(
      short.estimate!.estimatedWidth,
    );
    expect(edgeLabel.estimate!.estimatedWidth).toBeGreaterThan(
      short.estimate!.estimatedWidth,
    );
    expect(alternateEdgeLabel.estimate).toEqual(edgeLabel.estimate);
    expect(configured.estimate!.estimatedWidth).toBeGreaterThan(
      short.estimate!.estimatedWidth,
    );
    expect(reset).toEqual(short);
  });

  // @lat: [[tests/check-diagrams#Skips layouts outside the estimate]]
  it('still counts boxes when font measurement is unsupported, and reports upstream syntax errors', async () => {
    const results = await analyzeMermaidDiagrams([
      'flowchart TB; A-->B',
      'sequenceDiagram\n A->>B: Hello',
      'flowchart LR; subgraph Group; A --> B; end',
      'flowchart LR; A --> B; style A font-size:32px',
      '---\nconfig:\n  layout: elk\n---\nflowchart LR; A-->B',
      'flowchart LR; A["`Auto wrapped markdown label`"] --> B',
      'flowchart LR; A[unfinished --> B',
      'flowchart LR; A -->',
      'flowchart LR; ' + 'A'.repeat(50_000),
    ]);
    expect(results.slice(0, 6).map((result) => result.estimate)).toEqual(
      Array(6).fill(null),
    );
    expect(results.slice(0, 6).map((result) => result.boxes)).toEqual([
      2,
      null,
      2,
      2,
      2,
      2,
    ]);
    expect(results.slice(6).every((result) => result.error)).toBe(true);
  });

  // @lat: [[tests/check-diagrams#Isolates the upstream runtime]]
  it('keeps DOM and Mermaid configuration isolated across concurrent calls', async () => {
    const before = Object.getOwnPropertyDescriptor(globalThis, 'window');
    expect(await analyzeMermaidDiagrams([])).toEqual([]);
    const [largeFont, normalFont] = await Promise.all([
      analyzeMermaidDiagrams([
        '%%{init: {"themeVariables": {"fontSize": "30px"}}}%%\nflowchart LR; A-->B',
      ]),
      analyzeMermaidDiagrams(['flowchart LR; A-->B']),
    ]);
    expect(largeFont[0].estimate!.estimatedFontSize).toBe(30);
    expect(normalFont[0].estimate!.estimatedFontSize).toBe(16);
    expect(Object.getOwnPropertyDescriptor(globalThis, 'window')).toEqual(
      before,
    );
  });

  // @lat: [[tests/check-diagrams#Extracts real Mermaid fences]]
  it('uses Markdown code nodes, including nested fences, without scanning prose or other languages', () => {
    const content =
      '# Diagrams\n\nSummary.\n\n```text\nflowchart LR; A-->B\n```\n\n> ```mermaid\n> flowchart LR; A-->B\n> ```\n\n~~~~text\n```mermaid\nflowchart LR; A-->B\n```\n~~~~\n';
    const analysis = analyzeMarkdownFile(
      '/project/lat.md/lat.md',
      content,
      '/project/lat.md',
      '/project',
    );
    expect(analysis.mermaidFences).toEqual([
      { source: 'flowchart LR; A-->B', line: 9 },
    ]);
  });

  // @lat: [[tests/check-diagrams#Reports CLI errors]]
  it('fails full and explicit-directory checks for readability or complexity violations', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'lat-diagrams-'));
    temporaryRoots.push(projectRoot);
    const latDir = join(projectRoot, 'docs');
    await mkdir(latDir);
    const file = join(latDir, 'docs.md');
    const content = `# Diagrams\n\nSummary.\n\n\
\`\`\`mermaid\nflowchart LR; ${wider}\n\`\`\`\n`;
    await writeFile(file, content);
    const ctx: CmdContext = {
      projectRoot,
      latDir,
      styler: plainStyler,
      mode: 'cli',
      headless: true,
    };
    const errors = await checkDiagrams(latDir, projectRoot);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ line: 5, target: 'mermaid' });
    expect(errors[0].message).toContain('722px');
    expect(errors[0].message).toContain('flowchart TB or TD');
    const only = await checkDiagramsCommand(ctx);
    expect(only.isError).toBe(true);
    expect(only.output).toContain('Mermaid readability');
    // Also exercises the cached Markdown facts from the first run.
    const all = await checkAllCommand(ctx, { profile: true });
    expect(all.isError).toBe(true);
    expect(all.output).toContain('1 error found');
    expect(all.output).toContain('check Mermaid readability');
    const output = spawnSync(
      process.execPath,
      ['packages/core/dist/cli/index.js', 'check', 'diagrams', '--', latDir],
      { encoding: 'utf8' },
    );
    expect(output.status).toBe(1);
    expect(output.stderr).toContain('Mermaid readability');
    expect(output.stderr).not.toContain('Warning:');
    const boxes = Array.from({ length: 16 }, (_, index) => `N${index}`).join(
      '-->',
    );
    const boxContent = (direction: string, source: string) =>
      `# Diagrams\n\nSummary.\n\n\`\`\`mermaid\nflowchart ${direction}; ${source}\n\`\`\`\n`;
    await writeFile(
      file,
      boxContent('TB', boxes.slice(0, boxes.lastIndexOf('-->'))),
    );
    expect(await checkDiagrams(latDir, projectRoot)).toEqual([]);
    expect((await checkAllCommand(ctx)).isError).not.toBe(true);
    expect((await checkDiagramsCommand(ctx)).isError).not.toBe(true);
    await writeFile(file, boxContent('TB', boxes));
    const complexity = await checkDiagramsCommand(ctx);
    expect(complexity.isError).toBe(true);
    expect(complexity.output).toContain('16 distinct boxes (maximum 15)');
    expect(complexity.output).toContain(
      'Split it into several smaller diagrams',
    );
    expect(complexity.output).not.toContain('flowchart TB or TD');
    await writeFile(file, boxContent('LR', boxes));
    const combined = await checkDiagramsCommand(ctx);
    expect(combined.output).toContain('Mermaid complexity');
    expect(combined.isError).toBe(true);
    await writeFile(file, content + '\n[missing](missing.md)\n');
    const invalid = await checkAllCommand(ctx);
    expect(invalid.isError).toBe(true);
    expect(invalid.output).toContain('Mermaid readability');
    expect(invalid.output).toContain('missing.md');
  });
});
