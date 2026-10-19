// ip (iproute2), ifup et ifdown (ifupdown), sur le réseau local simulé
// (../lan.ts). Sorties d'iproute2 6 et d'ifupdown 0.8, en anglais.
// Sources : https://man7.org/linux/man-pages/man8/ip-address.8.html,
// https://man7.org/linux/man-pages/man8/ip-link.8.html,
// https://manpages.debian.org/trixie/ifupdown/ifup.8.en.html

import type { Shell } from '../shell';
import { cidr, creer, demonter, enService, lan, lireInterfaces, monter, reseauDe, supprimer, versIp, type Interface, type Lan } from '../lan';
import { lireDnsmasq } from '../dnsmasq';
import type { Commande } from './index';

const NON_PERMIS = 'RTNETLINK answers: Operation not permitted';

// Comme ip : « eth1.10@eth1 » pour un VLAN.
const nomAffiche = (i: Interface) => (i.vlan ? `${i.nom}@${i.vlan.parent}` : i.nom);

function etatLien(l: Lan, i: Interface): { drapeaux: string; etat: string } {
  if (i.nom === 'lo') return { drapeaux: '<LOOPBACK,UP,LOWER_UP>', etat: 'UNKNOWN' };
  if (!i.up) return { drapeaux: '<BROADCAST,MULTICAST>', etat: 'DOWN' };
  if (!enService(l, i)) return { drapeaux: '<NO-CARRIER,BROADCAST,MULTICAST,UP>', etat: 'LOWERLAYERDOWN' };
  return { drapeaux: '<BROADCAST,MULTICAST,UP,LOWER_UP>', etat: 'UP' };
}

function lignesLien(l: Lan, i: Interface, details: boolean): string[] {
  const n = l.ordre.indexOf(i.nom) + 1;
  const { drapeaux, etat } = etatLien(l, i);
  const lo = i.nom === 'lo';
  const lignes = [
    `${n}: ${nomAffiche(i)}: ${drapeaux} mtu ${lo ? 65536 : 1500} qdisc ${lo || i.vlan ? 'noqueue' : 'fq_codel'} state ${etat} mode DEFAULT group default qlen 1000`,
    lo ? '    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00' : `    link/ether ${i.mac} brd ff:ff:ff:ff:ff:ff`,
  ];
  if (details && i.vlan) lignes.push(`    vlan protocol 802.1Q id ${i.vlan.id} <REORDER_HDR>`);
  return lignes;
}

function lignesAdresses(l: Lan, i: Interface): string[] {
  const [premiere, ...reste] = lignesLien(l, i, false);
  return [
    premiere.replace(' mode DEFAULT', ''),
    ...reste,
    ...i.adresses.flatMap((a) => {
      const c = cidr(a)!;
      const brd = i.nom === 'lo' ? '' : ` brd ${versIp(c.diffusion)}`;
      return [`    inet ${a}${brd} scope ${i.nom === 'lo' ? 'host' : 'global'} ${i.nom}`, '       valid_lft forever preferred_lft forever'];
    }),
  ];
}

const bref = (l: Lan, i: Interface, quoi: string) => {
  const { etat } = etatLien(l, i);
  return `${nomAffiche(i).padEnd(16)} ${etat.padEnd(14)} ${quoi}`.trimEnd();
};

function routes(l: Lan): string[] {
  const lignes: string[] = [];
  if (l.passerelle) lignes.push(`default via ${l.passerelle.via} dev ${l.passerelle.dev} onlink`);
  for (const nom of l.ordre) {
    const i = l.interfaces[nom];
    if (!i || nom === 'lo' || !i.up) continue;
    for (const a of i.adresses)
      lignes.push(`${reseauDe(a)} dev ${nom} proto kernel scope link src ${a.split('/')[0]}${enService(l, i) ? '' : ' linkdown'}`);
  }
  return lignes;
}

// La valeur qui suit un mot-clé (dev eth0, name eth1.10…).
const apres = (mots: string[], mot: string) => (mots.includes(mot) ? mots[mots.indexOf(mot) + 1] : undefined);

function ip(jeu: Shell, args: string[]): string {
  const l = lan(jeu);
  if (!l) return jeu.erreur('Cannot open netlink socket: Operation not permitted', 1);
  const options = args.filter((a) => a.startsWith('-'));
  const [objet = '', action = 'show', ...reste] = args.filter((a) => !a.startsWith('-'));
  const brief = options.some((o) => o === '-br' || o === '-brief');
  const details = options.some((o) => o === '-d' || o === '-details');
  const root = jeu.qui === 'root';
  const interfaceDe = (nom: string | undefined) => (nom ? l.interfaces[nom] : undefined);
  const introuvable = (nom: string) => jeu.erreur(`Cannot find device "${nom}"`, 1);
  const liste = (dev: string | undefined) =>
    (dev ? [interfaceDe(dev)].filter(Boolean) : l.ordre.map((n) => l.interfaces[n]).filter(Boolean)) as Interface[];

  if (['a', 'addr', 'address'].includes(objet)) {
    if (['show', 'list', 'sh', 'ls'].includes(action)) {
      const dev = apres(reste, 'dev') ?? reste.find((r) => r !== 'dev');
      if (dev && !interfaceDe(dev)) return introuvable(dev);
      return liste(dev)
        .flatMap((i) => (brief ? [bref(l, i, i.adresses.join(' '))] : lignesAdresses(l, i)))
        .join('\n');
    }
    if (['add', 'del', 'delete'].includes(action)) {
      const adresse = reste[0];
      const dev = apres(reste, 'dev');
      if (!adresse || !dev) return jeu.erreur('Not enough information: "dev" argument is required.', 1);
      if (!cidr(adresse)) return jeu.erreur(`Error: any valid prefix is expected rather than "${adresse}".`, 1);
      const i = interfaceDe(dev);
      if (!i) return introuvable(dev);
      if (!root) return jeu.erreur(NON_PERMIS, 2);
      const complete = adresse.includes('/') ? adresse : `${adresse}/32`;
      if (action === 'add') {
        if (i.adresses.includes(complete)) return jeu.erreur('Error: ipv4: Address already assigned.', 2);
        i.adresses.push(complete);
      } else {
        if (!i.adresses.includes(complete)) return jeu.erreur('Error: ipv4: Address not found.', 2);
        i.adresses = i.adresses.filter((a) => a !== complete);
      }
      return '';
    }
    if (action === 'flush') {
      const i = interfaceDe(apres(reste, 'dev') ?? reste[0]);
      if (!i) return introuvable(apres(reste, 'dev') ?? reste[0] ?? '');
      if (!root) return jeu.erreur(NON_PERMIS, 2);
      i.adresses = [];
      return '';
    }
  }

  if (['l', 'link'].includes(objet)) {
    if (['show', 'list', 'sh', 'ls'].includes(action)) {
      const dev = apres(reste, 'dev') ?? reste.find((r) => r !== 'dev');
      if (dev && !interfaceDe(dev)) return introuvable(dev);
      return liste(dev)
        .flatMap((i) =>
          brief ? [bref(l, i, `${i.nom === 'lo' ? '00:00:00:00:00:00' : i.mac} ${etatLien(l, i).drapeaux}`)] : lignesLien(l, i, details),
        )
        .join('\n');
    }
    if (action === 'add') {
      const parent = apres(reste, 'link');
      const nom = apres(reste, 'name');
      const type = apres(reste, 'type');
      const id = Number(apres(reste, 'id'));
      if (!nom) return jeu.erreur('Not enough information: "dev" argument is required.', 1);
      if (type !== 'vlan') return jeu.erreur(`Error: Unknown device type.`, 2);
      if (!parent || !interfaceDe(parent)) return introuvable(parent ?? '');
      if (!Number.isInteger(id) || id < 1 || id > 4094) return jeu.erreur('Error: argument "id" is wrong: invalid VLAN id', 1);
      if (!root) return jeu.erreur(NON_PERMIS, 2);
      if (l.interfaces[nom]) return jeu.erreur('RTNETLINK answers: File exists', 2);
      creer(l, nom, { parent, id });
      return '';
    }
    if (action === 'set') {
      const dev = apres(reste, 'dev') ?? reste[0];
      const i = interfaceDe(dev);
      if (!i) return introuvable(dev ?? '');
      if (!reste.includes('up') && !reste.includes('down')) return jeu.erreur('Not enough of information: "dev" argument is required.', 1);
      if (!root) return jeu.erreur(NON_PERMIS, 2);
      i.up = reste.includes('up');
      return '';
    }
    if (['del', 'delete'].includes(action)) {
      const dev = apres(reste, 'dev') ?? reste[0];
      if (!interfaceDe(dev)) return introuvable(dev ?? '');
      if (!root) return jeu.erreur(NON_PERMIS, 2);
      if (!interfaceDe(dev)!.vlan) return jeu.erreur('RTNETLINK answers: Operation not supported', 2);
      supprimer(l, dev!);
      return '';
    }
  }

  if (['r', 'ro', 'route'].includes(objet)) {
    if (['show', 'list', 'sh', 'ls'].includes(action)) return routes(l).join('\n');
    if (['add', 'replace'].includes(action) && reste[0] === 'default') {
      const via = apres(reste, 'via');
      if (!via) return jeu.erreur('Error: either "to" is duplicate, or "via" is a garbage.', 1);
      if (!root) return jeu.erreur(NON_PERMIS, 2);
      const dev = apres(reste, 'dev') ?? Object.values(l.interfaces).find((i) => i.adresses.some((a) => dans4(via, a)))?.nom;
      if (!dev) return jeu.erreur('Error: Nexthop has invalid gateway.', 2);
      if (action === 'add' && l.passerelle) return jeu.erreur('RTNETLINK answers: File exists', 2);
      l.passerelle = { via, dev };
      return '';
    }
    if (['del', 'delete'].includes(action) && reste[0] === 'default') {
      if (!root) return jeu.erreur(NON_PERMIS, 2);
      if (!l.passerelle) return jeu.erreur('RTNETLINK answers: No such process', 2);
      l.passerelle = null;
      return '';
    }
  }
  if (!objet) return jeu.erreur(jeu.t('ip-usage'), 255);
  if (!['a', 'addr', 'address', 'l', 'link', 'r', 'ro', 'route'].includes(objet))
    return jeu.erreur(`Object "${objet}" is unknown, try "ip help".`, 255);
  return jeu.erreur(`Command "${action}" is unknown, try "ip ${objet} help".`, 255);
}

// Une passerelle joignable par cette adresse d'interface ?
const dans4 = (ip: string, adresse: string) => {
  const c = cidr(adresse)!;
  const autre = cidr(`${ip}/${c.longueur}`);
  return !!autre && autre.reseau === c.reseau;
};

// ifup / ifdown : -a (les interfaces « auto »), ou des noms.
function ifupdown(jeu: Shell, args: string[], monte: boolean): string {
  const programme = monte ? 'ifup' : 'ifdown';
  const l = lan(jeu);
  if (!l) return jeu.erreur(`${programme}: couldn't open interfaces file "/etc/network/interfaces"`, 1);
  if (jeu.qui !== 'root') return jeu.erreur(`${programme}: failed to open lockfile /run/network/.ifstate.lock: Permission denied`, 1);
  const { strophes, erreurs } = lireInterfaces(jeu);
  if (erreurs.length) return jeu.erreur([...erreurs, `${programme}: couldn't read interfaces file "/etc/network/interfaces"`].join('\n'), 1);
  const configurees: string[] = (jeu.etat.ifstate ??= []);
  const noms = args.includes('-a')
    ? Object.values(strophes)
        .filter((s) => s.auto)
        .map((s) => s.nom)
    : args.filter((a) => !a.startsWith('-'));
  if (!noms.length) return jeu.erreur(`Usage: ${programme} <options> <ifaces...>`, 1);
  for (const nom of noms) {
    const s = strophes[nom];
    if (!s) {
      jeu.erreur(`${programme}: unknown interface ${nom}`, 1);
      continue;
    }
    if (monte) {
      if (configurees.includes(nom)) {
        if (!args.includes('-a')) jeu.erreur(`ifup: interface ${nom} already configured`, 0);
        continue;
      }
      const e = monter(jeu, l, s);
      if (e) jeu.erreur(`${e}\nifup: failed to bring up ${nom}`, 1);
      else configurees.push(nom);
    } else {
      if (!configurees.includes(nom)) {
        if (!args.includes('-a')) jeu.erreur(`ifdown: interface ${nom} not configured`, 0);
        continue;
      }
      demonter(l, s);
      jeu.etat.ifstate = configurees.filter((n) => n !== nom);
    }
  }
  return '';
}

export const LAN: Record<string, Commande> = {
  // dnsmasq --test : vérifier la configuration (le service, lui, se pilote avec systemctl).
  dnsmasq: {
    section: 8,
    propresOptions: true,
    lancer: ({ args, jeu }) => {
      if (args.includes('--test')) {
        const { erreurs } = lireDnsmasq(jeu);
        return erreurs.length ? jeu.erreur(erreurs[0], 1) : 'dnsmasq: syntax check OK.';
      }
      return jeu.erreur(
        `dnsmasq: failed to create listening socket for port 53: ${jeu.qui === 'root' ? 'Address already in use' : 'Permission denied'}`,
        2,
      );
    },
  },
  ip: { section: 8, propresOptions: true, lancer: ({ args, jeu }) => ip(jeu, args) },
  ifup: { section: 8, propresOptions: true, lancer: ({ args, jeu }) => ifupdown(jeu, args, true) },
  ifdown: { section: 8, propresOptions: true, lancer: ({ args, jeu }) => ifupdown(jeu, args, false) },
  // La page de manuel du fichier (man 5 interfaces).
  interfaces: { section: 5, lancer: () => '' },
};
