// Story "The Huts", chapter 2 — "The Full Journal": a month later, the
// valley's disk is at 93 %. Not the huts' files: systemd's journal, in
// /var/log/journal, has grown to 6 GiB since a debug option was left on in
// hut-collector (the program that gathers the huts' measurements). journald
// keeps by default up to 10 % of the file system… which, on this disk, is
// still too much with the rest.
// Commands: df -h, du -sh /var/log/*, journalctl --disk-usage,
// journalctl --vacuum-size / --vacuum-time, /etc/systemd/journald.conf (or
// a drop-in in journald.conf.d): SystemMaxUse=, systemctl restart
// systemd-journald.
// Objective checked on the state: the journal under 1 GiB and kept there by
// SystemMaxUse= (1 GiB at most) in force, the disk back under 80 %. Traps:
// rm in /var/log/journal (journald still writes into the deleted active
// file), a vacuum without a limit (it grows back), the limit written
// without restarting journald.
// Sources: https://www.freedesktop.org/software/systemd/man/latest/journald.conf.html#SystemMaxUse=,
// https://www.freedesktop.org/software/systemd/man/latest/journalctl.html#--disk-usage

import type { Chapter, Directory } from '../world';
import { d, f } from '../world';
import type { Game, Shell } from '../shell';
import { grow, journalFiles, startJournald, usage } from '../journal-files';
import { HOME, PASSWORD, accounts, hutsState, hutsWorld, passTime, prepareRsyslog, proc, REMOTE_CONF, remoteHistory, RSYSLOG_CONF_UDP, running, sd, seen } from './huts';
import { newFirewall } from '../firewall';

const BOOT = Date.UTC(2028, 4, 1, 6, 0, 0);
const NOW = Date.UTC(2028, 5, 3, 9, 20, 0);
const G = 1024 ** 3;
const M = 1024 ** 2;
export const MACHINE_ID = '6d1f3c2a9b8e47f0a1c2d3e4f5a6b7c8';
const DISK = 20 * G;
// What hut-collector writes to the journal each minute, in debug.
const NOISE = 22 * M;

const disk = (j: Game) => (j as Shell).size(j.find("/")!) / DISK;
const limit = (j: Game) => j.state.journalLimit as number | null | undefined;
const limited = (j: Game) => limit(j) !== null && limit(j) !== undefined && limit(j)! <= G;

/** Thirty archived files, one a day, and the active one. */
function journalDir(): Directory {
  const files: Record<string, ReturnType<typeof f>> = {};
  for (let i = 0; i < 30; i++) {
    const t = BigInt(Date.UTC(2028, 4, 3 + i, 4, 0, 0)) * 1000n;
    files[`system@${MACHINE_ID}-${(0xa3f1c2n + BigInt(i)).toString(16).padStart(16, '0')}-${t.toString(16).padStart(16, '0')}.journal`] = f('', { owner: 'root', group: 'systemd-journal', mode: 'rw-r-----', size: 200 * M + i * M });
  }
  files['system.journal'] = f('', { owner: 'root', group: 'systemd-journal', mode: 'rw-r-----', size: 96 * M });
  files['user-1000.journal'] = f('', { owner: 'root', group: 'systemd-journal', mode: 'rw-r-----', size: 8 * M });
  return d({ [MACHINE_ID]: d(files, undefined, { owner: 'root', group: 'systemd-journal', mode: 'rwxr-sr-x' }) }, undefined, { owner: 'root', group: 'systemd-journal', mode: 'rwxr-sr-x' });
}

export const journalFull: Chapter = {
  id: 'journal-full',
  number: 2,
  commands: [
    'ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'nano', 'sudo', 'id', 'whoami', 'rm', 'mkdir',
    'df', 'du', 'systemctl', 'journalctl', 'ss', 'ufw', 'rsyslogd', 'logger',
  ],
  home: HOME,
  welcome: 'message_from_lou.txt',
  names: true,
  final: 'end',
  steps: ['disk', 'journal', 'end'],
  password: PASSWORD,
  accounts,
  state: (t) => ({
    ...hutsState(t, {
      boot: BOOT,
      now: NOW,
      firewall: { ...newFirewall(), enabled: true, rules: [{ action: 'allow', to: '22/tcp', ports: [22], forEachOf: null }, { action: 'allow', to: '514/udp', ports: [514], forEachOf: '198.51.100.0/24' }] },
      more: { 'hut-collector': { description: 'Hut measurements collector', active: true, executable: 'python3', process: [proc(980, 'root', '/usr/bin/python3 /opt/hut-collector/collect.py --debug')] } },
    }),
    mounts: [{ path: '/', capacity: DISK, name: '/dev/vda1', system: 'ext4' }],
  }),
  initialise: (j) => {
    prepareRsyslog(j);
    sd(j).services['systemd-journald'].load = startJournald;
    j.state.journalLimit = null;
  },
  afterCommand: (j) => {
    passTime(j);
    if (running(j, 'hut-collector')) grow(j, NOISE);
  },
  createWorld: (t) =>
    withJournal(hutsWorld(t, {
      welcome: { 'message_from_lou.txt': t('journal-full-message-lou') },
      conf: RSYSLOG_CONF_UDP,
      dropIns: { '10-remote.conf': REMOTE_CONF },
      remote: remoteHistory(t, NOW),
      var: {
        lib: d({ 'hut-data': d({ 'measurements-2027.tar': f('', { owner: 'root', size: 12.4 * G }) }, undefined, { owner: 'root' }) }, undefined, { owner: 'root' }),
      },
    })),
  events: [
    {
      id: 'disk',
      condition: (j) => seen(j, '/dev/vda1') && disk(j) > 0.8,
      message: (j) => j.t('journal-full-event-disk'),
    },
    {
      id: 'journal',
      condition: (j) => seen(j, 'Archived and active journals take up') || seen(j, '/var/log/journal'),
      message: (j) => j.t('journal-full-event-journal'),
    },
    {
      id: 'rm',
      condition: (j) => !journalFiles(j).some((x) => x.name === 'system.journal'),
      message: (j) => j.t('journal-full-event-rm'),
    },
    {
      id: 'vacuum-only',
      condition: (j) => usage(j) < 2 * G && !limited(j) && /vacuum/.test(j.last.line),
      message: (j) => j.t('journal-full-event-vacuum-only'),
    },
    {
      id: 'restart-needed',
      condition: (j) => /SystemMaxUse\s*=\s*\d/m.test(`${j.read('/etc/systemd/journald.conf') ?? ''}\n${Object.keys((j.find('/etc/systemd/journald.conf.d') as Directory | null)?.children ?? {}).map((n) => j.read(`/etc/systemd/journald.conf.d/${n}`)).join('\n')}`) && limit(j) == null,
      message: (j) => j.t('journal-full-event-restart-needed'),
    },
    {
      id: 'too-big',
      condition: (j) => limit(j) != null && limit(j)! > G,
      message: (j) => j.t('journal-full-event-too-big'),
    },
    {
      id: 'end',
      condition: (j) => limited(j) && usage(j) <= G && disk(j) < 0.8 && running(j, 'systemd-journald'),
      message: (j) => j.t('journal-full-event-end'),
    },
  ],
};

/** The journal's directory, added to the world /var/log (see createWorld). */
export function withJournal(world: Directory): Directory {
  ((world.children.var as Directory).children.log as Directory).children.journal = journalDir();
  return world;
}
