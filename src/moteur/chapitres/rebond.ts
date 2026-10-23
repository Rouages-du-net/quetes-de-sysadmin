// Histoire « La Maison des associations » — chapitre « Le rebond » : le
// wiki n'est joignable que depuis la passerelle. Gaspard s'y connectait en
// deux temps (ssh maison, puis ssh wiki), avec une copie de sa clé privée
// sur maison. Rebondir depuis son poste (ssh -J maison wiki), sans laisser
// de clé privée sur la passerelle, puis écrire le raccourci (ProxyJump dans
// ~/.ssh/config) pour que « ssh wiki » suffise.
// Objectif vérifié sur l'état : une connexion par clé au wiki, un bloc Host
// de ~/.ssh/config du poste qui y mène en rebondissant par maison (vérifié
// au sens de ssh : HostName résolu par maison, ProxyJump), et aucune clé
// privée dans ~/.ssh de maison.
// Sources : https://man.openbsd.org/ssh#J, https://man.openbsd.org/ssh_config#ProxyJump

import { chemin, d, f, type Chapitre, type Dossier } from '../monde';
import type { Jeu, Shell } from '../shell';
import { configuration, resoudreNom } from '../acces';
import { chargerSshd, comptesMaison, connexionsPar, dossierSsh, etatMaison, hoteInterne, M, mondeMaison, MOT_DE_PASSE, planMaison } from './maison';

const WIKI = '10.20.0.11';
const COMMANDES_INTERNES = ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'id', 'whoami', 'hostname'];

const poste = (j: Jeu) => (j.etat.poste as (() => Shell) | undefined)?.();
const wiki = (j: Jeu) => (j as Shell).interne('wiki');
const connexionsAuWiki = (j: Jeu) => (wiki(j) ? connexionsPar(wiki(j)!, 'cle') : 0);

// Les noms écrits dans un bloc Host de ~/.ssh/config du poste (sans jokers).
function alias(p: Shell): string[] {
  return (p.lire('~/.ssh/config') ?? '')
    .split('\n')
    .map((l) => l.trim().split(/\s+/))
    .filter(([cle]) => cle?.toLowerCase() === 'host')
    .flatMap(([, ...noms]) => noms.filter((n) => !/[*?!]/.test(n)));
}

// Un raccourci du poste qui mène au wiki en rebondissant par maison.
const raccourci = (j: Jeu) => {
  const p = poste(j);
  if (!p) return false;
  return alias(p).some((a) => {
    const c = configuration(p, a);
    const saut = c.proxyjump?.[0]?.split(',').at(-1)?.split('@').at(-1);
    if (!saut || !['maison', 'maison.internal', '192.0.2.19'].includes(saut)) return false;
    return resoudreNom(j as Shell, (c.hostname?.[0] ?? a).toLowerCase()) === WIKI;
  });
};

// Une clé privée laissée dans ~/.ssh de maison.
const clePriveeSurMaison = (j: Jeu) => {
  const ssh = j.trouver(chemin(j.t, `${M}/.ssh`)) as Dossier | null;
  if (ssh?.type !== 'dossier') return false;
  return Object.keys(ssh.enfants).some((n) => (j.lire(`${chemin(j.t, M)}/.ssh/${n}`) ?? '').includes('PRIVATE KEY'));
};

export const rebond: Chapitre = {
  id: 'rebond',
  numero: 2,
  plan: planMaison(),
  commandes: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'id', 'whoami', 'hostname', 'chmod', 'rm', 'nano', 'ssh'],
  maison: M,
  accueil: 'courriel_yasmine.txt',
  noms: true,
  final: 'fin',
  motDePasse: MOT_DE_PASSE,
  comptes: comptesMaison,
  clesDuJoueur: true,
  surveillePoste: true,
  etat: () => etatMaison(),
  initialiser: chargerSshd,
  hotes: {
    wiki: hoteInterne('wiki', WIKI, {
      commandes: COMMANDES_INTERNES,
      maison: (t) => ({ 'note_gaspard.txt': f(t('rebond-note-gaspard')) }),
      plus: (t) => ({ srv: d({ wiki: d({ pages: d({ 'accueil.md': f(t('rebond-wiki-accueil')) }) }) }, undefined, { proprio: 'root' }) }),
    }),
    archives: hoteInterne('archives', '10.20.0.12', { commandes: COMMANDES_INTERNES }),
  },
  creerMonde: (t) => mondeMaison({ motsDePasse: 'no', maison: { 'courriel_yasmine.txt': f(t('rebond-courriel-yasmine')), '.ssh': dossierSsh() } }),
  evenements: [
    { id: 'cle-privee', condition: clePriveeSurMaison, message: (j) => j.t('rebond-evenement-cle-privee') },
    { id: 'au-wiki', condition: (j) => connexionsAuWiki(j) > 0 && !clePriveeSurMaison(j), message: (j) => j.t('rebond-evenement-au-wiki') },
    { id: 'raccourci', condition: raccourci, message: (j) => j.t('rebond-evenement-raccourci') },
    {
      id: 'fin',
      condition: (j) => j.drapeaux.has('raccourci') && raccourci(j) && connexionsAuWiki(j) > 0 && !clePriveeSurMaison(j),
      message: (j) => j.t('rebond-evenement-fin'),
    },
  ],
};
