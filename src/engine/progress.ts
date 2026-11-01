// Emporter sa progression d'une machine à l'autre (une salle de TP, puis
// une autre), sans compte et sans serveur :
//   - un code court, à recopier à la main (QDS-XXXX-XXXX) : les chapitres
//     terminés, rien d'autre, avec une somme de contrôle contre les fautes
//     de frappe ;
//   - un fichier, toute la sauvegarde du navigateur (carnet, clés créées…).
// Ni l'un ni l'autre n'est une preuve : ils se recopient et se modifient.

import { STORIES } from './chapters';
import { ACHIEVEMENTS } from './achievements';

// L'ordre des chapitres dans le code court. On n'y fait qu'ajouter, à la
// fin : un code donné hier doit rester valable demain (tests/progress.test.ts).
export const CODE_ORDER = [
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
  'fatigue', 'disque-neuf', 'agrandir', 'secours',
  'bulletin', 'priorite', 'correctif', 'preuve', 'routine',
  'atelier',
  'facteur', 'signature', 'politique',
  'inventaire', 'playbook', 'repetition',
  'cadenas',
];

// Base32 de Crockford : pas de I, L, O ni U, qu'on confondrait en recopiant.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const VERSION = 1;

// CRC-8 (polynôme 0x07) : une faute de frappe change la somme.
function crc8(bytes: number[]): number {
  let crc = 0;
  for (const o of bytes) {
    crc ^= o;
    for (let i = 0; i < 8; i++) crc = crc & 0x80 ? ((crc << 1) ^ 0x07) & 0xff : (crc << 1) & 0xff;
  }
  return crc;
}

function toBase32(bytes: number[]): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const o of bytes) {
    value = (value << 8) | o;
    bits += 8;
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

function sinceBase32(text: string): number[] | null {
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const c of text) {
    const i = ALPHABET.indexOf(c);
    if (i < 0) return null;
    value = ((value << 5) | i) & 0xffff;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return bytes;
}

/** Le code court des chapitres terminés : QDS-XXXX-XXXX… */
export function progressCode(finished: string[]): string {
  const cases: number[] = [];
  CODE_ORDER.forEach((id, i) => {
    if (finished.includes(id)) cases[i >> 3] = (cases[i >> 3] ?? 0) | (1 << (i & 7));
  });
  const bytes = [VERSION, ...Array.from(cases, (o) => o ?? 0)];
  const groups = toBase32([...bytes, crc8(bytes)]).match(/.{1,4}/g)!;
  return ['QDS', ...groups].join('-');
}

export type CodeError = 'code-illisible' | 'code-faute' | 'code-trop-recent';

/** Les chapitres terminés d'un code, ou ce qui ne va pas. Tolère minuscules, espaces, O pour 0, I et L pour 1. */
export function readCode(code: string): { finished: string[] } | { error: CodeError } {
  const net = code
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/^QDS/, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
  const bytes = net.length >= 4 ? sinceBase32(net) : null;
  if (!bytes || bytes.length < 2) return { error: 'code-illisible' };
  // Les derniers bits de remplissage du base32 ne forment pas d'octet : la somme est le dernier octet entier.
  const sum = bytes.at(-1)!;
  const data = bytes.slice(0, -1);
  if (crc8(data) !== sum) return { error: 'code-faute' };
  if (data[0] !== VERSION) return { error: 'code-trop-recent' };
  const finished: string[] = [];
  data.slice(1).forEach((o, j) => {
    for (let b = 0; b < 8; b++)
      if (o & (1 << b)) {
        const id = CODE_ORDER[j * 8 + b];
        if (!id) return;
        finished.push(id);
      }
  });
  // Un chapitre au-delà de la liste : le code vient d'une version plus récente du jeu.
  const cases = data.slice(1).reduce((n, o) => n + o.toString(2).replace(/0/g, '').length, 0);
  if (cases !== finished.length) return { error: 'code-trop-recent' };
  return { finished };
}

// ——— Le fichier ———

export interface Backup {
  finished?: string[];
  story?: string | null;
  known?: string;
  ssh?: { files: Record<string, string>; phrases?: Record<string, string> };
  notebook?: Record<string, { line: string; chapter: string }>;
  exam?: boolean;
  records?: Record<string, number>;
  // Le nom (facultatif) mis en tête du carnet : « Carnet de … ».
  name?: string;
  // Les succès obtenus (voir succes.ts) : identifiant → date (ISO).
  achievements?: Record<string, string>;
}

const FORMAT = 'quetes-de-sysadmin';

/** Le fichier de sauvegarde : la sauvegarde du navigateur, datée. */
export const backupFile = (s: Backup, date: Date) =>
  JSON.stringify({ format: FORMAT, version: VERSION, date: date.toISOString(), backup: s }, null, 2);

const string = (x: unknown): x is string => typeof x === 'string';
const dictionary = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const strings = (x: unknown) => (dictionary(x) ? Object.fromEntries(Object.entries(x).filter(([, v]) => string(v))) as Record<string, string> : undefined);

export type FileError = 'fichier-illisible' | 'fichier-autre' | 'fichier-trop-recent';

/** La sauvegarde d'un fichier, nettoyée (on ne garde que ce que le jeu connaît), ou ce qui ne va pas. */
export function readFile(text: string): { backup: Backup } | { error: FileError } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { error: 'fichier-illisible' };
  }
  if (!dictionary(raw) || raw.format !== FORMAT || !dictionary(raw.backup)) return { error: 'fichier-autre' };
  if (typeof raw.version !== 'number' || raw.version > VERSION) return { error: 'fichier-trop-recent' };
  const s = raw.backup;
  const chapters = new Set(STORIES.flatMap((h) => h.chapters.map((c) => c.id)));
  const stories = new Set(STORIES.map((h) => h.id));
  const ssh = dictionary(s.ssh) ? { files: strings(s.ssh.files) ?? {}, phrases: strings(s.ssh.phrases) } : undefined;
  const notebook = dictionary(s.notebook)
    ? Object.fromEntries(
        Object.entries(s.notebook)
          .filter(([, e]) => dictionary(e) && string(e.line) && string(e.chapter))
          .map(([n, e]) => [n, { line: (e as { line: string }).line, chapter: (e as { chapter: string }).chapter }]),
      )
    : undefined;
  const records = dictionary(s.records)
    ? (Object.fromEntries(Object.entries(s.records).filter(([id, ms]) => chapters.has(id) && typeof ms === 'number' && ms > 0)) as Record<string, number>)
    : undefined;
  return {
    backup: {
      finished: Array.isArray(s.finished) ? s.finished.filter((id): id is string => string(id) && chapters.has(id)) : [],
      story: string(s.story) && stories.has(s.story) ? s.story : null,
      ...(string(s.known) ? { known: s.known } : {}),
      ...(ssh ? { ssh } : {}),
      ...(notebook ? { notebook } : {}),
      exam: s.exam === true,
      ...(records ? { records } : {}),
      ...(string(s.name) && s.name.trim() ? { name: cleanName(s.name) } : {}),
      ...(dictionary(s.achievements)
        ? { achievements: Object.fromEntries(Object.entries(s.achievements).filter(([id, date]) => ACHIEVEMENTS.some((x) => x.id === id) && string(date))) as Record<string, string> }
        : {}),
    },
  };
}

/** Un nom pour le carnet : une ligne, sans caractère de contrôle, 60 caractères au plus. */
export const cleanName = (name: string) =>
  name
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
