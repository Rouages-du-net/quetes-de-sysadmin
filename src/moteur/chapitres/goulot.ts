// Histoire « L'Astreinte » — chapitre « Le goulot » : chaque jour à 16 h,
// le direct de Radio Quartier hoquette. La machine semble lente, mais le
// processeur ne fait presque rien : il attend le disque (iowait). L'archivage
// du jour (radio-archives, un rsync lancé par un timer) recopie les
// enregistrements sur le même disque aussi vite qu'il peut, et le relais du
// direct n'obtient plus ses lectures à temps.
//   - comprendre : top (wa), iostat -x (%util, r_await), pidstat -d (qui) ;
//   - piège réel : ionice -c3 est accepté… et ne change rien, l'ordonnanceur
//     du disque virtuel (none, /sys/block/vda/queue/scheduler) ignore les
//     priorités ;
//   - limiter le débit de l'archivage avec systemd (IOWriteBandwidthMax=,
//     cgroup v2 io.max), pour aujourd'hui et pour demain, sans l'arrêter :
//     les émissions du jour doivent être archivées.
// Objectif vérifié sur l'état : le relais du direct est servi à temps,
// l'archivage tourne toujours, avec une limite de débit enregistrée (dans
// /etc) sur le bon disque, ni trop basse ni trop haute.
// Sources : https://man7.org/linux/man-pages/man1/iostat.1.html,
// https://www.freedesktop.org/software/systemd/man/latest/systemd.resource-control.html#IOReadBandwidthMax=device%20bytes,
// https://docs.kernel.org/admin-guide/cgroup-v2.html#io

import { chemin, d, f, fichiersComptes, type Chapitre, type Comptes, type Droits } from '../monde';
import type { Jeu } from '../shell';
import type { Traduire } from '../../textes';
import { journaliser, nouveauSystemd, systemd, type Service } from '../systemd';
import { etatDisque, io, prioritesActives, servieATemps, visePartition, type EtatIO } from '../entrees-sorties';
import type { Processus } from '../commandes/systeme';

const M = '/home/vous';
const Mo = 1024 * 1024;
const ARCHIVES = 2190;
// La copie du jour (rsync), dans la langue : /srv/radio/recordings/… en anglais.
const copie = (t: Traduire) => `rsync -a ${chemin(t, '/srv/radio/enregistrements')}/ /srv/archives/2027-09-20/`;
// Le relais lit le direct ici.
const tampon = (t: Traduire) => chemin(t, '/srv/radio/direct/buffer.ts');
const FLUX = 1730;
// Lundi 20 septembre 2027, 16 h 14 : l'émission de l'après-midi est en direct.
const MAINTENANT = Date.UTC(2027, 8, 20, 16, 14, 0);
const CAPACITE = 150_000;

const comptes = (): Comptes => ({
  utilisateurs: {
    root: { uid: 0, groupe: 'root', maison: '/root' },
    radio: { uid: 996, groupe: 'radio', maison: '/var/lib/radio', shell: '/usr/sbin/nologin' },
    vous: { uid: 1000, groupe: 'vous' },
    zoe: { uid: 1001, groupe: 'zoe' },
  },
  groupes: {
    root: { gid: 0, membres: [] },
    adm: { gid: 4, membres: ['vous', 'zoe'] },
    sudo: { gid: 27, membres: ['vous', 'zoe'] },
    radio: { gid: 996, membres: [] },
    vous: { gid: 1000, membres: [] },
    zoe: { gid: 1001, membres: [] },
  },
});

const proc = (pid: number, utilisateur: string, commande: string, cpu = 0): Processus => ({ pid, utilisateur, cpu, mem: 0.4, commande });
const sd = (j: Jeu) => systemd(j)!;
const archives = (j: Jeu): Service => sd(j).services['radio-archives'];
const tourne = (j: Jeu) => archives(j).etat === 'active' && (j.etat.processus ?? []).some((p: Processus) => p.pid === archives(j).processus[0]?.pid);
const limite = (j: Jeu) => [archives(j).ioEcriture, archives(j).ioLecture].filter((l) => l && visePartition(l.appareil, (io(j) as EtatIO).disque));
// Assez lente pour laisser le direct, assez rapide pour finir dans la soirée (au moins 5 Mio/s).
const raisonnable = (j: Jeu) => limite(j).length > 0 && limite(j).every((l) => l!.octets >= 5 * Mo) && servieATemps(j);

export const goulot: Chapitre = {
  id: 'goulot',
  numero: 7,
  commandes: [
    'ls',
    'cd',
    'pwd',
    'cat',
    'less',
    'head',
    'tail',
    'grep',
    'id',
    'whoami',
    'sudo',
    'nano',
    'systemctl',
    'journalctl',
    'ps',
    'top',
    'free',
    'kill',
    'df',
    'iostat',
    'pidstat',
    'ionice',
  ],
  maison: M,
  accueil: 'message_de_zoe.txt',
  noms: true,
  final: 'fin',
  motDePasse: 'antenne-2027',
  comptes,
  etat: (t) => ({
    systemd: (() => {
      const s = nouveauSystemd('radio', Date.UTC(2027, 8, 14, 7, 2, 0), MAINTENANT, {
        ssh: {
          description: 'OpenBSD Secure Shell server',
          active: true,
          executable: 'sshd',
          processus: [proc(598, 'root', 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups')],
        },
        'radio-flux': {
          description: 'Radio Quartier stream relay',
          active: true,
          executable: 'flux',
          processus: [proc(FLUX, 'radio', '/usr/local/bin/flux --config /etc/radio/flux.conf', 3.2)],
        },
        'radio-archives': {
          description: "Radio Quartier: archive the day's recordings",
          active: false,
          executable: 'rsync',
          processus: [proc(ARCHIVES, 'root', copie(t), 6.1)],
        },
      });
      s.minuteries = {
        'radio-archives': {
          description: "Archive the day's recordings",
          unite: 'radio-archives',
          calendrier: ['*-*-* 16:00'],
          active: true,
          etat: 'active',
          depuis: s.horloge,
          fichier: '/usr/lib/systemd/system/radio-archives.timer',
          dernier: Date.UTC(2027, 8, 20, 16, 0, 0),
        },
      };
      return s;
    })(),
    processus: [
      proc(1, 'root', '/sbin/init'),
      proc(312, 'root', '[jbd2/vda1-8]'),
      proc(598, 'root', 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups'),
      proc(FLUX, 'radio', '/usr/local/bin/flux --config /etc/radio/flux.conf', 3.2),
      proc(ARCHIVES, 'root', copie(t), 6.1),
    ],
    memoire: { total: 2048 * Mo, noyau: 380 * Mo, rss: { 1: 12 * Mo, 312: 0, 598: 8 * Mo, [FLUX]: 180 * Mo, [ARCHIVES]: 40 * Mo } },
    io: {
      disque: 'vda',
      ordonnanceur: 'none',
      capacite: CAPACITE,
      cpus: 2,
      classes: {},
      demandes: [
        { service: 'radio-archives', lecture: 70_000, ecriture: 70_000, copie: true },
        { service: 'radio-flux', lecture: 2048, ecriture: 0, sensible: true },
        { pid: 312, lecture: 0, ecriture: 180 },
      ],
    } satisfies EtatIO,
  }),
  initialiser: (j) => {
    const s = sd(j);
    // L'archivage a démarré à 16 h (par son timer), et le direct hoquette depuis.
    s.services['radio-archives'].etat = 'active';
    s.horloge = Date.UTC(2027, 8, 20, 16, 0, 0);
    journaliser(s, 'radio-archives.service', 'systemd', 1, "Started radio-archives.service - Radio Quartier: archive the day's recordings.");
    for (let i = 0; i < 9; i++) {
      s.horloge = Date.UTC(2027, 8, 20, 16, 1 + i * 1.5, 7 * i);
      journaliser(
        s,
        'radio-flux.service',
        'flux',
        FLUX,
        `relay: read stall on ${tampon(j.t)}: waited ${610 + ((i * 97) % 300)} ms, listeners hear a gap`,
        4,
        false,
      );
    }
    s.horloge = MAINTENANT;
  },
  // Chaque commande, une demi-minute : tant que le disque est saturé, le direct hoquette encore.
  apresCommande: (j) => {
    const s = sd(j);
    s.horloge += 30_000;
    if (!servieATemps(j))
      journaliser(
        s,
        'radio-flux.service',
        'flux',
        FLUX,
        `relay: read stall on ${tampon(j.t)}: waited ${Math.round(etatDisque(j).attente)} ms, listeners hear a gap`,
        4,
        false,
      );
  },
  creerMonde: (t) => {
    const racine: Droits = { proprio: 'root' };
    const lieu = (enfants: Parameters<typeof d>[0], droits: Droits = racine) => d(enfants, undefined, droits);
    const fichier = (texte: string, droits: Droits = racine) => f(texte, { lignes: true, ...droits });
    return lieu({
      etc: lieu({ ...fichiersComptes(), hostname: fichier('radio'), systemd: lieu({ system: lieu({}) }) }),
      home: lieu({ vous: d({ 'message_de_zoe.txt': f(t('goulot-message-de-zoe')) }), zoe: lieu({}, { proprio: 'zoe', mode: 'rwx------' }) }),
      sys: lieu({ block: lieu({ vda: lieu({ queue: lieu({ scheduler: fichier('[none] mq-deadline'), rotational: fichier('0') }) }) }) }),
      srv: lieu({ radio: lieu({ enregistrements: lieu({}), direct: lieu({}) }, { proprio: 'radio' }), archives: lieu({}) }),
      usr: lieu({
        lib: lieu({
          systemd: lieu({
            system: lieu({
              'radio-flux.service': fichier(
                '[Unit]\nDescription=Radio Quartier stream relay\nAfter=network.target\n\n[Service]\nUser=radio\nExecStart=/usr/local/bin/flux --config /etc/radio/flux.conf\n\n[Install]\nWantedBy=multi-user.target',
              ),
              'radio-archives.service': fichier(
                `[Unit]\nDescription=Radio Quartier: archive the day's recordings\n\n[Service]\nType=oneshot\nExecStart=/bin/sh -c 'rsync -a ${chemin(t, '/srv/radio/enregistrements')}/ /srv/archives/$(date +%%F)/'`,
              ),
              'radio-archives.timer': fichier(
                "[Unit]\nDescription=Archive the day's recordings\n\n[Timer]\nOnCalendar=*-*-* 16:00\n\n[Install]\nWantedBy=timers.target",
              ),
            }),
          }),
        }),
      }),
    });
  },
  evenements: [
    {
      id: 'iowait',
      condition: (j) => !servieATemps(j) && j.derniere.commandes.some((c) => c.includes('top')),
      message: (j) => j.t('goulot-evenement-iowait'),
    },
    {
      id: 'ionice',
      condition: (j) => (io(j) as EtatIO).classes[ARCHIVES]?.classe === 3 && !prioritesActives(io(j) as EtatIO),
      message: (j) => j.t('goulot-evenement-ionice'),
    },
    { id: 'arret', condition: (j) => !tourne(j), message: (j) => j.t('goulot-evenement-arret') },
    {
      id: 'mauvais-disque',
      condition: (j) => [archives(j).ioEcriture, archives(j).ioLecture].some((l) => l && !visePartition(l.appareil, 'vda')),
      message: (j) => j.t('goulot-evenement-mauvais-disque'),
    },
    { id: 'trop-lent', condition: (j) => limite(j).some((l) => l!.octets < 5 * Mo), message: (j) => j.t('goulot-evenement-trop-lent') },
    { id: 'fin', condition: (j) => tourne(j) && raisonnable(j), message: (j) => j.t('goulot-evenement-fin') },
  ],
};
