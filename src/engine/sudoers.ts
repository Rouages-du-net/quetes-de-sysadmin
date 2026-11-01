// La politique de sudo : /etc/sudoers et les fichiers qu'il inclut, lus
// comme sudoers(5) (https://www.sudo.ws/docs/man/sudoers.man/) :
//   - « @includedir /etc/sudoers.d » (ou l'ancienne forme #includedir) lit
//     chaque fichier du dossier, dans l'ordre, SAUF ceux dont le nom contient
//     un point ou finit par ~ (un « till.conf » est ignoré) ;
//   - une règle : « qui machines = (comptes) [NOPASSWD:] commandes » ; qui :
//     un compte, %groupe ou ALL ; une commande : ALL, ou un chemin complet
//     (sans arguments : tous les arguments sont permis ; avec : ceux-là
//     seulement ; * en joker) ;
//   - les lignes Defaults et les alias (Cmnd_Alias…) sont acceptés ; les
//     alias de commandes sont développés.
// Écarts : pas d'alias d'utilisateurs ni de machines, pas de Runas_Alias,
// pas de « ! » (négation), pas de digest ; la machine est toujours ALL.

import type { Shell } from './shell';
import { wildcard } from './tools';

export const SUDOERS = '/etc/sudoers';

export interface Rule {
  who: string[];
  as: string[];
  asText: string;
  withoutPassword: boolean;
  commands: string[];
  // Où elle est écrite (pour sudo -l).
  file: string;
}

export interface SudoersError {
  file: string;
  line: number;
  column: number;
  // Une clé de texte (sudoers-erreur-…), traduite par l'appelant.
  key: string;
  text: string;
  length: number;
}

// Les fichiers qu'un @includedir lit : sans point ni ~ final, triés.
export function includedFiles(game: Shell, directory: string): string[] {
  const d = game.find(directory);
  if (d?.type !== 'dossier') return [];
  return Object.keys(d.children)
    .filter((n) => !n.includes('.') && !n.endsWith('~') && d.children[n].type === 'fichier')
    .sort()
    .map((n) => `${directory}/${n}`);
}

/** Analyse un texte sudoers : les règles, et la première erreur de syntaxe. */
export function parse(text: string, file: string): { rules: Rule[]; included: string[]; defaults: string[]; error: SudoersError | null } {
  const rules: Rule[] = [];
  const defaults: string[] = [];
  const included: string[] = [];
  const alias: Record<string, string[]> = {};
  const lines = text.split('\n');
  for (const [i, rawValue] of lines.entries()) {
    const inclusion = /^\s*[@#]include(dir)?\s+(\S+)/.exec(rawValue);
    if (inclusion) {
      included.push((inclusion[1] ? 'dir:' : '') + inclusion[2]);
      continue;
    }
    const line = rawValue.replace(/#.*/, '').trimEnd();
    if (!line.trim()) continue;
    const error = (key: string, chunk: string): SudoersError => {
      const column = Math.max(1, rawValue.indexOf(chunk) + 1);
      return { file, line: i + 1, column, key, text: rawValue, length: Math.max(1, chunk.length) };
    };
    const d = /^\s*Defaults\s+(.+)$/.exec(line);
    if (d) {
      defaults.push(d[1].trim());
      continue;
    }
    const a = /^\s*(Cmnd_Alias|User_Alias|Host_Alias|Runas_Alias)\s+([A-Z][A-Z0-9_]*)\s*=\s*(.+)$/.exec(line);
    if (a) {
      if (a[1] === 'Cmnd_Alias') alias[a[2]] = a[3].split(',').map((c) => c.trim());
      continue;
    }
    const r = /^\s*([^\s=,]+(?:\s*,\s*[^\s=,]+)*)\s+([^\s=]+)\s*=\s*(?:\(([^)]*)\)\s*)?((?:[A-Z_]+:\s*)*)(.*)$/.exec(line);
    if (!r) return { rules, included, defaults, error: error('sudoers-error-syntax', line.trim().split(/\s+/).at(-1) ?? line) };
    const commands = r[5]
      .split(',')
      .map((c) => c.trim())
      .flatMap((c) => alias[c] ?? [c]);
    if (!commands.length || commands.some((c) => !c))
      return { rules, included, defaults, error: error('sudoers-error-syntax', r[5] || line.trim()) };
    const relative = commands.find((c) => c !== 'ALL' && !c.startsWith('/'));
    if (relative) return { rules, included, defaults, error: error('sudoers-error-path', relative.split(/\s+/)[0]) };
    rules.push({
      who: r[1].split(',').map((q) => q.trim()),
      as: (r[3] ?? 'root').split(',').map((c) => c.trim().split(':')[0] || 'root'),
      // Tel que sudo -l l'affiche : « ALL : ALL ».
      asText: (r[3] ?? 'root').replace(/\s*:\s*/, ' : '),
      withoutPassword: /NOPASSWD:/.test(r[4]),
      commands,
      file,
    });
  }
  return { rules, included, defaults, error: null };
}

/** Toute la politique : /etc/sudoers et ses inclusions ; la première erreur trouvée. */
export function read(game: Shell): { rules: Rule[]; defaults: string[]; files: string[]; error: SudoersError | null } {
  const rules: Rule[] = [];
  const defaults: string[] = [];
  const seen = new Set<string>();
  const readFile = (file: string): SudoersError | null => {
    if (seen.has(file)) return null;
    seen.add(file);
    const text = game.read(file);
    if (text === null) return null;
    const r = parse(text, file);
    rules.push(...r.rules);
    defaults.push(...r.defaults);
    if (r.error) return r.error;
    for (const i of r.included) {
      const e = i.startsWith('dir:') ? includedFiles(game, i.slice(4)).map(readFile).find(Boolean) : readFile(i);
      if (e) return e;
    }
    return null;
  };
  const error = readFile(SUDOERS);
  return { rules, defaults, files: [...seen], error };
}

// Une règle s'applique-t-elle à ce compte (son nom, %un de ses groupes, ALL) ?
const forEachOf = (game: Shell, r: Rule, account: string) =>
  r.who.some((q) => q === 'ALL' || q === account || (q.startsWith('%') && game.groupsFor(account).includes(q.slice(1))));

// Une commande de la règle couvre-t-elle cette commande (chemin complet et arguments) ?
function covers(allowedOne: string, requested: string): boolean {
  if (allowedOne === 'ALL') return true;
  const [path, ...args] = allowedOne.split(/\s+/);
  const [dPath, ...argsD] = requested.split(/\s+/);
  if (!wildcard(path).test(dPath)) return false;
  if (!args.length) return true;
  if (args.length === 1 && args[0] === '""') return argsD.length === 0;
  return wildcard(args.join(' ')).test(argsD.join(' '));
}

/** Ce compte peut-il lancer cette commande (chemin complet) en root avec sudo ? */
export function permitted(game: Shell, account: string, command: string, as = 'root'): boolean {
  return read(game).rules.some(
    (r) => forEachOf(game, r, account) && (r.as.includes(as) || r.as.includes('ALL')) && r.commands.some((c) => covers(c, command)),
  );
}

/** Les règles d'un compte, comme sudo -l les affiche : « (root) NOPASSWD: /usr/bin/… ». */
export function rulesFor(game: Shell, account: string): string[] {
  return read(game)
    .rules.filter((r) => forEachOf(game, r, account))
    .map((r) => `(${r.asText}) ${r.withoutPassword ? 'NOPASSWD: ' : ''}${r.commands.join(', ')}`);
}
