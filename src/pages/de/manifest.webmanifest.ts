// The German web app manifest (see src/pwa/manifest.ts).
import { manifestResponse } from '../../pwa/manifest';

export const GET = () =>
  manifestResponse({
    lang: 'de',
    name: 'Sysadmin-Quests',
    shortName: 'Sysadmin',
    description: 'Lerne Systemadministration unter Linux und Windows, indem du mit echten Befehlen spielst. Funktioniert offline; dein Fortschritt bleibt auf diesem Gerät.',
  });
