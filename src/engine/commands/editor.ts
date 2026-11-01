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
      if (n?.type === 'directory') return game.error(game.t('nano-directory', { path: path }));
      let text = '';
      let message: string;
      if (!n) message = game.t('nano-new');
      else if (!game.traverses(target) || !game.can(n, 'r')) message = game.t('nano-error-read', { path: path });
      else if (n.archive) message = game.t('nano-binary', { path: path });
      else {
        text = content(n, game);
        const lines = text === '' ? 0 : text.split('\n').length;
        message = game.can(n, 'w') ? game.t('nano-lines-read', { lines: lines }) : game.t('nano-read-only', { path: path });
      }
      game.edition = { path, text: text && !text.endsWith('\n') ? text + '\n' : text, root: game.who === 'root', message };
      return '';
    },
  },
};
