// The English web app manifest (see src/pwa/manifest.ts).
import { manifestResponse } from '../../pwa/manifest';

export const GET = () =>
  manifestResponse({
    lang: 'en',
    name: 'Sysadmin Quests',
    shortName: 'Sysadmin',
    description: 'Learn system administration, on Linux and Windows, by playing with real commands. Works offline; your progress stays on this device.',
  });
