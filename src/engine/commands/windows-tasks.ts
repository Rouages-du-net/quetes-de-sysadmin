// Scheduled tasks from PowerShell (the ScheduledTasks module) and cmd
// (schtasks): Get-ScheduledTask, Get-ScheduledTaskInfo (LastRunTime,
// LastTaskResult in decimal, NextRunTime), Start-ScheduledTask,
// Stop-ScheduledTask, Enable-ScheduledTask, Disable-ScheduledTask,
// Set-ScheduledTask -User -Password (the Task Scheduler checks the
// password when the task is registered, as Windows does),
// Unregister-ScheduledTask; schtasks /query (/fo LIST, /v, /tn), /run,
// /end, /change (/ru, /rp, /enable, /disable), /delete.
// Sources (Microsoft Learn): ScheduledTasks module
// (https://learn.microsoft.com/powershell/module/scheduledtasks/?view=windowsserver2022-ps),
// schtasks query, run, change
// (https://learn.microsoft.com/windows-server/administration/windows-commands/schtasks-query).
// A new task: New-ScheduledTaskAction (-Execute, -Argument,
// -WorkingDirectory), New-ScheduledTaskTrigger (-Daily, -Weekly, -Once,
// -AtStartup, -AtLogOn, -At), New-ScheduledTaskPrincipal (-UserId,
// -LogonType, -RunLevel), then Register-ScheduledTask (-Action, -Trigger,
// -User and -Password, or -Principal; -Force replaces a task of that name).
// Sources: Register-ScheduledTask, New-ScheduledTaskAction,
// New-ScheduledTaskTrigger, New-ScheduledTaskPrincipal (same module).
// Differences (docs/SCENARIOS.md): one action per task runs (the first),
// no settings (New-ScheduledTaskSettingsSet), a task registered without a
// password runs at night as if its user were logged on, schtasks /query
// /v shows a subset of its fields, no schtasks /create.

import type { Shell } from '../shell';
import { logEvent, longDate, TASK_LOG, windows } from '../windows';
import { findUser, logonError } from '../windows-accounts';
import { RUNNING, findTask, hexResult, nextRun, runTask, taskUser, tasks, type WinTask } from '../windows-tasks';
import { PSDate, arr, isObject, str, values, wildcard, type Cmdlet, type Native, type PSObject, type Run, type View } from '../powershell';
import type { TaskAction, TaskTrigger } from '../windows-tasks';

const MODULE = 'ScheduledTasks';

function taskObject(game: Shell, t: WinTask): PSObject {
  return {
    type: 'ScheduledTask',
    fullType: 'Microsoft.Management.Infrastructure.CimInstance#Root/Microsoft/Windows/TaskScheduler/MSFT_ScheduledTask',
    data: t,
    text: 'MSFT_ScheduledTask (TaskName = "' + t.name + '", TaskPath = "' + t.path + '")',
    props: {
      TaskPath: t.path,
      TaskName: t.name,
      State: t.state,
      Author: t.author ?? '',
      Description: t.description ?? '',
      Actions: t.actions.map((a) => ({ type: 'MSFT_TaskExecAction', props: { Execute: a.execute, Arguments: a.arguments ?? '', WorkingDirectory: a.workingDirectory ?? '' }, text: 'MSFT_TaskExecAction' })),
      Triggers: t.triggers.map((tr) => ({ type: 'MSFT_TaskTrigger', props: { Enabled: tr.enabled !== false, StartBoundary: new Date(tr.start).toISOString().slice(0, 19), DaysInterval: tr.every ?? 1 }, text: `MSFT_Task${tr.kind}Trigger` })),
      Principal: { type: 'MSFT_TaskPrincipal2', props: { UserId: taskUser(game, t).replace(/^.*\\/, ''), LogonType: t.logon, RunLevel: t.runLevel ?? 'Limited' }, text: 'MSFT_TaskPrincipal2' },
      URI: `${t.path}${t.name}`,
    },
  };
}

/** The tasks named by -TaskName (wildcards), -TaskPath, -InputObject or the pipeline. */
function named(r: Run, cmdlet: string, all = false): WinTask[] {
  const list = tasks(r.game);
  const fromInput = [...(r.input ?? []), ...values(r.p.InputObject)].filter(isObject).map((x) => x.data as WinTask).filter(Boolean);
  const names = arr(r.p.TaskName);
  const path = r.p.TaskPath !== undefined ? str(r.p.TaskPath) : null;
  if (!names.length && !fromInput.length) return all ? list.filter((t) => path === null || wildcard(path).test(t.path)) : [];
  const out = [...fromInput];
  for (const n of names) {
    const found = list.filter((t) => wildcard(n).test(t.name) && (path === null || wildcard(path).test(t.path)));
    if (!found.length && !/[*?]/.test(n))
      r.fail({ message: `No MSFT_ScheduledTask objects found with property 'TaskName' equal to '${n}'.  Verify the value of the property and retry.`, category: 'ObjectNotFound', target: `${n}:String`, exception: 'CimJobException', id: `CmdletizationQuery_NotFound_TaskName,${cmdlet}` });
    out.push(...found);
  }
  return out;
}

function info(game: Shell, t: WinTask): PSObject {
  const next = nextRun(game, t);
  return {
    type: 'ScheduledTaskInfo',
    data: t,
    props: {
      LastRunTime: t.lastRun === undefined ? null : new PSDate(t.lastRun),
      LastTaskResult: t.state === 'Running' ? RUNNING : t.lastResult,
      NextRunTime: next === null ? null : new PSDate(next),
      NumberOfMissedRuns: 0,
      TaskName: t.name,
      TaskPath: t.path,
      PSComputerName: '',
    },
  };
}

function setState(r: Run, cmdlet: string, state: 'Ready' | 'Disabled'): unknown[] {
  return named(r, cmdlet).flatMap((t) => {
    if (!r.should(cmdlet, `${t.path}${t.name}`)) return [];
    t.state = state;
    return [taskObject(r.game, t)];
  });
}

function startTask(r: Run): unknown[] {
  for (const t of named(r, 'Start-ScheduledTask')) {
    if (t.state === 'Disabled') {
      r.fail({ message: 'The task is disabled.\n(10,8):Run:', category: 'NotSpecified', target: 'MSFT_ScheduledTask (TaskName …):Root/Microsoft/...T_ScheduledTask', exception: 'CimException', id: 'HRESULT 0x80041326,Start-ScheduledTask' });
      continue;
    }
    if (!r.should('Start-ScheduledTask', `${t.path}${t.name}`)) continue;
    runTask(r.game, t, 'user');
  }
  return [];
}

function setTask(r: Run): unknown[] {
  const out: unknown[] = [];
  for (const t of named(r, 'Set-ScheduledTask')) {
    if (r.p.User !== undefined || r.p.Password !== undefined) {
      const user = r.p.User !== undefined ? str(r.p.User) : t.user;
      const system = /^(nt authority\\)?system$/i.test(user);
      if (!system) {
        const u = findUser(r.game, user);
        const password = r.p.Password !== undefined ? str(r.p.Password) : undefined;
        // Registering checks the password (it is stored for "Run whether user is logged on or not").
        if (!u || (password !== undefined && logonError(r.game, u.name, password) === 1326)) {
          r.fail({ message: 'The user name or password is incorrect.', category: 'AuthenticationError', target: 'PS_ScheduledTask:Root/Microsoft/...S_ScheduledTask', exception: 'CimException', id: 'HRESULT 0x8007052e,Set-ScheduledTask' });
          continue;
        }
        if (!r.should('Set-ScheduledTask', `${t.path}${t.name}`)) continue;
        t.user = `${windows(r.game).computer}\\${u.name}`;
        if (password !== undefined) {
          t.password = password;
          t.logon = 'Password';
        }
      } else {
        if (!r.should('Set-ScheduledTask', `${t.path}${t.name}`)) continue;
        t.user = 'SYSTEM';
        t.logon = 'ServiceAccount';
        delete t.password;
      }
    }
    out.push(taskObject(r.game, t));
  }
  return out;
}

function unregister(r: Run): unknown[] {
  for (const t of named(r, 'Unregister-ScheduledTask')) {
    if (!r.should('Delete', `${t.path}${t.name}`, true)) continue;
    const list = tasks(r.game);
    list.splice(list.indexOf(t), 1);
  }
  return [];
}

// ——— A new task: its action, trigger, principal, then Register-ScheduledTask ———

const CIM = 'Microsoft.Management.Infrastructure.CimInstance';
const actionObject = (a: TaskAction): PSObject => ({
  type: 'TaskExecAction',
  fullType: `${CIM}#Root/Microsoft/Windows/TaskScheduler/MSFT_TaskExecAction`,
  data: { action: a },
  text: 'MSFT_TaskExecAction',
  props: { Id: '', Arguments: a.arguments ?? '', Execute: a.execute, WorkingDirectory: a.workingDirectory ?? '', PSComputerName: '' },
});
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 19);
const triggerObject = (tr: TaskTrigger): PSObject => ({
  type: 'TaskTrigger',
  fullType: `${CIM}#Root/Microsoft/Windows/TaskScheduler/MSFT_Task${tr.kind === 'AtStartup' ? 'Boot' : tr.kind === 'AtLogOn' ? 'Logon' : tr.kind === 'Once' ? 'Time' : tr.kind}Trigger`,
  data: { trigger: tr },
  text: `MSFT_Task${tr.kind === 'AtStartup' ? 'Boot' : tr.kind === 'AtLogOn' ? 'Logon' : tr.kind === 'Once' ? 'Time' : tr.kind}Trigger`,
  props: {
    Enabled: tr.enabled !== false,
    EndBoundary: '',
    ExecutionTimeLimit: '',
    Id: '',
    Repetition: 'MSFT_TaskRepetitionPattern',
    RandomDelay: '',
    StartBoundary: tr.kind === 'AtStartup' || tr.kind === 'AtLogOn' ? '' : iso(tr.start),
    ...(tr.kind === 'Daily' ? { DaysInterval: tr.every ?? 1 } : {}),
    ...(tr.kind === 'Weekly' ? { DaysOfWeek: (tr.days ?? []).reduce((m, d) => m | (1 << d), 0), WeeksInterval: 1 } : {}),
    PSComputerName: '',
  },
});
interface Principal {
  user: string;
  logon: WinTask['logon'];
  runLevel: 'Limited' | 'Highest';
}
const principalObject = (p: Principal): PSObject => ({
  type: 'TaskPrincipal',
  fullType: `${CIM}#Root/Microsoft/Windows/TaskScheduler/MSFT_TaskPrincipal2`,
  data: { principal: p },
  text: 'MSFT_TaskPrincipal2',
  props: { DisplayName: '', GroupId: '', Id: 'Author', LogonType: p.logon, RunLevel: p.runLevel, UserId: p.user, ProcessTokenSidType: 'Default', RequiredPrivilege: '', PSComputerName: '' },
});

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const ambiguous = (r: Run, cmdlet: string): never =>
  r.stop({ message: 'Parameter set cannot be resolved using the specified named parameters.', category: 'InvalidArgument', target: ':', exception: 'ParameterBindingException', id: `AmbiguousParameterSet,${cmdlet}` });

function newTrigger(r: Run): unknown[] {
  const { p } = r;
  const kinds = (['Once', 'Daily', 'Weekly', 'AtStartup', 'AtLogOn'] as const).filter((k) => p[k]);
  if (kinds.length !== 1) ambiguous(r, 'New-ScheduledTaskTrigger');
  const kind = kinds[0];
  const at = p.At instanceof PSDate ? p.At.ms : null;
  if ((kind === 'Once' || kind === 'Daily' || kind === 'Weekly') && at === null) ambiguous(r, 'New-ScheduledTaskTrigger');
  const tr: TaskTrigger = { kind, start: at ?? windows(r.game).clock };
  if (kind === 'Daily' && p.DaysInterval !== undefined) tr.every = Math.max(1, Number(p.DaysInterval));
  if (kind === 'Weekly') {
    const days = arr(p.DaysOfWeek).map((d) => DAYS.indexOf(d.toLowerCase()));
    if (!days.length) ambiguous(r, 'New-ScheduledTaskTrigger');
    const bad = arr(p.DaysOfWeek).find((d) => !DAYS.includes(d.toLowerCase()));
    if (bad)
      r.stop({ message: `Cannot process argument transformation on parameter 'DaysOfWeek'. Cannot convert value "${bad}" to type "Microsoft.PowerShell.Cmdletization.GeneratedTypes.ScheduledTask.DaysOfWeekEnum[]".`, category: 'InvalidData', target: ':', exception: 'ParameterBindingArgumentTransformationException', id: 'ParameterArgumentTransformationError,New-ScheduledTaskTrigger' });
    tr.days = days;
  }
  return [triggerObject(tr)];
}

/** The account a new task runs as: SYSTEM, a local user with its password, or the user without one. */
function principalFor(r: Run, user: string | null, password: string | undefined, cmdlet: string): Principal | null {
  const game = r.game;
  const name = user ?? game.who;
  if (/^(nt authority\\)?system$/i.test(name)) return { user: 'SYSTEM', logon: 'ServiceAccount', runLevel: 'Limited' };
  const u = findUser(game, name);
  if (!u || (password !== undefined && logonError(game, u.name, password) === 1326)) {
    r.fail({ message: u ? 'The user name or password is incorrect.' : 'No mapping between account names and security IDs was done.', category: u ? 'AuthenticationError' : 'NotSpecified', target: 'PS_ScheduledTask:Root/Microsoft/...S_ScheduledTask', exception: 'CimException', id: `HRESULT ${u ? '0x8007052e' : '0x80070534'},${cmdlet}` });
    return null;
  }
  return { user: `${windows(game).computer}\\${u.name}`, logon: password !== undefined ? 'Password' : 'InteractiveToken', runLevel: 'Limited' };
}

function register(r: Run): unknown[] {
  const { game, p } = r;
  const name = str(p.TaskName);
  let path = p.TaskPath !== undefined ? str(p.TaskPath) : '\\';
  if (!path.startsWith('\\')) path = `\\${path}`;
  if (!path.endsWith('\\')) path = `${path}\\`;
  const actions = values(p.Action).filter(isObject).map((x) => (x.data as { action?: TaskAction })?.action).filter((x): x is TaskAction => !!x);
  if (!actions.length)
    r.stop({ message: "Cannot validate argument on parameter 'Action'. The argument is null or empty. Provide an argument that is not null or empty, and then try the command again.", category: 'InvalidData', target: ':', exception: 'ParameterBindingValidationException', id: 'ParameterArgumentValidationError,Register-ScheduledTask' });
  const triggers = values(p.Trigger).filter(isObject).map((x) => (x.data as { trigger?: TaskTrigger })?.trigger).filter((x): x is TaskTrigger => !!x);
  const given = values(p.Principal).filter(isObject).map((x) => (x.data as { principal?: Principal })?.principal).find(Boolean);
  let principal: Principal | null;
  if (given) principal = given.user === 'SYSTEM' ? given : principalFor(r, given.user, undefined, 'Register-ScheduledTask') && { ...given, user: `${windows(game).computer}\\${findUser(game, given.user)!.name}` };
  else principal = principalFor(r, p.User !== undefined ? str(p.User) : null, p.Password !== undefined ? str(p.Password) : undefined, 'Register-ScheduledTask');
  if (!principal) return [];
  if (p.RunLevel !== undefined) principal.runLevel = /^highest$/i.test(str(p.RunLevel)) ? 'Highest' : 'Limited';
  const existing = findTask(game, name, path);
  if (existing && !p.Force) {
    r.fail({ message: 'Cannot create a file when that file already exists.', category: 'ResourceExists', target: 'PS_ScheduledTask:Root/Microsoft/...S_ScheduledTask', exception: 'CimException', id: 'HRESULT 0x800700b7,Register-ScheduledTask' });
    return [];
  }
  if (!r.should('Register-ScheduledTask', `${path}${name}`)) return [];
  const list = tasks(game);
  if (existing) list.splice(list.indexOf(existing), 1);
  const t: WinTask = {
    path,
    name,
    state: 'Ready',
    author: `${windows(game).computer}\\${game.who}`,
    description: p.Description !== undefined ? str(p.Description) : undefined,
    user: principal.user,
    logon: principal.logon,
    ...(principal.logon === 'Password' ? { password: str(p.Password) } : {}),
    runLevel: principal.runLevel,
    actions,
    triggers,
    lastResult: 267011,
  };
  list.push(t);
  logEvent(game, TASK_LOG, { id: 106, level: 'Information', provider: 'Microsoft-Windows-TaskScheduler', message: `User "${windows(game).computer}\\${game.who}"  registered Task Scheduler task "${path}${name}"` });
  return [taskObject(game, t)];
}

const TN = { name: 'TaskName', list: true };
const TP = { name: 'TaskPath', type: 'System.String' };
const IN = { name: 'InputObject', type: 'Microsoft.Management.Infrastructure.CimInstance' };

export const TASK_CMDLETS: Cmdlet[] = [
  { name: 'Get-ScheduledTask', module: MODULE, version: '1.0.0.0', kind: 'Function', positional: ['TaskName', 'TaskPath'], params: [TN, TP], run: (r) => named(r, 'Get-ScheduledTask', true).map((t) => taskObject(r.game, t)) },
  { name: 'Get-ScheduledTaskInfo', module: MODULE, version: '1.0.0.0', kind: 'Function', positional: ['TaskName', 'TaskPath'], params: [TN, TP, IN], run: (r) => named(r, 'Get-ScheduledTaskInfo').map((t) => info(r.game, t)) },
  { name: 'Start-ScheduledTask', module: MODULE, version: '1.0.0.0', kind: 'Function', writes: true, positional: ['TaskName', 'TaskPath'], params: [TN, TP, IN], run: startTask },
  {
    name: 'Stop-ScheduledTask', module: MODULE, version: '1.0.0.0', kind: 'Function', writes: true, positional: ['TaskName', 'TaskPath'], params: [TN, TP, IN],
    run: (r) => {
      for (const t of named(r, 'Stop-ScheduledTask')) if (t.state === 'Running' && r.should('Stop-ScheduledTask', t.name)) t.state = 'Ready';
      return [];
    },
  },
  { name: 'Enable-ScheduledTask', module: MODULE, version: '1.0.0.0', kind: 'Function', writes: true, positional: ['TaskName', 'TaskPath'], params: [TN, TP, IN], run: (r) => setState(r, 'Enable-ScheduledTask', 'Ready') },
  { name: 'Disable-ScheduledTask', module: MODULE, version: '1.0.0.0', kind: 'Function', writes: true, positional: ['TaskName', 'TaskPath'], params: [TN, TP, IN], run: (r) => setState(r, 'Disable-ScheduledTask', 'Disabled') },
  { name: 'Set-ScheduledTask', module: MODULE, version: '1.0.0.0', kind: 'Function', writes: true, positional: ['TaskName', 'TaskPath'], params: [TN, TP, IN, { name: 'User', type: 'System.String' }, { name: 'Password', type: 'System.String' }], run: setTask },
  { name: 'Unregister-ScheduledTask', module: MODULE, version: '1.0.0.0', kind: 'Function', writes: true, positional: ['TaskName', 'TaskPath'], params: [TN, TP, IN], run: unregister },
  {
    name: 'New-ScheduledTaskAction', module: MODULE, version: '1.0.0.0', kind: 'Function', positional: ['Execute', 'Argument', 'WorkingDirectory'],
    params: [{ name: 'Execute', type: 'System.String' }, { name: 'Argument', type: 'System.String' }, { name: 'WorkingDirectory', type: 'System.String' }, { name: 'Id', type: 'System.String' }],
    run: (r) => {
      if (r.p.Execute === undefined) r.stop({ message: "Cannot process command because of one or more missing mandatory parameters: Execute.", category: 'InvalidArgument', target: ':', exception: 'ParameterBindingException', id: 'MissingMandatoryParameter,New-ScheduledTaskAction' });
      return [actionObject({ execute: str(r.p.Execute), ...(r.p.Argument !== undefined ? { arguments: str(r.p.Argument) } : {}), ...(r.p.WorkingDirectory !== undefined ? { workingDirectory: str(r.p.WorkingDirectory) } : {}) })];
    },
  },
  {
    name: 'New-ScheduledTaskTrigger', module: MODULE, version: '1.0.0.0', kind: 'Function',
    params: [{ name: 'Once', switch: true }, { name: 'Daily', switch: true }, { name: 'Weekly', switch: true }, { name: 'AtStartup', switch: true }, { name: 'AtLogOn', switch: true }, { name: 'At', type: 'System.DateTime' }, { name: 'DaysInterval', type: 'System.UInt32' }, { name: 'DaysOfWeek', list: true, type: 'Microsoft.PowerShell.Cmdletization.GeneratedTypes.ScheduledTask.DaysOfWeekEnum[]' }, { name: 'User', type: 'System.String' }],
    run: newTrigger,
  },
  {
    name: 'New-ScheduledTaskPrincipal', module: MODULE, version: '1.0.0.0', kind: 'Function', positional: ['UserId'],
    params: [{ name: 'UserId', type: 'System.String' }, { name: 'LogonType', type: 'Microsoft.PowerShell.Cmdletization.GeneratedTypes.ScheduledTask.LogonTypeEnum' }, { name: 'RunLevel', type: 'Microsoft.PowerShell.Cmdletization.GeneratedTypes.ScheduledTask.RunLevelEnum' }],
    run: (r) => {
      const user = r.p.UserId !== undefined ? str(r.p.UserId) : r.game.who;
      const system = /^(nt authority\\)?system$/i.test(user);
      const logon = r.p.LogonType !== undefined ? (str(r.p.LogonType) as Principal['logon']) : system ? 'ServiceAccount' : 'InteractiveToken';
      const runLevel = r.p.RunLevel !== undefined && /^highest$/i.test(str(r.p.RunLevel)) ? 'Highest' : 'Limited';
      return [principalObject({ user: system ? 'SYSTEM' : user.replace(/^.*\\/, ''), logon, runLevel })];
    },
  },
  {
    name: 'Register-ScheduledTask', module: MODULE, version: '1.0.0.0', kind: 'Function', writes: true, positional: ['TaskName', 'TaskPath', 'Action', 'Trigger', 'User', 'Password'],
    params: [{ name: 'TaskName', type: 'System.String' }, TP, { name: 'Action', list: true, type: `${CIM}[]` }, { name: 'Trigger', list: true, type: `${CIM}[]` }, { name: 'User', type: 'System.String' }, { name: 'Password', type: 'System.String' }, { name: 'Principal', type: CIM }, { name: 'RunLevel', type: 'Microsoft.PowerShell.Cmdletization.GeneratedTypes.ScheduledTask.RunLevelEnum' }, { name: 'Description', type: 'System.String' }, { name: 'Force', switch: true }],
    run: register,
  },
];

export const TASK_VIEWS: Record<string, View> = {
  ScheduledTask: { columns: [{ label: 'TaskPath', value: (o) => o.props.TaskPath }, { label: 'TaskName', value: (o) => o.props.TaskName }, { label: 'State', value: (o) => o.props.State }], listProps: ['Actions', 'Author', 'Description', 'Principal', 'State', 'TaskName', 'TaskPath', 'Triggers', 'URI'] },
  ScheduledTaskInfo: { columns: [], list: true },
  TaskExecAction: { columns: [], list: true },
  TaskTrigger: { columns: [], list: true },
  TaskPrincipal: { columns: [], list: true },
};

// ——— schtasks ———

const ok = (out: string) => ({ out, code: 0 });
const err = (e: string, code = 1) => ({ out: '', err: e, code });

function schtasks(game: Shell, args: string[]) {
  const [op, ...rest] = args;
  if (!op || op === '/?') return ok(game.t('schtasks-usage'));
  const value = (f: string) => {
    const i = rest.findIndex((a) => a.toLowerCase() === f);
    return i >= 0 ? rest[i + 1] : undefined;
  };
  const has = (f: string) => rest.some((a) => a.toLowerCase() === f);
  const tn = value('/tn');
  const t = tn ? findTask(game, tn) : undefined;
  const missing = () => err(`ERROR: The system cannot find the file specified.`);
  switch (op.toLowerCase()) {
    case '/query': {
      const list = tn ? (t ? [t] : []) : tasks(game);
      if (tn && !t) return missing();
      const format = (value('/fo') ?? 'TABLE').toUpperCase();
      const nextText = (x: WinTask) => (nextRun(game, x) === null ? 'N/A' : longDate(nextRun(game, x)!));
      const status = (x: WinTask) => (x.state === 'Disabled' ? 'Disabled' : x.state);
      if (format === 'LIST' || has('/v')) {
        const pad = (k: string, v: string) => `${`${k}:`.padEnd(38)}${v}`;
        return ok(
          list
            .map((x) =>
              [
                '',
                pad('HostName', windows(game).computer),
                pad('TaskName', `${x.path}${x.name}`),
                pad('Next Run Time', nextText(x)),
                pad('Status', status(x)),
                ...(has('/v')
                  ? [
                      pad('Logon Mode', x.logon === 'Password' ? 'Interactive/Background' : 'Background only'),
                      pad('Last Run Time', x.lastRun === undefined ? '11/30/1999 12:00:00 AM' : longDate(x.lastRun)),
                      pad('Last Result', String(x.lastResult >= 0x80000000 ? x.lastResult - 0x100000000 : x.lastResult)),
                      pad('Author', x.author ?? 'N/A'),
                      pad('Task To Run', `${x.actions[0]?.execute ?? ''} ${x.actions[0]?.arguments ?? ''}`.trim()),
                      pad('Start In', x.actions[0]?.workingDirectory ?? 'N/A'),
                      pad('Comment', x.description ?? 'N/A'),
                      pad('Scheduled Task State', x.state === 'Disabled' ? 'Disabled' : 'Enabled'),
                      pad('Run As User', taskUser(game, x).replace(/^.*\\/, '')),
                      pad('Schedule Type', x.triggers[0]?.kind ?? 'On demand only'),
                      pad('Start Time', x.triggers[0] ? longDate(x.triggers[0].start).replace(/^\S+ /, '') : 'N/A'),
                    ]
                  : []),
              ].join('\n'),
            )
            .join('\n'),
        );
      }
      const rows = list.map((x) => `${x.name.padEnd(40)} ${nextText(x).padEnd(22)} ${status(x)}`);
      return ok(['', 'Folder: \\', `${'TaskName'.padEnd(40)} ${'Next Run Time'.padEnd(22)} Status`, `${'='.repeat(40)} ${'='.repeat(22)} ${'='.repeat(15)}`, ...rows].join('\n'));
    }
    case '/run':
      if (!t) return missing();
      if (t.state === 'Disabled') return err('ERROR: The task is disabled.');
      runTask(game, t, 'user');
      return ok(`SUCCESS: Attempted to run the scheduled task "${t.name}".`);
    case '/end':
      if (!t) return missing();
      return ok(`SUCCESS: The scheduled task "${t.name}" has been terminated successfully.`);
    case '/change': {
      if (!t) return missing();
      const ru = value('/ru');
      const rp = value('/rp');
      if (ru !== undefined || rp !== undefined) {
        const user = ru ?? t.user;
        if (!/^(nt authority\\)?system$/i.test(user)) {
          const u = findUser(game, user);
          if (!u || (rp !== undefined && logonError(game, u.name, rp) === 1326)) return err('ERROR: The user name or password is incorrect.');
          t.user = `${windows(game).computer}\\${u.name}`;
          if (rp !== undefined) {
            t.password = rp;
            t.logon = 'Password';
          }
        } else {
          t.user = 'SYSTEM';
          t.logon = 'ServiceAccount';
          delete t.password;
        }
      }
      if (has('/enable')) t.state = 'Ready';
      if (has('/disable')) t.state = 'Disabled';
      return ok(`SUCCESS: The parameters of scheduled task "${t.name}" have been changed.`);
    }
    case '/delete': {
      if (!t) return missing();
      const list = tasks(game);
      list.splice(list.indexOf(t), 1);
      return ok(`SUCCESS: The scheduled task "${t.name}" was successfully deleted.`);
    }
  }
  return err(`ERROR: Invalid argument/option - '${op}'.\nType "SCHTASKS /?" for usage.`);
}

export const TASK_NATIVES: Native[] = [{ name: 'schtasks.exe', page: 'schtasks', run: (game, args) => schtasks(game, args) }];

export { hexResult };
