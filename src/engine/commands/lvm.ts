// LVM (lvm2 2.03, Debian 13) : pvs, vgs, lvs pour voir ; pvcreate,
// vgextend, vgreduce, pvmove et lvextend pour agrandir ; resize2fs
// (e2fsprogs 1.47) pour le système de fichiers ; update-initramfs pour que
// le démarrage connaisse les grappes (mdadm.conf). Sorties et messages
// d'après lvm(8), lvextend(8), pvmove(8), resize2fs(8) et
// update-initramfs(8) : https://man7.org/linux/man-pages/man8/lvm.8.html,
// https://man7.org/linux/man-pages/man8/resize2fs.8.html,
// https://manpages.debian.org/trixie/initramfs-tools-core/update-initramfs.8.en.html
// Écarts : voir docs/SCENARIOS.md (LVM).

import type { Shell } from '../shell';
import type { Commande } from './index';
import { aide } from './manual';
import { grappeDe, majDev, partitionDe, stockage, type Stockage } from '../storage';
import {
  allouer,
  ETENDUE,
  etenduesLv,
  etenduesPv,
  libresSur,
  libresVg,
  lireLv,
  lvm,
  majMontages,
  prisesSur,
  pvsDe,
  tailleDe,
  tailleLv,
  tailleLvm,
  totalVg,
} from '../lvm';

const sansDev = (nom: string) => nom.replace(/^\/dev\//, '');
const NOYAU = '6.12.48+deb13-amd64';

// Sans être root, LVM ne peut pas prendre son verrou.
const pasRoot = (jeu: Shell) =>
  jeu.erreur('  WARNING: Running as a non-root user. Functionality may be unavailable.\n  /run/lock/lvm/P_global:aux: open failed: Permission denied', 5);

const tableau = (entetes: string[], lignes: string[][], droite: number[]) => {
  const largeurs = entetes.map((e, i) => Math.max(e.length, ...lignes.map((l) => l[i].length)));
  const ligne = (l: string[]) => '  ' + l.map((v, i) => (droite.includes(i) ? v.padStart(largeurs[i]) : v.padEnd(largeurs[i]))).join(' ');
  return [ligne(entetes), ...lignes.map(ligne)].join('\n');
};

function pvs(jeu: Shell, st: Stockage): string {
  const l = lvm(st);
  return tableau(
    ['PV', 'VG', 'Fmt', 'Attr', 'PSize', 'PFree'],
    Object.keys(l.pvs)
      .sort()
      .map((pv) => [`/dev/${pv}`, l.pvs[pv].vg ?? '', 'lvm2', l.pvs[pv].vg ? 'a--' : '---', tailleLvm(etenduesPv(st, pv) * ETENDUE), tailleLvm(libresSur(st, pv) * ETENDUE)]),
    [4, 5],
  );
}

function vgs(st: Stockage): string {
  const l = lvm(st);
  return tableau(
    ['VG', '#PV', '#LV', '#SN', 'Attr', 'VSize', 'VFree'],
    Object.keys(l.vgs).map((vg) => [
      vg,
      String(pvsDe(st, vg).length),
      String(Object.keys(l.vgs[vg].lvs).length),
      '0',
      'wz--n-',
      tailleLvm(totalVg(st, vg) * ETENDUE),
      tailleLvm(libresVg(st, vg) * ETENDUE),
    ]),
    [1, 2, 3, 5, 6],
  );
}

function lvs(st: Stockage): string {
  const l = lvm(st);
  return tableau(
    ['LV', 'VG', 'Attr', 'LSize', 'Pool', 'Origin', 'Data%', 'Meta%', 'Move', 'Log', 'Cpy%Sync', 'Convert'],
    Object.entries(l.vgs).flatMap(([vg, g]) =>
      Object.entries(g.lvs).map(([n, lv]) => [n, vg, lv.point ? '-wi-ao----' : '-wi-a-----', tailleLvm(tailleLv(lv)), '', '', '', '', '', '', '', '']),
    ),
    [3],
  ).replace(/ +$/gm, '');
}

/** Un périphérique qu'on peut donner à LVM : il existe, et rien d'autre ne le tient. */
function utilisable(jeu: Shell, st: Stockage, chemin: string): string | null {
  const n = sansDev(chemin);
  if (tailleDe(st, n) === null || !chemin.startsWith('/dev/')) return jeu.erreur(`  No device found for ${chemin}.`, 5), null;
  const p = partitionDe(st, n);
  if (grappeDe(st, n) || (p && grappeDe(st, p.disque))) return jeu.erreur(`  Cannot use ${chemin}: device is an md component`, 5), null;
  if (st.disques[n]?.table) return jeu.erreur(`  Cannot use ${chemin}: device is partitioned`, 5), null;
  return n;
}

function pvcreate(jeu: Shell, st: Stockage, cibles: string[]): string {
  if (!cibles.length) return jeu.erreur('  Please enter a physical volume path.\n  Run `pvcreate --help\' for more information.', 3);
  const sorties: string[] = [];
  for (const c of cibles) {
    const pv = lvm(st).pvs[sansDev(c)];
    if (pv?.vg) {
      jeu.erreur(`  Can't initialize physical volume "${c}" of volume group "${pv.vg}" without -ff\n  ${c}: physical volume not initialized.`, 5);
      continue;
    }
    const n = utilisable(jeu, st, c);
    if (!n) continue;
    lvm(st).pvs[n] ??= { vg: null, uuid: uuidLvm(`pv-${n}`) };
    sorties.push(`  Physical volume "${c}" successfully created.`);
  }
  majDev(jeu);
  return sorties.join('\n');
}

// Les UUID de LVM : 32 caractères en groupes 6-4-4-4-4-4-6, tirés d'un nom.
function uuidLvm(graine: string): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let h = 0x811c9dc5;
  let s = '';
  for (let i = 0; s.length < 32; i++) {
    h = Math.imul(h ^ graine.charCodeAt(i % graine.length) ^ i, 0x01000193) >>> 0;
    s += alphabet[h % alphabet.length];
  }
  return [6, 4, 4, 4, 4, 4, 6].reduce<[string[], number]>(([g, k], n) => [[...g, s.slice(k, k + n)], k + n], [[], 0])[0].join('-');
}

function pvremove(jeu: Shell, st: Stockage, cibles: string[]): string {
  if (!cibles.length) return jeu.erreur('  Please enter a physical volume path\n  Run `pvremove --help\' for more information.', 3);
  const sorties: string[] = [];
  for (const c of cibles) {
    const n = sansDev(c);
    const pv = lvm(st).pvs[n];
    if (!pv) {
      jeu.erreur(`  No PV found on device ${c}.`, 5);
      continue;
    }
    if (pv.vg) {
      jeu.erreur(`  PV ${c} is used by VG ${pv.vg} so please use vgreduce first.\n  (If you are certain you need pvremove, then confirm by using --force twice.)`, 5);
      continue;
    }
    delete lvm(st).pvs[n];
    sorties.push(`  Labels on physical volume "${c}" successfully wiped.`);
  }
  return sorties.join('\n');
}

function vgextend(jeu: Shell, st: Stockage, args: string[]): string {
  const [vg, ...cibles] = args;
  if (!vg) return jeu.erreur('  Please enter volume group name and physical volume(s)\n  Run `vgextend --help\' for more information.', 3);
  if (!lvm(st).vgs[vg]) return jeu.erreur(`  Volume group "${vg}" not found\n  Cannot process volume group ${vg}`, 5);
  if (!cibles.length) return jeu.erreur('  Please enter volume group name and physical volume(s)\n  Run `vgextend --help\' for more information.', 3);
  const sorties: string[] = [];
  for (const c of cibles) {
    const pv = lvm(st).pvs[sansDev(c)];
    if (pv?.vg) return jeu.erreur(`  Physical volume '${c}' is already in volume group '${pv.vg}'\n  Unable to add physical volume '${c}' to volume group '${vg}'\n  ${c}: physical volume not initialized.`, 5);
    if (!pv) {
      // vgextend initialise lui-même un périphérique qui n'est pas encore un PV.
      const n = utilisable(jeu, st, c);
      if (!n) return '';
      lvm(st).pvs[n] = { vg: null, uuid: uuidLvm(`pv-${n}`) };
      sorties.push(`  Physical volume "${c}" successfully created.`);
    }
  }
  for (const c of cibles) lvm(st).pvs[sansDev(c)].vg = vg;
  majDev(jeu);
  return [...sorties, `  Volume group "${vg}" successfully extended`].join('\n');
}

function vgreduce(jeu: Shell, st: Stockage, args: string[]): string {
  const [vg, ...cibles] = args;
  if (!vg || !cibles.length) return jeu.erreur('  Please give volume group name and physical volume paths\n  Run `vgreduce --help\' for more information.', 3);
  if (!lvm(st).vgs[vg]) return jeu.erreur(`  Volume group "${vg}" not found\n  Cannot process volume group ${vg}`, 5);
  const sorties: string[] = [];
  for (const c of cibles) {
    const n = sansDev(c);
    if (lvm(st).pvs[n]?.vg !== vg) {
      jeu.erreur(`  Physical Volume "${c}" not found in Volume Group "${vg}".`, 5);
      continue;
    }
    if (prisesSur(st, n) > 0) {
      jeu.erreur(`  Physical volume "${c}" still in use`, 5);
      continue;
    }
    if (pvsDe(st, vg).length === 1) {
      jeu.erreur(`  Can't remove final physical volume "${c}" from volume group "${vg}"`, 5);
      continue;
    }
    lvm(st).pvs[n].vg = null;
    sorties.push(`  Removed "${c}" from volume group "${vg}"`);
  }
  return sorties.join('\n');
}

function pvmove(jeu: Shell, st: Stockage, args: string[]): string {
  const [source, ...dest] = args.filter((a) => !a.startsWith('-'));
  if (!source) return jeu.erreur('  Please enter source physical volume.\n  Run `pvmove --help\' for more information.', 3);
  const n = sansDev(source);
  const vg = lvm(st).pvs[n]?.vg;
  if (!vg) return jeu.erreur(`  Physical volume ${source} not in a volume group.`, 5);
  const a = prisesSur(st, n);
  if (!a) return jeu.erreur(`  No data to move for ${vg}.`, 5);
  const cibles = dest.length ? dest.map(sansDev) : pvsDe(st, vg).filter((p) => p !== n);
  for (const c of cibles) if (lvm(st).pvs[c]?.vg !== vg) return jeu.erreur(`  Physical Volume "/dev/${c}" not found in Volume Group "${vg}".`, 5);
  const place = cibles.reduce((t, c) => t + libresSur(st, c), 0);
  if (place < a) return jeu.erreur(`  Insufficient free space: ${a} extents needed, but only ${place} available\n  Unable to allocate mirror extents for ${vg}/pvmove0.\n  Failed to convert pvmove LV to mirrored.`, 5);
  // Chaque morceau posé sur la source part sur les destinations.
  for (const lv of Object.values(lvm(st).vgs[vg].lvs)) {
    const sur = lv.segments.filter((s) => s.pv === n).reduce((t, s) => t + s.etendues, 0);
    if (!sur) continue;
    lv.segments = lv.segments.filter((s) => s.pv !== n);
    allouer(st, lv, sur, cibles);
  }
  return [25, 50, 75, 100].map((p) => `  ${source}: Moved: ${p.toFixed(2)}%`).join('\n');
}

// « +1.5T », « 500G », « +100%FREE » : la taille voulue, en étendues, ou une erreur.
function tailleVoulue(st: Stockage, vg: string, actuelles: number, l: string | null, L: string | null): number | string {
  if (L !== null) {
    const m = /^(\+?)(\d+(?:\.\d+)?)([bkmgtpBKMGTP]?)$/.exec(L);
    if (!m) return `  Invalid argument for --size: ${L}`;
    const facteur = { b: 1, k: 1024, m: 1024 ** 2, g: 1024 ** 3, t: 1024 ** 4, p: 1024 ** 5 }[(m[3] || 'm').toLowerCase() as 'b']!;
    const n = Math.ceil((Number(m[2]) * facteur) / ETENDUE);
    return m[1] ? actuelles + n : n;
  }
  const m = /^(\+?)(\d+)(%FREE|%VG)?$/.exec(l ?? '');
  if (!m) return `  Invalid argument for --extents: ${l}`;
  const n = m[3] === '%FREE' ? Math.floor((libresVg(st, vg) * Number(m[2])) / 100) : m[3] === '%VG' ? Math.floor((totalVg(st, vg) * Number(m[2])) / 100) : Number(m[2]);
  return m[1] ? actuelles + n : n;
}

function lvextend(jeu: Shell, st: Stockage, args: string[]): string {
  let L: string | null = null;
  let l: string | null = null;
  let fs = false;
  const positionnels: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-L' || a === '--size') L = args[++i] ?? '';
    else if (a.startsWith('-L')) L = a.slice(2);
    else if (a.startsWith('--size=')) L = a.slice(7);
    else if (a === '-l' || a === '--extents') l = args[++i] ?? '';
    else if (a.startsWith('-l')) l = a.slice(2);
    else if (a.startsWith('--extents=')) l = a.slice(10);
    else if (a === '-r' || a === '--resizefs') fs = true;
    else if (a.startsWith('-')) return jeu.erreur(`lvextend: unrecognized option '${a}'\n  Error during parsing of command line.`, 3);
    else positionnels.push(a);
  }
  const [cible, ...pvsPermis] = positionnels;
  if (!cible) return jeu.erreur('  Please specify a logical volume path.\n  Run `lvextend --help\' for more information.', 3);
  if (L === null && l === null) return jeu.erreur('  Please specify either size or extents but not both.\n  Run `lvextend --help\' for more information.', 3);
  const qui = lireLv(st, cible);
  if (!qui) return jeu.erreur(`  Failed to find logical volume "${sansDev(cible)}"`, 5);
  const [vg, nom] = qui;
  const lv = lvm(st).vgs[vg].lvs[nom];
  const avant = etenduesLv(lv);
  const voulues = tailleVoulue(st, vg, avant, l, L);
  if (typeof voulues === 'string') return jeu.erreur(voulues, 3);
  if (voulues === avant) return jeu.erreur(`  New size (${avant} extents) matches existing size (${avant} extents).`, 5);
  if (voulues < avant) return jeu.erreur(`  New size given (${voulues} extents) not larger than existing size (${avant} extents)`, 5);
  const permis = pvsPermis.length ? pvsPermis.map(sansDev) : pvsDe(st, vg);
  const libres = permis.reduce((t, p) => t + Math.max(0, libresSur(st, p)), 0);
  if (voulues - avant > libres) return jeu.erreur(`  Insufficient free space: ${voulues - avant} extents needed, but only ${libres} available`, 5);
  allouer(st, lv, voulues - avant, permis);
  const sorties = [`  Size of logical volume ${vg}/${nom} changed from ${tailleLvm(avant * ETENDUE, true)} (${avant} extents) to ${tailleLvm(voulues * ETENDUE, true)} (${voulues} extents).`];
  if (fs) {
    sorties.push(
      `  File system ext4 found on ${vg}/${nom}${lv.point ? ` mounted at ${lv.point}` : ''}.`,
      `  Extending file system ext4 to ${tailleLvm(tailleLv(lv), true)} (${tailleLv(lv)} bytes) on ${vg}/${nom}...`,
      ...agrandirFs(st, vg, nom),
      `  Extended file system ext4 on ${vg}/${nom}.`,
    );
    majMontages(jeu, st);
  }
  sorties.push(`  Logical volume ${vg}/${nom} successfully resized.`);
  return sorties.join('\n');
}

const ENTETE_E2FS = 'resize2fs 1.47.2 (1-Jan-2025)';
// Les groupes de blocs d'ext4 (32 768 blocs de 4 Kio) et leurs descripteurs (64 par bloc).
const descripteurs = (octets: number) => Math.ceil(Math.ceil(octets / 4096 / 32_768) / 64);

/** Le système de fichiers prend toute la place du LV ; renvoie ce qu'écrit resize2fs. */
function agrandirFs(st: Stockage, vg: string, nom: string): string[] {
  const lv = lvm(st).vgs[vg].lvs[nom];
  const avant = lv.fs;
  lv.fs = tailleLv(lv);
  return [
    ENTETE_E2FS,
    ...(lv.point ? [`Filesystem at /dev/mapper/${vg}-${nom} is mounted on ${lv.point}; on-line resizing required`] : []),
    `old_desc_blocks = ${descripteurs(avant)}, new_desc_blocks = ${descripteurs(lv.fs)}`,
    `The filesystem on /dev/mapper/${vg}-${nom} is now ${lv.fs / 4096} (4k) blocks long.`,
    '',
  ];
}

function resize2fs(jeu: Shell, st: Stockage | null, args: string[]): string {
  const cible = args.find((a) => !a.startsWith('-'));
  if (!cible) return jeu.erreur(`Usage: resize2fs [-d debug_flags] [-f] [-F] [-M] [-P] [-p] device [-b|-s|new_size] [-S RAID-stride] [-z undo_file]\n`, 1);
  if (jeu.qui !== 'root') return jeu.erreur(`${ENTETE_E2FS}\nresize2fs: Permission denied while trying to open ${cible}\nCouldn't find valid filesystem superblock.`, 1);
  const qui = st ? lireLv(st, cible) : null;
  if (!st || !qui) return jeu.erreur(`${ENTETE_E2FS}\nresize2fs: No such file or directory while trying to open ${cible}\nCouldn't find valid filesystem superblock.`, 1);
  const lv = lvm(st).vgs[qui[0]].lvs[qui[1]];
  if (lv.fs >= tailleLv(lv)) return `${ENTETE_E2FS}\nThe filesystem is already ${lv.fs / 4096} (4k) blocks long.  Nothing to do!\n`;
  const sortie = agrandirFs(st, qui[0], qui[1]).join('\n');
  majMontages(jeu, st);
  return sortie;
}

function updateInitramfs(jeu: Shell, args: string[]): string {
  if (!args.includes('-u') && !args.includes('-c')) return jeu.erreur(jeu.t('update-initramfs-usage'), 1);
  if (jeu.qui !== 'root') return jeu.erreur(`update-initramfs: Generating /boot/initrd.img-${NOYAU}\ncp: cannot create regular file '/boot/initrd.img-${NOYAU}.new': Permission denied`, 1);
  // L'initramfs emporte la configuration de mdadm telle qu'elle est maintenant.
  jeu.etat.initramfs = { mdadm: jeu.lire('/etc/mdadm/mdadm.conf') ?? '' };
  return `update-initramfs: Generating /boot/initrd.img-${NOYAU}`;
}

// Les commandes de LVM : root d'abord, puis un modèle de stockage.
const avecLvm =
  (f: (jeu: Shell, st: Stockage, args: string[]) => string, nom: string) =>
  ({ args, jeu }: { args: string[]; jeu: Shell }) => {
    if (args.includes('-h') || args.includes('--help')) return aide(nom, LVM[nom], jeu.t);
    if (jeu.qui !== 'root') return pasRoot(jeu);
    const st = stockage(jeu);
    if (!st) return jeu.erreur('  No volume groups found.', 5);
    return f(jeu, st, args);
  };

export const LVM: Record<string, Commande> = {
  pvs: { section: 8, propresOptions: true, lancer: avecLvm((jeu, st) => pvs(jeu, st), 'pvs') },
  vgs: { section: 8, propresOptions: true, lancer: avecLvm((_, st) => vgs(st), 'vgs') },
  lvs: { section: 8, propresOptions: true, lancer: avecLvm((_, st) => lvs(st), 'lvs') },
  pvcreate: { section: 8, propresOptions: true, lancer: avecLvm((jeu, st, args) => pvcreate(jeu, st, args.filter((a) => !a.startsWith('-'))), 'pvcreate') },
  vgextend: { section: 8, propresOptions: true, lancer: avecLvm((jeu, st, args) => vgextend(jeu, st, args.filter((a) => !a.startsWith('-'))), 'vgextend') },
  pvremove: { section: 8, propresOptions: true, lancer: avecLvm((jeu, st, args) => pvremove(jeu, st, args.filter((a) => !a.startsWith('-'))), 'pvremove') },
  vgreduce: { section: 8, propresOptions: true, lancer: avecLvm((jeu, st, args) => vgreduce(jeu, st, args.filter((a) => !a.startsWith('-'))), 'vgreduce') },
  pvmove: { section: 8, propresOptions: true, lancer: avecLvm((jeu, st, args) => pvmove(jeu, st, args), 'pvmove') },
  lvextend: { section: 8, propresOptions: true, lancer: avecLvm((jeu, st, args) => lvextend(jeu, st, args), 'lvextend') },
  resize2fs: {
    section: 8,
    propresOptions: true,
    lancer: ({ args, jeu }) => (args.includes('--help') ? aide('resize2fs', LVM.resize2fs, jeu.t) : resize2fs(jeu, stockage(jeu), args)),
  },
  'update-initramfs': {
    section: 8,
    propresOptions: true,
    lancer: ({ args, jeu }) => (args.includes('-h') || args.includes('--help') ? aide('update-initramfs', LVM['update-initramfs'], jeu.t) : updateInitramfs(jeu, args)),
  },
};
