// The shell's control words a loop needs (man bash, "SHELL BUILTIN
// COMMANDS"): read, break and continue (inside a loop, control.ts answers
// them first), and seq (GNU coreutils, https://www.gnu.org/software/coreutils/seq),
// the list of numbers a for loop often goes through.

import type { Command } from './index';

// seq [-s SEP] [-w] [-f FORMAT] [FIRST [INCREMENT]] LAST
function seq(args: string[], fail: (m: string) => string): string {
  let separator = '\n';
  let width = false;
  let format: string | null = null;
  const numbers: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-s' || a === '--separator') separator = args[++i] ?? '';
    else if (a.startsWith('-s') && a.length > 2) separator = a.slice(2);
    else if (a.startsWith('--separator=')) separator = a.slice(12);
    else if (a === '-w' || a === '--equal-width') width = true;
    else if (a === '-f' || a === '--format') format = args[++i] ?? '';
    else if (a.startsWith('--format=')) format = a.slice(9);
    else if (/^-[^\d.]/.test(a)) return fail(`seq: invalid option -- '${a.slice(1, 2)}'\nTry 'seq --help' for more information.`);
    else numbers.push(a);
  }
  if (!numbers.length) return fail("seq: missing operand\nTry 'seq --help' for more information.");
  if (numbers.length > 3) return fail(`seq: extra operand '${numbers[3]}'\nTry 'seq --help' for more information.`);
  const bad = numbers.find((n) => !/^[-+]?(\d+\.?\d*|\.\d+)$/.test(n));
  if (bad) return fail(`seq: invalid floating point argument: '${bad}'\nTry 'seq --help' for more information.`);
  const [first, step, last] = numbers.length === 1 ? ['1', '1', numbers[0]] : numbers.length === 2 ? [numbers[0], '1', numbers[1]] : numbers;
  if (Number(step) === 0) return fail(`seq: invalid Zero increment value: '${step}'\nTry 'seq --help' for more information.`);
  // The output keeps the most decimals given in FIRST or INCREMENT (like GNU seq).
  const decimals = Math.max(...[first, step].map((n) => (n.includes('.') ? n.split('.')[1].length : 0)));
  const out: string[] = [];
  const a = Number(first);
  const b = Number(last);
  const s = Number(step);
  for (let k = 0; ; k++) {
    const v = a + k * s;
    if (s > 0 ? v > b + 1e-9 : v < b - 1e-9) break;
    if (out.length >= 1_000_000) break;
    let text = v.toFixed(decimals);
    if (format) text = format.replace(/%(\.\d+)?[gfe]/, (_, p?: string) => (p ? v.toFixed(Number(p.slice(1))) : String(Number(v.toFixed(decimals))))).replace(/%%/g, '%');
    out.push(text);
  }
  if (width && !format) {
    const w = Math.max(...out.map((t) => t.replace('-', '').length));
    for (let i = 0; i < out.length; i++) out[i] = (out[i].startsWith('-') ? '-' : '') + out[i].replace('-', '').padStart(w, '0');
  }
  return out.join(separator);
}

export const SHELL_CONTROL: Record<string, Command> = {
  seq: { ownOptions: true, launch: ({ args, game }) => seq(args, (m) => game.error(m)) },
  // read [-r] [-p prompt] [name…]: a line from the input (< file, <<<, a here-document),
  // or from the keyboard; in a pipeline, read runs in a subshell and sets nothing.
  read: {
    ownOptions: true,
    launch: ({ args, input, game }) => {
      if (game.inPipeline) return '';
      if (input !== null) {
        game.status = game.readLine(args, input === '' ? null : input.split('\n')[0]);
        return '';
      }
      const p = args.indexOf('-p');
      const prompt = p >= 0 ? (args[p + 1] ?? '') : '';
      game.ask(prompt, (answer) => {
        game.status = game.readLine(args, answer);
        return '';
      }, /^-\w*s/.test(args.find((a) => /^-\w*s/.test(a)) ?? ''));
      return '';
    },
  },
  break: { ownOptions: true, launch: ({ game }) => (game.error(game.t('shell-loop-only', { command: 'break' })), (game.status = 0), '') },
  continue: { ownOptions: true, launch: ({ game }) => (game.error(game.t('shell-loop-only', { command: 'continue' })), (game.status = 0), '') },
};
