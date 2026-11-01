// Les couleurs des sorties, comme les vrais outils les écrivent : des
// séquences ANSI (SGR, « ESC [ … m »). Un outil ne colore que si sa sortie
// va à l'écran (--color=auto : pas dans un tube ni dans un fichier), ou
// toujours avec --color=always (alors les codes partent aussi dans le tube,
// comme sur un vrai système). L'interface transforme ces séquences en
// couleurs ; les événements des chapitres lisent la sortie sans elles.
//
// Les codes sont ceux par défaut des outils : dircolors (ls), GREP_COLORS
// (grep), diff --palette, systemctl.

import type { Context } from './commands';

export const ESC = '\x1b';

/** Le texte entouré d'une couleur (ex. « 01;34 », bleu gras), puis le retour à la normale. */
export const sgr = (code: string, text: string) => (code && text ? `${ESC}[${code}m${text}${ESC}[0m` : text);

/** La sortie sans ses couleurs (ni les « effacer jusqu'à la fin de la ligne » de grep). */
export const withoutColours = (text: string) => text.replace(/\x1b\[[0-9;]*[mK]/g, '');

/** La longueur visible (sans les séquences de couleur), pour aligner des colonnes. */
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
 * L'option --color[=QUAND] d'une commande (la dernière l'emporte), et les
 * arguments sans elle. Sans option, `defaut` : « auto » pour ls et grep,
 * comme les alias du ~/.bashrc de Debian ; « never » pour diff.
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

/** Faut-il colorer ? Selon --color et selon que la sortie va à un terminal qui montre les couleurs. */
export const colourise = (c: Context, when: When) => when === 'always' || (when === 'auto' && c.last && c.game.colours);

/** Le message de GNU coreutils pour une valeur de --color inconnue (dans la langue du système). */
export const invalidColourMessage = (c: Context, command: string, value: string) => c.game.t('colour-argument-invalid', { command: command, value: value });

// ls : les couleurs par défaut de dircolors (coreutils), pour les types les plus courants.
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

/** Un morceau de texte et son style, pour l'interface : gras, couleur du texte (30-37, 90-97), du fond (40-47). */
export interface Chunk {
  text: string;
  bold: boolean;
  before: number | null;
  background: number | null;
}

/** Une ligne de sortie lue comme un terminal lit les séquences SGR. */
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
