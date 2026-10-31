// iostat et pidstat (sysstat), ionice (util-linux), sur le modèle de
// ../entrees-sorties.ts. Sorties en anglais, colonnes de sysstat 12.7.
// Sources : https://man7.org/linux/man-pages/man1/iostat.1.html,
// https://man7.org/linux/man-pages/man1/pidstat.1.html,
// https://man7.org/linux/man-pages/man1/ionice.1.html
// Écarts : iostat -c, -d, -x, -k, -m, -y, -z et un intervalle ; pidstat -d,
// -u et un intervalle ; ionice -p (lire), -c, -n, -p (régler) ; tous les
// rapports donnent les chiffres de l'instant.

import type { Shell } from '../shell';
import { systemd } from '../systemd';
import { etatDisque, io } from '../disk-io';
import { aide } from './manual';
import type { Commande } from './index';

const f2 = (n: number) => n.toFixed(2);

// L'en-tête de sysstat : noyau, machine, date (au format de la langue), architecture, processeurs.
function entete(jeu: Shell): string {
  const sd = systemd(jeu)!;
  const date = new Date(sd.horloge);
  const jour =
    jeu.t.langue === 'fr'
      ? date.toISOString().slice(0, 10).split('-').reverse().join('/')
      : `${date.toISOString().slice(5, 7)}/${date.toISOString().slice(8, 10)}/${date.getUTCFullYear()}`;
  return `Linux 6.12.0-quetes (${sd.hote}) \t${jour} \t_x86_64_\t(${io(jeu)!.cpus} CPU)`;
}

// Intervalle et nombre de rapports (iostat 1 3).
function repetitions(args: string[]): { nombre: number; intervalle: boolean } | null {
  const nombres = args.filter((a) => /^\d+$/.test(a)).map(Number);
  if (nombres.some((n) => n === 0) && nombres[0] === 0) return null;
  return { nombre: nombres.length === 0 ? 1 : (nombres[1] ?? 2), intervalle: nombres.length > 0 };
}

function iostat(jeu: Shell, args: string[]): string {
  if (!io(jeu)) return entete(jeu);
  const options = new Set(args.filter((a) => /^-[a-zA-Z]+$/.test(a)).flatMap((a) => [...a.slice(1)]));
  const inconnue = [...options].find((o) => !'cdxkmyzh'.includes(o));
  if (inconnue)
    return jeu.erreur(
      `Usage: iostat [ options ] [ <interval> [ <count> ] ]\nOptions are:\n[ -c ] [ -d ] [ -h ] [ -k | -m ] [ -t ] [ -V ] [ -x ] [ -y ] [ -z ]`,
      1,
    );
  if (options.has('h')) return aide('iostat', IOSTAT.iostat, jeu.t);
  const rep = repetitions(args);
  if (!rep) return jeu.erreur('Usage: iostat [ options ] [ <interval> [ <count> ] ]', 1);
  const { e, debits, utilisation, attente, iowait } = etatDisque(jeu);
  const cpu = !options.has('d') || options.has('c');
  const disques = !options.has('c') || options.has('d');
  const unite = options.has('m') ? 1024 : 1;
  const nom = unite === 1 ? 'kB' : 'MB';
  const lecture = debits.reduce((t, d) => t + d.lecture, 0);
  const ecriture = debits.reduce((t, d) => t + d.ecriture, 0);
  // Des requêtes d'environ 240 ko (lecture séquentielle), le compte des opérations s'en déduit.
  const rs = lecture / 236;
  const ws = ecriture / 240;
  const systeme = Math.min(9, 1.2 + utilisation / 40);
  const rapport = () => {
    const lignes: string[] = [];
    if (cpu)
      lignes.push(
        'avg-cpu:  %user   %nice %system %iowait  %steal   %idle',
        `         ${f2(3.4).padStart(6)}  ${f2(0).padStart(6)}  ${f2(systeme).padStart(6)}  ${f2(iowait).padStart(6)}  ${f2(0).padStart(6)}  ${f2(Math.max(0, 100 - 3.4 - systeme - iowait)).padStart(6)}`,
        '',
      );
    if (disques) {
      if (options.has('x')) {
        lignes.push(
          `Device            r/s     r${nom}/s   rrqm/s  %rrqm r_await rareq-sz     w/s     w${nom}/s   wrqm/s  %wrqm w_await wareq-sz     d/s     d${nom}/s   drqm/s  %drqm d_await dareq-sz     f/s f_await  aqu-sz  %util`,
          [
            e.disque.padEnd(12),
            f2(rs).padStart(8),
            f2(lecture / unite).padStart(9),
            f2(0).padStart(8),
            f2(0).padStart(6),
            f2(attente).padStart(7),
            f2(rs ? 236 : 0).padStart(8),
            f2(ws).padStart(7),
            f2(ecriture / unite).padStart(9),
            f2(ws * 0.04).padStart(8),
            f2(ws ? 3.83 : 0).padStart(6),
            f2(ws ? attente * 1.6 : 0).padStart(7),
            f2(ws ? 240 : 0).padStart(8),
            ...['0.00', '0.00', '0.00', '0.00', '0.00', '0.00'].map((v, i) => v.padStart([7, 9, 8, 6, 7, 8][i])),
            f2(0).padStart(7),
            f2(0).padStart(7),
            f2(((rs + ws) * attente) / 1000).padStart(7),
            f2(utilisation).padStart(6),
          ].join(' '),
          '',
        );
      } else {
        lignes.push(
          `Device             tps    ${nom}_read/s    ${nom}_wrtn/s    ${nom}_dscd/s    ${nom}_read    ${nom}_wrtn    ${nom}_dscd`,
          `${e.disque.padEnd(12)} ${f2(rs + ws).padStart(9)} ${f2(lecture / unite).padStart(12)} ${f2(ecriture / unite).padStart(12)} ${f2(0).padStart(12)} ${String(Math.round((lecture * 3600) / unite)).padStart(10)} ${String(Math.round((ecriture * 3600) / unite)).padStart(10)} ${'0'.padStart(10)}`,
          '',
        );
      }
    }
    return lignes;
  };
  const rapports = Array.from({ length: options.has('y') && rep.intervalle ? Math.max(1, rep.nombre - 1) : rep.nombre }, rapport);
  return [entete(jeu), '', ...rapports.flat()].join('\n').trimEnd();
}

function pidstat(jeu: Shell, args: string[]): string {
  if (!io(jeu)) return entete(jeu);
  const options = new Set(args.filter((a) => /^-[a-zA-Z]+$/.test(a)).flatMap((a) => [...a.slice(1)]));
  const inconnue = [...options].find((o) => !'duh'.includes(o));
  if (inconnue) return jeu.erreur('Usage: pidstat [ options ] [ <interval> [ <count> ] ]\nOptions are:\n[ -d ] [ -h ] [ -u ]', 1);
  const rep = repetitions(args);
  if (!rep) return jeu.erreur('Usage: pidstat [ options ] [ <interval> [ <count> ] ]', 1);
  const sd = systemd(jeu)!;
  const { debits } = etatDisque(jeu);
  const heure = (decalage: number) => new Date(sd.horloge + decalage * 1000).toISOString().slice(11, 19);
  const disque = options.has('d');
  const titre = disque
    ? '      UID       PID   kB_rd/s   kB_wr/s kB_ccwr/s iodelay  Command'
    : '      UID       PID    %usr %system  %guest   %wait    %CPU   CPU  Command';
  const lignes = (debut: string) =>
    disque
      ? debits.map(
          (d) =>
            `${debut} ${String(d.uid).padStart(5)} ${String(d.pid).padStart(9)} ${f2(d.lecture).padStart(9)} ${f2(d.ecriture).padStart(9)} ${f2(0).padStart(9)} ${String(Math.round(d.attente / 4)).padStart(7)}  ${d.commande}`,
        )
      : (jeu.etat.processus ?? [])
          .filter((p: { cpu: number }) => p.cpu > 0)
          .map(
            (p: { pid: number; cpu: number; utilisateur: string; commande: string }) =>
              `${debut} ${String(p.utilisateur === 'root' ? 0 : (jeu.comptes.utilisateurs[p.utilisateur]?.uid ?? 1000)).padStart(5)} ${String(p.pid).padStart(9)} ${f2(p.cpu * 0.7).padStart(7)} ${f2(p.cpu * 0.3).padStart(7)} ${f2(0).padStart(7)} ${f2(debits.find((d) => d.pid === p.pid && d.attente > 50) ? 41 : 0).padStart(7)} ${f2(p.cpu).padStart(7)} ${'1'.padStart(5)}  ${p.commande.split(/\s+/)[0].split('/').at(-1)}`,
          );
  const blocs: string[] = [];
  for (let i = 0; i < rep.nombre; i++) blocs.push('', `${heure(i)}${titre}`, ...lignes(heure(i + 1)));
  if (rep.intervalle && rep.nombre > 1) blocs.push('', `Average: ${titre.trimStart().padStart(titre.length - 1)}`, ...lignes('Average:'));
  return [entete(jeu), ...blocs].join('\n');
}

const CLASSES = ['none', 'realtime', 'best-effort', 'idle'];

function ionice(jeu: Shell, args: string[]): string {
  let classe: number | null = null;
  let prio: number | null = null;
  const pids: number[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    const valeur = /^-[cn]\d$/.test(a) ? a.slice(2) : a === '-c' || a === '-n' || a === '--class' || a === '--classdata' ? args[++i] : null;
    if (a.startsWith('-c') || a === '--class') classe = Number(valeur);
    else if (a.startsWith('-n') || a === '--classdata') prio = Number(valeur);
    else if (a === '-p' || a === '--pid') {
      while (/^\d+$/.test(args[i + 1] ?? '')) pids.push(Number(args[++i]));
    } else if (a === '-h' || a === '--help') return aide('ionice', IOSTAT.ionice, jeu.t);
    else if (a.startsWith('-'))
      return jeu.erreur(`ionice: invalid option -- '${a.replace(/^-+/, '')}'\nTry 'ionice --help' for more information.`, 1);
    else return jeu.erreur(jeu.t('ionice-commande'), 1);
  }
  const e = io(jeu);
  const vivants = new Set((jeu.etat.processus ?? []).map((p: { pid: number }) => p.pid));
  if (!pids.length) return classe === null ? 'none: prio 0' : jeu.erreur("ionice: bad usage\nTry 'ionice --help' for more information.", 1);
  if (classe !== null && (Number.isNaN(classe) || classe < 0 || classe > 3)) return jeu.erreur(`ionice: unknown scheduling class: '${classe}'`, 1);
  const sorties: string[] = [];
  for (const pid of pids) {
    if (!vivants.has(pid)) return jeu.erreur(`ionice: ioprio_get failed: No such process`, 1);
    if (classe === null) {
      const c = e?.classes[pid];
      sorties.push(!c || c.classe === 2 ? `best-effort: prio ${c?.prio ?? 4}` : c.classe === 3 ? 'idle' : `${CLASSES[c.classe]}: prio ${c.prio}`);
      continue;
    }
    const proprio = (jeu.etat.processus ?? []).find((p: { pid: number }) => p.pid === pid)?.utilisateur;
    // Le temps réel est réservé à root ; changer la classe d'un processus d'un autre compte aussi.
    if (jeu.qui !== 'root' && (classe === 1 || proprio !== jeu.qui)) return jeu.erreur('ionice: ioprio_set failed: Operation not permitted', 1);
    if (e) e.classes[pid] = { classe, prio: classe === 3 ? 0 : (prio ?? 4) };
  }
  return sorties.join('\n');
}

export const IOSTAT: Record<string, Commande> = {
  iostat: { propresOptions: true, lancer: ({ args, jeu }) => iostat(jeu, args) },
  pidstat: { propresOptions: true, lancer: ({ args, jeu }) => pidstat(jeu, args) },
  ionice: { propresOptions: true, lancer: ({ args, jeu }) => ionice(jeu, args) },
};
