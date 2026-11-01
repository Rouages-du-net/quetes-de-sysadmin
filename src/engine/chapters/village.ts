// Chapitre 2 — Le Bourg : grep, rm, touch, cp, mkdir. Notre propre histoire
// et nos propres énigmes, dans la suite de L'Île du Phare.

import { path, d, f, name, type Chapter } from '../world';
import type { Game } from '../shell';

const M = '/Quai';
const BAKERY = `${M}/Boulangerie`;
const WORKSHOP = `${M}/Atelier`;
const ALLEY = `${M}/Ruelle`;
const YARD = `${ALLEY}/Cour`;
const SEWER = `${YARD}/Egout`;
const CLASS = `${M}/Ecole/Classe`;

// Les engrenages de l'Atelier (engrenage, engrenage_2…), sous leur nom dans la langue.
const engrenages = (j: Game) => j.count(path(j.t, WORKSHOP), name(j.t, 'engrenage'));

// Un avis : une phrase par ligne (grep les lit ligne par ligne).
const shows = (text: string) => f(text, { lines: true });

export const village: Chapter = {
  id: 'bourg',
  number: 2,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'mv', 'grep', 'rm', 'touch', 'cp', 'mkdir'],
  home: M,
  names: true,
  welcome: 'crieur.txt',
  final: 'nour',
  // Dans le jeu : le levain, les engrenages, la barricade, les rats, puis Nour et sa Classe.
  steps: ['levain', 'engrenage', 'engrenages', 'barricade', 'rats', 'nour-sans-classe', 'classe', 'nour'],
  createWorld: (t) =>
    d({
      Quai: d({
        'crieur.txt': f(t('bourg-crieur')),
        'parchemin_des_sorts.txt': f(t('bourg-parchemin-des-sorts')),
        Marche: d({
          'marchande.txt': f(t('bourg-marchande')),
          'pomme': f(t('bourg-pomme')),
          'pomme_2': f(t('bourg-pomme-2')),
          'fromage': f(t('bourg-fromage'), {
            isProtected: { rm: t('bourg-fromage-protege-rm') },
          }),
        }),
        Boulangerie: d({
          'boulanger.txt': f(t('bourg-boulanger')),
          'levain': f(t('bourg-levain'), {
            isProtected: { rm: t('bourg-levain-protege-rm') },
          }),
        }),
        Atelier: d({
          'artisane.txt': f(t('bourg-artisane')),
        }),
        Ecole: d({
          'institutrice.txt': f(t('bourg-institutrice')),
        }),
        Mairie: d({
          'greffiere.txt': f(t('bourg-greffiere')),
          'avis_bal.txt': shows(t('bourg-avis-bal')),
          'avis_chat.txt': shows(t('bourg-avis-chat')),
          'avis_egouts.txt': shows(t('bourg-avis-egouts')),
          'avis_marche.txt': shows(t('bourg-avis-marche')),
          'avis_horloge.txt': shows(t('bourg-avis-horloge')),
          '.paillasson': f(t('bourg-paillasson'), {
            read: (j) => {
              j.flags.add('cle-archives');
              return j.t('bourg-paillasson-lu');
            },
          }),
          Archives: d(
            {
              'archiviste.txt': f(t('bourg-archiviste')),
              'chronique.txt': f(t('bourg-chronique'), { lines: true }),
            },
            (game) => (game.flags.has('cle-archives') ? null : game.t('bourg-archives-bloque')),
          ),
        }),
        Ruelle: d(
          {
            'barricade': f(t('bourg-barricade'), {
              isProtected: { mv: t('bourg-barricade-protege-mv') },
            }),
            Cour: d(
              {
                'mur.txt': f(t('bourg-mur')),
                Egout: d(
                  {
                    'rats.txt': f(t('bourg-rats')),
                    Galerie: d(
                      {
                        'nour.txt': f(t('bourg-nour'), {
                          read: (j) => {
                            j.flags.add('nour-lue');
                          },
                        }),
                      },
                      (game) => (game.exists(path(game.t, `${SEWER}/rats.txt`)) ? game.t('bourg-galerie-bloque') : null),
                    ),
                  },
                ),
              },
              (game) => (game.exists(path(game.t, `${ALLEY}/barricade`)) ? game.t('bourg-cour-bloque') : null),
            ),
          },
          (game) =>
            engrenages(game) >= 5 ? null : game.t('bourg-ruelle-bloque'),
        ),
      }),
    }),
  events: [
    {
      id: 'levain',
      condition: (j) => j.count(path(j.t, BAKERY), name(j.t, 'levain')) >= 3,
      message: (j) => j.t('bourg-evenement-levain'),
    },
    {
      id: 'engrenage',
      condition: (j) => engrenages(j) >= 1,
      message: (j) => j.t('bourg-evenement-engrenage'),
    },
    {
      id: 'engrenages',
      condition: (j) => engrenages(j) >= 5,
      message: (j) => j.t('bourg-evenement-engrenages'),
    },
    {
      id: 'classe',
      condition: (j) => j.find(path(j.t, CLASS))?.type === 'dossier',
      message: (j) =>
        j.flags.has('nour-lue')
          ? j.t('bourg-evenement-classe')
          : j.t('bourg-evenement-classe-sans-nour'),
    },
    {
      id: 'barricade',
      condition: (j) => !j.exists(path(j.t, `${ALLEY}/barricade`)),
      message: (j) => j.t('bourg-evenement-barricade'),
    },
    {
      id: 'rats',
      condition: (j) => j.exists(path(j.t, `${SEWER}/fromage`)),
      action: (j) => {
        j.erase(path(j.t, `${SEWER}/rats.txt`));
        j.erase(path(j.t, `${SEWER}/fromage`));
      },
      message: (j) => j.t('bourg-evenement-rats'),
    },
    {
      id: 'nour-sans-classe',
      condition: (j) => j.flags.has('nour-lue') && j.find(path(j.t, CLASS))?.type !== 'dossier',
      message: (j) => j.t('bourg-evenement-nour-sans-classe'),
    },
    {
      id: 'nour',
      condition: (j) => j.flags.has('nour-lue') && j.find(path(j.t, CLASS))?.type === 'dossier',
      message: (j) => j.t('bourg-evenement-nour'),
    },
  ],
};
