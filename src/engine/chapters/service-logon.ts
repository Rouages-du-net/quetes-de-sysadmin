// Story "The Music School" — chapter "Locked Out": on Friday, Gabriel
// changed the password of svc_agenda, the Agenda's local account (the
// insurer's audit asks for it every year), and saved it in the password
// manager. The service kept running on its logon session until Sunday's
// update restart; at boot the Service Control Manager tried the password
// it had stored, the old one: the Agenda is stopped.
//   - Get-Service Agenda: Stopped (StartType Automatic);
//   - Start-Service Agenda: "cannot be started due to the following
//     error"; sc.exe start: FAILED 1069 (logon failure);
//   - Get-WinEvent -FilterHashtable @{LogName='System'; Id=7000,7038} (or
//     Get-EventLog System -EntryType Error): 7038 "unable to log on as
//     .\svc_agenda with the currently configured password", 7000;
//   - Get-CimInstance Win32_Service -Filter "Name='Agenda'" | Select-Object
//     Name, StartName, State, or sc.exe qc Agenda: the account;
//     Get-LocalUser svc_agenda | Select-Object Name, PasswordLastSet:
//     Friday;
//   - the new password: the password manager's entry Mariam exported
//     (Documents\vault-svc_agenda.txt), never guessed;
//   - sc.exe config Agenda obj= .\svc_agenda password= … (in PowerShell,
//     "sc" is Set-Content: sc.exe), Start-Service Agenda.
// Objective checked on the state: the Agenda runs, under svc_agenda, with
// the account's current password stored, StartType Automatic, and
// svc_agenda isn't an administrator.
// False leads: LocalSystem (it starts, but the booking app would have every
// right on the server), resetting svc_agenda's password again without
// telling the service, disabling the service or setting it to Manual.
// Sources: https://learn.microsoft.com/windows/win32/services/service-user-accounts,
// https://learn.microsoft.com/windows-server/administration/windows-commands/sc-config,
// https://learn.microsoft.com/troubleshoot/windows-server/system-management-components/event-id-7000-7011-7009,
// https://learn.microsoft.com/powershell/module/microsoft.powershell.diagnostics/get-winevent?view=powershell-5.1

import { name, type Chapter } from '../world';
import type { Game } from '../shell';
import { logEvent, windows, type WinService } from '../windows';
import { findService, serviceUser, startService } from '../windows-services';
import { token } from '../windows-acl';
import { AGENDA_PASSWORD, HOME, quietEvents, ran, rebootEvents, said, stave } from './music-school';

// Monday 10 December 2029, 8:50.
export const NOW = Date.UTC(2029, 11, 10, 8, 50, 0);
// Gabriel changed the password on Friday 7 December at 16:42.
const ROTATED = Date.UTC(2029, 11, 7, 16, 42, 0);
// Windows Update restarted the server on Sunday 9 December at 3:02.
const REBOOT = Date.UTC(2029, 11, 9, 3, 2, 0);
const BOOT = REBOOT + 95_000;
// The new password, in the password manager (a Windows password: not translated).
export const NEW_PASSWORD = 'Rondo-7kq-Vt29';

const machine = stave({
  clock: NOW,
  agendaPassword: NEW_PASSWORD,
  agendaStored: AGENDA_PASSWORD,
  agendaPasswordAge: (NOW - ROTATED) / 86_400_000,
  agendaStatus: 'Stopped',
  teachersShare: 'fixed',
  events: quietEvents(REBOOT),
  home: (t) => ({
    'email_mariam.txt': { type: 'file', content: t('service-logon-email-mariam').replace(/\n/g, '\r\n'), lines: true, mtime: NOW - 25 * 60_000 },
    Documents: {
      type: 'directory',
      children: { 'vault-svc_agenda.txt': { type: 'file', content: t('service-logon-vault', { password: NEW_PASSWORD }).replace(/\n/g, '\r\n'), lines: true, mtime: NOW - 20 * 60_000 } },
    },
  }),
});

const agenda = (j: Game): WinService => findService(j, 'Agenda')!;
const runsAs = (j: Game) => serviceUser(j, agenda(j));
const ownAccount = (j: Game) => runsAs(j)?.toLowerCase() === 'svc_agenda';
const passwordMatches = (j: Game) => ownAccount(j) && agenda(j).password === windows(j).passwords.svc_agenda;
const adminAccount = (j: Game) => token(j, 'svc_agenda').has('BUILTIN\\Administrators');
const vault = (j: Game) => j.find(`/C/Users/${j.player}/Documents/${name(j.t, 'vault-svc_agenda.txt')}`);

export const COMMANDS_SERVICE_LOGON = [
  'Get-Service', 'Start-Service', 'Restart-Service', 'Set-Service', 'Get-WinEvent', 'Get-EventLog', 'Get-CimInstance', 'Select-Object', 'Get-LocalUser',
  'sc.exe', 'net', 'Get-Content', 'Remove-Item', 'Get-Help',
];

export const serviceLogon: Chapter = {
  id: 'service-logon',
  number: 2,
  commands: COMMANDS_SERVICE_LOGON,
  home: HOME,
  welcome: 'email_mariam.txt',
  names: true,
  final: 'end',
  steps: ['stopped', 'start-failed', 'events', 'account', 'configured', 'end'],
  accounts: machine.accounts,
  state: machine.state,
  createWorld: machine.createWorld,
  initialise: (j) => {
    // Sunday's restart: the System log up to the boot, then the Agenda's
    // logon failure at boot (7038, 7000, and 4625 in Security), then the
    // quiet hours until now.
    const w = windows(j);
    for (const e of rebootEvents(j.t, REBOOT)) logEvent(j, 'System', e);
    w.boot = BOOT;
    w.clock = BOOT + 40_000;
    startService(j, agenda(j));
    w.clock = NOW;
    for (const e of quietEvents(NOW).filter((x) => x.time > BOOT + 40_000)) logEvent(j, 'System', e);
    j.state.agendaStored = agenda(j).password;
  },
  events: [
    {
      id: 'stopped',
      condition: (j) => (ran(j, 'Get-Service') && said(j, /Stopped +Agenda/)) || (ran(j, 'sc', 'sc.exe') && /agenda/i.test(j.last.line) && said(j, 'STOPPED')),
      message: (j) => j.t('service-logon-event-stopped'),
    },
    { id: 'start-failed', condition: (j) => said(j, /Agenda.*cannot be started|FAILED 1069|System error 1069/), message: (j) => j.t('service-logon-event-start-failed') },
    { id: 'events', condition: (j) => said(j, 'was unable to log on as .\\svc_agenda'), message: (j) => j.t('service-logon-event-events') },
    {
      id: 'account',
      condition: (j) => ran(j, 'Get-CimInstance', 'Get-WmiObject', 'sc', 'sc.exe') && said(j, /\.\\svc_agenda/) && (said(j, 'StartName') || said(j, 'SERVICE_START_NAME')),
      message: (j) => j.t('service-logon-event-account'),
    },
    {
      id: 'rotated',
      condition: (j) => ran(j, 'Get-LocalUser', 'net') && /svc_agenda/i.test(j.last.line) && said(j, /PasswordLastSet|Password last set/),
      message: (j) => j.t('service-logon-event-rotated'),
    },
    { id: 'sc-alias', condition: (j) => said(j, "A positional parameter cannot be found that accepts argument '"), message: (j) => j.t('service-logon-event-sc-alias') },
    { id: 'local-system', condition: (j) => runsAs(j) === null, message: (j) => j.t('service-logon-event-local-system') },
    { id: 'reset', condition: (j) => windows(j).passwords.svc_agenda !== NEW_PASSWORD, message: (j) => j.t('service-logon-event-reset') },
    {
      id: 'wrong-password',
      condition: (j) => ownAccount(j) && agenda(j).password !== j.state.agendaStored && !passwordMatches(j),
      message: (j) => j.t('service-logon-event-wrong-password'),
    },
    { id: 'start-type', condition: (j) => agenda(j).start !== 'Automatic', message: (j) => j.t('service-logon-event-start-type') },
    { id: 'admin', condition: adminAccount, message: (j) => j.t('service-logon-event-admin') },
    { id: 'configured', condition: passwordMatches, message: (j) => j.t('service-logon-event-configured') },
    { id: 'vault-deleted', condition: (j) => !vault(j), message: (j) => j.t('service-logon-event-vault-deleted') },
    {
      id: 'end',
      condition: (j) => agenda(j).status === 'Running' && passwordMatches(j) && agenda(j).start === 'Automatic' && !adminAccount(j),
      message: (j) => j.t('service-logon-event-end'),
    },
  ],
};
