// La configuration d'apt, lue comme apt.conf(5) : /etc/apt/apt.conf.d/*,
// dans l'ordre alphabétique (les fichiers dont le nom contient autre chose
// que lettres, chiffres, « _ », « - » et « . » sont ignorés), puis
// /etc/apt/apt.conf. Une valeur lue plus tard remplace la précédente ; une
// liste ({ "a"; "b"; }) s'allonge d'un fichier à l'autre. Commentaires //,
// /* */ et #. Chaque affectation finit par « ; ».
// Source : https://manpages.debian.org/trixie/apt/apt.conf.5.en.html
// Écarts : pas de #include ni de #clear, pas de portée « Clé::Sous { … } »
// imbriquée sur plusieurs niveaux (seulement les listes).

import type { Game } from './shell';

export const APT_DIRECTORY = '/etc/apt/apt.conf.d';

export interface ConfApt {
  values: Record<string, string>;
  lists: Record<string, string[]>;
  errors: string[];
}

// Les fichiers lus, dans l'ordre.
function files(game: Game): string[] {
  const n = game.find(APT_DIRECTORY);
  const names =
    n?.type === 'dossier'
      ? Object.keys(n.children)
          .filter((f) => /^[A-Za-z0-9_.-]+$/.test(f) && n.children[f].type === 'fichier')
          .sort()
      : [];
  return [...names.map((f) => `${APT_DIRECTORY}/${f}`), ...(game.exists('/etc/apt/apt.conf') ? ['/etc/apt/apt.conf'] : [])];
}

/** Lit toute la configuration d'apt ; les erreurs sont celles d'apt (« E: Syntax error … »). */
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

/** Une option booléenne d'apt : « 1 », « true », « yes », « on ». */
export const yes = (v: string | undefined) => /^(1|true|yes|on|enable)$/i.test(v ?? '');

/** Ce qu'affiche apt-config dump : une ligne par valeur, les listes en « Clé:: ». */
export function empty(c: ConfApt): string {
  const lines = Object.entries(c.values).map(([k, v]) => `${k} "${v}";`);
  for (const [k, l] of Object.entries(c.lists)) lines.push(`${k} "";`, ...l.map((v) => `${k}:: "${v}";`));
  return lines.join('\n');
}
