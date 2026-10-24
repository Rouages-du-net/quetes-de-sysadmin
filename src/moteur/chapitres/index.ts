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
import { port } from './port';
import { recidive } from './recidive';
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
import { sonde } from './sonde';
import { postMortem } from './post-mortem';
import { goulot } from './goulot';
import { cles } from './cles';
import { rebond } from './rebond';
import { tunnel } from './tunnel';
import { transferts } from './transferts';
import { hebergeur } from './hebergeur';
import { depart } from './depart';
import { droits } from './droits';
import { secret } from './secret';
import { proxy } from './proxy';
import { misesAJour } from './mises-a-jour';
import { automatiques } from './automatiques';
import { vlan } from './vlan';
import { dhcp } from './dhcp';
import { zones } from './zones';
import { vpn } from './vpn';
import { dmz } from './dmz';
import { annexe } from './annexe';
import { annuaireChapitre } from './annuaire';
import { wifi } from './wifi';
import { rapport } from './rapport';
import { exposition } from './exposition';
import { traces } from './traces';
import { perimetre } from './perimetre';
import { contreVisite } from './contre-visite';

// Les histoires s'ouvrent peu à peu : chacune dit, dans `apres`, les chapitres
// à finir avant d'en recevoir la clé (voir deverrouillage.ts et docs/SCENARIOS.md).
export const HISTOIRES: Histoire[] = [
  {
    id: 'effaceur',
    chapitres: [eveil, bourg, racine, sauvegarde],
  },
  {
    id: 'datacenter',
    apres: ['racine'],
    chapitres: [datacenter, deuxiemeJour, redemarrage, incendie, certificat],
  },
  {
    id: 'paquet',
    apres: ['racine'],
    chapitres: [paquet],
  },
  {
    id: 'temps',
    apres: ['racine'],
    chapitres: [temps],
  },
  {
    id: 'archives',
    apres: ['racine'],
    chapitres: [archives, versions],
  },
  {
    id: 'lettres',
    apres: ['redemarrage', 'paquet-perdu'],
    chapitres: [porte, pareFeu, sentinelle, colocation, chezMoi, concert, port, recidive],
  },
  {
    id: 'fabrique',
    apres: ['redemarrage'],
    chapitres: [miseAJour, composition, contournement, pleinsPouvoirs],
  },
  {
    id: 'gazette',
    apres: ['manuscrit', 'redemarrage'],
    chapitres: [depotNu, retourArriere, bleuVert, canari, migration],
  },
  {
    id: 'ludotheque',
    apres: ['versions'],
    chapitres: [rancon, instantanesChapitre, base],
  },
  {
    id: 'astreinte',
    apres: ['redemarrage'],
    chapitres: [disquePlein, memoireChapitre, inodes, horloge, sonde, postMortem, goulot],
  },
  {
    id: 'maison',
    apres: ['fermer-la-porte'],
    chapitres: [cles, rebond, tunnel, transferts, hebergeur],
  },
  {
    id: 'cooperative',
    apres: ['colocation', 'deuxieme-jour'],
    chapitres: [depart, droits, secret, proxy, misesAJour, automatiques],
  },
  {
    id: 'ruche',
    apres: ['pare-feu', 'rebond'],
    chapitres: [vlan, dhcp, zones, vpn, dmz, annexe, annuaireChapitre, wifi],
  },
  {
    id: 'audit',
    apres: ['sentinelle', 'droits'],
    chapitres: [perimetre, rapport, exposition, traces, contreVisite],
  },
];

// Tous les chapitres, toutes histoires confondues (identifiants uniques).
export const CHAPITRES: Chapitre[] = HISTOIRES.flatMap((h) => h.chapitres);
