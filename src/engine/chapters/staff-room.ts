// Story "The Staff Room": what its chapters share. A primary school (some
// 300 pupils, 25 staff) prints through chalk (craie in French, 192.0.2.64),
// a small Debian server in the office cupboard running CUPS. It has a leg on
// each of the school's networks: eth0 on the servers' network
// (192.0.2.0/24), eth1 on the staff VLAN (198.51.100.0/24: the staff
// room's and classrooms' PCs and Macs), eth2 on the pupils' VLAN
// (203.0.113.0/24: the library's Chromebooks), because the library's
// printer is for pupils too. So @LOCAL, in cupsd.conf, means all three.
// The printers: the office laser (IPP Everywhere), the library's colour
// laser (IPP Everywhere, for pupils), then the staff room's new MFP and the
// reception's old HP LaserJet 4250 (port 9100 only, it needs a driver).
// Ines runs the office; Joe is the caretaker; Sven, Amara, Kofi, Aiko and
// Leila teach. The staff's computers send jobs as their users; the
// Chromebooks as "pupil". Each command, a minute passes: the printers
// print, the staff and the pupils send what they send.
// Addresses: RFC 5737. mDNS names (.local) are what DNS-SD announces.
// Sources: https://www.cups.org/doc/sharing.html, https://www.cups.org/doc/man-cupsd.conf.html,
// https://wiki.debian.org/SystemPrinting, https://wiki.debian.org/CUPSDriverlessPrinting

import { accountsFiles, d, f, type Accounts, type Directory, type File, type Node, type Rights } from '../world';
import type { Game, Shell } from '../shell';
import { newSystemd, systemd, type DefinitionService } from '../systemd';
import type { Process } from '../commands/system';
import { advance, attach, cups, deviceFor, logDate, printersText, submit, syncSpool, type CupsState, type Device, type Job, type Model, type Printer } from '../cups';
import { webAnswer } from '../commands/cups';

export const HOME = '/home/you';
export const PASSWORD = 'chalkboard-29';
export const CHALK = '192.0.2.64';
export const STAFF_NET = '198.51.100.0/24';
export const PUPILS_NET = '203.0.113.0/24';
// A staff PC (Amara's classroom), a Mac (Kofi's), a Chromebook in the library.
export const STAFF_PC = '198.51.100.23';
export const STAFF_MAC = '198.51.100.41';
export const CHROMEBOOK = '203.0.113.77';
export const SVEN_PC = '198.51.100.31';

// Friday 16 November 2029 (the jam); Monday 19 November, 8:10 (chapter 1);
// Wednesday 28 November, 13:30 (chapter 2); Friday 7 December, 16:00 (chapter 3).
export const FRIDAY = Date.UTC(2029, 10, 16, 16, 5, 2);
export const NOW_1 = Date.UTC(2029, 10, 19, 8, 10, 0);
export const NOW_2 = Date.UTC(2029, 10, 28, 13, 30, 0);
export const NOW_3 = Date.UTC(2029, 11, 7, 16, 0, 0);
const BOOT = Date.UTC(2029, 9, 30, 7, 2, 0);
const GiB = 1024 ** 3;
const MiB = 1024 ** 2;

export type ChapterNo = 1 | 2 | 3;

export const chalkAccounts = (): Accounts => ({
  users: {
    root: { uid: 0, group: 'root', home: '/root' },
    lp: { uid: 7, group: 'lp', home: '/var/spool/lpd', shell: '/usr/sbin/nologin' },
    you: { uid: 1000, group: 'you' },
    ines: { uid: 1001, group: 'ines' },
    sven: { uid: 1002, group: 'sven' },
    amara: { uid: 1003, group: 'amara' },
    kofi: { uid: 1004, group: 'kofi' },
    aiko: { uid: 1005, group: 'aiko' },
    leila: { uid: 1006, group: 'leila' },
  },
  groups: {
    root: { gid: 0, members: [] },
    adm: { gid: 4, members: ['you'] },
    lp: { gid: 7, members: [] },
    sudo: { gid: 27, members: ['you'] },
    lpadmin: { gid: 118, members: ['you'] },
    you: { gid: 1000, members: [] },
    ines: { gid: 1001, members: [] },
    sven: { gid: 1002, members: [] },
    amara: { gid: 1003, members: [] },
    kofi: { gid: 1004, members: [] },
    aiko: { gid: 1005, members: [] },
    leila: { gid: 1006, members: [] },
    staff: { gid: 1500, members: ['ines', 'sven', 'amara', 'kofi', 'aiko', 'leila'] },
  },
});

// ——— The printers on the network ———

export const OFFICE_URI = 'ipp://laser-office.internal/ipp/print';
export const LIBRARY_URI = 'ipp://laser-library.internal/ipp/print';
export const MFP_URI = 'ipp://mfp-staffroom.internal/ipp/print';
export const OLD_URI = 'socket://laserjet-reception.internal:9100';

export const devices = (n: ChapterNo): Device[] => [
  { uri: OFFICE_URI, names: ['laser-office.internal', 'laser-office.local'], address: '198.51.100.20', makeModel: 'Kyocera ECOSYS P3145dn', ipp: true, online: true, ppm: 45, dnssd: 'Kyocera ECOSYS P3145dn' },
  { uri: LIBRARY_URI, names: ['laser-library.internal', 'laser-library.local'], address: '203.0.113.20', makeModel: 'Brother HL-L3270CDW series', ipp: true, online: true, ppm: 24, dnssd: 'Brother HL-L3270CDW series' },
  ...(n >= 2
    ? [
        { uri: MFP_URI, names: ['mfp-staffroom.internal', 'mfp-staffroom.local'], address: '198.51.100.21', makeModel: 'RICOH IM C3010', ipp: true, online: true, ppm: 30, dnssd: 'RICOH IM C3010' },
        { uri: OLD_URI, names: ['laserjet-reception.internal'], address: '198.51.100.22', makeModel: 'HP LaserJet 4250', ipp: false, online: true, ppm: 43 },
      ]
    : []),
];

// cups's own sample drivers (drv:///sample.drv), and those printer-driver-hpcups installs.
export const HPCUPS_DRV = '/usr/share/cups/drv/hpcups.drv';
export const MODELS: Model[] = [
  { name: 'drv:///sample.drv/dymo.ppd', makeModel: 'Dymo Label Printer' },
  { name: 'drv:///sample.drv/epson9.ppd', makeModel: 'Epson 9-Pin Series' },
  { name: 'drv:///sample.drv/epson24.ppd', makeModel: 'Epson 24-Pin Series' },
  { name: 'drv:///sample.drv/generic.ppd', makeModel: 'Generic PostScript Printer' },
  { name: 'drv:///sample.drv/generpcl.ppd', makeModel: 'Generic PCL Laser Printer' },
  { name: 'drv:///sample.drv/deskjet.ppd', makeModel: 'HP DeskJet Series' },
  { name: 'drv:///sample.drv/laserjet.ppd', makeModel: 'HP LaserJet Series PCL 4/5' },
  { name: 'drv:///sample.drv/intelbar.ppd', makeModel: 'Intellitech IntelliBar Label Printer, 2.1' },
  { name: 'drv:///sample.drv/okidata9.ppd', makeModel: 'Oki 9-Pin Series' },
  { name: 'drv:///sample.drv/zebra.ppd', makeModel: 'Zebra ZPL Label Printer' },
  { name: 'drv:///hpcups.drv/hp-laserjet_4200.ppd', makeModel: 'HP LaserJet 4200, hpcups 3.25.2', file: HPCUPS_DRV },
  { name: 'drv:///hpcups.drv/hp-laserjet_4250.ppd', makeModel: 'HP LaserJet 4250, hpcups 3.25.2', file: HPCUPS_DRV },
  { name: 'drv:///hpcups.drv/hp-laserjet_4350.ppd', makeModel: 'HP LaserJet 4350, hpcups 3.25.2', file: HPCUPS_DRV },
];

// ——— cupsd.conf ———

/** Debian's cupsd.conf (cups 2.4), with what the story's admins changed. */
export function cupsdConf(o: { logLevel?: string; maxLogSize?: string; history?: string; files?: string; remoteAdmin?: boolean; privateValues?: string; cancelAny?: boolean } = {}): string {
  const admin = o.remoteAdmin ? '  Allow @LOCAL\n' : '';
  return `#
# Configuration file for the CUPS scheduler.  See "man cupsd.conf" for a
# complete description of this file.
#

# Log general information in error_log - change "warn" to "debug"
# for troubleshooting...
LogLevel ${o.logLevel ?? 'warn'}
${o.maxLogSize !== undefined ? `MaxLogSize ${o.maxLogSize}\n` : ''}PageLogFormat
${o.history !== undefined ? `PreserveJobHistory ${o.history}\n` : ''}${o.files !== undefined ? `PreserveJobFiles ${o.files}\n` : ''}
# Specifies the maximum size of the log files before they are rotated.  The value "0" disables log rotation.

# Allow remote access
Port 631
Listen /run/cups/cups.sock

# Share local printers on the local network.
Browsing On
BrowseLocalProtocols dnssd

# Default authentication type, when authentication is required...
DefaultAuthType Basic

# Web interface setting...
WebInterface Yes

# Timeout after cupsd exits if idle (applied only if cupsd runs on-demand - with -l)
IdleExitTimeout 60

# Restrict access to the server...
<Location />
  # Allow shared printing...
  Order allow,deny
  Allow @LOCAL
</Location>

# Restrict access to the admin pages...
<Location /admin>
  AuthType Default
  Require valid-user
  Order allow,deny
${admin}</Location>

# Restrict access to configuration files...
<Location /admin/conf>
  AuthType Default
  Require user @SYSTEM
  Order allow,deny
${admin}</Location>

# Restrict access to log files...
<Location /admin/log>
  AuthType Default
  Require user @SYSTEM
  Order allow,deny
${admin}</Location>

# Set the default printer/job policies...
<Policy default>
  # Job/subscription privacy...
  JobPrivateAccess default
  JobPrivateValues ${o.privateValues ?? 'default'}
  SubscriptionPrivateAccess default
  SubscriptionPrivateValues default

  # Job-related operations must be done by the owner or an administrator...
  <Limit Create-Job Print-Job Print-URI Validate-Job>
    Order deny,allow
  </Limit>

  <Limit Send-Document Send-URI Hold-Job Release-Job Restart-Job Purge-Jobs Set-Job-Attributes Create-Job-Subscription Renew-Subscription Cancel-Subscription Get-Notifications Reprocess-Job Cancel-Current-Job Suspend-Current-Job Resume-Job Cancel-My-Jobs Close-Job CUPS-Move-Job CUPS-Get-Document>
    Require user @OWNER @SYSTEM
    Order deny,allow
  </Limit>

  # All administration operations require an administrator to authenticate...
  <Limit CUPS-Add-Modify-Printer CUPS-Delete-Printer CUPS-Add-Modify-Class CUPS-Delete-Class CUPS-Set-Default CUPS-Get-Devices>
    AuthType Default
    Require user @SYSTEM
    Order deny,allow
  </Limit>

  # All printer operations require a printer operator to authenticate...
  <Limit Pause-Printer Resume-Printer Enable-Printer Disable-Printer Pause-Printer-After-Current-Job Hold-New-Jobs Release-Held-New-Jobs Deactivate-Printer Activate-Printer Restart-Printer Shutdown-Printer Startup-Printer Promote-Job Schedule-Job-After Cancel-Jobs CUPS-Accept-Jobs CUPS-Reject-Jobs>
    AuthType Default
    Require user @SYSTEM
    Order deny,allow
  </Limit>

  # Only the owner or an administrator can cancel or authenticate a job...
  <Limit Cancel-Job CUPS-Authenticate-Job>
${o.cancelAny ? '' : '    Require user @OWNER @SYSTEM\n'}    Order deny,allow
  </Limit>

  <Limit All>
    Order deny,allow
  </Limit>
</Policy>`;
}

export const CUPS_FILES_CONF = `#
# File/directory/user/group configuration file for the CUPS scheduler.
# See "man cups-files.conf" for a complete description of this file.
#

# List of events that are considered fatal errors for the scheduler...
#FatalErrors config

# Do we call fsync() after writing configuration or status files?
#SyncOnClose No

# Default user and group for filters/backends/helper programs; this cannot be
# any user or group that resolves to ID 0 for security reasons...
#User lp
#Group lp

# Administrator user group, used to match @SYSTEM in cupsd.conf policy rules...
# This cannot contain the Group value for security reasons...
SystemGroup lpadmin

# Location of the file logging all access to the scheduler; may be the name
# "syslog". If not an absolute path, the value of ServerRoot is used as the
# root directory.  Also see the "AccessLogLevel" directive in cupsd.conf.
AccessLog /var/log/cups/access_log

# Location of the file logging all messages produced by the scheduler and any
# helper programs; may be the name "syslog". If not an absolute path, the value
# of ServerRoot is used as the root directory.  Also see the "LogLevel"
# directive in cupsd.conf.
ErrorLog /var/log/cups/error_log

# Location of the file logging all pages printed by the scheduler and any
# helper programs; may be the name "syslog". If not an absolute path, the value
# of ServerRoot is used as the root directory.  Also see the "PageLogFormat"
# directive in cupsd.conf.
PageLog /var/log/cups/page_log`;

/** Debian's /etc/logrotate.d/cups-daemon. */
export const LOGROTATE_CUPS = `/var/log/cups/*log {
	daily
	missingok
	rotate 7
	sharedscripts
	prerotate
		if [ -e /var/run/cups/cupsd.pid ]; then
			invoke-rc.d --quiet cups stop > /var/run/cups/cupsd.stopped
		fi
	endscript
	postrotate
		if [ -e /var/run/cups/cupsd.stopped ]; then
			rm /var/run/cups/cupsd.stopped
			invoke-rc.d --quiet cups start > /dev/null
		fi
	endscript
	compress
	notifempty
	create
}`;

// ——— Helpers ———

const proc = (pid: number, user: string, command: string): Process => ({ pid, user, cpu: 0, mem: 0.3, command });
export const sd = (j: Game) => systemd(j)!;
export const now = (j: Game) => sd(j).clock;
export const seen = (j: Game, text: string | RegExp) => {
  const all = `${j.last.output}\n${j.last.errors.join('\n')}`;
  return typeof text === 'string' ? all.includes(text) : text.test(all);
};
export const typed = (j: Game) => (j as Shell).last.line ?? '';
export const queueFor = (j: Game, uri: string): Printer | undefined => {
  const st = cups(j);
  return Object.values(st.printers).find((p) => deviceFor(st, p.uri)?.uri === uri);
};
export const enabled = (p: Printer | undefined) => !!p && p.state !== 'stopped' && p.accepting;

// ——— The state ———

const printer = (o: Partial<Printer> & Pick<Printer, 'name' | 'uri' | 'makeModel' | 'driver' | 'id'>): Printer => ({
  info: o.name,
  location: '',
  state: 'idle',
  stateTime: BOOT,
  message: '',
  accepting: true,
  acceptTime: BOOT,
  shared: true,
  ...o,
});

export function basePrinters(n: ChapterNo): Record<string, Printer> {
  const office = printer({ name: 'office', id: 1, info: 'Office laser', location: 'School office', uri: OFFICE_URI, makeModel: 'Kyocera ECOSYS P3145dn - IPP Everywhere', driver: 'everywhere' });
  const library = printer({ name: 'library', id: 2, info: 'Library colour laser', location: 'Library', uri: LIBRARY_URI, makeModel: 'Brother HL-L3270CDW series - IPP Everywhere', driver: 'everywhere' });
  const out: Record<string, Printer> = { office, library };
  if (n === 1) {
    office.state = 'stopped';
    office.stateTime = Date.UTC(2029, 10, 16, 16, 12, 33);
    office.message = 'Printer stopped due to backend errors; please consult the error_log file for details.';
  }
  if (n === 3) {
    out.staffroom = printer({ name: 'staffroom', id: 3, info: 'Staff room MFP', location: 'Staff room', uri: MFP_URI, makeModel: 'RICOH IM C3010 - IPP Everywhere', driver: 'everywhere', stateTime: Date.UTC(2029, 10, 28, 14, 0, 0), acceptTime: Date.UTC(2029, 10, 28, 14, 0, 0) });
    out.reception = printer({ name: 'reception', id: 4, info: 'Reception LaserJet', location: 'Reception', uri: OLD_URI, makeModel: 'HP LaserJet 4250, hpcups 3.25.2', driver: 'drv:///hpcups.drv/hp-laserjet_4250.ppd', stateTime: Date.UTC(2029, 10, 28, 14, 5, 0), acceptTime: Date.UTC(2029, 10, 28, 14, 5, 0) });
  }
  return out;
}

const job = (id: number, printer: string, user: string, title: string, pages: number, size: number, created: number, host: string, state: Job['state'] = 'pending', extra: Partial<Job> = {}): Job => ({
  id, printer, user, title, pages, size, created, host, state, printed: state === 'completed' ? pages : 0, ...(state === 'completed' ? { completed: created + 60_000 * Math.ceil(pages / 30) } : {}), ...extra,
});

// Chapter 1: Sven's yearbook proofs, then Monday morning's jobs behind them.
export const YEARBOOK = 117;
export function mondayJobs(): Job[] {
  const at = (h: number, m: number) => Date.UTC(2029, 10, 19, h, m, 0);
  return [
    job(YEARBOOK, 'office', 'sven', 'yearbook-2029-proofs.pdf', 900, 3_650_000_000, FRIDAY, SVEN_PC),
    job(118, 'office', 'amara', 'register-class-2B.pdf', 2, 84_211, at(7, 52), STAFF_PC),
    job(119, 'office', 'kofi', 'maths-worksheet-fractions.pdf', 30, 1_204_551, at(7, 58), STAFF_MAC),
    job(120, 'office', 'ines', 'letter-parents-museum-trip.pdf', 90, 2_911_870, at(8, 1), '198.51.100.12'),
    job(121, 'office', 'aiko', 'phonics-cards.pdf', 12, 6_420_388, at(8, 3), '198.51.100.27'),
    job(122, 'office', 'leila', 'staff-meeting-agenda.pdf', 2, 61_904, at(8, 5), '198.51.100.29'),
    job(123, 'office', 'kofi', 'maths-worksheet-fractions.pdf', 30, 1_204_551, at(8, 6), STAFF_MAC),
    job(124, 'office', 'amara', 'register-class-2B.pdf', 2, 84_211, at(8, 8), STAFF_PC),
  ];
}
// The colleagues' documents (what must come out).
export const COLLEAGUES = ['register-class-2B.pdf', 'maths-worksheet-fractions.pdf', 'letter-parents-museum-trip.pdf', 'phonics-cards.pdf', 'staff-meeting-agenda.pdf'];

// Chapter 3: a term of history, with the pupils' names in the titles (invented names).
export function termJobs(): Job[] {
  const titles: [string, string, string, number][] = [
    ['amara', 'staffroom', 'report-autumn-Mila-B.pdf', 3],
    ['kofi', 'staffroom', 'reading-assessment-Noah-T.pdf', 4],
    ['leila', 'office', 'support-plan-Sami-K.pdf', 6],
    ['aiko', 'staffroom', 'report-autumn-Yusuf-A.pdf', 3],
    ['ines', 'office', 'medical-form-Lena-O.pdf', 2],
    ['sven', 'staffroom', 'report-autumn-Chloe-D.pdf', 3],
    ['amara', 'staffroom', 'behaviour-log-Theo-R.pdf', 5],
    ['kofi', 'library', 'year4-spelling-list.pdf', 1],
    ['leila', 'office', 'safeguarding-note-Ava-M.pdf', 2],
    ['ines', 'office', 'free-meals-list-autumn.pdf', 4],
    ['aiko', 'staffroom', 'report-autumn-Iris-N.pdf', 3],
    ['sven', 'staffroom', 'parents-evening-slots-6S.pdf', 2],
  ];
  const out: Job[] = [];
  let id = 1188;
  // From 1 October to 6 December, one job every other day or so, in turn.
  for (let k = 0; k < 34; k++) {
    const [user, p, title, pages] = titles[k % titles.length];
    const created = Date.UTC(2029, 9, 1, 9, 0, 0) + k * 2 * 86_400_000 + (k % 5) * 3_600_000;
    out.push(job(id++, p, user, title, pages, 180_000 + pages * 412_377 + k * 9_013, created, user === 'kofi' ? STAFF_MAC : STAFF_PC, 'completed'));
  }
  return out;
}

export function cupsState(n: ChapterNo): CupsState {
  const jobs = n === 1 ? mondayJobs() : n === 3 ? termJobs() : [];
  return {
    printers: basePrinters(n),
    jobs,
    nextJob: n === 1 ? 125 : n === 2 ? 1101 : 1222,
    nextPrinter: n === 3 ? 5 : 3,
    default: 'office',
    devices: devices(n),
    models: MODELS,
    network: {
      interfaces: [
        { name: 'eth0', address: CHALK, prefix: 24 },
        { name: 'eth1', address: '198.51.100.4', prefix: 24 },
        { name: 'eth2', address: '203.0.113.4', prefix: 24 },
      ],
    },
    conf: null,
    written: '',
  };
}

const lan = () => ({
  interfaces: {
    lo: { name: 'lo', up: true, addresses: ['127.0.0.1/8'], mac: '00:00:00:00:00:00', addresses6: ['::1/128'] },
    eth0: { name: 'eth0', up: true, addresses: [`${CHALK}/24`], mac: '52:54:00:3c:a1:07' },
    eth1: { name: 'eth1', up: true, addresses: ['198.51.100.4/24'], mac: '52:54:00:3c:a1:08' },
    eth2: { name: 'eth2', up: true, addresses: ['203.0.113.4/24'], mac: '52:54:00:3c:a1:09' },
  },
  gateway: { via: '192.0.2.1', dev: 'eth0' },
  trunk: '',
  vlans: [],
  devices: [],
  order: ['lo', 'eth0', 'eth1', 'eth2'],
});

export function chalkState(n: ChapterNo) {
  const now = n === 1 ? NOW_1 : n === 2 ? NOW_2 : NOW_3;
  const services: Record<string, DefinitionService> = {
    ssh: { description: 'OpenBSD Secure Shell server', active: true, executable: 'sshd', process: [proc(688, 'root', 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups')] },
    cups: { description: 'CUPS Scheduler', active: true, executable: 'cupsd', modelled: true, process: [proc(912, 'root', '/usr/sbin/cupsd -l')] },
    'cups-browsed': { description: 'Make remote CUPS printers available locally', active: true, executable: 'cups-browsed', process: [proc(914, 'cups-browsed', '/usr/sbin/cups-browsed')] },
    cron: { description: 'Regular background program processing daemon', active: true, executable: 'cron', process: [proc(540, 'root', '/usr/sbin/cron -f')] },
  };
  return {
    systemd: newSystemd('chalk', BOOT, now, services),
    process: [proc(1, 'root', '/sbin/init'), ...Object.values(services).flatMap((x) => x.process ?? [])],
    mounts: [
      { path: '/', capacity: 19.5 * GiB, name: '/dev/vda1', system: 'ext4', bytesBase: 2.3 * GiB },
      { path: '/var', capacity: (n === 3 ? 6 : 5) * GiB, name: '/dev/vda3', system: 'ext4', bytesBase: 1.1 * GiB },
    ],
    listening: [
      { proto: 'tcp', address: '0.0.0.0', port: 22, process: 'sshd', pid: 688 },
      { proto: 'tcp', address: '0.0.0.0', port: 631, process: 'cupsd', pid: 912 },
      { proto: 'udp', address: '0.0.0.0', port: 5353, process: 'avahi-daemon', pid: 498 },
    ],
    baseLan: lan(),
    cups: cupsState(n),
    apps: { '127.0.0.1:631': { service: 'cups', pages: {}, answer: (g: Game, path: string) => ({ ...webAnswer(g as Shell, path), type: 'text/html' }) } },
  };
}

// ——— The world ———

const root: Rights = { owner: 'root' };
const conf = (text: string, rights: Rights = { owner: 'root', group: 'lp', mode: 'rw-r-----' }) => f(text, { lines: true, ...rights });
const log = (text: string, size?: number): File => f(text, { lines: true, owner: 'root', group: 'adm', mode: 'rw-r-----', ...(size ? { size } : {}) });

function ppds(printers: Record<string, Printer>): Record<string, Node> {
  return Object.fromEntries(
    Object.values(printers)
      .filter((p) => p.driver !== 'raw')
      .map((p) => [`${p.name}.ppd`, conf(`*PPD-Adobe: "4.3"\n*NickName: "${p.makeModel}"\n*DefaultPageSize: A4`)]),
  );
}

/** Friday's failure, as cupsd dumps a failed job's debug history at LogLevel warn. */
export function fridayErrorLog(): string {
  const at = (s: number) => logDate(FRIDAY + s * 1000);
  const lines = [
    `E ${at(451)} [Job 117] The following messages were recorded from 16:05:02 to 16:12:33`,
    `D ${at(0)} [Job 117] Adding start banner page "none".`,
    `D ${at(0)} [Job 117] Queued on "office" by "sven".`,
    `D ${at(0)} [Job 117] File of type application/pdf queued by "sven".`,
    `D ${at(1)} [Job 117] Started backend /usr/lib/cups/backend/ipp (PID 21877)`,
  ];
  for (let s = 1; s <= 421; s += 30) lines.push(`D ${at(s + 1)} [Job 117] Unable to connect to printer; will retry in 30 seconds...`);
  lines.push(
    `D ${at(451)} [Job 117] Backend returned status 1 (failed)`,
    `D ${at(451)} [Job 117] Printer stopped due to backend errors; please consult the error_log file for details.`,
    `E ${at(451)} [Job 117] End of messages`,
    `E ${at(451)} [Job 117] Printer stopped due to backend errors; please consult the error_log file for details.`,
  );
  return lines.join('\n');
}

function accessLog(n: ChapterNo): string {
  if (n !== 1) return `${STAFF_PC} - amara ${logDate((n === 2 ? NOW_2 : NOW_3) - 3_600_000)} "POST /printers/office HTTP/1.1" 200 412 Print-Job successful-ok`;
  return mondayJobs()
    .map((x) => `${x.host} - ${x.user} ${logDate(x.created)} "POST /printers/office HTTP/1.1" 200 ${380 + x.title.length * 7} Print-Job successful-ok`)
    .join('\n');
}

/** Chapter 3's error_log at debug2: weeks of it, every job's attributes written out. */
function debugLog(): string {
  const jobs = termJobs().slice(-6);
  return jobs
    .flatMap((x) => [
      `d ${logDate(x.created)} [Job ${x.id}] job-name="${x.title}" job-originating-user-name="${x.user}" job-originating-host-name="${x.host}"`,
      `D ${logDate(x.created)} [Job ${x.id}] File of type application/pdf queued by "${x.user}".`,
      `d ${logDate(x.created + 1000)} [Job ${x.id}] envp[18]="CUPS_FILETYPE=document"`,
      `d ${logDate(x.created + 1000)} [Job ${x.id}] argv[3]="${x.title}"`,
    ])
    .join('\n');
}

export function chalkWorld(n: ChapterNo, welcome: Record<string, string>): Directory {
  const st = cupsState(n);
  const pageLog = n === 3 ? termJobs().map((x) => `${x.printer} ${x.user} ${x.id} ${logDate(x.completed!)} total ${x.pages} - ${x.host} ${x.title} A4 one-sided`).join('\n') : `office ines 116 ${logDate(FRIDAY - 600_000)} total 4 - 198.51.100.12 newsletter-november.pdf A4 one-sided`;
  return d(
    {
      etc: d(
        {
          ...accountsFiles(),
          hostname: f('chalk', { lines: true, ...root }),
          hosts: f(`127.0.0.1\tlocalhost\n${CHALK}\tchalk chalk.internal\n198.51.100.20\tlaser-office laser-office.internal\n198.51.100.21\tmfp-staffroom mfp-staffroom.internal\n198.51.100.22\tlaserjet-reception laserjet-reception.internal\n203.0.113.20\tlaser-library laser-library.internal`, { lines: true, ...root }),
          cups: d(
            {
              'cupsd.conf': conf(
                n === 3 ? cupsdConf({ logLevel: 'debug2', maxLogSize: '0', history: 'Yes', files: 'Yes', remoteAdmin: true, privateValues: 'none', cancelAny: true }) : cupsdConf(),
                { owner: 'root', group: 'lp', mode: 'rw-r--r--' },
              ),
              'cups-files.conf': conf(CUPS_FILES_CONF, { owner: 'root', group: 'lp', mode: 'rw-r--r--' }),
              'printers.conf': conf(printersText(st, now0(n)), { owner: 'root', group: 'lp', mode: 'rw-------' }),
              ppd: d(ppds(st.printers), undefined, { owner: 'root', group: 'lp', mode: 'rwxr-xr-x' }),
              ssl: d({}, undefined, { owner: 'root', group: 'lp', mode: 'rwx------' }),
            },
            undefined,
            { owner: 'root', group: 'lp', mode: 'rwxr-xr-x' },
          ),
          'logrotate.d': d(n === 3 ? { apt: f('/var/log/apt/term.log {\n  rotate 12\n  monthly\n  compress\n  missingok\n  notifempty\n}', { lines: true, ...root }) } : { 'cups-daemon': f(LOGROTATE_CUPS, { lines: true, ...root }) }, undefined, root),
        },
        undefined,
        root,
      ),
      usr: d({ share: d({ cups: d({ drv: d({ 'sample.drv': f('// Sample drivers included with CUPS', { lines: true, ...root }) }, undefined, root) }, undefined, root) }, undefined, root) }, undefined, root),
      var: d(
        {
          spool: d({ cups: d({ tmp: d({}, undefined, { owner: 'root', group: 'lp', mode: 'rwxrwx--T' }) }, undefined, { owner: 'root', group: 'lp', mode: 'rwx--x---' }) }, undefined, root),
          log: d(
            {
              cups: d(
                {
                  error_log: n === 1 ? log(fridayErrorLog()) : n === 3 ? log(debugLog(), Math.round(3.9 * GiB)) : log(''),
                  access_log: log(accessLog(n), n === 3 ? 21 * MiB : undefined),
                  page_log: log(pageLog),
                },
                undefined,
                { owner: 'root', group: 'adm', mode: 'rwxr-xr-x' },
              ),
            },
            undefined,
            root,
          ),
        },
        undefined,
        root,
      ),
      home: d({ you: d(Object.fromEntries(Object.entries(welcome).map(([k, v]) => [k, f(v)]))), ines: d({}, undefined, { owner: 'ines', mode: 'rwx------' }) }, undefined, root),
      root: d({}, undefined, { owner: 'root', mode: 'rwx------' }),
      tmp: d({ 'test-page.txt': f('chalk test page\n', { lines: true, owner: 'you' }) }, undefined, { owner: 'root', mode: 'rwxrwxrwt' }),
    },
    undefined,
    root,
  );
}

const now0 = (n: ChapterNo) => (n === 1 ? NOW_1 : n === 2 ? NOW_2 : NOW_3);

/** At the start: the cups service hooked to the model, its configuration read, the spool written. */
export function initialiseChalk(j: Game) {
  attach(j);
  syncSpool(j);
  const s = sd(j).services.cups;
  s.load?.(j);
}

// ——— Time passing: printing, and what the staff and pupils send ———

export interface Traffic {
  from: string;
  user: string;
  // The queue it goes to (null: none suitable now).
  printer: (j: Game) => string | null;
  title: string;
  pages: number;
}

/** A minute passes; each minute, one of the traffic's requests arrives (in turn). */
export function passTime(j: Game, traffic: Traffic[] = []) {
  sd(j).clock += 60_000;
  const minute = (j.state.minutes = (j.state.minutes ?? 0) + 1);
  if (traffic.length) {
    const t = traffic[minute % traffic.length];
    const p = t.printer(j);
    if (p) submit(j, { from: t.from, user: t.user, printer: p, title: t.title, pages: t.pages, size: 40_000 + t.pages * 61_000 });
  }
  advance(j, 60_000);
}
