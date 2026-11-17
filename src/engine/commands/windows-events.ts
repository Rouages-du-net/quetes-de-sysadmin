// The event logs from PowerShell and cmd: Get-WinEvent (-LogName,
// -MaxEvents, -ProviderName, -FilterHashtable with LogName, Id, Level,
// ProviderName, StartTime, EndTime; -ListLog), Get-EventLog (the classic
// logs: System, Application, Security; -Newest, -EntryType, -Source,
// -InstanceId, -After, -Before, -List) and wevtutil (el, gl, sl /e:).
// Sources (Microsoft Learn): Get-WinEvent
// (https://learn.microsoft.com/powershell/module/microsoft.powershell.diagnostics/get-winevent?view=powershell-5.1),
// "Creating Get-WinEvent queries with FilterHashtable"
// (https://learn.microsoft.com/powershell/scripting/samples/creating-get-winevent-queries-with-filterhashtable),
// Get-EventLog (https://learn.microsoft.com/powershell/module/microsoft.powershell.management/get-eventlog?view=powershell-5.1),
// wevtutil (https://learn.microsoft.com/windows-server/administration/windows-commands/wevtutil).
// Differences (docs/SCENARIOS.md): no XPath (-FilterXPath), messages in
// one language, record numbers made up.

import type { Shell } from '../shell';
import { logNames, windows, winLog, type WinEvent } from '../windows';
import { PSDate, PSHashtable, arr, str, text, values, wildcard, type Cmdlet, type Native, type PSObject, type Run, type View } from '../powershell';

const LEVELS: Record<WinEvent['level'], number> = { Critical: 1, Error: 2, Warning: 3, Information: 4 };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function record(game: Shell, log: string, e: WinEvent): PSObject {
  return {
    type: 'EventLogRecord',
    fullType: 'System.Diagnostics.Eventing.Reader.EventLogRecord',
    group: `   ProviderName: ${e.provider}`,
    text: 'System.Diagnostics.Eventing.Reader.EventLogRecord',
    props: {
      Message: e.message,
      Id: e.id,
      Version: 0,
      Qualifiers: e.provider === 'Service Control Manager' ? 49152 : null,
      Level: LEVELS[e.level] === 4 && e.keywords ? 0 : LEVELS[e.level],
      Task: 0,
      Opcode: 0,
      Keywords: e.keywords === 'Audit Failure' ? -9218868437227405312 : -9223372036854775808,
      RecordId: e.record ?? 0,
      ProviderName: e.provider,
      LogName: log,
      ProcessId: 640,
      ThreadId: 1000,
      MachineName: `${windows(game).computer}`,
      UserId: e.user ?? null,
      TimeCreated: new PSDate(e.time),
      LevelDisplayName: e.level,
      KeywordsDisplayNames: e.keywords ? [e.keywords] : ['Classic'],
    },
  };
}

const logName = (game: Shell, name: string) => logNames(game).find((n) => n.toLowerCase() === name.toLowerCase()) ?? name;

function noLog(r: Run, name: string) {
  r.fail({ message: `There is not an event log on the localhost computer that matches "${name}".`, category: 'ObjectNotFound', target: `${name}:String`, exception: 'Exception', id: 'NoMatchingLogsFound,Microsoft.PowerShell.Commands.GetWinEventCommand' });
}
function noEvents(r: Run) {
  r.fail({ message: 'No events were found that match the specified selection criteria.', category: 'ObjectNotFound', target: ':', exception: 'Exception', id: 'NoMatchingEventsFound,Microsoft.PowerShell.Commands.GetWinEventCommand' });
}

function getWinEvent(r: Run): unknown[] {
  const game = r.game;
  if (r.p.ListLog !== undefined) {
    const pats = arr(r.p.ListLog);
    return logNames(game)
      .filter((n) => pats.some((p) => wildcard(p).test(n)))
      .map((n) => {
        const l = winLog(game, n)!;
        return { type: 'EventLogConfiguration', props: { LogMode: 'Circular', MaximumSizeInBytes: n === 'System' || n === 'Application' ? 20971520 : 1052672, RecordCount: l.events.length, LogName: n, IsEnabled: l.enabled } };
      });
  }
  let sources: { log: string; events: WinEvent[] }[] = [];
  let filter: PSHashtable | null = null;
  if (r.p.FilterHashtable !== undefined) {
    filter = values(r.p.FilterHashtable)[0] as PSHashtable;
    const names = values(filter.get('LogName')).map(text);
    const providers = values(filter.get('ProviderName')).map(text);
    const logs = names.length ? names : providers.length ? logNames(game) : [];
    for (const n of logs) {
      const l = winLog(game, n);
      if (!l) {
        noLog(r, n);
        continue;
      }
      sources.push({ log: logName(game, n), events: l.events });
    }
  } else {
    const names = arr(r.p.LogName).length ? arr(r.p.LogName) : r.p.ProviderName === undefined ? [] : logNames(game);
    if (!names.length && r.p.ProviderName === undefined) {
      r.fail({ message: r.game.t('powershell-winevent-which'), category: 'InvalidArgument', target: ':', exception: 'Exception', id: 'NoMatchingLogsFound,Microsoft.PowerShell.Commands.GetWinEventCommand' });
      return [];
    }
    for (const n of names) {
      const matches = /[*?]/.test(n) ? logNames(game).filter((x) => wildcard(n).test(x)) : [n];
      for (const m of matches) {
        const l = winLog(game, m);
        if (!l) noLog(r, m);
        else sources.push({ log: logName(game, m), events: l.events });
      }
    }
  }
  if (!sources.length) return [];
  let all = sources.flatMap((s) => s.events.map((e) => ({ log: s.log, e }))).sort((a, b) => b.e.time - a.e.time || (b.e.record ?? 0) - (a.e.record ?? 0));
  const providers = [...arr(r.p.ProviderName), ...(filter ? values(filter.get('ProviderName')).map(text) : [])];
  if (providers.length) all = all.filter(({ e }) => providers.some((p) => wildcard(p).test(e.provider)));
  if (filter) {
    const ids = values(filter.get('Id')).map(Number);
    const levels = values(filter.get('Level')).map(Number);
    const start = filter.get('StartTime');
    const end = filter.get('EndTime');
    if (ids.length) all = all.filter(({ e }) => ids.includes(e.id));
    if (levels.length) all = all.filter(({ e }) => levels.includes(LEVELS[e.level]));
    if (start instanceof PSDate) all = all.filter(({ e }) => e.time >= start.ms);
    if (end instanceof PSDate) all = all.filter(({ e }) => e.time <= end.ms);
  }
  if (r.p.Oldest) all.reverse();
  if (r.p.MaxEvents !== undefined) all = all.slice(0, Number(r.p.MaxEvents));
  if (!all.length) {
    noEvents(r);
    return [];
  }
  return all.map(({ log, e }) => record(game, log, e));
}

function getEventLog(r: Run): unknown[] {
  const game = r.game;
  if (r.p.List) {
    return ['Application', 'Security', 'System']
      .filter((n) => winLog(game, n))
      .map((n) => ({ type: 'EventLog', props: { 'Max(K)': 20480, Retain: 0, OverflowAction: 'OverwriteAsNeeded', Entries: winLog(game, n)!.events.length, Log: n } }));
  }
  const name = str(r.p.LogName);
  if (!name) {
    r.fail({ message: 'Cannot process command because of one or more missing mandatory parameters: LogName.', category: 'InvalidArgument', target: ':', exception: 'ParameterBindingException', id: 'MissingMandatoryParameter,Microsoft.PowerShell.Commands.GetEventLogCommand' });
    return [];
  }
  const log = winLog(game, name);
  if (!log || name.includes('/')) {
    r.fail({ message: `The event log '${name}' on computer '.' does not exist.`, category: 'NotSpecified', target: ':', exception: 'InvalidOperationException', id: 'System.InvalidOperationException,Microsoft.PowerShell.Commands.GetEventLogCommand' });
    return [];
  }
  const total = log.events.length;
  let rows = [...log.events].reverse().map((e, i) => ({ e, index: e.record ?? 48_000 + total - i }));
  const level = (e: WinEvent) => (e.keywords === 'Audit Failure' ? 'FailureAudit' : e.keywords === 'Audit Success' ? 'SuccessAudit' : e.level === 'Critical' ? 'Error' : e.level);
  if (r.p.EntryType) rows = rows.filter(({ e }) => arr(r.p.EntryType).some((t) => t.toLowerCase() === level(e).toLowerCase()));
  if (r.p.Source) rows = rows.filter(({ e }) => arr(r.p.Source).some((s) => wildcard(s).test(e.provider)));
  if (r.p.InstanceId !== undefined) rows = rows.filter(({ e }) => values(r.p.InstanceId).map(Number).includes(e.id));
  if (r.p.After instanceof PSDate) rows = rows.filter(({ e }) => e.time > (r.p.After as PSDate).ms);
  if (r.p.Before instanceof PSDate) rows = rows.filter(({ e }) => e.time < (r.p.Before as PSDate).ms);
  if (r.p.Newest !== undefined) rows = rows.slice(0, Number(r.p.Newest));
  return rows.map(({ e, index }) => {
    const d = new Date(e.time);
    const time = `${MONTHS[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2, '0')} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
    return { type: 'EventLogEntry', fullType: 'System.Diagnostics.EventLogEntry', props: { Index: index, Time: time, EntryType: level(e), Source: e.provider, InstanceID: e.id, Message: e.message, TimeGenerated: new PSDate(e.time), EventID: e.id } };
  });
}

const DIAG = 'Microsoft.PowerShell.Diagnostics';

export const EVENT_CMDLETS: Cmdlet[] = [
  {
    name: 'Get-WinEvent', module: DIAG, version: '3.0.0.0', positional: ['LogName'],
    params: [{ name: 'LogName', list: true }, { name: 'MaxEvents', type: 'System.Int64' }, { name: 'ProviderName', list: true }, { name: 'FilterHashtable', type: 'System.Collections.Hashtable[]' }, { name: 'ListLog', list: true }, { name: 'Oldest', switch: true }],
    run: getWinEvent,
  },
  {
    name: 'Get-EventLog', module: 'Microsoft.PowerShell.Management', version: '3.1.0.0', positional: ['LogName', 'InstanceId'],
    params: [{ name: 'LogName', aliases: ['LN'], type: 'System.String' }, { name: 'Newest', type: 'System.Int32' }, { name: 'EntryType', list: true }, { name: 'Source', list: true }, { name: 'InstanceId', list: true, type: 'System.Int64[]' }, { name: 'After', type: 'System.DateTime' }, { name: 'Before', type: 'System.DateTime' }, { name: 'List', switch: true }],
    run: getEventLog,
  },
];

export const EVENT_VIEWS: Record<string, View> = {
  EventLogRecord: {
    group: (o) => o.group!,
    columns: [
      { label: 'TimeCreated', value: (o) => String(o.props.TimeCreated) },
      { label: 'Id', value: (o) => o.props.Id },
      { label: 'LevelDisplayName', value: (o) => o.props.LevelDisplayName },
      { label: 'Message', value: (o) => o.props.Message },
    ],
    listProps: ['TimeCreated', 'ProviderName', 'Id', 'Message'],
  },
  EventLogEntry: { columns: ['Index', 'Time', 'EntryType', 'Source', 'InstanceID', 'Message'].map((n) => ({ label: n, value: (o: PSObject) => o.props[n] })), listProps: ['Index', 'EntryType', 'InstanceID', 'Message', 'Source', 'TimeGenerated'] },
  EventLogConfiguration: { columns: [{ label: 'LogMode', value: (o) => o.props.LogMode }, { label: 'MaximumSizeInBytes', value: (o) => o.props.MaximumSizeInBytes, right: true }, { label: 'RecordCount', value: (o) => o.props.RecordCount, right: true }, { label: 'LogName', value: (o) => o.props.LogName }] },
  EventLog: { columns: ['Max(K)', 'Retain', 'OverflowAction', 'Entries', 'Log'].map((n) => ({ label: n, value: (o: PSObject) => o.props[n], right: ['Max(K)', 'Retain', 'Entries'].includes(n) })) },
};

// ——— wevtutil ———

function wevtutil(game: Shell, args: string[]) {
  const [op, name, ...rest] = args;
  if (!op || op === '/?') return { out: game.t('wevtutil-usage'), code: 0 };
  switch (op.toLowerCase()) {
    case 'el':
    case 'enum-logs':
      return { out: [...logNames(game)].sort((a, b) => a.localeCompare(b)).join('\n'), code: 0 };
    case 'gl':
    case 'get-log': {
      const l = name ? winLog(game, name) : null;
      if (!l) return { out: '', err: 'Failed to read configuration for log ' + (name ?? '') + '. The specified channel could not be found.', code: 15007 };
      return { out: [`name: ${logName(game, name!)}`, `enabled: ${l.enabled ? 'true' : 'false'}`, 'type: Operational', 'isolation: Application', 'logging:', '  retention: false', '  autoBackup: false', '  maxSize: 1052672'].join('\n'), code: 0 };
    }
    case 'sl':
    case 'set-log': {
      const l = name ? winLog(game, name) : null;
      if (!l) return { out: '', err: 'Failed to read configuration for log ' + (name ?? '') + '. The specified channel could not be found.', code: 15007 };
      const e = rest.map((a) => /^\/e(?:nabled)?:(true|false)$/i.exec(a)).find(Boolean);
      if (e) l.enabled = e[1].toLowerCase() === 'true';
      return { out: '', code: 0 };
    }
  }
  return { out: '', err: `Unknown command: ${op}.`, code: 1 };
}

export const EVENT_NATIVES: Native[] = [{ name: 'wevtutil.exe', page: 'wevtutil', run: (game, args) => wevtutil(game, args) }];
