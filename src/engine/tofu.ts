// OpenTofu 1.13 (the open-source fork of Terraform), loaded with the story
// that keeps its DNS as code ("The Mapping Party"): `tofu` reads a
// directory's *.tf files (hcl.ts), installs its provider from a local
// filesystem mirror (init, .terraform.lock.hcl), checks it (validate),
// formats it (fmt), compares it with the state and with the real objects
// (plan: refresh, drift, + ~ - -/+), changes them (apply, with its "yes"),
// adopts an object made by hand (import, import blocks), edits the state
// (state list/show/rm/mv) and shows outputs. The state is a local backend:
// terraform.tfstate (JSON, format 4, serial, lineage, a backup), locked
// while an operation runs; another process's lock stops the next one.
// The one provider is hashicorp/dns 3.6.2 (RFC 2136 dynamic updates with a
// TSIG key): its record sets are the game's BIND zones (dns.ts), so `dig`
// sees what apply did and `tofu plan` sees what someone changed by hand.
// Messages after OpenTofu v1.13.10's sources (internal/command/views,
// internal/command/jsonformat, internal/backend/local, internal/tofu,
// internal/states/statemgr) and the provider's (terraform-provider-dns
// v3.6.2, internal/provider); see docs/ACCURACY.md.
// Docs: https://opentofu.org/docs/cli/commands/,
// https://opentofu.org/docs/language/state/,
// https://search.opentofu.org/provider/hashicorp/dns/latest.
// Differences: one provider; no modules, workspaces, count/for_each,
// data sources, functions, remote backends nor -generate-config-out; the
// TSIG key isn't checked; unset variables are an error (as with
// -input=false), tofu never prompts for them; named writes each update to
// its journal (.jnl) and keeps the zone file as it was.

import type { Shell } from './shell';
import type { Context } from './commands/index';
import { d, f, type File } from './world';
import { declaredZones, dns, type DnsState, type Rr } from './dns';
import { systemd, writeLog } from './systemd';
import { nowOf } from './time';
import { sgr } from './colours';
import { labelledDiff } from './commands/diff';
import type { Process } from './commands/system';
import { format, literal, parse, type Attribute, type Block, type Body, type Diagnostic, type Expr, type Range, type Value } from './hcl';

export const VERSION = '1.13.10';
export const DNS_VERSION = '3.6.2';
const REGISTRY = 'registry.opentofu.org';
export const DNS_FQN = `${REGISTRY}/hashicorp/dns`;
const PLATFORM = 'linux_amd64';
const WIDTH = 78;
export const STATE_FILE = 'terraform.tfstate';
const LOCK_FILE = '.terraform.lock.hcl';
const PLUGIN_DIR = `.terraform/providers/${DNS_FQN}/${DNS_VERSION}/${PLATFORM}`;
// The h1: hash of the provider's package (dirhash of the unpacked files), fixed.
export const DNS_HASH = 'h1:Hx3vYhJ0n6b1kN3Qz1x5w9iNq0g0bq8Yp5xJb5hZ7cE=';

// ——— The story's side: who holds a lock, what was run ———

export interface LockInfo {
  id: string;
  path: string;
  operation: string;
  who: string;
  version: string;
  created: string;
  info: string;
}
export interface TofuRun {
  // init, plan, apply, import, state rm, fmt, validate…
  command: string;
  dir: string;
  ok: boolean;
  autoApprove?: boolean;
  noLock?: boolean;
  // What an apply did: addresses created, updated, destroyed, imported.
  created?: string[];
  updated?: string[];
  destroyed?: string[];
  imported?: string[];
  removed?: string[];
  // A plan: its counts and whether drift was shown.
  changes?: number;
  drift?: string[];
  refreshOnly?: boolean;
  formatted?: string[];
  valid?: boolean;
  user: string;
  // Set by the story after the command: did everything agree then?
  ranAfter?: boolean;
}
export interface Tofu {
  // A lock another process holds on a state file (absolute path): its PID and its info.
  locks: Record<string, { pid: number; info: LockInfo }>;
  // The text tofu last wrote to each state file (a hand edit shows).
  written: Record<string, string>;
  runs: TofuRun[];
  counter: number;
  // The filesystem mirror's providers (versions).
  mirror: { path: string; versions: string[] };
}
export const tofuOf = (game: Shell): Tofu => {
  const p = game.principal;
  return (p.state.tofu ??= { locks: {}, written: {}, runs: [], counter: 0, mirror: { path: '/usr/share/opentofu/providers', versions: [DNS_VERSION] } } satisfies Tofu);
};

// ——— Output helpers ———

class Out {
  lines: string[] = [];
  errors: string[] = [];
  constructor(public colour: boolean) {}
  c(code: string, text: string) {
    return this.colour ? sgr(code, text) : text;
  }
  print(text: string) {
    this.lines.push(text);
  }
  diag(d: Diagnostic, sources: Record<string, string>) {
    const text = renderDiagnostic(d, sources, this);
    if (d.severity === 'error') this.errors.push(text);
    else this.lines.push(text);
  }
}

/** go-wordwrap's WrapString: lines of at most `limit` characters, broken at spaces. */
export function wrap(text: string, limit: number): string {
  return text
    .split('\n')
    .map((line) => {
      if (line.startsWith(' ')) return line;
      const words = line.split(' ');
      const out: string[] = [];
      let current = '';
      for (const w of words) {
        if (!current) current = w;
        else if (current.length + 1 + w.length <= limit) current += ' ' + w;
        else {
          out.push(current);
          current = w;
        }
      }
      out.push(current);
      return out.join('\n');
    })
    .join('\n');
}

/** A diagnostic in a box, like format.Diagnostic: ╷ │ ╵, the snippet, the detail wrapped. */
export function renderDiagnostic(d: Diagnostic, sources: Record<string, string>, o?: { c: (code: string, t: string) => string }): string {
  const c = o?.c.bind(o) ?? ((_: string, t: string) => t);
  const body: string[] = [];
  body.push(`${d.severity === 'error' ? c('1;31', 'Error: ') : c('1;33', 'Warning: ')}${c('1', d.summary)}`, '');
  if (d.address) body.push(`  with ${d.address},`);
  if (d.subject) {
    const src = sources[d.subject.file];
    body.push(`  on ${d.subject.file} line ${d.subject.start.line}${d.context ? `, in ${d.context}` : ''}:`);
    if (src !== undefined) {
      const all = src.split('\n');
      for (let n = d.subject.start.line; n <= Math.max(d.subject.start.line, d.subject.end.line); n++) body.push(`${String(n).padStart(4)}: ${all[n - 1] ?? ''}`);
    } else body.push('  (source code not available)');
    body.push('');
  }
  if (d.detail) body.push(...wrap(d.detail, WIDTH - 3).split('\n'));
  const rule = d.severity === 'error' ? '31' : '33';
  return [c(rule, '╷'), ...body.map((l) => (l === '' ? c(rule, '│') : `${c(rule, '│')} ${l}`)), c(rule, '╵')].join('\n');
}

const sourceless = (severity: 'error' | 'warning', summary: string, detail?: string): Diagnostic => ({ severity, summary, detail });

/** didyoumean.NameSuggestion: the closest name, if its Levenshtein distance is under 3. */
export function suggest(given: string, names: string[]): string {
  let best = '';
  let distance = Infinity;
  for (const n of names) {
    const dist = levenshtein(given, n);
    if (dist < 3 && dist < distance) {
      best = n;
      distance = dist;
    }
  }
  return best;
}
function levenshtein(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

// ——— The provider's schema (hashicorp/dns 3.6.2) ———

interface AttrSchema {
  kind: 'string' | 'number' | 'set';
  required?: boolean;
  optional?: boolean;
  computed?: boolean;
  forceNew?: boolean;
  default?: Value;
}
interface ResourceSchema {
  rrType: 'A' | 'AAAA' | 'CNAME';
  attrs: Record<string, AttrSchema>;
}
const RECORD_SET = (rrType: 'A' | 'AAAA'): ResourceSchema => ({
  rrType,
  attrs: {
    addresses: { kind: 'set', required: true },
    id: { kind: 'string', computed: true },
    name: { kind: 'string', optional: true, forceNew: true },
    ttl: { kind: 'number', optional: true, forceNew: true, default: 3600 },
    zone: { kind: 'string', required: true, forceNew: true },
  },
});
export const SCHEMAS: Record<string, ResourceSchema> = {
  dns_a_record_set: RECORD_SET('A'),
  dns_aaaa_record_set: RECORD_SET('AAAA'),
  dns_cname_record: {
    rrType: 'CNAME',
    attrs: {
      cname: { kind: 'string', required: true },
      id: { kind: 'string', computed: true },
      name: { kind: 'string', required: true, forceNew: true },
      ttl: { kind: 'number', optional: true, computed: true, forceNew: true, default: 3600 },
      zone: { kind: 'string', required: true, forceNew: true },
    },
  },
};
// The other resource types of the provider (named in "did you mean").
const OTHER_TYPES = ['dns_mx_record_set', 'dns_ns_record_set', 'dns_ptr_record', 'dns_srv_record_set', 'dns_txt_record_set'];
const PROVIDER_ARGS = ['update'];
const UPDATE_ARGS = ['server', 'port', 'transport', 'timeout', 'retries', 'key_name', 'key_algorithm', 'key_secret', 'gssapi'];

// ——— The configuration ———

export interface Variable {
  name: string;
  block: Block;
  default?: Value;
  hasDefault: boolean;
  type: string;
  sensitive: boolean;
  description?: string;
}
export interface ResourceConfig {
  type: string;
  name: string;
  block: Block;
  file: string;
}
export interface Config {
  dir: string;
  sources: Record<string, string>;
  bodies: Record<string, Body>;
  variables: Record<string, Variable>;
  locals: Record<string, { expr: Expr; file: string }>;
  outputs: Record<string, { expr: Expr; sensitive: boolean; block: Block; file: string }>;
  resources: Record<string, ResourceConfig>;
  imports: { to: string; id: Expr; block: Block; file: string }[];
  provider: { block: Block; file: string } | null;
  constraint: string | null;
  required: boolean;
}

const blockLabel = (b: Block) => [b.type, ...b.labels.map((l) => `"${l}"`)].join(' ');

/** The *.tf files of a directory, read and decoded; syntax and structure errors. */
export function loadConfig(game: Shell, dir: string): { config: Config; diagnostics: Diagnostic[] } {
  const config: Config = { dir, sources: {}, bodies: {}, variables: {}, locals: {}, outputs: {}, resources: {}, imports: [], provider: null, constraint: null, required: false };
  const diagnostics: Diagnostic[] = [];
  const node = game.find(dir);
  if (node?.type !== 'directory') return { config, diagnostics };
  const names = Object.keys(node.children)
    .filter((n) => n.endsWith('.tf') && node.children[n].type === 'file')
    .sort();
  for (const name of names) {
    const src = game.read(`${dir}/${name}`) ?? '';
    config.sources[name] = src;
    const { body, diagnostics: syntax } = parse(src, name);
    diagnostics.push(...syntax);
    if (body) config.bodies[name] = body;
  }
  if (diagnostics.length) return { config, diagnostics };
  for (const [file, body] of Object.entries(config.bodies)) {
    for (const a of body.attributes)
      diagnostics.push({ severity: 'error', summary: 'Unsupported argument', detail: `An argument named "${a.name}" is not expected here.`, subject: a.nameRange });
    for (const b of body.blocks) {
      const labels = (n: number, names: string[]) => {
        if (b.labels.length === n) return true;
        if (b.labels.length < n)
          diagnostics.push({ severity: 'error', summary: `Missing ${names[b.labels.length]} for ${b.type}`, detail: `All ${b.type} blocks must have ${n} labels (${names.join(', ')}).`, subject: b.openBrace });
        else diagnostics.push({ severity: 'error', summary: `Extraneous label for ${b.type}`, detail: `Only ${n} labels (${names.join(', ')}) are expected for ${b.type} blocks.`, subject: b.typeRange });
        return false;
      };
      switch (b.type) {
        case 'terraform': {
          if (!labels(0, [])) break;
          for (const rp of b.body.blocks.filter((x) => x.type === 'required_providers'))
            for (const a of rp.body.attributes) {
              const v = literal(a.expr);
              if (a.name === 'dns' && v && typeof v === 'object' && !Array.isArray(v)) {
                config.required = true;
                config.constraint = typeof v.version === 'string' ? v.version : null;
              }
            }
          break;
        }
        case 'provider':
          if (labels(1, ['name'])) config.provider = { block: b, file };
          break;
        case 'variable': {
          if (!labels(1, ['name'])) break;
          const get = (n: string) => b.body.attributes.find((a) => a.name === n);
          const def = get('default');
          const type = get('type');
          config.variables[b.labels[0]] = {
            name: b.labels[0],
            block: b,
            hasDefault: !!def,
            default: def ? literal(def.expr) : undefined,
            type: type ? exprText(config.sources[file], type.expr) : 'any',
            sensitive: literal(get('sensitive')?.expr ?? { kind: 'literal', value: false, range: b.typeRange }) === true,
            description: (get('description') && (literal(get('description')!.expr) as string)) || undefined,
          };
          break;
        }
        case 'locals':
          for (const a of b.body.attributes) config.locals[a.name] = { expr: a.expr, file };
          break;
        case 'output': {
          if (!labels(1, ['name'])) break;
          const value = b.body.attributes.find((a) => a.name === 'value');
          if (!value) {
            diagnostics.push({ severity: 'error', summary: 'Missing required argument', detail: 'The argument "value" is required, but no definition was found.', subject: { ...b.openBrace, end: b.openBrace.start } });
            break;
          }
          config.outputs[b.labels[0]] = { expr: value.expr, sensitive: literal(b.body.attributes.find((a) => a.name === 'sensitive')?.expr ?? value.expr) === true, block: b, file };
          break;
        }
        case 'resource': {
          if (!labels(2, ['type', 'name'])) break;
          const key = `${b.labels[0]}.${b.labels[1]}`;
          if (config.resources[key]) {
            diagnostics.push({ severity: 'error', summary: 'Duplicate resource configuration', detail: `A ${b.labels[0]} resource named "${b.labels[1]}" was already declared at ${config.resources[key].file}:${config.resources[key].block.typeRange.start.line},${config.resources[key].block.typeRange.start.col}-${config.resources[key].block.openBrace.start.col - 1}. Resource names must be unique per type in each module.`, subject: b.headerRange });
            break;
          }
          config.resources[key] = { type: b.labels[0], name: b.labels[1], block: b, file };
          break;
        }
        case 'import': {
          if (!labels(0, [])) break;
          const to = b.body.attributes.find((a) => a.name === 'to');
          const id = b.body.attributes.find((a) => a.name === 'id');
          if (to && id && to.expr.kind === 'ref') config.imports.push({ to: to.expr.parts.join('.'), id: id.expr, block: b, file });
          else diagnostics.push({ severity: 'error', summary: 'Missing required argument', detail: `The argument "${to ? 'id' : 'to'}" is required, but no definition was found.`, subject: { ...b.openBrace, end: b.openBrace.start } });
          break;
        }
        default: {
          const known = ['terraform', 'provider', 'variable', 'locals', 'output', 'resource', 'data', 'module', 'import', 'moved', 'removed', 'check'];
          if (known.includes(b.type)) break;
          const s = suggest(b.type, known);
          diagnostics.push({ severity: 'error', summary: 'Unsupported block type', detail: `Blocks of type "${b.type}" are not expected here.${s ? ` Did you mean "${s}"?` : ''}`, subject: b.typeRange });
        }
      }
    }
  }
  return { config, diagnostics };
}

/** An expression as written (a variable's type). */
const exprText = (src: string, e: Expr) => src.slice(e.range.start.offset, e.range.end.offset);

/** The block a range is inside (the snippet's context), if any. */
function contextOf(config: Config, r: Range): string | undefined {
  const body = config.bodies[r.file];
  let found: string | undefined;
  const walk = (b: Body) => {
    for (const blk of b.blocks)
      if (r.start.offset >= blk.openBrace.start.offset && r.start.offset <= blk.body.range.end.offset) {
        found = blockLabel(blk);
        walk(blk.body);
      }
  };
  if (body) walk(body);
  return found;
}

function refsIn(e: Expr): { parts: string[]; range: Range }[] {
  switch (e.kind) {
    case 'ref':
      return [{ parts: e.parts, range: e.range }];
    case 'template':
      return e.parts.flatMap((p) => (typeof p === 'string' ? [] : refsIn(p)));
    case 'tuple':
      return e.items.flatMap(refsIn);
    case 'object':
      return e.items.flatMap((i) => refsIn(i.value));
    case 'call':
      return e.args.flatMap(refsIn);
    default:
      return [];
  }
}

/** What `tofu validate` checks besides the syntax: the provider's schema and the references. */
export function validate(config: Config): Diagnostic[] {
  const out: Diagnostic[] = [];
  const ctx = (r: Range) => contextOf(config, r);
  const checkRefs = (e: Expr) => {
    for (const r of refsIn(e)) {
      const [head, name] = r.parts;
      if (head === 'var') {
        if (!config.variables[name]) {
          const s = suggest(name, Object.keys(config.variables));
          out.push({ severity: 'error', summary: 'Reference to undeclared input variable', detail: `An input variable with the name "${name}" has not been declared.${s ? ` Did you mean "${s}"?` : ` This variable can be declared with a variable "${name}" {} block.`}`, subject: r.range, context: ctx(r.range) });
        }
      } else if (head === 'local') {
        if (!config.locals[name]) {
          const s = suggest(name, Object.keys(config.locals));
          out.push({ severity: 'error', summary: 'Reference to undeclared local value', detail: `A local value with the name "${name}" has not been declared.${s ? ` Did you mean "${s}"?` : ''}`, subject: r.range, context: ctx(r.range) });
        }
      } else if (SCHEMAS[head] || OTHER_TYPES.includes(head) || head.startsWith('dns_')) {
        if (!config.resources[`${head}.${name}`])
          out.push({ severity: 'error', summary: 'Reference to undeclared resource', detail: `A resource "${head}" "${name}" has not been declared in the root module.`, subject: r.range, context: ctx(r.range) });
      } else if (!['path', 'terraform', 'tofu', 'count', 'each', 'self'].includes(head)) {
        out.push({ severity: 'error', summary: 'Reference to undeclared resource', detail: `A managed resource "${head}" "${name ?? ''}" has not been declared in the root module.`, subject: r.range, context: ctx(r.range) });
      }
    }
    for (const call of calls(e))
      out.push({ severity: 'error', summary: 'Call to unknown function', detail: `There is no function named "${call.name}".`, subject: call.range, context: ctx(call.range) });
  };
  if (config.provider) {
    const p = config.provider.block;
    for (const a of p.body.attributes) out.push({ severity: 'error', summary: 'Unsupported argument', detail: `An argument named "${a.name}" is not expected here.`, subject: a.nameRange, context: blockLabel(p) });
    for (const b of p.body.blocks) {
      if (!PROVIDER_ARGS.includes(b.type)) {
        out.push({ severity: 'error', summary: 'Unsupported block type', detail: `Blocks of type "${b.type}" are not expected here.`, subject: b.typeRange, context: blockLabel(p) });
        continue;
      }
      for (const a of b.body.attributes) {
        if (!UPDATE_ARGS.includes(a.name)) {
          const s = suggest(a.name, UPDATE_ARGS);
          out.push({ severity: 'error', summary: 'Unsupported argument', detail: `An argument named "${a.name}" is not expected here.${s ? ` Did you mean "${s}"?` : ''}`, subject: a.nameRange, context: 'update' });
        }
        checkRefs(a.expr);
      }
    }
  }
  for (const r of Object.values(config.resources)) {
    const schema = SCHEMAS[r.type];
    if (!schema) {
      const s = suggest(r.type, [...Object.keys(SCHEMAS), ...OTHER_TYPES]);
      if (!OTHER_TYPES.includes(r.type))
        out.push({ severity: 'error', summary: 'Invalid resource type', detail: `The provider hashicorp/dns does not support resource type "${r.type}".${s ? ` Did you mean "${s}"?` : ''}`, subject: r.block.typeRange.file ? { ...r.block.headerRange, start: { ...r.block.headerRange.start, col: r.block.headerRange.start.col + 9, offset: r.block.headerRange.start.offset + 9 } } : undefined });
      continue;
    }
    const given = r.block.body.attributes;
    const meta = ['lifecycle', 'depends_on', 'provider'];
    for (const [name, a] of Object.entries(schema.attrs).sort(([x], [y]) => x.localeCompare(y)))
      if (a.required && !given.some((g) => g.name === name))
        out.push({ severity: 'error', summary: 'Missing required argument', detail: `The argument "${name}" is required, but no definition was found.`, subject: { ...r.block.openBrace, end: r.block.openBrace.start }, context: blockLabel(r.block) });
    for (const g of given) {
      const a = schema.attrs[g.name];
      if (!a || a.computed && !a.optional && !a.required) {
        if (meta.includes(g.name)) continue;
        const s = suggest(g.name, Object.keys(schema.attrs).filter((k) => !(schema.attrs[k].computed && !schema.attrs[k].optional)));
        out.push({ severity: 'error', summary: 'Unsupported argument', detail: a ? `Can't configure a value for "${g.name}": its value will be decided automatically based on the result of applying this configuration.` : `An argument named "${g.name}" is not expected here.${s ? ` Did you mean "${s}"?` : ''}`, subject: g.nameRange, context: blockLabel(r.block) });
        continue;
      }
      checkRefs(g.expr);
    }
    for (const b of r.block.body.blocks)
      if (b.type !== 'lifecycle') out.push({ severity: 'error', summary: 'Unsupported block type', detail: `Blocks of type "${b.type}" are not expected here.`, subject: b.typeRange, context: blockLabel(r.block) });
  }
  for (const l of Object.values(config.locals)) checkRefs(l.expr);
  for (const o of Object.values(config.outputs)) checkRefs(o.expr);
  for (const i of config.imports) {
    if (!config.resources[i.to])
      out.push({ severity: 'error', summary: 'Configuration for import target does not exist', detail: `The configuration for the given import target ${i.to} does not exist. All target instances must have an associated configuration to be imported.`, subject: i.block.body.attributes.find((a) => a.name === 'to')?.expr.range });
    checkRefs(i.id);
  }
  return out;
}

function calls(e: Expr): { name: string; range: Range }[] {
  switch (e.kind) {
    case 'call':
      return [{ name: e.name, range: e.range }, ...e.args.flatMap(calls)];
    case 'template':
      return e.parts.flatMap((p) => (typeof p === 'string' ? [] : calls(p)));
    case 'tuple':
      return e.items.flatMap(calls);
    case 'object':
      return e.items.flatMap((i) => calls(i.value));
    default:
      return [];
  }
}

// ——— Values ———

export const UNKNOWN = { unknown: true } as const;
type Val = Value | typeof UNKNOWN;
const isUnknown = (v: unknown): v is typeof UNKNOWN => typeof v === 'object' && v !== null && (v as { unknown?: boolean }).unknown === true;

interface Scope {
  vars: Record<string, Value>;
  config: Config;
  // The resources' values known so far (state or plan).
  resources: Record<string, Record<string, Val>>;
}

function evaluate(e: Expr, s: Scope, seen = new Set<string>()): Val {
  switch (e.kind) {
    case 'literal':
      return e.value;
    case 'template': {
      let out = '';
      for (const p of e.parts) {
        if (typeof p === 'string') out += p;
        else {
          const v = evaluate(p, s, seen);
          if (isUnknown(v)) return UNKNOWN;
          out += typeof v === 'string' ? v : JSON.stringify(v);
        }
      }
      return out;
    }
    case 'tuple': {
      const items = e.items.map((i) => evaluate(i, s, seen));
      return items.some(isUnknown) ? UNKNOWN : (items as Value[]);
    }
    case 'object': {
      const out: Record<string, Value> = {};
      for (const it of e.items) {
        const v = evaluate(it.value, s, seen);
        if (isUnknown(v)) return UNKNOWN;
        out[it.key] = v;
      }
      return out;
    }
    case 'ref': {
      const [head, name, attr] = e.parts;
      if (head === 'var') return s.vars[name] ?? null;
      if (head === 'local') {
        const l = s.config.locals[name];
        if (!l || seen.has(name)) return null;
        return evaluate(l.expr, s, new Set([...seen, name]));
      }
      const r = s.resources[`${head}.${name}`];
      if (!r) return UNKNOWN;
      return attr ? (r[attr] ?? null) : (r as Value);
    }
    default:
      return null;
  }
}

// ——— Variables ———

interface VarSource {
  name: string;
  value: string | Value;
  raw: boolean;
  from: 'file' | 'cli' | 'env';
  file?: string;
}

/** The variables' values: defaults, TF_VAR_*, terraform.tfvars, *.auto.tfvars, then -var-file and -var in order. */
function variableValues(game: Shell, config: Config, cli: { kind: 'var' | 'file'; text: string }[]): { vars: Record<string, Value>; diagnostics: Diagnostic[]; fromCli: string[] } {
  const diagnostics: Diagnostic[] = [];
  const sources: VarSource[] = [];
  const env = { ...game.environment };
  for (const name of game.exported) if (game.vars[name] !== undefined) env[name] = game.vars[name];
  for (const [k, v] of Object.entries(env)) if (k.startsWith('TF_VAR_')) sources.push({ name: k.slice(7), value: v, raw: true, from: 'env' });
  const readFile = (path: string, shown: string) => {
    const text = game.read(path);
    if (text === null) {
      diagnostics.push(sourceless('error', 'Failed to read variables file', `Given variables file ${shown} does not exist.`));
      return;
    }
    const { body, diagnostics: d } = parse(text, shown);
    diagnostics.push(...d);
    for (const a of body?.attributes ?? []) {
      const v = literal(a.expr);
      if (v !== undefined) sources.push({ name: a.name, value: v, raw: false, from: 'file', file: shown });
    }
  };
  const dir = game.find(config.dir);
  const files = dir?.type === 'directory' ? Object.keys(dir.children) : [];
  if (files.includes('terraform.tfvars')) readFile(`${config.dir}/terraform.tfvars`, 'terraform.tfvars');
  for (const n of files.filter((x) => x.endsWith('.auto.tfvars')).sort()) readFile(`${config.dir}/${n}`, n);
  const fromCli: string[] = [];
  for (const c of cli) {
    if (c.kind === 'file') readFile(game.resolve(c.text), c.text);
    else {
      const eq = c.text.indexOf('=');
      if (eq <= 0) {
        diagnostics.push(sourceless('error', 'Invalid -var option', `The given -var option ${JSON.stringify(c.text)} is not correctly specified. It must be a variable name and value separated an equals sign, like -var="key=value".`));
        continue;
      }
      sources.push({ name: c.text.slice(0, eq), value: c.text.slice(eq + 1), raw: true, from: 'cli' });
      fromCli.push(c.text.slice(0, eq));
    }
  }
  const vars: Record<string, Value> = {};
  for (const v of Object.values(config.variables)) if (v.hasDefault) vars[v.name] = v.default ?? null;
  let undeclaredInFiles = 0;
  for (const s of sources) {
    const decl = config.variables[s.name];
    if (!decl) {
      if (s.from === 'file') {
        if (++undeclaredInFiles <= 2)
          diagnostics.push(
            sourceless(
              'warning',
              'Value for undeclared variable',
              `The root module does not declare a variable named "${s.name}" but a value was found in file "${s.file}". If you meant to use this value, add a "variable" block to the configuration.\n\nTo silence these warnings, use TF_VAR_... environment variables to provide certain "global" settings to all configurations in your organization. To reduce the verbosity of these warnings, use the -compact-warnings option.`,
            ),
          );
      } else if (s.from === 'cli')
        diagnostics.push(sourceless('error', 'Value for undeclared variable', `A variable named "${s.name}" was assigned on the command line, but the root module does not declare a variable of that name. To use this value, add a "variable" block to the configuration.`));
      continue;
    }
    let value: Value = s.value as Value;
    if (s.raw && typeof s.value === 'string' && decl.type !== 'string' && decl.type !== 'any') {
      const p = parse(`v = ${s.value}`, '<value for var.' + s.name + '>');
      value = (p.body && literal(p.body.attributes[0].expr)) ?? s.value;
    }
    if (decl.type === 'number' && typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value)) value = Number(value);
    if (decl.type === 'string' && typeof value === 'number') value = String(value);
    vars[s.name] = value;
  }
  for (const v of Object.values(config.variables))
    if (!(v.name in vars))
      diagnostics.push({
        severity: 'error',
        summary: 'No value for required variable',
        detail: `The root module input variable "${v.name}" is not set, and has no default value. Use a -var or -var-file command line argument to provide a value for this variable.`,
        subject: v.block.headerRange,
      });
  return { vars, diagnostics, fromCli };
}

// ——— The state (local backend) ———

export interface Instance {
  type: string;
  name: string;
  attributes: Record<string, Value>;
}
export interface StateFile {
  serial: number;
  lineage: string;
  outputs: Record<string, { value: Value; type: string; sensitive?: boolean }>;
  resources: Instance[];
}

/** A UUID made from a text (lineages, lock IDs): the game stays deterministic. */
export function uuidOf(text: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  const hex: string[] = [];
  for (let round = 0; round < 4; round++) {
    for (let i = 0; i < text.length; i++) {
      h1 = Math.imul(h1 ^ text.charCodeAt(i), 16777619) >>> 0;
      h2 = Math.imul(h2 + text.charCodeAt(i) + round, 2246822519) >>> 0;
    }
    hex.push(((h1 ^ h2) >>> 0).toString(16).padStart(8, '0'));
  }
  const s = hex.join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-4${s.slice(13, 16)}-a${s.slice(17, 20)}-${s.slice(20, 32)}`;
}

const ATTR_ORDER = (a: string, b: string) => a.localeCompare(b);

/** The JSON tofu writes (format version 4, two-space indentation, like json.MarshalIndent). */
export function stateText(s: StateFile): string {
  const sortObj = (o: Record<string, Value>) => Object.fromEntries(Object.keys(o).sort(ATTR_ORDER).map((k) => [k, o[k]]));
  return JSON.stringify(
    {
      version: 4,
      terraform_version: VERSION,
      serial: s.serial,
      lineage: s.lineage,
      outputs: Object.fromEntries(Object.entries(s.outputs).sort(([a], [b]) => ATTR_ORDER(a, b)).map(([k, v]) => [k, v.sensitive ? { value: v.value, type: v.type, sensitive: true } : { value: v.value, type: v.type }])),
      resources: [...s.resources]
        .sort((a, b) => `${a.type}.${a.name}`.localeCompare(`${b.type}.${b.name}`))
        .map((r) => ({
          mode: 'managed',
          type: r.type,
          name: r.name,
          provider: `provider["${DNS_FQN}"]`,
          instances: [{ schema_version: 0, attributes: sortObj(r.attributes), sensitive_attributes: [], private: 'bnVsbA==' }],
        })),
      check_results: null,
    },
    null,
    2,
  );
}

/** Reads a state file; null if there is none, an error if it can't be decoded. */
export function readState(text: string | null): { state: StateFile | null; error?: string } {
  if (text === null || text.trim() === '') return { state: null };
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(text);
  } catch (e) {
    const at = /position (\d+)/.exec(String((e as Error).message))?.[1] ?? String(text.length);
    return { state: null, error: `Unsupported state file format: The state file could not be parsed as JSON: syntax error at byte offset ${at}.` };
  }
  if (json.version !== 4) return { state: null, error: `Unsupported state file format: The state file uses format version ${String(json.version)}, which is not supported by OpenTofu ${VERSION}. This state file may have been created by a newer version of OpenTofu.` };
  const resources: Instance[] = [];
  for (const r of (json.resources as { type: string; name: string; mode?: string; instances?: { attributes?: Record<string, Value> }[] }[]) ?? [])
    for (const inst of r.instances ?? []) resources.push({ type: r.type, name: r.name, attributes: { ...(inst.attributes ?? {}) } });
  return {
    state: {
      serial: Number(json.serial ?? 0),
      lineage: String(json.lineage ?? ''),
      outputs: (json.outputs as StateFile['outputs']) ?? {},
      resources,
    },
  };
}

// ——— The DNS server behind the provider ———

interface ServerRef {
  d: DnsState;
}
const fqdnOf = (attrs: Record<string, Value>) => {
  const zone = String(attrs.zone ?? '');
  const name = attrs.name;
  return (name ? `${name}.${zone}` : zone).toLowerCase();
};

/** The provider's update server: the machine's own named (by name or address). */
function server(game: Shell, providerConfig: Record<string, Value>): { ok: ServerRef } | { error: string } {
  const d = dns(game.principal);
  const update = providerConfig.update as Record<string, Value> | undefined;
  const host = String(update?.server ?? '');
  if (!update || !host) return { error: 'update server is not set' };
  if (!d || !d.servers.primary.includes(host.toLowerCase())) return { error: `Error querying DNS record: read udp 192.0.2.176:41529->${/^\d/.test(host) ? host : '198.51.100.53'}:53: i/o timeout` };
  if (systemd(game.principal)?.services.named?.state !== 'active') return { error: `Error querying DNS record: read udp 127.0.0.1:41529->${/^\d/.test(host) ? host : '127.0.0.1'}:53: read: connection refused` };
  return { ok: { d } };
}

const zoneOf = (d: DnsState, fqdn: string) =>
  Object.keys(d.primary)
    .filter((z) => fqdn === `${z}.` || fqdn.endsWith(`.${z}.`))
    .sort((a, b) => b.length - a.length)[0];

/** The provider's Read: the record set at that name, or null (gone). */
export function readRecord(d: DnsState, type: string, attrs: Record<string, Value>): Record<string, Value> | null | { error: string } {
  const schema = SCHEMAS[type];
  const fqdn = fqdnOf(attrs);
  const zone = zoneOf(d, fqdn);
  if (!zone) return { error: 'Error querying DNS record: 5 (REFUSED)' };
  const rrs = d.primary[zone].rrs.filter((r) => r.name === fqdn && r.type === schema.rrType);
  if (!rrs.length) return null;
  const ttl = Math.min(...rrs.map((r) => r.ttl));
  const base = { id: String(attrs.id ?? fqdn), name: attrs.name ?? null, ttl, zone: attrs.zone ?? null };
  if (schema.rrType === 'CNAME') return { ...base, cname: rrs[0].data };
  return { ...base, addresses: [...new Set(rrs.map((r) => r.data))].sort() };
}

/** A dynamic update reaches named: the zone's records change, its serial grows, the journal tells. */
export function dynamicUpdate(game: Shell, zone: string, remove: (r: Rr) => boolean, add: Rr[], client: { address: string; key: string; at?: number }) {
  const d = dns(game.principal)!;
  const z = d.primary[zone];
  const sd = systemd(game.principal);
  const log = (m: string) => sd && writeLog(sd, 'named.service', 'named', 733, m, 6, false);
  if (sd && client.at === undefined) sd.clock += 1000;
  const prefix = `client @0x7f3a2c01b2e8 ${client.address}#${41000 + (Math.floor((sd?.clock ?? 0) / 1000) % 9000)}/key ${client.key}`;
  log(`${prefix}: signer "${client.key}" approved`);
  const gone = z.rrs.filter((r) => r.type !== 'SOA' && remove(r));
  const groups = new Set(gone.map((r) => `${r.name} ${r.type}`));
  for (const g of groups) {
    const [name, type] = g.split(' ');
    const all = z.rrs.filter((r) => r.name === name && r.type === type);
    if (all.every((r) => gone.includes(r))) log(`${prefix}: updating zone '${zone}/IN': deleting rrset at '${name.slice(0, -1)}' ${type}`);
    else for (const r of gone.filter((x) => x.name === name && x.type === type)) log(`${prefix}: updating zone '${zone}/IN': deleting an RR at '${name.slice(0, -1)}' ${type} ${r.data}`);
  }
  z.rrs = z.rrs.filter((r) => !gone.includes(r));
  for (const r of add) {
    if (z.rrs.some((x) => x.name === r.name && x.type === r.type && x.data === r.data)) continue;
    log(`${prefix}: updating zone '${zone}/IN': adding an RR at '${r.name.slice(0, -1)}' ${r.type} ${r.data}`);
    z.rrs.push(r);
  }
  // serial-update-method increment: the SOA's serial goes up by one.
  z.serial += 1;
  const soa = z.rrs.find((r) => r.type === 'SOA');
  if (soa) {
    const parts = soa.data.split(' ');
    parts[2] = String(z.serial);
    soa.data = parts.join(' ');
  }
  const copy = d.secondary[zone];
  if (copy) {
    log(`zone ${zone}/IN: sending notifies (serial ${z.serial})`);
    d.secondary[zone] = { serial: z.serial, rrs: z.rrs.map((r) => ({ ...r })) };
  }
  // named keeps the updates in the zone's journal (db.ZONE.jnl, next to the zone file).
  const file = declaredZones(game.principal)[zone];
  if (file) {
    const jnl = game.principal.find(`${file}.jnl`);
    if (jnl?.type === 'file') jnl.size = (jnl.size ?? 0) + 512;
    else game.principal.place('named', `${file}.jnl`, f('', { charset: 'binary', size: 1024, owner: 'bind', group: 'bind', mode: 'rw-r--r--' }));
  }
}

/** The provider's Create, Update and Delete, as dynamic updates. */
function writeRecord(game: Shell, type: string, before: Record<string, Value> | null, after: Record<string, Value> | null): string | null {
  const d = dns(game.principal)!;
  const schema = SCHEMAS[type];
  const target = after ?? before!;
  const fqdn = fqdnOf(target);
  const zone = zoneOf(d, fqdn);
  if (!zone) return after ? 'Error updating DNS record: 5 (REFUSED)' : 'Error deleting DNS record: 5 (REFUSED)';
  const client = { address: '127.0.0.1', key: 'tofu-key' };
  if (!after) {
    dynamicUpdate(game, zone, (r) => r.name === fqdn && r.type === schema.rrType, [], client);
    return null;
  }
  const ttl = Number(after.ttl ?? 3600);
  if (schema.rrType === 'CNAME') {
    if (before && before.cname === after.cname) return null;
    dynamicUpdate(game, zone, (r) => r.name === fqdn && r.type === 'CNAME', [{ name: fqdn, ttl, type: 'CNAME', data: String(after.cname).toLowerCase() }], client);
    return null;
  }
  // The set's difference: old addresses removed, new ones inserted (resourceDnsARecordSetUpdate).
  const old = new Set((before?.addresses as string[] | undefined) ?? []);
  const now = new Set((after.addresses as string[]) ?? []);
  const remove = [...old].filter((x) => !now.has(x));
  const add = [...now].filter((x) => !old.has(x));
  if (!remove.length && !add.length) return null;
  dynamicUpdate(game, zone, (r) => r.name === fqdn && r.type === schema.rrType && remove.includes(r.data), add.map((a) => ({ name: fqdn, ttl, type: schema.rrType, data: a })), client);
  return null;
}

// ——— Plans ———

type Action = 'create' | 'update' | 'delete' | 'replace' | 'noop' | 'import';
interface Change {
  address: string;
  type: string;
  name: string;
  action: Action;
  before: Record<string, Value> | null;
  after: Record<string, Value | typeof UNKNOWN> | null;
  forcing: string[];
  // Why a delete: the resource left the configuration.
  notInConfig?: boolean;
  importId?: string;
}
interface Drift {
  address: string;
  type: string;
  name: string;
  before: Record<string, Value>;
  after: Record<string, Value> | null;
}
interface Plan {
  changes: Change[];
  drift: Drift[];
  prior: Instance[];
  outputs: { name: string; before: Value | undefined; after: Val; sensitive: boolean }[];
  mode: 'normal' | 'destroy' | 'refresh-only';
  errors: Diagnostic[];
  refreshed: string[];
}

const sameValue = (a: Value | undefined, b: Value | undefined): boolean => JSON.stringify(normalise(a)) === JSON.stringify(normalise(b));
function normalise(v: Value | undefined): Value | undefined {
  if (Array.isArray(v)) return [...v].map((x) => normalise(x) as Value).sort((x, y) => String(x).localeCompare(String(y)));
  return v;
}

/** The planned values of a resource from its configuration (defaults, the computed id). */
function plannedValues(r: ResourceConfig, scope: Scope, prior: Record<string, Value> | null): Record<string, Val> {
  const schema = SCHEMAS[r.type];
  const out: Record<string, Val> = {};
  for (const [name, a] of Object.entries(schema.attrs)) {
    if (name === 'id') continue;
    const given = r.block.body.attributes.find((g) => g.name === name);
    let v: Val = given ? evaluate(given.expr, scope) : (a.default ?? null);
    if (a.kind === 'set' && Array.isArray(v)) v = [...new Set(v.map(String))].sort();
    if (a.kind === 'number' && typeof v === 'string' && /^\d+$/.test(v)) v = Number(v);
    if (name === 'cname' && typeof v === 'string') v = v.toLowerCase();
    out[name] = v;
  }
  out.id = prior?.id ?? UNKNOWN;
  return out;
}

function buildPlan(game: Shell, config: Config, state: StateFile | null, scope: Scope, mode: Plan['mode'], providerConfig: Record<string, Value>, out: Out): Plan {
  const plan: Plan = { changes: [], drift: [], prior: [], outputs: [], mode, errors: [], refreshed: [] };
  const srv = server(game, providerConfig);
  const instances = state?.resources ?? [];
  // Refresh: each object of the state read again from the server.
  for (const inst of instances) {
    const address = `${inst.type}.${inst.name}`;
    out.print(`${out.c('1', `${address}: Refreshing state... [id=${inst.attributes.id}]`)}`);
    plan.refreshed.push(address);
    if ('error' in srv) {
      plan.errors.push({ severity: 'error', summary: srv.error, address, subject: config.resources[address]?.block.headerRange, context: undefined });
      continue;
    }
    const now = SCHEMAS[inst.type] ? readRecord(srv.ok.d, inst.type, inst.attributes) : inst.attributes;
    if (now && 'error' in now) {
      plan.errors.push({ severity: 'error', summary: String(now.error), address });
      continue;
    }
    const after = now ? { ...inst.attributes, ...(now as Record<string, Value>) } : null;
    if (!after || Object.keys(after).some((k) => !sameValue(after[k], inst.attributes[k]))) plan.drift.push({ address, type: inst.type, name: inst.name, before: inst.attributes, after });
    if (after) plan.prior.push({ type: inst.type, name: inst.name, attributes: after });
  }
  if (plan.errors.length) return plan;
  for (const p of plan.prior) scope.resources[`${p.type}.${p.name}`] = p.attributes;
  if (mode === 'refresh-only') return plan;
  const priorOf = (a: string) => plan.prior.find((p) => `${p.type}.${p.name}` === a) ?? null;
  // Resources of the configuration: created, imported, updated, replaced or left alone.
  const addresses = Object.keys(config.resources).sort();
  for (const address of addresses) {
    const r = config.resources[address];
    const prior = priorOf(address);
    if (mode === 'destroy') continue;
    const imp = !prior ? config.imports.find((i) => i.to === address) : undefined;
    if (imp && !('error' in srv)) {
      const id = evaluate(imp.id, scope);
      const found = typeof id === 'string' ? importRead(srv.ok.d, r.type, id) : { error: 'Invalid import id argument' };
      if ('error' in found) {
        plan.errors.push({ severity: 'error', summary: found.error === 'missing' ? 'Cannot import non-existent remote object' : String(found.error), detail: found.error === 'missing' ? missingImport(address) : undefined });
        continue;
      }
      const after = plannedValues(r, scope, found);
      const forcing = Object.keys(SCHEMAS[r.type].attrs).filter((k) => SCHEMAS[r.type].attrs[k].forceNew && !isUnknown(after[k]) && !sameValue(after[k] as Value, found[k]));
      const changed = Object.keys(after).some((k) => !isUnknown(after[k]) && !sameValue(after[k] as Value, found[k]));
      plan.changes.push({ address, type: r.type, name: r.name, action: forcing.length ? 'replace' : changed ? 'update' : 'import', before: found, after: forcing.length ? { ...after, id: UNKNOWN } : after, forcing, importId: String(id) });
      scope.resources[address] = found;
      continue;
    }
    const after = plannedValues(r, scope, prior?.attributes ?? null);
    if (!prior) {
      plan.changes.push({ address, type: r.type, name: r.name, action: 'create', before: null, after, forcing: [] });
      scope.resources[address] = after as Record<string, Value>;
      continue;
    }
    const before = prior.attributes;
    const differs = Object.keys(after).filter((k) => !isUnknown(after[k]) && !sameValue(after[k] as Value, before[k]));
    const forcing = differs.filter((k) => SCHEMAS[r.type].attrs[k]?.forceNew);
    if (forcing.length) plan.changes.push({ address, type: r.type, name: r.name, action: 'replace', before, after: { ...after, id: UNKNOWN }, forcing });
    else if (differs.length) plan.changes.push({ address, type: r.type, name: r.name, action: 'update', before, after, forcing: [] });
    else plan.changes.push({ address, type: r.type, name: r.name, action: 'noop', before, after, forcing: [] });
  }
  // In the state but no longer in the configuration (or tofu destroy): destroyed.
  for (const p of plan.prior) {
    const address = `${p.type}.${p.name}`;
    if (mode === 'destroy' || !config.resources[address]) plan.changes.push({ address, type: p.type, name: p.name, action: 'delete', before: p.attributes, after: null, forcing: [], notInConfig: mode !== 'destroy' });
  }
  plan.changes.sort((a, b) => a.address.localeCompare(b.address));
  // The outputs: their new values against the state's.
  if (mode !== 'destroy')
    for (const [name, o] of Object.entries(config.outputs)) {
      const after = evaluate(o.expr, scope);
      const before = state?.outputs[name]?.value;
      if (before === undefined || isUnknown(after) || !sameValue(before, after as Value)) plan.outputs.push({ name, before, after, sensitive: o.sensitive });
    }
  if (state) for (const name of Object.keys(state.outputs)) if (mode === 'destroy' || !config.outputs[name]) plan.outputs.push({ name, before: state.outputs[name].value, after: null, sensitive: !!state.outputs[name].sensitive });
  return plan;
}

const missingImport = (address: string) =>
  `While attempting to import an existing object to "${address}", the provider detected that no object exists with the given id or identity. Only pre-existing objects can be imported; check that the id or identity is correct and that it is associated with the provider's configured region or endpoint, or use "tofu apply" to create a new remote object for this resource.`;

/** resourceDnsImport: the zone found by asking for SOAs up the name, then a Read. */
function importRead(d: DnsState, type: string, id: string): Record<string, Value> | { error: string } {
  if (!id.endsWith('.')) return { error: `Not a fully-qualified DNS name: ${id}` };
  const fqdn = id.toLowerCase();
  const zone = zoneOf(d, fqdn);
  if (!zone) return { error: `Error querying DNS record: 3 (NXDOMAIN)` };
  const zoneFqdn = `${zone}.`;
  const name = fqdn === zoneFqdn ? null : fqdn.slice(0, -(zoneFqdn.length + 1));
  const attrs: Record<string, Value> = { id: fqdn, zone: zoneFqdn, name };
  const found = readRecord(d, type, attrs);
  if (!found) return { error: 'missing' };
  if ('error' in found) return { error: String(found.error) };
  return found as Record<string, Value>;
}

// ——— Rendering a plan (jsonformat's human renderer) ———

const IMPORTANT = ['id', 'name', 'tags'];

function show(v: Value | typeof UNKNOWN | undefined): string {
  if (isUnknown(v)) return '(known after apply)';
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'string') return JSON.stringify(v);
  return String(v);
}

function symbol(action: 'create' | 'delete' | 'update' | 'noop' | 'replace', o: Out): string {
  switch (action) {
    case 'create':
      return `  ${o.c('32', '+')}`;
    case 'delete':
      return `  ${o.c('31', '-')}`;
    case 'update':
      return `  ${o.c('33', '~')}`;
    case 'replace':
      return `${o.c('31', '-')}/${o.c('32', '+')}`;
    default:
      return '   ';
  }
}
const indent = (n: number) => '    '.repeat(n);

/** A resource's attributes, before and after (+, ~, -), with Terraform's alignment and hidden unchanged ones. */
function renderBody(type: string, before: Record<string, Value> | null, after: Record<string, Value | typeof UNKNOWN> | null, forcing: string[], showAll: boolean, o: Out): string[] {
  const keys = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])].filter((k) => (before?.[k] ?? null) !== null || (after?.[k] ?? null) !== null || isUnknown(after?.[k])).sort();
  const width = Math.max(...keys.map((k) => k.length));
  const lines: string[] = [];
  let hidden = 0;
  for (const k of keys) {
    const b = before ? before[k] : undefined;
    const a = after ? after[k] : undefined;
    const kind = SCHEMAS[type]?.attrs[k]?.kind;
    const force = forcing.includes(k) ? ` ${o.c('31', '# forces replacement')}` : '';
    const action: 'create' | 'delete' | 'update' | 'noop' = !before ? 'create' : !after ? 'delete' : isUnknown(a) || !sameValue(a as Value, b) ? 'update' : 'noop';
    if (action === 'noop' && !IMPORTANT.includes(k) && !showAll) {
      hidden++;
      continue;
    }
    const head = `${indent(1)}${symbol(action, o)} ${k.padEnd(width)} = `;
    if (kind === 'set' && !isUnknown(a)) {
      const olds = (Array.isArray(b) ? b : []).map(String);
      const news = (Array.isArray(a) ? a : []).map(String);
      const items: string[] = [];
      let same = 0;
      for (const x of olds) {
        if (news.includes(x)) {
          if (action === 'noop' || showAll || !before || !after) items.push(`${indent(2)}${symbol(!before ? 'create' : !after ? 'delete' : 'noop', o)} ${JSON.stringify(x)},`);
          else same++;
        } else items.push(`${indent(2)}${symbol('delete', o)} ${JSON.stringify(x)},`);
      }
      for (const x of news) if (!olds.includes(x)) items.push(`${indent(2)}${symbol('create', o)} ${JSON.stringify(x)},`);
      if (same) items.push(`${indent(2)}${symbol('noop', o)} ${o.c('90', `# (${same} unchanged element${same > 1 ? 's' : ''} hidden)`)}`);
      lines.push(`${head}[${force}`, ...items, `${indent(1)}    ]${action === 'delete' ? ' -> null' : ''}`);
      continue;
    }
    if (action === 'create') lines.push(`${head}${show(a)}${force}`);
    else if (action === 'delete') lines.push(`${head}${show(b)} -> null${force}`);
    else if (action === 'update') lines.push(`${head}${show(b)} -> ${show(a)}${force}`);
    else lines.push(`${head}${show(b)}`);
  }
  if (hidden) lines.push(`${indent(1)}    ${o.c('90', `# (${hidden} unchanged attribute${hidden > 1 ? 's' : ''} hidden)`)}`);
  return lines;
}

function renderResource(c: { address: string; type: string; name: string }, action: 'create' | 'delete' | 'update' | 'noop' | 'replace', comment: string[], before: Record<string, Value> | null, after: Record<string, Value | typeof UNKNOWN> | null, forcing: string[], showAll: boolean, o: Out): string {
  return [...comment, `${symbol(action, o)} resource "${c.type}" "${c.name}" {`, ...renderBody(c.type, before, after, forcing, showAll, o), '    }'].join('\n');
}

function renderPlan(plan: Plan, o: Out): { text: string; changes: number } {
  const lines: string[] = [];
  const visible = plan.changes.filter((c) => c.action !== 'noop');
  const outputsChanged = plan.outputs.length > 0;
  let haveDrift = false;
  if (plan.drift.length && (visible.length || outputsChanged || plan.mode === 'refresh-only')) {
    haveDrift = true;
    lines.push('', o.c('1', `${o.c('36', 'Note:')} Objects have changed outside of OpenTofu`), '');
    lines.push(wrap('OpenTofu detected the following changes made outside of OpenTofu since the last "tofu apply" which may have affected this plan:', WIDTH - 1));
    for (const dr of plan.drift) {
      lines.push('');
      if (dr.after) lines.push(renderResource(dr, 'update', [o.c('1', `  # ${dr.address}`) + ' has changed'], dr.before, dr.after, [], false, o));
      else lines.push(renderResource(dr, 'delete', [o.c('1', `  # ${dr.address}`) + ' has been deleted'], dr.before, null, [], false, o));
    }
    lines.push('');
    lines.push(
      wrap(
        plan.mode === 'refresh-only'
          ? '\nThis is a refresh-only plan, so OpenTofu will not take any actions to undo these. If you were expecting these changes then you can apply this plan to record the updated values in the OpenTofu state without changing any remote objects.'
          : '\nUnless you have made equivalent changes to your configuration, or ignored the relevant attributes using ignore_changes, the following plan may include actions to undo or respond to these changes.',
        WIDTH - 1,
      ),
    );
  }
  if (!visible.length && !outputsChanged) {
    if (haveDrift) lines.push(o.c('90', `\n${'─'.repeat(WIDTH - 1)}`));
    if (plan.mode === 'refresh-only') {
      if (!haveDrift) lines.push('', `${o.c('1;32', 'No changes.')}${o.c('1', ' Your infrastructure still matches the configuration.')}`, '', wrap('OpenTofu has checked that the real remote objects still match the result of your most recent changes, and found no differences.', WIDTH - 1));
    } else if (plan.mode === 'destroy') lines.push('', `${o.c('1;32', 'No changes.')}${o.c('1', ' No objects need to be destroyed.')}`, '', wrap('Either you have not created any objects yet or the existing objects were already deleted outside of OpenTofu.', WIDTH - 1));
    else lines.push('', `${o.c('1;32', 'No changes.')}${o.c('1', ' Your infrastructure matches the configuration.')}`);
    return { text: lines.join('\n'), changes: 0 };
  }
  if (haveDrift) lines.push(o.c('90', `\n${'─'.repeat(WIDTH - 1)}`));
  const counts = { create: 0, update: 0, delete: 0, replace: 0, import: 0 };
  for (const c of visible) {
    if (c.importId) counts.import++;
    if (c.action !== 'import') counts[c.action as 'create']++;
  }
  if (visible.some((c) => c.action !== 'import')) {
    lines.push(wrap('\nOpenTofu used the selected providers to generate the following execution plan. Resource actions are indicated with the following symbols:', WIDTH - 1));
    if (counts.create) lines.push(`  ${o.c('32', '+')} create`);
    if (counts.update) lines.push(`  ${o.c('33', '~')} update in-place`);
    if (counts.delete) lines.push(`  ${o.c('31', '-')} destroy`);
    if (counts.replace) lines.push(`${o.c('31', '-')}/${o.c('32', '+')} destroy and then create replacement`);
  }
  if (visible.length) {
    lines.push('', 'OpenTofu will perform the following actions:');
    for (const c of visible) {
      lines.push('');
      const head = o.c('1', `  # ${c.address}`);
      const imported = c.importId ? [`  # (imported from "${c.importId}")`] : [];
      if (c.action === 'create') lines.push(renderResource(c, 'create', [`${head} will be created`], null, c.after, [], false, o));
      else if (c.action === 'update') lines.push(renderResource(c, 'update', [`${head} will be updated in-place`, ...imported], c.before, c.after, [], !!c.importId, o));
      else if (c.action === 'replace') lines.push(renderResource(c, 'replace', [`${head} must be ${o.c('1;31', 'replaced')}`, ...imported], c.before, c.after, c.forcing, false, o));
      else if (c.action === 'import') lines.push(renderResource(c, 'noop', [`${head} will be imported`, ...imported], c.before, c.after, [], true, o));
      else lines.push(renderResource(c, 'delete', [`${head} will be ${o.c('1;31', 'destroyed')}`, ...(c.notInConfig ? [`  # (because ${c.address} is not in configuration)`] : [])], c.before, null, [], false, o));
    }
    const add = counts.create + counts.replace;
    const destroy = counts.delete + counts.replace;
    lines.push('', counts.import ? `${o.c('1', 'Plan:')} ${counts.import} to import, ${add} to add, ${counts.update} to change, ${destroy} to destroy.` : `${o.c('1', 'Plan:')} ${add} to add, ${counts.update} to change, ${destroy} to destroy.`);
  }
  if (outputsChanged) {
    lines.push('', 'Changes to Outputs:');
    const width = Math.max(...plan.outputs.map((x) => x.name.length));
    for (const x of plan.outputs) {
      const value = (v: Val | undefined) => (x.sensitive ? '(sensitive value)' : show(v as Value));
      if (x.before === undefined) lines.push(`${symbol('create', o)} ${x.name.padEnd(width)} = ${value(x.after)}`);
      else if (x.after === null && plan.mode === 'destroy') lines.push(`${symbol('delete', o)} ${x.name.padEnd(width)} = ${value(x.before)} -> null`);
      else lines.push(`${symbol('update', o)} ${x.name.padEnd(width)} = ${value(x.before)} -> ${value(x.after)}`);
    }
    if (!visible.length) lines.push(wrap('\nYou can apply this plan to save these new output values to the OpenTofu state, without changing any real infrastructure.', WIDTH - 1));
  }
  return { text: lines.join('\n'), changes: visible.length + (outputsChanged ? 1 : 0) };
}

// ——— The command ———

interface Options {
  chdir: string | null;
  flags: Record<string, string | true>;
  vars: { kind: 'var' | 'file'; text: string }[];
  positional: string[];
}

function readOptions(args: string[]): Options | { error: string } {
  const o: Options = { chdir: null, flags: {}, vars: [], positional: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a.startsWith('-') || a === '-') {
      o.positional.push(a);
      continue;
    }
    const m = /^--?([\w-]+)(?:=(.*))?$/.exec(a);
    if (!m) return { error: a };
    const [, name, value] = m;
    if (name === 'var' || name === 'var-file') {
      const v = value ?? args[++i];
      if (v === undefined) return { error: a };
      o.vars.push({ kind: name === 'var' ? 'var' : 'file', text: v });
    } else if (['out', 'target', 'state', 'lock-timeout', 'parallelism'].includes(name) && value === undefined) {
      const v = args[++i];
      if (v === undefined) return { error: a };
      o.flags[name] = v;
    } else o.flags[name] = value ?? true;
  }
  return o;
}

const flag = (o: Options, name: string, fallback: boolean) => {
  const v = o.flags[name];
  if (v === undefined) return fallback;
  return v === true || v === 'true' || v === '1';
};

const ROOT_HELP = `Usage: tofu [global options] <subcommand> [args]

The available commands for execution are listed below.
The primary workflow commands are given first, followed by
less common or more advanced commands.

Main commands:
  init          Prepare your working directory for other commands
  validate      Check whether the configuration is valid
  plan          Show changes required by the current configuration
  apply         Create or update infrastructure
  destroy       Destroy previously-created infrastructure

All other commands:
  fmt           Reformat your configuration in the standard style
  force-unlock  Release a stuck lock on the current workspace
  import        Associate existing infrastructure with a OpenTofu resource
  output        Show output values from your root module
  show          Show the current state or a saved plan
  state         Advanced state management
  version       Show the current OpenTofu version

Global options (use these before the subcommand, if any):
  -chdir=DIR    Switch to a different working directory before executing the
                given subcommand.
  -help         Show this help output, or the help for a specified subcommand.
  -version      An alias for the "version" subcommand.`;

const STATE_HELP = `Usage: tofu [global options] state <subcommand> [options] [args]

  This command has subcommands for advanced state management.

  These subcommands can be used to slice and dice the OpenTofu state.
  This is sometimes necessary in advanced cases. For your safety, all
  state management commands that modify the state create a timestamped
  backup of the state prior to making modifications.

  The structure and output of the commands is specifically tailored to work
  well with the common Unix utilities such as grep, awk, etc. We recommend
  using those tools to perform more advanced state tasks.

Subcommands:
    list                List resources in the state
    mv                  Move an item in the state
    rm                  Remove instances from the state
    show                Show a resource in the state`;

export function tofu(c: Context): string {
  const game = c.game;
  let args = [...c.args];
  // Global options come first: -chdir, -help, -version.
  let chdir: string | null = null;
  while (args.length && args[0].startsWith('-')) {
    const a = args.shift()!;
    const m = /^--?chdir=(.*)$/.exec(a);
    if (m) chdir = m[1];
    else if (/^--?(help|h)$/.test(a)) return ROOT_HELP;
    else if (/^--?(version|v)$/.test(a)) return versionText();
    else return game.error(`${ROOT_HELP}\n\nError: Unknown global option: ${a}`, 1) as string;
  }
  const sub = args.shift();
  if (!sub) return game.error(ROOT_HELP, 1);
  const dir = game.resolve(chdir ?? '.');
  if (chdir && game.find(dir)?.type !== 'directory') return game.error(`Error handling -chdir option: chdir ${chdir}: no such file or directory`, 1);
  const out = new Out(c.last && game.colours && !args.includes('-no-color'));
  args = args.filter((a) => a !== '-no-color');
  const t = tofuOf(game);
  const done = (run: Omit<TofuRun, 'user' | 'dir' | 'command'> & { command?: string }) => {
    t.runs.push({ command: sub, dir, user: game.who, ...run });
  };
  const finish = (code = 0): string => {
    if (out.errors.length) game.error(out.errors.join('\n\n'), code || 1);
    else if (code) game.status = code;
    return out.lines.join('\n');
  };
  if (args.some((a) => /^--?(help|h)$/.test(a))) return subHelp(sub);
  const opts = readOptions(args);
  if ('error' in opts) {
    out.errors.push(`Error parsing command-line flags: flag provided but not defined: ${opts.error}`);
    return finish(1);
  }
  switch (sub) {
    case 'version':
      return versionText();
    case 'init':
      return init(game, dir, opts, out, done, finish);
    case 'fmt':
      return fmt(game, dir, opts, out, done, finish);
    case 'validate':
      return validateCommand(game, dir, out, done, finish);
    case 'plan':
    case 'apply':
    case 'destroy':
      return operation(game, sub, dir, opts, out, done, finish);
    case 'import':
      return importCommand(game, dir, opts, out, done, finish);
    case 'state':
      return stateCommand(game, dir, opts, out, done, finish);
    case 'output':
      return outputCommand(game, dir, opts, out, finish);
    case 'show':
      return showCommand(game, dir, out, finish);
    case 'force-unlock':
      return forceUnlock(game, dir, opts, out, done, finish);
    case 'refresh':
      return operation(game, 'apply', dir, { ...opts, flags: { ...opts.flags, 'refresh-only': true, 'auto-approve': true } }, out, done, finish);
    default:
      return game.error(`OpenTofu has no command named "${sub}".\n\nTo see all of OpenTofu's top-level commands, run:\n  tofu -help`, 1);
  }
}

const versionText = () => `OpenTofu v${VERSION}\non ${PLATFORM}`;

function subHelp(sub: string): string {
  const helps: Record<string, string> = {
    init: 'Usage: tofu [global options] init [options]\n\n  Initialize a new or existing OpenTofu working directory by creating\n  initial files, loading any remote state, downloading modules, etc.',
    plan: 'Usage: tofu [global options] plan [options]\n\n  Generates a speculative execution plan, showing what actions OpenTofu\n  would take to apply the current configuration. This command will not\n  actually perform the planned actions.',
    apply: 'Usage: tofu [global options] apply [options] [PLAN]\n\n  Creates or updates infrastructure according to OpenTofu configuration\n  files in the current directory.',
    state: STATE_HELP,
  };
  return helps[sub] ?? `Usage: tofu [global options] ${sub} [options]`;
}

type Done = (run: Omit<TofuRun, 'user' | 'dir' | 'command'> & { command?: string }) => void;
type Finish = (code?: number) => string;

// ——— init ———

function init(game: Shell, dir: string, opts: Options, out: Out, done: Done, finish: Finish): string {
  const { config, diagnostics } = loadConfig(game, dir);
  if (!Object.keys(config.sources).length) {
    out.print(out.c('1', 'OpenTofu initialized in an empty directory!') + '\n\n' + wrap('The directory has no OpenTofu configuration files. You may begin working with OpenTofu immediately by creating OpenTofu configuration files.', WIDTH - 1));
    return finish();
  }
  if (diagnostics.some((x) => x.severity === 'error')) {
    out.errors.push(out.c('31', '\nOpenTofu encountered problems during initialization, including problems\nwith the configuration, described below.\n\nThe OpenTofu configuration must be valid before initialization so that\nOpenTofu can determine which modules and providers need to be installed.'));
    for (const x of diagnostics) out.diag({ ...x, context: x.context ?? contextOf(config, x.subject ?? ({ file: '' } as Range)) }, config.sources);
    done({ ok: false });
    return finish(1);
  }
  out.print('');
  out.print(out.c('1', 'Initializing the backend...'));
  out.print('');
  out.print(out.c('1', 'Initializing provider plugins...'));
  const lockPath = `${dir}/${LOCK_FILE}`;
  const locked = /provider\s+"registry\.opentofu\.org\/hashicorp\/dns"\s*\{[^}]*version\s*=\s*"([^"]+)"/.exec(game.read(lockPath) ?? '')?.[1];
  const installed = game.find(`${dir}/${PLUGIN_DIR}/terraform-provider-dns_v${DNS_VERSION}`);
  const constraint = config.constraint ?? '';
  const t = tofuOf(game);
  const mirrorOk = !!game.read(`${game.home}/.tofurc`)?.includes(t.mirror.path) || !!game.read(`${game.home}/.terraformrc`)?.includes(t.mirror.path);
  if (locked && !flag(opts, 'upgrade', false)) {
    out.print(`- Reusing previous version of hashicorp/dns from the dependency lock file`);
    if (installed) out.print(`- Using previously-installed hashicorp/dns v${locked}`);
  } else out.print(constraint ? `- Finding hashicorp/dns versions matching "${constraint}"...` : '- Finding latest version of hashicorp/dns...');
  if (!installed || !locked || flag(opts, 'upgrade', false)) {
    if (!mirrorOk) {
      out.diag(
        sourceless(
          'error',
          'Failed to query available provider packages',
          `Could not retrieve the list of available versions for provider hashicorp/dns: could not connect to registry.opentofu.org: failed to request discovery document: Get "https://registry.opentofu.org/.well-known/terraform.json": dial tcp: lookup registry.opentofu.org on 127.0.0.1:53: server misbehaving`,
        ),
        {},
      );
      done({ ok: false });
      return finish(1);
    }
    if (game.find(dir) && !game.writtenIn(`${dir}/.terraform`) && !game.find(`${dir}/.terraform`)) {
      out.errors.push(`Error: Failed to install provider\n\nError while installing hashicorp/dns v${DNS_VERSION}: mkdir .terraform: permission denied`);
      done({ ok: false });
      return finish(1);
    }
    out.print(`- Installing hashicorp/dns v${DNS_VERSION}...`);
    const parts = PLUGIN_DIR.split('/');
    for (let i = 1; i <= parts.length; i++) {
      const p = `${dir}/${parts.slice(0, i).join('/')}`;
      if (!game.find(p)) game.place('tofu', p, d({}, undefined, { owner: game.who, group: groupOf(game, dir) }));
    }
    game.place('tofu', `${dir}/${PLUGIN_DIR}/terraform-provider-dns_v${DNS_VERSION}`, f('', { charset: 'binary', size: 22_417_560, owner: game.who, group: groupOf(game, dir), mode: 'rwxr-xr-x' }));
    out.print(`- Installed hashicorp/dns v${DNS_VERSION} (unauthenticated)`);
  }
  if (!locked) {
    writeText(game, lockPath, lockFileText(constraint));
    out.print(`\nOpenTofu has created a lock file ${out.c('1', LOCK_FILE)} to record the provider\nselections it made above. Include this file in your version control repository\nso that OpenTofu can guarantee to make the same selections by default when\nyou run "tofu init" in the future.`);
    out.print('');
    out.diag(
      sourceless(
        'warning',
        'Incomplete lock file information for providers',
        `Due to your customized provider installation methods, OpenTofu was forced to calculate lock file checksums locally for the following providers:\n  - hashicorp/dns\n\nThe current .terraform.lock.hcl file only includes checksums for ${PLATFORM}, so OpenTofu running on another platform will fail to install these providers.\n\nTo calculate additional checksums for another platform, run:\n  tofu providers lock -platform=linux_amd64\n(where linux_amd64 is the platform to generate)`,
      ),
      {},
    );
  }
  out.print('');
  out.print(out.c('1;32', 'OpenTofu has been successfully initialized!'));
  out.print(
    out.c(
      '32',
      '\nYou may now begin working with OpenTofu. Try running "tofu plan" to see\nany changes that are required for your infrastructure. All OpenTofu commands\nshould now work.\n\nIf you ever set or change modules or backend configuration for OpenTofu,\nrerun this command to reinitialize your working directory. If you forget, other\ncommands will detect it and remind you to do so if necessary.',
    ),
  );
  done({ ok: true });
  return finish();
}

export const lockFileText = (constraint: string) => `# This file is maintained automatically by "tofu init".
# Manual edits may be lost in future updates.

provider "${DNS_FQN}" {
  version     = "${DNS_VERSION}"${constraint ? `\n  constraints = "${constraint}"` : ''}
  hashes = [
    "${DNS_HASH}",
  ]
}
`;

const groupOf = (game: Shell, dir: string) => game.find(dir)?.group ?? game.who;

/** Writes a text file in place (keeping its owner and mode) or creates it. */
function writeText(game: Shell, path: string, text: string, mode = 'rw-r--r--'): string | null {
  const n = game.find(path);
  if (n?.type === 'file') {
    if (!game.can(n, 'w')) return `open ${path}: permission denied`;
    (n as File).content = text;
    (n as File).mtime = nowOf(game);
    (n as File).size = undefined;
    return null;
  }
  const dir = path.slice(0, path.lastIndexOf('/')) || '/';
  return game.place('tofu', path, f(text, { lines: true, owner: game.who, group: groupOf(game, dir), mode, mtime: nowOf(game) }));
}

// ——— fmt ———

function fmt(game: Shell, dir: string, opts: Options, out: Out, done: Done, finish: Finish): string {
  const check = flag(opts, 'check', false);
  const write = flag(opts, 'write', !check);
  const list = flag(opts, 'list', true);
  const diff = flag(opts, 'diff', false);
  const recursive = flag(opts, 'recursive', false);
  const target = opts.positional[0];
  const root = target ? game.resolve(target) : dir;
  const node = game.find(root);
  if (!node) {
    out.diag(sourceless('error', 'No file or directory at ' + (target ?? '.'), undefined), {});
    return finish(2);
  }
  const files: { path: string; shown: string }[] = [];
  const walk = (abs: string, shown: string) => {
    const n = game.find(abs);
    if (n?.type !== 'directory') return;
    for (const name of Object.keys(n.children).sort()) {
      const child = n.children[name];
      const s = shown ? `${shown}/${name}` : name;
      if (child.type === 'file' && /\.(tf|tfvars|tftest\.hcl)$/.test(name)) files.push({ path: `${abs}/${name}`, shown: s });
      else if (child.type === 'directory' && recursive && !name.startsWith('.')) walk(`${abs}/${name}`, s);
    }
  };
  if (node.type === 'file') files.push({ path: root, shown: target! });
  else walk(root, target && target !== '.' ? target.replace(/\/$/, '') : '');
  const changed: string[] = [];
  for (const file of files) {
    const src = game.read(file.path) ?? '';
    const { diagnostics } = parse(src, file.shown);
    if (diagnostics.length) {
      for (const x of diagnostics) out.diag(x, { [file.shown]: src });
      done({ ok: false });
      return finish(2);
    }
    const result = format(src);
    if (result === src) continue;
    changed.push(file.shown);
    if (list) out.print(file.shown);
    if (write) {
      const e = writeText(game, file.path, result);
      if (e) {
        out.diag(sourceless('error', 'Writing formatted file failed', `Failed to write ${file.shown}`), {});
        return finish(2);
      }
    }
    if (diff) out.print(labelledDiff(src, result, `old/${file.shown}`, `new/${file.shown}`));
  }
  done({ ok: !(check && changed.length), formatted: write ? changed : [] });
  return finish(check && changed.length ? 3 : 0);
}

// ——— validate ———

/** The provider is installed for this directory (init done, the lock file names it). */
function providerReady(game: Shell, dir: string): boolean {
  return !!game.find(`${dir}/${PLUGIN_DIR}/terraform-provider-dns_v${DNS_VERSION}`) && /registry\.opentofu\.org\/hashicorp\/dns/.test(game.read(`${dir}/${LOCK_FILE}`) ?? '');
}

function validateCommand(game: Shell, dir: string, out: Out, done: Done, finish: Finish): string {
  const { config, diagnostics } = loadConfig(game, dir);
  if (diagnostics.length) {
    for (const x of diagnostics) out.diag({ ...x, context: x.context ?? (x.subject ? contextOf(config, x.subject) : undefined) }, config.sources);
    done({ ok: false, valid: false });
    return finish(1);
  }
  if (config.required && !providerReady(game, dir)) {
    out.diag(sourceless('error', 'Missing required provider', `This configuration requires provider ${DNS_FQN}, but that provider isn't available. You may be able to install it automatically by running:\n  tofu init`), {});
    done({ ok: false, valid: false });
    return finish(1);
  }
  const problems = validate(config);
  if (problems.length) {
    for (const x of problems) out.diag(x, config.sources);
    done({ ok: false, valid: false });
    return finish(1);
  }
  out.print(`${out.c('1;32', 'Success!')} The configuration is valid.`);
  done({ ok: true, valid: true });
  return finish();
}

// ——— The state lock ———

function lockHolder(game: Shell, path: string): { pid: number; info: LockInfo } | null {
  const t = tofuOf(game);
  const l = t.locks[path];
  if (!l) return null;
  const alive = ((game.principal.state.process ?? []) as Process[]).some((p) => p.pid === l.pid);
  if (!alive) {
    delete t.locks[path];
    return null;
  }
  return l;
}

const lockInfoText = (i: LockInfo) =>
  `Lock Info:\n  ID:        ${i.id}\n  Path:      ${i.path}\n  Operation: ${i.operation}\n  Who:       ${i.who}\n  Version:   ${i.version}\n  Created:   ${i.created}\n  Info:      ${i.info}`;

function lockError(i: LockInfo): Diagnostic {
  return sourceless(
    'error',
    'Error acquiring the state lock',
    `Error message: resource temporarily unavailable\n${lockInfoText(i)}\n\nOpenTofu acquires a state lock to protect the state from being written\nby multiple users at the same time. Please resolve the issue above and try\nagain. For most commands, you can disable locking with the "-lock=false"\nflag, but this is not recommended.`,
  );
}

/** A process held the lock and ended: TERM or INT let tofu remove its lock file, KILL leaves it. */
export function releaseLock(game: Shell, pid: number, signal: string) {
  const t = tofuOf(game);
  for (const [path, l] of Object.entries(t.locks))
    if (l.pid === pid) {
      delete t.locks[path];
      const info = `${path.slice(0, path.lastIndexOf('/'))}/.${path.slice(path.lastIndexOf('/') + 1)}.lock.info`;
      if (signal !== 'KILL') game.principal.erase(info);
    }
}

// ——— plan, apply, destroy ———

interface Prepared {
  config: Config;
  state: StateFile | null;
  statePath: string;
  vars: Record<string, Value>;
  fromCli: string[];
  providerConfig: Record<string, Value>;
  scope: Scope;
}

/** What plan, apply and import do first: the configuration, the lock, the dependencies, the variables, validation, the state. */
function prepare(game: Shell, dir: string, opts: Options, out: Out, lock: boolean): Prepared | null {
  const { config, diagnostics } = loadConfig(game, dir);
  if (diagnostics.length) {
    for (const x of diagnostics) out.diag({ ...x, context: x.context ?? (x.subject ? contextOf(config, x.subject) : undefined) }, config.sources);
    return null;
  }
  const statePath = game.resolve(typeof opts.flags.state === 'string' ? opts.flags.state : `${dir}/${STATE_FILE}`);
  if (lock && flag(opts, 'lock', true)) {
    const held = lockHolder(game, statePath);
    if (held) {
      out.diag(lockError(held.info), {});
      return null;
    }
  }
  if (config.required && !/registry\.opentofu\.org\/hashicorp\/dns/.test(game.read(`${dir}/${LOCK_FILE}`) ?? '')) {
    out.diag(
      sourceless(
        'error',
        'Inconsistent dependency lock file',
        `The following dependency selections recorded in the lock file are inconsistent with the current configuration:\n  - provider ${DNS_FQN}: required by this configuration but no version is selected\n\nTo make the initial dependency selections that will initialize the dependency lock file, run:\n  tofu init`,
      ),
      {},
    );
    return null;
  }
  if (config.required && !providerReady(game, dir)) {
    out.diag(
      sourceless(
        'error',
        'Required plugins are not installed',
        `The installed provider plugins are not consistent with the packages selected in the dependency lock file:\n  - ${DNS_FQN}: there is no package for ${DNS_FQN} ${DNS_VERSION} cached in .terraform/providers\n\nOpenTofu uses external plugins to integrate with a variety of different infrastructure services. To download the plugins required for this configuration, run:\n  tofu init`,
      ),
      {},
    );
    return null;
  }
  const { vars, diagnostics: varDiags, fromCli } = variableValues(game, config, opts.vars);
  for (const x of varDiags) out.diag(x, config.sources);
  if (varDiags.some((x) => x.severity === 'error')) return null;
  const problems = validate(config);
  if (problems.length) {
    for (const x of problems) out.diag(x, config.sources);
    return null;
  }
  const raw = game.read(statePath);
  const { state, error } = readState(raw);
  if (error) {
    out.diag(sourceless('error', `error loading state: ${error}`), {});
    return null;
  }
  const scope: Scope = { vars, config, resources: {} };
  const providerConfig: Record<string, Value> = {};
  for (const b of config.provider?.block.body.blocks ?? []) {
    const u: Record<string, Value> = {};
    for (const a of b.body.attributes) {
      const v = evaluate(a.expr, scope);
      u[a.name] = isUnknown(v) ? null : v;
    }
    providerConfig[b.type] = u;
  }
  return { config, state, statePath, vars, fromCli, providerConfig, scope };
}

function writeState(game: Shell, p: Prepared, next: StateFile): string | null {
  const t = tofuOf(game);
  const old = game.read(p.statePath);
  if (old !== null) writeText(game, `${p.statePath}.backup`, old);
  const text = stateText(next);
  const e = writeText(game, p.statePath, text);
  if (!e) t.written[p.statePath] = text;
  return e;
}

function newState(game: Shell, p: Prepared): StateFile {
  const t = tofuOf(game);
  return p.state ? { ...p.state, serial: p.state.serial + 1, resources: [...p.state.resources] } : { serial: 1, lineage: uuidOf(`${p.config.dir}:${t.counter++}`), outputs: {}, resources: [] };
}

function operation(game: Shell, sub: 'plan' | 'apply' | 'destroy', dir: string, opts: Options, out: Out, done: Done, finish: Finish): string {
  const mode: Plan['mode'] = sub === 'destroy' || flag(opts, 'destroy', false) ? 'destroy' : flag(opts, 'refresh-only', false) ? 'refresh-only' : 'normal';
  const p = prepare(game, dir, opts, out, true);
  if (!p) {
    done({ ok: false });
    return finish(1);
  }
  const plan = buildPlan(game, p.config, p.state, p.scope, mode, p.providerConfig, out);
  if (plan.errors.length) {
    for (const x of plan.errors) out.diag(x, p.config.sources);
    done({ ok: false });
    return finish(1);
  }
  const rendered = renderPlan(plan, out);
  out.print(rendered.text);
  const canApply = rendered.changes > 0 || (mode === 'refresh-only' && plan.drift.length > 0);
  const drift = plan.drift.map((x) => x.address);
  const noLock = !flag(opts, 'lock', true);
  if (sub === 'plan') {
    if (canApply) {
      out.print(out.c('90', `\n${'─'.repeat(WIDTH - 1)}`));
      if (typeof opts.flags.out === 'string') {
        writeText(game, game.resolve(opts.flags.out), JSON.stringify({ plan: 'tofu', mode, config: p.config.sources }));
        out.print(`\nSaved the plan to: ${opts.flags.out}\n\nTo perform exactly these actions, run the following command to apply:\n    tofu apply "${opts.flags.out}"`);
      } else out.print('\n' + wrap('Note: You didn\'t use the -out option to save this plan, so OpenTofu can\'t guarantee to take exactly these actions if you run "tofu apply" now.', WIDTH - 1));
    }
    done({ ok: true, changes: rendered.changes, drift, refreshOnly: mode === 'refresh-only', noLock });
    return finish(flag(opts, 'detailed-exitcode', false) && canApply ? 2 : 0);
  }
  const carryOut = (): string => {
    const result = execute(game, p, plan, out);
    done({ ok: result.ok, autoApprove: flag(opts, 'auto-approve', false), noLock, ...result.what, drift, refreshOnly: mode === 'refresh-only', changes: rendered.changes });
    return finish(result.ok ? 0 : 1);
  };
  if (!canApply || flag(opts, 'auto-approve', false)) return carryOut();
  const query =
    mode === 'destroy'
      ? 'Do you really want to destroy all resources?\n  OpenTofu will destroy all your managed infrastructure, as shown above.\n  There is no undo. Only \'yes\' will be accepted to confirm.'
      : mode === 'refresh-only'
        ? 'Would you like to update the OpenTofu state to reflect these detected changes?\n  OpenTofu will write these changes to the state without modifying any real infrastructure.\n  There is no undo. Only \'yes\' will be accepted to confirm.'
        : "Do you want to perform these actions?\n  OpenTofu will perform the actions described above.\n  Only 'yes' will be accepted to approve.";
  out.print(`\n${out.c('1', query.split('\n')[0])}\n${query.split('\n').slice(1).join('\n')}\n`);
  const text = out.lines.join('\n');
  const errors = [...out.errors];
  const who = game.who;
  game.ask('  Enter a value: ', (answer) => {
    const before = game.who;
    game.who = who;
    try {
      const o2 = new Out(out.colour);
      o2.errors.push(...errors);
      if (answer.trim() !== 'yes') {
        o2.print(mode === 'destroy' ? 'Destroy cancelled.' : 'Apply cancelled.');
        done({ ok: false, changes: rendered.changes, drift, refreshOnly: mode === 'refresh-only', command: sub });
        game.status = 1;
        game.lastStatus = 1;
        return o2.lines.join('\n');
      }
      o2.print('');
      const result = execute(game, p, plan, o2);
      done({ ok: result.ok, noLock, ...result.what, drift, refreshOnly: mode === 'refresh-only', changes: rendered.changes });
      if (o2.errors.length) game.error(o2.errors.join('\n\n'), 1);
      return o2.lines.join('\n');
    } finally {
      game.who = before;
    }
  });
  return text;
}

/** apply: each change made on the server, the new state written, the summary and the outputs. */
function execute(game: Shell, p: Prepared, plan: Plan, out: Out): { ok: boolean; what: Partial<TofuRun> } {
  const next = newState(game, p);
  next.resources = plan.prior.map((x) => ({ ...x, attributes: { ...x.attributes } }));
  const what = { created: [] as string[], updated: [] as string[], destroyed: [] as string[], imported: [] as string[] };
  const set = (inst: Instance | null, address: string) => {
    next.resources = next.resources.filter((r) => `${r.type}.${r.name}` !== address);
    if (inst) next.resources.push(inst);
  };
  let ok = true;
  if (plan.mode !== 'refresh-only')
    for (const c of plan.changes) {
      if (c.action === 'noop') continue;
      const resolved = c.after ? (Object.fromEntries(Object.entries(c.after).map(([k, v]) => [k, isUnknown(v) ? null : v])) as Record<string, Value>) : null;
      if (c.importId) {
        out.print(out.c('1', `${c.address}: Importing... [id=${c.importId}]`));
        out.print(out.c('1', `${c.address}: Import complete [id=${c.importId}]`));
        what.imported.push(c.address);
        set({ type: c.type, name: c.name, attributes: c.before! }, c.address);
        if (c.action === 'import') continue;
      }
      if (c.action === 'delete' || c.action === 'replace') {
        out.print(out.c('1', `${c.address}: Destroying... [id=${c.before!.id}]`));
        const e = writeRecord(game, c.type, c.before, null);
        if (e) {
          out.diag({ severity: 'error', summary: e, address: c.address }, p.config.sources);
          ok = false;
          continue;
        }
        out.print(out.c('1', `${c.address}: Destruction complete after 0s`));
        what.destroyed.push(c.address);
        set(null, c.address);
        if (c.action === 'delete') continue;
      }
      if (c.action === 'create' || c.action === 'replace') {
        out.print(out.c('1', `${c.address}: Creating...`));
        const attrs = { ...resolved!, id: fqdnOf(resolved!) };
        const e = writeRecord(game, c.type, null, attrs);
        if (e) {
          out.diag({ severity: 'error', summary: e, address: c.address }, p.config.sources);
          ok = false;
          continue;
        }
        const d = dns(game.principal)!;
        const read = readRecord(d, c.type, attrs);
        out.print(out.c('1', `${c.address}: Creation complete after 0s [id=${attrs.id}]`));
        what.created.push(c.address);
        set({ type: c.type, name: c.name, attributes: read && !('error' in read) ? { ...attrs, ...(read as Record<string, Value>) } : attrs }, c.address);
        continue;
      }
      if (c.action === 'update') {
        out.print(out.c('1', `${c.address}: Modifying... [id=${c.before!.id}]`));
        const e = writeRecord(game, c.type, c.before, resolved);
        if (e) {
          out.diag({ severity: 'error', summary: e, address: c.address }, p.config.sources);
          ok = false;
          continue;
        }
        out.print(out.c('1', `${c.address}: Modifications complete after 0s [id=${c.before!.id}]`));
        what.updated.push(c.address);
        set({ type: c.type, name: c.name, attributes: { ...resolved!, id: String(c.before!.id) } }, c.address);
      }
    }
  // Outputs, from the new values.
  if (plan.mode === 'destroy') next.outputs = {};
  else if (plan.mode !== 'refresh-only') {
    const scope: Scope = { ...p.scope, resources: Object.fromEntries(next.resources.map((r) => [`${r.type}.${r.name}`, r.attributes])) };
    next.outputs = {};
    for (const [name, o] of Object.entries(p.config.outputs)) {
      const v = evaluate(o.expr, scope);
      if (!isUnknown(v)) next.outputs[name] = { value: v, type: typeof v === 'number' ? 'number' : Array.isArray(v) ? '["list","string"]' : typeof v === 'object' && v ? '["object",{}]' : 'string', ...(o.sensitive ? { sensitive: true } : {}) };
    }
  }
  const e = writeState(game, p, next);
  if (e) {
    out.diag(sourceless('error', 'Failed to save state', `Error saving state: ${e}`), {});
    return { ok: false, what };
  }
  if (!ok) return { ok, what };
  const n = (x: string[]) => x.length;
  const added = n(what.created);
  const destroyed = n(what.destroyed);
  out.print(
    out.c(
      '1;32',
      plan.mode === 'destroy'
        ? `\nDestroy complete! Resources: ${destroyed} destroyed.`
        : what.imported.length
          ? `\nApply complete! Resources: ${what.imported.length} imported, ${added} added, ${what.updated.length} changed, ${destroyed} destroyed.`
          : `\nApply complete! Resources: ${added} added, ${what.updated.length} changed, ${destroyed} destroyed.`,
    ),
  );
  if (Object.keys(next.outputs).length && plan.mode !== 'destroy') {
    out.print(out.c('1;32', '\nOutputs:\n'));
    out.print(outputsText(next.outputs));
  }
  return { ok, what };
}

function outputsText(outputs: StateFile['outputs']): string {
  return Object.keys(outputs)
    .sort()
    .map((k) => `${k} = ${outputs[k].sensitive ? '<sensitive>' : showValue(outputs[k].value, 0)}`)
    .join('\n');
}

/** A value as tofu output writes it (HCL-like, lists on several lines). */
function showValue(v: Value, depth: number): string {
  if (Array.isArray(v)) return v.length ? `[\n${v.map((x) => `${'  '.repeat(depth + 1)}${showValue(x, depth + 1)},`).join('\n')}\n${'  '.repeat(depth)}]` : '[]';
  if (v && typeof v === 'object') {
    const keys = Object.keys(v).sort();
    const width = Math.max(0, ...keys.map((k) => k.length));
    return `{\n${keys.map((k) => `${'  '.repeat(depth + 1)}"${k}"${' '.repeat(width - k.length)} = ${showValue(v[k], depth + 1)}`).join('\n')}\n${'  '.repeat(depth)}}`;
  }
  return v === null ? 'null' : typeof v === 'string' ? JSON.stringify(v) : String(v);
}

// ——— import ———

function importCommand(game: Shell, dir: string, opts: Options, out: Out, done: Done, finish: Finish): string {
  const [address, id] = opts.positional;
  if (!address || !id || opts.positional.length !== 2) {
    out.errors.push('The import command expects two arguments.\nUsage: tofu [global options] import [options] ADDR ID');
    return finish(1);
  }
  const p = prepare(game, dir, opts, out, true);
  if (!p) {
    done({ ok: false });
    return finish(1);
  }
  const r = p.config.resources[address];
  if (!/^[a-z][\w-]*\.[\w-]+$/.test(address)) {
    out.diag(sourceless('error', 'Invalid address', 'A resource name is required.'), {});
    out.print('For information on valid syntax, see:\nhttps://opentofu.org/docs/cli/state/resource-addressing/');
    return finish(1);
  }
  if (!r) {
    const [type, name] = address.split('.');
    out.errors.push(`${out.c('1;31', 'Error:')} resource address "${address}" does not exist in the configuration.\n\nBefore importing this resource, please create its configuration in the root module. For example:\n\nresource "${type}" "${name}" {\n  # (resource arguments)\n}`);
    done({ ok: false });
    return finish(1);
  }
  if (p.state?.resources.some((x) => `${x.type}.${x.name}` === address)) {
    out.diag(sourceless('error', 'Resource already managed by OpenTofu', `OpenTofu is already managing a remote object for ${address}. To import to this address you must first remove the existing object from the state.`), {});
    done({ ok: false });
    return finish(1);
  }
  const srv = server(game, p.providerConfig);
  out.print(out.c('1', `${address}: Importing from ID "${id}"...`));
  if ('error' in srv) {
    out.diag({ severity: 'error', summary: srv.error }, {});
    done({ ok: false });
    return finish(1);
  }
  const found = importRead(srv.ok.d, r.type, id);
  if ('error' in found) {
    if (found.error === 'missing') {
      out.print(out.c('1;32', `${address}: Import prepared!`));
      out.print(out.c('32', `  Prepared ${r.type} for import`));
      out.print(out.c('1', `${address}: Refreshing state... [id=${id.toLowerCase()}]`));
      out.diag(sourceless('error', 'Cannot import non-existent remote object', missingImport(address)), {});
    } else out.diag({ severity: 'error', summary: String(found.error) }, {});
    done({ ok: false });
    return finish(1);
  }
  out.print(out.c('1;32', `${address}: Import prepared!`));
  out.print(out.c('32', `  Prepared ${r.type} for import`));
  out.print(out.c('1', `${address}: Refreshing state... [id=${found.id}]`));
  const next = newState(game, p);
  next.resources = [...next.resources, { type: r.type, name: r.name, attributes: found }];
  const e = writeState(game, p, next);
  if (e) {
    out.diag(sourceless('error', 'Failed to save state', e), {});
    return finish(1);
  }
  out.print(out.c('32', '\nImport successful!\n\nThe resources that were imported are shown above. These resources are now in\nyour OpenTofu state and will henceforth be managed by OpenTofu.\n'));
  done({ ok: true, imported: [address] });
  return finish();
}

// ——— state list / show / rm / mv ———

function stateCommand(game: Shell, dir: string, opts: Options, out: Out, done: Done, finish: Finish): string {
  const [action, ...rest] = opts.positional;
  if (!action) return STATE_HELP;
  const statePath = game.resolve(typeof opts.flags.state === 'string' ? opts.flags.state : `${dir}/${STATE_FILE}`);
  const raw = game.read(statePath);
  const { state, error } = readState(raw);
  if (error) {
    out.diag(sourceless('error', 'Error loading the state', `Please ensure that your OpenTofu state exists and that you've configured it properly. You can use the "-state" flag to point OpenTofu at another state file.\n\nCause: ${error}`), {});
    return finish(1);
  }
  if (!state) {
    if (action === 'list') return finish();
    out.diag(sourceless('error', 'No state file was found', 'State management commands require a state file. Run this command in a directory where OpenTofu has been run or use the -state flag to point the command to a specific state location.'), {});
    return finish(1);
  }
  const addr = (r: Instance) => `${r.type}.${r.name}`;
  if (action === 'list') {
    const list = state.resources.map(addr).sort().filter((a) => !rest.length || rest.some((x) => a === x || a.startsWith(`${x}.`)));
    done({ ok: true, command: 'state list' });
    return list.join('\n');
  }
  if (action === 'show') {
    const target = state.resources.find((r) => addr(r) === rest[0]);
    if (!target) {
      out.diag(sourceless('error', 'No instance found for the given address', 'This command requires that the address references one specific instance. To view the available instances, use "tofu state list". Please modify the address to reference a specific instance.'), {});
      return finish(1);
    }
    done({ ok: true, command: 'state show' });
    return stateShow(target);
  }
  if (action === 'rm' || action === 'mv') {
    if (flag(opts, 'lock', true)) {
      const held = lockHolder(game, statePath);
      if (held) {
        out.diag(lockError(held.info), {});
        return finish(1);
      }
    }
    const p: Prepared = { config: loadConfig(game, dir).config, state, statePath, vars: {}, fromCli: [], providerConfig: {}, scope: { vars: {}, config: loadConfig(game, dir).config, resources: {} } };
    const dry = flag(opts, 'dry-run', false);
    if (action === 'rm') {
      if (!rest.length) {
        out.errors.push('At least one address is required.');
        return finish(1);
      }
      const targets = state.resources.filter((r) => rest.includes(addr(r)));
      if (!targets.length) {
        out.diag(sourceless('error', 'Invalid target address', 'No matching objects found. To view the available instances, use "tofu state list". Please modify the address to reference a specific instance.'), {});
        return finish(1);
      }
      for (const r of targets) out.print(dry ? `Would remove ${addr(r)}` : `Removed ${addr(r)}`);
      if (dry) {
        out.print(`Would have removed ${targets.length} items.`);
        return finish();
      }
      const next = newState(game, p);
      next.resources = state.resources.filter((r) => !targets.includes(r));
      writeState(game, p, next);
      out.print(`Successfully removed ${targets.length} resource instance(s).`);
      done({ ok: true, command: 'state rm', removed: targets.map(addr) });
      return finish();
    }
    const [from, to] = rest;
    if (!from || !to) {
      out.errors.push('Exactly two arguments expected.\n\nUsage: tofu [global options] state mv [options] SOURCE DESTINATION');
      return finish(1);
    }
    const source = state.resources.find((r) => addr(r) === from);
    if (!source) {
      out.diag(sourceless('error', 'Invalid source address', `Cannot move ${from}: does not match anything in the current state.`), {});
      return finish(1);
    }
    const [type, name] = to.split('.');
    if (type !== source.type || !name) {
      out.diag(sourceless('error', 'Invalid state move request', `Cannot move ${from} to ${to}: resource types don't match.`), {});
      return finish(1);
    }
    if (state.resources.some((r) => addr(r) === to)) {
      out.diag(sourceless('error', 'Invalid target address', `Cannot move to ${to}: there is already a resource instance at that address in the current state.\n\nTo replace this resource instance, first remove it from the state using "tofu state rm ${to}".`), {});
      return finish(1);
    }
    out.print(`${dry ? 'Would move' : 'Move'} "${from}" to "${to}"`);
    if (dry) return finish();
    const next = newState(game, p);
    next.resources = state.resources.map((r) => (r === source ? { ...r, name } : r));
    writeState(game, p, next);
    out.print('Successfully moved 1 object(s).');
    done({ ok: true, command: 'state mv' });
    return finish();
  }
  out.errors.push(`${STATE_HELP}`);
  return finish(1);
}

function stateShow(r: Instance): string {
  const keys = Object.keys(r.attributes).filter((k) => r.attributes[k] !== null).sort();
  const width = Math.max(...keys.map((k) => k.length));
  const lines = [`# ${r.type}.${r.name}:`, `resource "${r.type}" "${r.name}" {`];
  for (const k of keys) {
    const v = r.attributes[k];
    if (Array.isArray(v)) lines.push(`    ${k.padEnd(width)} = [`, ...v.map((x) => `        ${JSON.stringify(x)},`), '    ]');
    else lines.push(`    ${k.padEnd(width)} = ${show(v)}`);
  }
  lines.push('}');
  return lines.join('\n');
}

// ——— output, show, force-unlock ———

function outputCommand(game: Shell, dir: string, opts: Options, out: Out, finish: Finish): string {
  const { state, error } = readState(game.read(`${dir}/${STATE_FILE}`));
  if (error) {
    out.diag(sourceless('error', `error loading state: ${error}`), {});
    return finish(1);
  }
  const outputs = state?.outputs ?? {};
  const name = opts.positional[0];
  if (flag(opts, 'json', false)) return JSON.stringify(name ? outputs[name]?.value ?? null : Object.fromEntries(Object.entries(outputs).map(([k, v]) => [k, { sensitive: !!v.sensitive, type: v.type, value: v.value }])), null, 2);
  if (!Object.keys(outputs).length) {
    out.diag(
      sourceless(
        'warning',
        'No outputs found',
        'The state file either has no outputs defined, or all the defined outputs are empty. Please define an output in your configuration with the `output` keyword and run `tofu refresh` for it to become available. If you are using interpolation, please verify the interpolated value is not empty. You can use the `tofu console` command to assist.',
      ),
      {},
    );
    return finish();
  }
  if (name) {
    const o = outputs[name];
    if (!o) {
      out.diag(sourceless('error', `Output "${name}" not found`, 'The output variable requested could not be found in the state file. If you recently added this to your configuration, be sure to run `tofu apply`, since the state won\'t be updated with new output variables until that command is run.'), {});
      return finish(1);
    }
    if (flag(opts, 'raw', false)) return typeof o.value === 'string' || typeof o.value === 'number' || typeof o.value === 'boolean' ? String(o.value) : (game.error(`Error: Unsupported value for raw output\n\nThe -raw option only supports strings, numbers, and boolean values, but output value "${name}" is ${Array.isArray(o.value) ? 'list' : 'object'}.`, 1) as string);
    return showValue(o.value, 0);
  }
  return outputsText(outputs);
}

function showCommand(game: Shell, dir: string, out: Out, finish: Finish): string {
  const { state, error } = readState(game.read(`${dir}/${STATE_FILE}`));
  if (error) {
    out.diag(sourceless('error', `error loading state: ${error}`), {});
    return finish(1);
  }
  if (!state || !state.resources.length) return 'No state.';
  const parts = [...state.resources].sort((a, b) => `${a.type}.${a.name}`.localeCompare(`${b.type}.${b.name}`)).map(stateShow);
  if (Object.keys(state.outputs).length) parts.push(`\n\nOutputs:\n\n${outputsText(state.outputs)}`);
  return parts.join('\n\n');
}

function forceUnlock(game: Shell, dir: string, opts: Options, out: Out, done: Done, finish: Finish): string {
  void game;
  void dir;
  if (!opts.positional[0]) {
    out.errors.push('Expected a single argument: LOCK_ID');
    return finish(1);
  }
  // The local backend's lock is the operating system's: only its process can
  // release it. Without -force, OpenTofu says so; with it, a new process holds
  // no lock to release (statemgr.Filesystem.Unlock).
  out.diag(flag(opts, 'force', false) ? sourceless('error', 'Failed to unlock state: LocalState not locked') : sourceless('error', 'State locked by another local process', 'Local state cannot be unlocked by another process.'), {});
  done({ ok: false });
  return finish(1);
}

// ——— For the story's checks ———

/** The configuration's planned values (variables from the files only), without running anything. */
export function desired(game: Shell, dir: string): Record<string, Record<string, Value>> | null {
  const { config, diagnostics } = loadConfig(game, dir);
  if (diagnostics.length || validate(config).length) return null;
  const { vars, diagnostics: v } = variableValues(game, config, []);
  if (v.some((x) => x.severity === 'error')) return null;
  const scope: Scope = { vars, config, resources: {} };
  const out: Record<string, Record<string, Value>> = {};
  for (const [address, r] of Object.entries(config.resources)) {
    const p = plannedValues(r, scope, null);
    if (Object.values(p).some((x) => isUnknown(x) && x !== p.id)) return null;
    out[address] = Object.fromEntries(Object.entries(p).filter(([k]) => k !== 'id')) as Record<string, Value>;
  }
  return out;
}

/** Every *.tf file of the directory is as `tofu fmt` would write it. */
export function formatted(game: Shell, dir: string): boolean {
  const n = game.find(dir);
  if (n?.type !== 'directory') return false;
  return Object.keys(n.children)
    .filter((x) => x.endsWith('.tf'))
    .every((x) => {
      const src = game.read(`${dir}/${x}`) ?? '';
      return parse(src, x).diagnostics.length === 0 && format(src) === src;
    });
}

export { readRecord as providerRead, fqdnOf };
export type { Attribute };
