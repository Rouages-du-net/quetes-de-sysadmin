// nano : un éditeur de texte minimal, comme GNU nano (https://www.nano-editor.org/dist/latest/nano.html).
// La commande ouvre le fichier (jeu.edition) ; l'interface affiche l'éditeur
// et appelle enregistrerEdition() (^O) et quitterEdition() (^X).
// Les messages suivent la traduction française de nano.

import type { Command } from './index';
import { content } from '../tools';

export const EDITOR: Record<string, Command> = {
  nano: {
    launch: ({ args, game }) => {
      const target = args.find((a) => !a.startsWith('-'));
      if (!target) return game.error(game.t('nano-usage'));
      const path = game.resolve(target);
      const n = game.find(target);
      const reason = game.block(target);
      if (reason) return game.error(reason);
      if (n?.type === 'dossier') return game.error(game.t('nano-dossier', { chemin: path }));
      let text = '';
      let message: string;
      if (!n) message = game.t('nano-nouveau');
      else if (!game.traverses(target) || !game.can(n, 'r')) message = game.t('nano-erreur-lecture', { chemin: path });
      else if (n.archive) message = game.t('nano-binaire', { chemin: path });
      else {
        text = content(n, game);
        const lines = text === '' ? 0 : text.split('\n').length;
        message = game.can(n, 'w') ? game.t('nano-lignes-lues', { lignes: lines }) : game.t('nano-lecture-seule', { chemin: path });
      }
      game.edition = { path, text: text && !text.endsWith('\n') ? text + '\n' : text, root: game.who === 'root', message };
      return '';
    },
  },
};
