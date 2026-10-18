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
import { systemd, versUtc } from './systemd';
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
  deny: r(1, 1, HTTP),
};

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
}

export interface Configuration {
  serveurs: Serveur[];
  // Les avertissements de nginx -t ([warn]) : la configuration reste valable.
  avertissements: string[];
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
        const regle = DIRECTIVES[nom];
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

// « 80 », « [::]:80 », « 192.0.2.11:80 » → adresse:port.
const adresse = (valeur: string) => (/^\d+$/.test(valeur) ? `0.0.0.0:${valeur}` : valeur.includes(':') ? valeur : `${valeur}:80`);

/** Lit et vérifie toute la configuration ; lève une erreur au format de nginx. */
function construire(jeu: Jeu, lus: string[] = []): Configuration {
  if (!jeu.trouver(CONF)) echec(`open() "${CONF}" failed (2: No such file or directory)`, CONF, 0);
  const racine = analyser(jeu, CONF, 'main', lus);
  const http = racine.find((d) => d.nom === 'http')?.enfants ?? [];
  const valeurs = (liste: Directive[], nom: string) => liste.filter((d) => d.nom === nom).flatMap((d) => d.args);
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
          return {
            exact,
            chemin: l.args.at(-1)!,
            racine: une('root')?.[0],
            alias: une('alias')?.[0],
            index: une('index'),
            proxy: une('proxy_pass')?.[0],
            retour: une('return'),
          };
        });
      return {
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
  return { serveurs, avertissements };
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

const RAISONS: Record<number, string> = { 200: 'OK', 301: 'Moved Permanently', 302: 'Found', 403: 'Forbidden', 404: 'Not Found', 502: 'Bad Gateway' };
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
}

const PAGE_EXPRESS = (chemin: string) =>
  `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>Error</title>\n</head>\n<body>\n<pre>Cannot GET ${chemin}</pre>\n</body>\n</html>`;

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
export function requete(jeu: Jeu, hote: string, chemin: string, port = 80, trace = true): Reponse | null {
  // Les vérifications du jeu (objectifs) interrogent nginx sans laisser de trace au journal.
  jeu.etat.nginxTrace = trace;
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
  if (serveur.retour) return retourner(serveur.retour);
  const loc = choisirLocation(serveur, chemin);
  if (loc?.retour) return retourner(loc.retour);
  if (loc?.proxy) {
    const m = /^https?:\/\/([^/]+)(\/.*)?$/.exec(loc.proxy);
    const adresse = (m?.[1] ?? '').replace(/^localhost(?=:|$)/, '127.0.0.1');
    // Avec une partie chemin dans proxy_pass, elle remplace le préfixe de la location.
    const amont = m?.[2] !== undefined ? m[2] + chemin.slice(loc.chemin.length) : chemin;
    const appli: Appli | undefined = jeu.etat.applis?.[adresse.includes(':') ? adresse : `${adresse}:80`];
    if (!appli || sd!.services[appli.service]?.etat !== 'active') {
      journalErreur(
        jeu,
        'error',
        `connect() failed (111: Connection refused) while connecting to upstream, client: 127.0.0.1, server: ${serveur.noms[0] ?? '_'}, request: "GET ${chemin} HTTP/1.1", upstream: "http://${adresse}${amont}", host: "${hote}"`,
      );
      return reponse(502, page(502));
    }
    const corps = appli.pages[amont];
    return corps === undefined ? reponse(404, PAGE_EXPRESS(amont)) : reponse(200, corps);
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
