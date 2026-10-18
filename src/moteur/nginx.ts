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
import { systemd } from './systemd';

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
  deny: r(1, 1, HTTP),
};

interface Directive {
  nom: string;
  args: string[];
  fichier: string;
  ligne: number;
  enfants?: Directive[];
}

export interface Serveur {
  // Adresses d'écoute (« 0.0.0.0:80 », « [::]:80 ») ; celles où il est le serveur par défaut.
  ecoute: string[];
  parDefaut: string[];
  noms: string[];
  racine: string;
  index: string[];
  refus: string[];
}

export interface Configuration {
  serveurs: Serveur[];
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
  const dossier = chemin.slice(0, chemin.lastIndexOf('/')) || '/';
  const n = jeu.trouver(dossier);
  if (!n || n.type !== 'dossier') return [];
  const re = joker(chemin.slice(chemin.lastIndexOf('/') + 1));
  return Object.keys(n.enfants)
    .filter((nom) => re.test(nom) && n.enfants[nom].type === 'fichier')
    .sort()
    .map((nom) => `${dossier}/${nom}`);
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

// « 80 », « [::]:80 », « 192.0.2.11:80 » → adresse:port.
const adresse = (valeur: string) => (/^\d+$/.test(valeur) ? `0.0.0.0:${valeur}` : valeur.includes(':') ? valeur : `${valeur}:80`);

/** Lit et vérifie toute la configuration ; lève une erreur au format de nginx. */
function construire(jeu: Jeu, lus: string[] = []): Configuration {
  if (!jeu.trouver(CONF)) echec(`open() "${CONF}" failed (2: No such file or directory)`, CONF, 0);
  const racine = analyser(jeu, CONF, 'main', lus);
  const http = racine.find((d) => d.nom === 'http')?.enfants ?? [];
  const valeurs = (liste: Directive[], nom: string) => liste.filter((d) => d.nom === nom).flatMap((d) => d.args);
  const parDefautVus: Record<string, true> = {};
  const serveurs = http
    .filter((d) => d.nom === 'server')
    .map((s): Serveur => {
      const enfants = s.enfants ?? [];
      const ecoute: string[] = [];
      const parDefaut: string[] = [];
      for (const l of enfants.filter((d) => d.nom === 'listen')) {
        const a = adresse(l.args[0]);
        ecoute.push(a);
        if (l.args.includes('default_server')) {
          if (parDefautVus[a]) echec(`a duplicate default server for ${a}`, l.fichier, l.ligne);
          parDefautVus[a] = true;
          parDefaut.push(a);
        }
      }
      return {
        ecoute: ecoute.length ? ecoute : ['0.0.0.0:80'],
        parDefaut,
        noms: valeurs(enfants, 'server_name'),
        racine: valeurs(enfants, 'root')[0] ?? valeurs(http, 'root')[0] ?? '/usr/share/nginx/html',
        index: valeurs(enfants, 'index').length ? valeurs(enfants, 'index') : valeurs(http, 'index').length ? valeurs(http, 'index') : ['index.html'],
        refus: [...valeurs(http, 'deny'), ...valeurs(enfants, 'deny')],
      };
    });
  return { serveurs };
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
}

const RAISONS: Record<number, string> = { 200: 'OK', 403: 'Forbidden', 404: 'Not Found' };
const page = (code: number) =>
  `<html>\n<head><title>${code} ${RAISONS[code]}</title></head>\n<body>\n<center><h1>${code} ${RAISONS[code]}</h1></center>\n<hr><center>nginx/${VERSION}</center>\n</body>\n</html>`;
const JOURS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MOIS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// En-tête Date (GMT) ; l'horloge de la machine est à l'heure d'été de Paris (UTC+2).
const dateHttp = (ms: number) => {
  const d = new Date(ms - 2 * 3600_000);
  return `${JOURS[d.getUTCDay()]}, ${String(d.getUTCDate()).padStart(2, '0')} ${MOIS[d.getUTCMonth()]} ${d.getUTCFullYear()} ${d.toISOString().slice(11, 19)} GMT`;
};

/**
 * Une requête HTTP (port 80) vers cette machine : null si personne n'écoute.
 * Le serveur est choisi par son nom (en-tête Host), sinon c'est celui par
 * défaut du port, sinon le premier.
 */
export function requete(jeu: Jeu, hote: string, chemin: string): Reponse | null {
  const sd = systemd(jeu);
  const config: Configuration | null = jeu.etat.nginx?.charge ?? null;
  if (!config || sd?.services.nginx?.etat !== 'active') return null;
  const a = /^\[|:/.test(hote) ? '[::]:80' : '0.0.0.0:80';
  const candidats = config.serveurs.filter((s) => s.ecoute.includes(a));
  const serveur = candidats.find((s) => s.noms.includes(hote.toLowerCase())) ?? candidats.find((s) => s.parDefaut.includes(a)) ?? candidats[0];
  if (!serveur) return null;
  const reponse = (code: number, corps: string): Reponse => ({
    code,
    corps,
    entetes: [
      `HTTP/1.1 ${code} ${RAISONS[code]}`,
      `Server: nginx/${VERSION}`,
      `Date: ${dateHttp(sd!.horloge)}`,
      'Content-Type: text/html',
      `Content-Length: ${new TextEncoder().encode(corps).length}`,
      'Connection: keep-alive',
    ],
  });
  const base = serveur.racine.replace(/\/$/, '');
  const demande = jeu.trouver(base + (chemin || '/'));
  let fichier = demande;
  if (demande?.type === 'dossier') {
    const nom = serveur.index.find((i) => demande.enfants[i]?.type === 'fichier');
    // Un lieu sans page d'index : nginx refuse d'en montrer la liste.
    if (!nom) return reponse(403, page(403));
    fichier = demande.enfants[nom];
  }
  if (!fichier || fichier.type !== 'fichier') return reponse(404, page(404));
  // Les processus de travail de nginx tournent sous le compte www-data.
  if (!jeu.peut(fichier, 'r', 'www-data')) return reponse(403, page(403));
  const corps = typeof fichier.contenu === 'function' ? fichier.contenu(jeu) : fichier.contenu;
  return reponse(200, corps);
}
