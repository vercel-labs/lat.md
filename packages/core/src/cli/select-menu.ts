import { styleText } from 'node:util';

export interface SelectOption {
  label: string;
  value: string;
  /** If true, this option uses a distinct highlight style (e.g. for "done" actions). */
  accent?: boolean;
}

/**
 * Display an interactive select menu with arrow-key navigation.
 * Returns the selected option's value, or null if the user pressed Ctrl+C.
 *
 * @param defaultIndex - initial cursor position (defaults to 0)
 */
export async function selectMenu(
  options: SelectOption[],
  prompt?: string,
  defaultIndex?: number,
): Promise<string | null> {
  if (options.length === 0) return null;
  if (!process.stdin.isTTY) {
    // Non-interactive fallback: return first option
    return options[0].value;
  }

  return new Promise((resolve) => {
    let cursor = defaultIndex ?? 0;
    const stdin = process.stdin;

    // Save original stdin state
    const wasRaw = stdin.isRaw;

    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf-8');

    function render() {
      process.stdout.write('\x1B[?25l'); // hide cursor

      const lines: string[] = [];
      if (prompt) {
        lines.push(styleText('bold', prompt));
      }
      for (let i = 0; i < options.length; i++) {
        const opt = options[i];
        const selected = i === cursor;
        const pointer = selected ? '❯' : ' ';
        if (selected) {
          if (opt.accent) {
            lines.push(
              `  ${pointer} ${styleText(['bgGreen', 'black', 'bold'], ` ${opt.label} `)}`,
            );
          } else {
            lines.push(
              `  ${pointer} ${styleText(['bgCyan', 'black', 'bold'], ` ${opt.label} `)}`,
            );
          }
        } else {
          lines.push(`  ${pointer} ${styleText('dim', opt.label)}`);
        }
      }
      process.stdout.write(lines.join('\n') + '\n');
    }

    function clearRender() {
      const totalLines = options.length + (prompt ? 1 : 0);
      // Move up and clear each line
      for (let i = 0; i < totalLines; i++) {
        process.stdout.write('\x1B[A\x1B[2K');
      }
    }

    function cleanup() {
      stdin.setRawMode(wasRaw ?? false);
      stdin.pause();
      process.stdout.write('\x1B[?25h'); // show cursor
      stdin.removeListener('data', onData);
    }

    function onData(data: string | Buffer) {
      const key = data.toString();

      // Ctrl+C
      if (key === '\x03') {
        clearRender();
        cleanup();
        console.log('');
        process.exit(130);
      }

      // Enter
      if (key === '\r' || key === '\n') {
        clearRender();
        cleanup();
        const selected = options[cursor];
        // Print the selection
        if (prompt) {
          console.log(
            styleText('bold', prompt) +
              ' ' +
              styleText('green', selected.label),
          );
        }
        resolve(selected.value);
        return;
      }

      // Arrow keys (escape sequences)
      if (key === '\x1B[A' || key === 'k') {
        // Up
        clearRender();
        cursor = (cursor - 1 + options.length) % options.length;
        render();
      } else if (key === '\x1B[B' || key === 'j') {
        // Down
        clearRender();
        cursor = (cursor + 1) % options.length;
        render();
      }
    }

    stdin.on('data', onData);
    render();
  });
}
