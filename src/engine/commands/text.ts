// Commandes de texte : elles lisent des fichiers, ou ce qui arrive par un
// tube quand on ne leur donne pas de fichier. C'est la force d'Unix : de
// petits outils qui font une seule chose, et qu'on enchaîne.

import { options } from '../tools';
import { colourise, readColour, invalidColourMessage, sgr } from '../colours';
import type { Command, Context } from './index';

// Les lignes à traiter : celles des fichiers donnés, sinon l'entrée du tube.
function texts(cmd: string, { input, game }: Context, files: string[]): { name: string; text: string }[] {
  if (!files.length) {
    if (input === null) game.error(game.t('text-without-input', { commande: cmd }));
    return input === null ? [] : [{ name: '', text: input }];
  }
  return files
    .map((f) => ({ name: f, text: game.readFor(cmd, f) }))
    .filter((t): t is { name: string; text: string } => t.text !== null);
}

const linesFor = (t: string) => (t === '' ? [] : t.split('\n'));

// -n 5, -n5 ou -5 → 5.
function count(args: string[], fallback: number): { n: number; rest: string[] } {
  const rest: string[] = [];
  let n = fallback;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-n') n = Number(args[++i]);
    else if (/^-n\d+$/.test(a)) n = Number(a.slice(2));
    else if (/^-\d+$/.test(a)) n = Number(a.slice(1));
    else rest.push(a);
  }
  return { n: Number.isFinite(n) ? n : fallback, rest };
}

function head(cmd: 'head' | 'tail') {
  return (c: Context) => {
    const { n, rest } = count(c.args, 10);
    const ts = texts(cmd, c, rest);
    return ts
      .map(({ name, text }) => {
        const l = linesFor(text);
        const part = cmd === 'head' ? l.slice(0, n) : l.slice(Math.max(0, l.length - n));
        return (ts.length > 1 ? `==> ${name} <==\n` : '') + part.join('\n');
      })
      .join('\n\n');
  };
}

export const TEXT: Record<string, Command> = {
  less: {
    launch: (c) => texts('less', c, c.args.slice(0, 1)).map((t) => t.text).join('\n'),
  },

  grep: {
    launch: (raw) => {
      // --color : comme l'alias « grep --color=auto » du ~/.bashrc de Debian.
      const colour = readColour(raw.args, 'auto', 'auto');
      if (colour.invalid !== undefined) return raw.game.error(invalidColourMessage(raw, 'grep', colour.invalid));
      const c = { ...raw, args: colour.args };
      const inColour = colourise(c, colour.when);
      const { letters, rest } = options(c.args);
      const [pattern, ...files] = rest;
      if (pattern === undefined) return c.game.error(c.game.t('grep-usage'));
      const broken = letters.has('i');
      // Le motif : une expression régulière basique (BRE), étendue avec -E, du texte brut avec -F.
      let re: RegExp | null = null;
      if (!letters.has('F'))
        try {
          re = new RegExp(letters.has('E') ? pattern : toBasicRegex(pattern), broken ? 'i' : '');
        } catch {
          c.game.status = 2;
          return c.game.error(/\[/.test(pattern) && !/\]/.test(pattern) ? 'grep: Unmatched [, [^, [:, [., or [=' : 'grep: Invalid regular expression');
        }
      const searches = broken ? pattern.toLowerCase() : pattern;
      const correspond = (l: string) => (re ? re.test(l) : (broken ? l.toLowerCase() : l).includes(searches));
      const ts = texts('grep', c, files);
      // En couleur (GREP_COLORS par défaut) : ce qui correspond en rouge gras, le nom du fichier en magenta, le « : » en cyan.
      const global = re ? new RegExp(re.source, re.flags + 'g') : null;
      const highlight = (l: string) => {
        if (!inColour || letters.has('v')) return l;
        if (global) return l.replace(global, (m) => sgr('01;31', m));
        if (!searches) return l;
        let output = '';
        let i = 0;
        const inside = broken ? l.toLowerCase() : l;
        for (let k = inside.indexOf(searches); k >= 0; k = inside.indexOf(searches, i)) {
          output += l.slice(i, k) + sgr('01;31', l.slice(k, k + searches.length));
          i = k + searches.length;
        }
        return output + l.slice(i);
      };
      const prefix = (name: string) => (inColour ? `${sgr('35', name)}${sgr('36', ':')}` : `${name}:`);
      const outputs: string[] = [];
      for (const { name, text } of ts) {
        const kept = linesFor(text).filter((l) => correspond(l) !== letters.has('v'));
        if (letters.has('c')) outputs.push(ts.length > 1 ? `${prefix(name)}${kept.length}` : String(kept.length));
        else outputs.push(...kept.map((l) => (ts.length > 1 ? `${prefix(name)}${highlight(l)}` : highlight(l))));
      }
      // Écart volontaire : le vrai grep ne dit rien quand il ne trouve rien ;
      // ici, on le précise (seulement à l'écran, jamais dans un tube).
      // -q : rien à l'écran ; seul compte le code de retour (échec si rien trouvé).
      if (letters.has('q')) return outputs.length ? '' : c.game.error('');
      // Comme grep : code 1 quand rien ne correspond (utile dans un script).
      c.game.status = outputs.length ? 0 : 1;
      if (!outputs.length && c.last && ts.length) c.game.error(c.game.t('grep-nothing', { motif: pattern }));
      return outputs.join('\n');
    },
  },

  head: {
    launch: head('head'),
  },

  tail: {
    // -f (--follow, -F) : après la fin du fichier, tail attend ce qui s'y ajoute
    // et l'affiche, jusqu'à Ctrl-C (Shell.suivi, voir activite.ts).
    launch: (c) => {
      const follow = c.args.some((a) => a === '-f' || a === '-F' || a === '--follow');
      const args = c.args.filter((a) => a !== '-f' && a !== '-F' && a !== '--follow');
      const output = head('tail')({ ...c, args });
      const { rest } = count(args, 10);
      // Écart : dans un tube (tail -f journal | grep …), le jeu affiche une fois, sans suivre.
      if (!follow || !c.last || rest.length !== 1 || c.game.readFor('tail', rest[0]) === null) return output;
      const file = c.game.resolve(rest[0]);
      let views = linesFor(c.game.read(file) ?? '').length;
      c.game.follow = {
        read: () => {
          const lines = linesFor(c.game.read(file) ?? '');
          if (lines.length < views) {
            views = lines.length;
            return `tail: ${rest[0]}: file truncated`;
          }
          const fresh = lines.slice(views);
          views = lines.length;
          return fresh.join('\n');
        },
      };
      return output;
    },
  },

  wc: {
    launch: (c) => {
      const { letters, rest } = options(c.args);
      const all = !letters.has('l') && !letters.has('w') && !letters.has('c');
      return texts('wc', c, rest)
        .map(({ name, text }) => {
          // Comme le vrai wc : on compte les fins de ligne.
          const fields: number[] = [];
          if (all || letters.has('l')) fields.push(text === '' ? 0 : text.split('\n').length);
          if (all || letters.has('w')) fields.push(text.split(/\s+/).filter(Boolean).length);
          if (all || letters.has('c')) fields.push(new TextEncoder().encode(text).length + (text ? 1 : 0));
          return [fields.length === 1 ? String(fields[0]) : fields.map((n) => String(n).padStart(6)).join(' '), name].filter(Boolean).join(' ');
        })
        .join('\n');
    },
  },

  sort: {
    launch: (c) => {
      const { letters, rest } = options(c.args);
      const lines = texts('sort', c, rest).flatMap((t) => linesFor(t.text));
      const num = (l: string) => parseFloat(l.trim()) || 0;
      lines.sort(letters.has('n') ? (a, b) => num(a) - num(b) || a.localeCompare(b, 'fr') : (a, b) => a.localeCompare(b, 'fr'));
      if (letters.has('r')) lines.reverse();
      return lines.join('\n');
    },
  },

  uniq: {
    launch: (c) => {
      const { letters, rest } = options(c.args);
      const groups: { line: string; n: number }[] = [];
      for (const l of texts('uniq', c, rest).flatMap((t) => linesFor(t.text))) {
        const last = groups.at(-1);
        if (last && last.line === l) last.n++;
        else groups.push({ line: l, n: 1 });
      }
      return groups.map((g) => (letters.has('c') ? `${String(g.n).padStart(7)} ${g.line}` : g.line)).join('\n');
    },
  },

  cut: {
    launch: (c) => {
      let sep = '\t';
      let fields: number[] = [];
      const files: string[] = [];
      for (let i = 0; i < c.args.length; i++) {
        const a = c.args[i];
        if (a === '-d') sep = c.args[++i] ?? sep;
        else if (a.startsWith('-d')) sep = a.slice(2);
        else if (a === '-f') fields = (c.args[++i] ?? '').split(',').map(Number);
        else if (a.startsWith('-f')) fields = a.slice(2).split(',').map(Number);
        else files.push(a);
      }
      if (!fields.length || fields.some((n) => !n)) return c.game.error(c.game.t('cut-fields'));
      if (sep.length !== 1) return c.game.error(c.game.t('cut-separator'));
      return texts('cut', c, files)
        .flatMap((t) => linesFor(t.text))
        .map((l) => {
          const parts = l.split(sep);
          return parts.length === 1 ? l : fields.map((n) => parts[n - 1]).filter((p) => p !== undefined).join(sep);
        })
        .join('\n');
    },
  },
};

// Une expression régulière basique (BRE, comme grep sans -E) en expression JavaScript :
// + ? | ( ) { } sont des caractères ordinaires, et spéciaux précédés de \ ;
// les crochets [...] sont recopiés tels quels.
export function toBasicRegex(pattern: string): string {
  let res = '';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '\\' && i + 1 < pattern.length) {
      const s = pattern[++i];
      res += '+?|(){}'.includes(s) ? s : `\\${s}`;
    } else if ('+?|(){}'.includes(c)) res += `\\${c}`;
    else if (c === '[') {
      const end = pattern.indexOf(']', i + (pattern[i + 1] === ']' ? 2 : pattern[i + 1] === '^' && pattern[i + 2] === ']' ? 3 : 1));
      if (end < 0) return pattern.slice(0, i) + '[';
      res += pattern.slice(i, end + 1);
      i = end;
    } else res += c;
  }
  return res;
}
