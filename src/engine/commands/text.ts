// Commandes de texte : elles lisent des fichiers, ou ce qui arrive par un
// tube quand on ne leur donne pas de fichier. C'est la force d'Unix : de
// petits outils qui font une seule chose, et qu'on enchaîne.

import { options } from '../tools';
import { colorer, lireCouleur, messageCouleurInvalide, sgr } from '../colours';
import type { Commande, Contexte } from './index';

// Les lignes à traiter : celles des fichiers donnés, sinon l'entrée du tube.
function textes(cmd: string, { entree, jeu }: Contexte, fichiers: string[]): { nom: string; texte: string }[] {
  if (!fichiers.length) {
    if (entree === null) jeu.erreur(jeu.t('texte-sans-entree', { commande: cmd }));
    return entree === null ? [] : [{ nom: '', texte: entree }];
  }
  return fichiers
    .map((f) => ({ nom: f, texte: jeu.lirePour(cmd, f) }))
    .filter((t): t is { nom: string; texte: string } => t.texte !== null);
}

const lignesDe = (t: string) => (t === '' ? [] : t.split('\n'));

// -n 5, -n5 ou -5 → 5.
function nombre(args: string[], defaut: number): { n: number; reste: string[] } {
  const reste: string[] = [];
  let n = defaut;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-n') n = Number(args[++i]);
    else if (/^-n\d+$/.test(a)) n = Number(a.slice(2));
    else if (/^-\d+$/.test(a)) n = Number(a.slice(1));
    else reste.push(a);
  }
  return { n: Number.isFinite(n) ? n : defaut, reste };
}

function tete(cmd: 'head' | 'tail') {
  return (c: Contexte) => {
    const { n, reste } = nombre(c.args, 10);
    const ts = textes(cmd, c, reste);
    return ts
      .map(({ nom, texte }) => {
        const l = lignesDe(texte);
        const part = cmd === 'head' ? l.slice(0, n) : l.slice(Math.max(0, l.length - n));
        return (ts.length > 1 ? `==> ${nom} <==\n` : '') + part.join('\n');
      })
      .join('\n\n');
  };
}

export const TEXTE: Record<string, Commande> = {
  less: {
    lancer: (c) => textes('less', c, c.args.slice(0, 1)).map((t) => t.texte).join('\n'),
  },

  grep: {
    lancer: (brut) => {
      // --color : comme l'alias « grep --color=auto » du ~/.bashrc de Debian.
      const couleur = lireCouleur(brut.args, 'auto', 'auto');
      if (couleur.invalide !== undefined) return brut.jeu.erreur(messageCouleurInvalide(brut, 'grep', couleur.invalide));
      const c = { ...brut, args: couleur.args };
      const enCouleur = colorer(c, couleur.quand);
      const { lettres, reste } = options(c.args);
      const [motif, ...fichiers] = reste;
      if (motif === undefined) return c.jeu.erreur(c.jeu.t('grep-usage'));
      const casse = lettres.has('i');
      // Le motif : une expression régulière basique (BRE), étendue avec -E, du texte brut avec -F.
      let re: RegExp | null = null;
      if (!lettres.has('F'))
        try {
          re = new RegExp(lettres.has('E') ? motif : versRegexBasique(motif), casse ? 'i' : '');
        } catch {
          c.jeu.statut = 2;
          return c.jeu.erreur(/\[/.test(motif) && !/\]/.test(motif) ? 'grep: Unmatched [, [^, [:, [., or [=' : 'grep: Invalid regular expression');
        }
      const cherche = casse ? motif.toLowerCase() : motif;
      const correspond = (l: string) => (re ? re.test(l) : (casse ? l.toLowerCase() : l).includes(cherche));
      const ts = textes('grep', c, fichiers);
      // En couleur (GREP_COLORS par défaut) : ce qui correspond en rouge gras, le nom du fichier en magenta, le « : » en cyan.
      const global = re ? new RegExp(re.source, re.flags + 'g') : null;
      const surligner = (l: string) => {
        if (!enCouleur || lettres.has('v')) return l;
        if (global) return l.replace(global, (m) => sgr('01;31', m));
        if (!cherche) return l;
        let sortie = '';
        let i = 0;
        const dans = casse ? l.toLowerCase() : l;
        for (let k = dans.indexOf(cherche); k >= 0; k = dans.indexOf(cherche, i)) {
          sortie += l.slice(i, k) + sgr('01;31', l.slice(k, k + cherche.length));
          i = k + cherche.length;
        }
        return sortie + l.slice(i);
      };
      const prefixe = (nom: string) => (enCouleur ? `${sgr('35', nom)}${sgr('36', ':')}` : `${nom}:`);
      const sorties: string[] = [];
      for (const { nom, texte } of ts) {
        const garde = lignesDe(texte).filter((l) => correspond(l) !== lettres.has('v'));
        if (lettres.has('c')) sorties.push(ts.length > 1 ? `${prefixe(nom)}${garde.length}` : String(garde.length));
        else sorties.push(...garde.map((l) => (ts.length > 1 ? `${prefixe(nom)}${surligner(l)}` : surligner(l))));
      }
      // Écart volontaire : le vrai grep ne dit rien quand il ne trouve rien ;
      // ici, on le précise (seulement à l'écran, jamais dans un tube).
      // -q : rien à l'écran ; seul compte le code de retour (échec si rien trouvé).
      if (lettres.has('q')) return sorties.length ? '' : c.jeu.erreur('');
      // Comme grep : code 1 quand rien ne correspond (utile dans un script).
      c.jeu.statut = sorties.length ? 0 : 1;
      if (!sorties.length && c.dernier && ts.length) c.jeu.erreur(c.jeu.t('grep-rien', { motif }));
      return sorties.join('\n');
    },
  },

  head: {
    lancer: tete('head'),
  },

  tail: {
    // -f (--follow, -F) : après la fin du fichier, tail attend ce qui s'y ajoute
    // et l'affiche, jusqu'à Ctrl-C (Shell.suivi, voir activite.ts).
    lancer: (c) => {
      const suivre = c.args.some((a) => a === '-f' || a === '-F' || a === '--follow');
      const args = c.args.filter((a) => a !== '-f' && a !== '-F' && a !== '--follow');
      const sortie = tete('tail')({ ...c, args });
      const { reste } = nombre(args, 10);
      // Écart : dans un tube (tail -f journal | grep …), le jeu affiche une fois, sans suivre.
      if (!suivre || !c.dernier || reste.length !== 1 || c.jeu.lirePour('tail', reste[0]) === null) return sortie;
      const fichier = c.jeu.resoudre(reste[0]);
      let vues = lignesDe(c.jeu.lire(fichier) ?? '').length;
      c.jeu.suivi = {
        lire: () => {
          const lignes = lignesDe(c.jeu.lire(fichier) ?? '');
          if (lignes.length < vues) {
            vues = lignes.length;
            return `tail: ${reste[0]}: file truncated`;
          }
          const nouvelles = lignes.slice(vues);
          vues = lignes.length;
          return nouvelles.join('\n');
        },
      };
      return sortie;
    },
  },

  wc: {
    lancer: (c) => {
      const { lettres, reste } = options(c.args);
      const tous = !lettres.has('l') && !lettres.has('w') && !lettres.has('c');
      return textes('wc', c, reste)
        .map(({ nom, texte }) => {
          // Comme le vrai wc : on compte les fins de ligne.
          const champs: number[] = [];
          if (tous || lettres.has('l')) champs.push(texte === '' ? 0 : texte.split('\n').length);
          if (tous || lettres.has('w')) champs.push(texte.split(/\s+/).filter(Boolean).length);
          if (tous || lettres.has('c')) champs.push(new TextEncoder().encode(texte).length + (texte ? 1 : 0));
          return [champs.length === 1 ? String(champs[0]) : champs.map((n) => String(n).padStart(6)).join(' '), nom].filter(Boolean).join(' ');
        })
        .join('\n');
    },
  },

  sort: {
    lancer: (c) => {
      const { lettres, reste } = options(c.args);
      const lignes = textes('sort', c, reste).flatMap((t) => lignesDe(t.texte));
      const num = (l: string) => parseFloat(l.trim()) || 0;
      lignes.sort(lettres.has('n') ? (a, b) => num(a) - num(b) || a.localeCompare(b, 'fr') : (a, b) => a.localeCompare(b, 'fr'));
      if (lettres.has('r')) lignes.reverse();
      return lignes.join('\n');
    },
  },

  uniq: {
    lancer: (c) => {
      const { lettres, reste } = options(c.args);
      const groupes: { ligne: string; n: number }[] = [];
      for (const l of textes('uniq', c, reste).flatMap((t) => lignesDe(t.texte))) {
        const dernier = groupes.at(-1);
        if (dernier && dernier.ligne === l) dernier.n++;
        else groupes.push({ ligne: l, n: 1 });
      }
      return groupes.map((g) => (lettres.has('c') ? `${String(g.n).padStart(7)} ${g.ligne}` : g.ligne)).join('\n');
    },
  },

  cut: {
    lancer: (c) => {
      let sep = '\t';
      let champs: number[] = [];
      const fichiers: string[] = [];
      for (let i = 0; i < c.args.length; i++) {
        const a = c.args[i];
        if (a === '-d') sep = c.args[++i] ?? sep;
        else if (a.startsWith('-d')) sep = a.slice(2);
        else if (a === '-f') champs = (c.args[++i] ?? '').split(',').map(Number);
        else if (a.startsWith('-f')) champs = a.slice(2).split(',').map(Number);
        else fichiers.push(a);
      }
      if (!champs.length || champs.some((n) => !n)) return c.jeu.erreur(c.jeu.t('cut-champs'));
      if (sep.length !== 1) return c.jeu.erreur(c.jeu.t('cut-separateur'));
      return textes('cut', c, fichiers)
        .flatMap((t) => lignesDe(t.texte))
        .map((l) => {
          const parts = l.split(sep);
          return parts.length === 1 ? l : champs.map((n) => parts[n - 1]).filter((p) => p !== undefined).join(sep);
        })
        .join('\n');
    },
  },
};

// Une expression régulière basique (BRE, comme grep sans -E) en expression JavaScript :
// + ? | ( ) { } sont des caractères ordinaires, et spéciaux précédés de \ ;
// les crochets [...] sont recopiés tels quels.
export function versRegexBasique(motif: string): string {
  let res = '';
  for (let i = 0; i < motif.length; i++) {
    const c = motif[i];
    if (c === '\\' && i + 1 < motif.length) {
      const s = motif[++i];
      res += '+?|(){}'.includes(s) ? s : `\\${s}`;
    } else if ('+?|(){}'.includes(c)) res += `\\${c}`;
    else if (c === '[') {
      const fin = motif.indexOf(']', i + (motif[i + 1] === ']' ? 2 : motif[i + 1] === '^' && motif[i + 2] === ']' ? 3 : 1));
      if (fin < 0) return motif.slice(0, i) + '[';
      res += motif.slice(i, fin + 1);
      i = fin;
    } else res += c;
  }
  return res;
}
