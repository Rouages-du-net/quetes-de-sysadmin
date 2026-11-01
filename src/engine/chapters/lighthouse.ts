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
  final: 'lumiere',
  createWorld: (t) =>
    d({
      Hut: d({
        'welcome.txt': f(t('lighthouse-bienvenue')),
        'message.txt': f(t('lighthouse-message')),
        Beach: d({
          'sign.txt': f(t('lighthouse-panneau')),
          'mender.txt': f(t('lighthouse-ravaudeuse')),
          'seashell': f(t('lighthouse-coquillage')),
        }),
        Hill: d({
          'wind.txt': f(t('lighthouse-vent')),
          SignalSchool: d({
            'headteacher.txt': f(t('lighthouse-directrice')),
            PracticeRoom: d({
              'exercise.txt': f(t('lighthouse-consigne')),
              crab: f(t('lighthouse-crabe')),
              Bucket: d({}),
            }),
            Lessons: d({
              'lesson_1_manual.txt': f(t('lighthouse-cours-1-manuel')),
              'lesson_2_paths.txt': f(t('lighthouse-cours-2-chemins')),
              'lesson_3_hidden.txt': f(t('lighthouse-cours-3-caches')),
              '.secret_note': f(t('lighthouse-note-secrete')),
              'lesson_4_rename.txt': f(t('lighthouse-cours-4-renommer')),
            }),
            Library: d({
              'book_of_commands.txt': f(t('lighthouse-livre-des-commandes')),
            }),
          }),
        }),
        Harbour: d({
          'captain.txt': f(t('lighthouse-capitaine')),
          Boathouse: d({
            'inventory.txt': f(t('lighthouse-inventaire')),
          }),
          Storeroom: d({
            'label.txt': f(t('lighthouse-etiquette')),
            '.spare_bulb': f(t('lighthouse-ampoule-de-secours')),
          }),
        }),
        Pier: d({
          'net': f(t('lighthouse-filet')),
          'clue.txt': f(t('lighthouse-indice')),
          Lighthouse: d(
            {
              'keeper.txt': f(t('lighthouse-gardienne')),
              Stairs: d({
                'steps.txt': f(t('lighthouse-marches')),
                Lantern: d({
                  'lantern.txt': f(t('lighthouse-lanterne')),
                }),
              }),
            },
            (game) =>
              game.exists(path(game.t, `${M}/Pier/net`)) ? game.t('lighthouse-phare-bloque') : null,
          ),
        }),
      }),
    }),
  events: [
    {
      id: 'crabe',
      condition: (j) => j.exists(path(j.t, `${M}/Hill/SignalSchool/PracticeRoom/Bucket/crab`)),
      message: (j) => j.t('lighthouse-evenement-crabe'),
    },
    {
      id: 'filet',
      condition: (j) => !j.exists(path(j.t, `${M}/Pier/net`)),
      message: (j) => j.t('lighthouse-evenement-filet'),
    },
    {
      id: 'mauvais-nom',
      condition: (j) => j.exists(path(j.t, `${LANTERN}/.spare_bulb`)),
      message: (j) => j.t('lighthouse-evenement-mauvais-nom'),
    },
    {
      id: 'lumiere',
      condition: (j) => j.exists(path(j.t, `${LANTERN}/bulb`)),
      message: (j) => j.t('lighthouse-evenement-lumiere'),
    },
  ],
};
