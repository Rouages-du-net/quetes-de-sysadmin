// Histoire « L'Effaceur » — chapitre 4 « La Sauvegarde » : rsync et cron.
// Plus jamais ça : sauvegarder les souvenirs sur le disque de sauvegarde,
// chaque nuit, automatiquement, et vérifier qu'on sait restaurer.
//   1. rsync -a ~/souvenirs/ /mnt/sauvegarde/souvenirs/ (piège : sans la
//      barre finale, on obtient souvenirs/souvenirs) ;
//   2. crontab -e : une tâche de nuit. Le jeu fait passer la nuit dès que la
//      crontab change : un nouveau souvenir arrivé dans la journée doit se
//      retrouver dans la sauvegarde ; sinon, le courrier de cron explique ;
//   3. au matin, un souvenir est effacé par erreur : le restaurer.
// Piège : --delete recopie aussi les effacements.
// Sources : https://download.samba.org/pub/rsync/rsync.1,
// https://manpages.debian.org/bookworm/cron/crontab.5.en.html

import { chemin, d, f, nom, type Chapitre } from '../monde';
import type { Jeu, Shell } from '../shell';
import { analyser, passer, tourneA } from '../cron';

const M = '/home/vous';
const SOUVENIRS = `${M}/souvenirs`;
const SAUVEGARDE = '/mnt/sauvegarde/souvenirs';
const FICHIERS = ['premiere-lettre.txt', 'phare.txt', 'bourg.txt', 'nour.txt', 'effaceur.txt'];
const NOUVEAU = 'fete-du-phare.txt';
const EFFACE = 'premiere-lettre.txt';
// La nuit du vendredi au samedi 24 octobre 2026, de minuit à 6 h.
const NUIT = [Date.UTC(2026, 9, 24, 0, 0), Date.UTC(2026, 9, 24, 6, 0)];

const originaux = (j: Jeu): Record<string, string> => j.etat.originaux;
// La sauvegarde contient-elle ces souvenirs, à l'identique ?
const sauve = (j: Jeu, noms: string[]) => noms.every((n) => j.lire(chemin(j.t, `${SAUVEGARDE}/${n}`)) === originaux(j)[n]);
const tachesDeNuit = (j: Jeu) =>
  analyser(j.etat.crontabs?.vous ?? '', '').taches.filter((t) => {
    for (let ms = Date.UTC(2026, 9, 25, 0, 0); ms < Date.UTC(2026, 9, 26, 0, 0); ms += 60_000) if (tourneA(t, ms)) return /\brsync\b/.test(t.commande);
    return false;
  });

export const sauvegarde: Chapitre = {
  id: 'sauvegarde',
  numero: 4,
  commandes: ['ls', 'cd', 'pwd', 'cat', 'less', 'mkdir', 'cp', 'mv', 'rm', 'nano', 'rsync', 'crontab'],
  maison: M,
  noms: true,
  accueil: 'mot_de_maelle.txt',
  final: 'fin',
  etat: () => ({ crontabs: {}, versionCrontab: 0, versionNuit: 0, originaux: {} }),
  initialiser: (j) => {
    for (const n of FICHIERS) j.etat.originaux[n] = j.lire(chemin(j.t, `${SOUVENIRS}/${n}`));
  },
  creerMonde: (t) =>
    d({
      home: d(
        {
          vous: d({
            'mot_de_maelle.txt': f(t('sauvegarde-mot-de-maelle')),
            souvenirs: d(Object.fromEntries(FICHIERS.map((n) => [n, f(t(`sauvegarde-souvenir-${n.replace('.txt', '')}`))]))),
          }),
        },
        undefined,
        { proprio: 'root' },
      ),
      mnt: d({ sauvegarde: d({}) }, undefined, { proprio: 'root' }),
      tmp: d({}, undefined, { proprio: 'root', mode: 'rwxrwxrwx' }),
    }),
  // Dès que la crontab change, la nuit passe : cron lance ce qui tombe entre minuit et 6 h.
  apresCommande: (j) => {
    if ((j.etat.versionCrontab ?? 0) === j.etat.versionNuit || !j.etat.crontabs?.vous || j.drapeaux.has('nuit-ok')) return;
    j.etat.versionNuit = j.etat.versionCrontab;
    const morceaux: string[] = [];
    if (!j.drapeaux.has('jour')) {
      // Le souvenir du jour, arrivé avant la nuit : la tâche doit l'emporter.
      j.drapeaux.add('jour');
      const n = j.trouver(chemin(j.t, SOUVENIRS));
      if (n?.type === 'dossier') n.enfants[nom(j.t, NOUVEAU)] = f(j.t('sauvegarde-souvenir-fete-du-phare'));
      j.etat.originaux[NOUVEAU] = j.lire(chemin(j.t, `${SOUVENIRS}/${NOUVEAU}`));
      morceaux.push(j.t('sauvegarde-nuit-debut', { fichier: nom(j.t, NOUVEAU) }));
    } else morceaux.push(j.t('sauvegarde-nuit-encore'));
    const executions = passer(j as Shell, NUIT[0], NUIT[1]);
    const courrier = executions
      .filter((e) => e.sortie)
      .map((e) => `$ ${e.commande}\n${e.sortie}`)
      .join('\n\n');
    if (sauve(j, [...FICHIERS, NOUVEAU])) {
      j.drapeaux.add('nuit-ok');
      // Au matin, l'erreur humaine.
      j.effacer(chemin(j.t, `${SOUVENIRS}/${EFFACE}`));
      morceaux.push(j.t('sauvegarde-nuit-ok', { fichier: nom(j.t, NOUVEAU) }), j.t('sauvegarde-matin', { fichier: nom(j.t, EFFACE) }));
    } else if (!executions.length) morceaux.push(j.t('sauvegarde-nuit-rien'));
    else morceaux.push(courrier ? j.t('sauvegarde-nuit-courrier', { courrier }) : j.t('sauvegarde-nuit-echec'));
    return morceaux.join('\n\n');
  },
  evenements: [
    {
      id: 'imbrique',
      condition: (j) => j.existe(chemin(j.t, `${SAUVEGARDE}/souvenirs`)),
      message: (j) => j.t('sauvegarde-evenement-imbrique', { sauvegarde: chemin(j.t, SAUVEGARDE) }),
    },
    {
      id: 'copie',
      condition: (j) => sauve(j, FICHIERS) && !j.drapeaux.has('nuit-ok'),
      message: (j) => j.t('sauvegarde-evenement-copie'),
    },
    {
      id: 'perdu',
      condition: (j) => j.drapeaux.has('nuit-ok') && !j.existe(chemin(j.t, `${SAUVEGARDE}/${EFFACE}`)) && !j.existe(chemin(j.t, `${SOUVENIRS}/${EFFACE}`)),
      message: (j) => j.t('sauvegarde-evenement-perdu', { fichier: nom(j.t, EFFACE) }),
    },
    {
      id: 'fin',
      condition: (j) => j.drapeaux.has('nuit-ok') && j.lire(chemin(j.t, `${SOUVENIRS}/${EFFACE}`)) === originaux(j)[EFFACE] && tachesDeNuit(j).length > 0,
      message: (j) => j.t('sauvegarde-evenement-fin'),
    },
  ],
};
