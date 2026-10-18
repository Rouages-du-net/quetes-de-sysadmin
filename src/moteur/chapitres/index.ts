// Les histoires de Quêtes de Sysadmin et leurs chapitres, dans l'ordre. Voir
// docs/SCENARIOS.md. Les histoires sont indépendantes ; dans une
// histoire, un chapitre s'ouvre quand le précédent est terminé.
import type { Chapitre, Histoire } from '../monde';
import { eveil } from './eveil';
import { bourg } from './bourg';
import { racine } from './racine';
import { sauvegarde } from './sauvegarde';
import { datacenter } from './datacenter';
import { deuxiemeJour } from './deuxieme-jour';
import { redemarrage } from './redemarrage';
import { incendie } from './incendie';
import { certificat } from './certificat';
import { paquet } from './paquet';
import { temps } from './temps';
import { archives } from './archives';
import { versions } from './versions';
import { porte } from './porte';
import { pareFeu } from './pare-feu';
import { sentinelle } from './sentinelle';
import { colocation } from './colocation';
import { chezMoi } from './chez-moi';
import { concert } from './concert';
import { miseAJour } from './mise-a-jour';
import { composition } from './composition';
import { contournement } from './contournement';
import { pleinsPouvoirs } from './pleins-pouvoirs';
import { depotNu } from './depot-nu';
import { retourArriere } from './retour-arriere';
import { bleuVert } from './bleu-vert';
import { canari } from './canari';
import { migration } from './migration';
import { rancon } from './rancon';
import { instantanesChapitre } from './instantanes';
import { base } from './base';
import { disquePlein } from './disque-plein';
import { memoireChapitre } from './memoire';
import { inodes } from './inodes';
import { horloge } from './horloge';

export const HISTOIRES: Histoire[] = [
  {
    id: 'effaceur',
    chapitres: [eveil, bourg, racine, sauvegarde],
  },
  {
    id: 'datacenter',
    chapitres: [datacenter, deuxiemeJour, redemarrage, incendie, certificat],
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
    chapitres: [archives, versions],
  },
  {
    id: 'lettres',
    chapitres: [porte, pareFeu, sentinelle, colocation, chezMoi, concert],
  },
  {
    id: 'fabrique',
    chapitres: [miseAJour, composition, contournement, pleinsPouvoirs],
  },
  {
    id: 'gazette',
    chapitres: [depotNu, retourArriere, bleuVert, canari, migration],
  },
  {
    id: 'ludotheque',
    chapitres: [rancon, instantanesChapitre, base],
  },
  {
    id: 'astreinte',
    chapitres: [disquePlein, memoireChapitre, inodes, horloge],
  },
];

// Tous les chapitres, toutes histoires confondues (identifiants uniques).
export const CHAPITRES: Chapitre[] = HISTOIRES.flatMap((h) => h.chapitres);
