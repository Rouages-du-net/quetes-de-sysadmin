// Le poste : la machine de la joueuse ou du joueur, d'où l'on se connecte
// en ssh aux machines des histoires (machines.ts). Ce n'est pas un chapitre
// à finir : il n'a pas d'événement final. Les clés SSH de ~/.ssh dépendent
// de la progression (voir console.ts).

import { d, f, player, type Chapter } from './world';
import type { Translate } from '../texts';
import { privateKey, publicKey, machineDomain, MACHINES, machineName, WORKSTATION, type Machine } from './machines';

const HOME = '/home/you';

// Le /etc/hosts du poste ; en tête, pourquoi ces noms en .internal et
// .example (ils ne mènent jamais chez quelqu'un de réel).
const hosts = (t: Translate) =>
  [
    ...t('workstation-hosts-comment').split('\n').map((l) => `# ${l}`),
    '',
    '127.0.0.1\tlocalhost',
    `127.0.1.1\t${machineDomain(t, WORKSTATION)} ${machineName(t, WORKSTATION.name)}`,
    '',
    ...MACHINES.map((m) => `${m.address}\t${machineDomain(t, m)} ${machineName(t, m.name)}`),
  ].join('\n');

/** Le ~/.ssh/config que le jeu donne au poste, dans une langue. */
export const config = (t: Translate) =>
  [
    ...t('workstation-config-comment').split('\n').map((l) => `# ${l}`),
    '',
    ...MACHINES.flatMap((m) => [
      `Host ${machineName(t, m.name)}`,
      `    HostName ${machineDomain(t, m)}`,
      `    User ${player(t)}`,
      ...(m.withoutKey ? [] : [`    IdentityFile ~/.ssh/${keyFor(t, m)}`]),
      '',
    ]),
  ]
    .join('\n')
    .trim();

/** Le nom du fichier de la clé d'une machine, dans la langue : id_royaume, id_kingdom. */
export const keyFor = (t: Translate, m: Machine) => `id_${machineName(t, m.name)}`;

/** Les fichiers d'une clé SSH : privée (lisible par soi seul) et publique. */
export const keyFiles = (t: Translate, m: Machine) => ({
  [keyFor(t, m)]: f(privateKey(m), { lines: true, mode: 'rw-------' }),
  [`${keyFor(t, m)}.pub`]: f(publicKey(m, player(t), machineName(t, WORKSTATION.name)), { lines: true }),
});

/** Le poste, avec les clés des machines déjà ouvertes. */
export function workstation(keys: Machine[]): Chapter {
  return {
    id: 'desk',
    number: 0,
    commands: [
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
    home: HOME,
    names: true,
    welcome: 'welcome.txt',
    final: '',
    events: [],
    createWorld: (t) =>
      d({
        etc: d({ hosts: f(hosts(t), { lines: true, owner: 'root' }) }),
        home: d({
          you: d({
            'welcome.txt': f(t('workstation-welcome')),
            '.ssh': d(
              { config: f(config(t), { lines: true }), ...Object.assign({}, ...keys.map((m) => keyFiles(t, m))) },
              undefined,
              { mode: 'rwx------' },
            ),
          }),
        }),
      }),
  };
}
