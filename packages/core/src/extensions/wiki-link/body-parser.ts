const ALIAS_DIVIDER_CODE = 124;
const OPEN_BRACKET_CODE = 91;
const CLOSE_BRACKET_CODE = 93;
const TAB_CODE = 9;
const LINE_FEED_CODE = 10;
const CARRIAGE_RETURN_CODE = 13;
const SPACE_CODE = 32;

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
      return code === CLOSE_BRACKET_CODE ? 'end' : 'invalid';
    }
    if (
      code === null ||
      code === LINE_FEED_CODE ||
      code === CARRIAGE_RETURN_CODE
    ) {
      this.phase = 'done';
      return 'invalid';
    }
    if (this.phase === 'target') {
      if (code === ALIAS_DIVIDER_CODE) {
        if (!this.hasData) {
          this.phase = 'done';
          return 'invalid';
        }
        this.phase = 'alias';
        this.hasData = false;
        return 'alias-marker';
      }
      if (code === OPEN_BRACKET_CODE) this.depth++;
      if (code === CLOSE_BRACKET_CODE && this.depth > 0) {
        this.depth--;
        return 'data';
      }
    }
    if (code === CLOSE_BRACKET_CODE) {
      if (!this.hasData) {
        this.phase = 'done';
        return 'invalid';
      }
      this.phase = 'closing';
      return 'close';
    }
    if (code !== TAB_CODE && code !== SPACE_CODE) this.hasData = true;
    return 'data';
  }
}
