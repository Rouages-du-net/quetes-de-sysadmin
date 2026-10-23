// Les succès et le grade : de petites récompenses, vérifiées sur ce qui
// s'est vraiment passé (la ligne tapée, l'état de la partie), jamais
// déclarées par le joueur ou la joueuse. Les textes (nom, description)
// sont dans src/textes/<langue>/interface.ftl : succes-<id>, et
// succes-<id>.description. Un succès « caché » ne montre son nom qu'une
// fois obtenu (les clins d'œil).

import { HISTOIRES } from './chapitres';
import type { Shell } from './shell';
import type { Carnet } from './carnet';

export interface Contexte {
  // La session où la ligne a été tapée (null : vérification hors d'une ligne).
  sh: Shell | null;
  termines: string[];
  carnet: Carnet;
  // Meilleurs temps en mode examen, par chapitre (ms).
  records: Record<string, number>;
}

export interface Succes {
  id: string;
  cache?: boolean;
  obtenu: (c: Contexte) => boolean;
}

const histoiresFinies = (termines: string[]) => HISTOIRES.filter((h) => h.chapitres.every((c) => termines.includes(c.id)));
const commandes = (c: Contexte) => c.sh?.derniere.commandes ?? [];

export const SUCCES: Succes[] = [
  { id: 'premiere-commande', obtenu: (c) => Object.keys(c.carnet).length > 0 },
  { id: 'manuel', obtenu: (c) => 'man' in c.carnet || 'apropos' in c.carnet },
  { id: 'cache-ls', obtenu: (c) => commandes(c).some((a) => a[0] === 'ls' && a.slice(1).some((o) => /^-[a-zA-Z]*a/.test(o) || o === '--all')) },
  { id: 'tube', obtenu: (c) => commandes(c).length >= 2 },
  { id: 'redirection', obtenu: (c) => !!c.sh?.derniere.redirection },
  { id: 'premier-chapitre', obtenu: (c) => c.termines.length >= 1 },
  { id: 'effaceur', obtenu: (c) => histoiresFinies(c.termines).some((h) => h.id === 'effaceur') },
  { id: 'restauration', obtenu: (c) => ['sauvegarde', 'versions', 'instantanes', 'base'].some((id) => c.termines.includes(id)) },
  { id: 'reseau', obtenu: (c) => histoiresFinies(c.termines).some((h) => h.id === 'ruche') },
  { id: 'trois-histoires', obtenu: (c) => histoiresFinies(c.termines).length >= 3 },
  { id: 'toutes-histoires', obtenu: (c) => histoiresFinies(c.termines).length === HISTOIRES.length },
  { id: 'cinquante-commandes', obtenu: (c) => Object.keys(c.carnet).length >= 50 },
  { id: 'sans-indice', obtenu: (c) => !!c.sh?.termine && c.sh.chapitre.id !== 'poste' && c.sh.indicesDemandes.size === 0 },
  { id: 'examen', obtenu: (c) => Object.keys(c.records).length > 0 },
  { id: 'examen-eclair', obtenu: (c) => Object.values(c.records).some((ms) => ms < 5 * 60_000) },
  // Les clins d'œil : une ligne bien précise (voir OEUFS dans shell.ts).
  { id: 'xyzzy', cache: true, obtenu: (c) => !!c.sh?.oeufs.has('xyzzy') },
  { id: 'sandwich', cache: true, obtenu: (c) => !!c.sh?.oeufs.has('sandwich') },
  { id: 'sl', cache: true, obtenu: (c) => !!c.sh?.oeufs.has('sl') },
];

/** Les succès obtenus maintenant et pas encore notés (dans l'ordre de la liste). */
export const nouveauxSucces = (c: Contexte, deja: Record<string, string>) => SUCCES.filter((s) => !deja[s.id] && s.obtenu(c)).map((s) => s.id);

// Les grades, du premier au dernier : le nombre de chapitres terminés pour l'atteindre.
export const GRADES: { id: string; chapitres: number }[] = [
  { id: 'stagiaire', chapitres: 0 },
  { id: 'apprenti', chapitres: 1 },
  { id: 'junior', chapitres: 4 },
  { id: 'admin', chapitres: 15 },
  { id: 'confirme', chapitres: 30 },
  { id: 'senior', chapitres: 45 },
];
const TOUS = () => HISTOIRES.reduce((n, h) => n + h.chapitres.length, 0);

/** Le grade d'après les chapitres terminés : « SRE » pour tout le jeu. */
export function grade(termines: string[]): string {
  const n = termines.length;
  if (n >= TOUS()) return 'sre';
  return GRADES.filter((g) => n >= g.chapitres).at(-1)!.id;
}
