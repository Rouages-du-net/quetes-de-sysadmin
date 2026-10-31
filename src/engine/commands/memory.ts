// La mémoire : free, top (un instantané, comme top -b -n 1) et dmesg (les
// messages du noyau, dont ceux de l'OOM killer), sur le modèle de
// ../memoire.ts. Sorties d'après procps-ng (free(1), top(1)) et
// util-linux (dmesg(1)) : https://man7.org/linux/man-pages/man1/free.1.html,
// https://man7.org/linux/man-pages/man1/top.1.html,
// https://man7.org/linux/man-pages/man1/dmesg.1.html
// Écarts : top n'est pas interactif (il affiche un instantané et rend la
// main) ; pas de swap ; la colonne available vaut free (le cache ne se
// libère pas dans le jeu).

import { etatDisque, io } from '../disk-io';
import type { Shell } from '../shell';
import type { Processus } from './system';
import { memoire, processus, tailleFree, utilisee } from '../memory';
import { systemd } from '../systemd';
import { processusDocker } from '../docker';
import type { Commande } from './index';

// Le noyau lui-même, hors cache (le reste de « noyau » est du cache disque).
const NOYAU_SEUL = 150 * 1024 * 1024;

function chiffresMemoire(jeu: Shell) {
  const m = memoire(jeu)!;
  const total = m.total;
  const occupee = Math.min(total, utilisee(jeu));
  const cache = Math.max(0, m.noyau - NOYAU_SEUL);
  const libre = total - occupee;
  return { total, used: occupee - cache, free: libre, shared: 12 * 1024 * 1024, cache, available: libre };
}

// Le démarrage de la machine : la première ligne du journal de ce démarrage.
const demarrage = (jeu: Shell) => {
  const sd = systemd(jeu)!;
  return sd.journal.find((e) => e.demarrage === sd.demarrage)?.temps ?? sd.horloge;
};

const nomCourt = (p: Processus) =>
  p.zombie ? p.commande.replace(/^\[(.*)\].*$/, '$1') : p.commande.split(/\s+/)[0].split('/').at(-1)!.replace(/:$/, '');

function free(jeu: Shell, args: string[]): string {
  const c = chiffresMemoire(jeu);
  const options = args.join('');
  const unite = (o: number) =>
    /h/.test(options)
      ? tailleFree(o)
      : /g/.test(options)
        ? String(Math.floor(o / 1024 ** 3))
        : /m/.test(options)
          ? String(Math.floor(o / 1024 ** 2))
          : /b/.test(options)
            ? String(o)
            : String(Math.floor(o / 1024));
  const ligne = (nom: string, valeurs: number[]) => nom.padEnd(8) + valeurs.map((v) => unite(v).padStart(12)).join('');
  return [
    ' '.repeat(8) + ['total', 'used', 'free', 'shared', 'buff/cache', 'available'].map((x) => x.padStart(12)).join(''),
    ligne('Mem:', [c.total, c.used, c.free, c.shared, c.cache, c.available]),
    ligne('Swap:', [0, 0, 0]),
  ].join('\n');
}

const heure = (ms: number) => new Date(ms).toISOString().slice(11, 19);

function top(jeu: Shell, args: string[]): string {
  const sd = systemd(jeu)!;
  const m = memoire(jeu)!;
  const c = chiffresMemoire(jeu);
  const i = args.indexOf('-o');
  const tri = i >= 0 ? args[i + 1] : '%CPU';
  const complet = args.includes('-c');
  const liste: Processus[] = [...processus(jeu), ...processusDocker(jeu)];
  const zombies = liste.filter((p) => p.zombie).length;
  const rss = (p: Processus) => Math.round((m.rss[p.pid] ?? 0) / 1024);
  // RES : en Kio, puis en Mio (m) ou Gio (g) quand la colonne déborderait.
  const kio = (k: number) => (k >= 10_000_000 ? `${(k / 1024 ** 2).toFixed(1)}g` : k >= 1_000_000 ? `${(k / 1024).toFixed(1)}m` : String(k));
  const cle = (p: Processus) => (tri === '%MEM' || tri === 'RES' ? rss(p) : tri === 'PID' ? -p.pid : p.cpu);
  const trie = [...liste].sort((a, b) => cle(b) - cle(a) || a.pid - b.pid);
  const disponible = Math.round(c.available / 1024 / 102.4) / 10;
  const enMio = (o: number) => (o / 1024 / 1024).toFixed(1).padStart(8);
  const uptime = sd.horloge - demarrage(jeu);
  const jours = Math.floor(uptime / 86_400_000);
  const h = Math.floor((uptime % 86_400_000) / 3_600_000);
  const min = String(Math.floor((uptime % 3_600_000) / 60_000)).padStart(2, '0');
  // Le disque (s'il est suivi) : l'attente des entrées-sorties (wa) et la charge.
  const disque = io(jeu) ? etatDisque(jeu) : null;
  const wa = disque ? Math.min(95.7, disque.iowait) : 0.2;
  const charge = disque ? [disque.charge, disque.charge * 0.85, disque.charge * 0.6].map((x) => x.toFixed(2)).join(', ') : '0.42, 0.38, 0.35';
  return [
    `top - ${heure(sd.horloge)} up ${jours ? `${jours} days, ` : ''}${String(h).padStart(2)}:${min},  1 user,  load average: ${charge}`,
    `Tasks: ${String(liste.length).padStart(3)} total,   1 running, ${String(liste.length - 1 - zombies).padStart(3)} sleeping,   0 stopped, ${String(zombies).padStart(3)} zombie`,
    `%Cpu(s):  3.1 us,  1.0 sy,  0.0 ni, ${(100 - 4.2 - wa).toFixed(1).padStart(4)} id, ${wa.toFixed(1).padStart(4)} wa,  0.0 hi,  0.1 si,  0.0 st`,
    `MiB Mem : ${enMio(c.total)} total, ${enMio(c.free)} free, ${enMio(c.used)} used, ${enMio(c.cache)} buff/cache`,
    `MiB Swap:      0.0 total,      0.0 free,      0.0 used. ${String(disponible.toFixed(1)).padStart(8)} avail Mem`,
    '',
    '    PID USER      PR  NI    VIRT    RES    SHR S  %CPU  %MEM     TIME+ COMMAND',
    ...trie.map((p) => {
      const r = rss(p);
      const virt = p.zombie ? 0 : r + 180_000;
      const etat = p.zombie ? 'Z' : 'S';
      const commande = complet ? p.commande : nomCourt(p);
      const temps = `${Math.floor(p.pid / 97)}:${String((p.pid * 7) % 60).padStart(2, '0')}.${String(p.pid % 100).padStart(2, '0')}`;
      return `${String(p.pid).padStart(7)} ${p.utilisateur.slice(0, 8).padEnd(8)}  20   0 ${kio(virt).padStart(7)} ${kio(r).padStart(6)} ${String(p.zombie ? 0 : Math.min(r, 9800)).padStart(6)} ${etat} ${p.cpu.toFixed(1).padStart(5)} ${p.mem.toFixed(1).padStart(5)} ${temps.padStart(9)} ${commande}`;
    }),
  ].join('\n');
}

const JOURS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MOIS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function dmesg(jeu: Shell, args: string[]): string {
  // Debian règle kernel.dmesg_restrict = 1 : seul root lit les messages du noyau.
  if (jeu.qui !== 'root') return jeu.erreur('dmesg: read kernel buffer failed: Operation not permitted');
  const debut = demarrage(jeu);
  const lisible = args.some((a) => /^-\w*T/.test(a) || a === '--ctime');
  const lignes: { temps: number; texte: string }[] = (jeu.etat.noyau ?? []).filter((l: { temps: number }) => l.temps >= debut);
  return lignes
    .map(({ temps, texte }) => {
      if (lisible) {
        const d = new Date(temps);
        const date = `${JOURS[d.getUTCDay()]} ${MOIS[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2)} ${heure(temps)} ${d.getUTCFullYear()}`;
        return `[${date}] ${texte}`;
      }
      const s = (temps - debut) / 1000;
      return `[${s.toFixed(6).padStart(12)}] ${texte}`;
    })
    .join('\n');
}

export const MEMOIRE: Record<string, Commande> = {
  free: { lancer: ({ args, jeu }) => (memoire(jeu) ? free(jeu, args) : jeu.erreur('free: Unable to create meminfo structure')) },
  top: {
    propresOptions: true,
    lancer: ({ args, jeu }) => {
      const inconnue = args.find((a) => a.startsWith('-') && !['-b', '-c', '-o', '-n'].includes(a));
      if (inconnue)
        return jeu.erreur(
          `top: unknown option '${inconnue.replace(/^-+/, '')}'\nUsage:\n  top -hv | -bcEeHiOSs1 -d secs -n max -u|U user -p pid(s) -o field -w [cols]`,
        );
      if (!memoire(jeu) || !systemd(jeu)) return jeu.erreur('top: failed tty get');
      return top(jeu, args);
    },
  },
  dmesg: { lancer: ({ args, jeu }) => dmesg(jeu, args) },
};
