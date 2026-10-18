// Le poste : la machine de la joueuse ou du joueur, d'où l'on se connecte
// en ssh aux machines des histoires (machines.ts). Ce n'est pas un chapitre
// à finir : il n'a pas d'événement final. Les clés SSH de ~/.ssh dépendent
// de la progression (voir console.ts).

import { d, f, type Chapitre } from './monde';
import { clePrivee, clePublique, MACHINES, POSTE, type Machine } from './machines';

const MAISON = '/home/vous';

const hosts = () =>
  [
    '127.0.0.1\tlocalhost',
    `127.0.1.1\t${POSTE.domaine} ${POSTE.nom}`,
    '',
    ...MACHINES.map((m) => `${m.adresse}\t${m.domaine} ${m.nom}`),
  ].join('\n');

const config = (commentaire: string) =>
  [
    ...commentaire.split('\n').map((l) => `# ${l}`),
    '',
    ...MACHINES.flatMap((m) => [`Host ${m.nom}`, `    HostName ${m.domaine}`, '    User vous', `    IdentityFile ~/.ssh/id_${m.nom}`, '']),
  ]
    .join('\n')
    .trim();

/** Les fichiers d'une clé SSH : privée (lisible par soi seul) et publique. */
export const fichiersCle = (m: Machine) => ({
  [`id_${m.nom}`]: f(clePrivee(m), { lignes: true, mode: 'rw-------' }),
  [`id_${m.nom}.pub`]: f(clePublique(m), { lignes: true }),
});

/** Le poste, avec les clés des machines déjà ouvertes. */
export function poste(cles: Machine[]): Chapitre {
  return {
    id: 'poste',
    numero: 0,
    commandes: ['ls', 'cd', 'pwd', 'cat', 'less', 'chmod', 'nano', 'ssh'],
    maison: MAISON,
    accueil: 'bienvenue.txt',
    final: '',
    evenements: [],
    creerMonde: (t) =>
      d({
        etc: d({ hosts: f(hosts(), { lignes: true, proprio: 'root' }) }),
        home: d({
          vous: d({
            'bienvenue.txt': f(t('poste-bienvenue')),
            '.ssh': d(
              { config: f(config(t('poste-config-commentaire')), { lignes: true }), ...Object.assign({}, ...cles.map(fichiersCle)) },
              undefined,
              { mode: 'rwx------' },
            ),
          }),
        }),
      }),
  };
}
