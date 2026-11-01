// Petits outils du shell : découpage de la ligne de commande, permissions,
// tailles, jokers.

import type { File } from './world';
import type { Game } from './shell';
import { typography } from '../texts';

export const content = (n: File, game: Game) =>
  typeof n.content === 'function' ? n.content(game) : n.prose && !n.lines ? typography(n.content, game.t.language) : n.content;
export const sizeFor = (n: File, game: Game) => n.size ?? new TextEncoder().encode(content(n, game)).length;

// Motif de jokers (*, ?) → expression régulière.
export function wildcard(pattern: string): RegExp {
  return new RegExp('^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
}

export interface Word {
  text: string;
  // Entre guillemets : pas de jokers, pas d'opérateurs.
  city: boolean;
  // Opérateur du shell : tube ou redirection.
  op?: '|' | '>' | '>>';
}

// Découpe une ligne en mots, comme le shell : les espaces séparent les mots,
// sauf entre guillemets ("…" ou '…') ; | > et >> sont des opérateurs.
export function split(line: string): Word[] {
  const words: Word[] = [];
  let active: Word | null = null;
  let quote = '';
  const finish = () => {
    if (active) words.push(active);
    active = null;
  };
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      if (c === quote) quote = '';
      else active!.text += c;
    } else if (c === '"' || c === "'") {
      quote = c;
      active ??= { text: '', city: true };
      active.city = true;
    } else if (/\s/.test(c)) {
      finish();
    } else if (c === '|') {
      finish();
      words.push({ text: '|', city: false, op: '|' });
    } else if (c === '>') {
      finish();
      const double = line[i + 1] === '>';
      if (double) i++;
      words.push({ text: double ? '>>' : '>', city: false, op: double ? '>>' : '>' });
    } else {
      active ??= { text: '', city: false };
      active.text += c;
    }
  }
  finish();
  return words;
}

// « 755 », « 2775 » ou « u+x », « o-w », « go=r », « g+s », « +t »… → nouveau
// mode rwxrwxrwx, où les bits spéciaux prennent la place du x, comme ls -l :
// s/S (setuid, setgid : x présent ou non), t/T (sticky).
// Écart volontaire : sans u/g/o/a, on agit sur tout le monde (a) sans
// tenir compte du masque (umask).
export function applyMode(current: string, rights: string): string | null {
  // Les droits rwx d'un côté, les bits spéciaux de l'autre.
  const bits = [...current].map((c, i) => (i % 3 === 2 ? (/[xst]/.test(c) ? 'x' : '-') : c));
  const specials = { u: /[sS]/.test(current[2] ?? ''), g: /[sS]/.test(current[5] ?? ''), t: /[tT]/.test(current[8] ?? '') };
  if (/^[0-7]{3,4}$/.test(rights)) {
    const digits = rights.padStart(4, '0');
    const special = Number(digits[0]);
    [...digits.slice(1)].forEach((c, i) => {
      const v = Number(c);
      bits[i * 3] = v & 4 ? 'r' : '-';
      bits[i * 3 + 1] = v & 2 ? 'w' : '-';
      bits[i * 3 + 2] = v & 1 ? 'x' : '-';
    });
    // Comme GNU chmod : 3 chiffres ne retirent pas le setgid d'un dossier, 4 chiffres fixent tout.
    if (rights.length === 4) Object.assign(specials, { u: !!(special & 4), g: !!(special & 2), t: !!(special & 1) });
  } else
    for (const clause of rights.split(',')) {
      const m = /^([ugoa]*)([+\-=])([rwxst]*)$/.exec(clause);
      if (!m) return null;
      const who = (m[1] || 'a').replace('a', 'ugo');
      for (const [i, c] of ['u', 'g', 'o'].entries()) {
        if (!who.includes(c)) continue;
        ['r', 'w', 'x'].forEach((d, j) => {
          const k = i * 3 + j;
          if (m[2] === '=') bits[k] = m[3].includes(d) ? d : '-';
          else if (m[3].includes(d)) bits[k] = m[2] === '+' ? d : '-';
        });
      }
      const put = (key: 'u' | 'g' | 't', concerns: boolean, request: boolean) => {
        if (!concerns) return;
        if (m[2] === '=') specials[key] = request;
        else if (request) specials[key] = m[2] === '+';
      };
      put('u', who.includes('u'), m[3].includes('s'));
      put('g', who.includes('g'), m[3].includes('s'));
      put('t', !m[1] || m[1].includes('a') || m[1].includes('o'), m[3].includes('t'));
    }
  const withValue = (k: number, enabled: boolean, small: string) => {
    if (enabled) bits[k] = bits[k] === 'x' ? small : small.toUpperCase();
  };
  withValue(2, specials.u, 's');
  withValue(5, specials.g, 's');
  withValue(8, specials.t, 't');
  return bits.join('');
}

/** Le mode octal (« 2775 », « 644 ») d'un mode rwxrwxrwx. */
export function octal(mode: string): string {
  const digit = (i: number) => (mode[i] === 'r' ? 4 : 0) + (mode[i + 1] === 'w' ? 2 : 0) + (/[xst]/.test(mode[i + 2]) ? 1 : 0);
  const special = (/[sS]/.test(mode[2]) ? 4 : 0) + (/[sS]/.test(mode[5]) ? 2 : 0) + (/[tT]/.test(mode[8]) ? 1 : 0);
  return `${special || ''}${digit(0)}${digit(3)}${digit(6)}`;
}

/** Le mode d'un nouveau fichier (base 666) ou dossier (base 777), moins le masque (umask, ex. « 0022 »). */
export function modeWithMask(directory: boolean, mask: string): string {
  const m = parseInt(mask, 8);
  const base = directory ? 0o777 : 0o666;
  const v = base & ~m;
  return [6, 3, 0].map((d) => ((v >> d) & 4 ? 'r' : '-') + ((v >> d) & 2 ? 'w' : '-') + ((v >> d) & 1 ? 'x' : '-')).join('');
}

// Taille lisible : 1536 → « 1,5K », comme du -h ou ls -lh (en base 1024),
// avec le séparateur décimal de la langue.
export function readable(bytes: number, language = 'fr'): string {
  const units = ['', 'K', 'M', 'G'];
  let v = bytes;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u++;
  }
  const decimal = new Intl.NumberFormat(language, { minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: false });
  const text = u === 0 ? String(v) : v < 10 ? decimal.format(v) : String(Math.round(v));
  return text + units[u];
}

// Options courtes groupées : « -czf » → c, z, f. Renvoie les lettres et les
// arguments qui ne sont pas des options.
// Tri des noms comme ls en français (un seul Collator : bien plus rapide que localeCompare sur des milliers de noms).
export const compareNames = new Intl.Collator('fr').compare;

export function options(args: string[]): { letters: Set<string>; rest: string[] } {
  const letters = new Set<string>();
  const rest: string[] = [];
  for (const a of args) {
    if (/^-[a-zA-Z]+$/.test(a)) for (const l of a.slice(1)) letters.add(l);
    else rest.push(a);
  }
  return { letters, rest };
}
