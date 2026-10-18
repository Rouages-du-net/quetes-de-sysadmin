// Les histoires de Quêtes de Sysadmin et leurs chapitres, dans l'ordre. Voir
// docs/SCENARIOS.md. Les histoires sont indépendantes ; dans une
// histoire, un chapitre s'ouvre quand le précédent est terminé.
import type { Chapitre, Histoire } from '../monde';
import { eveil } from './eveil';
import { bourg } from './bourg';
import { racine } from './racine';
import { datacenter } from './datacenter';
import { paquet } from './paquet';
import { temps } from './temps';
import { archives } from './archives';

export const HISTOIRES: Histoire[] = [
  {
    id: 'effaceur',
    titre: 'L’Effaceur',
    resume: 'Une créature efface tout dans le royaume. Se déplacer, créer, chercher, puis les permissions et sudo.',
    chapitres: [eveil, bourg, racine],
  },
  {
    id: 'datacenter',
    titre: 'Le Datacenter',
    resume: 'Premier jour de stage, un site en panne : les journaux, les tubes |, les processus.',
    chapitres: [datacenter],
  },
  {
    id: 'paquet',
    titre: 'Le Paquet perdu',
    resume: '« Internet ne marche plus » : enquête de proche en proche avec ping, dig, traceroute et curl.',
    chapitres: [paquet],
  },
  {
    id: 'temps',
    titre: 'La Machine à remonter le temps',
    resume: 'Le manuscrit d’Inès est abîmé : voyager dans ses versions avec git.',
    chapitres: [temps],
  },
  {
    id: 'archives',
    titre: 'Les Archives',
    resume: 'Sauver le fonds d’une bibliothèque sur une petite clé : du, df, find, tar.',
    chapitres: [archives],
  },
];

// Tous les chapitres, toutes histoires confondues (identifiants uniques).
export const CHAPITRES: Chapitre[] = HISTOIRES.flatMap((h) => h.chapitres);
