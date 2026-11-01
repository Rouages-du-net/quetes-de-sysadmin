// Chapitre 1 — L'Île du Phare : ls, cd, pwd, cat (less), ls -a, mv (déplacer
// et renommer), chemins (.., ~, /). Notre propre histoire et nos propres
// énigmes ; l'idée d'apprendre les commandes en se déplaçant de lieu en lieu
// vient de Terminus (MIT).

import { path, d, f, type Chapter } from '../world';

const M = '/Hut';
const LANTERN = `${M}/Pier/Lighthouse/Stairs/Lantern`;

export const awakening: Chapter = {
  id: 'lighthouse',
  number: 1,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'mv'],
  home: M,
  names: true,
  welcome: 'welcome.txt',
  final: 'light',
  createWorld: (t) =>
    d({
      Hut: d({
        'welcome.txt': f(t('lighthouse-welcome')),
        'message.txt': f(t('lighthouse-message')),
        Beach: d({
          'sign.txt': f(t('lighthouse-panel')),
          'mender.txt': f(t('lighthouse-ravaudeuse')),
          'seashell': f(t('lighthouse-seashell')),
        }),
        Hill: d({
          'wind.txt': f(t('lighthouse-wind')),
          SignalSchool: d({
            'headteacher.txt': f(t('lighthouse-headteacher')),
            PracticeRoom: d({
              'exercise.txt': f(t('lighthouse-instructions')),
              crab: f(t('lighthouse-crab')),
              Bucket: d({}),
            }),
            Lessons: d({
              'lesson_1_manual.txt': f(t('lighthouse-course-1-manual')),
              'lesson_2_paths.txt': f(t('lighthouse-course-2-paths')),
              'lesson_3_hidden.txt': f(t('lighthouse-course-3-caches')),
              '.secret_note': f(t('lighthouse-note-secret')),
              'lesson_4_rename.txt': f(t('lighthouse-course-4-rename')),
            }),
            Library: d({
              'book_of_commands.txt': f(t('lighthouse-book-commands')),
            }),
          }),
        }),
        Harbour: d({
          'captain.txt': f(t('lighthouse-captain')),
          Boathouse: d({
            'inventory.txt': f(t('lighthouse-inventory')),
          }),
          Storeroom: d({
            'label.txt': f(t('lighthouse-label')),
            '.spare_bulb': f(t('lighthouse-bulb-rescue')),
          }),
        }),
        Pier: d({
          'net': f(t('lighthouse-net')),
          'clue.txt': f(t('lighthouse-hint')),
          Lighthouse: d(
            {
              'keeper.txt': f(t('lighthouse-keeper')),
              Stairs: d({
                'steps.txt': f(t('lighthouse-steps')),
                Lantern: d({
                  'lantern.txt': f(t('lighthouse-lantern')),
                }),
              }),
            },
            (game) =>
              game.exists(path(game.t, `${M}/Pier/net`)) ? game.t('lighthouse-lighthouse-blocked') : null,
          ),
        }),
      }),
    }),
  events: [
    {
      id: 'crab',
      condition: (j) => j.exists(path(j.t, `${M}/Hill/SignalSchool/PracticeRoom/Bucket/crab`)),
      message: (j) => j.t('lighthouse-event-crab'),
    },
    {
      id: 'net',
      condition: (j) => !j.exists(path(j.t, `${M}/Pier/net`)),
      message: (j) => j.t('lighthouse-event-net'),
    },
    {
      id: 'bad-name',
      condition: (j) => j.exists(path(j.t, `${LANTERN}/.spare_bulb`)),
      message: (j) => j.t('lighthouse-event-bad-name'),
    },
    {
      id: 'light',
      condition: (j) => j.exists(path(j.t, `${LANTERN}/bulb`)),
      message: (j) => j.t('lighthouse-event-light'),
    },
  ],
};
