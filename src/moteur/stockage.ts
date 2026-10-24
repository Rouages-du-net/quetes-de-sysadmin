// Le stockage d'une machine : ses disques (et ce que SMART en dit), leurs
// partitions (GPT), et les grappes RAID logiciel (md) qui les assemblent.
// C'est ce que lisent lsblk, smartctl, mdadm, sfdisk et grub-install, et ce
// que montre /proc/mdstat. D'après la documentation du noyau
// (https://docs.kernel.org/admin-guide/md.html), mdadm(8)
// (https://man7.org/linux/man-pages/man8/mdadm.8.html), smartctl(8)
// (https://www.smartmontools.org/browser/trunk/smartmontools/smartctl.8.in)
// et sfdisk(8) (https://man7.org/linux/man-pages/man8/sfdisk.8.html).
//
//   etat.stockage = { disques: { sda: Disque, … }, grappes: { md0: Grappe, … }, grub: ['sda'] }
//
// Une grappe RAID 1 garde le même contenu sur chacun de ses membres (des
// partitions). Un membre peut être actif, défectueux (F), ou en
// reconstruction : il reçoit la copie des autres, une grappe à la fois
// (les autres attendent : DELAYED). Le temps passe à chaque commande
// (avancer) : la reconstruction d'un gros disque prend quelques commandes.
// Écarts : RAID 1 seulement ; une seule taille de secteur (512 octets) ;
// pas de bitmap d'écriture réelle (--re-add reconstruit comme --add, mais
// plus vite) ; le contenu des disques n'est pas copié (le monde reste celui
// de la machine).

import type { Jeu } from './shell';
import type { Dossier } from './monde';

export const SECTEUR = 512;

export type TypePartition = 'bios' | 'raid' | 'linux';

/** Les identifiants GPT des types de partition (sfdisk -d). */
export const GUID_TYPE: Record<TypePartition, string> = {
  bios: '21686148-6449-6E6F-744E-656564454649',
  raid: 'A19D880F-05FC-4D3B-A006-743F0F84911E',
  linux: '0FC63DAF-8483-4772-8E79-3D69D8477DE4',
};
/** Leur nom, comme sfdisk et fdisk l'affichent. */
export const NOM_TYPE: Record<TypePartition, string> = { bios: 'BIOS boot', raid: 'Linux RAID', linux: 'Linux filesystem' };

export interface Partition {
  numero: number;
  debut: number;
  secteurs: number;
  type: TypePartition;
  uuid: string;
}

export interface Smart {
  heures: number;
  temperature: number;
  // Secteurs réalloués (5), en attente de réallocation (197), illisibles hors ligne (198).
  realloues: number;
  enAttente: number;
  illisibles: number;
  // Erreurs de liaison (199, UDMA_CRC) et erreurs ATA journalisées.
  crc: number;
  erreursAta: number;
  // Le verdict global (PASSED tant qu'aucun attribut n'a franchi son seuil).
  echec?: boolean;
}

export interface Disque {
  modele: string;
  serie: string;
  secteurs: number;
  // L'identifiant de la table GPT (label-id), ou null : disque vierge.
  table: string | null;
  partitions: Partition[];
  smart: Smart;
  // Le rang du disque (sda : 0, sdb : 1…), pour ses numéros MAJ:MIN.
  rang: number;
}

// spare : un membre de rechange, qui prendra la place d'un défectueux.
export type EtatMembre = 'actif' | 'defectueux' | 'reconstruction' | 'spare';

export interface Membre {
  // La partition, sans /dev/ (sda2).
  part: string;
  // Son numéro dans la grappe (le [n] de /proc/mdstat), et sa place (RaidDevice).
  numero: number;
  role: number | null;
  etat: EtatMembre;
  // Reconstruction : la part déjà copiée (0 à 1).
  copie?: number;
  // Revenu par --re-add : seuls les blocs changés depuis son départ sont recopiés.
  rapide?: boolean;
}

export interface Grappe {
  niveau: 'raid1';
  voulus: number;
  // La taille utile, en blocs de 1 Kio (comme /proc/mdstat).
  blocs: number;
  uuid: string;
  nom: string;
  membres: Membre[];
  evenements: number;
  creation: number;
  // Les grosses grappes ont un bitmap d'écriture (ligne bitmap: de /proc/mdstat).
  bitmap?: boolean;
  rang: number;
}

export interface Stockage {
  disques: Record<string, Disque>;
  grappes: Record<string, Grappe>;
  // Les disques où GRUB est installé (dans leur zone de démarrage).
  grub: string[];
}

// Débit de reconstruction (Kio/s), et temps simulé à chaque commande.
const VITESSE = 180_000;
export const SECONDES_PAR_COMMANDE = 1800;

export const stockage = (j: Jeu): Stockage | null => (j.etat.stockage as Stockage | undefined) ?? null;

/** « sdb2 » → le disque sdb et sa partition 2 (ou null). */
export function partitionDe(st: Stockage, nom: string): { disque: string; d: Disque; p: Partition } | null {
  const m = /^(?:\/dev\/)?(sd[a-z])(\d+)$/.exec(nom);
  if (!m) return null;
  const d = st.disques[m[1]];
  const p = d?.partitions.find((x) => x.numero === Number(m[2]));
  return d && p ? { disque: m[1], d, p } : null;
}

/** La grappe dont cette partition est membre (sans /dev/), ou null. */
export const grappeDe = (st: Stockage, part: string): [string, Grappe] | null =>
  Object.entries(st.grappes).find(([, g]) => g.membres.some((m) => m.part === part)) ?? null;

/** Une partition est-elle tenue par une grappe ou un montage ? (sfdisk refuse de toucher son disque.) */
export const disqueOccupe = (st: Stockage, disque: string) =>
  st.disques[disque]?.partitions.some((p) => grappeDe(st, `${disque}${p.numero}`) !== null) ?? false;

export const majmin = (st: Stockage, nom: string): [number, number] => {
  const p = /^(sd[a-z])(\d*)$/.exec(nom);
  if (p) return [8, st.disques[p[1]].rang * 16 + (p[2] ? Number(p[2]) : 0)];
  return [9, st.grappes[nom]?.rang ?? 0];
};

/** Les membres en état de marche (actifs, ou à jour) et le compte des places tenues. */
export const actifs = (g: Grappe) => g.membres.filter((m) => m.etat === 'actif');
export const enReconstruction = (g: Grappe) => g.membres.filter((m) => m.etat === 'reconstruction');
export const degradee = (g: Grappe) => actifs(g).length < g.voulus;
export const saine = (g: Grappe) => actifs(g).length === g.voulus && g.membres.every((m) => m.etat === 'actif');

// La grappe qui reconstruit en ce moment : la première (dans l'ordre md0, md1…) ; les autres attendent.
export function reconstruitEnCeMoment(st: Stockage): string | null {
  return Object.keys(st.grappes)
    .sort((a, b) => st.grappes[a].rang - st.grappes[b].rang)
    .find((n) => enReconstruction(st.grappes[n]).length > 0) ?? null;
}

/** Le temps passe (une commande) : la reconstruction avance. */
export function avancer(st: Stockage, secondes = SECONDES_PAR_COMMANDE): void {
  let reste = secondes;
  // Une grappe finie, la suivante commence dans le temps qui reste.
  while (reste > 0) {
    const nom = reconstruitEnCeMoment(st);
    if (!nom) return;
    const g = st.grappes[nom];
    const m = enReconstruction(g)[0];
    const total = m.rapide ? Math.min(g.blocs, 2_000_000) : g.blocs;
    const faits = (m.copie ?? 0) * total;
    const possible = VITESSE * reste;
    if (faits + possible < total) {
      m.copie = (faits + possible) / total;
      return;
    }
    reste -= Math.ceil((total - faits) / VITESSE);
    m.etat = 'actif';
    delete m.copie;
    delete m.rapide;
    g.evenements += 1;
  }
}

/** Le premier numéro libre d'une grappe ([n] dans /proc/mdstat). */
export const numeroLibre = (g: Grappe) => Math.max(-1, ...g.membres.map((m) => m.numero)) + 1;

/** La place libre (RaidDevice) d'une grappe dégradée, ou null. */
export function placeLibre(g: Grappe): number | null {
  for (let r = 0; r < g.voulus; r++) if (!g.membres.some((m) => m.role === r && m.etat !== 'defectueux')) return r;
  return null;
}

// ——— /proc/mdstat ———

const barre = (copie: number) => {
  const pleins = Math.min(19, Math.floor(copie * 20));
  return `[${'='.repeat(pleins)}>${'.'.repeat(19 - pleins)}]`;
};

/** Le contenu de /proc/mdstat. */
export function mdstat(st: Stockage): string {
  const lignes = ['Personalities : [raid1] [linear] [multipath] [raid0] [raid6] [raid5] [raid4] [raid10] '];
  const enCours = reconstruitEnCeMoment(st);
  const noms = Object.keys(st.grappes).sort((a, b) => st.grappes[b].rang - st.grappes[a].rang);
  for (const nom of noms) {
    const g = st.grappes[nom];
    // Les membres, du plus récent au plus ancien, (F) pour les défectueux.
    const membres = [...g.membres]
      .sort((a, b) => b.numero - a.numero)
      .map((m) => `${m.part}[${m.numero}]${m.etat === 'defectueux' ? '(F)' : m.etat === 'spare' ? '(S)' : ''}`)
      .join(' ');
    lignes.push(`${nom} : active ${g.niveau} ${membres}`);
    const places = Array.from({ length: g.voulus }, (_, r) => (g.membres.some((m) => m.role === r && m.etat === 'actif') ? 'U' : '_')).join('');
    lignes.push(`      ${g.blocs} blocks super 1.2 [${g.voulus}/${actifs(g).length}] [${places}]`);
    const r = enReconstruction(g)[0];
    if (r && nom === enCours) {
      const copie = r.copie ?? 0;
      const total = r.rapide ? Math.min(g.blocs, 2_000_000) : g.blocs;
      const faits = Math.floor(copie * total);
      const minutes = (total - faits) / VITESSE / 60;
      lignes.push(
        `      ${barre(copie)}  recovery = ${(Math.floor(copie * 1000) / 10).toFixed(1).padStart(4)}% (${faits}/${total}) finish=${minutes.toFixed(1)}min speed=${VITESSE}K/sec`,
      );
    } else if (r) lignes.push('      \tresync=DELAYED');
    if (g.bitmap) lignes.push('      bitmap: 0/15 pages [0KB], 65536KB chunk');
    lignes.push('');
  }
  lignes.push('unused devices: <none>');
  return lignes.join('\n');
}

// ——— Tailles, comme les outils les écrivent ———

/** « 1.8T », « 32G », « 1M » : comme lsblk (puissances de 1024, un chiffre après la virgule). */
export function tailleCourte(octets: number): string {
  const unites = ['B', 'K', 'M', 'G', 'T'];
  let v = octets;
  let i = 0;
  while (v >= 1024 && i < unites.length - 1) {
    v /= 1024;
    i++;
  }
  const arrondi = Math.round(v * 10) / 10;
  return `${Number.isInteger(arrondi) ? arrondi : arrondi.toFixed(1)}${unites[i]}`;
}

/** « 1.82 TiB » (fdisk, sfdisk) et « 31.97 GiB 34.33 GB » (mdadm). */
export function tailleBinaire(octets: number): string {
  const unites = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  let v = octets;
  let i = 0;
  while (v >= 1024 && i < unites.length - 1) {
    v /= 1024;
    i++;
  }
  return `${Number(v.toFixed(2))} ${unites[i]}`;
}
export function tailleDecimale(octets: number): string {
  const unites = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = octets;
  let i = 0;
  while (v >= 1000 && i < unites.length - 1) {
    v /= 1000;
    i++;
  }
  return `${v.toFixed(2)} ${unites[i]}`;
}

// ——— /dev ———

/** Les fichiers de périphérique de /dev suivent les disques, partitions et grappes (pour ls et la complétion). */
export function majDev(j: Jeu): void {
  const st = stockage(j);
  const dev = j.trouver('/dev');
  if (!st || dev?.type !== 'dossier') return;
  const noms = [
    ...Object.entries(st.disques).flatMap(([n, d]) => [n, ...d.partitions.map((p) => `${n}${p.numero}`)]),
    ...Object.keys(st.grappes),
  ];
  for (const k of Object.keys(dev.enfants)) if (/^(sd[a-z]\d*|md\d+)$/.test(k) && !noms.includes(k)) delete dev.enfants[k];
  for (const n of noms)
    dev.enfants[n] ??= { type: 'fichier', contenu: '', proprio: 'root', groupe: 'disk', mode: 'rw-rw----', lignes: true };
}

/** Un dossier /dev de départ (rempli par majDev). */
export const dossierDev = (): Dossier => ({ type: 'dossier', enfants: {}, proprio: 'root', mode: 'rwxr-xr-x' });
