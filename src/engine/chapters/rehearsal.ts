// Histoire « La flotte » — chapitre « La répétition » : un changement
// risqué (plus de mot de passe pour SSH) répété avant d'être joué :
// --check --diff, puis --limit sur un centre, puis tous. Le playbook de
// Théo notifie « Recharger ssh », mais le handler s'appelle « recharger
// ssh » ; et une fois le fichier changé, une nouvelle exécution ne notifie
// plus rien : sshd garde l'ancienne configuration tant qu'on ne le recharge pas.
// Commandes : ansible-playbook --check --diff, --limit, handlers, ansible -m
// service, sshd -T (sur un centre).
// Objectif vérifié sur l'état : sur les trois centres, sshd_config dit
// PasswordAuthentication no et sshd l'a chargé ; la dernière exécution
// complète n'a rien changé.
// Sources : https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_checkmode.html,
// https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_handlers.html

import { f, type Chapter } from '../world';
import type { Game, Shell } from '../shell';
import { readConfig } from '../sshd';
import { history } from '../commands/ansible';
import { centre, pilotAccounts, pilotState, idempotent, M, pilotWorld, NAMES, onCentre } from './fleet';
import { CFG, INVENTORY } from './playbook';

const centreState = (n: string) => centre(n, { motd: (t) => `${t('playbook-ligne-motd')}\n`, share: true, packages: ['htop'] });
const ditFile = (h: Shell) => readConfig(h).values.passwordauthentication;
const ditLoad = (h: Shell) => (h.state.sshd?.load as Record<string, string> | undefined)?.passwordauthentication;
const executions = (j: Game) => history(j as Shell).executions;
const seen = (j: Game, text: string) => j.last.output.includes(text) || j.last.errors.some((e) => e.includes(text));

export const rehearsal: Chapter = {
  id: 'rehearsal',
  number: 3,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'cp', 'nano', 'sudo', 'id', 'whoami', 'ssh', 'exit', 'ansible', 'ansible-playbook', 'ansible-inventory', 'ansible-doc'],
  home: M,
  welcome: 'note_de_theo.txt',
  names: true,
  final: 'fin',
  steps: ['repetition', 'gestionnaire', 'canari', 'fin'],
  password: 'quartiers-2027',
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
      home: { 'note_de_theo.txt': f(t('rehearsal-note-theo')) },
    }),
  events: [
    { id: 'repetition', condition: (j) => executions(j).some((e) => e.check), message: (j) => j.t('rehearsal-evenement-repetition') },
    { id: 'gestionnaire', condition: (j) => seen(j, 'The requested handler'), message: (j) => j.t('rehearsal-evenement-gestionnaire') },
    {
      id: 'canari',
      condition: (j) => executions(j).some((e) => !e.check && !!e.limit && Object.values(e.changes).some((l) => l.includes('/etc/ssh/sshd_config'))),
      message: (j) => j.t('rehearsal-evenement-canari'),
    },
    {
      id: 'pas-recharge',
      condition: (j) => NAMES.some((n) => ditFile(onCentre(j, n)) === 'no' && ditLoad(onCentre(j, n)) !== 'no'),
      message: (j) => j.t('rehearsal-evenement-pas-recharge'),
    },
    {
      id: 'fin',
      condition: (j) => NAMES.every((n) => ditFile(onCentre(j, n)) === 'no' && ditLoad(onCentre(j, n)) === 'no') && idempotent(j),
      message: (j) => j.t('rehearsal-evenement-fin'),
    },
  ],
};
