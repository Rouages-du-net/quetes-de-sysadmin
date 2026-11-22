// Sieve (RFC 5228) as Pigeonhole 2.4 compiles and runs it: the grammar
// (strings, text: blocks, string lists, numbers with K/M/G, tags, tests,
// blocks), require and the extensions it knows (fileinto, envelope, reject,
// vacation, mailbox, copy, body), the tests address, envelope, header,
// exists, size, body, allof, anyof, not, true, false with :is, :contains,
// :matches and :all, :localpart, :domain; the actions keep, fileinto,
// redirect, discard, reject, vacation and stop; the implicit keep.
// Vacation follows RFC 5230 and Pigeonhole's checks (no reply to <>,
// MAILER-DAEMON, owner-, -request, mailing list headers, Auto-Submitted,
// Precedence bulk/junk/list, a message not addressed to the recipient or its
// :addresses, one reply per sender per :days).
// After https://www.rfc-editor.org/rfc/rfc5228, https://www.rfc-editor.org/rfc/rfc5230,
// https://doc.dovecot.org/2.4.1/core/config/sieve/extensions/vacation.html and
// https://doc.dovecot.org/2.4.1/core/man/sievec.1.html.
// Differences: no comparators other than i;ascii-casemap (the default), no
// variables, no imap4flags, no include; the compiled binary (.svbin) is the
// script's text checked, not Pigeonhole's byte code.

import type { Mail } from './dovecot';

// The capabilities Pigeonhole announces (require accepts them); the game runs those of KNOWN.
const CAPABILITIES = ['fileinto', 'envelope', 'reject', 'ereject', 'vacation', 'vacation-seconds', 'mailbox', 'copy', 'body', 'imap4flags', 'variables', 'include', 'relational', 'regex', 'date', 'index', 'duplicate', 'encoded-character', 'comparator-i;ascii-numeric', 'comparator-i;octet', 'comparator-i;ascii-casemap', 'enotify', 'environment', 'mailbox', 'spamtest', 'spamtestplus', 'virustest', 'editheader', 'subaddress', 'foreverypart', 'mime', 'extracttext', 'imapsieve', 'mboxmetadata', 'servermetadata', 'special-use', 'vnd.dovecot.debug'];

type Token =
  | { t: 'id'; v: string; line: number }
  | { t: 'tag'; v: string; line: number }
  | { t: 'num'; v: number; line: number }
  | { t: 'str'; v: string; line: number }
  | { t: 'sym'; v: string; line: number };

export interface SieveError {
  line: number;
  message: string;
}

function tokenize(text: string): { tokens: Token[]; error?: SieveError } {
  const tokens: Token[] = [];
  let i = 0;
  let line = 1;
  while (i < text.length) {
    const c = text[i];
    if (c === '\n') {
      line++;
      i++;
    } else if (/\s/.test(c)) i++;
    else if (c === '#') {
      while (i < text.length && text[i] !== '\n') i++;
    } else if (c === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      if (end < 0) return { tokens, error: { line, message: 'end of file before end of bracket comment ("/* ... */") started at line ' + line } };
      line += text.slice(i, end).split('\n').length - 1;
      i = end + 2;
    } else if (c === '"') {
      const start = line;
      let s = '';
      i++;
      while (i < text.length && text[i] !== '"') {
        if (text[i] === '\\' && i + 1 < text.length) i++;
        if (text[i] === '\n') line++;
        s += text[i++];
      }
      if (i >= text.length) return { tokens, error: { line: start, message: 'end of file before end of quoted string' } };
      i++;
      tokens.push({ t: 'str', v: s, line: start });
    } else if (/^text:/i.test(text.slice(i, i + 5))) {
      const start = line;
      const nl = text.indexOf('\n', i);
      if (nl < 0) return { tokens, error: { line, message: 'end of file before end of multi-line string' } };
      i = nl + 1;
      line++;
      const lines: string[] = [];
      for (;;) {
        const e = text.indexOf('\n', i);
        const l = e < 0 ? text.slice(i) : text.slice(i, e);
        if (l.replace(/\r$/, '') === '.') {
          i = e < 0 ? text.length : e + 1;
          line++;
          break;
        }
        if (e < 0) return { tokens, error: { line: start, message: 'end of file before end of multi-line string' } };
        lines.push(l.startsWith('..') ? l.slice(1) : l);
        i = e + 1;
        line++;
      }
      tokens.push({ t: 'str', v: lines.join('\n'), line: start });
    } else if (c === ':' && /[A-Za-z_]/.test(text[i + 1] ?? '')) {
      const m = /^:[A-Za-z_][\w-]*/.exec(text.slice(i))!;
      tokens.push({ t: 'tag', v: m[0].slice(1).toLowerCase(), line });
      i += m[0].length;
    } else if (/\d/.test(c)) {
      const m = /^(\d+)([KMG]?)/i.exec(text.slice(i))!;
      const mult: Record<string, number> = { '': 1, k: 1024, m: 1024 ** 2, g: 1024 ** 3 };
      tokens.push({ t: 'num', v: Number(m[1]) * mult[m[2].toLowerCase()], line });
      i += m[0].length;
    } else if (/[A-Za-z_]/.test(c)) {
      const m = /^[A-Za-z_][\w.-]*/.exec(text.slice(i))!;
      tokens.push({ t: 'id', v: m[0].toLowerCase(), line });
      i += m[0].length;
    } else if ('[](),;{}'.includes(c)) {
      tokens.push({ t: 'sym', v: c, line });
      i++;
    } else return { tokens, error: { line, message: `unexpected character(s) starting with '${c}'` } };
  }
  return { tokens };
}

// ——— The tree ———

export type Arg = { kind: 'str'; v: string } | { kind: 'list'; v: string[] } | { kind: 'num'; v: number } | { kind: 'tag'; v: string };
export interface Test {
  name: string;
  args: Arg[];
  tests: Test[];
  line: number;
}
export interface Command {
  name: string;
  args: Arg[];
  tests: Test[];
  block?: Command[];
  line: number;
}

function parse(tokens: Token[]): { commands: Command[]; error?: SieveError } {
  let p = 0;
  const peek = () => tokens[p];
  const describe = (t: Token | undefined) =>
    !t ? 'end of script' : t.t === 'id' ? `identifier '${t.v}'` : t.t === 'str' ? 'string' : t.t === 'num' ? 'number' : t.t === 'tag' ? `tag ':${t.v}'` : `'${t.v}'`;
  const fail = (message: string): never => {
    throw { line: peek()?.line ?? tokens[tokens.length - 1]?.line ?? 1, message } as SieveError;
  };
  const args = (): Arg[] => {
    const out: Arg[] = [];
    for (;;) {
      const t = peek();
      if (!t) return out;
      if (t.t === 'str') {
        out.push({ kind: 'str', v: t.v });
        p++;
      } else if (t.t === 'num') {
        out.push({ kind: 'num', v: t.v });
        p++;
      } else if (t.t === 'tag') {
        out.push({ kind: 'tag', v: t.v });
        p++;
      } else if (t.t === 'sym' && t.v === '[') {
        p++;
        const list: string[] = [];
        for (;;) {
          const s = peek();
          if (s?.t !== 'str') fail(`expected string, but found ${describe(s)}`);
          list.push((s as { v: string }).v);
          p++;
          const n = peek();
          if (n?.t === 'sym' && n.v === ',') {
            p++;
            continue;
          }
          if (n?.t === 'sym' && n.v === ']') {
            p++;
            break;
          }
          fail(`expected ',' or end of string list ']', but found ${describe(n)}`);
        }
        out.push({ kind: 'list', v: list });
      } else return out;
    }
  };
  const test = (): Test => {
    const t = peek();
    if (t?.t !== 'id') fail(`expected test identifier, but found ${describe(t)}`);
    p++;
    const a = args();
    const tests: Test[] = [];
    const n = peek();
    if (n?.t === 'sym' && n.v === '(') {
      p++;
      for (;;) {
        tests.push(test());
        const s = peek();
        if (s?.t === 'sym' && s.v === ',') {
          p++;
          continue;
        }
        if (s?.t === 'sym' && s.v === ')') {
          p++;
          break;
        }
        fail(`expected ',' or end of test list ')', but found ${describe(s)}`);
      }
    } else if (n?.t === 'id') tests.push(test());
    return { name: (t as { v: string }).v, args: a, tests, line: t!.line };
  };
  const commands = (inBlock: boolean): Command[] => {
    const out: Command[] = [];
    for (;;) {
      const t = peek();
      if (!t) {
        if (inBlock) fail("expected end of block '}', but found end of script");
        return out;
      }
      if (t.t === 'sym' && t.v === '}' && inBlock) return out;
      if (t.t !== 'id') fail(`expected command identifier, but found ${describe(t)}`);
      p++;
      const a = args();
      const tests: Test[] = [];
      const n = peek();
      if (n?.t === 'id') tests.push(test());
      else if (n?.t === 'sym' && n.v === '(') {
        p++;
        for (;;) {
          tests.push(test());
          const s = peek();
          if (s?.t === 'sym' && s.v === ',') {
            p++;
            continue;
          }
          if (s?.t === 'sym' && s.v === ')') {
            p++;
            break;
          }
          fail(`expected ',' or end of test list ')', but found ${describe(s)}`);
        }
      }
      const e = peek();
      const cmd: Command = { name: (t as { v: string }).v, args: a, tests, line: t.line };
      if (e?.t === 'sym' && e.v === ';') p++;
      else if (e?.t === 'sym' && e.v === '{') {
        p++;
        cmd.block = commands(true);
        p++;
      } else fail(`expected end of command ';' or the beginning of a compound block '{', but found ${describe(e)}`);
      out.push(cmd);
    }
  };
  try {
    return { commands: commands(false) };
  } catch (e) {
    return { commands: [], error: e as SieveError };
  }
}

// ——— Validation ———

interface Spec {
  ext?: string;
  tags?: Record<string, 'flag' | 'str' | 'num' | 'list'>;
  // Positional arguments: their kinds.
  positional: ('str' | 'list' | 'strlist' | 'num')[];
  tests?: 'one' | 'list' | 'none';
  block?: boolean;
}
const MATCH = { is: 'flag', contains: 'flag', matches: 'flag', comparator: 'str', all: 'flag', localpart: 'flag', domain: 'flag', user: 'flag', detail: 'flag' } as const;
const COMMANDS: Record<string, Spec> = {
  require: { positional: ['strlist'] },
  if: { positional: [], tests: 'one', block: true },
  elsif: { positional: [], tests: 'one', block: true },
  else: { positional: [], block: true },
  stop: { positional: [] },
  keep: { positional: [] },
  discard: { positional: [] },
  fileinto: { ext: 'fileinto', tags: { copy: 'flag', create: 'flag' }, positional: ['str'] },
  redirect: { tags: { copy: 'flag' }, positional: ['str'] },
  reject: { ext: 'reject', positional: ['str'] },
  vacation: { ext: 'vacation', tags: { days: 'num', seconds: 'num', subject: 'str', from: 'str', addresses: 'list', mime: 'flag', handle: 'str' }, positional: ['str'] },
};
const TESTS: Record<string, Spec> = {
  address: { tags: MATCH, positional: ['strlist', 'strlist'] },
  envelope: { ext: 'envelope', tags: MATCH, positional: ['strlist', 'strlist'] },
  header: { tags: MATCH, positional: ['strlist', 'strlist'] },
  exists: { positional: ['strlist'] },
  size: { tags: { over: 'flag', under: 'flag' }, positional: ['num'] },
  body: { ext: 'body', tags: { ...MATCH, raw: 'flag', text: 'flag', content: 'list' }, positional: ['strlist'] },
  allof: { positional: [], tests: 'list' },
  anyof: { positional: [], tests: 'list' },
  not: { positional: [], tests: 'one' },
  true: { positional: [] },
  false: { positional: [] },
};

function validate(commands: Command[], required: Set<string>, top: boolean, previous: () => string | null): SieveError | null {
  let last: string | null = previous();
  for (const c of commands) {
    const spec = COMMANDS[c.name];
    if (!spec || (spec.ext && !required.has(spec.ext))) return { line: c.line, message: `unknown command '${c.name}'` };
    if (!spec.tests && c.tests.length) return { line: c.line, message: `expected end of command ';' or the beginning of a compound block '{', but found identifier '${c.tests[0].name}'` };
    if (c.name === 'require') {
      if (!top || last !== null && last !== 'require') return { line: c.line, message: 'require commands can only be placed at top level at the beginning of the file' };
      const a = c.args[0];
      const caps = a?.kind === 'str' ? [a.v] : a?.kind === 'list' ? a.v : null;
      if (!caps) return { line: c.line, message: "the require command expects a string list (capabilities) as first positional argument, but none was found" };
      for (const cap of caps) {
        if (!CAPABILITIES.includes(cap.toLowerCase())) return { line: c.line, message: `require command: unknown Sieve capability '${cap}'` };
        required.add(cap.toLowerCase());
        if (cap.toLowerCase() === 'vacation-seconds') required.add('vacation');
      }
      last = 'require';
      continue;
    }
    if ((c.name === 'elsif' || c.name === 'else') && last !== 'if' && last !== 'elsif') return { line: c.line, message: `${c.name} command must follow an if or elseif command` };
    const e = checkArgs(c.name, 'command', spec, c, required);
    if (e) return e;
    if (spec.block && !c.block) return { line: c.line, message: `the ${c.name} command requires a command block` };
    if (!spec.block && c.block) return { line: c.line, message: `the ${c.name} command does not expect a block` };
    if (c.block) {
      const inner = validate(c.block, required, false, () => null);
      if (inner) return inner;
    }
    last = c.name;
  }
  return null;
}

function checkArgs(name: string, what: 'command' | 'test', spec: Spec, c: Command | Test, required: Set<string>): SieveError | null {
  const positional: Arg[] = [];
  for (let i = 0; i < c.args.length; i++) {
    const a = c.args[i];
    if (a.kind !== 'tag') {
      positional.push(a);
      continue;
    }
    const kind = spec.tags?.[a.v];
    const needsExt = (a.v === 'create' && !required.has('mailbox')) || (a.v === 'copy' && !required.has('copy')) || (a.v === 'seconds' && !required.has('vacation-seconds'));
    if (!kind || needsExt) return { line: c.line, message: `unknown tagged argument ':${a.v}' for the ${name} ${what} (reported only once at first occurrence)` };
    if (kind !== 'flag') {
      const v = c.args[i + 1];
      const ok = v && ((kind === 'num' && v.kind === 'num') || (kind === 'str' && v.kind === 'str') || (kind === 'list' && (v.kind === 'list' || v.kind === 'str')));
      if (!ok) return { line: c.line, message: `the :${a.v} tag for the ${name} ${what} requires one ${kind === 'num' ? 'number' : kind === 'list' ? 'string list' : 'string'} argument, but ${v ? 'something else' : 'none'} was found` };
      i++;
    }
  }
  if (positional.length !== spec.positional.length) {
    const kind = spec.positional[positional.length] ?? spec.positional[spec.positional.length - 1];
    const label = kind === 'num' ? 'number' : kind === 'str' ? 'string' : 'string list';
    return positional.length < spec.positional.length
      ? { line: c.line, message: `the ${name} ${what} expects ${spec.positional.length === 1 ? 'a' : 'more'} ${label} as positional argument${spec.positional.length > 1 ? 's' : ''}, but none was found` }
      : { line: c.line, message: `the ${name} ${what} expects ${spec.positional.length ? spec.positional.length : 'no'} positional argument${spec.positional.length === 1 ? '' : 's'}, but more were found` };
  }
  for (let i = 0; i < positional.length; i++) {
    const want = spec.positional[i];
    const a = positional[i];
    const ok = (want === 'num' && a.kind === 'num') || (want === 'str' && a.kind === 'str') || ((want === 'list' || want === 'strlist') && (a.kind === 'list' || a.kind === 'str'));
    if (!ok) return { line: c.line, message: `the ${name} ${what} expects a ${want === 'num' ? 'number' : want === 'str' ? 'string' : 'string list'} as positional argument ${i + 1}, but ${a.kind === 'num' ? 'a number' : 'a string list'} was found` };
  }
  if (spec.tests === 'one' && c.tests.length !== 1) return { line: c.line, message: `the ${name} ${what} requires one test argument, but ${c.tests.length ? 'more' : 'none'} were found` };
  if (spec.tests === 'list' && !c.tests.length) return { line: c.line, message: `the ${name} test requires a test list as argument` };
  if (!spec.tests && c.tests.length) return { line: c.line, message: `the ${name} ${what} accepts no test argument` };
  for (const t of c.tests) {
    const ts = TESTS[t.name];
    if (!ts || (ts.ext && !required.has(ts.ext))) return { line: t.line, message: `unknown test '${t.name}'` };
    const e = checkArgs(t.name, 'test', ts, t, required);
    if (e) return e;
  }
  return null;
}

export interface Compiled {
  ok: boolean;
  program?: { commands: Command[]; required: string[] };
  errors: string[];
}

/** Compiles a script like sievec: the errors, each "name: line N: error: …", then what failed. */
export function compile(text: string, name: string): Compiled {
  const { tokens, error } = tokenize(text);
  if (error) return { ok: false, errors: [`${name}: line ${error.line}: error: ${error.message}.`, `${name}: error: parse failed.`] };
  const parsed = parse(tokens);
  if (parsed.error) return { ok: false, errors: [`${name}: line ${parsed.error.line}: error: ${parsed.error.message}.`, `${name}: error: parse failed.`] };
  const required = new Set<string>();
  const v = validate(parsed.commands, required, true, () => null);
  if (v) return { ok: false, errors: [`${name}: line ${v.line}: error: ${v.message}.`, `${name}: error: validation failed.`] };
  return { ok: true, program: { commands: parsed.commands, required: [...required] }, errors: [] };
}

// ——— Running ———

export type SieveAction =
  | { type: 'fileinto'; mailbox: string; create: boolean; copy: boolean }
  | { type: 'redirect'; to: string; copy: boolean }
  | { type: 'reject'; reason: string }
  | { type: 'discard' }
  | { type: 'vacation'; sent: boolean; to: string; subject: string; reason: string; why: string; days: number; from?: string; text: string; handle?: string };

export interface SieveResult {
  actions: SieveAction[];
  keep: boolean;
}

export interface Envelope {
  from: string;
  to: string;
  // The original recipient (an alias).
  orig?: string;
  user: string;
  now: number;
  // Vacation's memory (.dovecot.lda-dupes): sender (and handle) → time of the last reply.
  dupes: Record<string, number>;
  // sieve-test doesn't send: vacation is printed without its checks.
  dryRun?: boolean;
}

const strings = (a: Arg | undefined): string[] => (!a ? [] : a.kind === 'str' ? [a.v] : a.kind === 'list' ? a.v : []);
const tagged = (args: Arg[], tag: string): Arg | undefined => {
  const i = args.findIndex((a) => a.kind === 'tag' && a.v === tag);
  return i >= 0 ? args[i + 1] : undefined;
};
const has = (args: Arg[], tag: string) => args.some((a) => a.kind === 'tag' && a.v === tag);
const positional = (args: Arg[]): Arg[] => {
  const out: Arg[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.kind === 'tag') {
      if (['comparator', 'days', 'seconds', 'subject', 'from', 'addresses', 'handle', 'content'].includes(a.v)) i++;
      continue;
    }
    out.push(a);
  }
  return out;
};

const glob = (pattern: string, value: string) => new RegExp('^' + pattern.replace(/[.+^$()|[\]{}\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'is').test(value);
function matches(args: Arg[], values: string[], keys: string[]): boolean {
  const type = has(args, 'contains') ? 'contains' : has(args, 'matches') ? 'matches' : 'is';
  return values.some((v) =>
    keys.some((k) => {
      const a = v.toLowerCase();
      const b = k.toLowerCase();
      return type === 'is' ? a === b : type === 'contains' ? a.includes(b) : glob(b, a);
    }),
  );
}
const headerValues = (m: Mail, name: string) => m.headers.filter(([k]) => k.toLowerCase() === name.toLowerCase()).map(([, v]) => v);
const addressList = (value: string) => [...value.matchAll(/<([^<>]*)>|([^\s,<>"]+@[^\s,<>"]+)/g)].map((x) => (x[1] ?? x[2]).trim());
const part = (args: Arg[], address: string) => {
  if (has(args, 'localpart')) return address.replace(/@.*$/, '');
  if (has(args, 'domain')) return address.includes('@') ? address.replace(/^.*@/, '') : '';
  return address;
};

function test(t: Test, m: Mail, env: Envelope): boolean {
  const pos = positional(t.args);
  switch (t.name) {
    case 'true':
      return true;
    case 'false':
      return false;
    case 'not':
      return !test(t.tests[0], m, env);
    case 'allof':
      return t.tests.every((x) => test(x, m, env));
    case 'anyof':
      return t.tests.some((x) => test(x, m, env));
    case 'exists':
      return strings(pos[0]).every((h) => headerValues(m, h).length > 0);
    case 'size': {
      const size = m.size ?? m.headers.reduce((n, [k, v]) => n + k.length + v.length + 3, 0) + m.body.length;
      const limit = (pos[0] as { v: number }).v;
      return has(t.args, 'over') ? size > limit : size < limit;
    }
    case 'header':
      return matches(t.args, strings(pos[0]).flatMap((h) => headerValues(m, h)), strings(pos[1]));
    case 'address':
      return matches(
        t.args,
        strings(pos[0]).flatMap((h) => headerValues(m, h).flatMap(addressList)).map((a) => part(t.args, a)),
        strings(pos[1]),
      );
    case 'envelope': {
      const values = strings(pos[0]).flatMap((p) => (p.toLowerCase() === 'from' ? [env.from] : p.toLowerCase() === 'to' ? [env.orig ?? env.to] : []));
      return matches(t.args, values.map((a) => part(t.args, a)), strings(pos[1]));
    }
    case 'body':
      return matches(t.args, [m.body], strings(pos[0]));
  }
  return false;
}

const SYSTEM_SENDER = (s: string) => /^(mailer-daemon|listserv|majordomo)/i.test(s) || s.includes('-request') || s.startsWith('owner-');
const LIST_HEADERS = ['list-id', 'list-owner', 'list-subscribe', 'list-post', 'list-unsubscribe', 'list-help', 'list-archive'];
const DAY = 86_400_000;

/** Vacation's decision (RFC 5230 and Pigeonhole's checks). */
function vacation(c: Command, m: Mail, env: Envelope): SieveAction {
  const pos = positional(c.args);
  const reason = (pos[0] as { v: string }).v;
  const days = Math.min(60, Math.max(1, (tagged(c.args, 'days') as { v: number } | undefined)?.v ?? 7));
  const subjectTag = (tagged(c.args, 'subject') as { v: string } | undefined)?.v;
  const original = headerValues(m, 'Subject')[0] ?? '';
  const subject = subjectTag ?? `Auto: ${original}`;
  const addresses = strings(tagged(c.args, 'addresses')).map((a) => a.toLowerCase());
  const handle = (tagged(c.args, 'handle') as { v: string } | undefined)?.v;
  const from = env.from.toLowerCase();
  const base = { type: 'vacation' as const, to: env.from, subject, reason: '', why: '', days, text: reason, from: (tagged(c.args, 'from') as { v: string } | undefined)?.v, handle };
  const skip = (code: string, why: string): SieveAction => ({ ...base, sent: false, reason: code, why });
  if (env.dryRun) return { ...base, sent: true };
  if (!from || from === '<>') return skip('null-sender', 'discarded vacation reply to <>');
  if (from === env.to.toLowerCase()) return skip('self', `discarding vacation response to own address <${env.from}>`);
  if (SYSTEM_SENDER(from)) return skip('system', `not sending vacation response to system address <${env.from}>`);
  if (m.headers.some(([k]) => LIST_HEADERS.includes(k.toLowerCase()))) return skip('list', `discarding vacation response to mailinglist recipient <${env.from}>`);
  const auto = headerValues(m, 'Auto-Submitted')[0];
  if (auto && auto.trim().toLowerCase() !== 'no') return skip('auto', `discarding vacation response to auto-submitted message from <${env.from}>`);
  const prec = (headerValues(m, 'Precedence')[0] ?? '').trim().toLowerCase();
  if (['junk', 'bulk', 'list'].includes(prec)) return skip('precedence', `discarding vacation response to precedence=${prec} message from <${env.from}>`);
  const mine = [env.to.toLowerCase(), ...addresses];
  const seen = ['to', 'cc', 'bcc', 'resent-to', 'resent-cc', 'resent-bcc'].flatMap((h) => headerValues(m, h).flatMap(addressList)).map((a) => a.toLowerCase());
  if (!seen.some((a) => mine.includes(a)))
    return skip(
      'implicit',
      `discarding vacation response for implicitly delivered message; no known (envelope) recipient address found in message headers (recipient=<${env.to}>${addresses.length ? '' : ", and no additional `:addresses' are specified"})`,
    );
  const key = `${handle ?? reason}\u0000${from}`;
  const last = env.dupes[key];
  if (last !== undefined && env.now - last < days * DAY) return skip('duplicate', `discarded duplicate vacation response to <${env.from}>`);
  env.dupes[key] = env.now;
  return { ...base, sent: true };
}

/** Runs a compiled script on a message: its actions and whether the implicit keep stays. */
export function execute(program: { commands: Command[] }, m: Mail, env: Envelope): SieveResult {
  const actions: SieveAction[] = [];
  let keep = true;
  let explicitKeep = false;
  let stopped = false;
  const run = (commands: Command[]) => {
    let taken = false;
    for (const c of commands) {
      if (stopped) return;
      if (c.name === 'if') {
        taken = test(c.tests[0], m, env);
        if (taken) run(c.block!);
        continue;
      }
      if (c.name === 'elsif') {
        if (!taken) {
          taken = test(c.tests[0], m, env);
          if (taken) run(c.block!);
        }
        continue;
      }
      if (c.name === 'else') {
        if (!taken) run(c.block!);
        taken = true;
        continue;
      }
      const pos = positional(c.args);
      switch (c.name) {
        case 'stop':
          stopped = true;
          return;
        case 'keep':
          explicitKeep = true;
          break;
        case 'discard':
          keep = false;
          actions.push({ type: 'discard' });
          break;
        case 'fileinto':
          actions.push({ type: 'fileinto', mailbox: (pos[0] as { v: string }).v, create: has(c.args, 'create'), copy: has(c.args, 'copy') });
          if (!has(c.args, 'copy')) keep = false;
          break;
        case 'redirect':
          actions.push({ type: 'redirect', to: (pos[0] as { v: string }).v, copy: has(c.args, 'copy') });
          if (!has(c.args, 'copy')) keep = false;
          break;
        case 'reject':
          actions.push({ type: 'reject', reason: (pos[0] as { v: string }).v });
          keep = false;
          break;
        case 'vacation':
          if (!actions.some((a) => a.type === 'vacation')) actions.push(vacation(c, m, env));
          break;
      }
    }
  };
  run(program.commands);
  return { actions, keep: keep || explicitKeep };
}

/** sieve-test's report of what would be done. */
export function printResult(r: SieveResult, defaultMailbox = 'INBOX'): string {
  const lines = ['', 'Performed actions:', ''];
  const performed: string[] = [];
  for (const a of r.actions) {
    if (a.type === 'fileinto') performed.push(` * store message in folder: ${a.mailbox}`);
    else if (a.type === 'redirect') performed.push(` * redirect message to: ${a.to}`);
    else if (a.type === 'reject') performed.push(` * reject message with reason: ${a.reason}`);
    else if (a.type === 'vacation')
      performed.push(
        ` * send vacation message:`,
        `    => seconds : ${a.days * 86400}`,
        ...(a.subject ? [`    => subject : ${a.subject}`] : []),
        ...(a.from ? [`    => from    : ${a.from}`] : []),
        ...(a.handle ? [`    => handle  : ${a.handle}`] : []),
        '',
        'START MESSAGE',
        a.text,
        'END MESSAGE',
      );
  }
  lines.push(...(performed.length ? performed : ['  (none)']), '', 'Implicit keep:', '', r.keep ? ` * store message in folder: ${defaultMailbox}` : '  (none)', '', 'info: final result: success');
  return lines.join('\n');
}
