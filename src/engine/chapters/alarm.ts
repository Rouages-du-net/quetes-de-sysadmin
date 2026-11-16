// Story "The Bastion" — chapter "The Alarm": Saturday, 8:20. The hosting
// provider has written to Nadia: since the night of 12 to 13 April, the
// server has been talking to a known mining pool. Before touching anything,
// find out and write down what is happening:
//   - what runs: top or ps (a "kworkerd" at almost 200 % CPU, owned by
//     deploy, started from /tmp/.cache: a real kernel thread shows in
//     brackets, belongs to root and has no path);
//   - where it talks to: sudo ss -tnp or sudo netstat -tnp (the pool's
//     address, port 3333, and the process);
//   - how it got in: journalctl -u ssh (fourteen failed passwords on
//     deploy, then "Accepted password" from the same address), last.
// Objective checked on the state: incident.md holds the program's path, the
// pool's address, the account, the intruder's address and the time of the
// login. Nothing is stopped yet: observing comes before acting.
// Sources: https://man7.org/linux/man-pages/man1/ps.1.html,
// https://man7.org/linux/man-pages/man8/ss.8.html,
// https://www.freedesktop.org/software/systemd/man/latest/journalctl.html,
// https://csrc.nist.gov/pubs/sp/800/61/r2/final (detection and analysis)

import { f, path, type Chapter } from '../world';
import type { Game } from '../shell';
import { ATTACKER, M, PASSWORD, POOL, POOL_PORT, bastionAccounts, bastionState, bastionWorld, initialiseBastion } from './bastion';

const ran = (j: Game, ...names: string[]) => j.last.commands.some((c) => names.includes(c[0]) || (c[0] === 'sudo' && names.includes(c[1])));
const note = (j: Game) => j.read(path(j.t, `${M}/incident.md`)) ?? '';
const noted = (j: Game) => {
  const n = note(j);
  return n.includes('kworkerd') && n.includes(POOL) && n.includes('deploy') && n.includes(ATTACKER) && /\b0?2:40\b/.test(n);
};

export const alarm: Chapter = {
  id: 'alarm',
  number: 1,
  commands: [
    'ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'find', 'nano', 'sudo', 'id', 'whoami', 'who', 'last', 'ps', 'top', 'pgrep',
    'ss', 'netstat', 'journalctl', 'systemctl', 'uptime', 'crontab',
  ],
  home: M,
  welcome: 'email_nadia.txt',
  names: true,
  final: 'end',
  steps: ['process', 'connection', 'entry', 'end'],
  password: PASSWORD,
  accounts: bastionAccounts,
  state: (t) => bastionState(t, { miner: true }),
  initialise: initialiseBastion,
  createWorld: (t) =>
    bastionWorld(t, {
      home: {
        'email_nadia.txt': f(t('alarm-email-nadia')),
        'incident.md': f(t('alarm-incident-template'), { lines: true }),
      },
    }),
  events: [
    {
      id: 'process',
      condition: (j) => ran(j, 'ps', 'top', 'pgrep') && j.last.output.includes('kworkerd'),
      message: (j) => j.t('alarm-event-process'),
    },
    {
      id: 'connection',
      condition: (j) => ran(j, 'ss', 'netstat') && j.last.output.includes(`${POOL}:${POOL_PORT}`),
      message: (j) => j.t(j.last.output.includes('kworkerd') ? 'alarm-event-connection' : 'alarm-event-connection-anonymous', { pool: POOL }),
    },
    {
      id: 'entry',
      condition: (j) => j.last.output.includes(`Accepted password for deploy from ${ATTACKER}`),
      message: (j) => j.t('alarm-event-entry', { address: ATTACKER }),
    },
    {
      id: 'stopped-early',
      condition: (j) => j.state.respawned !== undefined,
      message: (j) => j.t('alarm-event-stopped-early'),
    },
    {
      id: 'end',
      condition: (j) => noted(j) && j.flags.has('process') && j.flags.has('connection') && j.flags.has('entry'),
      message: (j) => j.t('alarm-event-end'),
    },
  ],
};
