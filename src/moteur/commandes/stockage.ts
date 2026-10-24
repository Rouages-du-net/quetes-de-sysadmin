// Les disques d'un serveur : smartctl (smartmontools) pour leur santé,
// mdadm pour le RAID logiciel, sfdisk pour les tables de partitions,
// grub-install pour la zone de démarrage, et lsblk quand la machine a un
// modèle de stockage (voir stockage.ts). Sorties et messages d'après
// smartctl(8) (smartmontools 7.4), mdadm(8) (mdadm 4.3, Manage.c),
// sfdisk(8) (util-linux 2.40) et grub-install(8) (GRUB 2.12) :
// https://www.smartmontools.org/browser/trunk/smartmontools/smartctl.8.in,
// https://man7.org/linux/man-pages/man8/mdadm.8.html,
// https://man7.org/linux/man-pages/man8/sfdisk.8.html,
// https://www.gnu.org/software/grub/manual/grub/html_node/Installing-GRUB-using-grub_002dinstall.html
// Écarts : voir le tableau de docs/SCENARIOS.md (smartctl, mdadm, sfdisk).

import type { Shell } from '../shell';
import type { Commande } from './index';
import { aide } from './manuel';
import { systemd } from '../systemd';
import { tailleDe, tailleLv } from '../lvm';
import {
  actifs,
  avancer,
  degradee,
  disqueOccupe,
  enReconstruction,
  GUID_TYPE,
  grappeDe,
  majDev,
  majmin,
  NOM_TYPE,
  numeroLibre,
  partitionDe,
  placeLibre,
  reconstruitEnCeMoment,
  SECTEUR,
  stockage,
  tailleBinaire,
  tailleCourte,
  tailleDecimale,
  type Disque,
  type Grappe,
  type Partition,
  type Stockage,
  type TypePartition,
} from '../stockage';

const JOURS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MOIS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const deux = (n: number) => String(n).padStart(2, '0');
/** « Sat Nov 13 07:42:10 2027 », comme ctime(3). */
const dateC = (ms: number) => {
  const d = new Date(ms);
  return `${JOURS[d.getUTCDay()]} ${MOIS[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2)} ${deux(d.getUTCHours())}:${deux(d.getUTCMinutes())}:${deux(d.getUTCSeconds())} ${d.getUTCFullYear()}`;
};
const maintenant = (jeu: Shell) => systemd(jeu)?.horloge ?? Date.UTC(2027, 10, 13, 7, 42, 0);
const sansDev = (nom: string) => nom.replace(/^\/dev\//, '');

// ——— smartctl ———

const ENTETE_SMART = 'smartctl 7.4 2023-08-01 r5530 [x86_64-linux-6.12.48+deb13-amd64] (local build)\nCopyright (C) 2002-23, Bruce Allen, Christian Franke, www.smartmontools.org';

function informations(jeu: Shell, d: Disque): string {
  const octets = d.secteurs * SECTEUR;
  return [
    '=== START OF INFORMATION SECTION ===',
    `Device Model:     ${d.modele}`,
    `Serial Number:    ${d.serie}`,
    `Firmware Version: LB07`,
    `User Capacity:    ${octets.toLocaleString('en-US')} bytes [${(octets / 1e12).toFixed(2)} TB]`,
    'Sector Sizes:     512 bytes logical, 4096 bytes physical',
    'Rotation Rate:    7200 rpm',
    'Form Factor:      3.5 inches',
    'Device is:        Not in smartctl database 7.3/5528',
    'ATA Version is:   ACS-3 T13/2161-D revision 5',
    'SATA Version is:  SATA 3.3, 6.0 Gb/s (current: 6.0 Gb/s)',
    `Local Time is:    ${dateC(maintenant(jeu))} UTC`,
    'SMART support is: Available - device has SMART capability.',
    'SMART support is: Enabled',
  ].join('\n');
}

function attributs(d: Disque): string {
  const s = d.smart;
  // VALUE baisse quand les secteurs réalloués s'accumulent ; sous THRESH, l'attribut « échoue ».
  const realloc = Math.max(1, 200 - Math.ceil(s.realloues / 26));
  const ligne = (id: number, nom: string, flag: string, valeur: number, pire: number, seuil: number, type: string, maj: string, brut: number | string) =>
    `${String(id).padStart(3)} ${nom.padEnd(23)} ${flag}   ${String(valeur).padStart(3, '0')}   ${String(pire).padStart(3, '0')}   ${String(seuil).padStart(3, '0')}    ${type.padEnd(9)} ${maj.padEnd(8)} ${valeur <= seuil && seuil > 0 ? 'FAILING_NOW' : '    -      '} ${brut}`;
  return [
    'SMART Attributes Data Structure revision number: 16',
    'Vendor Specific SMART Attributes with Thresholds:',
    'ID# ATTRIBUTE_NAME          FLAG     VALUE WORST THRESH TYPE      UPDATED  WHEN_FAILED RAW_VALUE',
    ligne(1, 'Raw_Read_Error_Rate', '0x002f', s.enAttente ? 191 : 200, s.enAttente ? 186 : 200, 51, 'Pre-fail', 'Always', s.erreursAta * 59),
    ligne(3, 'Spin_Up_Time', '0x0027', 176, 174, 21, 'Pre-fail', 'Always', 4183),
    ligne(4, 'Start_Stop_Count', '0x0032', 100, 100, 0, 'Old_age', 'Always', 74),
    ligne(5, 'Reallocated_Sector_Ct', '0x0033', realloc, realloc, 140, 'Pre-fail', 'Always', s.realloues),
    ligne(9, 'Power_On_Hours', '0x0032', Math.max(0, 100 - Math.floor(s.heures / 876)), Math.max(0, 100 - Math.floor(s.heures / 876)), 0, 'Old_age', 'Always', s.heures),
    ligne(12, 'Power_Cycle_Count', '0x0032', 100, 100, 0, 'Old_age', 'Always', 71),
    ligne(194, 'Temperature_Celsius', '0x0022', 113 - s.temperature + 34, 104, 0, 'Old_age', 'Always', s.temperature),
    ligne(196, 'Reallocated_Event_Count', '0x0032', s.realloues ? 128 : 200, s.realloues ? 128 : 200, 0, 'Old_age', 'Always', Math.ceil(s.realloues / 16)),
    ligne(197, 'Current_Pending_Sector', '0x0032', 200, 200, 0, 'Old_age', 'Always', s.enAttente),
    ligne(198, 'Offline_Uncorrectable', '0x0030', s.illisibles ? 200 : 100, 253, 0, 'Old_age', 'Offline', s.illisibles),
    ligne(199, 'UDMA_CRC_Error_Count', '0x0032', 200, 200, 0, 'Old_age', 'Always', s.crc),
  ].join('\n');
}

function journalErreurs(d: Disque): string {
  const s = d.smart;
  if (!s.erreursAta) return 'SMART Error Log Version: 1\nNo Errors Logged';
  return [
    'SMART Error Log Version: 1',
    `ATA Error Count: ${s.erreursAta} (device log contains only the most recent five errors)`,
    '\tCR = Command Register [HEX]',
    '\tER = Error register [HEX]',
    '\tST = Status register [HEX]',
    '',
    `Error ${s.erreursAta} occurred at disk power-on lifetime: ${s.heures - 2} hours (${Math.floor((s.heures - 2) / 24)} days + ${(s.heures - 2) % 24} hours)`,
    '  When the command that caused the error occurred, the device was active or idle.',
    '',
    '  After command completion occurred, registers were:',
    '  ER ST SC SN CL CH DH',
    '  -- -- -- -- -- -- --',
    '  40 51 00 87 d6 12 e0  Error: UNC at LBA = 0x0012d687 = 1234567',
  ].join('\n');
}

function journalTests(d: Disque, tests: { type: string; heures: number }[]): string {
  const s = d.smart;
  const lignes = [
    'SMART Self-test log structure revision number 1',
    'Num  Test_Description    Status                  Remaining  LifeTime(hours)  LBA_of_first_error',
  ];
  const tous = [...tests].reverse().concat([{ type: 'Short offline', heures: s.heures - 168 }]);
  tous.forEach((t, i) => {
    const echec = s.enAttente > 0 && i === 0 && tests.length > 0;
    const statut = echec ? 'Completed: read failure       90%' : 'Completed without error       00%';
    lignes.push(`# ${String(i + 1).padEnd(2)} ${t.type.padEnd(19)} ${statut}     ${String(t.heures).padStart(5)}         ${echec ? '1234567' : '-'}`);
  });
  return lignes.join('\n');
}

const verdict = (d: Disque) => `SMART overall-health self-assessment test result: ${d.smart.echec ? 'FAILED!' : 'PASSED'}`;

function smartctl(jeu: Shell, args: string[]): string {
  const options = args.filter((a) => a.startsWith('-'));
  const cible = args.filter((a, i) => !a.startsWith('-') && !['-t', '-l', '--test', '--log'].includes(args[i - 1])).at(-1);
  const valeur = (courte: string, longue: string) => {
    const i = args.findIndex((a) => a === courte || a === longue);
    return i >= 0 ? args[i + 1] : args.find((a) => a.startsWith(`${longue}=`))?.split('=')[1];
  };
  const connues = ['-a', '--all', '-x', '--xall', '-H', '--health', '-i', '--info', '-A', '--attributes', '-l', '--log', '-t', '--test', '-h', '--help'];
  const inconnue = options.find((o) => !connues.includes(o.split('=')[0]));
  if (inconnue)
    return jeu.erreur(`${ENTETE_SMART}\n\n=======> UNRECOGNIZED OPTION: ${inconnue.replace(/^-+/, '')}\n=======> VALID ARGUMENTS ARE: help\n\nUse smartctl -h to get a usage summary`, 1);
  if (args.includes('-h') || args.includes('--help')) return aide('smartctl', STOCKAGE.smartctl, jeu.t);
  if (!cible) return jeu.erreur(`${ENTETE_SMART}\n\nERROR: smartctl requires a device name as the final command-line argument.\n\n\nUse smartctl -h to get a usage summary`, 1);
  const st = stockage(jeu);
  const nom = sansDev(cible).replace(/\d+$/, '');
  const d = st?.disques[nom];
  if (jeu.qui !== 'root') return jeu.erreur(`${ENTETE_SMART}\n\nSmartctl open device: ${cible} failed: Permission denied`, 2);
  if (!st || !d || !cible.startsWith('/dev/')) return jeu.erreur(`${ENTETE_SMART}\n\nSmartctl open device: ${cible} failed: No such device`, 2);
  const tests: { type: string; heures: number }[] = (jeu.etat.testsSmart ??= {})[nom] ?? [];
  const test = valeur('-t', '--test');
  if (test) {
    if (!['short', 'long'].includes(test))
      return jeu.erreur(`${ENTETE_SMART}\n\n=======> INVALID ARGUMENT TO -t: ${test}\n=======> VALID ARGUMENTS ARE: offline, short, long, conveyance, force, vendor,N, select,M-N, pending,N, afterselect,[on|off]\n\nUse smartctl -h to get a usage summary`, 1);
    const court = test === 'short';
    (jeu.etat.testsSmart[nom] = tests).push({ type: court ? 'Short offline' : 'Extended offline', heures: d.smart.heures });
    const nomTest = court ? 'Short' : 'Extended';
    const duree = court ? 2 : 254;
    return [
      ENTETE_SMART,
      '',
      '=== START OF OFFLINE IMMEDIATE AND SELF-TEST SECTION ===',
      `Sending command: "Execute SMART ${nomTest} self-test routine immediately in off-line mode".`,
      `Drive command "Execute SMART ${nomTest} self-test routine immediately in off-line mode" successful.`,
      'Testing has begun.',
      `Please wait ${duree} minutes for test to complete.`,
      `Test will complete after ${dateC(maintenant(jeu) + duree * 60_000)} UTC`,
      'Use smartctl -X to abort test.',
    ].join('\n');
  }
  // Le code de retour de smartctl est un masque : 64, le journal d'erreurs n'est pas vide ; 128, un test a échoué.
  const codes = (d.smart.erreursAta ? 64 : 0) | (d.smart.enAttente && tests.length ? 128 : 0) | (d.smart.echec ? 8 : 0);
  const journal = valeur('-l', '--log');
  const parties: string[] = [ENTETE_SMART, ''];
  const tout = options.some((o) => ['-a', '--all', '-x', '--xall'].includes(o));
  if (tout || options.some((o) => o === '-i' || o === '--info')) parties.push(informations(jeu, d), '');
  if (tout || options.some((o) => ['-H', '--health', '-A', '--attributes'].includes(o))) parties.push('=== START OF READ SMART DATA SECTION ===');
  if (tout || options.some((o) => o === '-H' || o === '--health')) parties.push(verdict(d), '');
  if (tout || options.some((o) => o === '-A' || o === '--attributes')) parties.push(attributs(d), '');
  if (tout || journal === 'error') parties.push(journalErreurs(d), '');
  if (tout || journal === 'selftest') parties.push(journalTests(d, tests), '');
  if (journal && !['error', 'selftest'].includes(journal))
    return jeu.erreur(`${ENTETE_SMART}\n\n=======> INVALID ARGUMENT TO -l: ${journal}\n=======> VALID ARGUMENTS ARE: error, selftest, selective, directory, background, scttemp, ...\n\nUse smartctl -h to get a usage summary`, 1);
  if (parties.length === 2) parties.push('=== START OF INFORMATION SECTION ===\nSMART support is: Available - device has SMART capability.', '');
  jeu.statut = codes;
  return parties.join('\n').trimEnd();
}

// ——— mdadm ———

const nomGrappe = (st: Stockage, cible: string) => {
  const n = sansDev(cible).replace(/^md\//, 'md');
  return st.grappes[n] ? n : null;
};
const ligneMembre = (st: Stockage, numero: number | string, part: string, role: number | string, etat: string) => {
  const [maj, min] = part ? majmin(st, part) : [0, 0];
  return `${String(numero).padStart(8)}${String(maj).padStart(8)}${String(min).padStart(9)}${String(role).padStart(9)}      ${etat}${part ? `   /dev/${part}` : ''}`;
};

function detail(jeu: Shell, st: Stockage, nom: string): string {
  const g = st.grappes[nom];
  const octets = g.blocs * 1024;
  const recons = enReconstruction(g);
  const enCours = reconstruitEnCeMoment(st) === nom;
  const etats = ['clean'];
  if (degradee(g)) etats.push('degraded');
  if (recons.length) etats.push(enCours ? 'recovering' : 'resyncing (DELAYED)');
  if (g.synchro !== undefined) etats.push(enCours ? 'resyncing' : 'resyncing (DELAYED)');
  const defectueux = g.membres.filter((m) => m.etat === 'defectueux');
  const rangees: string[] = [];
  for (let r = 0; r < g.voulus; r++) {
    const m = g.membres.find((x) => x.role === r && x.etat !== 'defectueux');
    if (!m) rangees.push(ligneMembre(st, '-', '', r, 'removed'));
    else rangees.push(ligneMembre(st, m.numero, m.part, r, m.etat === 'actif' ? 'active sync' : 'spare rebuilding'));
  }
  for (const m of g.membres.filter((x) => x.etat === 'spare')) rangees.push(ligneMembre(st, m.numero, m.part, '-', 'spare'));
  for (const m of defectueux) rangees.push(ligneMembre(st, m.numero, m.part, '-', 'faulty'));
  return [
    `/dev/${nom}:`,
    '           Version : 1.2',
    `     Creation Time : ${dateC(g.creation)}`,
    `        Raid Level : ${g.niveau}`,
    `        Array Size : ${g.blocs} (${tailleBinaire(octets)} ${tailleDecimale(octets)})`,
    `     Used Dev Size : ${g.blocs} (${tailleBinaire(octets)} ${tailleDecimale(octets)})`,
    `      Raid Devices : ${g.voulus}`,
    `     Total Devices : ${g.membres.length}`,
    '       Persistence : Superblock is persistent',
    '',
    ...(g.bitmap ? ['     Intent Bitmap : Internal', ''] : []),
    `       Update Time : ${dateC(maintenant(jeu))}`,
    `             State : ${etats.join(', ')} `,
    `    Active Devices : ${actifs(g).length}`,
    `   Working Devices : ${g.membres.length - defectueux.length}`,
    `    Failed Devices : ${defectueux.length}`,
    `     Spare Devices : ${recons.length + g.membres.filter((x) => x.etat === 'spare').length}`,
    '',
    `Consistency Policy : ${g.bitmap ? 'bitmap' : 'resync'}`,
    '',
    ...(recons.length && enCours ? [`    Rebuild Status : ${Math.floor((recons[0].copie ?? 0) * 100)}% complete`, ''] : []),
    ...(g.synchro !== undefined && enCours ? [`     Resync Status : ${Math.floor(g.synchro * 100)}% complete`, ''] : []),
    `              Name : ${g.nom}  (local to host ${systemd(jeu)?.hote ?? jeu.hote})`,
    `              UUID : ${g.uuid}`,
    `            Events : ${g.evenements}`,
    '',
    '    Number   Major   Minor   RaidDevice State',
    ...rangees,
  ].join('\n');
}

export const uuidMdadm = (uuid: string) => uuid.replace(/-/g, '').replace(/(.{8})(?=.)/g, '$1:');

function gerer(jeu: Shell, st: Stockage, nom: string, ops: [string, string[]][]): string {
  const g = st.grappes[nom];
  const sorties: string[] = [];
  const md = `/dev/${nom}`;
  for (const [op, cibles] of ops) {
    for (const cible of cibles) {
      const part = sansDev(cible);
      const m = g.membres.find((x) => x.part === part);
      if (op === 'fail') {
        if (!m) {
          jeu.erreur(`mdadm: set device faulty failed for ${cible}:  No such device`);
          continue;
        }
        // RAID 1 : le noyau refuse de marquer défectueux le dernier membre à jour.
        if (m.etat === 'actif' && actifs(g).length === 1) {
          jeu.erreur(`mdadm: set device faulty failed for ${cible}:  Device or resource busy`);
          continue;
        }
        m.etat = 'defectueux';
        delete m.copie;
        g.evenements += 1;
        sorties.push(`mdadm: set ${cible} faulty in ${md}`);
      } else if (op === 'remove') {
        const visees = cible === 'failed' ? g.membres.filter((x) => x.etat === 'defectueux') : m ? [m] : [];
        if (!visees.length) {
          if (cible !== 'failed') jeu.erreur(`mdadm: hot remove failed for ${cible}: No such device or address`);
          continue;
        }
        for (const v of visees) {
          // On ne retire qu'un membre défectueux (ou un spare) : un membre actif est occupé.
          if (v.etat === 'actif') {
            jeu.erreur(`mdadm: hot remove failed for /dev/${v.part}: Device or resource busy`);
            continue;
          }
          g.membres = g.membres.filter((x) => x !== v);
          g.evenements += 1;
          sorties.push(`mdadm: hot removed /dev/${v.part} from ${md}`);
        }
      } else {
        // add, re-add : la partition (ou le disque) doit exister, être libre, et assez grande.
        const disque = /^sd[a-z]$/.test(part) ? st.disques[part] : undefined;
        const p = partitionDe(st, part);
        if (!disque && !p) {
          jeu.erreur(`mdadm: Cannot find ${cible}: No such file or directory`);
          continue;
        }
        if (grappeDe(st, part) || st.lvm?.pvs[part] || (disque && disqueOccupe(st, part)) || (p && grappeDe(st, p.disque))) {
          jeu.erreur(`mdadm: Cannot open ${cible}: Device or resource busy`);
          continue;
        }
        const secteurs = disque ? disque.secteurs : p!.p.secteurs;
        if (secteurs / 2 < g.blocs) {
          jeu.erreur(`mdadm: ${cible} not large enough to join array`);
          continue;
        }
        const ancien = (jeu.etat.anciensMembres ??= {})[`${nom}:${part}`] as number | undefined;
        if (op === 're-add' && ancien === undefined) {
          jeu.erreur(`mdadm: --re-add for ${cible} to ${md} is not possible`);
          continue;
        }
        // Le disque entier dans la grappe : son superbloc md écrase la table de partitions.
        if (disque) {
          disque.partitions = [];
          disque.table = null;
        }
        // Une place libre (grappe dégradée) : il la reprend en se reconstruisant ; sinon, il attend en spare.
        const place = placeLibre(g);
        g.membres.push({
          part,
          numero: numeroLibre(g),
          role: place,
          etat: place === null ? 'spare' : 'reconstruction',
          ...(place === null ? {} : { copie: 0 }),
          ...(op === 're-add' ? { rapide: true } : {}),
        });
        g.evenements += 1;
        sorties.push(`mdadm: ${op === 're-add' ? 're-added' : 'added'} ${cible}`);
      }
    }
    // On garde la trace des anciens membres (pour --re-add).
    for (const x of g.membres) (jeu.etat.anciensMembres ??= {})[`${nom}:${x.part}`] = x.numero;
  }
  majDev(jeu);
  return sorties.join('\n');
}

const OPERATIONS: Record<string, string> = {
  '--fail': 'fail',
  '-f': 'fail',
  '--set-faulty': 'fail',
  '--remove': 'remove',
  '-r': 'remove',
  '--add': 'add',
  '-a': 'add',
  '--re-add': 're-add',
};

function mdadm(jeu: Shell, args: string[]): string {
  if (!args.length) return jeu.erreur('Usage: mdadm --help\n  for help', 2);
  if (args.includes('--help') || args.includes('-h')) return aide('mdadm', STOCKAGE.mdadm, jeu.t);
  const st = stockage(jeu);
  if (args[0] === '--create' || args[0] === '-C') return creer(jeu, st, args.slice(1));
  const detailMode = args.includes('--detail') || args.includes('-D');
  if (detailMode) {
    if (args.includes('--scan') || args.includes('-s')) {
      if (jeu.qui !== 'root') return jeu.erreur('mdadm: must be super-user to perform this action', 1);
      return Object.entries(st?.grappes ?? {})
        .sort(([, a], [, b]) => a.rang - b.rang)
        .map(([n, g]) => `ARRAY /dev/md/${n.slice(2)} metadata=1.2 name=${g.nom} UUID=${uuidMdadm(g.uuid)}`)
        .join('\n');
    }
    const cibles = args.filter((a) => !a.startsWith('-'));
    if (!cibles.length) return jeu.erreur('mdadm: No devices given.', 1);
    // --brief : une ligne ARRAY par grappe, celle de mdadm.conf.
    const bref = args.includes('--brief') || args.includes('-b');
    const sorties: string[] = [];
    for (const c of cibles) {
      if (jeu.qui !== 'root') {
        jeu.erreur(`mdadm: cannot open ${c}: Permission denied`, 1);
        continue;
      }
      const n = st ? nomGrappe(st, c) : null;
      if (!n) {
        jeu.erreur(partitionDe(st ?? { disques: {}, grappes: {}, grub: [] }, c) || /^\/dev\/sd[a-z]$/.test(c) ? `mdadm: ${c} does not appear to be an md device` : `mdadm: cannot open ${c}: No such file or directory`, 1);
        continue;
      }
      const g = st!.grappes[n];
      sorties.push(bref ? `ARRAY /dev/${n} metadata=1.2 name=${g.nom} UUID=${uuidMdadm(g.uuid)}` : detail(jeu, st!, n));
    }
    return sorties.join('\n');
  }
  // Le mode « manage » : mdadm [--manage] /dev/mdX --fail dev … --remove dev … --add dev …
  const reste = args.filter((a) => a !== '--manage');
  const inconnue = reste.find((a) => a.startsWith('-') && !(a in OPERATIONS));
  if (inconnue) return jeu.erreur(`mdadm: unrecognised option ${inconnue}\nUsage: mdadm --help\n  for help`, 2);
  const cible = reste[0];
  if (!cible || cible.startsWith('-')) return jeu.erreur('mdadm: an md device must be given in this mode', 2);
  if (jeu.qui !== 'root') return jeu.erreur('mdadm: must be super-user to perform this action', 1);
  const n = st ? nomGrappe(st, cible) : null;
  if (!n) return jeu.erreur(`mdadm: error opening ${cible}: No such file or directory`, 1);
  const ops: [string, string[]][] = [];
  for (const a of reste.slice(1)) {
    if (a in OPERATIONS) ops.push([OPERATIONS[a], []]);
    else if (ops.length) ops.at(-1)![1].push(a);
    else return jeu.erreur(`mdadm: ${a} only meaningful with -r or -f, not -a`, 2);
  }
  if (!ops.length || ops.some(([, c]) => !c.length)) return jeu.erreur('mdadm: no devices given for ' + cible, 2);
  return gerer(jeu, st!, n, ops);
}

// mdadm --create : une grappe RAID 1 neuve, sur des disques ou des partitions libres.
function creer(jeu: Shell, st: Stockage | null, args: string[]): string {
  let niveau = '';
  let nombre = 0;
  let sansQuestion = false;
  const positionnels: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    const valeur = (court: string, long: string) => (a === court || a === long ? args[++i] : a.startsWith(`${long}=`) ? a.slice(long.length + 1) : a.startsWith(court) && a.length > court.length ? a.slice(court.length) : null);
    const l = valeur('-l', '--level');
    const n = valeur('-n', '--raid-devices');
    if (l !== null) niveau = l ?? '';
    else if (n !== null) nombre = Number(n);
    else if (a === '--run' || a === '-R') sansQuestion = true;
    else if (a.startsWith('--metadata=') || a.startsWith('-e')) continue;
    else if (a.startsWith('-')) return jeu.erreur(`mdadm: unrecognised option ${a}\nUsage: mdadm --help\n  for help`, 2);
    else positionnels.push(a);
  }
  const [md, ...membres] = positionnels;
  if (!md) return jeu.erreur('mdadm: an md device must be given in this mode', 2);
  if (jeu.qui !== 'root') return jeu.erreur('mdadm: must be super-user to perform this action', 1);
  const nom = sansDev(md).replace(/^md\//, 'md');
  if (!st || !/^md\d+$/.test(nom)) return jeu.erreur(`mdadm: ${md} is an invalid name for an md device.  Try /dev/md/${nom.replace(/\D/g, '') || '0'}`, 1);
  if (st.grappes[nom]) return jeu.erreur(`mdadm: ${md} is already in use.`, 1);
  if (!niveau) return jeu.erreur('mdadm: a RAID level is needed to create an array.', 2);
  if (!['1', 'raid1', 'mirror'].includes(niveau)) return jeu.erreur(jeu.t('mdadm-niveau', { niveau }), 2);
  if (!nombre) return jeu.erreur('mdadm: no raid-devices specified.', 2);
  if (membres.length > nombre) return jeu.erreur(`mdadm: You have listed more devices (${membres.length}) than are in the array(${nombre})!`, 2);
  if (membres.length < nombre) return jeu.erreur("mdadm: You haven't given enough devices (real or missing) to create this array", 2);
  const avertissements: string[] = [];
  // « missing » : une place laissée vide (la grappe naît dégradée, on la complétera avec --add).
  const presents = membres.filter((m) => m !== 'missing');
  if (!presents.length) return jeu.erreur('mdadm: at least one device must be given', 2);
  for (const m of presents) {
    const n = sansDev(m);
    const disque = st.disques[n];
    const p = partitionDe(st, n);
    if (!m.startsWith('/dev/') || (!disque && !p)) return jeu.erreur(`mdadm: cannot open ${m}: No such file or directory`, 1);
    if (grappeDe(st, n) || st.lvm?.pvs[n] || (disque && disqueOccupe(st, n)) || (p && (grappeDe(st, p.disque) || st.lvm?.pvs[p.disque])))
      return jeu.erreur(`mdadm: cannot open ${m}: Device or resource busy`, 1);
    if (disque?.table) avertissements.push(`mdadm: partition table exists on ${m} but will be lost or\n       meaningless after creating array`);
  }
  const tailles = presents.map((m) => {
    const n = sansDev(m);
    return st.disques[n] ? st.disques[n].secteurs : partitionDe(st, n)!.p.secteurs;
  });
  const faire = () => {
    // La taille utile : celle du plus petit membre, moins la place du superbloc (128 Mio en tête).
    const blocs = Math.floor((Math.min(...tailles) * SECTEUR - 134_217_728) / 1024 / 64) * 64;
    const rang = Number(nom.slice(2));
    for (const m of presents) {
      const d = st.disques[sansDev(m)];
      if (d) {
        d.partitions = [];
        d.table = null;
      }
    }
    st.grappes[nom] = {
      niveau: 'raid1',
      voulus: nombre,
      blocs,
      uuid: (() => {
        const h = [1, 2, 3, 4].map((k) => condenser(`${nom}-${membres.join()}-${k}`)).join('');
        return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
      })(),
      nom: `${systemd(jeu)?.hote ?? jeu.hote}:${rang}`,
      membres: membres.flatMap((m, i) => (m === 'missing' ? [] : [{ part: sansDev(m), numero: i, role: i, etat: 'actif' as const }])),
      evenements: 0,
      creation: maintenant(jeu),
      bitmap: blocs * 1024 > 100e9,
      // Une grappe complète synchronise ses membres ; une grappe dégradée n'a rien à synchroniser.
      ...(presents.length === nombre && nombre > 1 ? { synchro: 0 } : {}),
      rang,
    };
    majDev(jeu);
    return 'mdadm: Defaulting to version 1.2 metadata\nmdadm: array ' + md + ' started.';
  };
  const note = [
    ...avertissements,
    'mdadm: Note: this array has metadata at the start and',
    '    may not be suitable as a boot device.  If you plan to',
    "    store '/boot' on this device please ensure that",
    '    your boot-loader understands md/v1.x metadata, or use',
    '    --metadata=0.90',
  ].join('\n');
  if (sansQuestion) return `${note}\n${faire()}`;
  jeu.demander('Continue creating array? ', (reponse) => (/^y(es)?$/i.test(reponse) ? faire() : jeu.erreur('mdadm: create aborted.', 1)));
  return note;
}

// Huit chiffres hexadécimaux tirés d'un texte (FNV-1a) : un UUID qui ne change jamais.
const condenser = (texte: string) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < texte.length; i++) h = Math.imul(h ^ texte.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(16).padStart(8, '0');
};

// ——— sfdisk ———

const enteteDisque = (nom: string, d: Disque) => {
  const octets = d.secteurs * SECTEUR;
  return [
    `Disk /dev/${nom}: ${tailleBinaire(octets)}, ${octets} bytes, ${d.secteurs} sectors`,
    `Disk model: ${d.modele}`,
    'Units: sectors of 1 * 512 = 512 bytes',
    'Sector size (logical/physical): 512 bytes / 4096 bytes',
    'I/O size (minimum/optimal): 4096 bytes / 4096 bytes',
  ];
};

function liste(nom: string, d: Disque): string {
  const lignes = enteteDisque(nom, d);
  if (!d.table) return lignes.join('\n');
  lignes.push('Disklabel type: gpt', `Disk identifier: ${d.table}`, '');
  const largeur = Math.max(6, ...d.partitions.map((p) => `/dev/${nom}${p.numero}`.length));
  lignes.push(`${'Device'.padEnd(largeur)}${'Start'.padStart(10)}${'End'.padStart(11)}${'Sectors'.padStart(11)}${'Size'.padStart(6)} Type`);
  for (const p of d.partitions)
    lignes.push(
      `${`/dev/${nom}${p.numero}`.padEnd(largeur)}${String(p.debut).padStart(10)}${String(p.debut + p.secteurs - 1).padStart(11)}${String(p.secteurs).padStart(11)}${tailleCourte(p.secteurs * SECTEUR).padStart(6)} ${NOM_TYPE[p.type]}`,
    );
  return lignes.join('\n');
}

function vidage(nom: string, d: Disque): string {
  return [
    'label: gpt',
    `label-id: ${d.table}`,
    `device: /dev/${nom}`,
    'unit: sectors',
    'first-lba: 2048',
    `last-lba: ${d.secteurs - 34}`,
    'sector-size: 512',
    '',
    ...d.partitions.map(
      (p) => `/dev/${nom}${p.numero} : start=${String(p.debut).padStart(12)}, size=${String(p.secteurs).padStart(12)}, type=${GUID_TYPE[p.type]}, uuid=${p.uuid}`,
    ),
  ].join('\n');
}

/** Lit un script sfdisk (celui de sfdisk -d) : la table et ses partitions. */
function lireScript(texte: string): { table: string | null; partitions: Omit<Partition, 'numero'>[]; numeros: number[] } | string {
  let table: string | null = null;
  const partitions: Omit<Partition, 'numero'>[] = [];
  const numeros: number[] = [];
  const types = Object.fromEntries(Object.entries(GUID_TYPE).map(([k, v]) => [v, k as TypePartition]));
  for (const brute of texte.split('\n')) {
    const l = brute.trim();
    if (!l || l.startsWith('#')) continue;
    const entete = /^([a-z-]+):\s*(.*)$/.exec(l);
    if (entete) {
      if (entete[1] === 'label' && entete[2] !== 'gpt') return `unsupported label '${entete[2]}'`;
      if (entete[1] === 'label-id') table = entete[2];
      continue;
    }
    const m = /^(\S+)\s*:\s*(.*)$/.exec(l);
    if (!m) return `script header: unknown line '${l}'`;
    const champs = Object.fromEntries(
      m[2].split(',').map((x) => {
        const [k, ...v] = x.split('=');
        return [k.trim(), v.join('=').trim()];
      }),
    );
    const type = types[(champs.type ?? '').toUpperCase()];
    if (!champs.start || !champs.size || !type) return `failed to parse script line '${l}'`;
    numeros.push(Number(/(\d+)$/.exec(m[1])?.[1] ?? partitions.length + 1));
    partitions.push({ debut: Number(champs.start), secteurs: Number(champs.size), type, uuid: champs.uuid ?? '' });
  }
  return { table, partitions, numeros };
}

function sfdisk(jeu: Shell, args: string[], entree: string | null): string {
  if (args.includes('-h') || args.includes('--help')) return aide('sfdisk', STOCKAGE.sfdisk, jeu.t);
  const inconnue = args.find((a) => a.startsWith('-') && !['-d', '--dump', '-l', '--list'].includes(a));
  if (inconnue)
    return jeu.erreur(
      inconnue.startsWith('--') ? `sfdisk: unrecognized option '${inconnue}'\nTry 'sfdisk --help' for more information.` : `sfdisk: invalid option -- '${inconnue.slice(1, 2)}'\nTry 'sfdisk --help' for more information.`,
      1,
    );
  const st = stockage(jeu);
  const cibles = args.filter((a) => !a.startsWith('-'));
  const disque = (c: string) => (st && /^\/dev\/sd[a-z]$/.test(c) ? st.disques[sansDev(c)] : undefined);
  const ouvrir = (c: string): Disque | null => {
    if (jeu.qui !== 'root') return jeu.erreur(`sfdisk: cannot open ${c}: Permission denied`, 1), null;
    const d = disque(c);
    if (!d) return jeu.erreur(`sfdisk: cannot open ${c}: No such file or directory`, 1), null;
    return d;
  };
  if (args.includes('-l') || args.includes('--list')) {
    const noms = cibles.length ? cibles : Object.keys(st?.disques ?? {}).map((n) => `/dev/${n}`);
    return noms
      .map((c) => {
        const d = ouvrir(c);
        return d ? liste(sansDev(c), d) : null;
      })
      .filter((x): x is string => x !== null)
      .join('\n\n');
  }
  if (args.includes('-d') || args.includes('--dump')) {
    if (!cibles.length) return jeu.erreur('sfdisk: no disk device specified', 1);
    const d = ouvrir(cibles[0]);
    if (!d) return '';
    if (!d.table) return jeu.erreur(`sfdisk: ${cibles[0]}: does not contain a recognized partition table`, 1);
    return vidage(sansDev(cibles[0]), d);
  }
  // Écrire une table : le script arrive sur l'entrée standard.
  if (!cibles.length) return jeu.erreur('sfdisk: no disk device specified', 1);
  const nom = sansDev(cibles[0]);
  const d = ouvrir(cibles[0]);
  if (!d) return '';
  if (entree === null) return jeu.erreur(jeu.t('sfdisk-interactif'), 1);
  const entete = ['Checking that no-one is using this disk right now ... FAILED', ''];
  if (disqueOccupe(st!, nom))
    return jeu.erreur(
      [
        ...entete,
        'This disk is currently in use - repartitioning is probably a bad idea.',
        'Umount all file systems, and swapoff all swap partitions on this disk.',
        'Use the --no-reread flag to suppress this check.',
        '',
        'sfdisk: Use the --force flag to overrule all checks.',
      ].join('\n'),
      1,
    );
  const script = lireScript(entree);
  if (typeof script === 'string') return jeu.erreur(`sfdisk: ${script}`, 1);
  if (!script.partitions.length) return jeu.erreur('sfdisk: no partitions defined', 1);
  const fin = Math.max(...script.partitions.map((p) => p.debut + p.secteurs));
  if (fin > d.secteurs - 33) return jeu.erreur(`sfdisk: failed to add #${script.partitions.length} partition: Numerical result out of range\nLeaving.`, 1);
  const avant = enteteDisque(nom, d);
  d.table = script.table ?? 'E2A7C1D4-5B3F-4A8E-9C6D-1F0B2A3C4D5E';
  d.partitions = script.partitions.map((p, i) => ({ ...p, numero: script.numeros[i] }));
  majDev(jeu);
  return [
    'Checking that no-one is using this disk right now ... OK',
    '',
    ...avant,
    '',
    '>>> Script header accepted.',
    '>>> Script header accepted.',
    '>>> Script header accepted.',
    '>>> Script header accepted.',
    '>>> Script header accepted.',
    '>>> Script header accepted.',
    `>>> Created a new GPT disklabel (GUID: ${d.table}).`,
    ...d.partitions.map((p) => `/dev/${nom}${p.numero}: Created a new partition ${p.numero} of type '${NOM_TYPE[p.type]}' and of size ${tailleBinaire(p.secteurs * SECTEUR)}.`),
    `/dev/${nom}${d.partitions.length + 1}: Done.`,
    '',
    'New situation:',
    liste(nom, d).split('\n').slice(5).join('\n'),
    '',
    'The partition table has been altered.',
    'Calling ioctl() to re-read partition table.',
    'Syncing disks.',
  ].join('\n');
}

// ——— grub-install ———

function grubInstall(jeu: Shell, args: string[]): string {
  if (args.includes('-h') || args.includes('--help')) return aide('grub-install', STOCKAGE['grub-install'], jeu.t);
  const cible = args.find((a) => !a.startsWith('-'));
  if (jeu.qui !== 'root') return jeu.erreur('grub-install: error: failed to get canonical path of `/boot/grub/i386-pc\'.', 1);
  if (!cible) return jeu.erreur('grub-install: error: install device isn\'t specified.', 1);
  const st = stockage(jeu);
  const nom = sansDev(cible);
  if (st && partitionDe(st, nom)) return jeu.erreur(`grub-install: error: unable to identify a filesystem in ${cible}; safety check can't be performed.`, 1);
  const d = st?.disques[nom];
  if (!d || !cible.startsWith('/dev/')) return jeu.erreur(`grub-install: error: cannot find a GRUB drive for ${cible}.  Check your device.map.`, 1);
  // Sur une table GPT, GRUB (en mode BIOS) s'installe dans la partition « BIOS boot ».
  if (!d.partitions.some((p) => p.type === 'bios'))
    return jeu.erreur(
      `Installing for i386-pc platform.\ngrub-install: warning: this GPT partition label contains no BIOS Boot Partition; embedding won't be possible.\ngrub-install: error: embedding is not possible, but this is required for cross-disk install.`,
      1,
    );
  if (!st!.grub.includes(nom)) st!.grub.push(nom);
  return 'Installing for i386-pc platform.\nInstallation finished. No error reported.';
}

// ——— lsblk, sur une machine qui a un modèle de stockage ———

interface LigneLsblk {
  nom: string;
  prefixe: string;
  type: 'disk' | 'part' | 'raid1' | 'lvm';
  octets: number;
  majmin: [number, number];
  point: string;
  modele: string;
  serie: string;
  fstype: string;
  uuid: string;
}

export function lsblkStockage(jeu: Shell, st: Stockage, args: string[]): string {
  const montages: { chemin: string; nom: string; systeme?: string }[] = jeu.etat.montages ?? [];
  const point = (n: string) => montages.find((m) => m.nom === `/dev/${n}`)?.chemin ?? '';
  const sansEnfants = args.some((a) => /^-\w*d/.test(a) || a === '--nodeps');
  const lignes: LigneLsblk[] = [];
  const pvs = st.lvm?.pvs ?? {};
  // Les volumes logiques qui ont un morceau sur ce PV (vg-lv).
  const lvsSur = (pv: string) =>
    Object.entries(st.lvm?.vgs ?? {}).flatMap(([vg, g]) => Object.entries(g.lvs).filter(([, lv]) => lv.segments.some((x) => x.pv === pv)).map(([n]) => `${vg}-${n}`));
  // Ce qui est posé sur un périphérique : sa grappe, ses volumes logiques, ou ses partitions.
  const enfants = (n: string): string[] => {
    const g = grappeDe(st, n);
    if (g) return [g[0]];
    if (pvs[n]) return lvsSur(n);
    return st.disques[n]?.partitions.map((p) => `${n}${p.numero}`) ?? [];
  };
  const ligneDe = (n: string, prefixe: string): LigneLsblk => {
    const fs = grappeDe(st, n) ? ['linux_raid_member', grappeDe(st, n)![1].uuid] : pvs[n] ? ['LVM2_member', pvs[n].uuid] : null;
    const d = st.disques[n];
    const g = st.grappes[n];
    const lv = /^([\w.+]+)-([\w.+]+)$/.exec(n);
    const vol = lv && !d && !g ? st.lvm?.vgs[lv[1]]?.lvs[lv[2]] : undefined;
    const monte = montages.find((m) => m.nom === (vol ? `/dev/mapper/${n}` : `/dev/${n}`));
    return {
      nom: n,
      prefixe,
      type: d ? 'disk' : g ? 'raid1' : vol ? 'lvm' : 'part',
      octets: vol ? tailleLv(vol) : (tailleDe(st, n) ?? 0),
      majmin: vol ? [253, vol.mineur] : majmin(st, n),
      point: monte?.chemin ?? '',
      modele: d?.modele ?? '',
      serie: d?.serie ?? '',
      fstype: fs ? fs[0] : vol || monte ? (monte?.systeme ?? 'ext4') : '',
      uuid: fs ? fs[1] : '',
    };
  };
  const poser = (n: string, avant: string, derniere: boolean, racine: boolean) => {
    lignes.push(ligneDe(n, racine ? '' : `${avant}${derniere ? '└─' : '├─'}`));
    if (sansEnfants) return;
    const suite = racine ? '' : `${avant}${derniere ? '  ' : '│ '}`;
    const liste = enfants(n);
    liste.forEach((e, i) => poser(e, suite, i === liste.length - 1, false));
  };
  for (const [n] of Object.entries(st.disques).sort(([, a], [, b]) => a.rang - b.rang)) poser(n, '', true, true);
  // Les colonnes : -o liste, -f les systèmes de fichiers, sinon celles par défaut.
  const iO = args.findIndex((a) => a === '-o' || a === '--output');
  const demandees = iO >= 0 ? (args[iO + 1] ?? '').toUpperCase().split(',').filter(Boolean) : args.some((a) => /^-\w*f/.test(a)) ? ['NAME', 'FSTYPE', 'UUID', 'MOUNTPOINTS'] : ['NAME', 'MAJ:MIN', 'RM', 'SIZE', 'RO', 'TYPE', 'MOUNTPOINTS'];
  const colonnes: Record<string, { droite?: boolean; valeur: (l: LigneLsblk) => string }> = {
    NAME: { valeur: (l) => l.prefixe + l.nom },
    'MAJ:MIN': { valeur: (l) => `${String(l.majmin[0]).padStart(3)}:${String(l.majmin[1]).padEnd(3)}` },
    RM: { droite: true, valeur: () => '0' },
    SIZE: { droite: true, valeur: (l) => tailleCourte(l.octets) },
    RO: { droite: true, valeur: () => '0' },
    TYPE: { valeur: (l) => l.type },
    MOUNTPOINT: { valeur: (l) => l.point },
    MOUNTPOINTS: { valeur: (l) => l.point },
    MODEL: { valeur: (l) => l.modele },
    SERIAL: { valeur: (l) => l.serie },
    FSTYPE: { valeur: (l) => l.fstype },
    UUID: { valeur: (l) => l.uuid },
  };
  const inconnue = demandees.find((c) => !colonnes[c]);
  if (inconnue) return jeu.erreur(`lsblk: unknown column: ${inconnue}`, 1);
  const largeurs = demandees.map((c) => Math.max(c.length, ...lignes.map((l) => [...colonnes[c].valeur(l)].length)));
  const cellule = (c: string, texte: string, i: number, derniere: boolean) => {
    if (derniere) return texte;
    const manque = largeurs[i] - [...texte].length;
    return colonnes[c].droite ? ' '.repeat(manque) + texte : texte + ' '.repeat(manque);
  };
  const ligne = (valeurs: string[]) => valeurs.map((v, i) => cellule(demandees[i], v, i, i === valeurs.length - 1)).join(' ').trimEnd();
  return [ligne(demandees), ...lignes.map((l) => ligne(demandees.map((c) => colonnes[c].valeur(l))))].join('\n');
}

export const STOCKAGE: Record<string, Commande> = {
  smartctl: { section: 8, propresOptions: true, lancer: ({ args, jeu }) => smartctl(jeu, args) },
  mdadm: { section: 8, propresOptions: true, lancer: ({ args, jeu }) => mdadm(jeu, args) },
  sfdisk: { section: 8, propresOptions: true, lancer: ({ args, jeu, entree }) => sfdisk(jeu, args, entree) },
  'grub-install': { section: 8, propresOptions: true, lancer: ({ args, jeu }) => grubInstall(jeu, args) },
};

/** Le temps passe d'une commande sur la machine : la reconstruction avance. */
export function tempsQuiPasse(jeu: Shell): void {
  const st = stockage(jeu);
  if (st) avancer(st);
}
