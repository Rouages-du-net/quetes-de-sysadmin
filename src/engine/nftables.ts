// nftables, le pare-feu du noyau Linux, sur un routeur (etat.nft) : des
// tables (famille ip, ip6, inet), des chaînes accrochées au trajet des
// paquets (hook input, forward, output, prerouting, postrouting) avec une
// politique, et des règles lues de gauche à droite (des conditions, puis
// des instructions : counter, log, accept, drop, masquerade…).
// Le langage est celui de nft(8) : https://www.netfilter.org/projects/nftables/manpage.html,
// https://wiki.nftables.org/wiki-nftables/index.php/Quick_reference-nftables_in_10_minutes ;
// sur Debian, /etc/nftables.conf est chargé par nftables.service (nft -f).
// Le trafic des appareils du réseau local (Lan.flux) traverse le routeur :
// hook forward (paquet « new », puis la réponse « established »), puis la
// traduction d'adresse (masquerade, snat) au hook postrouting d'une chaîne
// de type nat. Une adresse privée (RFC 1918) qui sort vers internet sans
// traduction ne reçoit jamais de réponse. Rien ne passe sans
// net.ipv4.ip_forward = 1 (/proc/sys, voir sysctl).
// Écarts : IPv4 seulement ; pas d'ensembles nommés (set), de maps, de
// limit, ni de règles sur le contenu des paquets ; les compteurs comptent
// le trafic simulé (un passage de chaque flux) ; la chaîne input ne coupe
// pas la session ssh du jeu.

import type { Game } from './shell';
import { addressFor, inside, inService, isIp, vlanInterface, interfaceFor, reach, lan, isPrivate, networkFor, toCount, type Lan } from './lan';
import { writeLog, systemd } from './systemd';

export const CONF = '/etc/nftables.conf';
export const FAMILIES = ['ip', 'ip6', 'inet', 'arp', 'bridge', 'netdev'];
const HOOKS = ['prerouting', 'input', 'forward', 'output', 'postrouting', 'ingress'];
const PRIORITIES: Record<string, number> = { raw: -300, mangle: -150, dstnat: -100, filter: 0, security: 50, srcnat: 100 };
// Les services de /etc/services que le jeu connaît (tcp dport https…).
export const SERVICES: Record<string, number> = {
  ssh: 22,
  smtp: 25,
  domain: 53,
  bootps: 67,
  bootpc: 68,
  http: 80,
  ntp: 123,
  https: 443,
  'microsoft-ds': 445,
  rtsp: 554,
  ipp: 631,
  imaps: 993,
};
const CT_STATES = ['new', 'established', 'related', 'invalid', 'untracked'];

// ——— Le modèle ———

export interface Condition {
  // iifname, oifname, ip saddr, ip daddr, ip protocol, meta l4proto, ct state, tcp dport, udp sport…
  field: string;
  negation: boolean;
  values: string[];
  // Écrit entre accolades ({ 80, 443 }).
  set: boolean;
}

export type Instruction =
  | { what: 'counter'; packages: number; bytes: number }
  | { what: 'log'; prefix?: string }
  | { what: 'accept' | 'drop' | 'reject' | 'return' | 'continue' }
  | { what: 'jump' | 'goto'; string: string }
  | { what: 'masquerade' }
  | { what: 'snat' | 'dnat'; to: string };

export interface Rule {
  conditions: Condition[];
  instructions: Instruction[];
  handshake: number;
}

export interface String {
  name: string;
  base?: { type: string; hook: string; priority: number; policy: 'accept' | 'drop' };
  rules: Rule[];
  handshake: number;
}

export interface Table {
  family: string;
  name: string;
  strings: String[];
  handshake: number;
  // Le prochain numéro (handle) à donner dans cette table.
  next: number;
}

export interface Ruleset {
  tables: Table[];
}

export const nft = (j: Game): Ruleset => (j.state.nft ??= { tables: [] });
export const copyOf = (r: Ruleset): Ruleset => structuredClone(r);

// ——— Le lexique ———

interface Token {
  t: string;
  type: 'word' | 'string' | 'sym' | 'nl' | 'end';
  line: number;
  col: number;
}

function split(text: string): Token[] {
  const tokens: Token[] = [];
  text.split('\n').forEach((rawValue, i) => {
    const line = i + 1;
    let k = 0;
    while (k < rawValue.length) {
      const c = rawValue[k];
      if (c === '#') break;
      if (c === '\\' && k === rawValue.trimEnd().length - 1) return; // la ligne continue
      if (/\s/.test(c)) {
        k++;
        continue;
      }
      if (c === '"') {
        const end = rawValue.indexOf('"', k + 1);
        const edge = end < 0 ? rawValue.length : end;
        tokens.push({ t: rawValue.slice(k + 1, edge), type: 'string', line, col: k + 1 });
        k = edge + 1;
        continue;
      }
      const two = rawValue.slice(k, k + 2);
      if (two === '!=' || two === '==') {
        tokens.push({ t: two, type: 'sym', line, col: k + 1 });
        k += 2;
        continue;
      }
      if ('{};,='.includes(c)) {
        tokens.push({ t: c, type: 'sym', line, col: k + 1 });
        k++;
        continue;
      }
      const m = /^[^\s{};,"#=]+/.exec(rawValue.slice(k))!;
      tokens.push({ t: m[0], type: 'word', line, col: k + 1 });
      k += m[0].length;
    }
    tokens.push({ t: '\n', type: 'nl', line, col: rawValue.length + 1 });
  });
  tokens.push({ t: '', type: 'end', line: text.split('\n').length, col: 1 });
  return tokens;
}

// Une erreur de nft : le message, et où (ligne, colonnes).
export class NftError extends Error {
  constructor(
    message: string,
    public token?: Token,
  ) {
    super(message);
  }
}

const describe = (j: Token) =>
  j.type === 'nl'
    ? 'newline'
    : j.type === 'end'
      ? 'end of file'
      : j.type === 'string'
        ? 'string'
        : j.type === 'sym'
          ? `'${j.t}'`
          : /^\d+$/.test(j.t)
            ? 'number'
            : 'string';
const unexpected = (j: Token) => new NftError(`syntax error, unexpected ${describe(j)}`, j);

// ——— L'analyse ———

class Reader {
  k = 0;
  constructor(
    public tokens: Token[],
    public definitions: Map<string, Token[]>,
  ) {}
  see(): Token {
    const j = this.tokens[this.k];
    if (j.type === 'word' && j.t.startsWith('$')) {
      const d = this.definitions.get(j.t.slice(1));
      if (!d) throw new NftError(`unknown identifier '${j.t.slice(1)}'`, j);
      this.tokens.splice(this.k, 1, ...d.map((x) => ({ ...x, line: j.line, col: j.col })));
      return this.see();
    }
    return j;
  }
  take(): Token {
    const j = this.see();
    this.k++;
    return j;
  }
  is(t: string) {
    const j = this.see();
    return j.type !== 'string' && j.t === t;
  }
  wait(t: string) {
    const j = this.take();
    if (j.type === 'string' || j.t !== t) throw unexpected(j);
  }
  word(): Token {
    const j = this.take();
    if (j.type !== 'word' && j.type !== 'string') throw unexpected(j);
    return j;
  }
  lineEnd() {
    const j = this.see();
    return j.type === 'nl' || j.type === 'end' || j.t === ';' || j.t === '}';
  }
  skipBlanks() {
    while (this.see().type === 'nl' || this.is(';')) this.k++;
  }
}

/** Ce qu'une commande de liste demande (nft list …), pour l'affichage. */
export interface List {
  what: 'ruleset' | 'tables' | 'table' | 'chain';
  family?: string;
  table?: string;
  string?: string;
}

/**
 * Exécute un texte nft (un fichier, ou une commande) sur une copie du
 * ruleset : renvoie la copie modifiée et les listes demandées. Lève
 * ErreurNft (rien n'est appliqué : nft est atomique).
 */
export function runNft(j: Game, text: string, departure: Ruleset, depth = 0): { ruleset: Ruleset; lists: List[] } {
  const r = copyOf(departure);
  const lists: List[] = [];
  const reader = new Reader(split(text), new Map());
  runIn(j, reader, r, lists, depth);
  return { ruleset: r, lists };
}

function family(l: Reader): string {
  return FAMILIES.includes(l.see().t) && l.see().type === 'word' ? l.take().t : 'ip';
}

function findTable(r: Ruleset, fam: string, name: Token): Table {
  const t = r.tables.find((x) => x.family === fam && x.name === name.t);
  if (!t) throw new NftError('Could not process rule: No such file or directory', name);
  return t;
}

function findString(t: Table, name: Token): String {
  const c = t.strings.find((x) => x.name === name.t);
  if (!c) throw new NftError('Could not process rule: No such file or directory', name);
  return c;
}

function tableOrNew(r: Ruleset, fam: string, name: string): Table {
  let t = r.tables.find((x) => x.family === fam && x.name === name);
  if (!t) {
    t = { family: fam, name, strings: [], handshake: r.tables.length + 1, next: 1 };
    r.tables.push(t);
  }
  return t;
}

function stringOrNew(t: Table, name: string): String {
  let c = t.strings.find((x) => x.name === name);
  if (!c) {
    c = { name, rules: [], handshake: t.next++ };
    t.strings.push(c);
  }
  return c;
}

function runIn(j: Game, l: Reader, r: Ruleset, lists: List[], depth: number) {
  for (;;) {
    l.skipBlanks();
    const start = l.see();
    if (start.type === 'end') return;
    const word = l.word();
    if (word.t === 'define' || word.t === 'redefine') {
      const name = l.word();
      l.wait('=');
      const value: Token[] = [];
      let accolades = 0;
      while (!(l.see().type === 'end' || (accolades === 0 && (l.see().type === 'nl' || l.is(';'))))) {
        const x = l.tokens[l.k++];
        if (x.t === '{' && x.type === 'sym') accolades++;
        if (x.t === '}' && x.type === 'sym') accolades--;
        value.push(x);
      }
      l.definitions.set(name.t, value);
    } else if (word.t === 'include') {
      const path = l.word();
      const text = j.read(path.t);
      if (text === null || depth > 8) throw new NftError(`File not found: ${path.t}`, path);
      const under = new Reader(split(text), l.definitions);
      try {
        runIn(j, under, r, lists, depth + 1);
      } catch (e) {
        if (e instanceof NftError) (e as NftError & { file?: string }).file ??= path.t;
        throw e;
      }
    } else if (word.t === 'flush') {
      const what = l.word();
      if (what.t === 'ruleset') r.tables = [];
      else if (what.t === 'table') {
        const t = findTable(r, family(l), l.word());
        for (const c of t.strings) c.rules = [];
      } else if (what.t === 'chain') {
        const t = findTable(r, family(l), l.word());
        findString(t, l.word()).rules = [];
      } else throw unexpected(what);
    } else if (word.t === 'table') {
      const fam = family(l);
      const t = tableOrNew(r, fam, l.word().t);
      tableBody(l, t);
    } else if (word.t === 'add' || word.t === 'create' || word.t === 'insert') {
      const what = l.word();
      if (what.t === 'table' && word.t !== 'insert') {
        const fam = family(l);
        const name = l.word();
        if (word.t === 'create' && r.tables.some((x) => x.family === fam && x.name === name.t))
          throw new NftError('Could not process rule: File exists', name);
        const t = tableOrNew(r, fam, name.t);
        if (l.is('{')) tableBody(l, t);
      } else if (what.t === 'chain' && word.t !== 'insert') {
        const t = findTable(r, family(l), l.word());
        const c = stringOrNew(t, l.word().t);
        if (l.is('{')) stringBody(l, t, c);
      } else if (what.t === 'rule') {
        const t = findTable(r, family(l), l.word());
        const c = findString(t, l.word());
        const rule = readRule(l, t);
        if (word.t === 'insert') c.rules.unshift(rule);
        else c.rules.push(rule);
      } else throw unexpected(what);
    } else if (word.t === 'delete' || word.t === 'destroy') {
      const what = l.word();
      if (what.t === 'table') {
        const fam = family(l);
        const t = findTable(r, fam, l.word());
        r.tables = r.tables.filter((x) => x !== t);
      } else if (what.t === 'chain') {
        const t = findTable(r, family(l), l.word());
        const c = findString(t, l.word());
        t.strings = t.strings.filter((x) => x !== c);
      } else if (what.t === 'rule') {
        const t = findTable(r, family(l), l.word());
        const c = findString(t, l.word());
        l.wait('handle');
        const n = l.word();
        const before = c.rules.length;
        c.rules = c.rules.filter((x) => String(x.handshake) !== n.t);
        if (c.rules.length === before) throw new NftError('Could not process rule: No such file or directory', n);
      } else throw unexpected(what);
    } else if (word.t === 'list') {
      const what = l.word();
      if (what.t === 'ruleset') lists.push({ what: 'ruleset' });
      else if (what.t === 'tables') lists.push({ what: 'tables' });
      else if (what.t === 'table') {
        const fam = family(l);
        const t = findTable(r, fam, l.word());
        lists.push({ what: 'table', family: fam, table: t.name });
      } else if (what.t === 'chain') {
        const fam = family(l);
        const t = findTable(r, fam, l.word());
        const c = findString(t, l.word());
        lists.push({ what: 'chain', family: fam, table: t.name, string: c.name });
      } else throw unexpected(what);
    } else throw unexpected(word);
    if (!l.lineEnd()) throw unexpected(l.see());
  }
}

function tableBody(l: Reader, t: Table) {
  l.wait('{');
  for (;;) {
    l.skipBlanks();
    if (l.is('}')) {
      l.take();
      return;
    }
    const word = l.word();
    if (word.t === 'chain') {
      const c = stringOrNew(t, l.word().t);
      stringBody(l, t, c);
    } else if (word.t === 'comment') l.word();
    else throw unexpected(word);
  }
}

function priority(l: Reader): number {
  const j = l.word();
  let p = /^-?\d+$/.test(j.t) ? Number(j.t) : PRIORITIES[j.t];
  if (p === undefined) throw new NftError(`'${j.t}' is not a valid priority in this family`, j);
  if (l.is('+') || l.is('-')) {
    const sign = l.take().t === '-' ? -1 : 1;
    p += sign * Number(l.word().t);
  } else if (/^[+-]\d+$/.test(l.see().t)) p += Number(l.take().t);
  return p;
}

function stringBody(l: Reader, t: Table, c: String) {
  l.wait('{');
  for (;;) {
    l.skipBlanks();
    if (l.is('}')) {
      l.take();
      return;
    }
    if (l.is('type')) {
      l.take();
      const type = l.word();
      if (!['filter', 'nat', 'route'].includes(type.t)) throw new NftError(`unknown chain type`, type);
      l.wait('hook');
      const hook = l.word();
      if (!HOOKS.includes(hook.t)) throw new NftError(`unknown chain hook`, hook);
      l.wait('priority');
      const p = priority(l);
      if (type.t === 'nat' && !['prerouting', 'postrouting', 'input', 'output'].includes(hook.t))
        throw new NftError('Could not process rule: Operation not supported', hook);
      c.base = { type: type.t, hook: hook.t, priority: p, policy: c.base?.policy ?? 'accept' };
    } else if (l.is('policy')) {
      const p = l.take();
      const v = l.word();
      if (v.t !== 'accept' && v.t !== 'drop') throw unexpected(v);
      if (!c.base) throw new NftError('Could not process rule: Invalid argument', p);
      c.base.policy = v.t;
    } else if (l.is('comment')) {
      l.take();
      l.word();
    } else c.rules.push(readRule(l, t, c));
  }
}

// Une valeur, une liste (a,b) ou un ensemble ({ a, b }).
function values(l: Reader): { values: string[]; set: boolean } {
  if (l.is('{')) {
    l.take();
    const v: string[] = [];
    for (;;) {
      while (l.see().type === 'nl' || l.is(',')) l.take();
      if (l.is('}')) {
        l.take();
        break;
      }
      v.push(l.word().t);
    }
    return { values: v, set: true };
  }
  const v = [l.word().t];
  while (l.is(',')) {
    l.take();
    v.push(l.word().t);
  }
  return { values: v, set: false };
}

const ipValid = (v: string) => {
  if (v.includes('-')) return v.split('-').every(isIp);
  const [ip, lg] = v.split('/');
  return isIp(ip) && (lg === undefined || (/^\d+$/.test(lg) && Number(lg) <= 32));
};
const portValid = (v: string) => v in SERVICES || /^\d+(-\d+)?$/.test(v);

function readRule(l: Reader, t: Table, c?: String): Rule {
  const rule: Rule = { conditions: [], instructions: [], handshake: 0 };
  const condition = (field: string, controle?: (v: string) => boolean, message?: (v: string) => string) => {
    let negation = false;
    if (l.is('!=')) {
      l.take();
      negation = true;
    } else if (l.is('==')) l.take();
    const start = l.see();
    const { values: v, set } = values(l);
    if (controle) for (const x of v) if (!controle(x)) throw new NftError(message ? message(x) : `syntax error, unexpected string`, start);
    rule.conditions.push({ field, negation, values: v, set });
  };
  if (l.lineEnd()) throw unexpected(l.see());
  while (!l.lineEnd()) {
    const j = l.word();
    const m = j.t;
    if (['iifname', 'oifname', 'iif', 'oif'].includes(m)) condition(m.replace(/^(i|o)if$/, '$1ifname'));
    else if (m === 'meta') {
      const k = l.word();
      if (['iifname', 'oifname'].includes(k.t)) condition(k.t);
      else if (k.t === 'l4proto') condition('l4proto', (v) => ['tcp', 'udp', 'icmp'].includes(v));
      else if (k.t === 'nfproto') condition('nfproto', (v) => ['ipv4', 'ipv6'].includes(v));
      else throw unexpected(k);
    } else if (m === 'ip') {
      const k = l.word();
      if (k.t === 'saddr' || k.t === 'daddr') condition(`ip ${k.t}`, ipValid, (v) => `Could not resolve hostname: Name or service not known (${v})`);
      else if (k.t === 'protocol') condition('l4proto', (v) => ['tcp', 'udp', 'icmp'].includes(v));
      else throw unexpected(k);
    } else if (m === 'ip6') {
      // Une règle IPv6 : elle ne voit jamais les paquets IPv4 du jeu.
      const k = l.word();
      if (!['saddr', 'daddr', 'nexthdr'].includes(k.t)) throw unexpected(k);
      condition(`ip6 ${k.t}`);
    } else if (m === 'tcp' || m === 'udp') {
      const k = l.word();
      if (k.t !== 'dport' && k.t !== 'sport') throw unexpected(k);
      condition(`${m} ${k.t}`, portValid, (v) => `Could not resolve service: Servname not supported for ai_socktype (${v})`);
    } else if (m === 'icmp' || m === 'icmpv6') {
      l.wait('type');
      condition(`${m} type`);
    } else if (m === 'ct') {
      l.wait('state');
      condition(
        'ct state',
        (v) => CT_STATES.includes(v),
        (v) => `Error parsing ct state: unknown value '${v}'`,
      );
    } else if (m === 'counter') {
      let packages = 0;
      let bytes = 0;
      if (l.is('packets')) {
        l.take();
        packages = Number(l.word().t);
        l.wait('bytes');
        bytes = Number(l.word().t);
      }
      rule.instructions.push({ what: 'counter', packages, bytes });
    } else if (m === 'log') {
      const i: Instruction = { what: 'log' };
      while (l.is('prefix') || l.is('level') || l.is('flags')) {
        const k = l.take().t;
        const v = l.word().t;
        if (k === 'prefix') i.prefix = v;
      }
      rule.instructions.push(i);
    } else if (['accept', 'drop', 'return', 'continue'].includes(m)) rule.instructions.push({ what: m as 'accept' });
    else if (m === 'reject') {
      if (l.is('with')) {
        l.take();
        l.word();
        l.word();
        if (l.see().type === 'word' && !l.lineEnd() && !['counter', 'log'].includes(l.see().t)) l.word();
      }
      rule.instructions.push({ what: 'reject' });
    } else if (m === 'jump' || m === 'goto') {
      const target = l.word();
      rule.instructions.push({ what: m, string: target.t });
    } else if (m === 'masquerade') {
      if (c?.base && c.base.type !== 'nat') throw new NftError('Could not process rule: Operation not supported', j);
      rule.instructions.push({ what: 'masquerade' });
      while (['random', 'persistent', 'fully-random'].includes(l.see().t)) l.take();
    } else if (m === 'snat' || m === 'dnat') {
      if (c?.base && c.base.type !== 'nat') throw new NftError('Could not process rule: Operation not supported', j);
      if (l.is('ip')) l.take();
      l.wait('to');
      const v = l.word();
      if (!isIp(v.t.split(':')[0])) throw new NftError(`Could not resolve hostname: Name or service not known`, v);
      rule.instructions.push({ what: m, to: v.t });
    } else if (m === 'comment') l.word();
    else throw unexpected(j);
  }
  rule.handshake = t.next++;
  return rule;
}

// ——— L'affichage (nft list) ———

const priorityName = (p: number) => Object.entries(PRIORITIES).find(([, v]) => v === p)?.[0] ?? String(p);
const guillemets = (field: string, v: string) => (field.endsWith('ifname') ? `"${v}"` : v);
const inCount = (field: string, v: string) => (/(d|s)port$/.test(field) && v in SERVICES ? String(SERVICES[v]) : v);

function conditionText(c: Condition): string {
  const field = c.field === 'l4proto' ? 'meta l4proto' : c.field;
  const v = c.values.map((x) => guillemets(c.field, inCount(c.field, x)));
  const value = c.field === 'ct state' ? v.join(',') : v.length > 1 || c.set ? `{ ${v.join(', ')} }` : v[0];
  return `${field} ${c.negation ? '!= ' : ''}${value}`;
}

function instructionText(i: Instruction): string {
  if (i.what === 'counter') return `counter packets ${i.packages} bytes ${i.bytes}`;
  if (i.what === 'log') return i.prefix !== undefined ? `log prefix "${i.prefix}"` : 'log';
  if (i.what === 'jump' || i.what === 'goto') return `${i.what} ${i.string}`;
  if (i.what === 'snat' || i.what === 'dnat') return `${i.what} to ${i.to}`;
  return i.what;
}

export const ruleText = (r: Rule) => [...r.conditions.map(conditionText), ...r.instructions.map(instructionText)].join(' ');

function stringLines(c: String, handshakes: boolean): string[] {
  const h = (n: number) => (handshakes ? ` # handle ${n}` : '');
  const lines = [`\tchain ${c.name} {${h(c.handshake)}`];
  if (c.base) lines.push(`\t\ttype ${c.base.type} hook ${c.base.hook} priority ${priorityName(c.base.priority)}; policy ${c.base.policy};`);
  for (const r of c.rules) lines.push(`\t\t${ruleText(r)}${h(r.handshake)}`);
  lines.push('\t}');
  return lines;
}

export function tableLines(t: Table, handshakes: boolean, string?: string): string[] {
  const strings = t.strings.filter((c) => !string || c.name === string);
  return [`table ${t.family} ${t.name} {${handshakes ? ` # handle ${t.handshake}` : ''}`, ...strings.flatMap((c) => stringLines(c, handshakes)), '}'];
}

export function show(r: Ruleset, listing: List, handshakes: boolean): string {
  if (listing.what === 'tables') return r.tables.map((t) => `table ${t.family} ${t.name}`).join('\n');
  const tables = r.tables.filter((t) => listing.what === 'ruleset' || (t.family === listing.family && t.name === listing.table));
  return tables.flatMap((t) => tableLines(t, handshakes, listing.string)).join('\n');
}

// ——— Le trajet d'un paquet ———

export interface Package {
  iif: string;
  oif: string;
  saddr: string;
  daddr: string;
  proto: 'tcp' | 'udp' | 'icmp';
  sport: number;
  dport: number;
  ct: 'new' | 'established';
  size: number;
}

const nameCorrespond = (pattern: string, name: string) => (pattern.endsWith('*') ? name.startsWith(pattern.slice(0, -1)) : pattern === name);
const correspondIp = (pattern: string, ip: string) => {
  if (pattern.includes('-')) {
    const [a, b] = pattern.split('-').map(toCount);
    return toCount(ip) >= a && toCount(ip) <= b;
  }
  return pattern.includes('/') ? inside(ip, pattern) : pattern === ip;
};
const correspondPort = (pattern: string, port: number) => {
  const m = pattern in SERVICES ? String(SERVICES[pattern]) : pattern;
  const [a, b] = m.split('-').map(Number);
  return b === undefined ? port === a : port >= a && port <= b;
};

function correspond(c: Condition, p: Package): boolean {
  const one = (v: string): boolean => {
    switch (c.field) {
      case 'iifname':
        return nameCorrespond(v, p.iif);
      case 'oifname':
        return nameCorrespond(v, p.oif);
      case 'ip saddr':
        return correspondIp(v, p.saddr);
      case 'ip daddr':
        return correspondIp(v, p.daddr);
      case 'l4proto':
        return v === p.proto;
      case 'nfproto':
        return v === 'ipv4';
      case 'ct state':
        return v === p.ct;
      case 'tcp dport':
      case 'udp dport':
        return c.field.startsWith(p.proto) && correspondPort(v, p.dport);
      case 'tcp sport':
      case 'udp sport':
        return c.field.startsWith(p.proto) && correspondPort(v, p.sport);
      case 'icmp type':
        return p.proto === 'icmp';
      default:
        return false; // ip6, icmpv6 : jamais pour un paquet IPv4
    }
  };
  // Un champ de protocole ne s'applique qu'à son protocole, même nié.
  if (/^(tcp|udp) /.test(c.field) && !c.field.startsWith(p.proto)) return false;
  if (c.field.startsWith('ip6') || c.field === 'icmpv6 type') return false;
  const yes = c.values.some(one);
  return c.negation ? !yes : yes;
}

export interface Trace {
  string: string;
  rule: Rule | null;
  verdict: 'accept' | 'drop';
}

type End = {
  verdict: 'accept' | 'drop' | 'return' | null;
  nat?: { what: 'masquerade' | 'snat' | 'dnat'; to?: string };
  rule: Rule | null;
  logs: string[];
};

function walk(t: Table, c: String, p: Package, count: boolean, depth = 0): End {
  const logs: string[] = [];
  for (const r of c.rules) {
    if (!r.conditions.every((x) => correspond(x, p))) continue;
    for (const i of r.instructions) {
      if (i.what === 'counter') {
        if (count) {
          i.packages++;
          i.bytes += p.size;
        }
      } else if (i.what === 'log') logs.push(i.prefix ?? '');
      else if (i.what === 'accept' || i.what === 'drop') return { verdict: i.what, rule: r, logs };
      else if (i.what === 'reject') return { verdict: 'drop', rule: r, logs };
      else if (i.what === 'return') return { verdict: 'return', rule: r, logs };
      else if (i.what === 'masquerade' || i.what === 'snat' || i.what === 'dnat')
        return { verdict: 'accept', nat: { what: i.what, ...('to' in i ? { to: i.to } : {}) }, rule: r, logs };
      else if (i.what === 'jump' || i.what === 'goto') {
        const under = t.strings.find((x) => x.name === i.string);
        if (!under || depth > 16) continue;
        const f = walk(t, under, p, count, depth + 1);
        logs.push(...f.logs);
        if (f.verdict === 'accept' || f.verdict === 'drop') return { ...f, logs };
        if (i.what === 'goto') return { verdict: 'return', rule: r, logs };
      }
    }
  }
  return { verdict: null, rule: null, logs };
}

/**
 * Un paquet passe par un hook : chaque chaîne de base de ce hook (familles
 * ip et inet), dans l'ordre des priorités. Le premier drop l'arrête ; un
 * accept le laisse aller à la chaîne suivante ; sans verdict, la politique.
 */
export function traverse(
  r: Ruleset,
  hook: string,
  type: string,
  p: Package,
  count = false,
): { pass: boolean; nat: End['nat'] | null; logs: string[]; trace: Trace[] } {
  const strings = r.tables
    .filter((t) => t.family === 'ip' || t.family === 'inet')
    .flatMap((t) => t.strings.filter((c) => c.base?.hook === hook && c.base.type === type).map((c) => ({ t, c })))
    .sort((a, b) => a.c.base!.priority - b.c.base!.priority);
  let nat: End['nat'] | null = null;
  const logs: string[] = [];
  const trace: Trace[] = [];
  for (const { t, c } of strings) {
    const f = walk(t, c, p, count);
    logs.push(...f.logs);
    const verdict = f.verdict === 'accept' || f.verdict === 'drop' ? f.verdict : c.base!.policy;
    trace.push({ string: `${t.family} ${t.name} ${c.name}`, rule: f.verdict === 'accept' || f.verdict === 'drop' ? f.rule : null, verdict });
    if (f.nat && !nat) nat = f.nat;
    if (verdict === 'drop') return { pass: false, nat, logs, trace };
  }
  return { pass: true, nat, logs, trace };
}

// ——— Le trafic du réseau local ———

/**
 * Un échange qu'un appareil essaie à travers le routeur : depuis un appareil
 * du réseau local (son nom) ou depuis internet (une adresse publique), vers
 * un appareil (son nom) ou une adresse (d'internet, ou celle du routeur, que
 * la traduction de destination, dnat, renvoie vers un appareil).
 */
export interface Flux {
  forEachOf: string;
  to: string;
  proto: 'tcp' | 'udp';
  port: number;
}

export interface Result {
  flux: Flux;
  // ok : échange établi ; sans-reponse : la question passe, la réponse ne revient pas ; bloque : jeté au passage ; impossible : pas d'adresse, pas de route.
  state: 'ok' | 'no-response' | 'blocked' | 'impossible';
  // Le premier paquet, tel qu'il arrive au routeur (avant toute traduction).
  go?: Package;
  // L'adresse source après traduction (masquerade, snat), si elle change.
  translated?: string;
  // La destination après traduction (dnat), si elle change : adresse, et port.
  destination?: { address: string; port: number };
  logs: { prefix: string; pkg: Package }[];
}

/** La valeur d'une clé sysctl (/proc/sys/…), ou null si elle n'existe pas. */
export const readSysctl = (j: Game, key: string) => j.read(`/proc/sys/${key.replace(/\./g, '/')}`)?.trim() ?? null;
export const routing = (j: Game) => readSysctl(j, 'net.ipv4.ip_forward') === '1' || readSysctl(j, 'net.ipv4.conf.all.forwarding') === '1';

// Un port source tiré du nom de l'appareil (toujours le même).
const portSource = (name: string, port: number) => {
  let h = port;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return 40000 + (h % 20000);
};

/** Ce que devient un flux à travers le routeur, avec ce ruleset et ce réglage d'ip_forward. */
export function attempt(l: Lan, r: Ruleset, transfer: boolean, f: Flux, count = false): Result {
  const res = (state: Result['state'], o: Partial<Result> = {}): Result => ({ flux: f, state, logs: [], ...o });
  const gw = l.gateway && l.interfaces[l.gateway.dev] && inService(l, l.interfaces[l.gateway.dev]) ? l.interfaces[l.gateway.dev] : null;
  // La source : un appareil du réseau local, ou une adresse d'internet (qui arrive par la passerelle).
  const external = isIp(f.forEachOf) && !isPrivate(f.forEachOf);
  const source = external ? null : l.devices.find((a) => a.name === f.forEachOf);
  const saddr = external ? f.forEachOf : source && addressFor(source);
  const iif = external ? gw : source && vlanInterface(l, source.vlan);
  if (!saddr || !iif || (!external && !iif.addresses.some((a) => inside(saddr, networkFor(a))))) return res('impossible');
  const target = l.devices.find((a) => a.name === f.to);
  const daddr = target ? addressFor(target) : f.to;
  if (!daddr) return res('impossible');
  const go: Package = {
    iif: iif.name,
    oif: '',
    saddr,
    daddr,
    proto: f.proto,
    sport: portSource(source?.name ?? f.forEachOf, f.port),
    dport: f.port,
    ct: 'new',
    size: 60,
  };
  const logs: Result['logs'] = [];
  const note = (t: { logs: string[] }, p: Package) => logs.push(...t.logs.map((prefix) => ({ prefix, pkg: p })));
  // La traduction de destination : prerouting, chaînes de type nat (premier paquet seulement).
  const pre = traverse(r, 'prerouting', 'nat', go, count);
  note(pre, go);
  if (!pre.pass) return res('blocked', { go, logs });
  let destination: Result['destination'];
  if (pre.nat?.what === 'dnat') {
    const [address, port] = pre.nat.to!.split(':');
    destination = { address, port: port ? Number(port) : f.port };
  }
  const dest = destination?.address ?? daddr;
  const dport = destination?.port ?? f.port;
  // Pour le routeur lui-même (sans traduction) : la chaîne input, que ces échanges ne regardent pas.
  if (Object.values(l.interfaces).some((i) => i.addresses.some((a) => a.split('/')[0] === dest))) return res('blocked', { go, destination, logs });
  const internal = interfaceFor(l, dest);
  const oif = internal ?? (isPrivate(dest) ? null : gw);
  if (!oif) return res('impossible', { go, destination });
  const traverses: Package = { ...go, oif: oif.name, daddr: dest, dport };
  if (!transfer) return res('blocked', { go, destination, logs });
  const before = traverse(r, 'forward', 'filter', traverses, count);
  note(before, traverses);
  if (!before.pass) return res('blocked', { go, destination, logs });
  // La traduction de source : postrouting, chaînes de type nat (premier paquet seulement).
  const nat = traverse(r, 'postrouting', 'nat', traverses, count);
  note(nat, traverses);
  if (!nat.pass) return res('blocked', { go, destination, logs });
  const translated =
    nat.nat?.what === 'masquerade' ? oif.addresses[0]?.split('/')[0] : nat.nat?.what === 'snat' ? nat.nat.to!.split(':')[0] : undefined;
  const view = translated ?? saddr;
  // La réponse : d'un appareil du réseau local s'il existe ; d'internet seulement vers une adresse publique.
  const device = l.devices.find((a) => addressFor(a) === dest);
  const answers = device ? reach(l, dest).what === 'device' : internal ? false : !isPrivate(view);
  if (!answers) return res('no-response', { go, translated, destination, logs });
  const back: Package = {
    ...traverses,
    iif: oif.name,
    oif: iif.name,
    saddr: dest,
    daddr: saddr,
    sport: dport,
    dport: go.sport,
    ct: 'established',
    size: 1500,
  };
  const r2 = traverse(r, 'forward', 'filter', back, count);
  note(r2, back);
  return res(r2.pass ? 'ok' : 'no-response', { go, translated, destination, logs });
}

/** Les flux du réseau local, maintenant (ruleset chargé, ip_forward du noyau). */
export const results = (j: Game, count = false, r = nft(j)): Result[] => {
  const l = lan(j);
  return (l?.flux ?? []).map((f) => attempt(l!, r, routing(j), f, count));
};

/** Le ruleset avec les compteurs du trafic simulé (un passage de chaque flux), pour nft list. */
export function withCounters(j: Game): Ruleset {
  const r = copyOf(nft(j));
  for (const t of r.tables)
    for (const c of t.strings)
      for (const rule of c.rules) for (const i of rule.instructions) if (i.what === 'counter') Object.assign(i, { packages: 0, bytes: 0 });
  results(j, true, r);
  // Ce qui a déjà été compté à la main (counter packets N bytes M) s'ajoute.
  const base = nft(j);
  r.tables.forEach((t, a) =>
    t.strings.forEach((c, b) =>
      c.rules.forEach((rule, k) =>
        rule.instructions.forEach((i, n) => {
          const before = base.tables[a]?.strings[b]?.rules[k]?.instructions[n];
          if (i.what === 'counter' && before?.what === 'counter') {
            i.packages += before.packages;
            i.bytes += before.bytes;
          }
        }),
      ),
    ),
  );
  return r;
}

/** Après un chargement : les lignes « log » du noyau pour le trafic du moment (journalctl -k). */
export function logTraffic(j: Game) {
  const sd = systemd(j);
  const l = lan(j);
  if (!sd || !l) return;
  for (const res of results(j))
    for (const { prefix, pkg: p } of res.logs) {
      const mac = l.interfaces[p.iif]?.mac ?? '00:00:00:00:00:00';
      writeLog(
        sd,
        '',
        'kernel',
        0,
        `${prefix}IN=${p.iif} OUT=${p.oif} MAC=${mac}:00:00:5e:00:53:00:08:00 SRC=${p.saddr} DST=${p.daddr} LEN=${p.size} TOS=0x00 PREC=0x00 TTL=63 ID=0 DF PROTO=${p.proto.toUpperCase()} SPT=${p.sport} DPT=${p.dport} WINDOW=64240 RES=0x00 ${p.ct === 'new' ? 'SYN' : 'ACK'} URGP=0`,
      );
    }
}

// ——— Le fichier /etc/nftables.conf ———

/** Lit /etc/nftables.conf comme nft -f (sur un ruleset vide, sauf s'il ne le vide pas lui-même). */
export function readConf(j: Game, departure: Ruleset = nft(j)): { ruleset: Ruleset | null; error: string | null } {
  const text = j.read(CONF);
  if (text === null) return { ruleset: null, error: `Error: Could not open file "${CONF}": No such file or directory` };
  try {
    return { ruleset: runNft(j, text, departure).ruleset, error: null };
  } catch (e) {
    if (e instanceof NftError)
      return { ruleset: null, error: formatError(e, CONF, j.read((e as { file?: string }).file ?? CONF) ?? text) };
    throw e;
  }
}

/** Une erreur au format de nft : « fichier:ligne:col-col: Error: … », la ligne, et des ^ dessous. */
export function formatError(e: NftError, file: string | null, text: string): string {
  const fic = (e as { file?: string }).file ?? file;
  const j = e.token;
  if (!j) return `Error: ${e.message}`;
  const line = text.split('\n')[j.line - 1] ?? '';
  const width = Math.max(1, j.type === 'string' ? j.t.length + 2 : j.type === 'nl' || j.type === 'end' ? 1 : j.t.length);
  const place = fic ? `${fic}:${j.line}:${j.col}-${j.col + width - 1}: ` : '';
  const offset = line.slice(0, j.col - 1).replace(/[^\t]/g, ' ');
  return `${place}Error: ${e.message}\n${line}\n${offset}${'^'.repeat(width)}`;
}

/** Le ruleset que donnerait le fichier au démarrage (sur un ruleset vide). */
export const toBoot = (j: Game) => readConf(j, { tables: [] }).ruleset;
