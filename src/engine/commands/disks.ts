// Les disques : lsblk (util-linux) pour les voir, mount et umount pour
// brancher un système de fichiers dans l'arborescence. D'après
// https://man7.org/linux/man-pages/man8/mount.8.html et lsblk(8).
//
//   etat.peripheriques = { '/dev/sdb1': { disque, taille, systeme, etiquette, arbre } }
//   etat.montages = [{ chemin, capacite, nom, systeme, lectureSeule }]
//
// Monter, c'est faire apparaître l'arbre du périphérique au point de montage
// (ce qu'il y avait dans le dossier est caché, pas effacé) ; démonter le
// détache. Monté en lecture seule (-o ro), rien ne peut y être écrit.
// Sur une machine au stockage décrit, mount lit /etc/fstab (voir fstab.ts) : mount -a,
// mount point_de_montage, sources UUID= et LABEL=.
// Écarts : pas d'options autres que ro/rw ; un seul type
// de système de fichiers par périphérique.

import type { Dossier, Noeud } from '../world';
import type { Shell } from '../shell';
import type { Commande } from './index';
import { stockage } from '../storage';
import { lireFstab, resoudreSource, systemeDe } from '../fstab';
import { lsblkStockage } from './storage';

export interface Peripherique {
  // Le disque entier (/dev/sdb) et ses numéros (MAJ:MIN), amovible ou non.
  disque: string;
  majmin: [number, number];
  amovible: boolean;
  taille: number;
  systeme: string;
  etiquette?: string;
  uuid: string;
  arbre: Dossier;
}

export interface Montage {
  chemin: string;
  capacite: number;
  nom: string;
  systeme?: string;
  lectureSeule?: boolean;
  options?: string;
  // Ce que cachait le point de montage, rendu au démontage.
  cache?: { enfants: Record<string, Noeud>; proprio?: string; groupe?: string; mode?: string };
}

const peripheriques = (jeu: Shell): Record<string, Peripherique> => jeu.etat.peripheriques ?? {};
const montages = (jeu: Shell): Montage[] => (jeu.etat.montages ??= []);

/** « 29.3G », « 20G », comme lsblk (puissances de 1024). */
function tailleLsblk(octets: number): string {
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

function lsblk(jeu: Shell, args: string[]): string {
  // Une machine aux disques décrits (stockage.ts) : disques, partitions, RAID, colonnes au choix.
  const st = stockage(jeu);
  if (st) return lsblkStockage(jeu, st, args);
  const complet = args.includes('-f') || args.includes('--fs');
  // Le disque de la machine (vda) et ses partitions montées, puis les périphériques.
  type Ligne = {
    nom: string;
    majmin: string;
    rm: number;
    taille: number;
    type: string;
    point: string;
    systeme: string;
    etiquette: string;
    uuid: string;
  };
  const disques = new Map<string, { majmin: string; rm: number; taille: number; parts: Ligne[] }>();
  for (const m of montages(jeu).filter((x) => x.nom.startsWith('/dev/vd'))) {
    const disque = m.nom.replace(/\d+$/, '');
    const d = disques.get(disque) ?? { majmin: '254:0', rm: 0, taille: m.capacite, parts: [] };
    d.parts.push({
      nom: m.nom,
      majmin: `254:${d.parts.length + 1}`,
      rm: 0,
      taille: m.capacite,
      type: 'part',
      point: m.chemin,
      systeme: m.systeme ?? 'ext4',
      etiquette: '',
      uuid: '3f6d2c1e-8a4b-4c1d-9e2f-5b7a0c9d1e42',
    });
    disques.set(disque, d);
  }
  for (const [nom, p] of Object.entries(peripheriques(jeu))) {
    const d = disques.get(p.disque) ?? { majmin: `${p.majmin[0]}:${p.majmin[1] - 1}`, rm: p.amovible ? 1 : 0, taille: p.taille, parts: [] };
    const m = montages(jeu).find((x) => x.nom === nom);
    d.parts.push({
      nom,
      majmin: `${p.majmin[0]}:${p.majmin[1]}`,
      rm: p.amovible ? 1 : 0,
      taille: p.taille,
      type: 'part',
      point: m?.chemin ?? '',
      systeme: p.systeme,
      etiquette: p.etiquette ?? '',
      uuid: p.uuid,
    });
    disques.set(p.disque, d);
  }
  const court = (n: string) => n.replace('/dev/', '');
  const lignes: string[] = [];
  if (complet) {
    lignes.push('NAME   FSTYPE FSVER LABEL      UUID                                 FSAVAIL FSUSE% MOUNTPOINTS');
    for (const [disque, d] of disques) {
      lignes.push(court(disque));
      d.parts.forEach((p, i) => {
        const m = montages(jeu).find((x) => x.nom === p.nom);
        const lieu = m ? jeu.trouver(m.chemin) : null;
        const utilise = lieu ? jeu.taille(lieu) : 0;
        const libre = m ? tailleLsblk(Math.max(0, p.taille - utilise)) : '';
        const pct = m ? `${Math.round((100 * utilise) / p.taille)}%` : '';
        lignes.push(
          `${(i === d.parts.length - 1 ? '└─' : '├─') + court(p.nom)}`.padEnd(7) +
            `${p.systeme.padEnd(7)}${''.padEnd(6)}${p.etiquette.padEnd(11)}${p.uuid.padEnd(37)}${libre.padStart(7)} ${pct.padStart(6)} ${p.point}`.trimEnd(),
        );
      });
    }
    return lignes.join('\n');
  }
  lignes.push('NAME   MAJ:MIN RM  SIZE RO TYPE MOUNTPOINTS');
  for (const [disque, d] of disques) {
    lignes.push(`${court(disque).padEnd(6)} ${d.majmin.padStart(7)} ${String(d.rm).padStart(2)} ${tailleLsblk(d.taille).padStart(5)}  0 disk `);
    d.parts.forEach((p, i) => {
      const m = montages(jeu).find((x) => x.nom === p.nom);
      const nom = (i === d.parts.length - 1 ? '└─' : '├─') + court(p.nom);
      lignes.push(
        `${nom.padEnd(6)} ${p.majmin.padStart(7)} ${String(p.rm).padStart(2)} ${tailleLsblk(p.taille).padStart(5)} ${m?.lectureSeule ? ' 1' : ' 0'} part ${p.point}`,
      );
    });
  }
  return lignes.join('\n');
}

const DMESG = '\n       dmesg(1) may have more information after failed mount system call.';

// Sur une machine au stockage décrit (stockage.ts), un système de fichiers qu'on peut monter.
function periphStockage(jeu: Shell, source: string): (Peripherique & { nom: string }) | null {
  const st = stockage(jeu);
  if (!st) return null;
  const dev = resoudreSource(st, source);
  const fs = dev ? systemeDe(st, dev) : null;
  if (!dev || !fs?.arbre) return null;
  return { nom: dev, disque: dev, majmin: [8, 0], amovible: false, taille: fs.octets ?? 0, systeme: fs.type, etiquette: fs.label, uuid: fs.uuid, arbre: fs.arbre };
}

// mount -a : tout ce que décrit /etc/fstab (sauf noauto), et qui n'est pas déjà monté.
function monterTout(jeu: Shell): string {
  if (jeu.qui !== 'root') return jeu.erreur('mount: only root can use "--all" option');
  const texte = jeu.lire('/etc/fstab') ?? '';
  const { entrees, erreurs } = lireFstab(texte);
  for (const n of erreurs) jeu.erreur(`mount: /etc/fstab: parse error at line ${n} -- ignored`);
  const st = stockage(jeu);
  for (const e of entrees) {
    if (e.type === 'swap' || e.options.includes('noauto') || montages(jeu).some((m) => m.chemin === e.cible)) continue;
    const dev = st ? resoudreSource(st, e.source) : null;
    if (!dev || !st || !systemeDe(st, dev)) {
      // nofail : un support absent n'est pas une erreur.
      if (!e.options.includes('nofail')) jeu.erreur(`mount: ${e.cible}: special device ${e.source} does not exist.${DMESG}`, 32);
      continue;
    }
    if (montages(jeu).some((m) => m.nom === dev)) continue;
    const r = brancher(jeu, e.source, e.cible, e.options.join(','));
    if (r) jeu.erreur(r, 32);
  }
  // util-linux prévient quand fstab a changé depuis que systemd l'a lue.
  if (jeu.etat.fstabLue !== undefined && jeu.etat.fstabLue !== texte)
    jeu.erreur("mount: (hint) your fstab has been modified, but systemd still uses\n       the old version; use 'systemctl daemon-reload' to reload.");
  return '';
}

/** Monte une source sur un point (renvoie le message d'erreur de mount, ou ''). */
function brancher(jeu: Shell, source: string, point: string, options: string): string {
  const absolu = jeu.resoudre(point);
  const p = peripheriques(jeu)[source] ? { ...peripheriques(jeu)[source], nom: source } : periphStockage(jeu, source);
  if (!p) return `mount: ${absolu}: special device ${source} does not exist.${DMESG}`;
  const lieu = jeu.trouver(absolu);
  if (lieu?.type !== 'dossier') return `mount: ${absolu}: mount point does not exist.${DMESG}`;
  const deja = montages(jeu).find((m) => m.nom === p.nom);
  if (deja) return `mount: ${absolu}: ${p.nom} already mounted on ${deja.chemin}.${DMESG}`;
  const lectureSeule = options.split(',').includes('ro');
  const cache = { enfants: lieu.enfants, proprio: lieu.proprio, groupe: lieu.groupe, mode: lieu.mode };
  lieu.enfants = p.arbre.enfants;
  lieu.proprio = p.arbre.proprio;
  lieu.groupe = p.arbre.groupe;
  lieu.mode = p.arbre.mode;
  montages(jeu).push({ chemin: absolu, capacite: p.taille, nom: p.nom, systeme: p.systeme, lectureSeule, cache });
  return '';
}

/** Au démarrage : monte ce que décrit fstab et qui peut l'être (le reste a été vérifié avant). */
export function monterAuDemarrage(jeu: Shell): void {
  const avant = jeu.qui;
  jeu.qui = 'root';
  try {
    monterTout(jeu);
    jeu.recupererErreurs();
  } finally {
    jeu.qui = avant;
  }
}

function monter(jeu: Shell, args: string[]): string {
  if (!args.length)
    return montages(jeu)
      .map((m) => `${m.nom} on ${m.chemin} type ${m.systeme ?? 'ext4'} (${m.lectureSeule ? 'ro' : 'rw'},${m.options ?? 'relatime'})`)
      .join('\n');
  let options = '';
  const positionnels: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-o') options = args[++i] ?? '';
    else if (args[i] === '-t') i++;
    else if (args[i].startsWith('-o')) options = args[i].slice(2);
    else if (args[i] === '-a' || args[i] === '--all') return monterTout(jeu);
    else if (!args[i].startsWith('-')) positionnels.push(args[i]);
  }
  // Un seul argument : le point de montage (ou la source) d'une ligne de fstab.
  if (positionnels.length === 1) {
    const seul = positionnels[0];
    const e = lireFstab(jeu.lire('/etc/fstab') ?? '').entrees.find((x) => x.cible === jeu.resoudre(seul) || x.source === seul);
    if (!e) return jeu.erreur(`mount: ${seul}: can't find in /etc/fstab.`);
    positionnels.push(e.cible);
    positionnels[0] = e.source;
    options ||= e.options.join(',');
  }
  const [source, point] = positionnels;
  if (!source || !point) return jeu.erreur(jeu.t('mount-usage'));
  const absolu = jeu.resoudre(point);
  if (jeu.qui !== 'root')
    return jeu.erreur(`mount: ${absolu}: must be superuser to use mount.\n       dmesg(1) may have more information after failed mount system call.`);
  if (!peripheriques(jeu)[source] && stockage(jeu)) {
    const r = brancher(jeu, source, point, options);
    return r ? jeu.erreur(r, 32) : '';
  }
  const p = peripheriques(jeu)[source];
  if (!p)
    return jeu.erreur(
      `mount: ${absolu}: special device ${source} does not exist.\n       dmesg(1) may have more information after failed mount system call.`,
    );
  const lieu = jeu.trouver(absolu);
  if (lieu?.type !== 'dossier')
    return jeu.erreur(`mount: ${absolu}: mount point does not exist.\n       dmesg(1) may have more information after failed mount system call.`);
  const deja = montages(jeu).find((m) => m.nom === source);
  if (deja)
    return jeu.erreur(
      `mount: ${absolu}: ${source} already mounted on ${deja.chemin}.\n       dmesg(1) may have more information after failed mount system call.`,
    );
  const lectureSeule = options.split(',').includes('ro');
  // Le contenu du dossier est caché (pas effacé) tant que le périphérique y est monté.
  const cache = { enfants: lieu.enfants, proprio: lieu.proprio, groupe: lieu.groupe, mode: lieu.mode };
  lieu.enfants = p.arbre.enfants;
  lieu.proprio = p.arbre.proprio;
  lieu.groupe = p.arbre.groupe;
  lieu.mode = p.arbre.mode;
  montages(jeu).push({ chemin: absolu, capacite: p.taille, nom: source, systeme: p.systeme, lectureSeule, cache });
  return '';
}

function demonter(jeu: Shell, args: string[]): string {
  const cible = args.find((a) => !a.startsWith('-'));
  if (!cible) return jeu.erreur(jeu.t('umount-usage'));
  const m = montages(jeu).find((x) => x.nom === cible || x.chemin === jeu.resoudre(cible));
  const affiche = m?.chemin ?? jeu.resoudre(cible);
  if (jeu.qui !== 'root') return jeu.erreur(`umount: ${affiche}: must be superuser to unmount.`);
  if (!m || !m.cache) return jeu.erreur(`umount: ${affiche}: not mounted.`);
  // On ne démonte pas un lieu où l'on se trouve (comme un processus qui y travaille).
  if (jeu.cwd === m.chemin || jeu.cwd.startsWith(m.chemin + '/')) return jeu.erreur(`umount: ${m.chemin}: target is busy.`);
  const lieu = jeu.trouver(m.chemin) as Dossier;
  const p = peripheriques(jeu)[m.nom];
  if (p) p.arbre.enfants = lieu.enfants;
  const fs = stockage(jeu) ? systemeDe(stockage(jeu)!, m.nom) : null;
  if (fs?.arbre) fs.arbre.enfants = lieu.enfants;
  Object.assign(lieu, { enfants: m.cache.enfants, proprio: m.cache.proprio, groupe: m.cache.groupe, mode: m.cache.mode });
  jeu.etat.montages = montages(jeu).filter((x) => x !== m);
  return '';
}

export const DISQUES: Record<string, Commande> = {
  lsblk: { options: ['f'], lancer: ({ args, jeu }) => lsblk(jeu, args) },
  mount: { section: 8, propresOptions: true, lancer: ({ args, jeu }) => monter(jeu, args) },
  umount: { section: 8, propresOptions: true, lancer: ({ args, jeu }) => demonter(jeu, args) },
};
