// Story "The Archives", chapter "The versions": restic. Since January, the
// library has backed up its collection every night with restic, onto the
// town hall's shared disk (/mnt/mairie). Four nights ago, an automatic
// "correction" script damaged the transcription of Marie's diary; the
// following backups faithfully kept the damaged version. You must find the
// good version in an older snapshot, restore it, then free space on the
// disk (forget --prune) without throwing away the good version, check the
// repository (check), and protect the password file.
// Objective checked on the state: the diary is back exactly as it was, the
// password file is no longer readable by other accounts, the disk has
// regained space, and the repository was checked afterwards.
// Sources: https://restic.readthedocs.io/en/stable/045_working_with_repos.html,
// https://restic.readthedocs.io/en/stable/050_restore.html,
// https://restic.readthedocs.io/en/stable/060_forget.html

import { password, path, d, f, type Chapter, type File } from '../world';
import type { Game, Shell } from '../shell';
import type { Translate } from '../../texts';
import { addSnapshot, writeRepo, hex, repoSize, type Repo, type Version } from '../commands/restic';

const M = '/home/you';
const COLLECTION = `${M}/collection`;
const REPO = '/mnt/townhall/restic-library';
const PASSWORD_FILE = `${M}/.config/restic/password`;
const PASSWORD = 'lantern-paper-cherry-41';
const LOG = `${COLLECTION}/manuscripts/marie_diary.txt`;
const Mo = 1024 * 1024;
const CAPACITY = 1800 * Mo;
// The time of a backup: every night at 23:30 (machine time).
const night = (day: number) => Date.UTC(2027, 0, day, 23, 30, 2);
// The "correction" script ran in the night of 1 to 2 February, at 2:00.
const CORRECTION = Date.UTC(2027, 1, 2, 2, 0, 13);

const text = (content: string, modified: number): Version => ({ content, size: new TextEncoder().encode(content).length, modified });
const media = (description: string, mo: number, modified: number): Version => ({ content: description, size: Math.round(mo * Mo), modified });

// The collection as it was on a given day (day of January; 32 = 1 February…),
// with the French names: the world is created that way (then renamed), and
// the snapshots take the paths in the language (translatedCollection).
function collection(t: Translate, day: number): Record<string, Version> {
  const base = COLLECTION;
  const before = Date.UTC(2026, 11, 14, 16, 2, 0);
  const v: Record<string, Version> = {
    [`${base}/readme.txt`]: text(t('archives-readme'), before),
    [`${base}/manuscripts/marie_diary.txt`]: day >= 33 ? text(t('versions-journal-damaged'), CORRECTION) : text(t('versions-journal'), before),
    [`${base}/manuscripts/letters_1914.txt`]: text(t('archives-letters-1914'), before),
    [`${base}/manuscripts/neighbourhood_recipes.txt`]:
      day >= 20
        ? text(`${t('archives-recipes-neighbourhood')}\n${t('versions-recipe-added')}`, Date.UTC(2027, 0, 20, 11, 15, 0))
        : text(t('archives-recipes-neighbourhood'), before),
    [`${base}/maps/map_1890.png`]: media(t('archives-image-png'), 6, before),
    [`${base}/maps/map_1954.png`]: media(t('archives-image-png'), 5, before),
    [`${base}/press/gazette_1936.pdf`]: media(t('archives-document-pdf'), 4, before),
    [`${base}/press/gazette_1968.pdf`]: media(t('archives-document-pdf'), 4.5, before),
    [`${base}/recordings/market_songs.ogg`]: media(t('archives-its-ogg'), 12, before),
    [`${base}/recordings/interview_fatou.ogg`]: media(t('archives-its-ogg'), 15, before),
  };
  // From 8 to 14 January, the raw scans (huge) were waiting to be processed.
  if (day >= 8 && day <= 14)
    for (const n of [1, 2, 3])
      v[`${base}/scans/raw_register_${n}.tiff`] = media(t('versions-image-tiff'), 540, Date.UTC(2027, 0, 8, 10, n, 0));
  if (day >= 15)
    for (const n of [1, 2, 3]) v[`${base}/scans/register_${n}.png`] = media(t('archives-image-png'), 3, Date.UTC(2027, 0, 15, 9, n, 0));
  return v;
}

// A day's collection, filed under its paths in the language (/home/you/collection…).
const translatedCollection = (t: Translate, day: number) => Object.fromEntries(Object.entries(collection(t, day)).map(([c, v]) => [path(t, c), v]));

// Thirty nights of backups, from 7 January to 5 February.
function initialRepo(t: Translate): Repo {
  const repo: Repo = { id: hex('repo-library'), password: password(t, PASSWORD), snapshotList: [], packs: [], checked: true, pruneA: false };
  for (let day = 7; day <= 36; day++)
    addSnapshot(repo, { id: hex(`snapshot-${day}`), time: night(day), host: 'library', paths: [path(t, COLLECTION)], files: translatedCollection(t, day) });
  repo.checked = true;
  return repo;
}

const shell = (j: Game) => j as Shell;
const repo = (j: Game): Repo => j.state.restic[path(j.t, REPO)];
const restored = (j: Game) => j.read(path(j.t, LOG)) === j.t('versions-journal');
// The password file: readable by the machine's other accounts?
const openPasswordFile = (j: Game) => {
  const n = j.find(path(j.t, PASSWORD_FILE));
  return !!n && j.can(n, 'r', 'rosa');
};
const keptGoodVersion = (j: Game) => repo(j).snapshotList.some((s) => s.files[path(j.t, LOG)]?.content === j.t('versions-journal'));
const roomMade = (j: Game) => repoSize(repo(j)) < CAPACITY * 0.6;

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
  final: 'end',
  accounts: () => ({
    users: { root: { uid: 0, group: 'root', home: '/root' }, you: { uid: 1000, group: 'you' }, rosa: { uid: 1001, group: 'rosa' } },
    groups: { root: { gid: 0, members: [] }, you: { gid: 1000, members: [] }, rosa: { gid: 1001, members: [] } },
  }),
  state: (t) => ({
    restic: { [path(t, REPO)]: initialRepo(t) },
    // The time of the next backups by hand: Saturday 6 February, 9:40.
    resticClock: Date.UTC(2027, 1, 6, 9, 40, 0),
    mounts: [
      { path: path(t, '/mnt/townhall'), capacity: CAPACITY, name: `townhall.example:${path(t, '/share/backups')}` },
      { path: '/', capacity: 20 * 1024 * Mo, name: '/dev/sda1' },
    ],
  }),
  // The repository's files on the disk, from its contents.
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
          'note_from_rosa.txt': f(t('versions-word-rosa')),
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
      id: 'password',
      condition: (j) => !!j.state.resticPasswordFile && openPasswordFile(j),
      message: (j) => j.t('versions-event-password', { file: path(j.t, PASSWORD_FILE) }),
    },
    {
      id: 'bad-password',
      condition: (j) => j.state.resticWrongPassword === true,
      message: (j) => j.t('versions-event-bad-password'),
    },
    {
      id: 'elsewhere',
      condition: (j) => !restored(j) && findElsewhereRestore(j),
      message: (j) => j.t('versions-event-elsewhere'),
    },
    {
      id: 'restored',
      condition: restored,
      message: (j) => j.t('versions-event-restored'),
    },
    {
      id: 'lost',
      condition: (j) => !restored(j) && !keptGoodVersion(j),
      message: (j) => j.t('versions-event-lost'),
    },
    {
      id: 'forgotten-without-prune',
      condition: (j) => j.state.resticForgotten === true && repo(j).pruneA,
      message: (j) => j.t('versions-event-forgotten-without-prune'),
    },
    {
      id: 'place',
      condition: roomMade,
      message: (j) => j.t('versions-event-place'),
    },
    {
      id: 'end',
      condition: (j) => restored(j) && !openPasswordFile(j) && roomMade(j) && repo(j).checked && keptGoodVersion(j),
      message: (j) => j.t('versions-event-end'),
    },
  ],
};

// A copy of the good version restored somewhere else (restic recreates the full path).
function findElsewhereRestore(j: Game): boolean {
  const good = j.t('versions-journal');
  const log = path(j.t, LOG);
  const search = (path: string, depth: number): boolean => {
    const n = j.find(path);
    if (!n || depth > 9) return false;
    if (n.type === 'file') return path !== log && j.read(path) === good;
    return Object.keys(n.children).some((name) => search(`${path === '/' ? '' : path}/${name}`, depth + 1));
  };
  return search('/tmp', 0) || search(path(j.t, M), 0);
}
