// Histoire « L'Astreinte » — chapitre « La mémoire » : à 4 h 12, le direct
// de Radio Quartier passe du silence. La playlist automatique de la nuit
// (radio-playlist, un programme Node) a été tuée par l'OOM killer du noyau :
// elle garde en mémoire tout ce qu'elle lit, sans jamais rien oublier (une
// fuite). La relancer ne suffit pas : elle regrossit, et le noyau finit par
// tuer le plus gros processus. On la contient avec une limite systemd
// (MemoryMax=), qu'on fait relancer en cas d'échec (Restart=on-failure),
// le temps que les développeur·ses corrigent la fuite. Au passage, des
// processus zombies que kill ne tue pas : seul leur parent peut les
// récupérer (le redémarrer).
// Objectif vérifié sur l'état : la playlist tourne, avec une limite de
// mémoire raisonnable et une relance automatique, et plus aucun zombie.
// Sources : https://www.freedesktop.org/software/systemd/man/latest/systemd.resource-control.html,
// https://www.freedesktop.org/software/systemd/man/latest/systemd.service.html#Restart=,
// https://man7.org/linux/man-pages/man1/free.1.html, https://man7.org/linux/man-pages/man2/wait.2.html

import { d, f, fichiersComptes, type Chapitre, type Comptes, type Droits } from '../monde';
import type { Jeu } from '../shell';
import { journaliser, nouveauSystemd, systemd, type Service } from '../systemd';
import { memoire, noyau, processus, verifierMemoire } from '../memoire';
import type { Processus } from '../commandes/systeme';

const M = '/home/vous';
const Mo = 1024 * 1024;
// La playlist démarre avec 200 Mio et en prend 60 de plus à chaque instant.
const DEPART = 200 * Mo;
const FUITE = 60 * Mo;
const PODCAST = 2305;
const ZOMBIES = [2411, 2427, 2448, 2463];

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

const sd = (j: Jeu) => systemd(j)!;
const playlist = (j: Jeu): Service => sd(j).services['radio-playlist'];
const active = (j: Jeu) => playlist(j).etat === 'active';
const zombies = (j: Jeu) => processus(j).filter((p) => p.zombie);
const tues = (j: Jeu): { service: string; cgroup: boolean; relance: boolean }[] =>
  (j.etat.oomTues ?? []).filter((t: { service: string }) => t.service === 'radio-playlist');

// Une limite qui protège la machine sans empêcher la playlist de démarrer.
const limiteRaisonnable = (j: Jeu) => {
  const max = playlist(j).memoireMax;
  return max !== undefined && max >= 256 * Mo && max <= 1024 * Mo;
};
const relance = (j: Jeu) => ['on-failure', 'always', 'on-abnormal'].includes(playlist(j).redemarrage ?? '');

// Chaque démarrage : un nouveau processus, qui repart de 200 Mio.
function lancerPlaylist(j: Jeu) {
  const pid = (j.etat.prochainPid = (j.etat.prochainPid ?? 2600) + 1);
  const s = playlist(j);
  s.processus = [{ pid, utilisateur: 'radio', cpu: 2.0, mem: 0, commande: '/usr/bin/node /opt/playlist/server.js' }];
  memoire(j)!.rss[pid] = DEPART;
  j.etat.memoireDemandeur = pid;
}

function lancerPodcast(j: Jeu) {
  const s = sd(j).services['radio-podcast'];
  // Au premier démarrage, le parent des zombies ; ensuite, un nouveau processus.
  const pid = j.etat.podcastLance ? (j.etat.prochainPid = (j.etat.prochainPid ?? 2600) + 1) : PODCAST;
  j.etat.podcastLance = true;
  s.processus = [{ pid, utilisateur: 'radio', cpu: 0.3, mem: 0, commande: '/usr/bin/python3 /opt/podcast/convertir.py' }];
  memoire(j)!.rss[pid] = 160 * Mo;
}

const proc = (pid: number, utilisateur: string, commande: string, extra: Partial<Processus> = {}): Processus => ({
  pid,
  utilisateur,
  cpu: 0,
  mem: 0,
  commande,
  ...extra,
});

export const memoireChapitre: Chapitre = {
  id: 'memoire',
  numero: 2,
  commandes: [
    'ls',
    'cd',
    'pwd',
    'cat',
    'less',
    'head',
    'tail',
    'grep',
    'wc',
    'find',
    'echo',
    'id',
    'whoami',
    'mkdir',
    'touch',
    'cp',
    'ps',
    'kill',
    'sudo',
    'nano',
    'systemctl',
    'journalctl',
    'free',
    'top',
    'dmesg',
  ],
  maison: M,
  accueil: 'message_de_zoe.txt',
  noms: true,
  final: 'fin',
  motDePasse: 'antenne-2027',
  comptes,
  etat: () => ({
    systemd: nouveauSystemd('radio', Date.UTC(2027, 7, 1, 6, 0, 0), Date.UTC(2027, 7, 22, 4, 12, 0), {
      ssh: {
        description: 'OpenBSD Secure Shell server',
        active: true,
        executable: 'sshd',
        processus: [proc(598, 'root', 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups')],
      },
      'radio-stream': {
        description: 'Radio Quartier stream relay',
        active: true,
        executable: 'stream',
        processus: [proc(1730, 'radio', '/usr/local/bin/stream --config /etc/radio/stream.conf', { cpu: 3.2 })],
      },
      'radio-playlist': { description: 'Radio Quartier night playlist', active: true, executable: 'node', charger: lancerPlaylist },
      'radio-podcast': { description: 'Radio Quartier podcast converter', active: true, executable: 'python3', charger: lancerPodcast },
      cron: {
        description: 'Regular background program processing daemon',
        active: true,
        executable: 'cron',
        processus: [proc(611, 'root', '/usr/sbin/cron -f')],
      },
    }),
    processus: [
      proc(1, 'root', '/sbin/init'),
      proc(598, 'root', 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups'),
      proc(611, 'root', '/usr/sbin/cron -f'),
      proc(1730, 'radio', '/usr/local/bin/stream --config /etc/radio/stream.conf', { cpu: 3.2 }),
      ...ZOMBIES.map((pid) => proc(pid, 'radio', '[convertir] <defunct>', { ppid: PODCAST, zombie: true })),
    ],
    memoire: { total: 2048 * Mo, noyau: 380 * Mo, rss: { 1: 12 * Mo, 598: 8 * Mo, 611: 4 * Mo, 1730: 420 * Mo } },
  }),
  // La nuit jusqu'ici : la playlist grossit depuis son démarrage, et à 4 h 12, plus de mémoire.
  initialiser: (j) => {
    const s = sd(j);
    const debut = s.journal[0].temps;
    // Quelques lignes du démarrage, pour dmesg.
    const horloge = s.horloge;
    [
      'Linux version 6.12.0-quetes (radio)',
      'Memory: 2097152K/2097152K available',
      'EXT4-fs (vda1): mounted filesystem with ordered data mode.',
    ].forEach((texte, i) => (j.etat.noyau ??= []).push({ temps: debut + i * 211, texte }));
    lancerPlaylist(j);
    lancerPodcast(j);
    for (const nom of ['radio-playlist', 'radio-podcast']) {
      const svc = s.services[nom];
      j.etat.processus.push({ ...svc.processus[0] });
    }
    const pid = playlist(j).processus[0].pid;
    s.horloge = debut + 60_000;
    journaliser(s, 'radio-playlist.service', 'node', pid, 'playlist: 2214 tracks loaded, cache enabled (no size limit)');
    s.horloge = horloge - 14 * 60_000;
    journaliser(s, 'radio-playlist.service', 'node', pid, 'playlist: cache holds 41208 decoded chunks (1.4 GB)', 4);
    s.horloge = Date.UTC(2027, 7, 22, 4, 12, 30);
    memoire(j)!.rss[pid] = 1700 * Mo;
    verifierMemoire(j);
    journaliser(s, 'radio-stream.service', 'stream', 1730, 'relay: source disconnected (playlist), streaming silence', 4);
    s.horloge = Date.UTC(2027, 7, 22, 4, 31, 0);
    j.etat.oomTues = [];
  },
  // La playlist (si elle tourne) prend de la mémoire à chaque instant ; le noyau et systemd veillent.
  apresCommande: (j) => {
    // Chaque commande, une demi-minute de la nuit.
    sd(j).horloge += 30_000;
    if (active(j)) {
      const pid = playlist(j).processus[0].pid;
      const m = memoire(j)!;
      m.rss[pid] = (m.rss[pid] ?? DEPART) + FUITE;
      j.etat.memoireDemandeur = pid;
    }
    verifierMemoire(j);
  },
  creerMonde: (t) => {
    const racine: Droits = { proprio: 'root' };
    const lieu = (enfants: Parameters<typeof d>[0], droits: Droits = racine) => d(enfants, undefined, droits);
    const fichier = (texte: string, droits: Droits = racine) => f(texte, { lignes: true, ...droits });
    const unite = (description: string, commande: string) =>
      fichier(
        `[Unit]\nDescription=${description}\nAfter=network.target\n\n[Service]\nUser=radio\nExecStart=${commande}\n\n[Install]\nWantedBy=multi-user.target`,
      );
    return lieu({
      etc: lieu({ ...fichiersComptes(), hostname: fichier('radio'), systemd: lieu({ system: lieu({}) }) }),
      home: lieu({ vous: d({ 'message_de_zoe.txt': f(t('memoire-message-de-zoe')) }), zoe: lieu({}, { proprio: 'zoe', mode: 'rwx------' }) }),
      opt: lieu({
        playlist: lieu({ 'server.js': fichier(t('memoire-server-js')) }),
        podcast: lieu({ 'convertir.py': fichier(t('memoire-convertir-py')) }),
      }),
      tmp: lieu({}, { proprio: 'root', mode: 'rwxrwxrwt' }),
      usr: lieu({
        lib: lieu({
          systemd: lieu({
            system: lieu({
              'radio-playlist.service': unite('Radio Quartier night playlist', '/usr/bin/node /opt/playlist/server.js'),
              'radio-podcast.service': unite('Radio Quartier podcast converter', '/usr/bin/python3 /opt/podcast/convertir.py'),
              'radio-stream.service': unite('Radio Quartier stream relay', '/usr/local/bin/stream --config /etc/radio/stream.conf'),
            }),
          }),
        }),
      }),
      var: lieu({ lib: lieu({ radio: lieu({}, { proprio: 'radio' }) }) }),
    });
  },
  evenements: [
    { id: 'oom', condition: (j) => /Out of memory|oom-kill|OOM killer/.test(j.derniere.sortie), message: (j) => j.t('memoire-evenement-oom') },
    {
      id: 'zombies',
      condition: (j) => /<defunct>| Z /.test(j.derniere.sortie) && j.derniere.commandes.some((c) => c.includes('ps') || c.includes('top')),
      message: (j) => j.t('memoire-evenement-zombies'),
    },
    {
      id: 'kill-zombie',
      condition: (j) => j.derniere.commandes.some((c) => c.includes('kill') && c.some((a) => ZOMBIES.includes(Number(a)))) && zombies(j).length > 0,
      message: (j) => j.t('memoire-evenement-kill-zombie'),
    },
    {
      id: 'grossit',
      condition: (j) =>
        active(j) &&
        !playlist(j).memoireMax &&
        (memoire(j)!.rss[playlist(j).processus[0].pid] ?? 0) >= DEPART + 4 * FUITE &&
        j.derniere.commandes.some(
          (c) => ['free', 'top', 'ps', 'systemctl'].includes(c[0]) || (c[0] === 'sudo' && ['free', 'top', 'ps', 'systemctl'].includes(c[1])),
        ),
      message: (j) => j.t('memoire-evenement-grossit'),
    },
    { id: 'encore', condition: (j) => tues(j).some((t) => !t.cgroup), message: (j) => j.t('memoire-evenement-encore') },
    { id: 'trop-bas', condition: (j) => (playlist(j).memoireMax ?? Infinity) < 256 * Mo, message: (j) => j.t('memoire-evenement-trop-bas') },
    { id: 'trop-haut', condition: (j) => (playlist(j).memoireMax ?? 0) > 1024 * Mo, message: (j) => j.t('memoire-evenement-trop-haut') },
    { id: 'sans-relance', condition: (j) => tues(j).some((t) => t.cgroup) && !active(j), message: (j) => j.t('memoire-evenement-sans-relance') },
    { id: 'contenue', condition: (j) => tues(j).some((t) => t.cgroup && t.relance) && active(j), message: (j) => j.t('memoire-evenement-contenue') },
    { id: 'sans-zombies', condition: (j) => zombies(j).length === 0, message: (j) => j.t('memoire-evenement-sans-zombies') },
    {
      id: 'fin',
      condition: (j) => active(j) && limiteRaisonnable(j) && relance(j) && zombies(j).length === 0 && sd(j).services['radio-stream'].etat === 'active',
      message: (j) => j.t('memoire-evenement-fin'),
    },
  ],
};
