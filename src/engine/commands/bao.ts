// The `bao` command, OpenBao's CLI (2.7), on the story's server (openbao.ts):
// status, operator unseal/init/seal, login, token create/lookup/revoke/
// capabilities/renew, policy list/read/write/delete, kv get/put/patch/list/
// metadata get/rollback, read, write, list, audit list, secrets list,
// version. Its output follows the CLI's table formatter (columnize, "Key
// Value" headers, n/a for empty cells, <nil>, Go's %v and %q), its flags Go's
// flag package (before the positional arguments, or ignored with OpenBao's
// warning), its exit codes (1 usage, 2 API error or sealed, 127 help).
// The address comes from BAO_ADDR (or VAULT_ADDR, https://127.0.0.1:8200 by
// default), the token from BAO_TOKEN (or VAULT_TOKEN), then ~/.vault-token
// (the token helper's file, written by bao login).
// Messages after OpenBao v2.7.3's internal/command (status.go, format.go,
// base_helpers.go, operator_unseal.go, kv_*.go, token_*.go, policy_*.go,
// login.go, audit_list.go); see docs/ACCURACY.md.
// Docs: https://openbao.org/docs/commands/.
// Differences: the table format only (-format=json prints the data as JSON,
// without every field of the real response); no -output-curl-string,
// namespaces, wrapping, other auth methods nor engines; the subcommands not
// modelled are left out of the help.

import type { Context } from './index';
import type { Shell } from '../shell';
import { f } from '../world';
import {
  ADDRESS,
  VERSION,
  COMMIT_DATE,
  apiError,
  bao,
  humanDuration,
  lookupData,
  parseDuration,
  parsePolicy,
  refusedText,
  request,
  ttlLeft,
  uuidOf,
  type BaoToken,
  type Request,
  type Response,
} from '../openbao';

// ——— Output: columnize, as the CLI uses it ———

/** Rows of cells (split on "|"), padded to each column's width and glued with four spaces; empty: n/a. */
export function columnize(rows: string[][]): string {
  const cells = rows.map((r) => r.map((c) => c.trim() || 'n/a'));
  const widths: number[] = [];
  for (const r of cells) r.forEach((c, i) => (widths[i] = Math.max(widths[i] ?? 0, [...c].length)));
  return cells.map((r) => r.map((c, i) => (i === r.length - 1 ? c : c + ' '.repeat(widths[i] - [...c].length))).join('    ').trimEnd()).join('\n');
}
/** tableOutput: the first row is the header, underlined with dashes. */
export function table(header: string[], rows: string[][]): string {
  return columnize([header, header.map((h) => '-'.repeat(h.length)), ...rows]);
}
/** Go's %v of a JSON value, as the CLI prints a field. */
export function goValue(v: unknown): string {
  if (v === null || v === undefined) return '<nil>';
  if (Array.isArray(v)) return `[${v.map(goValue).join(' ')}]`;
  if (typeof v === 'object')
    return `map[${Object.keys(v as object)
      .sort()
      .map((k) => `${k}:${goValue((v as Record<string, unknown>)[k])}`)
      .join(' ')}]`;
  return String(v);
}
const quoted = (xs: string[]) => `[${xs.map((x) => JSON.stringify(x)).join(' ')}]`;
const looksLikeDuration = (k: string) => k === 'period' || k.endsWith('_period') || k === 'ttl' || k.endsWith('_ttl') || k === 'duration' || k.endsWith('_duration') || k === 'lease_max' || k === 'ttl_max';
/** A map as "Key Value" rows (sorted), durations made human. */
export function mapTable(data: Record<string, unknown>): string {
  const rows = Object.keys(data)
    .sort()
    .map((k) => {
      const v = data[k];
      return [k, looksLikeDuration(k) && typeof v === 'number' ? humanDuration(v) : goValue(v)];
    });
  return table(['Key', 'Value'], rows);
}
/** The "==== Header ====" above a map (getHeaderForMap, padEqualSigns). */
export function headerFor(title: string, keys: string[]) {
  const total = Math.max(0, ...keys.map((k) => k.length)) + 4 + 5;
  return padEqual(title, total);
}
function padEqual(title: string, total: number) {
  let n = total - (title.length + 2);
  if (n <= 0) n = 4;
  if (n % 2) n++;
  return `${'='.repeat(n / 2)} ${title} ${'='.repeat(n / 2)}`;
}
/** The token part of a secret (login, token create). */
function authTable(g: Shell, t: BaoToken): string {
  const left = ttlLeft(g, t);
  return table(
    ['Key', 'Value'],
    [
      ['token', t.id],
      ['token_accessor', t.accessor],
      ['token_duration', left === null ? '∞' : humanDuration(left)],
      ['token_renewable', String(!!t.ttl)],
      ['token_policies', quoted(t.policies)],
      ['identity_policies', '[]'],
      ['policies', quoted(t.policies)],
    ],
  );
}

/** -format=json: the data as the API's JSON (a reduced response). */
function jsonOf(g: Shell, data: unknown, auth?: BaoToken): string {
  const b = bao(g)!;
  const secret = {
    request_id: uuidOf(`json:${b.seq++}`),
    lease_id: '',
    lease_duration: 0,
    renewable: false,
    data: auth ? null : data,
    warnings: null,
    ...(auth ? { auth: { client_token: auth.id, accessor: auth.accessor, policies: auth.policies, token_policies: auth.policies, lease_duration: ttlLeft(g, auth) ?? 0, renewable: !!auth.ttl } } : {}),
  };
  return JSON.stringify(secret, null, 2);
}

// ——— Flags (Go's flag package) ———

interface Spec {
  bools?: string[];
  values?: string[];
  // Flags that may be repeated (-policy).
  multi?: string[];
}
interface Flags {
  values: Record<string, string>;
  multi: Record<string, string[]>;
  args: string[];
  warning?: string;
  error?: string;
}
// The flags every command takes (the HTTP options and output options).
const GLOBAL_VALUES = ['address', 'format', 'namespace', 'ns', 'ca-cert', 'ca-path', 'client-cert', 'client-key', 'tls-server-name', 'wrap-ttl', 'header', 'mfa'];
const GLOBAL_BOOLS = ['tls-skip-verify', 'non-interactive', 'output-curl-string', 'output-policy', 'detailed', 'disable-redirects', 'policy-override'];
const TRAILING_GLOBAL = ['output-curl-string', 'output-policy', 'format', 'detailed'];

function parseFlags(args: string[], spec: Spec): Flags {
  const values: Record<string, string> = {};
  const multi: Record<string, string[]> = {};
  const bools = [...(spec.bools ?? []), ...GLOBAL_BOOLS];
  const vals = [...(spec.values ?? []), ...(spec.multi ?? []), ...GLOBAL_VALUES];
  let i = 0;
  for (; i < args.length; i++) {
    const a = args[i];
    if (a === '--') {
      i++;
      break;
    }
    if (!a.startsWith('-') || a === '-') break;
    const m = /^--?([^=]+)(?:=(.*))?$/.exec(a);
    if (!m) break;
    const [, name, inline] = m;
    if (bools.includes(name)) {
      if (inline !== undefined && !/^(1|0|t|f|T|F|true|false|TRUE|FALSE|True|False)$/.test(inline)) return { values, multi, args: [], error: `invalid boolean value "${inline}" for -${name}: parse error` };
      values[name] = inline === undefined ? 'true' : String(/^(1|t|T|true|TRUE|True)$/.test(inline));
      continue;
    }
    if (vals.includes(name)) {
      let v = inline;
      if (v === undefined) {
        if (i + 1 >= args.length) return { values, multi, args: [], error: `flag needs an argument: -${name}` };
        v = args[++i];
      }
      if (spec.multi?.includes(name)) (multi[name] ??= []).push(...v.split(',').map((x) => x.trim()).filter(Boolean));
      else values[name] = v;
      continue;
    }
    if (name === 'h' || name === 'help') return { values: { help: 'true' }, multi, args: [] };
    return { values, multi, args: [], error: `flag provided but not defined: -${name}` };
  }
  const rest = args.slice(i);
  const trailing = rest.filter((a) => a.startsWith('-') && a !== '-' && !TRAILING_GLOBAL.includes(a.replace(/^-+/, '').split('=')[0]));
  const warning = trailing.length ? `Command flags must be provided before positional arguments. The following arguments will not be parsed as flags: [${trailing.join(',')}]` : undefined;
  return { values, multi, args: rest, warning };
}

// ——— The commands' help ———

const ROOT_HELP = `Usage: bao <command> [args]

Common commands:
    read        Read data and retrieves secrets
    write       Write data, configuration, and secrets
    delete      Delete secrets and configuration
    list        List data or secrets
    login       Authenticate locally
    agent       Start an OpenBao agent
    server      Start an OpenBao server
    status      Print seal and HA status
    unwrap      Unwrap a wrapped secret

Other commands:
    audit                Interact with audit devices
    auth                 Interact with auth methods
    debug                Runs the debug command
    kv                   Interact with OpenBao's Key-Value storage
    lease                Interact with leases
    monitor              Stream log messages from an OpenBao server
    namespace            Interact with namespaces
    operator             Perform operator-specific tasks
    patch                Patch data, configuration, and secrets
    path-help            Retrieve API help for paths
    pki                  Interact with OpenBao's PKI Secrets Engine
    plugin               Interact with OpenBao plugins and catalog
    policy               Interact with policies
    print                Prints runtime configurations
    proxy                Start an OpenBao Proxy
    secrets              Interact with secrets engines
    ssh                  Initiate an SSH session
    token                Interact with tokens
    transit              Interact with OpenBao's Transit Secrets Engine
    version              Prints the OpenBao CLI version
    version-history      Prints the version history of the target Vault server`;

const GROUPS: Record<string, { help: string; subs: [string, string][] }> = {
  operator: {
    help: 'This command groups subcommands for operators interacting with OpenBao. Most\n  users will not need to interact with these commands.',
    subs: [
      ['init', 'Initializes a server'],
      ['seal', 'Seals the OpenBao server'],
      ['unseal', 'Unseals the OpenBao server'],
    ],
  },
  token: {
    help: 'This command groups subcommands for interacting with tokens. Users can\n  create, lookup, renew, and revoke tokens.',
    subs: [
      ['capabilities', 'Print capabilities of a token on a path'],
      ['create', 'Create a new token'],
      ['lookup', 'Display information about a token'],
      ['renew', 'Renew a token lease'],
      ['revoke', 'Revoke a token and its children'],
    ],
  },
  policy: {
    help: 'This command groups subcommands for interacting with policies.\n  Users can write, read, and list policies in OpenBao.',
    subs: [
      ['delete', 'Deletes a policy by name'],
      ['list', 'Lists the installed policies'],
      ['read', 'Prints the contents of a policy'],
      ['write', 'Uploads a named policy from a file'],
    ],
  },
  kv: {
    help: "This command has subcommands for interacting with OpenBao's key-value\n  store. Here are some simple examples, and more detailed examples are\n  available in the subcommands or the documentation.",
    subs: [
      ['get', 'Retrieves data from the KV store'],
      ['list', 'List data or secrets'],
      ['metadata', "Interact with OpenBao's Key-Value storage"],
      ['patch', 'Sets or updates data in the KV store without overwriting'],
      ['put', 'Sets or updates data in the KV store'],
      ['rollback', 'Rolls back to a previous version of data'],
    ],
  },
  audit: {
    help: 'This command groups subcommands for interacting with OpenBao\'s audit devices.\n  Users can list, enable, and disable audit devices.',
    subs: [['list', 'Lists enabled audit devices']],
  },
  secrets: {
    help: "This command groups subcommands for interacting with OpenBao's secrets\n  engines. Each secret engine behaves differently. Please see the\n  documentation for more information.",
    subs: [['list', 'List enabled secrets engines']],
  },
};
function groupHelp(name: string): string {
  const g = GROUPS[name];
  const w = Math.max(...g.subs.map(([s]) => s.length));
  return `Usage: bao ${name} <subcommand> [options] [args]\n\n  ${g.help}\n\nSubcommands:\n${g.subs.map(([s, d]) => `    ${s.padEnd(w)}    ${d}`).join('\n')}`;
}
const USAGE: Record<string, string> = {
  status: 'Usage: bao status [options]\n\n  Prints the current state of OpenBao including whether it is sealed and if HA\n  mode is enabled. This command prints regardless of whether the OpenBao is\n  sealed.\n\n  The exit code reflects the seal status:\n\n      - 0 - unsealed\n      - 1 - error\n      - 2 - sealed',
  'operator unseal': 'Usage: bao operator unseal [options] [KEY]\n\n  Provide a portion of the root key to unseal an OpenBao server. OpenBao starts\n  in a sealed state. It cannot perform operations until it is unsealed. This\n  command accepts a portion of the root key (an "unseal key").\n\n  The unseal key can be supplied as an argument to the command, but this is\n  not recommended as the unseal key will be available in your history:\n\n      $ bao operator unseal IXyR0OJnSFobekZMMCKCoVEpT7wI6l+USMzE3IcyDyo=\n\n  Instead, run the command with no arguments and it will prompt for the key:\n\n      $ bao operator unseal\n      Key (will be hidden): IXyR0OJnSFobekZMMCKCoVEpT7wI6l+USMzE3IcyDyo=\n\n  Command Options:\n\n  -reset\n      Discard any previously entered keys to the unseal process.',
  'operator init': 'Usage: bao operator init [options]\n\n  Initializes an OpenBao server. Initialization is the process by which\n  OpenBao\'s storage backend is prepared to receive data. Since OpenBao servers\n  share the same storage backend in HA mode, you only need to initialize one\n  OpenBao to initialize the storage backend.\n\n  This command cannot be run against an already-initialized OpenBao cluster.',
  'operator seal': 'Usage: bao operator seal [options]\n\n  Seals the OpenBao server. Sealing tells the OpenBao server to stop\n  responding to any operations until it is unsealed. When sealed, the OpenBao\n  server discards its in-memory root key to unlock the data, so it is\n  physically blocked from responding to operations unsealed.',
  login: 'Usage: bao login [options] [AUTH K=V...]\n\n  Authenticates users or machines to OpenBao using the provided arguments. A\n  successful authentication results in an OpenBao token - conceptually similar\n  to a session token on a website. By default, this token is cached on the\n  local machine for future requests.\n\n  The default auth method is "token". If not supplied via the CLI,\n  OpenBao will prompt for input. If the argument is "-", the values are read\n  from stdin.',
  'token create': 'Usage: bao token create [options]\n\n  Creates a new token that can be used for authentication. This token will be\n  created as a child of the currently authenticated token. The generated token\n  will inherit all policies and permissions of the currently authenticated\n  token unless you explicitly define a subset list policies to assign to the\n  token.\n\n  Command Options:\n\n  -display-name=<string>, -explicit-max-ttl=<duration>, -metadata=<k=v>,\n  -no-default-policy, -orphan, -period=<duration>, -policy=<string>,\n  -renewable, -ttl=<duration>, -type=<string>, -use-limit=<int>',
  'token lookup': 'Usage: bao token lookup [options] [TOKEN | ACCESSOR]\n\n  Displays information about a token or accessor. If a TOKEN is not provided,\n  the locally authenticated token is used.\n\n  Command Options:\n\n  -accessor\n      Treat the argument as an accessor instead of a token.',
  'token revoke': 'Usage: bao token revoke [options] [TOKEN | ACCESSOR]\n\n  Revokes authentication tokens and their children. If a TOKEN is not provided,\n  the locally authenticated token is used. The "-mode" flag can be used to\n  control the behavior of the revocation.\n\n  Command Options:\n\n  -accessor\n      Treat the argument as an accessor instead of a token.\n\n  -self\n      Perform the revocation on the currently authenticated token.',
  'token capabilities': 'Usage: bao token capabilities [options] [TOKEN] PATH\n\n  Fetches the capabilities of a token for a given path. If a TOKEN is provided\n  as an argument, the "/sys/capabilities" endpoint and permission is used. If\n  no TOKEN is provided, the "/sys/capabilities-self" endpoint and permission\n  is used with the locally authenticated token.',
  'token renew': 'Usage: bao token renew [options] [TOKEN]\n\n  Renews a token\'s lease, extending the amount of time it can be used. If a\n  TOKEN is not provided, the locally authenticated token is used.',
  'policy write': 'Usage: bao policy write [options] NAME PATH\n\n  Uploads a policy with name NAME from the contents of a local file PATH or\n  stdin. If PATH is "-", the policy is read from stdin. Otherwise, it is\n  loaded from the file at the given path on the local disk.',
  'policy read': 'Usage: bao policy read [options] [NAME]\n\n  Prints the contents and metadata of the OpenBao policy named NAME. If the\n  policy does not exist, an error is returned.',
  'policy list': 'Usage: bao policy list [options]\n\n  Lists the names of the policies that are installed on the OpenBao server.',
  'policy delete': 'Usage: bao policy delete [options] NAME\n\n  Deletes the policy named NAME in the OpenBao server. Once the policy is\n  deleted, all tokens associated with the policy are affected immediately.',
  'kv get': 'Usage: bao kv get [options] KEY\n\n  Retrieves the value from OpenBao\'s key-value store at the given key name. If no\n  key exists with that name, an error is returned. If a key exists with that\n  name but has no data, nothing is returned.\n\n      $ bao kv get -mount=secret foo\n\n  Command Options:\n\n  -mount=<string>, -version=<int>, -field=<string>',
  'kv put': 'Usage: bao kv put [options] KEY [DATA]\n\n  Writes the data to the given path in the key-value store. The data can be of\n  any type.\n\n      $ bao kv put -mount=secret foo bar=baz\n\n  Command Options:\n\n  -mount=<string>, -cas=<int>',
  'kv patch': 'Usage: bao kv patch [options] KEY [DATA]\n\n  *NOTE*: This is only supported for KV v2 engine mounts.\n\n  Writes the data to the corresponding path in the key-value store. The data can be of\n  any type.\n\n      $ bao kv patch -mount=secret foo bar=baz\n\n  Command Options:\n\n  -mount=<string>, -remove-data=<string>',
  'kv list': 'Usage: bao kv list [options] PATH\n\n  Lists data from OpenBao\'s key-value store at the given path.\n\n      $ bao kv list -mount=secret my-app/',
  'kv rollback': 'Usage: bao kv rollback [options] KEY\n\n  *NOTE*: This is only supported for KV v2 engine mounts.\n\n  Restores a given previous version to the current version at the given path.\n  The value is written as a new version; for instance, if the current version\n  is 5 and the rollback version is 2, the data from version 2 will become\n  version 6.\n\n      $ bao kv rollback -mount=secret -version=2 foo',
  'kv metadata get': 'Usage: bao kv metadata get [options] KEY\n\n  Retrieves the metadata from OpenBao\'s key-value store at the given key name. If no\n  key exists with that name, an error is returned.\n\n      $ bao kv metadata get -mount=secret foo',
  read: 'Usage: bao read [options] PATH\n\n  Reads data from OpenBao at the given path. This can be used to read secrets,\n  generate dynamic credentials, get configuration details, and more.',
  write: 'Usage: bao write [options] PATH [DATA K=V...]\n\n  Writes data to OpenBao at the given path. The data can be credentials, secrets,\n  configuration, or arbitrary data. The specific behavior of this command is\n  determined at the thing mounted at the path.',
  list: 'Usage: bao list [options] PATH\n\n  Lists data from OpenBao at the given path. This can be used to list keys in a,\n  given secret engine.',
  'audit list': 'Usage: bao audit list [options]\n\n  Lists the enabled audit devices in the OpenBao server. The output lists the\n  enabled audit devices and the options for those devices.\n\n  Command Options:\n\n  -detailed\n      Print detailed information such as options and replication status about\n      each auth device.',
  'secrets list': 'Usage: bao secrets list [options]\n\n  Lists the enabled secret engines on the OpenBao server. This command also\n  outputs information about the enabled path including configured TTLs and\n  human-friendly descriptions. A TTL of "system" indicates that the system\n  default is in use.',
  version: 'Usage: bao version\n\n  Prints the version of this OpenBao CLI. This does not print the target\n  OpenBao server version.',
};

// ——— The client ———

interface Client {
  game: Shell;
  address: string;
  token: string | undefined;
  format: string;
  out: string[];
  err: string[];
}

/** BAO_ADDR, then VAULT_ADDR. */
function env(g: Shell, name: string): string | undefined {
  const e = { ...g.exportedVars(), ...g.environment };
  return e[`BAO_${name}`] ?? e[`VAULT_${name}`];
}
/** The token helper's file: ~/.vault-token of whoever runs the command. */
export function tokenFile(g: Shell): string {
  const who = g.who;
  if (who === 'root') return '/root/.vault-token';
  return `${g.accounts.users[who]?.home ?? `/home/${who}`}/.vault-token`;
}
function readTokenFile(g: Shell): string | undefined {
  const path = tokenFile(g);
  const n = g.find(path);
  if (n?.type !== 'file' || !g.can(n, 'r')) return undefined;
  return (g.read(path) ?? '').trim() || undefined;
}

/** A request through the address the client uses; null and an error printed when it can't be sent. */
function call(c: Client, req: Request): Response | { transport: string } {
  const addr = c.address.replace(/\/+$/, '');
  const m = /^(https?):\/\/([^/:]+)(?::(\d+))?$/.exec(addr);
  const method = req.method === 'LIST' ? 'GET' : req.method;
  const url = `${addr}/v1/${req.path}${req.method === 'LIST' ? '?list=true' : ''}`;
  const verb = method[0] + method.slice(1).toLowerCase();
  if (!m) return { transport: `parse "${addr}": first path segment in URL cannot contain colon` };
  const host = m[2];
  const port = m[3] ?? (m[1] === 'https' ? '443' : '80');
  const local = ['127.0.0.1', 'localhost', c.game.principal.hostName, `${c.game.principal.hostName}.internal`].includes(host);
  if (!local) return { transport: `${verb} "${url}": dial tcp: lookup ${host} on 127.0.0.53:53: no such host` };
  if (port !== '8200') return { transport: `${verb} "${url}": dial tcp ${host === 'localhost' ? '[::1]' : '127.0.0.1'}:${port}: connect: connection refused` };
  // Plain HTTP to the TLS listener: Go's server answers 400 before OpenBao sees anything.
  if (m[1] === 'http') {
    const up = request(c.game, { method: 'GET', path: 'sys/leader' });
    if (up.refused) return { transport: `${verb} "${url}": dial tcp 127.0.0.1:8200: connect: connection refused` };
    return { transport: `Error making API request.\n\nURL: ${method} ${url}\nCode: 400. Raw Message:\n\nClient sent an HTTP request to an HTTPS server.\n` };
  }
  const r = request(c.game, { ...req, token: req.token ?? c.token });
  if (r.refused) return { transport: refusedText(req.path, req.method) };
  return r;
}
/** The error text of a failed request (transport or API). */
function failure(c: Client, req: Request, r: Response | { transport: string }): string | null {
  if ('transport' in r) return r.transport;
  if (r.status >= 400) return apiError(req.method, req.path, r).replace(ADDRESS, c.address.replace(/\/+$/, ''));
  return null;
}

// ——— The entry ———

export function baoCommand(ctx: Context): string {
  const game = ctx.game;
  const args = [...ctx.args];
  const c: Client = { game, address: env(game, 'ADDR') ?? ADDRESS, token: env(game, 'TOKEN') ?? readTokenFile(game), format: env(game, 'FORMAT') ?? 'table', out: [], err: [] };
  const finish = (code: number) => {
    if (c.err.length) game.error(c.err.join('\n'), code || 1);
    else if (code) game.status = code;
    return c.out.join('\n');
  };
  if (!args.length) {
    c.err.push(ROOT_HELP);
    return finish(127);
  }
  const first = args.shift()!;
  if (/^--?(h|help)$/.test(first)) {
    c.err.push(ROOT_HELP);
    return finish(0);
  }
  if (/^--?(v|version)$/.test(first)) return versionText();
  // A group (token, kv, operator…) and its subcommand.
  let name = first;
  if (GROUPS[first]) {
    const sub = args[0];
    if (!sub || sub.startsWith('-')) {
      c.err.push(groupHelp(first));
      return finish(127);
    }
    args.shift();
    if (first === 'kv' && sub === 'metadata') {
      if (args[0] !== 'get') {
        c.err.push('Usage: bao kv metadata <subcommand> [options] [args]\n\n  This command has subcommands for interacting with the metadata endpoint in\n  OpenBao\'s key-value store.\n\nSubcommands:\n    get    Retrieves key metadata from the KV store');
        return finish(127);
      }
      args.shift();
      name = 'kv metadata get';
    } else if (!GROUPS[first].subs.some(([s]) => s === sub)) {
      c.err.push(groupHelp(first));
      return finish(127);
    } else name = `${first} ${sub}`;
  }
  const handler = HANDLERS[name];
  if (!handler) {
    c.err.push(ROOT_HELP);
    return finish(127);
  }
  const fl = parseFlags(args, handler.spec);
  if (fl.values.help) {
    c.err.push(USAGE[name] ?? ROOT_HELP);
    return finish(0);
  }
  if (fl.error) {
    c.err.push(fl.error);
    return finish(1);
  }
  if (fl.warning && (fl.values.format ?? c.format) === 'table') c.err.push(fl.warning);
  if (fl.values.address) c.address = fl.values.address;
  if (fl.values.format) c.format = fl.values.format;
  if (!['table', 'json', 'yaml', 'pretty', 'raw'].includes(c.format)) {
    c.err.push(`Invalid output format: ${c.format}`);
    return finish(1);
  }
  return finish(handler.run(c, fl, ctx));
}

function versionText() {
  return `OpenBao v${VERSION} (6dc9a6a7c1d6ce0d1c4b54e3a64a9b8f4e2d1c20), committed ${COMMIT_DATE}`;
}

interface Handler {
  spec: Spec;
  run: (c: Client, fl: Flags, ctx: Context) => number;
}

const tooMany = (c: Client, expected: string, got: number) => (c.err.push(`Too many arguments (expected ${expected}, got ${got})`), 1);
const notEnough = (c: Client, expected: string, got: number) => (c.err.push(`Not enough arguments (expected ${expected}, got ${got})`), 1);

/** The seal status as the CLI prints it (bao status, unseal). */
function statusTable(c: Client, d: Record<string, unknown>): string {
  const rows: string[][] = [
    ['Seal Type', String(d.type)],
    ['Initialized', String(d.initialized)],
    ['Sealed', String(d.sealed)],
    ['Total Shares', String(d.n)],
    ['Threshold', String(d.t)],
  ];
  if (d.sealed) {
    rows.push(['Unseal Progress', `${d.progress}/${d.t}`]);
    rows.push(['Unseal Nonce', String(d.nonce ?? '')]);
  }
  rows.push(['Version', String(d.version)], ['Commit Date', String(d.commit_date)], ['Storage Type', String(d.storage_type)]);
  if (d.cluster_name && d.cluster_id) rows.push(['Cluster Name', String(d.cluster_name)], ['Cluster ID', String(d.cluster_id)]);
  rows.push(['HA Enabled', 'false']);
  if (c.format === 'json') return JSON.stringify({ ...d, ha_enabled: false }, null, 2);
  return table(['Key', 'Value'], rows);
}

/** The KV v2 path of an argument (secret/foo or -mount=secret foo), after the preflight. */
function kvPath(c: Client, fl: Flags, raw: string, prefix: 'data' | 'metadata'): { full: string } | { code: number } {
  const mount = fl.values.mount?.replace(/^\/+|\/+$/g, '');
  const partial = raw.replace(/^\/+/, '');
  const asked = mount ? `${mount}/` : partial;
  const pre: Request = { method: 'GET', path: `sys/internal/ui/mounts/${asked}` };
  const r = call(c, pre);
  const e = failure(c, pre, r);
  if (e) {
    c.err.push(e);
    return { code: 2 };
  }
  const mountPath = String(((r as Response).data ?? {}).path ?? 'secret/');
  const rest = mount ? partial : partial.startsWith(mountPath) ? partial.slice(mountPath.length) : partial.replace(/^[^/]*\/?/, '');
  return { full: `${mountPath}${prefix}${rest ? `/${rest.replace(/\/+$/, '')}` : ''}` };
}

/** K=V arguments (and K=@file, K=- from stdin), like kvbuilder. */
function kvData(c: Client, items: string[], input: string | null): Record<string, string> | null {
  const data: Record<string, string> = {};
  for (const it of items) {
    const i = it.indexOf('=');
    if (i <= 0) {
      c.err.push(`Failed to parse K=V data: invalid key/value pair "${it}": format must be key=value`);
      return null;
    }
    let v = it.slice(i + 1);
    if (v === '-') v = (input ?? '').replace(/\n$/, '');
    else if (v.startsWith('@')) {
      const text = c.game.read(v.slice(1));
      if (text === null) {
        c.err.push(`Failed to parse K=V data: error reading file: open ${v.slice(1)}: no such file or directory`);
        return null;
      }
      v = text.replace(/\n$/, '');
    }
    data[it.slice(0, i)] = v;
  }
  return data;
}

const HANDLERS: Record<string, Handler> = {
  status: {
    spec: {},
    run(c, fl) {
      if (fl.args.length) return tooMany(c, '0', fl.args.length);
      const req: Request = { method: 'GET', path: 'sys/seal-status' };
      const r = call(c, req);
      const e = failure(c, req, r);
      if (e) {
        c.err.push(`Error checking seal status: ${e}`);
        return 1;
      }
      const d = (r as Response).data!;
      c.out.push(statusTable(c, d));
      return d.sealed ? 2 : 0;
    },
  },
  'operator unseal': {
    spec: { bools: ['reset', 'migrate'] },
    run(c, fl) {
      if (fl.args.length > 1) return tooMany(c, '1', fl.args.length);
      const send = (data: Record<string, unknown>) => {
        const req: Request = { method: 'PUT', path: 'sys/unseal', data };
        const r = call(c, req);
        const e = failure(c, req, r);
        if (e) {
          c.err.push(`${data.reset ? 'Error resetting unseal process' : 'Error unsealing'}: ${e}`);
          return 2;
        }
        c.out.push(statusTable(c, (r as Response).data!));
        return 0;
      };
      if (fl.values.reset === 'true') return send({ reset: true });
      if (fl.args.length) return send({ key: fl.args[0].trim() });
      if (fl.values['non-interactive'] === 'true') {
        c.err.push('Refusing to read from stdin with -non-interactive specified; specify unseal\nkey as an argument to this command');
        return 1;
      }
      // The prompt: the key is typed without echo; the rest happens on the answer.
      const g = c.game;
      g.ask(
        'Unseal Key (will be hidden): ',
        (answer) => {
          const c2: Client = { ...c, out: [], err: [] };
          const code = (() => {
            const req: Request = { method: 'PUT', path: 'sys/unseal', data: { key: answer.trim() } };
            const r = call(c2, req);
            const e = failure(c2, req, r);
            if (e) {
              c2.err.push(`Error unsealing: ${e}`);
              return 2;
            }
            c2.out.push(statusTable(c2, (r as Response).data!));
            return 0;
          })();
          if (c2.err.length) g.error(c2.err.join('\n'), code);
          g.status = code;
          g.lastStatus = code;
          return c2.out.join('\n');
        },
        true,
      );
      return 0;
    },
  },
  'operator init': {
    spec: { bools: ['status'], values: ['key-shares', 'key-threshold', 'pgp-keys', 'root-token-pgp-key', 'recovery-shares', 'recovery-threshold'] },
    run(c, fl) {
      if (fl.args.length) return tooMany(c, '0', fl.args.length);
      const st: Request = { method: 'GET', path: 'sys/seal-status' };
      const r0 = call(c, st);
      const e0 = failure(c, st, r0);
      if (e0) {
        c.err.push(e0);
        return 2;
      }
      if (fl.values.status === 'true') {
        c.out.push('Vault is initialized');
        return 0;
      }
      const req: Request = { method: 'PUT', path: 'sys/init', data: {} };
      const r = call(c, req);
      c.err.push(`Error initializing: ${failure(c, req, r)}`);
      return 2;
    },
  },
  'operator seal': {
    spec: {},
    run(c, fl) {
      if (fl.args.length) return tooMany(c, '0', fl.args.length);
      const req: Request = { method: 'PUT', path: 'sys/seal' };
      const r = call(c, req);
      const e = failure(c, req, r);
      if (e) {
        c.err.push(`Error sealing: ${e}`);
        return 2;
      }
      c.out.push('Success! Vault is sealed.');
      return 0;
    },
  },
  version: {
    spec: {},
    run(c) {
      c.out.push(versionText());
      return 0;
    },
  },
  login: {
    spec: { values: ['method', 'path', 'field'], bools: ['no-store', 'no-print', 'token-only'] },
    run(c, fl, ctx) {
      const method = fl.values.method ?? 'token';
      if (method !== 'token') {
        c.err.push(`Unknown auth method: ${method}. Use "bao auth list" to see the complete list of auth methods. Additionally, some auth methods are only available via the HTTP API.`);
        return 1;
      }
      if (fl.args.length > 1) {
        c.err.push(`Error authenticating: invalid key/value pair "${fl.args[1]}": format must be key=value`);
        return 2;
      }
      const go = (c2: Client, raw: string): number => {
        const token = raw === '-' ? (ctx.input ?? '').trim() : raw.trim().replace(/^token=/, '');
        if (!token) {
          c2.err.push('Error authenticating: a token must be passed to auth, please view the help for more information');
          return 2;
        }
        const req: Request = { method: 'GET', path: 'auth/token/lookup-self', token };
        const r = call(c2, req);
        const e = failure(c2, req, r);
        if (e) {
          c2.err.push(`Error authenticating: error looking up token: ${e}`);
          return 2;
        }
        const t = bao(c2.game)!.tokens[token];
        const tokenOnly = fl.values['token-only'] === 'true';
        if (fl.values['no-store'] !== 'true' && !tokenOnly) {
          const g = c2.game;
          const path = tokenFile(g);
          const old = g.find(path);
          const problem = old ? (g.can(old, 'w') ? null : 'permission denied') : g.place('bao', path, f(token, { lines: true, owner: g.who, group: g.accounts.users[g.who]?.group ?? g.who, mode: 'rw-------' }));
          if (old && !problem && old.type === 'file') old.content = token;
          if (problem) {
            c2.err.push(`Error storing token: open ${path}: permission denied`);
            return 2;
          }
          if (env(g, 'TOKEN')) c2.err.push('WARNING! The BAO_TOKEN environment variable is set! The value of this\nvariable will take precedence; if this is unwanted please unset BAO_TOKEN or\nupdate its value accordingly.\n');
        } else if (!tokenOnly) c2.err.push('The token was not stored in token helper. Set the BAO_TOKEN environment\nvariable or pass the token below with each request to Vault.\n');
        if (fl.values['no-print'] === 'true') return 0;
        if (tokenOnly || fl.values.field === 'token') {
          c2.out.push(t.id);
          return 0;
        }
        c2.out.push('Success! You are now authenticated. The token information displayed below\nis already stored in the token helper. You do NOT need to run "bao login"\nagain. Future OpenBao requests will automatically use this token.\n');
        c2.out.push(authTable(c2.game, t));
        return 0;
      };
      if (fl.args.length) return go(c, fl.args[0]);
      const g = c.game;
      g.ask(
        'Token (will be hidden): ',
        (answer) => {
          const c2: Client = { ...c, out: [], err: [] };
          const code = go(c2, answer);
          if (c2.err.length) g.error(c2.err.join('\n'), code || 1);
          g.status = code;
          g.lastStatus = code;
          return c2.out.join('\n');
        },
        true,
      );
      return 0;
    },
  },
  'token create': {
    spec: { values: ['id', 'display-name', 'ttl', 'explicit-max-ttl', 'period', 'role', 'type', 'use-limit', 'entity-alias', 'field'], bools: ['orphan', 'no-default-policy', 'renewable'], multi: ['policy', 'metadata'] },
    run(c, fl) {
      if (fl.args.length) return tooMany(c, '0', fl.args.length);
      const data: Record<string, unknown> = {};
      for (const k of ['ttl', 'period', 'explicit-max-ttl'] as const) {
        if (fl.values[k] === undefined) continue;
        const d = parseDuration(fl.values[k]);
        if (d === null) {
          c.err.push(`invalid value "${fl.values[k]}" for flag -${k}: time: invalid duration "${fl.values[k]}"`);
          return 1;
        }
        data[k === 'explicit-max-ttl' ? 'explicit_max_ttl' : k] = d;
      }
      if (fl.multi.policy) data.policies = fl.multi.policy;
      if (fl.values['display-name']) data.display_name = fl.values['display-name'];
      if (fl.values.orphan === 'true') data.no_parent = true;
      if (fl.values['no-default-policy'] === 'true') data.no_default_policy = true;
      const req: Request = { method: 'POST', path: 'auth/token/create', data };
      const r = call(c, req);
      const e = failure(c, req, r);
      if (e) {
        c.err.push(`Error creating token: ${e}`);
        return 2;
      }
      const t = (r as Response).auth!.token;
      if (fl.values.field) {
        const v = { token: t.id, token_accessor: t.accessor }[fl.values.field];
        if (v === undefined) {
          c.err.push(`Field "${fl.values.field}" not present in secret`);
          return 1;
        }
        c.out.push(v);
        return 0;
      }
      c.out.push(c.format === 'json' ? jsonOf(c.game, null, t) : authTable(c.game, t));
      return 0;
    },
  },
  'token lookup': {
    spec: { bools: ['accessor'] },
    run(c, fl) {
      const acc = fl.values.accessor === 'true';
      if (acc && fl.args.length < 1) return notEnough(c, '1', fl.args.length);
      if (acc && fl.args.length > 1) {
        c.err.push(`Too many arguments with -accessor (expected 1, got ${fl.args.length})`);
        return 1;
      }
      if (fl.args.length > 1) return tooMany(c, '0-1', fl.args.length);
      const req: Request = acc
        ? { method: 'POST', path: 'auth/token/lookup-accessor', data: { accessor: fl.args[0] } }
        : fl.args.length
          ? { method: 'POST', path: 'auth/token/lookup', data: { token: fl.args[0] } }
          : { method: 'GET', path: 'auth/token/lookup-self' };
      const r = call(c, req);
      const e = failure(c, req, r);
      if (e) {
        c.err.push(`Error looking up token: ${e}`);
        return 2;
      }
      const d = (r as Response).data!;
      c.out.push(c.format === 'json' ? jsonOf(c.game, d) : mapTable(d));
      return 0;
    },
  },
  'token revoke': {
    spec: { bools: ['accessor', 'self'], values: ['mode'] },
    run(c, fl) {
      const self = fl.values.self === 'true';
      const acc = fl.values.accessor === 'true';
      if (self && fl.args.length) {
        c.err.push(`Too many arguments with -self (expected 0, got ${fl.args.length})`);
        return 1;
      }
      if (!self && fl.args.length > 1) {
        c.err.push(`Too many arguments (expected 1 or -self, got ${fl.args.length})`);
        return 1;
      }
      if (!self && !fl.args.length) {
        c.err.push('Not enough arguments (expected 1 or -self, got 0)');
        return 1;
      }
      if (self && acc) {
        c.err.push('Cannot use -self with -accessor!');
        return 1;
      }
      const req: Request = self
        ? { method: 'PUT', path: 'auth/token/revoke-self' }
        : acc
          ? { method: 'PUT', path: 'auth/token/revoke-accessor', data: { accessor: fl.args[0] } }
          : { method: 'PUT', path: 'auth/token/revoke', data: { token: fl.args[0] } };
      const r = call(c, req);
      const e = failure(c, req, r);
      if (e) {
        c.err.push(`Error revoking token: ${e}`);
        return 2;
      }
      c.out.push('Success! Revoked token (if it existed)');
      return 0;
    },
  },
  'token renew': {
    spec: { values: ['increment'] },
    run(c, fl) {
      if (fl.args.length > 1) return tooMany(c, '0-1', fl.args.length);
      const req: Request = { method: 'PUT', path: 'auth/token/renew-self', token: fl.args[0] };
      const r = call(c, req);
      const e = failure(c, req, r);
      if (e) {
        c.err.push(`Error renewing token: ${e}`);
        return 2;
      }
      c.out.push(authTable(c.game, (r as Response).auth!.token));
      return 0;
    },
  },
  'token capabilities': {
    spec: {},
    run(c, fl) {
      if (!fl.args.length) {
        c.err.push('Not enough arguments (expected 1-2, got 0)');
        return 1;
      }
      if (fl.args.length > 2) return tooMany(c, '1-2', fl.args.length);
      const [token, path] = fl.args.length === 2 ? fl.args : [undefined, fl.args[0]];
      const req: Request = token ? { method: 'POST', path: 'sys/capabilities', data: { token, path } } : { method: 'POST', path: 'sys/capabilities-self', data: { path } };
      const r = call(c, req);
      const e = failure(c, req, r);
      if (e) {
        c.err.push(`Error listing capabilities: ${e}`);
        return 2;
      }
      const caps = ((r as Response).data!.capabilities as string[]).slice().sort();
      c.out.push(c.format === 'json' ? JSON.stringify(caps, null, 2) : caps.join(', '));
      return 0;
    },
  },
  'policy list': {
    spec: {},
    run(c, fl) {
      if (fl.args.length) return tooMany(c, '0', fl.args.length);
      const req: Request = { method: 'LIST', path: 'sys/policies/acl' };
      const r = call(c, req);
      const e = failure(c, req, r);
      if (e) {
        c.err.push(`Error listing policies: ${e}`);
        return 2;
      }
      c.out.push(...((r as Response).data!.keys as string[]));
      return 0;
    },
  },
  'policy read': {
    spec: {},
    run(c, fl) {
      if (!fl.args.length) return notEnough(c, '1', 0);
      if (fl.args.length > 1) return tooMany(c, '1', fl.args.length);
      const name = fl.args[0].trim().toLowerCase();
      const req: Request = { method: 'GET', path: `sys/policies/acl/${name}` };
      const r = call(c, req);
      if (!('transport' in r) && r.status === 404) {
        c.err.push(`No policy named: ${name}`);
        return 2;
      }
      const e = failure(c, req, r);
      if (e) {
        c.err.push(`Error reading policy named ${name}: ${e}`);
        return 2;
      }
      c.out.push(String((r as Response).data!.policy).trim());
      return 0;
    },
  },
  'policy write': {
    spec: {},
    run(c, fl, ctx) {
      if (fl.args.length < 2) return notEnough(c, '2', fl.args.length);
      if (fl.args.length > 2) return tooMany(c, '2', fl.args.length);
      const [name, file] = fl.args;
      let text: string | null;
      if (file === '-') text = ctx.input ?? '';
      else {
        const g = c.game;
        const n = g.find(file);
        if (!n) {
          c.err.push(`Error opening policy file: open ${file}: no such file or directory`);
          return 2;
        }
        if (n.type === 'directory') {
          c.err.push(`Error reading policy: read ${file}: is a directory`);
          return 2;
        }
        if (!g.traverses(file) || !g.can(n, 'r')) {
          c.err.push(`Error opening policy file: open ${file}: permission denied`);
          return 2;
        }
        text = g.read(file);
      }
      const formatted = name.trim().toLowerCase();
      const req: Request = { method: 'PUT', path: `sys/policies/acl/${formatted}`, data: { policy: text ?? '' } };
      const r = call(c, req);
      const e = failure(c, req, r);
      if (e) {
        c.err.push(`Error uploading policy: ${e}`);
        return 2;
      }
      if (formatted !== name) c.err.push(`Policy name was converted from "${name}" to "${formatted}"`);
      c.out.push(`Success! Uploaded policy: ${formatted}`);
      return 0;
    },
  },
  'policy delete': {
    spec: {},
    run(c, fl) {
      if (!fl.args.length) return notEnough(c, '1', 0);
      if (fl.args.length > 1) return tooMany(c, '1', fl.args.length);
      const name = fl.args[0].trim().toLowerCase();
      const req: Request = { method: 'DELETE', path: `sys/policies/acl/${name}` };
      const r = call(c, req);
      const e = failure(c, req, r);
      if (e) {
        c.err.push(`Error deleting ${name}: ${e}`);
        return 2;
      }
      c.out.push(`Success! Deleted policy: ${name}`);
      return 0;
    },
  },
  'kv get': {
    spec: { values: ['mount', 'version', 'field'] },
    run(c, fl) {
      if (!fl.args.length) return notEnough(c, '1', 0);
      if (fl.args.length > 1) return tooMany(c, '1', fl.args.length);
      const p = kvPath(c, fl, fl.args[0], 'data');
      if ('code' in p) return p.code;
      const version = Number(fl.values.version ?? 0);
      const req: Request = { method: 'GET', path: p.full, data: version ? { version } : undefined, query: version ? `?version=${version}` : '' };
      const r = call(c, req);
      if (!('transport' in r) && r.status === 404) {
        c.err.push(`No value found at ${p.full}`);
        return 2;
      }
      const e = failure(c, req, r);
      if (e) {
        c.err.push(`Error reading ${p.full}: ${e}`);
        return 2;
      }
      const d = (r as Response).data!;
      const data = d.data as Record<string, unknown>;
      const meta = d.metadata as Record<string, unknown>;
      if (fl.values.field) {
        if (!(fl.values.field in data)) {
          c.err.push(`Field "${fl.values.field}" not present in secret`);
          return 1;
        }
        c.out.push(String(data[fl.values.field]));
        return 0;
      }
      if (c.format === 'json') {
        c.out.push(jsonOf(c.game, d));
        return 0;
      }
      c.out.push(padEqual('Secret Path', p.full.length), p.full, '');
      c.out.push(headerFor('Metadata', Object.keys(meta)), mapTable(meta), '');
      c.out.push(headerFor('Data', Object.keys(data)), mapTable(data));
      return 0;
    },
  },
  'kv put': {
    spec: { values: ['mount', 'cas', 'field'] },
    run(c, fl, ctx) {
      if (fl.args.length < 1) return notEnough(c, '>1', fl.args.length);
      if (fl.args.length < 2) {
        c.err.push('Must supply data');
        return 1;
      }
      const data = kvData(c, fl.args.slice(1), ctx.input);
      if (!data) return 1;
      const p = kvPath(c, fl, fl.args[0], 'data');
      if ('code' in p) return p.code;
      return writeKv(c, p.full, { method: 'PUT', path: p.full, data: { data } });
    },
  },
  'kv patch': {
    spec: { values: ['mount', 'method', 'cas'], multi: ['remove-data'] },
    run(c, fl, ctx) {
      if (fl.args.length < 1) return notEnough(c, '>1', fl.args.length);
      if (fl.args.length < 2 && !fl.multi['remove-data']) {
        c.err.push('Must supply data');
        return 1;
      }
      const data: Record<string, string | null> | null = kvData(c, fl.args.slice(1), ctx.input);
      if (!data) return 1;
      for (const k of fl.multi['remove-data'] ?? []) data[k] = null;
      const p = kvPath(c, fl, fl.args[0], 'data');
      if ('code' in p) return p.code;
      const r = call(c, { method: 'PATCH', path: p.full, data: { data } });
      if (!('transport' in r) && r.status === 404) {
        c.err.push(`No value found at ${p.full}`);
        return 2;
      }
      return writeKv(c, p.full, { method: 'PATCH', path: p.full, data: { data } }, r);
    },
  },
  'kv rollback': {
    spec: { values: ['mount', 'version'] },
    run(c, fl) {
      if (fl.args.length !== 1) {
        c.err.push(`Invalid number of arguments (expected 1, got ${fl.args.length})`);
        return 1;
      }
      if (fl.values.version === undefined) {
        c.err.push('Version flag must be specified');
        return 1;
      }
      const version = Number(fl.values.version);
      if (!(version > 0)) {
        c.err.push(`Invalid value ${fl.values.version} for the version flag`);
        return 1;
      }
      const p = kvPath(c, fl, fl.args[0], 'data');
      if ('code' in p) return p.code;
      const read: Request = { method: 'GET', path: p.full, data: { version }, query: `?version=${version}` };
      const r = call(c, read);
      if (!('transport' in r) && r.status === 404) {
        c.err.push(`No value found at ${p.full}`);
        return 2;
      }
      const e = failure(c, read, r);
      if (e) {
        c.err.push(`Error doing pre-read at ${p.full}: ${e}`);
        return 2;
      }
      const data = (r as Response).data!.data as Record<string, string>;
      return writeKv(c, p.full, { method: 'PUT', path: p.full, data: { data } });
    },
  },
  'kv list': {
    spec: { values: ['mount'] },
    run(c, fl) {
      if (!fl.args.length && !fl.values.mount) return notEnough(c, '1', 0);
      if (fl.args.length > 1) return tooMany(c, '1', fl.args.length);
      const p = kvPath(c, fl, fl.args[0] ?? '', 'metadata');
      if ('code' in p) return p.code;
      const req: Request = { method: 'LIST', path: `${p.full}/` };
      const r = call(c, req);
      if (!('transport' in r) && r.status === 404) {
        c.err.push(`No value found at ${p.full}/`);
        return 2;
      }
      const e = failure(c, req, r);
      if (e) {
        c.err.push(`Error listing ${p.full}/: ${e}`);
        return 2;
      }
      c.out.push(table(['Keys'], ((r as Response).data!.keys as string[]).map((k) => [k])));
      return 0;
    },
  },
  'kv metadata get': {
    spec: { values: ['mount'] },
    run(c, fl) {
      if (!fl.args.length) return notEnough(c, '1', 0);
      if (fl.args.length > 1) return tooMany(c, '1', fl.args.length);
      const p = kvPath(c, fl, fl.args[0], 'metadata');
      if ('code' in p) return p.code;
      const req: Request = { method: 'GET', path: p.full };
      const r = call(c, req);
      if (!('transport' in r) && r.status === 404) {
        c.err.push(`No value found at ${p.full}`);
        return 2;
      }
      const e = failure(c, req, r);
      if (e) {
        c.err.push(`Error reading ${p.full}: ${e}`);
        return 2;
      }
      const { versions, ...meta } = (r as Response).data! as Record<string, unknown> & { versions: Record<string, Record<string, unknown>> };
      c.out.push(padEqual('Metadata Path', p.full.length), p.full, '');
      c.out.push(headerFor('Metadata', Object.keys(meta)), mapTable(meta));
      for (const v of Object.keys(versions).map(Number).sort((a, b) => a - b)) c.out.push(`\n${headerFor(`Version ${v}`, Object.keys(versions[v]))}`, mapTable(versions[v]));
      return 0;
    },
  },
  read: {
    spec: { values: ['field'] },
    run(c, fl) {
      if (!fl.args.length) return notEnough(c, '1', 0);
      const path = fl.args[0].replace(/^\/+/, '');
      const req: Request = { method: 'GET', path };
      const r = call(c, req);
      if (!('transport' in r) && r.status === 404) {
        c.err.push(`No value found at ${path}`);
        return 2;
      }
      const e = failure(c, req, r);
      if (e) {
        c.err.push(`Error reading ${path}: ${e}`);
        return 2;
      }
      const d = (r as Response).data!;
      if (fl.values.field) return printField(c, d, fl.values.field);
      c.out.push(c.format === 'json' ? jsonOf(c.game, d) : mapTable(d));
      return 0;
    },
  },
  list: {
    spec: {},
    run(c, fl) {
      if (!fl.args.length) return notEnough(c, '1', 0);
      const path = fl.args[0].replace(/^\/+/, '').replace(/\/?$/, '/');
      const req: Request = { method: 'LIST', path };
      const r = call(c, req);
      if (!('transport' in r) && r.status === 404) {
        c.err.push(`No value found at ${path}`);
        return 2;
      }
      const e = failure(c, req, r);
      if (e) {
        c.err.push(`Error listing ${path}: ${e}`);
        return 2;
      }
      c.out.push(table(['Keys'], ((r as Response).data!.keys as string[]).map((k) => [k])));
      return 0;
    },
  },
  write: {
    spec: { values: ['field'], bools: ['force'] },
    run(c, fl, ctx) {
      if (!fl.args.length) return notEnough(c, '1', 0);
      const path = fl.args[0].replace(/^\/+/, '');
      if (fl.args.length < 2 && fl.values.force !== 'true') {
        c.err.push('Must supply data or use -force');
        return 1;
      }
      const data = kvData(c, fl.args.slice(1), ctx.input);
      if (!data) return 1;
      // The KV v2 API takes its fields under "data".
      const body = /^secret\/data\//.test(path) ? { data } : data;
      const req: Request = { method: 'PUT', path, data: body };
      const r = call(c, req);
      const e = failure(c, req, r);
      if (e) {
        c.err.push(`Error writing data to ${path}: ${e}`);
        return 2;
      }
      const d = (r as Response).data;
      if (!d || (r as Response).status === 204) {
        c.out.push(`Success! Data written to: ${path}`);
        return 0;
      }
      if (fl.values.field) return printField(c, d, fl.values.field);
      c.out.push(c.format === 'json' ? jsonOf(c.game, d) : mapTable(d));
      return 0;
    },
  },
  'audit list': {
    spec: {},
    run(c, fl) {
      if (fl.args.length) return tooMany(c, '0', fl.args.length);
      const req: Request = { method: 'GET', path: 'sys/audit' };
      const r = call(c, req);
      const e = failure(c, req, r);
      if (e) {
        c.err.push(`Error listing audits: ${e}`);
        return 2;
      }
      const audits = (r as Response).data as Record<string, { type: string; path: string; description: string; options: Record<string, string> }>;
      if (!Object.keys(audits).length) {
        c.out.push('No audit devices are enabled.');
        return 0;
      }
      const paths = Object.keys(audits).sort();
      if (fl.values.detailed === 'true')
        c.out.push(table(['Path', 'Type', 'Description', 'Replication', 'Options'], paths.map((p) => [p, audits[p].type, audits[p].description, 'replicated', goValue(audits[p].options)])));
      else c.out.push(table(['Path', 'Type', 'Description'], paths.map((p) => [p, audits[p].type, audits[p].description])));
      return 0;
    },
  },
  'secrets list': {
    spec: {},
    run(c, fl) {
      if (fl.args.length) return tooMany(c, '0', fl.args.length);
      const req: Request = { method: 'GET', path: 'sys/mounts' };
      const r = call(c, req);
      const e = failure(c, req, r);
      if (e) {
        c.err.push(`Error listing secrets engines: ${e}`);
        return 2;
      }
      const m = (r as Response).data as Record<string, { type: string; accessor: string; description: string }>;
      c.out.push(table(['Path', 'Type', 'Accessor', 'Description'], Object.keys(m).sort().map((p) => [p, m[p].type, m[p].accessor, m[p].description === 'n/a' ? '' : m[p].description])));
      return 0;
    },
  },
};

function printField(c: Client, d: Record<string, unknown>, field: string): number {
  if (!(field in d)) {
    c.err.push(`Field "${field}" not present in secret`);
    return 1;
  }
  c.out.push(goValue(d[field]));
  return 0;
}

/** A KV write's answer: the secret's path, then its new version's metadata. */
function writeKv(c: Client, full: string, req: Request, done?: Response | { transport: string }): number {
  const r = done ?? call(c, req);
  const e = failure(c, req, r);
  if (e) {
    c.err.push(`Error writing data to ${full}: ${e}`);
    return 2;
  }
  const meta = (r as Response).data!;
  if (c.format === 'json') {
    c.out.push(jsonOf(c.game, meta));
    return 0;
  }
  c.out.push(padEqual('Secret Path', full.length), full, '');
  c.out.push(headerFor('Metadata', Object.keys(meta)), mapTable(meta));
  return 0;
}

// Used by the story: what a token's lookup shows.
export { lookupData };
