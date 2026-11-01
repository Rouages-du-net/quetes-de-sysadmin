// DNS simulé : des zones au format de BIND, un serveur primaire (named, sur
// la machine), un serveur secondaire chez le registre (qui ne recopie la zone
// que si son numéro de série augmente, après NOTIFY), et un résolveur public
// qui garde ses réponses en cache pendant leur TTL.
// D'après la documentation de BIND 9 (https://bind9.readthedocs.io/en/stable/) :
// format des fichiers de zone (RFC 1035), named-checkzone, rndc reload,
// transferts de zone vers les secondaires quand le serial augmente.
//
//   etat.dns = {
//     conf: '/etc/bind/named.conf.local',
//     primaire: { zone: { serie, rrs } },     ce que named a chargé
//     secondaire: { zone: { serie, rrs } },   la copie du registre
//     cache: { 'nom TYPE': { rrs, expire } }, le résolveur public (heure UTC)
//     serveurs: { primaire: [noms, adresses], secondaire: [...], resolveur: [...] }
//   }
//
// Écarts : types A, AAAA, CNAME, MX, NS, TXT, SOA ; pas de DNSSEC, de
// délégation ni de zones inverses ; le transfert vers le secondaire est
// immédiat.

import type { Game } from './shell';
import { writeLog, systemd } from './systemd';

export interface Rr {
  name: string;
  ttl: number;
  type: string;
  data: string;
}

export interface Zone {
  serial: number;
  rrs: Rr[];
}

export interface DnsState {
  conf: string;
  primary: Record<string, Zone>;
  secondary: Record<string, Zone>;
  cache: Record<string, { rrs: Rr[]; expires: number }>;
  servers: { primary: string[]; secondary: string[]; resolver: string[] };
  // Les fichiers de zone tels qu'ils étaient au dernier chargement (pour « up-to-date »).
  charges: Record<string, string>;
  // Le serveur de la machine est aussi un résolveur (récursif) : pour les noms
  // hors de ses zones, il répond comme le reste d'internet (le secondaire et
  // les zones des autres, rangées avec lui).
  recursive?: boolean;
}

export const dns = (game: Game): DnsState | undefined => game.state.dns;

const TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'NS', 'TXT', 'SOA'];
const fqdn = (name: string, origin: string) => (name === '@' ? origin : name.endsWith('.') ? name : `${name}.${origin}`).toLowerCase();

// Une durée de zone : 86400, ou 1d, 2h, 30m, 1w.
function duration(text: string): number | null {
  if (/^\d+$/.test(text)) return Number(text);
  const m = /^(\d+)([smhdw])$/i.exec(text);
  if (!m) return null;
  return Number(m[1]) * { s: 1, m: 60, h: 3600, d: 86400, w: 604800 }[m[2].toLowerCase() as 's']!;
}

// Un « ; » commence un commentaire, sauf entre guillemets (« v=DKIM1; k=rsa; »).
const withoutComment = (line: string) => line.replace(/^((?:"[^"]*"|[^";])*);.*$/, '$1');
const outsideGuillemets = (line: string) => line.replace(/"[^"]*"/g, '');

/** Le texte d'un enregistrement TXT : ses chaînes entre guillemets, mises bout à bout (RFC 7208, 3.3). */
export const txtText = (data: string) => {
  const strings = [...data.matchAll(/"([^"]*)"/g)].map((m) => m[1]);
  return strings.length ? strings.join('') : data;
};

/**
 * Lit un fichier de zone comme named-checkzone ; renvoie les enregistrements
 * et le serial, ou les erreurs au format de BIND (fichier:ligne: message).
 */
export function readZone(text: string, zone: string, file: string): { zone: Zone; errors: string[] } {
  const zoneOrigin = zone.replace(/\.?$/, '.').toLowerCase();
  let origin = zoneOrigin;
  let defaultTtl: number | null = null;
  let previous = origin;
  const rrs: Rr[] = [];
  const errors: string[] = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const number = i + 1;
    // Les parenthèses regroupent plusieurs lignes (le SOA, une clé DKIM).
    let line = withoutComment(lines[i]);
    if (outsideGuillemets(line).includes('(')) {
      while (!outsideGuillemets(line).includes(')') && i + 1 < lines.length) line += ' ' + withoutComment(lines[++i]);
      line = line.replace(/"[^"]*"|[()]/g, (m) => (m === '(' || m === ')' ? ' ' : m));
    }
    if (!line.trim()) continue;
    const words = [...line.matchAll(/"[^"]*"|\S+/g)].map((m) => m[0]);
    if (words[0] === '$TTL') {
      defaultTtl = duration(words[1] ?? '');
      if (defaultTtl === null) errors.push(`${file}:${number}: '$TTL ${words[1] ?? ''}': not a valid number`);
      continue;
    }
    if (words[0] === '$ORIGIN') {
      origin = fqdn(words[1] ?? '@', zoneOrigin);
      continue;
    }
    // Un nom en début de ligne ; sinon, le même que la ligne précédente.
    let name = previous;
    if (!/^\s/.test(line)) name = fqdn(words.shift()!, origin);
    previous = name;
    let ttl: number | null = null;
    while (words.length && (duration(words[0]) !== null || words[0].toUpperCase() === 'IN')) {
      const m = words.shift()!;
      if (m.toUpperCase() !== 'IN') ttl = duration(m);
    }
    const type = (words.shift() ?? '').toUpperCase();
    if (!TYPES.includes(type)) {
      errors.push(`${file}:${number}: unknown RR type '${type || words[0] || ''}'`);
      continue;
    }
    if (ttl === null && defaultTtl === null) errors.push(`${file}:${number}: no TTL specified; using SOA MINTTL instead`);
    let data = words.join(' ');
    if (
      (type === 'A' && !/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.test(data.trim())) ||
      (type === 'A' && data.split('.').some((o) => Number(o) > 255))
    ) {
      errors.push(`dns_rdata_fromtext: ${file}:${number}: near '${data}': bad dotted quad`);
      continue;
    }
    if (type === 'AAAA' && !/^[0-9a-f:]+$/i.test(data)) {
      errors.push(`dns_rdata_fromtext: ${file}:${number}: near '${data}': bad IPv6 address`);
      continue;
    }
    // Les noms dans les données : relatifs à l'origine s'ils ne finissent pas par un point.
    if (type === 'CNAME' || type === 'NS') data = fqdn(data, origin);
    if (type === 'MX') {
      const [prio, target] = words;
      if (!/^\d+$/.test(prio ?? '') || !target) {
        errors.push(`dns_rdata_fromtext: ${file}:${number}: near '${data}': not a valid number`);
        continue;
      }
      data = `${prio} ${fqdn(target, origin)}`;
    }
    if (type === 'SOA') {
      const [ns, contact, ...numbers] = words;
      if (numbers.length < 5 || numbers.some((n) => duration(n) === null)) {
        errors.push(`dns_rdata_fromtext: ${file}:${number}: near eol: unexpected end of input`);
        continue;
      }
      data = `${fqdn(ns, origin)} ${fqdn(contact, origin)} ${numbers.map((n) => duration(n)).join(' ')}`;
    }
    if (!name.endsWith(zoneOrigin)) {
      errors.push(`${file}:${number}: ignoring out-of-zone data (${name.slice(0, -1)})`);
      continue;
    }
    rrs.push({ name, ttl: ttl ?? defaultTtl ?? 3600, type, data });
  }
  const soa = rrs.find((r) => r.type === 'SOA' && r.name === zoneOrigin);
  if (!soa && !errors.length) errors.push(`zone ${zone}/IN: has no SOA record`);
  // Un CNAME ne peut pas cohabiter avec d'autres données du même nom.
  for (const c of rrs.filter((r) => r.type === 'CNAME'))
    if (rrs.some((r) => r.name === c.name && r.type !== 'CNAME')) errors.push(`zone ${zone}/IN: ${c.name.slice(0, -1)}: CNAME and other data`);
  return { zone: { serial: soa ? Number(soa.data.split(' ')[2]) : 0, rrs }, errors };
}

/** Les zones déclarées dans named.conf.local : nom → fichier. */
export function declaredZones(game: Game): Record<string, string> {
  const d = dns(game);
  const text = d ? (game.read(d.conf) ?? '') : '';
  const zones: Record<string, string> = {};
  for (const m of text.matchAll(/zone\s+"([^"]+)"\s*\{([^}]*)\}/g)) {
    const file = /file\s+"([^"]+)"/.exec(m[2])?.[1];
    if (file) zones[m[1].toLowerCase()] = file;
  }
  return zones;
}

/**
 * rndc reload : named relit les fichiers de zone. Une zone fausse garde son
 * ancienne version. Si le serial augmente, le secondaire est prévenu (NOTIFY)
 * et recopie la zone ; sinon, il garde l'ancienne. Renvoie les zones en erreur.
 */
export function reloadZones(game: Game, only?: string): { errors: string[]; changed: string[] } {
  const d = dns(game)!;
  const sd = systemd(game);
  const log = (message: string, priority = 6) => sd && writeLog(sd, 'named.service', 'named', 733, message, priority);
  const errors: string[] = [];
  const changed: string[] = [];
  for (const [zone, file] of Object.entries(declaredZones(game))) {
    if (only && zone !== only.replace(/\.$/, '').toLowerCase()) continue;
    const text = game.read(file);
    if (text === null) {
      log(`zone ${zone}/IN: loading from master file ${file} failed: file not found`, 3);
      errors.push(zone);
      continue;
    }
    if (d.charges[zone] === text) continue;
    const { zone: z, errors: e } = readZone(text, zone, file);
    if (e.length) {
      e.forEach((m) => log(m, 3));
      const reason = e[0].includes('dotted') ? 'bad dotted quad' : e[0].includes('unknown RR') ? 'unknown class/type' : 'failure';
      log(`zone ${zone}/IN: loading from master file ${file} failed: ${reason}`, 3);
      log(`zone ${zone}/IN: not loaded due to errors.`, 3);
      errors.push(zone);
      continue;
    }
    const old = d.primary[zone];
    if (old && z.serial <= old.serial && d.charges[zone] !== undefined)
      log(`zone ${zone}/IN: zone serial (${z.serial}) unchanged. zone may fail to transfer to secondaries.`, 4);
    log(`zone ${zone}/IN: loaded serial ${z.serial}`);
    d.primary[zone] = z;
    d.charges[zone] = text;
    changed.push(zone);
    // NOTIFY : le secondaire ne recopie que si le serial a augmenté.
    const copyOf = d.secondary[zone];
    if (!copyOf || z.serial > copyOf.serial) {
      log(`zone ${zone}/IN: sending notifies (serial ${z.serial})`);
      d.secondary[zone] = { serial: z.serial, rrs: z.rrs.map((r) => ({ ...r })) };
    }
  }
  return { errors, changed };
}

export type Server = 'primary' | 'secondary' | 'resolver';

export function serverFor(d: DnsState, name: string): Server | null {
  const n = name.replace(/\.$/, '').toLowerCase();
  for (const s of ['primary', 'secondary', 'resolver'] as const) if (d.servers[s].includes(n)) return s;
  return null;
}

export interface Response {
  status: 'NOERROR' | 'NXDOMAIN' | 'REFUSED';
  responses: Rr[];
  authority: boolean;
}

// La zone qui contient ce nom, parmi celles qu'un serveur connaît.
const zoneFor = (zones: Record<string, Zone>, name: string) =>
  Object.keys(zones)
    .filter((z) => name === `${z}.` || name.endsWith(`.${z}.`))
    .sort((a, b) => b.length - a.length)[0];

/** Ce que répond un serveur faisant autorité (primaire ou secondaire), en suivant les CNAME de ses zones. */
function authoritative(zones: Record<string, Zone>, name: string, type: string): Response {
  const z = zoneFor(zones, name);
  if (!z) return { status: 'REFUSED', responses: [], authority: false };
  const responses: Rr[] = [];
  let target = name;
  for (let i = 0; i < 8; i++) {
    const rrs = zones[zoneFor(zones, target) ?? z]?.rrs ?? [];
    const found = rrs.filter((r) => r.name === target && r.type === type);
    if (found.length) return { status: 'NOERROR', responses: [...responses, ...found], authority: true };
    const cname = rrs.find((r) => r.name === target && r.type === 'CNAME');
    if (!cname || type === 'CNAME') {
      const exists = rrs.some((r) => r.name === target);
      return { status: exists || responses.length ? 'NOERROR' : 'NXDOMAIN', responses, authority: true };
    }
    responses.push(cname);
    target = cname.data;
    if (!zoneFor(zones, target)) break;
  }
  return { status: 'NOERROR', responses, authority: true };
}

/**
 * Une question DNS posée à un serveur. Le résolveur public répond depuis son
 * cache tant que le TTL court, sinon il demande au serveur secondaire
 * (celui que ses requêtes atteignent ici) et garde la réponse.
 */
export function query(game: Game, server: Server, name: string, type: string, now: number): Response & { remainingTtl?: number } {
  const d = dns(game)!;
  const q = name.replace(/\.?$/, '.').toLowerCase();
  if (server === 'primary' && d.recursive) {
    const r = authoritative({ ...d.secondary, ...d.primary }, q, type);
    return { ...r, authority: !!zoneFor(d.primary, q) };
  }
  if (server !== 'resolver') return authoritative(server === 'primary' ? d.primary : d.secondary, q, type);
  const key = `${q} ${type}`;
  const memo = d.cache[key];
  if (memo && memo.expires > now) {
    const rest = Math.floor((memo.expires - now) / 1000);
    return {
      status: memo.rrs.length ? 'NOERROR' : 'NXDOMAIN',
      responses: memo.rrs.map((r) => ({ ...r, ttl: rest })),
      authority: false,
      remainingTtl: rest,
    };
  }
  const r = authoritative(d.secondary, q, type);
  if (r.status === 'REFUSED') return { status: 'NXDOMAIN', responses: [], authority: false };
  const ttl = r.responses.length ? Math.min(...r.responses.map((x) => x.ttl)) : 3600;
  d.cache[key] = { rrs: r.responses, expires: now + ttl * 1000 };
  return { ...r, authority: false };
}
