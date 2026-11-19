// Story "The Ferry", chapter "The New Card": since quay's network card was
// replaced last week, the ferry's site no longer answers over IPv6. quay
// gets its IPv6 address by SLAAC: the router's /64 prefix plus an
// identifier made from the card's MAC address (modified EUI-64), so the
// new card brought a new address; the AAAA records Tevita wrote still name
// the old one. You read the addresses and routes (ip -6 addr, ip -6 route:
// the default route goes through the router's link-local address, fe80::…,
// which ping only reaches with its interface, %eth0), give quay a static
// address in its prefix (ip -6 addr add, and an "iface eth0 inet6 static"
// stanza in /etc/network/interfaces), then publish it: the AAAA records,
// the serial, named-checkzone, rndc reload.
// Objective checked on the state: a static address of the prefix on eth0
// now and at the next boot, an IPv6 default route now and at boot, and the
// zone's public servers (the secondary, which only copies a higher serial)
// answering that address for ferry.example, www and quay.
// Sources: https://www.rfc-editor.org/rfc/rfc4862 (SLAAC),
// https://www.rfc-editor.org/rfc/rfc4291#appendix-A (modified EUI-64),
// https://manpages.debian.org/trixie/ifupdown/interfaces.5.en.html (inet6 static),
// https://man7.org/linux/man-pages/man8/ip-address.8.html,
// https://bind9.readthedocs.io/en/stable/chapter3.html (zone files, serial).

import { f, type Chapter } from '../world';
import type { Game, Shell } from '../shell';
import { defaultRoute6, inPrefix6, normalise6 } from '../ipv6';
import { lan, startNetwork } from '../lan';
import {
  M,
  NOW_1,
  PASSWORD,
  PREFIX,
  OLD_SLAAC,
  NEW_SLAAC,
  NEW_MAC,
  ROUTER_LL,
  STATIC,
  ferryAccounts,
  ferryState,
  ferryWorld,
  initialiseFerry,
  lookoutHost,
  lookoutSaw,
  globals6,
  statics6,
  atBoot6,
  publicAaaa,
  primaryAaaa,
  publicNames,
} from './ferry';

// A static address of the prefix that quay has now, and would get back at boot.
const kept = (j: Game) => statics6(j).filter((a) => inPrefix6(a, PREFIX) && globals6(j).includes(a));
const keptAtBoot = (j: Game) => atBoot6(j).addresses.filter((a) => inPrefix6(a, PREFIX) && a !== NEW_SLAAC);
const routeNow = (j: Game) => !!defaultRoute6(j, lan(j)!);
// What the zone's public servers answer: one static address of quay, the same for the three names.
const published = (j: Game, source: (j: Game, n: string) => string[]) => {
  const answers = publicNames(j.t).map((n) => source(j, n));
  const one = answers[0];
  return one.length === 1 && answers.every((a) => a.length === 1 && a[0] === one[0]) ? one[0] : null;
};
const publishedStatic = (j: Game) => {
  const a = published(j, publicAaaa);
  return !!a && kept(j).includes(a) && keptAtBoot(j).includes(a);
};

export const newCard: Chapter = {
  id: 'new-card',
  number: 1,
  commands: [
    'ls',
    'cd',
    'pwd',
    'cat',
    'less',
    'head',
    'tail',
    'grep',
    'nano',
    'sudo',
    'ip',
    'ping',
    'ping6',
    'ifup',
    'ifdown',
    'sysctl',
    'systemctl',
    'journalctl',
    'dig',
    'host',
    'named-checkzone',
    'rndc',
    'curl',
    'ssh',
    'exit',
  ],
  home: M,
  welcome: 'message_from_amaru.txt',
  names: true,
  final: 'end',
  steps: ['addresses', 'route', 'router', 'old-record', 'static-now', 'static-boot', 'zone-loaded', 'published', 'end'],
  password: PASSWORD,
  accounts: ferryAccounts,
  state: (t) => ferryState(t, 1),
  initialise: initialiseFerry,
  hosts: { lookout: lookoutHost(NOW_1, (t) => t('ferry-lookout-readme')) },
  createWorld: (t) =>
    ferryWorld(t, 1, {
      'message_from_amaru.txt': f(t('new-card-message-amaru')),
      'email_from_rangi.txt': f(t('new-card-email-rangi', { prefix: PREFIX, address: STATIC })),
    }),
  // ifdown eth0 over ssh: the session goes with it; Amaru, at the office, brings it back up from the file.
  afterCommand: (j) => {
    const l = lan(j);
    if (l && !l.interfaces.eth0?.up) {
      startNetwork(j);
      (j as Shell).cut = true;
      j.state.ferryCut = true;
    }
  },
  events: [
    { id: 'addresses', condition: (j) => j.last.output.includes(`inet6 ${NEW_SLAAC}/64 scope global dynamic`), message: (j) => j.t('new-card-event-addresses') },
    { id: 'mac', condition: (j) => j.last.output.includes(`link/ether ${NEW_MAC}`), message: (j) => j.t('new-card-event-mac') },
    { id: 'route', condition: (j) => j.last.output.includes(`default via ${ROUTER_LL}`), message: (j) => j.t('new-card-event-route') },
    { id: 'zone-needed', condition: (j) => j.last.errors.some((e) => e.includes('may require ifname or scope-id')), message: (j) => j.t('new-card-event-zone-needed') },
    { id: 'router', condition: (j) => j.last.output.includes(`64 bytes from ${ROUTER_LL}%eth0`), message: (j) => j.t('new-card-event-router') },
    { id: 'old-record', condition: (j) => j.last.output.includes(OLD_SLAAC), message: (j) => j.t('new-card-event-old-record') },
    { id: 'cut', condition: (j) => !!j.state.ferryCut, message: (j) => j.t('new-card-event-cut') },
    { id: 'already', condition: (j) => j.last.errors.some((e) => e.includes('ifup: interface eth0 already configured')), message: (j) => j.t('new-card-event-already') },
    {
      id: 'wrong-prefix',
      condition: (j) => statics6(j).some((a) => !inPrefix6(a, PREFIX)),
      message: (j) => j.t('new-card-event-wrong-prefix', { prefix: PREFIX }),
    },
    { id: 'static-now', condition: (j) => kept(j).length > 0, message: (j) => j.t('new-card-event-static-now') },
    { id: 'static-boot', condition: (j) => keptAtBoot(j).length > 0 && atBoot6(j).route, message: (j) => j.t('new-card-event-static-boot') },
    { id: 'no-route-boot', condition: (j) => keptAtBoot(j).length > 0 && !atBoot6(j).route, message: (j) => j.t('new-card-event-no-route-boot') },
    { id: 'no-route', condition: (j) => !routeNow(j), message: (j) => j.t('new-card-event-no-route') },
    {
      id: 'zone-loaded',
      condition: (j) => {
        const a = published(j, primaryAaaa);
        return !!a && a !== OLD_SLAAC;
      },
      message: (j) => j.t('new-card-event-zone-loaded'),
    },
    {
      id: 'serial',
      condition: (j) => {
        const p = published(j, primaryAaaa);
        // rndc reload with the same serial: named loaded it, the secondary kept its copy.
        return !!p && p !== OLD_SLAAC && published(j, publicAaaa) === OLD_SLAAC;
      },
      message: (j) => j.t('new-card-event-serial'),
    },
    { id: 'slaac-record', condition: (j) => published(j, publicAaaa) === NEW_SLAAC, message: (j) => j.t('new-card-event-slaac-record') },
    { id: 'published', condition: publishedStatic, message: (j) => j.t('new-card-event-published') },
    {
      id: 'seen-outside',
      condition: (j) => {
        const a = published(j, publicAaaa);
        return !!a && lookoutSaw(j).includes(`64 bytes from ${a}`);
      },
      message: (j) => j.t('new-card-event-seen-outside'),
    },
    {
      id: 'end',
      condition: (j) => publishedStatic(j) && routeNow(j) && atBoot6(j).route,
      message: (j) => j.t('new-card-event-end', { address: normalise6(published(j, publicAaaa) ?? STATIC) ?? STATIC }),
    },
  ],
};
