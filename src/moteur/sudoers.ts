// La politique de sudo : /etc/sudoers et les fichiers qu'il inclut, lus
// comme sudoers(5) (https://www.sudo.ws/docs/man/sudoers.man/) :
//   - « @includedir /etc/sudoers.d » (ou l'ancienne forme #includedir) lit
//     chaque fichier du dossier, dans l'ordre, SAUF ceux dont le nom contient
//     un point ou finit par ~ (un « caisse.conf » est ignoré) ;
//   - une règle : « qui machines = (comptes) [NOPASSWD:] commandes » ; qui :
//     un compte, %groupe ou ALL ; une commande : ALL, ou un chemin complet
//     (sans arguments : tous les arguments sont permis ; avec : ceux-là
//     seulement ; * en joker) ;
//   - les lignes Defaults et les alias (Cmnd_Alias…) sont acceptés ; les
//     alias de commandes sont développés.
// Écarts : pas d'alias d'utilisateurs ni de machines, pas de Runas_Alias,
// pas de « ! » (négation), pas de digest ; la machine est toujours ALL.

import type { Shell } from './shell';
import { joker } from './outils';

export const SUDOERS = '/etc/sudoers';

export interface Regle {
  qui: string[];
  comme: string[];
  commeTexte: string;
  sansMotDePasse: boolean;
  commandes: string[];
  // Où elle est écrite (pour sudo -l).
  fichier: string;
}

export interface ErreurSudoers {
  fichier: string;
  ligne: number;
  colonne: number;
  // Une clé de texte (sudoers-erreur-…), traduite par l'appelant.
  cle: string;
  texte: string;
  longueur: number;
}

// Les fichiers qu'un @includedir lit : sans point ni ~ final, triés.
export function fichiersInclus(jeu: Shell, dossier: string): string[] {
  const d = jeu.trouver(dossier);
  if (d?.type !== 'dossier') return [];
  return Object.keys(d.enfants)
    .filter((n) => !n.includes('.') && !n.endsWith('~') && d.enfants[n].type === 'fichier')
    .sort()
    .map((n) => `${dossier}/${n}`);
}

/** Analyse un texte sudoers : les règles, et la première erreur de syntaxe. */
export function analyser(texte: string, fichier: string): { regles: Regle[]; inclus: string[]; defauts: string[]; erreur: ErreurSudoers | null } {
  const regles: Regle[] = [];
  const defauts: string[] = [];
  const inclus: string[] = [];
  const alias: Record<string, string[]> = {};
  const lignes = texte.split('\n');
  for (const [i, brute] of lignes.entries()) {
    const inclusion = /^\s*[@#]include(dir)?\s+(\S+)/.exec(brute);
    if (inclusion) {
      inclus.push((inclusion[1] ? 'dir:' : '') + inclusion[2]);
      continue;
    }
    const ligne = brute.replace(/#.*/, '').trimEnd();
    if (!ligne.trim()) continue;
    const erreur = (cle: string, morceau: string): ErreurSudoers => {
      const colonne = Math.max(1, brute.indexOf(morceau) + 1);
      return { fichier, ligne: i + 1, colonne, cle, texte: brute, longueur: Math.max(1, morceau.length) };
    };
    const d = /^\s*Defaults\s+(.+)$/.exec(ligne);
    if (d) {
      defauts.push(d[1].trim());
      continue;
    }
    const a = /^\s*(Cmnd_Alias|User_Alias|Host_Alias|Runas_Alias)\s+([A-Z][A-Z0-9_]*)\s*=\s*(.+)$/.exec(ligne);
    if (a) {
      if (a[1] === 'Cmnd_Alias') alias[a[2]] = a[3].split(',').map((c) => c.trim());
      continue;
    }
    const r = /^\s*([^\s=,]+(?:\s*,\s*[^\s=,]+)*)\s+([^\s=]+)\s*=\s*(?:\(([^)]*)\)\s*)?((?:[A-Z_]+:\s*)*)(.*)$/.exec(ligne);
    if (!r) return { regles, inclus, defauts, erreur: erreur('sudoers-erreur-syntaxe', ligne.trim().split(/\s+/).at(-1) ?? ligne) };
    const commandes = r[5]
      .split(',')
      .map((c) => c.trim())
      .flatMap((c) => alias[c] ?? [c]);
    if (!commandes.length || commandes.some((c) => !c))
      return { regles, inclus, defauts, erreur: erreur('sudoers-erreur-syntaxe', r[5] || ligne.trim()) };
    const relative = commandes.find((c) => c !== 'ALL' && !c.startsWith('/'));
    if (relative) return { regles, inclus, defauts, erreur: erreur('sudoers-erreur-chemin', relative.split(/\s+/)[0]) };
    regles.push({
      qui: r[1].split(',').map((q) => q.trim()),
      comme: (r[3] ?? 'root').split(',').map((c) => c.trim().split(':')[0] || 'root'),
      // Tel que sudo -l l'affiche : « ALL : ALL ».
      commeTexte: (r[3] ?? 'root').replace(/\s*:\s*/, ' : '),
      sansMotDePasse: /NOPASSWD:/.test(r[4]),
      commandes,
      fichier,
    });
  }
  return { regles, inclus, defauts, erreur: null };
}

/** Toute la politique : /etc/sudoers et ses inclusions ; la première erreur trouvée. */
export function lire(jeu: Shell): { regles: Regle[]; defauts: string[]; fichiers: string[]; erreur: ErreurSudoers | null } {
  const regles: Regle[] = [];
  const defauts: string[] = [];
  const vus = new Set<string>();
  const lireFichier = (fichier: string): ErreurSudoers | null => {
    if (vus.has(fichier)) return null;
    vus.add(fichier);
    const texte = jeu.lire(fichier);
    if (texte === null) return null;
    const r = analyser(texte, fichier);
    regles.push(...r.regles);
    defauts.push(...r.defauts);
    if (r.erreur) return r.erreur;
    for (const i of r.inclus) {
      const e = i.startsWith('dir:') ? fichiersInclus(jeu, i.slice(4)).map(lireFichier).find(Boolean) : lireFichier(i);
      if (e) return e;
    }
    return null;
  };
  const erreur = lireFichier(SUDOERS);
  return { regles, defauts, fichiers: [...vus], erreur };
}

// Une règle s'applique-t-elle à ce compte (son nom, %un de ses groupes, ALL) ?
const pour = (jeu: Shell, r: Regle, compte: string) =>
  r.qui.some((q) => q === 'ALL' || q === compte || (q.startsWith('%') && jeu.groupesDe(compte).includes(q.slice(1))));

// Une commande de la règle couvre-t-elle cette commande (chemin complet et arguments) ?
function couvre(permise: string, demandee: string): boolean {
  if (permise === 'ALL') return true;
  const [chemin, ...args] = permise.split(/\s+/);
  const [cheminD, ...argsD] = demandee.split(/\s+/);
  if (!joker(chemin).test(cheminD)) return false;
  if (!args.length) return true;
  if (args.length === 1 && args[0] === '""') return argsD.length === 0;
  return joker(args.join(' ')).test(argsD.join(' '));
}

/** Ce compte peut-il lancer cette commande (chemin complet) en root avec sudo ? */
export function permis(jeu: Shell, compte: string, commande: string, comme = 'root'): boolean {
  return lire(jeu).regles.some(
    (r) => pour(jeu, r, compte) && (r.comme.includes(comme) || r.comme.includes('ALL')) && r.commandes.some((c) => couvre(c, commande)),
  );
}

/** Les règles d'un compte, comme sudo -l les affiche : « (root) NOPASSWD: /usr/bin/… ». */
export function reglesDe(jeu: Shell, compte: string): string[] {
  return lire(jeu)
    .regles.filter((r) => pour(jeu, r, compte))
    .map((r) => `(${r.commeTexte}) ${r.sansMotDePasse ? 'NOPASSWD: ' : ''}${r.commandes.join(', ')}`);
}
