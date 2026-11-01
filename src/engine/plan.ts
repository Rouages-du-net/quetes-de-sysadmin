// A story's network plan: the diagram the team would have pinned on the
// wall or on its wiki. It is the PLANNED network, not its state: checking
// that reality matches it (ip a, ip route, wg show…) is the player's job.
// Only two markers follow the game: the machine you are on ("you are here")
// and the ones you have already connected to.
// Each chapter that has a network to show declares it (Chapter.plan); the
// map shows it in its "Network" tab (see src/interface/game.ts).

import type { Translate } from '../texts';
import { machineName } from './machines';

export type Role = 'internet' | 'workstation' | 'router' | 'server' | 'device' | 'network';

export interface ElementPlan {
  role: Role;
  // Displayed name: a machine name (as is) or an already translated text.
  name: string;
  // Address or network (192.0.2.21, 10.10.10.0/24), or "DHCP".
  address?: string;
  // What it does, in a few words (translated text): "router, DHCP".
  note?: string;
  // The machine's name in the game (the prompt's), for "you are here".
  host?: string;
  // The link to its parent goes through a tunnel (WireGuard): dotted.
  tunnel?: boolean;
  children?: ElementPlan[];
}

/** The start of every plan: the internet, and the workstation you start from. */
export const internet = (t: Translate, ...children: ElementPlan[]): ElementPlan => ({
  role: 'internet',
  name: t('plan-internet'),
  children: [{ role: 'workstation', name: machineName(t, 'desk'), address: '192.0.2.2', note: t('plan-your-workstation'), host: 'desk' }, ...children],
});

export interface Landmark {
  here: boolean;
  visit: boolean;
}

/** An element's markers for the current game. */
export const landmarks = (e: ElementPlan, here: string, visited: Set<string>): Landmark => ({
  here: !!e.host && e.host === here,
  visit: !!e.host && visited.has(e.host),
});

// ——— Laying out the diagram ———
// A sideways tree: one column per level (the internet, then the machines,
// then the networks, then the devices), one row per leaf; each
// parent is centred on its children.

export interface Place {
  element: ElementPlan;
  parent: Place | null;
  column: number;
  line: number;
}

export function layOut(root: ElementPlan): { places: Place[]; columns: number; lines: number } {
  const places: Place[] = [];
  let leaves = 0;
  const place = (e: ElementPlan, parent: Place | null, column: number): Place => {
    const p: Place = { element: e, parent, column, line: 0 };
    places.push(p);
    const children = (e.children ?? []).map((x) => place(x, p, column + 1));
    p.line = children.length ? (children[0].line + children.at(-1)!.line) / 2 : leaves++;
    return p;
  };
  place(root, null, 0);
  return { places, columns: Math.max(...places.map((p) => p.column)) + 1, lines: leaves };
}
