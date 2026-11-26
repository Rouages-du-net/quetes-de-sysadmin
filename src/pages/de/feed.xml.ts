// The German Atom feed of new stories (see src/feeds.ts).
import { feedResponse } from '../../feeds';

export const GET = () =>
  feedResponse({
    lang: 'de',
    title: 'Sysadmin-Quests: neue Geschichten',
    subtitle: 'Jede neue Geschichte des Spiels, ein Abenteuer der Systemadministration mit echten Befehlen, sobald sie erscheint.',
    author: 'Les rouages du net',
    rights: 'Texte unter der Lizenz CC BY-SA 4.0',
  });
