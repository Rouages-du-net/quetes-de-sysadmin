// nmap simulé (https://nmap.org/book/man.html) : le balayage de ports d'un
// réseau décrit par l'histoire (etat.scan), vu d'internet.
//   - le chapitre déclare les machines qu'on peut sonder (adresse, noms, services
//     avec leur version) et le périmètre autorisé (les adresses de la lettre de
//     mission) ; une adresse inconnue ne répond jamais ;
//   - pour la machine où l'on joue (`local`), l'état de chaque port vient du
//     vrai modèle (ports.ts : qui écoute, ufw) : un correctif change donc le
//     résultat du balayage suivant ; 127.0.0.1 la voit de l'intérieur ;
//   - -sV affiche la version des services ; -oN garde la trace dans un fichier ;
//   - chaque balayage est noté dans etat.scans (le chapitre y lit si l'on est
//     sorti du périmètre).
// Écarts : TCP seulement (pas de -sU), pas de -O, de scripts (-sC, -A) ni de
// sortie XML ; les 1000 ports les plus courants se réduisent aux services
// déclarés ; le temps est une durée calculée, sans attente réelle.
// Source : https://nmap.org/book/man.html

import type { Jeu } from './shell';
import { etatPort } from './ports';
import type { PareFeu } from './firewall';

export const VERSION_NMAP = '7.95';
// Le point de vue du balayage : une adresse quelconque d'internet (RFC 5737).
const INTERNET = '198.51.100.23';

export interface ServiceScan {
  port: number;
  // Le nom du service, et sa version telle que nmap -sV la devine (une fonction : elle suit l'état, ex. apt).
  service: string;
  produit?: string | ((j: Jeu) => string);
  // TLS : nmap -sV écrit « ssl/http ».
  ssl?: boolean;
}

export interface HoteScan {
  adresse: string;
  // Le premier nom sert à l'affichage (« fournil.internal (192.0.2.22) »).
  noms: string[];
  // La machine où l'on joue : l'état de ses ports vient du modèle, et 127.0.0.1 est elle-même.
  local?: boolean;
  services: ServiceScan[];
  // Latence affichée (secondes).
  latence?: number;
}

export interface EtatScan {
  hotes: HoteScan[];
  // Les adresses que la lettre de mission autorise à sonder.
  perimetre: string[];
}

export interface Balayage {
  // Les adresses visées (la commande, telle que tapée), et si l'une est hors du périmètre.
  commande: string;
  adresses: string[];
  horsPerimetre: string[];
  versions: boolean;
  fichier?: string;
  // Les hôtes qui ont répondu, avec leurs ports ouverts.
  ouverts: Record<string, number[]>;
  // Ce que -sV a lu sur chaque port ouvert (le produit et sa version), par adresse.
  produits: Record<string, string[]>;
}

export interface Options {
  versions: boolean;
  ping: boolean;
  sansPing: boolean;
  nombres: boolean;
  ouvertsSeulement: boolean;
  // null : les 1000 ports courants ; sinon la liste, ou « tous ».
  ports: number[] | 'tous' | 'rapide' | null;
  fichier?: string;
}

// /etc/services, pour la colonne SERVICE sans -sV.
const NOMS: Record<number, string> = { 22: 'ssh', 25: 'smtp', 53: 'domain', 80: 'http', 110: 'pop3', 143: 'imap', 443: 'https', 3000: 'ppp', 3306: 'mysql', 5432: 'postgresql', 6379: 'redis', 8080: 'http-proxy' };
// Les 100 ports les plus courants que nous reconnaissons (-F).
const RAPIDES = new Set([22, 25, 53, 80, 110, 143, 443, 3306, 8080]);

export const etatScan = (jeu: Jeu): EtatScan | undefined => jeu.etat.scan;

const versNombre = (a: string) => a.split('.').reduce((n, o) => n * 256 + Number(o), 0);
const versAdresse = (n: number) => [24, 16, 8, 0].map((s) => (n >>> s) & 255).join('.');
const adresseValide = (a: string) => /^(\d{1,3})(\.\d{1,3}){3}$/.test(a) && a.split('.').every((o) => Number(o) <= 255);

/** Les adresses d'une cible : un nom, une adresse, un réseau (192.0.2.0/29) ou une plage (192.0.2.20-25). null : impossible à résoudre. */
export function developper(jeu: Jeu, cible: string): { adresses: string[]; nom?: string } | null {
  const e = etatScan(jeu);
  const cidr = /^(\d+\.\d+\.\d+\.\d+)\/(\d{1,2})$/.exec(cible);
  if (cidr && adresseValide(cidr[1]) && Number(cidr[2]) >= 16 && Number(cidr[2]) <= 32) {
    const taille = 2 ** (32 - Number(cidr[2]));
    const debut = Math.floor(versNombre(cidr[1]) / taille) * taille;
    return { adresses: Array.from({ length: taille }, (_, i) => versAdresse(debut + i)) };
  }
  const plage = /^(\d+\.\d+\.\d+\.)(\d+)-(\d+)$/.exec(cible);
  if (plage && adresseValide(`${plage[1]}${plage[2]}`) && Number(plage[3]) <= 255 && Number(plage[2]) <= Number(plage[3]))
    return { adresses: Array.from({ length: Number(plage[3]) - Number(plage[2]) + 1 }, (_, i) => `${plage[1]}${Number(plage[2]) + i}`) };
  if (adresseValide(cible)) return { adresses: [cible] };
  if (cible === 'localhost') {
    const ici = e?.hotes.find((h) => h.local);
    return ici ? { adresses: ['127.0.0.1'], nom: 'localhost' } : null;
  }
  const hote = e?.hotes.find((h) => h.noms.includes(cible));
  return hote ? { adresses: [hote.adresse], nom: cible } : null;
}

type EtatLigne = 'open' | 'closed' | 'filtered';

// L'état d'un port de cet hôte, vu d'internet (ou de l'intérieur pour 127.0.0.1).
function etat(jeu: Jeu, h: HoteScan, port: number, interieur: boolean): EtatLigne {
  const declare = h.services.some((s) => s.port === port);
  if (!h.local) return declare ? 'open' : 'closed';
  const e = etatPort(jeu, port, interieur, INTERNET);
  if (declare || e !== 'refuse') return e === 'ouvert' ? 'open' : e === 'filtre' ? 'filtered' : 'closed';
  // Un port où rien n'écoute : fermé, ou jeté en silence par le pare-feu.
  const pf: PareFeu | undefined = jeu.etat.ufw;
  return !interieur && pf?.actif && pf.entrant === 'deny' ? 'filtered' : 'closed';
}

const produit = (jeu: Jeu, s: ServiceScan) => (typeof s.produit === 'function' ? s.produit(jeu) : (s.produit ?? ''));
const hhmm = (ms: number) => new Date(ms).toISOString().slice(0, 16).replace('T', ' ');
const heure = (jeu: Jeu) => hhmm(jeu.etat.systemd?.horloge ?? Date.UTC(2028, 2, 14, 9, 30));
const decimales = (n: number, d = 2) => n.toFixed(d);

/** Les ports à examiner pour cet hôte : ceux qu'il déclare parmi ceux demandés, et le nombre total de ports du balayage. */
function portsExamines(h: HoteScan, o: Options): { ports: number[]; total: number } {
  const declares = h.services.map((s) => s.port);
  if (Array.isArray(o.ports)) return { ports: o.ports, total: o.ports.length };
  if (o.ports === 'tous') return { ports: declares, total: 65535 };
  if (o.ports === 'rapide') return { ports: declares.filter((p) => RAPIDES.has(p)), total: 100 };
  return { ports: declares, total: 1000 };
}

function tableau(jeu: Jeu, h: HoteScan, o: Options, interieur: boolean): { lignes: string[]; ouverts: number[]; produits: string[]; duree: number } {
  const { ports, total } = portsExamines(h, o);
  const uniques = [...new Set(ports)].sort((a, b) => a - b);
  const etats = uniques.map((p) => [p, etat(jeu, h, p, interieur)] as const);
  // Les ports qu'on n'a pas nommés : tous dans l'état « par défaut » de la machine.
  const defaut = etat(jeu, h, -1, interieur) === 'open' ? 'closed' : etat(jeu, h, -1, interieur);
  const autres = total - uniques.length;
  const compte: Record<EtatLigne, number> = { open: 0, closed: 0, filtered: 0 };
  for (const [, e] of etats) compte[e]++;
  compte[defaut] += autres;
  // nmap regroupe l'état le plus courant s'il couvre plus de 25 ports ; les ports ouverts sont toujours listés.
  const regroupe = (['closed', 'filtered'] as EtatLigne[]).filter((e) => compte[e] > 25).sort((a, b) => compte[b] - compte[a])[0];
  const visibles = etats.filter(([, e]) => e === 'open' || (e !== regroupe && !o.ouvertsSeulement));
  const ouverts = etats.filter(([, e]) => e === 'open').map(([p]) => p);
  const lignes: string[] = [];
  const cache = regroupe ? compte[regroupe] : 0;
  const nomEtat = (e: EtatLigne) => (e === 'filtered' ? 'filtered' : e);
  if (!visibles.length && regroupe) lignes.push(`All ${total} scanned ports on ${h.noms[0] && !o.nombres ? `${h.noms[0]} (${h.adresse})` : h.adresse} are in ignored states.`);
  if (regroupe) lignes.push(`Not shown: ${cache} ${regroupe} tcp ports (${regroupe === 'filtered' ? 'no-response' : 'reset'})`);
  if (visibles.length) {
    const lignesPorts = visibles.map(([p, e]) => {
      const s = h.services.find((x) => x.port === p);
      const service = o.versions && s ? `${s.ssl ? 'ssl/' : ''}${s.service}` : e === 'open' && s && !o.versions ? (NOMS[p] ?? s.service) : (NOMS[p] ?? 'unknown');
      const version = o.versions && s && e === 'open' ? produit(jeu, s) : '';
      return [`${p}/tcp`, nomEtat(e), service, version];
    });
    const largeurs = [4, 5, 7].map((min, i) => Math.max(min, ...lignesPorts.map((l) => l[i].length)));
    const ligne = (l: string[]) => `${l[0].padEnd(largeurs[0])} ${l[1].padEnd(largeurs[1])} ${l[2].padEnd(largeurs[2])}${o.versions ? ` ${l[3]}` : ''}`.trimEnd();
    lignes.push(ligne(['PORT', 'STATE', 'SERVICE', 'VERSION']));
    for (const l of lignesPorts) lignes.push(ligne(l));
    if (o.versions && ouverts.some((p) => /^OpenSSH/.test(produit(jeu, h.services.find((s) => s.port === p)!)))) lignes.push('Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel');
  }
  // La durée : les ports filtrés font attendre, la détection de versions aussi.
  const duree = 0.9 + compte.closed * 0.0004 + compte.filtered * 0.0052 + (o.versions ? ouverts.length * 2.4 : 0) + total * 0.00002;
  const produits = ouverts.map((p) => h.services.find((s) => s.port === p)).filter((s) => !!s).map((s) => produit(jeu, s!));
  return { lignes, ouverts, produits, duree };
}

export function balayer(jeu: Jeu, cibles: string[], o: Options, commande: string): { sortie: string; fichier: string } | { erreur: string } {
  const e = etatScan(jeu);
  const adresses: string[] = [];
  const echecs: string[] = [];
  const noms = new Map<string, string>();
  for (const c of cibles) {
    const r = developper(jeu, c);
    if (!r) {
      echecs.push(`Failed to resolve "${c}".`);
      continue;
    }
    for (const a of r.adresses) {
      adresses.push(a);
      if (r.nom) noms.set(a, r.nom);
    }
  }
  const horsPerimetre = [...new Set(adresses)].filter((a) => a !== '127.0.0.1' && !e?.perimetre.includes(a));
  const rapport: string[] = [];
  const fichier: string[] = [];
  let vivants = 0;
  let duree = 0.3;
  const ouverts: Record<string, number[]> = {};
  const produits: Record<string, string[]> = {};
  for (const a of [...new Set(adresses)]) {
    const interieur = a === '127.0.0.1';
    const h = e?.hotes.find((x) => x.adresse === a || (interieur && x.local));
    const vivant = !!h || o.sansPing;
    if (!vivant) {
      if (cibles.length === 1 && adresses.length === 1) rapport.push('Note: Host seems down. If it is really up, but blocking our ping probes, try -Pn');
      duree += adresses.length === 1 ? 3 : 0.2;
      continue;
    }
    vivants++;
    const nom = noms.get(a) ?? h?.noms[0];
    const titre = interieur ? `localhost (127.0.0.1)` : nom && !o.nombres ? `${nom} (${a})` : a;
    const entete = [`Nmap scan report for ${titre}`];
    if (h) entete.push(`Host is up (${decimales(h.latence ?? (interieur ? 0.00012 : 0.011), interieur ? 5 : 3)}s latency).`);
    else entete.push('Host is up.');
    if (o.ping) {
      rapport.push(...entete, '');
      fichier.push(...entete, '');
      duree += 0.02;
      continue;
    }
    const hote: HoteScan = h ?? { adresse: a, noms: [], services: [] };
    // Un hôte joint par 127.0.0.1 s'affiche sous ce nom.
    const t = tableau(jeu, hote, o, interieur);
    ouverts[a] = t.ouverts;
    if (o.versions) produits[a] = t.produits;
    duree += t.duree;
    const bloc = [...entete, ...t.lignes, ''];
    rapport.push(...bloc);
    fichier.push(...bloc);
  }
  const total = new Set(adresses).size;
  const duree2 = Math.max(0.02, duree);
  const pied = `Nmap done: ${total} IP address${total === 1 ? '' : 'es'} (${vivants} host${vivants === 1 ? '' : 's'} up) scanned in ${decimales(duree2)} seconds`;
  if (!total) echecs.push('WARNING: No targets were specified, so 0 hosts scanned.');
  const horloge = heure(jeu);
  const detection = o.versions && !o.ping && vivants ? ['Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .'] : [];
  const sortie = [`Starting Nmap ${VERSION_NMAP} ( https://nmap.org ) at ${horloge} CET`, ...echecs, ...rapport, ...detection, pied]
    .join('\n');
  const lisible = (ms: number) => new Date(ms).toUTCString().replace(/^(\w+), (\d+) (\w+) (\d+) (\d+:\d+:\d+) GMT$/, '$1 $3 $2 $5 $4');
  const t0 = jeu.etat.systemd?.horloge ?? Date.UTC(2028, 2, 14, 9, 30);
  const contenu = [
    `# Nmap ${VERSION_NMAP} scan initiated ${lisible(t0)} as: ${commande}`,
    ...fichier,
    ...detection,
    `# Nmap done at ${lisible(t0 + Math.round(duree2) * 1000)} -- ${total} IP address${total === 1 ? '' : 'es'} (${vivants} host${vivants === 1 ? '' : 's'} up) scanned in ${decimales(duree2)} seconds`,
  ]
    .join('\n');
  // Le temps passe : l'horloge de la machine avance de la durée du balayage.
  if (jeu.etat.systemd) jeu.etat.systemd.horloge += Math.round(duree2) * 1000;
  const liste: Balayage[] = (jeu.etat.scans ??= []);
  liste.push({ commande, adresses: [...new Set(adresses)], horsPerimetre, versions: o.versions, fichier: o.fichier, ouverts, produits });
  return { sortie, fichier: contenu };
}

