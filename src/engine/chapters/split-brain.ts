// Story "The Blood Drive", chapter "Split Brain": on Tuesday night the
// network team installed new edge routers (a VRRP pair for the gateway
// 192.0.2.254, virtual_router_id 51, their vendor's default) and applied
// their hardening baseline to lb2: an nftables input chain with policy drop
// that forgot VRRP. lb2 no longer hears lb1's advertisements: it became
// MASTER too. Both hold 192.0.2.108; the gateway's ARP entry swings between
// them and every other donor's connection is reset. lb1 hears lb2 (no
// firewall there) and logs "lower priority … forcing new election"; both
// log the routers' adverts for VRID 51 as bogus.
// Diagnosis: ip a on both, journalctl -u keepalived, tcpdump -i eth0 vrrp on
// lb2 (the adverts arrive on the wire: tcpdump sees them before the
// firewall, keepalived after), nft list ruleset. Fix: let VRRP in on lb2
// (ip protocol vrrp, or 112, or ip daddr 224.0.0.18) and keep it in
// /etc/nftables.conf; move off VRID 51 on both nodes (the same new VRID on
// both), or switch both to unicast_peer.
// Objective checked on the state: one master, the other BACKUP, both
// keepalived running, lb2's firewall lets the adverts in now and at the next
// boot, no clash with the routers' VRID, the donors served.
// False leads: stopping keepalived on lb2 (one master, no redundancy left),
// changing priorities (they don't matter between nodes that can't hear each
// other), changing the VRID on one node only (two groups: split again).
// Sources: https://www.keepalived.org/manpage.html (virtual_router_id,
// unicast_peer), RFC 3768 (VRRP: protocol 112, 224.0.0.18), nft(8),
// https://www.tcpdump.org/manpages/tcpdump.1.html.

import type { Chapter } from '../world';
import type { Game, Shell } from '../shell';
import { VRRP_GROUP, masters, type Run } from '../keepalived';
import { toBoot, traverse } from '../nftables';
import { HOME, LB1, LB2, PASSWORD, VIP, holders, initialiseStory, lb1Accounts, lbState, lbWorld, machine, passTime, runOf, seen, servedLately, serviceState, split, story, storyHosts } from './blood-drive';

const ROUTERS_VRID = 51;
const unicastPair = (a: Run | undefined, b: Run | undefined) =>
  !!a?.inst && !!b?.inst && a.inst.unicastPeers.includes(LB2) && b.inst.unicastPeers.includes(LB1);
/** Neither node's group meets the routers' (their own VRID on multicast). */
const noClash = (j: Game) => {
  const a = runOf(j, 'lb1');
  const b = runOf(j, 'lb2');
  if (!a?.inst || !b?.inst || a.inst.vrid !== b.inst.vrid) return false;
  return unicastPair(a, b) || a.inst.vrid !== ROUTERS_VRID;
};
/** lb2's firewall, as the next boot loads it, lets lb1's adverts in. */
const persisted = (j: Game) => {
  const sh = machine(j, 'lb2') as Shell;
  const r = toBoot(sh);
  if (!r) return false;
  const a = runOf(j, 'lb1');
  const dst = a?.inst?.unicastPeers.length ? LB2 : VRRP_GROUP;
  return traverse(r, 'input', 'filter', { iif: 'eth0', oif: '', saddr: LB1, daddr: dst, proto: 'vrrp', sport: 0, dport: 0, ct: 'new', size: 60 }).pass;
};
const running = (j: Game, n: string) => serviceState(j, n, 'keepalived') === 'active' && !!runOf(j, n as 'lb1' | 'lb2');
const single = (j: Game) => running(j, 'lb1') && running(j, 'lb2') && masters(j).length === 1 && Object.values({ a: runOf(j, 'lb1'), b: runOf(j, 'lb2') }).every((r) => r?.state === 'MASTER' || r?.state === 'BACKUP');

export const splitBrain: Chapter = {
  id: 'split-brain',
  number: 3,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'cut', 'diff', 'cp', 'nano', 'sudo', 'ssh', 'exit', 'echo', 'systemctl', 'journalctl', 'ip', 'curl', 'sleep', 'tcpdump', 'nft'],
  home: HOME,
  welcome: 'message_from_kirsi.txt',
  names: true,
  final: 'end',
  steps: ['two-masters', 'lower-priority', 'on-the-wire', 'ruleset', 'single-master', 'persisted', 'clash', 'vrid', 'end'],
  password: PASSWORD,
  accounts: lb1Accounts,
  state: (t) => lbState(t, 'lb1', 3),
  initialise: (j) => initialiseStory(j, 3),
  hosts: storyHosts(3),
  createWorld: (t) =>
    lbWorld(t, 'lb1', 3, {
      'message_from_kirsi.txt': t('split-brain-message-kirsi'),
      'message_from_zainab.txt': t('split-brain-message-zainab'),
    }),
  afterCommand: (j) => passTime(j),
  events: [
    { id: 'two-masters', condition: (j) => seen(j, `inet ${VIP}/24`, 'lb2') && split(j), message: (j) => j.t('split-brain-event-two-masters') },
    { id: 'lower-priority', condition: (j) => seen(j, /with lower priority \d+, ours \d+, forcing new election/), message: (j) => j.t('split-brain-event-lower-priority') },
    { id: 'on-the-wire', condition: (j) => seen(j, /IP (192\.0\.2\.104|lb1\.internal|lb1) > (224\.0\.0\.18|vrrp\.mcast\.net)/, 'lb2'), message: (j) => j.t('split-brain-event-on-the-wire') },
    { id: 'ruleset', condition: (j) => seen(j, 'policy drop;', 'lb2'), message: (j) => j.t('split-brain-event-ruleset') },
    { id: 'stopped', condition: (j) => serviceState(j, 'lb2', 'keepalived') !== 'active' || serviceState(j, 'lb1', 'keepalived') !== 'active', message: (j) => j.t('split-brain-event-stopped') },
    {
      id: 'priorities',
      condition: (j) => split(j) && (runOf(j, 'lb1')?.inst?.priority !== 101 || runOf(j, 'lb2')?.inst?.priority !== 100) && !!runOf(j, 'lb1')?.inst && !!runOf(j, 'lb2')?.inst,
      message: (j) => j.t('split-brain-event-priorities'),
    },
    { id: 'single-master', condition: (j) => single(j) && (story(j).split ?? 0) > 0, message: (j) => j.t('split-brain-event-single-master') },
    { id: 'persisted', condition: (j) => single(j) && persisted(j), message: (j) => j.t('split-brain-event-persisted') },
    { id: 'clash', condition: (j) => seen(j, 'bogus VRRP packet received') || seen(j, /vrid 51, prio 120/), message: (j) => j.t('split-brain-event-clash') },
    {
      id: 'vrid-half',
      condition: (j) => !!runOf(j, 'lb1')?.inst && !!runOf(j, 'lb2')?.inst && runOf(j, 'lb1')!.inst!.vrid !== runOf(j, 'lb2')!.inst!.vrid,
      message: (j) => j.t('split-brain-event-vrid-half'),
    },
    { id: 'vrid', condition: noClash, message: (j) => j.t('split-brain-event-vrid') },
    {
      id: 'end',
      condition: (j) => single(j) && persisted(j) && noClash(j) && holders(j).length === 1 && servedLately(j),
      message: (j) => j.t('split-brain-event-end'),
    },
  ],
};
