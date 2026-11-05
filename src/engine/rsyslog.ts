// A machine's rsyslog: its configuration (/etc/rsyslog.conf and the files
// of /etc/rsyslog.d, read when the service starts), the messages it
// receives (from the local system: logger; from other machines: UDP or TCP
// 514, if an input listens there and the firewall lets them in), and where
// its rules write them.
//
//   state.rsyslog = { config, senders: [{ host, address, proto, port, messages }], sent }
//
// The configuration understood, after the rsyslog documentation
// (https://www.rsyslog.com/doc/configuration/index.html):
// module(load=…), input(type=… port=…), template(name=… type="string"
// string=…), include(file=…) and $IncludeConfig, the legacy $ModLoad,
// $UDPServerRun, $InputTCPServerRun and $template; rules with a selector
// (facility.priority;… with none), a property filter (:prop, op, "value")
// or "if EXPR then ACTION" (==, !=, contains, startswith, and, or, not), and
// the actions: a file (-/path), a dynamic file (?Template), action(type=
// "omfile" file=… or dynaFile=…), :omusrmsg:*, stop (and the old ~), "&"
// to chain an action to the same filter, and if … then { … } blocks.
// Simplifications (docs/SCENARIOS.md): priorities only matter for none and
// emerg; the files' format is the traditional one (RSYSLOG_TraditionalFileFormat);
// no queues, no forwarding (omfwd), no TLS.

import type { Game } from './shell';
import type { Shell } from './shell';
import { systemd, writeLog } from './systemd';
import { verdict, type Firewall } from './firewall';

export interface Message {
  host: string;
  address: string;
  program: string;
  pid?: number;
  facility: string;
  severity: string;
  text: string;
}

export interface Sender {
  host: string;
  address: string;
  proto: 'udp' | 'tcp';
  port: number;
  // What it sends, in turn (one message per command).
  messages: Omit<Message, 'host' | 'address'>[];
  next?: number;
}

type Condition = (m: Message) => boolean;
type ActionSpec = { kind: 'file'; path: string } | { kind: 'dyna'; template: string } | { kind: 'stop' } | { kind: 'users' };
interface RuleSpec {
  condition: Condition;
  actions: ActionSpec[];
}

export interface Config {
  modules: string[];
  inputs: { type: string; port: number }[];
  templates: Record<string, string>;
  rules: RuleSpec[];
  errors: string[];
}

export interface RsyslogState {
  config: Config | null;
  senders: Sender[];
  // How many messages each remote host got in (and how many were lost).
  received: Record<string, number>;
  lost: Record<string, number>;
}

export const rsyslog = (j: Game): RsyslogState | undefined => j.state.rsyslog;
export const CONF = '/etc/rsyslog.conf';
const VERSION = 'v8.2302.0';
const KNOWN_MODULES = ['imuxsock', 'imklog', 'immark', 'imudp', 'imtcp', 'imfile', 'imjournal', 'omfwd', 'omfile', 'mmjsonparse'];
const FACILITIES = ['kern', 'user', 'mail', 'daemon', 'auth', 'syslog', 'lpr', 'news', 'uucp', 'cron', 'authpriv', 'ftp', 'local0', 'local1', 'local2', 'local3', 'local4', 'local5', 'local6', 'local7'];
const SEVERITIES = ['emerg', 'alert', 'crit', 'err', 'warning', 'notice', 'info', 'debug'];

// ——— Reading the configuration ———

/** key="value" pairs of an object statement: module(load="imudp") → { load: 'imudp' }. */
function params(text: string): Record<string, string> {
  return Object.fromEntries([...text.matchAll(/([\w.-]+)\s*=\s*"([^"]*)"/g)].map((m) => [m[1].toLowerCase(), m[2]]));
}

/** A selector: "*.*;auth,authpriv.none", "mail.*", "*.emerg". */
function selector(text: string): Condition | null {
  const parts = text.split(';').map((p) => /^([\w*,]+)\.(!?=?[\w*]+)$/.exec(p.trim()));
  if (parts.some((p) => !p)) return null;
  return (m) => {
    let ok = false;
    for (const p of parts) {
      const facilities = p![1].split(',');
      const priority = p![2];
      const facilityMatches = facilities.includes('*') || facilities.includes(m.facility);
      if (!facilityMatches) continue;
      if (priority === 'none') ok = false;
      else if (priority === '*') ok = true;
      else ok = SEVERITIES.indexOf(m.severity) <= SEVERITIES.indexOf(priority.replace(/^!?=?/, ''));
    }
    return ok;
  };
}

/** A message property, by its rsyslog name. */
function property(m: Message, name: string): string | null {
  switch (name.replace(/^\$/, '').toLowerCase()) {
    case 'hostname':
    case 'source':
    case 'fromhost':
      return m.host;
    case 'fromhost-ip':
      return m.address;
    case 'programname':
    case 'app-name':
      return m.program;
    case 'syslogtag':
      return `${m.program}${m.pid ? `[${m.pid}]` : ''}:`;
    case 'msg':
    case 'rawmsg':
      return ` ${m.text}`;
    case 'syslogfacility-text':
      return m.facility;
    case 'syslogseverity-text':
      return m.severity;
    default:
      return null;
  }
}

/** An expression of an "if": $prop op 'value', with and, or, not. */
function expression(text: string): Condition | null {
  const or = text.split(/\s+or\s+/i);
  const terms = or.map((part) =>
    part.split(/\s+and\s+/i).map((t) => {
      const m = /^(not\s+)?\(?\s*(\$[\w-]+)\s*(==|!=|<>|contains_i|contains|startswith)\s*['"]([^'"]*)['"]\s*\)?$/i.exec(t.trim());
      if (!m || property({ host: '', address: '', program: '', facility: '', severity: '', text: '' }, m[2]) === null) return null;
      const [, not, prop, op, value] = m;
      const test: Condition = (msg) => {
        const v = property(msg, prop)!;
        const r =
          op === '==' ? v.trim() === value : op === '!=' || op === '<>' ? v.trim() !== value : op.toLowerCase() === 'contains' ? v.includes(value) : op.toLowerCase() === 'contains_i' ? v.toLowerCase().includes(value.toLowerCase()) : v.trim().startsWith(value);
        return not ? !r : r;
      };
      return test;
    }),
  );
  if (terms.some((a) => a.some((t) => !t))) return null;
  return (m) => terms.some((and) => and.every((t) => t!(m)));
}

/** A property filter: ":programname, isequal, "sshd"" (operators contains, isequal, startswith, regex not supported). */
function propertyFilter(text: string): { condition: Condition; rest: string } | null {
  const m = /^:([\w-]+)\s*,\s*(!?)(contains|isequal|startswith)\s*,\s*"([^"]*)"\s*(.*)$/.exec(text);
  if (!m || property({ host: '', address: '', program: '', facility: '', severity: '', text: '' }, m[1]) === null) return null;
  const [, prop, not, op, value, rest] = m;
  return {
    condition: (msg) => {
      const v = property(msg, prop)!;
      const r = op === 'contains' ? v.includes(value) : op === 'isequal' ? v.trim() === value : v.trim().startsWith(value);
      return not ? !r : r;
    },
    rest,
  };
}

/** An action: "-/var/log/syslog", "?Remote", "stop", action(type="omfile" …), ":omusrmsg:*". */
function action(text: string): ActionSpec | null {
  const t = text.trim();
  if (t === 'stop' || t === '~') return { kind: 'stop' };
  if (/^:omusrmsg:/.test(t)) return { kind: 'users' };
  const file = /^-?(\/[\w./-]+)$/.exec(t);
  if (file) return { kind: 'file', path: file[1] };
  const dyna = /^-?\?(\w+)$/.exec(t);
  if (dyna) return { kind: 'dyna', template: dyna[1] };
  const obj = /^action\s*\((.*)\)$/s.exec(t);
  if (obj) {
    const p = params(obj[1]);
    if ((p.type ?? '').toLowerCase() !== 'omfile') return null;
    if (p.dynafile) return { kind: 'dyna', template: p.dynafile };
    if (p.file) return { kind: 'file', path: p.file };
  }
  return null;
}

/** Joins the statements written over several lines (parentheses, braces), without the comments. */
function statements(text: string): { text: string; line: number }[] {
  const out: { text: string; line: number }[] = [];
  let current = '';
  let start = 0;
  let depth = 0;
  text.split('\n').forEach((raw, i) => {
    const line = raw.replace(/(^|\s)#.*$/, '').trim();
    if (!line) return;
    if (!current) start = i + 1;
    current = current ? `${current} ${line}` : line;
    depth += (line.match(/\(/g) ?? []).length - (line.match(/\)/g) ?? []).length;
    if (depth <= 0) {
      out.push({ text: current, line: start });
      current = '';
      depth = 0;
    }
  });
  if (current) out.push({ text: current, line: start });
  return out;
}

/** Reads the configuration, as rsyslogd does when it starts (or with -N1). */
export function readConfig(j: Game): Config {
  const c: Config = { modules: [], inputs: [], templates: {}, rules: [], errors: [] };
  const err = (m: string) => c.errors.push(`rsyslogd: ${m} [${VERSION}]`);
  const visit = (file: string) => {
    const text = j.read(file);
    if (text === null) return;
    let last: Condition | null = null;
    // An open "if … then {" block: its condition, until "}".
    let block: Condition | null = null;
    for (const s of statements(text)) {
      const at = `file '${file}', on or before line ${s.line}`;
      let t = s.text;
      if (block && t === '}') {
        block = null;
        continue;
      }
      const mod = /^module\s*\((.*)\)$/.exec(t) ?? /^\$ModLoad\s+(\S+)$/i.exec(t);
      if (mod) {
        const name = t.startsWith('$') ? mod[1] : params(mod[1]).load;
        if (!name || !KNOWN_MODULES.includes(name)) err(`could not load module '${name ?? ''}', errors: trying to load module /usr/lib/x86_64-linux-gnu/rsyslog/${name ?? ''}.so: cannot open shared object file: No such file or directory`);
        else if (!c.modules.includes(name)) c.modules.push(name);
        continue;
      }
      const input = /^input\s*\((.*)\)$/.exec(t);
      const legacyInput = /^\$(UDPServerRun|InputTCPServerRun)\s+(\d+)$/i.exec(t);
      if (input || legacyInput) {
        const type = legacyInput ? (/udp/i.test(legacyInput[1]) ? 'imudp' : 'imtcp') : (params(input![1]).type ?? '');
        const port = Number(legacyInput ? legacyInput[2] : (params(input![1]).port ?? '514'));
        if (!c.modules.includes(type)) err(`input module name '${type}' is unknown. Did you forget to load it?`);
        else c.inputs.push({ type, port });
        continue;
      }
      const tpl = /^template\s*\((.*)\)$/.exec(t);
      const legacyTpl = /^\$template\s+(\w+)\s*,\s*"([^"]*)"/i.exec(t);
      if (tpl || legacyTpl) {
        const p = tpl ? params(tpl[1]) : { name: legacyTpl![1], string: legacyTpl![2] };
        if (!p.name || p.string === undefined) err(`template '${p.name ?? ''}' has no string or type: parameter error in ${at}`);
        else c.templates[p.name] = p.string;
        continue;
      }
      const include = /^include\s*\((.*)\)$/.exec(t) ?? /^\$IncludeConfig\s+(\S+)$/i.exec(t);
      if (include) {
        const pattern = t.startsWith('$') ? include[1] : (params(include[1]).file ?? '');
        const dir = pattern.replace(/\/[^/]*$/, '');
        const node = j.find(dir);
        const re = new RegExp(`^${pattern.split('/').at(-1)!.replace(/\./g, '\\.').replace(/\*/g, '.*')}$`);
        if (node?.type === 'directory') for (const name of Object.keys(node.children).filter((n) => re.test(n)).sort()) visit(`${dir}/${name}`);
        continue;
      }
      // Global directives ($FileOwner, $WorkDirectory…): accepted.
      if (/^\$\w+/.test(t)) continue;
      // "if EXPR then ACTION" or "if EXPR then {".
      const iff = /^if\s+(.+?)\s+then\s*(.*)$/is.exec(t);
      if (iff) {
        const cond = expression(iff[1]);
        if (!cond) {
          err(`error during parsing file ${file}, on or before line ${s.line}: invalid character '${iff[1].trim()[0]}' in expression - is there an invalid escape sequence somewhere?`);
          continue;
        }
        if (iff[2].trim() === '{') {
          block = cond;
          last = cond;
          continue;
        }
        t = iff[2].trim();
        if (t.startsWith('{') && t.endsWith('}')) {
          const actions = t.slice(1, -1).split(/\s*;\s*|\s+(?=stop\b)|(?<=\))\s+/).map((x) => x.trim()).filter(Boolean).map(action);
          if (actions.some((a) => !a)) err(`error during parsing file ${file}, on or before line ${s.line}: syntax error`);
          else c.rules.push({ condition: cond, actions: actions as ActionSpec[] });
          last = cond;
          continue;
        }
        const a = action(t);
        if (!a) err(`error during parsing file ${file}, on or before line ${s.line}: syntax error`);
        else c.rules.push({ condition: cond, actions: [a] });
        last = cond;
        continue;
      }
      // Inside a block: its actions.
      if (block) {
        const a = action(t);
        if (!a) err(`error during parsing file ${file}, on or before line ${s.line}: syntax error`);
        else c.rules.push({ condition: block, actions: [a] });
        continue;
      }
      // "& ACTION": the previous filter again.
      if (t.startsWith('&')) {
        const a = action(t.slice(1));
        if (!a || !last) err(`error during parsing file ${file}, on or before line ${s.line}: syntax error`);
        else c.rules.push({ condition: last, actions: [a] });
        continue;
      }
      // A property filter.
      if (t.startsWith(':')) {
        const pf = propertyFilter(t);
        const a = pf && action(pf.rest);
        if (!pf || !a) err(`error during parsing file ${file}, on or before line ${s.line}: syntax error`);
        else {
          c.rules.push({ condition: pf.condition, actions: [a] });
          last = pf.condition;
        }
        continue;
      }
      // "SELECTOR ACTION".
      const sel = /^(\S+)\s+(.+)$/.exec(t);
      const cond = sel && selector(sel[1]);
      const a = sel && action(sel[2]);
      if (!cond || !a) {
        err(`invalid or yet-unknown config file command '${t.split(/\s+/)[0]}' - have you forgotten to load a module? [${VERSION} try https://www.rsyslog.com/e/3003 ]`.replace(` [${VERSION} try https://www.rsyslog.com/e/3003 ]`, ''));
        continue;
      }
      c.rules.push({ condition: cond, actions: [a] });
      last = cond;
    }
  };
  visit(CONF);
  // A dynamic file needs its template.
  for (const r of c.rules) for (const a of r.actions) if (a.kind === 'dyna' && !(a.template in c.templates)) err(`Could not find template 0 '${a.template}' - action disabled`);
  return c;
}

/** rsyslogd -N1: the validation run's output. */
export function validate(j: Game): { output: string; ok: boolean } {
  const c = readConfig(j);
  const lines = [`rsyslogd: version 8.2302.0, config validation run (level 1), master config ${CONF}`, ...c.errors, 'rsyslogd: End of config validation run. Bye.'];
  return { output: lines.join('\n'), ok: c.errors.length === 0 };
}

// ——— The messages ———

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const clock = (j: Game) => systemd(j)?.clock ?? 0;

/** A line in the traditional format: "May  2 10:14:03 eagle sshd[812]: …". */
function line(j: Game, m: Message): string {
  const d = new Date(clock(j));
  const stamp = `${MONTHS[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2)} ${d.toISOString().slice(11, 19)}`;
  return `${stamp} ${m.host} ${m.program}${m.pid ? `[${m.pid}]` : ''}: ${m.text}`;
}

/** A template's string for this message: %HOSTNAME%, %FROMHOST-IP%, %PROGRAMNAME%, %$YEAR%… */
function expand(j: Game, template: string, m: Message): string {
  const d = new Date(clock(j));
  return template.replace(/%([^%]+)%/g, (_, name: string) => {
    const n = name.toLowerCase();
    if (n === '$year') return String(d.getUTCFullYear());
    if (n === '$month') return String(d.getUTCMonth() + 1).padStart(2, '0');
    if (n === '$day') return String(d.getUTCDate()).padStart(2, '0');
    return (property(m, n) ?? '').trim();
  });
}

/** Appends a line to a file (created, with its directories, like rsyslog: root, group adm, 0640). */
function append(j: Game, path: string, text: string) {
  const g = j as Shell;
  const before = g.who;
  g.who = 'root';
  try {
    const parts = path.split('/').filter(Boolean);
    for (let i = 1; i < parts.length; i++) {
      const dir = '/' + parts.slice(0, i).join('/');
      if (!g.exists(dir)) g.place('rsyslogd', dir, { type: 'directory', children: {}, owner: 'root', mode: 'rwxr-xr-x' });
    }
    const n = g.find(path);
    if (n?.type === 'file' && typeof n.content === 'string') n.content = n.content ? `${n.content}\n${text}` : text;
    else if (!n) g.place('rsyslogd', path, { type: 'file', content: text, owner: 'root', group: 'adm', mode: 'rw-r-----', lines: true });
  } finally {
    g.who = before;
  }
}

/** A message through the rules, in order, until a stop. */
/** Where a message goes under this configuration, rule by rule until a stop (nothing is written). */
export function route(j: Game, c: Config, m: Message): string[] {
  const out: string[] = [];
  for (const r of c.rules) {
    if (!r.condition(m)) continue;
    let stop = false;
    for (const a of r.actions) {
      if (a.kind === 'stop') stop = true;
      else if (a.kind === 'file') out.push(a.path);
      else if (a.kind === 'dyna' && c.templates[a.template] !== undefined) out.push(expand(j, c.templates[a.template], m));
    }
    if (stop) break;
  }
  return out;
}

export function processMessage(j: Game, m: Message) {
  const c = rsyslog(j)?.config;
  if (!c || systemd(j)?.services.rsyslog?.state !== 'active') return;
  for (const path of route(j, c, m)) append(j, path, line(j, m));
}

/** rsyslog (re)starts: it reads its configuration; its inputs listen; errors go to its journal. */
export function startRsyslog(j: Game) {
  const r = rsyslog(j)!;
  r.config = readConfig(j);
  const sd = systemd(j)!;
  for (const e of r.config.errors) writeLog(sd, 'rsyslog.service', 'rsyslogd', 611, e.replace(/^rsyslogd: /, ''), 3);
  const listening = ((j.state.listening ??= []) as { proto: string; process: string }[]).filter((l) => l.process !== 'rsyslogd');
  for (const i of r.config.inputs)
    listening.push({ proto: i.type === 'imudp' ? 'udp' : 'tcp', address: '0.0.0.0', port: i.port, process: 'rsyslogd', pid: 611 } as never);
  j.state.listening = listening;
}

/** What the remote machines send, one message each per command: received, or lost on the way. */
export function deliver(j: Game) {
  const r = rsyslog(j);
  if (!r) return;
  const pf = j.state.ufw as Firewall | undefined;
  const active = systemd(j)?.services.rsyslog?.state === 'active';
  for (const s of r.senders) {
    const i = s.next ?? 0;
    const msg = s.messages[i % s.messages.length];
    s.next = i + 1;
    const listens = active && r.config?.inputs.some((x) => x.type === (s.proto === 'udp' ? 'imudp' : 'imtcp') && x.port === s.port);
    const through = !pf || verdict(pf, s.port, s.address) === 'accepted';
    if (listens && through) {
      r.received[s.host] = (r.received[s.host] ?? 0) + 1;
      processMessage(j, { ...msg, host: s.host, address: s.address });
    } else r.lost[s.host] = (r.lost[s.host] ?? 0) + 1;
  }
}

export { FACILITIES, SEVERITIES };
