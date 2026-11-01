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

import { path, d, f, name, type Chapter } from '../world';
import type { Game, Shell } from '../shell';
import { parse, pass, aRunning } from '../cron';

const M = '/home/you';
const MEMORIES = `${M}/memories`;
const BACKUP = '/mnt/backup/memories';
const FILES = ['first-letter.txt', 'lighthouse.txt', 'village.txt', 'nour.txt', 'eraser.txt'];
const NEW = 'lighthouse-festival.txt';
const ERASES = 'first-letter.txt';
// La nuit du vendredi au samedi 24 octobre 2026, de minuit à 6 h.
const NIGHT = [Date.UTC(2026, 9, 24, 0, 0), Date.UTC(2026, 9, 24, 6, 0)];

const originals = (j: Game): Record<string, string> => j.state.originaux;
// La sauvegarde contient-elle ces souvenirs, à l'identique ?
const saved = (j: Game, names: string[]) => names.every((n) => j.read(path(j.t, `${BACKUP}/${n}`)) === originals(j)[n]);
const nightTasks = (j: Game) =>
  parse(j.state.crontabs?.[j.player] ?? '', '').tasks.filter((t) => {
    for (let ms = Date.UTC(2026, 9, 25, 0, 0); ms < Date.UTC(2026, 9, 26, 0, 0); ms += 60_000) if (aRunning(t, ms)) return /\brsync\b/.test(t.command);
    return false;
  });

export const backup: Chapter = {
  id: 'backup',
  number: 4,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'mkdir', 'cp', 'mv', 'rm', 'nano', 'rsync', 'crontab'],
  home: M,
  names: true,
  welcome: 'note_from_maelle.txt',
  final: 'end',
  state: () => ({ crontabs: {}, versionCrontab: 0, versionNuit: 0, originaux: {} }),
  initialise: (j) => {
    for (const n of FILES) j.state.originaux[n] = j.read(path(j.t, `${MEMORIES}/${n}`));
  },
  createWorld: (t) =>
    d({
      home: d(
        {
          you: d({
            'note_from_maelle.txt': f(t('backup-word-maelle')),
            memories: d(Object.fromEntries(FILES.map((n) => [n, f(t(`backup-memory-${n.replace('.txt', '')}`))]))),
          }),
        },
        undefined,
        { owner: 'root' },
      ),
      mnt: d({ backup: d({}) }, undefined, { owner: 'root' }),
      tmp: d({}, undefined, { owner: 'root', mode: 'rwxrwxrwx' }),
    }),
  // Dès que la crontab change, la nuit passe : cron lance ce qui tombe entre minuit et 6 h.
  afterCommand: (j) => {
    if ((j.state.versionCrontab ?? 0) === j.state.versionNuit || !j.state.crontabs?.[j.player] || j.flags.has('night-ok')) return;
    j.state.versionNuit = j.state.versionCrontab;
    const chunks: string[] = [];
    if (!j.flags.has('day')) {
      // Le souvenir du jour, arrivé avant la nuit : la tâche doit l'emporter.
      j.flags.add('day');
      const n = j.find(path(j.t, MEMORIES));
      if (n?.type === 'dossier') n.children[name(j.t, NEW)] = f(j.t('backup-memory-lighthouse-festival'));
      j.state.originaux[NEW] = j.read(path(j.t, `${MEMORIES}/${NEW}`));
      chunks.push(j.t('backup-night-start', { fichier: name(j.t, NEW) }));
    } else chunks.push(j.t('backup-night-still'));
    const executions = pass(j as Shell, NIGHT[0], NIGHT[1]);
    const mail = executions
      .filter((e) => e.output)
      .map((e) => `$ ${e.command}\n${e.output}`)
      .join('\n\n');
    if (saved(j, [...FILES, NEW])) {
      j.flags.add('night-ok');
      // Au matin, l'erreur humaine.
      j.erase(path(j.t, `${MEMORIES}/${ERASES}`));
      chunks.push(j.t('backup-night-ok', { fichier: name(j.t, NEW) }), j.t('backup-morning', { fichier: name(j.t, ERASES) }));
    } else if (!executions.length) chunks.push(j.t('backup-night-nothing'));
    else chunks.push(mail ? j.t('backup-night-mail', { courrier: mail }) : j.t('backup-night-failure'));
    return chunks.join('\n\n');
  },
  events: [
    {
      id: 'nested',
      condition: (j) => j.exists(path(j.t, `${BACKUP}/memories`)),
      message: (j) => j.t('backup-event-nested', { sauvegarde: path(j.t, BACKUP) }),
    },
    {
      id: 'copy',
      condition: (j) => saved(j, FILES) && !j.flags.has('night-ok'),
      message: (j) => j.t('backup-event-copy'),
    },
    {
      id: 'lost',
      condition: (j) => j.flags.has('night-ok') && !j.exists(path(j.t, `${BACKUP}/${ERASES}`)) && !j.exists(path(j.t, `${MEMORIES}/${ERASES}`)),
      message: (j) => j.t('backup-event-lost', { fichier: name(j.t, ERASES) }),
    },
    {
      id: 'end',
      condition: (j) => j.flags.has('night-ok') && j.read(path(j.t, `${MEMORIES}/${ERASES}`)) === originals(j)[ERASES] && nightTasks(j).length > 0,
      message: (j) => j.t('backup-event-end'),
    },
  ],
};
