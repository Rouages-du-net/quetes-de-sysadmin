// The French Atom feed of new stories (see src/feeds.ts).
import { feedResponse } from '../../feeds';

export const GET = () =>
  feedResponse({
    lang: 'fr',
    title: 'Quêtes de Sysadmin : nouvelles histoires',
    subtitle: "Chaque nouvelle histoire du jeu, une aventure d'administration système avec de vraies commandes, dès sa sortie.",
    author: 'Les rouages du net',
    rights: 'Textes sous licence CC BY-SA 4.0',
  });
