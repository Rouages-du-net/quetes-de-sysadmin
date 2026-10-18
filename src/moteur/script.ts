// Un petit interpréteur de scripts shell (/bin/sh), pour les crochets de git
// et les scripts de déploiement. Chaque ligne est lancée par le shell du jeu
// (shell.ts), depuis le lieu du script.
//
// Ce qu'il comprend, comme dash (le /bin/sh de Debian, https://manpages.debian.org/dash) :
// les commentaires et la ligne #!, les lignes coupées par « \ », set -e
// (s'arrêter à la première commande qui échoue), exit N, les variables
// (NOM=valeur, export, $NOM, ${NOM}, $1…, $?), $(commande), read (une ligne
// de l'entrée), cd, true, false, :, [ … ] (la commande test), et les suites
// « a && b », « a || b ».
// Une affectation devant une commande (GIT_WORK_TREE=… git …) ne vaut que
// pour git, qui la lit comme l'option correspondante.
// Écarts : pas de if, for, while, case ni de fonctions (une erreur le dit),
// et le code de retour d'une commande vaut 0 si elle n'a écrit aucune erreur.

import type { Shell } from './shell';

export interface ResultatScript {
  sortie: string;
  code: number;
}

export interface OptionsScript {
  // Le lieu de départ (pour un crochet de git : le dépôt).
  cwd: string;
  // L'entrée standard (pour un crochet pre-receive : « ancien nouveau ref »).
  entree?: string;
  // $0, $1, $2…
  arguments?: string[];
  // Le nom du script, pour les messages d'erreur (comme sh : « nom: 3: … »).
  nom: string;
}

// Coupe une ligne sur && et || (hors des guillemets).
function enchainement(ligne: string): { commande: string; avant: '&&' | '||' | null }[] {
  const morceaux: { commande: string; avant: '&&' | '||' | null }[] = [];
  let courant = '';
  let avant: '&&' | '||' | null = null;
  let guillemet = '';
  for (let i = 0; i < ligne.length; i++) {
    const c = ligne[i];
    if (guillemet) {
      if (c === guillemet) guillemet = '';
      courant += c;
    } else if (c === '"' || c === "'") {
      guillemet = c;
      courant += c;
    } else if ((c === '&' || c === '|') && ligne[i + 1] === c) {
      morceaux.push({ commande: courant.trim(), avant });
      avant = c === '&' ? '&&' : '||';
      courant = '';
      i++;
    } else courant += c;
  }
  morceaux.push({ commande: courant.trim(), avant });
  return morceaux;
}

const MOTS_RESERVES = ['if', 'then', 'else', 'elif', 'fi', 'for', 'while', 'until', 'do', 'done', 'case', 'esac', 'function'];

/** Exécute un script ; renvoie ce qu'il a écrit (sortie et erreurs mêlées) et son code de retour. */
export function executerScript(jeu: Shell, texte: string, options: OptionsScript): ResultatScript {
  const variables: Record<string, string> = { '?': '0', '0': options.nom };
  (options.arguments ?? []).forEach((a, i) => (variables[String(i + 1)] = a));
  const entree = (options.entree ?? '').split('\n');
  let cwd = options.cwd;
  let arretSurErreur = false;
  const sorties: string[] = [];

  // $NOM, ${NOM}, $1, $? et $(commande) ; rien entre guillemets simples.
  const developper = (s: string): string => {
    let resultat = '';
    let simple = false;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === "'" && !simple) {
        simple = true;
        resultat += c;
      } else if (c === "'" && simple) {
        simple = false;
        resultat += c;
      } else if (c === '$' && !simple) {
        if (s[i + 1] === '(') {
          let profondeur = 1;
          let j = i + 2;
          for (; j < s.length && profondeur; j++) profondeur += s[j] === '(' ? 1 : s[j] === ')' ? -1 : 0;
          const interieur = s.slice(i + 2, j - 1);
          resultat += jeu.sousCommande(developper(interieur), cwd).sortie.trim();
          i = j - 1;
        } else {
          const m = /^\{([A-Za-z_][A-Za-z0-9_]*|\d+|\?)\}|^([A-Za-z_][A-Za-z0-9_]*|\d|\?)/.exec(s.slice(i + 1));
          if (!m) resultat += c;
          else {
            resultat += variables[m[1] ?? m[2]] ?? '';
            i += m[0].length;
          }
        }
      } else resultat += c;
    }
    return resultat;
  };

  // Une commande simple ; renvoie son code de retour.
  const lancer = (brute: string, numero: number): number => {
    let ligne = developper(brute).trim();
    if (!ligne || ligne === ':' || ligne === 'true') return 0;
    if (ligne === 'false') return 1;
    // [ condition ] est la commande test (son dernier argument doit être « ] »).
    if (/^\[(\s|$)/.test(ligne)) {
      if (!/\s\]$/.test(ligne)) {
        sorties.push(jeu.t('test-crochet-manquant', { script: options.nom, numero }));
        return 2;
      }
      ligne = `test ${ligne.slice(1, -1).trim()}`;
    }
    const premier = ligne.split(/\s+/)[0];
    if (MOTS_RESERVES.includes(premier)) {
      sorties.push(jeu.t('script-non-simule', { script: options.nom, numero, mot: premier }));
      return 2;
    }
    const set = /^set\s+(.*)$/.exec(ligne);
    if (set) {
      if (/-\w*e/.test(set[1])) arretSurErreur = true;
      return 0;
    }
    const read = /^read\s+(.*)$/.exec(ligne);
    if (read) {
      const noms = read[1].split(/\s+/).filter((n) => !n.startsWith('-'));
      const valeurs = (entree.shift() ?? '').trim().split(/\s+/);
      noms.forEach((n, i) => (variables[n] = i === noms.length - 1 ? valeurs.slice(i).join(' ') : (valeurs[i] ?? '')));
      return 0;
    }
    // NOM=valeur (seul) : une variable ; devant une commande : son environnement.
    const affectations: Record<string, string> = {};
    for (;;) {
      const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=("[^"]*"|'[^']*'|\S*)\s*/.exec(ligne);
      if (!m) break;
      affectations[m[1]] = m[2].replace(/^(["'])(.*)\1$/, '$2');
      ligne = ligne.slice(m[0].length);
    }
    if (!ligne) {
      Object.assign(variables, affectations);
      return 0;
    }
    if (ligne.startsWith('git ')) {
      const options = [
        ...(affectations.GIT_DIR ? [`--git-dir=${affectations.GIT_DIR}`] : []),
        ...(affectations.GIT_WORK_TREE ? [`--work-tree=${affectations.GIT_WORK_TREE}`] : []),
      ];
      if (options.length) ligne = `git ${options.join(' ')} ${ligne.slice(4)}`;
    }
    const r = jeu.sousCommande(ligne, cwd);
    cwd = r.cwd;
    if (r.sortie) sorties.push(r.sortie);
    return r.ok ? 0 : 1;
  };

  // Les lignes, recollées après un « \ » final.
  const lignes = texte.replace(/\\\n/g, ' ').split('\n');
  for (let n = 0; n < lignes.length; n++) {
    const ligne = lignes[n].trim();
    if (!ligne || ligne.startsWith('#')) continue;
    const exit = /^exit(?:\s+(\S+))?$/.exec(ligne);
    if (exit) return { sortie: sorties.join('\n'), code: Number(developper(exit[1] ?? '$?')) || 0 };
    let code = 0;
    for (const { commande, avant } of enchainement(ligne)) {
      if ((avant === '&&' && code !== 0) || (avant === '||' && code === 0)) continue;
      const fin = /^exit(?:\s+(\S+))?$/.exec(commande);
      if (fin) return { sortie: sorties.join('\n'), code: Number(developper(fin[1] ?? String(code))) || 0 };
      code = lancer(commande, n + 1);
    }
    variables['?'] = String(code);
    if (code !== 0 && arretSurErreur) return { sortie: sorties.join('\n'), code };
  }
  return { sortie: sorties.join('\n'), code: Number(variables['?']) };
}
