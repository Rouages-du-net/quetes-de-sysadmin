// lynis (https://cisofy.com/documentation/lynis/), l'outil d'audit d'un
// serveur : « lynis audit system ». Sortie en anglais, comme le vrai outil ;
// elle se lit dans src/engine/lynis.ts. Après l'audit, /var/log/lynis-report.dat
// garde les constats (hardening_index=, warning[]=, suggestion[]=).

import { audit, VERSION_LYNIS, RAPPORT, JOURNAL } from '../lynis';
import type { Commande } from './index';

export const LYNIS: Record<string, Commande> = {
  lynis: {
    section: 8,
    propresOptions: true,
    lancer: ({ args, jeu }) => {
      const [action, ...reste] = args;
      if (action === '--version' || action === '-V' || (action === 'show' && reste[0] === 'version')) return VERSION_LYNIS;
      if (action === 'audit' && reste[0] === 'system') {
        if (jeu.qui !== 'root') return jeu.erreur(jeu.t('lynis-sans-root'), 1);
        const r = audit(jeu);
        const droits = { type: 'fichier' as const, lignes: true, proprio: 'root', mode: 'rw-------' };
        jeu.placer('lynis', RAPPORT, { ...droits, contenu: r.rapport });
        jeu.placer('lynis', JOURNAL, { ...droits, contenu: `# Lynis ${VERSION_LYNIS}\n${r.rapport}` });
        jeu.etat.lynis = { indice: r.indice, ids: r.constats.map((c) => c.id), avertissements: r.constats.filter((c) => c.type === 'warning').length };
        return r.sortie;
      }
      if (action === 'audit') return jeu.erreur(jeu.t('lynis-audit-cible', { cible: reste[0] ?? '' }), 1);
      if (!action) return jeu.erreur(jeu.t('lynis-usage'), 1);
      return jeu.erreur(jeu.t('lynis-commande-inconnue', { commande: action }), 1);
    },
  },
};
