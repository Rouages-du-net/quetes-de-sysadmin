// Le poste : la machine de la joueuse ou du joueur, d'où l'on se connecte
// en ssh aux machines des histoires (machines.ts). Ce n'est pas un chapitre
// à finir : il n'a pas d'événement final. Les clés SSH de ~/.ssh dépendent
// de la progression (voir console.ts).

import { d, f, joueur, type Chapitre } from './monde';
import type { Traduire } from '../textes';
import { clePrivee, clePublique, MACHINES, POSTE, type Machine } from './machines';

const MAISON = '/home/vous';

const hosts = () =>
  [
    '127.0.0.1\tlocalhost',
    `127.0.1.1\t${POSTE.domaine} ${POSTE.nom}`,
    '',
    ...MACHINES.map((m) => `${m.adresse}\t${m.domaine} ${m.nom}`),
  ].join('\n');

/** Le ~/.ssh/config que le jeu donne au poste, dans une langue. */
export const config = (t: Traduire) =>
  [
    ...t('poste-config-commentaire').split('\n').map((l) => `# ${l}`),
    '',
    ...MACHINES.flatMap((m) => [
      `Host ${m.nom}`,
      `    HostName ${m.domaine}`,
      `    User ${joueur(t)}`,
      ...(m.sansCle ? [] : [`    IdentityFile ~/.ssh/id_${m.nom}`]),
      '',
    ]),
  ]
    .join('\n')
    .trim();

/** Les fichiers d'une clé SSH : privée (lisible par soi seul) et publique. */
export const fichiersCle = (t: Traduire, m: Machine) => ({
  [`id_${m.nom}`]: f(clePrivee(m), { lignes: true, mode: 'rw-------' }),
  [`id_${m.nom}.pub`]: f(clePublique(m, joueur(t)), { lignes: true }),
});

/** Le poste, avec les clés des machines déjà ouvertes. */
export function poste(cles: Machine[]): Chapitre {
  return {
    id: 'poste',
    numero: 0,
    commandes: [
      'ls',
      'cd',
      'pwd',
      'cat',
      'less',
      'chmod',
      'mkdir',
      'cp',
      'mv',
      'rm',
      'nano',
      'ssh',
      'ssh-keygen',
      'ssh-copy-id',
      'scp',
      'sftp',
      'lftp',
      'rsync',
      'curl',
      'ps',
      'kill',
      'nc',
    ],
    maison: MAISON,
    noms: true,
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
              { config: f(config(t), { lignes: true }), ...Object.assign({}, ...cles.map((m) => fichiersCle(t, m))) },
              undefined,
              { mode: 'rwx------' },
            ),
          }),
        }),
      }),
  };
}
