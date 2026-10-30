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

import { f, type Chapitre } from '../monde';
import type { Jeu, Shell } from '../shell';
import { lireConfig } from '../sshd';
import { historique } from '../commandes/ansible';
import { centre, comptesPilote, etatPilote, idempotent, M, mondePilote, NOMS, surCentre } from './flotte';
import { CFG, INVENTAIRE } from './playbook';

const etatCentre = (n: string) => centre(n, { motd: (t) => `${t('playbook-ligne-motd')}\n`, partage: true, paquets: ['htop'] });
const fichierDit = (h: Shell) => lireConfig(h).valeurs.passwordauthentication;
const chargeDit = (h: Shell) => (h.etat.sshd?.charge as Record<string, string> | undefined)?.passwordauthentication;
const executions = (j: Jeu) => historique(j as Shell).executions;
const vu = (j: Jeu, texte: string) => j.derniere.sortie.includes(texte) || j.derniere.erreurs.some((e) => e.includes(texte));

export const repetition: Chapitre = {
  id: 'repetition',
  numero: 3,
  commandes: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'cp', 'nano', 'sudo', 'id', 'whoami', 'ssh', 'exit', 'ansible', 'ansible-playbook', 'ansible-inventory', 'ansible-doc'],
  maison: M,
  accueil: 'note_de_theo.txt',
  noms: true,
  final: 'fin',
  etapes: ['repetition', 'gestionnaire', 'canari', 'fin'],
  motDePasse: 'quartiers-2027',
  comptes: comptesPilote,
  hotes: Object.fromEntries(NOMS.map((n) => [n, etatCentre(n)])),
  etat: etatPilote,
  creerMonde: (t) =>
    mondePilote(t, {
      connus: NOMS,
      ansible: {
        'ansible.cfg': f(CFG, { lignes: true }),
        'inventory.ini': f(INVENTAIRE, { lignes: true }),
        'site.yml': f(t('repetition-site-yml'), { lignes: true }),
        'ssh.yml': f(t('repetition-ssh-yml'), { lignes: true }),
      },
      maison: { 'note_de_theo.txt': f(t('repetition-note-theo')) },
    }),
  evenements: [
    { id: 'repetition', condition: (j) => executions(j).some((e) => e.verifier), message: (j) => j.t('repetition-evenement-repetition') },
    { id: 'gestionnaire', condition: (j) => vu(j, 'The requested handler'), message: (j) => j.t('repetition-evenement-gestionnaire') },
    {
      id: 'canari',
      condition: (j) => executions(j).some((e) => !e.verifier && !!e.limite && Object.values(e.changes).some((l) => l.includes('/etc/ssh/sshd_config'))),
      message: (j) => j.t('repetition-evenement-canari'),
    },
    {
      id: 'pas-recharge',
      condition: (j) => NOMS.some((n) => fichierDit(surCentre(j, n)) === 'no' && chargeDit(surCentre(j, n)) !== 'no'),
      message: (j) => j.t('repetition-evenement-pas-recharge'),
    },
    {
      id: 'fin',
      condition: (j) => NOMS.every((n) => fichierDit(surCentre(j, n)) === 'no' && chargeDit(surCentre(j, n)) === 'no') && idempotent(j),
      message: (j) => j.t('repetition-evenement-fin'),
    },
  ],
};
