// Story "L'Effaceur" — chapter 4 "The Backup": rsync and cron.
// Never again: back up the memories onto the backup disk,
// every night, automatically, and check that we know how to restore.
//   1. rsync -a ~/memories/ /mnt/backup/memories/ (trap: without the
//      trailing slash, you get memories/memories);
//   2. crontab -e: a nightly job. The game makes the night pass as soon as the
//      crontab changes: a new memory that arrived during the day must end up
//      in the backup; otherwise, cron's mail explains;
//   3. in the morning, a memory is deleted by mistake: restore it.
// Trap: --delete also copies the deletions.
// Sources: https://download.samba.org/pub/rsync/rsync.1,
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
// The night from Friday to Saturday 24 October 2026, from midnight to 6 am.
const NIGHT = [Date.UTC(2026, 9, 24, 0, 0), Date.UTC(2026, 9, 24, 6, 0)];

const originals = (j: Game): Record<string, string> => j.state.originals;
// Does the backup contain these memories, identical?
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
  state: () => ({ crontabs: {}, crontabVersion: 0, nightVersion: 0, originals: {} }),
  initialise: (j) => {
    for (const n of FILES) j.state.originals[n] = j.read(path(j.t, `${MEMORIES}/${n}`));
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
  // As soon as the crontab changes, the night passes: cron runs what falls between midnight and 6 am.
  afterCommand: (j) => {
    if ((j.state.crontabVersion ?? 0) === j.state.nightVersion || !j.state.crontabs?.[j.player] || j.flags.has('night-ok')) return;
    j.state.nightVersion = j.state.crontabVersion;
    const chunks: string[] = [];
    if (!j.flags.has('day')) {
      // The day's memory, arrived before the night: the job must take it along.
      j.flags.add('day');
      const n = j.find(path(j.t, MEMORIES));
      if (n?.type === 'directory') n.children[name(j.t, NEW)] = f(j.t('backup-memory-lighthouse-festival'));
      j.state.originals[NEW] = j.read(path(j.t, `${MEMORIES}/${NEW}`));
      chunks.push(j.t('backup-night-start', { file: name(j.t, NEW) }));
    } else chunks.push(j.t('backup-night-still'));
    const executions = pass(j as Shell, NIGHT[0], NIGHT[1]);
    const mail = executions
      .filter((e) => e.output)
      .map((e) => `$ ${e.command}\n${e.output}`)
      .join('\n\n');
    if (saved(j, [...FILES, NEW])) {
      j.flags.add('night-ok');
      // In the morning, the human error.
      j.erase(path(j.t, `${MEMORIES}/${ERASES}`));
      chunks.push(j.t('backup-night-ok', { file: name(j.t, NEW) }), j.t('backup-morning', { file: name(j.t, ERASES) }));
    } else if (!executions.length) chunks.push(j.t('backup-night-nothing'));
    else chunks.push(mail ? j.t('backup-night-mail', { mail: mail }) : j.t('backup-night-failure'));
    return chunks.join('\n\n');
  },
  events: [
    {
      id: 'nested',
      condition: (j) => j.exists(path(j.t, `${BACKUP}/memories`)),
      message: (j) => j.t('backup-event-nested', { backup: path(j.t, BACKUP) }),
    },
    {
      id: 'copy',
      condition: (j) => saved(j, FILES) && !j.flags.has('night-ok'),
      message: (j) => j.t('backup-event-copy'),
    },
    {
      id: 'lost',
      condition: (j) => j.flags.has('night-ok') && !j.exists(path(j.t, `${BACKUP}/${ERASES}`)) && !j.exists(path(j.t, `${MEMORIES}/${ERASES}`)),
      message: (j) => j.t('backup-event-lost', { file: name(j.t, ERASES) }),
    },
    {
      id: 'end',
      condition: (j) => j.flags.has('night-ok') && j.read(path(j.t, `${MEMORIES}/${ERASES}`)) === originals(j)[ERASES] && nightTasks(j).length > 0,
      message: (j) => j.t('backup-event-end'),
    },
  ],
};
