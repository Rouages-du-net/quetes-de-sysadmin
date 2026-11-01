// Output colours, as the real tools write them:
// ANSI sequences (SGR, "ESC [ … m"). A tool only colours if its output
// goes to the screen (--color=auto: not into a pipe or a file), or
// always with --color=always (then the codes also go into the pipe,
// as on a real system). The interface turns these sequences into
// colours; the chapters' events read the output without them.
//
// The codes are the tools' defaults: dircolors (ls), GREP_COLORS
// (grep), diff --palette, systemctl.

import type { Context } from './commands';

export const ESC = '\x1b';

/** The text wrapped in a colour (e.g. "01;34", bold blue), then back to normal. */
export const sgr = (code: string, text: string) => (code && text ? `${ESC}[${code}m${text}${ESC}[0m` : text);

/** The output without its colours (nor grep's "erase to end of line"). */
export const withoutColours = (text: string) => text.replace(/\x1b\[[0-9;]*[mK]/g, '');

/** The visible length (without the colour sequences), to align columns. */
export const visibleWidth = (text: string) => withoutColours(text).length;

export type When = 'always' | 'never' | 'auto';

const VALUES: Record<string, When> = {
  always: 'always',
  yes: 'always',
  force: 'always',
  never: 'never',
  no: 'never',
  none: 'never',
  auto: 'auto',
  tty: 'auto',
  'if-tty': 'auto',
};

/**
 * A command's --color[=WHEN] option (the last one wins), and the
 * arguments without it. With no option, `fallback`: "auto" for ls and grep,
 * like the aliases in Debian's ~/.bashrc; "never" for diff.
 */
export function readColour(args: string[], fallback: When, withoutValue: When = 'always'): { when: When; args: string[]; invalid?: string } {
  let when = fallback;
  let invalid: string | undefined;
  const rest: string[] = [];
  for (const a of args) {
    const m = /^--colou?r(?:=(.*))?$/.exec(a);
    if (!m) rest.push(a);
    else if (m[1] === undefined) when = withoutValue;
    else if (VALUES[m[1]]) when = VALUES[m[1]];
    else invalid = m[1];
  }
  return { when, args: rest, invalid };
}

/** Should we colour? Depending on --color and on whether the output goes to a terminal that shows colours. */
export const colourise = (c: Context, when: When) => when === 'always' || (when === 'auto' && c.last && c.game.colours);

/** GNU coreutils' message for an unknown --color value (in the system's language). */
export const invalidColourMessage = (c: Context, command: string, value: string) => c.game.t('colour-argument-invalid', { command: command, value: value });

// ls: dircolors' default colours (coreutils), for the most common types.
const ARCHIVES = /\.(tar|tgz|gz|bz2|xz|zst|zip|7z|deb|rpm)$/i;
const IMAGES = /\.(png|jpe?g|gif|svg|webp|bmp)$/i;
export function lsColour(name: string, type: 'directory' | 'file', link: boolean, mode: string): string {
  if (link) return '01;36';
  if (type === 'directory') return /t$/i.test(mode) && mode[7] === 'w' ? '30;42' : '01;34';
  if (/^..s/i.test(mode)) return '37;41';
  if (/[xst]/.test(mode[2] + mode[5] + mode[8])) return '01;32';
  if (ARCHIVES.test(name)) return '01;31';
  if (IMAGES.test(name)) return '01;35';
  return '';
}

/** A piece of text and its style, for the interface: bold, text colour (30-37, 90-97), background (40-47). */
export interface Chunk {
  text: string;
  bold: boolean;
  before: number | null;
  background: number | null;
}

/** An output line read the way a terminal reads SGR sequences. */
export function chunks(line: string): Chunk[] {
  const output: Chunk[] = [];
  let style = { bold: false, before: null as number | null, background: null as number | null };
  let i = 0;
  const re = /\x1b\[([0-9;]*)([mK])/g;
  for (let m = re.exec(line); m; m = re.exec(line)) {
    if (m.index > i) output.push({ text: line.slice(i, m.index), ...style });
    i = re.lastIndex;
    if (m[2] !== 'm') continue;
    const codes = m[1] === '' ? [0] : m[1].split(';').map(Number);
    for (const c of codes) {
      if (c === 0) style = { bold: false, before: null, background: null };
      else if (c === 1) style = { ...style, bold: true };
      else if (c === 22) style = { ...style, bold: false };
      else if ((c >= 30 && c <= 37) || (c >= 90 && c <= 97)) style = { ...style, before: c >= 90 ? c - 60 : c };
      else if (c === 39) style = { ...style, before: null };
      else if (c >= 40 && c <= 47) style = { ...style, background: c };
      else if (c === 49) style = { ...style, background: null };
    }
  }
  if (i < line.length) output.push({ text: line.slice(i), ...style });
  return output;
}
