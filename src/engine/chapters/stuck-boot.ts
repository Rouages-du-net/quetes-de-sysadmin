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

import { f, type Chapter } from '../world';
import type { Game, Shell } from '../shell';
import { devUpdate } from '../storage';
import { blocking, readFstab, resolveSource, deviceUnit, mountUnit } from '../fstab';
import { writeLog, start, systemd } from '../systemd';
import { mountToBoot } from '../commands/disks';
import { labAccounts, labState, labWorld, labKernel, st, UUID_SCANS } from './lab';

const R = '/root';
const BANNER = [
  'You are in emergency mode. After logging in, type "journalctl -xb" to view',
  'system logs, "systemctl reboot" to reboot, or "exit"',
  'to continue bootup.',
].join('\n');

const fstab = (j: Game) => j.read('/etc/fstab') ?? '';
const scansLine = (j: Game) => readFstab(fstab(j)).inputs.find((e) => e.target === '/srv/scans');
// La ligne des scans désigne le disque par ce qui ne change pas : son UUID ou son étiquette.
const byId = (j: Game) => {
  const e = scansLine(j);
  return !!e && /^(UUID=|LABEL=|\/dev\/disk\/by-(uuid|label)\/)/.test(e.source) && resolveSource(st(j), e.source) === '/dev/sde1';
};
const withNofail = (j: Game) => !!scansLine(j)?.options.includes('nofail');
const healthy = (j: Game) => blocking(st(j), fstab(j)).length === 0 && readFstab(fstab(j)).errors.length === 0;
const mounted = (j: Game) => ((j.state.montages ?? []) as { path: string; name: string }[]).some((m) => m.path === '/srv/scans' && m.name === '/dev/sde1');
const fstabOk = (j: Game) => byId(j) && withNofail(j) && healthy(j);

// La machine s'arrête en mode secours : ce que systemd écrit au journal.
function enterInRescue(j: Game): void {
  const sd = systemd(j)!;
  const e = blocking(st(j), j.state.fstabLue ?? fstab(j))[0];
  const dev = deviceUnit(e.source);
  const mount = mountUnit(e.target);
  sd.clock += 90_000;
  writeLog(sd, dev, 'systemd', 1, `${dev}: Job ${dev}/start timed out.`, 4);
  writeLog(sd, dev, 'systemd', 1, `Timed out waiting for device ${dev} - ${e.source}.`, 3);
  writeLog(sd, mount, 'systemd', 1, `Dependency failed for systemd-fsck@${dev.replace(/\.device$/, '')}.service - File System Check on ${e.source}.`, 3);
  writeLog(sd, mount, 'systemd', 1, `Dependency failed for ${mount} - ${e.target}.`, 3);
  writeLog(sd, 'local-fs.target', 'systemd', 1, 'Dependency failed for local-fs.target - Local File Systems.', 3);
  writeLog(sd, 'local-fs.target', 'systemd', 1, "local-fs.target: Job local-fs.target/start failed with result 'dependency'.", 4);
  writeLog(sd, 'local-fs.target', 'systemd', 1, 'local-fs.target: Triggering OnFailure= dependencies.', 5);
  writeLog(sd, 'emergency.service', 'systemd', 1, 'Started emergency.service - Emergency Shell.');
  writeLog(sd, 'emergency.target', 'systemd', 1, 'Reached target emergency.target - Emergency Mode.');
  j.state.secours = true;
  j.state.rechutes = (j.state.rechutes ?? 0) + 1;
  // Rechute avec une fstab déjà juste : systemd n'a simplement pas relu le fichier.
  if (fstabOk(j)) j.state.rechuteSansReload = true;
}

// Au démarrage (reboot) : systemd lit fstab tel qu'il est sur le disque.
function startMounts(j: Game): boolean {
  j.state.fstabLue = fstab(j);
  if (blocking(st(j), fstab(j)).length) {
    enterInRescue(j);
    return false;
  }
  mountToBoot(j as Shell);
  j.state.secours = false;
  return true;
}

// systemctl default (ou exit) : systemd reprend le démarrage avec fstab tel qu'il l'a lu (daemon-reload).
function continueBoot(j: Shell): string {
  if (!j.state.secours) return '';
  if (blocking(st(j), j.state.fstabLue ?? fstab(j)).length) {
    enterInRescue(j);
    return BANNER;
  }
  mountToBoot(j);
  const sd = systemd(j)!;
  writeLog(sd, 'local-fs.target', 'systemd', 1, 'Reached target local-fs.target - Local File Systems.');
  for (const [name, s] of Object.entries(sd.services)) if (s.active && s.state !== 'active') start(j, sd, name, true);
  writeLog(sd, 'multi-user.target', 'systemd', 1, 'Reached target multi-user.target - Multi-User System.');
  j.state.secours = false;
  return '';
}

export const rescue: Chapter = {
  id: 'stuck-boot',
  number: 4,
  commands: [
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
  home: R,
  welcome: 'message_d_odile.txt',
  names: true,
  final: 'fin',
  steps: ['journal', 'disques', 'corrige', 'monte', 'fin'],
  accounts: labAccounts,
  state: () => ({ ...labState('secours'), secours: true, consoleHebergeur: true }),
  initialise: (j) => {
    labKernel(j, 'secours');
    devUpdate(j);
    // On travaille en root sur la console de l'hébergeur.
    j.who = 'root';
    j.state.fstabLue = fstab(j);
    j.state.demarrerMontages = startMounts;
    j.state.continuerDemarrage = continueBoot;
    j.state.banniereSecours = BANNER;
    // La machine est arrêtée en mode secours : aucun service n'a démarré.
    for (const s of Object.values(systemd(j)!.services)) s.state = 'inactive';
    enterInRescue(j);
    j.state.rechutes = 0;
  },
  createWorld: (t) => labWorld(t, { 'message_d_odile.txt': f(t('stuck-boot-message-d-odile', { banniere: BANNER })) }, { winter: true, rescue: true }),
  events: [
    {
      id: 'journal',
      condition: (j) => j.last.output.includes('Timed out waiting for device'),
      message: (j) => j.t('stuck-boot-evenement-journal'),
    },
    {
      id: 'disques',
      condition: (j) => j.last.output.includes(UUID_SCANS) || /sde1.*SCANS|SCANS.*sde1/.test(j.last.output),
      message: (j) => j.t('stuck-boot-evenement-disques'),
    },
    {
      id: 'nom',
      condition: (j) => scansLine(j)?.source === '/dev/sde1',
      message: (j) => j.t('stuck-boot-evenement-nom'),
    },
    {
      id: 'supprimee',
      condition: (j) => !scansLine(j),
      message: (j) => j.t('stuck-boot-evenement-supprimee'),
    },
    {
      id: 'lecture',
      condition: (j) => readFstab(fstab(j)).errors.length > 0,
      message: (j) => j.t('stuck-boot-evenement-lecture'),
    },
    {
      id: 'sans-nofail',
      condition: (j) => byId(j) && !withNofail(j),
      message: (j) => j.t('stuck-boot-evenement-sans-nofail'),
    },
    { id: 'corrige', condition: fstabOk, message: (j) => j.t('stuck-boot-evenement-corrige') },
    { id: 'rechute', condition: (j) => (j.state.rechutes ?? 0) > 0 && !fstabOk(j), message: (j) => j.t('stuck-boot-evenement-rechute') },
    { id: 'rechute-reload', condition: (j) => !!j.state.rechuteSansReload, message: (j) => j.t('stuck-boot-evenement-rechute-reload') },
    { id: 'monte', condition: mounted, message: (j) => j.t('stuck-boot-evenement-monte') },
    {
      id: 'fin',
      condition: (j) => fstabOk(j) && mounted(j) && !j.state.secours,
      message: (j) => j.t('stuck-boot-evenement-fin'),
    },
  ],
};
