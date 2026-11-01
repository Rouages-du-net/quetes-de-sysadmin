// diff (GNU diffutils): the differences between two files, or between two
// places (-r). Normal format ("3c3", "<", "---", ">") or unified
// (-u, three lines of context), -q to say only whether they differ.
// Based on https://www.gnu.org/software/diffutils/manual/diffutils.html.
// Difference: the files' time, in the -u header, is the machine's time
// when the command runs.

import type { Shell } from '../shell';
import { systemd } from '../systemd';
import type { Command } from './index';
import { colourise, readColour, invalidColourMessage, sgr } from '../colours';

// --color: GNU diff's default palette (hd=1, ad=32, de=31, ln=36).
type Paint = (code: string, text: string) => string;
const raw: Paint = (_code, text) => text;

type Op = { t: ' ' | '-' | '+'; l: string; a: number; b: number };

// The edit script (longest common subsequence): each line kept,
// removed or added, with its numbers in each file (starting at 1).
function edit(a: string[], b: string[]): Op[] {
  const l = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--) l[i][j] = a[i] === b[j] ? l[i + 1][j + 1] + 1 : Math.max(l[i + 1][j], l[i][j + 1]);
  const ops: Op[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) ops.push({ t: ' ', l: a[i++], a: i, b: ++j });
    else if (i < a.length && (j === b.length || l[i + 1][j] >= l[i][j + 1])) ops.push({ t: '-', l: a[i++], a: i, b: j });
    else ops.push({ t: '+', l: b[j++], a: i, b: j });
  }
  return ops;
}

const lines = (text: string) => (text === '' ? [] : text.replace(/\n$/, '').split('\n'));
const range = (start: number, end: number) => (end > start ? `${start},${end}` : String(start));

// The normal format: one block per group of changes.
function normal(ops: Op[], paint: Paint = raw): string {
  const output: string[] = [];
  for (let k = 0; k < ops.length; ) {
    if (ops[k].t === ' ') {
      k++;
      continue;
    }
    const group: Op[] = [];
    while (k < ops.length && ops[k].t !== ' ') group.push(ops[k++]);
    const less = group.filter((o) => o.t === '-');
    const more = group.filter((o) => o.t === '+');
    const beforeA = group[0].t === '-' ? group[0].a - 1 : group[0].a;
    const beforeB = group[0].t === '+' ? group[0].b - 1 : group[0].b;
    if (less.length && more.length) output.push(paint('36', `${range(beforeA + 1, beforeA + less.length)}c${range(beforeB + 1, beforeB + more.length)}`));
    else if (less.length) output.push(paint('36', `${range(beforeA + 1, beforeA + less.length)}d${beforeB}`));
    else output.push(paint('36', `${beforeA}a${range(beforeB + 1, beforeB + more.length)}`));
    output.push(...less.map((o) => paint('31', `< ${o.l}`)));
    if (less.length && more.length) output.push('---');
    output.push(...more.map((o) => paint('32', `> ${o.l}`)));
  }
  return output.join('\n');
}

// The unified format: hunks ("@@ -a,n +b,m @@") with 3 lines of context.
function unified(ops: Op[], aName: string, bName: string, date: string, paint: Paint = raw): string {
  const changes = ops.map((o, k) => (o.t === ' ' ? -1 : k)).filter((k) => k >= 0);
  if (!changes.length) return '';
  const chunks: [number, number][] = [];
  for (const k of changes) {
    const start = Math.max(0, k - 3);
    const end = Math.min(ops.length - 1, k + 3);
    const last = chunks.at(-1);
    if (last && start <= last[1] + 1) last[1] = Math.max(last[1], end);
    else chunks.push([start, end]);
  }
  const output = [paint('1', `--- ${aName}\t${date}`), paint('1', `+++ ${bName}\t${date}`)];
  for (const [start, end] of chunks) {
    const part = ops.slice(start, end + 1);
    const nA = part.filter((o) => o.t !== '+').length;
    const nB = part.filter((o) => o.t !== '-').length;
    const firstA = part.find((o) => o.t !== '+')?.a ?? part[0].a;
    const firstB = part.find((o) => o.t !== '-')?.b ?? part[0].b;
    const inHead = (first: number, n: number) => (n === 0 ? `${first},0` : n === 1 ? String(first) : `${first},${n}`);
    output.push(
      paint('36', `@@ -${inHead(nA ? firstA : firstA, nA)} +${inHead(firstB, nB)} @@`),
      ...part.map((o) => paint(o.t === '-' ? '31' : o.t === '+' ? '32' : '', `${o.t}${o.l}`)),
    );
  }
  return output.join('\n');
}

const dateDiff = (game: Shell) => {
  const ms = systemd(game)?.clock ?? Date.UTC(2027, 0, 1);
  return `${new Date(ms)
    .toISOString()
    .replace('T', ' ')
    .replace('Z', '')
    .replace(/\.(\d+)$/, '.$1000000')} +0200`;
};

export const DIFF: Record<string, Command> = {
  diff: {
    options: ['u', 'r', 'q'],
    launch: (c) => {
      // --color[=WHEN]: without the option, diff doesn't colour; "--color" alone means "auto".
      const colour = readColour(c.args, 'never', 'auto');
      if (colour.invalid !== undefined) return c.game.error(invalidColourMessage(c, 'diff', colour.invalid));
      const { args } = colour;
      const { game } = c;
      const paint: Paint = colourise(c, colour.when) ? sgr : raw;
      const letters = new Set(args.filter((a) => /^-[a-zA-Z]+$/.test(a)).flatMap((a) => [...a.slice(1)]));
      const [gauche, right] = args.filter((a) => !a.startsWith('-'));
      if (!gauche || !right) return game.error(game.t('diff-usage', { operand: gauche ?? 'diff' }));
      const outputs: string[] = [];
      const compare = (a: string, b: string, root: boolean) => {
        const na = game.find(a);
        const nb = game.find(b);
        for (const [path, n] of [
          [a, na],
          [b, nb],
        ] as const)
          if (!n) return void game.error(game.t('diff-missing', { target: path }));
        if (na!.type === 'directory' && nb!.type === 'directory') {
          if (!root && !letters.has('r')) return void outputs.push(game.t('diff-under-directories', { a, b }));
          const names = [...new Set([...Object.keys(na!.children), ...Object.keys(nb!.children)])].sort();
          for (const name of names) {
            if (!(name in nb!.children)) outputs.push(game.t('diff-only', { place: a, name: name }));
            else if (!(name in na!.children)) outputs.push(game.t('diff-only', { place: b, name: name }));
            else compare(`${a.replace(/\/$/, '')}/${name}`, `${b.replace(/\/$/, '')}/${name}`, false);
          }
          return;
        }
        // A file and a place: compare with the file of the same name in the place.
        if (na!.type === 'directory' || nb!.type === 'directory') {
          if (!root) return void outputs.push(game.t('diff-types', { a, b }));
          return compare(na!.type === 'directory' ? `${a}/${game.name(b)}` : a, nb!.type === 'directory' ? `${b}/${game.name(a)}` : b, false);
        }
        const ta = game.readFor('diff', a);
        const tb = game.readFor('diff', b);
        if (ta === null || tb === null || ta === tb) return;
        if (letters.has('q')) return void outputs.push(game.t('diff-different', { a, b }));
        const ops = edit(lines(ta), lines(tb));
        if (!root) outputs.push(paint('1', `diff ${[...letters].map((l) => `-${l}`).join(' ')} ${a} ${b}`.replace(/ +/g, ' ')));
        outputs.push(letters.has('u') ? unified(ops, a, b, dateDiff(game), paint) : normal(ops, paint));
      };
      compare(gauche, right, true);
      return outputs.join('\n');
    },
  },
};
