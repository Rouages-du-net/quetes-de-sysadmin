// Les textes du jeu, au format Fluent (https://projectfluent.org) : un
// dossier par langue (src/textes/fr/, src/textes/en/…), plusieurs fichiers
// .ftl par dossier (interface, manuel, commandes, une histoire par fichier).
// Le français est la langue de référence : un texte absent d'une traduction
// s'affiche en français. Le code n'utilise que des identifiants :
//
//   t('eveil-message')                       un message
//   t('histoire-effaceur.resume')            un attribut
//   t('ls-acces-impossible', { cible })      avec des variables nommées
//
// Les pluriels, les nombres et les dates passent par Fluent, qui s'appuie sur
// Intl. Un nombre passé en variable est mis en forme selon la langue
// (« 1 234 ») : passer en texte (String(pid)) ce qui doit rester tel quel.

import { FluentBundle, FluentResource, type FluentVariable } from '@fluent/bundle';

const SOURCES = import.meta.glob('./*/*.ftl', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

export const LANGUE_DE_REFERENCE = 'fr';
export const LANGUES = [...new Set(Object.keys(SOURCES).map((f) => f.split('/')[1]))].sort();
export type Langue = string;
export type Variables = Record<string, FluentVariable>;
export type Traduire = ((id: string, variables?: Variables) => string) & {
  langue: Langue;
  /** Vrai si le texte existe (dans la langue ou en français). */
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

export function traducteur(langue: Langue = LANGUE_DE_REFERENCE): Traduire {
  const choisie = LANGUES.includes(langue) ? langue : LANGUE_DE_REFERENCE;
  const ordre = [...new Set([choisie, LANGUE_DE_REFERENCE])].map(paquet);
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
