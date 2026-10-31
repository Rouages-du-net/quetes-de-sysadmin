// Caddy d'une machine : le Caddyfile lu comme le fait l'adaptateur
// caddyfile, la configuration appliquée au démarrage et au rechargement, et
// le HTTPS automatique. Pour chaque site dont l'adresse est un nom de domaine
// (ni http://, ni :80), Caddy obtient lui-même un certificat auprès de Let's
// Encrypt (ACME) et redirige HTTP vers HTTPS. L'autorité vérifie, depuis
// internet, que la machine répond pour ce nom sur le port 80 (défi HTTP-01)
// ou 443 (TLS-ALPN-01) : le DNS du nom doit mener ici, et le pare-feu laisser
// passer. Les journaux de Caddy sont des lignes JSON (zap).
// Sources : https://caddyserver.com/docs/caddyfile/concepts,
// https://caddyserver.com/docs/automatic-https,
// https://caddyserver.com/docs/caddyfile/directives,
// https://caddyserver.com/docs/command-line,
// https://letsencrypt.org/docs/challenge-types/
// Écarts : un sous-ensemble des directives est appliqué (root, file_server,
// respond, redir, reverse_proxy) ; les autres sont reconnues mais sans effet ;
// pas de matchers nommés ni de blocs handle ; une seule autorité (Let's
// Encrypt, sans ZeroSSL) ; un défi raté est retenté dès que la cause a
// disparu (au lieu d'attendre le délai) ; localhost et les adresses IP ne
// reçoivent pas de certificat interne.

import type { Jeu, Shell } from './shell';
import { journaliser, systemd, versUtc } from './systemd';
import { verdict, type PareFeu } from './firewall';
import { couvre, DUREE, EMETTEUR, lire as lireCertificat, pem, type Certificat } from './tls';
import { clePrivee, INTERMEDIAIRE } from './commands/certbot';
import { requeteAppli, type Reponse } from './nginx';
import type { Ecoute } from './commands/ss';

export const CADDYFILE = '/etc/caddy/Caddyfile';
export const PID = 812;
export const VERSION = 'v2.10.2 h1:g/gTYjGMD0dec+UgMw8SnfmJ3I9+M2TdvoRL/Ovu6U8=';
export const EMETTEUR_ACME = 'acme-v02.api.letsencrypt.org-directory';
const CA = 'https://acme-v02.api.letsencrypt.org/directory';
export const STOCKAGE = '/var/lib/caddy/.local/share/caddy';
const AUTOSAUVEGARDE = '/var/lib/caddy/.config/caddy/autosave.json';
// Une adresse des serveurs de validation de Let's Encrypt (pour le pare-feu).
const VALIDATEUR = '198.51.100.77';

// ——— Lecture du Caddyfile ———

export interface Directive {
  nom: string;
  args: string[];
  ligne: number;
  bloc?: Directive[];
}

export interface Adresse {
  schema: string;
  hote: string;
  port: number;
  // Le texte tel qu'écrit (pour les messages).
  texte: string;
}

export interface Site {
  adresses: Adresse[];
  directives: Directive[];
  ligne: number;
}

export interface ConfigCaddy {
  globales: Directive[];
  sites: Site[];
  // Le premier écart avec ce qu'écrirait caddy fmt (numéro de ligne), sinon null.
  nonFormate: number | null;
}

// Les directives connues des sites, d'après la documentation de Caddy 2.10.
const DIRECTIVES = new Set([
  'abort', 'acme_server', 'basic_auth', 'basicauth', 'bind', 'encode', 'error', 'file_server', 'forward_auth', 'fs', 'handle', 'handle_errors',
  'handle_path', 'header', 'import', 'intercept', 'invoke', 'log', 'log_append', 'log_skip', 'map', 'method', 'metrics', 'php_fastcgi', 'push',
  'redir', 'request_body', 'request_header', 'respond', 'reverse_proxy', 'rewrite', 'root', 'route', 'templates', 'tls', 'tracing', 'try_files',
  'uri', 'vars',
]);
const GLOBALES = new Set([
  'debug', 'http_port', 'https_port', 'default_bind', 'order', 'storage', 'storage_clean_interval', 'admin', 'persist_config', 'log', 'grace_period',
  'shutdown_delay', 'auto_https', 'email', 'default_sni', 'local_certs', 'skip_install_trust', 'acme_ca', 'acme_ca_root', 'acme_eab', 'acme_dns',
  'on_demand_tls', 'key_type', 'cert_issuer', 'renew_interval', 'ocsp_interval', 'ocsp_stapling', 'preferred_chains', 'servers', 'pki', 'events',
]);
// Les directives qui demandent au moins un argument (sans bloc).
const AVEC_ARGUMENT = new Set(['root', 'redir', 'respond', 'reverse_proxy', 'encode', 'rewrite', 'try_files', 'import', 'header', 'bind', 'tls']);

export class ErreurCaddy extends Error {}

interface LigneJetons {
  ligne: number;
  jetons: string[];
}

// Découpe le texte en lignes de jetons (guillemets, accents graves, commentaires).
function decouper(texte: string): LigneJetons[] {
  const lignes: LigneJetons[] = [];
  texte.split('\n').forEach((brute, i) => {
    const jetons: string[] = [];
    let courant = '';
    let dans: string | null = null;
    let enCours = false;
    for (let k = 0; k < brute.length; k++) {
      const c = brute[k];
      if (dans) {
        if (c === '\\' && dans === '"' && brute[k + 1] === '"') {
          courant += '"';
          k++;
        } else if (c === dans) dans = null;
        else courant += c;
        continue;
      }
      if (c === '"' || c === '`') {
        dans = c;
        enCours = true;
        continue;
      }
      if (c === '#' && !enCours) break;
      if (/\s/.test(c)) {
        if (enCours) jetons.push(courant);
        courant = '';
        enCours = false;
        continue;
      }
      courant += c;
      enCours = true;
    }
    if (enCours) jetons.push(courant);
    if (jetons.length) lignes.push({ ligne: i + 1, jetons });
  });
  return lignes;
}

/** Une adresse de site : [schéma://]hôte[:port], ou :port. */
export function lireAdresse(texte: string): Adresse {
  const m = /^(?:(https?):\/\/)?([^:/]*)(?::(\d+))?(\/.*)?$/.exec(texte);
  const schema = m?.[1] ?? '';
  const hote = (m?.[2] ?? texte).toLowerCase();
  const port = m?.[3] ? Number(m[3]) : schema === 'http' ? 80 : 443;
  return { schema, hote, port, texte };
}

export const estIp = (s: string) => /^\d{1,3}(\.\d{1,3}){3}$/.test(s);

/** Lit un Caddyfile ; lance ErreurCaddy avec le message de Caddy (sans « Error: »). */
export function lireCaddyfile(texte: string, fichier = CADDYFILE): ConfigCaddy {
  const lignes = decouper(texte);
  let i = 0;
  const finAttendue = (ligne: number) => new ErreurCaddy(`${fichier}:${ligne} - Error during parsing: Unexpected EOF`);
  const bloc = (ouverture: number, verifier: (d: Directive) => void): Directive[] => {
    const directives: Directive[] = [];
    while (i < lignes.length) {
      const { ligne, jetons } = lignes[i++];
      if (jetons[0] === '}' && jetons.length === 1) return directives;
      const ouvre = jetons.at(-1) === '{';
      const d: Directive = { nom: jetons[0], args: (ouvre ? jetons.slice(1, -1) : jetons.slice(1)).filter((j) => j !== '}'), ligne };
      verifier(d);
      if (ouvre) d.bloc = bloc(ligne, () => {});
      directives.push(d);
      // « respond ok }» : l'accolade fermante en fin de ligne n'est pas permise.
      if (!ouvre && jetons.length > 1 && jetons.at(-1) === '}') throw new ErreurCaddy(`${fichier}:${ligne} - Error during parsing: Unexpected next token after '${jetons.at(-2)}' on same line`);
    }
    throw finAttendue(ouverture);
  };
  const directiveDeSite = (d: Directive) => {
    if (!DIRECTIVES.has(d.nom)) {
      const site = /[.:]/.test(d.nom) || d.nom.startsWith('http');
      throw new ErreurCaddy(
        `${fichier}:${d.ligne}: unrecognized directive: ${d.nom}${site ? '\nDid you mean to define a second site? If so, you must use curly braces around each site to separate their configurations.' : ''}`,
      );
    }
    if (AVEC_ARGUMENT.has(d.nom) && !d.args.length) throw new ErreurCaddy(`${fichier}:${d.ligne} - Error during parsing: Wrong argument count or unexpected line ending after '${d.nom}'`);
  };
  const config: ConfigCaddy = { globales: [], sites: [], nonFormate: null };
  // Le bloc des options globales : des accolades seules, tout en haut.
  if (lignes[0]?.jetons.length === 1 && lignes[0].jetons[0] === '{') {
    i = 1;
    config.globales = bloc(lignes[0].ligne, (d) => {
      if (!GLOBALES.has(d.nom)) throw new ErreurCaddy(`${fichier}:${d.ligne}: unrecognized global option: ${d.nom}`);
    });
  }
  while (i < lignes.length) {
    const { ligne, jetons } = lignes[i++];
    if (jetons[0] === '}') throw new ErreurCaddy(`${fichier}:${ligne} - Error during parsing: Unexpected '}' because no matching opening brace`);
    const ouvre = jetons.at(-1) === '{';
    const textes = (ouvre ? jetons.slice(0, -1) : jetons)
      .join(' ')
      .split(/[\s,]+/)
      .filter(Boolean);
    if (!ouvre && config.sites.length) {
      // Après un premier site entre accolades, une ligne sans accolade : une directive égarée.
      directiveDeSite({ nom: jetons[0], args: [], ligne });
      throw new ErreurCaddy(`${fichier}:${ligne}: unrecognized directive: ${jetons[0]}`);
    }
    if (!textes.length) throw new ErreurCaddy(`${fichier}:${ligne} - Error during parsing: Unexpected '{'`);
    let directives: Directive[];
    if (ouvre) directives = bloc(ligne, directiveDeSite);
    else {
      // Un seul site, sans accolades : toute la suite du fichier lui appartient.
      directives = [];
      while (i < lignes.length) {
        const l = lignes[i++];
        if (l.jetons[0] === '}' && l.jetons.length === 1) throw new ErreurCaddy(`${fichier}:${l.ligne} - Error during parsing: Unexpected '}' because no matching opening brace`);
        const o = l.jetons.at(-1) === '{';
        const d: Directive = { nom: l.jetons[0], args: o ? l.jetons.slice(1, -1) : l.jetons.slice(1), ligne: l.ligne };
        directiveDeSite(d);
        if (o) d.bloc = bloc(l.ligne, () => {});
        directives.push(d);
      }
    }
    config.sites.push({ adresses: textes.map(lireAdresse), directives, ligne });
  }
  // Deux sites ne peuvent pas répondre à la même adresse.
  const vues = new Set<string>();
  config.sites.forEach((s, n) =>
    s.adresses.forEach((a, k) => {
      const cle = `${a.schema}|${a.hote}|${a.port}`;
      if (vues.has(cle)) throw new ErreurCaddy(`server block ${n}, key ${k} (${a.texte}): ambiguous site definition: ${a.texte}`);
      vues.add(cle);
    }),
  );
  const propre = formater(texte).split('\n');
  const brut = texte.replace(/\n+$/, '').split('\n');
  const ecart = brut.findIndex((l, k) => l !== propre[k]);
  config.nonFormate = ecart !== -1 ? ecart + 1 : propre.length !== brut.length ? brut.length + 1 : null;
  return config;
}

/** Ce qu'écrit caddy fmt : une tabulation par niveau d'accolades, un espace entre jetons, une ligne vide au plus. */
export function formater(texte: string): string {
  const sortie: string[] = [];
  let niveau = 0;
  let videAvant = false;
  for (const brute of texte.split('\n')) {
    const ligne = brute.trim();
    if (!ligne) {
      if (sortie.length && !videAvant) sortie.push('');
      videAvant = true;
      continue;
    }
    videAvant = false;
    // Un espace entre les jetons, hors des guillemets et des commentaires.
    let compacte = '';
    let dans: string | null = null;
    for (let k = 0; k < ligne.length; k++) {
      const c = ligne[k];
      if (dans) {
        compacte += c;
        if (c === dans) dans = null;
      } else if (c === '#') {
        compacte += ligne.slice(k);
        break;
      } else if (/\s/.test(c)) {
        if (!compacte.endsWith(' ')) compacte += ' ';
      } else {
        if (c === '"' || c === '`') dans = c;
        compacte += c;
      }
    }
    if (compacte.startsWith('}')) niveau = Math.max(0, niveau - 1);
    sortie.push('\t'.repeat(niveau) + compacte);
    if (compacte.endsWith('{') && !compacte.startsWith('#')) niveau++;
  }
  while (sortie.at(-1) === '') sortie.pop();
  return sortie.join('\n');
}

// ——— Les sites tels que Caddy les sert ———

const globale = (c: ConfigCaddy, nom: string) => c.globales.find((d) => d.nom === nom);
const modeHttps = (c: ConfigCaddy) => globale(c, 'auto_https')?.args[0] ?? 'on';

/** L'adresse reçoit-elle le HTTPS automatique (certificat ACME) ? */
export const geree = (c: ConfigCaddy, a: Adresse) =>
  !['off', 'disable_certs', 'ignore_loaded_certs'].includes(modeHttps(c)) && a.schema !== 'http' && a.port !== 80 && !!a.hote && a.hote.includes('.') && !estIp(a.hote) && !a.hote.includes('*');

/** Les noms dont Caddy gère le certificat. */
export const nomsGeres = (c: ConfigCaddy) => [...new Set(c.sites.flatMap((s) => s.adresses.filter((a) => geree(c, a)).map((a) => a.hote)))];

/** Les ports sur lesquels Caddy écoute avec cette configuration. */
export function portsEcoutes(c: ConfigCaddy): number[] {
  const ports = new Set(c.sites.flatMap((s) => s.adresses.map((a) => a.port)));
  if (nomsGeres(c).length && !['off', 'disable_redirects'].includes(modeHttps(c))) ports.add(80);
  return [...ports].sort((a, b) => a - b);
}

// ——— L'état de Caddy (etat.caddy) ———

export interface EtatCaddy {
  // La configuration en service (null : Caddy ne tourne pas).
  charge: ConfigCaddy | null;
  // Les noms sous lesquels la machine se joint elle-même (pour curl).
  noms: string[];
  // L'adresse publique de la machine, et ce que le DNS public dit de chaque nom.
  ip: string;
  dns: Record<string, string>;
  // Les noms dont l'obtention du certificat a échoué (Caddy retentera).
  attente: string[];
  essais: Record<string, number>;
}

export const etatCaddy = (jeu: Jeu): EtatCaddy | undefined => jeu.etat.caddy;

const dossierCertificat = (nom: string) => `${STOCKAGE}/certificates/${EMETTEUR_ACME}/${nom}`;

/** Le certificat que Caddy a pour ce nom, s'il est encore valable. */
export function certificatDe(jeu: Jeu, nom: string): { certificat: Certificat; contenu: string } | null {
  const contenu = jeu.lire(`${dossierCertificat(nom)}/${nom}.crt`);
  const c = lireCertificat(contenu);
  const maintenant = versUtc(systemd(jeu)?.horloge ?? 0);
  if (!c || !contenu || c.fin < maintenant || !couvre(c, nom)) return null;
  return { certificat: c, contenu };
}

// Un instant au format de zap (secondes depuis 1970, avec les millièmes).
const ts = (jeu: Jeu) => (versUtc(systemd(jeu)?.horloge ?? 0) / 1000 + 0.123).toFixed(3);

/** Une ligne JSON au journal de caddy.service. */
export function noter(jeu: Jeu, niveau: string, logger: string | null, msg: string, champs: Record<string, unknown> = {}, avance = false) {
  const sd = systemd(jeu);
  if (!sd) return;
  const ligne = JSON.stringify({ level: niveau, ts: 0, ...(logger ? { logger } : {}), msg, ...champs }).replace('"ts":0', `"ts":${ts(jeu)}`);
  journaliser(sd, 'caddy.service', 'caddy', PID, ligne, niveau === 'error' ? 3 : niveau === 'warn' ? 4 : 6, avance);
}

/** Le Caddyfile de la machine, lu ; ou l'erreur de Caddy. */
export function lireConfigCaddy(jeu: Jeu, fichier = CADDYFILE): { config: ConfigCaddy } | { erreur: string } {
  const texte = jeu.lire(fichier);
  if (texte === null) return { erreur: `reading config from file: open ${fichier}: no such file or directory` };
  try {
    return { config: lireCaddyfile(texte, fichier) };
  } catch (e) {
    if (e instanceof ErreurCaddy) return { erreur: `adapting config using caddyfile: ${e.message}` };
    throw e;
  }
}

/** Au démarrage et au rechargement du service : null si tout va bien, sinon les lignes d'erreur. */
export function verifierCaddy(jeu: Jeu): string[] | null {
  const r = lireConfigCaddy(jeu);
  return 'erreur' in r ? [`Error: ${r.erreur}`] : null;
}

// Les écoutes de Caddy (ss -tlnp) : celles de la configuration, et l'API d'administration.
function ecouter(jeu: Jeu, c: ConfigCaddy | null) {
  const autres = ((jeu.etat.ecoute ?? []) as Ecoute[]).filter((e) => e.processus !== 'caddy');
  const caddy: Ecoute[] = c ? [{ proto: 'tcp', adresse: '127.0.0.1', port: 2019, processus: 'caddy', pid: PID }, ...portsEcoutes(c).map((port) => ({ proto: 'tcp' as const, adresse: '*', port, processus: 'caddy', pid: PID }))] : [];
  if (c && portsEcoutes(c).includes(443)) caddy.push({ proto: 'udp', adresse: '*', port: 443, processus: 'caddy', pid: PID });
  jeu.etat.ecoute = [...autres, ...caddy];
}

/** Après un démarrage ou un rechargement réussi : Caddy applique sa configuration, et obtient les certificats qui manquent. */
export function chargerCaddy(jeu: Jeu) {
  const e = etatCaddy(jeu);
  const r = lireConfigCaddy(jeu);
  if (!e || 'erreur' in r) return;
  const c = r.config;
  e.charge = c;
  noter(jeu, 'info', null, 'using config from file', { file: CADDYFILE });
  if (c.nonFormate !== null) noter(jeu, 'warn', null, "Caddyfile input is not formatted; run 'caddy fmt --overwrite' to fix inconsistencies", { adapter: 'caddyfile', file: CADDYFILE, line: c.nonFormate });
  noter(jeu, 'info', null, 'adapted config to JSON', { adapter: 'caddyfile' });
  noter(jeu, 'info', 'admin', 'admin endpoint started', { address: 'localhost:2019', enforce_origin: false, origins: ['//localhost:2019', '//[::1]:2019', '//127.0.0.1:2019'] });
  // Un « serveur » par port, comme l'adaptateur (srv0, srv1…).
  const ports = [...new Set(c.sites.flatMap((s) => s.adresses.map((a) => a.port)))].sort((a, b) => b - a);
  ports.forEach((port, n) => {
    const geres = c.sites.flatMap((s) => s.adresses.filter((a) => a.port === port && geree(c, a)));
    if (port === 80) noter(jeu, 'warn', 'http.auto_https', 'server is listening only on the HTTP port, so no automatic HTTPS will be applied to this server', { server_name: `srv${n}`, http_port: 80 });
    else if (geres.length && !['off', 'disable_redirects'].includes(modeHttps(c))) noter(jeu, 'info', 'http.auto_https', 'enabling automatic HTTP->HTTPS redirects', { server_name: `srv${n}` });
  });
  if (portsEcoutes(c).includes(443)) noter(jeu, 'info', 'http', 'enabling HTTP/3 listener', { addr: ':443' });
  portsEcoutes(c).forEach((port) =>
    noter(jeu, 'info', 'http.log', 'server running', { name: ports.includes(port) ? `srv${ports.indexOf(port)}` : 'remaining_auto_https_redirects', protocols: ['h1', 'h2', 'h3'] }),
  );
  noter(jeu, 'info', null, 'autosaved config (load with --resume flag)', { file: AUTOSAUVEGARDE });
  ecouter(jeu, c);
  const noms = nomsGeres(c);
  if (noms.length) noter(jeu, 'info', 'http', 'enabling automatic TLS certificate management', { domains: noms });
  noter(jeu, 'info', null, 'serving initial configuration');
  e.attente = [];
  for (const nom of noms) if (!certificatDe(jeu, nom)) obtenir(jeu, nom);
}

/** À l'arrêt du service : plus rien n'écoute. */
export function arreterCaddy(jeu: Jeu) {
  const e = etatCaddy(jeu);
  if (e) e.charge = null;
  ecouter(jeu, null);
}

// Pourquoi l'autorité n'arrive pas à valider ce nom (null : elle y arrive).
function probleme(jeu: Jeu, nom: string): { type: string; detail: string } | null {
  const e = etatCaddy(jeu)!;
  const ip = e.dns[nom];
  if (!ip) return { type: 'dns', detail: `DNS problem: NXDOMAIN looking up A for ${nom} - check that a DNS record exists for this domain` };
  if (ip !== e.ip) return { type: 'connection', detail: `${ip}: Timeout during connect (likely firewall problem)` };
  const pf = jeu.etat.ufw as PareFeu | undefined;
  const ouvert = (port: number) => !pf || verdict(pf, port, VALIDATEUR) === 'accepte';
  if (!ouvert(80) && !ouvert(443)) return { type: 'connection', detail: `${ip}: Timeout during connect (likely firewall problem)` };
  return null;
}

// Un numéro de série, tiré du nom et du nombre d'essais (déterministe).
function serie(nom: string, n: number): string {
  let h = 0x811c9dc5;
  for (const c of `${nom}#${n}`) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193) >>> 0;
  return Array.from({ length: 5 }, (_, i) => ((Math.imul(h, i + 3) >>> 0) ^ (h >>> i)).toString(16).padStart(8, '0'))
    .join('')
    .slice(0, 36)
    .replace(/^./, '0');
}

// Crée les dossiers qui manquent (au nom de caddy), puis pose le fichier.
function poser(jeu: Jeu, chemin: string, contenu: string, mode: string) {
  const s = jeu as Shell;
  const avant = s.qui;
  s.qui = 'root';
  const morceaux = chemin.split('/').filter(Boolean);
  for (let k = 1; k < morceaux.length; k++) {
    const dossier = `/${morceaux.slice(0, k).join('/')}`;
    if (!s.existe(dossier)) s.placer('caddy', dossier, { type: 'dossier', enfants: {}, proprio: 'caddy', groupe: 'caddy', mode: 'rwx------' });
  }
  s.placer('caddy', chemin, { type: 'fichier', contenu, lignes: true, proprio: 'caddy', groupe: 'caddy', mode });
  s.qui = avant;
}

/** Caddy demande un certificat pour ce nom : il l'obtient, ou note l'échec (il retentera). */
export function obtenir(jeu: Jeu, nom: string): boolean {
  const e = etatCaddy(jeu)!;
  const essai = (e.essais[nom] = (e.essais[nom] ?? 0) + 1);
  noter(jeu, 'info', 'tls.obtain', 'acquiring lock', { identifier: nom }, true);
  noter(jeu, 'info', 'tls.obtain', 'lock acquired', { identifier: nom });
  noter(jeu, 'info', 'tls.obtain', 'obtaining certificate', { identifier: nom });
  const type = essai % 2 ? 'http-01' : 'tls-alpn-01';
  noter(jeu, 'info', 'acme_client', 'trying to solve challenge', { identifier: nom, challenge_type: type, ca: CA });
  const p = probleme(jeu, nom);
  if (p) {
    const urn = `urn:ietf:params:acme:error:${p.type}`;
    noter(jeu, 'error', 'acme_client', 'challenge failed', { identifier: nom, challenge_type: type, problem: { type: urn, title: '', detail: p.detail, instance: '', subproblems: [] } }, true);
    noter(jeu, 'error', 'acme_client', 'validating authorization', {
      identifier: nom,
      problem: { type: urn, title: '', detail: p.detail, instance: '', subproblems: [] },
      order: `https://acme-v02.api.letsencrypt.org/acme/order/2398412/${3_841_290_117 + essai}`,
      attempt: 1,
      max_attempts: 3,
    });
    const erreur = `HTTP 400 ${urn} - ${p.detail}`;
    noter(jeu, 'error', 'tls.obtain', 'could not get certificate from issuer', { identifier: nom, issuer: EMETTEUR_ACME, error: erreur });
    noter(jeu, 'error', 'tls.obtain', 'will retry', {
      error: `[${nom}] Obtain: [${nom}] solving challenge: ${nom}: [${nom}] authorization failed: ${erreur} (ca=${CA})`,
      attempt: essai,
      retrying_in: 60 * 2 ** Math.min(essai - 1, 5),
      elapsed: 2.4 * essai,
      max_duration: 2_592_000,
    });
    noter(jeu, 'info', 'tls.obtain', 'releasing lock', { identifier: nom });
    if (!e.attente.includes(nom)) e.attente.push(nom);
    return false;
  }
  noter(jeu, 'info', 'acme_client', 'authorization finalized', { identifier: nom, authz_status: 'valid' }, true);
  noter(jeu, 'info', 'acme_client', 'validations succeeded; finalizing order', { order: `https://acme-v02.api.letsencrypt.org/acme/order/2398412/${3_841_290_117 + essai}` });
  noter(jeu, 'info', 'acme_client', 'successfully downloaded available certificate chains', { count: 2, first_url: `https://acme-v02.api.letsencrypt.org/acme/cert/${serie(nom, essai)}` });
  const debut = Math.floor((versUtc(systemd(jeu)?.horloge ?? 0) - 3600_000) / 1000) * 1000;
  const c: Certificat = { cn: nom, noms: [nom], emetteur: EMETTEUR, serie: serie(nom, essai), debut, fin: debut + DUREE - 1000 };
  const dossier = dossierCertificat(nom);
  poser(jeu, `${dossier}/${nom}.crt`, `${pem(c)}\n${INTERMEDIAIRE}`, 'rw-------');
  poser(jeu, `${dossier}/${nom}.key`, clePrivee(c.serie), 'rw-------');
  poser(jeu, `${dossier}/${nom}.json`, JSON.stringify({ sans: [nom], issuer_data: { url: `https://acme-v02.api.letsencrypt.org/acme/cert/${c.serie}`, ca: CA } }, null, '\t'), 'rw-------');
  noter(jeu, 'info', 'tls.obtain', 'certificate obtained successfully', { identifier: nom, issuer: EMETTEUR_ACME });
  noter(jeu, 'info', 'tls.obtain', 'releasing lock', { identifier: nom });
  e.attente = e.attente.filter((n) => n !== nom);
  return true;
}

/**
 * Avant chaque commande : Caddy retente les certificats en échec. Le délai
 * réel (une minute, puis de plus en plus) est sauté dès que la cause a
 * disparu ; tant qu'elle reste, rien ne change.
 */
export function reessayer(jeu: Jeu) {
  const e = etatCaddy(jeu);
  const sd = systemd(jeu);
  if (!e?.charge || !e.attente.length || sd?.services.caddy?.etat !== 'active') return;
  for (const nom of [...e.attente]) {
    if (probleme(jeu, nom)) continue;
    sd.horloge += 60_000;
    obtenir(jeu, nom);
  }
}

// ——— Les requêtes ———

const RAISONS: Record<number, string> = { 200: 'OK', 301: 'Moved Permanently', 302: 'Found', 307: 'Temporary Redirect', 308: 'Permanent Redirect', 404: 'Not Found', 502: 'Bad Gateway' };
const JOURS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MOIS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dateHttp = (ms: number) => {
  const d = new Date(versUtc(ms));
  return `${JOURS[d.getUTCDay()]}, ${String(d.getUTCDate()).padStart(2, '0')} ${MOIS[d.getUTCMonth()]} ${d.getUTCFullYear()} ${d.toISOString().slice(11, 19)} GMT`;
};

export type ReponseCaddy = Reponse | { tls: 'alerte' };

function reponse(jeu: Jeu, https: boolean, code: number, corps: string, entetes: [string, string][], certificat?: string): Reponse {
  const date = dateHttp(systemd(jeu)?.horloge ?? 0);
  const tous: [string, string][] = [...(https ? [['Alt-Svc', 'h3=":443"; ma=2592000'] as [string, string]] : []), ...entetes, ['Server', 'Caddy'], ['Date', date]];
  if (!entetes.some(([n]) => n === 'Content-Length')) tous.push(['Content-Length', String(new TextEncoder().encode(corps).length)]);
  const premiere = https ? `HTTP/2 ${code} ` : `HTTP/1.1 ${code} ${RAISONS[code] ?? ''}`.trimEnd();
  return { code, corps, entetes: [premiere, ...tous.map(([n, v]) => `${https ? n.toLowerCase() : n}: ${v}`)], certificat };
}

const remplacer = (texte: string, hote: string, chemin: string, schema: string) =>
  texte.replaceAll('{uri}', chemin).replaceAll('{path}', chemin.split('?')[0]).replaceAll('{host}', hote).replaceAll('{scheme}', schema).replaceAll('{http.request.uri}', chemin).replaceAll('{http.request.host}', hote);

// Un matcher de chemin (/x, /x*, *) : le premier argument d'une directive, s'il commence par / ou vaut *.
function correspond(matcher: string, chemin: string): boolean {
  if (matcher === '*') return true;
  const p = chemin.split('?')[0];
  return matcher.endsWith('*') ? p.startsWith(matcher.slice(0, -1)) : p === matcher;
}

// Ce que sert un site, dans l'ordre des directives de Caddy (redir, respond, reverse_proxy, file_server).
function servir(jeu: Jeu, site: Site, hote: string, chemin: string, https: boolean, certificat?: string): Reponse {
  const schema = https ? 'https' : 'http';
  const avecMatcher = (d: Directive) => (d.args[0] === '*' || d.args[0]?.startsWith('/') ? { matcher: d.args[0], reste: d.args.slice(1) } : { matcher: '*', reste: d.args });
  for (const d of site.directives.filter((x) => x.nom === 'redir')) {
    const { matcher, reste } = d.args.length >= 2 && (d.args[0] === '*' || (d.args[0].startsWith('/') && !/^\d{3}$|^(permanent|temporary|html)$/.test(d.args[1] ?? ''))) ? avecMatcher(d) : { matcher: '*', reste: d.args };
    if (!correspond(matcher, chemin)) continue;
    const code = reste[1] === 'permanent' ? 301 : reste[1] === 'temporary' || !reste[1] ? 302 : /^\d{3}$/.test(reste[1]) ? Number(reste[1]) : 302;
    return reponse(jeu, https, code, '', [['Location', remplacer(reste[0], hote, chemin, schema)]], certificat);
  }
  for (const d of site.directives.filter((x) => x.nom === 'respond')) {
    const { matcher, reste } = avecMatcher(d);
    if (!correspond(matcher, chemin)) continue;
    const code = /^\d{3}$/.test(reste[0] ?? '') ? Number(reste[0]) : /^\d{3}$/.test(reste[1] ?? '') ? Number(reste[1]) : 200;
    const corps = /^\d{3}$/.test(reste[0] ?? '') ? '' : remplacer(reste[0] ?? '', hote, chemin, schema);
    return reponse(jeu, https, code, corps, [['Content-Type', 'text/plain; charset=utf-8']], certificat);
  }
  for (const d of site.directives.filter((x) => x.nom === 'reverse_proxy')) {
    const { matcher, reste } = avecMatcher(d);
    if (!correspond(matcher, chemin)) continue;
    const port = Number(/:(\d+)$/.exec(reste[0] ?? '')?.[1] ?? 80);
    const r = requeteAppli(jeu, port, chemin, { host: hote, 'x-forwarded-proto': schema, 'x-forwarded-host': hote });
    if (!r) return reponse(jeu, https, 502, '', [], certificat);
    return reponse(jeu, https, r.code, r.corps, [['Content-Type', r.type ?? 'text/html; charset=utf-8']], certificat);
  }
  const fichiers = site.directives.find((x) => x.nom === 'file_server');
  if (fichiers) {
    const root = site.directives.find((x) => x.nom === 'root');
    const racine = root ? (root.args.length > 1 ? root.args[1] : root.args[0]) : '.';
    const p = decodeURIComponent(chemin.split('?')[0]);
    const base = `${racine.replace(/\/$/, '')}${p}`;
    const noeud = jeu.trouver(base);
    const cible = noeud?.type === 'dossier' ? `${base.replace(/\/$/, '')}/index.html` : base;
    const n = jeu.trouver(cible);
    if (n?.type !== 'fichier' || !jeu.peut(n, 'r', 'caddy')) return reponse(jeu, https, 404, '', [], certificat);
    const corps = jeu.lire(cible) ?? '';
    const type = cible.endsWith('.html') ? 'text/html; charset=utf-8' : cible.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/plain; charset=utf-8';
    return reponse(jeu, https, 200, corps, [['Accept-Ranges', 'bytes'], ['Content-Type', type], ['Etag', `"${serie(cible, corps.length).slice(0, 13)}"`]], certificat);
  }
  return reponse(jeu, https, 200, '', [], certificat);
}

/**
 * Une requête à Caddy, sur la machine : null si rien n'écoute sur ce port ;
 * { tls: 'alerte' } si Caddy n'a pas de certificat pour ce nom (la poignée de
 * main TLS échoue). `dehors` : la requête vient d'internet (le pare-feu compte).
 */
export function requeteCaddy(jeu: Jeu, hote: string, chemin: string, port: number, dehors = false): ReponseCaddy | null {
  const e = etatCaddy(jeu);
  const c = e?.charge;
  if (!c || systemd(jeu)?.services.caddy?.etat !== 'active') return null;
  if (!portsEcoutes(c).includes(port)) return null;
  if (dehors) {
    const pf = jeu.etat.ufw as PareFeu | undefined;
    if (pf && verdict(pf, port, '192.0.2.99') !== 'accepte') return null;
  }
  const nom = hote.toLowerCase().replace(/\.$/, '');
  const https = port !== 80 && c.sites.some((s) => s.adresses.some((a) => a.port === port && a.schema !== 'http'));
  // Le site qui répond : celui de ce nom sur ce port, sinon celui sans nom (:port).
  const site =
    c.sites.find((s) => s.adresses.some((a) => a.port === port && a.hote === nom)) ?? c.sites.find((s) => s.adresses.some((a) => a.port === port && !a.hote));
  if (https) {
    const cert = certificatDe(jeu, nom);
    if (!site || !cert) return { tls: 'alerte' };
    return servir(jeu, site, nom, chemin, true, cert.contenu);
  }
  if (site) return servir(jeu, site, nom, chemin, false);
  // Sur le port 80, les noms gérés sont redirigés vers HTTPS (308).
  if (port === 80 && nomsGeres(c).includes(nom) && !['off', 'disable_redirects'].includes(modeHttps(c)))
    return reponse(jeu, false, 308, '', [['Connection', 'close'], ['Location', `https://${nom}${chemin}`]]);
  return reponse(jeu, false, 200, '', []);
}

// ——— caddy adapt : la configuration JSON (simplifiée) ———

export function versJson(c: ConfigCaddy): unknown {
  const ports = [...new Set(c.sites.flatMap((s) => s.adresses.map((a) => a.port)))].sort((a, b) => b - a);
  const servers: Record<string, unknown> = {};
  ports.forEach((port, n) => {
    const routes = c.sites
      .filter((s) => s.adresses.some((a) => a.port === port))
      .map((s) => {
        const hotes = s.adresses.filter((a) => a.port === port && a.hote).map((a) => a.hote);
        const handle = s.directives
          .filter((d) => ['root', 'file_server', 'respond', 'redir', 'reverse_proxy', 'encode'].includes(d.nom))
          .map((d) =>
            d.nom === 'root'
              ? { handler: 'vars', root: d.args.at(-1) }
              : d.nom === 'file_server'
                ? { handler: 'file_server', hide: ['/etc/caddy/Caddyfile'] }
                : d.nom === 'reverse_proxy'
                  ? { handler: 'reverse_proxy', upstreams: d.args.filter((a) => !a.startsWith('/')).map((dial) => ({ dial })) }
                  : d.nom === 'redir'
                    ? { handler: 'static_response', headers: { Location: [d.args[0]] }, status_code: d.args[1] === 'permanent' ? 301 : 302 }
                    : d.nom === 'encode'
                      ? { handler: 'encode', encodings: Object.fromEntries(d.args.map((a) => [a, {}])) }
                      : { handler: 'static_response', body: d.args[0] },
          );
        return { ...(hotes.length ? { match: [{ host: hotes }] } : {}), handle: [{ handler: 'subroute', routes: [{ handle }] }], terminal: true };
      });
    servers[`srv${n}`] = { listen: [`:${port}`], routes };
  });
  return { apps: { http: { servers } } };
}
