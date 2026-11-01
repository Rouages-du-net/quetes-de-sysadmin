// docker : la ligne de commande du moteur de conteneurs (docker.ts), avec
// les sorties et les messages de Docker 27
// (https://docs.docker.com/reference/cli/docker/).
// Écarts : sans -d, docker run rend la main (le conteneur continue) ; docker
// logs -f n'attend pas ; docker exec ne connaît que quelques commandes (ls,
// cat, env, id, whoami) ; --format seulement {{.Champ.Sous.champ}}.

import type { Shell } from '../shell';
import {
  APPS,
  complete,
  imageAccounts,
  docker,
  writeIn,
  clock,
  identifier,
  identity,
  imageOfContainer,
  launch,
  nodeIn,
  readIn,
  diskUpdate,
  listIn,
  imageName,
  rfc3339,
  stop,
  dockerSize,
  findContainer,
  imageUser,
  type Container,
  type DockerState,
  type Mount,
  type Port,
} from '../docker';
import { systemd } from '../systemd';
import { projectContainers, YamlError, readProject, mount, type Project } from '../compose';
import type { Command } from './index';

const SOCKET = 'permission denied while trying to connect to the Docker daemon socket at unix:///var/run/docker.sock';

/** Une durée comme units.HumanDuration de Docker : « 3 days », « About an hour ». */
export function duration(ms: number): string {
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

const A_NAMES = ['brave', 'calm', 'eager', 'gentle', 'happy', 'jolly', 'keen', 'lucid', 'nifty', 'quirky'];
const B_NAMES = ['hopper', 'lovelace', 'noether', 'curie', 'turing', 'hamilton', 'germain', 'meitner', 'franklin', 'johnson'];

const ports = (c: Container) =>
  c.ports
    .flatMap((p) =>
      p.ip === '0.0.0.0'
        ? [`0.0.0.0:${p.host}->${p.container}/tcp`, `[::]:${p.host}->${p.container}/tcp`]
        : [`${p.ip}:${p.host}->${p.container}/tcp`],
    )
    .join(', ');

function status(c: Container, now: number): string {
  if (c.state === 'running') return `Up ${duration(now - c.start)}`;
  // Un conteneur qui s'arrête en erreur et que sa politique relance sans fin.
  if (c.state === 'exited' && c.code !== 0 && ['always', 'unless-stopped', 'on-failure'].includes(c.reboot.split(':')[0]))
    return `Restarting (${c.code}) ${duration(Math.min(now - c.end, 9000))} ago`;
  if (c.state === 'exited') return `Exited (${c.code}) ${duration(now - c.end)} ago`;
  return 'Created';
}

// Un tableau aligné, colonnes séparées par trois espaces (comme docker).
function grid(titres: string[], lines: string[][]): string {
  const widths = titres.map((t, i) => Math.max(t.length, ...lines.map((l) => l[i].length)));
  const line = (l: string[]) =>
    l
      .map((x, i) => (i === l.length - 1 ? x : x.padEnd(widths[i])))
      .join('   ')
      .trimEnd();
  return [line(titres), ...lines.map(line)].join('\n');
}

const imageFor = (d: DockerState, c: Container) => Object.values(d.images).find((i) => imageName(i) === c.image);

function ps(d: DockerState, game: Shell, all: boolean): string {
  const now = clock(game);
  const listing = d.containers.filter((c) => all || c.state === 'running').reverse();
  return grid(
    ['CONTAINER ID', 'IMAGE', 'COMMAND', 'CREATED', 'STATUS', 'PORTS', 'NAMES'],
    listing.map((c) => {
      const command = imageFor(d, c)?.command ?? '';
      return [
        c.id.slice(0, 12),
        c.image,
        `"${command.length > 20 ? command.slice(0, 19) + '…' : command}"`,
        `${duration(now - c.created)} ago`,
        status(c, now),
        c.state === 'running' ? ports(c) : '',
        c.name,
      ];
    }),
  );
}

function images(d: DockerState, game: Shell): string {
  const now = clock(game);
  return grid(
    ['REPOSITORY', 'TAG', 'IMAGE ID', 'CREATED', 'SIZE'],
    Object.values(d.images).map((i) => [i.repo, i.tag, i.id.slice(0, 12), `${duration(now - i.created)} ago`, dockerSize(i.size)]),
  );
}

// Télécharge une image depuis le registre ; renvoie la sortie, ou null si elle n'existe pas.
function pull(d: DockerState, name: string): string | null {
  const full = complete(name);
  const source = d.registry[full];
  if (!source) return null;
  const [repo, tag] = [full.slice(0, full.lastIndexOf(':')), full.slice(full.lastIndexOf(':') + 1)];
  const already = d.images[full]?.id === source.id;
  if (already)
    return `${tag}: Pulling from ${repo.split('/').slice(1).join('/') || repo}\nDigest: sha256:${identifier('digest' + source.id)}\nStatus: Image is up to date for ${full}\n${full}`;
  d.images[full] = { ...source };
  const layers = [identifier('couche-a' + repo), identifier('couche-b' + source.id), identifier('couche-c' + source.id)].map((c) =>
    c.slice(0, 12),
  );
  const present = Object.values(d.images).some((i) => i.repo === repo && i.tag !== tag);
  return [
    `${tag}: Pulling from ${repo.split('/').slice(1).join('/') || repo}`,
    `${layers[0]}: ${present ? 'Already exists' : 'Pull complete'}`,
    `${layers[1]}: Pull complete`,
    `${layers[2]}: Pull complete`,
    `Digest: sha256:${identifier('digest' + source.id)}`,
    `Status: Downloaded newer image for ${full}`,
    full,
  ].join('\n');
}

interface OptionsRun {
  detached: boolean;
  name?: string;
  ports: string[];
  volumes: string[];
  env: string[];
  reboot: string;
  remove: boolean;
  user?: string;
  onlyRead: boolean;
  capDrop: string[];
  security: string[];
  image?: string;
  unknown?: string;
}

function parseRun(args: string[]): OptionsRun {
  const o: OptionsRun = {
    detached: false,
    ports: [],
    volumes: [],
    env: [],
    reboot: 'no',
    remove: false,
    onlyRead: false,
    capDrop: [],
    security: [],
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    const [key, egal] = a.startsWith('--') && a.includes('=') ? [a.slice(0, a.indexOf('=')), a.slice(a.indexOf('=') + 1)] : [a, undefined];
    const value = () => egal ?? args[++i] ?? '';
    if (key === '-d' || key === '--detach') o.detached = true;
    else if (/^-[dit]+$/.test(key)) o.detached ||= key.includes('d');
    else if (key === '--name') o.name = value();
    else if (key === '-p' || key === '--publish') o.ports.push(value());
    else if (key === '-v' || key === '--volume') o.volumes.push(value());
    else if (key === '-e' || key === '--env') o.env.push(value());
    else if (key === '--restart') o.reboot = value();
    else if (key === '--rm') o.remove = true;
    else if (key === '-u' || key === '--user') o.user = value();
    else if (key === '--read-only') o.onlyRead = true;
    else if (key === '--cap-drop') o.capDrop.push(value());
    else if (key === '--security-opt') o.security.push(value());
    else if (key === '--interactive' || key === '--tty') continue;
    else if (key.startsWith('-')) {
      o.unknown = key;
      return o;
    } else {
      // L'image, puis la commande (ignorée ici).
      o.image = a;
      return o;
    }
  }
  return o;
}

function run(d: DockerState, game: Shell, args: string[]): string {
  const o = parseRun(args);
  if (o.unknown) return game.error(`unknown flag: ${o.unknown}\nSee 'docker run --help'.`);
  if (!o.image)
    return game.error(
      `docker: 'docker run' requires at least 1 argument.\n\nUsage:  docker run [OPTIONS] IMAGE [COMMAND] [ARG...]\n\nSee 'docker run --help' for more information`,
    );
  if (!['no', 'always', 'unless-stopped', 'on-failure'].includes(o.reboot.split(':')[0]))
    return game.error(`docker: invalid restart policy format: ${o.reboot}\n\nRun 'docker run --help' for more information`);
  const output: string[] = [];
  const full = complete(o.image);
  if (!d.images[full]) {
    const tire = pull(d, o.image);
    if (!tire) {
      return game.error(
        `Unable to find image '${full}' locally\ndocker: Error response from daemon: manifest for ${full} not found: manifest unknown: manifest unknown\n\nRun 'docker run --help' for more information`,
      );
    }
    output.push(`Unable to find image '${full}' locally`, tire);
  }
  const image = d.images[full];
  const name = o.name ?? `${A_NAMES[d.next % A_NAMES.length]}_${B_NAMES[(d.next * 3) % B_NAMES.length]}`;
  const existing = d.containers.find((c) => c.name === name);
  if (existing)
    return game.error(
      `docker: Error response from daemon: Conflict. The container name "/${name}" is already in use by container "${existing.id}". You have to remove (or rename) that container to be able to reuse that name.\n\nRun 'docker run --help' for more information`,
    );
  // -p [ip:]hôte:conteneur, ou -p conteneur (port de la machine au hasard).
  const published: Port[] = [];
  for (const p of o.ports) {
    const parts = p.replace(/\/tcp$/, '').split(':');
    const [ip, host, container] =
      parts.length === 3 ? parts : parts.length === 2 ? ['0.0.0.0', ...parts] : ['0.0.0.0', String(32768 + d.next), parts[0]];
    if (!/^\d+$/.test(host) || !/^\d+$/.test(container))
      return game.error(`docker: invalid publish opts format (should be name=value but got '${p}')\n\nRun 'docker run --help' for more information`);
    published.push({ ip, host: Number(host), container: Number(container) });
  }
  // -v nom:/chemin (volume) ou /dossier:/chemin (dossier de la machine), :ro en lecture seule.
  const mounts: Mount[] = [];
  for (const v of o.volumes) {
    const [source, target, mode] = v.split(':');
    if (!target || !target.startsWith('/'))
      return game.error(
        `docker: Error response from daemon: invalid volume specification: '${v}': invalid mount config for type "volume": invalid mount path: '${target ?? ''}' mount path must be absolute\n\nRun 'docker run --help' for more information`,
      );
    const bind = source.startsWith('/') || source.startsWith('.') || source.startsWith('~');
    if (bind) {
      const path = game.resolve(source);
      // Docker crée le dossier de la machine s'il n'existe pas (à root).
      if (!game.exists(path)) {
        const before = game.who;
        game.who = 'root';
        game.place('docker', path, { type: 'dossier', children: {}, owner: 'root' });
        game.who = before;
      }
      mounts.push({ type: 'bind', source: path, target, onlyRead: mode === 'ro' });
    } else {
      d.volumes[source] ??= { created: clock(game), data: {} };
      mounts.push({ type: 'volume', source, target, onlyRead: mode === 'ro' });
    }
  }
  const id = identifier(`conteneur-${d.next}-${name}`);
  d.next++;
  const c: Container = {
    id,
    name,
    image: full,
    state: 'created',
    code: 0,
    ports: published,
    mounts,
    env: Object.fromEntries(o.env.map((e) => [e.split('=')[0], e.split('=').slice(1).join('=')])),
    reboot: o.reboot,
    created: clock(game),
    start: 0,
    end: 0,
    layer: { ...(APPS[image.app]?.files?.(image) ?? {}) },
    log: [],
    ip: `172.17.0.${d.containers.filter((x) => x.state === 'running').length + 2}`,
    ...(o.user ? { user: o.user } : {}),
    ...(o.onlyRead ? { onlyRead: true } : {}),
    ...(o.capDrop.length ? { capDrop: o.capDrop } : {}),
    ...(o.security.length ? { security: o.security } : {}),
  };
  // Un port de la machine déjà publié par un conteneur qui tourne : refus au démarrage.
  const busy = published.find((p) => d.containers.some((x) => x.state === 'running' && x.ports.some((q) => q.host === p.host)));
  d.containers.push(c);
  if (busy) {
    return game.error(
      [
        ...output,
        `docker: Error response from daemon: driver failed programming external connectivity on endpoint ${name} (${identifier('ep' + id)}): Bind for 0.0.0.0:${busy.host} failed: port is already allocated.`,
        '',
        "Run 'docker run --help' for more information",
      ].join('\n'),
    );
  }
  const failure = launch(game, c);
  if (failure)
    return game.error([...output, `docker: Error response from daemon: ${failure}.`, '', "Run 'docker run --help' for more information"].join('\n'));
  game.state.dockerRun = (game.state.dockerRun ?? 0) + 1;
  if (o.detached) return [...output, id].join('\n');
  // Sans -d, docker resterait attaché au conteneur : on montre son journal.
  return [...output, ...c.log.map((l) => l.text), game.t('docker-attached')].join('\n');
}

// docker cp conteneur:chemin chemin_machine, ou l'inverse.
function cp(d: DockerState, game: Shell, args: string[]): string {
  const [source, dest] = args.filter((a) => !a.startsWith('-'));
  if (!source || !dest)
    return game.error(
      `docker: 'docker cp' requires 2 arguments.\n\nUsage:  docker cp [OPTIONS] CONTAINER:SRC_PATH DEST_PATH|-\n\tdocker cp [OPTIONS] SRC_PATH|- CONTAINER:DEST_PATH`,
    );
  const cote = (x: string) => (/^[\w.-]+:\//.test(x) ? { container: x.slice(0, x.indexOf(':')), path: x.slice(x.indexOf(':') + 1) } : null);
  const forEachOf = cote(source);
  const to = cote(dest);
  if (!!forEachOf === !!to) return game.error('must specify at least one container source');
  let bytes = 0;
  if (forEachOf) {
    const c = findContainer(d, forEachOf.container);
    if (!c) return game.error(`Error response from daemon: No such container: ${forEachOf.container}`);
    const base = forEachOf.path.replace(/\/\.?$/, '');
    const files = readIn(game, c, base) !== null ? [base] : listIn(game, c, base);
    if (!files.length) return game.error(`Error response from daemon: Could not find the file ${forEachOf.path} in container ${forEachOf.container}`);
    const oneFile = files.length === 1 && files[0] === base;
    const destPlace = game.resolve(dest);
    const exists = game.find(destPlace);
    // Un dossier copié vers un lieu qui existe : il y garde son nom (sauf avec /.).
    const root = oneFile
      ? exists?.type === 'dossier'
        ? `${destPlace}/${base.split('/').at(-1)}`
        : destPlace
      : exists?.type === 'dossier' && !forEachOf.path.endsWith('/.')
        ? `${destPlace}/${base.split('/').at(-1)}`
        : destPlace;
    if (!oneFile && !game.exists(root)) {
      const e = game.place('docker', root, { type: 'dossier', children: {}, owner: game.who });
      if (e) return game.error(e);
    }
    for (const f of files) {
      const content = readIn(game, c, f) ?? '';
      const target = oneFile ? root : `${root}/${f.slice(base.length + 1)}`;
      const e = game.place('docker', target, { type: 'fichier', content, lines: true, owner: game.who });
      if (e) return game.error(e);
      bytes += new TextEncoder().encode(content).length;
    }
    game.state.dockerCopy = (game.state.dockerCopy ?? 0) + 1;
    return `Successfully copied ${dockerSize(bytes)} to ${destPlace}`;
  }
  const c = findContainer(d, to!.container);
  if (!c) return game.error(`Error response from daemon: No such container: ${to!.container}`);
  const n = game.find(source);
  if (!n) return game.error(`lstat ${game.resolve(source)}: no such file or directory`);
  const baseTarget = to!.path.replace(/\/\.?$/, '');
  const copy = (path: string, target: string): string | null => {
    const x = game.find(path);
    if (x?.type === 'fichier') {
      const content = game.read(path) ?? '';
      bytes += new TextEncoder().encode(content).length;
      return writeIn(game, c, target, content);
    }
    if (x?.type === 'dossier')
      for (const k of Object.keys(x.children)) {
        const e: string | null = copy(`${path}/${k}`, `${target}/${k}`);
        if (e) return e;
      }
    return null;
  };
  // Le contenu d'un dossier (source/.) va directement dans la cible.
  const toPlace = n.type === 'dossier' && !source.endsWith('/.') ? `${baseTarget}/${game.resolve(source).split('/').at(-1)}` : baseTarget;
  const e = copy(game.resolve(source), n.type === 'fichier' && listIn(game, c, baseTarget).length ? `${baseTarget}/${game.name(source)}` : toPlace);
  if (e) return game.error(`Error response from daemon: ${e}`);
  return `Successfully copied ${dockerSize(bytes)} to ${to!.container}:${to!.path}`;
}

function exec(d: DockerState, game: Shell, args: string[]): string {
  // Les options avant le conteneur : -i, -t, -it, -u utilisateur (--user).
  let i = 0;
  let request: string | undefined;
  for (; i < args.length && args[i].startsWith('-'); i++) {
    if (args[i] === '-u' || args[i] === '--user') request = args[++i];
    else if (args[i].startsWith('--user=')) request = args[i].slice(7);
  }
  const [name, command, ...params] = args.slice(i);
  if (!name || !command)
    return game.error(`docker: 'docker exec' requires at least 2 arguments.\n\nUsage:  docker exec [OPTIONS] CONTAINER COMMAND [ARG...]`);
  const c = findContainer(d, name);
  if (!c) return game.error(`Error response from daemon: No such container: ${name}`);
  if (c.state !== 'running') return game.error(`Error response from daemon: container ${c.id} is not running`);
  const image = imageFor(d, c)!;
  const id = identity(image, c, request);
  if ('error' in id) return game.error(`Error response from daemon: ${id.error}`);
  if (command === 'env')
    return [
      `PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin`,
      `HOSTNAME=${c.id.slice(0, 12)}`,
      ...Object.entries(c.env).map(([k, v]) => `${k}=${v}`),
    ].join('\n');
  const withName = (n: number, nameFor: string | null) => (nameFor === null ? String(n) : `${n}(${nameFor})`);
  if (command === 'id') return `uid=${withName(id.uid, id.name)} gid=${withName(id.gid, id.group)} groups=${withName(id.gid, id.group)}`;
  if (command === 'whoami') return id.name ?? game.error(`whoami: cannot find name for user ID ${id.uid}`);
  if (command === 'cat') {
    const outputs: string[] = [];
    for (const p of params) {
      const content = readIn(game, c, p);
      if (content === null) {
        const inside = listIn(game, c, p);
        game.error(`cat: ${p}: ${inside.length ? 'Is a directory' : 'No such file or directory'}`);
      } else outputs.push(content);
    }
    return outputs.join('\n');
  }
  if (command === 'ls') {
    const long = params.some((p) => /^-\w*l/.test(p));
    const place = params.find((p) => !p.startsWith('-')) ?? '/';
    const files = readIn(game, c, place) !== null ? [place] : listIn(game, c, place);
    if (!files.length && readIn(game, c, place) === null && !c.mounts.some((m) => m.target === place.replace(/\/$/, '')))
      return game.error(`ls: cannot access '${place}': No such file or directory`);
    const names = [...new Set(files.map((f) => (f === place ? f : f.slice(place.replace(/\/$/, '').length + 1).split('/')[0])))].sort();
    if (!long) return names.join('  ');
    // Le propriétaire vu du conteneur : le nom de son uid dans l'image (sinon le numéro).
    const accounts = imageAccounts(image);
    const nameIn = (uid: number) => Object.entries(accounts).find(([, x]) => x === uid)?.[0] ?? String(uid);
    const byDefault = imageUser(image);
    return names
      .map((n) => {
        const path = `${place.replace(/\/$/, '')}/${n}`;
        const host = nodeIn(game, c, path);
        const uid = host ? (game.accounts.users[host.owner ?? game.player]?.uid ?? Number(host.owner)) : (accounts[byDefault] ?? 0);
        const owner = Number.isNaN(uid) ? 'root' : nameIn(uid);
        const directory = host?.type === 'dossier';
        const mode = host?.mode ?? (directory ? 'rwxr-xr-x' : 'rw-r--r--');
        const size = directory
          ? 4096
          : host?.type === 'fichier' && host.size !== undefined
            ? host.size
            : new TextEncoder().encode(readIn(game, c, path) ?? '').length;
        return `${directory ? 'd' : '-'}${mode} 1 ${owner} ${owner} ${String(size).padStart(6)} ${n}`;
      })
      .join('\n');
  }
  return game.error(
    `OCI runtime exec failed: exec failed: unable to start container process: exec: "${command}": executable file not found in $PATH: unknown`,
  );
}

// ——— Le disque : system df, prune, rmi ———

const used = (d: DockerState) => new Set(d.containers.map((c) => c.image));
const usedVolumes = (d: DockerState) => new Set(d.containers.flatMap((c) => c.mounts.filter((m) => m.type === 'volume').map((m) => m.source)));
const volumeSize = (v: DockerState['volumes'][string]) => Object.values(v.data).reduce((t, x) => t + x.length, 0) + (v.size ?? 0);

function dfSystem(d: DockerState): string {
  const imgs = Object.values(d.images);
  const inService = used(d);
  const size = imgs.reduce((t, i) => t + i.size, 0);
  const freeMem = imgs.filter((i) => !inService.has(imageName(i))).reduce((t, i) => t + i.size, 0);
  const volumes = Object.entries(d.volumes);
  const usedV = usedVolumes(d);
  const volumesSize = volumes.reduce((t, [, v]) => t + volumeSize(v), 0);
  const freeV = volumes.filter(([n]) => !usedV.has(n)).reduce((t, [, v]) => t + volumeSize(v), 0);
  const percent = (a: number, b: number) => `${dockerSize(a)} (${b ? Math.round((a / b) * 100) : 0}%)`;
  const stopped = d.containers.filter((c) => c.state !== 'running');
  return grid(
    ['TYPE', 'TOTAL', 'ACTIVE', 'SIZE', 'RECLAIMABLE'],
    [
      ['Images', String(imgs.length), String(imgs.filter((i) => inService.has(imageName(i))).length), dockerSize(size), percent(freeMem, size)],
      [
        'Containers',
        String(d.containers.length),
        String(d.containers.length - stopped.length),
        dockerSize(d.containers.length * 4096),
        percent(stopped.length * 4096, d.containers.length * 4096),
      ],
      ['Local Volumes', String(volumes.length), String(usedV.size), dockerSize(volumesSize), percent(freeV, volumesSize)],
      ['Build Cache', '0', '0', '0B', '0B'],
    ],
  );
}

const WARNINGS = {
  image: 'WARNING! This will remove all dangling images.',
  imageTout: 'WARNING! This will remove all images without at least one container associated to them.',
  container: 'WARNING! This will remove all stopped containers.',
  volume: 'WARNING! This will remove anonymous local volumes not used by at least one container.',
  volumeTout: 'WARNING! This will remove all local volumes not used by at least one container.',
};

// docker image|container|volume|system prune : demande confirmation, sauf avec -f.
function prune(d: DockerState, game: Shell, what: 'image' | 'container' | 'volume' | 'system', options: string[]): string {
  const all = options.some((o) => o === '-a' || o === '--all');
  const force = options.some((o) => o === '-f' || o === '--force');
  const withVolumes = options.includes('--volumes');
  const perform = (): string => {
    const lines: string[] = [];
    let recovered = 0;
    if (what === 'container' || what === 'system') {
      const stopped = d.containers.filter((c) => c.state !== 'running');
      d.containers = d.containers.filter((c) => c.state === 'running');
      if (stopped.length) lines.push('Deleted Containers:', ...stopped.map((c) => c.id), '');
      recovered += stopped.length * 4096;
    }
    if (what === 'image' || what === 'system') {
      const inService = used(d);
      const parts = Object.entries(d.images).filter(([, i]) => !inService.has(imageName(i)) && (all || i.repo === '<none>'));
      for (const [key] of parts) delete d.images[key];
      if (parts.length)
        lines.push(
          'Deleted Images:',
          ...parts.flatMap(([, i]) => [...(i.repo === '<none>' ? [] : [`untagged: ${imageName(i)}`]), `deleted: sha256:${i.id}`]),
          '',
        );
      recovered += parts.reduce((t, [, i]) => t + i.size, 0);
    }
    // Les volumes nommés ne partent qu'avec volume prune -a (depuis Docker 23).
    if (what === 'volume' && all) {
      const inService = usedVolumes(d);
      const partis = Object.keys(d.volumes).filter((n) => !inService.has(n));
      recovered += partis.reduce((t, n) => t + volumeSize(d.volumes[n]), 0);
      for (const n of partis) delete d.volumes[n];
      if (partis.length) lines.push('Deleted Volumes:', ...partis, '');
      game.state.dockerPrunedVolumes = [...(game.state.dockerPrunedVolumes ?? []), ...partis];
    }
    diskUpdate(game);
    return [...lines, `Total reclaimed space: ${dockerSize(recovered)}`].join('\n');
  };
  const warning =
    what === 'system'
      ? [
          'WARNING! This will remove:',
          '  - all stopped containers',
          '  - all networks not used by at least one container',
          ...(withVolumes ? ['  - all anonymous volumes not used by at least one container'] : []),
          all ? '  - all images without at least one container associated to them' : '  - all dangling images',
          '  - unused build cache',
          '',
        ].join('\n')
      : what === 'image'
        ? all
          ? WARNINGS.imageTout
          : WARNINGS.image
        : what === 'volume'
          ? all
            ? WARNINGS.volumeTout
            : WARNINGS.volume
          : WARNINGS.container;
  if (force) return perform();
  game.ask('Are you sure you want to continue? [y/N] ', (response) => (/^y(es)?$/i.test(response) ? perform() : ''));
  return warning;
}

// docker rmi : une image utilisée par un conteneur (même arrêté) est protégée.
function rmi(d: DockerState, game: Shell, args: string[]): string {
  const force = args.some((a) => a === '-f' || a === '--force');
  const lines: string[] = [];
  for (const name of args.filter((a) => !a.startsWith('-'))) {
    const key = Object.keys(d.images).find((k) => k === complete(name) || d.images[k].id.startsWith(name));
    if (!key) {
      game.error(`Error response from daemon: No such image: ${complete(name)}`);
      continue;
    }
    const i = d.images[key];
    const container = d.containers.find((c) => c.image === imageName(i));
    if (container && !force) {
      game.error(
        `Error response from daemon: conflict: unable to remove repository reference "${name}" (must force) - container ${container.id.slice(0, 12)} is using its referenced image ${i.id.slice(0, 12)}`,
      );
      continue;
    }
    delete d.images[key];
    lines.push(...(i.repo === '<none>' ? [] : [`Untagged: ${imageName(i)}`]), `Deleted: sha256:${i.id}`);
  }
  return lines.join('\n');
}

// ——— docker compose ———

function compose(d: DockerState, game: Shell, args: string[]): string {
  const outputs: string[] = [];
  let directory = game.cwd;
  const rest: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-f' || args[i] === '--file') directory = game.resolve(args[++i] ?? '.').replace(/\/[^/]+$/, '');
    else if (args[i] === '--project-directory') directory = game.resolve(args[++i] ?? '.');
    else rest.push(args[i]);
  }
  const [action, ...options] = rest;
  if (!action) return game.error(game.t('compose-usage'));
  let project: Project;
  try {
    project = readProject(game, directory);
  } catch (e) {
    if (e instanceof YamlError) return game.error(e.message);
    throw e;
  }
  const warn = () => project.warnings.map((a) => `WARN[0000] ${a}`);
  const containers = () => projectContainers(d, project.name);
  const service = (name?: string) => containers().find((c) => c.service === name);
  switch (action) {
    case 'config':
      return [...warn(), showProject(project)].join('\n');
    case 'up': {
      const detached = options.some((o) => o === '-d' || o === '--detach');
      const { lines, error } = mount(game, project, (image) => !!d.images[complete(image)] || pull(d, image) !== null);
      game.state.composeUp = (game.state.composeUp ?? 0) + 1;
      const head = [...warn(), `[+] Running ${lines.length}/${lines.length}`, ...lines];
      if (error) return game.error([...head, error].join('\n'));
      if (detached) return head.join('\n');
      const logs = containers().flatMap((c) => c.log.map((l) => `${c.service.padEnd(6)} | ${l.text}`));
      return [
        ...head,
        `Attaching to ${containers()
          .map((c) => c.name)
          .join(', ')}`,
        ...logs,
        game.t('docker-attached'),
      ].join('\n');
    }
    case 'down': {
      const volumes = options.some((o) => o === '-v' || o === '--volumes');
      const lines: string[] = [];
      for (const c of [...containers()].reverse()) {
        stop(game, c);
        d.containers = d.containers.filter((x) => x !== c);
        lines.push(` ✔ Container ${c.name}  Removed`);
      }
      // down -v efface aussi les volumes du projet : leurs données sont perdues.
      if (volumes)
        for (const v of project.volumes) {
          const name = `${project.name}_${v}`;
          if (d.volumes[name]) {
            delete d.volumes[name];
            lines.push(` ✔ Volume ${name}  Removed`);
            game.state.composeVolumesErased = true;
          }
        }
      const reseaux: Record<string, true> = game.state.dockerReseaux ?? {};
      if (reseaux[`${project.name}_default`]) {
        delete reseaux[`${project.name}_default`];
        lines.push(` ✔ Network ${project.name}_default  Removed`);
      }
      return [...warn(), `[+] Running ${lines.length}/${lines.length}`, ...lines].join('\n');
    }
    case 'ps': {
      const now = clock(game);
      // Sans -a : ceux qui tournent, et ceux que leur politique relance en boucle.
      const inLoop = (c: Container) => c.code !== 0 && ['always', 'unless-stopped', 'on-failure'].includes(c.reboot.split(':')[0]);
      const listing = containers().filter((c) => options.includes('-a') || options.includes('--all') || c.state === 'running' || inLoop(c));
      return [
        ...warn(),
        grid(
          ['NAME', 'IMAGE', 'COMMAND', 'SERVICE', 'CREATED', 'STATUS', 'PORTS'],
          listing.map((c) => {
            const command = imageFor(d, c)?.command ?? '';
            return [
              c.name,
              c.image,
              `"${command.length > 20 ? command.slice(0, 19) + '…' : command}"`,
              c.service,
              `${duration(now - c.created)} ago`,
              status(c, now),
              c.state === 'running' ? ports(c) : '',
            ];
          }),
        ),
      ].join('\n');
    }
    case 'logs': {
      const name = options.find((o, i) => !o.startsWith('-') && !['-n', '--tail'].includes(options[i - 1]));
      const listing = name ? containers().filter((c) => c.service === name) : containers();
      if (name && !listing.length) return game.error(`no such service: ${name}`);
      const width = Math.max(...listing.map((c) => c.name.length));
      return listing.flatMap((c) => c.log.map((l) => `${c.name.padEnd(width)}  | ${l.text}`)).join('\n');
    }
    case 'restart':
    case 'stop':
    case 'start': {
      const names = options.filter((o) => !o.startsWith('-'));
      const listing = names.length ? containers().filter((c) => names.includes(c.service)) : containers();
      for (const c of listing) {
        if (action !== 'start') stop(game, c);
        const failure = action !== 'stop' ? launch(game, c) : null;
        if (failure) return game.error(`Error response from daemon: ${failure}`);
      }
      const verb = { restart: 'Started', stop: 'Stopped', start: 'Started' }[action];
      return [
        ...warn(),
        `[+] ${action === 'stop' ? 'Stopping' : 'Restarting'} ${listing.length}/${listing.length}`,
        ...listing.map((c) => ` ✔ Container ${c.name}  ${verb}`),
      ].join('\n');
    }
    case 'exec': {
      const [name, ...command] = options.filter((o) => !/^-[it]+$/.test(o));
      const c = service(name);
      if (!c) return game.error(`service "${name ?? ''}" is not running`);
      return exec(d, game, [c.name, ...command]);
    }
    case 'pull':
      for (const s of project.services) (outputs.push(` ✔ ${s.name} Pulled`), pull(d, s.image));
      return [...warn(), `[+] Pulling ${project.services.length}/${project.services.length}`, ...outputs].join('\n');
    default:
      return game.error(`unknown docker command: "compose ${action}"`);
  }
}

// docker compose config : le projet tel que Compose l'a compris (variables remplacées).
function showProject(p: Project): string {
  const lines = [`name: ${p.name}`, 'services:'];
  for (const s of p.services) {
    lines.push(`  ${s.name}:`);
    if (s.capDrop.length) lines.push('    cap_drop:', ...s.capDrop.map((x) => `      - ${x}`));
    if (s.dependencies.length)
      lines.push('    depends_on:', ...s.dependencies.map((d) => `      ${d}:\n        condition: service_started\n        required: true`));
    if (Object.keys(s.env).length) lines.push('    environment:', ...Object.entries(s.env).map(([k, v]) => `      ${k}: ${v === '' ? '""' : v}`));
    lines.push(`    image: ${s.image}`, '    networks:', '      default: null');
    if (s.ports.length) lines.push('    ports:', ...s.ports.map((x) => `      - ${x}`));
    if (s.onlyRead) lines.push('    read_only: true');
    if (s.reboot !== 'no') lines.push(`    restart: ${s.reboot}`);
    if (s.security.length) lines.push('    security_opt:', ...s.security.map((x) => `      - ${x}`));
    if (s.user) lines.push(`    user: ${s.user}`);
    if (s.volumes.length) lines.push('    volumes:', ...s.volumes.map((v) => `      - ${v}`));
  }
  lines.push('networks:', '  default:', `    name: ${p.name}_default`);
  if (p.volumes.length) lines.push('volumes:', ...p.volumes.flatMap((v) => [`  ${v}:`, `    name: ${p.name}_${v}`]));
  return lines.join('\n');
}

// --format '{{.State.Status}}' : un chemin dans l'objet JSON.
function formatGo(object: unknown, template: string): string {
  return template.replace(/\{\{\s*(json\s+)?\.([\w.]*)\s*\}\}/g, (_, json: string | undefined, path: string) => {
    let v: unknown = object;
    for (const p of path.split('.').filter(Boolean)) v = (v as Record<string, unknown> | undefined)?.[p];
    if (json || (typeof v === 'object' && v !== null)) return JSON.stringify(v);
    return v === undefined ? '<no value>' : String(v);
  });
}

function inspect(game: Shell, c: Container) {
  return {
    Id: c.id,
    Created: rfc3339(c.created),
    State: { Status: c.state, Running: c.state === 'running', ExitCode: c.code, StartedAt: c.start ? rfc3339(c.start) : '0001-01-01T00:00:00Z' },
    Image: c.image,
    Name: `/${c.name}`,
    HostConfig: {
      RestartPolicy: { Name: c.reboot.split(':')[0], MaximumRetryCount: Number(c.reboot.split(':')[1] ?? 0) },
      ReadonlyRootfs: !!c.onlyRead,
      CapDrop: c.capDrop ?? null,
      SecurityOpt: c.security ?? null,
      PortBindings: Object.fromEntries(
        c.ports.map((p) => [`${p.container}/tcp`, [{ HostIp: p.ip === '0.0.0.0' ? '' : p.ip, HostPort: String(p.host) }]]),
      ),
    },
    Mounts: c.mounts.map((m) => ({
      Type: m.type,
      ...(m.type === 'volume' ? { Name: m.source, Source: `/var/lib/docker/volumes/${m.source}/_data` } : { Source: m.source }),
      Destination: m.target,
      RW: !m.onlyRead,
    })),
    Config: {
      Image: c.image,
      User: c.user ?? (imageUser(imageOfContainer(game, c)) === 'root' ? '' : imageUser(imageOfContainer(game, c))),
      Env: Object.entries(c.env).map(([k, v]) => `${k}=${v}`),
    },
    NetworkSettings: { IPAddress: c.ip },
  };
}

const HELP = (game: Shell) => game.error(game.t('docker-usage'));

export const DOCKER: Record<string, Command> = {
  // Le paquet docker-compose de Debian : la même chose que docker compose.
  'docker-compose': {
    ownOptions: true,
    launch: (context) => DOCKER.docker.launch({ ...context, args: ['compose', ...context.args] }),
  },
  docker: {
    ownOptions: true,
    launch: ({ args, game }) => {
      if (args[0] === '--version' || args[0] === '-v') return 'Docker version 27.5.1, build 9f9e405';
      const d = docker(game);
      if (!d) return game.error(game.t('command-missing', { commande: 'docker' }));
      // Le groupe docker donne les droits de root sur la machine : ici, sudo.
      if (game.who !== 'root' && !game.groupsFor(game.who).includes('docker'))
        return game.error(
          `${SOCKET}: Get "http://%2Fvar%2Frun%2Fdocker.sock/v1.47/containers/json": dial unix /var/run/docker.sock: connect: permission denied`,
        );
      if (systemd(game)?.services.docker && systemd(game)!.services.docker.state !== 'active')
        return game.error('Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?');
      // Chaque commande prend un peu de temps (l'horloge de la machine avance).
      const sd = systemd(game);
      if (sd) sd.clock += 2000;
      const output = execute(d, game, args);
      diskUpdate(game);
      return output;
    },
  },
};

function execute(d: DockerState, game: Shell, args: string[]): string {
  let [action, ...rest] = args;
  // docker container ls, docker image ls, docker container rm… : les mêmes commandes.
  if (action === 'container' || action === 'image') {
    const group = action;
    const under = rest.shift() ?? '';
    action =
      under === 'ls' || under === 'list'
        ? group === 'container'
          ? 'ps'
          : 'images'
        : under === 'prune'
          ? `${group}-prune`
          : group === 'image' && under === 'rm'
            ? 'rmi'
            : under;
  }
  switch (action) {
    case 'system':
      if (rest[0] === 'df') return dfSystem(d);
      if (rest[0] === 'prune') return prune(d, game, 'system', rest.slice(1));
      return game.error(`docker: unknown command: docker system ${rest[0] ?? ''}`);
    case 'image-prune':
      return prune(d, game, 'image', rest);
    case 'container-prune':
      return prune(d, game, 'container', rest);
    case 'rmi':
      return rmi(d, game, rest);
    case 'ps':
      return ps(d, game, rest.includes('-a') || rest.includes('--all'));
    case 'images':
      return images(d, game);
    case 'pull': {
      const name = rest.find((a) => !a.startsWith('-'));
      if (!name) return game.error(`"docker pull" requires exactly 1 argument.`);
      return pull(d, name) ?? game.error(`Error response from daemon: manifest for ${complete(name)} not found: manifest unknown: manifest unknown`);
    }
    case 'run':
      return run(d, game, rest);
    case 'start':
    case 'stop':
    case 'restart':
    case 'rm': {
      const force = rest.some((a) => a === '-f' || a === '--force');
      const names = rest.filter((a) => !a.startsWith('-'));
      if (!names.length) return game.error(`"docker ${action}" requires at least 1 argument.`);
      const outputs: string[] = [];
      for (const name of names) {
        const c = findContainer(d, name);
        if (!c) {
          game.error(`Error response from daemon: No such container: ${name}`);
          continue;
        }
        if (action === 'rm') {
          if (c.state === 'running' && !force) {
            game.error(
              `Error response from daemon: cannot remove container "/${c.name}": container is running: stop the container before removing or force remove`,
            );
            continue;
          }
          // La couche du conteneur disparaît avec lui ; les volumes restent.
          d.containers = d.containers.filter((x) => x !== c);
          game.state.dockerRemoved = [...(game.state.dockerRemoved ?? []), c];
        } else {
          if (action !== 'start') stop(game, c);
          if (action !== 'stop') {
            const busy = c.ports.find((p) => d.containers.some((x) => x !== c && x.state === 'running' && x.ports.some((q) => q.host === p.host)));
            if (busy) {
              game.error(
                `Error response from daemon: driver failed programming external connectivity on endpoint ${c.name} (${identifier('ep' + c.id)}): Bind for 0.0.0.0:${busy.host} failed: port is already allocated\nError: failed to start containers: ${name}`,
              );
              continue;
            }
            const failure = launch(game, c);
            if (failure) {
              game.error(`Error response from daemon: ${failure}\nError: failed to start containers: ${name}`);
              continue;
            }
          }
        }
        outputs.push(name);
      }
      return outputs.join('\n');
    }
    case 'logs': {
      const name = rest.filter((a, i) => !a.startsWith('-') && !['-n', '--tail'].includes(rest[i - 1])).at(0);
      const c = name ? findContainer(d, name) : null;
      if (!name) return game.error(`"docker logs" requires exactly 1 argument.`);
      if (!c) return game.error(`Error response from daemon: No such container: ${name}`);
      const n =
        rest.indexOf('-n') >= 0 ? rest[rest.indexOf('-n') + 1] : rest.indexOf('--tail') >= 0 ? rest[rest.indexOf('--tail') + 1] : undefined;
      const time = rest.includes('-t') || rest.includes('--timestamps');
      const lines = c.log.map((l) => (time ? `${rfc3339(l.time)} ${l.text}` : l.text));
      return (n !== undefined && n !== 'all' ? lines.slice(-Number(n)) : lines).join('\n');
    }
    case 'exec':
      return exec(d, game, rest);
    case 'cp':
      return cp(d, game, rest);
    case 'port': {
      const c = findContainer(d, rest[0] ?? '');
      if (!c) return game.error(`Error response from daemon: No such container: ${rest[0] ?? ''}`);
      return c.ports
        .flatMap((p) =>
          p.ip === '0.0.0.0'
            ? [`${p.container}/tcp -> 0.0.0.0:${p.host}`, `${p.container}/tcp -> [::]:${p.host}`]
            : [`${p.container}/tcp -> ${p.ip}:${p.host}`],
        )
        .join('\n');
    }
    case 'update': {
      const i = rest.indexOf('--restart');
      const policy = i >= 0 ? rest[i + 1] : rest.find((a) => a.startsWith('--restart='))?.slice(10);
      const names = rest.filter((a, k) => !a.startsWith('-') && rest[k - 1] !== '--restart');
      if (!policy || !names.length) return game.error(game.t('docker-update-usage'));
      for (const name of names) {
        const c = findContainer(d, name);
        if (!c) game.error(`Error response from daemon: No such container: ${name}`);
        else c.reboot = policy;
      }
      return names.join('\n');
    }
    case 'inspect': {
      const i = rest.findIndex((a) => a === '-f' || a === '--format');
      const template = i >= 0 ? rest[i + 1] : rest.find((a) => a.startsWith('--format='))?.slice(9);
      const names = rest.filter((a, k) => !a.startsWith('-') && (i < 0 || k !== i + 1));
      const objets = names.map((n) => {
        const c = findContainer(d, n);
        if (c) return inspect(game, c);
        const v = d.volumes[n];
        if (v) return { CreatedAt: rfc3339(v.created), Driver: 'local', Mountpoint: `/var/lib/docker/volumes/${n}/_data`, Name: n, Scope: 'local' };
        game.error(`Error: No such object: ${n}`);
        return null;
      });
      const found = objets.filter(Boolean);
      if (template) return found.map((o) => formatGo(o, template)).join('\n');
      return found.length ? JSON.stringify(found, null, 4) : '[]';
    }
    case 'volume': {
      const [under, ...names] = rest;
      if (under === 'ls' || under === 'list')
        return grid(
          ['DRIVER', 'VOLUME NAME'],
          Object.keys(d.volumes).map((n) => ['local', n]),
        );
      if (under === 'create') {
        const name = names[0] ?? identifier('volume' + d.next++);
        d.volumes[name] ??= { created: clock(game), data: {} };
        return name;
      }
      if (under === 'inspect') return DOCKER.docker.launch({ args: ['inspect', ...names], game, input: null, last: true });
      if (under === 'prune') return prune(d, game, 'volume', names);
      if (under === 'rm') {
        for (const n of names) {
          const inUse = d.containers.find((c) => c.mounts.some((m) => m.type === 'volume' && m.source === n));
          if (!d.volumes[n]) game.error(`Error response from daemon: get ${n}: no such volume`);
          else if (inUse) game.error(`Error response from daemon: remove ${n}: volume is in use - [${inUse.id}]`);
          else delete d.volumes[n];
        }
        return names.filter((n) => !d.volumes[n]).join('\n');
      }
      return game.error(game.t('docker-volume-usage'));
    }
    case 'compose':
      return compose(d, game, rest);
    case undefined:
      return HELP(game);
    default:
      return game.error(`docker: unknown command: docker ${action}\n\nRun 'docker --help' for more information`);
  }
}
