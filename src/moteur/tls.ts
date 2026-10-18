// Certificats TLS simulés. Un certificat est un vrai fichier PEM
// (-----BEGIN CERTIFICATE-----, base64) : ce que contient le base64 est
// propre au jeu (les informations utiles, lisibles par openssl et curl), au
// lieu d'une structure X.509. Copier, déplacer ou abîmer le fichier fait donc
// ce qu'on attend : un certificat abîmé ne se lit plus.
// Formats d'affichage d'après OpenSSL 3 (https://docs.openssl.org/3.5/man1/openssl-x509/).

export interface Certificat {
  // Nom commun (CN) et noms couverts (subjectAltName).
  cn: string;
  noms: string[];
  emetteur: string;
  serie: string;
  // Dates UTC, en millisecondes.
  debut: number;
  fin: number;
}

const MARQUE = 'quetes-x509:';

// Encodage base64 d'un texte ASCII (navigateur comme Node).
const base64 = (texte: string) => btoa(texte);

/** Le fichier PEM d'un certificat (lignes de 64 caractères, comme OpenSSL). */
export function pem(c: Certificat): string {
  // Un vrai certificat ECDSA fait une quinzaine de lignes : on complète.
  const texte = MARQUE + JSON.stringify(c) + '\u0000';
  const corps = base64(texte + c.serie.repeat(Math.ceil(Math.max(0, 760 - texte.length) / c.serie.length))).match(/.{1,64}/g)!;
  return ['-----BEGIN CERTIFICATE-----', ...corps, '-----END CERTIFICATE-----'].join('\n');
}

/** Lit le premier certificat d'un texte PEM ; null s'il n'y en a pas ou s'il est abîmé. */
export function lire(texte: string | null): Certificat | null {
  const m = /-----BEGIN CERTIFICATE-----\n([\s\S]*?)\n-----END CERTIFICATE-----/.exec(texte ?? '');
  if (!m) return null;
  try {
    const decode = atob(m[1].replace(/\s/g, ''));
    if (!decode.startsWith(MARQUE)) return null;
    return JSON.parse(decode.slice(MARQUE.length, decode.indexOf('\u0000'))) as Certificat;
  } catch {
    return null;
  }
}

const MOIS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** « Jan 21 06:39:59 2027 GMT », comme OpenSSL. */
export function dateOpenssl(ms: number): string {
  const d = new Date(ms);
  return `${MOIS[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2, ' ')} ${d.toISOString().slice(11, 19)} ${d.getUTCFullYear()} GMT`;
}

/** « 2027-01-21 06:39:59+00:00 », comme certbot. */
export const dateCertbot = (ms: number) => `${new Date(ms).toISOString().slice(0, 19).replace('T', ' ')}+00:00`;

export const sujet = (c: Certificat) => `CN=${c.cn}`;

/** Le certificat couvre-t-il ce nom ? (noms exacts, ou joker *.domaine sur un niveau) */
export const couvre = (c: Certificat, nom: string) =>
  c.noms.some((n) => n === nom.toLowerCase() || (n.startsWith('*.') && nom.toLowerCase().split('.').slice(1).join('.') === n.slice(2)));

export const DUREE = 90 * 86_400_000;
export const EMETTEUR = "C=US, O=Let's Encrypt, CN=E6";
