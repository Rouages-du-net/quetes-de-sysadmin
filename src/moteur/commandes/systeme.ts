// Commandes système : processus (ps, kill, pkill) et sessions (who). Les services (systemctl,
// journalctl) sont dans systemd.ts. Les processus sont simulés dans l'état de
// l'histoire :
//   etat.processus : liste de { pid, utilisateur, cpu, mem, commande }
//   etat.surKill(jeu, processus), etat.surSystemctl(jeu, action, nom) :
//   réactions propres à l'histoire, qui renvoient un message éventuel.

import type { Commande } from './index';
import { processusDocker } from '../docker';

export interface Processus {
  pid: number;
  utilisateur: string;
  cpu: number;
  mem: number;
  commande: string;
  // Le parent, et un processus zombie (terminé, que son parent n'a pas récupéré).
  ppid?: number;
  zombie?: boolean;
}

export const SYSTEME: Record<string, Commande> = {
  ps: {
    lancer: ({ args, jeu }) => {
      const tous = args.some((a) => /^-?\w*[ae]/.test(a) && !/^-\w*u$/.test(a));
      // -u compte[,compte] : seulement les processus de ces comptes.
      const iu = args.findIndex((a) => /^-\w*u$/.test(a));
      const comptes = iu >= 0 ? (args[iu + 1] ?? '').split(',') : null;
      const liste: Processus[] = [...(jeu.etat.processus ?? []), ...processusDocker(jeu)]
        .filter((p: Processus) => (comptes ? comptes.includes(p.utilisateur) : tous || p.utilisateur === jeu.qui || p.utilisateur === 'vous'))
        .sort((a: Processus, b: Processus) => a.pid - b.pid);
      // -f (ps -ef) : le format complet, avec le parent (PPID).
      if (args.some((a) => /^-\w*f/.test(a))) {
        const ligneF = (p: Processus) =>
          `${p.utilisateur.slice(0, 8).padEnd(8)} ${String(p.pid).padStart(7)} ${String(p.ppid ?? (p.pid === 1 ? 0 : 1)).padStart(7)}  0 04:00 ?        00:00:00 ${p.commande}`;
        return ['UID          PID    PPID  C STIME TTY          TIME CMD', ...liste.map(ligneF)].join('\n');
      }
      const ligne = (p: Processus) =>
        `${p.utilisateur.padEnd(10)} ${String(p.pid).padStart(6)} ${p.cpu.toFixed(1).padStart(5)} ${p.mem.toFixed(1).padStart(5)} ${p.commande}`;
      return ['USER          PID  %CPU  %MEM COMMAND', ...liste.map(ligne)].join('\n');
    },
  },

  kill: {
    lancer: ({ args, jeu }) => {
      const pids = args.filter((a) => !a.startsWith('-'));
      if (!pids.length) return jeu.erreur(jeu.t('kill-usage'));
      const messages: string[] = [];
      for (const brut of pids) {
        const liste: Processus[] = jeu.etat.processus ?? [];
        const p = liste.find((q) => String(q.pid) === brut);
        if (!p) jeu.erreur(jeu.t('kill-aucun', { pid: brut }));
        else if (jeu.qui !== 'root' && p.utilisateur !== jeu.qui) jeu.erreur(jeu.t('kill-non-permise', { pid: brut }));
        // Un zombie est déjà mort : aucun signal n'y fait rien, seul son parent peut le récupérer.
        else if (p.zombie) continue;
        else {
          jeu.etat.processus = liste.filter((q) => q !== p);
          const m = jeu.etat.surKill?.(jeu, p);
          if (m) messages.push(m);
        }
      }
      return messages.join('\n');
    },
  },

  // pkill : arrête les processus choisis par nom (motif dans le nom du programme) ou par compte (-u).
  // Code de retour 1 si aucun processus ne correspond (procps).
  pkill: {
    lancer: ({ args, jeu }) => {
      const iu = args.indexOf('-u');
      const comptes = iu >= 0 ? (args[iu + 1] ?? '').split(',') : null;
      const motif = args.filter((a, k) => !a.startsWith('-') && (iu < 0 || k !== iu + 1))[0];
      if (!motif && !comptes) return jeu.erreur(jeu.t('pkill-usage'), 2);
      let re: RegExp | null = null;
      try {
        re = motif ? new RegExp(motif) : null;
      } catch {
        return jeu.erreur(`pkill: invalid regular expression: ${motif}`, 2);
      }
      const liste: Processus[] = jeu.etat.processus ?? [];
      // Le nom du programme : le premier mot de la commande, sans son chemin (comme /proc/pid/comm).
      const nom = (p: Processus) => p.commande.split(/[\s:]/)[0].split('/').at(-1)!.replace(/^-/, '');
      const choisis = liste.filter((p) => (!comptes || comptes.includes(p.utilisateur)) && (!re || re.test(nom(p))) && !p.zombie);
      if (!choisis.length) {
        jeu.statut = 1;
        return '';
      }
      const messages: string[] = [];
      for (const p of choisis) {
        if (jeu.qui !== 'root' && p.utilisateur !== jeu.qui) {
          jeu.erreur(`pkill: killing pid ${p.pid} failed: Operation not permitted`);
          continue;
        }
        jeu.etat.processus = (jeu.etat.processus as Processus[]).filter((q) => q !== p);
        const m = jeu.etat.surKill?.(jeu, p);
        if (m) messages.push(m);
      }
      return messages.join('\n');
    },
  },

  // who : les sessions ouvertes (une session vit tant que son processus sshd tourne).
  who: {
    lancer: ({ jeu }) => {
      const sessions: { utilisateur: string; tty: string; depuis: string; de: string; pid?: number }[] = jeu.etat.sessions ?? [];
      const vivants = ((jeu.etat.processus ?? []) as Processus[]).map((p) => p.pid);
      return sessions
        .filter((x) => x.pid === undefined || vivants.includes(x.pid))
        .map((x) => `${x.utilisateur.padEnd(8)} ${x.tty.padEnd(12)} ${x.depuis} (${x.de})`)
        .join('\n');
    },
  },
};
