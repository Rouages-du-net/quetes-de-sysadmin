// Story "Next Door Windows" — chapter "The Share Next Door": Plotter, the
// drawing export service on compass (account plotter), must write its PDFs
// on cabinet's "plans" share, and the mount must survive a reboot, with or
// without cabinet (Windows Update reboots it on Tuesday nights):
//   - smbclient -L //cabinet -U compass-svc: the shares (plans, scans, and
//     the administrative ones), SMB1 disabled;
//   - mount -t cifs: "you might need a /sbin/mount.<type> helper program":
//     cifs-utils isn't installed (apt install cifs-utils);
//   - vers=1.0 (Henrik's old NAS habit): "mount error(112): Host is down",
//     SMB1 is off on Windows Server since 2019, and should stay off;
//   - password= on the command line works, but stays in the history and
//     shows in ps while mount.cifs runs: a credentials file, root's, 600;
//   - mounted, everything belongs to root, 0755: plotter can't write;
//     chown changes nothing (a Windows server has no Unix owners): uid=,
//     gid= (and file_mode=, dir_mode=) are the mount's options;
//   - /etc/fstab: the line with credentials=, uid=, gid=, and _netdev,nofail
//     so that a boot without cabinet doesn't wait for it nor fail.
// Objective checked on the state: the share mounted on /mnt/plans and
// writable by plotter; a credentials file readable by root only; an fstab
// line that would mount it the same way (no password in it).
// Sources: https://manpages.debian.org/mount.cifs.8,
// https://www.kernel.org/doc/html/latest/admin-guide/cifs/usage.html,
// https://learn.microsoft.com/windows-server/storage/file-server/troubleshoot/detect-enable-and-disable-smbv1-v2-v3,
// https://www.freedesktop.org/software/systemd/man/latest/systemd.mount.html (_netdev, nofail)

import { f, type Chapter } from '../world';
import type { Game, Shell } from '../shell';
import { readFstab } from '../fstab';
import { serverFor } from '../nfs';
import { CABINET, FSTAB_BASE, HOME, MOUNT, PASSWORD, SVC, SVC_PASSWORD, cabinetHost, compassAccounts, compassState, compassWorld, plansMount } from './mixed-fleet';

// Monday 12 November 2029, 10:15.
export const NOW = Date.UTC(2029, 10, 12, 10, 15, 0);

// The last line's output, or an error mount.cifs gave after its password prompt.
const said = (j: Game, text: string) => j.last.output.includes(text) || j.last.errors.some((e) => e.includes(text)) || ((j.state.cifsErrors ?? []) as string[]).some((e) => e.includes(text));
const typed = (j: Game, ...cmds: string[]) => j.last.commands.some((c) => cmds.includes(c[0]));

/** The fstab line for /mnt/plans, if it is a cifs one. */
const fstabLine = (j: Game) => readFstab(j.read('/etc/fstab') ?? '').inputs.find((e) => /^(cifs|smb3)$/.test(e.type) && e.target.replace(/\/$/, '') === MOUNT);
const option = (options: string[], ...names: string[]) => options.find((o) => names.includes(o.split('=')[0].toLowerCase()))?.split('=').slice(1).join('=');

/** Could plotter write in a share mounted with these options (as the kernel would present it)? */
function writableWith(j: Game, options: string[]): boolean {
  if (options.includes('ro')) return false;
  const users = j.accounts.users;
  const named = (v: string | undefined, kind: 'users' | 'groups', fallback: string) => {
    if (v === undefined) return fallback;
    if (!/^\d+$/.test(v)) return v;
    const table = j.accounts[kind] as Record<string, { uid?: number; gid?: number }>;
    return Object.entries(table).find(([, a]) => (kind === 'users' ? a.uid : a.gid) === Number(v))?.[0] ?? v;
  };
  const owner = named(option(options, 'uid'), 'users', 'root');
  const group = named(option(options, 'gid'), 'groups', 'root');
  const mode = (option(options, 'dir_mode') ?? '0755').padStart(4, '0').slice(-3);
  const digit = Number(owner === 'plotter' ? mode[0] : j.groupsFor('plotter').includes(group) ? mode[1] : mode[2]);
  return !!users.plotter && (digit & 3) === 3;
}

const credentialsPath = (j: Game) => option(fstabLine(j)?.options ?? [], 'credentials', 'cred');
/** A credentials file root alone reads, with the account and its password. */
const credentialsOk = (j: Game) => {
  const p = credentialsPath(j);
  const n = p ? j.find(p) : null;
  if (n?.type !== 'file') return false;
  const text = j.read(p!) ?? '';
  return (n.owner ?? 'root') === 'root' && (n.mode ?? 'rw-r--r--').slice(3) === '------' && new RegExp(`^\\s*(username|user)\\s*=\\s*${SVC}\\s*$`, 'mi').test(text) && new RegExp(`^\\s*(password|pass)\\s*=\\s*${SVC_PASSWORD}\\s*$`, 'mi').test(text);
};
/** The fstab line: cabinet's plans share, credentials file, no password, _netdev and nofail, writable for plotter. */
const fstabOk = (j: Game) => {
  const e = fstabLine(j);
  if (!e) return false;
  const unc = /^\/\/([^/]+)\/([^/]+)\/?$/.exec(e.source);
  return (
    !!unc &&
    serverFor(j as Shell, unc[1])?.address === CABINET &&
    unc[2].toLowerCase() === 'plans' &&
    !!credentialsPath(j) &&
    option(e.options, 'password', 'pass') === undefined &&
    e.options.includes('nofail') &&
    e.options.includes('_netdev') &&
    option(e.options, 'vers') !== '1.0' &&
    writableWith(j, e.options)
  );
};
const mounted = (j: Game) => !!plansMount(j);
const writable = (j: Game) => {
  const n = mounted(j) ? j.find(MOUNT) : null;
  return !!n && j.can(n, 'w', 'plotter') && j.can(n, 'x', 'plotter');
};
const installed = (j: Game) => !!(j.state.apt as { installed: Record<string, string> } | undefined)?.installed['cifs-utils'];

export const COMMANDS_SMB = [
  'ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'nano', 'sudo', 'id', 'whoami', 'echo', 'touch', 'mkdir', 'rm', 'cp', 'mv', 'chmod', 'chown',
  'apt', 'smbclient', 'mount', 'umount', 'mount.cifs', 'df', 'findmnt', 'history', 'ps', 'systemctl', 'stat', 'tee', 'sed', 'du',
];

export const smbMount: Chapter = {
  id: 'smb-mount',
  number: 2,
  commands: COMMANDS_SMB,
  home: HOME,
  welcome: 'email_ifeoma.txt',
  names: true,
  final: 'end',
  steps: ['listed', 'helper', 'mounted', 'writable', 'credentials', 'fstab', 'end'],
  password: PASSWORD,
  accounts: compassAccounts,
  hosts: { cabinet: cabinetHost({ clock: NOW }) },
  state: (t) => compassState(t, { now: NOW, apt: true }),
  createWorld: (t) =>
    compassWorld(t, {
      fstab: FSTAB_BASE,
      home: { 'email_ifeoma.txt': f(t('smb-mount-email-ifeoma')), 'notes-priya.txt': f(t('smb-mount-notes-priya'), { lines: true }) },
      plotterLog: '2029-11-12 06:00:01 plotter: export directory /mnt/plans/exports does not exist, keeping the PDFs in /var/spool/plotter',
    }),
  events: [
    { id: 'listed', condition: (j) => !!j.state.smbListed, message: (j) => j.t('smb-mount-event-listed') },
    { id: 'helper-missing', condition: (j) => said(j, 'helper program'), message: (j) => j.t('smb-mount-event-helper-missing') },
    { id: 'helper', condition: installed, message: (j) => j.t('smb-mount-event-helper') },
    { id: 'smb1', condition: (j) => said(j, 'mount error(112)'), message: (j) => j.t('smb-mount-event-smb1') },
    { id: 'denied', condition: (j) => said(j, 'mount error(13)'), message: (j) => j.t('smb-mount-event-denied') },
    {
      id: 'password-visible',
      condition: (j) => j.last.commands.some((c) => ['mount', 'mount.cifs'].includes(c[0])) && /(^|[,\s])(password|pass)=/.test(j.last.line),
      message: (j) => j.t('smb-mount-event-password-visible'),
    },
    { id: 'mounted', condition: mounted, message: (j) => j.t('smb-mount-event-mounted') },
    { id: 'root-owned', condition: (j) => mounted(j) && !writable(j) && (typed(j, 'ls', 'touch') || j.last.errors.some((e) => e.includes('Permission denied'))), message: (j) => j.t('smb-mount-event-root-owned') },
    {
      id: 'chown',
      condition: (j) => mounted(j) && typed(j, 'chown', 'chmod') && j.last.line.includes(MOUNT) && !writable(j),
      message: (j) => j.t('smb-mount-event-chown'),
    },
    { id: 'writable', condition: (j) => mounted(j) && writable(j), message: (j) => j.t('smb-mount-event-writable') },
    {
      id: 'world-readable',
      condition: (j) => {
        const p = credentialsPath(j) ?? '/root/.smbcredentials';
        const n = j.find(p);
        return n?.type === 'file' && (n.mode ?? 'rw-r--r--').slice(3) !== '------';
      },
      message: (j) => j.t('smb-mount-event-world-readable'),
    },
    { id: 'credentials', condition: credentialsOk, message: (j) => j.t('smb-mount-event-credentials') },
    { id: 'no-nofail', condition: (j) => !!fstabLine(j) && !fstabLine(j)!.options.includes('nofail'), message: (j) => j.t('smb-mount-event-no-nofail') },
    { id: 'fstab-password', condition: (j) => !!fstabLine(j) && option(fstabLine(j)!.options, 'password', 'pass') !== undefined, message: (j) => j.t('smb-mount-event-fstab-password') },
    { id: 'fstab', condition: (j) => fstabOk(j) && credentialsOk(j), message: (j) => j.t('smb-mount-event-fstab') },
    { id: 'end', condition: (j) => mounted(j) && writable(j) && credentialsOk(j) && fstabOk(j), message: (j) => j.t('smb-mount-event-end') },
  ],
};
