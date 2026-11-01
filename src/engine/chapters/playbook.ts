// Story "The Fleet", chapter "The Playbook": idempotence. Lucie wrote
// site.yml: htop (with the apt module), the welcome message (shell:
// echo >> /etc/motd) and the shared directory (command: mkdir). Run twice
// on north, it doubled the message's line, then failed on mkdir.
// Commands: ansible-playbook, ansible-doc, nano (copy or lineinfile, file),
// ansible -a to look.
// Objective checked on the state: on all three centres, htop, a single
// "Ansible" line in /etc/motd, /srv/shared; and the last complete run of
// the playbook changed nothing (changed=0, failed=0).
// Sources: https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_intro.html,
// https://docs.ansible.com/ansible/latest/reference_appendices/glossary.html#term-Idempotency

import { path, f, type Chapter } from '../world';
import type { Game, Shell } from '../shell';
import { history } from '../commands/ansible';
import { centre, pilotAccounts, DIRECTORY, pilotState, idempotent, M, MOTD_DEBIAN, pilotWorld, NAMES, onCentre } from './fleet';

export const CFG = `[defaults]
inventory = inventory.ini
remote_user = deploy`;
export const INVENTORY = `[centres]
north
south
east`;

const ansibleLines = (h: Shell) => (h.read('/etc/motd') ?? '').split('\n').filter((l) => l.includes('Ansible')).length;
const ready = (j: Game, n: string) => {
  const h = onCentre(j, n);
  return !!h.state.packages?.htop && ansibleLines(h) === 1 && h.find('/srv/shared')?.type === 'directory';
};
const executions = (j: Game) => history(j as Shell).executions;

export const playbook: Chapter = {
  id: 'playbook',
  number: 2,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'cp', 'nano', 'sudo', 'id', 'whoami', 'ssh', 'exit', 'ansible', 'ansible-playbook', 'ansible-inventory', 'ansible-doc'],
  home: M,
  welcome: 'message_from_theo.txt',
  names: true,
  final: 'end',
  steps: ['failure', 'modules', 'second', 'end'],
  password: 'districts-2027',
  accounts: pilotAccounts,
  hosts: {
    // north received the playbook twice: the duplicated line, htop and the directory.
    north: centre('north', { motd: (t) => `${MOTD_DEBIAN}\n${t('playbook-line-motd')}\n${t('playbook-line-motd')}`, share: true, packages: ['htop'] }),
    south: centre('south'),
    east: centre('east'),
  },
  state: pilotState,
  createWorld: (t) =>
    pilotWorld(t, {
      known: NAMES,
      ansible: { 'ansible.cfg': f(CFG, { lines: true }), 'inventory.ini': f(INVENTORY, { lines: true }), 'site.yml': f(t('playbook-site-yml'), { lines: true }) },
      home: { 'message_from_theo.txt': f(t('playbook-message-theo')) },
    }),
  events: [
    { id: 'failure', condition: (j) => executions(j).some((e) => Object.values(e.hosts).some((b) => b.failed > 0)), message: (j) => j.t('playbook-event-failure') },
    { id: 'duplicate', condition: (j) => executions(j).length > 0 && NAMES.some((n) => ansibleLines(onCentre(j, n)) > 1), message: (j) => j.t('playbook-event-duplicate') },
    {
      id: 'modules',
      condition: (j) => {
        const text = j.read(path(j.t, `${DIRECTORY}/site.yml`)) ?? '';
        return !/^\s*-?\s*(ansible\.builtin\.)?(shell|command):/m.test(text);
      },
      message: (j) => j.t('playbook-event-modules'),
    },
    {
      id: 'second',
      condition: (j) => {
        const e = executions(j).at(-1);
        return !!e && !e.check && !e.limit && NAMES.every((n) => e.hosts[n] && e.hosts[n].failed === 0 && e.hosts[n].unreachable === 0) && NAMES.some((n) => e.hosts[n].changed > 0);
      },
      message: (j) => j.t('playbook-event-second'),
    },
    { id: 'end', condition: (j) => NAMES.every((n) => ready(j, n)) && idempotent(j), message: (j) => j.t('playbook-event-end') },
  ],
};
