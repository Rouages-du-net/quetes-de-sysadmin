// Chapter 2 — The Town: grep, rm, touch, cp, mkdir. Our own story and our
// own puzzles, following The Lighthouse Island.

import { path, d, f, name, type Chapter } from '../world';
import type { Game } from '../shell';

const M = '/Quay';
const BAKERY = `${M}/Bakery`;
const WORKSHOP = `${M}/Workshop`;
const ALLEY = `${M}/Alley`;
const YARD = `${ALLEY}/Yard`;
const SEWER = `${YARD}/Sewer`;
const CLASS = `${M}/School/Classroom`;

// The Workshop's gears (gear, gear_2…), under their name in the language.
const engrenages = (j: Game) => j.count(path(j.t, WORKSHOP), name(j.t, 'gear'));

// A notice: one sentence per line (grep reads them line by line).
const shows = (text: string) => f(text, { lines: true });

export const village: Chapter = {
  id: 'village',
  number: 2,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'mv', 'grep', 'rm', 'touch', 'cp', 'mkdir'],
  home: M,
  names: true,
  welcome: 'crier.txt',
  final: 'nour',
  // In the game: the sourdough, the gears, the barricade, the rats, then Nour and her Class.
  steps: ['sourdough', 'gear', 'gears', 'barricade', 'rats', 'nour-without-class', 'class', 'nour'],
  createWorld: (t) =>
    d({
      Quay: d({
        'crier.txt': f(t('village-crier')),
        'scroll_of_spells.txt': f(t('village-scroll-spells')),
        Market: d({
          'stallholder.txt': f(t('village-stallholder')),
          'apple': f(t('village-apple')),
          'apple_2': f(t('village-apple-2')),
          'cheese': f(t('village-cheese'), {
            isProtected: { rm: t('village-cheese-protected-rm') },
          }),
        }),
        Bakery: d({
          'baker.txt': f(t('village-baker')),
          'sourdough': f(t('village-sourdough'), {
            isProtected: { rm: t('village-sourdough-protected-rm') },
          }),
        }),
        Workshop: d({
          'maker.txt': f(t('village-craftswoman')),
        }),
        School: d({
          'teacher.txt': f(t('village-teacher')),
        }),
        TownHall: d({
          'clerk.txt': f(t('village-clerk')),
          'notice_dance.txt': shows(t('village-notice-ball')),
          'notice_cat.txt': shows(t('village-notice-cat')),
          'notice_sewers.txt': shows(t('village-notice-sewers')),
          'notice_market.txt': shows(t('village-notice-works')),
          'notice_clock.txt': shows(t('village-notice-clock')),
          '.doormat': f(t('village-doormat'), {
            read: (j) => {
              j.flags.add('key-archives');
              return j.t('village-doormat-read');
            },
          }),
          Archives: d(
            {
              'archivist.txt': f(t('village-archivist')),
              'chronicle.txt': f(t('village-column'), { lines: true }),
            },
            (game) => (game.flags.has('key-archives') ? null : game.t('village-archives-blocked')),
          ),
        }),
        Alley: d(
          {
            'barricade': f(t('village-barricade'), {
              isProtected: { mv: t('village-barricade-protected-mv') },
            }),
            Yard: d(
              {
                'wall.txt': f(t('village-wall')),
                Sewer: d(
                  {
                    'rats.txt': f(t('village-rats')),
                    Tunnel: d(
                      {
                        'nour.txt': f(t('village-nour'), {
                          read: (j) => {
                            j.flags.add('nour-read');
                          },
                        }),
                      },
                      (game) => (game.exists(path(game.t, `${SEWER}/rats.txt`)) ? game.t('village-gallery-blocked') : null),
                    ),
                  },
                ),
              },
              (game) => (game.exists(path(game.t, `${ALLEY}/barricade`)) ? game.t('village-yard-blocked') : null),
            ),
          },
          (game) =>
            engrenages(game) >= 5 ? null : game.t('village-alley-blocked'),
        ),
      }),
    }),
  events: [
    {
      id: 'sourdough',
      condition: (j) => j.count(path(j.t, BAKERY), name(j.t, 'sourdough')) >= 3,
      message: (j) => j.t('village-event-sourdough'),
    },
    {
      id: 'gear',
      condition: (j) => engrenages(j) >= 1,
      message: (j) => j.t('village-event-gear'),
    },
    {
      id: 'gears',
      condition: (j) => engrenages(j) >= 5,
      message: (j) => j.t('village-event-gears'),
    },
    {
      id: 'class',
      condition: (j) => j.find(path(j.t, CLASS))?.type === 'directory',
      message: (j) =>
        j.flags.has('nour-read')
          ? j.t('village-event-class')
          : j.t('village-event-class-without-nour'),
    },
    {
      id: 'barricade',
      condition: (j) => !j.exists(path(j.t, `${ALLEY}/barricade`)),
      message: (j) => j.t('village-event-barricade'),
    },
    {
      id: 'rats',
      condition: (j) => j.exists(path(j.t, `${SEWER}/cheese`)),
      action: (j) => {
        j.erase(path(j.t, `${SEWER}/rats.txt`));
        j.erase(path(j.t, `${SEWER}/cheese`));
      },
      message: (j) => j.t('village-event-rats'),
    },
    {
      id: 'nour-without-class',
      condition: (j) => j.flags.has('nour-read') && j.find(path(j.t, CLASS))?.type !== 'directory',
      message: (j) => j.t('village-event-nour-without-class'),
    },
    {
      id: 'nour',
      condition: (j) => j.flags.has('nour-read') && j.find(path(j.t, CLASS))?.type === 'directory',
      message: (j) => j.t('village-event-nour'),
    },
  ],
};
