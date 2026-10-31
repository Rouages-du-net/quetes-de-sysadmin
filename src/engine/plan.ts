// Le plan du réseau d'une histoire : le schéma que l'équipe aurait affiché
// au mur ou sur son wiki. C'est le réseau PRÉVU, pas son état : vérifier que
// la réalité lui ressemble (ip a, ip route, wg show…), c'est le travail du
// joueur ou de la joueuse. Seuls deux repères suivent la partie : la machine
// où l'on est (« tu es ici ») et celles où l'on s'est déjà connecté·e.
// Chaque chapitre qui a un réseau à montrer le déclare (Chapitre.plan) ; la
// carte l'affiche dans son onglet « Réseau » (voir src/interface/game.ts).

import type { Traduire } from '../texts';
import { nomMachine } from './machines';

export type Role = 'internet' | 'poste' | 'routeur' | 'serveur' | 'appareil' | 'reseau';

export interface ElementPlan {
  role: Role;
  // Nom affiché : un nom de machine (tel quel) ou un texte déjà traduit.
  nom: string;
  // Adresse ou réseau (192.0.2.21, 10.10.10.0/24), ou « DHCP ».
  adresse?: string;
  // Ce qu'elle fait, en quelques mots (texte traduit) : « routeur, DHCP ».
  note?: string;
  // Le nom de la machine dans le jeu (celui de l'invite), pour « tu es ici ».
  hote?: string;
  // Le lien vers son parent passe par un tunnel (WireGuard) : en pointillés.
  tunnel?: boolean;
  enfants?: ElementPlan[];
}

/** Le début de tout plan : internet, et le poste d'où l'on part. */
export const internet = (t: Traduire, ...enfants: ElementPlan[]): ElementPlan => ({
  role: 'internet',
  nom: t('plan-internet'),
  enfants: [{ role: 'poste', nom: nomMachine(t, 'poste'), adresse: '192.0.2.2', note: t('plan-ton-poste'), hote: 'poste' }, ...enfants],
});

export interface Repere {
  ici: boolean;
  visite: boolean;
}

/** Les repères d'un élément pour la partie en cours. */
export const reperes = (e: ElementPlan, ici: string, visitees: Set<string>): Repere => ({
  ici: !!e.hote && e.hote === ici,
  visite: !!e.hote && visitees.has(e.hote),
});

// ——— Mise en place du schéma ———
// Un arbre couché : une colonne par niveau (internet, puis les machines,
// puis les réseaux, puis les appareils), une ligne par feuille ; chaque
// parent est centré sur ses enfants.

export interface Place {
  element: ElementPlan;
  parent: Place | null;
  colonne: number;
  ligne: number;
}

export function disposer(racine: ElementPlan): { places: Place[]; colonnes: number; lignes: number } {
  const places: Place[] = [];
  let feuilles = 0;
  const placer = (e: ElementPlan, parent: Place | null, colonne: number): Place => {
    const p: Place = { element: e, parent, colonne, ligne: 0 };
    places.push(p);
    const enfants = (e.enfants ?? []).map((x) => placer(x, p, colonne + 1));
    p.ligne = enfants.length ? (enfants[0].ligne + enfants.at(-1)!.ligne) / 2 : feuilles++;
    return p;
  };
  placer(racine, null, 0);
  return { places, colonnes: Math.max(...places.map((p) => p.colonne)) + 1, lignes: feuilles };
}
