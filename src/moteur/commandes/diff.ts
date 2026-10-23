// diff (GNU diffutils) : les différences entre deux fichiers, ou entre deux
// lieux (-r). Format normal (« 3c3 », « < », « --- », « > ») ou unifié
// (-u, trois lignes de contexte), -q pour dire seulement s'ils diffèrent.
// D'après https://www.gnu.org/software/diffutils/manual/diffutils.html.
// Écart : l'heure des fichiers, dans l'en-tête de -u, est celle de la
// machine au moment de la commande.

import type { Shell } from '../shell';
import { systemd } from '../systemd';
import type { Commande } from './index';
import { colorer, lireCouleur, messageCouleurInvalide, sgr } from '../couleurs';

// --color : la palette par défaut de GNU diff (hd=1, ad=32, de=31, ln=36).
type Peindre = (code: string, texte: string) => string;
const brut: Peindre = (_code, texte) => texte;

type Op = { t: ' ' | '-' | '+'; l: string; a: number; b: number };

// Le script d'édition (plus longue sous-suite commune) : chaque ligne gardée,
// retirée ou ajoutée, avec ses numéros dans chaque fichier (à partir de 1).
function editer(a: string[], b: string[]): Op[] {
  const l = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--) l[i][j] = a[i] === b[j] ? l[i + 1][j + 1] + 1 : Math.max(l[i + 1][j], l[i][j + 1]);
  const ops: Op[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) ops.push({ t: ' ', l: a[i++], a: i, b: ++j });
    else if (i < a.length && (j === b.length || l[i + 1][j] >= l[i][j + 1])) ops.push({ t: '-', l: a[i++], a: i, b: j });
    else ops.push({ t: '+', l: b[j++], a: i, b: j });
  }
  return ops;
}

const lignes = (texte: string) => (texte === '' ? [] : texte.replace(/\n$/, '').split('\n'));
const plage = (debut: number, fin: number) => (fin > debut ? `${debut},${fin}` : String(debut));

// Le format normal : un bloc par groupe de changements.
function normal(ops: Op[], peindre: Peindre = brut): string {
  const sortie: string[] = [];
  for (let k = 0; k < ops.length; ) {
    if (ops[k].t === ' ') {
      k++;
      continue;
    }
    const groupe: Op[] = [];
    while (k < ops.length && ops[k].t !== ' ') groupe.push(ops[k++]);
    const moins = groupe.filter((o) => o.t === '-');
    const plus = groupe.filter((o) => o.t === '+');
    const avantA = groupe[0].t === '-' ? groupe[0].a - 1 : groupe[0].a;
    const avantB = groupe[0].t === '+' ? groupe[0].b - 1 : groupe[0].b;
    if (moins.length && plus.length) sortie.push(peindre('36', `${plage(avantA + 1, avantA + moins.length)}c${plage(avantB + 1, avantB + plus.length)}`));
    else if (moins.length) sortie.push(peindre('36', `${plage(avantA + 1, avantA + moins.length)}d${avantB}`));
    else sortie.push(peindre('36', `${avantA}a${plage(avantB + 1, avantB + plus.length)}`));
    sortie.push(...moins.map((o) => peindre('31', `< ${o.l}`)));
    if (moins.length && plus.length) sortie.push('---');
    sortie.push(...plus.map((o) => peindre('32', `> ${o.l}`)));
  }
  return sortie.join('\n');
}

// Le format unifié : des morceaux (« @@ -a,n +b,m @@ ») avec 3 lignes de contexte.
function unifie(ops: Op[], nomA: string, nomB: string, date: string, peindre: Peindre = brut): string {
  const changes = ops.map((o, k) => (o.t === ' ' ? -1 : k)).filter((k) => k >= 0);
  if (!changes.length) return '';
  const morceaux: [number, number][] = [];
  for (const k of changes) {
    const debut = Math.max(0, k - 3);
    const fin = Math.min(ops.length - 1, k + 3);
    const dernier = morceaux.at(-1);
    if (dernier && debut <= dernier[1] + 1) dernier[1] = Math.max(dernier[1], fin);
    else morceaux.push([debut, fin]);
  }
  const sortie = [peindre('1', `--- ${nomA}\t${date}`), peindre('1', `+++ ${nomB}\t${date}`)];
  for (const [debut, fin] of morceaux) {
    const part = ops.slice(debut, fin + 1);
    const nA = part.filter((o) => o.t !== '+').length;
    const nB = part.filter((o) => o.t !== '-').length;
    const premierA = part.find((o) => o.t !== '+')?.a ?? part[0].a;
    const premierB = part.find((o) => o.t !== '-')?.b ?? part[0].b;
    const enTete = (premier: number, n: number) => (n === 0 ? `${premier},0` : n === 1 ? String(premier) : `${premier},${n}`);
    sortie.push(
      peindre('36', `@@ -${enTete(nA ? premierA : premierA, nA)} +${enTete(premierB, nB)} @@`),
      ...part.map((o) => peindre(o.t === '-' ? '31' : o.t === '+' ? '32' : '', `${o.t}${o.l}`)),
    );
  }
  return sortie.join('\n');
}

const dateDiff = (jeu: Shell) => {
  const ms = systemd(jeu)?.horloge ?? Date.UTC(2027, 0, 1);
  return `${new Date(ms)
    .toISOString()
    .replace('T', ' ')
    .replace('Z', '')
    .replace(/\.(\d+)$/, '.$1000000')} +0200`;
};

export const DIFF: Record<string, Commande> = {
  diff: {
    options: ['u', 'r', 'q'],
    lancer: (c) => {
      // --color[=QUAND] : sans option, diff ne colore pas ; « --color » seul vaut « auto ».
      const couleur = lireCouleur(c.args, 'never', 'auto');
      if (couleur.invalide !== undefined) return c.jeu.erreur(messageCouleurInvalide(c, 'diff', couleur.invalide));
      const { args } = couleur;
      const { jeu } = c;
      const peindre: Peindre = colorer(c, couleur.quand) ? sgr : brut;
      const lettres = new Set(args.filter((a) => /^-[a-zA-Z]+$/.test(a)).flatMap((a) => [...a.slice(1)]));
      const [gauche, droite] = args.filter((a) => !a.startsWith('-'));
      if (!gauche || !droite) return jeu.erreur(jeu.t('diff-usage', { operande: gauche ?? 'diff' }));
      const sorties: string[] = [];
      const comparer = (a: string, b: string, racine: boolean) => {
        const na = jeu.trouver(a);
        const nb = jeu.trouver(b);
        for (const [chemin, n] of [
          [a, na],
          [b, nb],
        ] as const)
          if (!n) return void jeu.erreur(jeu.t('diff-introuvable', { cible: chemin }));
        if (na!.type === 'dossier' && nb!.type === 'dossier') {
          if (!racine && !lettres.has('r')) return void sorties.push(jeu.t('diff-sous-dossiers', { a, b }));
          const noms = [...new Set([...Object.keys(na!.enfants), ...Object.keys(nb!.enfants)])].sort();
          for (const nom of noms) {
            if (!(nom in nb!.enfants)) sorties.push(jeu.t('diff-seulement', { lieu: a, nom }));
            else if (!(nom in na!.enfants)) sorties.push(jeu.t('diff-seulement', { lieu: b, nom }));
            else comparer(`${a.replace(/\/$/, '')}/${nom}`, `${b.replace(/\/$/, '')}/${nom}`, false);
          }
          return;
        }
        // Un fichier et un lieu : on compare au fichier de même nom dans le lieu.
        if (na!.type === 'dossier' || nb!.type === 'dossier') {
          if (!racine) return void sorties.push(jeu.t('diff-types', { a, b }));
          return comparer(na!.type === 'dossier' ? `${a}/${jeu.nom(b)}` : a, nb!.type === 'dossier' ? `${b}/${jeu.nom(a)}` : b, false);
        }
        const ta = jeu.lirePour('diff', a);
        const tb = jeu.lirePour('diff', b);
        if (ta === null || tb === null || ta === tb) return;
        if (lettres.has('q')) return void sorties.push(jeu.t('diff-differents', { a, b }));
        const ops = editer(lignes(ta), lignes(tb));
        if (!racine) sorties.push(peindre('1', `diff ${[...lettres].map((l) => `-${l}`).join(' ')} ${a} ${b}`.replace(/ +/g, ' ')));
        sorties.push(lettres.has('u') ? unifie(ops, a, b, dateDiff(jeu), peindre) : normal(ops, peindre));
      };
      comparer(gauche, droite, true);
      return sorties.join('\n');
    },
  },
};
