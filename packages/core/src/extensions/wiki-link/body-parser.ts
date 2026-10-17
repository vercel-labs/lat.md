type BodyStep = 'data' | 'alias-marker' | 'close' | 'end' | 'invalid';

/** Streaming grammar for the content after [[, through the closing ]].
 * Accepts ordinary character codes (or null for EOF), independent of Markdown.
 */
export class WikiLinkBodyParser {
  private phase: 'target' | 'alias' | 'closing' | 'done' = 'target';
  private depth = 0;
  private hasData = false;

  consume(code: number | null): BodyStep {
    if (this.phase === 'done') return 'invalid';
    if (this.phase === 'closing') {
      this.phase = 'done';
      return code === 93 ? 'end' : 'invalid';
    }
    if (code === null || code === 10 || code === 13) {
      this.phase = 'done';
      return 'invalid';
    }
    if (this.phase === 'target') {
      if (code === 124) {
        if (!this.hasData) {
          this.phase = 'done';
          return 'invalid';
        }
        this.phase = 'alias';
        this.hasData = false;
        return 'alias-marker';
      }
      if (code === 91) this.depth++;
      if (code === 93 && this.depth > 0) {
        this.depth--;
        return 'data';
      }
    }
    if (code === 93) {
      if (!this.hasData) {
        this.phase = 'done';
        return 'invalid';
      }
      this.phase = 'closing';
      return 'close';
    }
    if (code !== 9 && code !== 32) this.hasData = true;
    return 'data';
  }
}
