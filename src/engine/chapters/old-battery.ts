// Story "The Climbing Wall", chapter "Old Battery": two months after the
// cut, the UPS's battery.runtime has fallen to ten minutes, and Thandiwe's
// mailbox fills with "UPS: ONBATT" and "UPS: ONLINE": the hall's line
// flickers for a few seconds whenever the bouldering room's fans start,
// and upsmon's NOTIFYCMD mails every event.
// The work: a quick battery test (upscmd test.battery.start.quick: the
// admin account first needs instcmds in upsd.users, reloaded), its result
// (ups.test.result "Done and warning", RB); Ikaika swaps the cartridge; the
// new battery's date written into the UPS (upsrw battery.mfr.date, apc-hid's
// writable date) and a new quick test that passes; and the alerts through
// upssched: NOTIFYCMD upssched, an ONBATT timer cancelled by ONLINE, so a
// blip says nothing and a real outage mails once.
// Objective checked on the state: a quick test passed after the swap,
// battery.mfr.date set to the new battery's (December 2032 to today),
// upssched wired (NOTIFYCMD, PIPEFN, LOCKFN) and a trial run on the
// running configuration: an 8-second blip mails nothing, a 5-minute outage
// mails at least once; no deep test running.
// False leads: a deep test (test.battery.start.deep) with the hall open (on
// a worn battery, the UPS calibrates by draining it), alerts silenced
// altogether (NOTIFYFLAG … IGNORE, or no EXEC), an EXECUTE on every ONLINE
// (each blip mails again), upssched without PIPEFN and LOCKFN.
// Sources: https://networkupstools.org/docs/man/upscmd.html,
// https://networkupstools.org/docs/man/upsrw.html,
// https://networkupstools.org/docs/man/upssched.html,
// https://networkupstools.org/docs/man/upssched.conf.html,
// https://networkupstools.org/docs/user-manual.chunked/Advanced_usage_scheduling_notes.html,
// https://networkupstools.org/docs/man/upsd.users.html (instcmds).

import type { Chapter } from '../world';
import { f } from '../world';
import type { Game, Shell } from '../shell';
import { HOME, PASSWORD, alertTrial, belayAccounts, belayMon, belayState, belayWorld, harnessHost, initialiseStory, mailCount, passTime, power, schedWired, seen, story, typed, ups } from './climbing-wall';

const swapped = (j: Game) => story(j).swappedAt;
const passedAfter = (j: Game) => {
  const at = swapped(j);
  return at !== undefined && ups(j).tests.some((t) => t.kind === 'quick' && t.started >= at && t.result === 'Done and passed');
};
const dateOk = (j: Game) => {
  const d = ups(j).mfrDate;
  return swapped(j) !== undefined && d >= '2032/12/01' && d <= '2033/01/17';
};
const deepRunning = (j: Game) => ups(j).test?.kind === 'deep';
// The trial runs once per command (the events ask several times).
const memo = new WeakMap<object, { key: string; result: ReturnType<typeof alertTrial> }>();
const tried = (j: Game) => {
  const st = story(j);
  const p = (j as Shell).principal;
  const key = [st.ticks, JSON.stringify(belayMon(j)), p.read('/etc/nut/upssched.conf'), p.read('/usr/local/bin/ups-alert'), p.read('/usr/local/bin/ups-mail')].join('\u0000');
  const m = memo.get(st);
  if (m && m.key === key) return m.result;
  const result = alertTrial(j);
  memo.set(st, { key, result });
  return result;
};
const trial = (j: Game) => (schedWired(j) ? tried(j) : null);
const alertsOk = (j: Game) => {
  const r = trial(j);
  return !!r && r.blip === 0 && r.outage >= 1;
};
const brokenSched = (j: Game) => /(^|\/)upssched$/.test(belayMon(j)?.notifycmd ?? '') && !schedWired(j);
const silenced = (j: Game) => {
  if (brokenSched(j)) return false;
  const r = tried(j);
  return !!r && r.outage === 0;
};

export const oldBattery: Chapter = {
  id: 'old-battery',
  number: 3,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'wc', 'nano', 'sudo', 'systemctl', 'journalctl', 'ssh', 'upsc', 'upscmd', 'upsrw', 'upsmon', 'upsd', 'upssched', 'mail', 'logger', 'echo', 'date', 'exit'],
  home: HOME,
  welcome: 'message_from_thandiwe.txt',
  names: true,
  final: 'end',
  steps: ['runtime', 'denied', 'warning', 'date', 'passed', 'alerts', 'end'],
  password: PASSWORD,
  accounts: belayAccounts,
  hosts: { harness: harnessHost(3) },
  state: (t) => belayState(t, 3),
  initialise: (j) => initialiseStory(j, 3),
  createWorld: (t) =>
    belayWorld(t, 3, {
      'message_from_thandiwe.txt': f(t('old-battery-message-thandiwe')),
    }),
  afterCommand: (j) => passTime(j),
  events: [
    { id: 'runtime', condition: (j) => seen(j, /battery\.runtime: \d+/) || (/battery\.runtime\b/.test(typed(j)) && seen(j, /^\d+$/m)), message: (j) => j.t('old-battery-event-runtime') },
    { id: 'flapping', condition: (j) => mailCount(j) > story(j).mailsAtStart && !schedWired(j), message: (j) => j.t('old-battery-event-flapping') },
    { id: 'denied', condition: (j) => seen(j, 'Instant command failed: Access denied'), message: (j) => j.t('old-battery-event-denied') },
    { id: 'deep', condition: deepRunning, message: (j) => j.t('old-battery-event-deep') },
    {
      id: 'warning',
      condition: (j) => ups(j).tests.some((t) => t.kind === 'quick' && t.result === 'Done and warning') && seen(j, 'Done and warning'),
      action: (j) => {
        // Ikaika has a replacement cartridge (APC RBC): hot-swappable on this model.
        const u = ups(j);
        u.health = 1;
        u.charge = 92;
        story(j).swappedAt = power(j).clock;
      },
      message: (j) => j.t('old-battery-event-warning'),
    },
    { id: 'date', condition: dateOk, message: (j) => j.t('old-battery-event-date') },
    { id: 'passed', condition: passedAfter, message: (j) => j.t('old-battery-event-passed') },
    { id: 'sched-error', condition: brokenSched, message: (j) => j.t('old-battery-event-sched-error') },
    { id: 'silenced', condition: silenced, message: (j) => j.t('old-battery-event-silenced') },
    { id: 'still-flapping', condition: (j) => schedWired(j) && (trial(j)?.blip ?? 0) > 0, message: (j) => j.t('old-battery-event-still-flapping') },
    { id: 'alerts', condition: alertsOk, message: (j) => j.t('old-battery-event-alerts') },
    {
      id: 'end',
      condition: (j) => passedAfter(j) && dateOk(j) && alertsOk(j) && !deepRunning(j),
      message: (j) => j.t('old-battery-event-end'),
    },
  ],
};
