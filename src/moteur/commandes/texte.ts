// Commandes de texte : elles lisent des fichiers, ou ce qui arrive par un
// tube quand on ne leur donne pas de fichier. C'est la force d'Unix : de
// petits outils qui font une seule chose, et qu'on enchaîne.

import { options } from '../outils';
import type { Commande, Contexte } from './index';

// Les lignes à traiter : celles des fichiers donnés, sinon l'entrée du tube.
function textes(cmd: string, { entree, jeu }: Contexte, fichiers: string[]): { nom: string; texte: string }[] {
  if (!fichiers.length) {
    if (entree === null) jeu.erreur(`${cmd} : il faut un fichier (ou du texte qui arrive par un tube |)`);
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
    manuel: 'less fichier — affiche un fichier page par page. Ici, les fichiers sont courts : less fait comme cat.',
    lancer: (c) => textes('less', c, c.args.slice(0, 1)).map((t) => t.texte).join('\n'),
  },

  grep: {
    manuel:
      'grep [-i] [-v] [-c] motif [fichier...] — affiche les lignes qui contiennent le motif. -i ignore les majuscules, -v garde les lignes qui ne le contiennent PAS, -c compte les lignes. Sans fichier, cherche dans ce qui arrive par un tube. « grep mot * » cherche dans tous les fichiers du lieu.',
    lancer: (c) => {
      const { lettres, reste } = options(c.args);
      const [motif, ...fichiers] = reste;
      if (motif === undefined) return c.jeu.erreur('Usage : grep motif fichier (ex. : grep poivre livre.txt)');
      const casse = lettres.has('i');
      const cherche = casse ? motif.toLowerCase() : motif;
      const ts = textes('grep', c, fichiers);
      const sorties: string[] = [];
      for (const { nom, texte } of ts) {
        const garde = lignesDe(texte).filter((l) => (casse ? l.toLowerCase() : l).includes(cherche) !== lettres.has('v'));
        if (lettres.has('c')) sorties.push(ts.length > 1 ? `${nom}:${garde.length}` : String(garde.length));
        else sorties.push(...garde.map((l) => (ts.length > 1 ? `${nom}:${l}` : l)));
      }
      // Écart volontaire : le vrai grep ne dit rien quand il ne trouve rien ;
      // ici, on le précise (seulement à l'écran, jamais dans un tube).
      if (!sorties.length && c.dernier && ts.length) c.jeu.erreur(`(aucune ligne ne contient « ${motif} »)`);
      return sorties.join('\n');
    },
  },

  head: {
    manuel: 'head [-n N] [fichier] — affiche le début d’un fichier (les 10 premières lignes, ou N).',
    lancer: tete('head'),
  },

  tail: {
    manuel: 'tail [-n N] [fichier] — affiche la fin d’un fichier (les 10 dernières lignes, ou N). Pratique pour les journaux, où le plus récent est à la fin.',
    lancer: tete('tail'),
  },

  wc: {
    manuel: 'wc [-l] [-w] [-c] [fichier] — compte (word count) les lignes (-l), les mots (-w) et les octets (-c). Sans option : les trois.',
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
    manuel: 'sort [-n] [-r] [fichier] — trie les lignes : par ordre alphabétique, ou -n numérique (2 avant 10), -r à l’envers.',
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
    manuel:
      'uniq [-c] [fichier] — fusionne les lignes identiques qui se suivent. -c indique combien de fois chacune apparaît. On trie d’abord (sort) pour que les doublons se suivent : sort | uniq -c',
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
    manuel:
      'cut -d séparateur -f N [fichier] — découpe chaque ligne en champs selon le séparateur et garde le champ N (ou N,M). Ex. : cut -d " " -f 1 garde le premier mot.',
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
      if (!champs.length || champs.some((n) => !n)) return c.jeu.erreur('cut : il faut préciser les champs avec -f (ex. : cut -d " " -f 1)');
      if (sep.length !== 1) return c.jeu.erreur('cut : le séparateur doit être un seul caractère');
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

