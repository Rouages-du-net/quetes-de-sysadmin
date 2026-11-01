// tmux (https://man.openbsd.org/tmux): terminal sessions that live
// on the machine, independently of the connection. If the connection drops, what
// runs in tmux carries on; you reattach to it afterwards (tmux attach).
// Sessions are in etat.tmux ({ nom: { cree, lignes } }); the console
// copies into them what is displayed while attached (Shell.tmux).
// Differences: one window per session, no keyboard shortcuts (Ctrl+b d
// is written tmux detach), attach replays the session's last lines.
// And uname (coreutils): the running kernel.

import type { Shell } from '../shell';
import { systemd } from '../systemd';
import type { Command } from './index';

export interface SessionTmux {
  created: number;
  lines: string[];
}

const sessions = (game: Shell): Record<string, SessionTmux> => (game.state.tmux ??= {});
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// "Tue Oct 19 21:32:10 2027", like tmux ls.
const date = (ms: number) => {
  const d = new Date(ms);
  return `${DAYS[d.getUTCDay()]} ${MONTH[d.getUTCMonth()]} ${d.getUTCDate()} ${d.toISOString().slice(11, 19)} ${d.getUTCFullYear()}`;
};
const NESTED = 'sessions should be nested with care, unset $TMUX to force';
const WITHOUT_SERVER = (game: Shell) => `no server running on /tmp/tmux-${game.accounts.users[game.who]?.uid ?? 1000}/default`;

/** What is displayed in a tmux session: kept for the next time you reattach. */
export function noteTmux(game: Shell, name: string, text: string) {
  const s = sessions(game)[name];
  if (!s || !text) return;
  s.lines.push(...text.split('\n'));
  if (s.lines.length > 500) s.lines.splice(0, s.lines.length - 500);
}

// The value of an option (-s name, -t name).
const value = (args: string[], option: string) => (args.includes(option) ? args[args.indexOf(option) + 1] : undefined);

export const TMUX: Record<string, Command> = {
  tmux: {
    ownOptions: true,
    launch: ({ args, game }) => {
      const action = args.find((a) => !a.startsWith('-') && a !== value(args, '-s') && a !== value(args, '-t')) ?? 'new-session';
      const listing = sessions(game);
      const now = systemd(game)?.clock ?? 0;
      if (['new', 'new-session'].includes(action)) {
        if (game.tmux) return game.error(NESTED, 1);
        const name = value(args, '-s') ?? String(Object.keys(listing).filter((n) => /^\d+$/.test(n)).length);
        if (listing[name]) return game.error(`duplicate session: ${name}`, 1);
        listing[name] = { created: now, lines: [] };
        game.tmux = name;
        return '';
      }
      if (['ls', 'list-sessions'].includes(action)) {
        const names = Object.keys(listing);
        if (!names.length) return game.error(WITHOUT_SERVER(game), 1);
        return names.map((n) => `${n}: 1 windows (created ${date(listing[n].created)})${game.tmux === n ? ' (attached)' : ''}`).join('\n');
      }
      if (['attach', 'a', 'attach-session', 'at'].includes(action)) {
        if (game.tmux) return game.error(NESTED, 1);
        const names = Object.keys(listing);
        if (!names.length) return game.error(WITHOUT_SERVER(game), 1);
        const target = value(args, '-t') ?? names.at(-1)!;
        if (!listing[target]) return game.error(`can't find session: ${target}`, 1);
        game.tmux = target;
        return listing[target].lines.slice(-60).join('\n');
      }
      if (['detach', 'detach-client'].includes(action)) {
        if (!game.tmux) return game.error('no current client', 1);
        const name = game.tmux;
        game.tmux = null;
        return `[detached (from session ${name})]`;
      }
      if (['kill-session', 'kill-ses'].includes(action)) {
        const target = value(args, '-t') ?? game.tmux ?? Object.keys(listing).at(-1);
        if (!target || !listing[target]) return game.error(target ? `can't find session: ${target}` : WITHOUT_SERVER(game), 1);
        delete listing[target];
        if (game.tmux === target) game.tmux = null;
        return '';
      }
      return game.error(`unknown command: ${action}`, 1);
    },
  },

  uname: {
    launch: ({ args, game }) => {
      const kernel = (game.state.kernel as { active: string } | undefined)?.active ?? '6.12.0-quetes';
      const all = args.some((a) => /^-\w*a/.test(a));
      if (all) return `Linux ${game.host} ${kernel} #1 SMP PREEMPT_DYNAMIC Debian ${kernel.replace(/\+.*$/, '')}-1 x86_64 GNU/Linux`;
      if (args.some((a) => /^-\w*r/.test(a))) return kernel;
      return 'Linux';
    },
  },
};
