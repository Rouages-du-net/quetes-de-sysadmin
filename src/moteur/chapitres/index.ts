// Les histoires de Quêtes de Sysadmin et leurs chapitres, dans l'ordre. Voir
// docs/SCENARIOS.md. Les histoires sont indépendantes ; dans une
// histoire, un chapitre s'ouvre quand le précédent est terminé.
import type { Chapitre, Histoire } from '../monde';
import { eveil } from './eveil';
import { bourg } from './bourg';
import { racine } from './racine';
import { datacenter } from './datacenter';
import { deuxiemeJour } from './deuxieme-jour';
import { paquet } from './paquet';
import { temps } from './temps';
import { archives } from './archives';

export const HISTOIRES: Histoire[] = [
  {
    id: 'effaceur',
    chapitres: [eveil, bourg, racine],
  },
  {
    id: 'datacenter',
    chapitres: [datacenter, deuxiemeJour],
  },
  {
    id: 'paquet',
    chapitres: [paquet],
  },
  {
    id: 'temps',
    chapitres: [temps],
  },
  {
    id: 'archives',
    chapitres: [archives],
  },
];

// Tous les chapitres, toutes histoires confondues (identifiants uniques).
export const CHAPITRES: Chapitre[] = HISTOIRES.flatMap((h) => h.chapitres);
