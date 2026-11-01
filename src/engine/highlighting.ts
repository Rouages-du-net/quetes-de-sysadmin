// La coloration de la ligne de commande, comme fish ou
// zsh-syntax-highlighting : la commande en vert si elle existe, en rouge
// sinon (on voit la faute de frappe avant d'appuyer sur Entrée), les
// options, les chaînes entre guillemets, les opérateurs, et les chemins qui
// existent soulignés. Elle suit le shell du jeu (decouper() dans outils.ts) :
// tubes et redirections (|, >, >>), guillemets, jokers, sudo ; rien de ce
// que ce shell ne comprend pas (pas de && ni de $VARIABLE) n'est mis en
// valeur. La ligne découpée se recolle exactement (les espaces compris),
// pour que l'interface puisse la dessiner sous le champ de saisie.

import type { Shell } from './shell';
import { COMMANDS } from './commands';

export type Kind = 'command' | 'unknown' | 'option' | 'string' | 'operator' | 'path' | 'glob' | 'text';

export interface Token {
  text: string;
  kind: Kind;
}

// Un mot de la ligne : ses morceaux (entre guillemets ou non), sa position.
interface Word {
  chunks: { text: string; city: boolean }[];
  // Le mot tel que le shell le lira (sans les guillemets).
  value: string;
  op?: '|' | '>' | '>>';
}

/** La ligne en morceaux : des mots, des opérateurs et des espaces, dans l'ordre. */
function lexer(line: string): (Word | string)[] {
  const output: (Word | string)[] = [];
  let word: Word | null = null;
  let quote = '';
  const finish = () => {
    if (word) output.push(word);
    word = null;
  };
  const add = (c: string, city: boolean) => {
    word ??= { chunks: [], value: '' };
    const last = word.chunks.at(-1);
    if (last && last.city === city) last.text += c;
    else word.chunks.push({ text: c, city });
  };
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      add(c, true);
      if (c === quote) quote = '';
      else word!.value += c;
    } else if (c === '"' || c === "'") {
      quote = c;
      // Une nouvelle chaîne commence : un morceau à elle.
      word ??= { chunks: [], value: '' };
      word.chunks.push({ text: c, city: true });
    } else if (/\s/.test(c)) {
      finish();
      if (typeof output.at(-1) === 'string') output[output.length - 1] += c;
      else output.push(c);
    } else if (c === '|' || c === '>') {
      finish();
      const double = c === '>' && line[i + 1] === '>';
      if (double) i++;
      const op = double ? '>>' : (c as '|' | '>');
      output.push({ chunks: [{ text: op, city: false }], value: op, op });
    } else {
      add(c, false);
      word!.value += c;
    }
  }
  finish();
  return output;
}

/** La commande existe-t-elle ici (le shell la lancerait-il) ? */
function exists(sh: Shell, name: string): boolean {
  if (!name) return false;
  if (name.includes('/')) {
    // /usr/bin/ls : le chemin complet d'une commande du jeu.
    const only = name.split('/').at(-1)!;
    if (/^\/(usr\/)?s?bin\/[\w.-]+$/.test(name) && COMMANDS[only] && !COMMANDS[only].directory) return sh.known().includes(only);
    if (COMMANDS[only]?.directory && name === `${COMMANDS[only].directory}/${only}`) return sh.known().includes(only);
    // Un script : il faut qu'il existe et qu'on puisse le lancer.
    const n = sh.find(name);
    return !!n && n.type === 'file' && sh.can(n, 'x');
  }
  if (COMMANDS[name]?.section === 5) return false;
  // !!, !12, !cat : l'historique, que le shell développe avant de lancer la commande.
  if (/^!(!|-?\d+|[A-Za-z_./])/.test(name)) return true;
  // help est intégré au shell (comme aide) : il répond toujours.
  return name === 'help' || sh.known().includes(name);
}

/** Un argument qui désigne un fichier ou un dossier existant (comme le soulignement de zsh). */
function path(sh: Shell, value: string): boolean {
  if (!value || value.startsWith('-')) return false;
  try {
    return sh.find(value) !== null;
  } catch {
    return false;
  }
}

/** La ligne découpée en jetons colorés ; leurs textes recollés redonnent la ligne. */
export function colourise(sh: Shell, line: string): Token[] {
  const tokens: Token[] = [];
  const push = (text: string, kind: Kind) => {
    if (!text) return;
    const last = tokens.at(-1);
    if (last && last.kind === kind) last.text += text;
    else tokens.push({ text, kind });
  };
  // Où l'on en est dans la commande : on attend son nom, une option de sudo, ou des arguments.
  let expected: 'command' | 'sudo' | 'sudo-value' | 'argument' | 'target' = 'command';
  for (const x of lexer(line)) {
    if (typeof x === 'string') {
      push(x, 'text');
      continue;
    }
    if (x.op) {
      push(x.value, 'operator');
      // Après une redirection vient un fichier ; après un tube, une commande.
      expected = x.op === '|' ? 'command' : 'target';
      continue;
    }
    let kind: Kind;
    const notCity = x.chunks.every((m) => !m.city);
    if (expected === 'command' || expected === 'sudo') {
      if (expected === 'sudo' && x.value.startsWith('-')) {
        kind = 'option';
        if (x.value === '-u' || x.value === '-g') expected = 'sudo-value';
      } else {
        kind = exists(sh, x.value) ? 'command' : 'unknown';
        expected = x.value === 'sudo' && kind === 'command' ? 'sudo' : 'argument';
      }
    } else if (expected === 'sudo-value') {
      kind = 'text';
      expected = 'sudo';
    } else if (notCity && /^-./.test(x.value) && expected === 'argument') kind = 'option';
    else if (notCity && /[*?]/.test(x.value)) kind = sh.expand(x.value)[0] !== x.value ? 'glob' : 'text';
    else kind = path(sh, x.value) ? 'path' : 'text';
    if (expected === 'target') expected = 'argument';
    // Les morceaux entre guillemets restent des chaînes, sauf pour le nom de la commande.
    for (const m of x.chunks) push(m.text, m.city && kind !== 'command' && kind !== 'unknown' && kind !== 'path' ? 'string' : kind);
  }
  return tokens;
}
