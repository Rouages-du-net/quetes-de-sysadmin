// What the game says to screen readers besides the terminal's log (see
// docs/ACCESSIBILITY.md). The terminal's output is a log (role="log"): a
// screen reader reads each new output once. Two cases need more:
//
// - re-reading the last output (Alt+R, or the "Read the last output"
//   button): the blocks written since the last command line, at most
//   REREAD_LINES lines (the end, like a terminal's scrollback);
// - a follow (tail -f, journalctl -f, watch): new lines arrive every second
//   and would flood the reader. The log goes quiet while it lasts; a digest
//   says how many lines arrived, and the last one, at most every
//   DIGEST_SECONDS seconds (watch: that the screen changed).
//
// No DOM here: the interface (src/interface/game.ts) gives the texts and
// the clock, and puts what comes out in a polite live region.

/**
 * What a screen reader should not spell out, character by character: the
 * box-drawing of trees and tables (lsblk's `└─`, systemctl's `●` and `├─`),
 * status marks (`✔`, `✓`), rules made of one repeated character standing
 * alone (`--------`, `======`, `^~~~~`, never `-rw-------`, which says
 * something), a pictograph that opens a line (the achievement's trophy)
 * and an arrow that ends one ("Next chapter →").
 * The text around them says the same in words. The interface keeps them on
 * the screen and hides them from assistive technology (`aria-hidden`).
 */
export const DECORATION = /(?<!\S)[-=_~#*]{4,}(?!\S)|\^~+|[─-▟]+|[●○◆◇■□✔✓✗✘]|^[\p{Extended_Pictographic}↺▶←]️?(?=\s)|(?<=\s)→$/gmu;

/**
 * Splits a text into what is read and what is decoration, in order (see
 * DECORATION): `[text, decorative?]` pairs, adjacent texts never split.
 */
export function decorations(text: string): { text: string; decoration: boolean }[] {
  const parts: { text: string; decoration: boolean }[] = [];
  let at = 0;
  for (const m of text.matchAll(DECORATION)) {
    if (!m[0]) continue;
    if (m.index! > at) parts.push({ text: text.slice(at, m.index), decoration: false });
    parts.push({ text: m[0], decoration: true });
    at = m.index! + m[0].length;
  }
  if (at < text.length) parts.push({ text: text.slice(at), decoration: false });
  return parts;
}

/** A text as a screen reader should hear it: decorations removed, lines left empty dropped. */
export function spoken(text: string): string {
  const out: string[] = [];
  for (const line of text.split('\n')) {
    const quiet = line.replace(DECORATION, '');
    if (quiet === line) out.push(line);
    else if (quiet.trim()) out.push(quiet.trimEnd());
  }
  return out.join('\n');
}

/** One block of the terminal's output: a command line typed, or what came out. */
export interface Block {
  command: boolean;
  text: string;
}

export const REREAD_LINES = 60;
export const DIGEST_SECONDS = 10;

/**
 * The last output: the blocks after the last command line, joined, without
 * their decorations (spoken). Empty
 * when the last command printed nothing. `cut` is the number of lines left
 * out at the start (only the last `max` are kept).
 */
export function lastOutput(blocks: Block[], max = REREAD_LINES): { text: string; lines: number; cut: number } {
  const after: string[] = [];
  for (let i = blocks.length - 1; i >= 0 && !blocks[i].command; i--) after.unshift(spoken(blocks[i].text).replace(/\n+$/, ''));
  const lines = after
    .join('\n')
    .split('\n')
    .map((l) => l.trimEnd());
  while (lines.length && !lines[lines.length - 1]) lines.pop();
  while (lines.length && !lines[0]) lines.shift();
  const cut = Math.max(0, lines.length - max);
  return { text: lines.slice(cut).join('\n'), lines: lines.length, cut };
}

/** What a digest says: lines that arrived (and the last one), or a redrawn screen. */
export type Digest = { kind: 'lines'; count: number; last: string } | { kind: 'screen' };

/**
 * A follow's digest. add() each time something arrives, tick(now) each
 * second (now in seconds): it returns what to announce, at most once every
 * DIGEST_SECONDS, and only if something arrived since the last digest.
 */
export class FollowDigest {
  private count = 0;
  private last = '';
  private changed = false;
  private screenText: string;
  private since: number;
  private readonly screen: boolean;
  private readonly every: number;

  /** screen: watch (the screen is redrawn), whose first screen is `initial`. */
  constructor(now: number, options: { screen?: boolean; initial?: string; every?: number } = {}) {
    this.since = now;
    this.screen = options.screen ?? false;
    this.screenText = options.initial ?? '';
    this.every = options.every ?? DIGEST_SECONDS;
  }

  /** Something arrived: lines appended (follow) or a new screen (watch). */
  add(text: string) {
    if (this.screen) {
      if (text !== this.screenText) this.changed = true;
      this.screenText = text;
      return;
    }
    const lines = spoken(text).split('\n').filter((l) => l.trim());
    if (!lines.length) return;
    this.count += lines.length;
    this.last = lines[lines.length - 1].trim();
  }

  /** The digest due at this time, if any. */
  tick(now: number): Digest | null {
    if (now - this.since < this.every) return null;
    if (this.screen ? !this.changed : this.count === 0) return null;
    const digest: Digest = this.screen ? { kind: 'screen' } : { kind: 'lines', count: this.count, last: this.last };
    this.count = 0;
    this.last = '';
    this.changed = false;
    this.since = now;
    return digest;
  }
}
