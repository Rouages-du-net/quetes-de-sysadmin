// Histoire « La Ruche » — chapitre « La DMZ » : La Ruche héberge elle-même
// son site de réservation des salles, sur un petit serveur (web). Inès,
// bénévole, l'a installé et branché sur le port 21 du commutateur, que
// l'électricien a mis dans un nouveau VLAN 40, la DMZ. Il faut :
//   - l'interface eth1.40 du routeur (10.10.40.1/24), dans le fichier ;
//   - une traduction de destination (dnat, chaîne nat au hook prerouting) :
//     ce qui arrive sur eth0 en TCP 80 et 443 part vers 10.10.40.10 ;
//   - la chaîne forward : internet → le serveur, sur ces ports-là seulement
//     (la règle voit l'adresse APRÈS traduction), et le serveur → internet
//     (ses mises à jour) ; mais rien du serveur vers le réseau interne : s'il
//     est piraté, il ne doit rien voir d'autre.
// Objectif vérifié sur l'état : le trafic simulé (internet vers le site,
// le serveur vers ses mises à jour et vers le NAS, les bureaux vers le
// serveur, et les zones du chapitre 3) passe ou est bloqué comme prévu,
// maintenant ET au prochain démarrage (interfaces, nftables), ssh restant
// ouvert au poste d'administration.
// Sources : https://wiki.nftables.org/wiki-nftables/index.php/Performing_Network_Address_Translation_(NAT),
// https://wiki.nftables.org/wiki-nftables/index.php/Netfilter_hooks

import { f, type Chapter } from '../world';
import type { Game } from '../shell';
import { lan, networkToBoot } from '../lan';
import { toBoot, attempt, nft, results, routing, type Flux, type Result } from '../nftables';
import { sysctlToBoot } from '../commands/nftables';
import { systemd } from '../systemd';
import { FLUX, openSsh } from './zones';
import {
  hiveAccounts,
  DNSMASQ_VLAN,
  initialiseFirewall,
  INTERFACES_VLAN,
  M,
  hiveWorld,
  PASSWORD,
  REMOTE_WORK_NFTABLES,
  lanWithDmz,
  ROUTER_SYSCTL,
  hiveSystemd,
  hivePlan,
} from './hive';

export const PUBLIC = '192.0.2.21';
const VISITOR = '203.0.113.77';

// Le trafic de la DMZ, et ce qui doit passer ; les zones du chapitre 3 restent vraies.
export const FLUX_DMZ: (Flux & { permitted: boolean })[] = [
  ...FLUX,
  { forEachOf: VISITOR, to: PUBLIC, proto: 'tcp', port: 443, permitted: true },
  { forEachOf: VISITOR, to: PUBLIC, proto: 'tcp', port: 80, permitted: true },
  { forEachOf: VISITOR, to: PUBLIC, proto: 'tcp', port: 22, permitted: false },
  { forEachOf: 'web', to: '198.51.100.80', proto: 'tcp', port: 443, permitted: true },
  { forEachOf: 'poste-malik', to: 'web', proto: 'tcp', port: 22, permitted: true },
  { forEachOf: 'web', to: 'nas', proto: 'tcp', port: 445, permitted: false },
  { forEachOf: 'web', to: 'imprimante', proto: 'tcp', port: 631, permitted: false },
];
const permitted = (r: Result) => FLUX_DMZ.find((x) => x.forEachOf === r.flux.forEachOf && x.to === r.flux.to && x.port === r.flux.port)!.permitted;
// Ce qui est interdit doit être jeté (ou impossible : le serveur n'a pas encore de réseau).
const refuse = (r: Result) => r.state === 'bloque' || r.state === 'impossible';
const compliant = (rs: Result[]) => rs.every((r) => (permitted(r) ? r.state === 'ok' : refuse(r)));
const site = (r: Result) => r.flux.forEachOf === VISITOR && r.flux.port !== 22;

const now = (j: Game) => compliant(results(j)) && openSsh(nft(j));
const toReboot = (j: Game) => {
  const l = networkToBoot(j)!;
  const rs = (systemd(j)?.services.nftables?.active && toBoot(j)) || { tables: [] };
  const transfer = sysctlToBoot(j, 'net.ipv4.ip_forward', '0') === '1';
  return compliant(FLUX_DMZ.map((x) => attempt(l, rs, transfer, x))) && openSsh(rs);
};

// Une règle de la chaîne forward qui attend l'adresse publique : elle ne verra jamais rien, le dnat a déjà eu lieu.
const waitsPublic = (j: Game) =>
  nft(j).tables.some((t) =>
    t.strings.some(
      (c) => c.base?.hook === 'forward' && c.rules.some((r) => r.conditions.some((x) => x.field === 'ip daddr' && x.values.includes(PUBLIC))),
    ),
  );

export const dmz: Chapter = {
  id: 'dmz',
  number: 5,
  plan: hivePlan({ remoteWork: true, dmz: true }),
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
    'cp',
    'sudo',
    'id',
    'whoami',
    'ip',
    'ifup',
    'ifdown',
    'ping',
    'systemctl',
    'journalctl',
    'reboot',
    'sysctl',
    'nft',
    'conntrack',
  ],
  home: M,
  welcome: 'email_ines.txt',
  names: true,
  final: 'end',
  password: PASSWORD,
  accounts: hiveAccounts,
  state: () => {
    const sd = hiveSystemd();
    sd.services.nftables.active = true;
    sd.services.nftables.state = 'active';
    const l = lanWithDmz();
    return { lan: { ...l, flux: FLUX_DMZ.map(({ permitted: _, ...x }) => x) }, systemd: sd, nft: { tables: [] } };
  },
  initialise: initialiseFirewall,
  createWorld: (t) =>
    hiveWorld({
      interfaces: INTERFACES_VLAN,
      dnsmasq: DNSMASQ_VLAN,
      nftables: REMOTE_WORK_NFTABLES,
      sysctl: ROUTER_SYSCTL,
      home: { 'email_ines.txt': f(t('dmz-email-ines')), 'switch-plan.txt': f(t('dmz-plan-switch'), { lines: true }) },
    }),
  events: [
    { id: 'address-public', condition: waitsPublic, message: (j) => j.t('dmz-event-address-public', { address: PUBLIC }) },
    {
      id: 'without-forward',
      condition: (j) => results(j).some((r) => site(r) && r.state === 'bloque' && !!r.destination) && routing(j),
      message: (j) => j.t('dmz-event-without-forward'),
    },
    {
      id: 'too-open',
      condition: (j) => results(j).some((r) => !permitted(r) && !refuse(r) && (r.flux.forEachOf === 'web' || r.flux.forEachOf === VISITOR)),
      message: (j) => j.t('dmz-event-too-open'),
    },
    { id: 'ssh', condition: (j) => !openSsh(nft(j)), message: (j) => j.t('zones-event-ssh') },
    { id: 'in-place', condition: (j) => now(j) && !toReboot(j), message: (j) => j.t('dmz-event-in-place') },
    { id: 'end', condition: (j) => !!lan(j) && now(j) && toReboot(j), message: (j) => j.t('dmz-event-end') },
  ],
};
