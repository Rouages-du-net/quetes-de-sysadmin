// dnsmasq, le serveur DHCP du réseau local (https://dnsmasq.org/docs/dnsmasq-man.html).
// Configuration : /etc/dnsmasq.conf et les fichiers de /etc/dnsmasq.d (comme
// le paquet Debian : sauf les fichiers cachés, finissant par ~, .dpkg-dist,
// .dpkg-old, .dpkg-new). Une option par ligne : interface, except-interface,
// no-dhcp-interface, dhcp-range, dhcp-host, dhcp-option…
// À chaque démarrage, les appareils qui demandent une adresse (DHCP) la
// reçoivent si dnsmasq écoute l'interface du routeur de leur VLAN et qu'une
// plage correspond à son réseau ; une réservation (dhcp-host) passe avant.
// Les baux sont écrits dans /var/lib/misc/dnsmasq.leases, et l'échange dans
// le journal (DHCPDISCOVER, DHCPOFFER, DHCPREQUEST, DHCPACK).
// Écarts : pas de DNS simulé ici (port, server… sont acceptés et ignorés),
// les baux ne se renouvellent pas, une adresse est tirée de l'adresse MAC.

import type { Jeu } from './shell';
import { dans, enService, estIp, lan, reseauDe, versIp, versNombre, vlanDe, type Lan } from './lan';
import { journaliser, systemd } from './systemd';

export const CONF = '/etc/dnsmasq.conf';
export const DOSSIER = '/etc/dnsmasq.d';
export const BAUX = '/var/lib/misc/dnsmasq.leases';

interface Plage {
  debut: string;
  fin: string;
  duree: string;
}

export interface ConfigDnsmasq {
  interfaces: string[];
  exclues: string[];
  plages: Plage[];
  reservations: { mac: string; nom?: string; ip: string }[];
  erreurs: string[];
}

// Les options que le jeu connaît (les autres sont refusées, comme une faute de frappe).
const CONNUES = new Set([
  'interface',
  'except-interface',
  'no-dhcp-interface',
  'listen-address',
  'bind-interfaces',
  'bind-dynamic',
  'dhcp-range',
  'dhcp-host',
  'dhcp-option',
  'dhcp-authoritative',
  'domain',
  'local',
  'port',
  'log-dhcp',
  'log-queries',
  'server',
  'no-resolv',
  'domain-needed',
  'bogus-priv',
  'expand-hosts',
  'dhcp-leasefile',
  'conf-dir',
  'conf-file',
  'cache-size',
  'dhcp-lease-max',
  'no-hosts',
  'addn-hosts',
]);

const duree = (t: string) => /^\d+[smhd]?$|^infinite$/.test(t);

/** La configuration de dnsmasq, et ses erreurs au format de dnsmasq. */
export function lireDnsmasq(j: Jeu): ConfigDnsmasq {
  const c: ConfigDnsmasq = { interfaces: [], exclues: [], plages: [], reservations: [], erreurs: [] };
  const lus = new Set<string>();
  const lireFichier = (fichier: string) => {
    if (lus.has(fichier)) return;
    lus.add(fichier);
    const texte = j.lire(fichier);
    if (texte === null) return;
    texte.split('\n').forEach((brute, i) => {
      if (c.erreurs.length) return;
      const ligne = brute.replace(/#.*/, '').trim();
      if (!ligne) return;
      const [cle, ...reste] = ligne.split('=');
      const nom = cle.trim();
      const valeur = reste.join('=').trim();
      const mauvais = (quoi: string) => c.erreurs.push(`dnsmasq: ${quoi} at line ${i + 1} of ${fichier}`);
      if (!CONNUES.has(nom)) return mauvais('bad option');
      if (nom === 'interface') c.interfaces.push(...valeur.split(','));
      else if (nom === 'except-interface' || nom === 'no-dhcp-interface') c.exclues.push(...valeur.split(','));
      else if (nom === 'conf-dir') lireDossier(valeur.split(',')[0]);
      else if (nom === 'conf-file') lireFichier(valeur);
      else if (nom === 'dhcp-range') {
        // Devant les adresses : des étiquettes (set:, tag:) ou un nom, que le jeu ignore.
        const champs = valeur.split(',').map((x) => x.trim());
        const k = champs.findIndex(estIp);
        const [debut, fin, ...suite] = k >= 0 ? champs.slice(k) : [];
        if (!debut || !fin || !estIp(fin)) return mauvais('bad dhcp-range');
        const masque = suite.find(estIp);
        const d = suite.find((x) => !estIp(x));
        if (d && !duree(d)) return mauvais('bad dhcp-range');
        if (masque && !estIp(masque)) return mauvais('bad dhcp-range');
        c.plages.push({ debut, fin, duree: d ?? '1h' });
      } else if (nom === 'dhcp-host') {
        const champs = valeur.split(',').map((x) => x.trim());
        const mac = champs.find((x) => /^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(x));
        const ip = champs.find(estIp);
        if (!mac || !ip) return mauvais('bad dhcp-host');
        const nomHote = champs.find((x) => x !== mac && x !== ip && !duree(x));
        c.reservations.push({ mac: mac.toLowerCase(), ip, ...(nomHote ? { nom: nomHote } : {}) });
      }
    });
  };
  const lireDossier = (dossier: string) => {
    const d = j.trouver(dossier);
    if (d?.type !== 'dossier') return;
    for (const n of Object.keys(d.enfants).sort())
      if (!n.startsWith('.') && !n.endsWith('~') && !/\.dpkg-(dist|old|new)$/.test(n)) lireFichier(`${dossier}/${n}`);
  };
  lireFichier(CONF);
  // Debian : /etc/default/dnsmasq ajoute -7 /etc/dnsmasq.d.
  lireDossier(DOSSIER);
  return c;
}

// Une adresse de la plage, tirée de l'adresse MAC (toujours la même pour un appareil).
function adresseDans(p: Plage, mac: string, prises: Set<string>): string | null {
  const debut = versNombre(p.debut);
  const taille = versNombre(p.fin) - debut + 1;
  if (taille <= 0) return null;
  let h = 0;
  for (const ch of mac) h = (h * 33 + ch.charCodeAt(0)) >>> 0;
  for (let k = 0; k < taille; k++) {
    const ip = versIp(debut + ((h + k) % taille));
    if (!prises.has(ip)) return ip;
  }
  return null;
}

/** Au démarrage de dnsmasq : chaque appareil en DHCP demande une adresse. */
export function demarrerDnsmasq(j: Jeu) {
  const l = lan(j);
  const sd = systemd(j);
  if (!l || !sd) return;
  const c = lireDnsmasq(j);
  const pid = 1450;
  const noter = (m: string) => journaliser(sd, 'dnsmasq.service', 'dnsmasq-dhcp', pid, m);
  journaliser(sd, 'dnsmasq.service', 'dnsmasq', pid, 'started, version 2.90 cachesize 150');
  for (const p of c.plages) noter(`DHCP, IP range ${p.debut} -- ${p.fin}, lease time ${p.duree}`);
  const prises = new Set<string>(c.reservations.map((r) => r.ip));
  const baux: string[] = [];
  const expiration = Math.floor(sd.horloge / 1000) + 12 * 3600;
  for (const a of l.appareils) {
    if (a.fixe) continue;
    delete a.bail;
    const i = interfaceDuVlan(l, a.vlan);
    if (!i || !ecoute(c, i)) continue;
    const reseaux = i.adresses.map(reseauDe);
    noter(`DHCPDISCOVER(${i.nom}) ${a.mac}`);
    const reservee = c.reservations.find((r) => r.mac === a.mac && reseaux.some((n) => dans(r.ip, n)));
    const plage = c.plages.find((p) => reseaux.some((n) => dans(p.debut, n) && dans(p.fin, n)));
    const ip = reservee?.ip ?? (plage ? adresseDans(plage, a.mac, prises) : null);
    if (!ip) {
      noter(`DHCPDISCOVER(${i.nom}) ${a.mac} no address range available for DHCP request via ${i.nom}`);
      continue;
    }
    prises.add(ip);
    a.bail = ip;
    const nom = reservee?.nom ?? a.nom;
    noter(`DHCPOFFER(${i.nom}) ${ip} ${a.mac}`);
    noter(`DHCPREQUEST(${i.nom}) ${ip} ${a.mac}`);
    noter(`DHCPACK(${i.nom}) ${ip} ${a.mac} ${nom}`);
    baux.push(`${expiration} ${a.mac} ${ip} ${nom} *`);
  }
  const n = j.trouver(BAUX);
  if (n?.type === 'fichier') n.contenu = baux.join('\n');
}

// L'interface du routeur (en service, avec une adresse) qui reçoit ce VLAN.
function interfaceDuVlan(l: Lan, vlan: number) {
  return Object.values(l.interfaces).find((i) => enService(l, i) && i.adresses.length && vlanDe(l, i) === vlan) ?? null;
}

// dnsmasq répond-il sur cette interface ?
// Un nom d'interface, ou un préfixe suivi de * (interface=eth1* : eth1, eth1.10…).
const correspond = (motif: string, nom: string) => (motif.endsWith('*') ? nom.startsWith(motif.slice(0, -1)) : motif === nom);
const ecoute = (c: ConfigDnsmasq, i: { nom: string }) =>
  (!c.interfaces.length || c.interfaces.some((m) => correspond(m, i.nom))) && !c.exclues.some((m) => correspond(m, i.nom));

/** Les appareils qui ont reçu une adresse de dnsmasq, et celle qu'ils ont. */
export const bauxDonnes = (j: Jeu) => (lan(j)?.appareils ?? []).filter((a) => a.bail).map((a) => ({ nom: a.nom, mac: a.mac, ip: a.bail! }));

/** dnsmasq écoute-t-il (en DHCP) l'interface qui porte cette adresse ? */
export function repondSur(j: Jeu, nomInterface: string): boolean {
  return ecoute(lireDnsmasq(j), { nom: nomInterface });
}
