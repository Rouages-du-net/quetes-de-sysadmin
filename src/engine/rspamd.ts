// A machine's rspamd 3.12 (Debian 13's package): its configuration in UCL
// (local.d/ and override.d/ over the defaults, read when rspamd starts or
// reloads; rspamadm configtest), the actions and their thresholds
// (reject, add_header, rewrite_subject, greylist), the symbols a message
// gets (computed from its headers, its body and the story's network:
// reverse DNS, SPF, DKIM, DMARC, URLs, a DNS blocklist), the Bayes
// classifier (Redis, min_learns, learn_spam and learn_ham on tokens), the
// multimap module (from, rcpt, ip, header maps; score or action) and
// settings (from, rcpt, ip; apply actions, want_spam), the greylist module,
// the milter's answer to Postfix and the log /var/log/rspamd/rspamd.log.
// After https://docs.rspamd.com/configuration/metrics/,
// https://docs.rspamd.com/modules/multimap/, https://docs.rspamd.com/configuration/settings/,
// https://docs.rspamd.com/configuration/statistic/ and
// https://docs.rspamd.com/tutorials/integration/.
//
//   state.rspamd = { loaded: the configuration in use (null: stopped),
//     bayes: tokens learned per class, learned: message ids learned,
//     stats: the scans by action, greylist: the triplets seen, net: the
//     story's senders (reverse DNS, SPF, DKIM, blocklists) }
//
// Differences: symbols come from a set of rules the game knows (their
// weights are rspamd's defaults or close), not from rspamd's rules; Bayes
// is a plain naive Bayes on words; no fuzzy storage, no neural network.

import type { Game } from './shell';
import { systemd, writeLog as journal } from './systemd';
import { header, parseMail, type Mail } from './dovecot';

export const RSPAMD_LOG = '/var/log/rspamd/rspamd.log';
export const VERSION = '3.12.1';

// ——— UCL ———

export type Ucl = string | number | boolean | null | Ucl[] | { [k: string]: Ucl };
export interface UclError {
  line: number;
  column: number;
  message: string;
}

/** Reads UCL as rspamd writes it: key = value; key { … }; [lists]; comments # and /* *\/. */
export function readUcl(text: string): { value: Record<string, Ucl>; error?: UclError } {
  let i = 0;
  let line = 1;
  let col = 1;
  const fail = (message: string): never => {
    throw { line, column: col, message } as UclError;
  };
  const advance = () => {
    if (text[i] === '\n') {
      line++;
      col = 1;
    } else col++;
    i++;
  };
  const space = () => {
    for (;;) {
      while (i < text.length && /\s/.test(text[i])) advance();
      if (text[i] === '#') while (i < text.length && text[i] !== '\n') advance();
      else if (text[i] === '/' && text[i + 1] === '*') {
        while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) advance();
        advance();
        advance();
      } else return;
    }
  };
  const word = (): string => {
    space();
    if (text[i] === '"' || text[i] === "'") {
      const q = text[i];
      advance();
      let s = '';
      while (i < text.length && text[i] !== q) {
        if (text[i] === '\\') advance();
        if (text[i] === '\n') fail('unexpected newline');
        s += text[i];
        advance();
      }
      if (i >= text.length) fail('unfinished json string');
      advance();
      return s;
    }
    const m = /^[^\s=:;,{}[\]"#]+/.exec(text.slice(i));
    if (!m) fail(text[i] === undefined ? 'unexpected end of file' : `unexpected symbol`);
    for (let k = 0; k < m![0].length; k++) advance();
    return m![0];
  };
  const scalar = (raw: string, quoted: boolean): Ucl => {
    if (quoted) return raw;
    if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
    if (/^(true|yes|on)$/i.test(raw)) return true;
    if (/^(false|no|off)$/i.test(raw)) return false;
    if (/^null$/i.test(raw)) return null;
    return raw;
  };
  const value = (): Ucl => {
    space();
    if (text[i] === '{') {
      advance();
      return object(true);
    }
    if (text[i] === '[') {
      advance();
      const list: Ucl[] = [];
      for (;;) {
        space();
        if (text[i] === ']') {
          advance();
          return list;
        }
        list.push(value());
        space();
        if (text[i] === ',') advance();
      }
    }
    const quoted = text[i] === '"' || text[i] === "'";
    return scalar(word(), quoted);
  };
  const object = (inner: boolean): Record<string, Ucl> => {
    const o: Record<string, Ucl> = {};
    for (;;) {
      space();
      if (i >= text.length) {
        if (inner) fail('unexpected end of file, expected }');
        return o;
      }
      if (text[i] === '}') {
        if (!inner) fail('unexpected symbol');
        advance();
        return o;
      }
      if (text[i] === ';' || text[i] === ',') {
        advance();
        continue;
      }
      const key = word();
      space();
      let v: Ucl;
      if (text[i] === '=' || text[i] === ':') {
        advance();
        v = value();
      } else if (text[i] === '{') {
        advance();
        v = object(true);
      } else {
        // A named object: key "name" { … }.
        const name = word();
        space();
        if (text[i] !== '{') fail('delimiter is missing');
        advance();
        const inside = object(true);
        const existing = (o[key] ?? {}) as Record<string, Ucl>;
        existing[name] = inside;
        v = existing;
      }
      o[key] = key in o && typeof o[key] === 'object' && o[key] !== null && !Array.isArray(o[key]) && typeof v === 'object' && v !== null && !Array.isArray(v) ? { ...(o[key] as object), ...(v as object) } : v;
      space();
      if (text[i] === ';' || text[i] === ',') advance();
      else if (i < text.length && text[i] !== '}' && typeof v !== 'object') fail('delimiter is missing');
    }
  };
  try {
    return { value: object(false) };
  } catch (e) {
    return { value: {}, error: e as UclError };
  }
}

// ——— Configuration ———

export interface MapRule {
  symbol: string;
  type: string;
  filter?: string;
  extract?: string;
  header?: string;
  entries: string[];
  score: number;
  action?: string;
}
export interface SettingsRule {
  name: string;
  from: string[];
  fromMime: string[];
  rcpt: string[];
  ip: string[];
  wantSpam: boolean;
  actions: Record<string, number | null>;
}
export interface RspamdConf {
  actions: Record<string, number | null>;
  multimap: MapRule[];
  settings: SettingsRule[];
  minLearns: number;
}

const DEFAULT_ACTIONS: Record<string, number | null> = { reject: 15, add_header: 6, greylist: 4, rewrite_subject: null };
const ACTION_NAMES: Record<string, string> = { reject: 'reject', add_header: 'add header', 'add header': 'add header', rewrite_subject: 'rewrite subject', 'rewrite subject': 'rewrite subject', greylist: 'greylist', no_action: 'no action' };
export const LOCAL = '/etc/rspamd/local.d';
export const OVERRIDE = '/etc/rspamd/override.d';

const asNumber = (v: Ucl): number | null => (typeof v === 'number' ? v : v === null ? null : typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : null);
const list = (v: Ucl | undefined): string[] => (v === undefined || v === null ? [] : Array.isArray(v) ? v.map(String) : [String(v)]);

/** A map's entries: a file (one per line, comments #), or an inline list. */
function mapEntries(game: Game, v: Ucl | undefined): string[] {
  const sources = list(v);
  return sources.flatMap((s) => {
    if (/^(https?|redis|cdb):/.test(s)) return [];
    const path = s.replace(/^(fallback\+)?file:\/\//, '');
    const text = game.read(path) ?? '';
    return text
      .split('\n')
      .map((l) => l.replace(/#.*$/, '').trim().split(/\s+/)[0] ?? '')
      .filter(Boolean)
      .map((x) => x.toLowerCase());
  });
}

/** Reads the configuration like rspamd at start: errors as rspamadm configtest says them. */
export function readConfig(game: Game): { conf: RspamdConf; errors: string[] } {
  const errors: string[] = [];
  const read = (file: string): Record<string, Ucl> => {
    const text = game.read(file);
    if (text === null) return {};
    const r = readUcl(text);
    if (r.error) errors.push(`ucl parser error: error while parsing ${file}: line: ${r.error.line}, column: ${r.error.column} - '${r.error.message}'`);
    return r.value;
  };
  const both = (name: string) => ({ ...read(`${LOCAL}/${name}`), ...read(`${OVERRIDE}/${name}`) });
  const actions: Record<string, number | null> = { ...DEFAULT_ACTIONS };
  const a = both('actions.conf');
  if ('actions' in a && typeof a.actions === 'object') errors.push(`${LOCAL}/actions.conf: nested section "actions": the file is already included inside the actions section`);
  for (const [k, v] of Object.entries(a)) {
    const key = k.replace(/ /g, '_');
    if (key in DEFAULT_ACTIONS || key === 'no_action') actions[key] = asNumber(v);
  }
  const multimap: MapRule[] = [];
  for (const [symbol, raw] of Object.entries(both('multimap.conf'))) {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) continue;
    const r = raw as Record<string, Ucl>;
    if (!r.type) {
      errors.push(`multimap: rule ${symbol} has no type`);
      continue;
    }
    multimap.push({
      symbol,
      type: String(r.type),
      filter: r.filter !== undefined ? String(r.filter) : undefined,
      extract: r.extract_from !== undefined ? String(r.extract_from) : undefined,
      header: r.header !== undefined ? String(r.header) : undefined,
      entries: r.map !== undefined ? mapEntries(game, r.map) : [],
      score: asNumber(r.score ?? 0) ?? 0,
      action: r.action !== undefined ? String(r.action) : undefined,
    });
  }
  const settings: SettingsRule[] = [];
  for (const [name, raw] of Object.entries(both('settings.conf'))) {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) continue;
    const r = raw as Record<string, Ucl>;
    const apply = (r.apply ?? {}) as Record<string, Ucl>;
    const acts: Record<string, number | null> = {};
    for (const [k, v] of Object.entries((apply.actions ?? {}) as Record<string, Ucl>)) acts[k.replace(/ /g, '_')] = asNumber(v);
    settings.push({ name, from: list(r.from).map((x) => x.toLowerCase()), fromMime: list(r.from_mime).map((x) => x.toLowerCase()), rcpt: list(r.rcpt).map((x) => x.toLowerCase()), ip: list(r.ip), wantSpam: r.want_spam === true, actions: acts });
  }
  const bayes = both('classifier-bayes.conf');
  const minLearns = asNumber(bayes.min_learns ?? 200) ?? 200;
  return { conf: { actions, multimap, settings, minLearns }, errors };
}

// ——— The story's network: what rspamd learns about a sender ———

export interface Sender {
  // Reverse DNS of the address (absent: none).
  rdns?: string;
  // Listed in a DNS blocklist the default configuration queries.
  listed?: string[];
}
export interface Domain {
  // The addresses its SPF record allows (absent: no SPF record).
  spf?: string[];
  // Its DMARC policy (absent: none).
  dmarc?: 'none' | 'quarantine' | 'reject';
  // The domains whose DKIM signatures verify.
}
export interface RspamdNet {
  senders: Record<string, Sender>;
  domains: Record<string, Domain>;
  // Domains whose DKIM signatures verify (the others fail).
  dkim: string[];
}

// ——— State ———

export interface RspamdState {
  loaded: RspamdConf | null;
  bayes: { spam: Record<string, number>; ham: Record<string, number> };
  learned: Record<string, 'spam' | 'ham'>;
  counts: { spam: number; ham: number };
  stats: Record<string, number>;
  scanned: number;
  greylist: Record<string, number>;
  net: RspamdNet;
  // What the chapters look at: scans and learns asked by the player.
  asked: { symbols: number; learn: string[] };
}

export const rspamd = (game: Game): RspamdState | undefined => game.state.rspamd as RspamdState | undefined;
export const newRspamd = (net: RspamdNet): RspamdState => ({
  loaded: null,
  bayes: { spam: {}, ham: {} },
  learned: {},
  counts: { spam: 0, ham: 0 },
  stats: {},
  scanned: 0,
  greylist: {},
  net,
  asked: { symbols: 0, learn: [] },
});
export const rspamdRunning = (game: Game) => systemd(game)?.services.rspamd?.state === 'active' && !!rspamd(game)?.loaded;

export function attachRspamd(game: Game) {
  const svc = systemd(game)?.services.rspamd;
  if (!svc) return;
  svc.check = (g) => {
    const r = readConfig(g);
    return r.errors.length ? [...r.errors.map((e) => `cfg; rspamd_config_read: ${e}`), 'main; rspamd_main: cannot load config, exiting'] : null;
  };
  svc.checkToReload = true;
  svc.load = (g) => {
    const st = rspamd(g);
    if (st) st.loaded = readConfig(g).conf;
  };
  svc.stop = (g) => {
    const st = rspamd(g);
    if (st) st.loaded = null;
  };
}

// ——— Scanning ———

export interface Symbol {
  name: string;
  score: number;
  options?: string[];
}
export interface Scan {
  symbols: Symbol[];
  score: number;
  required: number;
  action: string;
  isSpam: boolean;
  bayes?: number;
  msgid: string;
}

const tokens = (m: Mail): string[] => {
  const subject = header(m, 'Subject').join(' ');
  return [...new Set(`${subject} ${m.body}`.toLowerCase().replace(/<[^>]+>/g, ' ').match(/\p{L}{4,}/gu) ?? [])].slice(0, 400);
};

/** The Bayes probability that a message is spam (null: not enough learns, or nothing known). */
export function bayes(st: RspamdState, m: Mail, minLearns: number): number | null {
  if (st.counts.spam < minLearns || st.counts.ham < minLearns) return null;
  let sum = 0;
  let n = 0;
  for (const tok of tokens(m)) {
    const s = st.bayes.spam[tok] ?? 0;
    const h = st.bayes.ham[tok] ?? 0;
    if (s + h < 2) continue;
    const ps = (s + 0.5) / (st.counts.spam + 1);
    const ph = (h + 0.5) / (st.counts.ham + 1);
    sum += Math.log(ps / ph);
    n++;
  }
  if (n < 3) return null;
  return 1 / (1 + Math.exp(-sum / Math.sqrt(n)));
}

export function learn(st: RspamdState, m: Mail, cls: 'spam' | 'ham'): 'ok' | 'already' {
  const id = header(m, 'Message-ID')[0] ?? tokens(m).slice(0, 12).join(' ');
  const before = st.learned[id];
  if (before === cls) return 'already';
  const add = (c: 'spam' | 'ham', d: number) => {
    for (const tok of tokens(m)) st.bayes[c][tok] = Math.max(0, (st.bayes[c][tok] ?? 0) + d);
    st.counts[c] += d;
  };
  // Learned in the other class before: rspamd relearns it (unlearn, then learn).
  if (before) add(before, -1);
  add(cls, 1);
  st.learned[id] = cls;
  return 'ok';
}

const domainOf = (a: string) => (/@([^>\s]+)>?\s*$/.exec(a)?.[1] ?? '').toLowerCase();
const addrOf = (v: string) => (/<([^>]*)>/.exec(v)?.[1] ?? v.trim()).toLowerCase();
const orgOf = (d: string) => d.split('.').slice(-2).join('.');
const inNet = (ip: string, cidr: string) => {
  const [base, bits = '32'] = cidr.split('/');
  const n = (x: string) => x.split('.').reduce((t, o) => t * 256 + Number(o), 0);
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(base) || !/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return base === ip;
  const mask = Number(bits) === 0 ? 0 : 2 ** 32 - 2 ** (32 - Number(bits));
  return (n(base) & mask) >>> 0 === (n(ip) & mask) >>> 0;
};

export interface Envelope {
  ip?: string;
  from?: string;
  rcpt?: string[];
  helo?: string;
}

/** The sender's address: the one given (rspamc -i, the milter), or the last Received header's. */
const ipOf = (m: Mail, env: Envelope) => env.ip ?? /\[(\d+\.\d+\.\d+\.\d+)\]/.exec(header(m, 'Received')[0] ?? '')?.[1];

/** What rspamd answers for a message: symbols, score, action. */
export function scan(game: Game, m: Mail, env: Envelope = {}, conf = rspamd(game)?.loaded ?? readConfig(game).conf): Scan {
  const st = rspamd(game)!;
  const symbols: Symbol[] = [];
  const add = (name: string, score: number, options?: string[]) => symbols.push({ name, score, ...(options ? { options } : {}) });
  const ip = ipOf(m, env);
  const fromHeader = header(m, 'From')[0] ?? '';
  const mimeFrom = addrOf(fromHeader);
  const smtpFrom = (env.from ?? addrOf(header(m, 'Return-Path')[0] ?? mimeFrom)).toLowerCase();
  const rcpts = (env.rcpt ?? header(m, 'To').map(addrOf)).map((x) => x.toLowerCase());
  const net = st.net;
  // Received and reverse DNS.
  const sender = ip ? net.senders[ip] : undefined;
  if (ip && !sender?.rdns) add('RDNS_NONE', 2.0);
  if (ip && !sender?.rdns) add('HFILTER_HOSTNAME_UNKNOWN', 2.5);
  for (const bl of sender?.listed ?? []) add(bl, bl === 'RBL_SPAMCOP' ? 2.0 : 1.0, [`${ip?.split('.').reverse().join('.')}.bl.spamcop.example`]);
  if (header(m, 'Received').length <= 1) add('ONCE_RECEIVED', 0.1);
  // SPF, DKIM, DMARC (with the story's DNS).
  const envDomain = domainOf(smtpFrom);
  const spfPolicy = net.domains[envDomain]?.spf;
  const spf = !spfPolicy ? 'na' : ip && spfPolicy.some((c) => inNet(ip, c)) ? 'allow' : 'fail';
  if (spf === 'na') add('R_SPF_NA', 0.0, ['no SPF record']);
  else if (spf === 'allow') add('R_SPF_ALLOW', -0.2, [`+ip4:${ip}`]);
  else add('R_SPF_FAIL', 1.0, ['-all']);
  const sig = header(m, 'DKIM-Signature')[0];
  const d = sig ? (/\bd=([^;\s]+)/.exec(sig)?.[1] ?? '').toLowerCase() : '';
  const dkim = !sig ? 'na' : net.dkim.includes(d) ? 'allow' : 'reject';
  if (dkim === 'na') add('R_DKIM_NA', 0.0);
  else if (dkim === 'allow') add('R_DKIM_ALLOW', -0.2, [`${d}:s=s1`]);
  else add('R_DKIM_REJECT', 1.0, [`${d}:s=s1`]);
  const fromDomain = domainOf(`<${mimeFrom}>`);
  const policy = net.domains[fromDomain]?.dmarc;
  const aligned = (spf === 'allow' && orgOf(envDomain) === orgOf(fromDomain)) || (dkim === 'allow' && orgOf(d) === orgOf(fromDomain));
  if (!policy) add('DMARC_NA', 0.0, [fromDomain]);
  else if (aligned) add('DMARC_POLICY_ALLOW', -0.5, [fromDomain, policy]);
  else add(policy === 'reject' ? 'DMARC_POLICY_REJECT' : policy === 'quarantine' ? 'DMARC_POLICY_QUARANTINE' : 'DMARC_POLICY_SOFTFAIL', policy === 'none' ? 0.1 : 2.0, [fromDomain, policy]);
  if (mimeFrom && smtpFrom && mimeFrom !== smtpFrom) add('FROM_NEQ_ENVFROM', 0.0, [mimeFrom, smtpFrom]);
  // Content.
  const subject = header(m, 'Subject')[0] ?? '';
  const type = (header(m, 'Content-Type')[0] ?? 'text/plain').toLowerCase();
  if (type.startsWith('text/html')) add('MIME_HTML_ONLY', 0.2);
  if (subject.length > 10 && subject === subject.toUpperCase() && /[A-Z]{4}/.test(subject)) add('SUBJ_ALL_CAPS', 2.1);
  if (/!\s*$/.test(subject)) add('SUBJECT_ENDS_EXCLAIM', 0.0);
  const links = [...m.body.matchAll(/<a href="([^"]+)"[^>]*>([^<]*)<\/a>/gi)];
  for (const [, href, label] of links) {
    const target = (/^https?:\/\/([^/]+)/.exec(href)?.[1] ?? '').toLowerCase();
    const shown = (/(?:https?:\/\/)?([a-z0-9.-]+\.[a-z]{2,})/i.exec(label)?.[1] ?? '').toLowerCase();
    if (shown && target && orgOf(shown) !== orgOf(target) && /\./.test(label)) {
      add('PHISHING', 4.0, [`${shown}->${target}`]);
      break;
    }
  }
  if (links.some(([, href]) => /\/r\/[A-Za-z0-9]{12,}/.test(href))) add('R_SUSPICIOUS_URL', 5.0, ['redirector']);
  if (/<img[^>]+>/i.test(m.body) && links.length > 0 && m.body.replace(/<[^>]+>/g, '').trim().length < 400) add('HTML_SHORT_LINK_IMG_1', 2.0);
  if (header(m, 'List-Unsubscribe').length) add('HAS_LIST_UNSUB', -0.01);
  if (/^bulk$/i.test((header(m, 'Precedence')[0] ?? '').trim())) add('PRECEDENCE_BULK', 0.0);
  if (!header(m, 'Message-ID').length) add('MISSING_MID', 2.5);
  // Bayes.
  const p = bayes(st, m, conf.minLearns);
  if (p !== null && p >= 0.95) add('BAYES_SPAM', Math.round(5.1 * Math.min(1, (p - 0.5) * 2) * 100) / 100, [`${(p * 100).toFixed(2)}%`]);
  else if (p !== null && p <= 0.05) add('BAYES_HAM', Math.round(-3.0 * Math.min(1, (0.5 - p) * 2) * 100) / 100, [`${((1 - p) * 100).toFixed(2)}%`]);
  // Multimap.
  let forced: string | undefined;
  for (const r of conf.multimap) {
    let values: string[] = [];
    if (r.type === 'from') {
      const which = r.extract ?? 'smtp';
      values = which === 'mime' ? [mimeFrom] : which === 'both' ? [smtpFrom, mimeFrom] : [smtpFrom];
    } else if (r.type === 'rcpt') values = rcpts;
    else if (r.type === 'ip') values = ip ? [ip] : [];
    else if (r.type === 'header') values = r.header ? header(m, r.header) : [];
    if (r.filter === 'email:domain') values = values.map((v) => domainOf(`<${v}>`) || v);
    else if (r.filter === 'email:user') values = values.map((v) => v.replace(/@.*$/, ''));
    const hit = values.find((v) =>
      r.entries.some((e) => (r.type === 'ip' ? inNet(v, e) : r.filter === 'email:domain' ? v === e || v.endsWith(`.${e}`) : v.toLowerCase() === e)),
    );
    if (hit) {
      add(r.symbol, r.score, [hit]);
      if (r.action && !forced) forced = r.action;
    }
  }
  // Settings: the first rule that matches.
  let actions = { ...conf.actions };
  let wantSpam = false;
  const sameAs = (patterns: string[], addr: string) => patterns.some((f) => (f.startsWith('@') ? addr.endsWith(f) : addr === f));
  // Within a rule, different kinds of match are ANDed, the values of one kind ORed.
  const applied = conf.settings.find((s) => {
    const checks = [
      s.from.length ? sameAs(s.from, smtpFrom) : null,
      s.fromMime.length ? sameAs(s.fromMime, mimeFrom) : null,
      s.rcpt.length ? s.rcpt.some((f) => rcpts.some((r) => sameAs([f], r))) : null,
      s.ip.length ? !!ip && s.ip.some((c) => inNet(ip, c)) : null,
    ].filter((x) => x !== null);
    return checks.length > 0 && checks.every(Boolean);
  });
  if (applied) {
    actions = { ...actions, ...applied.actions };
    wantSpam = applied.wantSpam;
  }
  const score = Math.round(symbols.reduce((t, s) => t + s.score, 0) * 100) / 100;
  let action = 'no action';
  if (wantSpam) action = 'no action';
  else if (forced) action = ACTION_NAMES[forced] ?? forced;
  else {
    const ordered = (['reject', 'rewrite_subject', 'add_header', 'greylist'] as const).filter((k) => typeof actions[k] === 'number').sort((a, b) => (actions[b] as number) - (actions[a] as number));
    for (const k of ordered) if (score >= (actions[k] as number)) {
      action = ACTION_NAMES[k];
      break;
    }
  }
  const required = (actions.reject as number | null) ?? 15;
  return { symbols: symbols.sort((a, b) => a.name.localeCompare(b.name)), score, required, action, isSpam: ['reject', 'add header', 'rewrite subject'].includes(action), ...(p !== null ? { bayes: p } : {}), msgid: header(m, 'Message-ID')[0] ?? '' };
}

export const scanText = (game: Game, text: string, env: Envelope = {}) => scan(game, parseMail(text), env);

// ——— The log ———

const stamp = (ms: number) => new Date(ms).toISOString().replace('T', ' ').slice(0, 19);
const hex = (s: string, n: number) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  let out = '';
  for (let i = 0; out.length < n; i++) {
    h = Math.imul(h ^ (i + 0x9e), 0x01000193) >>> 0;
    out += h.toString(16).padStart(8, '0');
  }
  return out.slice(0, n);
};

/** rspamd_task_write_log's line, as the proxy worker writes it for a milter scan. */
export function logScan(game: Game, s: Scan, info: { qid: string; ip?: string; from: string; rcpts: string[]; len: number }) {
  const sd = systemd(game);
  const n = game.find(RSPAMD_LOG);
  const st = rspamd(game)!;
  st.scanned++;
  st.stats[s.action] = (st.stats[s.action] ?? 0) + 1;
  if (!sd || n?.type !== 'file' || typeof n.content !== 'string') return;
  const syms = s.symbols.map((x) => `${x.name}(${x.score.toFixed(2)}){${(x.options ?? []).join(';')}${x.options?.length ? ';' : ''}}`).join(',');
  const line = `${stamp(sd.clock)} #${1400 + (st.scanned % 7)}(rspamd_proxy) <${hex(`${s.msgid}#${st.scanned}`, 6)}>; proxy; rspamd_task_write_log: id: ${s.msgid}, qid: <${info.qid}>, ip: ${info.ip ?? '127.0.0.1'}, from: <${info.from}>, (default: ${s.isSpam ? 'T' : 'F'} (${s.action}): [${s.score.toFixed(2)}/${s.required.toFixed(2)}] [${syms}]), len: ${info.len}, time: ${(80 + (st.scanned * 37) % 200).toFixed(3)}ms, dns req: ${12 + (st.scanned % 30)}, digest: <${hex(s.msgid, 32)}>, rcpts: <${info.rcpts.join(',')}>, mime_rcpts: <${info.rcpts.join(',')}>`;
  n.content = n.content ? `${n.content}\n${line}` : line;
}

export function logStart(game: Game) {
  const sd = systemd(game);
  if (sd) journal(sd, 'rspamd.service', 'rspamd', 1390, `rspamd ${VERSION} is loading configuration, build id: release`);
}
