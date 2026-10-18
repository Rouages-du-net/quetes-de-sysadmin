// nginx simulé : la configuration lue comme nginx la lit (nginx.conf et ses
// include, directives terminées par « ; », blocs entre accolades), vérifiée
// comme `nginx -t`, puis appliquée au démarrage et au rechargement (comme
// sshd.ts). curl interroge ensuite la configuration chargée.
// D'après la documentation de nginx : https://nginx.org/en/docs/switches.html
// (ligne de commande), https://nginx.org/en/docs/http/ngx_http_core_module.html
// (listen, server_name, root, index) et https://nginx.org/en/docs/http/request_processing.html
// (choix du serveur : le nom demandé, sinon le serveur par défaut du port).
// Écarts : une partie des directives seulement, pas de location ni de
// redirection (root et index suffisent), ports en HTTP seulement.

import type { Jeu } from './shell';
import { joker } from './outils';
import { heureEte, systemd, versUtc } from './systemd';
import { lire as lireCertificat } from './tls';

export const VERSION = '1.26.3';
export const CONF = '/etc/nginx/nginx.conf';
const PREFIXE = '/etc/nginx';

// Les directives connues : nombre d'arguments (min, max) et blocs autorisés
// (main = hors de tout bloc). Un bloc « types » contient des types MIME, pas
// des directives.
type Regle = { min: number; max: number; dans: string[]; bloc?: boolean };
const r = (min: number, max: number, dans: string[], bloc = false): Regle => ({ min, max, dans, bloc });
const PARTOUT = ['main', 'events', 'http', 'server', 'location'];
const HTTP = ['http', 'server', 'location'];
const DIRECTIVES: Record<string, Regle> = {
  user: r(1, 2, ['main']),
  worker_processes: r(1, 1, ['main']),
  pid: r(1, 1, ['main']),
  error_log: r(1, 2, PARTOUT),
  include: r(1, 1, PARTOUT),
  events: r(0, 0, ['main'], true),
  worker_connections: r(1, 1, ['events']),
  http: r(0, 0, ['main'], true),
  sendfile: r(1, 1, HTTP),
  tcp_nopush: r(1, 1, HTTP),
  types_hash_max_size: r(1, 1, HTTP),
  types: r(0, 0, HTTP, true),
  default_type: r(1, 1, HTTP),
  ssl_protocols: r(1, 9, ['http', 'server']),
  ssl_prefer_server_ciphers: r(1, 1, ['http', 'server']),
  ssl_certificate: r(1, 1, ['http', 'server']),
  ssl_certificate_key: r(1, 1, ['http', 'server']),
  access_log: r(1, 3, HTTP),
  gzip: r(1, 1, HTTP),
  server_tokens: r(1, 1, HTTP),
  server: r(0, 0, ['http'], true),
  listen: r(1, 9, ['server']),
  server_name: r(1, 99, ['server']),
  root: r(1, 1, HTTP),
  index: r(1, 99, HTTP),
  location: r(1, 2, ['server', 'location'], true),
  try_files: r(2, 99, ['server', 'location']),
  return: r(1, 2, ['server', 'location']),
  allow: r(1, 1, HTTP),
  alias: r(1, 1, ['location']),
  proxy_pass: r(1, 1, ['location']),
  proxy_set_header: r(2, 2, HTTP),
  proxy_http_version: r(1, 1, HTTP),
  limit_req_zone: r(3, 4, ['http']),
  limit_req: r(1, 3, HTTP),
  limit_req_status: r(1, 1, HTTP),
  deny: r(1, 1, HTTP),
  upstream: r(1, 1, ['http'], true),
  keepalive: r(1, 1, ['upstream']),
  least_conn: r(0, 0, ['upstream']),
};
// Dans un bloc upstream, server est une simple directive : server adresse [weight=N] [backup] [down]…
const SERVEUR_AMONT = r(1, 9, ['upstream']);

interface Directive {
  nom: string;
  args: string[];
  fichier: string;
  ligne: number;
  enfants?: Directive[];
}

// Un bloc location : le préfixe (ou le chemin exact, avec =) et ce qu'on y fait.
export interface Location {
  exact: boolean;
  chemin: string;
  racine?: string;
  alias?: string;
  index?: string[];
  proxy?: string;
  retour?: string[];
  limite?: Limite;
  refus: string[];
  limiteStatut?: number;
}

// limit_req : la zone (clé et débit) et la rafale tolérée.
export interface Limite {
  zone: string;
  rafale: number;
  sansDelai: boolean;
}

export interface ZoneLimite {
  // La clé : $binary_remote_addr (une par adresse), ou autre chose.
  cle: string;
  // Requêtes par seconde.
  debit: number;
}

export interface Serveur {
  // Adresses d'écoute (« 0.0.0.0:80 », « [::]:80 ») ; celles où il est le serveur par défaut.
  ecoute: string[];
  parDefaut: string[];
  noms: string[];
  racine: string;
  index: string[];
  refus: string[];
  // Adresses en HTTPS (listen … ssl) et le certificat lu au chargement :
  // renouveler le fichier ne change rien tant que nginx n'a pas rechargé.
  ssl: string[];
  certificat: string | null;
  locations: Location[];
  // return au niveau du serveur (ex. redirection vers HTTPS).
  retour?: string[];
  limite?: Limite;
  limiteStatut?: number;
}

// Un groupe de serveurs (upstream) : proxy_pass http://nom/ répartit entre eux.
export interface Amont {
  serveurs: { adresse: string; poids: number; secours: boolean; eteint: boolean }[];
}

export interface Configuration {
  serveurs: Serveur[];
  amonts: Record<string, Amont>;
  // Les avertissements de nginx -t ([warn]) : la configuration reste valable.
  avertissements: string[];
  zones: Record<string, ZoneLimite>;
}

class ErreurConf extends Error {}
const echec = (message: string, fichier: string, ligne: number): never => {
  throw new ErreurConf(`${message} in ${fichier}:${ligne}`);
};

// Découpe un fichier en mots, « ; », « { » et « } », avec leur ligne.
function jetons(texte: string): { mot: string; ligne: number }[] {
  const liste: { mot: string; ligne: number }[] = [];
  texte.split('\n').forEach((brute, i) => {
    const ligne = brute.replace(/(^|\s)#.*$/, '$1');
    for (const m of ligne.matchAll(/"([^"]*)"|'([^']*)'|[;{}]|[^\s;{}"']+/g)) liste.push({ mot: m[1] ?? m[2] ?? m[0], ligne: i + 1 });
  });
  return liste;
}

// Les fichiers d'un include : un chemin, ou un motif (*) qui peut ne rien trouver.
function fichiersInclus(jeu: Jeu, motif: string, fichier: string, ligne: number): string[] {
  const chemin = motif.startsWith('/') ? motif : `${PREFIXE}/${motif}`;
  if (!chemin.includes('*') && !chemin.includes('?')) {
    const n = jeu.trouver(chemin);
    if (!n || n.type !== 'fichier') echec(`open() "${chemin}" failed (2: No such file or directory)`, fichier, ligne);
    return [chemin];
  }
  // Un lien cassé dans sites-enabled/ fait échouer nginx -t.
  const verifier = (chemin: string) => {
    if (!jeu.trouver(chemin)) echec(`open() "${chemin}" failed (2: No such file or directory)`, fichier, ligne);
    return chemin;
  };
  const dossier = chemin.slice(0, chemin.lastIndexOf('/')) || '/';
  const n = jeu.trouver(dossier);
  if (!n || n.type !== 'dossier') return [];
  const re = joker(chemin.slice(chemin.lastIndexOf('/') + 1));
  return Object.keys(n.enfants)
    .filter((nom) => re.test(nom) && n.enfants[nom].type === 'fichier')
    .sort()
    .map((nom) => verifier(`${dossier}/${nom}`));
}

// Lit un fichier et ses include ; renvoie ses directives (dans le bloc `contexte`).
// `lus` reçoit les fichiers lus, dans l'ordre (pour nginx -T).
function analyser(jeu: Jeu, fichier: string, contexte: string, lus: string[]): Directive[] {
  lus.push(fichier);
  const liste = jetons(jeu.lire(fichier) ?? '');
  let i = 0;
  const bloc = (ctx: string, ouvert: boolean): Directive[] => {
    const directives: Directive[] = [];
    let mots: { mot: string; ligne: number }[] = [];
    while (i < liste.length) {
      const j = liste[i++];
      if (j.mot === ';' || j.mot === '{') {
        if (!mots.length) echec(`unexpected "${j.mot}"`, fichier, j.ligne);
        const [nom, ...args] = mots.map((m) => m.mot);
        const ligne = mots[0].ligne;
        mots = [];
        // Dans « types », chaque ligne associe un type MIME à des extensions.
        if (ctx === 'types') continue;
        const regle = ctx === 'upstream' && nom === 'server' ? SERVEUR_AMONT : DIRECTIVES[nom];
        if (!regle) echec(`unknown directive "${nom}"`, fichier, ligne);
        if (!regle.dans.includes(ctx)) echec(`"${nom}" directive is not allowed here`, fichier, ligne);
        if (j.mot === '{' && !regle.bloc) echec(`directive "${nom}" is not terminated by ";"`, fichier, ligne);
        if (j.mot === ';' && regle.bloc) echec(`directive "${nom}" has no opening "{"`, fichier, ligne);
        if (args.length < regle.min || args.length > regle.max) echec(`invalid number of arguments in "${nom}" directive`, fichier, ligne);
        if (nom === 'include') {
          for (const inclus of fichiersInclus(jeu, args[0], fichier, ligne)) directives.push(...analyser(jeu, inclus, ctx, lus));
          continue;
        }
        const d: Directive = { nom, args, fichier, ligne };
        if (regle.bloc) d.enfants = bloc(nom, true);
        directives.push(d);
      } else if (j.mot === '}') {
        if (mots.length) echec(`unexpected "}"`, fichier, j.ligne);
        if (!ouvert) echec(`unexpected "}"`, fichier, j.ligne);
        return directives;
      } else mots.push(j);
    }
    if (mots.length) echec(`unexpected end of file, expecting ";" or "}"`, fichier, mots.at(-1)!.ligne);
    if (ouvert) echec(`unexpected end of file, expecting "}"`, fichier, (liste.at(-1)?.ligne ?? 0) + 1);
    return directives;
  };
  return bloc(contexte, false);
}

// nginx lit le certificat et sa clé au chargement ; messages d'OpenSSL 3.
function chargerCertificat(jeu: Jeu, enfants: Directive[], http: Directive[], serveur: Directive): string {
  const trouve = (nom: string) => enfants.find((d) => d.nom === nom) ?? http.find((d) => d.nom === nom);
  const cert = trouve('ssl_certificate');
  const cle = trouve('ssl_certificate_key');
  const listen = enfants.find((d) => d.nom === 'listen' && d.args.includes('ssl')) ?? serveur;
  if (!cert) echec(`no "ssl_certificate" is defined for the "listen ... ssl" directive`, listen.fichier, listen.ligne);
  const ouvrir = (d: Directive, quoi: string) => {
    const chemin = d.args[0];
    const n = jeu.trouver(chemin);
    if (!n || n.type !== 'fichier')
      echec(
        `cannot load ${quoi} "${chemin}": BIO_new_file() failed (SSL: error:80000002:system library::No such file or directory:calling fopen(${chemin}, r) error:10000080:BIO routines::no such file)`,
        d.fichier,
        d.ligne,
      );
    return jeu.lire(chemin) ?? '';
  };
  const contenu = ouvrir(cert!, 'certificate');
  if (!lireCertificat(contenu))
    echec(
      `cannot load certificate "${cert!.args[0]}": PEM_read_bio_X509_AUX() failed (SSL: error:0480006C:PEM routines::no start line:Expecting: TRUSTED CERTIFICATE)`,
      cert!.fichier,
      cert!.ligne,
    );
  if (!cle) echec(`no "ssl_certificate_key" is defined for certificate "${cert!.args[0]}"`, listen.fichier, listen.ligne);
  ouvrir(cle!, 'certificate key');
  return contenu;
}

// limit_req_zone $binary_remote_addr zone=nom:10m rate=2r/s;
function lireZones(http: Directive[]): Record<string, ZoneLimite> {
  const zones: Record<string, ZoneLimite> = {};
  for (const d of http.filter((x) => x.nom === 'limit_req_zone')) {
    const [cle, ...params] = d.args;
    const zone = params.find((p) => p.startsWith('zone='))?.slice(5);
    const debit = params.find((p) => p.startsWith('rate='))?.slice(5);
    const inconnu = params.find((p) => !p.startsWith('zone=') && !p.startsWith('rate=') && p !== 'sync');
    if (inconnu) echec(`invalid parameter "${inconnu}"`, d.fichier, d.ligne);
    if (!zone || !/^[\w-]+:\d+[km]?$/i.test(zone)) echec(`no zone in "limit_req_zone" directive`, d.fichier, d.ligne);
    const m = /^(\d+)r\/([sm])$/.exec(debit ?? '');
    if (!m) echec(`invalid rate "${debit ?? ''}"`, d.fichier, d.ligne);
    zones[zone!.split(':')[0]] = { cle, debit: Number(m![1]) / (m![2] === 'm' ? 60 : 1) };
  }
  return zones;
}

// limit_req zone=nom [burst=N] [nodelay] : la zone doit exister.
function lireLimite(d: Directive, zones: Record<string, ZoneLimite>): Limite {
  const zone = d.args.find((a) => a.startsWith('zone='))?.slice(5);
  const rafale = d.args.find((a) => a.startsWith('burst='))?.slice(6);
  const inconnu = d.args.find((a) => !a.startsWith('zone=') && !a.startsWith('burst=') && a !== 'nodelay' && !a.startsWith('delay='));
  if (inconnu) echec(`invalid parameter "${inconnu}"`, d.fichier, d.ligne);
  if (!zone) echec(`no shared memory zone specified`, d.fichier, d.ligne);
  if (rafale !== undefined && !/^\d+$/.test(rafale)) echec(`invalid burst value "${rafale}"`, d.fichier, d.ligne);
  // Une zone jamais déclarée : nginx -t le dit sans fichier ni ligne.
  if (!zones[zone!]) throw new ErreurConf(`zero size shared memory zone "${zone}"`);
  return { zone: zone!, rafale: Number(rafale ?? 0), sansDelai: d.args.includes('nodelay') };
}

// « 80 », « [::]:80 », « 192.0.2.11:80 » → adresse:port.
const adresse = (valeur: string) => (/^\d+$/.test(valeur) ? `0.0.0.0:${valeur}` : valeur.includes(':') ? valeur : `${valeur}:80`);

/** Lit et vérifie toute la configuration ; lève une erreur au format de nginx. */
function construire(jeu: Jeu, lus: string[] = []): Configuration {
  if (!jeu.trouver(CONF)) echec(`open() "${CONF}" failed (2: No such file or directory)`, CONF, 0);
  const racine = analyser(jeu, CONF, 'main', lus);
  const http = racine.find((d) => d.nom === 'http')?.enfants ?? [];
  const valeurs = (liste: Directive[], nom: string) => liste.filter((d) => d.nom === nom).flatMap((d) => d.args);
  const zones = lireZones(http);
  const parDefautVus: Record<string, true> = {};
  const nomsVus = new Set<string>();
  const avertissements: string[] = [];
  const serveurs = http
    .filter((d) => d.nom === 'server')
    .map((s): Serveur => {
      const enfants = s.enfants ?? [];
      const ecoute: string[] = [];
      const parDefaut: string[] = [];
      const ssl: string[] = [];
      for (const l of enfants.filter((d) => d.nom === 'listen')) {
        const a = adresse(l.args[0]);
        ecoute.push(a);
        if (l.args.includes('ssl')) ssl.push(a);
        if (l.args.includes('default_server')) {
          if (parDefautVus[a]) echec(`a duplicate default server for ${a}`, l.fichier, l.ligne);
          parDefautVus[a] = true;
          parDefaut.push(a);
        }
      }
      const certificat = ssl.length ? chargerCertificat(jeu, enfants, http, s) : null;
      // Un même nom sur la même adresse : le premier serveur lu le garde.
      const noms: string[] = [];
      for (const nom of valeurs(enfants, 'server_name').map((n) => n.toLowerCase())) {
        const conflits = (ecoute.length ? ecoute : ['0.0.0.0:80']).filter((a) => nomsVus.has(`${nom} ${a}`));
        for (const a of conflits) avertissements.push(`conflicting server name "${nom}" on ${a}, ignored`);
        if (!conflits.length) noms.push(nom);
        for (const a of ecoute.length ? ecoute : ['0.0.0.0:80']) nomsVus.add(`${nom} ${a}`);
      }
      const locations = enfants
        .filter((d) => d.nom === 'location')
        .map((l): Location => {
          const exact = l.args[0] === '=';
          const dedans = l.enfants ?? [];
          const une = (nom: string) => dedans.find((d) => d.nom === nom)?.args;
          const limite = dedans.find((d) => d.nom === 'limit_req');
          return {
            limite: limite ? lireLimite(limite, zones) : undefined,
            refus: valeurs(dedans, 'deny'),
            limiteStatut: une('limit_req_status') ? Number(une('limit_req_status')![0]) : undefined,
            exact,
            chemin: l.args.at(-1)!,
            racine: une('root')?.[0],
            alias: une('alias')?.[0],
            index: une('index'),
            proxy: une('proxy_pass')?.[0],
            retour: une('return'),
          };
        });
      const limite = enfants.find((d) => d.nom === 'limit_req') ?? http.find((d) => d.nom === 'limit_req');
      const statut = valeurs(enfants, 'limit_req_status')[0] ?? valeurs(http, 'limit_req_status')[0];
      return {
        limite: limite ? lireLimite(limite, zones) : undefined,
        limiteStatut: statut ? Number(statut) : undefined,
        ssl,
        certificat,
        locations,
        retour: enfants.find((d) => d.nom === 'return')?.args,
        ecoute: ecoute.length ? ecoute : ['0.0.0.0:80'],
        parDefaut,
        noms,
        racine: valeurs(enfants, 'root')[0] ?? valeurs(http, 'root')[0] ?? '/usr/share/nginx/html',
        index: valeurs(enfants, 'index').length ? valeurs(enfants, 'index') : valeurs(http, 'index').length ? valeurs(http, 'index') : ['index.html'],
        refus: [...valeurs(http, 'deny'), ...valeurs(enfants, 'deny')],
      };
    });
  return { serveurs, avertissements, zones, amonts: lireAmonts(http) };
}

// upstream nom { server 127.0.0.1:3001 weight=9; server 127.0.0.1:3002 weight=1; }
// https://nginx.org/en/docs/http/ngx_http_upstream_module.html#server
function lireAmonts(http: Directive[]): Record<string, Amont> {
  const amonts: Record<string, Amont> = {};
  for (const u of http.filter((d) => d.nom === 'upstream')) {
    const nom = u.args[0];
    if (amonts[nom]) echec(`duplicate upstream "${nom}"`, u.fichier, u.ligne);
    const serveurs = (u.enfants ?? [])
      .filter((d) => d.nom === 'server')
      .map((d) => {
        const [adr, ...params] = d.args;
        let poids = 1;
        for (const p of params) {
          if (p.startsWith('weight=')) {
            poids = Number(p.slice(7));
            if (!Number.isInteger(poids) || poids < 1) echec(`invalid parameter "${p}"`, d.fichier, d.ligne);
          } else if (!['backup', 'down'].includes(p) && !/^(max_fails|fail_timeout|max_conns)=/.test(p))
            echec(`invalid parameter "${p}"`, d.fichier, d.ligne);
        }
        return {
          adresse: adr.includes(':') ? adr.replace(/^localhost/, '127.0.0.1') : `${adr}:80`,
          poids,
          secours: params.includes('backup'),
          eteint: params.includes('down'),
        };
      });
    if (!serveurs.length) echec(`no servers are inside upstream`, u.fichier, u.ligne);
    amonts[nom] = { serveurs };
  }
  return amonts;
}

// Le tourniquet pondéré de nginx (smooth weighted round-robin) : à chaque
// requête, chaque serveur gagne son poids, le plus haut est choisi et perd la
// somme des poids. Avec 9 et 1 : 9 requêtes sur 10 pour le premier.
function tourniquet(jeu: Jeu, nom: string, amont: Amont, exclus: string[], trace: boolean): string | null {
  const candidats = amont.serveurs.filter((x) => !x.eteint && !x.secours && !exclus.includes(x.adresse));
  const liste = candidats.length ? candidats : amont.serveurs.filter((x) => !x.eteint && x.secours && !exclus.includes(x.adresse));
  if (!liste.length) return null;
  const etats: Record<string, Record<string, number>> = (jeu.etat.nginxTourniquets ??= {});
  const courant = { ...(etats[nom] ?? {}) };
  const total = liste.reduce((t, x) => t + x.poids, 0);
  for (const x of liste) courant[x.adresse] = (courant[x.adresse] ?? 0) + x.poids;
  const choisi = liste.reduce((a, b) => (courant[b.adresse] > courant[a.adresse] ? b : a));
  courant[choisi.adresse] -= total;
  // Les vérifications du jeu ne font pas tourner le tourniquet.
  if (trace) etats[nom] = courant;
  return choisi.adresse;
}

/** Vérifie la configuration : null si elle est bonne, sinon le message [emerg]. */
export function tester(jeu: Jeu): { config: Configuration; erreur: null } | { config: null; erreur: string } {
  try {
    return { config: construire(jeu), erreur: null };
  } catch (e) {
    if (e instanceof ErreurConf) return { config: null, erreur: e.message };
    throw e;
  }
}

/** Les fichiers de configuration lus, dans l'ordre (nginx -T). */
export function fichiersLus(jeu: Jeu): string[] {
  const lus: string[] = [];
  construire(jeu, lus);
  return lus;
}

// L'heure de nginx dans ses journaux : « 2026/10/23 08:15:02 ».
export const heureNginx = (ms: number) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ').replaceAll('-', '/');

// Pour systemd : nginx refuse de démarrer (ou de recharger) une mauvaise configuration.
export function verifierNginx(jeu: Jeu): string[] | null {
  const { erreur } = tester(jeu);
  if (!erreur) return null;
  const h = heureNginx((systemd(jeu)?.horloge ?? 0) + 1000);
  return [`${h} [emerg] 2411#2411: ${erreur}`, `nginx: configuration file ${CONF} test failed`];
}

/** Au démarrage et au rechargement : la configuration lue devient celle qui sert. */
export function chargerNginx(jeu: Jeu) {
  jeu.etat.nginx = { ...(jeu.etat.nginx ?? {}), charge: tester(jeu).config };
}

export interface Reponse {
  code: number;
  corps: string;
  entetes: string[];
  // En HTTPS : le certificat présenté par le serveur (PEM).
  certificat?: string;
}

const RAISONS: Record<number, string> = {
  200: 'OK',
  301: 'Moved Permanently',
  302: 'Found',
  403: 'Forbidden',
  404: 'Not Found',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Temporarily Unavailable',
  504: 'Gateway Time-out',
};
const page = (code: number) =>
  `<html>\n<head><title>${code} ${RAISONS[code]}</title></head>\n<body>\n<center><h1>${code} ${RAISONS[code]}</h1></center>\n<hr><center>nginx/${VERSION}</center>\n</body>\n</html>`;
const JOURS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MOIS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// En-tête Date (GMT) ; l'horloge de la machine est à l'heure de Paris.
const dateHttp = (ms: number) => {
  const d = new Date(versUtc(ms));
  return `${JOURS[d.getUTCDay()]}, ${String(d.getUTCDate()).padStart(2, '0')} ${MOIS[d.getUTCMonth()]} ${d.getUTCFullYear()} ${d.toISOString().slice(11, 19)} GMT`;
};

// Les programmes derrière nginx (proxy_pass) : etat.applis, par adresse
// « 127.0.0.1:3000 ». Une appli répond tant que son service systemd tourne.
export interface Appli {
  service: string;
  // Les pages qu'elle sert, par chemin ; ailleurs, la page 404 d'Express.
  pages: Record<string, string>;
  // Ou une appli qui calcule sa réponse (version, configuration, santé…).
  repondre?: (jeu: Jeu, chemin: string) => { code: number; corps: string; type?: string };
  // Requêtes par seconde qu'elle sait servir (sans limite si absent).
  capacite?: number;
}

const PAGE_EXPRESS = (chemin: string) =>
  `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>Error</title>\n</head>\n<body>\n<pre>Cannot GET ${chemin}</pre>\n</body>\n</html>`;

/** Ce que répond une appli (sans passer par nginx). */
export function repondreAppli(jeu: Jeu, appli: Appli, chemin: string): { code: number; corps: string; type?: string } {
  if (appli.repondre) return appli.repondre(jeu, chemin.split('?')[0]);
  const corps = appli.pages[chemin.split('?')[0]];
  return corps === undefined ? { code: 404, corps: PAGE_EXPRESS(chemin) } : { code: 200, corps };
}

/** Une appli jointe directement sur son port (curl http://127.0.0.1:3001/) : null si personne n'écoute. */
export function requeteAppli(jeu: Jeu, port: number, chemin: string): { code: number; corps: string; type?: string } | null {
  const appli: Appli | undefined = jeu.etat.applis?.[`127.0.0.1:${port}`];
  if (!appli || systemd(jeu)?.services[appli.service]?.etat !== 'active') return null;
  return repondreAppli(jeu, appli, chemin);
}

// Une ligne de /var/log/nginx/error.log (si le fichier existe).
function journalErreur(jeu: Jeu, niveau: string, message: string) {
  if (!jeu.etat.nginxTrace) return;
  const n = jeu.trouver('/var/log/nginx/error.log');
  if (n?.type !== 'fichier' || typeof n.contenu !== 'string') return;
  const numero = (jeu.etat.nginxConnexions = (jeu.etat.nginxConnexions ?? 0) + 1);
  const ligne = `${heureNginx(systemd(jeu)?.horloge ?? 0)} [${niveau}] 2412#2412: *${numero} ${message}`;
  n.contenu = n.contenu ? `${n.contenu}\n${ligne}` : ligne;
}

/** Le bloc location qui traite ce chemin : = exact d'abord, puis le plus long préfixe. */
export function choisirLocation(serveur: Serveur, chemin: string): Location | null {
  const exact = serveur.locations.find((l) => l.exact && l.chemin === chemin);
  if (exact) return exact;
  return serveur.locations.filter((l) => !l.exact && chemin.startsWith(l.chemin)).sort((a, b) => b.chemin.length - a.chemin.length)[0] ?? null;
}

/**
 * Une requête HTTP (port 80) ou HTTPS (443) vers cette machine : null si
 * personne n'écoute. Le serveur est choisi par son nom (en-tête Host, ou SNI
 * en HTTPS), sinon c'est celui par défaut du port, sinon le premier ; puis
 * le bloc location, qui sert un fichier, renvoie (return) ou passe la
 * requête à une appli (proxy_pass).
 */
export function requete(jeu: Jeu, hote: string, chemin: string, port = 80, trace = true, client?: Client): Reponse | null {
  // Les vérifications du jeu (objectifs) interrogent nginx sans laisser de trace au journal.
  jeu.etat.nginxTrace = trace;
  const qui = client ?? { adresse: '127.0.0.1', temps: systemd(jeu)?.horloge ?? 0, agent: 'curl/8.14.1' };
  const r = traiter(jeu, hote, chemin, port, qui);
  if (r && trace) journalAcces(jeu, qui, chemin, r);
  return r;
}

// Qui fait la requête : son adresse, l'heure (locale, en millisecondes), son navigateur.
export interface Client {
  adresse: string;
  temps: number;
  agent: string;
}

// « 27/Mar/2027:20:00:01 +0100 », comme $time_local.
function heureLocale(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getUTCDate()).padStart(2, '0')}/${MOIS[d.getUTCMonth()]}/${d.getUTCFullYear()}:${d.toISOString().slice(11, 19)} ${heureEte(ms) ? '+0200' : '+0100'}`;
}

// Une ligne de /var/log/nginx/access.log (format combined), si le chapitre le demande.
function journalAcces(jeu: Jeu, c: Client, chemin: string, r: Reponse) {
  if (!jeu.etat.nginx?.journalAcces) return;
  const n = jeu.trouver('/var/log/nginx/access.log');
  if (n?.type !== 'fichier' || typeof n.contenu !== 'string') return;
  const ligne = `${c.adresse} - - [${heureLocale(c.temps)}] "GET ${chemin} HTTP/1.1" ${r.code} ${new TextEncoder().encode(r.corps).length} "-" "${c.agent}"`;
  n.contenu = n.contenu ? `${n.contenu}\n${ligne}` : ligne;
}

// Une adresse couverte par une règle deny (adresse, plage CIDR ou all).
function couvert(regle: string, adresse: string): boolean {
  if (regle === 'all') return true;
  const [base, bits = '32'] = regle.split('/');
  const nombre = (ip: string) => ip.split('.').reduce((t, o) => t * 256 + Number(o), 0);
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(base) || !/^\d+\.\d+\.\d+\.\d+$/.test(adresse)) return regle === adresse;
  const masque = Number(bits) === 0 ? 0 : 2 ** 32 - 2 ** (32 - Number(bits));
  return (nombre(base) & masque) >>> 0 === (nombre(adresse) & masque) >>> 0;
}

function traiter(jeu: Jeu, hote: string, chemin: string, port: number, client: Client): Reponse | null {
  const sd = systemd(jeu);
  const config: Configuration | null = jeu.etat.nginx?.charge ?? null;
  if (!config || sd?.services.nginx?.etat !== 'active') return null;
  const a = /^\[|:/.test(hote) ? `[::]:${port}` : `0.0.0.0:${port}`;
  const candidats = config.serveurs.filter((s) => s.ecoute.includes(a));
  const serveur = candidats.find((s) => s.noms.includes(hote.toLowerCase())) ?? candidats.find((s) => s.parDefaut.includes(a)) ?? candidats[0];
  if (!serveur) return null;
  // Un port en HTTPS ne répond pas en clair (et inversement) : on ne simule que le bon cas.
  if (serveur.ssl.includes(a) !== (port === 443)) return null;
  const reponse = (code: number, corps: string, plus: string[] = []): Reponse => ({
    code,
    corps,
    certificat: port === 443 ? (serveur.certificat ?? undefined) : undefined,
    entetes: [
      `HTTP/1.1 ${code} ${RAISONS[code] ?? ''}`.trimEnd(),
      `Server: nginx/${VERSION}`,
      `Date: ${dateHttp(sd!.horloge)}`,
      'Content-Type: text/html',
      `Content-Length: ${new TextEncoder().encode(corps).length}`,
      'Connection: keep-alive',
      ...plus,
    ],
  });
  const variables = (texte: string) =>
    texte
      .replaceAll('$request_uri', chemin)
      .replaceAll('$host', hote.toLowerCase())
      .replaceAll('$scheme', port === 443 ? 'https' : 'http')
      .replaceAll('$server_name', serveur.noms[0] ?? '');
  // return code [adresse ou texte] : 301/302 avec Location, sinon le texte.
  const retourner = ([code, quoi = '']: string[]) => {
    const n = Number(code);
    if (n >= 300 && n < 400) return reponse(n, page(n), [`Location: ${variables(quoi)}`]);
    return reponse(n, variables(quoi));
  };
  const loc = choisirLocation(serveur, chemin.split('?')[0]);
  const contexte = `client: ${client.adresse}, server: ${serveur.noms[0] ?? '_'}, request: "GET ${chemin} HTTP/1.1", host: "${hote}"`;
  // deny : 403 (http, puis server, puis location).
  if ([...serveur.refus, ...(loc?.refus ?? [])].some((r) => couvert(r, client.adresse))) {
    journalErreur(jeu, 'error', `access forbidden by rule, ${contexte}`);
    return reponse(403, page(403));
  }
  // limit_req : un seau qui fuit au débit de la zone ; au-delà de la rafale, refus.
  const limite = loc?.limite ?? serveur.limite;
  if (limite) {
    const zone = config.zones[limite.zone];
    const cle = zone.cle === '$binary_remote_addr' || zone.cle === '$remote_addr' ? client.adresse : zone.cle;
    const seaux: Record<string, { exces: number; dernier: number }> = (jeu.etat.nginxSeaux ??= {});
    const seau = seaux[`${limite.zone}|${cle}`];
    const exces = seau ? Math.max(0, seau.exces - (zone.debit * (client.temps - seau.dernier)) / 1000 + 1) : 0;
    if (exces > limite.rafale) {
      journalErreur(jeu, 'error', `limiting requests, excess: ${exces.toFixed(3)} by zone "${limite.zone}", ${contexte}`);
      const statut = loc?.limiteStatut ?? serveur.limiteStatut ?? 503;
      return reponse(statut, page(statut));
    }
    // Les vérifications du jeu ne remplissent pas le seau.
    if (jeu.etat.nginxTrace) seaux[`${limite.zone}|${cle}`] = { exces, dernier: client.temps };
  }
  if (serveur.retour) return retourner(serveur.retour);
  if (loc?.retour) return retourner(loc.retour);
  if (loc?.proxy) {
    const m = /^https?:\/\/([^/]+)(\/.*)?$/.exec(loc.proxy);
    const hoteAmont = (m?.[1] ?? '').replace(/^localhost(?=:|$)/, '127.0.0.1');
    // Avec une partie chemin dans proxy_pass, elle remplace le préfixe de la location.
    const amont = m?.[2] !== undefined ? m[2] + chemin.slice(loc.chemin.length) : chemin;
    const groupe = config.amonts?.[hoteAmont];
    const connexion = (adresse: string) =>
      `connect() failed (111: Connection refused) while connecting to upstream, client: ${client.adresse}, server: ${serveur.noms[0] ?? '_'}, request: "GET ${chemin} HTTP/1.1", upstream: "http://${adresse}${amont}", host: "${hote}"`;
    const joindre = (adresse: string): Appli | null => {
      const a: Appli | undefined = jeu.etat.applis?.[adresse.includes(':') ? adresse : `${adresse}:80`];
      return a && sd!.services[a.service]?.etat === 'active' ? a : null;
    };
    let adresse = hoteAmont;
    let appli: Appli | null = null;
    if (groupe) {
      // Un serveur qui ne répond pas : nginx essaie le suivant (proxy_next_upstream error).
      const essayes: string[] = [];
      for (;;) {
        const choisi = tourniquet(jeu, hoteAmont, groupe, essayes, !!jeu.etat.nginxTrace);
        if (!choisi) {
          journalErreur(
            jeu,
            'error',
            `no live upstreams while connecting to upstream, client: ${client.adresse}, server: ${serveur.noms[0] ?? '_'}, request: "GET ${chemin} HTTP/1.1", upstream: "http://${hoteAmont}${amont}", host: "${hote}"`,
          );
          return reponse(502, page(502));
        }
        adresse = choisi;
        appli = joindre(choisi);
        if (appli) break;
        journalErreur(jeu, 'error', connexion(choisi));
        essayes.push(choisi);
      }
    } else {
      appli = joindre(adresse);
      if (!appli) {
        journalErreur(jeu, 'error', connexion(adresse));
        return reponse(502, page(502));
      }
    }
    jeu.etat.nginxDernierAmont = adresse;
    // Une appli a une capacité : au-delà, elle ne répond plus à temps (504).
    if (appli.capacite) {
      const charge: Record<string, number> = (jeu.etat.appliCharge ??= {});
      const seconde = `${adresse}|${Math.floor(client.temps / 1000)}`;
      if (jeu.etat.nginxTrace) charge[seconde] = (charge[seconde] ?? 0) + 1;
      if ((charge[seconde] ?? 0) > appli.capacite) {
        journalErreur(
          jeu,
          'error',
          `upstream timed out (110: Connection timed out) while reading response header from upstream, ${contexte}, upstream: "http://${adresse}${amont}"`,
        );
        return reponse(504, page(504));
      }
    }
    const r = repondreAppli(jeu, appli, amont);
    return reponse(r.code, r.corps);
  }
  // Un fichier : root + chemin, ou alias à la place du préfixe de la location.
  const sansRequete = chemin.split('?')[0] || '/';
  const cible = loc?.alias
    ? loc.alias.replace(/\/$/, '') + '/' + sansRequete.slice(loc.chemin.length).replace(/^\//, '')
    : (loc?.racine ?? serveur.racine).replace(/\/$/, '') + sansRequete;
  const index = loc?.index ?? serveur.index;
  const demande = jeu.trouver(cible);
  let fichier = demande;
  if (demande?.type === 'dossier') {
    const nom = index.find((i) => demande.enfants[i] && jeu.trouver(`${cible.replace(/\/$/, '')}/${i}`)?.type === 'fichier');
    // Un lieu sans page d'index : nginx refuse d'en montrer la liste.
    if (!nom) {
      journalErreur(
        jeu,
        'error',
        `directory index of "${cible.replace(/\/?$/, '/')}" is forbidden, client: 127.0.0.1, server: ${serveur.noms[0] ?? '_'}, request: "GET ${chemin} HTTP/1.1", host: "${hote}"`,
      );
      return reponse(403, page(403));
    }
    fichier = jeu.trouver(`${cible.replace(/\/$/, '')}/${nom}`);
  }
  if (!fichier || fichier.type !== 'fichier') {
    journalErreur(
      jeu,
      'error',
      `open() "${cible}" failed (2: No such file or directory), client: 127.0.0.1, server: ${serveur.noms[0] ?? '_'}, request: "GET ${chemin} HTTP/1.1", host: "${hote}"`,
    );
    return reponse(404, page(404));
  }
  // Les processus de travail de nginx tournent sous le compte www-data.
  if (!jeu.peut(fichier, 'r', 'www-data')) return reponse(403, page(403));
  const corps = typeof fichier.contenu === 'function' ? fichier.contenu(jeu) : fichier.contenu;
  return reponse(200, corps);
}
