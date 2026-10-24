// Histoire « Le Labo » — chapitre « Le redémarrage qui coince » : cette
// nuit, le serveur a redémarré (un nouveau noyau) et ne s'en est pas remis.
// Théo, bénévole, avait ajouté le disque USB des numérisations dans
// /etc/fstab par son nom, /dev/sdc1, d'après un tutoriel suivi sur son
// portable. Depuis le chapitre 3, sdc est un des disques de 4 To (dans
// md2) : le disque USB s'appelle maintenant sde. systemd attend /dev/sdc1,
// abandonne au bout de 90 secondes, et la machine s'arrête en mode secours.
// On lit le journal (journalctl -xb), on trouve le disque par son UUID
// (lsblk -f, blkid), on corrige fstab (UUID=…, nofail : Théo l'emporte
// parfois), on vérifie (findmnt --verify, mount -a), on fait relire fstab à
// systemd (daemon-reload), et on reprend le démarrage (systemctl default,
// exit ou reboot).
// Objectif vérifié sur l'état : fstab désigne le disque des scans par son
// UUID (ou son étiquette), avec nofail, aucune ligne ne bloque plus le
// démarrage, le disque est monté sur /srv/scans, et la machine a quitté le
// mode secours.
// Sources : fstab(5), systemd.mount(5), findmnt(8), blkid(8),
// https://wiki.debian.org/fstab, https://www.freedesktop.org/software/systemd/man/latest/systemd-fstab-generator.html

import { f, type Chapitre } from '../monde';
import type { Jeu, Shell } from '../shell';
import { majDev } from '../stockage';
import { bloquantes, lireFstab, resoudreSource, uniteDevice, uniteMontage } from '../fstab';
import { journaliser, demarrer, systemd } from '../systemd';
import { monterAuDemarrage } from '../commandes/disques';
import { comptesLabo, etatLabo, mondeLabo, noyauLabo, st, UUID_SCANS } from './labo';

const R = '/root';
const BANNIERE = [
  'You are in emergency mode. After logging in, type "journalctl -xb" to view',
  'system logs, "systemctl reboot" to reboot, or "exit"',
  'to continue bootup.',
].join('\n');

const fstab = (j: Jeu) => j.lire('/etc/fstab') ?? '';
const ligneScans = (j: Jeu) => lireFstab(fstab(j)).entrees.find((e) => e.cible === '/srv/scans');
// La ligne des scans désigne le disque par ce qui ne change pas : son UUID ou son étiquette.
const parIdentifiant = (j: Jeu) => {
  const e = ligneScans(j);
  return !!e && /^(UUID=|LABEL=|\/dev\/disk\/by-(uuid|label)\/)/.test(e.source) && resoudreSource(st(j), e.source) === '/dev/sde1';
};
const avecNofail = (j: Jeu) => !!ligneScans(j)?.options.includes('nofail');
const sain = (j: Jeu) => bloquantes(st(j), fstab(j)).length === 0 && lireFstab(fstab(j)).erreurs.length === 0;
const monte = (j: Jeu) => ((j.etat.montages ?? []) as { chemin: string; nom: string }[]).some((m) => m.chemin === '/srv/scans' && m.nom === '/dev/sde1');
const fstabOk = (j: Jeu) => parIdentifiant(j) && avecNofail(j) && sain(j);

// La machine s'arrête en mode secours : ce que systemd écrit au journal.
function entrerEnSecours(j: Jeu): void {
  const sd = systemd(j)!;
  const e = bloquantes(st(j), j.etat.fstabLue ?? fstab(j))[0];
  const dev = uniteDevice(e.source);
  const montage = uniteMontage(e.cible);
  sd.horloge += 90_000;
  journaliser(sd, dev, 'systemd', 1, `${dev}: Job ${dev}/start timed out.`, 4);
  journaliser(sd, dev, 'systemd', 1, `Timed out waiting for device ${dev} - ${e.source}.`, 3);
  journaliser(sd, montage, 'systemd', 1, `Dependency failed for systemd-fsck@${dev.replace(/\.device$/, '')}.service - File System Check on ${e.source}.`, 3);
  journaliser(sd, montage, 'systemd', 1, `Dependency failed for ${montage} - ${e.cible}.`, 3);
  journaliser(sd, 'local-fs.target', 'systemd', 1, 'Dependency failed for local-fs.target - Local File Systems.', 3);
  journaliser(sd, 'local-fs.target', 'systemd', 1, "local-fs.target: Job local-fs.target/start failed with result 'dependency'.", 4);
  journaliser(sd, 'local-fs.target', 'systemd', 1, 'local-fs.target: Triggering OnFailure= dependencies.', 5);
  journaliser(sd, 'emergency.service', 'systemd', 1, 'Started emergency.service - Emergency Shell.');
  journaliser(sd, 'emergency.target', 'systemd', 1, 'Reached target emergency.target - Emergency Mode.');
  j.etat.secours = true;
  j.etat.rechutes = (j.etat.rechutes ?? 0) + 1;
  // Rechute avec une fstab déjà juste : systemd n'a simplement pas relu le fichier.
  if (fstabOk(j)) j.etat.rechuteSansReload = true;
}

// Au démarrage (reboot) : systemd lit fstab tel qu'il est sur le disque.
function demarrerMontages(j: Jeu): boolean {
  j.etat.fstabLue = fstab(j);
  if (bloquantes(st(j), fstab(j)).length) {
    entrerEnSecours(j);
    return false;
  }
  monterAuDemarrage(j as Shell);
  j.etat.secours = false;
  return true;
}

// systemctl default (ou exit) : systemd reprend le démarrage avec fstab tel qu'il l'a lu (daemon-reload).
function continuerDemarrage(j: Shell): string {
  if (!j.etat.secours) return '';
  if (bloquantes(st(j), j.etat.fstabLue ?? fstab(j)).length) {
    entrerEnSecours(j);
    return BANNIERE;
  }
  monterAuDemarrage(j);
  const sd = systemd(j)!;
  journaliser(sd, 'local-fs.target', 'systemd', 1, 'Reached target local-fs.target - Local File Systems.');
  for (const [nom, s] of Object.entries(sd.services)) if (s.active && s.etat !== 'active') demarrer(j, sd, nom, true);
  journaliser(sd, 'multi-user.target', 'systemd', 1, 'Reached target multi-user.target - Multi-User System.');
  j.etat.secours = false;
  return '';
}

export const secours: Chapitre = {
  id: 'secours',
  numero: 4,
  commandes: [
    'ls',
    'cd',
    'pwd',
    'cat',
    'less',
    'head',
    'tail',
    'grep',
    'echo',
    'nano',
    'id',
    'whoami',
    'df',
    'lsblk',
    'blkid',
    'findmnt',
    'mount',
    'umount',
    'dmesg',
    'journalctl',
    'systemctl',
    'reboot',
  ],
  maison: R,
  accueil: 'message_d_odile.txt',
  noms: true,
  final: 'fin',
  etapes: ['journal', 'disques', 'corrige', 'monte', 'fin'],
  comptes: comptesLabo,
  etat: () => ({ ...etatLabo('secours'), secours: true, consoleHebergeur: true }),
  initialiser: (j) => {
    noyauLabo(j, 'secours');
    majDev(j);
    // On travaille en root sur la console de l'hébergeur.
    j.qui = 'root';
    j.etat.fstabLue = fstab(j);
    j.etat.demarrerMontages = demarrerMontages;
    j.etat.continuerDemarrage = continuerDemarrage;
    j.etat.banniereSecours = BANNIERE;
    // La machine est arrêtée en mode secours : aucun service n'a démarré.
    for (const s of Object.values(systemd(j)!.services)) s.etat = 'inactive';
    entrerEnSecours(j);
    j.etat.rechutes = 0;
  },
  creerMonde: (t) => mondeLabo(t, { 'message_d_odile.txt': f(t('secours-message-d-odile', { banniere: BANNIERE })) }, { hiver: true, secours: true }),
  evenements: [
    {
      id: 'journal',
      condition: (j) => j.derniere.sortie.includes('Timed out waiting for device'),
      message: (j) => j.t('secours-evenement-journal'),
    },
    {
      id: 'disques',
      condition: (j) => j.derniere.sortie.includes(UUID_SCANS) || /sde1.*SCANS|SCANS.*sde1/.test(j.derniere.sortie),
      message: (j) => j.t('secours-evenement-disques'),
    },
    {
      id: 'nom',
      condition: (j) => ligneScans(j)?.source === '/dev/sde1',
      message: (j) => j.t('secours-evenement-nom'),
    },
    {
      id: 'supprimee',
      condition: (j) => !ligneScans(j),
      message: (j) => j.t('secours-evenement-supprimee'),
    },
    {
      id: 'lecture',
      condition: (j) => lireFstab(fstab(j)).erreurs.length > 0,
      message: (j) => j.t('secours-evenement-lecture'),
    },
    {
      id: 'sans-nofail',
      condition: (j) => parIdentifiant(j) && !avecNofail(j),
      message: (j) => j.t('secours-evenement-sans-nofail'),
    },
    { id: 'corrige', condition: fstabOk, message: (j) => j.t('secours-evenement-corrige') },
    { id: 'rechute', condition: (j) => (j.etat.rechutes ?? 0) > 0 && !fstabOk(j), message: (j) => j.t('secours-evenement-rechute') },
    { id: 'rechute-reload', condition: (j) => !!j.etat.rechuteSansReload, message: (j) => j.t('secours-evenement-rechute-reload') },
    { id: 'monte', condition: monte, message: (j) => j.t('secours-evenement-monte') },
    {
      id: 'fin',
      condition: (j) => fstabOk(j) && monte(j) && !j.etat.secours,
      message: (j) => j.t('secours-evenement-fin'),
    },
  ],
};
