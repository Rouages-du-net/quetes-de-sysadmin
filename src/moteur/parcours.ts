// Les parcours thématiques : des chapitres de plusieurs histoires, rangés
// autour d'un thème (sécuriser un serveur, le web, le réseau…). Un parcours
// ne change pas les règles : dans une histoire, un chapitre s'ouvre quand le
// précédent est fini, et une histoire sans sa clé reste fermée. Le parcours
// dit seulement par où passer, et montre ce qui reste à faire.
// Textes : parcours-<id> et son attribut .description (interface.ftl).

import { HISTOIRES } from './chapitres';

export interface Parcours {
  id: string;
  chapitres: string[];
}

export const PARCOURS: Parcours[] = [
  { id: 'debuter', chapitres: ['eveil', 'bourg', 'racine', 'sauvegarde', 'paquet-perdu', 'manuscrit', 'archives'] },
  {
    id: 'securite',
    chapitres: [
      'fermer-la-porte', 'pare-feu', 'sentinelle', 'port', 'recidive', 'cles', 'depart', 'droits', 'secret', 'mises-a-jour', 'automatiques',
      'perimetre', 'rapport', 'exposition', 'traces', 'contre-visite',
      'bulletin', 'priorite', 'correctif', 'preuve', 'routine',
    ],
  },
  {
    id: 'web',
    chapitres: ['premier-jour', 'redemarrage', 'incendie', 'certificat', 'colocation', 'concert', 'proxy'],
  },
  { id: 'reseau', chapitres: ['paquet-perdu', 'chez-moi', 'rebond', 'tunnel', 'vlan', 'dhcp', 'zones', 'vpn', 'dmz', 'annexe'] },
  { id: 'sauvegardes', chapitres: ['sauvegarde', 'archives', 'versions', 'rancon', 'instantanes', 'base', 'transferts', 'hebergeur'] },
  {
    id: 'deploiement',
    chapitres: ['manuscrit', 'mise-a-jour', 'composition', 'contournement', 'pleins-pouvoirs', 'depot-nu', 'retour-arriere', 'bleu-vert', 'canari', 'migration'],
  },
  { id: 'production', chapitres: ['redemarrage', 'disque-plein', 'memoire', 'inodes', 'horloge', 'sonde', 'post-mortem', 'goulot', 'fatigue', 'disque-neuf', 'agrandir', 'secours'] },
  { id: 'identites', chapitres: ['deuxieme-jour', 'depart', 'droits', 'cles', 'annuaire', 'wifi'] },
];

export type EtatEtape = 'fait' | 'ouvert' | 'verrouille' | 'sans-cle';

export interface EtapeParcours {
  chapitre: string;
  histoire: string;
  // Indices dans HISTOIRES et dans les chapitres de l'histoire (pour l'ouvrir).
  h: number;
  c: number;
  etat: EtatEtape;
  // Pour un chapitre verrouillé : le chapitre à finir d'abord dans son histoire.
  avant: string | null;
}

/** Où en est-on dans ce parcours : chaque chapitre, son état, et le prochain à faire. */
export function etapesParcours(p: Parcours, termines: string[], ouverte: (histoire: string) => boolean): { etapes: EtapeParcours[]; prochain: number } {
  const etapes = p.chapitres.map((id) => {
    const h = HISTOIRES.findIndex((x) => x.chapitres.some((c) => c.id === id));
    const histoire = HISTOIRES[h];
    const c = histoire.chapitres.findIndex((x) => x.id === id);
    const manquant = histoire.chapitres.slice(0, c).find((x) => !termines.includes(x.id));
    const etat: EtatEtape = termines.includes(id) ? 'fait' : !ouverte(histoire.id) ? 'sans-cle' : manquant ? 'verrouille' : 'ouvert';
    return { chapitre: id, histoire: histoire.id, h, c, etat, avant: etat === 'verrouille' ? manquant!.id : null };
  });
  return { etapes, prochain: etapes.findIndex((e) => e.etat !== 'fait') };
}
