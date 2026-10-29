// Apache httpd simulé (le paquet apache2 de Debian) : la configuration lue
// comme Apache la lit (apache2.conf, ses Include, les modules chargés par
// LoadModule, les sections <VirtualHost>, <Directory>, <IfModule>…), vérifiée
// comme `apache2ctl configtest`, puis appliquée au démarrage et au
// rechargement. Une requête choisit son hôte virtuel, puis Apache trouve le
// fichier, en lisant les .htaccess (si AllowOverride le permet) et les
// règles de mod_rewrite. nginx et curl s'adressent à lui comme à une appli
// (etat.applis, adresse 127.0.0.1:port).
// D'après la documentation d'Apache 2.4 :
// https://httpd.apache.org/docs/2.4/configuring.html (fichiers, sections, modules),
// https://httpd.apache.org/docs/2.4/vhosts/details.html (choix de l'hôte virtuel :
// d'abord l'adresse et le port, puis le nom demandé, sinon le premier),
// https://httpd.apache.org/docs/2.4/sections.html#merging (ordre de fusion),
// https://httpd.apache.org/docs/2.4/howto/htaccess.html et
// https://httpd.apache.org/docs/2.4/mod/core.html#allowoverride (.htaccess),
// https://httpd.apache.org/docs/2.4/mod/mod_rewrite.html et
// https://httpd.apache.org/docs/2.4/rewrite/tech.html (règles par répertoire),
// https://httpd.apache.org/docs/2.4/bind.html (Listen) ; et le README.Debian
// du paquet (sites-available, a2ensite, envvars).
// Écarts : une partie des directives seulement (les autres sont refusées
// comme celles d'un module absent), pas de PHP ni de CGI, pas d'en-têtes
// d'expiration ni de compression ; les jokers des chemins de <Directory> ne
// sont pas lus.

import type { Jeu } from './shell';
import { joker } from './outils';
import { systemd } from './systemd';
import type { Appli, Demande } from './nginx';
import type { Ecoute } from './commandes/ss';

export const VERSION = '2.4.65';
export const SIGNATURE = `Apache/${VERSION} (Debian)`;
export const RACINE = '/etc/apache2';
export const CONF = `${RACINE}/apache2.conf`;
// Le PID du processus principal (root) et ceux des processus qui servent (www-data).
export const PID = 2301;

// Les variables de /etc/apache2/envvars, lues par apache2ctl.
const ENV: Record<string, string> = {
  APACHE_RUN_USER: 'www-data',
  APACHE_RUN_GROUP: 'www-data',
  APACHE_PID_FILE: '/var/run/apache2/apache2.pid',
  APACHE_RUN_DIR: '/var/run/apache2',
  APACHE_LOCK_DIR: '/var/lock/apache2',
  APACHE_LOG_DIR: '/var/log/apache2',
};

// Les modules compilés dans le binaire de Debian (apache2ctl -M : « static »).
export const STATIQUES = ['core', 'so', 'watchdog', 'http', 'log_config', 'logio', 'version', 'unixd'];

// Où une directive est permise (S : configuration du serveur, V : <VirtualHost>,
// D : <Directory>, <Location>, <Files>, H : .htaccess), le module qui la
// définit, et, dans un .htaccess, la catégorie d'AllowOverride qu'elle demande.
interface Regle {
  module: string;
  ou: string;
  surcharge?: string;
  section?: boolean;
}
const R = (module: string, ou: string, surcharge?: string): Regle => ({ module, ou, surcharge });
const S = (module: string, ou: string, surcharge?: string): Regle => ({ module, ou, surcharge, section: true });
const TOUT = 'SVDH';
const DIRECTIVES: Record<string, Regle> = {
  AccessFileName: R('core', 'SV'),
  AddDefaultCharset: R('core', TOUT, 'FileInfo'),
  AllowOverride: R('core', 'D'),
  DefaultRuntimeDir: R('core', 'S'),
  Define: R('core', 'SVD'),
  DocumentRoot: R('core', 'SV'),
  ErrorDocument: R('core', TOUT, 'FileInfo'),
  ErrorLog: R('core', 'SV'),
  FileETag: R('core', TOUT, 'FileInfo'),
  HostnameLookups: R('core', 'SVD'),
  Include: R('core', 'SVD'),
  IncludeOptional: R('core', 'SVD'),
  KeepAlive: R('core', 'SV'),
  KeepAliveTimeout: R('core', 'SV'),
  LimitRequestBody: R('core', TOUT, 'All'),
  Listen: R('core', 'S'),
  LogLevel: R('core', 'SVD'),
  MaxKeepAliveRequests: R('core', 'SV'),
  Mutex: R('core', 'S'),
  Options: R('core', TOUT, 'Options'),
  PidFile: R('core', 'S'),
  Protocols: R('core', 'SV'),
  ServerAdmin: R('core', 'SV'),
  ServerAlias: R('core', 'V'),
  ServerName: R('core', 'SV'),
  ServerRoot: R('core', 'S'),
  ServerSignature: R('core', TOUT, 'All'),
  ServerTokens: R('core', 'S'),
  Timeout: R('core', 'SV'),
  TraceEnable: R('core', 'SV'),
  UseCanonicalName: R('core', 'SVD'),
  LoadModule: R('so', 'S'),
  User: R('unixd', 'S'),
  Group: R('unixd', 'S'),
  CustomLog: R('log_config', 'SV'),
  LogFormat: R('log_config', 'SV'),
  StartServers: R('mpm_event', 'S'),
  MinSpareThreads: R('mpm_event', 'S'),
  MaxSpareThreads: R('mpm_event', 'S'),
  ThreadLimit: R('mpm_event', 'S'),
  ThreadsPerChild: R('mpm_event', 'S'),
  MaxRequestWorkers: R('mpm_event', 'S'),
  MaxConnectionsPerChild: R('mpm_event', 'S'),
  Require: R('authz_core', 'DH', 'AuthConfig'),
  AuthType: R('authn_core', 'DH', 'AuthConfig'),
  AuthName: R('authn_core', 'DH', 'AuthConfig'),
  AuthUserFile: R('authn_file', 'DH', 'AuthConfig'),
  AuthBasicProvider: R('auth_basic', 'DH', 'AuthConfig'),
  Order: R('access_compat', 'DH', 'Limit'),
  Allow: R('access_compat', 'DH', 'Limit'),
  Deny: R('access_compat', 'DH', 'Limit'),
  DirectoryIndex: R('dir', TOUT, 'Indexes'),
  DirectorySlash: R('dir', TOUT, 'Indexes'),
  TypesConfig: R('mime', 'S'),
  AddType: R('mime', TOUT, 'FileInfo'),
  AddCharset: R('mime', TOUT, 'FileInfo'),
  AddEncoding: R('mime', TOUT, 'FileInfo'),
  AddHandler: R('mime', TOUT, 'FileInfo'),
  AddLanguage: R('mime', TOUT, 'FileInfo'),
  AddOutputFilter: R('mime', TOUT, 'FileInfo'),
  SetEnvIf: R('setenvif', TOUT, 'FileInfo'),
  SetEnvIfNoCase: R('setenvif', TOUT, 'FileInfo'),
  BrowserMatch: R('setenvif', TOUT, 'FileInfo'),
  BrowserMatchNoCase: R('setenvif', TOUT, 'FileInfo'),
  SetEnv: R('env', TOUT, 'FileInfo'),
  UnsetEnv: R('env', TOUT, 'FileInfo'),
  PassEnv: R('env', TOUT, 'FileInfo'),
  AddOutputFilterByType: R('filter', TOUT, 'FileInfo'),
  RequestReadTimeout: R('reqtimeout', 'SV'),
  IndexOptions: R('autoindex', TOUT, 'Indexes'),
  IndexIgnore: R('autoindex', TOUT, 'Indexes'),
  RewriteEngine: R('rewrite', TOUT, 'FileInfo'),
  RewriteRule: R('rewrite', TOUT, 'FileInfo'),
  RewriteCond: R('rewrite', TOUT, 'FileInfo'),
  RewriteOptions: R('rewrite', TOUT, 'FileInfo'),
  RewriteBase: R('rewrite', 'DH', 'FileInfo'),
  Alias: R('alias', 'SV'),
  ScriptAlias: R('alias', 'SV'),
  Redirect: R('alias', TOUT, 'FileInfo'),
  RedirectMatch: R('alias', TOUT, 'FileInfo'),
  RedirectPermanent: R('alias', TOUT, 'FileInfo'),
  Header: R('headers', TOUT, 'FileInfo'),
  RequestHeader: R('headers', TOUT, 'FileInfo'),
  ExpiresActive: R('expires', TOUT, 'Indexes'),
  ExpiresByType: R('expires', TOUT, 'Indexes'),
  ExpiresDefault: R('expires', TOUT, 'Indexes'),
  ProxyPass: R('proxy', 'SVD'),
  ProxyPassReverse: R('proxy', 'SVD'),
  ProxyPreserveHost: R('proxy', 'SV'),
  ProxyRequests: R('proxy', 'SV'),
  SSLEngine: R('ssl', 'SV'),
  SSLCertificateFile: R('ssl', 'SV'),
  SSLCertificateKeyFile: R('ssl', 'SV'),
  SSLProtocol: R('ssl', 'SV'),
  SSLCipherSuite: R('ssl', 'SV'),
  SSLSessionCache: R('ssl', 'S'),
  SSLRandomSeed: R('ssl', 'S'),
  SSLPassPhraseDialog: R('ssl', 'S'),
  VirtualHost: S('core', 'S'),
  Directory: S('core', 'SV'),
  DirectoryMatch: S('core', 'SV'),
  Location: S('core', 'SV'),
  LocationMatch: S('core', 'SV'),
  Files: S('core', TOUT, 'All'),
  FilesMatch: S('core', TOUT, 'All'),
  IfModule: S('core', TOUT),
  IfDefine: S('core', TOUT),
  IfVersion: S('version', TOUT),
  Limit: S('core', 'DH'),
  LimitExcept: S('core', 'DH'),
};
// Les noms de directives ne tiennent pas compte de la casse.
const PAR_MINUSCULES = Object.fromEntries(Object.keys(DIRECTIVES).map((n) => [n.toLowerCase(), n]));

// Les modules de mods-available (fichiers .load et .conf) et leurs dépendances (a2enmod).
export const DEPENDANCES: Record<string, string[]> = { ssl: ['setenvif', 'mime', 'socache_shmcb'], proxy_http: ['proxy'] };

export class ErreurApache extends Error {}
const syntaxe = (fichier: string, ligne: number, message: string): never => {
  throw new ErreurApache(`AH00526: Syntax error on line ${ligne} of ${fichier}:\n${message}`);
};
const commandeInvalide = (nom: string) => `Invalid command '${nom}', perhaps misspelled or defined by a module not included in the server configuration`;

// ——— Lecture ———

// Une directive lue : son nom (tel qu'écrit), ses arguments, d'où elle vient ;
// une section a ses enfants.
export interface Ligne {
  nom: string;
  args: string[];
  fichier: string;
  ligne: number;
  enfants?: Ligne[];
}

// Les mots d'une ligne : séparés par des espaces, les guillemets regroupent.
function mots(texte: string): string[] {
  const liste: string[] = [];
  for (const m of texte.matchAll(/"((?:[^"\\]|\\.)*)"|'([^']*)'|(\S+)/g)) liste.push(m[1] ?? m[2] ?? m[3]);
  return liste;
}

// Les lignes logiques d'un fichier : commentaires et lignes vides retirés, « \ » en fin de ligne continue.
function lignesDe(texte: string): { texte: string; ligne: number }[] {
  const resultat: { texte: string; ligne: number }[] = [];
  const brutes = texte.split('\n');
  for (let i = 0; i < brutes.length; i++) {
    const debut = i + 1;
    let l = brutes[i];
    while (l.endsWith('\\') && i + 1 < brutes.length) l = l.slice(0, -1) + ' ' + brutes[++i];
    const t = l.trim();
    if (t && !t.startsWith('#')) resultat.push({ texte: t, ligne: debut });
  }
  return resultat;
}

// Un nom de module : « rewrite_module », « mod_rewrite.c » → « rewrite ».
const module = (nom: string) => nom.replace(/^mod_/, '').replace(/\.c$/, '').replace(/_module$/, '');

// L'état de la lecture : modules chargés (dans l'ordre), variables définies, avertissements.
interface Lecture {
  modules: string[];
  definis: Set<string>;
  avertissements: string[];
}

/**
 * Lit un fichier de configuration (ou un .htaccess, contexte « H ») et ses
 * Include ; lève une ErreurApache au format d'Apache.
 */
function lireFichier(jeu: Jeu, fichier: string, contexte: string, lecture: Lecture, texte?: string): Ligne[] {
  const lignes = lignesDe(texte ?? jeu.lire(fichier) ?? '');
  let i = 0;
  // Les variables ${VAR} : celles d'envvars, puis Define.
  const remplacer = (l: string) =>
    l.replace(/\$\{([A-Za-z0-9_]+)\}/g, (tout, v: string) => {
      if (ENV[v] !== undefined) return ENV[v];
      if (lecture.definis.has(v)) return '';
      if (!lecture.avertissements.includes(`AH00111: Config variable \${${v}} is not defined`))
        lecture.avertissements.push(`AH00111: Config variable \${${v}} is not defined`);
      return tout;
    });
  const bloc = (ctx: string, ouverte: { nom: string; ligne: number } | null, actif: boolean): Ligne[] => {
    const liste: Ligne[] = [];
    while (i < lignes.length) {
      const { texte: brut, ligne } = lignes[i++];
      const l = remplacer(brut);
      const fin = /^<\/([^\s>]+)\s*>$/.exec(l);
      if (fin) {
        if (!ouverte) syntaxe(fichier, ligne, `</${fin[1]}> without matching <${fin[1]}> section`);
        if (fin[1].toLowerCase() !== ouverte!.nom.toLowerCase()) syntaxe(fichier, ligne, `Expected </${ouverte!.nom}> but saw </${fin[1]}>`);
        return liste;
      }
      const debut = /^<([^\s>]+)(.*?)>?$/.exec(l);
      if (debut && l.startsWith('<')) {
        const nomBrut = debut[1];
        const args = mots(debut[2].replace(/>\s*$/, ''));
        const nom = PAR_MINUSCULES[nomBrut.toLowerCase()];
        if (!actif) {
          bloc(ctx, { nom: nomBrut, ligne }, false);
          continue;
        }
        const regle = nom ? DIRECTIVES[nom] : undefined;
        if (!regle || !regle.section || !estCharge(lecture, regle.module)) syntaxe(fichier, ligne, commandeInvalide(`<${nomBrut}`));
        if (nom === 'VirtualHost' && ctx === 'V') syntaxe(fichier, ligne, '<VirtualHost> cannot occur within <VirtualHost> section');
        if (!regle!.ou.includes(ctx)) syntaxe(fichier, ligne, `<${nom} not allowed here`);
        if (nom === 'IfModule' || nom === 'IfDefine' || nom === 'IfVersion') {
          const condition = args[0] ?? '';
          const non = condition.startsWith('!');
          const quoi = condition.replace(/^!/, '');
          const vrai = nom === 'IfModule' ? estCharge(lecture, module(quoi)) : nom === 'IfDefine' ? lecture.definis.has(quoi) : true;
          const dedans = bloc(ctx, { nom: nomBrut, ligne }, vrai !== non);
          if (vrai !== non) liste.push(...dedans);
          continue;
        }
        const sous = nom === 'VirtualHost' ? 'V' : ctx === 'H' ? 'H' : 'D';
        const enfants = bloc(sous, { nom: nomBrut, ligne }, true);
        liste.push({ nom: nom!, args, fichier, ligne, enfants });
        continue;
      }
      if (!actif) continue;
      const [nomBrut, ...args] = mots(l);
      const nom = PAR_MINUSCULES[nomBrut.toLowerCase()];
      const regle = nom ? DIRECTIVES[nom] : undefined;
      if (!regle || regle.section || !estCharge(lecture, regle.module)) syntaxe(fichier, ligne, commandeInvalide(nomBrut));
      if (!regle!.ou.includes(ctx)) syntaxe(fichier, ligne, `${nom} not allowed here`);
      verifierArguments(nom!, args, fichier, ligne);
      if (nom === 'LoadModule') {
        const m = module(args[0]);
        if (lecture.modules.includes(m)) lecture.avertissements.push(`AH01574: module ${args[0]} is already loaded, skipping`);
        else if (!jeu.trouver(args[1]?.startsWith('/') ? args[1] : `/usr/lib/apache2/${args[1] ?? ''}`))
          syntaxe(fichier, ligne, `Cannot load ${args[1]} into server: ${args[1]}: cannot open shared object file: No such file or directory`);
        else lecture.modules.push(m);
        continue;
      }
      if (nom === 'Define') {
        if (args[0]) lecture.definis.add(args[0]);
        continue;
      }
      if (nom === 'Include' || nom === 'IncludeOptional') {
        for (const f of inclus(jeu, args[0] ?? '', nom === 'IncludeOptional', fichier, ligne)) liste.push(...lireFichier(jeu, f, ctx, lecture));
        continue;
      }
      liste.push({ nom: nom!, args, fichier, ligne });
    }
    if (ouverte) {
      const derniere = lignes.at(-1)?.ligne ?? ouverte.ligne;
      syntaxe(fichier, derniere, `${fichier}:${ouverte.ligne}: <${ouverte.nom}> was not closed.`);
    }
    return liste;
  };
  return bloc(contexte, null, true);
}

const estCharge = (lecture: Lecture, m: string) => STATIQUES.includes(m) || lecture.modules.includes(m);

// Quelques vérifications d'arguments, avec les messages d'Apache.
function verifierArguments(nom: string, args: string[], fichier: string, ligne: number) {
  const un: Record<string, string> = {
    DocumentRoot: 'Root directory of the document tree',
    ServerName: 'The hostname and port of the server',
    ErrorLog: 'The filename of the error log',
  };
  if (un[nom] && args.length !== 1) syntaxe(fichier, ligne, `${nom} takes one argument, ${un[nom]}`);
  if (['RewriteEngine', 'KeepAlive'].includes(nom) && !/^(on|off)$/i.test(args[0] ?? '')) syntaxe(fichier, ligne, `${nom} must be On or Off`);
  if (nom === 'Listen' && (!args.length || args.length > 2)) syntaxe(fichier, ligne, 'Listen requires 1 or 2 arguments.');
  if (nom === 'AllowOverride')
    for (const a of args)
      if (!/^(all|none|authconfig|fileinfo|indexes|limit|options(=.*)?|nonfatal=.*)$/i.test(a)) syntaxe(fichier, ligne, `Illegal override option ${a}`);
  if (nom === 'Require' && !args.length) syntaxe(fichier, ligne, 'Require requires at least one argument');
  if (nom === 'RewriteRule') {
    if (args.length < 2) syntaxe(fichier, ligne, 'RewriteRule: bad argument line');
    try {
      new RegExp(args[0].replace(/^!/, ''));
    } catch {
      syntaxe(fichier, ligne, `RewriteRule: cannot compile regular expression '${args[0]}'`);
    }
  }
}

// Les fichiers d'un Include (relatif à ServerRoot), triés ; un lien cassé ne s'ouvre pas.
function inclus(jeu: Jeu, motif: string, optionnel: boolean, fichier: string, ligne: number): string[] {
  const chemin = motif.startsWith('/') ? motif : `${RACINE}/${motif}`;
  const ouvrir = (c: string) => {
    const n = jeu.trouver(c);
    if (!n) syntaxe(fichier, ligne, `Could not open configuration file ${c}: No such file or directory`);
    return c;
  };
  if (!/[*?[]/.test(chemin)) {
    if (!jeu.trouver(chemin) && optionnel) return [];
    return [ouvrir(chemin)];
  }
  const dossier = chemin.slice(0, chemin.lastIndexOf('/')) || '/';
  const motifNom = chemin.slice(chemin.lastIndexOf('/') + 1);
  const n = jeu.trouver(dossier);
  if (!n || n.type !== 'dossier') {
    if (optionnel) return [];
    return syntaxe(fichier, ligne, `Could not open config directory ${dossier}: No such file or directory`);
  }
  const re = joker(motifNom);
  const trouves = Object.keys(n.enfants)
    .filter((nom) => re.test(nom))
    .sort()
    .map((nom) => `${dossier}/${nom}`);
  if (!trouves.length && !optionnel) syntaxe(fichier, ligne, `No matches for the wildcard '${motifNom}' in '${dossier}', failing`);
  return trouves.map(ouvrir);
}

// ——— Configuration chargée ———

export interface Adresse {
  // « * » (toutes), ou une adresse.
  ip: string;
  port: number | '*';
}

export interface Reecriture {
  // RewriteEngine On/Off ; undefined : pas dit à ce niveau (hérité).
  moteur?: boolean;
  regles: Ligne[];
  base?: string;
  // Le lieu (répertoire) des règles par répertoire.
  dossier?: string;
}

export interface Section {
  type: string;
  motif: string;
  regex?: RegExp;
  lignes: Ligne[];
}

export interface Hote {
  adresses: Adresse[];
  nom?: string;
  alias: string[];
  racine?: string;
  journal?: string;
  admin?: string;
  fichier: string;
  ligne: number;
  sections: Section[];
  reecriture: Reecriture;
  // Les directives hors section (DirectoryIndex, Options… au niveau du serveur ou de l'hôte).
  lignes: Ligne[];
}

export interface Configuration {
  modules: string[];
  ecoutes: { ip: string; port: number }[];
  principal: Hote;
  hotes: Hote[];
  // ServerName au niveau global (sinon : AH00558).
  nomGlobal?: string;
  avertissements: string[];
  fichierAcces: string;
}

const val = (lignes: Ligne[], nom: string) => lignes.filter((l) => l.nom === nom).at(-1)?.args;
const sections = (lignes: Ligne[]): Section[] =>
  lignes
    .filter((l) => l.enfants && l.nom !== 'VirtualHost')
    .map((l) => {
      const match = l.nom.endsWith('Match') || l.args[0] === '~';
      const motif = l.args[0] === '~' ? (l.args[1] ?? '') : (l.args[0] ?? '');
      let regex: RegExp | undefined;
      if (match)
        try {
          regex = new RegExp(motif);
        } catch {
          syntaxe(l.fichier, l.ligne, `Regex could not be compiled`);
        }
      const type = l.nom.replace(/Match$/, '');
      return { type, motif: type === 'Directory' && !match ? motif.replace(/\/+$/, '') || '/' : motif, regex, lignes: l.enfants! };
    });

// Les règles de réécriture d'un niveau (serveur, hôte, section, .htaccess).
function reecritureDe(lignes: Ligne[], dossier?: string): Reecriture {
  const moteur = val(lignes, 'RewriteEngine');
  return {
    moteur: moteur ? /^on$/i.test(moteur[0]) : undefined,
    regles: lignes.filter((l) => l.nom === 'RewriteRule' || l.nom === 'RewriteCond'),
    base: val(lignes, 'RewriteBase')?.[0],
    dossier,
  };
}

// « *:80 », « 127.0.0.1:8080 », « _default_:443 », « [::1]:80 » → adresse et port.
function lireAdresse(texte: string): Adresse {
  const m = /^(\[[^\]]+\]|[^:]+)(?::(\d+|\*))?$/.exec(texte);
  const ip = !m || m[1] === '_default_' ? '*' : m[1];
  const port = m?.[2] === undefined || m[2] === '*' ? '*' : Number(m[2]);
  return { ip, port };
}

function hote(lignes: Ligne[], fichier: string, ligne: number, adresses: Adresse[]): Hote {
  return {
    adresses,
    nom: val(lignes, 'ServerName')?.[0]?.replace(/^https?:\/\//, '').replace(/:\d+$/, '').toLowerCase(),
    alias: lignes.filter((l) => l.nom === 'ServerAlias').flatMap((l) => l.args.map((a) => a.toLowerCase())),
    racine: val(lignes, 'DocumentRoot')?.[0]?.replace(/\/+$/, ''),
    journal: val(lignes, 'ErrorLog')?.[0],
    admin: val(lignes, 'ServerAdmin')?.[0],
    fichier,
    ligne,
    sections: sections(lignes),
    reecriture: reecritureDe(lignes),
    lignes: lignes.filter((l) => !l.enfants),
  };
}

// Listen 80 → toutes les adresses (IPv6 et IPv4), Listen 127.0.0.1:8080 → une seule.
function ecoutes(lignes: Ligne[]): { ip: string; port: number }[] {
  return lignes
    .filter((l) => l.nom === 'Listen')
    .map((l) => {
      const a = l.args[0];
      if (/^\d+$/.test(a)) return { ip: '*', port: Number(a) };
      const m = /^(\[[^\]]+\]|[^:]+):(\d+)$/.exec(a);
      if (!m) syntaxe(l.fichier, l.ligne, `Port must be specified`);
      return { ip: m![1], port: Number(m![2]) };
    });
}

/** Lit et vérifie toute la configuration ; lève une ErreurApache. */
export function construire(jeu: Jeu): Configuration {
  if (!jeu.trouver(CONF)) throw new ErreurApache(`apache2: Could not open configuration file ${CONF}: No such file or directory`);
  const lecture: Lecture = { modules: [], definis: new Set(), avertissements: [] };
  const lignes = lireFichier(jeu, CONF, 'S', lecture);
  const principal = hote(lignes, CONF, 0, []);
  principal.racine ??= '/var/www/html';
  principal.journal ??= `${ENV.APACHE_LOG_DIR}/error.log`;
  principal.admin ??= '[no address given]';
  const hotes = lignes
    .filter((l) => l.nom === 'VirtualHost')
    .map((v) => {
      if (!v.args.length) syntaxe(v.fichier, v.ligne, '<VirtualHost> directive requires additional arguments');
      return hote(v.enfants!, v.fichier, v.ligne, v.args.map(lireAdresse));
    });
  const avertissements = [...lecture.avertissements];
  for (const h of [principal, ...hotes])
    if (h.racine && jeu.trouver(h.racine)?.type !== 'dossier') avertissements.push(`AH00112: Warning: DocumentRoot [${h.racine}] does not exist`);
  const liste = ecoutes(lignes);
  if (!liste.length) throw new ErreurApache('no listening sockets available, shutting down\nAH00015: Unable to open logs');
  return {
    modules: [...STATIQUES, ...lecture.modules],
    ecoutes: liste,
    principal,
    hotes,
    nomGlobal: val(lignes, 'ServerName')?.[0],
    avertissements,
    fichierAcces: val(lignes, 'AccessFileName')?.[0] ?? '.htaccess',
  };
}

/** La configuration, ou l'erreur : comme apache2ctl configtest. */
export function tester(jeu: Jeu): { config: Configuration; erreur: null } | { config: null; erreur: string } {
  try {
    return { config: construire(jeu), erreur: null };
  } catch (e) {
    if (e instanceof ErreurApache) return { config: null, erreur: e.message };
    throw e;
  }
}

// Sans ServerName global, Apache le dit à chaque lecture de la configuration.
export const AH00558 =
  "AH00558: apache2: Could not reliably determine the server's fully qualified domain name, using 127.0.1.1. Set the 'ServerName' directive globally to suppress this message";

// ——— Démarrage : les adresses d'écoute ———

const boucle = (ip: string) => ip === '127.0.0.1' || ip === '[::1]' || ip === 'localhost';

// Les sockets qu'Apache ouvre pour Listen (comme ss les montre).
function sockets(config: Configuration): Ecoute[] {
  return config.ecoutes.map((e) => ({ proto: 'tcp' as const, adresse: e.ip, port: e.port, processus: 'apache2', pid: PID }));
}

// Une adresse déjà prise par un autre programme (etat.ecoute) : l'erreur d'Apache.
function prises(jeu: Jeu, config: Configuration): string[] {
  const autres = ((jeu.etat.ecoute ?? []) as Ecoute[]).filter((e) => e.processus !== 'apache2' && e.proto === 'tcp');
  const chevauche = (ip: string, port: number, e: Ecoute) =>
    e.port === port &&
    (ip === '*' || e.adresse === ip || e.adresse === '0.0.0.0' || e.adresse === '*' || (e.adresse === '[::]' && ip.startsWith('[')));
  const messages: string[] = [];
  for (const { ip, port } of config.ecoutes) {
    if (!autres.some((e) => chevauche(ip, port, e))) continue;
    // Listen 80 : Apache essaie [::]:80 puis 0.0.0.0:80.
    const essais = ip === '*' ? [`[::]:${port}`, `0.0.0.0:${port}`] : [`${ip}:${port}`];
    for (const a of essais) messages.push(`(98)Address already in use: AH00072: make_sock: could not bind to address ${a}`);
  }
  return messages;
}

/** Pour systemd : les messages d'apachectl quand Apache ne démarre pas (null s'il démarre). */
export function verifierApache(jeu: Jeu): string[] | null {
  const res = tester(jeu);
  if (!res.config) return [...res.erreur.split('\n'), "Action 'start' failed.", 'The Apache error log may have more information.'];
  const avant = [...res.config.avertissements, ...(res.config.nomGlobal ? [] : [AH00558])];
  const occupe = prises(jeu, res.config);
  if (!occupe.length) return null;
  return [...avant, ...occupe, 'no listening sockets available, shutting down', 'AH00015: Unable to open logs', "Action 'start' failed.", 'The Apache error log may have more information.'];
}

// [Fri Nov 20 10:02:03.123456 2026] : l'heure des journaux d'Apache.
const JOURS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MOIS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const heureApache = (ms: number) => {
  const d = new Date(ms);
  return `${JOURS[d.getUTCDay()]} ${MOIS[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2, '0')} ${d.toISOString().slice(11, 19)}.${String(100000 + (ms % 900000)).slice(0, 6)} ${d.getUTCFullYear()}`;
};

// Une ligne dans un journal d'erreurs d'Apache (le fichier doit exister).
function journaliser(jeu: Jeu, fichier: string, niveau: string, message: string, client?: string) {
  const n = jeu.trouver(fichier);
  if (n?.type !== 'fichier' || typeof n.contenu !== 'string') return;
  const tid = niveau.startsWith('mpm') || niveau.startsWith('core:notice') ? PID : 140237;
  const ligne = `[${heureApache(systemd(jeu)?.horloge ?? 0)}] [${niveau}] [pid ${client ? PID + 1 : PID}:tid ${client ? 140237 : tid}] ${client ? `[client ${client}] ` : ''}${message}`;
  n.contenu = n.contenu ? `${n.contenu}\n${ligne}` : ligne;
}

/** Au démarrage et au rechargement : la configuration lue devient celle qui sert, sur ses adresses. */
export function chargerApache(jeu: Jeu) {
  const config = tester(jeu).config;
  const ancien = jeu.etat.apache?.charge as Configuration | null | undefined;
  jeu.etat.apache = { ...(jeu.etat.apache ?? {}), charge: config };
  if (!config) return;
  // ss : les sockets d'Apache remplacent les anciennes.
  jeu.etat.ecoute = [...((jeu.etat.ecoute ?? []) as Ecoute[]).filter((e) => e.processus !== 'apache2'), ...sockets(config)];
  // nginx et curl joignent Apache sur 127.0.0.1 : une « appli » par port d'écoute.
  const applis: Record<string, Appli> = (jeu.etat.applis ??= {});
  for (const [cle, a] of Object.entries(applis)) if (a.service === 'apache2') delete applis[cle];
  for (const { ip, port } of config.ecoutes)
    if (ip === '*' || ip === '0.0.0.0' || ip === '127.0.0.1')
      applis[`127.0.0.1:${port}`] = { service: 'apache2', pages: {}, repondre: (j, chemin, demande) => repondre(j, port, chemin, demande) };
  const journal = config.principal.journal!;
  if (ancien) journaliser(jeu, journal, 'mpm_event:notice', 'AH00493: SIGUSR1 received.  Doing graceful restart');
  journaliser(jeu, journal, 'mpm_event:notice', `AH00489: ${SIGNATURE} configured -- resuming normal operations`);
  journaliser(jeu, journal, 'core:notice', "AH00094: Command line: '/usr/sbin/apache2'");
}

/** À l'arrêt : plus de sockets, plus de configuration servie. */
export function arreterApache(jeu: Jeu) {
  jeu.etat.ecoute = ((jeu.etat.ecoute ?? []) as Ecoute[]).filter((e) => e.processus !== 'apache2');
  const journal = (jeu.etat.apache?.charge as Configuration | null)?.principal.journal;
  if (journal) journaliser(jeu, journal, 'mpm_event:notice', 'AH00491: caught SIGTERM, shutting down');
  jeu.etat.apache = { ...(jeu.etat.apache ?? {}), charge: null };
}

// ——— Requêtes ———

const RAISONS: Record<number, string> = {
  200: 'OK',
  301: 'Moved Permanently',
  302: 'Found',
  403: 'Forbidden',
  404: 'Not Found',
  410: 'Gone',
  500: 'Internal Server Error',
};
const TEXTES: Record<number, (lien: string, admin: string) => string> = {
  301: (lien) => `<p>The document has moved <a href="${lien}">here</a>.</p>`,
  302: (lien) => `<p>The document has moved <a href="${lien}">here</a>.</p>`,
  403: () => "<p>You don't have permission to access this resource.</p>",
  404: () => '<p>The requested URL was not found on this server.</p>',
  410: () =>
    '<p>The requested resource is no longer available on this server and there is no forwarding address.\nPlease remove all references to this resource.</p>',
  500: (_, admin) =>
    `<p>The server encountered an internal error or\nmisconfiguration and was unable to complete\nyour request.</p>\n<p>Please contact the server administrator at \n ${admin} to inform them of the time this error occurred,\n and the actions you performed just before this error.</p>\n<p>More information about this error may be available\nin the server error log.</p>`,
};

export interface ReponseApache {
  code: number;
  corps: string;
  type?: string;
  entetes?: string[];
}

// Ce que la requête a trouvé : l'hôte virtuel qui la sert, et l'adresse qu'il donne dans ses pages.
interface Contexte {
  config: Configuration;
  hote: Hote;
  nom: string;
  port: number;
  client: string;
  trace: boolean;
}

const pageErreur = (c: Contexte, code: number, lien = ''): ReponseApache => ({
  code,
  type: 'text/html; charset=iso-8859-1',
  corps: `<!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML 2.0//EN">\n<html><head>\n<title>${code} ${RAISONS[code]}</title>\n</head><body>\n<h1>${RAISONS[code]}</h1>\n${TEXTES[code](lien, c.hote.admin ?? c.config.principal.admin!)}\n<hr>\n<address>${SIGNATURE} Server at ${c.nom} Port ${c.port}</address>\n</body></html>`,
  entetes: [`Server: ${SIGNATURE}`, ...(lien ? [`Location: ${lien}`] : [])],
});

const correspond = (a: Adresse, ip: string, port: number) => (a.port === '*' || a.port === port) && (a.ip === '*' || a.ip === ip);

/** L'hôte virtuel qui sert une connexion (adresse, port) pour ce nom : d'abord l'adresse, puis le nom, sinon le premier. */
export function choisirHote(config: Configuration, ip: string, port: number, nom: string): Hote {
  const exacts = config.hotes.filter((h) => h.adresses.some((a) => a.ip !== '*' && correspond(a, ip, port)));
  const candidats = exacts.length ? exacts : config.hotes.filter((h) => h.adresses.some((a) => a.ip === '*' && correspond(a, ip, port)));
  if (!candidats.length) return config.principal;
  const n = nom.toLowerCase();
  return candidats.find((h) => h.nom === n || h.alias.some((a) => joker(a).test(n))) ?? candidats[0];
}

// Les réglages fusionnés pour un fichier : sections <Directory>, .htaccess, <Files>, <Location>.
interface Reglages {
  surcharges: Set<string>;
  refuse?: boolean;
  index: string[];
  listes: boolean;
  reecriture: Reecriture;
}

// AllowOverride All, None, ou une liste de catégories.
function lireSurcharges(args: string[]): Set<string> {
  if (args.some((a) => /^all$/i.test(a))) return new Set(['AuthConfig', 'FileInfo', 'Indexes', 'Limit', 'Options']);
  if (args.some((a) => /^none$/i.test(a))) return new Set();
  return new Set(args.map((a) => a.replace(/=.*$/, '')).map((a) => ['AuthConfig', 'FileInfo', 'Indexes', 'Limit', 'Options'].find((c) => c.toLowerCase() === a.toLowerCase()) ?? a));
}

function appliquer(r: Reglages, lignes: Ligne[], dossier?: string) {
  for (const l of lignes) {
    if (l.nom === 'AllowOverride') r.surcharges = lireSurcharges(l.args);
    else if (l.nom === 'Require') {
      const a = l.args.join(' ').toLowerCase();
      if (a === 'all denied') r.refuse = true;
      else if (a === 'all granted') r.refuse = false;
    } else if (l.nom === 'DirectoryIndex') r.index = l.args.filter((a) => a.toLowerCase() !== 'disabled');
    else if (l.nom === 'Options') {
      for (const o of l.args) {
        if (/^[+]?indexes$/i.test(o) || /^all$/i.test(o)) r.listes = true;
        else if (/^-indexes$/i.test(o) || /^none$/i.test(o)) r.listes = false;
      }
      // Options sans + ni - remplace toute la liste.
      if (l.args.every((o) => !/^[+-]/.test(o)) && !l.args.some((o) => /^(indexes|all)$/i.test(o))) r.listes = false;
    }
  }
  // mod_rewrite, par répertoire : l'état (On/Off) s'hérite, les règles non
  // (celles du niveau le plus profond remplacent celles du dessus).
  if (dossier !== undefined) {
    const n = reecritureDe(lignes, dossier);
    r.reecriture = { moteur: n.moteur ?? r.reecriture.moteur, regles: n.regles, base: n.base, dossier };
  }
}

// Lire un .htaccess comme Apache : chaque directive doit être connue, et permise par AllowOverride.
function lireHtaccess(jeu: Jeu, chemin: string, surcharges: Set<string>, modules: string[]): Ligne[] {
  const lecture: Lecture = { modules: modules.filter((m) => !STATIQUES.includes(m)), definis: new Set(), avertissements: [] };
  const lignes = lireFichier(jeu, chemin, 'H', lecture, jeu.lire(chemin) ?? '');
  const verifier = (liste: Ligne[]) => {
    for (const l of liste) {
      const cat = DIRECTIVES[l.nom]?.surcharge;
      if (cat && cat !== 'All' && !surcharges.has(cat)) throw new ErreurApache(`${chemin}: ${l.nom} not allowed here`);
      if (l.enfants) verifier(l.enfants);
    }
  };
  verifier(lignes);
  return lignes;
}

const dirname = (chemin: string) => chemin.slice(0, chemin.lastIndexOf('/')) || '/';

/** Les réglages qui s'appliquent à un fichier (null : un .htaccess illisible, l'erreur au journal). */
function reglagesPour(jeu: Jeu, c: Contexte, fichier: string, url: string): Reglages | { erreur: string } {
  // Par défaut (Apache 2.4) : AllowOverride None ; puis le serveur, puis l'hôte virtuel.
  const r: Reglages = { surcharges: new Set(), index: ['index.html'], listes: true, reecriture: { regles: [] } };
  appliquer(r, c.config.principal.lignes);
  if (c.hote !== c.config.principal) appliquer(r, c.hote.lignes);
  const toutes = [...c.config.principal.sections, ...c.hote.sections];
  // Les répertoires du chemin, de / au plus profond qui existe.
  const parties = fichier.split('/').filter(Boolean);
  const dossiers = ['/'];
  for (let i = 1; i <= parties.length; i++) {
    const d = '/' + parties.slice(0, i).join('/');
    if (jeu.trouver(d)?.type !== 'dossier') break;
    dossiers.push(d);
  }
  for (const d of dossiers) {
    for (const s of toutes.filter((s) => s.type === 'Directory' && !s.regex && s.motif === d)) appliquer(r, s.lignes, d);
    if (!r.surcharges.size) continue;
    const ht = `${d === '/' ? '' : d}/${c.config.fichierAcces}`;
    if (jeu.trouver(ht)?.type !== 'fichier') continue;
    try {
      appliquer(r, lireHtaccess(jeu, ht, r.surcharges, c.config.modules), d);
    } catch (e) {
      if (e instanceof ErreurApache) return { erreur: e.message.replace(/^AH00526: Syntax error on line \d+ of ([^:]+):\n/, '$1: ') };
      throw e;
    }
  }
  const dossier = dossiers.at(-1)!;
  for (const s of toutes.filter((s) => s.type === 'Directory' && s.regex?.test(dossier))) appliquer(r, s.lignes, dossier);
  const base = fichier.slice(fichier.lastIndexOf('/') + 1);
  for (const s of toutes.filter((s) => s.type === 'Files' && (s.regex ? s.regex.test(base) : joker(s.motif).test(base)))) appliquer(r, s.lignes);
  for (const s of toutes.filter((s) => s.type === 'Location' && (s.regex ? s.regex.test(url) : url.startsWith(s.motif)))) appliquer(r, s.lignes);
  return r;
}

// Une règle de mod_rewrite : [motif, cible, drapeaux] et ses conditions.
interface Resultat {
  chemin?: string;
  requete?: string;
  code?: number;
  lien?: string;
  fin?: boolean;
}

function drapeaux(texte: string | undefined): Record<string, string> {
  const d: Record<string, string> = {};
  for (const f of (texte ?? '').replace(/^\[|\]$/g, '').split(',').filter(Boolean)) {
    const [n, v = ''] = f.split('=');
    d[n.trim().toUpperCase()] = v;
  }
  return d;
}

/** Applique les règles (contexte serveur : sur l'URL ; par répertoire : sur le chemin sans le préfixe du répertoire). */
function reecrire(
  jeu: Jeu,
  regles: Ligne[],
  sujet: string,
  variables: Record<string, string>,
  versUrl: (cible: string) => string,
): Resultat | null {
  let conditions: { test: string; motif: string; drapeaux: Record<string, string> }[] = [];
  let actuel = sujet;
  let change: Resultat | null = null;
  for (const l of regles) {
    if (l.nom === 'RewriteCond') {
      conditions.push({ test: l.args[0] ?? '', motif: l.args[1] ?? '', drapeaux: drapeaux(l.args[2]) });
      continue;
    }
    const [motif, cible, d] = [l.args[0], l.args[1], drapeaux(l.args[2])];
    const conds = conditions;
    conditions = [];
    const non = motif.startsWith('!');
    let m: RegExpExecArray | null;
    try {
      m = new RegExp(motif.replace(/^!/, ''), 'NC' in d ? 'i' : '').exec(actuel);
    } catch {
      continue;
    }
    if (non ? m : !m) continue;
    // Les conditions (toutes, ou l'une avec [OR]) ; %1 renvoie à la dernière qui a réussi.
    let dernier: RegExpExecArray | null = null;
    let ok = true;
    for (let i = 0; i < conds.length; i++) {
      const c = conds[i];
      const valeur = c.test.replace(/%\{([A-Z_:]+)\}/g, (_, v: string) => variables[v] ?? '');
      const negation = c.motif.startsWith('!');
      const p = c.motif.replace(/^!/, '');
      let vrai: boolean;
      if (p === '-f') vrai = jeu.trouver(valeur)?.type === 'fichier';
      else if (p === '-d') vrai = jeu.trouver(valeur)?.type === 'dossier';
      else if (p === '-s') vrai = (jeu.lire(valeur) ?? '').length > 0;
      else if (p.startsWith('=')) vrai = valeur === p.slice(1);
      else {
        const r = new RegExp(p, 'NC' in c.drapeaux ? 'i' : '').exec(valeur);
        vrai = !!r;
        if (r && !negation) dernier = r;
      }
      if (negation) vrai = !vrai;
      if ('OR' in c.drapeaux) {
        if (vrai) {
          // Les conditions liées par [OR] : une suffit, on saute les suivantes du groupe.
          while (i < conds.length - 1 && 'OR' in conds[i].drapeaux) i++;
          continue;
        }
        if (i < conds.length - 1) continue;
      }
      if (!vrai) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    if ('F' in d) return { code: 403 };
    if ('G' in d) return { code: 410 };
    if (cible !== '-') {
      const remplie = cible.replace(/\$(\d)/g, (_, n: string) => m?.[Number(n)] ?? '').replace(/%(\d)/g, (_, n: string) => dernier?.[Number(n)] ?? '');
      const [chemin, requete] = remplie.split('?');
      if ('R' in d) {
        const absolu = /^https?:\/\//.test(chemin) ? chemin : null;
        return { code: Number(d.R) || 302, lien: absolu ?? versUrl(chemin) + (requete !== undefined ? `?${requete}` : ''), fin: true };
      }
      actuel = chemin;
      change = { chemin, requete: requete !== undefined ? requete + ('QSA' in d && variables.QUERY_STRING ? `&${variables.QUERY_STRING}` : '') : undefined, fin: 'END' in d };
    }
    if ('L' in d || 'END' in d) break;
  }
  return change;
}

const pageListe = (url: string, noms: string[]) =>
  `<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 3.2 Final//EN">\n<html>\n <head>\n  <title>Index of ${url}</title>\n </head>\n <body>\n<h1>Index of ${url}</h1>\n<ul>${noms.map((n) => `<li><a href="${n}"> ${n}</a></li>`).join('\n')}</ul>\n</body></html>`;

/**
 * Une requête vers Apache, sur 127.0.0.1:port : null si Apache n'écoute pas
 * là. `demande` porte les en-têtes reçus (Host choisit l'hôte virtuel).
 */
export function repondre(jeu: Jeu, port: number, chemin: string, demande: Demande = { entetes: {}, adresse: '127.0.0.1' }): ReponseApache {
  const config: Configuration = jeu.etat.apache.charge;
  const hoteDemande = demande.entetes.host ?? `127.0.0.1:${port}`;
  const nom = hoteDemande.replace(/:\d+$/, '');
  const portVu = Number(/:(\d+)$/.exec(hoteDemande)?.[1] ?? port);
  const h = choisirHote(config, '127.0.0.1', port, nom);
  const c: Contexte = { config, hote: h, nom, port: portVu, client: `${demande.adresse}:${41200 + (port % 100)}`, trace: demande.trace !== false };
  const journal = h.journal ?? config.principal.journal!;
  const alerte = (niveau: string, message: string) => c.trace && journaliser(jeu, journal, niveau, message, c.client);
  const racine = (h.racine ?? config.principal.racine!).replace(/\/+$/, '');
  let [url, requete] = chemin.split('?');
  url = url || '/';
  const variables = (fichier: string) => ({
    REQUEST_URI: url,
    REQUEST_FILENAME: fichier,
    HTTP_HOST: hoteDemande,
    QUERY_STRING: requete ?? '',
    HTTPS: 'off',
    DOCUMENT_ROOT: racine,
    SERVER_NAME: h.nom ?? nom,
  });
  const lien = (cible: string) => `http://${hoteDemande}${cible.startsWith('/') ? cible : `/${cible}`}`;
  // Le contexte serveur (RewriteEngine dans le VirtualHost) : une seule fois, sur l'URL.
  if (h.reecriture.moteur && h.reecriture.regles.length) {
    const r = reecrire(jeu, h.reecriture.regles, url, variables(racine + url), lien);
    if (r?.code) return pageErreur(c, r.code, r.lien);
    if (r?.chemin) {
      url = r.chemin.startsWith('/') ? r.chemin : `/${r.chemin}`;
      if (r.requete !== undefined) requete = r.requete;
    }
  }
  // Une redirection interne (règle par répertoire) recommence le traitement ; au plus 10 fois.
  let fini = false;
  for (let tour = 0; tour <= 10; tour++) {
    const fichier = racine + url;
    const r = reglagesPour(jeu, c, fichier.replace(/\/+$/, '') || '/', url);
    if ('erreur' in r) {
      alerte('core:alert', r.erreur);
      return pageErreur(c, 500);
    }
    const rr = r.reecriture;
    if (!fini && rr.moteur && rr.regles.length && rr.dossier) {
      // Le chemin, sans le répertoire des règles (ni barre au début).
      const prefixe = rr.dossier === '/' ? '/' : `${rr.dossier}/`;
      const sujet = fichier.startsWith(prefixe) ? fichier.slice(prefixe.length) : fichier === rr.dossier ? '' : null;
      if (sujet !== null) {
        const urlDuDossier = rr.base ?? (rr.dossier.startsWith(racine) ? rr.dossier.slice(racine.length) || '/' : '/');
        const versUrl = (cible: string) => (cible.startsWith('/') ? cible : `${urlDuDossier.replace(/\/?$/, '/')}${cible}`);
        const res = reecrire(jeu, rr.regles, sujet, variables(fichier), (cible) => lien(versUrl(cible)));
        if (res?.code) return pageErreur(c, res.code, res.lien);
        if (res?.chemin) {
          const suivant = versUrl(res.chemin);
          if (res.requete !== undefined) requete = res.requete;
          fini = !!res.fin;
          if (suivant !== url) {
            if (tour === 10) {
              alerte(
                'core:error',
                "AH00124: Request exceeded the limit of 10 internal redirects due to probable configuration error. Use 'LimitInternalRecursion' to increase the limit if necessary. Use 'LogLevel debug' to get a backtrace.",
              );
              return pageErreur(c, 500);
            }
            url = suivant;
            continue;
          }
        }
      }
    }
    if (r.refuse) {
      alerte('authz_core:error', `AH01630: client denied by server configuration: ${fichier}`);
      return pageErreur(c, 403);
    }
    const n = jeu.trouver(fichier);
    if (!n) return pageErreur(c, 404);
    if (n.type === 'dossier') {
      // mod_dir : un répertoire sans barre finale est redirigé vers l'adresse avec la barre.
      if (!url.endsWith('/')) return pageErreur(c, 301, lien(`${url}/`));
      const index = r.index.find((i) => jeu.trouver(`${fichier}${i}`)?.type === 'fichier');
      if (index) {
        url += index;
        continue;
      }
      if (r.listes && config.modules.includes('autoindex'))
        return { code: 200, corps: pageListe(url, Object.keys(n.enfants).sort()), type: 'text/html;charset=UTF-8', entetes: [`Server: ${SIGNATURE}`] };
      alerte(
        'autoindex:error',
        `AH01276: Cannot serve directory ${fichier}: No matching DirectoryIndex (${r.index.join(',')}) found, and server-generated directory index forbidden by Options directive`,
      );
      return pageErreur(c, 403);
    }
    if (!jeu.peut(n, 'r', 'www-data')) {
      alerte('core:error', `(13)Permission denied: AH00132: file permissions deny server access: ${fichier}`);
      return pageErreur(c, 403);
    }
    const corps = typeof n.contenu === 'function' ? n.contenu(jeu) : n.contenu;
    return { code: 200, corps, type: 'text/html', entetes: [`Server: ${SIGNATURE}`] };
  }
  return pageErreur(c, 500);
}

/** Pour les vérifications du jeu : ce qu'Apache répond (sans rien écrire au journal), null s'il n'écoute pas sur ce port. */
export function demander(jeu: Jeu, port: number, chemin: string, hote: string): ReponseApache | null {
  const appli: Appli | undefined = jeu.etat.applis?.[`127.0.0.1:${port}`];
  if (!appli || appli.service !== 'apache2' || systemd(jeu)?.services.apache2?.etat !== 'active' || !jeu.etat.apache?.charge) return null;
  return repondre(jeu, port, chemin, { entetes: { host: hote }, adresse: '127.0.0.1', trace: false });
}

/** Les adresses où Apache écoute (pour vérifier qu'il reste sur la boucle locale). */
export const ecoutesApache = (jeu: Jeu): { ip: string; port: number }[] =>
  systemd(jeu)?.services.apache2?.etat === 'active' ? ((jeu.etat.apache?.charge as Configuration | null)?.ecoutes ?? []) : [];
export const seulementLocal = (jeu: Jeu) => ecoutesApache(jeu).length > 0 && ecoutesApache(jeu).every((e) => boucle(e.ip));

// ——— apache2ctl -S et -M ———

const affiche = (a: Adresse) => `${a.ip}:${a.port}`;

/** apache2ctl -S : les hôtes virtuels, par adresse, puis le reste de la configuration. */
export function vhosts(config: Configuration): string {
  const nomDe = (h: Hote) => h.nom ?? config.nomGlobal ?? '127.0.1.1';
  const parAdresse = new Map<string, Hote[]>();
  for (const h of config.hotes)
    for (const a of h.adresses) {
      const k = affiche(a);
      parAdresse.set(k, [...(parAdresse.get(k) ?? []), h]);
    }
  const lignes = ['VirtualHost configuration:'];
  for (const [adresse, liste] of parAdresse) {
    const port = adresse.split(':').at(-1);
    const ou = (h: Hote) => `(${h.fichier}:${h.ligne})`;
    if (liste.length === 1) {
      lignes.push(`${adresse.padEnd(22)} ${nomDe(liste[0])} ${ou(liste[0])}`);
      continue;
    }
    lignes.push(`${adresse.padEnd(22)} is a NameVirtualHost`, `         default server ${nomDe(liste[0])} ${ou(liste[0])}`);
    for (const h of liste) {
      lignes.push(`         port ${port} namevhost ${nomDe(h)} ${ou(h)}`);
      for (const a of h.alias) lignes.push(`                 alias ${a}`);
    }
  }
  lignes.push(
    `ServerRoot: "${RACINE}"`,
    `Main DocumentRoot: "${config.principal.racine}"`,
    `Main ErrorLog: "${config.principal.journal}"`,
    'Mutex watchdog-callback: using_defaults',
    'Mutex default: dir="/var/run/apache2/" mechanism=default ',
    `PidFile: "${ENV.APACHE_PID_FILE}"`,
    'Define: DUMP_VHOSTS',
    'Define: DUMP_RUN_CFG',
    'User: name="www-data" id=33',
    'Group: name="www-data" id=33',
  );
  return lignes.join('\n');
}

/** apache2ctl -M : les modules chargés, dans l'ordre. */
export const modulesCharges = (config: Configuration) =>
  ['Loaded Modules:', ...config.modules.map((m) => ` ${m}_module (${STATIQUES.includes(m) ? 'static' : 'shared'})`)].join('\n');
