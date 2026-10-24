// Histoire « Le Labo » : ce que ses chapitres ont en commun. Le serveur du
// Labo, le club photo du quartier (machine labo), loué chez un hébergeur :
// deux disques de 2 To en RAID 1 logiciel (mdadm). md0 porte le système (/),
// md1 les photos des membres (/srv). Odile, la présidente, n'est pas
// technicienne ; l'hébergeur change les disques sur demande (un ticket avec
// le numéro de série), mais c'est au client de s'occuper du RAID.
// Le stockage est décrit par stockage.ts (disques, SMART, partitions, grappes).

import { d, f, fichiersComptes, type Comptes, type Dossier, type Droits } from '../monde';
import type { Jeu, Shell } from '../shell';
import type { Traduire } from '../../textes';
import { nouveauSystemd, type DefinitionService } from '../systemd';
import { dossierDev, majDev, mdstat, stockage, type Disque, type Partition, type Smart, type Stockage } from '../stockage';
import { allouer, etenduesPv, tailleLv, type VolumeLogique } from '../lvm';
import { tempsQuiPasse } from '../commandes/stockage';

export const M = '/home/vous';
export const MOT_DE_PASSE = 'argentique-2027';
// Samedi 13 novembre 2027, 7 h 42.
export const MAINTENANT = Date.UTC(2027, 10, 13, 7, 42, 0);
const DEMARRAGE = Date.UTC(2027, 9, 2, 4, 11, 0);
// Le chapitre 3 : samedi 15 janvier 2028, 10 h ; le serveur a redémarré pour brancher les disques.
export const MAINTENANT_PLACE = Date.UTC(2028, 0, 15, 10, 0, 0);
const DEMARRAGE_PLACE = Date.UTC(2028, 0, 15, 6, 40, 0);
// Le chapitre 4 : mardi 25 janvier 2028, le redémarrage de la nuit (un nouveau noyau) n'a pas abouti.
const DEMARRAGE_SECOURS = Date.UTC(2028, 0, 25, 4, 2, 0);
const MAINTENANT_SECOURS = Date.UTC(2028, 0, 25, 7, 55, 0);
const SECTEURS = 3_907_029_168;

// Les numéros de série : celui du disque qui fatigue, de l'autre, et du neuf.
export const SERIES = { sda: 'LB7K2A0F31C4', sdb: 'LB7K2A0F58E9', neuf: 'LB7K2B1D07A2', sdc: 'LB4K2C0E19F3', sdd: 'LB4K2C0E2A47' };
export const MODELE = 'LB2000-7K2';
const MODELE_4T = 'LB4000-7K2';
const SECTEURS_4T = 7_814_037_168;

export const comptesLabo = (): Comptes => ({
  utilisateurs: {
    root: { uid: 0, groupe: 'root', maison: '/root' },
    'www-data': { uid: 33, groupe: 'www-data', maison: '/var/www', shell: '/usr/sbin/nologin' },
    vous: { uid: 1000, groupe: 'vous' },
    odile: { uid: 1001, groupe: 'odile' },
    theo: { uid: 1002, groupe: 'theo' },
  },
  groupes: {
    root: { gid: 0, membres: [] },
    adm: { gid: 4, membres: ['vous'] },
    disk: { gid: 6, membres: [] },
    sudo: { gid: 27, membres: ['vous'] },
    'www-data': { gid: 33, membres: [] },
    vous: { gid: 1000, membres: [] },
    odile: { gid: 1001, membres: [] },
    theo: { gid: 1002, membres: [] },
  },
});

// La table GPT des disques du serveur : la petite partition de GRUB, puis
// une partition par grappe.
const partitions = (graine: string): Partition[] => [
  { numero: 1, debut: 2048, secteurs: 2048, type: 'bios', uuid: `3C1F0A2E-${graine}-4B7D-9E21-0D5A6C8B1F01` },
  { numero: 2, debut: 4096, secteurs: 67_108_864, type: 'raid', uuid: `8E4D2B6A-${graine}-4F3C-A1D7-2B9E5C0F7A02` },
  { numero: 3, debut: 67_112_960, secteurs: SECTEURS - 34 - 67_112_960 + 1, type: 'raid', uuid: `D7A95C13-${graine}-4E8B-B2F6-6A1C3E9D4B03` },
];
const smartSain = (heures: number): Smart => ({ heures, temperature: 34, realloues: 0, enAttente: 0, illisibles: 0, crc: 0, erreursAta: 0 });
const disque = (rang: number, serie: string, smart: Smart, table: string | null, parts: Partition[]): Disque => ({
  modele: MODELE,
  serie,
  secteurs: SECTEURS,
  table,
  partitions: parts,
  smart,
  rang,
});

export type Moment = 'fatigue' | 'neuf' | 'place' | 'secours';
// Les moments où le disque sdb a déjà été remplacé, et où sdc et sdd sont branchés.
const apresRemplacement = (m: Moment) => m === 'place' || m === 'secours';

/**
 * Le stockage du serveur au début d'un chapitre : 'fatigue' (sdb s'abîme,
 * tout est encore en RAID), 'neuf' (sdb vient d'être remplacé par un disque
 * vierge, les grappes tournent sur sda seul) ou 'place' (tout est réparé, et
 * l'hébergeur a branché deux disques neufs de 4 To, sdc et sdd). Les photos
 * sont dans un volume logique (LVM) posé sur md1, comme l'installateur de
 * Debian le propose (« RAID puis LVM »).
 */
export function stockageLabo(moment: Moment): Stockage {
  const neuf = moment === 'neuf';
  const sdb = neuf
    ? disque(1, SERIES.neuf, smartSain(3), null, [])
    : apresRemplacement(moment)
      ? disque(1, SERIES.neuf, smartSain(412), '6A1B3C5D-7E9F-4012-8A3B-C4D5E6F70812', partitions('1A3B'))
    : disque(1, SERIES.sdb, { heures: 28_509, temperature: 37, realloues: 1208, enAttente: 8, illisibles: 8, crc: 0, erreursAta: 37 }, '6A1B3C5D-7E9F-4012-8A3B-C4D5E6F70812', partitions('2B4C'));
  const membres = (n: number) => [
    { part: `sda${n}`, numero: 0, role: 0, etat: 'actif' as const },
    ...(neuf ? [] : [{ part: `sdb${n}`, numero: 1, role: 1, etat: 'actif' as const }]),
  ];
  const st: Stockage = {
    disques: {
      sda: disque(0, SERIES.sda, smartSain(28_512), '6A1B3C5D-7E9F-4012-8A3B-C4D5E6F70812', partitions('1A3B')),
      sdb,
      ...(apresRemplacement(moment)
        ? {
            sdc: { ...disque(2, SERIES.sdc, smartSain(2), null, []), modele: MODELE_4T, secteurs: SECTEURS_4T },
            sdd: { ...disque(3, SERIES.sdd, smartSain(2), null, []), modele: MODELE_4T, secteurs: SECTEURS_4T },
          }
        : {}),
      // Chapitre 4 : le disque USB des numérisations de Théo, branché au serveur.
      ...(moment === 'secours'
        ? {
            sde: {
              ...disque(4, 'NA7Q3K1P', smartSain(1210), '9B2E4F61-3C8A-4D17-A5E2-7F0C6B9D1A33', [
                { numero: 1, debut: 2048, secteurs: 1_953_521_664, type: 'linux', uuid: '4F8C2A1D-6E3B-4A9F-B7D5-0C2E8A4F6B11' },
              ]),
              modele: 'USB3.0 Disk 1TB',
              secteurs: 1_953_525_168,
              amovible: true,
            },
          }
        : {}),
    },
    grappes: {
      md0: { niveau: 'raid1', voulus: 2, blocs: 33_520_640, uuid: '5d1e0a3c-7b2f-4e91-a6c8-3f0d9b1e2c47', nom: 'labo:0', membres: membres(2), evenements: neuf ? 4182 : 4171, creation: Date.UTC(2024, 2, 6, 10, 12, 31), rang: 0 },
      md1: { niveau: 'raid1', voulus: 2, blocs: 1_919_824_896, uuid: 'a8c3e5f1-2d4b-4a6e-9f17-0b3c5d7e9a21', nom: 'labo:1', membres: membres(3), evenements: neuf ? 91_877 : 91_866, creation: Date.UTC(2024, 2, 6, 10, 12, 58), bitmap: true, rang: 1 },
    },
    grub: neuf ? ['sda'] : ['sda', 'sdb'],
  };
  // Le volume des photos prend tout le groupe labo (un seul PV : md1).
  const photos: VolumeLogique = { segments: [], fs: 0, point: '/srv', mineur: 0 };
  st.lvm = { pvs: { md1: { vg: 'labo', uuid: 'q3Xk7v-Lb2N-9fRt-Wm4P-cH8s-Jd5Y-a1ZeQo' } }, vgs: { labo: { uuid: 'Hn4w2B-pT6e-Rk9M-sL3v-Qa7X-dF1c-Zg8Y0u', lvs: { photos } } } };
  allouer(st, photos, etenduesPv(st, 'md1'), ['md1']);
  // Chapitre 4 : la fin du chapitre 3, md2 faite des disques neufs et donnée au volume des photos.
  if (moment === 'secours') {
    st.grappes.md2 = {
      niveau: 'raid1',
      voulus: 2,
      blocs: 3_906_887_488,
      uuid: 'e3b9d1c7-4a2f-4c8e-b5d6-7f1a9c3e2b40',
      nom: 'labo:2',
      membres: [
        { part: 'sdc', numero: 0, role: 0, etat: 'actif' },
        { part: 'sdd', numero: 1, role: 1, etat: 'actif' },
      ],
      evenements: 2210,
      creation: MAINTENANT_PLACE,
      bitmap: true,
      rang: 2,
    };
    st.lvm.pvs.md2 = { vg: 'labo', uuid: 'Vd6sQ1-mK3p-Xe7R-tB9w-Lc2N-yH4f-Jz8aPu' };
    allouer(st, photos, etenduesPv(st, 'md2'), ['md2']);
  }
  photos.fs = tailleLv(photos);
  // Les systèmes de fichiers, et leurs UUID (ceux de /etc/fstab).
  st.fs = {
    '/dev/md0': { type: 'ext4', uuid: '0f9c2a4e-61d3-4b8a-9e57-c3d1a2b4e6f8' },
    '/dev/mapper/labo-photos': { type: 'ext4', uuid: '7b3e5d1f-2a4c-4e6b-8d9f-1a2b3c4d5e6f' },
    ...(moment === 'secours' ? { '/dev/sde1': { type: 'ext4', uuid: UUID_SCANS, label: 'SCANS', octets: 984_000_000_000, arbre: scans() } } : {}),
  };
  return st;
}

export const st = (j: Jeu) => stockage(j)!;

// Le disque des numérisations : des dossiers de scans d'archives du club.
export const UUID_SCANS = 'c27a9e41-5b3d-4f8a-a1e6-9d0b2c4f7e13';
const scans = (): Dossier => {
  const scan = (taille: number) => f('', { proprio: 'theo', groupe: 'theo', taille });
  return d(
    {
      'archives-1962': d({ 'negatifs-001.tif': scan(212_000_000), 'negatifs-002.tif': scan(198_000_000) }, undefined, { proprio: 'theo' }),
      'archives-1978': d({ 'tirages-001.tif': scan(176_000_000) }, undefined, { proprio: 'theo' }),
    },
    undefined,
    { proprio: 'theo', groupe: 'theo' },
  );
};

// Les services de la machine : ssh, smartd (smartmontools), mdmonitor, et nginx pour la galerie.
const services = (): Record<string, DefinitionService> => ({
  ssh: {
    description: 'OpenBSD Secure Shell server',
    active: true,
    executable: 'sshd',
    processus: [{ pid: 604, utilisateur: 'root', cpu: 0, mem: 0.2, commande: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' }],
  },
  smartmontools: {
    description: 'Self Monitoring and Reporting Technology (SMART) Daemon',
    active: true,
    executable: 'smartd',
    processus: [{ pid: 588, utilisateur: 'root', cpu: 0, mem: 0.1, commande: '/usr/sbin/smartd -n' }],
  },
  mdmonitor: {
    description: 'MD array monitor',
    active: true,
    executable: 'mdadm',
    processus: [{ pid: 591, utilisateur: 'root', cpu: 0, mem: 0.1, commande: '/sbin/mdadm --monitor --scan' }],
  },
  nginx: {
    description: 'A high performance web server and a reverse proxy server',
    active: true,
    executable: 'nginx',
    processus: [{ pid: 801, utilisateur: 'root', cpu: 0, mem: 0.3, commande: 'nginx: master process /usr/sbin/nginx -g daemon on; master_process on;' }],
  },
});

/** L'état de la machine au début d'un chapitre (systemd, stockage, montages). */
export const etatLabo = (moment: Moment) => {
  const stockage = stockageLabo(moment);
  return {
    systemd: nouveauSystemd(
      'labo',
      moment === 'place' ? DEMARRAGE_PLACE : moment === 'secours' ? DEMARRAGE_SECOURS : DEMARRAGE,
      moment === 'place' ? MAINTENANT_PLACE : moment === 'secours' ? MAINTENANT_SECOURS : MAINTENANT,
      services(),
    ),
    stockage,
    montages: [
      { chemin: '/', capacite: 33_000_000_000, nom: '/dev/md0', systeme: 'ext4' },
      { chemin: '/srv', capacite: stockage.lvm!.vgs.labo.lvs.photos.fs, nom: '/dev/mapper/labo-photos', systeme: 'ext4' },
    ],
  };
};

/** Les messages du noyau : les erreurs de lecture de sdb (chapitre 1), ou son remplacement (chapitre 2). */
export function noyauLabo(j: Jeu, moment: Moment): void {
  const debut = moment === 'place' ? DEMARRAGE_PLACE : moment === 'secours' ? DEMARRAGE_SECOURS : DEMARRAGE;
  const disquesNeufs = (['sdc', 'sdd'] as const).flatMap((d, i): [number, string][] => [
    [debut + 3000 + i * 10, `ata${i + 3}.00: ATA-11: LB4000-7K2, LB07, max UDMA/133`],
    [debut + 3100 + i * 10, `sd ${i + 2}:0:0:0: [${d}] 7814037168 512-byte logical blocks: (4.00 TB/3.64 TiB)`],
    [debut + 3200 + i * 10, `sd ${i + 2}:0:0:0: [${d}] Attached SCSI disk`],
  ]);
  const lignes: [number, string][] =
    moment === 'place'
      ? disquesNeufs
      : moment === 'secours'
        ? [
            ...disquesNeufs,
            [debut + 3400, 'md/raid1:md2: active with 2 out of 2 mirrors'],
            [debut + 5100, 'usb 2-1: new SuperSpeed USB device number 2 using xhci_hcd'],
            [debut + 5300, 'usb-storage 2-1:1.0: USB Mass Storage device detected'],
            [debut + 6200, 'sd 6:0:0:0: [sde] 1953525168 512-byte logical blocks: (1.00 TB/932 GiB)'],
            [debut + 6300, ' sde: sde1'],
            [debut + 6400, 'sd 6:0:0:0: [sde] Attached SCSI removable disk'],
          ]
      : moment === 'fatigue'
      ? [
          [Date.UTC(2027, 10, 11, 3, 12, 40), 'ata2.00: exception Emask 0x0 SAct 0x40000 SErr 0x0 action 0x0'],
          [Date.UTC(2027, 10, 11, 3, 12, 40), 'ata2.00: irq_stat 0x40000008'],
          [Date.UTC(2027, 10, 11, 3, 12, 40), 'ata2.00: failed command: READ FPDMA QUEUED'],
          [Date.UTC(2027, 10, 11, 3, 12, 40), 'ata2.00: cmd 60/08:90:87:d6:12/00:00:00:00:00/40 tag 18 ncq dma 4096 in\n         res 41/40:00:87:d6:12/00:00:00:00:00/40 Emask 0x409 (media error) <F>'],
          [Date.UTC(2027, 10, 11, 3, 12, 40), 'ata2.00: status: { DRDY ERR }'],
          [Date.UTC(2027, 10, 11, 3, 12, 40), 'ata2.00: error: { UNC }'],
          [Date.UTC(2027, 10, 11, 3, 12, 41), 'ata2.00: configured for UDMA/133'],
          [Date.UTC(2027, 10, 11, 3, 12, 41), 'sd 1:0:0:0: [sdb] tag#18 FAILED Result: hostbyte=DID_OK driverbyte=DRIVER_OK cmd_age=3s'],
          [Date.UTC(2027, 10, 11, 3, 12, 41), 'sd 1:0:0:0: [sdb] tag#18 Sense Key : Medium Error [current]'],
          [Date.UTC(2027, 10, 11, 3, 12, 41), 'sd 1:0:0:0: [sdb] tag#18 Add. Sense: Unrecovered read error - auto reallocate failed'],
          [Date.UTC(2027, 10, 11, 3, 12, 41), 'I/O error, dev sdb, sector 1234567 op 0x0:(READ) flags 0x0 phys_seg 1 prio class 2'],
          [Date.UTC(2027, 10, 11, 3, 12, 41), 'md/raid1:md0: sdb2: rescheduling sector 1195655'],
          [Date.UTC(2027, 10, 11, 3, 12, 42), 'md/raid1:md0: redirecting sector 1195655 to other mirror: sda2'],
          [Date.UTC(2027, 10, 11, 3, 12, 42), 'ata2: EH complete'],
          [Date.UTC(2027, 10, 13, 2, 47, 9), 'ata2.00: failed command: READ FPDMA QUEUED'],
          [Date.UTC(2027, 10, 13, 2, 47, 10), 'I/O error, dev sdb, sector 1990344712 op 0x0:(READ) flags 0x0 phys_seg 1 prio class 2'],
          [Date.UTC(2027, 10, 13, 2, 47, 10), 'md/raid1:md1: sdb3: rescheduling sector 1923231752'],
          [Date.UTC(2027, 10, 13, 2, 47, 11), 'md/raid1:md1: redirecting sector 1923231752 to other mirror: sda3'],
        ]
      : [
          [Date.UTC(2027, 10, 14, 6, 58, 2), 'ata2: SATA link down (SStatus 0 SControl 300)'],
          [Date.UTC(2027, 10, 14, 6, 58, 2), 'ata2.00: disable device'],
          [Date.UTC(2027, 10, 14, 7, 6, 51), 'ata2: SATA link up 6.0 Gbps (SStatus 133 SControl 300)'],
          [Date.UTC(2027, 10, 14, 7, 6, 51), `ata2.00: ATA-11: ${MODELE}, LB07, max UDMA/133`],
          [Date.UTC(2027, 10, 14, 7, 6, 51), 'ata2.00: 3907029168 sectors, multi 16: LBA48 NCQ (depth 32), AA'],
          [Date.UTC(2027, 10, 14, 7, 6, 52), 'sd 1:0:0:0: [sdb] 3907029168 512-byte logical blocks: (2.00 TB/1.82 TiB)'],
          [Date.UTC(2027, 10, 14, 7, 6, 52), 'sd 1:0:0:0: [sdb] Attached SCSI disk'],
        ];
  j.etat.noyau = [
    { temps: debut, texte: 'Linux version 6.12.48+deb13-amd64 (debian-kernel@lists.debian.org)' },
    { temps: debut + 2000, texte: 'md/raid1:md0: active with 2 out of 2 mirrors' },
    { temps: debut + 2100, texte: 'md/raid1:md1: active with 2 out of 2 mirrors' },
    ...lignes.map(([temps, texte]) => ({ temps, texte })),
  ];
}

// Un courrier de smartd (format de smartmontools 7.4), dans la boîte de vous (root: vous dans /etc/aliases).
const courrierSmartd = (hote: string, temps: string, sujet: string, avertissement: string, premier: string) =>
  [
    `From root@${hote} ${temps}`,
    'To: root',
    `Subject: SMART error (${sujet}) detected on host: ${hote}`,
    `From: root <root@${hote}>`,
    '',
    'This message was generated by the smartd daemon running on:',
    '',
    `   host name:  ${hote}`,
    '   DNS domain: internal',
    '',
    'The following warning/error was logged by the smartd daemon:',
    '',
    `Device: /dev/sdb [SAT], ${avertissement}`,
    '',
    'Device info:',
    `${MODELE}, S/N:${SERIES.sdb}, WWN:5-000c50-0a1b2c3d4, FW:LB07, 2.00 TB`,
    '',
    "For details see host's SYSLOG.",
    '',
    'You can also use the smartctl utility for further investigation.',
    `The original message about this issue was sent at ${premier} UTC`,
    'Another message will be sent in 24 hours if the problem persists.',
    '',
  ].join('\n');

/** Les courriers de smartd, depuis la machine (son nom dans la langue : labo, lab). */
export const boiteSmartd = (hote: string) =>
  [
    courrierSmartd(hote, 'Thu Nov 11 03:12:44 2027', 'CurrentPendingSector', '8 Currently unreadable (pending) sectors', 'Thu Nov 11 03:12:44 2027'),
    courrierSmartd(hote, 'Thu Nov 11 03:42:44 2027', 'OfflineUncorrectableSector', '8 Offline uncorrectable sectors', 'Thu Nov 11 03:42:44 2027'),
    courrierSmartd(hote, 'Sat Nov 13 03:12:44 2027', 'CurrentPendingSector', '8 Currently unreadable (pending) sectors', 'Thu Nov 11 03:12:44 2027'),
  ].join('\n');

/** Le monde de la machine : le système, les photos, et ce que le chapitre ajoute dans la maison et ailleurs. */
export function mondeLabo(t: Traduire, maison: Record<string, ReturnType<typeof f>>, plus: { mail?: string; hiver?: boolean; secours?: boolean } = {}): Dossier {
  const racine: Droits = { proprio: 'root' };
  const lieu = (enfants: Parameters<typeof d>[0], droits: Droits = racine) => d(enfants, undefined, droits);
  const fichier = (texte: string, droits: Droits = racine) => f(texte, { lignes: true, ...droits });
  const photo = (taille: number) => f('', { proprio: 'www-data', groupe: 'www-data', taille });
  return lieu({
    dev: dossierDev(),
    etc: lieu({
      ...fichiersComptes(),
      hostname: fichier('labo'),
      aliases: fichier('# See man 5 aliases for format\npostmaster:    root\nroot: vous'),
      fstab: fichier(
        [
          '# /etc/fstab: static file system information.',
          '# <file system>                           <mount point> <type> <options>          <dump> <pass>',
          'UUID=0f9c2a4e-61d3-4b8a-9e57-c3d1a2b4e6f8 /             ext4   errors=remount-ro  0      1',
          'UUID=7b3e5d1f-2a4c-4e6b-8d9f-1a2b3c4d5e6f /srv          ext4   defaults           0      2',
          // Chapitre 4 : la ligne ajoutée par Théo, d'après un tutoriel suivi sur son portable.
          ...(plus.secours ? ['', t('secours-fstab-commentaire'), '/dev/sdc1  /srv/scans  ext4  defaults  0  2'] : []),
        ].join('\n'),
      ),
      mdadm: lieu({
        'mdadm.conf': fichier(
          [
            '# mdadm.conf',
            '#',
            '# !NB! Run update-initramfs -u after updating this file.',
            '',
            'HOMEHOST <system>',
            'MAILADDR root',
            '',
            'ARRAY /dev/md/0  metadata=1.2 UUID=5d1e0a3c:7b2f4e91:a6c83f0d:9b1e2c47 name=labo:0',
            'ARRAY /dev/md/1  metadata=1.2 UUID=a8c3e5f1:2d4b4a6e:9f170b3c:5d7e9a21 name=labo:1',
            ...(plus.secours ? ['ARRAY /dev/md2 metadata=1.2 name=labo:2 UUID=e3b9d1c7:4a2f4c8e:b5d67f1a:9c3e2b40'] : []),
          ].join('\n'),
        ),
      }),
      'smartd.conf': fichier(
        [
          '# Monitor all disks, mail root on trouble, short self-test every night at 3 am.',
          'DEVICESCAN -d removable -n standby -m root -M exec /usr/share/smartmontools/smartd-runner -s S/../.././03',
        ].join('\n'),
      ),
    }),
    home: lieu({ vous: d(plus.secours ? {} : maison), odile: lieu({}, { proprio: 'odile', mode: 'rwx------' }) }),
    // Chapitre 4 : on travaille en root, sur la console de l'hébergeur.
    ...(plus.secours ? { root: lieu(maison, { proprio: 'root', mode: 'rwx------' }) } : {}),
    proc: lieu({ mdstat: f((j) => mdstat(stockage(j)!), { lignes: true, proprio: 'root', mode: 'r--r--r--' }) }),
    srv: lieu({
      photos: lieu(
        {
          '2025': lieu({ 'expo-printemps': lieu({ 'tirages.tar': photo(48_000_000_000) }, { proprio: 'www-data' }) }, { proprio: 'www-data' }),
          '2026': lieu({ 'sortie-port': lieu({ 'raw.tar': photo(212_000_000_000) }, { proprio: 'www-data' }) }, { proprio: 'www-data' }),
          '2027': lieu(
            {
              'concours-nuit': lieu({ 'raw.tar': photo(391_000_000_000) }, { proprio: 'www-data' }),
              // Chapitre 3 : les archives de l'automne, versées d'un coup.
              ...(plus.hiver ? { 'archives-automne': lieu({ 'raw.tar': photo(1_259_000_000_000) }, { proprio: 'www-data' }) } : {}),
            },
            { proprio: 'www-data' },
          ),
        },
        { proprio: 'www-data', groupe: 'www-data' },
      ),
      // Le point de montage du disque des numérisations (chapitre 4).
      ...(plus.secours ? { scans: lieu({}, { proprio: 'root' }) } : {}),
    }),
    tmp: lieu({}, { proprio: 'root', mode: 'rwxrwxrwt' }),
    usr: lieu({ lib: f('', { proprio: 'root', taille: 2_900_000_000 }) }),
    var: lieu({
      log: lieu({ syslog: f(t('labo-syslog'), { lignes: true, proprio: 'root', groupe: 'adm', mode: 'rw-r-----' }) }),
      mail: lieu(
        plus.mail === undefined ? {} : { vous: f(plus.mail, { lignes: true, proprio: 'vous', groupe: 'mail', mode: 'rw-rw----' }) },
        { proprio: 'root', groupe: 'mail', mode: 'rwxrwsr-x' },
      ),
      www: lieu({ galerie: lieu({ 'index.html': fichier('<!doctype html><title>Le Labo</title>', { proprio: 'www-data' }) }) }),
    }),
  });
}

/** Avant chaque commande : le temps a passé depuis la précédente (la reconstruction avance). */
export function avantCommandeLabo(j: Jeu): void {
  tempsQuiPasse(j as Shell);
  majDev(j);
}

