// Story "The Shelter", chapter "Switch and Learn": haven runs the site
// again, but the world still asks for Hillside's drowned address. You open
// haven's firewall to the web (Wiremu enabled ufw with ssh only), check it
// from outside through Riverbend's public address, then point www at it in
// the zone meadow serves as hidden primary (the serial goes up, rndc
// reload; the TTL was lowered to 300 s in advance by the plan), and watch
// the resolver let go of the old answer. Then the plan's last two lines:
// the post-incident review (blameless: timeline, impact, what went well,
// what to improve, actions with owners), and the next restore drill, a job
// that really restores and checks, scheduled with cron or a timer.
// Objective checked on the state: the registrar's server answers the new
// address for www; visitors reach haven's site (firewall, nginx, the app);
// a request from meadow reached haven; the review has its sections filled,
// the outage's start from the monitoring log, actions with owners, and no
// blame; a cron job or an active timer whose run restores a snapshot
// beside and verifies it.
// False leads: switching the record while haven's port 80 is closed, an
// unchanged serial (the secondary keeps the old zone), a drill that only
// lists the snapshots, a drill that restores over /.
// Sources: https://bind9.readthedocs.io/en/stable/chapter3.html (zone files, SOA serial),
// https://www.rfc-editor.org/rfc/rfc1034#section-4.3.5 (TTL and caching),
// https://manpages.ubuntu.com/manpages/noble/man8/ufw.8.html,
// https://restic.readthedocs.io/en/stable/050_restore.html,
// https://sre.google/sre-book/postmortem-culture/ (blameless reviews),
// NIST SP 800-34 Rev. 1, 3.5 and 3.6 (testing, training and exercises; plan maintenance).

import { f, name, type Chapter } from '../world';
import type { Game, Shell } from '../shell';
import { parse } from '../cron';
import type { DnsState } from '../dns';
import type { Firewall } from '../firewall';
import { verdict } from '../firewall';
import { cloneTree, DOMAIN, FIRST_DOWN, HAVEN, HOME, NEW_PUBLIC, PASSWORD, havenHost, inner, initialiseDns, meadowAccounts, meadowState, meadowWorld, passTime, sd, seen, storyCurl, visitorsReach, initialiseMeadow
} from './shelter';
import { MEADOW_COMMANDS } from './what-we-have';

/** The review, in the player's home (review.md, by its name in the language). */
export const review = (j: Game) => `${(j as Shell).home}/${name(j.t, 'review.md')}`;
const SECTIONS = ['summary', 'timeline', 'impact', 'went-well', 'improve', 'actions'] as const;
type Section = (typeof SECTIONS)[number];

const dnsOf = (j: Game) => (j as Shell).principal.state.dns as DnsState;
const secondaryA = (j: Game) => dnsOf(j).secondary[DOMAIN]?.rrs.find((r) => r.name === `www.${DOMAIN}.` && r.type === 'A')?.data;
const primaryA = (j: Game) => dnsOf(j).primary[DOMAIN]?.rrs.find((r) => r.name === `www.${DOMAIN}.` && r.type === 'A')?.data;
const hv = (j: Game) => inner(j, 'haven') ?? (j as Shell).principal.internal('haven');
const webOpen = (j: Game) => {
  const h = hv(j);
  return !!h && (!h.state.ufw || verdict(h.state.ufw as Firewall, 80, '203.0.113.9') === 'accepted');
};
const curls = (j: Game) => (((j as Shell).principal.state.shelterCurls ?? []) as { from: string; address: string; code: number }[]);
/** A request from meadow (outside both sites) reached haven's site and got its page. */
const checkedOutside = (j: Game) => curls(j).some((c) => c.from === (j as Shell).principal.host && (c.address === NEW_PUBLIC || c.address === HAVEN) && c.code === 200);

// ——— The review: its sections (## headings, in the language), filled ———

function sections(j: Game): Partial<Record<Section, string>> {
  const titles = Object.fromEntries(SECTIONS.map((s) => [j.t(`switch-and-learn-section-${s}`).toLowerCase(), s]));
  const out: Partial<Record<Section, string>> = {};
  let current: Section | '' = '';
  for (const line of (j.read(review(j)) ?? '').split('\n')) {
    const h = /^##\s+(.*)$/.exec(line);
    if (h) {
      current = titles[h[1].trim().toLowerCase()] ?? '';
      continue;
    }
    if (current) out[current] = `${out[current] ?? ''}${line}\n`;
  }
  return out;
}
const placeholder = (j: Game) => j.t('switch-and-learn-placeholder');
const filled = (text: string | undefined, j: Game) => !!text && text.replace(/<!--[\s\S]*?-->/g, '').trim().length >= 12 && !text.includes(placeholder(j));
const times = (text: string) => [...text.matchAll(/\b([01]?\d|2[0-3])[:h]([0-5]\d)\b/g)].map((m) => `${m[1].padStart(2, '0')}:${m[2]}`);
const downAt = new Date(FIRST_DOWN).toISOString().slice(11, 16);
const blameWords = (j: Game) => new RegExp(j.t('switch-and-learn-blame-words'), 'i');
const owners = (j: Game) => new RegExp(j.t('switch-and-learn-owners'), 'i');
const actionLines = (j: Game) =>
  (sections(j).actions ?? '')
    .split('\n')
    .filter((l) => /^\s*([-*]|\d+[.)])\s+\S/.test(l) && !l.includes(placeholder(j)));

const reviewState = (j: Game) => {
  const s = sections(j);
  const all = SECTIONS.every((x) => filled(s[x], j));
  const timeline = times(s.timeline ?? '');
  return {
    exists: !!j.find(review(j)),
    all,
    timeline: timeline.includes(downAt) && new Set(timeline).size >= 3,
    actions: actionLines(j).length >= 2 && actionLines(j).every((l) => owners(j).test(l)),
    blame: blameWords(j).test((j.read(review(j)) ?? '').replace(/<!--[\s\S]*?-->/g, '')),
  };
};
const reviewOk = (j: Game) => {
  const r = reviewState(j);
  return r.all && r.timeline && r.actions && !r.blame;
};

// ——— The drill: the jobs that will run on meadow, run once as they will run ———

interface Job {
  account: string;
  command: string;
}

function jobs(j: Game): Job[] {
  const out: Job[] = [];
  for (const [account, text] of Object.entries((j.state.crontabs ?? {}) as Record<string, string>)) for (const x of parse(text, '').tasks) out.push({ account, command: x.command });
  // /etc/cron.d: a line names its account.
  const dir = j.find('/etc/cron.d');
  if (dir?.type === 'directory')
    for (const n of Object.keys(dir.children))
      for (const l of (j.read(`/etc/cron.d/${n}`) ?? '').split('\n')) {
        const m = /^\s*((?:\S+\s+){5})(\S+)\s+(.+)$/.exec(l);
        if (m && !l.trim().startsWith('#') && !/^\s*\w+=/.test(l)) out.push({ account: m[2], command: m[3] });
      }
  const s = sd(j);
  for (const m of Object.values(s.timers ?? {})) {
    if (m.state !== 'active') continue;
    const unit = s.services[m.unit]?.file ? (j.read(s.services[m.unit].file!) ?? '') : '';
    const exec = /^ExecStart=[-@+!:]*(.+)$/m.exec(unit)?.[1];
    const user = /^User=(\S+)/m.exec(unit)?.[1] ?? 'root';
    if (exec) out.push({ account: user, command: exec.trim() });
  }
  return out;
}

export type Drill = 'none' | 'list-only' | 'over-root' | 'unchecked' | 'failed' | 'ok';

/** Runs the jobs once, as cron or the timer would, on a copy of the machine's state, and reads what they did. */
export function drill(j: Game): Drill {
  const list = jobs(j);
  if (!list.length) return 'none';
  const shell = j as Shell;
  const referenced = list.flatMap((x) => x.command.match(/\/[\w./-]+/g) ?? []).map((p) => `${p}=${shell.read(p) ?? ''}`);
  const key = JSON.stringify([list, referenced]);
  const cache = j.state.drillVerdict as { key: string; result: Drill } | undefined;
  if (cache?.key === key) return cache.result;
  const keep = {
    done: j.state.resticDone,
    restoredTo: j.state.resticRestoredTo,
    sums: j.state.sha256Checked,
    clock: sd(j).clock,
    log: sd(j).log.length,
    resticClock: j.state.resticClock,
    world: cloneTree((shell.find('/') as { children: unknown }).children),
  };
  j.state.resticDone = [];
  j.state.resticRestoredTo = undefined;
  j.state.sha256Checked = [];
  for (const job of list) {
    const who = shell.who;
    shell.who = job.account;
    try {
      shell.runTask(job.command);
    } finally {
      shell.who = who;
    }
  }
  const done = (j.state.resticDone as string[] | undefined) ?? [];
  const to = j.state.resticRestoredTo as string | undefined;
  const sums = (j.state.sha256Checked as { ok: number; failed: number }[] | undefined) ?? [];
  const checked = sums.some((x) => x.ok >= 1 && x.failed === 0) || done.includes('check');
  const result: Drill = !done.length ? 'failed' : !done.includes('restore') ? 'list-only' : to === '' ? 'over-root' : !checked ? 'unchecked' : 'ok';
  // The run changed nothing for the player: the world, the clock and what restic remembers come back.
  const root = shell.find('/');
  if (root?.type === 'directory') root.children = keep.world as typeof root.children;
  j.state.resticDone = keep.done;
  j.state.resticRestoredTo = keep.restoredTo;
  j.state.sha256Checked = keep.sums;
  j.state.resticClock = keep.resticClock;
  sd(j).clock = keep.clock;
  sd(j).log.length = keep.log;
  j.state.drillVerdict = { key, result };
  return result;
}

export const switchAndLearn: Chapter = {
  id: 'switch-and-learn',
  number: 3,
  commands: [...MEADOW_COMMANDS, 'dig', 'host', 'named-checkzone', 'rndc', 'systemctl', 'journalctl', 'crontab', 'curl', 'sha256sum', 'sh'],
  home: HOME,
  welcome: 'message_from_teuila.txt',
  names: true,
  final: 'end',
  steps: ['outside-closed', 'opened', 'outside', 'zone', 'switched', 'resolver', 'review', 'drill', 'end'],
  password: PASSWORD,
  accounts: meadowAccounts,
  state: (t) => ({ ...meadowState(t, 3), storyCurl }),
  hosts: { haven: havenHost(3) },
  initialise: (j) => {
    initialiseMeadow(j);
    initialiseDns(j);
    (j as Shell).principal.internal('haven');
  },
  createWorld: (t) =>
    meadowWorld(t, 3, {
      'message_from_teuila.txt': f(t('switch-and-learn-message-teuila')),
      'review.md': f(t('switch-and-learn-review-template'), { lines: true }),
    }),
  afterCommand: (j) => passTime(j),
  events: [
    { id: 'outside-closed', condition: (j) => curls(j).some((c) => (c.address === NEW_PUBLIC || c.address === HAVEN) && c.code === 0), message: (j) => j.t('switch-and-learn-event-outside-closed') },
    { id: 'opened', condition: webOpen, message: (j) => j.t('switch-and-learn-event-opened') },
    { id: 'outside', condition: checkedOutside, message: (j) => j.t('switch-and-learn-event-outside') },
    { id: 'dark-switch', condition: (j) => secondaryA(j) === NEW_PUBLIC && visitorsReach(j) !== 'ok', message: (j) => j.t('switch-and-learn-event-dark-switch') },
    { id: 'serial', condition: (j) => primaryA(j) === NEW_PUBLIC && secondaryA(j) !== NEW_PUBLIC, message: (j) => j.t('switch-and-learn-event-serial') },
    { id: 'zone', condition: (j) => primaryA(j) === NEW_PUBLIC, message: (j) => j.t('switch-and-learn-event-zone') },
    { id: 'switched', condition: (j) => secondaryA(j) === NEW_PUBLIC && visitorsReach(j) === 'ok', message: (j) => j.t('switch-and-learn-event-switched') },
    {
      id: 'cache',
      condition: (j) => secondaryA(j) === NEW_PUBLIC && seen(j, /198\.51\.100\.163/) && /\b(dig|host|curl)\b/.test(j.last.line ?? ''),
      message: (j) => j.t('switch-and-learn-event-cache'),
    },
    {
      id: 'resolver',
      condition: (j) => secondaryA(j) === NEW_PUBLIC && seen(j, NEW_PUBLIC) && /\b(dig|host)\b/.test(j.last.line ?? '') && !/@/.test(j.last.line ?? ''),
      message: (j) => j.t('switch-and-learn-event-resolver'),
    },
    { id: 'blame', condition: (j) => reviewState(j).blame, message: (j) => j.t('switch-and-learn-event-blame') },
    { id: 'no-owners', condition: (j) => filled(sections(j).actions, j) && !reviewState(j).actions, message: (j) => j.t('switch-and-learn-event-no-owners') },
    { id: 'no-timeline', condition: (j) => filled(sections(j).timeline, j) && !reviewState(j).timeline, message: (j) => j.t('switch-and-learn-event-no-timeline', { time: downAt }) },
    { id: 'review', condition: reviewOk, message: (j) => j.t('switch-and-learn-event-review') },
    { id: 'drill-list-only', condition: (j) => drill(j) === 'list-only', message: (j) => j.t('switch-and-learn-event-drill-list-only') },
    { id: 'drill-over-root', condition: (j) => drill(j) === 'over-root', message: (j) => j.t('switch-and-learn-event-drill-over-root') },
    { id: 'drill-unchecked', condition: (j) => drill(j) === 'unchecked', message: (j) => j.t('switch-and-learn-event-drill-unchecked') },
    { id: 'drill-failed', condition: (j) => drill(j) === 'failed', message: (j) => j.t('switch-and-learn-event-drill-failed') },
    { id: 'drill', condition: (j) => drill(j) === 'ok', message: (j) => j.t('switch-and-learn-event-drill') },
    {
      id: 'end',
      condition: (j) => secondaryA(j) === NEW_PUBLIC && visitorsReach(j) === 'ok' && checkedOutside(j) && reviewOk(j) && drill(j) === 'ok',
      message: (j) => j.t('switch-and-learn-event-end'),
    },
  ],
};
