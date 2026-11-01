// Histoire « La flotte » — chapitre « L'inventaire » : Ansible joint-il les
// trois maisons de quartier ? Théo a commencé ~/ansible : un ansible.cfg
// (remote_user = theo, alors que le compte des centres est deploy) et un
// inventaire où manque east. Et known_hosts est vide : Ansible ne pose pas
// de question, il refuse (« Host key verification failed »).
// Commandes : cd, ansible centres -m ping, ansible-inventory --graph, ssh
// (accepter la clé d'hôte), nano (remote_user, l'inventaire).
// Objectif vérifié sur l'état : le groupe centres de l'inventaire contient
// north, south et east, et le dernier ping les a tous joints.
// Sources : https://docs.ansible.com/ansible/latest/inventory_guide/intro_inventory.html,
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

// Les hôtes du groupe centres, tels qu'Ansible les lit depuis ~/ansible.
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
  final: 'fin',
  steps: ['cle-hote', 'compte', 'manque', 'fin'],
  password: 'districts-2027',
  accounts: pilotAccounts,
  hosts: Object.fromEntries(NAMES.map((n) => [n, centre(n)])),
  state: pilotState,
  createWorld: (t) =>
    pilotWorld(t, {
      known: [],
      ansible: { 'ansible.cfg': f(CFG, { lines: true }), 'inventory.ini': f(INVENTORY, { lines: true }) },
      home: { 'email_theo.txt': f(t('inventory-courriel-theo')) },
    }),
  events: [
    { id: 'sans-config', condition: (j) => seen(j, 'No inventory was parsed'), message: (j) => j.t('inventory-evenement-sans-config') },
    { id: 'cle-hote', condition: (j) => seen(j, 'Host key verification failed'), message: (j) => j.t('inventory-evenement-cle-hote') },
    { id: 'compte', condition: (j) => seen(j, 'theo@') && seen(j, 'Permission denied'), message: (j) => j.t('inventory-evenement-compte') },
    {
      id: 'manque',
      condition: (j) => {
        const p = lastPing(j);
        const listing = Object.keys(p);
        return listing.length > 0 && listing.every((h) => p[h] === 'SUCCESS') && !NAMES.every((n) => n in p);
      },
      message: (j) => j.t('inventory-evenement-manque'),
    },
    {
      id: 'fin',
      condition: (j) => {
        const p = lastPing(j);
        return NAMES.every((n) => inventoryCentres(j).includes(n) && p[n] === 'SUCCESS');
      },
      message: (j) => j.t('inventory-evenement-fin'),
    },
  ],
};
