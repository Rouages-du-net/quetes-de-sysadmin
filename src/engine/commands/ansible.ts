// Les commandes d'Ansible : ansible (commandes ad-hoc), ansible-playbook,
// ansible-inventory et ansible-doc. Messages d'après ansible-core
// (https://docs.ansible.com/ansible/latest/cli/). Le moteur est dans ansible.ts.
// L'historique des exécutions est gardé dans etat.ansible (pour les histoires).

import type { Shell } from '../shell';
import type { Command } from './index';
import {
  adhoc,
  DOCS,
  AnsibleError,
  hostsFor,
  play,
  readConfig,
  readInventory,
  readPlaybook,
  knownModules,
  moduleFor,
  unknownPattern,
  VERSION,
  type Context,
  type Execution,
  type Inventory,
} from '../ansible';

export interface AnsibleState {
  executions: (Execution & { line: string; limit: string | null })[];
  pings: Record<string, string>[];
}
export const history = (game: Shell): AnsibleState => (game.state.ansible ??= { executions: [], pings: [] });

const LONG_VERSION = (program: string, home: string, config: string | null) =>
  [
    `${program} [core ${VERSION}]`,
    `  config file = ${config ?? 'None'}`,
    `  configured module search path = ['${home}/.ansible/plugins/modules', '/usr/share/ansible/plugins/modules']`,
    '  ansible python module location = /usr/lib/python3/dist-packages/ansible',
    `  ansible collection location = ${home}/.ansible/collections:/usr/share/ansible/collections`,
    `  executable location = /usr/bin/${program}`,
    '  python version = 3.13.5 (main, Jun 25 2025, 18:55:22) [GCC 14.2.0] (/usr/bin/python3)',
    '  jinja version = 3.1.6',
    '  libyaml = True',
  ].join('\n');

// Les options communes : -i inventaire, -u compte, -b (become), --check, --diff, --limit.
function readOptions(args: string[]) {
  const o: { inventory?: string; user?: string; become: boolean; check: boolean; difference: boolean; limit: string | null; rest: string[]; module?: string; arguments?: string; unknown?: string; flags: Set<string> } = {
    become: false,
    check: false,
    difference: false,
    limit: null,
    rest: [],
    flags: new Set(),
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    const value = () => args[++i] ?? '';
    if (a === '-i' || a === '--inventory') o.inventory = value();
    else if (a.startsWith('--inventory=')) o.inventory = a.slice(12);
    else if (a === '-u' || a === '--user') o.user = value();
    else if (a === '-b' || a === '--become') o.become = true;
    else if (a === '-C' || a === '--check') o.check = true;
    else if (a === '-D' || a === '--diff') o.difference = true;
    else if (a === '-l' || a === '--limit') o.limit = value();
    else if (a.startsWith('--limit=')) o.limit = a.slice(8);
    else if (a === '-m' || a === '--module-name') o.module = value();
    else if (a === '-a' || a === '--args') o.arguments = value();
    else if (/^-v+$/.test(a)) continue;
    else if (['--syntax-check', '--list-hosts', '--list-tasks', '--version', '--graph', '--list', '--force-handlers'].includes(a)) o.flags.add(a);
    else if (a.startsWith('-')) o.unknown ??= a;
    else o.rest.push(a);
  }
  return o;
}

// Le contexte : configuration, inventaire (avec les avertissements d'Ansible s'il manque).
function context(game: Shell, o: ReturnType<typeof readOptions>): { c: Context; warnings: string[] } {
  const config = readConfig(game);
  const warnings: string[] = [];
  const path = game.resolve(o.inventory ?? config.inventory);
  let inventory: Inventory;
  // -i nom1,nom2, : une liste d'hôtes directement.
  if (o.inventory?.includes(',')) inventory = readInventory(o.inventory.split(',').filter(Boolean).join('\n'));
  else {
    const text = game.read(path);
    if (text === null) {
      if (o.inventory) warnings.push(`[WARNING]: Unable to parse ${path} as an inventory source`);
      warnings.push('[WARNING]: No inventory was parsed, only implicit localhost is available');
    }
    inventory = readInventory(text ?? '');
  }
  return {
    c: { game, config, inventory, check: o.check, difference: o.difference, outputs: [], sessions: {}, forceUser: o.user, become: o.become },
    warnings,
  };
}

const USAGE_ANSIBLE = `usage: ansible [-h] [--version] [-v] [-b] [--become-method BECOME_METHOD] [-i INVENTORY] [--list-hosts] [-l SUBSET] [-C] [-D] [-u REMOTE_USER] [-a MODULE_ARGS] [-m MODULE_NAME] pattern`;

function ansible(game: Shell, args: string[]): string {
  const o = readOptions(args);
  if (o.flags.has('--version')) return LONG_VERSION('ansible', game.accounts.users[game.who]?.home ?? `/home/${game.who}`, readConfig(game).file);
  if (o.unknown) return game.error(`${USAGE_ANSIBLE}\nansible: error: unrecognized arguments: ${o.unknown}`, 2);
  const pattern = o.rest[0];
  if (!pattern) return game.error(`${USAGE_ANSIBLE}\nansible: error: the following arguments are required: pattern`, 2);
  const { c, warnings } = context(game, o);
  const output = [...warnings];
  const hosts = hostsFor(c.inventory, pattern);
  if (unknownPattern(c.inventory, pattern)) output.push(`[WARNING]: Could not match supplied host pattern, ignoring: ${pattern}`);
  if (o.flags.has('--list-hosts')) return [...output, `  hosts (${hosts.length}):`, ...hosts.map((h) => `    ${h}`)].join('\n');
  if (!hosts.length) {
    output.push('[WARNING]: No hosts matched, nothing to do');
    return game.error(output.join('\n'), 0);
  }
  const raw = o.module ?? 'command';
  const module = moduleFor(raw);
  if (!module) return game.error([...output, `ERROR! couldn't resolve module/action '${raw}'. This often indicates a misspelling, missing collection, or incorrect module path.`].join('\n'), 1);
  if ((module === 'command' || module === 'shell') && !o.arguments) return game.error(`ERROR! No argument passed to ${module} module`, 1);
  const r = adhoc(c, pattern, module, o.arguments ?? '', o.become);
  if (module === 'ping') history(game).pings.push(r.results);
  if (r.code) game.status = r.code;
  return [...output, ...r.lines].join('\n');
}

const USAGE_PLAYBOOK = 'usage: ansible-playbook [-h] [--version] [-v] [-i INVENTORY] [--list-hosts] [-l SUBSET] [-C] [-D] [-u REMOTE_USER] [-b] [--force-handlers] [--syntax-check] [--list-tasks] playbook [playbook ...]';

function playbook(game: Shell, args: string[]): string {
  const o = readOptions(args);
  if (o.flags.has('--version')) return LONG_VERSION('ansible-playbook', game.accounts.users[game.who]?.home ?? `/home/${game.who}`, readConfig(game).file);
  if (o.unknown) return game.error(`${USAGE_PLAYBOOK}\nansible-playbook: error: unrecognized arguments: ${o.unknown}`, 2);
  const file = o.rest[0];
  if (!file) return game.error(`${USAGE_PLAYBOOK}\nansible-playbook: error: the following arguments are required: playbook`, 2);
  const path = game.resolve(file);
  const text = game.read(path);
  if (text === null) return game.error(`ERROR! the playbook: ${file} could not be found`, 1);
  let plays;
  try {
    plays = readPlaybook(text, path);
  } catch (e) {
    if (e instanceof AnsibleError) return game.error(e.message, 4);
    throw e;
  }
  const { c, warnings } = context(game, o);
  if (o.flags.has('--syntax-check')) return [...warnings, '', `playbook: ${file}`].join('\n');
  if (o.flags.has('--list-hosts') || o.flags.has('--list-tasks')) {
    const lines = [...warnings, '', `playbook: ${file}`];
    plays.forEach((p, n) => {
      let hosts = hostsFor(c.inventory, p.hosts);
      if (o.limit) hosts = hosts.filter((h) => hostsFor(c.inventory, o.limit!).includes(h));
      lines.push('', `  play #${n + 1} (${p.hosts}): ${p.name}\tTAGS: []`);
      if (o.flags.has('--list-hosts')) lines.push(`    pattern: ['${p.hosts}']`, `    hosts (${hosts.length}):`, ...hosts.map((h) => `      ${h}`));
      if (o.flags.has('--list-tasks')) lines.push('    tasks:', ...p.tasks.map((t) => `      ${t.name}\tTAGS: []`));
    });
    return lines.join('\n');
  }
  c.outputs.push(...warnings);
  try {
    const { execution, code } = play(c, plays, o.limit, o.flags.has('--force-handlers'));
    history(game).executions.push({ ...execution, file: path, line: args.join(' '), limit: o.limit });
    if (code) game.status = code;
  } catch (e) {
    if (!(e instanceof AnsibleError)) throw e;
    c.outputs.push(e.message);
    game.status = 1;
  }
  return c.outputs.join('\n').replace(/^\n/, '');
}

function inventory(game: Shell, args: string[]): string {
  const o = readOptions(args);
  const { c, warnings } = context(game, o);
  const inv = c.inventory;
  if (o.flags.has('--graph')) {
    const groups = Object.keys(inv.groups).filter((g) => g !== 'all' && (g !== 'ungrouped' || inv.groups[g].length || true));
    const lines = ['@all:'];
    for (const g of ['ungrouped', ...groups.filter((x) => x !== 'ungrouped')]) {
      lines.push(`  |--@${g}:`);
      for (const h of inv.groups[g] ?? []) lines.push(`  |  |--${h}`);
    }
    return [...warnings, ...lines].join('\n');
  }
  if (o.flags.has('--list')) {
    const json: Record<string, unknown> = {
      _meta: { hostvars: Object.fromEntries(inv.order.map((h) => [h, inv.hosts[h]])) },
      all: { children: ['ungrouped', ...Object.keys(inv.groups).filter((g) => g !== 'all' && g !== 'ungrouped')] },
    };
    for (const [g, l] of Object.entries(inv.groups)) if (g !== 'all' && l.length) json[g] = { hosts: l };
    return [...warnings, JSON.stringify(json, null, 4)].join('\n');
  }
  return game.error('usage: ansible-inventory [-h] [--version] [-v] [-i INVENTORY] [--list] [--host HOST] [--graph] [group]\nansible-inventory: error: No action selected, at least one of --host, --graph or --list needs to be specified.', 2);
}

function doc(game: Shell, args: string[]): string {
  if (args.includes('-l') || args.includes('--list'))
    return knownModules()
      .map((m) => `ansible.builtin.${m.padEnd(20)} ${DOCS[m].short}`)
      .join('\n');
  const name = args.find((a) => !a.startsWith('-'));
  if (!name) return game.error('usage: ansible-doc [-h] [--version] [-v] [-l] [-s] [plugin ...]\nansible-doc: error: Incorrect options passed', 5);
  const m = moduleFor(name);
  if (!m || !DOCS[m]) return game.error(`[WARNING]: module ${name} not found in:\n/home/${game.who}/.ansible/plugins/modules:/usr/share/ansible/plugins/modules:/usr/lib/python3/dist-packages/ansible/modules`, 1);
  const d = DOCS[m];
  return [
    `> ANSIBLE.BUILTIN.${m.toUpperCase()}    (/usr/lib/python3/dist-packages/ansible/modules/${m}.py)`,
    '',
    `  ${d.short}`,
    '',
    'OPTIONS (= indicates it is required):',
    '',
    ...Object.entries(d.options).flatMap(([k, v]) => [`${v.includes('(required)') ? '=' : '-'} ${k}`, `        ${v.replace(' (required)', '')}`, '']),
    'EXAMPLES:',
    '',
    d.example,
  ].join('\n');
}

export const ANSIBLE: Record<string, Command> = {
  ansible: { ownOptions: true, launch: ({ args, game }) => ansible(game, args) },
  'ansible-playbook': { ownOptions: true, launch: ({ args, game }) => playbook(game, args) },
  'ansible-inventory': { ownOptions: true, launch: ({ args, game }) => inventory(game, args) },
  'ansible-doc': { ownOptions: true, launch: ({ args, game }) => doc(game, args) },
};
