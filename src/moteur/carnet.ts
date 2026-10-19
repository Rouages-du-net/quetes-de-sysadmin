// Le carnet du sysadmin : chaque commande du jeu, la première fois qu'on la
// lance, s'ajoute à un aide-mémoire personnel (sa ligne du manuel, la
// première ligne tapée, le chapitre). Gardé dans le navigateur avec la
// progression, exportable en Markdown.

import type { Shell } from './shell';
import type { Traduire } from '../textes';
import { COMMANDES } from './commandes';
import { page, resume } from './commandes/manuel';

export interface EntreeCarnet {
  // La première ligne où la commande a servi, et le chapitre (identifiant ; vide sur le poste).
  ligne: string;
  chapitre: string;
}

export type Carnet = Record<string, EntreeCarnet>;

// Les commandes du manuel lui-même, que le shell traite à part.
const MANUEL = ['man', 'apropos', 'whatis'];

/** Après une ligne tapée dans ce shell : les commandes lancées pour la première fois rejoignent le carnet. Renvoie les nouvelles. */
export function noter(carnet: Carnet, sh: Shell): string[] {
  const nouvelles: string[] = [];
  const { ligne, commandes } = sh.derniere;
  for (const args of commandes) {
    const nom = (args[0] ?? '').split('/').at(-1)!;
    const connue = MANUEL.includes(nom) || (sh.connues().includes(nom) && !!COMMANDES[nom] && COMMANDES[nom].section !== 5);
    if (!nom || !connue || carnet[nom]) continue;
    carnet[nom] = { ligne: ligne.trim(), chapitre: sh.chapitre.id === 'poste' ? '' : sh.chapitre.id };
    nouvelles.push(nom);
  }
  return nouvelles;
}

/** La ligne du carnet : ce que fait la commande, en une phrase (comme whatis). */
export const description = (nom: string, t: Traduire) => resume(t(page(nom)));

/** Le carnet en Markdown, trié par nom. */
export function enMarkdown(carnet: Carnet, t: Traduire): string {
  const noms = Object.keys(carnet).sort((a, b) => a.localeCompare(b));
  return [
    `# ${t('carnet-titre')}`,
    '',
    t('carnet-markdown-intro', { nombre: noms.length }),
    '',
    ...noms.flatMap((nom) => {
      const e = carnet[nom];
      return [
        `## ${nom}`,
        '',
        `${description(nom, t)}.`,
        '',
        '```',
        e.ligne,
        '```',
        '',
        ...(e.chapitre ? [t('carnet-decouverte', { chapitre: t(`chapitre-${e.chapitre}`) }), ''] : []),
        t('carnet-manuel', { commande: `man ${nom}` }),
        '',
      ];
    }),
  ].join('\n');
}
