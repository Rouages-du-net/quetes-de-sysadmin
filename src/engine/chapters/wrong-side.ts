// Story "The Health Centre", chapter "The Wrong Side": two weeks later.
// Hamid installed portal, the patients' appointment portal, with
// virt-install's defaults: its interface is on libvirt's default network
// (virbr0, NAT, 192.168.122.0/24). From hearth it answers; from the
// reception desk, nothing: the office's network has no route to a
// private network that only exists inside the hypervisor. The fix is to
// put its interface on the host's bridge br0 (virsh edit: type='bridge',
// source bridge='br0'; or detach-interface and attach-interface), then a
// full stop and start (a guest reboot keeps the same QEMU and the same
// definition), and the office's DHCP gives it an address on the LAN.
// Meanwhile, Hamid copied agenda by hand for a training session
// (agenda-training: its disk copied, its XML dumped and defined again
// without the uuid line): same MAC on the same bridge, same machine-id
// inside, so the same DHCP client identifier and the same address. The
// reception sees the training copy one time in two. The clone needs its
// own MAC (virt-clone would have made one) and its own machine-id
// (systemd-machine-id-setup after emptying /etc/machine-id, then a boot).
// Objective checked on the state: portal on br0 in its definition and
// running so, with an address on the LAN, reached from reception; agenda
// unchanged (its MAC, its machine-id, 192.0.2.90); agenda-training running
// with another MAC, another machine-id and another address.
// False leads: a DNAT rule on the host (one port, rewritten by libvirt,
// the guest still invisible), promiscuous mode on br0 (changes nothing),
// virsh reboot after the edit (the running definition stays), changing
// agenda's identity instead of the copy's, a new MAC alone (same address).
// Sources: https://libvirt.org/formatdomain.html#network-interfaces,
// https://wiki.libvirt.org/Networking.html, https://wiki.debian.org/KVM#Setting_up_bridge_networking,
// https://www.freedesktop.org/software/systemd/man/latest/machine-id.html,
// https://www.freedesktop.org/software/systemd/man/latest/systemd.network.html (ClientIdentifier=duid).

import type { Chapter } from '../world';
import type { Game } from '../shell';
import type { Translate } from '../../texts';
import { f } from '../world';
import { guestIdentity, libvirt } from '../libvirt';
import { HOME, LAN_IP, MAC, MACHINE_ID, PASSWORD, PORTAL_NAT, RECEPTION_COMMANDS, dom, guest, guests, hearthAccounts, hearthState, hearthWorld, initialiseHearth, passTime, receptionHost, seen, typed } from './health-centre';

const portal = (j: Game) => dom(j, 'portal');
const training = (j: Game) => dom(j, 'agenda-training');
const agenda = (j: Game) => dom(j, 'agenda');
const out = (j: Game, name: string) => {
  const s = guest(j, name);
  return s ? { line: s.last.line ?? '', text: `${s.last.output}\n${s.last.errors.join('\n')}` } : null;
};
const bridged = (i: { type: string; source: string } | undefined) => i?.type === 'bridge' && i.source === 'br0';
const portalConfig = (j: Game) => bridged(portal(j)?.config.ifaces[0]);
const portalLive = (j: Game) => {
  const p = portal(j);
  return !!p && p.state === 'running' && bridged(p.live?.ifaces[0]) && !!p.lanIp;
};
const macOf = (d: ReturnType<typeof agenda>, live: boolean) => (live ? d?.live?.ifaces[0]?.mac : d?.config.ifaces[0]?.mac);
const agendaIntact = (j: Game) => {
  const a = agenda(j);
  return !!a && a.state === 'running' && macOf(a, false) === MAC.agenda && macOf(a, true) === MAC.agenda && guestIdentity(j, 'agenda').machineId === MACHINE_ID.agenda && a.lanIp === LAN_IP.agenda;
};
const newMac = (j: Game) => {
  const t = training(j);
  return !!t && macOf(t, false) !== MAC.agenda && (t.state !== 'running' || macOf(t, true) !== MAC.agenda);
};
const newId = (j: Game) => /^[0-9a-f]{32}$/.test(guestIdentity(j, 'agenda-training').machineId) && guestIdentity(j, 'agenda-training').machineId !== guestIdentity(j, 'agenda').machineId;
const separate = (j: Game) => {
  const t = training(j);
  return !!t && t.state === 'running' && newMac(j) && !!t.lanIp && t.lanIp !== agenda(j)?.lanIp;
};

export const RECEPTION_NOTE = (t: Translate) => ({ 'note_from_hamid.txt': f(t('wrong-side-note-hamid')) });

export const wrongSide: Chapter = {
  id: 'wrong-side',
  number: 2,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'df', 'sudo', 'ssh', 'nano', 'ip', 'ping', 'curl', 'iptables', 'systemctl', 'journalctl', 'virsh', 'qemu-img', 'virt-clone', 'exit'],
  home: HOME,
  welcome: 'message_from_grace.txt',
  names: true,
  final: 'end',
  steps: ['nat-seen', 'unreachable', 'config-bridge', 'bridged', 'reception-ok', 'clash-seen', 'new-mac', 'new-id', 'separate', 'end'],
  password: PASSWORD,
  accounts: hearthAccounts,
  state: (t) => hearthState(t, 2),
  initialise: initialiseHearth,
  hosts: { ...guests(2), reception: receptionHost(RECEPTION_COMMANDS, RECEPTION_NOTE) },
  createWorld: (t) => hearthWorld(t, 2, { 'message_from_grace.txt': t('wrong-side-message-grace') }),
  afterCommand: (j) => passTime(j),
  events: [
    {
      id: 'nat-seen',
      condition: (j) => seen(j, new RegExp(`network\\s+default\\s+virtio\\s+${MAC.portal}`)) || (/portal/.test(typed(j)) && seen(j, "<source network='default'")) || seen(j, new RegExp(`${PORTAL_NAT.replace(/\./g, '\\.')}/24\\s+portal`)),
      message: (j) => j.t('wrong-side-event-nat-seen'),
    },
    {
      id: 'unreachable',
      condition: (j) => {
        const r = out(j, 'reception');
        return !!r && /192\.168\.122\.47|portal/.test(r.line) && /Failed to connect|100% packet loss|timed out|Could not resolve|Name or service not known|No route/.test(r.text);
      },
      message: (j) => j.t('wrong-side-event-unreachable'),
    },
    { id: 'nat-hack', condition: (j) => /iptables\b.*(DNAT|PREROUTING)|nft\b.*dnat/i.test(typed(j)), message: (j) => j.t('wrong-side-event-nat-hack') },
    { id: 'promisc', condition: (j) => /promisc/.test(typed(j)), message: (j) => j.t('wrong-side-event-promisc') },
    { id: 'config-bridge', condition: portalConfig, message: (j) => j.t('wrong-side-event-config-bridge') },
    { id: 'reboot-only', condition: (j) => portalConfig(j) && !portalLive(j) && ((j.state.guestReboots as string[] | undefined) ?? []).includes('portal'), message: (j) => j.t('wrong-side-event-reboot-only') },
    { id: 'bridged', condition: portalLive, message: (j) => j.t('wrong-side-event-bridged', { address: portal(j)?.lanIp ?? '' }) },
    { id: 'reception-ok', condition: (j) => portalLive(j) && !!j.state.receptionSawPortal, message: (j) => j.t('wrong-side-event-reception-ok') },
    {
      id: 'clash-seen',
      condition: (j) =>
        (/agenda-training/.test(typed(j)) && seen(j, MAC.agenda)) ||
        ['reception', 'agenda', 'ledger', 'records', 'portal'].some((n) => /curl|wget/.test(out(j, n)?.line ?? '') && !!out(j, n)?.text.includes('TRAINING COPY')) ||
        (/curl|wget/.test(typed(j)) && seen(j, 'TRAINING COPY')),
      message: (j) => j.t('wrong-side-event-clash-seen'),
    },
    { id: 'original-changed', condition: (j) => !!agenda(j) && (macOf(agenda(j), false) !== MAC.agenda || guestIdentity(j, 'agenda').machineId !== MACHINE_ID.agenda), message: (j) => j.t('wrong-side-event-original-changed') },
    { id: 'new-mac', condition: newMac, message: (j) => j.t('wrong-side-event-new-mac') },
    { id: 'same-ip', condition: (j) => newMac(j) && training(j)?.state === 'running' && !!training(j)?.lanIp && training(j)?.lanIp === agenda(j)?.lanIp && j.flags.has('new-mac') && macOf(training(j), true) !== MAC.agenda, message: (j) => j.t('wrong-side-event-same-ip') },
    { id: 'new-id', condition: newId, message: (j) => j.t('wrong-side-event-new-id') },
    { id: 'separate', condition: (j) => separate(j) && newId(j), message: (j) => j.t('wrong-side-event-separate', { address: training(j)?.lanIp ?? '' }) },
    {
      id: 'end',
      condition: (j) => portalConfig(j) && portalLive(j) && !!j.state.receptionSawPortal && agendaIntact(j) && separate(j) && newId(j) && !libvirt(j).jobs.length,
      message: (j) => j.t('wrong-side-event-end'),
    },
  ],
};
