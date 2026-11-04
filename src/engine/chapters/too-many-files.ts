// Story "The Observatory", chapter 3 — "Too Many Open Files": the gallery's
// new version has an archive page that opens every photo of the archive
// (2400) to build its mosaic, and keeps them open. Since this morning's
// update, the page answers 500: "EMFILE: too many open files". The
// gallery is a systemd service: its limit is 1024 open files (systemd's
// default soft limit), whatever the shell or /etc/security/limits.conf say.
// Commands: journalctl, curl, /proc/PID/limits, ls /proc/PID/fd | wc -l,
// lsof -p, ulimit, prlimit, systemctl edit (LimitNOFILE=), restart.
// Objective checked on the state: the gallery runs with an open-files limit
// above what the archive needs (2412), set in its unit (a drop-in or the
// unit file), so that it lasts. Traps: ulimit in the shell (only the shell
// and what it starts), limits.conf (pam_limits: login sessions only),
// LimitNOFILE= without a restart (a limit is set when the process starts),
// prlimit on the running process (works until the next restart).
// Sources: https://www.freedesktop.org/software/systemd/man/latest/systemd.exec.html#LimitCPU=,
// https://man7.org/linux/man-pages/man5/proc_pid_limits.5.html,
// https://man7.org/linux/man-pages/man1/prlimit.1.html,
// https://man7.org/linux/man-pages/man5/limits.conf.5.html

import type { Chapter, Directory } from '../world';
import { d, f } from '../world';
import type { Game } from '../shell';
import type { Process } from '../commands/system';
import { writeLog } from '../systemd';
import { limitsFile, nofileOf, SERVICE_NOFILE } from '../limits';
import { GALLERY, HOME, PASSWORD, accounts, observatoryState, observatoryWorld, passTime, prepare, running, sd, seen } from './observatory';

const BOOT = Date.UTC(2028, 0, 4, 7, 2, 0);
const NOW = Date.UTC(2028, 0, 4, 10, 12, 0);
export const PHOTOS = 2400;
// The archive's photos, plus what any Node.js process holds (standard streams, the socket…).
const BASE = 12;
export const NEED = PHOTOS + BASE;
const ARCHIVE = '/srv/skygallery/photos/archive';
const photo = (i: number) => `IMG_${String(i).padStart(4, '0')}.jpg`;

const gallery = (j: Game) => sd(j).services.gallery;
const proc = (j: Game) => ((j.state.process ?? []) as Process[]).find((p) => p.pid === GALLERY);
/** The gallery's open-files limit: that of its process, or the one it will get when it starts. */
const soft = (j: Game) => (proc(j) ? nofileOf(proc(j)).soft : (gallery(j).limitNofile ?? SERVICE_NOFILE).soft);
const configured = (j: Game) => gallery(j).limitNofile?.soft ?? SERVICE_NOFILE.soft;
const works = (j: Game) => running(j, 'gallery') && soft(j) >= NEED;

/** /proc/840 and the files the gallery holds: as many as its limit lets it open. */
function refresh(j: Game) {
  const limit = proc(j)?.nofile ?? gallery(j).limitNofile ?? SERVICE_NOFILE;
  const opened = Math.min(NEED, limit.soft);
  const fd: Directory = d(Object.fromEntries(Array.from({ length: opened }, (_, i) => [String(i), f('', { owner: 'gallery' })])), undefined, { owner: 'gallery', mode: 'r-x------' });
  const procDir = j.find('/proc') as Directory;
  procDir.children[String(GALLERY)] = d(
    { limits: f(limitsFile({ pid: GALLERY, user: 'gallery', cpu: 0, mem: 0, command: '', nofile: limit }), { owner: 'gallery', mode: 'r--r--r--' }), fd },
    undefined,
    { owner: 'gallery', mode: 'r-xr-xr-x' },
  );
  const archive = j.find(ARCHIVE) as Directory;
  j.state.openFiles = Array.from({ length: Math.max(0, opened - BASE) }, (_, i) => ({
    service: 'gallery', pid: GALLERY, user: 'gallery', command: 'node', fd: BASE + i, path: `${ARCHIVE}/${photo(i + 1)}`, node: archive.children[photo(i + 1)], mode: 'r',
  }));
}

/** A request for the archive's mosaic: refused past the limit, with Node's error in the journal. */
function archive(j: Game) {
  if (soft(j) >= NEED) return { code: 200, body: j.t('too-many-files-archive-page', { photos: String(PHOTOS) }) };
  const s = sd(j);
  writeLog(s, 'gallery.service', 'node', GALLERY, `Error: EMFILE: too many open files, open '${ARCHIVE}/${photo(soft(j) - BASE + 1)}'`, 3);
  writeLog(s, 'gallery.service', 'node', GALLERY, `    at Object.openSync (node:fs:573:18)`, 3, false);
  writeLog(s, 'gallery.service', 'node', GALLERY, `GET /archive 500 - mosaic aborted`, 4, false);
  return { code: 500, body: 'Internal Server Error' };
}

export const LIMITS_CONF = `# /etc/security/limits.conf
#
# Each line describes a limit for a user in the form:
#
#<domain>        <type>  <item>  <value>
#
# This file sets the limits of the sessions opened through PAM
# (pam_limits: ssh, login, su…), not those of systemd services.
#
#*               soft    core            0
#@student        hard    nproc           20
#@faculty        soft    nproc           20

# End of file`;

export const tooManyFiles: Chapter = {
  id: 'too-many-files',
  number: 3,
  commands: [
    'ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'nano', 'sudo', 'id', 'whoami', 'wc', 'ps', 'top', 'pgrep',
    'systemctl', 'journalctl', 'curl', 'ulimit', 'prlimit', 'lsof',
  ],
  home: HOME,
  welcome: 'message_from_amara.txt',
  names: true,
  final: 'end',
  steps: ['emfile', 'limits', 'end'],
  password: PASSWORD,
  accounts,
  state: (t) => {
    const s = observatoryState(t, { boot: BOOT, now: NOW, gallery: 0.2, load: [0.31, 0.27, 0.22] });
    return {
      ...s,
      apps: {
        '127.0.0.1:8080': {
          service: 'gallery',
          pages: { '/': t('observatory-gallery-page') },
          answer: (j: Game, path: string) => (path === '/archive' || path === '/archive/' ? archive(j) : { code: 200, body: t('observatory-gallery-page') }),
        },
      },
    };
  },
  initialise: (j) => {
    prepare(j);
    gallery(j).load = refresh;
    j.state.onLimits = refresh;
    refresh(j);
    // This morning: the update, then the members' first visits to the archive.
    const s = sd(j);
    const now = s.clock;
    s.clock = Date.UTC(2028, 0, 4, 8, 40, 0);
    writeLog(s, 'gallery.service', 'systemd', 1, 'Stopping gallery.service - ' + gallery(j).description + '...');
    writeLog(s, 'gallery.service', 'systemd', 1, 'Started gallery.service - ' + gallery(j).description + '.');
    writeLog(s, 'gallery.service', 'node', GALLERY, 'gallery 1.5.0 listening on 127.0.0.1:8080 (archive: 2400 photos)');
    for (const time of [Date.UTC(2028, 0, 4, 9, 3, 0), Date.UTC(2028, 0, 4, 9, 47, 0)]) {
      s.clock = time;
      archive(j);
    }
    s.clock = now;
  },
  afterCommand: passTime,
  createWorld: (t) => {
    const world = observatoryWorld(t, { welcome: { 'message_from_amara.txt': t('too-many-files-message-amara') } });
    const sky = (world.children.srv as Directory).children.skygallery as Directory;
    sky.children.photos = d(
      { archive: d(Object.fromEntries(Array.from({ length: PHOTOS }, (_, i) => [photo(i + 1), f('JFIF', { owner: 'gallery' })])), undefined, { owner: 'gallery', group: 'gallery' }) },
      undefined,
      { owner: 'gallery', group: 'gallery' },
    );
    const etc = world.children.etc as Directory;
    etc.children.security = d({ 'limits.conf': f(LIMITS_CONF, { lines: true, owner: 'root' }) }, undefined, { owner: 'root' });
    world.children.proc = d({}, undefined, { owner: 'root', mode: 'r-xr-xr-x' });
    return world;
  },
  events: [
    {
      id: 'emfile',
      condition: (j) => seen(j, 'EMFILE'),
      message: (j) => j.t('too-many-files-event-emfile'),
    },
    {
      id: 'limits',
      condition: (j) => seen(j, 'Max open files') || seen(j, 'NOFILE'),
      message: (j) => j.t('too-many-files-event-limits'),
    },
    {
      id: 'ulimit-shell',
      condition: (j) => (j.state.shellNofile?.soft ?? 1024) !== 1024 && !works(j),
      message: (j) => j.t('too-many-files-event-ulimit-shell'),
    },
    {
      id: 'limits-conf',
      condition: (j) => /^\s*[^#\s]\S*\s+(soft|hard|-)\s+nofile\s/m.test(j.read('/etc/security/limits.conf') ?? '') && !works(j),
      message: (j) => j.t('too-many-files-event-limits-conf'),
    },
    {
      id: 'too-small',
      condition: (j) => gallery(j).limitNofile !== undefined && configured(j) < NEED,
      message: (j) => j.t('too-many-files-event-too-small', { need: String(NEED) }),
    },
    {
      id: 'restart-needed',
      condition: (j) => configured(j) >= NEED && running(j, 'gallery') && soft(j) < NEED,
      message: (j) => j.t('too-many-files-event-restart-needed'),
    },
    {
      id: 'live-only',
      condition: (j) => works(j) && configured(j) < NEED,
      message: (j) => j.t('too-many-files-event-live-only'),
    },
    {
      id: 'end',
      condition: (j) => works(j) && configured(j) >= NEED,
      message: (j) => j.t('too-many-files-event-end'),
    },
  ],
};
