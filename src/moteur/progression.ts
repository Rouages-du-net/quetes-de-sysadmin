// Emporter sa progression d'une machine à l'autre (une salle de TP, puis
// une autre), sans compte et sans serveur :
//   - un code court, à recopier à la main (QDS-XXXX-XXXX) : les chapitres
//     terminés, rien d'autre, avec une somme de contrôle contre les fautes
//     de frappe ;
//   - un fichier, toute la sauvegarde du navigateur (carnet, clés créées…).
// Ni l'un ni l'autre n'est une preuve : ils se recopient et se modifient.

import { HISTOIRES } from './chapitres';
import { SUCCES } from './succes';

// L'ordre des chapitres dans le code court. On n'y fait qu'ajouter, à la
// fin : un code donné hier doit rester valable demain (tests/progression.test.ts).
export const ORDRE_DU_CODE = [
  'eveil', 'bourg', 'racine', 'sauvegarde',
  'premier-jour', 'deuxieme-jour', 'redemarrage', 'incendie', 'certificat',
  'paquet-perdu',
  'manuscrit',
  'archives', 'versions',
  'fermer-la-porte', 'pare-feu', 'sentinelle', 'colocation', 'chez-moi', 'concert', 'port', 'recidive',
  'mise-a-jour', 'composition', 'contournement', 'pleins-pouvoirs',
  'depot-nu', 'retour-arriere', 'bleu-vert', 'canari', 'migration',
  'rancon', 'instantanes', 'base',
  'disque-plein', 'memoire', 'inodes', 'horloge', 'sonde', 'post-mortem', 'goulot',
  'cles', 'rebond', 'tunnel', 'transferts', 'hebergeur',
  'depart', 'droits', 'secret', 'proxy', 'mises-a-jour', 'automatiques',
  'vlan', 'dhcp', 'zones', 'vpn', 'dmz', 'annexe', 'annuaire', 'wifi',
  'rapport', 'exposition', 'traces',
  'perimetre', 'contre-visite',
  'fatigue', 'disque-neuf',
];

// Base32 de Crockford : pas de I, L, O ni U, qu'on confondrait en recopiant.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const VERSION = 1;

// CRC-8 (polynôme 0x07) : une faute de frappe change la somme.
function crc8(octets: number[]): number {
  let crc = 0;
  for (const o of octets) {
    crc ^= o;
    for (let i = 0; i < 8; i++) crc = crc & 0x80 ? ((crc << 1) ^ 0x07) & 0xff : (crc << 1) & 0xff;
  }
  return crc;
}

function versBase32(octets: number[]): string {
  let bits = 0;
  let valeur = 0;
  let sortie = '';
  for (const o of octets) {
    valeur = (valeur << 8) | o;
    bits += 8;
    while (bits >= 5) {
      sortie += ALPHABET[(valeur >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) sortie += ALPHABET[(valeur << (5 - bits)) & 31];
  return sortie;
}

function depuisBase32(texte: string): number[] | null {
  let bits = 0;
  let valeur = 0;
  const octets: number[] = [];
  for (const c of texte) {
    const i = ALPHABET.indexOf(c);
    if (i < 0) return null;
    valeur = ((valeur << 5) | i) & 0xffff;
    bits += 5;
    if (bits >= 8) {
      octets.push((valeur >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return octets;
}

/** Le code court des chapitres terminés : QDS-XXXX-XXXX… */
export function codeDeProgression(termines: string[]): string {
  const cases: number[] = [];
  ORDRE_DU_CODE.forEach((id, i) => {
    if (termines.includes(id)) cases[i >> 3] = (cases[i >> 3] ?? 0) | (1 << (i & 7));
  });
  const octets = [VERSION, ...Array.from(cases, (o) => o ?? 0)];
  const groupes = versBase32([...octets, crc8(octets)]).match(/.{1,4}/g)!;
  return ['QDS', ...groupes].join('-');
}

export type ErreurDeCode = 'code-illisible' | 'code-faute' | 'code-trop-recent';

/** Les chapitres terminés d'un code, ou ce qui ne va pas. Tolère minuscules, espaces, O pour 0, I et L pour 1. */
export function lireCode(code: string): { termines: string[] } | { erreur: ErreurDeCode } {
  const net = code
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/^QDS/, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
  const octets = net.length >= 4 ? depuisBase32(net) : null;
  if (!octets || octets.length < 2) return { erreur: 'code-illisible' };
  // Les derniers bits de remplissage du base32 ne forment pas d'octet : la somme est le dernier octet entier.
  const somme = octets.at(-1)!;
  const donnees = octets.slice(0, -1);
  if (crc8(donnees) !== somme) return { erreur: 'code-faute' };
  if (donnees[0] !== VERSION) return { erreur: 'code-trop-recent' };
  const termines: string[] = [];
  donnees.slice(1).forEach((o, j) => {
    for (let b = 0; b < 8; b++)
      if (o & (1 << b)) {
        const id = ORDRE_DU_CODE[j * 8 + b];
        if (!id) return;
        termines.push(id);
      }
  });
  // Un chapitre au-delà de la liste : le code vient d'une version plus récente du jeu.
  const cases = donnees.slice(1).reduce((n, o) => n + o.toString(2).replace(/0/g, '').length, 0);
  if (cases !== termines.length) return { erreur: 'code-trop-recent' };
  return { termines };
}

// ——— Le fichier ———

export interface Sauvegarde {
  termines?: string[];
  histoire?: string | null;
  connus?: string;
  ssh?: { fichiers: Record<string, string>; phrases?: Record<string, string> };
  carnet?: Record<string, { ligne: string; chapitre: string }>;
  examen?: boolean;
  records?: Record<string, number>;
  // Le nom (facultatif) mis en tête du carnet : « Carnet de … ».
  nom?: string;
  // Les succès obtenus (voir succes.ts) : identifiant → date (ISO).
  succes?: Record<string, string>;
}

const FORMAT = 'quetes-de-sysadmin';

/** Le fichier de sauvegarde : la sauvegarde du navigateur, datée. */
export const fichierDeSauvegarde = (s: Sauvegarde, date: Date) =>
  JSON.stringify({ format: FORMAT, version: VERSION, date: date.toISOString(), sauvegarde: s }, null, 2);

const chaine = (x: unknown): x is string => typeof x === 'string';
const dictionnaire = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const deChaines = (x: unknown) => (dictionnaire(x) ? Object.fromEntries(Object.entries(x).filter(([, v]) => chaine(v))) as Record<string, string> : undefined);

export type ErreurDeFichier = 'fichier-illisible' | 'fichier-autre' | 'fichier-trop-recent';

/** La sauvegarde d'un fichier, nettoyée (on ne garde que ce que le jeu connaît), ou ce qui ne va pas. */
export function lireFichier(texte: string): { sauvegarde: Sauvegarde } | { erreur: ErreurDeFichier } {
  let brut: unknown;
  try {
    brut = JSON.parse(texte);
  } catch {
    return { erreur: 'fichier-illisible' };
  }
  if (!dictionnaire(brut) || brut.format !== FORMAT || !dictionnaire(brut.sauvegarde)) return { erreur: 'fichier-autre' };
  if (typeof brut.version !== 'number' || brut.version > VERSION) return { erreur: 'fichier-trop-recent' };
  const s = brut.sauvegarde;
  const chapitres = new Set(HISTOIRES.flatMap((h) => h.chapitres.map((c) => c.id)));
  const histoires = new Set(HISTOIRES.map((h) => h.id));
  const ssh = dictionnaire(s.ssh) ? { fichiers: deChaines(s.ssh.fichiers) ?? {}, phrases: deChaines(s.ssh.phrases) } : undefined;
  const carnet = dictionnaire(s.carnet)
    ? Object.fromEntries(
        Object.entries(s.carnet)
          .filter(([, e]) => dictionnaire(e) && chaine(e.ligne) && chaine(e.chapitre))
          .map(([n, e]) => [n, { ligne: (e as { ligne: string }).ligne, chapitre: (e as { chapitre: string }).chapitre }]),
      )
    : undefined;
  const records = dictionnaire(s.records)
    ? (Object.fromEntries(Object.entries(s.records).filter(([id, ms]) => chapitres.has(id) && typeof ms === 'number' && ms > 0)) as Record<string, number>)
    : undefined;
  return {
    sauvegarde: {
      termines: Array.isArray(s.termines) ? s.termines.filter((id): id is string => chaine(id) && chapitres.has(id)) : [],
      histoire: chaine(s.histoire) && histoires.has(s.histoire) ? s.histoire : null,
      ...(chaine(s.connus) ? { connus: s.connus } : {}),
      ...(ssh ? { ssh } : {}),
      ...(carnet ? { carnet } : {}),
      examen: s.examen === true,
      ...(records ? { records } : {}),
      ...(chaine(s.nom) && s.nom.trim() ? { nom: nettoyerNom(s.nom) } : {}),
      ...(dictionnaire(s.succes)
        ? { succes: Object.fromEntries(Object.entries(s.succes).filter(([id, date]) => SUCCES.some((x) => x.id === id) && chaine(date))) as Record<string, string> }
        : {}),
    },
  };
}

/** Un nom pour le carnet : une ligne, sans caractère de contrôle, 60 caractères au plus. */
export const nettoyerNom = (nom: string) =>
  nom
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
