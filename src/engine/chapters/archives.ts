// Story "The Archives": saving a neighbourhood library's collection onto a
// small USB stick, with du, df, find and tar. The sizes of the images,
// sounds and PDFs are simulated (the `size` field).

import { path, d, f, name, type Chapter, type File } from '../world';
import type { Game } from '../shell';

const M = '/home/you';
const KEY = '/media/usb';
const Mo = 1024 * 1024;
// The commands that write to the stick (bash: a > redirection).
const WRITERS = ['tar', 'cp', 'mv', 'mkdir', 'bash'];

const binary = (description: string, size: number) => f(description, { size: Math.round(size * Mo) });
const text = (t: string, size: number) => f(t, { size: Math.round(size * Mo), lines: true });

// The files that absolutely must be saved (paths relative to ~).
const PRECIOUS = [
  'collection/manuscripts/marie_diary.txt',
  'collection/manuscripts/letters_1914.txt',
  'collection/manuscripts/neighbourhood_recipes.txt',
  'collection/maps/map_1890.png',
  'collection/maps/map_1954.png',
  'collection/press/gazette_1936.pdf',
  'collection/press/gazette_1968.pdf',
  'collection/recordings/market_songs.ogg',
  'collection/recordings/interview_fatou.ogg',
];

// A tar archive on the stick containing all the precious files.
function archiveComplete(j: Pick<Game, 'find' | 'player' | 't'>): File | null {
  const key = j.find(path(j.t, KEY));
  if (key?.type !== 'directory') return null;
  for (const n of Object.values(key.children) as File[]) {
    if (n.type !== 'file' || !n.archive) continue;
    const paths = Object.keys(n.archive.files).map((c) => c.replace(new RegExp(`^(\\./|~/|home/${j.player}/)`), ''));
    if (PRECIOUS.map((p) => path(j.t, p)).every((p) => paths.some((c) => c === p || c.endsWith('/' + p)))) return n;
  }
  return null;
}

export const archives: Chapter = {
  id: 'archives',
  number: 1,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'du', 'df', 'find', 'tar', 'cp', 'mv', 'rm', 'mkdir'],
  home: M,
  welcome: 'letter_from_rosa.txt',
  names: true,
  final: 'saved',
  state: (t) => ({
    mounts: [
      { path: path(t, KEY), capacity: 64 * Mo, name: '/dev/sdb1' },
      { path: '/', capacity: 20 * 1024 * Mo, name: '/dev/sda1' },
    ],
  }),
  createWorld: (t) =>
    d({
      home: d({
        you: d({
          'letter_from_rosa.txt': f(t('archives-letter-rosa')),
          'notes_rosa.txt': f(t('archives-notes-rosa')),
          collection: d({
            'readme.txt': f(t('archives-readme')),
            manuscripts: d({
              'marie_diary.txt': text(t('archives-journal-marie'), 3),
              'letters_1914.txt': text(t('archives-letters-1914'), 2.5),
              'neighbourhood_recipes.txt': text(t('archives-recipes-neighbourhood'), 1.5),
            }),
            maps: d({
              'map_1890.png': binary(t('archives-image-png'), 6),
              'map_1954.png': binary(t('archives-image-png'), 5),
              'render.tmp': binary(t('archives-file-temporary'), 30),
            }),
            press: d({
              'gazette_1936.pdf': binary(t('archives-document-pdf'), 4),
              'gazette_1968.pdf': binary(t('archives-document-pdf'), 4.5),
              'export.tmp': binary(t('archives-file-temporary'), 40),
            }),
            recordings: d({
              'market_songs.ogg': binary(t('archives-its-ogg'), 12),
              'interview_fatou.ogg': binary(t('archives-its-ogg'), 15),
              'raw.tmp': binary(t('archives-file-temporary'), 50),
            }),
          }),
        }),
      }),
      media: d({ usb: d({}) }),
    }),
  events: [
    {
      id: 'measure',
      condition: (j) => j.last.commands[0]?.[0] === 'du',
      message: (j) => j.t('archives-event-measure'),
    },
    {
      id: 'full',
      condition: (j) => j.last.errors.some((e) => WRITERS.some((command) => e === j.t('error-space', { command: command }))),
      message: (j) => j.t('archives-event-full'),
    },
    {
      id: 'tmp',
      condition: (j) => j.last.commands[0]?.[0] === 'find' && j.last.output.includes(name(j.t, 'raw.tmp')),
      message: (j) => j.t('archives-event-tmp'),
    },
    {
      id: 'loss',
      condition: (j) => !archiveComplete(j) && PRECIOUS.some((p) => !j.exists(path(j.t, `${M}/${p}`))),
      message: (j) => j.t('archives-event-loss'),
    },
    {
      id: 'cleanup',
      condition: (j) => j.exists(path(j.t, `${M}/collection`)) && !['maps/render.tmp', 'press/export.tmp', 'recordings/raw.tmp'].some((t) => j.exists(path(j.t, `${M}/collection/${t}`))),
      message: (j) => j.t('archives-event-cleanup'),
    },
    {
      id: 'saved',
      condition: (j) => !!archiveComplete(j),
      message: (j) => j.t('archives-event-saved', { size: (archiveComplete(j)!.size ?? 0) / Mo }),
    },
  ],
};
