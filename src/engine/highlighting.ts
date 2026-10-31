// La coloration de la ligne de commande, comme fish ou
// zsh-syntax-highlighting : la commande en vert si elle existe, en rouge
// sinon (on voit la faute de frappe avant d'appuyer sur Entrée), les
// options, les chaînes entre guillemets, les opérateurs, et les chemins qui
// existent soulignés. Elle suit le shell du jeu (decouper() dans outils.ts) :
// tubes et redirections (|, >, >>), guillemets, jokers, sudo ; rien de ce
// que ce shell ne comprend pas (pas de && ni de $VARIABLE) n'est mis en
// valeur. La ligne découpée se recolle exactement (les espaces compris),
// pour que l'interface puisse la dessiner sous le champ de saisie.

import type { Shell } from './shell';
import { COMMANDES } from './commands';

export type Genre = 'commande' | 'inconnue' | 'option' | 'chaine' | 'operateur' | 'chemin' | 'joker' | 'texte';

export interface Jeton {
  texte: string;
  genre: Genre;
}

// Un mot de la ligne : ses morceaux (entre guillemets ou non), sa position.
interface Mot {
  morceaux: { texte: string; cite: boolean }[];
  // Le mot tel que le shell le lira (sans les guillemets).
  valeur: string;
  op?: '|' | '>' | '>>';
}

/** La ligne en morceaux : des mots, des opérateurs et des espaces, dans l'ordre. */
function lexer(ligne: string): (Mot | string)[] {
  const sortie: (Mot | string)[] = [];
  let mot: Mot | null = null;
  let guillemet = '';
  const finir = () => {
    if (mot) sortie.push(mot);
    mot = null;
  };
  const ajouter = (c: string, cite: boolean) => {
    mot ??= { morceaux: [], valeur: '' };
    const dernier = mot.morceaux.at(-1);
    if (dernier && dernier.cite === cite) dernier.texte += c;
    else mot.morceaux.push({ texte: c, cite });
  };
  for (let i = 0; i < ligne.length; i++) {
    const c = ligne[i];
    if (guillemet) {
      ajouter(c, true);
      if (c === guillemet) guillemet = '';
      else mot!.valeur += c;
    } else if (c === '"' || c === "'") {
      guillemet = c;
      // Une nouvelle chaîne commence : un morceau à elle.
      mot ??= { morceaux: [], valeur: '' };
      mot.morceaux.push({ texte: c, cite: true });
    } else if (/\s/.test(c)) {
      finir();
      if (typeof sortie.at(-1) === 'string') sortie[sortie.length - 1] += c;
      else sortie.push(c);
    } else if (c === '|' || c === '>') {
      finir();
      const double = c === '>' && ligne[i + 1] === '>';
      if (double) i++;
      const op = double ? '>>' : (c as '|' | '>');
      sortie.push({ morceaux: [{ texte: op, cite: false }], valeur: op, op });
    } else {
      ajouter(c, false);
      mot!.valeur += c;
    }
  }
  finir();
  return sortie;
}

/** La commande existe-t-elle ici (le shell la lancerait-il) ? */
function existe(sh: Shell, nom: string): boolean {
  if (!nom) return false;
  if (nom.includes('/')) {
    // /usr/bin/ls : le chemin complet d'une commande du jeu.
    const seul = nom.split('/').at(-1)!;
    if (/^\/(usr\/)?s?bin\/[\w.-]+$/.test(nom) && COMMANDES[seul] && !COMMANDES[seul].dossier) return sh.connues().includes(seul);
    if (COMMANDES[seul]?.dossier && nom === `${COMMANDES[seul].dossier}/${seul}`) return sh.connues().includes(seul);
    // Un script : il faut qu'il existe et qu'on puisse le lancer.
    const n = sh.trouver(nom);
    return !!n && n.type === 'fichier' && sh.peut(n, 'x');
  }
  if (COMMANDES[nom]?.section === 5) return false;
  // !!, !12, !cat : l'historique, que le shell développe avant de lancer la commande.
  if (/^!(!|-?\d+|[A-Za-z_./])/.test(nom)) return true;
  // help est intégré au shell (comme aide) : il répond toujours.
  return nom === 'help' || sh.connues().includes(nom);
}

/** Un argument qui désigne un fichier ou un dossier existant (comme le soulignement de zsh). */
function chemin(sh: Shell, valeur: string): boolean {
  if (!valeur || valeur.startsWith('-')) return false;
  try {
    return sh.trouver(valeur) !== null;
  } catch {
    return false;
  }
}

/** La ligne découpée en jetons colorés ; leurs textes recollés redonnent la ligne. */
export function colorer(sh: Shell, ligne: string): Jeton[] {
  const jetons: Jeton[] = [];
  const pousser = (texte: string, genre: Genre) => {
    if (!texte) return;
    const dernier = jetons.at(-1);
    if (dernier && dernier.genre === genre) dernier.texte += texte;
    else jetons.push({ texte, genre });
  };
  // Où l'on en est dans la commande : on attend son nom, une option de sudo, ou des arguments.
  let attendu: 'commande' | 'sudo' | 'valeur-sudo' | 'argument' | 'cible' = 'commande';
  for (const x of lexer(ligne)) {
    if (typeof x === 'string') {
      pousser(x, 'texte');
      continue;
    }
    if (x.op) {
      pousser(x.valeur, 'operateur');
      // Après une redirection vient un fichier ; après un tube, une commande.
      attendu = x.op === '|' ? 'commande' : 'cible';
      continue;
    }
    let genre: Genre;
    const nonCite = x.morceaux.every((m) => !m.cite);
    if (attendu === 'commande' || attendu === 'sudo') {
      if (attendu === 'sudo' && x.valeur.startsWith('-')) {
        genre = 'option';
        if (x.valeur === '-u' || x.valeur === '-g') attendu = 'valeur-sudo';
      } else {
        genre = existe(sh, x.valeur) ? 'commande' : 'inconnue';
        attendu = x.valeur === 'sudo' && genre === 'commande' ? 'sudo' : 'argument';
      }
    } else if (attendu === 'valeur-sudo') {
      genre = 'texte';
      attendu = 'sudo';
    } else if (nonCite && /^-./.test(x.valeur) && attendu === 'argument') genre = 'option';
    else if (nonCite && /[*?]/.test(x.valeur)) genre = sh.developper(x.valeur)[0] !== x.valeur ? 'joker' : 'texte';
    else genre = chemin(sh, x.valeur) ? 'chemin' : 'texte';
    if (attendu === 'cible') attendu = 'argument';
    // Les morceaux entre guillemets restent des chaînes, sauf pour le nom de la commande.
    for (const m of x.morceaux) pousser(m.texte, m.cite && genre !== 'commande' && genre !== 'inconnue' && genre !== 'chemin' ? 'chaine' : genre);
  }
  return jetons;
}
