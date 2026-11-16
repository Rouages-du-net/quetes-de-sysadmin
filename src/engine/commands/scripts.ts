// The scripts' commands: sh (and bash) to run a script, test (or [ … ] in a
// script) to check a condition, date and readlink. The scripts themselves
// are interpreted by script.ts.
// Based on dash (https://manpages.debian.org/dash), and coreutils' test and
// date (https://www.gnu.org/software/coreutils/manual/).

import type { Shell } from '../shell';
import { runScript } from '../script';
import { summerTime, systemd } from '../systemd';
import { timeOfDay, machineTime, setClock } from '../time';
import { content } from '../tools';
import { isBsd } from '../freebsd';

const BSD_DATE_USAGE = `usage: date [-jnRu] [-I[date|hours|minutes|seconds|ns]] [-f input_fmt]
            [ -z output_zone ] [-r filename|seconds] [-v[+|-]val[y|m|w|d|H|M|S]]
            [[[[[[cc]yy]mm]dd]HH]MM[.SS] | new_date] [+output_fmt]`;

const UNITS: Record<string, number> = { S: 1000, M: 60_000, H: 3_600_000, d: 86_400_000, w: 7 * 86_400_000 };

/** BSD date -v: "-1d", "+2H", "-1m" (a month), "1d" (sets the day of the month to 1). */
function adjustBsd(ms: number, value: string): number | null {
  const m = /^([+-]?)(\d+)([ymwdHMS])$/.exec(value);
  if (!m) return null;
  const [, sign, n, unit] = m;
  const d = new Date(ms);
  const k = Number(n);
  if (!sign) {
    if (unit === 'y') d.setUTCFullYear(k < 100 ? 2000 + k : k);
    else if (unit === 'm') d.setUTCMonth(k - 1);
    else if (unit === 'd') d.setUTCDate(k);
    else if (unit === 'H') d.setUTCHours(k);
    else if (unit === 'M') d.setUTCMinutes(k);
    else if (unit === 'S') d.setUTCSeconds(k);
    else return null;
    return d.getTime();
  }
  const s = sign === '-' ? -k : k;
  if (unit === 'y') d.setUTCFullYear(d.getUTCFullYear() + s);
  else if (unit === 'm') d.setUTCMonth(d.getUTCMonth() + s);
  else return ms + s * UNITS[unit];
  return d.getTime();
}

const GNU_UNITS: Record<string, string> = { second: 'S', sec: 'S', minute: 'M', min: 'M', hour: 'H', day: 'd', week: 'w', fortnight: 'f', month: 'm', year: 'y' };

/** GNU date -d: "yesterday", "tomorrow", "now", "3 days ago", "-1 day", "+2 weeks", "2028-09-01", "@1700000000". */
function relativeGnu(ms: number, text: string): number | null {
  const t = text.trim().toLowerCase();
  if (t === '' || t === 'now' || t === 'today') return ms;
  if (t === 'yesterday') return ms - 86_400_000;
  if (t === 'tomorrow') return ms + 86_400_000;
  const epoch = /^@(-?\d+)$/.exec(t);
  if (epoch) return Number(epoch[1]) * 1000;
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[ t](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(t);
  if (iso) return Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), Number(iso[4] ?? 0), Number(iso[5] ?? 0), Number(iso[6] ?? 0));
  const rel = /^([+-]?\d+)?\s*(second|sec|minute|min|hour|day|week|fortnight|month|year)s?(\s+ago)?$/.exec(t);
  if (!rel) return null;
  let n = Number(rel[1] ?? 1);
  if (rel[3]) n = -n;
  const unit = GNU_UNITS[rel[2]];
  if (unit === 'f') return ms + n * 14 * 86_400_000;
  return adjustBsd(ms, `${n < 0 ? '-' : '+'}${Math.abs(n)}${unit}`);
}
import type { Command } from './index';

/** Runs a file as a /bin/sh script; returns its output (failure if its code is not 0). */
export function launchScript(game: Shell, file: string, args: string[], name = file): string {
  const n = game.find(file);
  if (n?.type !== 'file') return game.error(game.t('sh-missing', { file: file }));
  const r = runScript(game, content(n, game), { cwd: game.cwd, name, arguments: args });
  if (r.code !== 0) game.error('');
  return r.output;
}

// test EXPRESSION: succeeds (nothing) or fails (code 1, without a message).
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

// "[ … ]" is the same command: script.ts rewrites it as test.
const test = ({ args, game }: { args: string[]; game: Shell }) => {
  const r = evaluate(game, args);
  if (typeof r === 'string') return game.error(`test: ${r}`);
  return r ? '' : game.error('');
};

// date +FORMAT: the common strftime directives.
// `zone`: the machine's time zone, if it is not Paris's (see ../time.ts).
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

/** "2027-08-30 09:12[:00]" or "09:12[:00]" (today) → wall-clock time (read as UTC); null if unreadable. */
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
      // -s "2027-08-30 09:12" (or --set=…): set the clock, reserved to root (GNU).
      const i = args.findIndex((a) => a === '-s' || a.startsWith('--set='));
      if (i >= 0 && !isBsd(game)) {
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
      let ms = machine?.wall ?? systemd(game)?.clock ?? Date.UTC(2027, 0, 1);
      const words: string[] = [];
      for (let k = 0; k < args.length; k++) {
        const a = args[k];
        if (isBsd(game)) {
          // BSD: -v[+|-]N[ymwdHMS] adjusts (or, without a sign, sets) a field; -j, -u change nothing here.
          if (a.startsWith('-v')) {
            const value = a.length > 2 ? a.slice(2) : args[++k];
            const next = adjustBsd(ms, value ?? '');
            if (next === null) return game.error(`date: ${value ?? ''}: illegal time adjustment`, 1);
            ms = next;
          } else if (a === '-j' || a === '-u' || a === '-n') continue;
          else if (a.startsWith('-') && a.length > 1) return game.error(`date: illegal option -- ${a.charAt(1)}\n${BSD_DATE_USAGE}`, 1);
          else words.push(a);
        } else {
          // GNU: -d STRING (or --date=STRING): another date than now.
          if (a === '-d' || a === '--date' || a.startsWith('--date=') || (a.startsWith('-d') && a.length > 2)) {
            const text = a === '-d' || a === '--date' ? args[++k] : a.startsWith('--date=') ? a.slice(7) : a.slice(2);
            if (text === undefined) return game.error(`date: option requires an argument -- 'd'\nTry 'date --help' for more information.`, 1);
            const when = relativeGnu(ms, text);
            if (when === null) return game.error(`date: invalid date '${text}'`, 1);
            ms = when;
          } else if (a === '-u' || a === '--utc') continue;
          else if (a.startsWith('-') && a.length > 1) return game.error(`date: invalid option -- '${a.charAt(1)}'\nTry 'date --help' for more information.`, 1);
          else words.push(a);
        }
      }
      const format = words.find((a) => a.startsWith('+'));
      const unknown = words.find((a) => !a.startsWith('+'));
      if (unknown) return game.error(game.t('date-invalid', { argument: unknown }));
      // Without a format: like date in the game's language (LANG).
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
        // The absolute path, all links followed.
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
