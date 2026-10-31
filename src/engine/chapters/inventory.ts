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

import { chemin, f, type Chapitre } from '../world';
import type { Jeu, Shell } from '../shell';
import { hotesDu, lireConfig, lireInventaire } from '../ansible';
import { historique } from '../commands/ansible';
import { centre, comptesPilote, DOSSIER, etatPilote, M, mondePilote, NOMS } from './fleet';

const CFG = `[defaults]
inventory = inventory.ini
remote_user = theo`;
const INVENTAIRE = `[centres]
north
south`;

// Les hôtes du groupe centres, tels qu'Ansible les lit depuis ~/ansible.
function centresInventaire(j: Jeu): string[] {
  const s = j as Shell;
  const cwd = s.cwd;
  s.cwd = chemin(j.t, DOSSIER);
  try {
    const c = lireConfig(s);
    return hotesDu(lireInventaire(s.lire(c.inventaire) ?? ''), 'centres');
  } finally {
    s.cwd = cwd;
  }
}
const dernierPing = (j: Jeu) => historique(j as Shell).pings.at(-1) ?? {};
const vu = (j: Jeu, texte: string) => j.derniere.sortie.includes(texte) || j.derniere.erreurs.some((e) => e.includes(texte));

export const inventaire: Chapitre = {
  id: 'inventaire',
  numero: 1,
  commandes: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'cp', 'nano', 'sudo', 'id', 'whoami', 'ssh', 'exit', 'ansible', 'ansible-inventory', 'ansible-doc'],
  maison: M,
  accueil: 'courriel_theo.txt',
  noms: true,
  final: 'fin',
  etapes: ['cle-hote', 'compte', 'manque', 'fin'],
  motDePasse: 'quartiers-2027',
  comptes: comptesPilote,
  hotes: Object.fromEntries(NOMS.map((n) => [n, centre(n)])),
  etat: etatPilote,
  creerMonde: (t) =>
    mondePilote(t, {
      connus: [],
      ansible: { 'ansible.cfg': f(CFG, { lignes: true }), 'inventory.ini': f(INVENTAIRE, { lignes: true }) },
      maison: { 'courriel_theo.txt': f(t('inventaire-courriel-theo')) },
    }),
  evenements: [
    { id: 'sans-config', condition: (j) => vu(j, 'No inventory was parsed'), message: (j) => j.t('inventaire-evenement-sans-config') },
    { id: 'cle-hote', condition: (j) => vu(j, 'Host key verification failed'), message: (j) => j.t('inventaire-evenement-cle-hote') },
    { id: 'compte', condition: (j) => vu(j, 'theo@') && vu(j, 'Permission denied'), message: (j) => j.t('inventaire-evenement-compte') },
    {
      id: 'manque',
      condition: (j) => {
        const p = dernierPing(j);
        const liste = Object.keys(p);
        return liste.length > 0 && liste.every((h) => p[h] === 'SUCCESS') && !NOMS.every((n) => n in p);
      },
      message: (j) => j.t('inventaire-evenement-manque'),
    },
    {
      id: 'fin',
      condition: (j) => {
        const p = dernierPing(j);
        return NOMS.every((n) => centresInventaire(j).includes(n) && p[n] === 'SUCCESS');
      },
      message: (j) => j.t('inventaire-evenement-fin'),
    },
  ],
};
