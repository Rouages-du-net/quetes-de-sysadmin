// The game's texts, in Fluent format (https://projectfluent.org): one
// directory per language (src/texts/en/, src/texts/fr/…), several .ftl
// files per directory (interface, manual, commands, one story per file).
// English is the reference language (texts are written in English first,
// every key exists in English) and the default and fallback language:
// without a requested language, or in a language the game doesn't know, the
// game speaks English, and a text missing from a translation shows in
// English. The code only uses identifiers:
//
//   t('eveil-message')                       a message
//   t('histoire-effaceur.resume')            an attribute
//   t('ls-acces-impossible', { cible })      with named variables
//
// Plurals, numbers and dates go through Fluent, which relies on Intl. A
// number passed as a variable is formatted for the language ("1,234"):
// pass as text (String(pid)) what must stay as is.

import { FluentBundle, FluentResource, type FluentVariable } from '@fluent/bundle';

const SOURCES = import.meta.glob('./*/*.ftl', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

export const LANGUE_DE_REFERENCE = 'en';
export const LANGUE_PAR_DEFAUT = 'en';
export const LANGUES = [...new Set(Object.keys(SOURCES).map((f) => f.split('/')[1]))].sort();
export type Langue = string;
export type Variables = Record<string, FluentVariable>;
export type Traduire = ((id: string, variables?: Variables) => string) & {
  langue: Langue;
  /** Vrai si le texte existe (dans la langue ou dans une langue de repli). */
  existe: (id: string) => boolean;
};

const paquets = new Map<Langue, FluentBundle>();

function paquet(langue: Langue): FluentBundle {
  let b = paquets.get(langue);
  if (!b) {
    // useIsolating : pas de caractères d'isolement Unicode autour des
    // variables (ils s'afficheraient dans le terminal).
    b = new FluentBundle(langue, { useIsolating: false });
    for (const [fichier, source] of Object.entries(SOURCES).sort())
      if (fichier.startsWith(`./${langue}/`)) {
        const erreurs = b.addResource(new FluentResource(source));
        if (erreurs.length) throw new Error(`${fichier} : ${erreurs.join(' ; ')}`);
      }
    paquets.set(langue, b);
  }
  return b;
}

// Typographie propre à chaque langue, appliquée aux textes du jeu au moment
// de l'affichage. En français : espaces insécables avant : ; ! ? » et après «,
// pour qu'un signe ne se retrouve jamais seul en début de ligne.
const TYPOGRAPHIE: Record<Langue, (texte: string) => string> = {
  fr: (texte) => texte.replace(/« /g, '«\u00a0').replace(/ ([:;!?»])/g, '\u00a0$1'),
};
export const typographie = (texte: string, langue: Langue) => TYPOGRAPHIE[langue]?.(texte) ?? texte;

// La langue demandée (« fr », « en-GB »…) si le jeu la connaît, sinon l'anglais.
// Les codes BCP 47 ne tiennent pas compte de la casse (zh-hans = zh-Hans).
export function langueDuJeu(langue?: string | null): Langue {
  const connue = (l: string) => LANGUES.find((x) => x.toLowerCase() === l.toLowerCase());
  const l = langue?.trim() ?? '';
  return (l && (connue(l) ?? connue(l.split('-')[0]))) || LANGUE_PAR_DEFAUT;
}

export function traducteur(langue?: Langue): Traduire {
  const choisie = langueDuJeu(langue);
  const ordre = [...new Set([choisie, LANGUE_PAR_DEFAUT, LANGUE_DE_REFERENCE])].map(paquet);
  const trouver = (id: string) => {
    const [nom, attribut] = id.split('.');
    for (const b of ordre) {
      const m = b.getMessage(nom);
      const motif = attribut ? m?.attributes[attribut] : m?.value;
      if (motif) return { b, motif };
    }
    return null;
  };
  const t = (id: string, variables?: Variables) => {
    const trouve = trouver(id);
    if (!trouve) throw new Error(`Texte manquant : « ${id} »`);
    const erreurs: Error[] = [];
    const texte = trouve.b.formatPattern(trouve.motif, variables, erreurs);
    if (erreurs.length) throw new Error(`Texte « ${id} » : ${erreurs.join(' ; ')}`);
    return texte;
  };
  return Object.assign(t, { langue: choisie, existe: (id: string) => trouver(id) !== null });
}
