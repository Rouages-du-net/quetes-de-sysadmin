// Les commandes des scripts : sh (et bash) pour lancer un script, test (ou
// [ … ] dans un script) pour vérifier une condition, date et readlink. Les scripts eux-mêmes
// sont interprétés par script.ts.
// D'après dash (https://manpages.debian.org/dash), test et date des
// coreutils (https://www.gnu.org/software/coreutils/manual/).

import type { Shell } from '../shell';
import { runScript } from '../script';
import { summerTime, systemd } from '../systemd';
import { timeOfDay, machineTime, setClock } from '../time';
import { content } from '../tools';
import type { Command } from './index';

/** Lance un fichier comme un script /bin/sh ; renvoie sa sortie (échec si son code n'est pas 0). */
export function launchScript(game: Shell, file: string, args: string[], name = file): string {
  const n = game.find(file);
  if (n?.type !== 'file') return game.error(game.t('sh-missing', { file: file }));
  const r = runScript(game, content(n, game), { cwd: game.cwd, name, arguments: args });
  if (r.code !== 0) game.error('');
  return r.output;
}

// test EXPRESSION : réussit (rien) ou échoue (code 1, sans message).
function evaluate(game: Shell, a: string[]): boolean | string {
  if (a[0] === '!') {
    const r = evaluate(game, a.slice(1));
    return typeof r === 'string' ? r : !r;
  }
  if (a.length === 0) return false;
  if (a.length === 1) return a[0] !== '';
  if (a.length === 2) {
    const [op, x] = a;
    const n = game.find(x);
    switch (op) {
      case '-e':
        return !!n;
      case '-f':
        return n?.type === 'file';
      case '-d':
        return n?.type === 'directory';
      case '-L':
      case '-h':
        return game.find(x, false)?.type === 'file' && (game.find(x, false) as { link?: string }).link !== undefined;
      case '-s':
        return n?.type === 'file' && content(n, game) !== '';
      case '-r':
      case '-w':
      case '-x':
        return !!n && game.can(n, op[1] as 'r' | 'w' | 'x');
      case '-n':
        return x !== '';
      case '-z':
        return x === '';
    }
    return game.t('test-operator', { operator: op });
  }
  if (a.length === 3) {
    const [x, op, y] = a;
    const nx = Number(x);
    const ny = Number(y);
    switch (op) {
      case '=':
      case '==':
        return x === y;
      case '!=':
        return x !== y;
      case '-eq':
        return nx === ny;
      case '-ne':
        return nx !== ny;
      case '-lt':
        return nx < ny;
      case '-le':
        return nx <= ny;
      case '-gt':
        return nx > ny;
      case '-ge':
        return nx >= ny;
    }
    return game.t('test-operator', { operator: op });
  }
  return game.t('test-too-arguments');
}

// « [ … ] » est la même commande : script.ts le réécrit en test.
const test = ({ args, game }: { args: string[]; game: Shell }) => {
  const r = evaluate(game, args);
  if (typeof r === 'string') return game.error(`test: ${r}`);
  return r ? '' : game.error('');
};

// date +FORMAT : les directives courantes de strftime.
// `zone` : le fuseau de la machine, s'il n'est pas celui de Paris (voir ../heure.ts).
export function formatValue(ms: number, format: string, language: string, zone?: { abbrev: string; z: string; utc: number }): string {
  const d = new Date(ms);
  const two = (n: number) => String(n).padStart(2, '0');
  const summer = summerTime(ms);
  const name = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(language, { timeZone: 'UTC', ...options }).format(d);
  const directives: Record<string, () => string> = {
    Y: () => String(d.getUTCFullYear()),
    y: () => two(d.getUTCFullYear() % 100),
    m: () => two(d.getUTCMonth() + 1),
    d: () => two(d.getUTCDate()),
    e: () => String(d.getUTCDate()).padStart(2, ' '),
    H: () => two(d.getUTCHours()),
    M: () => two(d.getUTCMinutes()),
    S: () => two(d.getUTCSeconds()),
    F: () => `${d.getUTCFullYear()}-${two(d.getUTCMonth() + 1)}-${two(d.getUTCDate())}`,
    T: () => `${two(d.getUTCHours())}:${two(d.getUTCMinutes())}:${two(d.getUTCSeconds())}`,
    s: () => String(Math.floor((zone ? zone.utc : ms - (summer ? 7200_000 : 3600_000)) / 1000)),
    Z: () => zone?.abbrev ?? (summer ? 'CEST' : 'CET'),
    z: () => zone?.z ?? (summer ? '+0200' : '+0100'),
    a: () => name({ weekday: 'short' }),
    A: () => name({ weekday: 'long' }),
    b: () => name({ month: 'short' }),
    B: () => name({ month: 'long' }),
    '%': () => '%',
  };
  return format.replace(/%(.)/g, (all, c: string) => directives[c]?.() ?? all);
}

/** « 2027-08-30 09:12[:00] » ou « 09:12[:00] » (aujourd'hui) → heure murale (lue comme UTC) ; null si illisible. */
export function readDate(game: Shell, text: string): number | null {
  const m = /^(?:(\d{4})-(\d{2})-(\d{2})\s+)?(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(text.trim());
  if (!m) return null;
  const today = new Date(timeOfDay(game) ? machineTime(game).wall : (systemd(game)?.clock ?? 0));
  const [an, month, day] = m[1]
    ? [Number(m[1]), Number(m[2]) - 1, Number(m[3])]
    : [today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()];
  return Date.UTC(an, month, day, Number(m[4]), Number(m[5]), Number(m[6] ?? 0));
}

export const SCRIPTS: Record<string, Command> = {
  sh: {
    ownOptions: true,
    launch: ({ args, game }) => {
      const [file, ...rest] = args;
      if (!file) return game.error(game.t('sh-interactive'));
      return launchScript(game, file, rest);
    },
  },
  bash: {
    ownOptions: true,
    launch: ({ args, game }) => {
      const [file, ...rest] = args;
      if (!file) return game.error(game.t('sh-interactive'));
      return launchScript(game, file, rest);
    },
  },
  test: { ownOptions: true, launch: test },
  date: {
    ownOptions: true,
    launch: ({ args, game }) => {
      // -s « 2027-08-30 09:12 » (ou --set=…) : régler l'horloge, réservé à root.
      const i = args.findIndex((a) => a === '-s' || a.startsWith('--set='));
      if (i >= 0) {
        const text = args[i] === '-s' ? args[i + 1] : args[i].slice(6);
        if (text === undefined) return game.error(game.t('date-option-argument'));
        const wall = readDate(game, text);
        if (wall === null) return game.error(game.t('date-invalid', { argument: text }));
        if (game.who !== 'root') {
          game.error(game.t('date-setting-refuse'));
        } else if (timeOfDay(game)) setClock(game, wall);
        return formatValue(wall, game.t('date-format'), game.t.language, timeOfDay(game) ? machineTime(game) : undefined);
      }
      const machine = timeOfDay(game) ? machineTime(game) : null;
      const ms = machine?.wall ?? systemd(game)?.clock ?? Date.UTC(2027, 0, 1);
      const format = args.find((a) => a.startsWith('+'));
      const unknown = args.find((a) => !a.startsWith('+'));
      if (unknown) return game.error(game.t('date-invalid', { argument: unknown }));
      // Sans format : comme date en français (LANG=fr_FR.UTF-8).
      return formatValue(ms, format ? format.slice(1) : game.t('date-format'), game.t.language, machine ?? undefined);
    },
  },
  readlink: {
    options: ['f'],
    launch: ({ args, game }) => {
      const canonical = args.includes('-f');
      const [target] = args.filter((a) => !a.startsWith('-'));
      if (!target) return game.error(game.t('readlink-operand'));
      if (canonical) {
        // Le chemin absolu, tous les liens suivis.
        let path = game.resolve(target);
        for (let i = 0; i < 20; i++) {
          const n = game.find(path, false) as { link?: string } | null;
          if (!n?.link) break;
          path = n.link.startsWith('/') ? n.link : game.resolve(`${path.replace(/\/[^/]+$/, '')}/${n.link}`);
        }
        return path;
      }
      const n = game.find(target, false) as { link?: string } | null;
      return n?.link ?? game.error('');
    },
  },
};
