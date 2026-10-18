// docker : la ligne de commande du moteur de conteneurs (docker.ts), avec
// les sorties et les messages de Docker 27
// (https://docs.docker.com/reference/cli/docker/).
// Écarts : sans -d, docker run rend la main (le conteneur continue) ; docker
// logs -f n'attend pas ; docker exec ne connaît que quelques commandes (ls,
// cat, env, id, whoami) ; --format seulement {{.Champ.Sous.champ}}.

import type { Shell } from '../shell';
import {
  APPLIS,
  complet,
  comptesImage,
  docker,
  ecrireDans,
  horloge,
  identifiant,
  identite,
  imageDu,
  lancer,
  noeudDans,
  lireDans,
  majDisque,
  listerDans,
  nomImage,
  rfc3339,
  stopper,
  tailleDocker,
  trouverConteneur,
  utilisateurImage,
  type Conteneur,
  type EtatDocker,
  type Montage,
  type Port,
} from '../docker';
import { systemd } from '../systemd';
import { conteneursDuProjet, ErreurYaml, lireProjet, monter, type Projet } from '../compose';
import type { Commande } from './index';

const SOCKET = 'permission denied while trying to connect to the Docker daemon socket at unix:///var/run/docker.sock';

/** Une durée comme units.HumanDuration de Docker : « 3 days », « About an hour ». */
export function duree(ms: number): string {
  const s = Math.round(ms / 1000);
  const m = Math.round(s / 60);
  const h = Math.round(m / 60);
  if (s < 1) return 'Less than a second';
  if (s === 1) return '1 second';
  if (s < 60) return `${s} seconds`;
  if (m === 1) return 'About a minute';
  if (m < 60) return `${m} minutes`;
  if (h === 1) return 'About an hour';
  if (h < 48) return `${h} hours`;
  if (h < 24 * 7 * 2) return `${Math.floor(h / 24)} days`;
  if (h < 24 * 30 * 2) return `${Math.floor(h / 24 / 7)} weeks`;
  if (h < 24 * 365 * 2) return `${Math.floor(h / 24 / 30)} months`;
  return `${Math.floor(h / 24 / 365)} years`;
}

const NOMS_A = ['brave', 'calm', 'eager', 'gentle', 'happy', 'jolly', 'keen', 'lucid', 'nifty', 'quirky'];
const NOMS_B = ['hopper', 'lovelace', 'noether', 'curie', 'turing', 'hamilton', 'germain', 'meitner', 'franklin', 'johnson'];

const ports = (c: Conteneur) =>
  c.ports
    .flatMap((p) =>
      p.ip === '0.0.0.0'
        ? [`0.0.0.0:${p.hote}->${p.conteneur}/tcp`, `[::]:${p.hote}->${p.conteneur}/tcp`]
        : [`${p.ip}:${p.hote}->${p.conteneur}/tcp`],
    )
    .join(', ');

function statut(c: Conteneur, maintenant: number): string {
  if (c.etat === 'running') return `Up ${duree(maintenant - c.debut)}`;
  // Un conteneur qui s'arrête en erreur et que sa politique relance sans fin.
  if (c.etat === 'exited' && c.code !== 0 && ['always', 'unless-stopped', 'on-failure'].includes(c.redemarrage.split(':')[0]))
    return `Restarting (${c.code}) ${duree(Math.min(maintenant - c.fin, 9000))} ago`;
  if (c.etat === 'exited') return `Exited (${c.code}) ${duree(maintenant - c.fin)} ago`;
  return 'Created';
}

// Un tableau aligné, colonnes séparées par trois espaces (comme docker).
function tableau(titres: string[], lignes: string[][]): string {
  const largeurs = titres.map((t, i) => Math.max(t.length, ...lignes.map((l) => l[i].length)));
  const ligne = (l: string[]) =>
    l
      .map((x, i) => (i === l.length - 1 ? x : x.padEnd(largeurs[i])))
      .join('   ')
      .trimEnd();
  return [ligne(titres), ...lignes.map(ligne)].join('\n');
}

const imageDe = (d: EtatDocker, c: Conteneur) => Object.values(d.images).find((i) => nomImage(i) === c.image);

function ps(d: EtatDocker, jeu: Shell, tous: boolean): string {
  const maintenant = horloge(jeu);
  const liste = d.conteneurs.filter((c) => tous || c.etat === 'running').reverse();
  return tableau(
    ['CONTAINER ID', 'IMAGE', 'COMMAND', 'CREATED', 'STATUS', 'PORTS', 'NAMES'],
    liste.map((c) => {
      const commande = imageDe(d, c)?.commande ?? '';
      return [
        c.id.slice(0, 12),
        c.image,
        `"${commande.length > 20 ? commande.slice(0, 19) + '…' : commande}"`,
        `${duree(maintenant - c.cree)} ago`,
        statut(c, maintenant),
        c.etat === 'running' ? ports(c) : '',
        c.nom,
      ];
    }),
  );
}

function images(d: EtatDocker, jeu: Shell): string {
  const maintenant = horloge(jeu);
  return tableau(
    ['REPOSITORY', 'TAG', 'IMAGE ID', 'CREATED', 'SIZE'],
    Object.values(d.images).map((i) => [i.depot, i.tag, i.id.slice(0, 12), `${duree(maintenant - i.cree)} ago`, tailleDocker(i.taille)]),
  );
}

// Télécharge une image depuis le registre ; renvoie la sortie, ou null si elle n'existe pas.
function tirer(d: EtatDocker, nom: string): string | null {
  const plein = complet(nom);
  const source = d.registre[plein];
  if (!source) return null;
  const [depot, tag] = [plein.slice(0, plein.lastIndexOf(':')), plein.slice(plein.lastIndexOf(':') + 1)];
  const deja = d.images[plein]?.id === source.id;
  if (deja)
    return `${tag}: Pulling from ${depot.split('/').slice(1).join('/') || depot}\nDigest: sha256:${identifiant('digest' + source.id)}\nStatus: Image is up to date for ${plein}\n${plein}`;
  d.images[plein] = { ...source };
  const couches = [identifiant('couche-a' + depot), identifiant('couche-b' + source.id), identifiant('couche-c' + source.id)].map((c) =>
    c.slice(0, 12),
  );
  const presentes = Object.values(d.images).some((i) => i.depot === depot && i.tag !== tag);
  return [
    `${tag}: Pulling from ${depot.split('/').slice(1).join('/') || depot}`,
    `${couches[0]}: ${presentes ? 'Already exists' : 'Pull complete'}`,
    `${couches[1]}: Pull complete`,
    `${couches[2]}: Pull complete`,
    `Digest: sha256:${identifiant('digest' + source.id)}`,
    `Status: Downloaded newer image for ${plein}`,
    plein,
  ].join('\n');
}

interface OptionsRun {
  detache: boolean;
  nom?: string;
  ports: string[];
  volumes: string[];
  env: string[];
  redemarrage: string;
  supprimer: boolean;
  utilisateur?: string;
  lectureSeule: boolean;
  capDrop: string[];
  securite: string[];
  image?: string;
  inconnue?: string;
}

function analyserRun(args: string[]): OptionsRun {
  const o: OptionsRun = {
    detache: false,
    ports: [],
    volumes: [],
    env: [],
    redemarrage: 'no',
    supprimer: false,
    lectureSeule: false,
    capDrop: [],
    securite: [],
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    const [cle, egal] = a.startsWith('--') && a.includes('=') ? [a.slice(0, a.indexOf('=')), a.slice(a.indexOf('=') + 1)] : [a, undefined];
    const valeur = () => egal ?? args[++i] ?? '';
    if (cle === '-d' || cle === '--detach') o.detache = true;
    else if (/^-[dit]+$/.test(cle)) o.detache ||= cle.includes('d');
    else if (cle === '--name') o.nom = valeur();
    else if (cle === '-p' || cle === '--publish') o.ports.push(valeur());
    else if (cle === '-v' || cle === '--volume') o.volumes.push(valeur());
    else if (cle === '-e' || cle === '--env') o.env.push(valeur());
    else if (cle === '--restart') o.redemarrage = valeur();
    else if (cle === '--rm') o.supprimer = true;
    else if (cle === '-u' || cle === '--user') o.utilisateur = valeur();
    else if (cle === '--read-only') o.lectureSeule = true;
    else if (cle === '--cap-drop') o.capDrop.push(valeur());
    else if (cle === '--security-opt') o.securite.push(valeur());
    else if (cle === '--interactive' || cle === '--tty') continue;
    else if (cle.startsWith('-')) {
      o.inconnue = cle;
      return o;
    } else {
      // L'image, puis la commande (ignorée ici).
      o.image = a;
      return o;
    }
  }
  return o;
}

function run(d: EtatDocker, jeu: Shell, args: string[]): string {
  const o = analyserRun(args);
  if (o.inconnue) return jeu.erreur(`unknown flag: ${o.inconnue}\nSee 'docker run --help'.`);
  if (!o.image)
    return jeu.erreur(
      `docker: 'docker run' requires at least 1 argument.\n\nUsage:  docker run [OPTIONS] IMAGE [COMMAND] [ARG...]\n\nSee 'docker run --help' for more information`,
    );
  if (!['no', 'always', 'unless-stopped', 'on-failure'].includes(o.redemarrage.split(':')[0]))
    return jeu.erreur(`docker: invalid restart policy format: ${o.redemarrage}\n\nRun 'docker run --help' for more information`);
  const sortie: string[] = [];
  const plein = complet(o.image);
  if (!d.images[plein]) {
    const tire = tirer(d, o.image);
    if (!tire) {
      return jeu.erreur(
        `Unable to find image '${plein}' locally\ndocker: Error response from daemon: manifest for ${plein} not found: manifest unknown: manifest unknown\n\nRun 'docker run --help' for more information`,
      );
    }
    sortie.push(`Unable to find image '${plein}' locally`, tire);
  }
  const image = d.images[plein];
  const nom = o.nom ?? `${NOMS_A[d.prochain % NOMS_A.length]}_${NOMS_B[(d.prochain * 3) % NOMS_B.length]}`;
  const existant = d.conteneurs.find((c) => c.nom === nom);
  if (existant)
    return jeu.erreur(
      `docker: Error response from daemon: Conflict. The container name "/${nom}" is already in use by container "${existant.id}". You have to remove (or rename) that container to be able to reuse that name.\n\nRun 'docker run --help' for more information`,
    );
  // -p [ip:]hôte:conteneur, ou -p conteneur (port de la machine au hasard).
  const publies: Port[] = [];
  for (const p of o.ports) {
    const parties = p.replace(/\/tcp$/, '').split(':');
    const [ip, hote, conteneur] =
      parties.length === 3 ? parties : parties.length === 2 ? ['0.0.0.0', ...parties] : ['0.0.0.0', String(32768 + d.prochain), parties[0]];
    if (!/^\d+$/.test(hote) || !/^\d+$/.test(conteneur))
      return jeu.erreur(`docker: invalid publish opts format (should be name=value but got '${p}')\n\nRun 'docker run --help' for more information`);
    publies.push({ ip, hote: Number(hote), conteneur: Number(conteneur) });
  }
  // -v nom:/chemin (volume) ou /dossier:/chemin (dossier de la machine), :ro en lecture seule.
  const montages: Montage[] = [];
  for (const v of o.volumes) {
    const [source, cible, mode] = v.split(':');
    if (!cible || !cible.startsWith('/'))
      return jeu.erreur(
        `docker: Error response from daemon: invalid volume specification: '${v}': invalid mount config for type "volume": invalid mount path: '${cible ?? ''}' mount path must be absolute\n\nRun 'docker run --help' for more information`,
      );
    const bind = source.startsWith('/') || source.startsWith('.') || source.startsWith('~');
    if (bind) {
      const chemin = jeu.resoudre(source);
      // Docker crée le dossier de la machine s'il n'existe pas (à root).
      if (!jeu.existe(chemin)) {
        const avant = jeu.qui;
        jeu.qui = 'root';
        jeu.placer('docker', chemin, { type: 'dossier', enfants: {}, proprio: 'root' });
        jeu.qui = avant;
      }
      montages.push({ type: 'bind', source: chemin, cible, lectureSeule: mode === 'ro' });
    } else {
      d.volumes[source] ??= { cree: horloge(jeu), donnees: {} };
      montages.push({ type: 'volume', source, cible, lectureSeule: mode === 'ro' });
    }
  }
  const id = identifiant(`conteneur-${d.prochain}-${nom}`);
  d.prochain++;
  const c: Conteneur = {
    id,
    nom,
    image: plein,
    etat: 'created',
    code: 0,
    ports: publies,
    montages,
    env: Object.fromEntries(o.env.map((e) => [e.split('=')[0], e.split('=').slice(1).join('=')])),
    redemarrage: o.redemarrage,
    cree: horloge(jeu),
    debut: 0,
    fin: 0,
    couche: { ...(APPLIS[image.appli]?.fichiers?.(image) ?? {}) },
    journal: [],
    ip: `172.17.0.${d.conteneurs.filter((x) => x.etat === 'running').length + 2}`,
    ...(o.utilisateur ? { utilisateur: o.utilisateur } : {}),
    ...(o.lectureSeule ? { lectureSeule: true } : {}),
    ...(o.capDrop.length ? { capDrop: o.capDrop } : {}),
    ...(o.securite.length ? { securite: o.securite } : {}),
  };
  // Un port de la machine déjà publié par un conteneur qui tourne : refus au démarrage.
  const occupe = publies.find((p) => d.conteneurs.some((x) => x.etat === 'running' && x.ports.some((q) => q.hote === p.hote)));
  d.conteneurs.push(c);
  if (occupe) {
    return jeu.erreur(
      [
        ...sortie,
        `docker: Error response from daemon: driver failed programming external connectivity on endpoint ${nom} (${identifiant('ep' + id)}): Bind for 0.0.0.0:${occupe.hote} failed: port is already allocated.`,
        '',
        "Run 'docker run --help' for more information",
      ].join('\n'),
    );
  }
  const echec = lancer(jeu, c);
  if (echec)
    return jeu.erreur([...sortie, `docker: Error response from daemon: ${echec}.`, '', "Run 'docker run --help' for more information"].join('\n'));
  jeu.etat.dockerRun = (jeu.etat.dockerRun ?? 0) + 1;
  if (o.detache) return [...sortie, id].join('\n');
  // Sans -d, docker resterait attaché au conteneur : on montre son journal.
  return [...sortie, ...c.journal.map((l) => l.texte), jeu.t('docker-attache')].join('\n');
}

// docker cp conteneur:chemin chemin_machine, ou l'inverse.
function cp(d: EtatDocker, jeu: Shell, args: string[]): string {
  const [source, dest] = args.filter((a) => !a.startsWith('-'));
  if (!source || !dest)
    return jeu.erreur(
      `docker: 'docker cp' requires 2 arguments.\n\nUsage:  docker cp [OPTIONS] CONTAINER:SRC_PATH DEST_PATH|-\n\tdocker cp [OPTIONS] SRC_PATH|- CONTAINER:DEST_PATH`,
    );
  const cote = (x: string) => (/^[\w.-]+:\//.test(x) ? { conteneur: x.slice(0, x.indexOf(':')), chemin: x.slice(x.indexOf(':') + 1) } : null);
  const de = cote(source);
  const vers = cote(dest);
  if (!!de === !!vers) return jeu.erreur('must specify at least one container source');
  let octets = 0;
  if (de) {
    const c = trouverConteneur(d, de.conteneur);
    if (!c) return jeu.erreur(`Error response from daemon: No such container: ${de.conteneur}`);
    const base = de.chemin.replace(/\/\.?$/, '');
    const fichiers = lireDans(jeu, c, base) !== null ? [base] : listerDans(jeu, c, base);
    if (!fichiers.length) return jeu.erreur(`Error response from daemon: Could not find the file ${de.chemin} in container ${de.conteneur}`);
    const unFichier = fichiers.length === 1 && fichiers[0] === base;
    const lieuDest = jeu.resoudre(dest);
    const existe = jeu.trouver(lieuDest);
    // Un dossier copié vers un lieu qui existe : il y garde son nom (sauf avec /.).
    const racine = unFichier
      ? existe?.type === 'dossier'
        ? `${lieuDest}/${base.split('/').at(-1)}`
        : lieuDest
      : existe?.type === 'dossier' && !de.chemin.endsWith('/.')
        ? `${lieuDest}/${base.split('/').at(-1)}`
        : lieuDest;
    if (!unFichier && !jeu.existe(racine)) {
      const e = jeu.placer('docker', racine, { type: 'dossier', enfants: {}, proprio: jeu.qui });
      if (e) return jeu.erreur(e);
    }
    for (const f of fichiers) {
      const contenu = lireDans(jeu, c, f) ?? '';
      const cible = unFichier ? racine : `${racine}/${f.slice(base.length + 1)}`;
      const e = jeu.placer('docker', cible, { type: 'fichier', contenu, lignes: true, proprio: jeu.qui });
      if (e) return jeu.erreur(e);
      octets += new TextEncoder().encode(contenu).length;
    }
    jeu.etat.dockerCopie = (jeu.etat.dockerCopie ?? 0) + 1;
    return `Successfully copied ${tailleDocker(octets)} to ${lieuDest}`;
  }
  const c = trouverConteneur(d, vers!.conteneur);
  if (!c) return jeu.erreur(`Error response from daemon: No such container: ${vers!.conteneur}`);
  const n = jeu.trouver(source);
  if (!n) return jeu.erreur(`lstat ${jeu.resoudre(source)}: no such file or directory`);
  const cibleBase = vers!.chemin.replace(/\/\.?$/, '');
  const copier = (chemin: string, cible: string): string | null => {
    const x = jeu.trouver(chemin);
    if (x?.type === 'fichier') {
      const contenu = jeu.lire(chemin) ?? '';
      octets += new TextEncoder().encode(contenu).length;
      return ecrireDans(jeu, c, cible, contenu);
    }
    if (x?.type === 'dossier')
      for (const k of Object.keys(x.enfants)) {
        const e: string | null = copier(`${chemin}/${k}`, `${cible}/${k}`);
        if (e) return e;
      }
    return null;
  };
  // Le contenu d'un dossier (source/.) va directement dans la cible.
  const versLieu = n.type === 'dossier' && !source.endsWith('/.') ? `${cibleBase}/${jeu.resoudre(source).split('/').at(-1)}` : cibleBase;
  const e = copier(jeu.resoudre(source), n.type === 'fichier' && listerDans(jeu, c, cibleBase).length ? `${cibleBase}/${jeu.nom(source)}` : versLieu);
  if (e) return jeu.erreur(`Error response from daemon: ${e}`);
  return `Successfully copied ${tailleDocker(octets)} to ${vers!.conteneur}:${vers!.chemin}`;
}

function exec(d: EtatDocker, jeu: Shell, args: string[]): string {
  // Les options avant le conteneur : -i, -t, -it, -u utilisateur (--user).
  let i = 0;
  let demande: string | undefined;
  for (; i < args.length && args[i].startsWith('-'); i++) {
    if (args[i] === '-u' || args[i] === '--user') demande = args[++i];
    else if (args[i].startsWith('--user=')) demande = args[i].slice(7);
  }
  const [nom, commande, ...params] = args.slice(i);
  if (!nom || !commande)
    return jeu.erreur(`docker: 'docker exec' requires at least 2 arguments.\n\nUsage:  docker exec [OPTIONS] CONTAINER COMMAND [ARG...]`);
  const c = trouverConteneur(d, nom);
  if (!c) return jeu.erreur(`Error response from daemon: No such container: ${nom}`);
  if (c.etat !== 'running') return jeu.erreur(`Error response from daemon: container ${c.id} is not running`);
  const image = imageDe(d, c)!;
  const id = identite(image, c, demande);
  if ('erreur' in id) return jeu.erreur(`Error response from daemon: ${id.erreur}`);
  if (commande === 'env')
    return [
      `PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin`,
      `HOSTNAME=${c.id.slice(0, 12)}`,
      ...Object.entries(c.env).map(([k, v]) => `${k}=${v}`),
    ].join('\n');
  const avecNom = (n: number, nomDe: string | null) => (nomDe === null ? String(n) : `${n}(${nomDe})`);
  if (commande === 'id') return `uid=${avecNom(id.uid, id.nom)} gid=${avecNom(id.gid, id.groupe)} groups=${avecNom(id.gid, id.groupe)}`;
  if (commande === 'whoami') return id.nom ?? jeu.erreur(`whoami: cannot find name for user ID ${id.uid}`);
  if (commande === 'cat') {
    const sorties: string[] = [];
    for (const p of params) {
      const contenu = lireDans(jeu, c, p);
      if (contenu === null) {
        const dedans = listerDans(jeu, c, p);
        jeu.erreur(`cat: ${p}: ${dedans.length ? 'Is a directory' : 'No such file or directory'}`);
      } else sorties.push(contenu);
    }
    return sorties.join('\n');
  }
  if (commande === 'ls') {
    const long = params.some((p) => /^-\w*l/.test(p));
    const lieu = params.find((p) => !p.startsWith('-')) ?? '/';
    const fichiers = lireDans(jeu, c, lieu) !== null ? [lieu] : listerDans(jeu, c, lieu);
    if (!fichiers.length && lireDans(jeu, c, lieu) === null && !c.montages.some((m) => m.cible === lieu.replace(/\/$/, '')))
      return jeu.erreur(`ls: cannot access '${lieu}': No such file or directory`);
    const noms = [...new Set(fichiers.map((f) => (f === lieu ? f : f.slice(lieu.replace(/\/$/, '').length + 1).split('/')[0])))].sort();
    if (!long) return noms.join('  ');
    // Le propriétaire vu du conteneur : le nom de son uid dans l'image (sinon le numéro).
    const comptes = comptesImage(image);
    const nomDans = (uid: number) => Object.entries(comptes).find(([, x]) => x === uid)?.[0] ?? String(uid);
    const parDefaut = utilisateurImage(image);
    return noms
      .map((n) => {
        const chemin = `${lieu.replace(/\/$/, '')}/${n}`;
        const hote = noeudDans(jeu, c, chemin);
        const uid = hote ? (jeu.comptes.utilisateurs[hote.proprio ?? 'vous']?.uid ?? Number(hote.proprio)) : (comptes[parDefaut] ?? 0);
        const proprio = Number.isNaN(uid) ? 'root' : nomDans(uid);
        const dossier = hote?.type === 'dossier';
        const mode = hote?.mode ?? (dossier ? 'rwxr-xr-x' : 'rw-r--r--');
        const taille = dossier
          ? 4096
          : hote?.type === 'fichier' && hote.taille !== undefined
            ? hote.taille
            : new TextEncoder().encode(lireDans(jeu, c, chemin) ?? '').length;
        return `${dossier ? 'd' : '-'}${mode} 1 ${proprio} ${proprio} ${String(taille).padStart(6)} ${n}`;
      })
      .join('\n');
  }
  return jeu.erreur(
    `OCI runtime exec failed: exec failed: unable to start container process: exec: "${commande}": executable file not found in $PATH: unknown`,
  );
}

// ——— Le disque : system df, prune, rmi ———

const utilisees = (d: EtatDocker) => new Set(d.conteneurs.map((c) => c.image));
const volumesUtilises = (d: EtatDocker) => new Set(d.conteneurs.flatMap((c) => c.montages.filter((m) => m.type === 'volume').map((m) => m.source)));
const tailleVolume = (v: EtatDocker['volumes'][string]) => Object.values(v.donnees).reduce((t, x) => t + x.length, 0) + (v.taille ?? 0);

function systemeDf(d: EtatDocker): string {
  const imgs = Object.values(d.images);
  const enService = utilisees(d);
  const taille = imgs.reduce((t, i) => t + i.taille, 0);
  const libre = imgs.filter((i) => !enService.has(nomImage(i))).reduce((t, i) => t + i.taille, 0);
  const volumes = Object.entries(d.volumes);
  const vUtilises = volumesUtilises(d);
  const tailleVolumes = volumes.reduce((t, [, v]) => t + tailleVolume(v), 0);
  const vLibre = volumes.filter(([n]) => !vUtilises.has(n)).reduce((t, [, v]) => t + tailleVolume(v), 0);
  const pourcent = (a: number, b: number) => `${tailleDocker(a)} (${b ? Math.round((a / b) * 100) : 0}%)`;
  const arretes = d.conteneurs.filter((c) => c.etat !== 'running');
  return tableau(
    ['TYPE', 'TOTAL', 'ACTIVE', 'SIZE', 'RECLAIMABLE'],
    [
      ['Images', String(imgs.length), String(imgs.filter((i) => enService.has(nomImage(i))).length), tailleDocker(taille), pourcent(libre, taille)],
      [
        'Containers',
        String(d.conteneurs.length),
        String(d.conteneurs.length - arretes.length),
        tailleDocker(d.conteneurs.length * 4096),
        pourcent(arretes.length * 4096, d.conteneurs.length * 4096),
      ],
      ['Local Volumes', String(volumes.length), String(vUtilises.size), tailleDocker(tailleVolumes), pourcent(vLibre, tailleVolumes)],
      ['Build Cache', '0', '0', '0B', '0B'],
    ],
  );
}

const AVERTISSEMENTS = {
  image: 'WARNING! This will remove all dangling images.',
  imageTout: 'WARNING! This will remove all images without at least one container associated to them.',
  container: 'WARNING! This will remove all stopped containers.',
  volume: 'WARNING! This will remove anonymous local volumes not used by at least one container.',
  volumeTout: 'WARNING! This will remove all local volumes not used by at least one container.',
};

// docker image|container|volume|system prune : demande confirmation, sauf avec -f.
function elaguer(d: EtatDocker, jeu: Shell, quoi: 'image' | 'container' | 'volume' | 'system', options: string[]): string {
  const tout = options.some((o) => o === '-a' || o === '--all');
  const force = options.some((o) => o === '-f' || o === '--force');
  const avecVolumes = options.includes('--volumes');
  const faire = (): string => {
    const lignes: string[] = [];
    let recupere = 0;
    if (quoi === 'container' || quoi === 'system') {
      const arretes = d.conteneurs.filter((c) => c.etat !== 'running');
      d.conteneurs = d.conteneurs.filter((c) => c.etat === 'running');
      if (arretes.length) lignes.push('Deleted Containers:', ...arretes.map((c) => c.id), '');
      recupere += arretes.length * 4096;
    }
    if (quoi === 'image' || quoi === 'system') {
      const enService = utilisees(d);
      const parties = Object.entries(d.images).filter(([, i]) => !enService.has(nomImage(i)) && (tout || i.depot === '<none>'));
      for (const [cle] of parties) delete d.images[cle];
      if (parties.length)
        lignes.push(
          'Deleted Images:',
          ...parties.flatMap(([, i]) => [...(i.depot === '<none>' ? [] : [`untagged: ${nomImage(i)}`]), `deleted: sha256:${i.id}`]),
          '',
        );
      recupere += parties.reduce((t, [, i]) => t + i.taille, 0);
    }
    // Les volumes nommés ne partent qu'avec volume prune -a (depuis Docker 23).
    if (quoi === 'volume' && tout) {
      const enService = volumesUtilises(d);
      const partis = Object.keys(d.volumes).filter((n) => !enService.has(n));
      recupere += partis.reduce((t, n) => t + tailleVolume(d.volumes[n]), 0);
      for (const n of partis) delete d.volumes[n];
      if (partis.length) lignes.push('Deleted Volumes:', ...partis, '');
      jeu.etat.dockerVolumesElagues = [...(jeu.etat.dockerVolumesElagues ?? []), ...partis];
    }
    majDisque(jeu);
    return [...lignes, `Total reclaimed space: ${tailleDocker(recupere)}`].join('\n');
  };
  const avertissement =
    quoi === 'system'
      ? [
          'WARNING! This will remove:',
          '  - all stopped containers',
          '  - all networks not used by at least one container',
          ...(avecVolumes ? ['  - all anonymous volumes not used by at least one container'] : []),
          tout ? '  - all images without at least one container associated to them' : '  - all dangling images',
          '  - unused build cache',
          '',
        ].join('\n')
      : quoi === 'image'
        ? tout
          ? AVERTISSEMENTS.imageTout
          : AVERTISSEMENTS.image
        : quoi === 'volume'
          ? tout
            ? AVERTISSEMENTS.volumeTout
            : AVERTISSEMENTS.volume
          : AVERTISSEMENTS.container;
  if (force) return faire();
  jeu.demander('Are you sure you want to continue? [y/N] ', (reponse) => (/^y(es)?$/i.test(reponse) ? faire() : ''));
  return avertissement;
}

// docker rmi : une image utilisée par un conteneur (même arrêté) est protégée.
function rmi(d: EtatDocker, jeu: Shell, args: string[]): string {
  const force = args.some((a) => a === '-f' || a === '--force');
  const lignes: string[] = [];
  for (const nom of args.filter((a) => !a.startsWith('-'))) {
    const cle = Object.keys(d.images).find((k) => k === complet(nom) || d.images[k].id.startsWith(nom));
    if (!cle) {
      jeu.erreur(`Error response from daemon: No such image: ${complet(nom)}`);
      continue;
    }
    const i = d.images[cle];
    const conteneur = d.conteneurs.find((c) => c.image === nomImage(i));
    if (conteneur && !force) {
      jeu.erreur(
        `Error response from daemon: conflict: unable to remove repository reference "${nom}" (must force) - container ${conteneur.id.slice(0, 12)} is using its referenced image ${i.id.slice(0, 12)}`,
      );
      continue;
    }
    delete d.images[cle];
    lignes.push(...(i.depot === '<none>' ? [] : [`Untagged: ${nomImage(i)}`]), `Deleted: sha256:${i.id}`);
  }
  return lignes.join('\n');
}

// ——— docker compose ———

function compose(d: EtatDocker, jeu: Shell, args: string[]): string {
  const sorties: string[] = [];
  let dossier = jeu.cwd;
  const reste: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-f' || args[i] === '--file') dossier = jeu.resoudre(args[++i] ?? '.').replace(/\/[^/]+$/, '');
    else if (args[i] === '--project-directory') dossier = jeu.resoudre(args[++i] ?? '.');
    else reste.push(args[i]);
  }
  const [action, ...options] = reste;
  if (!action) return jeu.erreur(jeu.t('compose-usage'));
  let projet: Projet;
  try {
    projet = lireProjet(jeu, dossier);
  } catch (e) {
    if (e instanceof ErreurYaml) return jeu.erreur(e.message);
    throw e;
  }
  const avertir = () => projet.avertissements.map((a) => `WARN[0000] ${a}`);
  const conteneurs = () => conteneursDuProjet(d, projet.nom);
  const service = (nom?: string) => conteneurs().find((c) => c.service === nom);
  switch (action) {
    case 'config':
      return [...avertir(), afficherProjet(projet)].join('\n');
    case 'up': {
      const detache = options.some((o) => o === '-d' || o === '--detach');
      const { lignes, erreur } = monter(jeu, projet, (image) => !!d.images[complet(image)] || tirer(d, image) !== null);
      jeu.etat.composeUp = (jeu.etat.composeUp ?? 0) + 1;
      const tete = [...avertir(), `[+] Running ${lignes.length}/${lignes.length}`, ...lignes];
      if (erreur) return jeu.erreur([...tete, erreur].join('\n'));
      if (detache) return tete.join('\n');
      const journaux = conteneurs().flatMap((c) => c.journal.map((l) => `${c.service.padEnd(6)} | ${l.texte}`));
      return [
        ...tete,
        `Attaching to ${conteneurs()
          .map((c) => c.nom)
          .join(', ')}`,
        ...journaux,
        jeu.t('docker-attache'),
      ].join('\n');
    }
    case 'down': {
      const volumes = options.some((o) => o === '-v' || o === '--volumes');
      const lignes: string[] = [];
      for (const c of [...conteneurs()].reverse()) {
        stopper(jeu, c);
        d.conteneurs = d.conteneurs.filter((x) => x !== c);
        lignes.push(` ✔ Container ${c.nom}  Removed`);
      }
      // down -v efface aussi les volumes du projet : leurs données sont perdues.
      if (volumes)
        for (const v of projet.volumes) {
          const nom = `${projet.nom}_${v}`;
          if (d.volumes[nom]) {
            delete d.volumes[nom];
            lignes.push(` ✔ Volume ${nom}  Removed`);
            jeu.etat.composeVolumesEffaces = true;
          }
        }
      const reseaux: Record<string, true> = jeu.etat.dockerReseaux ?? {};
      if (reseaux[`${projet.nom}_default`]) {
        delete reseaux[`${projet.nom}_default`];
        lignes.push(` ✔ Network ${projet.nom}_default  Removed`);
      }
      return [...avertir(), `[+] Running ${lignes.length}/${lignes.length}`, ...lignes].join('\n');
    }
    case 'ps': {
      const maintenant = horloge(jeu);
      // Sans -a : ceux qui tournent, et ceux que leur politique relance en boucle.
      const enBoucle = (c: Conteneur) => c.code !== 0 && ['always', 'unless-stopped', 'on-failure'].includes(c.redemarrage.split(':')[0]);
      const liste = conteneurs().filter((c) => options.includes('-a') || options.includes('--all') || c.etat === 'running' || enBoucle(c));
      return [
        ...avertir(),
        tableau(
          ['NAME', 'IMAGE', 'COMMAND', 'SERVICE', 'CREATED', 'STATUS', 'PORTS'],
          liste.map((c) => {
            const commande = imageDe(d, c)?.commande ?? '';
            return [
              c.nom,
              c.image,
              `"${commande.length > 20 ? commande.slice(0, 19) + '…' : commande}"`,
              c.service,
              `${duree(maintenant - c.cree)} ago`,
              statut(c, maintenant),
              c.etat === 'running' ? ports(c) : '',
            ];
          }),
        ),
      ].join('\n');
    }
    case 'logs': {
      const nom = options.find((o, i) => !o.startsWith('-') && !['-n', '--tail'].includes(options[i - 1]));
      const liste = nom ? conteneurs().filter((c) => c.service === nom) : conteneurs();
      if (nom && !liste.length) return jeu.erreur(`no such service: ${nom}`);
      const largeur = Math.max(...liste.map((c) => c.nom.length));
      return liste.flatMap((c) => c.journal.map((l) => `${c.nom.padEnd(largeur)}  | ${l.texte}`)).join('\n');
    }
    case 'restart':
    case 'stop':
    case 'start': {
      const noms = options.filter((o) => !o.startsWith('-'));
      const liste = noms.length ? conteneurs().filter((c) => noms.includes(c.service)) : conteneurs();
      for (const c of liste) {
        if (action !== 'start') stopper(jeu, c);
        const echec = action !== 'stop' ? lancer(jeu, c) : null;
        if (echec) return jeu.erreur(`Error response from daemon: ${echec}`);
      }
      const verbe = { restart: 'Started', stop: 'Stopped', start: 'Started' }[action];
      return [
        ...avertir(),
        `[+] ${action === 'stop' ? 'Stopping' : 'Restarting'} ${liste.length}/${liste.length}`,
        ...liste.map((c) => ` ✔ Container ${c.nom}  ${verbe}`),
      ].join('\n');
    }
    case 'exec': {
      const [nom, ...commande] = options.filter((o) => !/^-[it]+$/.test(o));
      const c = service(nom);
      if (!c) return jeu.erreur(`service "${nom ?? ''}" is not running`);
      return exec(d, jeu, [c.nom, ...commande]);
    }
    case 'pull':
      for (const s of projet.services) (sorties.push(` ✔ ${s.nom} Pulled`), tirer(d, s.image));
      return [...avertir(), `[+] Pulling ${projet.services.length}/${projet.services.length}`, ...sorties].join('\n');
    default:
      return jeu.erreur(`unknown docker command: "compose ${action}"`);
  }
}

// docker compose config : le projet tel que Compose l'a compris (variables remplacées).
function afficherProjet(p: Projet): string {
  const lignes = [`name: ${p.nom}`, 'services:'];
  for (const s of p.services) {
    lignes.push(`  ${s.nom}:`);
    if (s.capDrop.length) lignes.push('    cap_drop:', ...s.capDrop.map((x) => `      - ${x}`));
    if (s.dependances.length)
      lignes.push('    depends_on:', ...s.dependances.map((d) => `      ${d}:\n        condition: service_started\n        required: true`));
    if (Object.keys(s.env).length) lignes.push('    environment:', ...Object.entries(s.env).map(([k, v]) => `      ${k}: ${v === '' ? '""' : v}`));
    lignes.push(`    image: ${s.image}`, '    networks:', '      default: null');
    if (s.ports.length) lignes.push('    ports:', ...s.ports.map((x) => `      - ${x}`));
    if (s.lectureSeule) lignes.push('    read_only: true');
    if (s.redemarrage !== 'no') lignes.push(`    restart: ${s.redemarrage}`);
    if (s.securite.length) lignes.push('    security_opt:', ...s.securite.map((x) => `      - ${x}`));
    if (s.utilisateur) lignes.push(`    user: ${s.utilisateur}`);
    if (s.volumes.length) lignes.push('    volumes:', ...s.volumes.map((v) => `      - ${v}`));
  }
  lignes.push('networks:', '  default:', `    name: ${p.nom}_default`);
  if (p.volumes.length) lignes.push('volumes:', ...p.volumes.flatMap((v) => [`  ${v}:`, `    name: ${p.nom}_${v}`]));
  return lignes.join('\n');
}

// --format '{{.State.Status}}' : un chemin dans l'objet JSON.
function formatGo(objet: unknown, modele: string): string {
  return modele.replace(/\{\{\s*(json\s+)?\.([\w.]*)\s*\}\}/g, (_, json: string | undefined, chemin: string) => {
    let v: unknown = objet;
    for (const p of chemin.split('.').filter(Boolean)) v = (v as Record<string, unknown> | undefined)?.[p];
    if (json || (typeof v === 'object' && v !== null)) return JSON.stringify(v);
    return v === undefined ? '<no value>' : String(v);
  });
}

function inspecter(jeu: Shell, c: Conteneur) {
  return {
    Id: c.id,
    Created: rfc3339(c.cree),
    State: { Status: c.etat, Running: c.etat === 'running', ExitCode: c.code, StartedAt: c.debut ? rfc3339(c.debut) : '0001-01-01T00:00:00Z' },
    Image: c.image,
    Name: `/${c.nom}`,
    HostConfig: {
      RestartPolicy: { Name: c.redemarrage.split(':')[0], MaximumRetryCount: Number(c.redemarrage.split(':')[1] ?? 0) },
      ReadonlyRootfs: !!c.lectureSeule,
      CapDrop: c.capDrop ?? null,
      SecurityOpt: c.securite ?? null,
      PortBindings: Object.fromEntries(
        c.ports.map((p) => [`${p.conteneur}/tcp`, [{ HostIp: p.ip === '0.0.0.0' ? '' : p.ip, HostPort: String(p.hote) }]]),
      ),
    },
    Mounts: c.montages.map((m) => ({
      Type: m.type,
      ...(m.type === 'volume' ? { Name: m.source, Source: `/var/lib/docker/volumes/${m.source}/_data` } : { Source: m.source }),
      Destination: m.cible,
      RW: !m.lectureSeule,
    })),
    Config: {
      Image: c.image,
      User: c.utilisateur ?? (utilisateurImage(imageDu(jeu, c)) === 'root' ? '' : utilisateurImage(imageDu(jeu, c))),
      Env: Object.entries(c.env).map(([k, v]) => `${k}=${v}`),
    },
    NetworkSettings: { IPAddress: c.ip },
  };
}

const AIDE = (jeu: Shell) => jeu.erreur(jeu.t('docker-usage'));

export const DOCKER: Record<string, Commande> = {
  // Le paquet docker-compose de Debian : la même chose que docker compose.
  'docker-compose': {
    propresOptions: true,
    lancer: (contexte) => DOCKER.docker.lancer({ ...contexte, args: ['compose', ...contexte.args] }),
  },
  docker: {
    propresOptions: true,
    lancer: ({ args, jeu }) => {
      if (args[0] === '--version' || args[0] === '-v') return 'Docker version 27.5.1, build 9f9e405';
      const d = docker(jeu);
      if (!d) return jeu.erreur(jeu.t('commande-introuvable', { commande: 'docker' }));
      // Le groupe docker donne les droits de root sur la machine : ici, sudo.
      if (jeu.qui !== 'root' && !jeu.groupesDe(jeu.qui).includes('docker'))
        return jeu.erreur(
          `${SOCKET}: Get "http://%2Fvar%2Frun%2Fdocker.sock/v1.47/containers/json": dial unix /var/run/docker.sock: connect: permission denied`,
        );
      if (systemd(jeu)?.services.docker && systemd(jeu)!.services.docker.etat !== 'active')
        return jeu.erreur('Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?');
      // Chaque commande prend un peu de temps (l'horloge de la machine avance).
      const sd = systemd(jeu);
      if (sd) sd.horloge += 2000;
      const sortie = executer(d, jeu, args);
      majDisque(jeu);
      return sortie;
    },
  },
};

function executer(d: EtatDocker, jeu: Shell, args: string[]): string {
  let [action, ...reste] = args;
  // docker container ls, docker image ls, docker container rm… : les mêmes commandes.
  if (action === 'container' || action === 'image') {
    const groupe = action;
    const sous = reste.shift() ?? '';
    action =
      sous === 'ls' || sous === 'list'
        ? groupe === 'container'
          ? 'ps'
          : 'images'
        : sous === 'prune'
          ? `${groupe}-prune`
          : groupe === 'image' && sous === 'rm'
            ? 'rmi'
            : sous;
  }
  switch (action) {
    case 'system':
      if (reste[0] === 'df') return systemeDf(d);
      if (reste[0] === 'prune') return elaguer(d, jeu, 'system', reste.slice(1));
      return jeu.erreur(`docker: unknown command: docker system ${reste[0] ?? ''}`);
    case 'image-prune':
      return elaguer(d, jeu, 'image', reste);
    case 'container-prune':
      return elaguer(d, jeu, 'container', reste);
    case 'rmi':
      return rmi(d, jeu, reste);
    case 'ps':
      return ps(d, jeu, reste.includes('-a') || reste.includes('--all'));
    case 'images':
      return images(d, jeu);
    case 'pull': {
      const nom = reste.find((a) => !a.startsWith('-'));
      if (!nom) return jeu.erreur(`"docker pull" requires exactly 1 argument.`);
      return tirer(d, nom) ?? jeu.erreur(`Error response from daemon: manifest for ${complet(nom)} not found: manifest unknown: manifest unknown`);
    }
    case 'run':
      return run(d, jeu, reste);
    case 'start':
    case 'stop':
    case 'restart':
    case 'rm': {
      const force = reste.some((a) => a === '-f' || a === '--force');
      const noms = reste.filter((a) => !a.startsWith('-'));
      if (!noms.length) return jeu.erreur(`"docker ${action}" requires at least 1 argument.`);
      const sorties: string[] = [];
      for (const nom of noms) {
        const c = trouverConteneur(d, nom);
        if (!c) {
          jeu.erreur(`Error response from daemon: No such container: ${nom}`);
          continue;
        }
        if (action === 'rm') {
          if (c.etat === 'running' && !force) {
            jeu.erreur(
              `Error response from daemon: cannot remove container "/${c.nom}": container is running: stop the container before removing or force remove`,
            );
            continue;
          }
          // La couche du conteneur disparaît avec lui ; les volumes restent.
          d.conteneurs = d.conteneurs.filter((x) => x !== c);
          jeu.etat.dockerSupprimes = [...(jeu.etat.dockerSupprimes ?? []), c];
        } else {
          if (action !== 'start') stopper(jeu, c);
          if (action !== 'stop') {
            const occupe = c.ports.find((p) => d.conteneurs.some((x) => x !== c && x.etat === 'running' && x.ports.some((q) => q.hote === p.hote)));
            if (occupe) {
              jeu.erreur(
                `Error response from daemon: driver failed programming external connectivity on endpoint ${c.nom} (${identifiant('ep' + c.id)}): Bind for 0.0.0.0:${occupe.hote} failed: port is already allocated\nError: failed to start containers: ${nom}`,
              );
              continue;
            }
            const echec = lancer(jeu, c);
            if (echec) {
              jeu.erreur(`Error response from daemon: ${echec}\nError: failed to start containers: ${nom}`);
              continue;
            }
          }
        }
        sorties.push(nom);
      }
      return sorties.join('\n');
    }
    case 'logs': {
      const nom = reste.filter((a, i) => !a.startsWith('-') && !['-n', '--tail'].includes(reste[i - 1])).at(0);
      const c = nom ? trouverConteneur(d, nom) : null;
      if (!nom) return jeu.erreur(`"docker logs" requires exactly 1 argument.`);
      if (!c) return jeu.erreur(`Error response from daemon: No such container: ${nom}`);
      const n =
        reste.indexOf('-n') >= 0 ? reste[reste.indexOf('-n') + 1] : reste.indexOf('--tail') >= 0 ? reste[reste.indexOf('--tail') + 1] : undefined;
      const temps = reste.includes('-t') || reste.includes('--timestamps');
      const lignes = c.journal.map((l) => (temps ? `${rfc3339(l.temps)} ${l.texte}` : l.texte));
      return (n !== undefined && n !== 'all' ? lignes.slice(-Number(n)) : lignes).join('\n');
    }
    case 'exec':
      return exec(d, jeu, reste);
    case 'cp':
      return cp(d, jeu, reste);
    case 'port': {
      const c = trouverConteneur(d, reste[0] ?? '');
      if (!c) return jeu.erreur(`Error response from daemon: No such container: ${reste[0] ?? ''}`);
      return c.ports
        .flatMap((p) =>
          p.ip === '0.0.0.0'
            ? [`${p.conteneur}/tcp -> 0.0.0.0:${p.hote}`, `${p.conteneur}/tcp -> [::]:${p.hote}`]
            : [`${p.conteneur}/tcp -> ${p.ip}:${p.hote}`],
        )
        .join('\n');
    }
    case 'update': {
      const i = reste.indexOf('--restart');
      const politique = i >= 0 ? reste[i + 1] : reste.find((a) => a.startsWith('--restart='))?.slice(10);
      const noms = reste.filter((a, k) => !a.startsWith('-') && reste[k - 1] !== '--restart');
      if (!politique || !noms.length) return jeu.erreur(jeu.t('docker-update-usage'));
      for (const nom of noms) {
        const c = trouverConteneur(d, nom);
        if (!c) jeu.erreur(`Error response from daemon: No such container: ${nom}`);
        else c.redemarrage = politique;
      }
      return noms.join('\n');
    }
    case 'inspect': {
      const i = reste.findIndex((a) => a === '-f' || a === '--format');
      const modele = i >= 0 ? reste[i + 1] : reste.find((a) => a.startsWith('--format='))?.slice(9);
      const noms = reste.filter((a, k) => !a.startsWith('-') && k !== i + 1);
      const objets = noms.map((n) => {
        const c = trouverConteneur(d, n);
        if (c) return inspecter(jeu, c);
        const v = d.volumes[n];
        if (v) return { CreatedAt: rfc3339(v.cree), Driver: 'local', Mountpoint: `/var/lib/docker/volumes/${n}/_data`, Name: n, Scope: 'local' };
        jeu.erreur(`Error: No such object: ${n}`);
        return null;
      });
      const trouves = objets.filter(Boolean);
      if (modele) return trouves.map((o) => formatGo(o, modele)).join('\n');
      return trouves.length ? JSON.stringify(trouves, null, 4) : '[]';
    }
    case 'volume': {
      const [sous, ...noms] = reste;
      if (sous === 'ls' || sous === 'list')
        return tableau(
          ['DRIVER', 'VOLUME NAME'],
          Object.keys(d.volumes).map((n) => ['local', n]),
        );
      if (sous === 'create') {
        const nom = noms[0] ?? identifiant('volume' + d.prochain++);
        d.volumes[nom] ??= { cree: horloge(jeu), donnees: {} };
        return nom;
      }
      if (sous === 'inspect') return DOCKER.docker.lancer({ args: ['inspect', ...noms], jeu, entree: null, dernier: true });
      if (sous === 'prune') return elaguer(d, jeu, 'volume', noms);
      if (sous === 'rm') {
        for (const n of noms) {
          const utilise = d.conteneurs.find((c) => c.montages.some((m) => m.type === 'volume' && m.source === n));
          if (!d.volumes[n]) jeu.erreur(`Error response from daemon: get ${n}: no such volume`);
          else if (utilise) jeu.erreur(`Error response from daemon: remove ${n}: volume is in use - [${utilise.id}]`);
          else delete d.volumes[n];
        }
        return noms.filter((n) => !d.volumes[n]).join('\n');
      }
      return jeu.erreur(jeu.t('docker-volume-usage'));
    }
    case 'compose':
      return compose(d, jeu, reste);
    case undefined:
      return AIDE(jeu);
    default:
      return jeu.erreur(`docker: unknown command: docker ${action}\n\nRun 'docker --help' for more information`);
  }
}
