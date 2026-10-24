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
// Écarts : pas de /etc/fstab, ni d'options autres que ro/rw ; un seul type
// de système de fichiers par périphérique.

import type { Dossier, Noeud } from '../monde';
import type { Shell } from '../shell';
import type { Commande } from './index';
import { stockage } from '../stockage';
import { lsblkStockage } from './stockage';

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
    else if (!args[i].startsWith('-')) positionnels.push(args[i]);
  }
  const [source, point] = positionnels;
  if (!source || !point) return jeu.erreur(jeu.t('mount-usage'));
  const absolu = jeu.resoudre(point);
  if (jeu.qui !== 'root')
    return jeu.erreur(`mount: ${absolu}: must be superuser to use mount.\n       dmesg(1) may have more information after failed mount system call.`);
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
  Object.assign(lieu, { enfants: m.cache.enfants, proprio: m.cache.proprio, groupe: m.cache.groupe, mode: m.cache.mode });
  jeu.etat.montages = montages(jeu).filter((x) => x !== m);
  return '';
}

export const DISQUES: Record<string, Commande> = {
  lsblk: { options: ['f'], lancer: ({ args, jeu }) => lsblk(jeu, args) },
  mount: { section: 8, propresOptions: true, lancer: ({ args, jeu }) => monter(jeu, args) },
  umount: { section: 8, propresOptions: true, lancer: ({ args, jeu }) => demonter(jeu, args) },
};
