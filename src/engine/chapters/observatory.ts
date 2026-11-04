// What the chapters of "The Observatory" share: an amateur astronomy club
// and its small server, observatory (two vCPUs at a hosting provider). It
// serves the club's photo gallery (gallery, Node.js, on port 8080) and,
// at night, stacks the members' photos: stack-night starts worker
// processes (stack-worker) that each keep one CPU busy. Amara, the club's
// volunteer sysadmin, is away observing; Jules takes the photos.
// The processor is modelled by ../cpu.ts: each process's share, nice, a
// service's CPUQuota=, the load average.
// Simplifications: the gallery's response time is computed from the CPU it
// gets (it needs a whole CPU when members browse it); the stacking's output
// is not modelled.
// Sources: https://man7.org/linux/man-pages/man1/renice.1.html,
// https://man7.org/linux/man-pages/man7/sched.7.html,
// https://www.freedesktop.org/software/systemd/man/latest/systemd.resource-control.html

import { accountsFiles, d, f, type Accounts, type Directory, type Rights } from '../world';
import type { Translate } from '../../texts';
import type { Game } from '../shell';
import type { Process } from '../commands/system';
import { newSystemd, systemd, type DefinitionService } from '../systemd';
import { refreshCpu, shares, type Cpu } from '../cpu';
import { loadOverrides } from '../commands/systemd';
import type { Shell } from '../shell';

export const HOME = '/home/you';
export const PASSWORD = 'nebula-2028';
export const GALLERY = 840;
// The stacking: its parent (it only waits) and its eight workers.
export const STACK = 2101;
export const WORKERS = [2102, 2103, 2104, 2105, 2106, 2107, 2108, 2109];
const Mo = 1024 * 1024;

export const accounts = (): Accounts => ({
  users: {
    root: { uid: 0, group: 'root', home: '/root' },
    gallery: { uid: 998, group: 'gallery', home: '/srv/skygallery', shell: '/usr/sbin/nologin' },
    you: { uid: 1000, group: 'you' },
    amara: { uid: 1001, group: 'amara' },
    jules: { uid: 1002, group: 'jules' },
  },
  groups: {
    root: { gid: 0, members: [] },
    adm: { gid: 4, members: ['you', 'amara'] },
    sudo: { gid: 27, members: ['you', 'amara'] },
    gallery: { gid: 998, members: [] },
    you: { gid: 1000, members: [] },
    amara: { gid: 1001, members: [] },
    jules: { gid: 1002, members: [] },
    astro: { gid: 1100, members: ['amara', 'jules', 'you'] },
  },
});

export const proc = (pid: number, user: string, command: string, more: Partial<Process> = {}): Process => ({ pid, user, cpu: 0, mem: 0.1, command, ...more });

export const sd = (j: Game) => systemd(j)!;
export const seen = (j: Game, text: string) => j.last.output.includes(text) || j.last.errors.some((e) => e.includes(text));
export const running = (j: Game, n: string) => sd(j).services[n]?.state === 'active';
export const cpuOf = (j: Game) => j.state.cpu as Cpu;

/** The stacking's workers still alive. */
export const workers = (j: Game) => ((j.state.process ?? []) as Process[]).filter((p) => WORKERS.includes(p.pid));

/**
 * The gallery's response time (s): 0.25 s when it gets the CPU it wants,
 * much longer when it waits for one (requests queue up: the delay grows
 * faster than the shortage).
 */
export function galleryTime(j: Game): number {
  const want = cpuOf(j).demand[GALLERY] ?? 0;
  if (!want) return 0.25;
  const got = shares(j)[GALLERY] ?? 0;
  return Math.min(30, 0.25 * (want / Math.max(got, 0.0001)) ** 2);
}

export const GALLERY_UNIT = (t: Translate) => `[Unit]
Description=${t('observatory-gallery-description')}
After=network.target

[Service]
User=gallery
WorkingDirectory=/srv/skygallery
ExecStart=/usr/bin/node server.js
Restart=on-failure

[Install]
WantedBy=multi-user.target`;

/** The machine's services: ssh, cron, the gallery, and what the chapter adds. */
export function observatorySystemd(t: Translate, boot: number, now: number, more: Record<string, DefinitionService> = {}) {
  return newSystemd('observatory', boot, now, {
    ssh: { description: 'OpenBSD Secure Shell server', active: true, executable: 'sshd', process: [proc(612, 'root', 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups')] },
    cron: { description: 'Regular background program processing daemon', active: true, executable: 'cron', process: [proc(633, 'root', '/usr/sbin/cron -f')] },
    gallery: {
      description: t('observatory-gallery-description'),
      active: true,
      executable: 'node',
      file: '/etc/systemd/system/gallery.service',
      modelled: true,
      process: [proc(GALLERY, 'gallery', '/usr/bin/node server.js', { mem: 2.4 })],
    },
    ...more,
  });
}

export interface Options {
  boot: number;
  now: number;
  // The CPU the gallery wants (1: members are browsing it), the load before the chapter.
  gallery: number;
  load: [number, number, number];
  services?: Record<string, DefinitionService>;
  process?: Process[];
  demand?: Record<number, number>;
}

export function observatoryState(t: Translate, o: Options) {
  const systemd = observatorySystemd(t, o.boot, o.now, o.services);
  const own = Object.values(systemd.services).flatMap((s) => (s.state === 'active' ? s.process : []));
  return {
    systemd,
    process: [proc(1, 'root', '/sbin/init'), ...own, ...(o.process ?? [])],
    memory: { total: 4096 * Mo, kernel: 620 * Mo, rss: { 1: 12 * Mo, 612: 8 * Mo, 633: 4 * Mo, [GALLERY]: 98 * Mo, ...Object.fromEntries(WORKERS.map((p) => [p, 46 * Mo])), [STACK]: 21 * Mo } },
    cpu: { cores: 2, demand: { [GALLERY]: o.gallery, ...(o.demand ?? {}) }, load: o.load, at: o.now } satisfies Cpu,
    sessions: [{ user: 'jules', tty: 'pts/1', since: '2027-12-14 06:02', forEachOf: '198.51.100.23' }],
    // The gallery answers on 127.0.0.1:8080; its response time depends on the CPU it gets.
    apps: { '127.0.0.1:8080': { service: 'gallery', pages: { '/': t('observatory-gallery-page') }, time: galleryTime } },
  };
}

/** At the start of a chapter: the unit files read, the shares computed. */
export function prepare(j: Game) {
  loadOverrides(j as Shell, sd(j));
  refreshCpu(j);
}

/** Each command, a quarter of a minute: the load average moves towards what wants to run. */
export function passTime(j: Game) {
  sd(j).clock += 15_000;
  refreshCpu(j);
}

/** The club's machine: the gallery's unit and code, the night's photos, the welcome message. */
export function observatoryWorld(t: Translate, o: { welcome: Record<string, string>; units?: Record<string, string>; dropIns?: Record<string, Record<string, string>>; julesHome?: Record<string, string> }): Directory {
  const root: Rights = { owner: 'root' };
  const directory = (children: Parameters<typeof d>[0], rights: Rights = root) => d(children, undefined, rights);
  const file = (text: string, rights: Rights = root) => f(text, { lines: true, ...rights });
  const dropIns = Object.fromEntries(
    Object.entries(o.dropIns ?? {}).map(([u, files]) => [`${u}.d`, directory(Object.fromEntries(Object.entries(files).map(([n, x]) => [n, file(x)])))]),
  );
  const night = (date: string) =>
    directory(
      Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`frame_${String(i + 1).padStart(4, '0')}.fits`, f('SIMPLE  =                    T / FITS', { owner: 'jules', group: 'astro' })])),
      { owner: 'jules', group: 'astro' },
    );
  return directory({
    etc: directory({
      ...accountsFiles(),
      hostname: file('observatory'),
      systemd: directory({ system: directory({ 'gallery.service': file(GALLERY_UNIT(t)), ...Object.fromEntries(Object.entries(o.units ?? {}).map(([n, x]) => [n, file(x)])), ...dropIns }) }),
    }),
    home: directory({
      you: d(Object.fromEntries(Object.entries(o.welcome).map(([n, x]) => [n, f(x)]))),
      amara: directory({}, { owner: 'amara', mode: 'rwx------' }),
      jules: directory(Object.fromEntries(Object.entries(o.julesHome ?? {}).map(([n, x]) => [n, f(x, { owner: 'jules' })])), { owner: 'jules', mode: 'rwxr-x---', group: 'astro' }),
    }),
    srv: directory({
      skygallery: directory(
        { 'server.js': file(t('observatory-server-js'), { owner: 'gallery' }), 'package.json': file('{\n  "name": "gallery",\n  "version": "1.4.2",\n  "main": "server.js"\n}', { owner: 'gallery' }) },
        { owner: 'gallery', group: 'gallery' },
      ),
      nights: directory({ '2027-12-14': night('2027-12-14'), '2027-12-20': night('2027-12-20') }, { owner: 'jules', group: 'astro', mode: 'rwxrwsr-x' }),
    }),
    usr: directory({ local: directory({ bin: directory({ 'stack-night': f('#!/bin/sh\nexec /usr/local/lib/stack/stack-night "$@"', { owner: 'root', mode: 'rwxr-xr-x' }) }) }) }),
    root: directory({}, { owner: 'root', mode: 'rwx------' }),
    tmp: directory({}, { owner: 'root', mode: 'rwxrwxrwt' }),
  });
}
