import { Worker } from 'node:worker_threads';

/** The desktop document column minus the diagram's padding and borders. */
export const MERMAID_CONTENT_WIDTH = 722;
export const MERMAID_MIN_READABLE_FONT_SIZE = 12;
export const MERMAID_MAX_BOXES = 15;
export const MERMAID_MAX_SOURCE_LENGTH = 50_000;

export type MermaidFence = { source: string; line: number };
export type MermaidReadability = {
  direction: 'LR' | 'RL';
  estimatedWidth: number;
  estimatedFontSize: number;
};
export type MermaidAnalysis = {
  boxes: number | null;
  estimate: MermaidReadability | null;
  error?: string;
};

// @lat: [[markdown#Mermaid Diagrams#Readability checks]]
/** Parse and lay out diagrams upstream in an isolated, command-scoped worker. */
export async function analyzeMermaidDiagrams(
  sources: string[],
): Promise<MermaidAnalysis[]> {
  if (!sources.length) return [];
  const worker = new Worker(
    new URL('./mermaid-runtime/worker.js', import.meta.url),
    {
      workerData: sources,
      execArgv: process.execArgv.filter(
        (arg) => !arg.startsWith('--input-type'),
      ),
      resourceLimits: { maxOldGenerationSizeMb: 256 },
    },
  );
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await new Promise<MermaidAnalysis[]>((resolve, reject) => {
      timer = setTimeout(
        () => reject(new Error('Mermaid analysis timed out')),
        30_000,
      );
      worker.once('message', resolve);
      worker.once('error', reject);
      worker.once('exit', (code) =>
        reject(
          new Error(
            `Mermaid analysis worker exited without a result (code ${code})`,
          ),
        ),
      );
    });
  } finally {
    clearTimeout(timer);
    await worker.terminate();
  }
}
