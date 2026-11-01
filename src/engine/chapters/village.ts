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
  id: 'village',
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
        'crieur.txt': f(t('village-crieur')),
        'parchemin_des_sorts.txt': f(t('village-parchemin-des-sorts')),
        Marche: d({
          'marchande.txt': f(t('village-marchande')),
          'pomme': f(t('village-pomme')),
          'pomme_2': f(t('village-pomme-2')),
          'fromage': f(t('village-fromage'), {
            isProtected: { rm: t('village-fromage-protege-rm') },
          }),
        }),
        Boulangerie: d({
          'boulanger.txt': f(t('village-boulanger')),
          'levain': f(t('village-levain'), {
            isProtected: { rm: t('village-levain-protege-rm') },
          }),
        }),
        Atelier: d({
          'artisane.txt': f(t('village-artisane')),
        }),
        Ecole: d({
          'institutrice.txt': f(t('village-institutrice')),
        }),
        Mairie: d({
          'greffiere.txt': f(t('village-greffiere')),
          'avis_bal.txt': shows(t('village-avis-bal')),
          'avis_chat.txt': shows(t('village-avis-chat')),
          'avis_egouts.txt': shows(t('village-avis-egouts')),
          'avis_marche.txt': shows(t('village-avis-marche')),
          'avis_horloge.txt': shows(t('village-avis-horloge')),
          '.paillasson': f(t('village-paillasson'), {
            read: (j) => {
              j.flags.add('cle-archives');
              return j.t('village-paillasson-lu');
            },
          }),
          Archives: d(
            {
              'archiviste.txt': f(t('village-archiviste')),
              'chronique.txt': f(t('village-chronique'), { lines: true }),
            },
            (game) => (game.flags.has('cle-archives') ? null : game.t('village-archives-bloque')),
          ),
        }),
        Ruelle: d(
          {
            'barricade': f(t('village-barricade'), {
              isProtected: { mv: t('village-barricade-protege-mv') },
            }),
            Cour: d(
              {
                'mur.txt': f(t('village-mur')),
                Egout: d(
                  {
                    'rats.txt': f(t('village-rats')),
                    Galerie: d(
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
      condition: (j) => j.count(path(j.t, BAKERY), name(j.t, 'levain')) >= 3,
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
      condition: (j) => j.exists(path(j.t, `${SEWER}/fromage`)),
      action: (j) => {
        j.erase(path(j.t, `${SEWER}/rats.txt`));
        j.erase(path(j.t, `${SEWER}/fromage`));
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
