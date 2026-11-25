// OpenBao 2.7 (the open-source fork of HashiCorp Vault, a Linux Foundation
// project under the MPL 2.0), loaded with the story that keeps a hostel's
// secrets in it ("The Hostel"): a server on the story's machine
// (state.bao on the principal) and what its HTTP API answers, for the `bao`
// command (commands/bao.ts) and the story's own app.
// The model: the Shamir seal (five shares, a threshold of three; each share
// counted once, a wrong share fails the whole attempt and resets the
// progress; a restart seals again), tokens (ids "s." + 24 base62 characters
// as OpenBao makes them with its default disable_sscts; accessor, policies,
// parent and children revoked together, TTL from the system's 768h, orphans,
// periods), ACL policies (path rules in HCL, capabilities, globs and "+",
// Vault's priority rules, deny, root, sudo on root-protected paths), a KV
// version 2 engine mounted at secret/ (data/ and metadata/ paths, versions,
// patch, rollback), and a file audit device declared in openbao.hcl
// (one JSON object per request and response, strings HMAC'd with the
// device's salt, sys/audit-hash).
// Messages after OpenBao v2.7.3's sources (sdk/logical, internal/vault:
// request_handling.go, seal_manager.go, token_store.go, policy/policy.go,
// logical_system.go; internal/http/sys_seal.go; api/response.go); see
// docs/ACCURACY.md.
// Docs: https://openbao.org/docs/concepts/seal/,
// https://openbao.org/docs/concepts/tokens/,
// https://openbao.org/docs/concepts/policies/,
// https://openbao.org/docs/secrets/kv/kv-v2/, https://openbao.org/docs/audit/.
// Differences: one KV mount (secret/, version 2) and the token auth method;
// no namespaces, leases, identity, response wrapping nor other engines; TLS
// isn't modelled (the CLI talks to https://127.0.0.1:8200 without checking a
// certificate); the audit entries keep the main fields.

import type { Game } from './shell';
import { sha256 } from './commands/checksums';
import { systemd, toUtc } from './systemd';

export const VERSION = '2.7.3';
export const COMMIT_DATE = '2026-11-19T09:42:17Z';
export const ADDRESS = 'https://127.0.0.1:8200';
/** The system's default and maximum TTL for tokens (768h, 32 days). */
export const MAX_TTL = 768 * 3600;

// ——— Deterministic randomness: ids derived from a seed ———

const enc = (s: string) => new TextEncoder().encode(s);
const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
/** n base62 characters derived from a seed (base62.Random's shape). */
export function base62(seed: string, n = 24): string {
  let out = '';
  let round = 0;
  while (out.length < n) {
    const hex = sha256(enc(`${seed}#${round++}`));
    for (let i = 0; i + 2 <= hex.length && out.length < n; i += 2) {
      const b = parseInt(hex.slice(i, i + 2), 16);
      // Rejection sampling, like base62.Random (248 = 4 × 62).
      if (b < 248) out += BASE62[b % 62];
    }
  }
  return out;
}
export function uuidOf(seed: string): string {
  const h = sha256(enc(seed));
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

/** HMAC-SHA256 (RFC 2104), in hexadecimal. */
export function hmacSha256(key: string, message: string): string {
  let k: Uint8Array = enc(key);
  if (k.length > 64) k = hexBytes(sha256(k));
  const pad = (x: number) => {
    const b = new Uint8Array(64);
    b.set(k);
    for (let i = 0; i < 64; i++) b[i] ^= x;
    return b;
  };
  const m = enc(message);
  const inner = new Uint8Array(64 + m.length);
  inner.set(pad(0x36));
  inner.set(m, 64);
  const ih = hexBytes(sha256(inner));
  const outer = new Uint8Array(64 + 32);
  outer.set(pad(0x5c));
  outer.set(ih, 64);
  return sha256(outer);
}
function hexBytes(hex: string): Uint8Array {
  const b = new Uint8Array(hex.length / 2);
  for (let i = 0; i < b.length; i++) b[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return b;
}

/** A time (the machine's local time read as UTC, like systemd's clock) as Go's RFC3339Nano writes it in UTC (trailing zeros of the fraction dropped). */
export function rfc3339(local: number, seed = ''): string {
  const ms = toUtc(local);
  const micro = seed ? parseInt(sha256(enc(seed)).slice(0, 5), 16) % 1_000_000 : 0;
  const base = new Date(Math.floor(ms / 1000) * 1000).toISOString().slice(0, 19);
  const frac = `${String(micro).padStart(6, '0')}`.replace(/0+$/, '');
  return `${base}${frac ? `.${frac}` : ''}Z`;
}

/** Go's time.Duration.String() of whole seconds, trimmed like the CLI's humanDuration. */
export function humanDuration(seconds: number): string {
  if (seconds === 0) return '0s';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  let out = h ? `${h}h${m}m${s}s` : m ? `${m}m${s}s` : `${s}s`;
  if (out.endsWith('m0s')) out = out.slice(0, -2);
  const i = out.indexOf('h0m');
  if (i > 0) out = out.slice(0, i + 1) + out.slice(i + 3);
  return out;
}

/** A duration as the CLI's flags read it: Go's time.ParseDuration, or seconds. null: invalid. */
export function parseDuration(text: string): number | null {
  if (/^\d+$/.test(text)) return Number(text);
  const re = /(\d+(?:\.\d+)?)(h|m|s|ms)/gy;
  let total = 0;
  let m: RegExpExecArray | null;
  let at = 0;
  while ((m = re.exec(text))) {
    total += Number(m[1]) * { h: 3600, m: 60, s: 1, ms: 0.001 }[m[2] as 'h']!;
    at = re.lastIndex;
  }
  if (at !== text.length || !text) return null;
  return Math.round(total);
}

// ——— The state ———

export interface BaoToken {
  id: string;
  accessor: string;
  policies: string[];
  displayName: string;
  // auth/token/create, auth/token/root…
  path: string;
  // The token that created it (null: an orphan); revoking a parent revokes its children.
  parent: string | null;
  // Creation (ms); TTL in seconds (0: never expires, a root token).
  created: number;
  ttl: number;
  period?: number;
  // Who created it, for the story (the player's commands).
  createdBy?: string;
}
export interface KvVersion {
  data: Record<string, string>;
  created: number;
}
export interface KvSecret {
  versions: KvVersion[];
  created: number;
}
export interface AuditDevice {
  path: string;
  type: string;
  file: string;
  salt: string;
}
export interface BaoState {
  initialized: boolean;
  sealed: boolean;
  // The five valid shares (base64), the threshold, the shares given so far.
  shares: string[];
  threshold: number;
  parts: string[];
  nonce: string;
  clusterName: string;
  clusterId: string;
  tokens: Record<string, BaoToken>;
  revoked: Record<string, BaoToken>;
  policies: Record<string, string>;
  kv: Record<string, KvSecret>;
  audit: AuditDevice | null;
  auditLines: string[];
  // A counter for the ids made from now on.
  seq: number;
  // What was done through the API (for the story's events).
  runs: BaoRun[];
}
export interface BaoRun {
  method: string;
  path: string;
  status: number;
  token?: string;
  remote: string;
  // A share that was accepted, a duplicate, the result of an unseal attempt.
  note?: string;
  at: number;
}

export const bao = (g: Game): BaoState | undefined => (g as { principal?: Game }).principal?.state.bao ?? g.state.bao;
const now = (g: Game) => systemd((g as { principal?: Game }).principal ?? g)?.clock ?? 0;
/** Is the server process running (the openbao unit active)? */
export const serverUp = (g: Game) => {
  const p = (g as { principal?: Game }).principal ?? g;
  return systemd(p)?.services.openbao?.state === 'active';
};

/** A new token, with its accessor, made from a seed. */
export function mint(b: BaoState, seed: string, t: Omit<BaoToken, 'id' | 'accessor'>): BaoToken {
  const token: BaoToken = { id: `s.${base62(`token:${seed}`)}`, accessor: base62(`accessor:${seed}`), ...t };
  b.tokens[token.id] = token;
  return token;
}

/** Seconds left before a token expires (null: it never does). */
export function ttlLeft(g: Game, t: BaoToken): number | null {
  if (!t.ttl) return null;
  return Math.max(0, Math.round((t.created + t.ttl * 1000 - now(g)) / 1000));
}
/** The token, if it exists and hasn't expired. */
export function lookupToken(g: Game, id: string | undefined): BaoToken | null {
  const b = bao(g);
  if (!b || !id) return null;
  const t = b.tokens[id];
  if (!t) return null;
  const left = ttlLeft(g, t);
  if (left === 0) {
    revokeTree(b, t.id);
    return null;
  }
  return t;
}
export const byAccessor = (b: BaoState, accessor: string) => Object.values(b.tokens).find((t) => t.accessor === accessor) ?? null;

/** Revokes a token and, like auth/token/revoke, every token it created, down the tree. */
export function revokeTree(b: BaoState, id: string): string[] {
  const t = b.tokens[id];
  if (!t) return [];
  delete b.tokens[id];
  b.revoked[id] = t;
  const gone = [id];
  for (const child of Object.values(b.tokens).filter((x) => x.parent === id)) gone.push(...revokeTree(b, child.id));
  return gone;
}

/** Seals the server (a restart, a stop, bao operator seal): the root key leaves memory. */
export function seal(g: Game) {
  const b = bao(g);
  if (!b) return;
  b.sealed = true;
  b.parts = [];
  b.nonce = '';
}

// ——— Policies (HCL, the subset a policy uses) ———

export const CAPABILITIES = ['create', 'read', 'update', 'patch', 'delete', 'list', 'sudo', 'deny', 'scan'];
export interface Rule {
  path: string;
  capabilities: string[];
}
export type Parsed = { rules: Rule[] } | { error: string };

// The default policy, as OpenBao writes it at init (internal/vault/policy/policy_store.go).
export const DEFAULT_POLICY = `# Allow tokens to look up their own properties
path "auth/token/lookup-self" {
    capabilities = ["read"]
}

# Allow tokens to renew themselves
path "auth/token/renew-self" {
    capabilities = ["update"]
}

# Allow tokens to revoke themselves
path "auth/token/revoke-self" {
    capabilities = ["update"]
}

# Allow a token to look up its own capabilities on a path
path "sys/capabilities-self" {
    capabilities = ["update"]
}

# Allow a token to look up its own entity by id or name
path "identity/entity/id/{{identity.entity.id}}" {
  capabilities = ["read"]
}
path "identity/entity/name/{{identity.entity.name}}" {
  capabilities = ["read"]
}


# Allow a token to look up its resultant ACL from all policies. This is useful
# for UIs. It is an internal path because the format may change at any time
# based on how the internal ACL features and capabilities change.
path "sys/internal/ui/resultant-acl" {
    capabilities = ["read"]
}

# Allow a token to renew a lease via lease_id in the request body; old path for
# old clients, new path for newer
path "sys/leases/renew" {
    capabilities = ["update"]
}

# Allow looking up lease properties. This requires knowing the lease ID ahead
# of time and does not divulge any sensitive information.
path "sys/leases/lookup" {
    capabilities = ["update"]
}

# Allow a token to manage its own cubbyhole
path "cubbyhole/*" {
    capabilities = ["create", "read", "update", "delete", "list"]
}

# Allow a token to wrap arbitrary values in a response-wrapping token
path "sys/wrapping/wrap" {
    capabilities = ["update"]
}

# Allow a token to look up the creation time and TTL of a given
# response-wrapping token
path "sys/wrapping/lookup" {
    capabilities = ["update"]
}

# Allow a token to unwrap a response-wrapping token. This is a convenience to
# avoid client token swapping since this is also part of the response wrapping
# policy.
path "sys/wrapping/unwrap" {
    capabilities = ["update"]
}

# Allow general purpose tools
path "sys/tools/hash" {
    capabilities = ["update"]
}
path "sys/tools/hash/*" {
    capabilities = ["update"]
}

# Allow a token to make requests to the Authorization Endpoint for OIDC providers.
path "identity/oidc/provider/+/authorize" {
    capabilities = ["read", "update"]
}`;

type Tok = { kind: 'string' | 'ident' | 'punct' | 'number' | 'eof'; text: string; line: number; col: number };

function tokens(src: string): Tok[] | { error: string } {
  const out: Tok[] = [];
  let i = 0;
  let line = 1;
  let col = 1;
  const step = (n: number) => {
    for (let k = 0; k < n; k++) {
      if (src[i] === '\n') {
        line++;
        col = 1;
      } else col++;
      i++;
    }
  };
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) step(1);
    else if (c === '#' || (c === '/' && src[i + 1] === '/')) while (i < src.length && src[i] !== '\n') step(1);
    else if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      step((end < 0 ? src.length : end + 2) - i);
    } else if (c === '"') {
      const at = { line, col };
      let j = i + 1;
      let text = '';
      while (j < src.length && src[j] !== '"' && src[j] !== '\n') {
        if (src[j] === '\\' && j + 1 < src.length) j++;
        text += src[j++];
      }
      if (src[j] !== '"') return { error: `At ${at.line}:${at.col}: literal not terminated` };
      step(j + 1 - i);
      out.push({ kind: 'string', text, ...at });
    } else if (/[A-Za-z_]/.test(c)) {
      const at = { line, col };
      const m = /^[A-Za-z_][\w.-]*/.exec(src.slice(i))![0];
      step(m.length);
      out.push({ kind: 'ident', text: m, ...at });
    } else if (/[0-9]/.test(c)) {
      const at = { line, col };
      const m = /^[0-9][\w.]*/.exec(src.slice(i))![0];
      step(m.length);
      out.push({ kind: 'number', text: m, ...at });
    } else if ('{}[]=,'.includes(c)) {
      out.push({ kind: 'punct', text: c, line, col });
      step(1);
    } else return { error: `At ${line}:${col}: illegal char` };
  }
  out.push({ kind: 'eof', text: 'EOF', line, col });
  return out;
}

/** Reads a policy like ParseACLPolicy: its path rules, or the error OpenBao gives. */
export function parsePolicy(src: string): Parsed {
  const toks = tokens(src);
  if ('error' in toks) return { error: `failed to parse policy: ${toks.error}` };
  let i = 0;
  const peek = () => toks[i];
  const fail = (msg: string) => ({ error: `failed to parse policy: ${msg}` });
  const rules: Rule[] = [];
  const badKeys: string[] = [];
  // A value: a string, a number, a list, or an object (skipped, but checked for balance).
  const value = (): string | string[] | null | { error: string } => {
    const t = toks[i++];
    if (t.kind === 'string' || t.kind === 'number' || t.kind === 'ident') return t.text;
    if (t.text === '[') {
      const list: string[] = [];
      while (peek().text !== ']') {
        const v = toks[i++];
        if (v.kind === 'eof') return { error: `At ${v.line}:${v.col}: list expected closing RBRACK got: EOF` };
        if (v.kind !== 'string' && v.kind !== 'number') return { error: `At ${v.line}:${v.col}: illegal char` };
        list.push(v.text);
        if (peek().text === ',') i++;
        else if (peek().text !== ']') {
          const x = peek();
          return { error: `At ${x.line}:${x.col}: list expected closing RBRACK got: ${x.kind === 'eof' ? 'EOF' : x.kind === 'string' ? 'STRING' : x.text}` };
        }
      }
      i++;
      return list;
    }
    if (t.text === '{') {
      const r = body(() => {});
      return 'error' in (r as object) ? (r as { error: string }) : null;
    }
    return { error: `At ${t.line}:${t.col}: Unknown token: ${t.line}:${t.col} ${t.kind === 'eof' ? 'EOF' : t.text}` };
  };
  // An object's body until its closing brace: key [= ] value, or key "label" { … }.
  const body = (onItem: (key: string, v: string | string[] | null, line: number) => void, top = false): { ok: true } | { error: string } => {
    for (;;) {
      const t = peek();
      if (t.kind === 'eof') {
        if (top) return { ok: true };
        return { error: `At ${t.line}:${t.col}: object expected closing RBRACE got: EOF` };
      }
      if (t.text === '}') {
        if (top) return { error: `At ${t.line}:${t.col}: expected: IDENT | STRING got: RBRACE` };
        i++;
        return { ok: true };
      }
      if (t.kind !== 'ident' && t.kind !== 'string') return { error: `At ${t.line}:${t.col}: expected: IDENT | STRING got: ${t.text === '=' ? 'ASSIGN' : t.text}` };
      i++;
      const key = t.text;
      if (top && key === 'path') {
        const label = peek();
        if (label.kind !== 'string') return { error: `At ${label.line}:${label.col}: key '${key}' expected start of object ('{') or assignment ('=')` };
        i++;
        if (peek().text === '=') i++;
        const open = peek();
        if (open.text !== '{') return { error: `At ${open.line}:${open.col}: expected start of object ('{') or assignment ('=')` };
        i++;
        let caps: string[] = [];
        const r = body((k, v) => {
          if (k === 'capabilities' && Array.isArray(v)) caps = v;
        });
        if ('error' in r) return r;
        rules.push({ path: label.text, capabilities: caps });
        continue;
      }
      if (peek().text === '=') i++;
      else if (peek().text !== '{' && peek().kind !== 'string') {
        const x = peek();
        return { error: `At ${x.line}:${x.col}: key '${key}' expected start of object ('{') or assignment ('=')` };
      }
      // A labelled block other than path: its labels, then the object.
      while (peek().kind === 'string' && toks[i + 1]?.text !== '=' && top) i++;
      const v = value();
      if (v && typeof v === 'object' && 'error' in v) return v as { error: string };
      if (top) {
        if (key !== 'name') badKeys.push(`invalid key "${key}" on line ${t.line}`);
      } else onItem(key, v as string | string[] | null, t.line);
    }
  };
  const r = body(() => {}, true);
  if ('error' in r) return fail(r.error);
  if (badKeys.length) return fail(`${badKeys.length} error${badKeys.length > 1 ? 's' : ''} occurred:\n${badKeys.map((k) => `\t* ${k}`).join('\n')}\n\n`);
  for (const rule of rules) {
    if (/\+\*/.test(rule.path)) return fail(`path "${rule.path}": invalid use of wildcards ('+*' is forbidden)`);
    for (const c of rule.capabilities) if (!CAPABILITIES.includes(c)) return fail(`path "${rule.path}": path "${rule.path}": invalid capability "${c}"`);
  }
  return { rules };
}

/** Does a rule's path match a request path ("*" at the end: a prefix; "+": one segment)? */
export function matches(pattern: string, path: string): boolean {
  const glob = pattern.endsWith('*');
  const body = (glob ? pattern.slice(0, -1) : pattern)
    .split('/')
    .map((seg) => (seg === '+' ? '[^/]+' : seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .join('/');
  return new RegExp(`^${body}${glob ? '.*' : ''}$`).test(path);
}

/** Vault's priority between two matching rules: > 0 if a wins (https://openbao.org/docs/concepts/policies/#priority-matching). */
function priority(a: string, b: string): number {
  const firstWild = (s: string) => {
    const i = s.search(/[+*]/);
    return i < 0 ? s.length + 1 : i;
  };
  if (firstWild(a) !== firstWild(b)) return firstWild(a) - firstWild(b);
  const star = (s: string) => (s.endsWith('*') ? 1 : 0);
  if (star(a) !== star(b)) return star(b) - star(a);
  const plus = (s: string) => (s.match(/\+/g) ?? []).length;
  if (plus(a) !== plus(b)) return plus(b) - plus(a);
  if (a.length !== b.length) return a.length - b.length;
  return a < b ? 1 : a > b ? -1 : 0;
}

/** The rules of a set of policies, merged by pattern (unknown policies are skipped). */
function rulesOf(b: BaoState, policies: string[]): Map<string, Set<string>> {
  const merged = new Map<string, Set<string>>();
  for (const name of policies) {
    const text = name === 'default' ? (b.policies.default ?? DEFAULT_POLICY) : b.policies[name];
    if (!text) continue;
    const p = parsePolicy(text);
    if ('error' in p) continue;
    for (const r of p.rules) {
      const set = merged.get(r.path) ?? new Set<string>();
      r.capabilities.forEach((c) => set.add(c));
      merged.set(r.path, set);
    }
  }
  return merged;
}

/** A token's capabilities on a path, like sys/capabilities: ["root"], ["deny"], or the list. */
export function capabilitiesOf(b: BaoState, policies: string[], path: string): string[] {
  if (policies.includes('root')) return ['root'];
  let best: string | null = null;
  const rules = rulesOf(b, policies);
  for (const pattern of rules.keys()) if (matches(pattern, path) && (best === null || priority(pattern, best) > 0)) best = pattern;
  if (best === null) return ['deny'];
  const caps = [...rules.get(best)!];
  if (caps.includes('deny') || !caps.length) return ['deny'];
  return caps.sort();
}

/** Do these policies give any capability at or under a mount (the KV preflight's check)? */
export function hasMountAccess(b: BaoState, policies: string[], mount: string): boolean {
  if (policies.includes('root')) return true;
  const rules = rulesOf(b, policies);
  for (const [pattern, caps] of rules) {
    if (caps.has('deny')) continue;
    if (pattern.startsWith(mount) || matches(pattern, mount) || (pattern.endsWith('*') && mount.startsWith(pattern.slice(0, -1)))) return true;
  }
  return false;
}

// Paths whose access also needs sudo (root-protected).
const SUDO_PATHS = [/^sys\/audit(\/|$)/, /^sys\/seal$/, /^sys\/raw(\/|$)/, /^sys\/rotate$/, /^sys\/step-down$/];

// ——— The API ———

export interface Request {
  method: 'GET' | 'PUT' | 'POST' | 'PATCH' | 'DELETE' | 'LIST';
  // Without /v1/ (e.g. secret/data/bunks/db).
  path: string;
  token?: string;
  data?: Record<string, unknown>;
  remote?: string;
  // The URL as the CLI writes it in its errors (a query string, the method it shows).
  query?: string;
}
export interface Response {
  status: number;
  errors?: string[];
  data?: Record<string, unknown>;
  auth?: AuthData;
  warnings?: string[];
  // A connection refused (the server is down).
  refused?: boolean;
}
export interface AuthData {
  token: BaoToken;
}

const DENIED = '1 error occurred:\n\t* permission denied\n\n';
/** The API's error, as the Go client prints it (api/response.go). */
export function apiError(method: string, path: string, r: Response, query = ''): string {
  const shown = method === 'LIST' ? 'GET' : method;
  const q = method === 'LIST' ? '?list=true' : query;
  return `Error making API request.\n\nURL: ${shown} ${ADDRESS}/v1/${path}${q}\nCode: ${r.status}. Errors:\n\n${(r.errors ?? []).map((e) => `* ${e}`).join('')}`;
}
export const refusedText = (path: string, method = 'GET') =>
  `${method === 'LIST' ? 'Get' : method[0] + method.slice(1).toLowerCase()} "${ADDRESS}/v1/${path}${method === 'LIST' ? '?list=true' : ''}": dial tcp 127.0.0.1:8200: connect: connection refused`;

// The paths a sealed server still answers, and those the audit device never sees.
const UNSEALED_NOT_NEEDED = ['sys/seal-status', 'sys/unseal', 'sys/init', 'sys/leader', 'sys/health'];

/** One API request: the seal, the token, the ACL, the handler, the audit log. */
export function request(g: Game, req: Request): Response {
  const b = bao(g)!;
  const remote = req.remote ?? '127.0.0.1';
  const done = (r: Response, note?: string): Response => {
    b.runs.push({ method: req.method, path: req.path, status: r.status, token: req.token, remote, note, at: now(g) });
    return r;
  };
  if (!serverUp(g)) return done({ status: 0, refused: true });
  if (UNSEALED_NOT_NEEDED.includes(req.path)) return done(unauthenticated(g, b, req));
  if (b.sealed) return done({ status: 503, errors: ['Vault is sealed'] });
  // The token.
  const token = req.token ? lookupToken(g, req.token) : null;
  const op = operationOf(req);
  const audit = (r: Response, error?: string) => auditEntry(g, b, req, token, op, r, remote, error);
  if (!token) {
    const r: Response = { status: 403, errors: ['permission denied'] };
    audit(r, 'permission denied');
    return done(r);
  }
  // Paths every valid token may use for itself, checked by the default policy but answered here.
  const r = route(g, b, req, token, op);
  audit(r, r.status >= 400 ? (r.errors ?? []).join('; ') : undefined);
  return done(r);
}

function operationOf(req: Request): string {
  if (req.method === 'GET') return 'read';
  if (req.method === 'LIST') return 'list';
  if (req.method === 'DELETE') return 'delete';
  if (req.method === 'PATCH') return 'patch';
  return 'update';
}

/** Is this token allowed this operation on this path? (create/update decided by the caller.) */
export function allowed(b: BaoState, token: BaoToken, path: string, capability: string): boolean {
  const caps = capabilitiesOf(b, token.policies, path);
  if (caps.includes('root')) return true;
  if (caps.includes('deny')) return false;
  if (SUDO_PATHS.some((re) => re.test(path)) && !caps.includes('sudo')) return false;
  return caps.includes(capability);
}

function unauthenticated(g: Game, b: BaoState, req: Request): Response {
  if (req.path === 'sys/init') {
    if (req.method === 'GET') return { status: 200, data: { initialized: b.initialized } };
    return { status: 400, errors: ['Vault is already initialized'] };
  }
  if (req.path === 'sys/unseal') return unsealRequest(g, b, req);
  if (req.path === 'sys/leader') return { status: 200, data: { ha_enabled: false } };
  return { status: 200, data: sealStatus(b) };
}

export function sealStatus(b: BaoState): Record<string, unknown> {
  return {
    type: 'shamir',
    initialized: b.initialized,
    sealed: b.sealed,
    t: b.threshold,
    n: b.shares.length,
    progress: b.parts.length,
    nonce: b.nonce,
    version: VERSION,
    commit_date: COMMIT_DATE,
    storage_type: 'pebbledb',
    ...(b.sealed ? {} : { cluster_name: b.clusterName, cluster_id: b.clusterId }),
  };
}

/** sys/unseal: a share (base64 or hex), counted once; at the threshold, the shares are combined. */
function unsealRequest(g: Game, b: BaoState, req: Request): Response {
  const data = req.data ?? {};
  if (data.reset) {
    if (!b.sealed) return { status: 400, errors: ['vault is unsealed'] };
    b.parts = [];
    b.nonce = '';
    return { status: 200, data: sealStatus(b) };
  }
  const key = String(data.key ?? '').trim();
  if (!key) return { status: 400, errors: ["'key' must be specified in request body as JSON, or 'reset' set to true"] };
  if (!b.sealed) return { status: 200, data: sealStatus(b) };
  // The share decodes to its bytes: hex first (16 to 33 bytes), then base64.
  let bytes: number;
  if (/^[0-9a-fA-F]+$/.test(key) && key.length % 2 === 0 && key.length / 2 >= 16 && key.length / 2 <= 33) bytes = key.length / 2;
  else {
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(key) || key.length % 4 !== 0) return { status: 400, errors: ["'key' must be a valid hex or base64 string"] };
    bytes = (key.length / 4) * 3 - (key.endsWith('==') ? 2 : key.endsWith('=') ? 1 : 0);
  }
  if (bytes < 16) return { status: 400, errors: ['invalid key: key is shorter than minimum 16 bytes'] };
  if (bytes > 33) return { status: 400, errors: ['invalid key: key is longer than maximum 33 bytes'] };
  if (b.parts.includes(key)) {
    // Already given: recordUnsealPart ignores it, the progress doesn't move.
    b.runs.push({ method: 'PUT', path: 'sys/unseal-duplicate', status: 200, remote: req.remote ?? '127.0.0.1', note: 'duplicate', at: now(g) });
    return { status: 200, data: sealStatus(b) };
  }
  if (!b.parts.length) b.nonce = uuidOf(`nonce:${b.seq++}`);
  b.parts.push(key);
  if (b.parts.length < b.threshold) return { status: 200, data: sealStatus(b) };
  // The threshold: combine. One wrong share and the key doesn't decrypt the keyring.
  const ok = b.parts.every((p) => b.shares.includes(p));
  b.parts = [];
  b.nonce = '';
  if (!ok) return { status: 400, errors: ['invalid key: failed to decrypt keys from storage: cipher: message authentication failed'] };
  b.sealed = false;
  b.runs.push({ method: 'PUT', path: 'sys/unsealed', status: 200, remote: req.remote ?? '127.0.0.1', note: 'unsealed', at: now(g) });
  return { status: 200, data: sealStatus(b) };
}

// ——— The routes behind a token ———

export const MOUNT = 'secret/';

function route(g: Game, b: BaoState, req: Request, token: BaoToken, op: string): Response {
  const path = req.path;
  const data = req.data ?? {};
  const deny = (): Response => ({ status: 403, errors: [DENIED] });
  // The token's own paths (the default policy grants them).
  if (path === 'auth/token/lookup-self') return allowed(b, token, path, 'read') ? { status: 200, data: lookupData(g, token) } : deny();
  if (path === 'auth/token/revoke-self') {
    if (!allowed(b, token, path, 'update')) return deny();
    revokeTree(b, token.id);
    return { status: 204 };
  }
  if (path === 'sys/capabilities-self' || path === 'sys/capabilities') {
    if (!allowed(b, token, path, 'update')) return deny();
    let target = token;
    if (path === 'sys/capabilities') {
      const t = lookupToken(g, String(data.token ?? ''));
      if (!t) return { status: 400, errors: ['invalid token'] };
      target = t;
    }
    return { status: 200, data: { capabilities: capabilitiesOf(b, target.policies, String(data.path ?? '').replace(/^\//, '')) } };
  }
  // The KV preflight: which mount, which version.
  const pre = /^sys\/internal\/ui\/mounts\/(.*)$/.exec(path);
  if (pre) {
    const asked = pre[1].replace(/^\/+/, '');
    const sanitized = asked.endsWith('/') ? asked : `${asked}/`;
    const err = (): Response => ({ status: 403, errors: [`preflight capability check returned 403, please ensure client's policies grant access to path "${sanitized}"`] });
    if (!sanitized.startsWith(MOUNT)) return err();
    if (!hasMountAccess(b, token.policies, MOUNT)) return err();
    return { status: 200, data: { path: MOUNT, type: 'kv', options: { version: '2' } } };
  }
  // KV version 2.
  const kv = /^secret\/(data|metadata)\/(.*)$/.exec(path) ?? /^secret\/(data|metadata)$/.exec(path);
  if (kv) return kvRoute(g, b, req, token, op, kv[1], (kv[2] ?? '').replace(/\/+$/, ''));
  if (/^secret\//.test(path) || path === 'secret') {
    // Without data/ or metadata/: the engine has no such path.
    if (!allowed(b, token, path, op === 'update' ? 'update' : op)) return deny();
    return { status: 404, errors: [] };
  }
  // Policies.
  const pol = /^sys\/policies\/acl\/?(.*)$/.exec(path) ?? /^sys\/policy\/?(.*)$/.exec(path);
  if (pol) return policyRoute(b, req, token, op, pol[1]);
  // Tokens.
  if (path.startsWith('auth/token/')) return tokenRoute(g, b, req, token, op);
  // The audit devices, and the hash of a value with a device's salt.
  if (path === 'sys/audit') {
    if (!allowed(b, token, path, 'read')) return deny();
    return { status: 200, data: b.audit ? { [`${b.audit.path}`]: { type: b.audit.type, path: b.audit.path, description: '', options: { file_path: b.audit.file } } } : {} };
  }
  const hash = /^sys\/audit-hash\/(.+)$/.exec(path);
  if (hash) {
    if (!allowed(b, token, path, 'update')) return deny();
    const device = hash[1].replace(/\/?$/, '/');
    if (!b.audit || b.audit.path !== device) return { status: 400, errors: ['unknown audit backend'] };
    return { status: 200, data: { hash: `hmac-sha256:${hmacSha256(b.audit.salt, String(data.input ?? ''))}` } };
  }
  if (path === 'sys/mounts') {
    if (!allowed(b, token, path, 'read')) return deny();
    return { status: 200, data: MOUNTS };
  }
  if (path === 'sys/seal') {
    if (!allowed(b, token, path, 'update')) return deny();
    seal(g);
    return { status: 204 };
  }
  if (!allowed(b, token, path, op)) return deny();
  return { status: 404, errors: [] };
}

export const MOUNTS: Record<string, { type: string; accessor: string; description: string }> = {
  'cubbyhole/': { type: 'cubbyhole', accessor: 'cubbyhole_4b1c3a9e', description: 'per-token private secret storage' },
  'identity/': { type: 'identity', accessor: 'identity_7f02d5c1', description: 'identity store' },
  'secret/': { type: 'kv', accessor: 'kv_92e6b0d4', description: 'n/a' },
  'sys/': { type: 'system', accessor: 'system_1d3f8a62', description: 'system endpoints used for control, policy and debugging' },
};

export function lookupData(g: Game, t: BaoToken): Record<string, unknown> {
  const left = ttlLeft(g, t);
  const d: Record<string, unknown> = {
    accessor: t.accessor,
    creation_time: Math.floor(toUtc(t.created) / 1000),
    creation_ttl: t.ttl,
    display_name: t.displayName,
    entity_id: '',
    expire_time: t.ttl ? rfc3339(t.created + t.ttl * 1000, `expire:${t.id}`) : null,
    explicit_max_ttl: 0,
    id: t.id,
    meta: null,
    num_uses: 0,
    orphan: t.parent === null,
    path: t.path,
    policies: [...t.policies],
    ttl: left ?? 0,
    type: 'service',
  };
  if (t.ttl) {
    d.issue_time = rfc3339(t.created, `issue:${t.id}`);
    d.renewable = true;
  }
  if (t.period) d.period = t.period;
  return d;
}

function kvRoute(g: Game, b: BaoState, req: Request, token: BaoToken, op: string, kind: string, key: string): Response {
  const path = req.path;
  const deny = (): Response => ({ status: 403, errors: [DENIED] });
  const secret = b.kv[key];
  if (kind === 'metadata') {
    if (op === 'list') {
      if (!allowed(b, token, path.replace(/\/?$/, '/'), 'list') && !allowed(b, token, path, 'list')) return deny();
      const prefix = key ? `${key}/` : '';
      const keys = [...new Set(Object.keys(b.kv).filter((k) => k.startsWith(prefix)).map((k) => { const rest = k.slice(prefix.length); const i = rest.indexOf('/'); return i < 0 ? rest : rest.slice(0, i + 1); }))].sort();
      if (!keys.length) return { status: 404, errors: [] };
      return { status: 200, data: { keys } };
    }
    if (!allowed(b, token, path, 'read')) return deny();
    if (!secret) return { status: 404, errors: [] };
    return { status: 200, data: metadataOf(secret) };
  }
  if (op === 'read') {
    if (!allowed(b, token, path, 'read')) return deny();
    if (!secret) return { status: 404, errors: [] };
    const asked = Number((req.data ?? {}).version ?? 0);
    const v = asked ? secret.versions[asked - 1] : secret.versions.at(-1);
    if (!v) return { status: 404, errors: [] };
    return { status: 200, data: { data: { ...v.data }, metadata: versionMeta(v, asked || secret.versions.length) } };
  }
  if (op === 'update' || op === 'patch') {
    const need = op === 'patch' ? 'patch' : secret ? 'update' : 'create';
    if (!allowed(b, token, path, need)) return deny();
    if (op === 'patch' && !secret) return { status: 404, errors: [] };
    const incoming = ((req.data ?? {}).data ?? {}) as Record<string, string | null>;
    let next: Record<string, string> = {};
    if (op === 'patch') {
      next = { ...secret!.versions.at(-1)!.data };
      for (const [k, v] of Object.entries(incoming)) {
        if (v === null) delete next[k];
        else next[k] = v;
      }
    } else for (const [k, v] of Object.entries(incoming)) if (v !== null) next[k] = String(v);
    const at = now(g);
    const s = (b.kv[key] ??= { versions: [], created: at });
    s.versions.push({ data: next, created: at });
    return { status: 200, data: versionMeta(s.versions.at(-1)!, s.versions.length) };
  }
  if (!allowed(b, token, path, op)) return deny();
  return { status: 404, errors: [] };
}

export function versionMeta(v: KvVersion, n: number): Record<string, unknown> {
  return { created_time: rfc3339(v.created, `kv:${n}:${v.created}`), custom_metadata: null, deletion_time: '', destroyed: false, version: n };
}
function metadataOf(s: KvSecret): Record<string, unknown> {
  const versions: Record<string, unknown> = {};
  s.versions.forEach((v, i) => {
    versions[String(i + 1)] = { created_time: rfc3339(v.created, `kv:${i + 1}:${v.created}`), deletion_time: '', destroyed: false };
  });
  const last = s.versions.at(-1)!;
  return {
    cas_required: false,
    created_time: rfc3339(s.versions[0].created, `kv:1:${s.versions[0].created}`),
    current_version: s.versions.length,
    custom_metadata: null,
    delete_version_after: '0s',
    max_versions: 0,
    oldest_version: 0,
    updated_time: rfc3339(last.created, `kv:${s.versions.length}:${last.created}`),
    versions,
  };
}

function policyRoute(b: BaoState, req: Request, token: BaoToken, op: string, name: string): Response {
  const deny = (): Response => ({ status: 403, errors: [DENIED] });
  const path = name ? `sys/policies/acl/${name}` : 'sys/policies/acl';
  if (!name || op === 'list') {
    if (!allowed(b, token, 'sys/policies/acl', 'list') && !allowed(b, token, 'sys/policies/acl/', 'list')) return deny();
    return { status: 200, data: { keys: ['default', ...Object.keys(b.policies).filter((p) => p !== 'default').sort(), 'root'] } };
  }
  const n = name.toLowerCase();
  if (op === 'read') {
    if (!allowed(b, token, path, 'read')) return deny();
    if (n === 'root') return { status: 200, data: { name: 'root', policy: '' } };
    const text = n === 'default' ? (b.policies.default ?? DEFAULT_POLICY) : b.policies[n];
    if (text === undefined) return { status: 404, errors: [] };
    return { status: 200, data: { name: n, policy: text } };
  }
  if (op === 'delete') {
    if (!allowed(b, token, path, 'delete')) return deny();
    if (n === 'root' || n === 'default') return { status: 400, errors: [`cannot delete "${n}" policy`] };
    delete b.policies[n];
    return { status: 204 };
  }
  // Write.
  if (!allowed(b, token, path, b.policies[n] ? 'update' : 'create')) return deny();
  if (n === 'root') return { status: 400, errors: ['cannot update "root" policy'] };
  const text = String((req.data ?? {}).policy ?? '');
  if (!text.trim()) return { status: 400, errors: ["'policy' parameter not supplied or empty"] };
  const parsed = parsePolicy(text);
  if ('error' in parsed) return { status: 400, errors: [parsed.error] };
  b.policies[n] = text;
  return { status: 204 };
}

function tokenRoute(g: Game, b: BaoState, req: Request, token: BaoToken, op: string): Response {
  const path = req.path;
  const data = req.data ?? {};
  const deny = (): Response => ({ status: 403, errors: [DENIED] });
  const create = /^auth\/token\/create(-orphan)?$/.exec(path);
  if (create) {
    if (!allowed(b, token, 'auth/token/create', 'update') && !(create[1] && allowed(b, token, path, 'update'))) return deny();
    const isRoot = token.policies.includes('root');
    const sudo = isRoot || capabilitiesOf(b, token.policies, 'auth/token/create').includes('sudo');
    let policies = (data.policies as string[] | undefined)?.map((p) => p.trim().toLowerCase()).filter(Boolean);
    if (!policies?.length) policies = token.policies.filter((p) => p !== 'default');
    const noDefault = !!data.no_default_policy;
    policies = [...new Set(policies)];
    if (!noDefault && !policies.includes('root')) policies.push('default');
    policies.sort();
    if (!sudo && !policies.every((p) => token.policies.includes(p) || p === 'default')) return { status: 400, errors: ['child policies must be subset of parent'] };
    if (policies.includes('root') && !isRoot) return { status: 400, errors: ['root tokens may not be created without parent token being root'] };
    const orphan = !!create[1] || !!data.no_parent;
    if (orphan && !sudo) return { status: 400, errors: ['root or sudo privileges required to create orphan token'] };
    const period = typeof data.period === 'number' ? data.period : 0;
    let ttl = typeof data.ttl === 'number' ? data.ttl : 0;
    if (policies.includes('root') && !ttl && !period) ttl = 0;
    else {
      if (period) ttl = period;
      if (!ttl) ttl = MAX_TTL;
      if (ttl > MAX_TTL) ttl = MAX_TTL;
    }
    const t = mint(b, `${b.seq++}`, {
      policies,
      displayName: data.display_name ? `token-${String(data.display_name).replace(/^token-/, '')}` : 'token',
      path: create[1] ? 'auth/token/create-orphan' : 'auth/token/create',
      parent: orphan ? null : token.id,
      created: now(g),
      ttl,
      period: period || undefined,
      createdBy: token.id,
    });
    return { status: 200, auth: { token: t } };
  }
  if (path === 'auth/token/lookup' || path === 'auth/token/lookup-accessor') {
    if (!allowed(b, token, path, 'update')) return deny();
    const which = path.endsWith('accessor') ? byAccessor(b, String(data.accessor ?? '')) : lookupToken(g, String(data.token ?? ''));
    if (!which) return path.endsWith('accessor') ? { status: 400, errors: ['invalid accessor'] } : { status: 403, errors: ['bad token'] };
    return { status: 200, data: lookupData(g, which) };
  }
  if (path === 'auth/token/revoke' || path === 'auth/token/revoke-accessor') {
    if (!allowed(b, token, path, 'update')) return deny();
    const which = path.endsWith('accessor') ? byAccessor(b, String(data.accessor ?? '')) : b.tokens[String(data.token ?? '')];
    if (path.endsWith('accessor') && !which) return { status: 400, errors: ['invalid accessor'] };
    if (which) revokeTree(b, which.id);
    return { status: 204 };
  }
  if (path === 'auth/token/renew-self') {
    if (!allowed(b, token, path, 'update')) return deny();
    if (token.ttl) token.created = now(g);
    return { status: 200, auth: { token } };
  }
  if (!allowed(b, token, path, op)) return deny();
  return { status: 404, errors: [] };
}

// ——— The audit device ———

const hmacOf = (b: BaoState, s: string) => `hmac-sha256:${hmacSha256(b.audit!.salt, s)}`;

/** Writes the request and response entries for one request, as the file device does (one JSON object per line). */
function auditEntry(g: Game, b: BaoState, req: Request, token: BaoToken | null, op: string, r: Response, remote: string, error?: string) {
  if (!b.audit) return;
  const time = rfc3339(now(g), `audit:${b.auditLines.length}`);
  const id = uuidOf(`request:${b.auditLines.length}:${now(g)}`);
  const auth = token
    ? {
        client_token: hmacOf(b, token.id),
        accessor: hmacOf(b, token.accessor),
        display_name: token.displayName,
        policies: token.policies,
        token_policies: token.policies,
        policy_results: { allowed: r.status < 400 },
        token_type: 'service',
        ...(token.ttl ? { token_ttl: token.ttl, token_issue_time: rfc3339(token.created) } : {}),
      }
    : { policy_results: { allowed: false }, token_type: 'default' };
  const kv = /^secret\/(data|metadata)\//.test(req.path);
  const request = {
    id,
    operation: op,
    ...(kv ? { mount_point: MOUNT, mount_type: 'kv', mount_class: 'secret' } : {}),
    ...(req.token ? { client_token: hmacOf(b, req.token), client_token_accessor: token ? hmacOf(b, token.accessor) : '' } : {}),
    namespace: { id: 'root' },
    path: req.path,
    ...(req.data && Object.keys(req.data).length ? { data: hashData(b, req.data) } : {}),
    remote_address: remote,
    remote_port: 40000 + (b.auditLines.length * 7919) % 20000,
  };
  b.auditLines.push(JSON.stringify({ time, type: 'request', auth, request, ...(error ? { error } : {}) }));
  const response =
    r.status < 400
      ? {
          ...(kv ? { mount_point: MOUNT, mount_type: 'kv', mount_class: 'secret' } : {}),
          ...(r.data ? { data: hashData(b, r.data) } : {}),
        }
      : undefined;
  b.auditLines.push(JSON.stringify({ time, type: 'response', auth, request, ...(response ? { response } : {}), ...(error ? { error } : {}) }));
}

/** Strings HMAC'd, other values as they are (the audit device's hashstructure). */
function hashData(b: BaoState, v: unknown): unknown {
  if (typeof v === 'string') return hmacOf(b, v);
  if (Array.isArray(v)) return v.map((x) => hashData(b, x));
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, hashData(b, x)]));
  return v;
}

/** The audit log file's text (its content is this function: the device appends as requests come). */
export const auditText = (g: Game) => (bao(g)?.auditLines ?? []).join('\n');

/** A new server's state: initialized, the given shares, tokens and policies come from the story. */
export function newBao(o: { shares: string[]; threshold: number; sealed: boolean; salt: string; auditFile: string; seed: string }): BaoState {
  return {
    initialized: true,
    sealed: o.sealed,
    shares: o.shares,
    threshold: o.threshold,
    parts: [],
    nonce: '',
    clusterName: `vault-cluster-${sha256(enc(`cluster:${o.seed}`)).slice(0, 8)}`,
    clusterId: uuidOf(`cluster-id:${o.seed}`),
    tokens: {},
    revoked: {},
    policies: {},
    kv: {},
    audit: { path: 'file/', type: 'file', file: o.auditFile, salt: `salt:${o.seed}` },
    auditLines: [],
    seq: 0,
    runs: [],
  };
}
