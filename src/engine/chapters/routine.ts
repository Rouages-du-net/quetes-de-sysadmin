// Story "The Watch" — chapter "Settling Into a Routine": a one-off check
// isn't enough, watching is a habit. Two things to set up, which run on
// their own without replacing the human decision:
//   - unattended-upgrades, restricted to SECURITY updates only (not
//     everything, which would break things without warning): enable the two
//     periodic tasks (20auto-upgrades), and in 50unattended-upgrades, keep
//     only the "Debian-Security" Origins-Pattern lines, with an address for
//     the report;
//   - a weekly appointment that reminds you to read the next bulletin: a
//     systemd timer (or a cron job) that mails the list of packages waiting
//     to be updated.
// Objective checked on the state: both tasks of 20auto-upgrades enabled,
// 50unattended-upgrades limited to security updates with a report by mail,
// and an active and persistent timer (or cron job) that sends a weekly
// summary.
// Planned traps: enabling without restricting to security updates (or
// the reverse), a timer that doesn't survive a reboot (not in /etc).
// Sources: https://wiki.debian.org/UnattendedUpgrades,
// https://www.freedesktop.org/software/systemd/man/latest/systemd.timer.html,
// https://manpages.debian.org/bookworm/cron/crontab.5.en.html

import { d, f, type Chapter } from '../world';
import type { Game } from '../shell';
import { newSystemd, systemd } from '../systemd';
import { readConfApt, yes } from '../apt-conf';
import { M, NOW, PASSWORD, watchApt, watchAccounts, watchListening, initialiseWatch, watchWorld, watchNginx, watchScan, serviceSsh } from './watch';

const STARTED = NOW - 14 * 86_400_000;
const TWENTY = '/etc/apt/apt.conf.d/20auto-upgrades';
const FIFTY = '/etc/apt/apt.conf.d/50unattended-upgrades';

const TWENTY_CONTENT = 'APT::Periodic::Update-Package-Lists "0";\nAPT::Periodic::Unattended-Upgrade "0";\n';

const FIFTY_CONTENT = `Unattended-Upgrade::Origins-Pattern {
        // Codename based matching:
        "origin=Debian,codename=\${distro_codename},label=Debian";
        "origin=Debian,codename=\${distro_codename},label=Debian-Security";
        "origin=Debian,codename=\${distro_codename}-security,label=Debian-Security";
};

// Send email to this address for problems or packages upgrades
// If empty or unset then no email is sent, make sure that you
// have a working mail setup on your system.
//Unattended-Upgrade::Mail "";

// Automatically reboot *WITHOUT CONFIRMATION* if
//  the file /var/run/reboot-required is found after the upgrade
//Unattended-Upgrade::Automatic-Reboot "false";
`;

const conf = (j: Game) => readConfApt(j);
const okActive = (j: Game) => {
  const c = conf(j);
  return !c.errors.length && yes(c.values['APT::Periodic::Update-Package-Lists']) && yes(c.values['APT::Periodic::Unattended-Upgrade']);
};
const fiftyLines = (j: Game) => (j.read(FIFTY) ?? '').split('\n');
const active = (l: string) => !/^\s*\/\//.test(l) && /"origin=/.test(l);
const okOnlySecurity = (j: Game) => {
  const l = fiftyLines(j);
  return !l.some((x) => active(x) && /label=Debian"/.test(x)) && l.some((x) => active(x) && /label=Debian-Security/.test(x));
};
const okReport = (j: Game) => fiftyLines(j).some((l) => !/^\s*\/\//.test(l) && /Unattended-Upgrade::Mail\s+"[^"]/.test(l));

// An active timer (or cron job), written by hand (persistent), whose
// command deals with updates AND mails the result.
const sd = (j: Game) => systemd(j)!;
const timerOk = (j: Game) =>
  Object.values(sd(j).timers ?? {}).some((m) => {
    if (m.state !== 'active' || !m.file.startsWith('/etc/')) return false;
    const service = sd(j).services[m.unit];
    const text = (service?.file ? (j.read(service.file) ?? '') : '').toLowerCase();
    return /exec/.test(text) && text.includes('apt') && text.includes('mail');
  });
const cronOk = (j: Game) =>
  Object.values((j.state.crontabs ?? {}) as Record<string, string>).some((t) =>
    t.split('\n').some((l) => {
      const s = l.trim().toLowerCase();
      return !!s && !s.startsWith('#') && s.includes('apt') && s.includes('mail');
    }),
  );
const okPeriodic = (j: Game) => timerOk(j) || cronOk(j);

const autoOk = (j: Game) => okActive(j) && okOnlySecurity(j) && okReport(j);

export const routine: Chapter = {
  id: 'routine',
  number: 5,
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
    'systemctl',
    'journalctl',
    'crontab',
    'mail',
  ],
  home: M,
  welcome: 'email_salome.txt',
  names: true,
  final: 'end',
  steps: ['active', 'security', 'periodic', 'end'],
  password: PASSWORD,
  accounts: watchAccounts,
  state: (t) => ({
    sshd: { load: {}, connectionsToLoad: 1, reloads: 0 },
    listening: watchListening(),
    nginx: watchNginx(t),
    scan: watchScan(t),
    apt: watchApt(true),
    crontabs: {},
    systemd: newSystemd('kneader', STARTED, NOW, {
      ssh: serviceSsh(),
      nginx: { description: 'A high performance web server and a reverse proxy server', active: true, executable: 'nginx' },
      cron: { description: 'Regular background program processing daemon', active: true, executable: 'cron' },
    }),
  }),
  initialise: initialiseWatch,
  createWorld: (t) =>
    watchWorld(t, {
      home: { 'email_salome.txt': f(t('routine-email-salome')) },
      etc: {
        apt: d(
          { 'apt.conf.d': d({ '20auto-upgrades': f(TWENTY_CONTENT, { lines: true, owner: 'root' }), '50unattended-upgrades': f(FIFTY_CONTENT, { lines: true, owner: 'root' }) }, undefined, { owner: 'root' }) },
          undefined,
          { owner: 'root' },
        ),
      },
    }),
  events: [
    { id: 'syntax', condition: (j) => conf(j).errors.length > 0, message: (j) => j.t('routine-event-syntax') },
    { id: 'active', condition: okActive, message: (j) => j.t('routine-event-active') },
    { id: 'security', condition: (j) => okActive(j) && okOnlySecurity(j) && okReport(j), message: (j) => j.t('routine-event-security') },
    { id: 'periodic', condition: okPeriodic, message: (j) => j.t('routine-event-periodic') },
    { id: 'end', condition: (j) => autoOk(j) && okPeriodic(j), message: (j) => j.t('routine-event-end') },
  ],
};
