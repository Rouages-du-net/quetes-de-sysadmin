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

const M = '/home/vous';
const MEMORIES = `${M}/souvenirs`;
const BACKUP = '/mnt/sauvegarde/souvenirs';
const FILES = ['premiere-lettre.txt', 'phare.txt', 'bourg.txt', 'nour.txt', 'effaceur.txt'];
const NEW = 'fete-du-phare.txt';
const ERASES = 'premiere-lettre.txt';
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
  welcome: 'mot_de_maelle.txt',
  final: 'fin',
  state: () => ({ crontabs: {}, versionCrontab: 0, versionNuit: 0, originaux: {} }),
  initialise: (j) => {
    for (const n of FILES) j.state.originaux[n] = j.read(path(j.t, `${MEMORIES}/${n}`));
  },
  createWorld: (t) =>
    d({
      home: d(
        {
          vous: d({
            'mot_de_maelle.txt': f(t('backup-mot-de-maelle')),
            souvenirs: d(Object.fromEntries(FILES.map((n) => [n, f(t(`backup-souvenir-${n.replace('.txt', '')}`))]))),
          }),
        },
        undefined,
        { owner: 'root' },
      ),
      mnt: d({ sauvegarde: d({}) }, undefined, { owner: 'root' }),
      tmp: d({}, undefined, { owner: 'root', mode: 'rwxrwxrwx' }),
    }),
  // Dès que la crontab change, la nuit passe : cron lance ce qui tombe entre minuit et 6 h.
  afterCommand: (j) => {
    if ((j.state.versionCrontab ?? 0) === j.state.versionNuit || !j.state.crontabs?.[j.player] || j.flags.has('nuit-ok')) return;
    j.state.versionNuit = j.state.versionCrontab;
    const chunks: string[] = [];
    if (!j.flags.has('jour')) {
      // Le souvenir du jour, arrivé avant la nuit : la tâche doit l'emporter.
      j.flags.add('jour');
      const n = j.find(path(j.t, MEMORIES));
      if (n?.type === 'dossier') n.children[name(j.t, NEW)] = f(j.t('backup-souvenir-fete-du-phare'));
      j.state.originaux[NEW] = j.read(path(j.t, `${MEMORIES}/${NEW}`));
      chunks.push(j.t('backup-nuit-debut', { fichier: name(j.t, NEW) }));
    } else chunks.push(j.t('backup-nuit-encore'));
    const executions = pass(j as Shell, NIGHT[0], NIGHT[1]);
    const mail = executions
      .filter((e) => e.output)
      .map((e) => `$ ${e.command}\n${e.output}`)
      .join('\n\n');
    if (saved(j, [...FILES, NEW])) {
      j.flags.add('nuit-ok');
      // Au matin, l'erreur humaine.
      j.erase(path(j.t, `${MEMORIES}/${ERASES}`));
      chunks.push(j.t('backup-nuit-ok', { fichier: name(j.t, NEW) }), j.t('backup-matin', { fichier: name(j.t, ERASES) }));
    } else if (!executions.length) chunks.push(j.t('backup-nuit-rien'));
    else chunks.push(mail ? j.t('backup-nuit-courrier', { courrier: mail }) : j.t('backup-nuit-echec'));
    return chunks.join('\n\n');
  },
  events: [
    {
      id: 'imbrique',
      condition: (j) => j.exists(path(j.t, `${BACKUP}/souvenirs`)),
      message: (j) => j.t('backup-evenement-imbrique', { sauvegarde: path(j.t, BACKUP) }),
    },
    {
      id: 'copie',
      condition: (j) => saved(j, FILES) && !j.flags.has('nuit-ok'),
      message: (j) => j.t('backup-evenement-copie'),
    },
    {
      id: 'perdu',
      condition: (j) => j.flags.has('nuit-ok') && !j.exists(path(j.t, `${BACKUP}/${ERASES}`)) && !j.exists(path(j.t, `${MEMORIES}/${ERASES}`)),
      message: (j) => j.t('backup-evenement-perdu', { fichier: name(j.t, ERASES) }),
    },
    {
      id: 'fin',
      condition: (j) => j.flags.has('nuit-ok') && j.read(path(j.t, `${MEMORIES}/${ERASES}`)) === originals(j)[ERASES] && nightTasks(j).length > 0,
      message: (j) => j.t('backup-evenement-fin'),
    },
  ],
};
