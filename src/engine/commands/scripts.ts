// Les commandes des scripts : sh (et bash) pour lancer un script, test (ou
// [ … ] dans un script) pour vérifier une condition, date et readlink. Les scripts eux-mêmes
// sont interprétés par script.ts.
// D'après dash (https://manpages.debian.org/dash), test et date des
// coreutils (https://www.gnu.org/software/coreutils/manual/).

import type { Shell } from '../shell';
import { executerScript } from '../script';
import { heureEte, systemd } from '../systemd';
import { heure, heureMachine, reglerHorloge } from '../time';
import { contenu } from '../tools';
import type { Commande } from './index';

/** Lance un fichier comme un script /bin/sh ; renvoie sa sortie (échec si son code n'est pas 0). */
export function lancerScript(jeu: Shell, fichier: string, args: string[], nom = fichier): string {
  const n = jeu.trouver(fichier);
  if (n?.type !== 'fichier') return jeu.erreur(jeu.t('sh-introuvable', { fichier }));
  const r = executerScript(jeu, contenu(n, jeu), { cwd: jeu.cwd, nom, arguments: args });
  if (r.code !== 0) jeu.erreur('');
  return r.sortie;
}

// test EXPRESSION : réussit (rien) ou échoue (code 1, sans message).
function evaluer(jeu: Shell, a: string[]): boolean | string {
  if (a[0] === '!') {
    const r = evaluer(jeu, a.slice(1));
    return typeof r === 'string' ? r : !r;
  }
  if (a.length === 0) return false;
  if (a.length === 1) return a[0] !== '';
  if (a.length === 2) {
    const [op, x] = a;
    const n = jeu.trouver(x);
    switch (op) {
      case '-e':
        return !!n;
      case '-f':
        return n?.type === 'fichier';
      case '-d':
        return n?.type === 'dossier';
      case '-L':
      case '-h':
        return jeu.trouver(x, false)?.type === 'fichier' && (jeu.trouver(x, false) as { lien?: string }).lien !== undefined;
      case '-s':
        return n?.type === 'fichier' && contenu(n, jeu) !== '';
      case '-r':
      case '-w':
      case '-x':
        return !!n && jeu.peut(n, op[1] as 'r' | 'w' | 'x');
      case '-n':
        return x !== '';
      case '-z':
        return x === '';
    }
    return jeu.t('test-operateur', { operateur: op });
  }
  if (a.length === 3) {
    const [x, op, y] = a;
    const nx = Number(x);
    const ny = Number(y);
    switch (op) {
      case '=':
      case '==':
        return x === y;
      case '!=':
        return x !== y;
      case '-eq':
        return nx === ny;
      case '-ne':
        return nx !== ny;
      case '-lt':
        return nx < ny;
      case '-le':
        return nx <= ny;
      case '-gt':
        return nx > ny;
      case '-ge':
        return nx >= ny;
    }
    return jeu.t('test-operateur', { operateur: op });
  }
  return jeu.t('test-trop-d-arguments');
}

// « [ … ] » est la même commande : script.ts le réécrit en test.
const tester = ({ args, jeu }: { args: string[]; jeu: Shell }) => {
  const r = evaluer(jeu, args);
  if (typeof r === 'string') return jeu.erreur(`test: ${r}`);
  return r ? '' : jeu.erreur('');
};

// date +FORMAT : les directives courantes de strftime.
// `zone` : le fuseau de la machine, s'il n'est pas celui de Paris (voir ../heure.ts).
export function formater(ms: number, format: string, langue: string, zone?: { abrev: string; z: string; utc: number }): string {
  const d = new Date(ms);
  const deux = (n: number) => String(n).padStart(2, '0');
  const ete = heureEte(ms);
  const nom = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(langue, { timeZone: 'UTC', ...options }).format(d);
  const directives: Record<string, () => string> = {
    Y: () => String(d.getUTCFullYear()),
    y: () => deux(d.getUTCFullYear() % 100),
    m: () => deux(d.getUTCMonth() + 1),
    d: () => deux(d.getUTCDate()),
    e: () => String(d.getUTCDate()).padStart(2, ' '),
    H: () => deux(d.getUTCHours()),
    M: () => deux(d.getUTCMinutes()),
    S: () => deux(d.getUTCSeconds()),
    F: () => `${d.getUTCFullYear()}-${deux(d.getUTCMonth() + 1)}-${deux(d.getUTCDate())}`,
    T: () => `${deux(d.getUTCHours())}:${deux(d.getUTCMinutes())}:${deux(d.getUTCSeconds())}`,
    s: () => String(Math.floor((zone ? zone.utc : ms - (ete ? 7200_000 : 3600_000)) / 1000)),
    Z: () => zone?.abrev ?? (ete ? 'CEST' : 'CET'),
    z: () => zone?.z ?? (ete ? '+0200' : '+0100'),
    a: () => nom({ weekday: 'short' }),
    A: () => nom({ weekday: 'long' }),
    b: () => nom({ month: 'short' }),
    B: () => nom({ month: 'long' }),
    '%': () => '%',
  };
  return format.replace(/%(.)/g, (tout, c: string) => directives[c]?.() ?? tout);
}

/** « 2027-08-30 09:12[:00] » ou « 09:12[:00] » (aujourd'hui) → heure murale (lue comme UTC) ; null si illisible. */
export function lireDate(jeu: Shell, texte: string): number | null {
  const m = /^(?:(\d{4})-(\d{2})-(\d{2})\s+)?(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(texte.trim());
  if (!m) return null;
  const aujourdhui = new Date(heure(jeu) ? heureMachine(jeu).mur : (systemd(jeu)?.horloge ?? 0));
  const [an, mois, jour] = m[1]
    ? [Number(m[1]), Number(m[2]) - 1, Number(m[3])]
    : [aujourdhui.getUTCFullYear(), aujourdhui.getUTCMonth(), aujourdhui.getUTCDate()];
  return Date.UTC(an, mois, jour, Number(m[4]), Number(m[5]), Number(m[6] ?? 0));
}

export const SCRIPTS: Record<string, Commande> = {
  sh: {
    propresOptions: true,
    lancer: ({ args, jeu }) => {
      const [fichier, ...reste] = args;
      if (!fichier) return jeu.erreur(jeu.t('sh-interactif'));
      return lancerScript(jeu, fichier, reste);
    },
  },
  bash: {
    propresOptions: true,
    lancer: ({ args, jeu }) => {
      const [fichier, ...reste] = args;
      if (!fichier) return jeu.erreur(jeu.t('sh-interactif'));
      return lancerScript(jeu, fichier, reste);
    },
  },
  test: { propresOptions: true, lancer: tester },
  date: {
    propresOptions: true,
    lancer: ({ args, jeu }) => {
      // -s « 2027-08-30 09:12 » (ou --set=…) : régler l'horloge, réservé à root.
      const i = args.findIndex((a) => a === '-s' || a.startsWith('--set='));
      if (i >= 0) {
        const texte = args[i] === '-s' ? args[i + 1] : args[i].slice(6);
        if (texte === undefined) return jeu.erreur(jeu.t('date-option-argument'));
        const mur = lireDate(jeu, texte);
        if (mur === null) return jeu.erreur(jeu.t('date-invalide', { argument: texte }));
        if (jeu.qui !== 'root') {
          jeu.erreur(jeu.t('date-reglage-refuse'));
        } else if (heure(jeu)) reglerHorloge(jeu, mur);
        return formater(mur, jeu.t('date-format'), jeu.t.langue, heure(jeu) ? heureMachine(jeu) : undefined);
      }
      const machine = heure(jeu) ? heureMachine(jeu) : null;
      const ms = machine?.mur ?? systemd(jeu)?.horloge ?? Date.UTC(2027, 0, 1);
      const format = args.find((a) => a.startsWith('+'));
      const inconnue = args.find((a) => !a.startsWith('+'));
      if (inconnue) return jeu.erreur(jeu.t('date-invalide', { argument: inconnue }));
      // Sans format : comme date en français (LANG=fr_FR.UTF-8).
      return formater(ms, format ? format.slice(1) : jeu.t('date-format'), jeu.t.langue, machine ?? undefined);
    },
  },
  readlink: {
    options: ['f'],
    lancer: ({ args, jeu }) => {
      const canonique = args.includes('-f');
      const [cible] = args.filter((a) => !a.startsWith('-'));
      if (!cible) return jeu.erreur(jeu.t('readlink-operande'));
      if (canonique) {
        // Le chemin absolu, tous les liens suivis.
        let chemin = jeu.resoudre(cible);
        for (let i = 0; i < 20; i++) {
          const n = jeu.trouver(chemin, false) as { lien?: string } | null;
          if (!n?.lien) break;
          chemin = n.lien.startsWith('/') ? n.lien : jeu.resoudre(`${chemin.replace(/\/[^/]+$/, '')}/${n.lien}`);
        }
        return chemin;
      }
      const n = jeu.trouver(cible, false) as { lien?: string } | null;
      return n?.lien ?? jeu.erreur('');
    },
  },
};
