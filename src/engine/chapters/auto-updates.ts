// Story "La Coopérative" — chapter "Automatic updates": after the manual
// update of the previous chapter, new security updates are already there.
// Marc had installed unattended-upgrades… without ever enabling it
// (20auto-upgrades at "0"). Enable it, receive the report by mail, reboot
// on its own but at night (the co-op is open from 7 am to 8 pm), and do not
// let nodejs through (NodeSource repository: a new major version the till
// does not support).
// Proof: start the apt-daily-upgrade service, as its timer will.
// Real traps: a forgotten ";" (apt-config refuses the whole file);
// "origin=*" in Origins-Pattern (nodejs goes to 22, the till will not
// restart); Automatic-Reboot without a time (immediate reboot, in the
// middle of the day); the service started before enabling 20auto-upgrades
// (it does nothing).
// Objective checked on the state: both tasks enabled, an automatic run
// installed the security updates, nodejs stays at 20, a report was sent,
// the automatic reboot is set at night, the till is running.
// Sources: https://wiki.debian.org/UnattendedUpgrades,
// https://github.com/mvo5/unattended-upgrades/blob/master/data/50unattended-upgrades.Debian

import { d, f, type Chapter } from '../world';
import type { Game } from '../shell';
import { loadNginx } from '../nginx';
import { systemd } from '../systemd';
import { readConfApt, yes } from '../apt-conf';
import { BASE_INSTALLED, PACKAGES, type AptState } from '../commands/apt';
import { afterDaily, UU, checkDaily } from '../commands/unattended';
import { cooperativeAccounts, M, cooperativeWorld, PASSWORD } from './coop';
import { SITE } from './updates';
import { NEW_KEY, tillEnv, tillState, tillWorld, BINARY_NGINX, nginxCooperative, tillSystemd } from './till-web';

const KERNEL = '6.12.48+deb13-amd64';
const NEW_KERNEL = '6.12.57+deb13-amd64';
const NODE = '20.19.5-1nodesource1';

// After "Updates": everything is up to date… until this week's announcements.
const INSTALLED: Record<string, string> = {
  ...Object.fromEntries(BASE_INSTALLED.map((p) => [p, PACKAGES[p].version])),
  nginx: '1.26.3-3+deb13u2',
  libc6: '2.41-12+deb13u1',
  openssl: '3.5.4-1~deb13u1',
  libssl3t64: '3.5.4-1~deb13u1',
  tzdata: '2025b-4',
  nodejs: NODE,
  'linux-image-amd64': '6.12.48-1',
  [`linux-image-${KERNEL}`]: '6.12.48-1',
};
const SECURITY: Record<string, string> = { openssl: '3.5.4-1~deb13u2', libssl3t64: '3.5.4-1~deb13u2', 'linux-image-amd64': '6.12.57-1' };
const UPDATES: Record<string, string> = { ...SECURITY, tzdata: '2025b-4+deb13u1', nodejs: '22.21.0-1nodesource1' };
const ORIGINS = {
  tzdata: { o: 'Debian', n: 'trixie', l: 'Debian', site: 'deb.debian.org' },
  nodejs: { o: 'Node Source', n: 'nodistro', l: 'Node Source', site: 'deb.nodesource.com' },
};

// The file shipped by Debian (abridged), as Marc left it.
const FIFTY = `// Unattended-Upgrade::Origins-Pattern controls which packages are
// upgraded.
//
// Lines below have the format "keyword=value,...".  A
// package will be upgraded only if the values in its metadata match
// all the supplied keywords in a line.  (In other words, omitted
// keywords are wild cards.) The keywords originate from the Release
// file, but several aliases are accepted.  The accepted keywords are:
//   a,archive,suite (eg, "stable")
//   c,component     (eg, "main", "contrib", "non-free")
//   l,label         (eg, "Debian", "Debian-Security")
//   o,origin        (eg, "Debian", "Unofficial Multimedia Packages")
//   n,codename      (eg, "jessie", "jessie-updates")
//     site          (eg, "http.debian.net")
// The available values on the system are printed by the command
// "apt-cache policy", and can be debugged by running
// "unattended-upgrades -d" and looking at the log file.
//
// Within lines unattended-upgrades allows 2 macros whose values are
// derived from /etc/debian_version:
//   \${distro_id}            Installed origin.
//   \${distro_codename}      Installed codename (eg, "buster")
Unattended-Upgrade::Origins-Pattern {
        // Codename based matching:
        // This will follow the migration of a release through different
        // archives (e.g. from testing to stable and later oldstable).
        // Software will be the latest available for the named release,
        // but the Debian release itself will not be automatically upgraded.
//      "origin=Debian,codename=\${distro_codename}-updates";
//      "origin=Debian,codename=\${distro_codename}-proposed-updates";
        "origin=Debian,codename=\${distro_codename},label=Debian";
        "origin=Debian,codename=\${distro_codename},label=Debian-Security";
        "origin=Debian,codename=\${distro_codename}-security,label=Debian-Security";
};

// Python regular expressions, matching packages to exclude from upgrading
Unattended-Upgrade::Package-Blacklist {
    // The following matches all packages starting with linux-
//  "linux-";
};

// Send email to this address for problems or packages upgrades
// If empty or unset then no email is sent, make sure that you
// have a working mail setup on your system. A package that provides
// 'mailx' must be installed. E.g. "user@example.com"
//Unattended-Upgrade::Mail "";

// Set this value to one of:
//    "always", "only-on-error" or "on-change"
// If this is not set, then any legacy MailOnlyOnError (boolean) value
// is used to chose between "only-on-error" and "on-change"
//Unattended-Upgrade::MailReport "on-change";

// Automatically reboot *WITHOUT CONFIRMATION* if
//  the file /var/run/reboot-required is found after the upgrade
//Unattended-Upgrade::Automatic-Reboot "false";

// Automatically reboot even if there are users currently logged in
// when Unattended-Upgrade::Automatic-Reboot is set to true
//Unattended-Upgrade::Automatic-Reboot-WithUsers "true";

// If automatic reboot is enabled and needed, reboot at the specific
// time instead of immediately
//  Default: "now"
//Unattended-Upgrade::Automatic-Reboot-Time "02:00";
`;

// dpkg-reconfigure unattended-upgrades, to which Marc answered "No".
const TWENTY = 'APT::Periodic::Update-Package-Lists "0";\nAPT::Periodic::Unattended-Upgrade "0";\n';

const apt = (j: Game) => j.state.apt as AptState;
const conf = (j: Game) => readConfApt(j);
const active = (j: Game) => {
  const c = conf(j);
  return !c.errors.length && yes(c.values['APT::Periodic::Update-Package-Lists']) && yes(c.values['APT::Periodic::Unattended-Upgrade']);
};
const installedSecurity = (j: Game) => Object.entries(SECURITY).every(([n, v]) => apt(j).installed[n] === v);
const nodeIntact = (j: Game) => apt(j).installed.nodejs === NODE;
// A time when the co-op is closed (8 pm – 7 am).
const night = (j: Game) => {
  const c = conf(j).values;
  const m = /^(\d{1,2}):(\d{2})$/.exec(c[`${UU}::Automatic-Reboot-Time`] ?? 'now');
  return yes(c[`${UU}::Automatic-Reboot`]) && !!m && (Number(m[1]) >= 20 || Number(m[1]) < 7) && Number(m[1]) < 24;
};
const report = (j: Game) => !!conf(j).values[`${UU}::Mail`];
const okTill = (j: Game) => systemd(j)!.services.till.state === 'active';

export const automatic: Chapter = {
  id: 'auto-updates',
  number: 6,
  commands: [
    'ls',
    'cd',
    'pwd',
    'cat',
    'less',
    'head',
    'tail',
    'grep',
    'nano',
    'sudo',
    'id',
    'whoami',
    'apt',
    'apt-config',
    'unattended-upgrade',
    'uname',
    'systemctl',
    'journalctl',
    'mail',
    'ps',
  ],
  home: M,
  welcome: 'email_awa.txt',
  names: true,
  final: 'end',
  password: PASSWORD,
  accounts: () => cooperativeAccounts(false),
  state: () => {
    const e = tillState(tillEnv(NEW_KEY, 'loopback'));
    const s = tillSystemd();
    // The till only starts with Node.js 20 (its package.json requires it).
    s.services.till.check = (j) =>
      /^20\./.test(apt(j).installed.nodejs ?? '')
        ? null
        : [`till requires Node.js 20.x (found ${(apt(j).installed.nodejs ?? '').replace(/-.*/, '')})`, 'npm error engine Unsupported engine'];
    for (const [name, description] of [
      ['apt-daily', 'Daily apt download activities'],
      ['apt-daily-upgrade', 'Daily apt upgrade and clean activities'],
    ] as const)
      s.services[name] = {
        description,
        state: 'inactive',
        active: false,
        process: [],
        executable: 'apt.systemd.daily',
        since: s.clock,
        oneshot: true,
        ...(name === 'apt-daily-upgrade' ? { check: checkDaily, execute: (j: Game) => (afterDaily(j), 0) } : {}),
      };
    s.timers = {
      'apt-daily': {
        description: 'Daily apt download activities',
        unit: 'apt-daily',
        calendar: ['*-*-* 6,18:00'],
        active: true,
        state: 'active',
        since: s.clock,
        file: '/usr/lib/systemd/system/apt-daily.timer',
      },
      'apt-daily-upgrade': {
        description: 'Daily apt upgrade and clean activities',
        unit: 'apt-daily-upgrade',
        calendar: ['*-*-* 6:00'],
        active: true,
        state: 'active',
        since: s.clock,
        file: '/usr/lib/systemd/system/apt-daily-upgrade.timer',
      },
    };
    return {
      ...e,
      systemd: s,
      apt: {
        lists: true,
        installed: { ...INSTALLED },
        updates: { ...UPDATES },
        fresh: { [`linux-image-${NEW_KERNEL}`]: '6.12.57-1' },
        origins: ORIGINS,
      },
      kernel: { active: KERNEL, installed: KERNEL },
    };
  },
  initialise: (j) => {
    loadNginx(j);
    const sd = systemd(j)!;
    sd.clock = Date.UTC(2027, 9, 19, 13, 10, 0);
    for (const m of Object.values(sd.timers ?? {})) m.last = Date.UTC(2027, 9, 19, 4, 0, 0);
  },
  createWorld: (t) =>
    cooperativeWorld({
      withoutMarc: true,
      home: { 'email_awa.txt': f(t('auto-updates-email-awa')) },
      etc: {
        ...nginxCooperative(SITE),
        apt: d(
          {
            'apt.conf.d': d(
              {
                '20auto-upgrades': f(TWENTY, { lines: true, owner: 'root' }),
                '50unattended-upgrades': f(FIFTY, { lines: true, owner: 'root' }),
              },
              undefined,
              { owner: 'root' },
            ),
            'sources.list.d': d(
              {
                'debian.sources': f(
                  'Types: deb\nURIs: http://deb.debian.org/debian\nSuites: trixie trixie-updates\nComponents: main\n\nTypes: deb\nURIs: http://security.debian.org/debian-security\nSuites: trixie-security\nComponents: main',
                  { lines: true, owner: 'root' },
                ),
                'nodesource.list': f('deb [signed-by=/usr/share/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main', {
                  lines: true,
                  owner: 'root',
                }),
              },
              undefined,
              { owner: 'root' },
            ),
          },
          undefined,
          { owner: 'root' },
        ),
      },
      sbin: BINARY_NGINX,
      more: tillWorld({ env: tillEnv(NEW_KEY, 'loopback'), envMode: 'rw-------', logAccess: '', appLog: '' }),
    }),
  events: [
    { id: 'syntax', condition: (j) => conf(j).errors.length > 0, message: (j) => j.t('auto-updates-event-syntax') },
    { id: 'nothing', condition: (j) => (j.state.daily ?? 0) > 0 && !(j.state.autoPasses ?? 0), message: (j) => j.t('auto-updates-event-nothing') },
    { id: 'nodejs', condition: (j) => !nodeIntact(j), message: (j) => j.t('auto-updates-event-nodejs') },
    { id: 'in-day', condition: (j) => systemd(j)!.boot > 1, message: (j) => j.t('auto-updates-event-in-day') },
    {
      id: 'without-report',
      condition: (j) => (j.state.autoPasses ?? 0) > 0 && !conf(j).values[`${UU}::Mail`],
      message: (j) => j.t('auto-updates-event-without-report'),
    },
    {
      id: 'end',
      condition: (j) => active(j) && (j.state.autoPasses ?? 0) > 0 && installedSecurity(j) && nodeIntact(j) && report(j) && night(j) && okTill(j),
      message: (j) => j.t('auto-updates-event-end'),
    },
  ],
};
