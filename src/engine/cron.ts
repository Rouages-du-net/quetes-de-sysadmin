// cron: a machine's scheduled jobs (crontab(5):
// https://manpages.debian.org/bookworm/cron/crontab.5.en.html).
//   m h dom mon dow command, with *, lists (1,5), ranges (1-5), steps (*/15),
//   and the shortcuts @hourly, @daily, @weekly, @monthly, @yearly, @reboot.
//   If both day of month AND day of week are restricted, either one is
//   enough (like the real cron).
// Crontabs live in state.crontabs (per account). The game cannot wait: a
// story "lets the night pass" and runs the jobs that fall in that slot
// (pass()).

import type { Game } from './shell';

export const TEMPLATE = `# Edit this file to introduce tasks to be run by cron.
#
# Each task to run has to be defined through a single line
# indicating with different fields when the task will be run
# and what command to run for the task
#
# To define the time you can provide concrete values for
# minute (m), hour (h), day of month (dom), month (mon),
# and day of week (dow) or use '*' in these fields (for 'any').
#
# Notice that tasks will be started based on the cron's system
# daemon's notion of time and timezones.
#
# Output of the crontab jobs (including errors) is sent through
# email to the user the crontab file belongs to (unless redirected).
#
# For example, you can run a backup of all your user accounts
# at 5 a.m every week with:
# 0 5 * * 1 tar -zcf /var/backups/home.tgz /home/
#
# For more information see the manual pages of crontab(5) and cron(8)
#
# m h  dom mon dow   command
`;

export interface Task {
  line: string;
  command: string;
  fields: Set<number>[];
  // Day of month / day of week restricted (the "or" rule).
  starDom: boolean;
  starDow: boolean;
}

const BOUNDS: [string, number, number][] = [
  ['minute', 0, 59],
  ['hour', 0, 23],
  ['day-of-month', 1, 31],
  ['month', 1, 12],
  ['day-of-week', 0, 7],
];
const SHORTCUTS: Record<string, string> = {
  '@yearly': '0 0 1 1 *',
  '@annually': '0 0 1 1 *',
  '@monthly': '0 0 1 * *',
  '@weekly': '0 0 * * 0',
  '@daily': '0 0 * * *',
  '@midnight': '0 0 * * *',
  '@hourly': '0 * * * *',
};

function field(text: string, min: number, max: number): Set<number> | null {
  const values = new Set<number>();
  for (const part of text.split(',')) {
    const m = /^(\*|(\d+)(?:-(\d+))?)(?:\/(\d+))?$/.exec(part);
    if (!m) return null;
    const start = m[1] === '*' ? min : Number(m[2]);
    const end = m[1] === '*' ? max : m[3] !== undefined ? Number(m[3]) : m[4] ? max : start;
    const not = m[4] ? Number(m[4]) : 1;
    if (start < min || end > max || start > end || not < 1) return null;
    for (let v = start; v <= end; v += not) values.add(v);
  }
  // 7 = Sunday, like 0.
  if (max === 7 && values.has(7)) values.add(0);
  return values;
}

/** Reads a crontab; errors in crontab -e's format (file:line: bad field). */
export function parse(text: string, file: string): { tasks: Task[]; errors: string[]; toBoot: string[] } {
  const tasks: Task[] = [];
  const toBoot: string[] = [];
  const errors: string[] = [];
  text.split('\n').forEach((rawValue, i) => {
    const line = rawValue.trim();
    if (!line || line.startsWith('#') || /^[A-Za-z_]+\s*=/.test(line)) return;
    const words = line.split(/\s+/);
    if (words[0] === '@reboot') {
      if (words.length < 2) errors.push(`"${file}":${i + 1}: bad command`);
      else toBoot.push(words.slice(1).join(' '));
      return;
    }
    const [schedule, rest] = SHORTCUTS[words[0]] ? [SHORTCUTS[words[0]].split(' '), words.slice(1)] : [words.slice(0, 5), words.slice(5)];
    const fields: Set<number>[] = [];
    for (let k = 0; k < 5; k++) {
      const c = schedule[k] === undefined ? null : field(schedule[k], BOUNDS[k][1], BOUNDS[k][2]);
      if (!c) return void errors.push(`"${file}":${i + 1}: bad ${BOUNDS[k][0]}`);
      fields.push(c);
    }
    if (!rest.length) return void errors.push(`"${file}":${i + 1}: bad command`);
    tasks.push({ line, command: rest.join(' '), fields, starDom: schedule[2] === '*', starDow: schedule[4] === '*' });
  });
  if (errors.length) errors.push("errors in crontab file, can't install.");
  return { tasks, errors, toBoot };
}

/** Does the job run at this minute (date read as local time, in UTC)? */
export function aRunning(t: Task, ms: number): boolean {
  const d = new Date(ms);
  const [mi, h, dom, my, dow] = t.fields;
  if (!mi.has(d.getUTCMinutes()) || !h.has(d.getUTCHours()) || !my.has(d.getUTCMonth() + 1)) return false;
  const monthDay = dom.has(d.getUTCDate());
  const weekDay = dow.has(d.getUTCDay());
  if (t.starDom || t.starDow) return (t.starDom || monthDay) && (t.starDow || weekDay);
  return monthDay || weekDay;
}

export interface Execution {
  command: string;
  output: string;
}

/**
 * Lets a time slot pass (from `start` to `end`): each job of each crontab
 * that falls in it is run once, under its account, from its home folder.
 * Returns what ran, with what cron would have sent by mail.
 */
export function pass(game: Game & { runTask(line: string): string; who: string }, start: number, end: number): Execution[] {
  const crontabs: Record<string, string> = game.state.crontabs ?? {};
  // The slot's jobs, in order of their time (like the real cron).
  const planned: { account: string; command: string; ms: number }[] = [];
  for (const [account, text] of Object.entries(crontabs))
    for (const t of parse(text, '').tasks)
      for (let ms = start; ms < end; ms += 60_000)
        if (aRunning(t, ms)) {
          planned.push({ account, command: t.command, ms });
          break;
        }
  planned.sort((a, b) => a.ms - b.ms);
  const executions: Execution[] = [];
  for (const p of planned) {
    const before = game.who;
    game.who = p.account;
    try {
      executions.push({ command: p.command, output: game.runTask(p.command) });
    } finally {
      game.who = before;
    }
  }
  return executions;
}
