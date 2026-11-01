// Un petit interpréteur de scripts shell (/bin/sh), pour les crochets de git
// et les scripts de déploiement. Chaque ligne est lancée par le shell du jeu
// (shell.ts), depuis le lieu du script.
//
// Ce qu'il comprend, comme dash (le /bin/sh de Debian, https://manpages.debian.org/dash) :
// les commentaires et la ligne #!, les lignes coupées par « \ », set -e
// (s'arrêter à la première commande qui échoue), exit N, les variables
// (NOM=valeur, export, $NOM, ${NOM}, $1…, $?), $(commande), read (une ligne
// de l'entrée), cd, true, false, :, [ … ] (la commande test), et les suites
// « a && b », « a || b ».
// Une affectation devant une commande (GIT_WORK_TREE=… git …) ne vaut que
// pour git, qui la lit comme l'option correspondante.
// Écarts : pas de if, for, while, case ni de fonctions (une erreur le dit),
// et le code de retour d'une commande vaut 0 si elle n'a écrit aucune erreur
// (sauf si elle donne le sien, comme les plugins de supervision ou grep).

import type { Shell } from './shell';

export interface ScriptResult {
  output: string;
  code: number;
}

export interface OptionsScript {
  // Le lieu de départ (pour un crochet de git : le dépôt).
  cwd: string;
  // L'entrée standard (pour un crochet pre-receive : « ancien nouveau ref »).
  input?: string;
  // $0, $1, $2…
  arguments?: string[];
  // Le nom du script, pour les messages d'erreur (comme sh : « nom: 3: … »).
  name: string;
}

// Coupe une ligne sur && et || (hors des guillemets).
function chain(line: string): { command: string; before: '&&' | '||' | null }[] {
  const chunks: { command: string; before: '&&' | '||' | null }[] = [];
  let active = '';
  let before: '&&' | '||' | null = null;
  let quote = '';
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      if (c === quote) quote = '';
      active += c;
    } else if (c === '"' || c === "'") {
      quote = c;
      active += c;
    } else if ((c === '&' || c === '|') && line[i + 1] === c) {
      chunks.push({ command: active.trim(), before });
      before = c === '&' ? '&&' : '||';
      active = '';
      i++;
    } else active += c;
  }
  chunks.push({ command: active.trim(), before });
  return chunks;
}

const RESERVES_WORDS = ['if', 'then', 'else', 'elif', 'fi', 'for', 'while', 'until', 'do', 'done', 'case', 'esac', 'function'];

/** Exécute un script ; renvoie ce qu'il a écrit (sortie et erreurs mêlées) et son code de retour. */
export function runScript(game: Shell, text: string, options: OptionsScript): ScriptResult {
  const variables: Record<string, string> = { '?': '0', '0': options.name };
  (options.arguments ?? []).forEach((a, i) => (variables[String(i + 1)] = a));
  const input = (options.input ?? '').split('\n');
  let cwd = options.cwd;
  let stopOnError = false;
  const outputs: string[] = [];

  // $NOM, ${NOM}, $1, $? et $(commande) ; rien entre guillemets simples.
  const expand = (s: string): string => {
    let result = '';
    let simple = false;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === "'" && !simple) {
        simple = true;
        result += c;
      } else if (c === "'" && simple) {
        simple = false;
        result += c;
      } else if (c === '$' && !simple) {
        if (s[i + 1] === '(') {
          let depth = 1;
          let j = i + 2;
          for (; j < s.length && depth; j++) depth += s[j] === '(' ? 1 : s[j] === ')' ? -1 : 0;
          const inside = s.slice(i + 2, j - 1);
          result += game.underCommand(expand(inside), cwd).output.trim();
          i = j - 1;
        } else {
          const m = /^\{([A-Za-z_][A-Za-z0-9_]*|\d+|\?)\}|^([A-Za-z_][A-Za-z0-9_]*|\d|\?)/.exec(s.slice(i + 1));
          if (!m) result += c;
          else {
            result += variables[m[1] ?? m[2]] ?? '';
            i += m[0].length;
          }
        }
      } else result += c;
    }
    return result;
  };

  // Une commande simple ; renvoie son code de retour.
  const launch = (rawValue: string, number: number): number => {
    let line = expand(rawValue).trim();
    if (!line || line === ':' || line === 'true') return 0;
    if (line === 'false') return 1;
    // [ condition ] est la commande test (son dernier argument doit être « ] »).
    if (/^\[(\s|$)/.test(line)) {
      if (!/\s\]$/.test(line)) {
        outputs.push(game.t('test-hook-missing', { script: options.name, numero: number }));
        return 2;
      }
      line = `test ${line.slice(1, -1).trim()}`;
    }
    const first = line.split(/\s+/)[0];
    if (RESERVES_WORDS.includes(first)) {
      outputs.push(game.t('script-not-simulated', { script: options.name, numero: number, mot: first }));
      return 2;
    }
    const set = /^set\s+(.*)$/.exec(line);
    if (set) {
      if (/-\w*e/.test(set[1])) stopOnError = true;
      return 0;
    }
    const read = /^read\s+(.*)$/.exec(line);
    if (read) {
      const names = read[1].split(/\s+/).filter((n) => !n.startsWith('-'));
      const values = (input.shift() ?? '').trim().split(/\s+/);
      names.forEach((n, i) => (variables[n] = i === names.length - 1 ? values.slice(i).join(' ') : (values[i] ?? '')));
      return 0;
    }
    // NOM=valeur (seul) : une variable ; devant une commande : son environnement.
    const assignments: Record<string, string> = {};
    for (;;) {
      const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=("[^"]*"|'[^']*'|\S*)\s*/.exec(line);
      if (!m) break;
      assignments[m[1]] = m[2].replace(/^(["'])(.*)\1$/, '$2');
      line = line.slice(m[0].length);
    }
    if (!line) {
      Object.assign(variables, assignments);
      return 0;
    }
    if (line.startsWith('git ')) {
      const options = [
        ...(assignments.GIT_DIR ? [`--git-dir=${assignments.GIT_DIR}`] : []),
        ...(assignments.GIT_WORK_TREE ? [`--work-tree=${assignments.GIT_WORK_TREE}`] : []),
      ];
      if (options.length) line = `git ${options.join(' ')} ${line.slice(4)}`;
    }
    const r = game.underCommand(line, cwd);
    cwd = r.cwd;
    if (r.output) outputs.push(r.output);
    return r.code;
  };

  // Les lignes, recollées après un « \ » final.
  const lines = text.replace(/\\\n/g, ' ').split('\n');
  for (let n = 0; n < lines.length; n++) {
    const line = lines[n].trim();
    if (!line || line.startsWith('#')) continue;
    const exit = /^exit(?:\s+(\S+))?$/.exec(line);
    if (exit) return { output: outputs.join('\n'), code: Number(expand(exit[1] ?? '$?')) || 0 };
    let code = 0;
    for (const { command, before } of chain(line)) {
      if ((before === '&&' && code !== 0) || (before === '||' && code === 0)) continue;
      const end = /^exit(?:\s+(\S+))?$/.exec(command);
      if (end) return { output: outputs.join('\n'), code: Number(expand(end[1] ?? String(code))) || 0 };
      code = launch(command, n + 1);
    }
    variables['?'] = String(code);
    if (code !== 0 && stopOnError) return { output: outputs.join('\n'), code };
  }
  return { output: outputs.join('\n'), code: Number(variables['?']) };
}
