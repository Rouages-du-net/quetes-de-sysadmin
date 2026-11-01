// Le plan du réseau d'une histoire : le schéma que l'équipe aurait affiché
// au mur ou sur son wiki. C'est le réseau PRÉVU, pas son état : vérifier que
// la réalité lui ressemble (ip a, ip route, wg show…), c'est le travail du
// joueur ou de la joueuse. Seuls deux repères suivent la partie : la machine
// où l'on est (« tu es ici ») et celles où l'on s'est déjà connecté·e.
// Chaque chapitre qui a un réseau à montrer le déclare (Chapitre.plan) ; la
// carte l'affiche dans son onglet « Réseau » (voir src/interface/game.ts).

import type { Translate } from '../texts';
import { machineName } from './machines';

export type Role = 'internet' | 'poste' | 'routeur' | 'serveur' | 'appareil' | 'reseau';

export interface ElementPlan {
  role: Role;
  // Nom affiché : un nom de machine (tel quel) ou un texte déjà traduit.
  name: string;
  // Adresse ou réseau (192.0.2.21, 10.10.10.0/24), ou « DHCP ».
  address?: string;
  // Ce qu'elle fait, en quelques mots (texte traduit) : « routeur, DHCP ».
  note?: string;
  // Le nom de la machine dans le jeu (celui de l'invite), pour « tu es ici ».
  host?: string;
  // Le lien vers son parent passe par un tunnel (WireGuard) : en pointillés.
  tunnel?: boolean;
  children?: ElementPlan[];
}

/** Le début de tout plan : internet, et le poste d'où l'on part. */
export const internet = (t: Translate, ...children: ElementPlan[]): ElementPlan => ({
  role: 'internet',
  name: t('plan-internet'),
  children: [{ role: 'poste', name: machineName(t, 'desk'), address: '192.0.2.2', note: t('plan-your-workstation'), host: 'desk' }, ...children],
});

export interface Landmark {
  here: boolean;
  visit: boolean;
}

/** Les repères d'un élément pour la partie en cours. */
export const landmarks = (e: ElementPlan, here: string, visited: Set<string>): Landmark => ({
  here: !!e.host && e.host === here,
  visit: !!e.host && visited.has(e.host),
});

// ——— Mise en place du schéma ———
// Un arbre couché : une colonne par niveau (internet, puis les machines,
// puis les réseaux, puis les appareils), une ligne par feuille ; chaque
// parent est centré sur ses enfants.

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
