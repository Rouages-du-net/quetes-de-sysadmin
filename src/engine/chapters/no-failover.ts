// Story "The Blood Drive", chapter "The Failover That Didn't Happen":
// Monday morning, donors can't book. haproxy died on lb1 at 6:58 (its worker
// aborted again and again until systemd's start limit), but keepalived kept
// the virtual address there: nothing told it about haproxy. lb2, healthy,
// waited as BACKUP. The fix is the design, not the restart: a vrrp_script
// that checks haproxy (killall -0, pidof, systemctl is-active…) tracked by
// the instance on both nodes, with a weight that brings the master below
// its peer (or 0: FAULT), keepalived reloaded; the address moves to lb2 at
// once since haproxy is still down on lb1; haproxy restarted on lb1; then a
// deliberate test (stop haproxy on lb1: the address moves; start it: it
// comes back with preemption, or stays with nopreempt).
// Objective checked on the state: both haproxy running, both keepalived
// running with a tracking that would move the address both ways, a
// failover seen (lb2 holding the address and serving while lb1's haproxy
// was down), one master, the donors served.
// False leads: restarting haproxy alone (works today, fails next time),
// state MASTER on both with the same priority (the state is only where an
// instance starts; the tie goes to the higher address), nopreempt on the
// backup with a weight (a master that still advertises is never
// preempted: the address stays on a dead haproxy).
// Sources: https://www.keepalived.org/manpage.html (vrrp_script,
// track_script, weight, nopreempt), https://keepalived.readthedocs.io/en/latest/case_study_failover.html.

import type { Chapter } from '../world';
import type { Game } from '../shell';
import { CONF_FILE } from '../keepalived';
import {
  HOME, PASSWORD, VIP, holders, initialiseStory, lb1Accounts, lbState, lbWorld, machine, passTime, runOf, seen, serviceState, servedLately, story, storyHosts, tracks, typed, wouldFailOver,
} from './blood-drive';

const bothMaster = (j: Game) => {
  const read = (n: string) => machine(j, n).read(CONF_FILE) ?? '';
  const state = (t: string) => /^\s*state\s+(\w+)/m.exec(t)?.[1]?.toUpperCase();
  const prio = (t: string) => /^\s*priority\s+(\d+)/m.exec(t)?.[1];
  const a = read('lb1');
  const b = read('lb2');
  return state(a) === 'MASTER' && state(b) === 'MASTER' && prio(a) === prio(b);
};
const running = (j: Game, n: 'lb1' | 'lb2', unit: string) => serviceState(j, n, unit) === 'active';
const designed = (j: Game) => wouldFailOver(j, 'lb1', 'lb2') && wouldFailOver(j, 'lb2', 'lb1');

export const noFailover: Chapter = {
  id: 'no-failover',
  number: 1,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'diff', 'cp', 'nano', 'sudo', 'ssh', 'exit', 'ps', 'kill', 'killall', 'pidof', 'systemctl', 'journalctl', 'ip', 'ping', 'curl', 'sleep', 'keepalived'],
  home: HOME,
  welcome: 'message_from_zainab.txt',
  names: true,
  final: 'end',
  steps: ['haproxy-dead', 'vip-on-lb1', 'no-tracking', 'tracking', 'failed-over', 'haproxy-back', 'lb2-tracked', 'end'],
  password: PASSWORD,
  accounts: lb1Accounts,
  state: (t) => lbState(t, 'lb1', 1),
  initialise: (j) => initialiseStory(j, 1),
  hosts: storyHosts(1),
  createWorld: (t) =>
    lbWorld(t, 'lb1', 1, {
      'message_from_zainab.txt': t('no-failover-message-zainab'),
      'note_from_bastien.txt': t('no-failover-note-bastien'),
    }),
  afterCommand: (j) => passTime(j),
  events: [
    {
      id: 'haproxy-dead',
      condition: (j) => seen(j, 'Start request repeated too quickly', 'lb1') || (seen(j, /Active: failed/, 'lb1') && /haproxy/.test(typed(j))),
      message: (j) => j.t('no-failover-event-haproxy-dead'),
    },
    { id: 'vip-on-lb1', condition: (j) => seen(j, `inet ${VIP}/24`, 'lb1') && holders(j).includes('lb1') && !running(j, 'lb1', 'haproxy'), message: (j) => j.t('no-failover-event-vip-on-lb1') },
    { id: 'no-tracking', condition: (j) => seen(j, 'vrrp_instance VI_1') && !tracks(runOf(j, 'lb1')), message: (j) => j.t('no-failover-event-no-tracking') },
    { id: 'restart-only', condition: (j) => running(j, 'lb1', 'haproxy') && !tracks(runOf(j, 'lb1')), message: (j) => j.t('no-failover-event-restart-only') },
    { id: 'both-master', condition: bothMaster, message: (j) => j.t('no-failover-event-both-master') },
    { id: 'edited-not-loaded', condition: (j) => /track_script/.test(machine(j, 'lb1').read(CONF_FILE) ?? '') && !tracks(runOf(j, 'lb1')) && /keepalived -t|cat .*keepalived/.test(typed(j)), message: (j) => j.t('no-failover-event-edited-not-loaded') },
    { id: 'tracking', condition: (j) => tracks(runOf(j, 'lb1')), message: (j) => j.t('no-failover-event-tracking') },
    { id: 'stuck', condition: (j) => (story(j).stuckMax ?? 0) >= 8, message: (j) => j.t('no-failover-event-stuck') },
    { id: 'failed-over', condition: (j) => !!story(j).failedOver, message: (j) => j.t('no-failover-event-failed-over') },
    {
      id: 'haproxy-back',
      // Once lb1's check succeeds again, and the address went where the configuration says (back to lb1, or staying with nopreempt).
      condition: (j) => {
        const r = runOf(j, 'lb1');
        const good = !!r && Object.values(r.scripts).some((s) => s.status === 'good');
        return !!story(j).failedOver && running(j, 'lb1', 'haproxy') && good && holders(j).length === 1 && (holders(j)[0] === 'lb1' || !!r?.inst?.nopreempt || !!runOf(j, 'lb2')?.inst?.nopreempt);
      },
      message: (j) => j.t(holders(j)[0] === 'lb1' ? 'no-failover-event-haproxy-back-preempt' : 'no-failover-event-haproxy-back-stays'),
    },
    { id: 'lb2-tracked', condition: (j) => tracks(runOf(j, 'lb2')) && wouldFailOver(j, 'lb2', 'lb1'), message: (j) => j.t('no-failover-event-lb2-tracked') },
    {
      id: 'end',
      condition: (j) =>
        designed(j) && !!story(j).failedOver && running(j, 'lb1', 'haproxy') && running(j, 'lb2', 'haproxy') && running(j, 'lb1', 'keepalived') && running(j, 'lb2', 'keepalived') && holders(j).length === 1 && servedLately(j),
      message: (j) => j.t('no-failover-event-end'),
    },
  ],
};
