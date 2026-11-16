// Story "The Bastion" — chapter "Containment": 9:05. Nadia asks whether to
// unplug the server. No: turning it off loses what runs in memory, and the
// deliveries stop. Contain it instead, without locking yourself out:
//   - cut the miner off from the pool (iptables -A OUTPUT -d POOL -j DROP,
//     or the replies on INPUT) and the intruder's address from the
//     machine (iptables -A INPUT -s ATTACKER -j DROP); a "-P INPUT DROP"
//     without an ACCEPT for your own ssh would lock your next login out;
//   - stop the miner: a watchdog (sh /tmp/.cache/.w) starts it again
//     within 30 seconds. Stop the watchdog first (kill, or kill -STOP to
//     freeze it), then the miner; killall -u deploy also takes the delivery
//     app down (restart it: the tampered app relaunches the watchdog);
//   - close the deploy account: usermod -L only locks the password, and
//     sshd still accepts a key (the intruder added one); expire it
//     (usermod -e 1, or chage -E 0) or give it nologin.
// Objective checked on the state: the pool and the intruder's address
// blocked, your workstation still allowed on 22, no process left from
// /tmp/.cache, deploy unable to log in, the delivery app running.
// Sources: https://man7.org/linux/man-pages/man8/iptables.8.html,
// https://man7.org/linux/man-pages/man1/kill.1.html,
// https://man7.org/linux/man-pages/man8/usermod.8.html ("-L ... if you
// wish to lock the account (not only access with a password), you should
// also set the EXPIRE_DATE to 1"),
// https://csrc.nist.gov/pubs/sp/800/61/r2/final (containment)

import { f, type Chapter } from '../world';
import type { Game } from '../shell';
import { iptables } from '../iptables';
import {
  ATTACKER, M, PASSWORD, POOL, appAlive, attackerBlocked, bastionAccounts, bastionState, bastionWorld, initialiseBastion, intruderProcs, poolBlocked as outBlocked,
  workstationIn,
} from './bastion';

const NOW_DAY = '2029-04-14';
const NOLOGIN = ['/usr/sbin/nologin', '/sbin/nologin', '/bin/false', '/usr/bin/false'];

/** Cut from the pool: an OUTPUT rule, or an INPUT rule dropping its replies. */
export const poolCut = (j: Game) => {
  if (outBlocked(j)) return true;
  const i = iptables(j.state);
  return !!i?.filter.chains.INPUT.rules.some((r) => r.source && (r.source === POOL || r.source === `${POOL}/32`) && ['DROP', 'REJECT'].includes(r.target));
};
const deploy = (j: Game) => j.accounts.users.deploy;
/** deploy can no longer log in at all (key included). */
export const deployClosed = (j: Game) => {
  const u = deploy(j);
  return !!u && ((u.expires !== undefined && u.expires <= NOW_DAY) || NOLOGIN.includes(u.shell ?? ''));
};
const passwordOnly = (j: Game) => ((j.state.lockedAccounts ?? []) as string[]).includes('deploy') && !deployClosed(j);
const done = (j: Game) => poolCut(j) && attackerBlocked(j) && workstationIn(j) && !intruderProcs(j).length && deployClosed(j) && appAlive(j);

export const containment: Chapter = {
  id: 'containment',
  number: 2,
  commands: [
    'ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'find', 'nano', 'sudo', 'id', 'whoami', 'who', 'last', 'ps', 'top', 'pgrep',
    'ss', 'netstat', 'journalctl', 'systemctl', 'crontab', 'kill', 'killall', 'pkill', 'iptables', 'iptables-save', 'usermod', 'chage',
  ],
  home: M,
  welcome: 'email_nadia.txt',
  names: true,
  final: 'end',
  steps: ['pool', 'attacker', 'stopped', 'closed', 'end'],
  password: PASSWORD,
  accounts: bastionAccounts,
  state: (t) => bastionState(t, { miner: true }),
  initialise: initialiseBastion,
  createWorld: (t) => bastionWorld(t, { home: { 'email_nadia.txt': f(t('containment-email-nadia')), 'incident.md': f(t('containment-incident'), { lines: true }) } }),
  events: [
    { id: 'pool', condition: poolCut, message: (j) => j.t('containment-event-pool', { pool: POOL }) },
    { id: 'attacker', condition: attackerBlocked, message: (j) => j.t('containment-event-attacker', { address: ATTACKER }) },
    { id: 'locked-out', condition: (j) => !workstationIn(j), message: (j) => j.t('containment-event-locked-out') },
    { id: 'respawn', condition: (j) => j.state.respawned !== undefined && intruderProcs(j).length > 0, message: (j) => j.t('containment-event-respawn', { pid: String(j.state.respawned) }) },
    { id: 'app-down', condition: (j) => !!j.state.appKilled && !appAlive(j), message: (j) => j.t('containment-event-app-down') },
    { id: 'relaunched', condition: (j) => !!j.state.relaunched, message: (j) => j.t('containment-event-relaunched') },
    { id: 'stopped', condition: (j) => !intruderProcs(j).length, message: (j) => j.t('containment-event-stopped') },
    { id: 'password-only', condition: passwordOnly, message: (j) => j.t('containment-event-password-only') },
    { id: 'closed', condition: deployClosed, message: (j) => j.t('containment-event-closed') },
    { id: 'end', condition: done, message: (j) => j.t('containment-event-end') },
  ],
};
