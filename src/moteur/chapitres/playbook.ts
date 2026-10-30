// Histoire « La flotte » — chapitre « Le playbook » : l'idempotence. Lucie a
// écrit site.yml : htop (avec le module apt), le message d'accueil (shell :
// echo >> /etc/motd) et le dossier partagé (command : mkdir). Lancé deux fois
// sur north, il a doublé la ligne du message, puis échoué sur mkdir.
// Commandes : ansible-playbook, ansible-doc, nano (copy ou lineinfile, file),
// ansible -a pour regarder.
// Objectif vérifié sur l'état : sur les trois centres, htop, une seule ligne
// « Ansible » dans /etc/motd, /srv/shared ; et la dernière exécution
// complète du playbook n'a rien changé (changed=0, failed=0).
// Sources : https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_intro.html,
// https://docs.ansible.com/ansible/latest/reference_appendices/glossary.html#term-Idempotency

import { chemin, f, type Chapitre } from '../monde';
import type { Jeu, Shell } from '../shell';
import { historique } from '../commandes/ansible';
import { centre, comptesPilote, DOSSIER, etatPilote, idempotent, M, MOTD_DEBIAN, mondePilote, NOMS, surCentre } from './flotte';

export const CFG = `[defaults]
inventory = inventory.ini
remote_user = deploy`;
export const INVENTAIRE = `[centres]
north
south
east`;

const lignesAnsible = (h: Shell) => (h.lire('/etc/motd') ?? '').split('\n').filter((l) => l.includes('Ansible')).length;
const pret = (j: Jeu, n: string) => {
  const h = surCentre(j, n);
  return !!h.etat.paquets?.htop && lignesAnsible(h) === 1 && h.trouver('/srv/shared')?.type === 'dossier';
};
const executions = (j: Jeu) => historique(j as Shell).executions;

export const playbook: Chapitre = {
  id: 'playbook',
  numero: 2,
  commandes: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'cp', 'nano', 'sudo', 'id', 'whoami', 'ssh', 'exit', 'ansible', 'ansible-playbook', 'ansible-inventory', 'ansible-doc'],
  maison: M,
  accueil: 'message_de_theo.txt',
  noms: true,
  final: 'fin',
  etapes: ['echec', 'modules', 'deuxieme', 'fin'],
  motDePasse: 'quartiers-2027',
  comptes: comptesPilote,
  hotes: {
    // north a reçu le playbook deux fois : la ligne en double, htop et le dossier.
    north: centre('north', { motd: (t) => `${MOTD_DEBIAN}\n${t('playbook-ligne-motd')}\n${t('playbook-ligne-motd')}`, partage: true, paquets: ['htop'] }),
    south: centre('south'),
    east: centre('east'),
  },
  etat: etatPilote,
  creerMonde: (t) =>
    mondePilote(t, {
      connus: NOMS,
      ansible: { 'ansible.cfg': f(CFG, { lignes: true }), 'inventory.ini': f(INVENTAIRE, { lignes: true }), 'site.yml': f(t('playbook-site-yml'), { lignes: true }) },
      maison: { 'message_de_theo.txt': f(t('playbook-message-theo')) },
    }),
  evenements: [
    { id: 'echec', condition: (j) => executions(j).some((e) => Object.values(e.hotes).some((b) => b.failed > 0)), message: (j) => j.t('playbook-evenement-echec') },
    { id: 'doublon', condition: (j) => executions(j).length > 0 && NOMS.some((n) => lignesAnsible(surCentre(j, n)) > 1), message: (j) => j.t('playbook-evenement-doublon') },
    {
      id: 'modules',
      condition: (j) => {
        const texte = j.lire(chemin(j.t, `${DOSSIER}/site.yml`)) ?? '';
        return !/^\s*-?\s*(ansible\.builtin\.)?(shell|command):/m.test(texte);
      },
      message: (j) => j.t('playbook-evenement-modules'),
    },
    {
      id: 'deuxieme',
      condition: (j) => {
        const e = executions(j).at(-1);
        return !!e && !e.verifier && !e.limite && NOMS.every((n) => e.hotes[n] && e.hotes[n].failed === 0 && e.hotes[n].unreachable === 0) && NOMS.some((n) => e.hotes[n].changed > 0);
      },
      message: (j) => j.t('playbook-evenement-deuxieme'),
    },
    { id: 'fin', condition: (j) => NOMS.every((n) => pret(j, n)) && idempotent(j), message: (j) => j.t('playbook-evenement-fin') },
  ],
};
