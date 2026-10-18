// Petits outils du shell : découpage de la ligne de commande, permissions,
// tailles, jokers.

import type { Fichier } from './monde';
import type { Jeu } from './shell';

export const contenu = (n: Fichier, jeu: Jeu) => (typeof n.contenu === 'function' ? n.contenu(jeu) : n.contenu);
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

// « 755 » ou « u+x », « o-w », « go=r », « +x »… → nouveau mode rwxrwxrwx.
// Écart volontaire : sans u/g/o/a, on agit sur tout le monde (a) sans
// tenir compte du masque (umask).
export function appliquerMode(actuel: string, droits: string): string | null {
  if (/^[0-7]{3}$/.test(droits))
    return [...droits]
      .map((c) => {
        const v = Number(c);
        return (v & 4 ? 'r' : '-') + (v & 2 ? 'w' : '-') + (v & 1 ? 'x' : '-');
      })
      .join('');
  const bits = [...actuel];
  for (const clause of droits.split(',')) {
    const m = /^([ugoa]*)([+\-=])([rwx]*)$/.exec(clause);
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
  }
  return bits.join('');
}

// Taille lisible : 1536 → « 1,5K », comme du -h ou ls -lh (en base 1024).
export function lisible(octets: number): string {
  const unites = ['', 'K', 'M', 'G'];
  let v = octets;
  let u = 0;
  while (v >= 1024 && u < unites.length - 1) {
    v /= 1024;
    u++;
  }
  const texte = u === 0 ? String(v) : v < 10 ? v.toFixed(1).replace('.', ',') : String(Math.round(v));
  return texte + unites[u];
}

// Options courtes groupées : « -czf » → c, z, f. Renvoie les lettres et les
// arguments qui ne sont pas des options.
export function options(args: string[]): { lettres: Set<string>; reste: string[] } {
  const lettres = new Set<string>();
  const reste: string[] = [];
  for (const a of args) {
    if (/^-[a-zA-Z]+$/.test(a)) for (const l of a.slice(1)) lettres.add(l);
    else reste.push(a);
  }
  return { lettres, reste };
}
