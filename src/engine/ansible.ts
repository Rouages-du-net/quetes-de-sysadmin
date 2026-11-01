// Ansible simulé : ansible.cfg, l'inventaire (format INI), les playbooks (YAML),
// et l'exécution sur les machines internes de l'histoire (Chapitre.hotes),
// jointes en ssh sans question (acces.ts : clé d'hôte connue, clé autorisée).
// Modules : ping, apt, copy, file, lineinfile, user, service/systemd,
// command, shell, debug (ansible.builtin). become, notify et handlers,
// --check, --diff, --limit, --syntax-check ; la sortie suit celle
// d'ansible-core (bannières PLAY/TASK, ok/changed/fatal, PLAY RECAP).
// D'après la documentation d'Ansible : https://docs.ansible.com/ansible/latest/
// (inventory_guide/intro_inventory.html, playbook_guide/, collections/ansible/builtin/).
// Écarts : YAML réduit (correspondances, listes, chaînes, blocs | et >,
// listes et dictionnaires sur une ligne) ; pas de rôles, de boucles, de
// conditions (when), de register ni de templates Jinja2 (seulement
// {{ variable }}) ; les faits (Gathering Facts) ne sont pas collectés.

import type { Shell } from './shell';
import { connectWithoutQuestion } from './access';
import { stop, start, reload, systemd } from './systemd';

export const VERSION = '2.18.6';

// ——— YAML ———

export type Value = string | Value[] | { [key: string]: Value };

export class YamlError extends Error {
  constructor(
    message: string,
    public line: number,
    public column: number,
  ) {
    super(message);
  }
}

interface YamlLine {
  number: number;
  indent: number;
  text: string;
  rawValue: string;
}

// Un # commence un commentaire en début de mot, hors guillemets.
function withoutComment(line: string): string {
  let quote: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") quote = c;
    else if (c === '#' && (i === 0 || /\s/.test(line[i - 1]))) return line.slice(0, i).trimEnd();
  }
  return line.trimEnd();
}

function scalar(raw: string, line: number, column: number): Value {
  const v = raw.trim();
  if (v.startsWith('[')) {
    if (!v.endsWith(']')) throw new YamlError("did not find expected ',' or ']'", line, column);
    return v
      .slice(1, -1)
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
      .map((x) => scalar(x, line, column));
  }
  if (v.startsWith('{')) {
    if (!v.endsWith('}')) throw new YamlError("did not find expected ',' or '}'", line, column);
    const object: Record<string, Value> = {};
    for (const chunk of v.slice(1, -1).split(',')) {
      const m = /^\s*([^:]+?)\s*:\s*(.*)$/.exec(chunk);
      if (m) object[m[1].replace(/^["']|["']$/g, '')] = scalar(m[2], line, column);
    }
    return object;
  }
  if ((v.startsWith('"') && v.endsWith('"') && v.length > 1) || (v.startsWith("'") && v.endsWith("'") && v.length > 1))
    return v.startsWith('"') ? v.slice(1, -1).replace(/\\n/g, '\n').replace(/\\"/g, '"') : v.slice(1, -1).replace(/''/g, "'");
  if (/^["']/.test(v)) throw new YamlError('found unexpected end of stream', line, column);
  if (v.startsWith('{{')) throw new YamlError('found unacceptable key (unhashable type)', line, column);
  return v;
}

/** Lit un YAML (le sous-ensemble des playbooks) ; lève ErreurYaml avec la ligne et la colonne. */
export function readYaml(text: string): Value {
  const raw = text.split('\n');
  raw.forEach((b, i) => {
    const t = /^\s*\t/.exec(b);
    if (t) throw new YamlError('found character that cannot start any token', i + 1, t[0].length);
  });
  let lines: YamlLine[] = raw
    .map((rawValue, i) => ({ number: i + 1, rawValue, text: withoutComment(rawValue) }))
    .filter((l) => l.text.trim() !== '' && l.text.trim() !== '---' && l.text.trim() !== '...')
    .map((l) => ({ ...l, indent: l.text.length - l.text.trimStart().length, text: l.text.trim() }));
  // Les blocs de texte (| et >) gardent leurs lignes telles quelles, commentaires compris.
  let i = 0;
  const textBlock = (style: string, keyIndent: number): string => {
    const start = lines[i - 1].number;
    const content: string[] = [];
    let indentation: number | null = null;
    const all = raw;
    let k = start; // index dans brutes (0-based) de la ligne suivante
    while (k < all.length) {
      const b = all[k];
      const r = b.length - b.trimStart().length;
      if (b.trim() === '') {
        content.push('');
        k++;
        continue;
      }
      if (r <= keyIndent) break;
      indentation ??= r;
      if (r < indentation) break;
      content.push(b.slice(indentation));
      k++;
    }
    while (content.length && content.at(-1) === '') content.pop();
    // Sauter les lignes consommées.
    while (i < lines.length && lines[i].number <= k) i++;
    const keep = style.includes('-') ? '' : '\n';
    const blockText = style.startsWith('>') ? content.join(' ').replace(/ {2,}/g, ' ') : content.join('\n');
    return blockText + keep;
  };
  const valueAfter = (rest: string, l: YamlLine, column: number, keyIndent: number): Value => {
    if (/^[|>][-+]?$/.test(rest)) return textBlock(rest, keyIndent);
    if (rest !== '' && /^[^"'[{][^#]*?:(\s|$)/.test(rest) && !/^https?:/.test(rest))
      throw new YamlError('mapping values are not allowed in this context', l.number, column + rest.indexOf(':') + 1);
    return scalar(rest, l.number, column);
  };
  const block = (indent: number): Value => {
    const first = lines[i];
    if (first.text === '-' || first.text.startsWith('- ')) {
      const listing: Value[] = [];
      while (i < lines.length && lines[i].indent === indent && (lines[i].text === '-' || lines[i].text.startsWith('- '))) {
        const l = lines[i];
        const rest = l.text.slice(1).trimStart();
        const column = indent + (l.text.length - rest.length);
        if (rest === '') {
          i++;
          listing.push(i < lines.length && lines[i].indent > indent ? block(lines[i].indent) : '');
        } else if (/^("[^"]*"|'[^']*'|[^\s"'[{][^:]*?):(\s|$)/.test(rest)) {
          // « - clé: valeur » : une correspondance, dont les autres clés sont alignées sur la première.
          lines[i] = { ...l, indent: column, text: rest };
          listing.push(block(column));
        } else {
          i++;
          listing.push(valueAfter(rest, l, column, indent));
        }
      }
      if (i < lines.length && lines[i].indent > indent) throw new YamlError("did not find expected '-' indicator", lines[i].number, lines[i].indent + 1);
      return listing;
    }
    const object: Record<string, Value> = {};
    while (i < lines.length && lines[i].indent === indent) {
      const l = lines[i];
      if (l.text.startsWith('- ')) throw new YamlError('did not find expected key', l.number, indent + 1);
      const m = /^("[^"]*"|'[^']*'|[^:]+?):(?:\s+(.*))?$/.exec(l.text);
      if (!m) throw new YamlError("could not find expected ':'", l.number + 1, 1);
      const key = m[1].replace(/^["']|["']$/g, '');
      i++;
      if (Object.hasOwn(object, key)) throw new YamlError(`found duplicate key "${key}"`, l.number, indent + 1);
      const rest = m[2] ?? '';
      if (rest !== '') object[key] = valueAfter(rest, l, indent + m[1].length + 2, indent);
      else if (i < lines.length && lines[i].indent > indent) object[key] = block(lines[i].indent);
      else if (i < lines.length && lines[i].indent === indent && lines[i].text.startsWith('- ')) object[key] = block(indent);
      else object[key] = '';
    }
    if (i < lines.length && lines[i].indent > indent) throw new YamlError('mapping values are not allowed in this context', lines[i].number, lines[i].indent + 1);
    return object;
  };
  if (!lines.length) return '';
  const root = block(lines[0].indent);
  if (i < lines.length) throw new YamlError('did not find expected key', lines[i].number, lines[i].indent + 1);
  lines = [];
  return root;
}

// ——— ansible.cfg et inventaire ———

export interface Config {
  inventory: string;
  user?: string;
  checkHostKey: boolean;
  file: string | null;
}

// INI : [section] puis « clé = valeur ».
function readIni(text: string): Record<string, Record<string, string>> {
  const sections: Record<string, Record<string, string>> = {};
  let current = '';
  for (const rawValue of text.split('\n')) {
    const l = rawValue.replace(/^\s*[#;].*$/, '').trim();
    if (!l) continue;
    const s = /^\[(.+)\]$/.exec(l);
    if (s) {
      current = s[1].trim();
      sections[current] ??= {};
      continue;
    }
    const m = /^([^=]+?)\s*=\s*(.*)$/.exec(l);
    if (m) (sections[current] ??= {})[m[1].trim().toLowerCase()] = m[2].trim();
  }
  return sections;
}

const yes = (v: string | undefined) => /^(yes|true|1|on)$/i.test(v ?? '');
const no = (v: string | undefined) => /^(no|false|0|off)$/i.test(v ?? '');

/** La configuration : ./ansible.cfg, puis ~/.ansible.cfg, puis /etc/ansible/ansible.cfg (la première trouvée). */
export function readConfig(game: Shell): Config {
  const file = [`${game.cwd}/ansible.cfg`, '~/.ansible.cfg', '/etc/ansible/ansible.cfg'].map((c) => game.resolve(c)).find((c) => game.find(c)?.type === 'file') ?? null;
  const ini = file ? readIni(game.read(file) ?? '') : {};
  const d = ini.defaults ?? {};
  const directory = file ? file.slice(0, file.lastIndexOf('/')) : game.cwd;
  const inv = d.inventory ? (d.inventory.startsWith('/') || d.inventory.startsWith('~') ? d.inventory : `${directory}/${d.inventory}`) : '/etc/ansible/hosts';
  return { inventory: game.resolve(inv), user: d.remote_user, checkHostKey: !no(d.host_key_checking), file };
}

export interface Inventory {
  hosts: Record<string, Record<string, string>>;
  groups: Record<string, string[]>;
  order: string[];
}

/** Un inventaire INI : [groupe], « hôte clé=valeur… », [groupe:vars], [groupe:children]. */
export function readInventory(text: string): Inventory {
  const inv: Inventory = { hosts: {}, groups: { all: [], ungrouped: [] }, order: [] };
  const variables: Record<string, Record<string, string>> = {};
  const children: Record<string, string[]> = {};
  let group = 'ungrouped';
  let mode: 'hosts' | 'vars' | 'children' = 'hosts';
  for (const rawValue of text.split('\n')) {
    const l = rawValue.replace(/(^|\s)[#;].*$/, '').trim();
    if (!l) continue;
    const s = /^\[([^\]:]+)(?::(vars|children))?\]$/.exec(l);
    if (s) {
      group = s[1];
      mode = (s[2] as 'vars' | 'children') ?? 'hosts';
      inv.groups[group] ??= [];
      continue;
    }
    if (mode === 'vars') {
      const m = /^([^=\s]+)\s*=\s*(.*)$/.exec(l);
      if (m) (variables[group] ??= {})[m[1]] = m[2];
      continue;
    }
    if (mode === 'children') {
      (children[group] ??= []).push(l);
      inv.groups[l] ??= [];
      continue;
    }
    const [name, ...vars] = l.split(/\s+/);
    inv.hosts[name] ??= {};
    for (const v of vars) {
      const m = /^([^=]+)=(.*)$/.exec(v);
      if (m) inv.hosts[name][m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
    if (!inv.order.includes(name)) inv.order.push(name);
    if (!inv.groups[group].includes(name)) inv.groups[group].push(name);
  }
  for (const [g, listing] of Object.entries(children)) for (const e of listing) for (const h of inv.groups[e] ?? []) if (!inv.groups[g].includes(h)) inv.groups[g].push(h);
  inv.groups.ungrouped = inv.groups.ungrouped.filter((h) => !Object.entries(inv.groups).some(([g, l]) => g !== 'ungrouped' && g !== 'all' && l.includes(h)));
  inv.groups.all = [...inv.order];
  // Les variables de groupe, sans écraser celles de l'hôte.
  for (const [g, vars] of Object.entries(variables))
    for (const h of g === 'all' ? inv.order : (inv.groups[g] ?? [])) inv.hosts[h] = { ...vars, ...inv.hosts[h] };
  return inv;
}

/** Les hôtes qui correspondent à un motif : all, un groupe, un hôte, plusieurs séparés par « , » ou « : », !exclusion. */
export function hostsFor(inv: Inventory, pattern: string): string[] {
  const result: string[] = [];
  const excluded: string[] = [];
  for (const raw of pattern.split(/[,:]/).map((x) => x.trim()).filter(Boolean)) {
    const not = raw.startsWith('!');
    const p = raw.replace(/^!/, '');
    const listing = p === 'all' || p === '*' ? inv.order : (inv.groups[p] ?? (inv.hosts[p] ? [p] : []));
    (not ? excluded : result).push(...listing);
  }
  return [...new Set(result)].filter((h) => !excluded.includes(h));
}

/** Le motif ne correspond-il à rien de connu (pour l'avertissement d'Ansible) ? */
export const unknownPattern = (inv: Inventory, pattern: string) =>
  pattern
    .split(/[,:]/)
    .map((x) => x.trim().replace(/^!/, ''))
    .filter(Boolean)
    .some((p) => p !== 'all' && p !== '*' && !inv.groups[p] && !inv.hosts[p]);

// ——— La connexion aux hôtes ———

export interface Context {
  game: Shell;
  config: Config;
  inventory: Inventory;
  check: boolean;
  difference: boolean;
  outputs: string[];
  // Hôte → session (connexion faite une fois par commande).
  sessions: Record<string, Shell | string>;
  forceUser?: string;
  become?: boolean;
}

function reach(c: Context, host: string): Shell | string {
  if (c.sessions[host] !== undefined) return c.sessions[host];
  const vars = c.inventory.hosts[host] ?? {};
  const address = vars.ansible_host ?? host;
  const user = c.forceUser ?? vars.ansible_user ?? c.config.user ?? c.game.who;
  const r = connectWithoutQuestion(c.game, `${user}@${address}`, c.config.checkHostKey);
  const s = 'shell' in r ? r.shell : `Failed to connect to the host via ssh: ${r.error}`;
  if (typeof s !== 'string') s.who = user;
  c.sessions[host] = s;
  return s;
}

// ——— Le JSON des résultats, comme Ansible l'affiche ———

export function json(v: unknown, indent = 0): string {
  const pad = ' '.repeat(indent);
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return v.length ? `[\n${v.map((x) => `${pad}    ${json(x, indent + 4)}`).join(',\n')}\n${pad}]` : '[]';
  const e = Object.entries(v as Record<string, unknown>);
  return e.length ? `{\n${e.map(([k, x]) => `${pad}    ${JSON.stringify(k)}: ${json(x, indent + 4)}`).join(',\n')}\n${pad}}` : '{}';
}

/** Le JSON sur une ligne, comme json.dumps de Python (« , » et « : » suivis d'une espace). */
export function lineJson(v: unknown): string {
  if (v === null || v === undefined) return 'null';
  if (typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(lineJson).join(', ')}]`;
  return `{${Object.entries(v as Record<string, unknown>).map(([k, x]) => `${JSON.stringify(k)}: ${lineJson(x)}`).join(', ')}}`;
}

// ——— Les modules ———

export interface Result {
  changed: boolean;
  failed?: boolean;
  skipped?: boolean;
  msg?: string;
  // Ce qu'Ansible affiche après « => » (pour debug, échecs, ad-hoc).
  data?: Record<string, unknown>;
  diff?: string;
  // command/shell en ad-hoc : rc et sortie.
  rc?: number;
  stdout?: string;
}

type Args = Record<string, Value>;
type Module = { params: string[]; required?: string[]; launch: (h: Shell, a: Args, c: Context, become: boolean) => Result; written?: boolean };

const string = (v: Value | undefined) => (v === undefined ? undefined : Array.isArray(v) ? v.join(',') : typeof v === 'string' ? v : JSON.stringify(v));
const listing = (v: Value | undefined): string[] =>
  v === undefined ? [] : Array.isArray(v) ? v.map((x) => String(x)) : String(v).split(',').map((x) => x.trim()).filter(Boolean);
const boolean = (v: Value | undefined, fallback = false) => (v === undefined ? fallback : typeof v === 'string' ? yes(v) : fallback);

// Un mode « 0644 », « 644 » ou « u=rw,g=r,o=r » → « rw-r--r-- ».
function toMode(v: string | undefined): string | null {
  if (!v) return null;
  const o = /^0?([0-7]{3,4})$/.exec(v.replace(/^'|'$/g, ''));
  if (o) {
    const digits = o[1].slice(-3);
    const special = o[1].length === 4 ? Number(o[1][0]) : 0;
    const r = [...digits].map((c) => {
      const n = Number(c);
      return (n & 4 ? 'r' : '-') + (n & 2 ? 'w' : '-') + (n & 1 ? 'x' : '-');
    });
    if (special & 2) r[1] = r[1].slice(0, 2) + (r[1][2] === 'x' ? 's' : 'S');
    return r.join('');
  }
  const m = /^u=([rwx]*),g=([rwx]*),o=([rwx]*)$/.exec(v);
  if (m) return [m[1], m[2], m[3]].map((p) => `${p.includes('r') ? 'r' : '-'}${p.includes('w') ? 'w' : '-'}${p.includes('x') ? 'x' : '-'}`).join('');
  return null;
}

// Écrire sur l'hôte demande d'être root, sauf là où le compte peut écrire.
const canWrite = (h: Shell, path: string) => h.who === 'root' || h.writtenIn(path);

// Le diff de --diff : les lignes gardées, retirées (-) et ajoutées (+), à leur place (plus longue sous-suite commune).
function diff(path: string, before: string, after: string): string {
  const a = before === '' ? [] : before.replace(/\n$/, '').split('\n');
  const b = after === '' ? [] : after.replace(/\n$/, '').split('\n');
  const l = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) l[i][j] = a[i] === b[j] ? l[i + 1][j + 1] + 1 : Math.max(l[i + 1][j], l[i][j + 1]);
  const lines = [`--- before: ${path}`, `+++ after: ${path}`, `@@ -1,${a.length} +1,${b.length} @@`];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      lines.push(` ${a[i++]}`);
      j++;
    } else if (i < a.length && (j === b.length || l[i + 1][j] >= l[i][j + 1])) lines.push(`-${a[i++]}`);
    else lines.push(`+${b[j++]}`);
  }
  return lines.join('\n');
}

const notWritable = (directory: string): Result => ({ changed: false, failed: true, msg: `Destination ${directory} not writable` });

function writeFile(h: Shell, path: string, content: string, a: Args): void {
  const n = h.find(path);
  if (n?.type === 'file') n.content = content;
  else h.place('ansible', path, { type: 'file', content, lines: true, owner: 'root', group: 'root', mode: 'rw-r--r--' });
  applyAttributes(h, path, a);
}

// owner, group, mode : renvoie vrai si quelque chose change (sans rien changer en mode vérification).
function changeAttributes(h: Shell, path: string, a: Args): boolean {
  const n = h.find(path);
  if (!n) return false;
  const mode = toMode(string(a.mode));
  return (!!a.owner && n.owner !== string(a.owner)) || (!!a.group && (n.group ?? n.owner) !== string(a.group)) || (!!mode && (n.mode ?? (n.type === 'directory' ? 'rwxr-xr-x' : 'rw-r--r--')) !== mode);
}
function applyAttributes(h: Shell, path: string, a: Args) {
  const n = h.find(path);
  if (!n) return;
  if (a.owner) n.owner = string(a.owner);
  if (a.group) n.group = string(a.group);
  const mode = toMode(string(a.mode));
  if (mode) n.mode = mode;
}

const directoryFor = (path: string) => path.slice(0, path.lastIndexOf('/')) || '/';

const MODULES: Record<string, Module> = {
  ping: { params: ['data'], launch: () => ({ changed: false, data: { ping: 'pong' } }) },
  debug: { params: ['msg', 'var', 'verbosity'], launch: (_h, a) => ({ changed: false, data: { msg: a.msg ?? 'Hello world!' } }) },
  apt: {
    params: ['name', 'pkg', 'state', 'update_cache', 'cache_valid_time', 'install_recommends', 'autoremove', 'upgrade'],
    launch: (h, a, c) => {
      const names = listing(a.name ?? a.pkg);
      const state = string(a.state) ?? 'present';
      const installed: Record<string, string> = (h.state.packages ??= {});
      const repo: Record<string, string> = h.state.repo ?? {};
      if (h.who !== 'root')
        return {
          changed: false,
          failed: true,
          msg: "Failed to lock apt for exclusive operation: Failed to lock directory /var/lib/apt/lists/: E:Could not open lock file /var/lib/apt/lists/lock - open (13: Permission denied)",
        };
      const unknown = names.find((n) => !repo[n] && !installed[n]);
      if (unknown && state !== 'absent') return { changed: false, failed: true, msg: `No package matching '${unknown}' is available` };
      const doA = state === 'absent' ? names.filter((n) => installed[n]) : names.filter((n) => !installed[n] || (state === 'latest' && installed[n] !== repo[n]));
      if (doA.length && !c.check) for (const n of doA) state === 'absent' ? delete installed[n] : (installed[n] = repo[n]);
      return { changed: doA.length > 0 || boolean(a.update_cache) };
    },
  },
  copy: {
    params: ['content', 'src', 'dest', 'owner', 'group', 'mode', 'backup', 'force'],
    required: ['dest'],
    launch: (h, a, c) => {
      const dest = string(a.dest)!;
      let content = string(a.content);
      if (content === undefined) {
        const src = string(a.src);
        if (!src) return { changed: false, failed: true, msg: 'src (or content) is required' };
        const path = src.startsWith('/') ? src : [`${c.game.cwd}/files/${src}`, `${c.game.cwd}/${src}`].find((x) => c.game.find(x)) ?? `${c.game.cwd}/${src}`;
        content = c.game.read(path) ?? undefined;
        if (content === undefined) return { changed: false, failed: true, msg: `Could not find or access '${src}'\nSearched in:\n\t${c.game.cwd}/files/${src}\n\t${c.game.cwd}/${src} on the Ansible Controller.\nIf you are using a module and expect the file to exist on the remote, see the remote_src option` };
      }
      const directory = directoryFor(dest);
      if (h.find(directory)?.type !== 'directory') return { changed: false, failed: true, msg: `Destination directory ${directory} does not exist` };
      const before = h.read(dest);
      const change = before !== content || changeAttributes(h, dest, a);
      if (change && !canWrite(h, dest)) return notWritable(directory);
      if (change && !c.check) writeFile(h, dest, content, a);
      return { changed: change, diff: before !== content ? diff(dest, before ?? '', content) : undefined };
    },
  },
  file: {
    params: ['path', 'dest', 'name', 'state', 'owner', 'group', 'mode', 'recurse'],
    required: ['path'],
    launch: (h, a, c) => {
      const path = string(a.path ?? a.dest ?? a.name)!;
      const state = string(a.state) ?? 'file';
      const n = h.find(path);
      if (state === 'absent') {
        if (!n) return { changed: false };
        if (!canWrite(h, path)) return { changed: false, failed: true, msg: `rmtree failed: [Errno 13] Permission denied: '${path}'` };
        if (!c.check) h.erase(path);
        return { changed: true };
      }
      if (state === 'directory') {
        if (n && n.type !== 'directory') return { changed: false, failed: true, msg: `${path} already exists as a file` };
        if (!n) {
          if (!canWrite(h, path)) return { changed: false, failed: true, msg: `There was an issue creating ${path} as requested: [Errno 13] Permission denied: b'${path}'` };
          if (!c.check) {
            h.place('ansible', path, { type: 'directory', children: {}, owner: 'root', group: 'root', mode: 'rwxr-xr-x' });
            applyAttributes(h, path, a);
          }
          return { changed: true };
        }
      } else if (state === 'touch') {
        if (!n) {
          if (!canWrite(h, path)) return notWritable(directoryFor(path));
          if (!c.check) writeFile(h, path, '', a);
          return { changed: true };
        }
      } else if (!n) return { changed: false, failed: true, msg: `file (${path}) is absent, cannot continue` };
      const change = changeAttributes(h, path, a);
      if (change && h.who !== 'root') return { changed: false, failed: true, msg: `chown failed: [Errno 1] Operation not permitted: b'${path}'` };
      if (change && !c.check) applyAttributes(h, path, a);
      return { changed: change };
    },
  },
  lineinfile: {
    params: ['path', 'dest', 'line', 'regexp', 'state', 'create', 'insertafter', 'insertbefore', 'backup', 'owner', 'group', 'mode', 'validate'],
    required: ['path'],
    launch: (h, a, c) => {
      const path = string(a.path ?? a.dest)!;
      const state = string(a.state) ?? 'present';
      const line = string(a.line);
      const before = h.read(path);
      if (before === null && !boolean(a.create)) return { changed: false, failed: true, msg: `Destination ${path} does not exist !`, data: { rc: 257 } };
      const lines = (before ?? '').replace(/\n$/, '').split('\n').filter((l, i, t) => !(t.length === 1 && l === ''));
      let re: RegExp | null = null;
      try {
        re = a.regexp ? new RegExp(string(a.regexp)!) : null;
      } catch {
        return { changed: false, failed: true, msg: `Invalid regular expression: ${string(a.regexp)}` };
      }
      let fresh = [...lines];
      if (state === 'absent') fresh = lines.filter((l) => !(re ? re.test(l) : l === line));
      else {
        if (line === undefined) return { changed: false, failed: true, msg: 'line is required with state=present' };
        const hint = re ? lines.map((l, k) => (re!.test(l) ? k : -1)).filter((k) => k >= 0).at(-1) : undefined;
        if (hint !== undefined) fresh[hint] = line;
        else if (!lines.includes(line)) fresh.push(line);
      }
      const after = fresh.join('\n') + (fresh.length ? '\n' : '');
      const change = after.replace(/\n$/, '') !== (before ?? '').replace(/\n$/, '');
      if (change && !canWrite(h, path))
        return { changed: false, failed: true, msg: `The destination directory (${directoryFor(path)}) is not writable by the current user. Error was: [Errno 13] Permission denied: b'${directoryFor(path)}/.ansible_tmp'` };
      if (change && !c.check) writeFile(h, path, after, a);
      return { changed: change, msg: change ? (state === 'absent' ? 'line(s) removed' : 'line replaced') : '', diff: change ? diff(path, before ?? '', after) : undefined };
    },
  },
  user: {
    params: ['name', 'state', 'shell', 'groups', 'append', 'create_home', 'comment', 'home', 'system', 'uid'],
    required: ['name'],
    launch: (h, a, c) => {
      const name = string(a.name)!;
      const exists = !!h.accounts.users[name];
      const state = string(a.state) ?? 'present';
      if (h.who !== 'root') return { changed: false, failed: true, msg: `useradd: Permission denied.\nuseradd: cannot lock /etc/passwd; try again later.\n`, data: { rc: 1 } };
      if (state === 'absent') {
        if (exists && !c.check) delete h.accounts.users[name];
        return { changed: exists };
      }
      const groups = listing(a.groups);
      const missing = groups.filter((g) => !h.accounts.groups[g]);
      if (missing.length) return { changed: false, failed: true, msg: `Group ${missing[0]} does not exist` };
      const inside = (g: string) => h.accounts.groups[g]?.members.includes(name);
      const wantedShell = string(a.shell);
      const change = !exists || groups.some((g) => !inside(g)) || (!!wantedShell && h.accounts.users[name]?.shell !== wantedShell);
      if (change && !c.check) {
        if (!exists) {
          const uid = Math.max(1000, ...Object.values(h.accounts.users).map((u) => u.uid)) + 1;
          h.accounts.groups[name] ??= { gid: uid, members: [] };
          h.accounts.users[name] = { uid, group: name, home: `/home/${name}`, shell: wantedShell ?? '/bin/sh' };
          if (boolean(a.create_home, true) && !h.find(`/home/${name}`)) h.place('ansible', `/home/${name}`, { type: 'directory', children: {}, owner: name, group: name, mode: 'rwxr-xr-x' });
        } else if (wantedShell) h.accounts.users[name].shell = wantedShell;
        for (const g of groups) if (!inside(g)) h.accounts.groups[g].members.push(name);
      }
      return { changed: change };
    },
  },
  service: {
    params: ['name', 'state', 'enabled', 'daemon_reload'],
    required: ['name'],
    launch: (h, a, c) => {
      const wanted = string(a.name)!.replace(/\.service$/, '');
      const sd = systemd(h);
      const name = sd && !sd.services[wanted] && wanted === 'sshd' && sd.services.ssh ? 'ssh' : wanted;
      const s = sd?.services[name];
      if (!sd || !s) return { changed: false, failed: true, msg: `Could not find the requested service ${wanted}: host` };
      const state = string(a.state);
      if (h.who !== 'root' && (state || a.enabled !== undefined))
        return { changed: false, failed: true, msg: `Unable to ${state?.replace(/ed$/, '') ?? 'enable'} service ${wanted}: Failed to ${state?.replace(/ed$/, '') ?? 'enable'} ${name}.service: Interactive authentication required.\n` };
      let change = false;
      if (a.enabled !== undefined && boolean(a.enabled) !== s.active) {
        change = true;
        if (!c.check) s.active = boolean(a.enabled);
      }
      if (state === 'started' && s.state !== 'active') {
        change = true;
        if (!c.check && !start(h, sd, name)) return { changed: false, failed: true, msg: `Unable to start service ${name}: Job for ${name}.service failed because the control process exited with error code.` };
      } else if (state === 'stopped' && s.state === 'active') {
        change = true;
        if (!c.check) stop(h, sd, name);
      } else if (state === 'restarted' || state === 'reloaded') {
        change = true;
        if (!c.check) {
          if (state === 'restarted' || s.state !== 'active') {
            if (s.state === 'active') stop(h, sd, name);
            if (!start(h, sd, name)) return { changed: false, failed: true, msg: `Unable to restart service ${name}: Job for ${name}.service failed because the control process exited with error code.` };
          } else if (!reload(h, sd, name)) return { changed: false, failed: true, msg: `Unable to reload service ${name}: Job for ${name}.service failed because the control process exited with error code.` };
        }
      }
      return { changed: change, data: { name: name, state: s.state === 'active' ? 'started' : 'stopped' } };
    },
  },
  command: {
    params: ['_raw_params', 'cmd', 'chdir', 'creates', 'removes'],
    launch: (h, a, c) => execute(h, a, c, false),
  },
  shell: {
    params: ['_raw_params', 'cmd', 'chdir', 'creates', 'removes', 'executable'],
    launch: (h, a, c) => execute(h, a, c, true),
  },
};
MODULES.systemd = MODULES.service;
MODULES.systemd_service = MODULES.service;

// command et shell : la commande tourne sur l'hôte ; « changed » à chaque fois (Ansible ne peut pas savoir).
function execute(h: Shell, a: Args, c: Context, shell: boolean): Result {
  const cmd = string(a._raw_params ?? a.cmd) ?? '';
  const creates = string(a.creates);
  if (creates && h.find(creates)) return { changed: false, msg: `Did not run command since '${creates}' exists`, rc: 0, stdout: `skipped, since ${creates} exists` };
  if (c.check) return { changed: false, skipped: true, msg: 'Command would have run if not in check mode' };
  // command ne passe pas par un shell : ni redirection, ni tube, ni variable.
  const line = shell ? cmd : cmd.replace(/[|>&;]/g, (x) => `'${x}'`);
  const r = h.underCommand(line, string(a.chdir) ?? h.accounts.users[h.who]?.home ?? '/');
  const errors = h.recoverErrors().join('\n');
  const fails = r.code !== 0;
  // En échec, ce que la commande a écrit est son erreur (stderr).
  const stdout = fails ? '' : r.output;
  const stderr = fails ? [errors, r.output].filter(Boolean).join('\n') : errors;
  const data = { cmd: shell ? cmd : cmd.split(/\s+/), rc: r.code, stderr, stderr_lines: stderr ? stderr.split('\n') : [], stdout, stdout_lines: stdout ? stdout.split('\n') : [] };
  if (fails) return { changed: true, failed: true, msg: 'non-zero return code', rc: r.code, stdout, data: { ...data, msg: 'non-zero return code' } };
  return { changed: true, rc: 0, stdout: r.output, data };
}

/** Le nom court d'un module (ansible.builtin.copy → copy), ou null s'il est inconnu. */
export const moduleFor = (name: string): string | null => {
  const short = name.replace(/^ansible\.(builtin|legacy)\./, '');
  return MODULES[short] ? short : null;
};

// « name=htop state=present » : les arguments en ligne (k=v), ou la commande de command/shell.
export function argumentsInLine(module: string, text: string): Args {
  if (module === 'command' || module === 'shell') {
    const args: Args = {};
    const rest = text.replace(/\b(chdir|creates|removes)=(\S+)/g, (_, k: string, v: string) => {
      args[k] = v;
      return '';
    });
    args._raw_params = rest.trim();
    return args;
  }
  const args: Args = {};
  for (const m of text.matchAll(/([\w]+)=("[^"]*"|'[^']*'|\S+)/g)) args[m[1]] = m[2].replace(/^["']|["']$/g, '');
  return args;
}

// {{ variable }} : remplacé par la valeur (variables de l'hôte, puis du play).
function replace(v: Value, vars: Record<string, string>): Value {
  if (typeof v === 'string')
    return v.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (all, name: string) => {
      if (name in vars) return vars[name];
      throw new Error(`'${name}' is undefined`);
    });
  if (Array.isArray(v)) return v.map((x) => replace(x, vars));
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, replace(x, vars)]));
}

/** Lance un module sur un hôte, avec ou sans become. */
export function launchModule(c: Context, h: Shell, module: string, args: Args, become: boolean): Result {
  const m = MODULES[module];
  const unknown = Object.keys(args).filter((k) => !m.params.includes(k) && k !== '_raw_params');
  if (unknown.length)
    return {
      changed: false,
      failed: true,
      msg: `Unsupported parameters for (ansible.builtin.${module}) module: ${unknown.join(', ')}. Supported parameters include: ${[...m.params].filter((p) => p !== '_raw_params').sort().join(', ')}.`,
    };
  const missing = (m.required ?? []).filter((r) => !(r in args) && !(r === 'path' && ('dest' in args || 'name' in args)) && !(r === 'name' && 'pkg' in args));
  if (missing.length) return { changed: false, failed: true, msg: `missing required arguments: ${missing.join(', ')}` };
  const who = h.who;
  if (become) h.who = 'root';
  try {
    return m.launch(h, args, c, become);
  } finally {
    h.who = who;
  }
}

// ——— Les playbooks ———

export interface Task {
  name: string;
  module: string;
  args: Args;
  become?: boolean;
  notify: string[];
  changedWhen?: boolean;
  line: number;
  listening?: string[];
}

export interface Play {
  name: string;
  hosts: string;
  become: boolean;
  done: boolean;
  vars: Record<string, string>;
  tasks: Task[];
  handlers: Task[];
}

export class AnsibleError extends Error {}

const TASK_WORDS = ['name', 'become', 'become_user', 'notify', 'changed_when', 'tags', 'listen', 'check_mode', 'ignore_errors', 'vars', 'register', 'when', 'loop'];
const PLAY_WORDS = ['name', 'hosts', 'become', 'become_user', 'gather_facts', 'vars', 'tasks', 'handlers', 'remote_user', 'pre_tasks', 'post_tasks', 'serial'];

// « The offending line appears to be » : la ligne, et un ^ sous la colonne.
const appears = (file: string, text: string, line: number, column: number) => {
  const l = text.split('\n')[line - 1] ?? '';
  const before = text.split('\n')[line - 2];
  return `The error appears to be in '${file}': line ${line}, column ${column}, but may\nbe elsewhere in the file depending on the exact syntax problem.\n\nThe offending line appears to be:\n\n${before !== undefined ? `${before}\n` : ''}${l}\n${' '.repeat(Math.max(0, column - 1))}^ here`;
};

function readTask(t: Value, file: string, text: string, line: number): Task {
  if (typeof t !== 'object' || Array.isArray(t)) throw new AnsibleError(`ERROR! A malformed block was encountered while loading tasks: ${string(t)} should be a list or None\n\n${appears(file, text, line, 3)}`);
  const keys = Object.keys(t);
  const modules = keys.filter((k) => !TASK_WORDS.includes(k));
  if (!modules.length) throw new AnsibleError(`ERROR! no module/action detected in task.\n\n${appears(file, text, line, 3)}`);
  if (modules.length > 1) {
    const known = modules.filter((k) => moduleFor(k));
    if (known.length > 1) throw new AnsibleError(`ERROR! conflicting action statements: ${known.join(', ')}\n\n${appears(file, text, line, 3)}`);
    const unknown = modules.find((k) => !moduleFor(k))!;
    throw new AnsibleError(`ERROR! couldn't resolve module/action '${unknown}'. This often indicates a misspelling, missing collection, or incorrect module path.\n\n${appears(file, text, line, 3)}`);
  }
  const raw = modules[0];
  const module = moduleFor(raw);
  if (!module) throw new AnsibleError(`ERROR! couldn't resolve module/action '${raw}'. This often indicates a misspelling, missing collection, or incorrect module path.\n\n${appears(file, text, line, 3)}`);
  const value = t[raw];
  const args: Args = typeof value === 'string' ? argumentsInLine(module, value) : Array.isArray(value) ? {} : { ...value };
  if ((module === 'command' || module === 'shell') && typeof value === 'object' && !Array.isArray(value) && value.cmd) args._raw_params = value.cmd;
  return {
    name: string(t.name) ?? `${module}`,
    module,
    args,
    become: t.become === undefined ? undefined : boolean(t.become),
    notify: listing(t.notify),
    changedWhen: t.changed_when === undefined ? undefined : boolean(t.changed_when),
    line,
    listening: listing(t.listen),
  };
}

/** Lit un playbook : une liste de plays ; lève ErreurAnsible au format d'Ansible. */
export function readPlaybook(text: string, file: string): Play[] {
  let data: Value;
  try {
    data = readYaml(text);
  } catch (e) {
    if (!(e instanceof YamlError)) throw e;
    throw new AnsibleError(`ERROR! Syntax Error while loading YAML.\n  ${e.message}\n\n${appears(file, text, e.line, e.column)}`);
  }
  if (!Array.isArray(data)) throw new AnsibleError(`ERROR! A playbook must be a list of plays, got a ${typeof data === 'string' ? 'AnsibleUnicode' : 'AnsibleMapping'} instead\n\nThe error appears to be in '${file}': line 1, column 1, but may\nbe elsewhere in the file depending on the exact syntax problem.`);
  // Les numéros de ligne des « - name: » (pour les messages).
  const tasksLines = text.split('\n').map((l, i) => (/^\s*- /.test(l) ? i + 1 : 0)).filter(Boolean);
  let k = 0;
  return data.map((p) => {
    if (typeof p !== 'object' || Array.isArray(p)) throw new AnsibleError(`ERROR! A malformed play was found.`);
    const unknown = Object.keys(p).find((x) => !PLAY_WORDS.includes(x));
    if (unknown) throw new AnsibleError(`ERROR! '${unknown}' is not a valid attribute for a Play\n\n${appears(file, text, tasksLines[k] ?? 1, 3)}`);
    if (!p.hosts) throw new AnsibleError(`ERROR! the field 'hosts' is required but was not set`);
    k++;
    const tasks = (Array.isArray(p.tasks) ? p.tasks : []).map((t) => readTask(t, file, text, tasksLines[k++] ?? 1));
    const handlers = (Array.isArray(p.handlers) ? p.handlers : []).map((t) => readTask(t, file, text, tasksLines[k++] ?? 1));
    const vars = typeof p.vars === 'object' && !Array.isArray(p.vars) ? Object.fromEntries(Object.entries(p.vars).map(([n, v]) => [n, string(v) ?? ''])) : {};
    return { name: string(p.name) ?? string(p.hosts)!, hosts: string(p.hosts)!, become: boolean(p.become), done: !no(string(p.gather_facts)), vars, tasks, handlers };
  });
}

// La bannière d'Ansible : le titre, puis des * jusqu'à 80 colonnes.
export const banner = (title: string) => `${title} ${'*'.repeat(Math.max(3, 79 - title.length))}`;

export interface Summary {
  ok: number;
  changed: number;
  unreachable: number;
  failed: number;
  skipped: number;
  rescued: number;
  ignored: number;
}

const newSummary = (): Summary => ({ ok: 0, changed: 0, unreachable: 0, failed: 0, skipped: 0, rescued: 0, ignored: 0 });

export interface Execution {
  file?: string;
  check: boolean;
  hosts: Record<string, Summary>;
  // Les chemins changés sur chaque hôte (pour les histoires).
  changes: Record<string, string[]>;
}

/** Joue un playbook ; renvoie la sortie, le bilan et le code de retour. */
export function play(c: Context, plays: Play[], limit: string | null, forcer = false): { execution: Execution; code: number } {
  const execution: Execution = { check: c.check, hosts: {}, changes: {} };
  const summaries = execution.hosts;
  const morts = new Set<string>();
  const output = c.outputs;
  let toLessOne = false;
  for (const p of plays) {
    let hosts = hostsFor(c.inventory, p.hosts);
    if (limit) hosts = hosts.filter((h) => hostsFor(c.inventory, limit).includes(h));
    if (unknownPattern(c.inventory, p.hosts)) output.push(`[WARNING]: Could not match supplied host pattern, ignoring: ${p.hosts}`);
    output.push('', banner(`PLAY [${p.name}]`));
    if (!hosts.length) {
      output.push('skipping: no hosts matched');
      continue;
    }
    toLessOne = true;
    for (const h of hosts) summaries[h] ??= newSummary();
    const live = () => hosts.filter((h) => !morts.has(h));
    const notified: Record<string, Set<string>> = {};
    const task = (t: Task, handler = false) => {
      // --force-handlers : un handler notifié tourne même sur un hôte qui a échoué ensuite (pas sur un hôte injoignable).
      const candidates = handler && forcer ? hosts.filter((h) => summaries[h].unreachable === 0) : live();
      const active = candidates.filter((h) => !handler || notified[t.name]?.has(h) || t.listening?.some((e) => notified[e]?.has(h)));
      if (!active.length) return;
      output.push('', banner(`${handler ? 'RUNNING HANDLER' : 'TASK'} [${t.name}]`));
      for (const h of active) {
        const s = reach(c, h);
        if (typeof s === 'string') {
          output.push(`fatal: [${h}]: UNREACHABLE! => ${lineJson({ changed: false, msg: s, unreachable: true })}`);
          summaries[h].unreachable++;
          morts.add(h);
          continue;
        }
        let r: Result;
        try {
          const vars = { ...p.vars, ...(c.inventory.hosts[h] ?? {}), inventory_hostname: h };
          r = launchModule(c, s, t.module, replace(t.args, vars) as Args, t.become ?? p.become);
        } catch (e) {
          r = { changed: false, failed: true, msg: `The task includes an option with an undefined variable. The error was: ${(e as Error).message}` };
        }
        if (t.changedWhen === false && !r.failed) r.changed = false;
        if (r.failed) {
          const data = { changed: r.changed, ...(r.data ?? {}), msg: r.msg };
          output.push(`fatal: [${h}]: FAILED! => ${lineJson(data)}`);
          summaries[h].failed++;
          morts.add(h);
          continue;
        }
        if (r.skipped) {
          output.push(`skipping: [${h}]`);
          summaries[h].skipped++;
          continue;
        }
        if (c.difference && r.diff) output.push(r.diff);
        if (t.module === 'debug') output.push(`ok: [${h}] => ${json(r.data)}`);
        else output.push(`${r.changed ? 'changed' : 'ok'}: [${h}]`);
        summaries[h].ok++;
        if (r.changed) {
          summaries[h].changed++;
          const path = string(t.args.dest ?? t.args.path ?? t.args.name);
          if (path) (execution.changes[h] ??= []).push(path);
          for (const n of t.notify) {
            if (!p.handlers.some((x) => x.name === n || x.listening?.includes(n)))
              throw new AnsibleError(`ERROR! The requested handler '${n}' was not found in either the main handlers list nor in the listening handlers list`);
            (notified[n] ??= new Set()).add(h);
          }
        }
      }
    };
    if (p.done) {
      output.push('', banner('TASK [Gathering Facts]'));
      for (const h of live()) {
        const s = reach(c, h);
        if (typeof s === 'string') {
          output.push(`fatal: [${h}]: UNREACHABLE! => ${lineJson({ changed: false, msg: s, unreachable: true })}`);
          summaries[h].unreachable++;
          morts.add(h);
        } else {
          output.push(`ok: [${h}]`);
          summaries[h].ok++;
        }
      }
    }
    for (const t of p.tasks) {
      if (!live().length) break;
      task(t);
    }
    for (const g of p.handlers) task(g, true);
    if (!live().length) output.push('', 'NO MORE HOSTS LEFT *************************************************************');
  }
  if (!toLessOne) output.push('', '[WARNING]: No hosts matched, nothing to do');
  output.push('', banner('PLAY RECAP'));
  for (const [h, b] of Object.entries(summaries))
    output.push(
      `${h.padEnd(26)} : ${[`ok=${b.ok}`, `changed=${b.changed}`, `unreachable=${b.unreachable}`, `failed=${b.failed}`, `skipped=${b.skipped}`, `rescued=${b.rescued}`, `ignored=${b.ignored}`]
        .map((x) => x.padEnd(x.indexOf('=') + 5))
        .join(' ')}`,
    );
  output.push('');
  const code = Object.values(summaries).some((b) => b.unreachable) ? 4 : Object.values(summaries).some((b) => b.failed) ? 2 : 0;
  return { execution, code };
}

/** Les commandes ad-hoc (ansible MOTIF -m MODULE -a ARGS) : une ligne par hôte. */
export function adhoc(c: Context, pattern: string, module: string, text: string, become: boolean): { lines: string[]; code: number; results: Record<string, 'SUCCESS' | 'CHANGED' | 'FAILED' | 'UNREACHABLE'> } {
  const lines: string[] = [];
  const results: Record<string, 'SUCCESS' | 'CHANGED' | 'FAILED' | 'UNREACHABLE'> = {};
  let code = 0;
  for (const h of hostsFor(c.inventory, pattern)) {
    const s = reach(c, h);
    if (typeof s === 'string') {
      lines.push(`${h} | UNREACHABLE! => ${json({ changed: false, msg: s, unreachable: true })}`);
      results[h] = 'UNREACHABLE';
      code = 4;
      continue;
    }
    const r = launchModule(c, s, module, argumentsInLine(module, text), become);
    if (module === 'command' || module === 'shell') {
      const state = r.failed ? 'FAILED' : r.changed ? 'CHANGED' : 'SUCCESS';
      lines.push(`${h} | ${state} | rc=${r.rc ?? 0} >>`, ...(r.stdout ? [r.stdout] : []), ...(r.failed ? [String((r.data?.stderr as string) ?? '')] : []));
      results[h] = state;
      if (r.failed && code < 2) code = 2;
      continue;
    }
    if (r.failed) {
      lines.push(`${h} | FAILED! => ${json({ changed: false, ...(r.data ?? {}), msg: r.msg })}`);
      results[h] = 'FAILED';
      if (code < 2) code = 2;
      continue;
    }
    const state = r.changed ? 'CHANGED' : 'SUCCESS';
    results[h] = state;
    lines.push(`${h} | ${state} => ${json({ ansible_facts: { discovered_interpreter_python: '/usr/bin/python3' }, changed: r.changed, ...(r.data ?? {}) })}`);
  }
  return { lines, code, results };
}

// ——— ansible-doc ———

// La documentation des modules (abrégée, en anglais comme ansible-doc).
export const DOCS: Record<string, { short: string; options: Record<string, string>; example: string }> = {
  ping: { short: 'Try to connect to host, verify a usable python and return `pong\' on success', options: { data: 'Data to return for the `ping\' return value.' }, example: '- name: Example from an Ansible Playbook\n  ansible.builtin.ping:' },
  apt: {
    short: 'Manages apt-packages',
    options: { name: 'A list of package names, like `foo\', or package specifier with version, like `foo=1.0\'.', state: 'Indicates the desired package state. `latest\' ensures that the latest version is installed. (Choices: absent, latest, present; default: present)', update_cache: 'Run the equivalent of `apt-get update\' before the operation.' },
    example: '- name: Install apache httpd (state=present is optional)\n  ansible.builtin.apt:\n    name: apache2\n    state: present',
  },
  copy: {
    short: 'Copy files to remote locations',
    options: { content: 'When used instead of `src\', sets the contents of a file directly to the specified value.', src: 'Local path to a file to copy to the remote server.', dest: 'Remote absolute path where the file should be copied to. (required)', owner: 'Name of the user that should own the filesystem object.', group: 'Name of the group that should own the filesystem object.', mode: 'The permissions the resulting filesystem object should have, like \'0644\'.' },
    example: '- name: Copy using inline content\n  ansible.builtin.copy:\n    content: \'# This file was moved to /etc/other.conf\'\n    dest: /etc/mine.conf',
  },
  file: {
    short: 'Manage files and file properties',
    options: { path: 'Path to the file being managed. (required)', state: 'If `directory\', all intermediate subdirectories will be created if they do not exist. If `absent\', directories will be recursively deleted. (Choices: absent, directory, file, hard, link, touch; default: file)', mode: 'The permissions the resulting filesystem object should have.', owner: 'Name of the user that should own the filesystem object.' },
    example: '- name: Create a directory if it does not exist\n  ansible.builtin.file:\n    path: /etc/some_directory\n    state: directory\n    mode: \'0755\'',
  },
  lineinfile: {
    short: 'Manage lines in text files',
    options: { path: 'The file to modify. (required)', regexp: 'The regular expression to look for in every line of the file. When modifying a line the regexp should typically match both the initial state of the line as well as its state after replacement by `line\' to ensure idempotence.', line: 'The line to insert/replace into the file.', state: 'Whether the line should be there or not. (Choices: absent, present; default: present)', create: 'Used with `state=present\'. If specified, the file will be created if it does not already exist.' },
    example: '- name: Ensure SELinux is set to enforcing mode\n  ansible.builtin.lineinfile:\n    path: /etc/selinux/config\n    regexp: \'^SELINUX=\'\n    line: SELINUX=enforcing',
  },
  user: {
    short: 'Manage user accounts',
    options: { name: 'Name of the user to create, remove or modify. (required)', state: 'Whether the account should exist or not. (Choices: absent, present; default: present)', shell: 'Optionally set the user\'s shell.', groups: 'A list of supplementary groups which the user is also a member of.', append: 'If `true\', add the user to the groups specified in `groups\'.' },
    example: '- name: Add the user \'johnd\' with a specific uid and a primary group of \'admin\'\n  ansible.builtin.user:\n    name: johnd\n    comment: John Doe',
  },
  service: {
    short: 'Manage services',
    options: { name: 'Name of the service. (required)', state: '`started\'/`stopped\' are idempotent actions that will not run commands unless necessary. `restarted\' will always bounce the service. `reloaded\' will always reload. (Choices: reloaded, restarted, started, stopped)', enabled: 'Whether the service should start on boot.' },
    example: '- name: Restart service httpd, in all cases\n  ansible.builtin.service:\n    name: httpd\n    state: restarted',
  },
  command: {
    short: 'Execute commands on targets',
    options: { cmd: 'The command to run.', creates: 'A filename or (since 2.0) glob pattern. If a matching file already exists, this step will not be run.', chdir: 'Change into this directory before running the command.' },
    example: '- name: Run command if /path/to/database does not exist (without \'args\')\n  ansible.builtin.command: /usr/bin/make_database.sh db_user db_name creates=/path/to/database',
  },
  shell: {
    short: 'Execute shell commands on targets',
    options: { cmd: 'The shell command to run.', creates: 'A filename, when it already exists, this step will not be run.', chdir: 'Change into this directory before running the command.' },
    example: '- name: Execute the command in remote shell; stdout goes to the specified file on the remote\n  ansible.builtin.shell: somescript.sh >> somelog.txt',
  },
  debug: { short: 'Print statements during execution', options: { msg: 'The customized message that is printed. If omitted, prints a generic message.' }, example: '- name: Print the gateway for each host when defined\n  ansible.builtin.debug:\n    msg: System {{ inventory_hostname }} has gateway {{ ansible_default_ipv4.gateway }}' },
};
DOCS.systemd = { ...DOCS.service, short: 'Manage systemd units' };

export const knownModules = () => Object.keys(DOCS).sort();
