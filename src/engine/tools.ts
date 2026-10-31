// Petits outils du shell : découpage de la ligne de commande, permissions,
// tailles, jokers.

import type { Fichier } from './world';
import type { Jeu } from './shell';
import { typographie } from '../texts';

export const contenu = (n: Fichier, jeu: Jeu) =>
  typeof n.contenu === 'function' ? n.contenu(jeu) : n.prose && !n.lignes ? typographie(n.contenu, jeu.t.langue) : n.contenu;
export const tailleDe = (n: Fichier, jeu: Jeu) => n.taille ?? new TextEncoder().encode(contenu(n, jeu)).length;

// Motif de jokers (*, ?) → expression régulière.
export function joker(motif: string): RegExp {
  return new RegExp('^' + motif.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
}

export interface Mot {
  texte: string;
  // Entre guillemets : pas de jokers, pas d'opérateurs.
  cite: boolean;
  // Opérateur du shell : tube ou redirection.
  op?: '|' | '>' | '>>';
}

// Découpe une ligne en mots, comme le shell : les espaces séparent les mots,
// sauf entre guillemets ("…" ou '…') ; | > et >> sont des opérateurs.
export function decouper(ligne: string): Mot[] {
  const mots: Mot[] = [];
  let courant: Mot | null = null;
  let guillemet = '';
  const finir = () => {
    if (courant) mots.push(courant);
    courant = null;
  };
  for (let i = 0; i < ligne.length; i++) {
    const c = ligne[i];
    if (guillemet) {
      if (c === guillemet) guillemet = '';
      else courant!.texte += c;
    } else if (c === '"' || c === "'") {
      guillemet = c;
      courant ??= { texte: '', cite: true };
      courant.cite = true;
    } else if (/\s/.test(c)) {
      finir();
    } else if (c === '|') {
      finir();
      mots.push({ texte: '|', cite: false, op: '|' });
    } else if (c === '>') {
      finir();
      const double = ligne[i + 1] === '>';
      if (double) i++;
      mots.push({ texte: double ? '>>' : '>', cite: false, op: double ? '>>' : '>' });
    } else {
      courant ??= { texte: '', cite: false };
      courant.texte += c;
    }
  }
  finir();
  return mots;
}

// « 755 », « 2775 » ou « u+x », « o-w », « go=r », « g+s », « +t »… → nouveau
// mode rwxrwxrwx, où les bits spéciaux prennent la place du x, comme ls -l :
// s/S (setuid, setgid : x présent ou non), t/T (sticky).
// Écart volontaire : sans u/g/o/a, on agit sur tout le monde (a) sans
// tenir compte du masque (umask).
export function appliquerMode(actuel: string, droits: string): string | null {
  // Les droits rwx d'un côté, les bits spéciaux de l'autre.
  const bits = [...actuel].map((c, i) => (i % 3 === 2 ? (/[xst]/.test(c) ? 'x' : '-') : c));
  const speciaux = { u: /[sS]/.test(actuel[2] ?? ''), g: /[sS]/.test(actuel[5] ?? ''), t: /[tT]/.test(actuel[8] ?? '') };
  if (/^[0-7]{3,4}$/.test(droits)) {
    const chiffres = droits.padStart(4, '0');
    const special = Number(chiffres[0]);
    [...chiffres.slice(1)].forEach((c, i) => {
      const v = Number(c);
      bits[i * 3] = v & 4 ? 'r' : '-';
      bits[i * 3 + 1] = v & 2 ? 'w' : '-';
      bits[i * 3 + 2] = v & 1 ? 'x' : '-';
    });
    // Comme GNU chmod : 3 chiffres ne retirent pas le setgid d'un dossier, 4 chiffres fixent tout.
    if (droits.length === 4) Object.assign(speciaux, { u: !!(special & 4), g: !!(special & 2), t: !!(special & 1) });
  } else
    for (const clause of droits.split(',')) {
      const m = /^([ugoa]*)([+\-=])([rwxst]*)$/.exec(clause);
      if (!m) return null;
      const qui = (m[1] || 'a').replace('a', 'ugo');
      for (const [i, c] of ['u', 'g', 'o'].entries()) {
        if (!qui.includes(c)) continue;
        ['r', 'w', 'x'].forEach((d, j) => {
          const k = i * 3 + j;
          if (m[2] === '=') bits[k] = m[3].includes(d) ? d : '-';
          else if (m[3].includes(d)) bits[k] = m[2] === '+' ? d : '-';
        });
      }
      const mettre = (cle: 'u' | 'g' | 't', concerne: boolean, demande: boolean) => {
        if (!concerne) return;
        if (m[2] === '=') speciaux[cle] = demande;
        else if (demande) speciaux[cle] = m[2] === '+';
      };
      mettre('u', qui.includes('u'), m[3].includes('s'));
      mettre('g', qui.includes('g'), m[3].includes('s'));
      mettre('t', !m[1] || m[1].includes('a') || m[1].includes('o'), m[3].includes('t'));
    }
  const avec = (k: number, actif: boolean, petit: string) => {
    if (actif) bits[k] = bits[k] === 'x' ? petit : petit.toUpperCase();
  };
  avec(2, speciaux.u, 's');
  avec(5, speciaux.g, 's');
  avec(8, speciaux.t, 't');
  return bits.join('');
}

/** Le mode octal (« 2775 », « 644 ») d'un mode rwxrwxrwx. */
export function octal(mode: string): string {
  const chiffre = (i: number) => (mode[i] === 'r' ? 4 : 0) + (mode[i + 1] === 'w' ? 2 : 0) + (/[xst]/.test(mode[i + 2]) ? 1 : 0);
  const special = (/[sS]/.test(mode[2]) ? 4 : 0) + (/[sS]/.test(mode[5]) ? 2 : 0) + (/[tT]/.test(mode[8]) ? 1 : 0);
  return `${special || ''}${chiffre(0)}${chiffre(3)}${chiffre(6)}`;
}

/** Le mode d'un nouveau fichier (base 666) ou dossier (base 777), moins le masque (umask, ex. « 0022 »). */
export function modeAvecMasque(dossier: boolean, masque: string): string {
  const m = parseInt(masque, 8);
  const base = dossier ? 0o777 : 0o666;
  const v = base & ~m;
  return [6, 3, 0].map((d) => ((v >> d) & 4 ? 'r' : '-') + ((v >> d) & 2 ? 'w' : '-') + ((v >> d) & 1 ? 'x' : '-')).join('');
}

// Taille lisible : 1536 → « 1,5K », comme du -h ou ls -lh (en base 1024),
// avec le séparateur décimal de la langue.
export function lisible(octets: number, langue = 'fr'): string {
  const unites = ['', 'K', 'M', 'G'];
  let v = octets;
  let u = 0;
  while (v >= 1024 && u < unites.length - 1) {
    v /= 1024;
    u++;
  }
  const decimal = new Intl.NumberFormat(langue, { minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: false });
  const texte = u === 0 ? String(v) : v < 10 ? decimal.format(v) : String(Math.round(v));
  return texte + unites[u];
}

// Options courtes groupées : « -czf » → c, z, f. Renvoie les lettres et les
// arguments qui ne sont pas des options.
// Tri des noms comme ls en français (un seul Collator : bien plus rapide que localeCompare sur des milliers de noms).
export const comparerNoms = new Intl.Collator('fr').compare;

export function options(args: string[]): { lettres: Set<string>; reste: string[] } {
  const lettres = new Set<string>();
  const reste: string[] = [];
  for (const a of args) {
    if (/^-[a-zA-Z]+$/.test(a)) for (const l of a.slice(1)) lettres.add(l);
    else reste.push(a);
  }
  return { lettres, reste };
}
