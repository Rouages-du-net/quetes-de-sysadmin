// blkid et findmnt (util-linux 2.40) : qui est qui parmi les disques (UUID,
// étiquette, type), ce qui est monté, et la vérification de /etc/fstab
// (findmnt --verify), à faire avant tout redémarrage. D'après blkid(8) et
// findmnt(8) : https://man7.org/linux/man-pages/man8/blkid.8.html,
// https://man7.org/linux/man-pages/man8/findmnt.8.html
// Écarts : voir docs/SCENARIOS.md (blkid, findmnt).

import type { Shell } from '../shell';
import type { Commande } from './index';
import { aide } from './manual';
import { grappeDe, stockage, type Stockage } from '../storage';
import { lvm } from '../lvm';
import { lireFstab, resoudreSource, systemeDe } from '../fstab';

// Ce que blkid sait d'un périphérique : son système de fichiers, ou ce qu'il est (membre RAID, PV).
function attributs(st: Stockage, dev: string): string | null {
  const n = dev.replace(/^\/dev\//, '');
  const fs = systemeDe(st, dev);
  const champs: string[] = [];
  if (fs) {
    if (fs.label) champs.push(`LABEL="${fs.label}"`);
    champs.push(`UUID="${fs.uuid}"`, 'BLOCK_SIZE="4096"', `TYPE="${fs.type}"`);
  } else if (grappeDe(st, n)) {
    const [, g] = grappeDe(st, n)!;
    champs.push(`UUID="${g.uuid}"`, `LABEL="${g.nom}"`, 'TYPE="linux_raid_member"');
  } else if (lvm(st).pvs[n]) champs.push(`UUID="${lvm(st).pvs[n].uuid}"`, 'TYPE="LVM2_member"');
  const p = /^(sd[a-z])(\d+)$/.exec(n);
  const part = p ? st.disques[p[1]]?.partitions.find((x) => x.numero === Number(p[2])) : undefined;
  if (part) champs.push(`PARTUUID="${part.uuid.toLowerCase()}"`);
  return champs.length ? `${dev}: ${champs.join(' ')}` : null;
}

// Tous les périphériques, dans l'ordre où blkid les trouve : disques et partitions, grappes, volumes logiques.
function tous(st: Stockage): string[] {
  const disques = Object.entries(st.disques)
    .sort(([, a], [, b]) => a.rang - b.rang)
    .flatMap(([n, d]) => [`/dev/${n}`, ...d.partitions.map((p) => `/dev/${n}${p.numero}`)]);
  const grappes = Object.keys(st.grappes).map((n) => `/dev/${n}`);
  const lvs = Object.entries(lvm(st).vgs).flatMap(([vg, g]) => Object.keys(g.lvs).map((lv) => `/dev/mapper/${vg}-${lv}`));
  return [...disques, ...grappes, ...lvs];
}

function blkid(jeu: Shell, args: string[]): string {
  const st = stockage(jeu);
  if (!st) return jeu.erreur('', 2);
  const valeur = (o: string) => (args.includes(o) ? args[args.indexOf(o) + 1] : undefined);
  const uuid = valeur('-U');
  const label = valeur('-L');
  if (uuid !== undefined || label !== undefined) {
    const dev = resoudreSource(st, uuid !== undefined ? `UUID=${uuid}` : `LABEL=${label}`);
    if (!dev) return jeu.erreur('', 2);
    return dev;
  }
  const cibles = args.filter((a, i) => !a.startsWith('-') && !['-U', '-L'].includes(args[i - 1]));
  const lignes = (cibles.length ? cibles : tous(st)).map((d) => attributs(st, resoudreSource(st, d) ?? d));
  const trouves = lignes.filter((l): l is string => l !== null);
  // Rien trouvé : blkid ne dit rien, et répond 2.
  if (!trouves.length) return jeu.erreur('', 2);
  return trouves.join('\n');
}

const montages = (jeu: Shell): { chemin: string; nom: string; systeme?: string; lectureSeule?: boolean }[] => jeu.etat.montages ?? [];

function findmnt(jeu: Shell, args: string[]): string {
  if (args.includes('--verify') || args.includes('-x')) return verifier(jeu, args.includes('--verbose') || args.includes('-v'));
  const cible = args.find((a) => !a.startsWith('-'));
  const liste = [...montages(jeu)].sort((a, b) => a.chemin.localeCompare(b.chemin));
  const choisis = cible ? liste.filter((m) => m.chemin === jeu.resoudre(cible) || m.nom === cible) : liste;
  if (!choisis.length) {
    jeu.statut = 1;
    return '';
  }
  const options = (m: (typeof liste)[0]) => `${m.lectureSeule ? 'ro' : 'rw'},relatime${m.chemin === '/' ? ',errors=remount-ro' : ''}`;
  // L'arbre : chaque montage sous celui qui le contient.
  const profondeur = (m: (typeof liste)[0]) => (cible ? 0 : liste.filter((x) => x !== m && (x.chemin === '/' || m.chemin.startsWith(x.chemin + '/'))).length);
  const cibles = choisis.map((m) => `${profondeur(m) ? `${'  '.repeat(profondeur(m) - 1)}└─` : ''}${m.chemin}`);
  const largeurs = [Math.max(6, ...cibles.map((c) => c.length)), Math.max(6, ...choisis.map((m) => m.nom.length)), 6];
  const ligne = (a: string, b: string, c: string, d: string) => `${a.padEnd(largeurs[0])} ${b.padEnd(largeurs[1])} ${c.padEnd(largeurs[2])} ${d}`;
  return [ligne('TARGET', 'SOURCE', 'FSTYPE', 'OPTIONS'), ...choisis.map((m, i) => ligne(cibles[i], m.nom, m.systeme ?? 'ext4', options(m)))].join('\n');
}

// findmnt --verify : chaque ligne de fstab, ses sources, ses points de montage.
function verifier(jeu: Shell, bavard: boolean): string {
  const texte = jeu.lire('/etc/fstab') ?? '';
  const st = stockage(jeu);
  const { entrees, erreurs: lectures } = lireFstab(texte);
  const sorties: string[] = [];
  let erreurs = 0;
  let avertissements = 0;
  const vues = new Set<string>();
  for (const e of entrees) {
    const notes: string[] = [];
    const dev = st ? resoudreSource(st, e.source) : null;
    if (!dev) {
      erreurs++;
      notes.push(e.source.startsWith('/') ? `   [E] unreachable source: ${e.source}: No such file or directory` : `   [E] unreachable on-disk source: ${e.source} (no such device)`);
    } else if (bavard) notes.push(`   [ ] source ${e.source} found`);
    if (dev && st) {
      const fs = systemeDe(st, dev);
      if (fs && e.type !== 'auto' && fs.type !== e.type) {
        erreurs++;
        notes.push(`   [E] ${e.type} does not match with on-disk ${fs.type}`);
      }
    }
    const lieu = jeu.trouver(e.cible);
    if (e.type !== 'swap' && lieu?.type !== 'dossier') {
      avertissements++;
      notes.push(`   [W] target does not exist`);
    }
    if (vues.has(e.cible)) {
      avertissements++;
      notes.push(`   [W] target specified more than once`);
    }
    vues.add(e.cible);
    if (notes.length) sorties.push(e.cible, ...notes);
  }
  const total = erreurs + avertissements + lectures.length;
  if (erreurs) jeu.statut = 1;
  if (!total) return [...sorties, 'Success, no errors or warnings detected'].join('\n');
  const pluriel = (n: number, mot: string) => `${n} ${mot}${n === 1 ? '' : 's'}`;
  return [...sorties, '', `${pluriel(lectures.length, 'parse error')}, ${pluriel(erreurs, 'error')}, ${pluriel(avertissements, 'warning')}`].join('\n');
}

export const FSTAB: Record<string, Commande> = {
  // La page de manuel de /etc/fstab (section 5), pas une commande.
  fstab: { section: 5, lancer: () => '' },
  blkid: {
    section: 8,
    propresOptions: true,
    lancer: ({ args, jeu }) => (args.includes('-h') || args.includes('--help') ? aide('blkid', FSTAB.blkid, jeu.t) : blkid(jeu, args)),
  },
  findmnt: {
    section: 8,
    propresOptions: true,
    lancer: ({ args, jeu }) => (args.includes('-h') || args.includes('--help') ? aide('findmnt', FSTAB.findmnt, jeu.t) : findmnt(jeu, args)),
  },
};

