// Commandes système : processus (ps, kill) et services (systemctl).
// Les processus et services sont simulés dans l'état de l'histoire :
//   etat.processus : liste de { pid, utilisateur, cpu, mem, commande }
//   etat.services  : { nom: { description, actif } }
//   etat.surKill(jeu, processus), etat.surSystemctl(jeu, action, nom) :
//   réactions propres à l'histoire, qui renvoient un message éventuel.

import type { Commande } from './index';

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
      const liste: Processus[] = (jeu.etat.processus ?? [])
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

  systemctl: {
    lancer: ({ args, jeu }) => {
      const [action, brut] = args;
      const services: Record<string, { description: string; actif: boolean }> = jeu.etat.services ?? {};
      const nom = brut?.replace(/\.service$/, '');
      if (!action || !nom) return jeu.erreur(jeu.t('systemctl-usage'));
      const s = services[nom];
      if (!s) return jeu.erreur(`Unit ${nom}.service could not be found.`);
      if (action === 'status')
        return `● ${nom}.service - ${s.description}\n     Active: ${s.actif ? 'active (running)' : 'failed'}`;
      if (!['start', 'stop', 'restart', 'reload'].includes(action)) return jeu.erreur(jeu.t('systemctl-action-inconnue', { action }));
      // Sans être root, systemctl demanderait un mot de passe ; ici, on
      // renvoie vers sudo.
      if (jeu.qui !== 'root') return jeu.erreur(jeu.t('systemctl-acces-refuse', { action, service: nom }));
      if (action === 'stop') s.actif = false;
      else s.actif = true;
      return jeu.etat.surSystemctl?.(jeu, action, nom) ?? '';
    },
  },
};
