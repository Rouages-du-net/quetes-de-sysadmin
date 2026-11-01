// Docker Compose simulé : le fichier compose.yaml (un sous-ensemble de
// YAML), ses variables (${VAR} lues dans .env), ses services, son réseau et
// ses volumes. D'après la spécification Compose
// (https://docs.docker.com/reference/compose-file/) et la commande
// docker compose (https://docs.docker.com/reference/cli/docker/compose/).
// Écarts : YAML réduit (correspondances, listes, chaînes, listes [a, b]) ;
// clés de service : image, ports, volumes, environment, env_file,
// depends_on, restart, user, read_only, cap_drop, security_opt, command
// (ignorée) ; pas de build, de healthcheck, ni de profils.

import type { Game, Shell } from './shell';
import { docker, clock, identifier, launch, stop, type Container, type DockerState, type Mount, type Port } from './docker';

type Value = string | Value[] | { [key: string]: Value };

export class YamlError extends Error {}

/** Lit un YAML simple : correspondances indentées, listes « - », chaînes. */
export function readYaml(text: string): Value {
  const lines = text.split('\n').map((rawValue, i) => ({ number: i + 1, rawValue }));
  for (const l of lines) if (/^\s*\t/.test(l.rawValue)) throw new YamlError(`yaml: line ${l.number}: found character that cannot start any token`);
  const useful = lines
    .map((l) => ({ ...l, text: commentRetirer(l.rawValue) }))
    .filter((l) => l.text.trim() !== '')
    .map((l) => ({ ...l, indent: l.text.length - l.text.trimStart().length, content: l.text.trim() }));
  let i = 0;
  const scalar = (s: string, number: number): Value => {
    const v = s.trim();
    if (v.startsWith('[')) {
      if (!v.endsWith(']')) throw new YamlError(`yaml: line ${number}: did not find expected ',' or ']'`);
      return v
        .slice(1, -1)
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)
        .map((x) => scalar(x, number) as string);
    }
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1, -1);
    if (/^["']/.test(v)) throw new YamlError(`yaml: line ${number}: found unexpected end of stream`);
    return v;
  };
  const block = (indent: number): Value => {
    const first = useful[i];
    if (first.content.startsWith('- ') || first.content === '-') {
      const listing: Value[] = [];
      while (i < useful.length && useful[i].indent === indent && (useful[i].content.startsWith('- ') || useful[i].content === '-')) {
        const l = useful[i++];
        const element = l.content.slice(1).trim();
        if (/^[\w.-]+:(\s|$)/.test(element)) throw new YamlError(simulatedNotGame(l.number));
        listing.push(scalar(element, l.number));
      }
      return listing;
    }
    const object: Record<string, Value> = {};
    while (i < useful.length && useful[i].indent === indent) {
      const l = useful[i];
      if (l.content.startsWith('- ')) throw new YamlError(`yaml: line ${l.number}: did not find expected key`);
      const m = /^("[^"]*"|'[^']*'|[^:]+?):(?:\s+(.*))?$/.exec(l.content);
      if (!m) throw new YamlError(`yaml: line ${l.number}: could not find expected ':'`);
      const key = m[1].replace(/^["']|["']$/g, '');
      const rest = m[2];
      if (rest !== undefined && /^[^"'[]*:\s/.test(rest))
        throw new YamlError(`yaml: line ${l.number}: mapping values are not allowed in this context`);
      if (Object.hasOwn(object, key)) throw new YamlError(`yaml: line ${l.number}: mapping key "${key}" already defined at line ${l.number - 1}`);
      i++;
      if (rest !== undefined && rest !== '') object[key] = scalar(rest, l.number);
      else if (i < useful.length && useful[i].indent > indent) object[key] = block(useful[i].indent);
      else if (i < useful.length && useful[i].indent === indent && useful[i].content.startsWith('- ')) object[key] = block(indent);
      else object[key] = '';
    }
    if (i < useful.length && useful[i].indent > indent) throw new YamlError(`yaml: line ${useful[i].number}: did not find expected key`);
    return object;
  };
  if (!useful.length) return {};
  const root = block(useful[0].indent);
  if (i < useful.length) throw new YamlError(`yaml: line ${useful[i].number}: did not find expected key`);
  return root;
}

const simulatedNotGame = (number: number) => `yaml: line ${number}: (long syntax is not simulated here)`;

// Un # commence un commentaire, sauf entre guillemets.
function commentRetirer(line: string): string {
  let quote: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") quote = c;
    else if (c === '#' && (i === 0 || /\s/.test(line[i - 1]))) return line.slice(0, i).trimEnd();
  }
  return line.trimEnd();
}

/** Lit un fichier .env : VARIABLE=valeur par ligne. */
export function readEnv(text: string | null): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const line of (text ?? '').split('\n')) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !line.trim().startsWith('#')) vars[m[1]] = m[2].replace(/^(["'])(.*)\1$/, '$2');
  }
  return vars;
}

// ——— Le projet ———

export interface Service {
  name: string;
  image: string;
  ports: string[];
  volumes: string[];
  env: Record<string, string>;
  dependencies: string[];
  reboot: string;
  user: string;
  onlyRead: boolean;
  capDrop: string[];
  security: string[];
}

export interface Project {
  name: string;
  directory: string;
  services: Service[];
  volumes: string[];
  warnings: string[];
}

const SERVICE_KEYS = [
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
export function readProject(game: Game, directory: string): Project {
  const file = ['compose.yaml', 'compose.yml', 'docker-compose.yml', 'docker-compose.yaml']
    .map((f) => `${directory}/${f}`)
    .find((f) => game.exists(f));
  if (!file) throw new YamlError('no configuration file provided: not found');
  const env = readEnv(game.read(`${directory}/.env`));
  const warnings: string[] = [];
  // ${VAR}, ${VAR:-défaut} : remplacées avant la lecture, comme Compose.
  const raw = (game.read(file) ?? '').replace(
    /\$\{([A-Za-z_][A-Za-z0-9_]*)(?::?-([^}]*))?\}|\$([A-Za-z_][A-Za-z0-9_]*)/g,
    (_, a: string, fallback: string | undefined, b: string) => {
      const name = a ?? b;
      if (env[name] !== undefined && env[name] !== '') return env[name];
      if (fallback !== undefined) return fallback;
      if (!warnings.some((x) => x.includes(`"${name}"`))) warnings.push(`The "${name}" variable is not set. Defaulting to a blank string.`);
      return '';
    },
  );
  const root = readYaml(raw);
  if (typeof root !== 'object' || Array.isArray(root)) throw new YamlError(`Top-level object must be a mapping`);
  if ('version' in root)
    warnings.push(`${file}: the attribute \`version\` is obsolete, it will be ignored, please remove it to avoid potential confusion`);
  const services = root.services;
  if (!services || typeof services !== 'object' || Array.isArray(services)) throw new YamlError(`validating ${file}: services must be a mapping`);
  const listing = (v: Value | undefined, path: string): string[] => {
    if (v === undefined || v === '') return [];
    if (!Array.isArray(v)) throw new YamlError(`validating ${file}: ${path} must be a array`);
    return v.map(String);
  };
  const result: Service[] = Object.entries(services).map(([name, s]) => {
    if (typeof s !== 'object' || Array.isArray(s)) throw new YamlError(`validating ${file}: services.${name} must be a mapping`);
    const unknown = Object.keys(s).find((k) => !SERVICE_KEYS.includes(k));
    if (unknown) throw new YamlError(`validating ${file}: services.${name} additional properties '${unknown}' not allowed`);
    if (!s.image) throw new YamlError(`service "${name}" has neither an image nor a build context specified: invalid compose project`);
    const e = s.environment;
    const variables: Record<string, string> = {};
    const envFiles = typeof s.env_file === 'string' ? (s.env_file ? [s.env_file] : []) : listing(s.env_file, `services.${name}.env_file`);
    for (const f of envFiles) Object.assign(variables, readEnv(game.read(`${directory}/${f.replace(/^\.\//, '')}`)));
    if (Array.isArray(e))
      for (const x of e.map(String)) {
        const k = x.split('=')[0];
        variables[k] = x.slice(k.length + 1);
      }
    else if (e && typeof e === 'object') for (const [k, v] of Object.entries(e)) variables[k] = String(v);
    const dep = s.depends_on;
    return {
      name,
      image: String(s.image),
      ports: listing(s.ports, `services.${name}.ports`),
      volumes: listing(s.volumes, `services.${name}.volumes`),
      env: variables,
      dependencies: Array.isArray(dep) ? dep.map(String) : dep && typeof dep === 'object' ? Object.keys(dep) : [],
      reboot: s.restart ? String(s.restart) : 'no',
      user: s.user ? String(s.user) : '',
      onlyRead: String(s.read_only ?? '') === 'true',
      capDrop: listing(s.cap_drop, `services.${name}.cap_drop`),
      security: listing(s.security_opt, `services.${name}.security_opt`),
    };
  });
  for (const s of result)
    for (const dep of s.dependencies)
      if (!result.some((x) => x.name === dep))
        throw new YamlError(`service "${s.name}" depends on undefined service "${dep}": invalid compose project`);
  const volumes = root.volumes && typeof root.volumes === 'object' && !Array.isArray(root.volumes) ? Object.keys(root.volumes) : [];
  for (const s of result)
    for (const v of s.volumes) {
      const source = v.split(':')[0];
      if (!/^[./~]/.test(source) && !volumes.includes(source))
        throw new YamlError(`service "${s.name}" refers to undefined volume ${source}: invalid compose project`);
    }
  const name = directory
    .split('/')
    .filter(Boolean)
    .at(-1)!
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '');
  return { name, directory, services: result, volumes, warnings };
}

/** L'ordre de démarrage : les dépendances d'abord (depends_on). */
export function order(p: Project): Service[] {
  const done: Service[] = [];
  const visiter = (s: Service) => {
    if (done.includes(s)) return;
    for (const d of s.dependencies) visiter(p.services.find((x) => x.name === d)!);
    done.push(s);
  };
  p.services.forEach(visiter);
  return done;
}

export const containerName = (p: Project, s: Service) => `${p.name}-${s.name}-1`;

// L'empreinte de la configuration d'un service : si elle change, up recrée le conteneur.
export const fingerprint = (s: Service) =>
  JSON.stringify([
    s.image,
    s.ports,
    s.volumes,
    s.env,
    s.reboot,
    ...(s.user || s.onlyRead || s.capDrop.length || s.security.length ? [s.user, s.onlyRead, s.capDrop, s.security] : []),
  ]);

export interface ComposeContainer extends Container {
  project: string;
  service: string;
  fingerprint: string;
}

export const projectContainers = (d: DockerState, project: string) =>
  d.containers.filter((c) => (c as ComposeContainer).project === project) as ComposeContainer[];

/** Crée (ou recrée) et démarre les conteneurs du projet ; renvoie les lignes « ✔ … ». */
export function mount(game: Shell, p: Project, createImage: (name: string) => boolean): { lines: string[]; error?: string } {
  const d = docker(game)!;
  const lines: string[] = [];
  const network = `${p.name}_default`;
  const reseaux: Record<string, true> = (game.state.dockerReseaux ??= {});
  if (!reseaux[network]) {
    reseaux[network] = true;
    lines.push(` ✔ Network ${network}  Created`);
  }
  for (const v of p.volumes) {
    const name = `${p.name}_${v}`;
    if (!d.volumes[name]) {
      d.volumes[name] = { created: clock(game), data: {} };
      lines.push(` ✔ Volume "${name}"  Created`);
    }
  }
  for (const s of order(p)) {
    if (!createImage(s.image))
      return { lines, error: `Error response from daemon: manifest for ${s.image} not found: manifest unknown: manifest unknown` };
    const name = containerName(p, s);
    const existing = projectContainers(d, p.name).find((c) => c.service === s.name);
    if (existing && existing.fingerprint === fingerprint(s)) {
      const failure = existing.state !== 'running' ? launch(game, existing) : null;
      if (failure) return { lines, error: `Error response from daemon: ${failure}` };
      lines.push(` ✔ Container ${name}  ${existing.state === 'running' ? 'Running' : 'Started'}`);
      continue;
    }
    if (existing) {
      stop(game, existing);
      d.containers = d.containers.filter((c) => c !== existing);
    }
    const ports: Port[] = s.ports.map((x) => {
      const parts = x.replace(/\/tcp$/, '').split(':');
      const [ip, host, container] =
        parts.length === 3 ? parts : parts.length === 2 ? ['0.0.0.0', ...parts] : ['0.0.0.0', String(32768 + d.next), parts[0]];
      return { ip, host: Number(host), container: Number(container) };
    });
    const busy = ports.find((x) => d.containers.some((c) => c.state === 'running' && c.ports.some((q) => q.host === x.host)));
    if (busy)
      return {
        lines,
        error: `Error response from daemon: driver failed programming external connectivity on endpoint ${name} (${identifier('ep' + name)}): Bind for 0.0.0.0:${busy.host} failed: port is already allocated`,
      };
    const mounts: Mount[] = s.volumes.map((v) => {
      const [source, target, mode] = v.split(':');
      const bind = /^[./~]/.test(source);
      return {
        type: bind ? 'bind' : 'volume',
        source: bind ? game.resolve(`${p.directory}/${source}`) : `${p.name}_${source}`,
        target,
        onlyRead: mode === 'ro',
      };
    });
    const c: ComposeContainer = {
      id: identifier(`compose-${name}-${d.next++}`),
      name,
      image: s.image.includes(':') ? s.image : `${s.image}:latest`,
      state: 'created',
      code: 0,
      ports,
      mounts,
      env: { ...s.env },
      reboot: s.reboot,
      created: clock(game),
      start: 0,
      end: 0,
      layer: {},
      log: [],
      ip: `172.18.0.${projectContainers(d, p.name).length + 2}`,
      project: p.name,
      service: s.name,
      fingerprint: fingerprint(s),
      ...(s.user ? { user: s.user } : {}),
      ...(s.onlyRead ? { onlyRead: true } : {}),
      ...(s.capDrop.length ? { capDrop: s.capDrop } : {}),
      ...(s.security.length ? { security: s.security } : {}),
    };
    d.containers.push(c);
    const failure = launch(game, c);
    if (failure)
      return { lines: [...lines, ` ✔ Container ${name}  ${existing ? 'Recreated' : 'Created'}`], error: `Error response from daemon: ${failure}` };
    lines.push(` ✔ Container ${name}  ${existing ? 'Recreated' : 'Started'}`);
  }
  // Un service qui s'est arrêté au démarrage (sa dépendance n'était pas prête)
  // repart, comme le fait Docker, si sa politique de redémarrage le permet.
  for (const c of projectContainers(d, p.name))
    if (c.state === 'exited' && c.code !== 0 && ['always', 'unless-stopped', 'on-failure'].includes(c.reboot.split(':')[0])) launch(game, c);
  return { lines };
}

/** Le conteneur d'un service joignable par son nom depuis un autre conteneur du même projet. */
export function reach(game: Game, since: Container, host: string): Container | null {
  const d = docker(game)!;
  const project = (since as ComposeContainer).project;
  if (!project) return null;
  return projectContainers(d, project).find((c) => c.service === host || c.name === host) ?? null;
}
