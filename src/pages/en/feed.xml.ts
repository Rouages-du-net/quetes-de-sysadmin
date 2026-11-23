// The English Atom feed of new stories (see src/feeds.ts).
import { feedResponse } from '../../feeds';

export const GET = () =>
  feedResponse({
    lang: 'en',
    title: 'Sysadmin Quests: new stories',
    subtitle: 'Each new story of the game, a system administration adventure with real commands, as it comes out.',
    author: 'Les rouages du net',
    rights: 'Texts under CC BY-SA 4.0',
  });
