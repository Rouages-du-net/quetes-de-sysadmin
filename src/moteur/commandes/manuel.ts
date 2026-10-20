// Le manuel : pages « man » au format habituel (NOM, SYNOPSIS, DESCRIPTION,
// OPTIONS, EXEMPLES, VOIR AUSSI), « commande --help », « man -k » (apropos)
// et « whatis ». Les pages sont fabriquées à partir du texte de chaque
// commande (man-<commande> dans manuel.ftl) et de sa partie technique
// (pages.ts), pour apprendre le bon réflexe : chercher dans le manuel avant
// de demander. Les messages reprennent ceux de man-db et des coreutils.

import type { Traduire } from '../../textes';
import { COMMANDES, type Commande } from './index';

// Identifiant Fluent de la page : le point est réservé aux attributs
// (« jail.conf » → man-jail_conf).
export const page = (nom: string) => `man-${nom.replace(/\./g, '_')}`;

const section = (nom: string) => COMMANDES[nom]?.section ?? 1;

function textes(nom: string, t: Traduire) {
  const synopsis = t.existe(`${page(nom)}.synopsis`) ? t(`${page(nom)}.synopsis`) : '';
  const options = (nom: string, c: Commande): [string, string][] => (c.options ?? []).map((o) => [o, t(`${page(nom)}.option-${o}`)]);
  // Une langue peut adapter la commande d'un exemple qui contient des mots (.commande-N) : grep "my password".
  const exemples = (nom: string, c: Commande): [string, string][] =>
    (c.exemples ?? []).map((e, i) => {
      const propre = `${page(nom)}.commande-${i + 1}`;
      return [t.existe(propre) ? t(propre) : e, t(`${page(nom)}.exemple-${i + 1}`)];
    });
  return { synopsis, description: t(page(nom)), options, exemples };
}

// La première phrase, sans point final, pour la ligne NOM et whatis.
export const resume = (texte: string) => texte.split(/(?<=\.)\s|(?<=。)|\n/)[0].replace(/[.。]$/, '');

const retrait = (texte: string, n = 7) =>
  texte
    .split('\n')
    .map((l) => (l ? ' '.repeat(n) + l : l))
    .join('\n');

export function ligneWhatis(nom: string, t: Traduire): string {
  return `${`${nom} (${section(nom)})`.padEnd(21)}- ${resume(t(page(nom)))}`;
}

const majuscule = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

export function pageMan(nom: string, c: Commande, t: Traduire): string {
  const { synopsis, description, options, exemples } = textes(nom, t);
  const titre = `${nom.toUpperCase()}(${section(nom)})`;
  const milieu = t('manuel-entete');
  const blanc = Math.max(2, Math.floor((60 - titre.length * 2 - milieu.length) / 2));
  // Comme une vraie page : le titre de section, puis son texte en retrait.
  const sections: [string, string][] = [[t('manuel-section-nom'), retrait(`${nom} - ${resume(description)}`)]];
  if (synopsis) sections.push([t('manuel-section-synopsis'), retrait(synopsis)]);
  sections.push([t('manuel-section-description'), retrait(majuscule(description))]);
  const opts = options(nom, c);
  if (opts.length)
    sections.push([t('manuel-section-options'), opts.map(([o, d]) => retrait(`-${o}`) + '\n' + retrait(majuscule(d), 14)).join('\n\n')]);
  const ex = exemples(nom, c);
  if (ex.length) sections.push([t('manuel-section-exemples'), ex.map(([cmd, d]) => retrait(cmd) + '\n' + retrait(majuscule(d), 14)).join('\n\n')]);
  if (c.voir?.length) sections.push([t('manuel-section-voir-aussi'), retrait(c.voir.map((v) => `${v}(${section(v)})`).join(', '))]);
  return [`${titre}${' '.repeat(blanc)}${milieu}${' '.repeat(blanc)}${titre}`, ...sections.map(([s, x]) => `${s}\n${x}`)].join('\n\n');
}

export function aide(nom: string, c: Commande, t: Traduire): string {
  const { synopsis, description, options } = textes(nom, t);
  const lignes = [t('manuel-utilisation', { synopsis: synopsis || nom }), majuscule(resume(description)) + '.'];
  const opts = options(nom, c);
  if (opts.length) {
    lignes.push('');
    for (const [o, d] of opts) lignes.push(`  -${o.padEnd(5)} ${d}`);
  }
  lignes.push('', t('manuel-complet', { commande: nom }));
  return lignes.join('\n');
}

/** man -k / apropos : les commandes dont le nom, le synopsis ou la description contient le mot. */
export function apropos(mot: string, noms: string[], t: Traduire): string[] {
  const m = mot.toLowerCase();
  return noms
    .filter((nom) => {
      const { synopsis, description } = textes(nom, t);
      return nom.includes(m) || `${synopsis} — ${description}`.toLowerCase().includes(m);
    })
    .map((nom) => ligneWhatis(nom, t));
}

/**
 * Vérifie les options courtes (-a, -la…) d'une commande qui déclare les
 * siennes. Renvoie le message d'erreur des coreutils, ou null.
 */
/** Les options longues connues, réécrites en options courtes (--all → -a), comme les lit la commande. */
export const raccourcir = (c: Commande, args: string[]): string[] => {
  const fin = args.indexOf('--');
  return args.map((a, i) => (c.longues && a.startsWith('--') && !a.includes('=') && (fin < 0 || i < fin) && c.longues[a.slice(2)] ? `-${c.longues[a.slice(2)]}` : a));
};

export function optionInvalide(nom: string, c: Commande, args: string[], t: Traduire): string | null {
  if (!c.options || c.propresOptions) return null;
  for (const a of args) {
    // Après « -- », plus aucune option.
    if (a === '--') break;
    if (a.startsWith('--')) {
      const longue = a.slice(2).split('=')[0];
      if (c.longues && longue in c.longues) continue;
      return t('manuel-option-longue-inconnue', { commande: nom, option: a.split('=')[0] });
    }
    if (!a.startsWith('-') || a === '-' || /^-\d+$/.test(a)) continue;
    for (const lettre of a.slice(1)) if (!c.options.includes(lettre)) return t('manuel-option-invalide', { commande: nom, lettre });
  }
  return null;
}
