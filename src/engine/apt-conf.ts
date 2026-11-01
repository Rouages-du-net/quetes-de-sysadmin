// apt's configuration, read like apt.conf(5): /etc/apt/apt.conf.d/*,
// in alphabetical order (files whose name contains anything other than
// letters, digits, "_", "-" and "." are ignored), then
// /etc/apt/apt.conf. A value read later replaces the previous one; a
// list ({ "a"; "b"; }) grows from one file to the next. Comments //,
// /* */ and #. Each assignment ends with ";".
// Source: https://manpages.debian.org/trixie/apt/apt.conf.5.en.html
// Differences: no #include nor #clear, no "Key::Sub { … }" scope
// nested on several levels (only lists).

import type { Game } from './shell';

export const APT_DIRECTORY = '/etc/apt/apt.conf.d';

export interface ConfApt {
  values: Record<string, string>;
  lists: Record<string, string[]>;
  errors: string[];
}

// The files read, in order.
function files(game: Game): string[] {
  const n = game.find(APT_DIRECTORY);
  const names =
    n?.type === 'directory'
      ? Object.keys(n.children)
          .filter((f) => /^[A-Za-z0-9_.-]+$/.test(f) && n.children[f].type === 'file')
          .sort()
      : [];
  return [...names.map((f) => `${APT_DIRECTORY}/${f}`), ...(game.exists('/etc/apt/apt.conf') ? ['/etc/apt/apt.conf'] : [])];
}

/** Reads all of apt's configuration; the errors are apt's ("E: Syntax error …"). */
export function readConfApt(game: Game): ConfApt {
  const values: Record<string, string> = {};
  const lists: Record<string, string[]> = {};
  const errors: string[] = [];
  for (const file of files(game)) {
    const text = (game.read(file) ?? '').replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));
    const lines = text.split('\n').map((l) => l.replace(/(^|\s)(\/\/|#).*$/, '$1'));
    let listing: string | null = null;
    for (let i = 0; i < lines.length && !errors.length; i++) {
      let rest = lines[i].trim();
      while (rest && !errors.length) {
        const end = /^};?\s*/.exec(rest);
        if (listing !== null && end) {
          listing = null;
          rest = rest.slice(end[0].length);
          continue;
        }
        if (listing !== null) {
          const v = /^"([^"]*)"\s*;\s*/.exec(rest);
          if (!v) {
            errors.push(`E: Syntax error ${file}:${i + 1}: Extra junk after value`);
            break;
          }
          (lists[listing] ??= []).push(v[1]);
          rest = rest.slice(v[0].length);
          continue;
        }
        const opens = /^([A-Za-z0-9_:.-]+)\s*{\s*/.exec(rest);
        if (opens) {
          listing = opens[1];
          lists[listing] ??= [];
          rest = rest.slice(opens[0].length);
          continue;
        }
        const affectation = /^([A-Za-z0-9_:.-]+)\s+"([^"]*)"\s*(;?)\s*/.exec(rest);
        if (!affectation) {
          errors.push(`E: Syntax error ${file}:${i + 1}: Malformed tag`);
          break;
        }
        if (!affectation[3]) {
          errors.push(`E: Syntax error ${file}:${i + 1}: Extra junk after value`);
          break;
        }
        values[affectation[1]] = affectation[2];
        rest = rest.slice(affectation[0].length);
      }
    }
    if (!errors.length && listing !== null) errors.push(`E: Syntax error ${file}:${lines.length}: Unbalanced braces`);
    if (errors.length) break;
  }
  if (errors.length) errors.push('E: Unable to parse configuration');
  return { values, lists, errors };
}

/** A boolean apt option: "1", "true", "yes", "on". */
export const yes = (v: string | undefined) => /^(1|true|yes|on|enable)$/i.test(v ?? '');

/** What apt-config dump shows: one line per value, lists as "Key::". */
export function empty(c: ConfApt): string {
  const lines = Object.entries(c.values).map(([k, v]) => `${k} "${v}";`);
  for (const [k, l] of Object.entries(c.lists)) lines.push(`${k} "";`, ...l.map((v) => `${k}:: "${v}";`));
  return lines.join('\n');
}
