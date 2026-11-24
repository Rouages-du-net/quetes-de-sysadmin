// The Spanish Atom feed of new stories (see src/feeds.ts).
import { feedResponse } from '../../feeds';

export const GET = () =>
  feedResponse({
    lang: 'es',
    title: 'Misiones de Sysadmin: historias nuevas',
    subtitle: 'Cada historia nueva del juego, una aventura de administración de sistemas con comandos reales, en cuanto sale.',
    author: 'Les rouages du net',
    rights: 'Textos bajo licencia CC BY-SA 4.0',
  });
