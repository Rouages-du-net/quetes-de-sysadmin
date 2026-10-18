// nano : un éditeur de texte minimal, comme GNU nano (https://www.nano-editor.org/dist/latest/nano.html).
// La commande ouvre le fichier (jeu.edition) ; l'interface affiche l'éditeur
// et appelle enregistrerEdition() (^O) et quitterEdition() (^X).
// Les messages suivent la traduction française de nano.

import type { Commande } from './index';
import { contenu } from '../outils';

export const EDITEUR: Record<string, Commande> = {
  nano: {
    lancer: ({ args, jeu }) => {
      const cible = args.find((a) => !a.startsWith('-'));
      if (!cible) return jeu.erreur(jeu.t('nano-usage'));
      const chemin = jeu.resoudre(cible);
      const n = jeu.trouver(cible);
      const raison = jeu.blocage(cible);
      if (raison) return jeu.erreur(raison);
      if (n?.type === 'dossier') return jeu.erreur(jeu.t('nano-dossier', { chemin }));
      let texte = '';
      let message: string;
      if (!n) message = jeu.t('nano-nouveau');
      else if (!jeu.traverse(cible) || !jeu.peut(n, 'r')) message = jeu.t('nano-erreur-lecture', { chemin });
      else if (n.archive) message = jeu.t('nano-binaire', { chemin });
      else {
        texte = contenu(n, jeu);
        const lignes = texte === '' ? 0 : texte.split('\n').length;
        message = jeu.peut(n, 'w') ? jeu.t('nano-lignes-lues', { lignes }) : jeu.t('nano-lecture-seule', { chemin });
      }
      jeu.edition = { chemin, texte: texte && !texte.endsWith('\n') ? texte + '\n' : texte, root: jeu.qui === 'root', message };
      return '';
    },
  },
};
