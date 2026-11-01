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

import { password, path, d, f, type Chapter, type File } from '../world';
import type { Game, Shell } from '../shell';
import type { Translate } from '../../texts';
import { addSnapshot, writeRepo, hex, repoSize, type Repo, type Version } from '../commands/restic';

const M = '/home/you';
const COLLECTION = `${M}/collection`;
const REPO = '/mnt/townhall/restic-library';
const MDP = `${M}/.config/restic/password`;
const PASSWORD = 'lantern-paper-cherry-41';
const LOG = `${COLLECTION}/manuscripts/marie_diary.txt`;
const Mo = 1024 * 1024;
const CAPACITY = 1800 * Mo;
// L'heure d'une sauvegarde : chaque nuit à 23 h 30 (heure de la machine).
const night = (day: number) => Date.UTC(2027, 0, day, 23, 30, 2);
// Le script de « correction » est passé dans la nuit du 1er au 2 février, à 2 h.
const CORRECTION = Date.UTC(2027, 1, 2, 2, 0, 13);

const text = (content: string, modified: number): Version => ({ content, size: new TextEncoder().encode(content).length, modified });
const media = (description: string, mo: number, modified: number): Version => ({ content: description, size: Math.round(mo * Mo), modified });

// Le fonds tel qu'il était un jour donné (jour de janvier ; 32 = 1er février…),
// avec les noms français : le monde est créé ainsi (puis renommé), et les
// instantanés prennent les chemins dans la langue (fondsTraduit).
function collection(t: Translate, day: number): Record<string, Version> {
  const base = COLLECTION;
  const before = Date.UTC(2026, 11, 14, 16, 2, 0);
  const v: Record<string, Version> = {
    [`${base}/readme.txt`]: text(t('archives-lisezmoi'), before),
    [`${base}/manuscripts/marie_diary.txt`]: day >= 33 ? text(t('versions-journal-abime'), CORRECTION) : text(t('versions-journal'), before),
    [`${base}/manuscripts/letters_1914.txt`]: text(t('archives-lettres-1914'), before),
    [`${base}/manuscripts/neighbourhood_recipes.txt`]:
      day >= 20
        ? text(`${t('archives-recettes-du-quartier')}\n${t('versions-recette-ajoutee')}`, Date.UTC(2027, 0, 20, 11, 15, 0))
        : text(t('archives-recettes-du-quartier'), before),
    [`${base}/maps/map_1890.png`]: media(t('archives-image-png'), 6, before),
    [`${base}/maps/map_1954.png`]: media(t('archives-image-png'), 5, before),
    [`${base}/press/gazette_1936.pdf`]: media(t('archives-document-pdf'), 4, before),
    [`${base}/press/gazette_1968.pdf`]: media(t('archives-document-pdf'), 4.5, before),
    [`${base}/recordings/market_songs.ogg`]: media(t('archives-son-ogg'), 12, before),
    [`${base}/recordings/interview_fatou.ogg`]: media(t('archives-son-ogg'), 15, before),
  };
  // Du 8 au 14 janvier, les numérisations brutes (énormes) attendaient d'être traitées.
  if (day >= 8 && day <= 14)
    for (const n of [1, 2, 3])
      v[`${base}/scans/brut_registre_${n}.tiff`] = media(t('versions-image-tiff'), 540, Date.UTC(2027, 0, 8, 10, n, 0));
  if (day >= 15)
    for (const n of [1, 2, 3]) v[`${base}/scans/registre_${n}.png`] = media(t('archives-image-png'), 3, Date.UTC(2027, 0, 15, 9, n, 0));
  return v;
}

// Le fonds d'un jour, rangé sous ses chemins dans la langue (/home/you/collection…).
const translatedCollection = (t: Translate, day: number) => Object.fromEntries(Object.entries(collection(t, day)).map(([c, v]) => [path(t, c), v]));

// Trente nuits de sauvegardes, du 7 janvier au 5 février.
function initialRepo(t: Translate): Repo {
  const repo: Repo = { id: hex('depot-bibliotheque'), password: password(t, PASSWORD), snapshotList: [], packs: [], checked: true, pruneA: false };
  for (let day = 7; day <= 36; day++)
    addSnapshot(repo, { id: hex(`instantane-${day}`), time: night(day), host: 'library', paths: [path(t, COLLECTION)], files: translatedCollection(t, day) });
  repo.checked = true;
  return repo;
}

const shell = (j: Game) => j as Shell;
const repo = (j: Game): Repo => j.state.restic[path(j.t, REPO)];
const restored = (j: Game) => j.read(path(j.t, LOG)) === j.t('versions-journal');
// Le fichier du mot de passe : lisible par les autres comptes de la machine ?
const openMdp = (j: Game) => {
  const n = j.find(path(j.t, MDP));
  return !!n && j.can(n, 'r', 'rosa');
};
const keptVersionBonne = (j: Game) => repo(j).snapshotList.some((s) => s.files[path(j.t, LOG)]?.content === j.t('versions-journal'));
const freeMem = (j: Game) => repoSize(repo(j)) < CAPACITY * 0.6;

export const versions: Chapter = {
  id: 'versions',
  number: 2,
  commands: [
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
  home: M,
  welcome: 'note_from_rosa.txt',
  names: true,
  final: 'fin',
  accounts: () => ({
    users: { root: { uid: 0, group: 'root', home: '/root' }, you: { uid: 1000, group: 'you' }, rosa: { uid: 1001, group: 'rosa' } },
    groups: { root: { gid: 0, members: [] }, you: { gid: 1000, members: [] }, rosa: { gid: 1001, members: [] } },
  }),
  state: (t) => ({
    restic: { [path(t, REPO)]: initialRepo(t) },
    // L'heure des prochaines sauvegardes à la main : samedi 6 février, 9 h 40.
    resticHorloge: Date.UTC(2027, 1, 6, 9, 40, 0),
    montages: [
      { path: path(t, '/mnt/townhall'), capacity: CAPACITY, name: `townhall.example:${path(t, '/share/backups')}` },
      { path: '/', capacity: 20 * 1024 * Mo, name: '/dev/sda1' },
    ],
  }),
  // Les fichiers du dépôt sur le disque, d'après son contenu.
  initialise: (j) => writeRepo(shell(j), path(j.t, REPO), repo(j)),
  createWorld: (t) => {
    const current = collection(t, 37);
    const places: Record<string, Record<string, File>> = {};
    for (const [path, v] of Object.entries(current)) {
      const relative = path.slice(COLLECTION.length + 1).split('/');
      const place = relative.length > 1 ? relative[0] : '';
      const file = f(v.content, { lines: true, size: v.content.length === v.size ? undefined : v.size });
      (places[place] ??= {})[relative.at(-1)!] = file;
    }
    const { '': collectionRoot, ...underPlaces } = places;
    return d({
      home: d({
        you: d({
          'note_from_rosa.txt': f(t('versions-mot-de-rosa')),
          'notes_restic.txt': f(t('versions-notes-restic')),
          '.config': d({ restic: d({ 'password': f(password(t, PASSWORD), { lines: true }) }) }),
          collection: d({ ...collectionRoot, ...Object.fromEntries(Object.entries(underPlaces).map(([name, children]) => [name, d(children)])) }),
        }),
        rosa: d({}, undefined, { owner: 'rosa', mode: 'rwx------' }),
      }),
      mnt: d({ townhall: d({ 'restic-library': d({}, undefined, { mode: 'rwx------' }) }) }, undefined, { owner: 'root' }),
      tmp: d({}, undefined, { owner: 'root', mode: 'rwxrwxrwx' }),
    });
  },
  events: [
    {
      id: 'mot-de-passe',
      condition: (j) => !!j.state.resticFichierMdp && openMdp(j),
      message: (j) => j.t('versions-evenement-mot-de-passe', { fichier: path(j.t, MDP) }),
    },
    {
      id: 'mauvais-mot-de-passe',
      condition: (j) => j.state.resticMauvaisMdp === true,
      message: (j) => j.t('versions-evenement-mauvais-mot-de-passe'),
    },
    {
      id: 'ailleurs',
      condition: (j) => !restored(j) && findElsewhereRestore(j),
      message: (j) => j.t('versions-evenement-ailleurs'),
    },
    {
      id: 'restaure',
      condition: restored,
      message: (j) => j.t('versions-evenement-restaure'),
    },
    {
      id: 'perdu',
      condition: (j) => !restored(j) && !keptVersionBonne(j),
      message: (j) => j.t('versions-evenement-perdu'),
    },
    {
      id: 'oublie-sans-prune',
      condition: (j) => j.state.resticOublie === true && repo(j).pruneA,
      message: (j) => j.t('versions-evenement-oublie-sans-prune'),
    },
    {
      id: 'place',
      condition: freeMem,
      message: (j) => j.t('versions-evenement-place'),
    },
    {
      id: 'fin',
      condition: (j) => restored(j) && !openMdp(j) && freeMem(j) && repo(j).checked && keptVersionBonne(j),
      message: (j) => j.t('versions-evenement-fin'),
    },
  ],
};

// Une copie de la bonne version restaurée sous un autre lieu (restic recrée le chemin complet).
function findElsewhereRestore(j: Game): boolean {
  const good = j.t('versions-journal');
  const log = path(j.t, LOG);
  const search = (path: string, depth: number): boolean => {
    const n = j.find(path);
    if (!n || depth > 9) return false;
    if (n.type === 'fichier') return path !== log && j.read(path) === good;
    return Object.keys(n.children).some((name) => search(`${path === '/' ? '' : path}/${name}`, depth + 1));
  };
  return search('/tmp', 0) || search(path(j.t, M), 0);
}
