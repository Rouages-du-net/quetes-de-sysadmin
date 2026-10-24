// Histoire « Les Archives » — chapitre « Les versions » : restic. Depuis
// janvier, la bibliothèque sauvegarde son fonds chaque nuit avec restic, sur
// le disque partagé de la mairie (/mnt/mairie). Il y a quatre nuits, un
// script de « correction » automatique a abîmé la transcription du journal
// de Marie ; les sauvegardes suivantes ont fidèlement gardé la version
// abîmée. Il faut retrouver la bonne version dans un instantané plus ancien,
// la restaurer, puis faire de la place sur le disque (forget --prune), sans
// jeter la bonne version, vérifier le dépôt (check), et protéger le fichier
// du mot de passe.
// Objectif vérifié sur l'état : le journal est revenu à l'identique, le
// fichier du mot de passe n'est plus lisible par les autres comptes, le
// disque a retrouvé de la place, et le dépôt a été vérifié après.
// Sources : https://restic.readthedocs.io/en/stable/045_working_with_repos.html,
// https://restic.readthedocs.io/en/stable/050_restore.html,
// https://restic.readthedocs.io/en/stable/060_forget.html

import { motDePasse, chemin, d, f, type Chapitre, type Fichier } from '../monde';
import type { Jeu, Shell } from '../shell';
import type { Traduire } from '../../textes';
import { ajouterInstantane, ecrireDepot, hex, tailleDepot, type Depot, type Version } from '../commandes/restic';

const M = '/home/vous';
const FONDS = `${M}/fonds`;
const DEPOT = '/mnt/mairie/restic-bibliotheque';
const MDP = `${M}/.config/restic/mot-de-passe`;
const MOT_DE_PASSE = 'lanterne-papier-cerisier-41';
const JOURNAL = `${FONDS}/manuscrits/journal_de_marie.txt`;
const Mo = 1024 * 1024;
const CAPACITE = 1800 * Mo;
// L'heure d'une sauvegarde : chaque nuit à 23 h 30 (heure de la machine).
const nuit = (jour: number) => Date.UTC(2027, 0, jour, 23, 30, 2);
// Le script de « correction » est passé dans la nuit du 1er au 2 février, à 2 h.
const CORRECTION = Date.UTC(2027, 1, 2, 2, 0, 13);

const texte = (contenu: string, modifie: number): Version => ({ contenu, taille: new TextEncoder().encode(contenu).length, modifie });
const media = (description: string, mo: number, modifie: number): Version => ({ contenu: description, taille: Math.round(mo * Mo), modifie });

// Le fonds tel qu'il était un jour donné (jour de janvier ; 32 = 1er février…),
// avec les noms français : le monde est créé ainsi (puis renommé), et les
// instantanés prennent les chemins dans la langue (fondsTraduit).
function fonds(t: Traduire, jour: number): Record<string, Version> {
  const base = FONDS;
  const avant = Date.UTC(2026, 11, 14, 16, 2, 0);
  const v: Record<string, Version> = {
    [`${base}/lisezmoi.txt`]: texte(t('archives-lisezmoi'), avant),
    [`${base}/manuscrits/journal_de_marie.txt`]: jour >= 33 ? texte(t('versions-journal-abime'), CORRECTION) : texte(t('versions-journal'), avant),
    [`${base}/manuscrits/lettres_1914.txt`]: texte(t('archives-lettres-1914'), avant),
    [`${base}/manuscrits/recettes_du_quartier.txt`]:
      jour >= 20
        ? texte(`${t('archives-recettes-du-quartier')}\n${t('versions-recette-ajoutee')}`, Date.UTC(2027, 0, 20, 11, 15, 0))
        : texte(t('archives-recettes-du-quartier'), avant),
    [`${base}/cartes/plan_1890.png`]: media(t('archives-image-png'), 6, avant),
    [`${base}/cartes/plan_1954.png`]: media(t('archives-image-png'), 5, avant),
    [`${base}/presse/gazette_1936.pdf`]: media(t('archives-document-pdf'), 4, avant),
    [`${base}/presse/gazette_1968.pdf`]: media(t('archives-document-pdf'), 4.5, avant),
    [`${base}/enregistrements/chants_du_marche.ogg`]: media(t('archives-son-ogg'), 12, avant),
    [`${base}/enregistrements/entretien_fatou.ogg`]: media(t('archives-son-ogg'), 15, avant),
  };
  // Du 8 au 14 janvier, les numérisations brutes (énormes) attendaient d'être traitées.
  if (jour >= 8 && jour <= 14)
    for (const n of [1, 2, 3])
      v[`${base}/numerisations/brut_registre_${n}.tiff`] = media(t('versions-image-tiff'), 540, Date.UTC(2027, 0, 8, 10, n, 0));
  if (jour >= 15)
    for (const n of [1, 2, 3]) v[`${base}/numerisations/registre_${n}.png`] = media(t('archives-image-png'), 3, Date.UTC(2027, 0, 15, 9, n, 0));
  return v;
}

// Le fonds d'un jour, rangé sous ses chemins dans la langue (/home/you/collection…).
const fondsTraduit = (t: Traduire, jour: number) => Object.fromEntries(Object.entries(fonds(t, jour)).map(([c, v]) => [chemin(t, c), v]));

// Trente nuits de sauvegardes, du 7 janvier au 5 février.
function depotInitial(t: Traduire): Depot {
  const depot: Depot = { id: hex('depot-bibliotheque'), motDePasse: motDePasse(t, MOT_DE_PASSE), instantanes: [], packs: [], verifie: true, aElaguer: false };
  for (let jour = 7; jour <= 36; jour++)
    ajouterInstantane(depot, { id: hex(`instantane-${jour}`), temps: nuit(jour), hote: 'bibliotheque', chemins: [chemin(t, FONDS)], fichiers: fondsTraduit(t, jour) });
  depot.verifie = true;
  return depot;
}

const shell = (j: Jeu) => j as Shell;
const depot = (j: Jeu): Depot => j.etat.restic[chemin(j.t, DEPOT)];
const restaure = (j: Jeu) => j.lire(chemin(j.t, JOURNAL)) === j.t('versions-journal');
// Le fichier du mot de passe : lisible par les autres comptes de la machine ?
const mdpOuvert = (j: Jeu) => {
  const n = j.trouver(chemin(j.t, MDP));
  return !!n && j.peut(n, 'r', 'rosa');
};
const bonneVersionGardee = (j: Jeu) => depot(j).instantanes.some((s) => s.fichiers[chemin(j.t, JOURNAL)]?.contenu === j.t('versions-journal'));
const libre = (j: Jeu) => tailleDepot(depot(j)) < CAPACITE * 0.6;

export const versions: Chapitre = {
  id: 'versions',
  numero: 2,
  commandes: [
    'ls',
    'cd',
    'pwd',
    'cat',
    'less',
    'head',
    'tail',
    'grep',
    'cp',
    'mv',
    'rm',
    'mkdir',
    'chmod',
    'du',
    'df',
    'find',
    'id',
    'whoami',
    'restic',
  ],
  maison: M,
  accueil: 'mot_de_rosa.txt',
  noms: true,
  final: 'fin',
  comptes: () => ({
    utilisateurs: { root: { uid: 0, groupe: 'root', maison: '/root' }, vous: { uid: 1000, groupe: 'vous' }, rosa: { uid: 1001, groupe: 'rosa' } },
    groupes: { root: { gid: 0, membres: [] }, vous: { gid: 1000, membres: [] }, rosa: { gid: 1001, membres: [] } },
  }),
  etat: (t) => ({
    restic: { [chemin(t, DEPOT)]: depotInitial(t) },
    // L'heure des prochaines sauvegardes à la main : samedi 6 février, 9 h 40.
    resticHorloge: Date.UTC(2027, 1, 6, 9, 40, 0),
    montages: [
      { chemin: chemin(t, '/mnt/mairie'), capacite: CAPACITE, nom: `mairie.example:${chemin(t, '/partage/sauvegardes')}` },
      { chemin: '/', capacite: 20 * 1024 * Mo, nom: '/dev/sda1' },
    ],
  }),
  // Les fichiers du dépôt sur le disque, d'après son contenu.
  initialiser: (j) => ecrireDepot(shell(j), chemin(j.t, DEPOT), depot(j)),
  creerMonde: (t) => {
    const actuel = fonds(t, 37);
    const lieux: Record<string, Record<string, Fichier>> = {};
    for (const [chemin, v] of Object.entries(actuel)) {
      const relatif = chemin.slice(FONDS.length + 1).split('/');
      const lieu = relatif.length > 1 ? relatif[0] : '';
      const fichier = f(v.contenu, { lignes: true, taille: v.contenu.length === v.taille ? undefined : v.taille });
      (lieux[lieu] ??= {})[relatif.at(-1)!] = fichier;
    }
    const { '': racineFonds, ...sousLieux } = lieux;
    return d({
      home: d({
        vous: d({
          'mot_de_rosa.txt': f(t('versions-mot-de-rosa')),
          'notes_restic.txt': f(t('versions-notes-restic')),
          '.config': d({ restic: d({ 'mot-de-passe': f(motDePasse(t, MOT_DE_PASSE), { lignes: true }) }) }),
          fonds: d({ ...racineFonds, ...Object.fromEntries(Object.entries(sousLieux).map(([nom, enfants]) => [nom, d(enfants)])) }),
        }),
        rosa: d({}, undefined, { proprio: 'rosa', mode: 'rwx------' }),
      }),
      mnt: d({ mairie: d({ 'restic-bibliotheque': d({}, undefined, { mode: 'rwx------' }) }) }, undefined, { proprio: 'root' }),
      tmp: d({}, undefined, { proprio: 'root', mode: 'rwxrwxrwx' }),
    });
  },
  evenements: [
    {
      id: 'mot-de-passe',
      condition: (j) => !!j.etat.resticFichierMdp && mdpOuvert(j),
      message: (j) => j.t('versions-evenement-mot-de-passe', { fichier: chemin(j.t, MDP) }),
    },
    {
      id: 'mauvais-mot-de-passe',
      condition: (j) => j.etat.resticMauvaisMdp === true,
      message: (j) => j.t('versions-evenement-mauvais-mot-de-passe'),
    },
    {
      id: 'ailleurs',
      condition: (j) => !restaure(j) && trouverRestaurationAilleurs(j),
      message: (j) => j.t('versions-evenement-ailleurs'),
    },
    {
      id: 'restaure',
      condition: restaure,
      message: (j) => j.t('versions-evenement-restaure'),
    },
    {
      id: 'perdu',
      condition: (j) => !restaure(j) && !bonneVersionGardee(j),
      message: (j) => j.t('versions-evenement-perdu'),
    },
    {
      id: 'oublie-sans-prune',
      condition: (j) => j.etat.resticOublie === true && depot(j).aElaguer,
      message: (j) => j.t('versions-evenement-oublie-sans-prune'),
    },
    {
      id: 'place',
      condition: libre,
      message: (j) => j.t('versions-evenement-place'),
    },
    {
      id: 'fin',
      condition: (j) => restaure(j) && !mdpOuvert(j) && libre(j) && depot(j).verifie && bonneVersionGardee(j),
      message: (j) => j.t('versions-evenement-fin'),
    },
  ],
};

// Une copie de la bonne version restaurée sous un autre lieu (restic recrée le chemin complet).
function trouverRestaurationAilleurs(j: Jeu): boolean {
  const bon = j.t('versions-journal');
  const journal = chemin(j.t, JOURNAL);
  const chercher = (chemin: string, profondeur: number): boolean => {
    const n = j.trouver(chemin);
    if (!n || profondeur > 9) return false;
    if (n.type === 'fichier') return chemin !== journal && j.lire(chemin) === bon;
    return Object.keys(n.enfants).some((nom) => chercher(`${chemin === '/' ? '' : chemin}/${nom}`, profondeur + 1));
  };
  return chercher('/tmp', 0) || chercher(chemin(j.t, M), 0);
}
