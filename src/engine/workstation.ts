// The workstation: the player's machine, from which they connect over ssh
// to the stories' machines (machines.ts). It is not a chapter to finish: it
// has no final event. The SSH keys in ~/.ssh depend on the progress (see
// console.ts).

import { d, f, player, type Chapter } from './world';
import type { Translate } from '../texts';
import { privateKey, publicKey, machineDomain, MACHINES, machineName, WORKSTATION, type Machine } from './machines';

const HOME = '/home/you';

// The workstation's /etc/hosts; at the top, why these .internal and
// .example names (they never lead to anyone real).
const hosts = (t: Translate) =>
  [
    ...t('workstation-hosts-comment').split('\n').map((l) => `# ${l}`),
    '',
    '127.0.0.1\tlocalhost',
    `127.0.1.1\t${machineDomain(t, WORKSTATION)} ${machineName(t, WORKSTATION.name)}`,
    '',
    ...MACHINES.map((m) => `${m.address}\t${machineDomain(t, m)} ${machineName(t, m.name)}`),
  ].join('\n');

/** The ~/.ssh/config the game gives the workstation, in one language. */
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

/** The file name of a machine's key, in the language: id_kingdom, id_royaume. */
export const keyFor = (t: Translate, m: Machine) => `id_${machineName(t, m.name)}`;

/** The files of an SSH key: private (readable by oneself only) and public. */
export const keyFiles = (t: Translate, m: Machine) => ({
  [keyFor(t, m)]: f(privateKey(m), { lines: true, mode: 'rw-------' }),
  [`${keyFor(t, m)}.pub`]: f(publicKey(m, player(t), machineName(t, WORKSTATION.name)), { lines: true }),
});

/** The workstation, with the keys of the machines already opened. */
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
