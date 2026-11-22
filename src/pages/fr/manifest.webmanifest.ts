// The French web app manifest (see src/pwa/manifest.ts).
import { manifestResponse } from '../../pwa/manifest';

export const GET = () =>
  manifestResponse({
    lang: 'fr',
    name: 'Quêtes de Sysadmin',
    shortName: 'Sysadmin',
    description: "Apprendre l'administration système, sous Linux et sous Windows, en jouant avec de vraies commandes. Fonctionne hors ligne ; ta progression reste sur cet appareil.",
  });
