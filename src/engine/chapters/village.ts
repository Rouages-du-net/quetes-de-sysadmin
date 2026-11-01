// Chapitre 2 — Le Bourg : grep, rm, touch, cp, mkdir. Notre propre histoire
// et nos propres énigmes, dans la suite de L'Île du Phare.

import { path, d, f, name, type Chapter } from '../world';
import type { Game } from '../shell';

const M = '/Quay';
const BAKERY = `${M}/Bakery`;
const WORKSHOP = `${M}/Workshop`;
const ALLEY = `${M}/Alley`;
const YARD = `${ALLEY}/Yard`;
const SEWER = `${YARD}/Sewer`;
const CLASS = `${M}/School/Classroom`;

// Les engrenages de l'Atelier (engrenage, engrenage_2…), sous leur nom dans la langue.
const engrenages = (j: Game) => j.count(path(j.t, WORKSHOP), name(j.t, 'gear'));

// Un avis : une phrase par ligne (grep les lit ligne par ligne).
const shows = (text: string) => f(text, { lines: true });

export const village: Chapter = {
  id: 'village',
  number: 2,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'mv', 'grep', 'rm', 'touch', 'cp', 'mkdir'],
  home: M,
  names: true,
  welcome: 'crier.txt',
  final: 'nour',
  // Dans le jeu : le levain, les engrenages, la barricade, les rats, puis Nour et sa Classe.
  steps: ['levain', 'engrenage', 'engrenages', 'barricade', 'rats', 'nour-sans-classe', 'classe', 'nour'],
  createWorld: (t) =>
    d({
      Quay: d({
        'crier.txt': f(t('village-crieur')),
        'scroll_of_spells.txt': f(t('village-parchemin-des-sorts')),
        Market: d({
          'stallholder.txt': f(t('village-marchande')),
          'apple': f(t('village-pomme')),
          'apple_2': f(t('village-pomme-2')),
          'cheese': f(t('village-fromage'), {
            isProtected: { rm: t('village-fromage-protege-rm') },
          }),
        }),
        Bakery: d({
          'baker.txt': f(t('village-boulanger')),
          'sourdough': f(t('village-levain'), {
            isProtected: { rm: t('village-levain-protege-rm') },
          }),
        }),
        Workshop: d({
          'maker.txt': f(t('village-artisane')),
        }),
        School: d({
          'teacher.txt': f(t('village-institutrice')),
        }),
        TownHall: d({
          'clerk.txt': f(t('village-greffiere')),
          'notice_dance.txt': shows(t('village-avis-bal')),
          'notice_cat.txt': shows(t('village-avis-chat')),
          'notice_sewers.txt': shows(t('village-avis-egouts')),
          'notice_market.txt': shows(t('village-avis-marche')),
          'notice_clock.txt': shows(t('village-avis-horloge')),
          '.doormat': f(t('village-paillasson'), {
            read: (j) => {
              j.flags.add('cle-archives');
              return j.t('village-paillasson-lu');
            },
          }),
          Archives: d(
            {
              'archivist.txt': f(t('village-archiviste')),
              'chronicle.txt': f(t('village-chronique'), { lines: true }),
            },
            (game) => (game.flags.has('cle-archives') ? null : game.t('village-archives-bloque')),
          ),
        }),
        Alley: d(
          {
            'barricade': f(t('village-barricade'), {
              isProtected: { mv: t('village-barricade-protege-mv') },
            }),
            Yard: d(
              {
                'wall.txt': f(t('village-mur')),
                Sewer: d(
                  {
                    'rats.txt': f(t('village-rats')),
                    Tunnel: d(
                      {
                        'nour.txt': f(t('village-nour'), {
                          read: (j) => {
                            j.flags.add('nour-lue');
                          },
                        }),
                      },
                      (game) => (game.exists(path(game.t, `${SEWER}/rats.txt`)) ? game.t('village-galerie-bloque') : null),
                    ),
                  },
                ),
              },
              (game) => (game.exists(path(game.t, `${ALLEY}/barricade`)) ? game.t('village-cour-bloque') : null),
            ),
          },
          (game) =>
            engrenages(game) >= 5 ? null : game.t('village-ruelle-bloque'),
        ),
      }),
    }),
  events: [
    {
      id: 'levain',
      condition: (j) => j.count(path(j.t, BAKERY), name(j.t, 'sourdough')) >= 3,
      message: (j) => j.t('village-evenement-levain'),
    },
    {
      id: 'engrenage',
      condition: (j) => engrenages(j) >= 1,
      message: (j) => j.t('village-evenement-engrenage'),
    },
    {
      id: 'engrenages',
      condition: (j) => engrenages(j) >= 5,
      message: (j) => j.t('village-evenement-engrenages'),
    },
    {
      id: 'classe',
      condition: (j) => j.find(path(j.t, CLASS))?.type === 'dossier',
      message: (j) =>
        j.flags.has('nour-lue')
          ? j.t('village-evenement-classe')
          : j.t('village-evenement-classe-sans-nour'),
    },
    {
      id: 'barricade',
      condition: (j) => !j.exists(path(j.t, `${ALLEY}/barricade`)),
      message: (j) => j.t('village-evenement-barricade'),
    },
    {
      id: 'rats',
      condition: (j) => j.exists(path(j.t, `${SEWER}/cheese`)),
      action: (j) => {
        j.erase(path(j.t, `${SEWER}/rats.txt`));
        j.erase(path(j.t, `${SEWER}/cheese`));
      },
      message: (j) => j.t('village-evenement-rats'),
    },
    {
      id: 'nour-sans-classe',
      condition: (j) => j.flags.has('nour-lue') && j.find(path(j.t, CLASS))?.type !== 'dossier',
      message: (j) => j.t('village-evenement-nour-sans-classe'),
    },
    {
      id: 'nour',
      condition: (j) => j.flags.has('nour-lue') && j.find(path(j.t, CLASS))?.type === 'dossier',
      message: (j) => j.t('village-evenement-nour'),
    },
  ],
};
