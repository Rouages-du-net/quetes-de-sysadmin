// visudo and sudo -l (https://www.sudo.ws/docs/man/visudo.man/,
// https://www.sudo.ws/docs/man/sudo.man/). Like the real visudo: you edit
// a copy (file.tmp), checked when the editor closes; if it has
// an error, visudo shows it and asks "What now?" (e: edit again,
// x: exit without saving, Q: save anyway). The saved
// file belongs to root, with mode 0440. Messages: sudo's French
// translation.

import type { Shell } from '../shell';
import { parse, read, rulesFor, SUDOERS, type SudoersError } from '../sudoers';
import type { Command } from './index';

// The error as sudo shows it: file:line:column: message, the line, and ^~~~ under the faulty part.
export const showError = (game: Shell, e: SudoersError) =>
  [`${e.file}:${e.line}:${e.column}: ${game.t(e.key)}`, e.text, `${' '.repeat(e.column - 1)}^${'~'.repeat(e.length - 1)}`].join('\n');

// Opens the copy in the editor; on closing, checks it and installs it.
function edit(game: Shell, target: string, temp: string) {
  const text = game.read(temp) ?? '';
  game.edition = {
    path: temp,
    text: text && !text.endsWith('\n') ? text + '\n' : text,
    root: true,
    message: game.t('nano-lines-read', { lines: text ? text.split('\n').length : 0 }),
    conclude: true,
    after: () => check(game, target, temp),
  };
}

function installer(game: Shell, target: string, temp: string): string {
  const content = game.read(temp) ?? '';
  const before = game.who;
  game.who = 'root';
  try {
    const n = game.find(target);
    if (n?.type === 'file') Object.assign(n, { content, lines: true, owner: 'root', group: 'root', mode: 'r--r-----', size: undefined });
    else game.place('visudo', target, { type: 'file', content, lines: true, owner: 'root', group: 'root', mode: 'r--r-----' });
    game.erase(temp);
  } finally {
    game.who = before;
  }
  return '';
}

function check(game: Shell, target: string, temp: string): string {
  const fresh = game.read(temp) ?? '';
  if (fresh === (game.read(target) ?? '') && game.exists(target)) {
    game.erase(temp);
    return `visudo: ${temp} unchanged`;
  }
  const { error } = parse(fresh, temp);
  if (!error) return installer(game, target, temp);
  const ask = (): void =>
    game.ask(game.t('visudo-and-now'), (r) => {
      const choice = r.trim();
      if (choice === 'e') {
        edit(game, target, temp);
        return '';
      }
      if (choice === 'x') {
        game.erase(temp);
        return '';
      }
      if (choice === 'Q') return installer(game, target, temp);
      ask();
      return game.t('visudo-options');
    });
  ask();
  return showError(game, error);
}

export const COMMANDS_SUDOERS: Record<string, Command> = {
  visudo: {
    section: 8,
    launch: ({ args, game }) => {
      const i = args.indexOf('-f');
      const target = i >= 0 ? (args[i + 1] ?? '') : SUDOERS;
      if (i >= 0 && !target) return game.error(game.t('visudo-usage'), 1);
      // -c: check without changing anything.
      if (args.includes('-c')) {
        if (game.who !== 'root') return game.error(game.t('visudo-permission', { file: target }), 1);
        if (i >= 0) {
          const text = game.read(target);
          if (text === null) return game.error(game.t('visudo-missing', { file: target }), 1);
          const { error } = parse(text, target);
          if (error) return game.error(showError(game, error), 1);
          return game.t('visudo-analysis-succeeded', { file: target });
        }
        const { error, files } = read(game);
        if (error) return game.error(showError(game, error), 1);
        return files.map((file) => game.t('visudo-analysis-succeeded', { file: file })).join('\n');
      }
      if (game.who !== 'root') return game.error(game.t('visudo-permission', { file: target }), 1);
      const directory = target.replace(/\/[^/]+$/, '') || '/';
      if (!game.exists(directory)) return game.error(game.t('visudo-missing', { file: `${target}.tmp` }), 1);
      const temp = `${target}.tmp`;
      game.place('visudo', temp, { type: 'file', content: game.read(target) ?? '', lines: true, owner: 'root', mode: 'rw-------' });
      edit(game, target, temp);
      return '';
    },
  },
};

/** sudo -l [-U account]: the allowed commands (the policy of /etc/sudoers). */
export function listSudo(game: Shell, args: string[]): string {
  const i = args.indexOf('-U');
  const account = i >= 0 ? (args[i + 1] ?? '') : game.player;
  if (i >= 0 && !game.accounts.users[account]) return game.error(game.t('sudo-account-unknown', { account: account }), 1);
  const host = game.read('/etc/hostname')?.trim() || game.host;
  // A machine with no /etc/sudoers described by the chapter: Debian's (the sudo group has all rights).
  const rules = game.exists(SUDOERS) ? rulesFor(game, account) : game.groupsFor(account).includes('sudo') || account === 'root' ? ['(ALL : ALL) ALL'] : [];
  if (!rules.length) return game.t('sudo-none', { account: account, host: host });
  // Like sudo -l: without the quotes, colons escaped.
  const defaults = game.exists(SUDOERS)
    ? read(game)
        .defaults.flatMap((x) => x.split(','))
        .map((x) => x.trim().replace(/"/g, '').replace(/:/g, '\\:'))
    : ['env_reset', 'mail_badpass', 'secure_path=/usr/local/sbin\\:/usr/local/bin\\:/usr/sbin\\:/usr/bin\\:/sbin\\:/bin', 'use_pty'];
  return game.t('sudo', { account: account, host: host, defaults: defaults.join(', '), rules: rules.map((r) => `    ${r}`).join('\n') });
}
