// Commandes système : processus (ps, kill). Les services (systemctl,
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
}

export const SYSTEME: Record<string, Commande> = {
  ps: {
    lancer: ({ args, jeu }) => {
      const tous = args.some((a) => /a/.test(a));
      const liste: Processus[] = [...(jeu.etat.processus ?? []), ...processusDocker(jeu)]
        .filter((p: Processus) => tous || p.utilisateur === 'vous')
        .sort((a: Processus, b: Processus) => a.pid - b.pid);
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
        else {
          jeu.etat.processus = liste.filter((q) => q !== p);
          const m = jeu.etat.surKill?.(jeu, p);
          if (m) messages.push(m);
        }
      }
      return messages.join('\n');
    },
  },

};
