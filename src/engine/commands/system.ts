// Commandes système : processus (ps, kill, pkill) et sessions (who). Les services (systemctl,
// journalctl) sont dans systemd.ts. Les processus sont simulés dans l'état de
// l'histoire :
//   etat.processus : liste de { pid, utilisateur, cpu, mem, commande }
//   etat.surKill(jeu, processus), etat.surSystemctl(jeu, action, nom) :
//   réactions propres à l'histoire, qui renvoient un message éventuel.

import type { Command } from './index';
import { dockerProcess } from '../docker';

export interface Process {
  pid: number;
  user: string;
  cpu: number;
  mem: number;
  command: string;
  // Le parent, et un processus zombie (terminé, que son parent n'a pas récupéré).
  ppid?: number;
  zombie?: boolean;
}

export const SYSTEM: Record<string, Command> = {
  ps: {
    launch: ({ args, game }) => {
      const all = args.some((a) => /^-?\w*[ae]/.test(a) && !/^-\w*u$/.test(a));
      // -u compte[,compte] : seulement les processus de ces comptes.
      const iu = args.findIndex((a) => /^-\w*u$/.test(a));
      const accounts = iu >= 0 ? (args[iu + 1] ?? '').split(',') : null;
      const listing: Process[] = [...(game.state.process ?? []), ...dockerProcess(game)]
        .filter((p: Process) => (accounts ? accounts.includes(p.user) : all || p.user === game.who || p.user === game.player))
        .sort((a: Process, b: Process) => a.pid - b.pid);
      // -f (ps -ef) : le format complet, avec le parent (PPID).
      if (args.some((a) => /^-\w*f/.test(a))) {
        const fLine = (p: Process) =>
          `${p.user.slice(0, 8).padEnd(8)} ${String(p.pid).padStart(7)} ${String(p.ppid ?? (p.pid === 1 ? 0 : 1)).padStart(7)}  0 04:00 ?        00:00:00 ${p.command}`;
        return ['UID          PID    PPID  C STIME TTY          TIME CMD', ...listing.map(fLine)].join('\n');
      }
      const line = (p: Process) =>
        `${p.user.padEnd(10)} ${String(p.pid).padStart(6)} ${p.cpu.toFixed(1).padStart(5)} ${p.mem.toFixed(1).padStart(5)} ${p.command}`;
      return ['USER          PID  %CPU  %MEM COMMAND', ...listing.map(line)].join('\n');
    },
  },

  kill: {
    launch: ({ args, game }) => {
      const pids = args.filter((a) => !a.startsWith('-'));
      if (!pids.length) return game.error(game.t('kill-usage'));
      const messages: string[] = [];
      for (const raw of pids) {
        const listing: Process[] = game.state.process ?? [];
        const p = listing.find((q) => String(q.pid) === raw);
        if (!p) game.error(game.t('kill-none', { pid: raw }));
        else if (game.who !== 'root' && p.user !== game.who) game.error(game.t('kill-not-allowed', { pid: raw }));
        // Un zombie est déjà mort : aucun signal n'y fait rien, seul son parent peut le récupérer.
        else if (p.zombie) continue;
        else {
          game.state.process = listing.filter((q) => q !== p);
          const m = game.state.onKill?.(game, p);
          if (m) messages.push(m);
        }
      }
      return messages.join('\n');
    },
  },

  // pkill : arrête les processus choisis par nom (motif dans le nom du programme) ou par compte (-u).
  // Code de retour 1 si aucun processus ne correspond (procps).
  pkill: {
    launch: ({ args, game }) => {
      const iu = args.indexOf('-u');
      const accounts = iu >= 0 ? (args[iu + 1] ?? '').split(',') : null;
      const pattern = args.filter((a, k) => !a.startsWith('-') && (iu < 0 || k !== iu + 1))[0];
      if (!pattern && !accounts) return game.error(game.t('pkill-usage'), 2);
      let re: RegExp | null = null;
      try {
        re = pattern ? new RegExp(pattern) : null;
      } catch {
        return game.error(`pkill: invalid regular expression: ${pattern}`, 2);
      }
      const listing: Process[] = game.state.process ?? [];
      // Le nom du programme : le premier mot de la commande, sans son chemin (comme /proc/pid/comm).
      const name = (p: Process) => p.command.split(/[\s:]/)[0].split('/').at(-1)!.replace(/^-/, '');
      const chosen = listing.filter((p) => (!accounts || accounts.includes(p.user)) && (!re || re.test(name(p))) && !p.zombie);
      if (!chosen.length) {
        game.status = 1;
        return '';
      }
      const messages: string[] = [];
      for (const p of chosen) {
        if (game.who !== 'root' && p.user !== game.who) {
          game.error(`pkill: killing pid ${p.pid} failed: Operation not permitted`);
          continue;
        }
        game.state.process = (game.state.process as Process[]).filter((q) => q !== p);
        const m = game.state.onKill?.(game, p);
        if (m) messages.push(m);
      }
      return messages.join('\n');
    },
  },

  // who : les sessions ouvertes (une session vit tant que son processus sshd tourne).
  who: {
    launch: ({ game }) => {
      const sessions: { user: string; tty: string; since: string; forEachOf: string; pid?: number }[] = game.state.sessions ?? [];
      const live = ((game.state.process ?? []) as Process[]).map((p) => p.pid);
      return sessions
        .filter((x) => x.pid === undefined || live.includes(x.pid))
        .map((x) => `${x.user.padEnd(8)} ${x.tty.padEnd(12)} ${x.since} (${x.forEachOf})`)
        .join('\n');
    },
  },
};
