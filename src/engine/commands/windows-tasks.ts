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
// Differences (docs/SCENARIOS.md): no Register-ScheduledTask nor
// New-ScheduledTaskAction/Trigger (a story declares its tasks), one
// action per task, schtasks /query /v shows a subset of its fields.

import type { Shell } from '../shell';
import { longDate, windows } from '../windows';
import { findUser, logonError } from '../windows-accounts';
import { RUNNING, findTask, hexResult, nextRun, runTask, taskUser, tasks, type WinTask } from '../windows-tasks';
import { PSDate, arr, isObject, str, values, wildcard, type Cmdlet, type Native, type PSObject, type Run, type View } from '../powershell';

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
];

export const TASK_VIEWS: Record<string, View> = {
  ScheduledTask: { columns: [{ label: 'TaskPath', value: (o) => o.props.TaskPath }, { label: 'TaskName', value: (o) => o.props.TaskName }, { label: 'State', value: (o) => o.props.State }], listProps: ['Actions', 'Author', 'Description', 'Principal', 'State', 'TaskName', 'TaskPath', 'Triggers', 'URI'] },
  ScheduledTaskInfo: { columns: [], list: true },
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
