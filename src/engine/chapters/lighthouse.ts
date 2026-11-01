// Chapitre 1 — L'Île du Phare : ls, cd, pwd, cat (less), ls -a, mv (déplacer
// et renommer), chemins (.., ~, /). Notre propre histoire et nos propres
// énigmes ; l'idée d'apprendre les commandes en se déplaçant de lieu en lieu
// vient de Terminus (MIT).

import { path, d, f, type Chapter } from '../world';

const M = '/Cabane';
const LANTERN = `${M}/Jetee/Phare/Escalier/Lanterne`;

export const awakening: Chapter = {
  id: 'lighthouse',
  number: 1,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'mv'],
  home: M,
  names: true,
  welcome: 'bienvenue.txt',
  final: 'lumiere',
  createWorld: (t) =>
    d({
      Cabane: d({
        'bienvenue.txt': f(t('lighthouse-bienvenue')),
        'message.txt': f(t('lighthouse-message')),
        Plage: d({
          'panneau.txt': f(t('lighthouse-panneau')),
          'ravaudeuse.txt': f(t('lighthouse-ravaudeuse')),
          'coquillage': f(t('lighthouse-coquillage')),
        }),
        Colline: d({
          'vent.txt': f(t('lighthouse-vent')),
          EcoleDesSignaux: d({
            'directrice.txt': f(t('lighthouse-directrice')),
            SalleDExercice: d({
              'consigne.txt': f(t('lighthouse-consigne')),
              crabe: f(t('lighthouse-crabe')),
              Seau: d({}),
            }),
            Cours: d({
              'cours_1_manuel.txt': f(t('lighthouse-cours-1-manuel')),
              'cours_2_chemins.txt': f(t('lighthouse-cours-2-chemins')),
              'cours_3_caches.txt': f(t('lighthouse-cours-3-caches')),
              '.note_secrete': f(t('lighthouse-note-secrete')),
              'cours_4_renommer.txt': f(t('lighthouse-cours-4-renommer')),
            }),
            Bibliotheque: d({
              'livre_des_commandes.txt': f(t('lighthouse-livre-des-commandes')),
            }),
          }),
        }),
        Port: d({
          'capitaine.txt': f(t('lighthouse-capitaine')),
          Hangar: d({
            'inventaire.txt': f(t('lighthouse-inventaire')),
          }),
          Remise: d({
            'etiquette.txt': f(t('lighthouse-etiquette')),
            '.ampoule_de_secours': f(t('lighthouse-ampoule-de-secours')),
          }),
        }),
        Jetee: d({
          'filet': f(t('lighthouse-filet')),
          'indice.txt': f(t('lighthouse-indice')),
          Phare: d(
            {
              'gardienne.txt': f(t('lighthouse-gardienne')),
              Escalier: d({
                'marches.txt': f(t('lighthouse-marches')),
                Lanterne: d({
                  'lanterne.txt': f(t('lighthouse-lanterne')),
                }),
              }),
            },
            (game) =>
              game.exists(path(game.t, `${M}/Jetee/filet`)) ? game.t('lighthouse-phare-bloque') : null,
          ),
        }),
      }),
    }),
  events: [
    {
      id: 'crabe',
      condition: (j) => j.exists(path(j.t, `${M}/Colline/EcoleDesSignaux/SalleDExercice/Seau/crabe`)),
      message: (j) => j.t('lighthouse-evenement-crabe'),
    },
    {
      id: 'filet',
      condition: (j) => !j.exists(path(j.t, `${M}/Jetee/filet`)),
      message: (j) => j.t('lighthouse-evenement-filet'),
    },
    {
      id: 'mauvais-nom',
      condition: (j) => j.exists(path(j.t, `${LANTERN}/.ampoule_de_secours`)),
      message: (j) => j.t('lighthouse-evenement-mauvais-nom'),
    },
    {
      id: 'lumiere',
      condition: (j) => j.exists(path(j.t, `${LANTERN}/ampoule`)),
      message: (j) => j.t('lighthouse-evenement-lumiere'),
    },
  ],
};
