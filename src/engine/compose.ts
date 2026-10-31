// Docker Compose simulé : le fichier compose.yaml (un sous-ensemble de
// YAML), ses variables (${VAR} lues dans .env), ses services, son réseau et
// ses volumes. D'après la spécification Compose
// (https://docs.docker.com/reference/compose-file/) et la commande
// docker compose (https://docs.docker.com/reference/cli/docker/compose/).
// Écarts : YAML réduit (correspondances, listes, chaînes, listes [a, b]) ;
// clés de service : image, ports, volumes, environment, env_file,
// depends_on, restart, user, read_only, cap_drop, security_opt, command
// (ignorée) ; pas de build, de healthcheck, ni de profils.

import type { Jeu, Shell } from './shell';
import { docker, horloge, identifiant, lancer, stopper, type Conteneur, type EtatDocker, type Montage, type Port } from './docker';

type Valeur = string | Valeur[] | { [cle: string]: Valeur };

export class ErreurYaml extends Error {}

/** Lit un YAML simple : correspondances indentées, listes « - », chaînes. */
export function lireYaml(texte: string): Valeur {
  const lignes = texte.split('\n').map((brute, i) => ({ numero: i + 1, brute }));
  for (const l of lignes) if (/^\s*\t/.test(l.brute)) throw new ErreurYaml(`yaml: line ${l.numero}: found character that cannot start any token`);
  const utiles = lignes
    .map((l) => ({ ...l, texte: retirerCommentaire(l.brute) }))
    .filter((l) => l.texte.trim() !== '')
    .map((l) => ({ ...l, retrait: l.texte.length - l.texte.trimStart().length, contenu: l.texte.trim() }));
  let i = 0;
  const scalaire = (s: string, numero: number): Valeur => {
    const v = s.trim();
    if (v.startsWith('[')) {
      if (!v.endsWith(']')) throw new ErreurYaml(`yaml: line ${numero}: did not find expected ',' or ']'`);
      return v
        .slice(1, -1)
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)
        .map((x) => scalaire(x, numero) as string);
    }
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1, -1);
    if (/^["']/.test(v)) throw new ErreurYaml(`yaml: line ${numero}: found unexpected end of stream`);
    return v;
  };
  const bloc = (retrait: number): Valeur => {
    const premiere = utiles[i];
    if (premiere.contenu.startsWith('- ') || premiere.contenu === '-') {
      const liste: Valeur[] = [];
      while (i < utiles.length && utiles[i].retrait === retrait && (utiles[i].contenu.startsWith('- ') || utiles[i].contenu === '-')) {
        const l = utiles[i++];
        const element = l.contenu.slice(1).trim();
        if (/^[\w.-]+:(\s|$)/.test(element)) throw new ErreurYaml(jeuNonSimule(l.numero));
        liste.push(scalaire(element, l.numero));
      }
      return liste;
    }
    const objet: Record<string, Valeur> = {};
    while (i < utiles.length && utiles[i].retrait === retrait) {
      const l = utiles[i];
      if (l.contenu.startsWith('- ')) throw new ErreurYaml(`yaml: line ${l.numero}: did not find expected key`);
      const m = /^("[^"]*"|'[^']*'|[^:]+?):(?:\s+(.*))?$/.exec(l.contenu);
      if (!m) throw new ErreurYaml(`yaml: line ${l.numero}: could not find expected ':'`);
      const cle = m[1].replace(/^["']|["']$/g, '');
      const reste = m[2];
      if (reste !== undefined && /^[^"'[]*:\s/.test(reste))
        throw new ErreurYaml(`yaml: line ${l.numero}: mapping values are not allowed in this context`);
      if (Object.hasOwn(objet, cle)) throw new ErreurYaml(`yaml: line ${l.numero}: mapping key "${cle}" already defined at line ${l.numero - 1}`);
      i++;
      if (reste !== undefined && reste !== '') objet[cle] = scalaire(reste, l.numero);
      else if (i < utiles.length && utiles[i].retrait > retrait) objet[cle] = bloc(utiles[i].retrait);
      else if (i < utiles.length && utiles[i].retrait === retrait && utiles[i].contenu.startsWith('- ')) objet[cle] = bloc(retrait);
      else objet[cle] = '';
    }
    if (i < utiles.length && utiles[i].retrait > retrait) throw new ErreurYaml(`yaml: line ${utiles[i].numero}: did not find expected key`);
    return objet;
  };
  if (!utiles.length) return {};
  const racine = bloc(utiles[0].retrait);
  if (i < utiles.length) throw new ErreurYaml(`yaml: line ${utiles[i].numero}: did not find expected key`);
  return racine;
}

const jeuNonSimule = (numero: number) => `yaml: line ${numero}: (long syntax is not simulated here)`;

// Un # commence un commentaire, sauf entre guillemets.
function retirerCommentaire(ligne: string): string {
  let guillemet: string | null = null;
  for (let i = 0; i < ligne.length; i++) {
    const c = ligne[i];
    if (guillemet) {
      if (c === guillemet) guillemet = null;
    } else if (c === '"' || c === "'") guillemet = c;
    else if (c === '#' && (i === 0 || /\s/.test(ligne[i - 1]))) return ligne.slice(0, i).trimEnd();
  }
  return ligne.trimEnd();
}

/** Lit un fichier .env : VARIABLE=valeur par ligne. */
export function lireEnv(texte: string | null): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const ligne of (texte ?? '').split('\n')) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(ligne);
    if (m && !ligne.trim().startsWith('#')) vars[m[1]] = m[2].replace(/^(["'])(.*)\1$/, '$2');
  }
  return vars;
}

// ——— Le projet ———

export interface Service {
  nom: string;
  image: string;
  ports: string[];
  volumes: string[];
  env: Record<string, string>;
  dependances: string[];
  redemarrage: string;
  utilisateur: string;
  lectureSeule: boolean;
  capDrop: string[];
  securite: string[];
}

export interface Projet {
  nom: string;
  dossier: string;
  services: Service[];
  volumes: string[];
  avertissements: string[];
}

const CLES_SERVICE = [
  'image',
  'ports',
  'volumes',
  'environment',
  'env_file',
  'depends_on',
  'restart',
  'command',
  'container_name',
  'user',
  'read_only',
  'cap_drop',
  'security_opt',
];

/** Lit compose.yaml et .env d'un dossier ; lève une erreur au format de docker compose. */
export function lireProjet(jeu: Jeu, dossier: string): Projet {
  const fichier = ['compose.yaml', 'compose.yml', 'docker-compose.yml', 'docker-compose.yaml']
    .map((f) => `${dossier}/${f}`)
    .find((f) => jeu.existe(f));
  if (!fichier) throw new ErreurYaml('no configuration file provided: not found');
  const env = lireEnv(jeu.lire(`${dossier}/.env`));
  const avertissements: string[] = [];
  // ${VAR}, ${VAR:-défaut} : remplacées avant la lecture, comme Compose.
  const brut = (jeu.lire(fichier) ?? '').replace(
    /\$\{([A-Za-z_][A-Za-z0-9_]*)(?::?-([^}]*))?\}|\$([A-Za-z_][A-Za-z0-9_]*)/g,
    (_, a: string, defaut: string | undefined, b: string) => {
      const nom = a ?? b;
      if (env[nom] !== undefined && env[nom] !== '') return env[nom];
      if (defaut !== undefined) return defaut;
      if (!avertissements.some((x) => x.includes(`"${nom}"`))) avertissements.push(`The "${nom}" variable is not set. Defaulting to a blank string.`);
      return '';
    },
  );
  const racine = lireYaml(brut);
  if (typeof racine !== 'object' || Array.isArray(racine)) throw new ErreurYaml(`Top-level object must be a mapping`);
  if ('version' in racine)
    avertissements.push(`${fichier}: the attribute \`version\` is obsolete, it will be ignored, please remove it to avoid potential confusion`);
  const services = racine.services;
  if (!services || typeof services !== 'object' || Array.isArray(services)) throw new ErreurYaml(`validating ${fichier}: services must be a mapping`);
  const liste = (v: Valeur | undefined, chemin: string): string[] => {
    if (v === undefined || v === '') return [];
    if (!Array.isArray(v)) throw new ErreurYaml(`validating ${fichier}: ${chemin} must be a array`);
    return v.map(String);
  };
  const resultat: Service[] = Object.entries(services).map(([nom, s]) => {
    if (typeof s !== 'object' || Array.isArray(s)) throw new ErreurYaml(`validating ${fichier}: services.${nom} must be a mapping`);
    const inconnue = Object.keys(s).find((k) => !CLES_SERVICE.includes(k));
    if (inconnue) throw new ErreurYaml(`validating ${fichier}: services.${nom} additional properties '${inconnue}' not allowed`);
    if (!s.image) throw new ErreurYaml(`service "${nom}" has neither an image nor a build context specified: invalid compose project`);
    const e = s.environment;
    const variables: Record<string, string> = {};
    const fichiersEnv = typeof s.env_file === 'string' ? (s.env_file ? [s.env_file] : []) : liste(s.env_file, `services.${nom}.env_file`);
    for (const f of fichiersEnv) Object.assign(variables, lireEnv(jeu.lire(`${dossier}/${f.replace(/^\.\//, '')}`)));
    if (Array.isArray(e))
      for (const x of e.map(String)) {
        const k = x.split('=')[0];
        variables[k] = x.slice(k.length + 1);
      }
    else if (e && typeof e === 'object') for (const [k, v] of Object.entries(e)) variables[k] = String(v);
    const dep = s.depends_on;
    return {
      nom,
      image: String(s.image),
      ports: liste(s.ports, `services.${nom}.ports`),
      volumes: liste(s.volumes, `services.${nom}.volumes`),
      env: variables,
      dependances: Array.isArray(dep) ? dep.map(String) : dep && typeof dep === 'object' ? Object.keys(dep) : [],
      redemarrage: s.restart ? String(s.restart) : 'no',
      utilisateur: s.user ? String(s.user) : '',
      lectureSeule: String(s.read_only ?? '') === 'true',
      capDrop: liste(s.cap_drop, `services.${nom}.cap_drop`),
      securite: liste(s.security_opt, `services.${nom}.security_opt`),
    };
  });
  for (const s of resultat)
    for (const dep of s.dependances)
      if (!resultat.some((x) => x.nom === dep))
        throw new ErreurYaml(`service "${s.nom}" depends on undefined service "${dep}": invalid compose project`);
  const volumes = racine.volumes && typeof racine.volumes === 'object' && !Array.isArray(racine.volumes) ? Object.keys(racine.volumes) : [];
  for (const s of resultat)
    for (const v of s.volumes) {
      const source = v.split(':')[0];
      if (!/^[./~]/.test(source) && !volumes.includes(source))
        throw new ErreurYaml(`service "${s.nom}" refers to undefined volume ${source}: invalid compose project`);
    }
  const nom = dossier
    .split('/')
    .filter(Boolean)
    .at(-1)!
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '');
  return { nom, dossier, services: resultat, volumes, avertissements };
}

/** L'ordre de démarrage : les dépendances d'abord (depends_on). */
export function ordre(p: Projet): Service[] {
  const fait: Service[] = [];
  const visiter = (s: Service) => {
    if (fait.includes(s)) return;
    for (const d of s.dependances) visiter(p.services.find((x) => x.nom === d)!);
    fait.push(s);
  };
  p.services.forEach(visiter);
  return fait;
}

export const nomConteneur = (p: Projet, s: Service) => `${p.nom}-${s.nom}-1`;

// L'empreinte de la configuration d'un service : si elle change, up recrée le conteneur.
export const empreinte = (s: Service) =>
  JSON.stringify([
    s.image,
    s.ports,
    s.volumes,
    s.env,
    s.redemarrage,
    ...(s.utilisateur || s.lectureSeule || s.capDrop.length || s.securite.length ? [s.utilisateur, s.lectureSeule, s.capDrop, s.securite] : []),
  ]);

export interface ConteneurCompose extends Conteneur {
  projet: string;
  service: string;
  empreinte: string;
}

export const conteneursDuProjet = (d: EtatDocker, projet: string) =>
  d.conteneurs.filter((c) => (c as ConteneurCompose).projet === projet) as ConteneurCompose[];

/** Crée (ou recrée) et démarre les conteneurs du projet ; renvoie les lignes « ✔ … ». */
export function monter(jeu: Shell, p: Projet, creerImage: (nom: string) => boolean): { lignes: string[]; erreur?: string } {
  const d = docker(jeu)!;
  const lignes: string[] = [];
  const reseau = `${p.nom}_default`;
  const reseaux: Record<string, true> = (jeu.etat.dockerReseaux ??= {});
  if (!reseaux[reseau]) {
    reseaux[reseau] = true;
    lignes.push(` ✔ Network ${reseau}  Created`);
  }
  for (const v of p.volumes) {
    const nom = `${p.nom}_${v}`;
    if (!d.volumes[nom]) {
      d.volumes[nom] = { cree: horloge(jeu), donnees: {} };
      lignes.push(` ✔ Volume "${nom}"  Created`);
    }
  }
  for (const s of ordre(p)) {
    if (!creerImage(s.image))
      return { lignes, erreur: `Error response from daemon: manifest for ${s.image} not found: manifest unknown: manifest unknown` };
    const nom = nomConteneur(p, s);
    const existant = conteneursDuProjet(d, p.nom).find((c) => c.service === s.nom);
    if (existant && existant.empreinte === empreinte(s)) {
      const echec = existant.etat !== 'running' ? lancer(jeu, existant) : null;
      if (echec) return { lignes, erreur: `Error response from daemon: ${echec}` };
      lignes.push(` ✔ Container ${nom}  ${existant.etat === 'running' ? 'Running' : 'Started'}`);
      continue;
    }
    if (existant) {
      stopper(jeu, existant);
      d.conteneurs = d.conteneurs.filter((c) => c !== existant);
    }
    const ports: Port[] = s.ports.map((x) => {
      const parties = x.replace(/\/tcp$/, '').split(':');
      const [ip, hote, conteneur] =
        parties.length === 3 ? parties : parties.length === 2 ? ['0.0.0.0', ...parties] : ['0.0.0.0', String(32768 + d.prochain), parties[0]];
      return { ip, hote: Number(hote), conteneur: Number(conteneur) };
    });
    const occupe = ports.find((x) => d.conteneurs.some((c) => c.etat === 'running' && c.ports.some((q) => q.hote === x.hote)));
    if (occupe)
      return {
        lignes,
        erreur: `Error response from daemon: driver failed programming external connectivity on endpoint ${nom} (${identifiant('ep' + nom)}): Bind for 0.0.0.0:${occupe.hote} failed: port is already allocated`,
      };
    const montages: Montage[] = s.volumes.map((v) => {
      const [source, cible, mode] = v.split(':');
      const bind = /^[./~]/.test(source);
      return {
        type: bind ? 'bind' : 'volume',
        source: bind ? jeu.resoudre(`${p.dossier}/${source}`) : `${p.nom}_${source}`,
        cible,
        lectureSeule: mode === 'ro',
      };
    });
    const c: ConteneurCompose = {
      id: identifiant(`compose-${nom}-${d.prochain++}`),
      nom,
      image: s.image.includes(':') ? s.image : `${s.image}:latest`,
      etat: 'created',
      code: 0,
      ports,
      montages,
      env: { ...s.env },
      redemarrage: s.redemarrage,
      cree: horloge(jeu),
      debut: 0,
      fin: 0,
      couche: {},
      journal: [],
      ip: `172.18.0.${conteneursDuProjet(d, p.nom).length + 2}`,
      projet: p.nom,
      service: s.nom,
      empreinte: empreinte(s),
      ...(s.utilisateur ? { utilisateur: s.utilisateur } : {}),
      ...(s.lectureSeule ? { lectureSeule: true } : {}),
      ...(s.capDrop.length ? { capDrop: s.capDrop } : {}),
      ...(s.securite.length ? { securite: s.securite } : {}),
    };
    d.conteneurs.push(c);
    const echec = lancer(jeu, c);
    if (echec)
      return { lignes: [...lignes, ` ✔ Container ${nom}  ${existant ? 'Recreated' : 'Created'}`], erreur: `Error response from daemon: ${echec}` };
    lignes.push(` ✔ Container ${nom}  ${existant ? 'Recreated' : 'Started'}`);
  }
  // Un service qui s'est arrêté au démarrage (sa dépendance n'était pas prête)
  // repart, comme le fait Docker, si sa politique de redémarrage le permet.
  for (const c of conteneursDuProjet(d, p.nom))
    if (c.etat === 'exited' && c.code !== 0 && ['always', 'unless-stopped', 'on-failure'].includes(c.redemarrage.split(':')[0])) lancer(jeu, c);
  return { lignes };
}

/** Le conteneur d'un service joignable par son nom depuis un autre conteneur du même projet. */
export function joindre(jeu: Jeu, depuis: Conteneur, hote: string): Conteneur | null {
  const d = docker(jeu)!;
  const projet = (depuis as ConteneurCompose).projet;
  if (!projet) return null;
  return conteneursDuProjet(d, projet).find((c) => c.service === hote || c.nom === hote) ?? null;
}
