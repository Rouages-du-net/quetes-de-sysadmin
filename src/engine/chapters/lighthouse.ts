// Chapitre 1 — L'Île du Phare : ls, cd, pwd, cat (less), ls -a, mv (déplacer
// et renommer), chemins (.., ~, /). Notre propre histoire et nos propres
// énigmes ; l'idée d'apprendre les commandes en se déplaçant de lieu en lieu
// vient de Terminus (MIT).

import { chemin, d, f, type Chapitre } from '../world';

const M = '/Cabane';
const LANTERNE = `${M}/Jetee/Phare/Escalier/Lanterne`;

export const eveil: Chapitre = {
  id: 'eveil',
  numero: 1,
  commandes: ['ls', 'cd', 'pwd', 'cat', 'less', 'mv'],
  maison: M,
  noms: true,
  accueil: 'bienvenue.txt',
  final: 'lumiere',
  creerMonde: (t) =>
    d({
      Cabane: d({
        'bienvenue.txt': f(t('eveil-bienvenue')),
        'message.txt': f(t('eveil-message')),
        Plage: d({
          'panneau.txt': f(t('eveil-panneau')),
          'ravaudeuse.txt': f(t('eveil-ravaudeuse')),
          'coquillage': f(t('eveil-coquillage')),
        }),
        Colline: d({
          'vent.txt': f(t('eveil-vent')),
          EcoleDesSignaux: d({
            'directrice.txt': f(t('eveil-directrice')),
            SalleDExercice: d({
              'consigne.txt': f(t('eveil-consigne')),
              crabe: f(t('eveil-crabe')),
              Seau: d({}),
            }),
            Cours: d({
              'cours_1_manuel.txt': f(t('eveil-cours-1-manuel')),
              'cours_2_chemins.txt': f(t('eveil-cours-2-chemins')),
              'cours_3_caches.txt': f(t('eveil-cours-3-caches')),
              '.note_secrete': f(t('eveil-note-secrete')),
              'cours_4_renommer.txt': f(t('eveil-cours-4-renommer')),
            }),
            Bibliotheque: d({
              'livre_des_commandes.txt': f(t('eveil-livre-des-commandes')),
            }),
          }),
        }),
        Port: d({
          'capitaine.txt': f(t('eveil-capitaine')),
          Hangar: d({
            'inventaire.txt': f(t('eveil-inventaire')),
          }),
          Remise: d({
            'etiquette.txt': f(t('eveil-etiquette')),
            '.ampoule_de_secours': f(t('eveil-ampoule-de-secours')),
          }),
        }),
        Jetee: d({
          'filet': f(t('eveil-filet')),
          'indice.txt': f(t('eveil-indice')),
          Phare: d(
            {
              'gardienne.txt': f(t('eveil-gardienne')),
              Escalier: d({
                'marches.txt': f(t('eveil-marches')),
                Lanterne: d({
                  'lanterne.txt': f(t('eveil-lanterne')),
                }),
              }),
            },
            (jeu) =>
              jeu.existe(chemin(jeu.t, `${M}/Jetee/filet`)) ? jeu.t('eveil-phare-bloque') : null,
          ),
        }),
      }),
    }),
  evenements: [
    {
      id: 'crabe',
      condition: (j) => j.existe(chemin(j.t, `${M}/Colline/EcoleDesSignaux/SalleDExercice/Seau/crabe`)),
      message: (j) => j.t('eveil-evenement-crabe'),
    },
    {
      id: 'filet',
      condition: (j) => !j.existe(chemin(j.t, `${M}/Jetee/filet`)),
      message: (j) => j.t('eveil-evenement-filet'),
    },
    {
      id: 'mauvais-nom',
      condition: (j) => j.existe(chemin(j.t, `${LANTERNE}/.ampoule_de_secours`)),
      message: (j) => j.t('eveil-evenement-mauvais-nom'),
    },
    {
      id: 'lumiere',
      condition: (j) => j.existe(chemin(j.t, `${LANTERNE}/ampoule`)),
      message: (j) => j.t('eveil-evenement-lumiere'),
    },
  ],
};
