// tmux (https://man.openbsd.org/tmux) : des sessions de terminal qui vivent
// sur la machine, indépendamment de la connexion. Si la connexion tombe, ce
// qui tourne dans tmux continue ; on s'y rattache ensuite (tmux attach).
// Les sessions sont dans etat.tmux ({ nom: { cree, lignes } }) ; la console y
// recopie ce qui s'affiche tant qu'on y est attaché (Shell.tmux).
// Écarts : une fenêtre par session, pas de raccourcis clavier (Ctrl+b d
// s'écrit tmux detach), attach rejoue les dernières lignes de la session.
// Et uname (coreutils) : le noyau qui tourne.

import type { Shell } from '../shell';
import { systemd } from '../systemd';
import type { Commande } from './index';

export interface SessionTmux {
  cree: number;
  lignes: string[];
}

const sessions = (jeu: Shell): Record<string, SessionTmux> => (jeu.etat.tmux ??= {});
const JOURS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MOIS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// « Tue Oct 19 21:32:10 2027 », comme tmux ls.
const date = (ms: number) => {
  const d = new Date(ms);
  return `${JOURS[d.getUTCDay()]} ${MOIS[d.getUTCMonth()]} ${d.getUTCDate()} ${d.toISOString().slice(11, 19)} ${d.getUTCFullYear()}`;
};
const IMBRIQUEE = 'sessions should be nested with care, unset $TMUX to force';
const SANS_SERVEUR = (jeu: Shell) => `no server running on /tmp/tmux-${jeu.comptes.utilisateurs[jeu.qui]?.uid ?? 1000}/default`;

/** Ce qui s'affiche dans une session tmux : on le garde pour la prochaine fois qu'on s'y rattache. */
export function noterTmux(jeu: Shell, nom: string, texte: string) {
  const s = sessions(jeu)[nom];
  if (!s || !texte) return;
  s.lignes.push(...texte.split('\n'));
  if (s.lignes.length > 500) s.lignes.splice(0, s.lignes.length - 500);
}

// La valeur d'une option (-s nom, -t nom).
const valeur = (args: string[], option: string) => (args.includes(option) ? args[args.indexOf(option) + 1] : undefined);

export const TMUX: Record<string, Commande> = {
  tmux: {
    propresOptions: true,
    lancer: ({ args, jeu }) => {
      const action = args.find((a) => !a.startsWith('-') && a !== valeur(args, '-s') && a !== valeur(args, '-t')) ?? 'new-session';
      const liste = sessions(jeu);
      const maintenant = systemd(jeu)?.horloge ?? 0;
      if (['new', 'new-session'].includes(action)) {
        if (jeu.tmux) return jeu.erreur(IMBRIQUEE, 1);
        const nom = valeur(args, '-s') ?? String(Object.keys(liste).filter((n) => /^\d+$/.test(n)).length);
        if (liste[nom]) return jeu.erreur(`duplicate session: ${nom}`, 1);
        liste[nom] = { cree: maintenant, lignes: [] };
        jeu.tmux = nom;
        return '';
      }
      if (['ls', 'list-sessions'].includes(action)) {
        const noms = Object.keys(liste);
        if (!noms.length) return jeu.erreur(SANS_SERVEUR(jeu), 1);
        return noms.map((n) => `${n}: 1 windows (created ${date(liste[n].cree)})${jeu.tmux === n ? ' (attached)' : ''}`).join('\n');
      }
      if (['attach', 'a', 'attach-session', 'at'].includes(action)) {
        if (jeu.tmux) return jeu.erreur(IMBRIQUEE, 1);
        const noms = Object.keys(liste);
        if (!noms.length) return jeu.erreur(SANS_SERVEUR(jeu), 1);
        const cible = valeur(args, '-t') ?? noms.at(-1)!;
        if (!liste[cible]) return jeu.erreur(`can't find session: ${cible}`, 1);
        jeu.tmux = cible;
        return liste[cible].lignes.slice(-60).join('\n');
      }
      if (['detach', 'detach-client'].includes(action)) {
        if (!jeu.tmux) return jeu.erreur('no current client', 1);
        const nom = jeu.tmux;
        jeu.tmux = null;
        return `[detached (from session ${nom})]`;
      }
      if (['kill-session', 'kill-ses'].includes(action)) {
        const cible = valeur(args, '-t') ?? jeu.tmux ?? Object.keys(liste).at(-1);
        if (!cible || !liste[cible]) return jeu.erreur(cible ? `can't find session: ${cible}` : SANS_SERVEUR(jeu), 1);
        delete liste[cible];
        if (jeu.tmux === cible) jeu.tmux = null;
        return '';
      }
      return jeu.erreur(`unknown command: ${action}`, 1);
    },
  },

  uname: {
    lancer: ({ args, jeu }) => {
      const noyau = (jeu.etat.noyau as { courant: string } | undefined)?.courant ?? '6.12.0-quetes';
      const tout = args.some((a) => /^-\w*a/.test(a));
      if (tout) return `Linux ${jeu.hote} ${noyau} #1 SMP PREEMPT_DYNAMIC Debian ${noyau.replace(/\+.*$/, '')}-1 x86_64 GNU/Linux`;
      if (args.some((a) => /^-\w*r/.test(a))) return noyau;
      return 'Linux';
    },
  },
};
