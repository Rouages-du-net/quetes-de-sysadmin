// Story "The Fleet" — chapter "The Rehearsal": a risky change (no more
// password for SSH) rehearsed before being played for real: --check --diff,
// then --limit on one centre, then all of them. Théo's playbook notifies
// "Reload ssh", but the handler is called "reload ssh"; and once the file
// has changed, a new run notifies nothing any more: sshd keeps the old
// configuration until it is reloaded.
// Commands: ansible-playbook --check --diff, --limit, handlers, ansible -m
// service, sshd -T (on a centre).
// Objective checked on the state: on all three centres, sshd_config says
// PasswordAuthentication no and sshd has loaded it; the last complete run
// changed nothing.
// Sources: https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_checkmode.html,
// https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_handlers.html

import { f, type Chapter } from '../world';
import type { Game, Shell } from '../shell';
import { readConfig } from '../sshd';
import { history } from '../commands/ansible';
import { centre, pilotAccounts, pilotState, idempotent, M, pilotWorld, NAMES, onCentre } from './fleet';
import { CFG, INVENTORY } from './playbook';

const centreState = (n: string) => centre(n, { motd: (t) => `${t('playbook-line-motd')}\n`, share: true, packages: ['htop'] });
const ditFile = (h: Shell) => readConfig(h).values.passwordauthentication;
const ditLoad = (h: Shell) => (h.state.sshd?.load as Record<string, string> | undefined)?.passwordauthentication;
const executions = (j: Game) => history(j as Shell).executions;
const seen = (j: Game, text: string) => j.last.output.includes(text) || j.last.errors.some((e) => e.includes(text));

export const rehearsal: Chapter = {
  id: 'rehearsal',
  number: 3,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'cp', 'nano', 'sudo', 'id', 'whoami', 'ssh', 'exit', 'ansible', 'ansible-playbook', 'ansible-inventory', 'ansible-doc'],
  home: M,
  welcome: 'note_from_theo.txt',
  names: true,
  final: 'end',
  steps: ['rehearsal', 'handler', 'canary', 'end'],
  password: 'districts-2027',
  accounts: pilotAccounts,
  hosts: Object.fromEntries(NAMES.map((n) => [n, centreState(n)])),
  state: pilotState,
  createWorld: (t) =>
    pilotWorld(t, {
      known: NAMES,
      ansible: {
        'ansible.cfg': f(CFG, { lines: true }),
        'inventory.ini': f(INVENTORY, { lines: true }),
        'site.yml': f(t('rehearsal-site-yml'), { lines: true }),
        'ssh.yml': f(t('rehearsal-ssh-yml'), { lines: true }),
      },
      home: { 'note_from_theo.txt': f(t('rehearsal-note-theo')) },
    }),
  events: [
    { id: 'rehearsal', condition: (j) => executions(j).some((e) => e.check), message: (j) => j.t('rehearsal-event-rehearsal') },
    { id: 'handler', condition: (j) => seen(j, 'The requested handler'), message: (j) => j.t('rehearsal-event-handler') },
    {
      id: 'canary',
      condition: (j) => executions(j).some((e) => !e.check && !!e.limit && Object.values(e.changes).some((l) => l.includes('/etc/ssh/sshd_config'))),
      message: (j) => j.t('rehearsal-event-canary'),
    },
    {
      id: 'not-reload',
      condition: (j) => NAMES.some((n) => ditFile(onCentre(j, n)) === 'no' && ditLoad(onCentre(j, n)) !== 'no'),
      message: (j) => j.t('rehearsal-event-not-reload'),
    },
    {
      id: 'end',
      condition: (j) => NAMES.every((n) => ditFile(onCentre(j, n)) === 'no' && ditLoad(onCentre(j, n)) === 'no') && idempotent(j),
      message: (j) => j.t('rehearsal-event-end'),
    },
  ],
};
