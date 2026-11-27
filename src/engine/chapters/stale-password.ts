// Story "The Card Catalogue" — chapter "The Stale Password": Rafael, the
// archivist, finds his account locked every morning since Monday, when
// Windows made him change his expired password. Nandini unlocked him twice;
// it locks again within the hour.
//   - Search-ADAccount -LockedOut: rsilva; Get-ADUser rsilva -Properties
//     LockedOut, BadLogonCount, LastBadPasswordAttempt, PasswordLastSet:
//     wrong passwords every few minutes since Monday, right after the change;
//   - on register, the domain controller (the PDC emulator):
//     Get-WinEvent -FilterHashtable @{LogName='Security'; Id=4740}: "Caller
//     Computer Name: STACKS", the file server, not Rafael's PC;
//   - ssh stacks (Windows' OpenSSH client, from register): Get-WinEvent
//     Security 4625 (Logon Type 4: a batch logon, a scheduled task),
//     Get-ScheduledTask | Select-Object TaskName, @{…Principal.UserId…},
//     Get-ScheduledTaskInfo 'Scan Import' (LastTaskResult 0x8007052E or
//     0x80070775), schtasks /query /v: the scan import, set up by Tomas in
//     September under Rafael's own account, every 5 minutes, with the
//     password the Task Scheduler stored then;
//   - the fix: the task under its own service account, svc_scans, created
//     for that in December (its password in the vault Nandini exported):
//     Set-ScheduledTask 'Scan Import' -User 'LENDING\svc_scans' -Password …
//     (or schtasks /change /tn "Scan Import" /ru LENDING\svc_scans /rp …);
//   - Unlock-ADAccount rsilva.
// Time: unlocking lets half an hour pass (the task keeps running, every 5
// minutes, on stacks): while the stale password is stored, it locks again.
// Objective checked on the state: rsilva isn't locked out half an hour
// after the unlock; no task on stacks holds a wrong password for rsilva;
// the scan import runs (Ready) under a service account (OU=Service
// Accounts) whose stored password works, who can write Archives and isn't an
// administrator;
// the domain's lockout policy is unchanged (5 attempts, 30 minutes).
// False leads: only unlocking (it locks again), raising the threshold or
// disabling the lockout, resetting Rafael's password (it doesn't unlock,
// and the task still has the older one), the task as SYSTEM, under
// another person's account or the player's, under svc_backup (read-only on
// Archives), or simply disabled (the scans stop arriving).
// Sources: https://learn.microsoft.com/troubleshoot/windows-server/windows-security/account-lockout-event-id-4740,
// https://learn.microsoft.com/windows/security/threat-protection/auditing/event-4740,
// https://learn.microsoft.com/windows/security/threat-protection/auditing/event-4625,
// https://learn.microsoft.com/powershell/module/activedirectory/search-adaccount,
// https://learn.microsoft.com/powershell/module/activedirectory/unlock-adaccount,
// https://learn.microsoft.com/powershell/module/scheduledtasks/set-scheduledtask

import { name, type Chapter } from '../world';
import type { Game, Shell } from '../shell';
import { windows } from '../windows';
import { allGroups, findAccount, lockedOut, type AdObject } from '../windows-ad';
import { tasks, type WinTask } from '../windows-tasks';
import { cmdletNamed } from '../commands/powershell';
import { BACKUP_PASSWORD, HOME, RAFAEL_NEW, SCANS_PASSWORD, ad, now, object, ou, passMinutes, ran, register, said, stacks, stacksHost, stacksName } from './card-catalogue';

// Wednesday 9 January 2030, 9:05.
export const NOW = Date.UTC(2030, 0, 9, 9, 5, 0);
// Rafael changed his expired password on Monday at 8:52.
export const CHANGED = Date.UTC(2030, 0, 7, 8, 52, 0);
const MIN = 60_000;
const DAY = 86_400_000;
// The lockout policy as the network has it: 5 attempts, 30 minutes.
const POLICY = { threshold: 5, duration: 30, window: 30 };

const text = (content: string, mtime: number) => ({ type: 'file' as const, content: content.replace(/\n/g, '\r\n'), lines: true, mtime });

const options = { clock: NOW, arrivals: true, rafaelChanged: (NOW - CHANGED) / DAY };
const machine = register({
  ...options,
  home: (t) => ({
    'email_nandini.txt': text(t('stale-password-email-nandini'), NOW - 15 * MIN),
    Documents: { type: 'directory', children: { 'vault-service-accounts.txt': text(t('stale-password-vault', { scans: SCANS_PASSWORD, backup: BACKUP_PASSWORD }), NOW - 10 * MIN) } },
  }),
});

const rafael = (j: Game) => object(j, 'rsilva')!;
const locked = (j: Game) => lockedOut(ad(j), rafael(j), now(j));

/** The domain account a task of stacks runs as (null: SYSTEM, a local account, or one the domain doesn't know). */
const taskAccount = (j: Game, t: WinTask): AdObject | null => {
  if (/^(nt authority\\)?system$/i.test(t.user)) return null;
  const o = findAccount(ad(j), t.user);
  return o && o.cls === 'user' ? o : null;
};
const isImport = (t: WinTask) => t.actions.some((a) => /scan-import/i.test(`${a.execute} ${a.arguments ?? ''}`));
const imports = (j: Game) => tasks(stacks(j)).filter(isImport);
/** A task that would still log on as Rafael with a password he no longer has. */
const stale = (j: Game) => tasks(stacks(j)).some((t) => t.state !== 'Disabled' && taskAccount(j, t) === rafael(j) && t.logon === 'Password' && t.password !== ad(j).passwords[rafael(j).guid]);
const ADMIN_GROUPS = ['domain admins', 'enterprise admins', 'administrators', 'account operators', 'server operators', 'backup operators'];
const isAdmin = (j: Game, o: AdObject) => allGroups(ad(j), o).some((g) => ADMIN_GROUPS.includes(g.name.toLowerCase()));
/** A service account of the domain, its stored password right, enabled, not an administrator. */
const serviceAccount = (j: Game, t: WinTask) => {
  const o = taskAccount(j, t);
  return !!o && o.dn.toLowerCase().endsWith(`,${ou('Service Accounts').toLowerCase()}`) && !!o.enabled && t.logon === 'Password' && t.password === ad(j).passwords[o.guid] && !isAdmin(j, o);
};
/** The import moves scans into Archives: its account must be able to write there. */
const writesArchives = (j: Game, t: WinTask) => allGroups(ad(j), taskAccount(j, t)!).some((g) => g.name.toLowerCase() === 'dl_archives_rw');
const importRuns = (j: Game) => imports(j).some((t) => t.state === 'Ready' && serviceAccount(j, t) && writesArchives(j, t));
const fixed = (j: Game) => !stale(j) && importRuns(j);
const policyKept = (j: Game) => {
  const p = ad(j).policy;
  return p.threshold === POLICY.threshold && p.duration >= POLICY.duration && p.window >= POLICY.window;
};

/** What was last typed on stacks (if you went there), and its output. */
const onStacks = (j: Game): Shell | null => {
  const s = stacks(j);
  return s.typedCommands > 0 ? s : null;
};
const stacksSaid = (j: Game, x: string | RegExp) => {
  const s = onStacks(j);
  return !!s && [s.last.output, ...s.last.errors].some((o) => (typeof x === 'string' ? o.includes(x) : x.test(o)));
};
const stacksRan = (j: Game, ...names: string[]) => {
  const s = onStacks(j);
  const low = names.map((n) => n.toLowerCase());
  return !!s && s.last.commands.some((c) => low.includes((cmdletNamed(c[0] ?? '')?.name ?? c[0] ?? '').toLowerCase().replace(/\.exe$/, '')));
};

export const COMMANDS_STALE_PASSWORD = [
  'Search-ADAccount', 'Get-ADUser', 'Unlock-ADAccount', 'Get-ADDefaultDomainPasswordPolicy', 'Get-WinEvent', 'Format-List', 'ssh', 'Get-ScheduledTask',
  'Get-ScheduledTaskInfo', 'Set-ScheduledTask', 'schtasks', 'Select-Object', 'Get-Content', 'exit', 'Get-Help',
];

export const stalePassword: Chapter = {
  id: 'stale-password',
  number: 2,
  commands: COMMANDS_STALE_PASSWORD,
  home: HOME,
  welcome: 'email_nandini.txt',
  names: true,
  final: 'end',
  steps: ['locked', 'bad-logons', 'caller', 'on-stacks', 'task', 'fixed', 'end'],
  accounts: machine.accounts,
  state: machine.state,
  createWorld: machine.createWorld,
  hosts: { stacks: stacksHost(options) },
  initialise: (j) => {
    // Since Monday's change, the scan import has tried Rafael's old password every 5 minutes:
    // locked out at the fifth try, again each time the lockout ends.
    const s = stacks(j);
    windows(j).clock = CHANGED;
    windows(s).clock = CHANGED;
    passMinutes(j, NOW);
    j.state.rafaelLocked = locked(j);
  },
  // An unlock: half an hour passes (Rafael gets back to work, the task keeps running on stacks).
  afterCommand: (j) => {
    const was = j.state.rafaelLocked as boolean;
    if (was && !locked(j)) {
      passMinutes(j, now(j) + 30 * MIN);
      j.state.rafaelLocked = locked(j);
      return j.t(locked(j) ? 'stale-password-relocked' : 'stale-password-holds');
    }
    j.state.rafaelLocked = locked(j);
  },
  events: [
    {
      id: 'locked',
      condition: (j) => (ran(j, 'Search-ADAccount') && said(j, 'rsilva')) || (ran(j, 'Get-ADUser', 'net') && /rsilva/i.test(j.last.line) && said(j, /LockedOut\s*:\s*True|Account active\s+Locked/)),
      message: (j) => j.t('stale-password-event-locked'),
    },
    {
      id: 'bad-logons',
      condition: (j) => ran(j, 'Get-ADUser') && /rsilva/i.test(j.last.line) && (said(j, /LastBadPasswordAttempt|BadLogonCount/) || /LastBadPasswordAttempt|BadLogonCount|\*/i.test(j.last.line)) && j.last.errors.length === 0,
      message: (j) => j.t('stale-password-event-bad-logons'),
    },
    {
      id: 'caller',
      condition: (j) => ran(j, 'Get-WinEvent', 'Get-EventLog', 'wevtutil') && said(j, 'Caller Computer Name:') && said(j, stacksName(j.t)),
      message: (j) => j.t('stale-password-event-caller'),
    },
    { id: 'on-stacks', condition: (j) => !!onStacks(j), message: (j) => j.t('stale-password-event-on-stacks') },
    {
      id: 'logon-type',
      condition: (j) => stacksRan(j, 'Get-WinEvent', 'Get-EventLog', 'wevtutil') && stacksSaid(j, /Logon Type:\s+4/) && stacksSaid(j, 'rsilva'),
      message: (j) => j.t('stale-password-event-logon-type'),
    },
    {
      id: 'task',
      condition: (j) =>
        (stacksRan(j, 'Get-ScheduledTask', 'schtasks') && stacksSaid(j, /rsilva/i) && stacksSaid(j, 'Scan Import')) ||
        (stacksRan(j, 'Get-ScheduledTaskInfo', 'schtasks') && stacksSaid(j, /2147943726|2147944309|-2147023570|-2147022987/)),
      message: (j) => j.t('stale-password-event-task'),
    },
    { id: 'policy', condition: (j) => !policyKept(j), message: (j) => j.t('stale-password-event-policy') },
    { id: 'reset', condition: (j) => ad(j).passwords[rafael(j).guid] !== RAFAEL_NEW, message: (j) => j.t('stale-password-event-reset') },
    { id: 'system', condition: (j) => imports(j).some((t) => t.state === 'Ready' && /^(nt authority\\)?system$/i.test(t.user)), message: (j) => j.t('stale-password-event-system') },
    {
      id: 'person',
      condition: (j) => imports(j).some((t) => t.state === 'Ready' && !!taskAccount(j, t) && taskAccount(j, t) !== rafael(j) && !serviceAccount(j, t)),
      message: (j) => j.t('stale-password-event-person'),
    },
    {
      id: 'read-only',
      condition: (j) => imports(j).some((t) => t.state === 'Ready' && serviceAccount(j, t) && !writesArchives(j, t)),
      message: (j) => j.t('stale-password-event-read-only'),
    },
    { id: 'task-off', condition: (j) => !imports(j).some((t) => t.state === 'Ready'), message: (j) => j.t('stale-password-event-task-off') },
    { id: 'fixed', condition: fixed, message: (j) => j.t(locked(j) ? 'stale-password-event-fixed' : 'stale-password-event-fixed-unlocked') },
    { id: 'vault-deleted', condition: (j) => !j.find(`/C/Users/${j.player}/Documents/${name(j.t, 'vault-service-accounts.txt')}`), message: (j) => j.t('stale-password-event-vault-deleted') },
    { id: 'end', condition: (j) => fixed(j) && !locked(j) && !j.state.rafaelLocked && policyKept(j), message: (j) => j.t('stale-password-event-end') },
  ],
};
