// La machine vit pendant qu'on joue : un chapitre peut déclarer une activité
// (Chapitre.activite) — des visiteurs, des robots, une attaque — qui écrit
// dans ses journaux au fil du temps. Le temps avance de quelques secondes à
// chaque commande tapée, et pendant un suivi (tail -f, journalctl -f), au
// rythme de l'écran. Tout reste déterministe : l'activité ne dépend que de
// l'horloge de la machine, jamais de l'heure réelle (le moteur ne la lit pas).

import type { Shell } from './shell';
import { systemd } from './systemd';

export interface Activity {
  // Les secondes qui passent à chaque commande tapée.
  not: number;
  // Ce qui arrive entre deux instants (en ms, horloge de la machine) : écrire
  // dans les journaux, bannir, relancer… L'horloge de systemd suit.
  advance: (game: Shell, forEachOf: number, a: number) => void;
  // L'instant de départ (par défaut, l'horloge de systemd).
  departure?: (game: Shell) => number;
}

/** L'horloge de l'activité d'une machine (ms) ; null si son chapitre n'en a pas. */
export function activityClock(game: Shell): number | null {
  const a = game.chapter.activity;
  if (!a) return null;
  return ((game.state.activity ??= { clock: a.departure?.(game) ?? systemd(game)?.clock ?? 0 }) as { clock: number }).clock;
}

/** Fait passer des secondes sur la machine : son activité écrit ce qui se passe pendant ce temps. */
export function live(game: Shell, seconds: number): void {
  const a = game.chapter.activity;
  const forEachOf = activityClock(game);
  if (!a || forEachOf === null || seconds <= 0) return;
  const end = forEachOf + seconds * 1000;
  a.advance(game, forEachOf, end);
  (game.state.activity as { clock: number }).clock = end;
  const sd = systemd(game);
  if (sd && sd.clock < end) sd.clock = end;
}

/** Les instants réguliers d'une source (toutes les `periode` secondes depuis `debut`) compris dans ]de, a]. */
export function instants(forEachOf: number, a: number, period: number, start = 0): number[] {
  const p = period * 1000;
  const first = start + Math.floor((forEachOf - start) / p + 1) * p;
  const t: number[] = [];
  for (let x = first; x <= a; x += p) t.push(x);
  return t;
}
