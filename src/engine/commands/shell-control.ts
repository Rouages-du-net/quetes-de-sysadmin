// The shell's control words a loop needs (man bash, "SHELL BUILTIN
// COMMANDS"): read, break and continue (inside a loop, control.ts answers
// them first), and seq (GNU coreutils, https://www.gnu.org/software/coreutils/seq),
// the list of numbers a for loop often goes through.

import type { Command } from './index';
import { opens } from './accounts';
import type { Shell } from '../shell';
import { bgCommand, disownCommand, fgCommand, jobsCommand, waitCommand } from '../jobs';

// nohup command… (GNU coreutils, https://www.gnu.org/software/coreutils/nohup):
// the command ignores the hangup of the session; its output, if it would go to
// the terminal, is appended to nohup.out (here, or in $HOME if this place is not writable).
function nohup(game: Shell, args: string[], last: boolean): string {
  if (!args.length) return game.error("nohup: missing operand\nTry 'nohup --help' for more information.", 125);
  const before = game.errorCount();
  const output = game.run(args, null, false);
  const code = game.status ?? (game.errorCount() > before ? 1 : 0);
  if (!last) {
    game.error('nohup: ignoring input');
    game.status = code;
    return output;
  }
  const here = game.writtenIn(`${game.cwd}/nohup.out`);
  const target = here ? 'nohup.out' : `${game.shellHome}/nohup.out`;
  const error = game.writeOutput(target, output, true);
  if (error) return game.error(error, 127);
  game.error(`nohup: ignoring input and appending output to '${target}'`);
  game.status = code;
  return '';
}

// watch [-n seconds] [-t] command (procps, https://man7.org/linux/man-pages/man1/watch.1.html):
// runs the command again and again and shows its output full screen, until
// Ctrl-C. In the game, the screen is redrawn as the machine's time passes
// (the follow of tail -f), when the output changes.
function watch(game: Shell, args: string[]): string {
  let interval = 2;
  let title = true;
  let i = 0;
  for (; i < args.length; i++) {
    const a = args[i];
    const n = /^(?:-n|--interval=?)(.*)$/.exec(a);
    if (n) {
      const value = n[1] || args[++i];
      if (value === undefined || !/^\d+(\.\d+)?$/.test(value)) return game.error(`watch: failed to parse argument: '${value ?? ''}'`, 1);
      interval = Math.max(0.1, Number(value));
    } else if (a === '-t' || a === '--no-title') title = false;
    else if (a === '-d' || a === '--differences' || a === '-c' || a === '--color' || a === '-x' || a === '--exec') continue;
    else if (a.startsWith('-') && a !== '-') return game.error(`watch: invalid option -- '${a.replace(/^-+/, '').slice(0, 1)}'\nTry 'watch --help' for more information.`, 1);
    else break;
  }
  const command = args.slice(i).join(' ');
  if (!command) return game.error("Usage:\n watch [options] command\nTry 'watch --help' for more information.", 1);
  const body = () => game.underCommand(command, game.cwd).output;
  const screen = (text: string) => {
    if (!title) return text;
    const left = `Every ${interval.toFixed(1)}s: ${command}`;
    const date = game.known().includes('date') ? game.underCommand('date', game.cwd).output.trim() : '';
    const right = date ? `${game.hostName}: ${date}` : game.hostName;
    return `${left}${' '.repeat(Math.max(1, game.columns - left.length - right.length))}${right}\n\n${text}`;
  };
  let last = body();
  game.follow = {
    screen: true,
    read: () => {
      const next = body();
      if (next === last) return '';
      last = next;
      return screen(next);
    },
  };
  return screen(last);
}

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

// su [-] [account] [-c command] (util-linux, https://man7.org/linux/man-pages/man1/su.1.html):
// a shell as another account (root by default), after that account's
// password; - (-l, --login) makes it a login shell, in its home. On Debian
// installed with sudo, root has no password: su always fails there with
// "Authentication failure", and sudo -i (or sudo su -) is the way in, unless
// root was given one (sudo passwd root). Another account opens with its own
// password (passwd, adduser), never when locked. root itself needs no password.
function su(game: Shell, args: string[]): string {
  let login = false;
  let command: string | null = null;
  const names: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-' || a === '-l' || a === '--login') login = true;
    else if (a === '-c' || a === '--command') command = args[++i] ?? '';
    else if (a.startsWith('-')) return game.error(`su: invalid option -- '${a.replace(/^-+/, '').slice(0, 1)}'\nTry 'su --help' for more information.`, 1);
    else names.push(a);
  }
  const user = names[0] ?? 'root';
  if (user !== 'root' && !game.accounts.users[user]) return game.error(`su: user ${user} does not exist or the user entry does not contain all the required fields`, 1);
  if (game.who !== 'root') {
    // The target's password, never shown (see passwordOf in accounts.ts).
    game.ask(
      game.t('su-password'),
      (typed) => {
        if (!opens(game, user, typed)) {
          game.status = 1;
          game.lastStatus = 1;
          return 'su: Authentication failure';
        }
        if (command !== null) {
          const before = game.who;
          game.who = user;
          try {
            return game.runTask(command, true);
          } finally {
            game.who = before;
          }
        }
        game.openShell(user, login);
        return '';
      },
      true,
    );
    return '';
  }
  if (command !== null) {
    const before = game.who;
    game.who = user;
    try {
      return game.runTask(command, true);
    } finally {
      game.who = before;
    }
  }
  game.openShell(user, login);
  return '';
}

export const SHELL_CONTROL: Record<string, Command> = {
  jobs: { ownOptions: true, launch: ({ args, game }) => jobsCommand(game, args) },
  fg: { ownOptions: true, launch: ({ args, game }) => fgCommand(game, args) },
  bg: { ownOptions: true, launch: ({ args, game }) => bgCommand(game, args) },
  wait: { ownOptions: true, launch: ({ args, game }) => waitCommand(game, args) },
  disown: { ownOptions: true, launch: ({ args, game }) => disownCommand(game, args) },
  nohup: { ownOptions: true, launch: ({ args, game, last }) => nohup(game, args, last) },
  watch: { ownOptions: true, launch: ({ args, game }) => watch(game, args) },
  su: { ownOptions: true, launch: ({ args, game }) => su(game, args) },
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
      // In a script, nobody types: the end of the input.
      if (game.script) {
        game.readLine(args, null);
        game.status = 1;
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
