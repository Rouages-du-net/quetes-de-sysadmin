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

import type { Jeu } from './shell';
import { journaliser, systemd } from './systemd';

export interface Rr {
  nom: string;
  ttl: number;
  type: string;
  donnees: string;
}

export interface Zone {
  serie: number;
  rrs: Rr[];
}

export interface EtatDns {
  conf: string;
  primaire: Record<string, Zone>;
  secondaire: Record<string, Zone>;
  cache: Record<string, { rrs: Rr[]; expire: number }>;
  serveurs: { primaire: string[]; secondaire: string[]; resolveur: string[] };
  // Les fichiers de zone tels qu'ils étaient au dernier chargement (pour « up-to-date »).
  charges: Record<string, string>;
}

export const dns = (jeu: Jeu): EtatDns | undefined => jeu.etat.dns;

const TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'NS', 'TXT', 'SOA'];
const fqdn = (nom: string, origine: string) => (nom === '@' ? origine : nom.endsWith('.') ? nom : `${nom}.${origine}`).toLowerCase();

// Une durée de zone : 86400, ou 1d, 2h, 30m, 1w.
function duree(texte: string): number | null {
  if (/^\d+$/.test(texte)) return Number(texte);
  const m = /^(\d+)([smhdw])$/i.exec(texte);
  if (!m) return null;
  return Number(m[1]) * { s: 1, m: 60, h: 3600, d: 86400, w: 604800 }[m[2].toLowerCase() as 's']!;
}

/**
 * Lit un fichier de zone comme named-checkzone ; renvoie les enregistrements
 * et le serial, ou les erreurs au format de BIND (fichier:ligne: message).
 */
export function lireZone(texte: string, zone: string, fichier: string): { zone: Zone; erreurs: string[] } {
  const origineZone = zone.replace(/\.?$/, '.').toLowerCase();
  let origine = origineZone;
  let ttlDefaut: number | null = null;
  let precedent = origine;
  const rrs: Rr[] = [];
  const erreurs: string[] = [];
  const lignes = texte.split('\n');
  for (let i = 0; i < lignes.length; i++) {
    const numero = i + 1;
    // Les parenthèses regroupent plusieurs lignes (le SOA).
    let ligne = lignes[i].replace(/;.*$/, '');
    if (ligne.includes('(')) {
      while (!ligne.includes(')') && i + 1 < lignes.length) ligne += ' ' + lignes[++i].replace(/;.*$/, '');
      ligne = ligne.replace(/[()]/g, ' ');
    }
    if (!ligne.trim()) continue;
    const mots = [...ligne.matchAll(/"[^"]*"|\S+/g)].map((m) => m[0]);
    if (mots[0] === '$TTL') {
      ttlDefaut = duree(mots[1] ?? '');
      if (ttlDefaut === null) erreurs.push(`${fichier}:${numero}: '$TTL ${mots[1] ?? ''}': not a valid number`);
      continue;
    }
    if (mots[0] === '$ORIGIN') {
      origine = fqdn(mots[1] ?? '@', origineZone);
      continue;
    }
    // Un nom en début de ligne ; sinon, le même que la ligne précédente.
    let nom = precedent;
    if (!/^\s/.test(ligne)) nom = fqdn(mots.shift()!, origine);
    precedent = nom;
    let ttl: number | null = null;
    while (mots.length && (duree(mots[0]) !== null || mots[0].toUpperCase() === 'IN')) {
      const m = mots.shift()!;
      if (m.toUpperCase() !== 'IN') ttl = duree(m);
    }
    const type = (mots.shift() ?? '').toUpperCase();
    if (!TYPES.includes(type)) {
      erreurs.push(`${fichier}:${numero}: unknown RR type '${type || mots[0] || ''}'`);
      continue;
    }
    if (ttl === null && ttlDefaut === null) erreurs.push(`${fichier}:${numero}: no TTL specified; using SOA MINTTL instead`);
    let donnees = mots.join(' ');
    if (
      (type === 'A' && !/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.test(donnees.trim())) ||
      (type === 'A' && donnees.split('.').some((o) => Number(o) > 255))
    ) {
      erreurs.push(`dns_rdata_fromtext: ${fichier}:${numero}: near '${donnees}': bad dotted quad`);
      continue;
    }
    if (type === 'AAAA' && !/^[0-9a-f:]+$/i.test(donnees)) {
      erreurs.push(`dns_rdata_fromtext: ${fichier}:${numero}: near '${donnees}': bad IPv6 address`);
      continue;
    }
    // Les noms dans les données : relatifs à l'origine s'ils ne finissent pas par un point.
    if (type === 'CNAME' || type === 'NS') donnees = fqdn(donnees, origine);
    if (type === 'MX') {
      const [prio, cible] = mots;
      if (!/^\d+$/.test(prio ?? '') || !cible) {
        erreurs.push(`dns_rdata_fromtext: ${fichier}:${numero}: near '${donnees}': not a valid number`);
        continue;
      }
      donnees = `${prio} ${fqdn(cible, origine)}`;
    }
    if (type === 'SOA') {
      const [ns, contact, ...nombres] = mots;
      if (nombres.length < 5 || nombres.some((n) => duree(n) === null)) {
        erreurs.push(`dns_rdata_fromtext: ${fichier}:${numero}: near eol: unexpected end of input`);
        continue;
      }
      donnees = `${fqdn(ns, origine)} ${fqdn(contact, origine)} ${nombres.map((n) => duree(n)).join(' ')}`;
    }
    if (!nom.endsWith(origineZone)) {
      erreurs.push(`${fichier}:${numero}: ignoring out-of-zone data (${nom.slice(0, -1)})`);
      continue;
    }
    rrs.push({ nom, ttl: ttl ?? ttlDefaut ?? 3600, type, donnees });
  }
  const soa = rrs.find((r) => r.type === 'SOA' && r.nom === origineZone);
  if (!soa && !erreurs.length) erreurs.push(`zone ${zone}/IN: has no SOA record`);
  // Un CNAME ne peut pas cohabiter avec d'autres données du même nom.
  for (const c of rrs.filter((r) => r.type === 'CNAME'))
    if (rrs.some((r) => r.nom === c.nom && r.type !== 'CNAME')) erreurs.push(`zone ${zone}/IN: ${c.nom.slice(0, -1)}: CNAME and other data`);
  return { zone: { serie: soa ? Number(soa.donnees.split(' ')[2]) : 0, rrs }, erreurs };
}

/** Les zones déclarées dans named.conf.local : nom → fichier. */
export function zonesDeclarees(jeu: Jeu): Record<string, string> {
  const d = dns(jeu);
  const texte = d ? (jeu.lire(d.conf) ?? '') : '';
  const zones: Record<string, string> = {};
  for (const m of texte.matchAll(/zone\s+"([^"]+)"\s*\{([^}]*)\}/g)) {
    const fichier = /file\s+"([^"]+)"/.exec(m[2])?.[1];
    if (fichier) zones[m[1].toLowerCase()] = fichier;
  }
  return zones;
}

/**
 * rndc reload : named relit les fichiers de zone. Une zone fausse garde son
 * ancienne version. Si le serial augmente, le secondaire est prévenu (NOTIFY)
 * et recopie la zone ; sinon, il garde l'ancienne. Renvoie les zones en erreur.
 */
export function rechargerZones(jeu: Jeu, seulement?: string): { erreurs: string[]; changees: string[] } {
  const d = dns(jeu)!;
  const sd = systemd(jeu);
  const log = (message: string, priorite = 6) => sd && journaliser(sd, 'named.service', 'named', 733, message, priorite);
  const erreurs: string[] = [];
  const changees: string[] = [];
  for (const [zone, fichier] of Object.entries(zonesDeclarees(jeu))) {
    if (seulement && zone !== seulement.replace(/\.$/, '').toLowerCase()) continue;
    const texte = jeu.lire(fichier);
    if (texte === null) {
      log(`zone ${zone}/IN: loading from master file ${fichier} failed: file not found`, 3);
      erreurs.push(zone);
      continue;
    }
    if (d.charges[zone] === texte) continue;
    const { zone: z, erreurs: e } = lireZone(texte, zone, fichier);
    if (e.length) {
      e.forEach((m) => log(m, 3));
      const raison = e[0].includes('dotted') ? 'bad dotted quad' : e[0].includes('unknown RR') ? 'unknown class/type' : 'failure';
      log(`zone ${zone}/IN: loading from master file ${fichier} failed: ${raison}`, 3);
      log(`zone ${zone}/IN: not loaded due to errors.`, 3);
      erreurs.push(zone);
      continue;
    }
    const ancien = d.primaire[zone];
    if (ancien && z.serie <= ancien.serie && d.charges[zone] !== undefined)
      log(`zone ${zone}/IN: zone serial (${z.serie}) unchanged. zone may fail to transfer to secondaries.`, 4);
    log(`zone ${zone}/IN: loaded serial ${z.serie}`);
    d.primaire[zone] = z;
    d.charges[zone] = texte;
    changees.push(zone);
    // NOTIFY : le secondaire ne recopie que si le serial a augmenté.
    const copie = d.secondaire[zone];
    if (!copie || z.serie > copie.serie) {
      log(`zone ${zone}/IN: sending notifies (serial ${z.serie})`);
      d.secondaire[zone] = { serie: z.serie, rrs: z.rrs.map((r) => ({ ...r })) };
    }
  }
  return { erreurs, changees };
}

export type Serveur = 'primaire' | 'secondaire' | 'resolveur';

export function serveurDe(d: EtatDns, nom: string): Serveur | null {
  const n = nom.replace(/\.$/, '').toLowerCase();
  for (const s of ['primaire', 'secondaire', 'resolveur'] as const) if (d.serveurs[s].includes(n)) return s;
  return null;
}

export interface Reponse {
  statut: 'NOERROR' | 'NXDOMAIN' | 'REFUSED';
  reponses: Rr[];
  autorite: boolean;
}

// La zone qui contient ce nom, parmi celles qu'un serveur connaît.
const zoneDe = (zones: Record<string, Zone>, nom: string) =>
  Object.keys(zones)
    .filter((z) => nom === `${z}.` || nom.endsWith(`.${z}.`))
    .sort((a, b) => b.length - a.length)[0];

/** Ce que répond un serveur faisant autorité (primaire ou secondaire), en suivant les CNAME de ses zones. */
function autoritaire(zones: Record<string, Zone>, nom: string, type: string): Reponse {
  const z = zoneDe(zones, nom);
  if (!z) return { statut: 'REFUSED', reponses: [], autorite: false };
  const reponses: Rr[] = [];
  let cible = nom;
  for (let i = 0; i < 8; i++) {
    const rrs = zones[zoneDe(zones, cible) ?? z]?.rrs ?? [];
    const trouves = rrs.filter((r) => r.nom === cible && r.type === type);
    if (trouves.length) return { statut: 'NOERROR', reponses: [...reponses, ...trouves], autorite: true };
    const cname = rrs.find((r) => r.nom === cible && r.type === 'CNAME');
    if (!cname || type === 'CNAME') {
      const existe = rrs.some((r) => r.nom === cible);
      return { statut: existe || reponses.length ? 'NOERROR' : 'NXDOMAIN', reponses, autorite: true };
    }
    reponses.push(cname);
    cible = cname.donnees;
    if (!zoneDe(zones, cible)) break;
  }
  return { statut: 'NOERROR', reponses, autorite: true };
}

/**
 * Une question DNS posée à un serveur. Le résolveur public répond depuis son
 * cache tant que le TTL court, sinon il demande au serveur secondaire
 * (celui que ses requêtes atteignent ici) et garde la réponse.
 */
export function interroger(jeu: Jeu, serveur: Serveur, nom: string, type: string, maintenant: number): Reponse & { ttlRestant?: number } {
  const d = dns(jeu)!;
  const q = nom.replace(/\.?$/, '.').toLowerCase();
  if (serveur !== 'resolveur') return autoritaire(serveur === 'primaire' ? d.primaire : d.secondaire, q, type);
  const cle = `${q} ${type}`;
  const memo = d.cache[cle];
  if (memo && memo.expire > maintenant) {
    const reste = Math.floor((memo.expire - maintenant) / 1000);
    return {
      statut: memo.rrs.length ? 'NOERROR' : 'NXDOMAIN',
      reponses: memo.rrs.map((r) => ({ ...r, ttl: reste })),
      autorite: false,
      ttlRestant: reste,
    };
  }
  const r = autoritaire(d.secondaire, q, type);
  if (r.statut === 'REFUSED') return { statut: 'NXDOMAIN', reponses: [], autorite: false };
  const ttl = r.reponses.length ? Math.min(...r.reponses.map((x) => x.ttl)) : 3600;
  d.cache[cle] = { rrs: r.reponses, expire: maintenant + ttl * 1000 };
  return { ...r, autorite: false };
}
