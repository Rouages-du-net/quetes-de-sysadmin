// The machine lives while you play: a chapter can declare an activity
// (Chapter.activity) — visitors, robots, an attack — that writes
// into its logs over time. Time moves forward a few seconds at
// each typed command, and during a follow (tail -f, journalctl -f), at
// the screen's pace. Everything stays deterministic: the activity depends only on
// the machine's clock, never on the real time (the engine doesn't read it).

import type { Shell } from './shell';
import { systemd } from './systemd';

export interface Activity {
  // The seconds that pass with each typed command.
  not: number;
  // What happens between two instants (in ms, machine clock): write
  // into the logs, ban, restart… systemd's clock follows.
  advance: (game: Shell, forEachOf: number, a: number) => void;
  // The starting instant (by default, systemd's clock).
  departure?: (game: Shell) => number;
}

/** The clock of a machine's activity (ms); null if its chapter has none. */
export function activityClock(game: Shell): number | null {
  const a = game.chapter.activity;
  if (!a) return null;
  return ((game.state.activity ??= { clock: a.departure?.(game) ?? systemd(game)?.clock ?? 0 }) as { clock: number }).clock;
}

/** Makes seconds pass on the machine: its activity writes what happens meanwhile. */
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

/** A source's regular instants (every `period` seconds from `start`) within ]forEachOf, a]. */
export function instants(forEachOf: number, a: number, period: number, start = 0): number[] {
  const p = period * 1000;
  const first = start + Math.floor((forEachOf - start) / p + 1) * p;
  const t: number[] = [];
  for (let x = first; x <= a; x += p) t.push(x);
  return t;
}
