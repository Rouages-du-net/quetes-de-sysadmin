// Les histoires de Quêtes de Sysadmin et leurs chapitres, dans l'ordre. Voir
// docs/SCENARIOS.md. Les histoires sont indépendantes ; dans une
// histoire, un chapitre s'ouvre quand le précédent est terminé.
import type { Chapitre, Histoire } from '../world';
import { eveil } from './lighthouse';
import { bourg } from './village';
import { racine } from './root';
import { sauvegarde } from './backup';
import { datacenter } from './first-day';
import { deuxiemeJour } from './second-day';
import { redemarrage } from './reboot-night';
import { incendie } from './fire';
import { certificat } from './certificate';
import { paquet } from './lost-packet';
import { temps } from './manuscript';
import { archives } from './archives';
import { versions } from './versions';
import { porte } from './shut-the-door';
import { pareFeu } from './firewall';
import { sentinelle } from './sentinel';
import { colocation } from './sharing';
import { chezMoi } from './works-for-me';
import { concert } from './concert';
import { port } from './port';
import { recidive } from './repeat-offenders';
import { miseAJour } from './update';
import { composition } from './compose';
import { contournement } from './firewall-hole';
import { pleinsPouvoirs } from './full-powers';
import { depotNu } from './bare-repo';
import { retourArriere } from './rollback';
import { bleuVert } from './blue-green';
import { canari } from './canary';
import { migration } from './migration';
import { rancon } from './ransom';
import { instantanesChapitre } from './snapshots';
import { base } from './database';
import { disquePlein } from './full-disk';
import { memoireChapitre } from './memory';
import { inodes } from './inodes';
import { horloge } from './clock';
import { sonde } from './probe';
import { postMortem } from './post-mortem';
import { goulot } from './bottleneck';
import { cles } from './keys';
import { rebond } from './jump';
import { tunnel } from './tunnel';
import { transferts } from './transfers';
import { hebergeur } from './web-host';
import { depart } from './departure';
import { droits } from './shared-rights';
import { secret } from './secret';
import { proxy } from './proxy';
import { misesAJour } from './updates';
import { automatiques } from './auto-updates';
import { vlan } from './vlan';
import { dhcp } from './dhcp';
import { zones } from './zones';
import { vpn } from './remote-work';
import { dmz } from './dmz';
import { annexe } from './annex';
import { annuaireChapitre } from './directory';
import { wifi } from './wifi';
import { rapport } from './report';
import { exposition } from './exposure';
import { traces } from './traces';
import { perimetre } from './scope';
import { contreVisite } from './follow-up';
import { fatigue } from './tired-disk';
import { disqueNeuf } from './new-disk';
import { agrandir } from './more-room';
import { secours } from './stuck-boot';
import { bulletin } from './bulletin';
import { priorite } from './priority';
import { correctif } from './fix';
import { preuve } from './proof';
import { routine } from './routine';
import { atelier } from './repair-cafe';
import { facteur } from './postman';
import { signature } from './signature';
import { politiqueChapitre } from './policy';
import { inventaire } from './inventory';
import { playbook } from './playbook';
import { repetition } from './rehearsal';
import { cadenas } from './padlock';

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
    chapitres: [porte, pareFeu, sentinelle, colocation, chezMoi, concert, port, recidive, atelier],
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
  {
    id: 'labo',
    apres: ['disque-plein'],
    chapitres: [fatigue, disqueNeuf, agrandir, secours],
  },
  {
    id: 'veille',
    apres: ['contre-visite'],
    chapitres: [bulletin, priorite, correctif, preuve, routine],
  },
  {
    id: 'courrier',
    apres: ['chez-moi'],
    chapitres: [facteur, signature, politiqueChapitre],
  },
  {
    id: 'flotte',
    apres: ['cles'],
    chapitres: [inventaire, playbook, repetition],
  },
  {
    id: 'rustine',
    apres: ['certificat', 'colocation'],
    chapitres: [cadenas],
  },
];

// Tous les chapitres, toutes histoires confondues (identifiants uniques).
export const CHAPITRES: Chapitre[] = HISTOIRES.flatMap((h) => h.chapitres);
