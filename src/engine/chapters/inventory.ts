// Story "The Fleet" — chapter "The inventory": does Ansible reach the three
// community centres? Théo started ~/ansible: an ansible.cfg (remote_user =
// theo, whereas the centres' account is deploy) and an inventory missing
// east. And known_hosts is empty: Ansible asks no question, it refuses
// ("Host key verification failed").
// Commands: cd, ansible centres -m ping, ansible-inventory --graph, ssh
// (accept the host key), nano (remote_user, the inventory).
// Objective checked on the state: the inventory's centres group contains
// north, south and east, and the last ping reached them all.
// Sources: https://docs.ansible.com/ansible/latest/inventory_guide/intro_inventory.html,
// https://docs.ansible.com/ansible/latest/inventory_guide/connection_details.html

import { path, f, type Chapter } from '../world';
import type { Game, Shell } from '../shell';
import { hostsFor, readConfig, readInventory } from '../ansible';
import { history } from '../commands/ansible';
import { centre, pilotAccounts, DIRECTORY, pilotState, M, pilotWorld, NAMES } from './fleet';

const CFG = `[defaults]
inventory = inventory.ini
remote_user = theo`;
const INVENTORY = `[centres]
north
south`;

// The hosts of the centres group, as Ansible reads them from ~/ansible.
function inventoryCentres(j: Game): string[] {
  const s = j as Shell;
  const cwd = s.cwd;
  s.cwd = path(j.t, DIRECTORY);
  try {
    const c = readConfig(s);
    return hostsFor(readInventory(s.read(c.inventory) ?? ''), 'centres');
  } finally {
    s.cwd = cwd;
  }
}
const lastPing = (j: Game) => history(j as Shell).pings.at(-1) ?? {};
const seen = (j: Game, text: string) => j.last.output.includes(text) || j.last.errors.some((e) => e.includes(text));

export const inventory: Chapter = {
  id: 'inventory',
  number: 1,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'cp', 'nano', 'sudo', 'id', 'whoami', 'ssh', 'exit', 'ansible', 'ansible-inventory', 'ansible-doc'],
  home: M,
  welcome: 'email_theo.txt',
  names: true,
  final: 'end',
  steps: ['key-host', 'account', 'missing', 'end'],
  password: 'districts-2027',
  accounts: pilotAccounts,
  hosts: Object.fromEntries(NAMES.map((n) => [n, centre(n)])),
  state: pilotState,
  createWorld: (t) =>
    pilotWorld(t, {
      known: [],
      ansible: { 'ansible.cfg': f(CFG, { lines: true }), 'inventory.ini': f(INVENTORY, { lines: true }) },
      home: { 'email_theo.txt': f(t('inventory-email-theo')) },
    }),
  events: [
    { id: 'without-config', condition: (j) => seen(j, 'No inventory was parsed'), message: (j) => j.t('inventory-event-without-config') },
    { id: 'key-host', condition: (j) => seen(j, 'Host key verification failed'), message: (j) => j.t('inventory-event-key-host') },
    { id: 'account', condition: (j) => seen(j, 'theo@') && seen(j, 'Permission denied'), message: (j) => j.t('inventory-event-account') },
    {
      id: 'missing',
      condition: (j) => {
        const p = lastPing(j);
        const listing = Object.keys(p);
        return listing.length > 0 && listing.every((h) => p[h] === 'SUCCESS') && !NAMES.every((n) => n in p);
      },
      message: (j) => j.t('inventory-event-missing'),
    },
    {
      id: 'end',
      condition: (j) => {
        const p = lastPing(j);
        return NAMES.every((n) => inventoryCentres(j).includes(n) && p[n] === 'SUCCESS');
      },
      message: (j) => j.t('inventory-event-end'),
    },
  ],
};
