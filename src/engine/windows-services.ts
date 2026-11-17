// A Windows machine's services, as the Service Control Manager runs them:
// a service starts under its logon account (LocalSystem, LocalService,
// NetworkService, or a local user with the password the SCM stored when it
// was configured); its dependencies start first; a disabled one doesn't
// start (error 1058). When the account's password has changed since, or the
// account is disabled, the logon fails: error 1069, and the System log gets
// event 7038 (the account and the reason) then 7000 (the service failed to
// start), as on Windows; the Security log a 4625. Starting and stopping
// write 7036 ("entered the running state").
// Sources (Microsoft Learn): "Service Control Manager" events
// (https://learn.microsoft.com/troubleshoot/windows-server/system-management-components/event-id-7000-7011-7009),
// "Service logon accounts" (https://learn.microsoft.com/windows/win32/services/service-user-accounts),
// System Error Codes (https://learn.microsoft.com/windows/win32/debug/system-error-codes--1000-1299-),
// Start-Service (https://learn.microsoft.com/powershell/module/microsoft.powershell.management/start-service?view=powershell-5.1),
// sc.exe config (https://learn.microsoft.com/windows-server/administration/windows-commands/sc-config),
// event 4625 (https://learn.microsoft.com/windows/security/threat-protection/auditing/event-4625).
// Simplifications: no start-pending state (a service starts or fails at
// once), no recovery actions, no service SIDs.

import type { Game } from './shell';
import { logEvent, serial, windows, type WinService } from './windows';
import { findUser, logonError } from './windows-accounts';

/** A Win32 error's text (net helpmsg). */
export const WIN32_ERRORS: Record<number, string> = {
  2: 'The system cannot find the file specified.',
  5: 'Access is denied.',
  1053: 'The service did not respond to the start or control request in a timely fashion.',
  1056: 'An instance of the service is already running.',
  1058: 'The service cannot be started, either because it is disabled or because it has no enabled devices associated with it.',
  1060: 'The specified service does not exist as an installed service.',
  1062: 'The service has not been started.',
  1068: 'The dependency service or group failed to start.',
  1069: 'The service did not start due to a logon failure.',
  1326: 'The user name or password is incorrect.',
  1330: 'The password for this account has expired.',
  1331: 'This user can\'t sign in because this account is currently disabled.',
};

/** The service by name or display name, without case. */
export const findService = (game: Game, name: string) => {
  const low = name.toLowerCase();
  return windows(game).services.find((s) => s.name.toLowerCase() === low) ?? windows(game).services.find((s) => s.display.toLowerCase() === low);
};

/** The built-in accounts a service may run as. */
const BUILT_IN = /^(localsystem|nt authority\\(localservice|local service|networkservice|network service|system))$/i;

/** The local user a service logs on as, if it is one (.\svc_backup, CABINET\svc_backup). */
export function serviceUser(game: Game, s: WinService): string | null {
  const a = s.account ?? 'LocalSystem';
  if (BUILT_IN.test(a)) return null;
  return findUser(game, a)?.name ?? a.replace(/^.*\\/, '');
}

const scm = (game: Game, id: number, level: 'Information' | 'Error' | 'Warning', message: string) => logEvent(game, 'System', { id, level, provider: 'Service Control Manager', message });

/** The services that depend on this one and run. */
export const runningDependents = (game: Game, s: WinService) => windows(game).services.filter((x) => x.status === 'Running' && x.dependsOn?.some((d) => d.toLowerCase() === s.name.toLowerCase()));

/**
 * Starts a service (and its dependencies first). Returns 0, or the Win32
 * error: 1058 disabled, 1069 logon failure, 1068 a dependency failed, or
 * the service's own error (`fails`). The events are written as Windows does.
 */
export function startService(game: Game, s: WinService, seen = new Set<string>()): number {
  if (s.status === 'Running') return 1056;
  if (s.start === 'Disabled') return 1058;
  seen.add(s.name.toLowerCase());
  for (const name of s.dependsOn ?? []) {
    const d = findService(game, name);
    if (!d || seen.has(d.name.toLowerCase()) || d.status === 'Running') continue;
    const code = startService(game, d, seen);
    if (code) {
      scm(game, 7001, 'Error', `The ${s.display} service depends on the ${d.display} service which failed to start because of the following error: \n${WIN32_ERRORS[code] ?? `%%${code}`}`);
      return 1068;
    }
  }
  const user = serviceUser(game, s);
  if (user) {
    const error = logonError(game, user, s.password ?? '');
    if (error) {
      const account = s.account ?? user;
      scm(game, 7038, 'Error', `The ${s.name} service was unable to log on as ${account} with the currently configured password due to the following error: \n${WIN32_ERRORS[error]}\n\nTo ensure that the service is configured properly, use the Services snap-in in Microsoft Management Console (MMC).`);
      scm(game, 7000, 'Error', `The ${s.display} service failed to start due to the following error: \n${WIN32_ERRORS[1069]}`);
      const w = windows(game);
      logEvent(game, 'Security', {
        id: 4625,
        level: 'Information',
        provider: 'Microsoft-Windows-Security-Auditing',
        keywords: 'Audit Failure',
        message: `An account failed to log on.\n\nLogon Type:\t\t\t5\n\nAccount For Which Logon Failed:\n\tAccount Name:\t\t${user}\n\tAccount Domain:\t\t${w.computer}\n\nFailure Information:\n\tFailure Reason:\t\t${error === 1331 ? 'Account currently disabled.' : error === 1330 ? 'The specified account\'s password has expired.' : 'Unknown user name or bad password.'}\n\tStatus:\t\t\t${error === 1331 ? '0xC000006E' : '0xC000006D'}\n\tSub Status:\t\t${error === 1331 ? '0xC0000072' : error === 1330 ? '0xC0000071' : '0xC000006A'}`,
      });
      return 1069;
    }
  }
  if (s.fails) {
    scm(game, s.fails === 1053 ? 7009 : 7000, 'Error', s.fails === 1053 ? `A timeout was reached (30000 milliseconds) while waiting for the ${s.display} service to connect.` : `The ${s.display} service failed to start due to the following error: \n${WIN32_ERRORS[s.fails] ?? `%%${s.fails}`}`);
    if (s.fails === 1053) scm(game, 7000, 'Error', `The ${s.display} service failed to start due to the following error: \n${WIN32_ERRORS[1053]}`);
    return s.fails;
  }
  s.status = 'Running';
  s.exitCode = 0;
  (s as WinService & { pid?: number }).pid = 2000 + serial(game) * 4;
  scm(game, 7036, 'Information', `The ${s.display} service entered the running state.`);
  return 0;
}

/** Stops a service (its running dependents first when forced). 1062 if it wasn't running, 1051 if dependents run. */
export function stopService(game: Game, s: WinService, force = false): number {
  if (s.status !== 'Running') return 1062;
  const deps = runningDependents(game, s);
  if (deps.length && !force) return 1051;
  for (const d of deps) stopService(game, d, true);
  s.status = 'Stopped';
  s.exitCode = 0;
  delete (s as WinService & { pid?: number }).pid;
  scm(game, 7036, 'Information', `The ${s.display} service entered the stopped state.`);
  return 0;
}

/** The process id of a running service (deterministic). */
export function servicePid(game: Game, s: WinService): number | null {
  if (s.status !== 'Running') return null;
  const x = s as WinService & { pid?: number };
  if (x.pid === undefined) {
    let h = 0;
    for (const c of s.name) h = (h * 31 + c.charCodeAt(0)) % 997;
    x.pid = 1000 + h * 4;
  }
  return x.pid;
}
