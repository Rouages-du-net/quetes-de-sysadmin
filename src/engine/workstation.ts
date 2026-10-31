// Le poste : la machine de la joueuse ou du joueur, d'où l'on se connecte
// en ssh aux machines des histoires (machines.ts). Ce n'est pas un chapitre
// à finir : il n'a pas d'événement final. Les clés SSH de ~/.ssh dépendent
// de la progression (voir console.ts).

import { d, f, joueur, type Chapitre } from './world';
import type { Traduire } from '../texts';
import { clePrivee, clePublique, domaineMachine, MACHINES, nomMachine, POSTE, type Machine } from './machines';

const MAISON = '/home/vous';

// Le /etc/hosts du poste ; en tête, pourquoi ces noms en .internal et
// .example (ils ne mènent jamais chez quelqu'un de réel).
const hosts = (t: Traduire) =>
  [
    ...t('poste-hosts-commentaire').split('\n').map((l) => `# ${l}`),
    '',
    '127.0.0.1\tlocalhost',
    `127.0.1.1\t${domaineMachine(t, POSTE)} ${nomMachine(t, POSTE.nom)}`,
    '',
    ...MACHINES.map((m) => `${m.adresse}\t${domaineMachine(t, m)} ${nomMachine(t, m.nom)}`),
  ].join('\n');

/** Le ~/.ssh/config que le jeu donne au poste, dans une langue. */
export const config = (t: Traduire) =>
  [
    ...t('poste-config-commentaire').split('\n').map((l) => `# ${l}`),
    '',
    ...MACHINES.flatMap((m) => [
      `Host ${nomMachine(t, m.nom)}`,
      `    HostName ${domaineMachine(t, m)}`,
      `    User ${joueur(t)}`,
      ...(m.sansCle ? [] : [`    IdentityFile ~/.ssh/${cleDe(t, m)}`]),
      '',
    ]),
  ]
    .join('\n')
    .trim();

/** Le nom du fichier de la clé d'une machine, dans la langue : id_royaume, id_kingdom. */
export const cleDe = (t: Traduire, m: Machine) => `id_${nomMachine(t, m.nom)}`;

/** Les fichiers d'une clé SSH : privée (lisible par soi seul) et publique. */
export const fichiersCle = (t: Traduire, m: Machine) => ({
  [cleDe(t, m)]: f(clePrivee(m), { lignes: true, mode: 'rw-------' }),
  [`${cleDe(t, m)}.pub`]: f(clePublique(m, joueur(t), nomMachine(t, POSTE.nom)), { lignes: true }),
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
        etc: d({ hosts: f(hosts(t), { lignes: true, proprio: 'root' }) }),
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
