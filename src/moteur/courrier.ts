// Le courrier d'une machine : Postfix (main.cf lu comme postconf, la file
// d'attente, les remises et /var/log/mail.log), OpenDKIM (opendkim.conf, la
// clé, la signature au passage du milter) et, en face, des serveurs de
// courrier distants qui vérifient SPF, DKIM et DMARC avec le DNS simulé
// (dns.ts : ils voient ce que le secondaire publie, comme le reste d'internet).
// D'après la documentation de Postfix (https://www.postfix.org/postconf.5.html,
// https://www.postfix.org/MILTER_README.html, https://www.postfix.org/postqueue.1.html),
// d'OpenDKIM (opendkim.conf(5), opendkim-genkey(8), opendkim-testkey(8), le
// opendkim.conf de Debian) et des RFC 7208 (SPF), 6376 (DKIM) et 7489 (DMARC).
//
//   etat.courrier = {
//     ip: l'adresse publique de la machine (celle que voient les destinataires),
//     file: les messages en attente (deferred), compteur: pour leurs identifiants,
//     postfix: main.cf chargé, dkim: opendkim.conf chargé,
//     fournisseurs: les serveurs distants, par domaine (déclarés par le chapitre),
//     remis: ce qui a été accepté ailleurs (pour les vérifications),
//   }
//
// Écarts : pas de vrai SMTP ni de vraie cryptographie (une clé « publique »
// est calculée à partir de la privée) ; les serveurs distants interrogent le
// DNS sans cache ; Postfix ne réessaie pas tout seul (postqueue -f) ; le
// chroot de Postfix n'est simulé que pour la prise du milter ; pas de
// KeyTable/SigningTable ni de DNSSEC.

import type { Jeu } from './shell';
import { dns, interroger, texteTxt, type Rr } from './dns';
import { systemd } from './systemd';

export interface Message {
  id: string;
  // L'expéditeur de l'enveloppe (MAIL FROM) et les destinataires qui restent.
  de: string;
  a: string[];
  // L'en-tête From: (son domaine compte pour DMARC), le sujet, le corps.
  from: string;
  sujet: string;
  corps: string;
  arrive: number;
  taille: number;
  // La dernière raison d'attente (postqueue -p).
  raison?: string;
  // La signature DKIM posée par le milter (d= et s=, et la clé qui a signé).
  signature?: Signature | null;
  // La machine qui l'envoie vraiment (pour SPF) ; par défaut, celle-ci.
  ip?: string;
}

export interface Signature {
  d: string;
  s: string;
  cle: string;
}

export type ResultatSpf = 'pass' | 'fail' | 'softfail' | 'neutral' | 'none' | 'permerror' | 'temperror';

export interface Authentification {
  spf: ResultatSpf;
  // Le domaine que SPF a vérifié (celui de l'enveloppe).
  spfDomaine: string;
  dkim: 'pass' | 'fail' | 'none' | 'permerror';
  dkimDomaine?: string;
  dkimRaison?: string;
  dmarc: 'pass' | 'fail' | 'none' | 'permerror';
  politique?: string;
  fromDomaine: string;
}

// Un serveur de courrier distant : son MX, son adresse, et ce qu'il répond à un message.
export interface Fournisseur {
  mx: string;
  ip: string;
  // « 250 … » : accepté ; « 4xx » : à réessayer ; « 5xx » : refusé.
  recevoir: (jeu: Jeu, auth: Authentification, m: Message, destinataire: string) => string;
}

export interface ConfPostfix {
  valeurs: Record<string, string>;
}

export interface ConfDkim {
  domaines: string[];
  selecteur?: string;
  cle?: string;
  prise: string;
  mode: string;
  sures: boolean;
}

export interface EtatCourrier {
  ip: string;
  file: Message[];
  compteur: number;
  postfix: ConfPostfix | null;
  dkim: ConfDkim | null;
  fournisseurs: Record<string, Fournisseur>;
  remis: { message: Message; destinataire: string; auth: Authentification }[];
}

export const courrier = (jeu: Jeu): EtatCourrier | undefined => jeu.etat.courrier;

// ——— Postfix : main.cf ———

export const MAIN_CF = '/etc/postfix/main.cf';

// Les valeurs par défaut utiles (postconf -d), dans la version de Debian.
const DEFAUTS: Record<string, string> = {
  myhostname: '',
  mydomain: '',
  myorigin: '$myhostname',
  mydestination: '$myhostname, localhost.$mydomain, localhost',
  inet_interfaces: 'all',
  inet_protocols: 'all',
  relayhost: '',
  mynetworks: '127.0.0.0/8 [::ffff:127.0.0.0]/104 [::1]/128',
  smtpd_milters: '',
  non_smtpd_milters: '',
  milter_default_action: 'tempfail',
  milter_protocol: '6',
  alias_maps: 'hash:/etc/aliases',
  alias_database: 'hash:/etc/aliases',
  mailbox_size_limit: '0',
  recipient_delimiter: '',
  smtpd_banner: '$myhostname ESMTP $mail_name (Debian/GNU)',
  mail_name: 'Postfix',
  biff: 'yes',
  append_dot_mydomain: 'no',
  readme_directory: 'no',
  compatibility_level: '3.6',
  smtpd_tls_cert_file: '/etc/ssl/certs/ssl-cert-snakeoil.pem',
  smtpd_tls_key_file: '/etc/ssl/private/ssl-cert-snakeoil.key',
  smtpd_tls_security_level: 'none',
  smtp_tls_security_level: 'none',
  smtp_tls_CApath: '',
  smtpd_relay_restrictions: 'permit_mynetworks permit_sasl_authenticated defer_unauth_destination',
  maximal_queue_lifetime: '5d',
  queue_run_delay: '300s',
  data_directory: '/var/lib/postfix',
  queue_directory: '/var/spool/postfix',
  smtp_tls_session_cache_database: '',
  smtpd_tls_session_cache_database: '',
  smtpd_tls_loglevel: '0',
  smtp_tls_loglevel: '0',
  smtpd_tls_auth_only: 'no',
  smtpd_tls_protocols: '>=TLSv1',
  smtpd_tls_mandatory_protocols: '>=TLSv1',
  smtp_tls_protocols: '>=TLSv1',
  smtp_tls_mandatory_protocols: '>=TLSv1',
  smtpd_recipient_restrictions: '',
  smtpd_sender_restrictions: '',
  smtpd_helo_restrictions: '',
  smtpd_client_restrictions: '',
  smtpd_helo_required: 'no',
  smtpd_sasl_auth_enable: 'no',
  smtpd_sasl_type: 'cyrus',
  smtpd_sasl_path: 'smtpd',
  disable_vrfy_command: 'no',
  message_size_limit: '10240000',
  home_mailbox: '',
  mailbox_command: '',
  virtual_alias_maps: '$virtual_maps',
  virtual_mailbox_domains: '$virtual_mailbox_maps',
  local_recipient_maps: 'proxy:unix:passwd.byname $alias_maps',
  header_checks: '',
  smtputf8_enable: 'yes',
  delay_warning_time: '0h',
  notify_classes: 'resource, software',
  milter_mail_macros: 'i {auth_type} {auth_authen} {auth_author} {mail_addr} {mail_host} {mail_mailer}',
  milter_connect_macros: 'j {daemon_name} {daemon_addr} v _',
  milter_command_timeout: '30s',
  milter_connect_timeout: '30s',
  smtp_helo_name: '$myhostname',
};
export const PARAMETRES = Object.keys(DEFAUTS);

/** Lit main.cf comme Postfix : « nom = valeur », une ligne qui commence par une espace continue la précédente. */
export function lireMainCf(texte: string): { valeurs: Record<string, string>; inconnus: string[]; ordre: string[] } {
  const valeurs: Record<string, string> = {};
  const ordre: string[] = [];
  let courant: string | null = null;
  for (const brute of texte.split('\n')) {
    if (/^\s*#/.test(brute) || !brute.trim()) {
      courant = null;
      continue;
    }
    if (/^\s/.test(brute) && courant) {
      valeurs[courant] += ' ' + brute.trim();
      continue;
    }
    const m = /^([A-Za-z0-9_]+)\s*=\s*(.*)$/.exec(brute);
    if (!m) continue;
    courant = m[1];
    valeurs[m[1]] = m[2].trim();
    if (!ordre.includes(m[1])) ordre.push(m[1]);
  }
  return { valeurs, inconnus: ordre.filter((n) => !(n in DEFAUTS)), ordre };
}

/** La valeur d'un paramètre, $variables développées (comme postconf -x). */
export function parametre(jeu: Jeu, nom: string, valeurs?: Record<string, string>): string {
  const v = valeurs ?? courrier(jeu)?.postfix?.valeurs ?? lireMainCf(jeu.lire(MAIN_CF) ?? '').valeurs;
  const hote = (jeu.lire('/etc/hostname') ?? systemd(jeu)?.hote ?? 'localhost').trim();
  const brut = (n: string): string => {
    if (n in v) return v[n];
    if (n === 'myhostname') return hote;
    if (n === 'mydomain') return brut('myhostname').split('.').slice(1).join('.') || 'localdomain';
    return DEFAUTS[n] ?? '';
  };
  const developper = (texte: string, profondeur = 0): string =>
    profondeur > 8 ? texte : texte.replace(/\$\{?([a-z_]+)\}?/g, (_, n: string) => developper(brut(n), profondeur + 1));
  return developper(brut(nom));
}

// myorigin peut nommer un fichier (/etc/mailname, comme sur Debian).
export function origine(jeu: Jeu): string {
  const o = parametre(jeu, 'myorigin');
  return (o.startsWith('/') ? (jeu.lire(o) ?? '').trim() : o).toLowerCase();
}

/** postfix reload / start : main.cf devient la configuration servie. */
export function chargerPostfix(jeu: Jeu) {
  const c = courrier(jeu);
  if (c) c.postfix = { valeurs: lireMainCf(jeu.lire(MAIN_CF) ?? '').valeurs };
}

// ——— OpenDKIM ———

export const OPENDKIM_CONF = '/etc/opendkim.conf';

/** Lit opendkim.conf : « Nom valeur », une directive par ligne. */
export function lireDkim(texte: string): ConfDkim {
  const v: Record<string, string> = {};
  for (const l of texte.split('\n')) {
    const m = /^\s*([A-Za-z]+)\s+(.+?)\s*$/.exec(l.replace(/#.*$/, ''));
    if (m) v[m[1].toLowerCase()] = m[2];
  }
  return {
    domaines: (v.domain ?? '').split(/[\s,]+/).filter(Boolean).map((d) => d.toLowerCase()),
    selecteur: v.selector,
    cle: v.keyfile,
    prise: v.socket ?? 'inet:8891@localhost',
    mode: v.mode ?? 'sv',
    sures: !/^(no|false|0)$/i.test(v.requiresafekeys ?? 'yes'),
  };
}

// La clé privée est-elle lisible par d'autres que son propriétaire (et son groupe) ? (RequireSafeKeys)
const nonSure = (jeu: Jeu, chemin: string) => {
  const n = jeu.trouver(chemin);
  const mode = n?.mode ?? 'rw-r--r--';
  return /[rw]/.test(mode.slice(6, 9));
};

// Le compte opendkim peut-il traverser chaque dossier qui mène au fichier ?
const traversable = (jeu: Jeu, chemin: string, compte: string) => {
  const parties = chemin.split('/').filter(Boolean).slice(0, -1);
  for (let i = 1; i <= parties.length; i++) {
    const n = jeu.trouver('/' + parties.slice(0, i).join('/'));
    if (!n || !jeu.peut(n, 'x', compte)) return false;
  }
  return true;
};

/** Pour systemd : opendkim refuse de démarrer si la clé manque, est illisible ou n'est pas sûre. */
export function verifierOpendkim(jeu: Jeu): string[] | null {
  const conf = lireDkim(jeu.lire(OPENDKIM_CONF) ?? '');
  if (!conf.cle) return null;
  const n = jeu.trouver(conf.cle);
  if (!n || n.type !== 'fichier') return [`opendkim: ${OPENDKIM_CONF}: ${conf.cle}: open(): No such file or directory`];
  if (!jeu.peut(n, 'r', 'opendkim') || !traversable(jeu, conf.cle, 'opendkim')) return [`opendkim: ${OPENDKIM_CONF}: ${conf.cle}: open(): Permission denied`];
  if (conf.sures && nonSure(jeu, conf.cle))
    return [`opendkim: ${OPENDKIM_CONF}: ${conf.cle}: key data is not secure: ${conf.cle} can be read or written by other users`];
  return null;
}

export function chargerDkim(jeu: Jeu) {
  const c = courrier(jeu);
  if (c) c.dkim = lireDkim(jeu.lire(OPENDKIM_CONF) ?? '');
}

export function arreterDkim(jeu: Jeu) {
  const c = courrier(jeu);
  if (c) c.dkim = null;
}

// Une empreinte déterministe d'un texte (FNV-1a), pour fabriquer des clés qui ont l'air vraies.
function empreinte(texte: string, graine = 0): number {
  let h = 0x811c9dc5 ^ graine;
  for (let i = 0; i < texte.length; i++) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
/** Une suite base64 déterministe de `longueur` caractères, tirée d'une graine. */
export function base64De(graine: string, longueur: number): string {
  let s = '';
  for (let i = 0; s.length < longueur; i++) s += B64[empreinte(`${graine}:${i}`) % 64];
  return s;
}

/** La clé privée PEM que fabrique opendkim-genkey (bits, domaine, sélecteur, tirage). */
export function clePrivee(graine: string, bits = 2048): string {
  const corps = base64De(`prive:${graine}`, bits === 1024 ? 848 : 1624);
  const lignes = corps.match(/.{1,64}/g)!;
  return ['-----BEGIN PRIVATE KEY-----', ...lignes, '-----END PRIVATE KEY-----'].join('\n');
}

/** La clé publique (p=) qui va avec une clé privée : la même pour le même fichier. */
export function clePublique(privee: string): string | null {
  const corps = /-----BEGIN (?:RSA )?PRIVATE KEY-----([\s\S]*?)-----END/.exec(privee)?.[1].replace(/\s+/g, '');
  if (!corps) return null;
  const longue = corps.length > 1000;
  return `MII${longue ? 'BIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA' : 'GfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC'}${base64De(`public:${corps}`, longue ? 342 : 174)}IDAQAB`;
}

/** Le fichier .txt d'opendkim-genkey : l'enregistrement à publier, coupé en chaînes de 250 caractères au plus. */
export function enregistrementDkim(selecteur: string, domaine: string, publique: string): string {
  const morceaux = [`"v=DKIM1; h=sha256; k=rsa; "`, ...`p=${publique}`.match(/.{1,250}/g)!.map((m) => `"${m}"`)];
  return `${selecteur}._domainkey\tIN\tTXT\t( ${morceaux.join('\n\t  ')} )  ; ----- DKIM key ${selecteur} for ${domaine}`;
}

// ——— DNS vu d'internet ———

// Les serveurs distants interrogent ce que publie internet (le secondaire, et les zones des autres).
// vue « primaire » : ce que publie le serveur de la machine (avant que le secondaire ait recopié).
export type Vue = 'secondaire' | 'primaire';
const demander = (jeu: Jeu, nom: string, type: string, vue: Vue = 'secondaire'): { rrs: Rr[]; existe: boolean } => {
  const d = dns(jeu);
  if (!d) return { rrs: [], existe: false };
  const r = interroger(jeu, vue, nom, type, systemd(jeu)?.horloge ?? 0);
  return { rrs: r.reponses.filter((x) => x.type === type), existe: r.statut === 'NOERROR' };
};
export const txt = (jeu: Jeu, nom: string, vue: Vue = 'secondaire') => demander(jeu, nom, 'TXT', vue).rrs.map((r) => texteTxt(r.donnees));
const adresses = (jeu: Jeu, nom: string, vue: Vue) => demander(jeu, nom, 'A', vue).rrs.map((r) => r.donnees.trim());

// ——— SPF (RFC 7208) ———

const dansReseau = (ip: string, cidr: string) => {
  const [base, bits = '32'] = cidr.split('/');
  const n = (x: string) => x.split('.').reduce((t, o) => t * 256 + Number(o), 0);
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(base) || !/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return false;
  const masque = Number(bits) === 0 ? 0 : 2 ** 32 - 2 ** (32 - Number(bits));
  return (n(base) & masque) >>> 0 === (n(ip) & masque) >>> 0;
};

/** Le résultat SPF pour une adresse qui envoie au nom d'un domaine (check_host de la RFC 7208). */
export function verifierSpf(jeu: Jeu, ip: string, domaine: string, compte = { requetes: 0 }, vue: Vue = 'secondaire'): { resultat: ResultatSpf; raison: string } {
  const enregistrements = txt(jeu, domaine, vue).filter((t) => /^v=spf1(\s|$)/i.test(t));
  if (!enregistrements.length) return { resultat: 'none', raison: `no SPF record for ${domaine}` };
  if (enregistrements.length > 1) return { resultat: 'permerror', raison: `more than one SPF record for ${domaine}` };
  const termes = enregistrements[0].split(/\s+/).slice(1).filter(Boolean);
  let redirection: string | null = null;
  const RESULTATS: Record<string, ResultatSpf> = { '+': 'pass', '-': 'fail', '~': 'softfail', '?': 'neutral' };
  for (const terme of termes) {
    const mod = /^(redirect|exp)=(.+)$/i.exec(terme);
    if (mod) {
      if (mod[1].toLowerCase() === 'redirect') redirection = mod[2];
      continue;
    }
    const m = /^([+\-~?]?)([a-z0-9]+)(?:[:]([^/]+))?(?:\/(\d+))?$/i.exec(terme);
    if (!m) return { resultat: 'permerror', raison: `invalid term '${terme}'` };
    const qualif = RESULTATS[m[1] || '+'];
    const mec = m[2].toLowerCase();
    const cible = (m[3] ?? domaine).toLowerCase();
    let trouve = false;
    if (['a', 'mx', 'include', 'exists', 'ptr'].includes(mec) && ++compte.requetes > 10)
      return { resultat: 'permerror', raison: 'too many DNS lookups' };
    if (mec === 'all') trouve = true;
    else if (mec === 'ip4') trouve = !!m[3] && dansReseau(ip, m[4] ? `${m[3]}/${m[4]}` : m[3]);
    else if (mec === 'ip6') trouve = false;
    else if (mec === 'a') trouve = adresses(jeu, cible, vue).some((a) => dansReseau(ip, `${a}/${m[4] ?? 32}`));
    else if (mec === 'mx')
      trouve = demander(jeu, cible, 'MX', vue)
        .rrs.map((r) => r.donnees.split(' ')[1])
        .some((hote) => adresses(jeu, hote, vue).some((a) => dansReseau(ip, `${a}/${m[4] ?? 32}`)));
    else if (mec === 'include') {
      if (!m[3]) return { resultat: 'permerror', raison: `include without a domain` };
      const r = verifierSpf(jeu, ip, cible, compte, vue);
      if (r.resultat === 'permerror' || r.resultat === 'none') return { resultat: 'permerror', raison: `include:${cible}: ${r.raison}` };
      trouve = r.resultat === 'pass';
    } else if (mec === 'exists' || mec === 'ptr') trouve = false;
    else return { resultat: 'permerror', raison: `unknown mechanism '${mec}'` };
    if (trouve) return { resultat: qualif, raison: `${ip} matched ${terme} in the SPF record of ${domaine}` };
  }
  if (redirection) return verifierSpf(jeu, ip, redirection.toLowerCase(), compte, vue);
  return { resultat: 'neutral', raison: `no mechanism matched ${ip} for ${domaine}` };
}

// ——— DKIM et DMARC ———

/** Les balises d'un enregistrement DKIM ou DMARC : « v=DKIM1; k=rsa; p=… ». */
export const balises = (texte: string): Record<string, string> =>
  Object.fromEntries(
    texte
      .split(';')
      .map((x) => x.trim())
      .filter(Boolean)
      .map((x) => {
        const i = x.indexOf('=');
        return [x.slice(0, i).trim().toLowerCase(), x.slice(i + 1).replace(/\s+/g, '')];
      }),
  );

export function verifierDkim(jeu: Jeu, sig: Signature | null | undefined, vue: Vue = 'secondaire'): { resultat: Authentification['dkim']; raison?: string } {
  if (!sig) return { resultat: 'none', raison: 'message not signed' };
  const enregistrements = txt(jeu, `${sig.s}._domainkey.${sig.d}`, vue);
  if (!enregistrements.length) return { resultat: 'permerror', raison: 'no key for signature' };
  const b = balises(enregistrements[0]);
  if (!b.p) return { resultat: 'fail', raison: 'key revoked' };
  if (b.p !== sig.cle) return { resultat: 'fail', raison: 'signature did not verify' };
  return { resultat: 'pass' };
}

// Le domaine organisationnel (ici, les deux derniers niveaux : gardens.example).
const organisation = (d: string) => d.toLowerCase().split('.').slice(-2).join('.');
const domaineDe = (adresse: string) => (/@([^>\s]+)>?\s*$/.exec(adresse)?.[1] ?? '').toLowerCase();

/** La politique DMARC publiée pour un domaine (null : aucune ; « permerror » : plusieurs ou illisible). */
export function politiqueDmarc(jeu: Jeu, domaine: string, vue: Vue = 'secondaire'): Record<string, string> | 'permerror' | null {
  const liste = txt(jeu, `_dmarc.${domaine}`, vue).filter((t) => /^v=DMARC1(\s*;|$)/i.test(t));
  if (!liste.length) return null;
  if (liste.length > 1) return 'permerror';
  const b = balises(liste[0]);
  if (!['none', 'quarantine', 'reject'].includes((b.p ?? '').toLowerCase())) return 'permerror';
  return b;
}

/** Ce que vérifie un serveur destinataire : SPF (enveloppe), DKIM (signature), DMARC (alignement sur From:). */
export function authentifier(jeu: Jeu, m: Message): Authentification {
  const ip = m.ip ?? courrier(jeu)?.ip ?? '';
  const spfDomaine = domaineDe(m.de) || domaineDe(`<${m.de}>`);
  const spf = verifierSpf(jeu, ip, spfDomaine).resultat;
  const dkim = verifierDkim(jeu, m.signature);
  const fromDomaine = domaineDe(m.from);
  const politique = politiqueDmarc(jeu, fromDomaine);
  const base = { spf, spfDomaine, dkim: dkim.resultat, dkimRaison: dkim.raison, dkimDomaine: m.signature?.d, fromDomaine };
  if (politique === null) return { ...base, dmarc: 'none' };
  if (politique === 'permerror') return { ...base, dmarc: 'permerror' };
  const aligne =
    (spf === 'pass' && organisation(spfDomaine) === organisation(fromDomaine)) ||
    (dkim.resultat === 'pass' && organisation(m.signature!.d) === organisation(fromDomaine));
  return { ...base, dmarc: aligne ? 'pass' : 'fail', politique: politique.p.toLowerCase() };
}

// ——— Le journal (/var/log/mail.log) ———

export const MAIL_LOG = '/var/log/mail.log';

// « 2027-05-03T09:30:01.123456+02:00 », comme rsyslog sur Debian.
export function heureLog(local: number): string {
  const d = new Date(local);
  const ete = (() => {
    const annee = d.getUTCFullYear();
    const dernier = (mois: number) => {
      const x = new Date(Date.UTC(annee, mois + 1, 0, 1));
      return x.getTime() - x.getUTCDay() * 86_400_000;
    };
    const utc = local - 3600_000;
    return utc >= dernier(2) && utc < dernier(9);
  })();
  return `${d.toISOString().slice(0, 19)}.${String(100000 + (local % 900000)).slice(0, 6)}${ete ? '+02:00' : '+01:00'}`;
}

let pidCourant = 0;
/** Une ligne de mail.log : « hôte postfix/smtp[pid]: message ». */
export function journaliser(jeu: Jeu, programme: string, message: string) {
  const sd = systemd(jeu);
  const n = jeu.trouver(MAIL_LOG);
  if (!sd || n?.type !== 'fichier' || typeof n.contenu !== 'string') return;
  const pids: Record<string, number> = { pickup: 2401, cleanup: 2402, qmgr: 1188, smtp: 2404, local: 2405, smtpd: 2406, postqueue: 2407, postsuper: 2408, opendkim: 812 };
  pidCourant = pids[programme.replace(/^postfix\//, '')] ?? 2409;
  const ligne = `${heureLog(sd.horloge)} ${sd.hote} ${programme}[${pidCourant}]: ${message}`;
  n.contenu = n.contenu ? `${n.contenu}\n${ligne}` : ligne;
}

// ——— La remise ———

/** Un identifiant de file d'attente, comme ceux de Postfix (10 chiffres hexadécimaux, en capitales). */
export function nouvelId(jeu: Jeu): string {
  const c = courrier(jeu)!;
  c.compteur++;
  return (empreinte(`file:${c.compteur}`) >>> 0).toString(16).toUpperCase().padStart(8, '0') + String.fromCharCode(65 + (c.compteur % 6)) + String(c.compteur % 10);
}

// La prise d'un milter dans main.cf (inet:localhost:8891, unix:/chemin) comparée à celle d'opendkim (inet:8891@localhost, local:/chemin).
function priseJointe(jeu: Jeu, milter: string): { ok: boolean; erreur?: string } {
  const c = courrier(jeu)!;
  const actif = systemd(jeu)?.services.opendkim?.etat === 'active' && !!c.dkim;
  const inet = /^inet:(?:(\[?[^:\]]+\]?):)?(\d+)$/.exec(milter);
  const unix = /^unix:(.+)$/.exec(milter);
  if (!inet && !unix) return { ok: false, erreur: `warning: invalid milter address: ${milter}` };
  const refus = `warning: connect to Milter service ${milter}: ${unix ? 'No such file or directory' : 'Connection refused'}`;
  if (!actif) return { ok: false, erreur: refus };
  const prise = c.dkim!.prise;
  if (inet) {
    const p = /^inet6?:(\d+)(?:@(.+))?$/.exec(prise);
    const hote = (inet[1] ?? 'localhost').replace(/[[\]]/g, '');
    const local = ['localhost', '127.0.0.1'];
    const ok = !!p && p[1] === inet[2] && (!p[2] || local.includes(p[2])) && local.includes(hote);
    return ok ? { ok } : { ok: false, erreur: refus };
  }
  // Postfix tourne dans un chroot (/var/spool/postfix) : le chemin de la prise y est relatif.
  const l = /^(?:local|unix):(.+)$/.exec(prise);
  const ok = !!l && l[1] === `/var/spool/postfix${unix![1]}`;
  return ok ? { ok } : { ok: false, erreur: refus };
}

/**
 * Le passage par cleanup : les milters (non_smtpd_milters pour le courrier
 * déposé sur la machine) posent la signature DKIM. Renvoie null si le
 * message doit attendre (milter injoignable avec milter_default_action =
 * tempfail).
 */
function signer(jeu: Jeu, m: Message): boolean {
  const c = courrier(jeu)!;
  const milters = parametre(jeu, 'non_smtpd_milters').split(/[\s,]+/).filter(Boolean);
  m.signature = null;
  for (const milter of milters) {
    const p = priseJointe(jeu, milter);
    if (!p.ok) {
      journaliser(jeu, 'postfix/cleanup', p.erreur ?? '');
      const action = parametre(jeu, 'milter_default_action');
      if (action === 'accept') continue;
      m.raison = '4.7.1 Service unavailable - try again later';
      journaliser(jeu, 'postfix/cleanup', `${m.id}: milter-reject: END-OF-MESSAGE from localhost[127.0.0.1]: 4.7.1 Service unavailable - try again later; from=<${m.de}> to=<${m.a[0]}>`);
      return false;
    }
    const conf = c.dkim!;
    const domaine = domaineDe(m.from);
    if (!conf.mode.includes('s') || !conf.domaines.includes(domaine) || !conf.selecteur || !conf.cle) continue;
    const privee = jeu.lire(conf.cle);
    const publique = privee ? clePublique(privee) : null;
    if (!publique) continue;
    m.signature = { d: domaine, s: conf.selecteur, cle: publique };
    journaliser(jeu, 'opendkim', `${m.id}: DKIM-Signature field added (s=${conf.selecteur}, d=${domaine})`);
  }
  return true;
}

// La remise à un destinataire : locale (nos domaines) ou vers un serveur distant.
function remettre(jeu: Jeu, m: Message, destinataire: string): 'sent' | 'deferred' | 'bounced' {
  const c = courrier(jeu)!;
  const domaine = domaineDe(destinataire);
  const locaux = parametre(jeu, 'mydestination')
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((x) => x.toLowerCase());
  const delai = Math.max(0, Math.round(((systemd(jeu)?.horloge ?? m.arrive) - m.arrive) / 1000));
  if (locaux.includes(domaine)) {
    deposer(jeu, destinataire, m);
    journaliser(jeu, 'postfix/local', `${m.id}: to=<${destinataire}>, relay=local, delay=${delai}, delays=0.02/0.01/0/0.01, dsn=2.0.0, status=sent (delivered to mailbox)`);
    return 'sent';
  }
  const f = c.fournisseurs[domaine];
  if (!f) {
    journaliser(jeu, 'postfix/smtp', `${m.id}: to=<${destinataire}>, relay=none, delay=${delai}, delays=0.01/0/0.2/0, dsn=5.4.4, status=bounced (Host or domain name not found. Name service error for name=${domaine} type=MX: Host not found)`);
    return 'bounced';
  }
  const auth = authentifier(jeu, m);
  const reponse = f.recevoir(jeu, auth, m, destinataire);
  const relais = `${f.mx}[${f.ip}]:25`;
  const dsn = /^\d{3}[ -](\d\.\d+\.\d+)/.exec(reponse)?.[1] ?? '2.0.0';
  if (reponse.startsWith('2')) {
    c.remis.push({ message: m, destinataire, auth });
    journaliser(jeu, 'postfix/smtp', `${m.id}: to=<${destinataire}>, relay=${relais}, delay=${delai}, delays=0.02/0.01/0.31/0.12, dsn=${dsn}, status=sent (${reponse})`);
    return 'sent';
  }
  const statut = reponse.startsWith('4') ? 'deferred' : 'bounced';
  m.raison = `host ${f.mx}[${f.ip}] said: ${reponse} (in reply to end of DATA command)`;
  journaliser(jeu, 'postfix/smtp', `${m.id}: to=<${destinataire}>, relay=${relais}, delay=${delai}, delays=0.02/0.01/0.31/0.12, dsn=${dsn}, status=${statut} (${m.raison})`);
  return statut;
}

// La boîte d'un compte de la machine (/var/mail/compte, format mbox).
const JOURS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MOIS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dateMbox = (ms: number) => {
  const d = new Date(ms);
  return `${JOURS[d.getUTCDay()]} ${MOIS[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2)} ${d.toISOString().slice(11, 19)} ${d.getUTCFullYear()}`;
};

export function deposer(jeu: Jeu, adresse: string, m: Message, entetes: string[] = []) {
  const local = adresse.replace(/@.*$/, '').toLowerCase();
  const alias = new RegExp(`^${local}:\\s*(\\S+)`, 'm').exec(jeu.lire('/etc/aliases') ?? '')?.[1];
  const compte = alias ? alias.replace(/@.*$/, '') : local;
  if (!jeu.comptes.utilisateurs[compte]) return;
  const texte = [
    `From ${m.de} ${dateMbox(systemd(jeu)?.horloge ?? m.arrive)}`,
    ...entetes,
    `From: ${m.from}`,
    `To: ${adresse}`,
    `Subject: ${m.sujet}`,
    `Message-Id: <${m.id}@${parametre(jeu, 'myhostname')}>`,
    '',
    m.corps,
    '',
  ].join('\n');
  const chemin = `/var/mail/${compte}`;
  const n = jeu.trouver(chemin);
  if (n?.type === 'fichier') n.contenu = `${typeof n.contenu === 'string' && n.contenu ? n.contenu + '\n' : ''}${texte}`;
  else if (jeu.trouver('/var/mail')?.type === 'dossier')
    (jeu.trouver('/var/mail') as { enfants: Record<string, unknown> }).enfants[compte] = {
      type: 'fichier',
      contenu: texte,
      lignes: true,
      proprio: compte,
      groupe: 'mail',
      mode: 'rw-rw----',
    };
}

/** Essaie de remettre un message ; il reste dans la file (deferred) tant qu'un destinataire attend. */
export function essayer(jeu: Jeu, m: Message) {
  const c = courrier(jeu)!;
  const restants: string[] = [];
  for (const a of m.a) if (remettre(jeu, m, a) === 'deferred') restants.push(a);
  m.a = restants;
  if (!restants.length) {
    journaliser(jeu, 'postfix/qmgr', `${m.id}: removed`);
    c.file = c.file.filter((x) => x !== m);
  } else if (!c.file.includes(m)) c.file.push(m);
}

/** Le courrier déposé sur la machine (mail, sendmail) : pickup, cleanup (milters), qmgr, puis la remise. */
export function soumettre(jeu: Jeu, de: string, a: string[], sujet: string, corps: string, uid: number, from?: string): Message | null {
  const c = courrier(jeu);
  if (!c) return null;
  const domaine = origine(jeu);
  const expediteur = de.includes('@') ? de : `${de}@${domaine}`;
  const destinataires = a.map((x) => (x.includes('@') ? x : `${x}@${domaine}`));
  const m: Message = {
    id: '',
    de: expediteur,
    a: destinataires,
    from: from ?? expediteur,
    sujet,
    corps,
    arrive: systemd(jeu)?.horloge ?? 0,
    taille: 420 + corps.length + sujet.length,
  };
  m.id = nouvelId(jeu);
  journaliser(jeu, 'postfix/pickup', `${m.id}: uid=${uid} from=<${de}>`);
  // Postfix arrêté : le message attend dans maildrop.
  if (systemd(jeu)?.services.postfix?.etat !== 'active') {
    m.raison = 'mail system is down';
    c.file.push(m);
    return m;
  }
  journaliser(jeu, 'postfix/cleanup', `${m.id}: message-id=<${m.id}@${parametre(jeu, 'myhostname')}>`);
  if (!signer(jeu, m)) {
    c.file.push(m);
    return m;
  }
  journaliser(jeu, 'postfix/qmgr', `${m.id}: from=<${expediteur}>, size=${m.taille}, nrcpt=${destinataires.length} (queue active)`);
  essayer(jeu, m);
  return m;
}

/** postqueue -f : Postfix réessaie tout ce qui attend (et resigne ce qui n'était pas passé par le milter). */
export function vider(jeu: Jeu) {
  const c = courrier(jeu)!;
  for (const m of [...c.file]) {
    if (m.raison === 'mail system is down' || m.raison?.startsWith('4.7.1 Service unavailable')) {
      m.raison = undefined;
      journaliser(jeu, 'postfix/cleanup', `${m.id}: message-id=<${m.id}@${parametre(jeu, 'myhostname')}>`);
      if (!signer(jeu, m)) continue;
    }
    essayer(jeu, m);
  }
}

/** postqueue -p (mailq) : la file d'attente. */
export function afficherFile(jeu: Jeu): string {
  const c = courrier(jeu)!;
  if (!c.file.length) return 'Mail queue is empty';
  const blocs = c.file.map((m) => {
    const d = new Date(m.arrive);
    const date = `${JOURS[d.getUTCDay()]} ${MOIS[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2)} ${d.toISOString().slice(11, 19)}`;
    return [
      `${m.id.padEnd(12)}${String(m.taille).padStart(8)} ${date}  ${m.de}`,
      ...(m.raison ? [`(${m.raison})`] : []),
      ...m.a.map((a) => `${' '.repeat(41)}${a}`),
      '',
    ].join('\n');
  });
  const ko = Math.max(1, Math.round(c.file.reduce((t, m) => t + m.taille, 0) / 1024));
  return ['-Queue ID-  --Size-- ----Arrival Time---- -Sender/Recipient-------', ...blocs, `-- ${ko} Kbytes in ${c.file.length} Request${c.file.length > 1 ? 's' : ''}.`].join('\n');
}

/** Le rapport d'un vérificateur (comme check-auth) : les résultats, et l'en-tête Authentication-Results. */
export function rapportVerification(auth: Authentification, m: Message, mx: string): string {
  const dkim =
    auth.dkim === 'pass' ? `dkim=pass header.d=${auth.dkimDomaine} header.s=${m.signature?.s}` : `dkim=${auth.dkim} (${auth.dkimRaison ?? 'message not signed'})`;
  const dmarc = `dmarc=${auth.dmarc}${auth.politique ? ` (p=${auth.politique})` : ''} header.from=${auth.fromDomaine}`;
  return [
    '==========================================================',
    'Summary of Results',
    '==========================================================',
    `SPF check:          ${auth.spf}`,
    `DKIM check:         ${auth.dkim}`,
    `DMARC check:        ${auth.dmarc}`,
    '==========================================================',
    '',
    `Authentication-Results: ${mx};`,
    `\tspf=${auth.spf} smtp.mailfrom=${m.de};`,
    `\t${dkim};`,
    `\t${dmarc}`,
  ].join('\n');
}

export const sansSignature = (m: Message): Message => ({ ...m, signature: undefined });
export type { Rr };
