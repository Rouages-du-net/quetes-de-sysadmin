// Les couleurs des sorties, comme les vrais outils les écrivent : des
// séquences ANSI (SGR, « ESC [ … m »). Un outil ne colore que si sa sortie
// va à l'écran (--color=auto : pas dans un tube ni dans un fichier), ou
// toujours avec --color=always (alors les codes partent aussi dans le tube,
// comme sur un vrai système). L'interface transforme ces séquences en
// couleurs ; les événements des chapitres lisent la sortie sans elles.
//
// Les codes sont ceux par défaut des outils : dircolors (ls), GREP_COLORS
// (grep), diff --palette, systemctl.

import type { Contexte } from './commands';

export const ESC = '\x1b';

/** Le texte entouré d'une couleur (ex. « 01;34 », bleu gras), puis le retour à la normale. */
export const sgr = (code: string, texte: string) => (code && texte ? `${ESC}[${code}m${texte}${ESC}[0m` : texte);

/** La sortie sans ses couleurs (ni les « effacer jusqu'à la fin de la ligne » de grep). */
export const sansCouleurs = (texte: string) => texte.replace(/\x1b\[[0-9;]*[mK]/g, '');

/** La longueur visible (sans les séquences de couleur), pour aligner des colonnes. */
export const largeurVisible = (texte: string) => sansCouleurs(texte).length;

export type Quand = 'always' | 'never' | 'auto';

const VALEURS: Record<string, Quand> = {
  always: 'always',
  yes: 'always',
  force: 'always',
  never: 'never',
  no: 'never',
  none: 'never',
  auto: 'auto',
  tty: 'auto',
  'if-tty': 'auto',
};

/**
 * L'option --color[=QUAND] d'une commande (la dernière l'emporte), et les
 * arguments sans elle. Sans option, `defaut` : « auto » pour ls et grep,
 * comme les alias du ~/.bashrc de Debian ; « never » pour diff.
 */
export function lireCouleur(args: string[], defaut: Quand, sansValeur: Quand = 'always'): { quand: Quand; args: string[]; invalide?: string } {
  let quand = defaut;
  let invalide: string | undefined;
  const reste: string[] = [];
  for (const a of args) {
    const m = /^--colou?r(?:=(.*))?$/.exec(a);
    if (!m) reste.push(a);
    else if (m[1] === undefined) quand = sansValeur;
    else if (VALEURS[m[1]]) quand = VALEURS[m[1]];
    else invalide = m[1];
  }
  return { quand, args: reste, invalide };
}

/** Faut-il colorer ? Selon --color et selon que la sortie va à un terminal qui montre les couleurs. */
export const colorer = (c: Contexte, quand: Quand) => quand === 'always' || (quand === 'auto' && c.dernier && c.jeu.couleurs);

/** Le message de GNU coreutils pour une valeur de --color inconnue (dans la langue du système). */
export const messageCouleurInvalide = (c: Contexte, commande: string, valeur: string) => c.jeu.t('couleur-argument-invalide', { commande, valeur });

// ls : les couleurs par défaut de dircolors (coreutils), pour les types les plus courants.
const ARCHIVES = /\.(tar|tgz|gz|bz2|xz|zst|zip|7z|deb|rpm)$/i;
const IMAGES = /\.(png|jpe?g|gif|svg|webp|bmp)$/i;
export function couleurLs(nom: string, type: 'dossier' | 'fichier', lien: boolean, mode: string): string {
  if (lien) return '01;36';
  if (type === 'dossier') return /t$/i.test(mode) && mode[7] === 'w' ? '30;42' : '01;34';
  if (/^..s/i.test(mode)) return '37;41';
  if (/[xst]/.test(mode[2] + mode[5] + mode[8])) return '01;32';
  if (ARCHIVES.test(nom)) return '01;31';
  if (IMAGES.test(nom)) return '01;35';
  return '';
}

/** Un morceau de texte et son style, pour l'interface : gras, couleur du texte (30-37, 90-97), du fond (40-47). */
export interface Morceau {
  texte: string;
  gras: boolean;
  avant: number | null;
  fond: number | null;
}

/** Une ligne de sortie lue comme un terminal lit les séquences SGR. */
export function morceaux(ligne: string): Morceau[] {
  const sortie: Morceau[] = [];
  let style = { gras: false, avant: null as number | null, fond: null as number | null };
  let i = 0;
  const re = /\x1b\[([0-9;]*)([mK])/g;
  for (let m = re.exec(ligne); m; m = re.exec(ligne)) {
    if (m.index > i) sortie.push({ texte: ligne.slice(i, m.index), ...style });
    i = re.lastIndex;
    if (m[2] !== 'm') continue;
    const codes = m[1] === '' ? [0] : m[1].split(';').map(Number);
    for (const c of codes) {
      if (c === 0) style = { gras: false, avant: null, fond: null };
      else if (c === 1) style = { ...style, gras: true };
      else if (c === 22) style = { ...style, gras: false };
      else if ((c >= 30 && c <= 37) || (c >= 90 && c <= 97)) style = { ...style, avant: c >= 90 ? c - 60 : c };
      else if (c === 39) style = { ...style, avant: null };
      else if (c >= 40 && c <= 47) style = { ...style, fond: c };
      else if (c === 49) style = { ...style, fond: null };
    }
  }
  if (i < ligne.length) sortie.push({ texte: ligne.slice(i), ...style });
  return sortie;
}
