// La machine vit pendant qu'on joue : un chapitre peut déclarer une activité
// (Chapitre.activite) — des visiteurs, des robots, une attaque — qui écrit
// dans ses journaux au fil du temps. Le temps avance de quelques secondes à
// chaque commande tapée, et pendant un suivi (tail -f, journalctl -f), au
// rythme de l'écran. Tout reste déterministe : l'activité ne dépend que de
// l'horloge de la machine, jamais de l'heure réelle (le moteur ne la lit pas).

import type { Shell } from './shell';
import { systemd } from './systemd';

export interface Activite {
  // Les secondes qui passent à chaque commande tapée.
  pas: number;
  // Ce qui arrive entre deux instants (en ms, horloge de la machine) : écrire
  // dans les journaux, bannir, relancer… L'horloge de systemd suit.
  avancer: (jeu: Shell, de: number, a: number) => void;
  // L'instant de départ (par défaut, l'horloge de systemd).
  depart?: (jeu: Shell) => number;
}

/** L'horloge de l'activité d'une machine (ms) ; null si son chapitre n'en a pas. */
export function horlogeActivite(jeu: Shell): number | null {
  const a = jeu.chapitre.activite;
  if (!a) return null;
  return ((jeu.etat.activite ??= { horloge: a.depart?.(jeu) ?? systemd(jeu)?.horloge ?? 0 }) as { horloge: number }).horloge;
}

/** Fait passer des secondes sur la machine : son activité écrit ce qui se passe pendant ce temps. */
export function vivre(jeu: Shell, secondes: number): void {
  const a = jeu.chapitre.activite;
  const de = horlogeActivite(jeu);
  if (!a || de === null || secondes <= 0) return;
  const fin = de + secondes * 1000;
  a.avancer(jeu, de, fin);
  (jeu.etat.activite as { horloge: number }).horloge = fin;
  const sd = systemd(jeu);
  if (sd && sd.horloge < fin) sd.horloge = fin;
}

/** Les instants réguliers d'une source (toutes les `periode` secondes depuis `debut`) compris dans ]de, a]. */
export function instants(de: number, a: number, periode: number, debut = 0): number[] {
  const p = periode * 1000;
  const premier = debut + Math.floor((de - debut) / p + 1) * p;
  const t: number[] = [];
  for (let x = premier; x <= a; x += p) t.push(x);
  return t;
}
