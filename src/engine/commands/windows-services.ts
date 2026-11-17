// Services and processes from PowerShell and cmd: Get-Service, Start-Service,
// Stop-Service, Restart-Service, Set-Service (5.1 has no -Credential: the
// logon account is changed with sc.exe config obj= password=, or seen with
// Get-CimInstance Win32_Service), Get-CimInstance/Get-WmiObject for a few
// classes (Win32_Service, Win32_OperatingSystem, Win32_LogicalDisk,
// Win32_ComputerSystem), Get-Process and Stop-Process; sc.exe (query, qc,
// start, stop, config) and net start / net stop. Note that in PowerShell
// "sc" is an alias of Set-Content: sc.exe must be typed with its extension.
// Sources (Microsoft Learn): Get-Service, Start-Service, Stop-Service,
// Restart-Service, Set-Service, Get-Process, Stop-Process
// (https://learn.microsoft.com/powershell/module/microsoft.powershell.management/?view=powershell-5.1),
// Get-CimInstance (https://learn.microsoft.com/powershell/module/cimcmdlets/get-ciminstance?view=powershell-5.1),
// Win32_Service (https://learn.microsoft.com/windows/win32/cimwin32prov/win32-service),
// sc.exe query, qc, config, start, stop
// (https://learn.microsoft.com/windows-server/administration/windows-commands/sc-config),
// net start / net stop (https://learn.microsoft.com/previous-versions/windows/it-pro/windows-server-2012-r2-and-2012/hh875576(v=ws.11)).
// Differences (docs/SCENARIOS.md): services start or stop at once (no
// pending states, no "Waiting for service" warnings), a fixed list of
// system processes, CIM's -Filter reads one or more Name='x' / State='y'
// comparisons joined by AND/OR.

import type { Shell } from '../shell';
import { volumeUsed, windows, type WinService } from '../windows';
import { WIN32_ERRORS, findService, runningDependents, servicePid, startService, stopService } from '../windows-services';
import { PSDate, arr, isObject, str, text, values, wildcard, type Cmdlet, type Native, type PSObject, type Run, type View } from '../powershell';
import { netAccountsPart } from './windows-accounts';

const MGMT = 'Microsoft.PowerShell.Management';
const fq = (c: string, id: string) => `${id},Microsoft.PowerShell.Commands.${c}Command`;

function serviceObject(game: Shell, s: WinService): PSObject {
  return {
    type: 'ServiceController',
    fullType: 'System.ServiceProcess.ServiceController',
    text: 'System.ServiceProcess.ServiceController',
    data: s,
    props: {
      Status: s.status,
      Name: s.name,
      DisplayName: s.display,
      StartType: s.start,
      ServiceName: s.name,
      DependentServices: windows(game).services.filter((x) => x.dependsOn?.some((d) => d.toLowerCase() === s.name.toLowerCase())).map((x) => x.name),
      ServicesDependedOn: s.dependsOn ?? [],
      CanPauseAndContinue: false,
      CanShutdown: s.status === 'Running',
      CanStop: s.status === 'Running',
      ServiceType: s.process ? 'Win32OwnProcess' : 'Win32ShareProcess',
      MachineName: '.',
    },
  };
}

/** The services named by -Name/-DisplayName (wildcards), -InputObject or the pipeline. */
function named(r: Run, cmdlet: string, all = false): WinService[] {
  const services = [...windows(r.game).services].sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
  const fromInput = [...(r.input ?? []), ...values(r.p.InputObject)].map((x) => (isObject(x) && x.data ? (x.data as WinService).name : isObject(x) ? text(x.props.Name) : text(x)));
  const names = [...arr(r.p.Name), ...fromInput];
  const displays = arr(r.p.DisplayName);
  if (!names.length && !displays.length) return all ? services : [];
  const out: WinService[] = [];
  for (const n of names) {
    const found = services.filter((s) => wildcard(n).test(s.name) || (cmdlet === 'GetService' && wildcard(n).test(s.display)));
    if (!found.length && !/[*?]/.test(n))
      r.fail({ message: `Cannot find any service with service name '${n}'.`, category: 'ObjectNotFound', target: `${n}:String`, exception: 'ServiceCommandException', id: fq(cmdlet, 'NoServiceFoundForGivenName') });
    out.push(...found.filter((s) => !out.includes(s)));
  }
  for (const n of displays) {
    const found = services.filter((s) => wildcard(n).test(s.display));
    if (!found.length && !/[*?]/.test(n))
      r.fail({ message: `Cannot find any service with display name '${n}'.`, category: 'ObjectNotFound', target: `${n}:String`, exception: 'ServiceCommandException', id: fq(cmdlet, 'NoServiceFoundForGivenDisplayName') });
    out.push(...found.filter((s) => !out.includes(s)));
  }
  return out;
}

function getService(r: Run): unknown[] {
  const list = named(r, 'GetService', true);
  if (r.p.DependentServices) return list.flatMap((s) => windows(r.game).services.filter((x) => x.dependsOn?.some((d) => d.toLowerCase() === s.name.toLowerCase()))).map((s) => serviceObject(r.game, s));
  if (r.p.RequiredServices) return list.flatMap((s) => (s.dependsOn ?? []).map((d) => findService(r.game, d)).filter((x): x is WinService => !!x)).map((s) => serviceObject(r.game, s));
  return list.map((s) => serviceObject(r.game, s));
}

const label = (s: WinService) => `${s.display} (${s.name})`;

function start(r: Run, s: WinService, cmdlet: string): boolean {
  const code = startService(r.game, s);
  if (code === 0 || code === 1056) return true;
  r.fail({
    message: `Service '${label(s)}' cannot be started due to the following error: Cannot start service ${s.name} on computer '.'.`,
    category: 'OpenError',
    target: 'System.ServiceProcess.ServiceController:ServiceController',
    exception: 'ServiceCommandException',
    id: fq(cmdlet, 'CouldNotStartService'),
  });
  return false;
}

function stop(r: Run, s: WinService, cmdlet: string): boolean {
  if (s.status !== 'Running') return true;
  const deps = runningDependents(r.game, s);
  if (deps.length && !r.p.Force) {
    r.fail({
      message: `Cannot stop service '${label(s)}' because it has dependent services. It can only be stopped if the Force flag is set.`,
      category: 'InvalidOperation',
      target: 'System.ServiceProcess.ServiceController:ServiceController',
      exception: 'ServiceCommandException',
      id: fq(cmdlet, 'ServiceHasDependentServices'),
    });
    return false;
  }
  stopService(r.game, s, true);
  return true;
}

function startStop(r: Run, action: 'start' | 'stop' | 'restart'): unknown[] {
  const cmdlet = { start: 'StartService', stop: 'StopService', restart: 'RestartService' }[action];
  const out: unknown[] = [];
  for (const s of named(r, cmdlet)) {
    if (!r.should(`${action === 'start' ? 'Start-Service' : action === 'stop' ? 'Stop-Service' : 'Restart-Service'}`, label(s))) continue;
    if (action === 'stop') stop(r, s, cmdlet);
    else if (action === 'start') start(r, s, cmdlet);
    else if (stop(r, s, cmdlet)) start(r, s, cmdlet);
    if (r.p.PassThru) out.push(serviceObject(r.game, s));
  }
  return out;
}

function setService(r: Run): unknown[] {
  const out: unknown[] = [];
  for (const s of named(r, 'SetService')) {
    if (!r.should('Set-Service', label(s))) continue;
    if (r.p.StartupType !== undefined) {
      const t = str(r.p.StartupType).toLowerCase();
      const map: Record<string, WinService['start']> = { automatic: 'Automatic', manual: 'Manual', disabled: 'Disabled' };
      if (!map[t]) {
        r.fail({ message: `Cannot bind parameter 'StartupType'. Cannot convert value "${str(r.p.StartupType)}" to type "System.ServiceProcess.ServiceStartMode". Error: "Unable to match the identifier name ${str(r.p.StartupType)} to a valid enumerator name. Specify one of the following enumerator names and try again:\nBoot, System, Automatic, Manual, Disabled"`, category: 'InvalidArgument', target: ':', exception: 'ParameterBindingException', id: fq('SetService', 'CannotConvertArgumentNoMessage') });
        continue;
      }
      s.start = map[t];
    }
    if (r.p.DisplayName !== undefined) s.display = str(r.p.DisplayName);
    if (r.p.Description !== undefined) s.description = str(r.p.Description);
    if (r.p.Status !== undefined) {
      const st = str(r.p.Status).toLowerCase();
      if (st === 'running') start(r, s, 'SetService');
      else if (st === 'stopped') stop(r, s, 'SetService');
    }
    if (r.p.PassThru) out.push(serviceObject(r.game, s));
  }
  return out;
}

// ——— CIM ———

/** WQL's simple filters: Name='x' AND State="Running" OR … */
function wqlMatch(o: PSObject, filter: string): boolean {
  if (!filter.trim()) return true;
  return filter.split(/\s+or\s+/i).some((alt) =>
    alt.split(/\s+and\s+/i).every((cond) => {
      const m = /^\s*(\w+)\s*(=|<>|!=|like)\s*['"]?(.*?)['"]?\s*$/i.exec(cond);
      if (!m) return false;
      const v = text(o.props[Object.keys(o.props).find((k) => k.toLowerCase() === m[1].toLowerCase()) ?? m[1]] ?? '');
      if (m[2].toLowerCase() === 'like') return new RegExp(`^${m[3].replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.')}$`, 'i').test(v);
      const eq = v.toLowerCase() === m[3].toLowerCase();
      return m[2] === '=' ? eq : !eq;
    }),
  );
}

const START_MODE: Record<WinService['start'], string> = { Automatic: 'Auto', Manual: 'Manual', Disabled: 'Disabled' };

function cimClass(game: Shell, cls: string): PSObject[] | null {
  const w = windows(game);
  switch (cls.toLowerCase()) {
    case 'win32_service':
      return w.services.map((s) => ({
        type: 'Win32_Service',
        fullType: 'Microsoft.Management.Infrastructure.CimInstance#root/cimv2/Win32_Service',
        props: { ProcessId: servicePid(game, s) ?? 0, Name: s.name, StartMode: START_MODE[s.start], State: s.status, Status: 'OK', ExitCode: s.exitCode ?? (s.status === 'Running' ? 0 : 1077), DisplayName: s.display, Description: s.description ?? '', PathName: s.path ?? 'C:\\Windows\\system32\\svchost.exe -k netsvcs -p', StartName: s.account ?? 'LocalSystem', Started: s.status === 'Running', ServiceType: s.process ? 'Own Process' : 'Share Process' },
      }));
    case 'win32_operatingsystem':
      return [{ type: 'Win32_OperatingSystem', props: { SystemDirectory: 'C:\\Windows\\system32', Organization: '', BuildNumber: '20348', RegisteredUser: 'Windows User', SerialNumber: '00454-60000-00001-AA000', Version: '10.0.20348', Caption: 'Microsoft Windows Server 2022 Standard', LastBootUpTime: new PSDate(w.boot ?? w.clock - 6 * 86_400_000), CSName: w.computer, OSArchitecture: '64-bit' } }];
    case 'win32_logicaldisk':
      return w.volumes.map((v) => ({ type: 'Win32_LogicalDisk', props: { DeviceID: `${v.letter}:`, DriveType: 3, ProviderName: '', FreeSpace: v.size - volumeUsed(game, v.letter), Size: v.size, VolumeName: v.label } }));
    case 'win32_computersystem':
      return [{ type: 'Win32_ComputerSystem', props: { Name: w.computer, PrimaryOwnerName: 'Windows User', Domain: 'WORKGROUP', TotalPhysicalMemory: 8 * 1024 ** 3, Model: 'Virtual Machine', Manufacturer: 'Microsoft Corporation' } }];
  }
  return null;
}

function getCim(r: Run, cmdlet: string): unknown[] {
  const cls = str(r.p.ClassName);
  if (r.p.Query !== undefined) {
    const m = /^\s*select\s+.+?\s+from\s+(\w+)(?:\s+where\s+(.+))?$/i.exec(str(r.p.Query));
    if (!m) {
      r.fail({ message: 'Invalid query ', category: 'InvalidArgument', target: ':', exception: 'CimException', id: `HRESULT 0x80041017,Microsoft.Management.Infrastructure.CimCmdlets.${cmdlet}Command` });
      return [];
    }
    return (cimClass(r.game, m[1]) ?? []).filter((o) => wqlMatch(o, m[2] ?? ''));
  }
  const all = cimClass(r.game, cls);
  if (!all) {
    r.fail({ message: 'Invalid class ', category: 'MetadataError', target: `root\\cimv2:${cls}:String`, exception: 'CimException', id: `HRESULT 0x80041010,Microsoft.Management.Infrastructure.CimCmdlets.${cmdlet}Command` });
    return [];
  }
  const out = all.filter((o) => wqlMatch(o, str(r.p.Filter)));
  const props = arr(r.p.Property);
  return props.length ? out.map((o) => ({ ...o, props: Object.fromEntries(Object.entries(o.props).filter(([k]) => props.some((p) => p.toLowerCase() === k.toLowerCase()))) })) : out;
}

// ——— Processes ———

const BASE_PROCESSES: [string, number, number, number][] = [
  ['Idle', 0, 0, 8],
  ['System', 4, 412.5, 144],
  ['Registry', 92, 2.4, 74_208],
  ['smss', 324, 0.11, 1_204],
  ['csrss', 416, 1.88, 5_612],
  ['wininit', 504, 0.09, 6_880],
  ['services', 640, 3.2, 9_324],
  ['lsass', 652, 4.6, 18_440],
  ['svchost', 768, 6.1, 27_120],
  ['svchost', 820, 2.9, 14_736],
  ['svchost', 1044, 9.4, 41_892],
  ['powershell', 4310, 1.2, 78_352],
];

function processes(game: Shell): PSObject[] {
  const w = windows(game);
  const own = w.services.filter((s) => s.status === 'Running' && s.process).map((s) => [s.process!.replace(/\.exe$/i, ''), servicePid(game, s)!, 0.6, 22_400] as [string, number, number, number]);
  return [...BASE_PROCESSES, ...own]
    .sort((a, b) => a[0].toLowerCase().localeCompare(b[0].toLowerCase()) || a[1] - b[1])
    .map(([name, id, cpu, ws]) => ({
      type: 'Process',
      fullType: 'System.Diagnostics.Process',
      text: `System.Diagnostics.Process (${name})`,
      props: { Handles: 200 + (id % 700), NPM: 12 + (id % 30), PM: Math.round(ws * 0.6), WS: ws * 1024, CPU: cpu, Id: id, SI: id < 400 ? 0 : 0, ProcessName: name, Name: name, Path: name === 'System' || name === 'Idle' || name === 'Registry' ? null : `C:\\Windows\\system32\\${name}.exe` },
    }));
}

function getProcess(r: Run): unknown[] {
  const all = processes(r.game);
  const names = arr(r.p.Name);
  const ids = values(r.p.Id).map(Number);
  if (!names.length && !ids.length) return all;
  const out: unknown[] = [];
  for (const n of names) {
    const found = all.filter((p) => wildcard(n).test(String(p.props.Name)));
    if (!found.length && !/[*?]/.test(n)) r.fail({ message: `Cannot find a process with the name "${n}". Verify the process name and call the cmdlet again.`, category: 'ObjectNotFound', target: `${n}:String`, exception: 'ProcessCommandException', id: fq('GetProcess', 'NoProcessFoundForGivenName') });
    out.push(...found);
  }
  for (const id of ids) {
    const found = all.find((p) => p.props.Id === id);
    if (!found) r.fail({ message: `Cannot find a process with the process identifier ${id}.`, category: 'ObjectNotFound', target: `${id}:Int32`, exception: 'ProcessCommandException', id: fq('GetProcess', 'NoProcessFoundForGivenId') });
    else out.push(found);
  }
  return out;
}

function stopProcess(r: Run): unknown[] {
  const targets = [...getProcess({ ...r, p: { Name: r.p.Name, Id: r.p.Id } }), ...(r.input ?? [])].filter(isObject);
  for (const p of targets) {
    const name = String(p.props.Name);
    if (!r.should('Stop-Process', `${name} (${p.props.Id})`)) continue;
    const s = windows(r.game).services.find((x) => x.process && x.process.replace(/\.exe$/i, '').toLowerCase() === name.toLowerCase());
    if (s) {
      stopService(r.game, s, true);
      continue;
    }
    r.fail({ message: `Cannot stop process "${name} (${p.props.Id})" because of the following error: Access is denied`, category: 'CloseError', target: `System.Diagnostics.Process (${name}):Process`, exception: 'ProcessCommandException', id: fq('StopProcess', 'CouldNotStopProcess') });
  }
  return [];
}

const SVC_NAME = { name: 'Name', list: true, aliases: ['ServiceName'] };
const SVC_INPUT = { name: 'InputObject', list: true, type: 'System.ServiceProcess.ServiceController[]' };

export const SERVICE_CMDLETS: Cmdlet[] = [
  { name: 'Get-Service', module: MGMT, version: '3.1.0.0', positional: ['Name'], params: [SVC_NAME, { name: 'DisplayName', list: true }, { name: 'DependentServices', switch: true, aliases: ['DS'] }, { name: 'RequiredServices', switch: true, aliases: ['SDO', 'ServicesDependedOn'] }, { name: 'Include', list: true }, { name: 'Exclude', list: true }], run: getService },
  { name: 'Start-Service', module: MGMT, version: '3.1.0.0', writes: true, positional: ['Name'], params: [SVC_NAME, { name: 'DisplayName', list: true }, SVC_INPUT, { name: 'PassThru', switch: true }], run: (r) => startStop(r, 'start') },
  { name: 'Stop-Service', module: MGMT, version: '3.1.0.0', writes: true, positional: ['Name'], params: [SVC_NAME, { name: 'DisplayName', list: true }, SVC_INPUT, { name: 'Force', switch: true }, { name: 'PassThru', switch: true }, { name: 'NoWait', switch: true }], run: (r) => startStop(r, 'stop') },
  { name: 'Restart-Service', module: MGMT, version: '3.1.0.0', writes: true, positional: ['Name'], params: [SVC_NAME, { name: 'DisplayName', list: true }, SVC_INPUT, { name: 'Force', switch: true }, { name: 'PassThru', switch: true }], run: (r) => startStop(r, 'restart') },
  {
    name: 'Set-Service', module: MGMT, version: '3.1.0.0', writes: true, positional: ['Name'],
    params: [{ name: 'Name', list: true, aliases: ['ServiceName', 'SN'] }, SVC_INPUT, { name: 'DisplayName', type: 'System.String' }, { name: 'Description', type: 'System.String' }, { name: 'StartupType', aliases: ['StartMode', 'SM', 'ST'], type: 'System.ServiceProcess.ServiceStartMode' }, { name: 'Status', type: 'System.String' }, { name: 'PassThru', switch: true }],
    run: setService,
  },
  { name: 'Get-CimInstance', module: 'CimCmdlets', version: '1.0.0.0', positional: ['ClassName'], params: [{ name: 'ClassName', type: 'System.String', aliases: ['Class'] }, { name: 'Filter', type: 'System.String' }, { name: 'Query', type: 'System.String' }, { name: 'Property', list: true }, { name: 'Namespace', type: 'System.String' }], run: (r) => getCim(r, 'GetCimInstance') },
  { name: 'Get-WmiObject', module: MGMT, version: '3.1.0.0', positional: ['ClassName'], params: [{ name: 'ClassName', type: 'System.String', aliases: ['Class'] }, { name: 'Filter', type: 'System.String' }, { name: 'Query', type: 'System.String' }, { name: 'Property', list: true }, { name: 'Namespace', type: 'System.String' }], run: (r) => getCim(r, 'GetWmiObject') },
  { name: 'Get-Process', module: MGMT, version: '3.1.0.0', positional: ['Name'], params: [{ name: 'Name', list: true, aliases: ['ProcessName'] }, { name: 'Id', list: true, type: 'System.Int32[]', aliases: ['PID'] }, { name: 'IncludeUserName', switch: true }], run: getProcess },
  { name: 'Stop-Process', module: MGMT, version: '3.1.0.0', writes: true, positional: ['Id'], params: [{ name: 'Id', list: true, type: 'System.Int32[]' }, { name: 'Name', list: true, aliases: ['ProcessName'] }, { name: 'Force', switch: true }, { name: 'PassThru', switch: true }], run: stopProcess },
];

const CIM_TABLES: Record<string, string[]> = {
  Win32_Service: ['ProcessId', 'Name', 'StartMode', 'State', 'Status', 'ExitCode'],
  Win32_LogicalDisk: ['DeviceID', 'DriveType', 'ProviderName', 'FreeSpace', 'Size', 'VolumeName'],
  Win32_OperatingSystem: ['SystemDirectory', 'Organization', 'BuildNumber', 'RegisteredUser', 'SerialNumber', 'Version'],
  Win32_ComputerSystem: ['Name', 'PrimaryOwnerName', 'Domain', 'TotalPhysicalMemory', 'Model', 'Manufacturer'],
};

export const SERVICE_VIEWS: Record<string, View> = {
  ServiceController: {
    columns: ['Status', 'Name', 'DisplayName'].map((n) => ({ label: n, value: (o: PSObject) => o.props[n] })),
    listProps: ['Name', 'DisplayName', 'Status', 'DependentServices', 'ServicesDependedOn', 'CanPauseAndContinue', 'CanShutdown', 'CanStop', 'ServiceType'],
  },
  ...Object.fromEntries(Object.entries(CIM_TABLES).map(([k, cols]) => [k, { columns: cols.map((n) => ({ label: n, value: (o: PSObject) => o.props[n] })) } satisfies View])),
  Process: {
    columns: [
      { label: 'Handles', value: (o) => o.props.Handles, right: true },
      { label: 'NPM(K)', value: (o) => o.props.NPM, right: true },
      { label: 'PM(K)', value: (o) => o.props.PM, right: true },
      { label: 'WS(K)', value: (o) => Math.round((o.props.WS as number) / 1024), right: true },
      { label: 'CPU(s)', value: (o) => (o.props.CPU as number).toFixed(2), right: true },
      { label: 'Id', value: (o) => o.props.Id, right: true },
      { label: 'SI', value: (o) => o.props.SI, right: true },
      { label: 'ProcessName', value: (o) => o.props.ProcessName },
    ],
  },
};

// ——— sc.exe ———

const START_SC: Record<WinService['start'], string> = { Automatic: '2   AUTO_START', Manual: '3   DEMAND_START', Disabled: '4   DISABLED' };

function scQuery(s: WinService): string {
  const running = s.status === 'Running';
  return [
    '',
    `SERVICE_NAME: ${s.name}`,
    `        TYPE               : ${s.process ? '10  WIN32_OWN_PROCESS' : '30  WIN32'}`,
    `        STATE              : ${running ? '4  RUNNING' : '1  STOPPED'}`,
    ...(running ? ['                                (STOPPABLE, NOT_PAUSABLE, ACCEPTS_SHUTDOWN)'] : []),
    `        WIN32_EXIT_CODE    : ${running ? '0  (0x0)' : `${s.exitCode ?? 1077}  (0x${(s.exitCode ?? 1077).toString(16)})`}`,
    '        SERVICE_EXIT_CODE  : 0  (0x0)',
    '        CHECKPOINT         : 0x0',
    '        WAIT_HINT          : 0x0',
  ].join('\n');
}

function sc(game: Shell, args: string[]) {
  const [op, name, ...rest] = args;
  if (!op || op === '/?') return { out: game.t('sc-usage'), code: 0 };
  const s = name ? findService(game, name) : undefined;
  const missing = (verb: string) => ({ out: `[SC] ${verb} FAILED 1060:\n\nThe specified service does not exist as an installed service.\n`, code: 1060 });
  switch (op.toLowerCase()) {
    case 'query':
      if (!name) return { out: windows(game).services.filter((x) => x.status === 'Running').map(scQuery).join('\n'), code: 0 };
      return s ? { out: scQuery(s), code: 0 } : missing('EnumQueryServicesStatus:OpenService');
    case 'qc':
      if (!s) return missing('OpenService');
      return {
        out: [
          '[SC] QueryServiceConfig SUCCESS',
          '',
          `SERVICE_NAME: ${s.name}`,
          `        TYPE               : ${s.process ? '10  WIN32_OWN_PROCESS' : '20  WIN32_SHARE_PROCESS'}`,
          `        START_TYPE         : ${START_SC[s.start]}`,
          '        ERROR_CONTROL      : 1   NORMAL',
          `        BINARY_PATH_NAME   : ${s.path ?? 'C:\\Windows\\system32\\svchost.exe -k netsvcs -p'}`,
          '        LOAD_ORDER_GROUP   :',
          '        TAG                : 0',
          `        DISPLAY_NAME       : ${s.display}`,
          `        DEPENDENCIES       : ${(s.dependsOn ?? []).join('\n                           : ')}`.trimEnd(),
          `        SERVICE_START_NAME : ${s.account ?? 'LocalSystem'}`,
        ].join('\n'),
        code: 0,
      };
    case 'start': {
      if (!s) return missing('StartService: OpenService');
      const code = startService(game, s);
      if (code) return { out: `[SC] StartService FAILED ${code}:\n\n${WIN32_ERRORS[code] ?? ''}\n`, code };
      return { out: scQuery(s).replace('4  RUNNING', '2  START_PENDING').replace('(STOPPABLE, NOT_PAUSABLE, ACCEPTS_SHUTDOWN)', '(NOT_STOPPABLE, NOT_PAUSABLE, IGNORES_SHUTDOWN)') + `\n        PID                : ${servicePid(game, s)}\n        FLAGS              :`, code: 0 };
    }
    case 'stop': {
      if (!s) return missing('ControlService: OpenService');
      if (s.status !== 'Running') return { out: `[SC] ControlService FAILED 1062:\n\nThe service has not been started.\n`, code: 1062 };
      if (runningDependents(game, s).length) return { out: `[SC] ControlService FAILED 1051:\n\nA stop control has been sent to a service that other running services are dependent on.\n`, code: 1051 };
      stopService(game, s);
      return { out: scQuery(s).replace('1  STOPPED', '3  STOP_PENDING'), code: 0 };
    }
    case 'config': {
      if (!s) return missing('OpenService');
      // sc config NAME start= auto obj= ".\svc" password= "x" DisplayName= "…": each option is "name=" then its value.
      const opts: Record<string, string> = {};
      for (let i = 0; i < rest.length; i++) {
        const m = /^(\w+)=(.*)$/.exec(rest[i]);
        if (!m) return { out: game.t('sc-config-usage'), code: 1639 };
        opts[m[1].toLowerCase()] = m[2] !== '' ? m[2] : (rest[++i] ?? '');
      }
      const startMap: Record<string, WinService['start']> = { auto: 'Automatic', demand: 'Manual', disabled: 'Disabled', 'delayed-auto': 'Automatic' };
      if (opts.start !== undefined && !startMap[opts.start.toLowerCase()]) return { out: game.t('sc-config-usage'), code: 1639 };
      if (opts.start) s.start = startMap[opts.start.toLowerCase()];
      if (opts.obj !== undefined) {
        s.account = opts.obj;
        if (/^(localsystem|nt authority\\)/i.test(opts.obj)) delete s.password;
      }
      if (opts.password !== undefined) s.password = opts.password;
      if (opts.displayname !== undefined) s.display = opts.displayname;
      if (opts.binpath !== undefined) s.path = opts.binpath;
      return { out: '[SC] ChangeServiceConfig SUCCESS', code: 0 };
    }
  }
  return { out: game.t('sc-usage'), code: 1 };
}

/** net start / net stop (a service by its name or display name). */
function netStartStop(game: Shell, op: 'start' | 'stop', name: string | undefined) {
  if (!name) {
    if (op === 'stop') return { out: '', err: 'The syntax of this command is:\n\nNET STOP\nservice\n', code: 1 };
    const running = windows(game).services.filter((s) => s.status === 'Running').map((s) => `   ${s.display}`);
    return { out: ['These Windows services are started:', '', ...running, '', 'The command completed successfully.', ''].join('\n'), code: 0 };
  }
  const s = findService(game, name);
  if (!s) return { out: '', err: 'The service name is invalid.\n\nMore help is available by typing NET HELPMSG 2185.\n', code: 2 };
  if (op === 'start') {
    if (s.status === 'Running') return { out: '', err: 'The requested service has already been started.\n\nMore help is available by typing NET HELPMSG 2182.\n', code: 2 };
    const code = startService(game, s);
    if (code) return { out: `The ${s.display} service is starting.\n`, err: `The ${s.display} service could not be started.\n\nA system error has occurred.\n\nSystem error ${code} has occurred.\n\n${WIN32_ERRORS[code] ?? ''}\n`, code: 2 };
    return { out: `The ${s.display} service is starting.\nThe ${s.display} service was started successfully.\n`, code: 0 };
  }
  if (s.status !== 'Running') return { out: '', err: `The ${s.display} service is not started.\n\nMore help is available by typing NET HELPMSG 3521.\n`, code: 2 };
  const deps = runningDependents(game, s);
  stopService(game, s, true);
  return { out: `${deps.length ? `The following services are dependent on the ${s.display} service.\nStopping the ${s.display} service will also stop these services.\n\n${deps.map((d) => `   ${d.display}`).join('\n')}\n\n` : ''}The ${s.display} service is stopping.\nThe ${s.display} service was stopped successfully.\n`, code: 0 };
}

function net(game: Shell, args: string[]) {
  const [sub, ...rest] = args;
  const accounts = netAccountsPart(game, args);
  if (accounts) return accounts;
  switch (sub?.toLowerCase()) {
    case 'start':
    case 'stop':
      return netStartStop(game, sub.toLowerCase() as 'start' | 'stop', rest.join(' ') || undefined);
    case 'share': {
      const shares = windows(game).shares;
      return { out: ['', 'Share name   Resource                        Remark', '', '-'.repeat(79), ...shares.map((s) => `${s.name.padEnd(13)}${s.path.padEnd(32)}${s.description}`.trimEnd()), 'The command completed successfully.', ''].join('\n'), code: 0 };
    }
    case 'helpmsg': {
      const n = Number(rest[0]);
      return WIN32_ERRORS[n] ? { out: `\n${WIN32_ERRORS[n]}\n`, code: 0 } : { out: '', err: `${rest[0]} is not a valid Windows network message number.\n`, code: 2 };
    }
  }
  return { out: game.t('net-usage'), code: sub ? 1 : 0 };
}

export const SERVICE_NATIVES: Native[] = [
  { name: 'sc.exe', page: 'sc.exe', run: (game, args) => sc(game, args) },
  { name: 'net.exe', page: 'net', run: (game, args) => net(game, args) },
];
