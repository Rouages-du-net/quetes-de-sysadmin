// kubectl, on a machine with a k3s cluster (state.k8s, see k8s.ts):
// get, describe, logs, apply, create, delete, edit, rollout, scale, set
// image, exec, port-forward, run, expose, top, explain, cluster-info,
// version, config, api-resources. Outputs, columns and messages follow
// kubectl 1.31 and the API server's (their printers use Go's tabwriter).
// Sources: https://kubernetes.io/docs/reference/kubectl/,
// https://kubernetes.io/docs/reference/kubectl/generated/,
// https://kubernetes.io/docs/reference/kubectl/jsonpath/,
// https://docs.k3s.io/cluster-access (the kubeconfig, /etc/rancher/k3s/k3s.yaml).

import type { Command } from './index';
import type { Shell } from '../shell';
import { readYaml } from '../ansible';
import {
  K3S_VERSION,
  KINDS,
  advance,
  age,
  base64Encode,
  base64Decode,
  carryOut,
  clone,
  clusterUp,
  containerExec,
  decode,
  deploymentCounts,
  endpointsObject,
  endpointsOf,
  eventsFor,
  find,
  full,
  invalidMessage,
  iso,
  k8s,
  kindFor,
  kindOf,
  list,
  mebibytes,
  millicores,
  newReplicaSet,
  normalise,
  imageDigest,
  ns,
  phase,
  plan,
  podConditions,
  podReady,
  podRequests,
  podStatusText,
  podUsage,
  nodeUsage,
  qosClass,
  quantity,
  readManifests,
  record,
  remove,
  resourceName,
  revisionOf,
  rfc1123z,
  routes,
  sliceName,
  stable,
  tabwrite,
  toJson,
  toYaml,
  update,
  validate,
  withDefaults,
  create,
  type K8s,
  type Kind,
  type Obj,
} from '../k8s';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type J = any;

const REFUSED = 'The connection to the server 127.0.0.1:6443 was refused - did you specify the right host or port?';

// ——— Options (pflag: --name=value, --name value, -n value, -nvalue, -it) ———

const VALUE_FLAGS: Record<string, string> = {
  namespace: 'n',
  output: 'o',
  selector: 'l',
  filename: 'f',
  container: 'c',
  tail: '',
  replicas: '',
  'to-revision': '',
  revision: '',
  timeout: '',
  'dry-run': '',
  'from-literal': '',
  'from-file': '',
  'from-env-file': '',
  image: '',
  port: '',
  'target-port': '',
  type: '',
  name: '',
  protocol: '',
  'grace-period': '',
  since: '',
  kubeconfig: '',
  context: '',
  restart: '',
  env: '',
  labels: '',
  cascade: '',
  address: '',
  'sort-by': '',
  'field-selector': '',
  validate: '',
  'pod-running-timeout': '',
  'docker-server': '',
  'docker-username': '',
  'docker-password': '',
  cluster: '',
  user: '',
  wait: '',
};
const BOOL_FLAGS: Record<string, string> = {
  'all-namespaces': 'A',
  watch: 'w',
  'show-labels': '',
  previous: 'p',
  follow: '',
  recursive: 'R',
  stdin: 'i',
  tty: 't',
  force: '',
  now: '',
  all: '',
  current: '',
  timestamps: '',
  record: '',
  'ignore-not-found': '',
  overwrite: '',
  'no-headers': '',
  'save-config': '',
  client: '',
  minify: '',
  raw: '',
  quiet: 'q',
  rm: '',
  containers: '',
  prefix: '',
  'show-kind': '',
  'recursive-list': '',
};

interface Args {
  pos: string[];
  flags: Record<string, string[]>;
  after: string[] | null;
  error?: string;
}

function parse(args: string[], sub: string): Args {
  const flags: Record<string, string[]> = {};
  const pos: string[] = [];
  let after: string[] | null = null;
  const put = (name: string, v: string) => (flags[name] ??= []).push(v);
  const byShort = (c: string) => Object.entries({ ...VALUE_FLAGS, ...BOOL_FLAGS }).find(([, s]) => s === c)?.[0];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--') {
      after = args.slice(i + 1);
      break;
    }
    if (a.startsWith('--')) {
      const [n, ...rest] = a.slice(2).split('=');
      const value = rest.length ? rest.join('=') : undefined;
      if (n in VALUE_FLAGS) {
        if (value !== undefined) put(n, value);
        else if (n === 'dry-run') put(n, 'client');
        else if (i + 1 < args.length) put(n, args[++i]);
        else return { pos, flags, after, error: `error: flag needs an argument: --${n}\nSee 'kubectl ${sub} --help' for usage.` };
      } else if (n in BOOL_FLAGS) put(n, value ?? 'true');
      else return { pos, flags, after, error: `error: unknown flag: --${n}\nSee 'kubectl ${sub} --help' for usage.` };
      continue;
    }
    if (a.startsWith('-') && a.length > 1 && !/^-\d/.test(a)) {
      const letters = a.slice(1);
      for (let j = 0; j < letters.length; j++) {
        let c = letters[j];
        // kubectl logs -f is --follow; elsewhere it is --filename.
        if (c === 'f' && sub === 'logs') {
          put('follow', 'true');
          continue;
        }
        if (c === 'p' && sub !== 'logs') c = '\0';
        const n = byShort(c);
        if (!n) return { pos, flags, after, error: `error: unknown shorthand flag: '${letters[j]}' in ${a}\nSee 'kubectl ${sub} --help' for usage.` };
        if (n in VALUE_FLAGS) {
          const rest = letters.slice(j + 1).replace(/^=/, '');
          if (rest) put(n, rest);
          else if (i + 1 < args.length) put(n, args[++i]);
          else return { pos, flags, after, error: `error: flag needs an argument: '${c}' in -${c}\nSee 'kubectl ${sub} --help' for usage.` };
          break;
        }
        put(n, 'true');
      }
      continue;
    }
    pos.push(a);
  }
  return { pos, flags, after };
}
const flag = (a: Args, n: string) => a.flags[n]?.at(-1);
const has = (a: Args, n: string) => a.flags[n] !== undefined && flag(a, n) !== 'false';

// ——— The kubeconfig ———

interface Config {
  path: string;
  namespace: string;
  context: string;
  text: string;
}

function kubeconfig(game: Shell, a: Args): Config | { error: string } {
  const home = game.who === 'root' ? '/root' : game.home;
  const explicit = flag(a, 'kubeconfig') ?? game.environment.KUBECONFIG;
  const fallback = game.find(`${home}/.kube/config`) ? `${home}/.kube/config` : '/etc/rancher/k3s/k3s.yaml';
  const path = explicit ? game.resolve(explicit) : fallback;
  const n = game.find(path);
  if (!n) return explicit ? { error: `error: stat ${explicit}: no such file or directory` } : { error: REFUSED.replace('127.0.0.1:6443', 'localhost:8080') };
  if (n.type === 'directory') return { error: `error: error loading config file "${path}": read ${path}: is a directory` };
  if (!game.can(n, 'r')) {
    const warn = path === '/etc/rancher/k3s/k3s.yaml' ? `WARN[0000] Unable to read /etc/rancher/k3s/k3s.yaml, please start server with --write-kubeconfig-mode or --write-kubeconfig-group to modify kube config permissions \n` : '';
    return { error: `${warn}error: error loading config file "${path}": open ${path}: permission denied` };
  }
  const text = game.read(path) ?? '';
  let v: J;
  try {
    v = readYaml(text);
  } catch {
    return { error: `error: error loading config file "${path}": couldn't get version/kind; json parse error: invalid character 'a' looking for beginning of value` };
  }
  const context = flag(a, 'context') ?? (typeof v?.['current-context'] === 'string' ? v['current-context'] : '');
  const c = (Array.isArray(v?.contexts) ? v.contexts : []).find((x: J) => x?.name === context);
  if (!c) return { error: `error: context was not found for specified context: ${context}` };
  return { path, namespace: typeof c.context?.namespace === 'string' && c.context.namespace ? c.context.namespace : 'default', context, text };
}

// ——— Printing ———

const labelsText = (l: Record<string, string>) => (Object.keys(l).length ? Object.keys(l).sort().map((x) => `${x}=${l[x]}`).join(',') : '<none>');
const selectorText = (s: J) => {
  const parts = Object.keys(s?.matchLabels ?? {}).sort().map((x) => `${x}=${s.matchLabels[x]}`);
  for (const e of s?.matchExpressions ?? []) parts.push(e.operator === 'Exists' ? e.key : e.operator === 'DoesNotExist' ? `!${e.key}` : `${e.key} ${e.operator.toLowerCase()} (${(e.values ?? []).join(',')})`);
  return parts.join(',') || '<none>';
};
const tableOut = (rows: string[][]) => tabwrite(rows.map((r) => r.join('\t')).join('\n'), 6, 3);

const restartsText = (k: K8s, o: Obj) => {
  const cs = o.pod?.containers ?? [];
  const n = cs.reduce((s, c) => s + c.restarts, 0);
  const lastEnd = Math.max(0, ...cs.map((c) => c.last?.finished ?? c.terminated?.finished ?? 0));
  return n && lastEnd ? `${n} (${age(k.now - lastEnd)} ago)` : String(n);
};

const portsText = (svc: Obj) =>
  (svc.body.spec.ports ?? []).map((p: J) => `${p.port}${p.nodePort ? `:${p.nodePort}` : ''}/${p.protocol ?? 'TCP'}`).join(',') || '<none>';

const endpointsText = (addrs: string[]) => (addrs.length ? (addrs.length > 3 ? `${addrs.slice(0, 3).join(',')} + ${addrs.length - 3} more...` : addrs.join(',')) : '<none>');

/** A virtual object (Endpoints, EndpointSlice, Event) or a stored one. */
interface Item {
  kind: string;
  namespace: string;
  name: string;
  labels: Record<string, string>;
  created: number;
  obj?: Obj;
  svc?: Obj;
  event?: import('../k8s').Ev;
}

function items(k: K8s, kind: Kind, namespace: string | null): Item[] {
  if (kind.kind === 'Endpoints' || kind.kind === 'EndpointSlice')
    return list(k, 'Service', namespace).map((svc) => ({ kind: kind.kind, namespace: ns(svc), name: kind.kind === 'Endpoints' ? svc.metadata.name : sliceName(svc), labels: kind.kind === 'EndpointSlice' ? { ...svc.metadata.labels, 'endpointslice.kubernetes.io/managed-by': 'endpointslice-controller.k8s.io', 'kubernetes.io/service-name': svc.metadata.name } : { ...svc.metadata.labels }, created: svc.metadata.created, svc }));
  if (kind.kind === 'Event')
    return k.events
      .filter((e) => namespace === null || e.namespace === namespace)
      .sort((a, b) => a.last - b.last)
      .map((e) => ({ kind: 'Event', namespace: e.namespace, name: e.id, labels: {}, created: e.first, event: e }));
  return list(k, kind.kind, namespace).map((o) => ({ kind: o.kind, namespace: ns(o), name: o.metadata.name, labels: o.metadata.labels, created: o.metadata.created, obj: o }));
}

function columns(k: K8s, kind: string, wide: boolean): { head: string[]; row: (i: Item) => string[] } {
  const since = (t: number) => age(k.now - t);
  switch (kind) {
    case 'Pod':
      return {
        head: ['NAME', 'READY', 'STATUS', 'RESTARTS', 'AGE', ...(wide ? ['IP', 'NODE', 'NOMINATED NODE', 'READINESS GATES'] : [])],
        row: (i) => {
          const o = i.obj!;
          const cs = o.pod!.containers;
          return [i.name, `${cs.filter((c) => c.ready).length}/${o.body.spec.containers.length}`, podStatusText(o), restartsText(k, o), since(i.created), ...(wide ? [o.pod!.ip || '<none>', o.pod!.scheduled ? k.node.name : '<none>', '<none>', '<none>'] : [])];
        },
      };
    case 'Deployment':
      return {
        head: ['NAME', 'READY', 'UP-TO-DATE', 'AVAILABLE', 'AGE', ...(wide ? ['CONTAINERS', 'IMAGES', 'SELECTOR'] : [])],
        row: (i) => {
          const o = i.obj!;
          const c = deploymentCounts(k, o);
          const cs = o.body.spec.template.spec.containers ?? [];
          return [i.name, `${c.ready}/${c.want}`, String(c.updated), String(c.available), since(i.created), ...(wide ? [cs.map((x: J) => x.name).join(','), cs.map((x: J) => x.image).join(','), selectorText(o.body.spec.selector)] : [])];
        },
      };
    case 'ReplicaSet':
      return {
        head: ['NAME', 'DESIRED', 'CURRENT', 'READY', 'AGE', ...(wide ? ['CONTAINERS', 'IMAGES', 'SELECTOR'] : [])],
        row: (i) => {
          const o = i.obj!;
          const pods = k.objects.filter((p) => p.kind === 'Pod' && p.metadata.owner?.uid === o.metadata.uid);
          const cs = o.body.spec.template.spec.containers ?? [];
          return [i.name, String(o.body.spec.replicas ?? 0), String(pods.length), String(pods.filter(podReady).length), since(i.created), ...(wide ? [cs.map((x: J) => x.name).join(','), cs.map((x: J) => x.image).join(','), selectorText(o.body.spec.selector)] : [])];
        },
      };
    case 'Service':
      return {
        head: ['NAME', 'TYPE', 'CLUSTER-IP', 'EXTERNAL-IP', 'PORT(S)', 'AGE', ...(wide ? ['SELECTOR'] : [])],
        row: (i) => {
          const s = i.obj!.body.spec;
          return [i.name, s.type, s.clusterIP ?? '<none>', s.type === 'LoadBalancer' ? k.node.ip : '<none>', portsText(i.obj!), since(i.created), ...(wide ? [s.selector ? labelsText(s.selector) : '<none>'] : [])];
        },
      };
    case 'Endpoints':
      return {
        head: ['NAME', 'ENDPOINTS', 'AGE'],
        row: (i) => [i.name, endpointsText(endpointsOf(k, i.svc!).filter((e) => e.ready).flatMap((e) => e.ports.map((p) => `${e.pod.pod!.ip}:${p.port}`))), since(i.created)],
      };
    case 'EndpointSlice':
      return {
        head: ['NAME', 'ADDRESSTYPE', 'PORTS', 'ENDPOINTS', 'AGE'],
        row: (i) => {
          const eps = endpointsOf(k, i.svc!);
          const ports = [...new Set(eps.flatMap((e) => e.ports.map((p) => String(p.port))))];
          return [i.name, 'IPv4', ports.join(',') || '<unset>', eps.length ? endpointsText(eps.map((e) => e.pod.pod!.ip)) : '<unset>', since(i.created)];
        },
      };
    case 'Ingress':
      return {
        head: ['NAME', 'CLASS', 'HOSTS', 'ADDRESS', 'PORTS', 'AGE'],
        row: (i) => {
          const s = i.obj!.body.spec ?? {};
          const hosts = (s.rules ?? []).map((r: J) => r.host || '*');
          return [i.name, s.ingressClassName ?? '<none>', hosts.join(',') || '*', k.node.ip, s.tls?.length ? '80, 443' : '80', since(i.created)];
        },
      };
    case 'ConfigMap':
      return { head: ['NAME', 'DATA', 'AGE'], row: (i) => [i.name, String(Object.keys(i.obj!.body.data ?? {}).length + Object.keys(i.obj!.body.binaryData ?? {}).length), since(i.created)] };
    case 'Secret':
      return { head: ['NAME', 'TYPE', 'DATA', 'AGE'], row: (i) => [i.name, i.obj!.body.type ?? 'Opaque', String(Object.keys(i.obj!.body.data ?? {}).length), since(i.created)] };
    case 'Namespace':
      return { head: ['NAME', 'STATUS', 'AGE'], row: (i) => [i.name, 'Active', since(i.created)] };
    case 'Node':
      return {
        head: ['NAME', 'STATUS', 'ROLES', 'AGE', 'VERSION', ...(wide ? ['INTERNAL-IP', 'EXTERNAL-IP', 'OS-IMAGE', 'KERNEL-VERSION', 'CONTAINER-RUNTIME'] : [])],
        row: (i) => [i.name, 'Ready', 'control-plane,master', since(i.created), K3S_VERSION, ...(wide ? [k.node.ip, '<none>', k.node.os, k.node.kernel, 'containerd://1.7.23-k3s2'] : [])],
      };
    case 'IngressClass':
      return { head: ['NAME', 'CONTROLLER', 'PARAMETERS', 'AGE'], row: (i) => [i.name, i.obj!.body.spec.controller, '<none>', since(i.created)] };
    case 'Event':
      return {
        head: ['LAST SEEN', 'TYPE', 'REASON', 'OBJECT', 'MESSAGE'],
        row: (i) => {
          const e = i.event!;
          return [since(e.last), e.type, e.reason, `${e.kind.toLowerCase()}/${e.name}`, e.message];
        },
      };
  }
  return { head: ['NAME', 'AGE'], row: (i) => [i.name, since(i.created)] };
}

// ——— Label selectors (-l): =, ==, !=, in, notin, exists, !key ———

function selector(text: string): ((l: Record<string, string>) => boolean) | null {
  const parts = text.match(/[^,(]+(\([^)]*\))?/g) ?? [];
  const tests: ((l: Record<string, string>) => boolean)[] = [];
  for (const raw of parts) {
    const p = raw.trim();
    let m: RegExpExecArray | null;
    if ((m = /^([\w./-]+)\s*(==|=|!=)\s*([\w./-]*)$/.exec(p))) {
      const [, key, op, v] = m;
      tests.push((l) => (op === '!=' ? l[key] !== v : l[key] === v));
    } else if ((m = /^([\w./-]+)\s+(in|notin)\s*\(([^)]*)\)$/.exec(p))) {
      const [, key, op, vs] = m;
      const values = vs.split(',').map((x) => x.trim());
      tests.push((l) => (op === 'in' ? values.includes(l[key]) : !values.includes(l[key])));
    } else if ((m = /^!([\w./-]+)$/.exec(p))) {
      const key = m[1];
      tests.push((l) => !(key in l));
    } else if ((m = /^([\w./-]+)$/.exec(p))) {
      const key = m[1];
      tests.push((l) => key in l);
    } else return null;
  }
  return (l) => tests.every((t) => t(l));
}

// ——— jsonpath (https://kubernetes.io/docs/reference/kubectl/jsonpath/) ———

function jsonpath(template: string, root: J): string | { error: string } {
  const t = template.replace(/^'|'$/g, '');
  const tokens: { lit?: string; expr?: string }[] = [];
  const re = /\{([^{}]*)\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    if (m.index > last) tokens.push({ lit: t.slice(last, m.index) });
    tokens.push({ expr: m[1].trim() });
    last = m.index + m[0].length;
  }
  if (last < t.length) tokens.push({ lit: t.slice(last) });
  if (!tokens.some((x) => x.expr !== undefined)) tokens.splice(0, tokens.length, { expr: t });
  const evalPath = (path: string, ctx: J): J[] => {
    if (path === '@' || path === '.' || path === '') return [ctx];
    const steps = path.replace(/^@/, '').match(/\.\.?[^.[\]]*(?:\\\.[^.[\]]*)*|\[[^\]]*\]/g) ?? [];
    let cur: J[] = [ctx];
    for (const s of steps) {
      const next: J[] = [];
      for (const c of cur) {
        if (s.startsWith('[')) {
          const inner = s.slice(1, -1).trim();
          if (inner === '*') next.push(...(Array.isArray(c) ? c : c && typeof c === 'object' ? Object.values(c) : []));
          else if (/^-?\d+$/.test(inner)) {
            const i = Number(inner);
            if (Array.isArray(c) && c.at(i) !== undefined) next.push(c.at(i));
          } else if (/^'.*'$|^".*"$/.test(inner)) {
            if (c && typeof c === 'object' && inner.slice(1, -1) in c) next.push(c[inner.slice(1, -1)]);
          } else if (/^\?\(@\.([\w.-]+)\s*==\s*["']([^"']*)["']\)$/.test(inner)) {
            const f = /^\?\(@\.([\w.-]+)\s*==\s*["']([^"']*)["']\)$/.exec(inner)!;
            for (const x of Array.isArray(c) ? c : []) if (String(f[1].split('.').reduce((o: J, key: string) => o?.[key], x)) === f[2]) next.push(x);
          }
        } else {
          const key = s.replace(/^\.+/, '').replace(/\\\./g, '.');
          if (key === '*') next.push(...(Array.isArray(c) ? c : c && typeof c === 'object' ? Object.values(c) : []));
          else if (c && typeof c === 'object' && !Array.isArray(c) && key in c) next.push(c[key]);
          else if (!key) next.push(c);
        }
      }
      cur = next;
    }
    return cur;
  };
  const show = (v: J) => (v && typeof v === 'object' ? JSON.stringify(v) : String(v));
  let out = '';
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok.lit !== undefined) {
      out += tok.lit;
      continue;
    }
    const e = tok.expr!;
    if (/^".*"$/.test(e)) {
      out += e.slice(1, -1).replace(/\\n/g, '\n').replace(/\\t/g, '\t');
      continue;
    }
    const range = /^range\s+(.*)$/.exec(e);
    if (range) {
      let depth = 1;
      let j = i + 1;
      for (; j < tokens.length; j++) {
        if (tokens[j].expr?.startsWith('range ')) depth++;
        if (tokens[j].expr === 'end' && --depth === 0) break;
      }
      const body = tokens.slice(i + 1, j);
      for (const x of evalPath(range[1], root)) {
        for (const b of body) {
          if (b.lit !== undefined) out += b.lit;
          else if (/^".*"$/.test(b.expr!)) out += b.expr!.slice(1, -1).replace(/\\n/g, '\n').replace(/\\t/g, '\t');
          else out += evalPath(b.expr!, x).map(show).join(' ');
        }
      }
      i = j;
      continue;
    }
    if (e === 'end') continue;
    const vals = evalPath(e, root);
    if (!vals.length && !/\[\*\]|\.\*/.test(e)) return { error: `error: error executing jsonpath "${template.replace(/^'|'$/g, '')}": Error executing template: ${e.split('.').filter(Boolean).at(-1)} is not found. Printing more information for debugging the template:\n\ttemplate was:\n\t\t${template}\n\tobject given to jsonpath engine was:\n\t\t${JSON.stringify(root).slice(0, 200)}\n\n` };
    out += vals.map(show).join(' ');
  }
  return out;
}

// ——— Describe ———

const describeLabels = (title: string, l: Record<string, string>, indent = '') => {
  const keys = Object.keys(l).filter((x) => x !== 'kubectl.kubernetes.io/last-applied-configuration').sort();
  if (!keys.length) return [`${indent}${title}\t<none>`];
  return keys.map((x, i) => `${i === 0 ? `${indent}${title}` : ''}\t${title.startsWith('Annotations') ? `${x}: ${l[x]}` : `${x}=${l[x]}`}`);
};

function eventLines(k: K8s, uid: string): string[] {
  const evs = eventsFor(k, uid);
  if (!evs.length) return ['Events:\t<none>'];
  return [
    'Events:',
    '  Type\tReason\tAge\tFrom\tMessage',
    '  ----\t------\t----\t----\t-------',
    ...evs.map((e) => `  ${e.type}\t${e.reason}\t${e.count > 1 ? `${age(k.now - e.last)} (x${e.count} over ${age(k.now - e.first)})` : age(k.now - e.first)}\t${e.source}\t${e.message}`),
  ];
}

const probeText = (p: J) => {
  const tail = `delay=${p.initialDelaySeconds ?? 0}s timeout=${p.timeoutSeconds ?? 1}s period=${p.periodSeconds ?? 10}s #success=${p.successThreshold ?? 1} #failure=${p.failureThreshold ?? 3}`;
  if (p.httpGet) return `http-get ${(p.httpGet.scheme ?? 'HTTP').toLowerCase()}://${p.httpGet.host ?? ''}:${p.httpGet.port}${p.httpGet.path ?? '/'} ${tail}`;
  if (p.tcpSocket) return `tcp-socket ${p.tcpSocket.host ?? ''}:${p.tcpSocket.port} ${tail}`;
  if (p.exec) return `exec [${(p.exec.command ?? []).join(' ')}] ${tail}`;
  return tail;
};

function containerBlock(k: K8s, c: J, cr: import('../k8s').ContainerRun | undefined, indent: string, template: boolean): string[] {
  // A pod's containers: the name at 2 spaces, its fields at 4; a template's: 3 and 4.
  const i = template ? '  ' : indent;
  const out: string[] = [`${indent}${c.name}:`];
  if (!template) out.push(`${i}  Container ID:\t${cr?.id ? `containerd://${cr.id}` : ''}`);
  out.push(`${i}  Image:\t${c.image}`);
  if (!template) out.push(`${i}  Image ID:\t${k.images.includes(normalise(c.image)) && cr?.id ? imageDigest(c.image) : ''}`);
  const ports = c.ports ?? [];
  if (!ports.length) out.push(`${i}  Port:\t<none>`, `${i}  Host Port:\t<none>`);
  else if (ports.length === 1) out.push(`${i}  Port:\t${ports[0].containerPort}/${ports[0].protocol ?? 'TCP'}`, `${i}  Host Port:\t${ports[0].hostPort ?? 0}/${ports[0].protocol ?? 'TCP'}`);
  else out.push(`${i}  Ports:\t${ports.map((p: J) => `${p.containerPort}/${p.protocol ?? 'TCP'}`).join(', ')}`, `${i}  Host Ports:\t${ports.map((p: J) => `${p.hostPort ?? 0}/${p.protocol ?? 'TCP'}`).join(', ')}`);
  if (c.command) out.push(`${i}  Command:`, ...c.command.map((x: string) => `${i}    ${x}`));
  if (c.args) out.push(`${i}  Args:`, ...c.args.map((x: string) => `${i}    ${x}`));
  if (!template && cr) {
    const state = (title: string, s: { state: string; reason?: string; started?: number; finished?: number; exitCode?: number }) => {
      const lines = [`${i}  ${title}:\t${s.state}`];
      if (s.reason) lines.push(`${i}    Reason:\t${s.reason}`);
      if (s.exitCode !== undefined) lines.push(`${i}    Exit Code:\t${s.exitCode}`);
      if (s.started) lines.push(`${i}    Started:\t${rfc1123z(s.started)}`);
      if (s.finished) lines.push(`${i}    Finished:\t${rfc1123z(s.finished)}`);
      return lines;
    };
    if (cr.state === 'running') out.push(...state('State', { state: 'Running', started: cr.started }));
    else if (cr.state === 'terminated' && cr.terminated) out.push(...state('State', { state: 'Terminated', reason: cr.terminated.reason, exitCode: cr.terminated.exitCode, started: cr.terminated.started, finished: cr.terminated.finished }));
    else out.push(...state('State', { state: 'Waiting', reason: cr.reason || 'ContainerCreating' }));
    if (cr.last) out.push(...state('Last State', { state: 'Terminated', reason: cr.last.reason, exitCode: cr.last.exitCode, started: cr.last.started, finished: cr.last.finished }));
    out.push(`${i}  Ready:\t${cr.ready ? 'True' : 'False'}`, `${i}  Restart Count:\t${cr.restarts}`);
  }
  for (const [title, key] of [['Limits', 'limits'], ['Requests', 'requests']] as const) {
    const r = c.resources?.[key];
    if (r && Object.keys(r).length) out.push(`${i}  ${title}:`, ...Object.keys(r).sort().map((x) => `${i}    ${x}:\t${r[x]}`));
  }
  if (c.livenessProbe) out.push(`${i}  Liveness:\t${probeText(c.livenessProbe)}`);
  if (c.readinessProbe) out.push(`${i}  Readiness:\t${probeText(c.readinessProbe)}`);
  if (c.startupProbe) out.push(`${i}  Startup:\t${probeText(c.startupProbe)}`);
  if (c.envFrom?.length) {
    out.push(`${i}  Environment Variables from:`);
    for (const f of c.envFrom) {
      if (f.configMapRef) out.push(`${i}    ${f.configMapRef.name}\tConfigMap\tOptional: ${f.configMapRef.optional ?? false}`);
      if (f.secretRef) out.push(`${i}    ${f.secretRef.name}\tSecret\tOptional: ${f.secretRef.optional ?? false}`);
    }
  }
  const env = c.env ?? [];
  if (!env.length) out.push(`${i}  Environment:\t<none>`);
  else {
    out.push(`${i}  Environment:`);
    for (const e of env) {
      if (e.value !== undefined) out.push(`${i}    ${e.name}:\t${e.value}`);
      else if (e.valueFrom?.configMapKeyRef) out.push(`${i}    ${e.name}:\t<set to the key '${e.valueFrom.configMapKeyRef.key}' of config map '${e.valueFrom.configMapKeyRef.name}'>\tOptional: ${e.valueFrom.configMapKeyRef.optional ?? false}`);
      else if (e.valueFrom?.secretKeyRef) out.push(`${i}    ${e.name}:\t<set to the key '${e.valueFrom.secretKeyRef.key}' in secret '${e.valueFrom.secretKeyRef.name}'>\tOptional: ${e.valueFrom.secretKeyRef.optional ?? false}`);
      else if (e.valueFrom?.fieldRef) out.push(`${i}    ${e.name}:\t (${e.valueFrom.fieldRef.apiVersion ?? 'v1'}:${e.valueFrom.fieldRef.fieldPath})`);
      else out.push(`${i}    ${e.name}:\t`);
    }
  }
  const mounts = [...(c.volumeMounts ?? []).map((m: J) => `${m.mountPath}${m.subPath ? ` from ${m.name} (${m.readOnly ? 'ro' : 'rw'},path="${m.subPath}")` : ` from ${m.name} (${m.readOnly ? 'ro' : 'rw'})`}`)];
  if (!template) mounts.push(`/var/run/secrets/kubernetes.io/serviceaccount from kube-api-access-${apiAccess(c.name)} (ro)`);
  if (!mounts.length) out.push(`${i}  Mounts:\t<none>`);
  else out.push(`${i}  Mounts:`, ...mounts.map((m) => `${i}    ${m}`));
  return out;
}
const apiAccess = (seed: string) => [...seed.padEnd(5, 'x')].map((c) => 'bcdfghjklmnpqrstvwxz2456789'[c.charCodeAt(0) % 27]).join('').slice(0, 5);

function volumesBlock(vols: J[], indent: string): string[] {
  if (!vols.length) return [`${indent}Volumes:\t<none>`];
  const out = [`${indent}Volumes:`];
  for (const v of vols) {
    out.push(`${indent}  ${v.name}:`);
    if (v.configMap) out.push(`${indent}    Type:\tConfigMap (a volume populated by a ConfigMap)`, `${indent}    Name:\t${v.configMap.name}`, `${indent}    Optional:\t${v.configMap.optional ?? false}`);
    else if (v.secret) out.push(`${indent}    Type:\tSecret (a volume populated by a Secret)`, `${indent}    SecretName:\t${v.secret.secretName}`, `${indent}    Optional:\t${v.secret.optional ?? false}`);
    else if (v.emptyDir) out.push(`${indent}    Type:\tEmptyDir (a temporary directory that shares a pod's lifetime)`, `${indent}    Medium:\t${v.emptyDir.medium ?? ''}`, `${indent}    SizeLimit:\t<unset>`);
    else if (v.persistentVolumeClaim) out.push(`${indent}    Type:\tPersistentVolumeClaim (a reference to a PersistentVolumeClaim in the same namespace)`, `${indent}    ClaimName:\t${v.persistentVolumeClaim.claimName}`, `${indent}    ReadOnly:\tfalse`);
  }
  return out;
}

function describe(k: K8s, it: Item): string {
  const lines: string[] = [];
  const o = it.obj;
  const push = (...l: string[]) => lines.push(...l);
  switch (it.kind) {
    case 'Pod': {
      const r = o!.pod!;
      const owner = o!.metadata.owner;
      push(`Name:\t${it.name}`, `Namespace:\t${it.namespace}`, 'Priority:\t0', `Service Account:\t${o!.body.spec.serviceAccountName ?? 'default'}`, `Node:\t${r.scheduled ? `${k.node.name}/${k.node.ip}` : '<none>'}`);
      if (r.started) push(`Start Time:\t${rfc1123z(r.started)}`);
      push(...describeLabels('Labels:', o!.metadata.labels), ...describeLabels('Annotations:', o!.metadata.annotations), `Status:\t${phase(o!)}`);
      if (r.ip) push(`IP:\t${r.ip}`, 'IPs:', `  IP:\t${r.ip}`);
      else push('IP:\t', 'IPs:\t<none>');
      if (owner) push(`Controlled By:\t${owner.kind}/${owner.name}`);
      push('Containers:', ...o!.body.spec.containers.flatMap((c: J, i: number) => containerBlock(k, c, r.scheduled ? r.containers[i] : undefined, '  ', false)));
      push('Conditions:', '  Type\tStatus', ...podConditions(k, o!).map((c) => `  ${c.type} \t${c.status} `));
      push(
        ...volumesBlock(o!.body.spec.volumes ?? [], ''),
        `  kube-api-access-${apiAccess(o!.body.spec.containers[0]?.name ?? 'x')}:`,
        '    Type:\tProjected (a volume that contains injected data from multiple sources)',
        '    TokenExpirationSeconds:\t3607',
        '    ConfigMapName:\tkube-root-ca.crt',
        '    ConfigMapOptional:\t<nil>',
        '    DownwardAPI:\ttrue',
      );
      if (lines.includes('Volumes:\t<none>')) lines.splice(lines.indexOf('Volumes:\t<none>'), 1, 'Volumes:');
      push(`QoS Class:\t${qosClass(o!)}`, `Node-Selectors:\t${o!.body.spec.nodeSelector ? labelsText(o!.body.spec.nodeSelector) : '<none>'}`, 'Tolerations:\tnode.kubernetes.io/not-ready:NoExecute op=Exists for 300s', '\tnode.kubernetes.io/unreachable:NoExecute op=Exists for 300s');
      push(...eventLines(k, o!.metadata.uid));
      break;
    }
    case 'Deployment': {
      const s = o!.body.spec;
      const c = deploymentCounts(k, o!);
      const ru = s.strategy?.rollingUpdate;
      const fresh = newReplicaSet(k, o!);
      const olds = k.objects.filter((x) => x.kind === 'ReplicaSet' && x.metadata.owner?.uid === o!.metadata.uid && x !== fresh && (x.body.spec.replicas ?? 0) + k.objects.filter((p) => p.metadata.owner?.uid === x.metadata.uid).length > 0);
      const rsText = (rs: Obj) => `${rs.metadata.name} (${k.objects.filter((p) => p.metadata.owner?.uid === rs.metadata.uid).length}/${rs.body.spec.replicas ?? 0} replicas created)`;
      const full_ = full(k, o!);
      push(`Name:\t${it.name}`, `Namespace:\t${it.namespace}`, `CreationTimestamp:\t${rfc1123z(it.created)}`, ...describeLabels('Labels:', o!.metadata.labels), ...describeLabels('Annotations:', o!.metadata.annotations), `Selector:\t${selectorText(s.selector)}`);
      push(`Replicas:\t${c.want} desired | ${c.updated} updated | ${c.replicas} total | ${c.available} available | ${Math.max(0, c.want - c.available)} unavailable`, `StrategyType:\t${s.strategy?.type ?? 'RollingUpdate'}`, `MinReadySeconds:\t${s.minReadySeconds ?? 0}`);
      if (ru) push(`RollingUpdateStrategy:\t${ru.maxUnavailable} max unavailable, ${ru.maxSurge} max surge`);
      push('Pod Template:', ...describeLabels('Labels:', s.template.metadata?.labels ?? {}, '  '));
      if (Object.keys(s.template.metadata?.annotations ?? {}).length) push(...describeLabels('Annotations:', s.template.metadata.annotations, '  '));
      push('  Containers:', ...s.template.spec.containers.flatMap((x: J) => containerBlock(k, x, undefined, '   ', true)));
      push(...volumesBlock(s.template.spec.volumes ?? [], '  '), `  Node-Selectors:\t<none>`, `  Tolerations:\t<none>`);
      push('Conditions:', '  Type\tStatus\tReason', '  ----\t------\t------', ...full_.status.conditions.map((x: J) => `  ${x.type} \t${x.status}\t${x.reason}`));
      push(`OldReplicaSets:\t${olds.length ? olds.map(rsText).join(', ') : '<none>'}`, `NewReplicaSet:\t${fresh ? rsText(fresh) : '<none>'}`);
      push(...eventLines(k, o!.metadata.uid));
      break;
    }
    case 'ReplicaSet': {
      const s = o!.body.spec;
      const pods = k.objects.filter((p) => p.kind === 'Pod' && p.metadata.owner?.uid === o!.metadata.uid);
      const running = pods.filter((p) => phase(p) === 'Running').length;
      push(`Name:\t${it.name}`, `Namespace:\t${it.namespace}`, `Selector:\t${selectorText(s.selector)}`, ...describeLabels('Labels:', o!.metadata.labels), ...describeLabels('Annotations:', o!.metadata.annotations));
      if (o!.metadata.owner) push(`Controlled By:\t${o!.metadata.owner.kind}/${o!.metadata.owner.name}`);
      push(`Replicas:\t${pods.length} current / ${s.replicas ?? 0} desired`, `Pods Status:\t${running} Running / ${pods.length - running} Waiting / 0 Succeeded / 0 Failed`);
      push('Pod Template:', ...describeLabels('Labels:', s.template.metadata?.labels ?? {}, '  '), '  Containers:', ...s.template.spec.containers.flatMap((x: J) => containerBlock(k, x, undefined, '   ', true)));
      push(...volumesBlock(s.template.spec.volumes ?? [], '  '), `  Node-Selectors:\t<none>`, `  Tolerations:\t<none>`, ...eventLines(k, o!.metadata.uid));
      break;
    }
    case 'Service': {
      const s = o!.body.spec;
      const eps = endpointsOf(k, o!).filter((e) => e.ready);
      push(`Name:\t${it.name}`, `Namespace:\t${it.namespace}`, ...describeLabels('Labels:', o!.metadata.labels), ...describeLabels('Annotations:', o!.metadata.annotations), `Selector:\t${s.selector ? labelsText(s.selector) : '<none>'}`, `Type:\t${s.type}`, `IP Family Policy:\t${s.ipFamilyPolicy}`, `IP Families:\t${(s.ipFamilies ?? []).join(',')}`, `IP:\t${s.clusterIP}`, `IPs:\t${(s.clusterIPs ?? [s.clusterIP]).join(',')}`);
      if (s.type === 'LoadBalancer') push(`LoadBalancer Ingress:\t${k.node.ip} (VIP)`);
      (s.ports ?? []).forEach((p: J, i: number) => {
        push(`Port:\t${p.name || '<unset>'}  ${p.port}/${p.protocol ?? 'TCP'}`, `TargetPort:\t${p.targetPort}/${p.protocol ?? 'TCP'}`);
        if (p.nodePort) push(`NodePort:\t${p.name || '<unset>'}  ${p.nodePort}/${p.protocol ?? 'TCP'}`);
        push(`Endpoints:\t${endpointsOf(k, o!).length ? eps.map((e) => `${e.pod.pod!.ip}:${e.ports[i]?.port}`).join(',') : '<none>'}`);
      });
      push(`Session Affinity:\t${s.sessionAffinity ?? 'None'}`);
      if (s.externalTrafficPolicy) push(`External Traffic Policy:\t${s.externalTrafficPolicy}`);
      push(`Internal Traffic Policy:\t${s.internalTrafficPolicy ?? 'Cluster'}`, ...eventLines(k, o!.metadata.uid));
      break;
    }
    case 'Endpoints': {
      const v = endpointsObject(k, it.svc!);
      push(`Name:\t${it.name}`, `Namespace:\t${it.namespace}`, ...describeLabels('Labels:', it.labels), 'Annotations:\t<none>', 'Subsets:');
      for (const sub of v.subsets ?? []) {
        push(`  Addresses:\t${(sub.addresses ?? []).map((a: J) => a.ip).join(',') || '<none>'}`, `  NotReadyAddresses:\t${(sub.notReadyAddresses ?? []).map((a: J) => a.ip).join(',') || '<none>'}`, '  Ports:', '    Name\tPort\tProtocol', '    ----\t----\t--------', ...sub.ports.map((p: J) => `    ${p.name ?? '<unset>'}\t${p.port}\t${p.protocol}`), '');
      }
      push('Events:\t<none>');
      break;
    }
    case 'EndpointSlice': {
      const eps = endpointsOf(k, it.svc!);
      push(`Name:\t${it.name}`, `Namespace:\t${it.namespace}`, ...describeLabels('Labels:', it.labels), 'Annotations:\t<none>', 'AddressType:\tIPv4', 'Ports:', '  Name\tPort\tProtocol', '  ----\t----\t--------');
      const ports = (it.svc!.body.spec.ports ?? []).map((p: J, i: number) => `  ${p.name || '<unset>'}\t${eps[0]?.ports[i]?.port ?? '<unset>'}\t${p.protocol ?? 'TCP'}`);
      push(...ports, 'Endpoints:');
      for (const e of eps) push(`  - Addresses:\t${e.pod.pod!.ip}`, '    Conditions:', `      Ready:\t${e.ready}`, `    Hostname:\t<unset>`, `    TargetRef:\tPod/${e.pod.metadata.name}`, `    NodeName:\t${k.node.name}`, '    Zone:\t<unset>');
      push('Events:\t<none>');
      break;
    }
    case 'Ingress': {
      const s = o!.body.spec ?? {};
      const rs = routes(k).filter((r) => r.ingress === o);
      push(`Name:\t${it.name}`, ...describeLabels('Labels:', o!.metadata.labels), `Namespace:\t${it.namespace}`, `Address:\t${k.node.ip}`, `Ingress Class:\t${s.ingressClassName ?? '<none>'}`, `Default backend:\t${s.defaultBackend ? `${s.defaultBackend.service?.name}:${s.defaultBackend.service?.port?.number ?? s.defaultBackend.service?.port?.name}` : '<default>'}`);
      if (s.tls?.length) push('TLS:', ...s.tls.map((x: J) => `  ${x.secretName} terminates ${(x.hosts ?? []).join(',')}`));
      push('Rules:', '  Host\tPath\tBackends', '  ----\t----\t--------');
      for (const rule of s.rules ?? []) {
        push(`  ${rule.host || '*'}\t`);
        for (const p of rule.http?.paths ?? []) {
          const svc = find(k, 'Service', it.namespace, p.backend?.service?.name ?? '');
          const port = p.backend?.service?.port?.number ?? p.backend?.service?.port?.name;
          const r = rs.find((x) => x.path === (p.path ?? '/') && x.service === p.backend?.service?.name);
          let target: string;
          if (!svc) target = `<error: services "${p.backend?.service?.name}" not found>`;
          else {
            const idx = (svc.body.spec.ports ?? []).findIndex((x: J) => x.port === port || x.name === port);
            target = idx < 0 ? '' : endpointsOf(k, svc).filter((e) => e.ready).map((e) => `${e.pod.pod!.ip}:${e.ports[idx]?.port}`).join(',');
          }
          void r;
          push(`    \t${p.path ?? '/'} \t${p.backend?.service?.name}:${port} (${target})`);
        }
      }
      push(...describeLabels('Annotations:', o!.metadata.annotations), ...eventLines(k, o!.metadata.uid));
      break;
    }
    case 'ConfigMap': {
      push(`Name:\t${it.name}`, `Namespace:\t${it.namespace}`, ...describeLabels('Labels:', o!.metadata.labels), ...describeLabels('Annotations:', o!.metadata.annotations), '', 'Data', '====');
      for (const key of Object.keys(o!.body.data ?? {}).sort()) push(`${key}:`, '----', String(o!.body.data[key]).replace(/\n$/, ''), '');
      push('', 'BinaryData', '====', '', 'Events:\t<none>');
      break;
    }
    case 'Secret': {
      push(`Name:\t${it.name}`, `Namespace:\t${it.namespace}`, ...describeLabels('Labels:', o!.metadata.labels), ...describeLabels('Annotations:', o!.metadata.annotations), '', `Type:\t${o!.body.type ?? 'Opaque'}`, '', 'Data', '====');
      for (const key of Object.keys(o!.body.data ?? {}).sort()) push(`${key}:\t${new TextEncoder().encode(base64Decode(o!.body.data[key]) ?? '').length} bytes`);
      break;
    }
    case 'Namespace': {
      push(`Name:\t${it.name}`, ...describeLabels('Labels:', o!.metadata.labels), 'Annotations:\t<none>', 'Status:\tActive', '', 'No resource quota.', '', 'No LimitRange resource.');
      break;
    }
    case 'Node': {
      const pods = k.objects.filter((p) => p.kind === 'Pod' && p.pod?.scheduled && !p.pod.fixed);
      const sum = (f: (c: J) => J, r: string) => pods.reduce((s, p) => s + p.body.spec.containers.reduce((x: number, c: J) => x + (r === 'cpu' ? millicores(f(c)?.cpu ?? 0) : (quantity(f(c)?.memory ?? 0) ?? 0)), 0), 0);
      const req = { cpu: sum((c) => c.resources?.requests, 'cpu'), memory: sum((c) => c.resources?.requests, 'memory') };
      const lim = { cpu: sum((c) => c.resources?.limits, 'cpu'), memory: sum((c) => c.resources?.limits, 'memory') };
      const pct = (x: number, total: number) => `${Math.floor((x / total) * 100)}%`;
      const mem = (b: number) => (b ? `${Math.round(b / 1024 ** 2)}Mi` : '0');
      const cpu = (m: number) => (m ? `${m}m` : '0');
      const kib = `${Math.round(k.node.memory / 1024)}Ki`;
      push(`Name:\t${it.name}`, 'Roles:\tcontrol-plane,master', ...describeLabels('Labels:', o!.metadata.labels), `CreationTimestamp:\t${rfc1123z(it.created)}`, 'Taints:\t<none>', 'Unschedulable:\tfalse');
      push('Conditions:', '  Type\tStatus\tReason\tMessage', '  ----\t------\t------\t-------', '  MemoryPressure\tFalse\tKubeletHasSufficientMemory\tkubelet has sufficient memory available', '  DiskPressure\tFalse\tKubeletHasNoDiskPressure\tkubelet has no disk pressure', '  PIDPressure\tFalse\tKubeletHasSufficientPID\tkubelet has sufficient PID available', '  Ready\tTrue\tKubeletReady\tkubelet is posting ready status');
      push('Addresses:', `  InternalIP:\t${k.node.ip}`, `  Hostname:\t${k.node.name}`, 'Capacity:', `  cpu:\t${k.node.cpu / 1000}`, `  memory:\t${kib}`, '  pods:\t110', 'Allocatable:', `  cpu:\t${k.node.cpu / 1000}`, `  memory:\t${kib}`, '  pods:\t110');
      push('System Info:', `  Kernel Version:\t${k.node.kernel}`, `  OS Image:\t${k.node.os}`, '  Operating System:\tlinux', '  Architecture:\tamd64', '  Container Runtime Version:\tcontainerd://1.7.23-k3s2', `  Kubelet Version:\t${K3S_VERSION}`, 'PodCIDR:\t10.42.0.0/24', `ProviderID:\tk3s://${k.node.name}`);
      push(`Non-terminated Pods:\t(${pods.length} in total)`, '  Namespace\tName\tCPU Requests\tCPU Limits\tMemory Requests\tMemory Limits\tAge', '  ---------\t----\t------------\t----------\t---------------\t-------------\t---');
      for (const p of pods) {
        const r = podRequests(p);
        const l = { cpu: p.body.spec.containers.reduce((x: number, c: J) => x + millicores(c.resources?.limits?.cpu ?? 0), 0), memory: p.body.spec.containers.reduce((x: number, c: J) => x + (quantity(c.resources?.limits?.memory ?? 0) ?? 0), 0) };
        push(`  ${ns(p)}\t${p.metadata.name}\t${cpu(r.cpu)} (${pct(r.cpu, k.node.cpu)})\t${cpu(l.cpu)} (${pct(l.cpu, k.node.cpu)})\t${mem(r.memory)} (${pct(r.memory, k.node.memory)})\t${mem(l.memory)} (${pct(l.memory, k.node.memory)})\t${age(k.now - p.metadata.created)}`);
      }
      push('Allocated resources:', '  (Total limits may be over 100 percent, i.e., overcommitted.)', '  Resource\tRequests\tLimits', '  --------\t--------\t------', `  cpu\t${cpu(req.cpu)} (${pct(req.cpu, k.node.cpu)})\t${cpu(lim.cpu)} (${pct(lim.cpu, k.node.cpu)})`, `  memory\t${mem(req.memory)} (${pct(req.memory, k.node.memory)})\t${mem(lim.memory)} (${pct(lim.memory, k.node.memory)})`, '  ephemeral-storage\t0 (0%)\t0 (0%)', 'Events:\t<none>');
      break;
    }
    default:
      push(`Name:\t${it.name}`, ...(it.namespace ? [`Namespace:\t${it.namespace}`] : []), ...describeLabels('Labels:', it.labels), 'Events:\t<none>');
  }
  return tabwrite(lines.join('\n'), 0, 2);
}

// ——— What a command acts on: TYPE NAME…, TYPE/NAME, -l, --all ———

interface Target {
  kind: Kind;
  names: string[];
}

function targets(pos: string[]): Target[] | { error: string } {
  if (!pos.length) return { error: '' };
  if (pos[0].includes('/')) {
    const out: Target[] = [];
    for (const p of pos) {
      const [type, name] = p.split('/');
      if (!name) return { error: `error: arguments in resource/name form must have a single resource and name` };
      const kind = kindFor(type);
      if (!kind) return { error: `error: the server doesn't have a resource type "${type}"` };
      const t = out.find((x) => x.kind === kind);
      if (t) t.names.push(name);
      else out.push({ kind, names: [name] });
    }
    return out;
  }
  const types = pos[0].split(',');
  const out: Target[] = [];
  for (const type of types) {
    if (type === 'all') {
      for (const kd of ['Pod', 'Service', 'Deployment', 'ReplicaSet']) out.push({ kind: kindOf(kd), names: pos.slice(1) });
      continue;
    }
    const kind = kindFor(type);
    if (!kind) return { error: `error: the server doesn't have a resource type "${type}"` };
    out.push({ kind, names: pos.slice(1) });
  }
  return out;
}
const plural = (k: Kind) => (k.group ? `${k.plural}.${k.group}` : k.plural);
const notFound = (kind: Kind, name: string) => `Error from server (NotFound): ${plural(kind)} "${name}" not found`;

// ——— The command ———

interface Ctx {
  game: Shell;
  k: K8s;
  a: Args;
  namespace: string;
  config: Config;
  last: boolean;
  input: string | null;
}

function out(ctx: Ctx, errors: string[], text: string, code = 1): string {
  for (const e of errors) ctx.game.error(e, code);
  return text;
}

function get(ctx: Ctx): string {
  const { k, a, game } = ctx;
  const all = has(a, 'all-namespaces');
  const namespace = all ? null : ctx.namespace;
  const t = targets(a.pos);
  if ('error' in t)
    return game.error(
      t.error ||
        "You must specify the type of resource to get. Use \"kubectl api-resources\" for a complete list of supported resources.\n\nerror: Required resource not specified.\nUse \"kubectl explain <resource>\" for a detailed description of that resource (e.g. kubectl explain pods).\nSee 'kubectl get -h' for help and examples",
      1,
    );
  const output = flag(a, 'output') ?? '';
  const sel = flag(a, 'selector');
  const test = sel !== undefined ? selector(sel) : () => true;
  if (!test) return game.error(`error: unable to parse requirement: found '${sel}', expected: identifier`, 1);
  const errors: string[] = [];
  const found: { kind: Kind; items: Item[] }[] = [];
  const named = t.some((x) => x.names.length);
  for (const target of t) {
    const pool = items(k, target.kind, target.kind.namespaced ? namespace : null).filter((i) => test(i.labels));
    if (target.names.length) {
      const got: Item[] = [];
      for (const n of target.names) {
        const i = pool.find((x) => x.name === n);
        if (i) got.push(i);
        else errors.push(notFound(target.kind, n));
      }
      found.push({ kind: target.kind, items: got });
    } else found.push({ kind: target.kind, items: pool });
  }
  const total = found.reduce((s, f) => s + f.items.length, 0);
  const watch = has(a, 'watch');
  if (/^(yaml|json)$/.test(output) || output.startsWith('jsonpath')) {
    const objs = found.flatMap((f) => f.items.map((i) => itemJson(k, i)));
    const single = named && objs.length === 1 && t.length === 1 && t[0].names.length === 1;
    const root = single ? objs[0] : { apiVersion: 'v1', items: objs, kind: 'List', metadata: { resourceVersion: '' } };
    if (output === 'yaml') return out(ctx, errors, total || single ? toYaml(root) : toYaml(root));
    if (output === 'json') return out(ctx, errors, toJson(root));
    const tpl = output.replace(/^jsonpath=/, '').replace(/^jsonpath/, '');
    const r = jsonpath(tpl, root);
    if (typeof r !== 'string') return out(ctx, [...errors, r.error], '');
    return out(ctx, errors, r);
  }
  if (output && !['wide', 'name'].includes(output))
    return game.error(`error: unable to match a printer suitable for the output format "${output}", allowed formats are: custom-columns,custom-columns-file,go-template,go-template-file,json,jsonpath,jsonpath-as-json,jsonpath-file,name,template,templatefile,wide,yaml`, 1);
  if (output === 'name') return out(ctx, errors, found.flatMap((f) => f.items.map((i) => `${f.kind.kind.toLowerCase()}${f.kind.group ? `.${f.kind.group}` : ''}/${i.name}`)).join('\n'));
  if (!total) {
    if (!errors.length) game.error(namespace === null || !t.some((x) => x.kind.namespaced) ? 'No resources found' : `No resources found in ${namespace} namespace.`, 0);
    return out(ctx, errors, '');
  }
  const wide = output === 'wide';
  const prefix = found.filter((f) => f.items.length).length > 1 || a.pos[0]?.split(',').includes('all');
  const tables: string[] = [];
  for (const f of found) {
    if (!f.items.length) continue;
    const col = columns(k, f.kind.kind, wide);
    const showNs = all && f.kind.namespaced;
    const head = [...(showNs ? ['NAMESPACE'] : []), ...col.head, ...(has(a, 'show-labels') ? ['LABELS'] : [])];
    const rows = f.items.map((i) => {
      const r = col.row(i);
      if (prefix && f.kind.kind !== 'Event') r[0] = `${f.kind.kind.toLowerCase()}${f.kind.group ? `.${f.kind.group}` : ''}/${r[0]}`;
      return [...(showNs ? [i.namespace] : []), ...r, ...(has(a, 'show-labels') ? [labelsText(i.labels)] : [])];
    });
    tables.push(tableOut(has(a, 'no-headers') ? rows : [head, ...rows]));
  }
  const text = tables.join('\n\n');
  if (watch && ctx.last && found.length === 1) {
    // -w: the table, then a line each time an object changes (time passes while following).
    const kind = found[0].kind;
    const col = columns(k, kind.kind, wide);
    const key = (i: Item) => col.row(i).filter((_, j) => col.head[j] !== 'AGE' && col.head[j] !== 'LAST SEEN').join('\t');
    const seen = new Map(found[0].items.map((i) => [i.name, key(i)]));
    game.follow = {
      read: () => {
        advance(game, k.now + 2000);
        const now = items(k, kind, kind.namespaced ? namespace : null).filter((i) => test(i.labels) && (!t[0].names.length || t[0].names.includes(i.name)));
        const changed: string[][] = [];
        for (const i of now) {
          const v = key(i);
          if (seen.get(i.name) !== v) changed.push([...(all && kind.namespaced ? [i.namespace] : []), ...col.row(i)]);
          seen.set(i.name, v);
        }
        if (!changed.length) return '';
        return tableOut([[...(all && kind.namespaced ? ['NAMESPACE'] : []), ...col.head], ...changed]).split('\n').slice(1).join('\n');
      },
    };
  }
  return out(ctx, errors, text);
}

function itemJson(k: K8s, i: Item): J {
  if (i.kind === 'Endpoints') return endpointsObject(k, i.svc!);
  if (i.kind === 'EndpointSlice') {
    const eps = endpointsOf(k, i.svc!);
    return {
      addressType: 'IPv4',
      apiVersion: 'discovery.k8s.io/v1',
      endpoints: eps.map((e) => ({ addresses: [e.pod.pod!.ip], conditions: { ready: e.ready, serving: e.ready, terminating: false }, nodeName: k.node.name, targetRef: { kind: 'Pod', name: e.pod.metadata.name, namespace: i.namespace, uid: e.pod.metadata.uid } })),
      kind: 'EndpointSlice',
      metadata: { creationTimestamp: iso(i.created), generateName: `${i.svc!.metadata.name}-`, labels: i.labels, name: i.name, namespace: i.namespace },
      ports: (i.svc!.body.spec.ports ?? []).map((p: J, j: number) => ({ name: p.name ?? '', port: eps[0]?.ports[j]?.port ?? null, protocol: p.protocol ?? 'TCP' })),
    };
  }
  if (i.kind === 'Event') {
    const e = i.event!;
    return { apiVersion: 'v1', count: e.count, firstTimestamp: iso(e.first), involvedObject: { kind: e.kind, name: e.name, namespace: e.namespace, uid: e.uid }, kind: 'Event', lastTimestamp: iso(e.last), message: e.message, metadata: { name: e.id, namespace: e.namespace }, reason: e.reason, source: { component: e.source }, type: e.type };
  }
  if (i.kind === 'Node') {
    const v = full(k, i.obj!);
    v.status = { addresses: [{ address: k.node.ip, type: 'InternalIP' }, { address: k.node.name, type: 'Hostname' }], allocatable: { cpu: String(k.node.cpu / 1000), memory: `${Math.round(k.node.memory / 1024)}Ki`, pods: '110' }, capacity: { cpu: String(k.node.cpu / 1000), memory: `${Math.round(k.node.memory / 1024)}Ki`, pods: '110' }, nodeInfo: { kernelVersion: k.node.kernel, kubeletVersion: K3S_VERSION, osImage: k.node.os, containerRuntimeVersion: 'containerd://1.7.23-k3s2' } };
    return v;
  }
  return full(k, i.obj!);
}

function describeCmd(ctx: Ctx): string {
  const { k, a, game } = ctx;
  const all = has(a, 'all-namespaces');
  const t = targets(a.pos);
  if ('error' in t) return game.error(t.error || "You must specify the type of resource to describe. Use \"kubectl api-resources\" for a complete list of supported resources.\nerror: Required resource not specified.\nSee 'kubectl describe -h' for help and examples", 1);
  const sel = flag(a, 'selector');
  const test = sel ? selector(sel) : () => true;
  const errors: string[] = [];
  const blocks: string[] = [];
  for (const target of t) {
    const pool = items(k, target.kind, target.kind.namespaced && !all ? ctx.namespace : null).filter((i) => test?.(i.labels));
    if (target.names.length)
      for (const n of target.names) {
        // describe also takes a name's beginning (kubectl describe pod booking).
        const exact = pool.filter((x) => x.name === n);
        const got = exact.length ? exact : pool.filter((x) => x.name.startsWith(n));
        if (!got.length) errors.push(notFound(target.kind, n));
        blocks.push(...got.map((i) => describe(k, i)));
      }
    else blocks.push(...pool.map((i) => describe(k, i)));
  }
  if (!blocks.length && !errors.length) game.error(`No resources found in ${ctx.namespace} namespace.`, 0);
  return out(ctx, errors, blocks.join('\n\n\n'));
}

/** The pod a command means: POD, pod/POD, deploy/NAME, svc/NAME (the first of its pods). */
function podFor(ctx: Ctx, ref: string): { pod: Obj; note?: string } | { error: string } {
  const { k } = ctx;
  const [type, name] = ref.includes('/') ? ref.split('/') : ['pod', ref];
  const kind = kindFor(type);
  if (!kind) return { error: `error: the server doesn't have a resource type "${type}"` };
  if (kind.kind === 'Pod') {
    const p = find(k, 'Pod', ctx.namespace, name);
    return p ? { pod: p } : { error: `Error from server (NotFound): pods "${name}" not found` };
  }
  const o = find(k, kind.kind, ctx.namespace, name);
  if (!o) return { error: notFound(kind, name) };
  const sel = kind.kind === 'Service' ? o.body.spec.selector : o.body.spec.selector?.matchLabels;
  const pods = list(k, 'Pod', ctx.namespace).filter((p) => sel && Object.entries(sel).every(([x, v]) => p.metadata.labels[x] === v));
  const ranked = [...pods].sort((x, y) => Number(podReady(y)) - Number(podReady(x)) || x.metadata.created - y.metadata.created);
  if (!ranked.length) return { error: kind.kind === 'Service' ? `error: cannot attach to *v1.Service: invalid service '${name}': Service is defined without a selector` : `error: timed out waiting for the condition` };
  return { pod: ranked[0], note: pods.length > 1 ? `Found ${pods.length} pods, using pod/${ranked[0].metadata.name}` : undefined };
}

function containerFor(ctx: Ctx, pod: Obj): { name: string; note?: string } | { error: string } {
  const cs = pod.body.spec.containers.map((c: J) => c.name);
  const asked = flag(ctx.a, 'container');
  if (asked) return cs.includes(asked) ? { name: asked } : { error: `error: container ${asked} is not valid for pod ${pod.metadata.name}` };
  return { name: cs[0], note: cs.length > 1 ? `Defaulted container "${cs[0]}" out of: ${cs.join(', ')}` : undefined };
}

function logs(ctx: Ctx): string {
  const { k, a, game } = ctx;
  const sel = flag(a, 'selector');
  let pods: Obj[];
  const notes: string[] = [];
  if (sel) {
    const test = selector(sel);
    pods = list(k, 'Pod', ctx.namespace).filter((p) => test?.(p.metadata.labels));
    if (!pods.length) return game.error(`No resources found in ${ctx.namespace} namespace.`, 0);
  } else {
    if (!a.pos.length) return game.error("error: expected 'logs [-f] [-p] (POD | TYPE/NAME) [-c CONTAINER]'.\nPOD or TYPE/NAME is a required argument for the logs command\nSee 'kubectl logs -h' for help and examples", 1);
    const r = podFor(ctx, a.pos[0]);
    if ('error' in r) return game.error(r.error, 1);
    if (r.note) notes.push(r.note);
    pods = [r.pod];
    if (a.pos[1] && !flag(a, 'container')) (a.flags.container ??= []).push(a.pos[1]);
  }
  const tail = flag(a, 'tail') !== undefined ? Number(flag(a, 'tail')) : -1;
  const previous = has(a, 'previous');
  const stamps = has(a, 'timestamps');
  const texts: string[] = [];
  let source: (() => import('../k8s').Logged[]) | null = null;
  for (const pod of pods) {
    const c = containerFor(ctx, pod);
    if ('error' in c) return game.error(c.error, 1);
    if (c.note) notes.push(c.note);
    const cr = pod.pod?.containers.find((x) => x.name === c.name);
    const where = `container "${c.name}" in pod "${pod.metadata.name}"`;
    let lines: import('../k8s').Logged[];
    if (previous) {
      if (!cr?.last) return game.error(`Error from server (BadRequest): previous terminated container "${c.name}" in pod "${pod.metadata.name}" not found`, 1);
      lines = cr.last.logs;
    } else if (!cr || (cr.state === 'waiting' && !cr.last)) {
      const reason = cr?.reason || 'ContainerCreating';
      const why = reason === 'ImagePullBackOff' ? 'trying and failing to pull image' : reason === 'ErrImagePull' ? "image can't be pulled" : reason;
      return game.error(`Error from server (BadRequest): ${where} is waiting to start: ${why}`, 1);
    } else lines = cr.state === 'waiting' ? cr.last!.logs : cr.logs;
    if (pods.length === 1 && !previous && cr) source = () => (cr.state === 'waiting' ? (cr.last?.logs ?? []) : cr.logs);
    const shown = tail >= 0 ? lines.slice(Math.max(0, lines.length - tail)) : lines;
    texts.push(...shown.map((l) => (stamps ? `${new Date(l.t).toISOString().replace('Z', '000000Z')} ${l.text}` : l.text)));
  }
  for (const n of notes) game.error(n, 0);
  if (has(a, 'follow') && ctx.last && source) {
    let shownCount = source().length;
    let base = source();
    game.follow = {
      read: () => {
        advance(game, k.now + 2000);
        const now = source!();
        if (now !== base) {
          base = now;
          shownCount = 0;
        }
        const fresh = now.slice(shownCount);
        shownCount = now.length;
        return fresh.map((l) => l.text).join('\n');
      },
    };
  }
  return texts.join('\n');
}

// ——— apply, create, delete ———

function filesFrom(ctx: Ctx): { file: string; text: string }[] | { error: string } {
  const { game, a } = ctx;
  const out: { file: string; text: string }[] = [];
  for (const f of a.flags.filename ?? []) {
    if (f === '-') {
      out.push({ file: 'STDIN', text: ctx.input ?? '' });
      continue;
    }
    if (/^https?:\/\//.test(f)) return { error: `error: unable to read URL "${f}", server reported 0 , status code=0` };
    const n = game.find(f);
    if (!n) return { error: `error: the path "${f}" does not exist` };
    if (n.type === 'directory') {
      const walk = (dir: string, recurse: boolean) => {
        const d = game.find(dir);
        if (d?.type !== 'directory') return;
        for (const name of Object.keys(d.children).sort()) {
          const p = `${dir.replace(/\/$/, '')}/${name}`;
          const c = d.children[name];
          if (c.type === 'directory') {
            if (recurse) walk(p, true);
          } else if (/\.(ya?ml|json)$/.test(name)) {
            const text = game.can(c, 'r') ? game.read(p) : null;
            if (text === null) throw new Error(`error: open ${p}: permission denied`);
            out.push({ file: p, text });
          }
        }
      };
      try {
        walk(f, has(a, 'recursive'));
      } catch (e) {
        return { error: (e as Error).message };
      }
      continue;
    }
    if (!game.can(n, 'r')) return { error: `error: open ${f}: permission denied` };
    out.push({ file: f, text: game.read(f) ?? '' });
  }
  if (!out.length) return { error: 'error: must specify one of -f and -k' };
  return out;
}

function applyCmd(ctx: Ctx, mode: 'apply' | 'create'): string {
  const { k, game, a } = ctx;
  const files = filesFrom(ctx);
  if ('error' in files) return game.error(files.error, 1);
  const dry = flag(a, 'dry-run');
  const output = flag(a, 'output');
  const lines: string[] = [];
  const printed: J[] = [];
  let failed = false;
  let any = false;
  for (const { file, text } of files) {
    const docs = readManifests(text, file);
    if ('error' in docs) {
      game.error(docs.error, 1);
      failed = true;
      continue;
    }
    for (const { doc } of docs) {
      any = true;
      const d = decode(doc, file);
      if ('error' in d) {
        game.error(mode === 'create' ? d.error : d.error, 1);
        failed = true;
        continue;
      }
      const kd = kindOf(d.obj.kind);
      const docNs = d.obj.metadata?.namespace;
      const explicit = flag(a, 'namespace');
      if (kd.namespaced && docNs && explicit && docNs !== explicit) {
        game.error(`error: the namespace from the provided object "${docNs}" does not match the namespace "${explicit}". You must pass '--namespace=${docNs}' to perform this operation.`, 1);
        failed = true;
        continue;
      }
      const namespace = kd.namespaced ? (docNs ?? ctx.namespace) : '';
      if (kd.namespaced && !find(k, 'Namespace', '', namespace)) {
        game.error(`Error from server (NotFound): error when creating "${file}": namespaces "${namespace}" not found`, 1);
        failed = true;
        continue;
      }
      const p = plan(k, d.obj, namespace);
      const res = `${kd.kind.toLowerCase()}${kd.group ? `.${kd.group}` : ''}/${p.name}`;
      if (mode === 'create' && p.live) {
        game.error(`Error from server (AlreadyExists): error when creating "${file}": ${plural(kd)} "${p.name}" already exists`, 1);
        failed = true;
        continue;
      }
      if (p.problems.length) {
        const verb = p.live ? 'patching' : 'creating';
        game.error(p.live ? `Error from server (Invalid): error when applying patch:\n${JSON.stringify({ metadata: { annotations: { 'kubectl.kubernetes.io/last-applied-configuration': p.annotations['kubectl.kubernetes.io/last-applied-configuration'].slice(0, 60) + '…' } } })}\nto:\nResource: "${kd.group || 'core'}/${kd.apiVersion.replace(/^.*\//, '')}, Resource=${kd.plural}", GroupVersionKind: "${kd.group ? `${kd.group}/` : '/'}${kd.apiVersion.replace(/^.*\//, '')}, Kind=${kd.kind}"\nName: "${p.name}", Namespace: "${namespace}"\nfor: "${file}": error when ${verb} "${file}": ${invalidMessage(kd.kind, p.name, p.problems)}` : invalidMessage(kd.kind, p.name, p.problems), 1);
        failed = true;
        continue;
      }
      if (output === 'yaml' || output === 'json') printed.push(full(k, { kind: kd.kind, apiVersion: kd.apiVersion, metadata: { name: p.name, namespace: kd.namespaced ? namespace : undefined, uid: '', labels: p.labels, annotations: p.annotations, created: k.now, generation: 1, rv: 0 }, body: p.body }));
      if (!dry || dry === 'none') {
        const o = carryOut(k, p);
        if (p.action !== 'unchanged') k.journal.push({ t: k.now, what: mode, detail: `${o.kind}/${ns(o)}/${o.metadata.name}` });
        if (p.action === 'created' && o.kind === 'Namespace') o.metadata.labels['kubernetes.io/metadata.name'] = p.name;
      }
      const suffix = dry === 'client' ? ' (dry run)' : dry === 'server' ? ' (server dry run)' : '';
      lines.push(`${res} ${mode === 'create' ? 'created' : p.action}${suffix}`);
    }
  }
  if (!any && !failed) return game.error('error: no objects passed to ' + mode, 1);
  if (failed) game.status = 1;
  if (output === 'yaml') return printed.map((x) => toYaml(x)).join('\n---\n');
  if (output === 'json') return printed.map((x) => toJson(x)).join('\n');
  return lines.join('\n');
}

function deleteCmd(ctx: Ctx): string {
  const { k, game, a } = ctx;
  const done: string[] = [];
  const errors: string[] = [];
  const kill = (o: Obj) => {
    const kd = kindOf(o.kind);
    if (o.kind === 'Pod' && o.metadata.owner?.kind === 'ReplicaSet') k.journal.push({ t: k.now, what: 'delete-pod', detail: `${ns(o)}/${o.metadata.name}` });
    else k.journal.push({ t: k.now, what: 'delete', detail: `${o.kind}/${ns(o)}/${o.metadata.name}` });
    if (o.kind === 'Pod')
      for (const c of o.pod?.containers ?? []) if (c.state === 'running') record(k, o, 'Normal', 'Killing', `Stopping container ${c.name}`);
    if (o.kind === 'Namespace') for (const x of k.objects.filter((y) => y.metadata.namespace === o.metadata.name)) remove(k, x);
    remove(k, o);
    done.push(`${kd.kind.toLowerCase()}${kd.group ? `.${kd.group}` : ''} "${o.metadata.name}" deleted`);
  };
  if (a.flags.filename) {
    const files = filesFrom(ctx);
    if ('error' in files) return game.error(files.error, 1);
    for (const { file, text } of files) {
      const docs = readManifests(text, file);
      if ('error' in docs) return game.error(docs.error, 1);
      for (const { doc } of docs) {
        const kd = KINDS.find((x) => x.kind === doc.kind);
        if (!kd) continue;
        const namespace = doc.metadata?.namespace ?? ctx.namespace;
        const o = find(k, kd.kind, namespace, doc.metadata?.name ?? '');
        if (o) kill(o);
        else if (!has(a, 'ignore-not-found')) errors.push(`Error from server (NotFound): error when deleting "${file}": ${plural(kd)} "${doc.metadata?.name}" not found`);
      }
    }
  } else {
    const t = targets(a.pos);
    if ('error' in t) return game.error(t.error || "error: You must provide one or more resources by argument or filename.\nExample resource specifications include:\n   '-f rsrc.yaml'\n   '--filename=rsrc.json'\n   '<resource> <name>'\n   '<resource>'", 1);
    const sel = flag(a, 'selector');
    const test = sel ? selector(sel) : null;
    for (const target of t) {
      if (target.kind.kind === 'Node' || target.kind.kind === 'Event' || target.kind.kind === 'Endpoints' || target.kind.kind === 'EndpointSlice') {
        if (target.kind.kind !== 'Node') continue;
      }
      if (target.names.length) {
        for (const n of target.names) {
          const o = find(k, target.kind.kind, ctx.namespace, n);
          if (o) kill(o);
          else if (!has(a, 'ignore-not-found')) errors.push(notFound(target.kind, n));
        }
      } else if (test || has(a, 'all')) {
        const pool = list(k, target.kind.kind, target.kind.namespaced ? ctx.namespace : null).filter((o) => !test || test(o.metadata.labels));
        if (!pool.length) game.error('No resources found', 0);
        pool.forEach(kill);
      } else return game.error('error: resource(s) were provided, but no name was specified', 1);
    }
  }
  return out(ctx, errors, done.join('\n'));
}

// ——— edit ———

const EDIT_HEADER = `# Please edit the object below. Lines beginning with a '#' will be ignored,
# and an empty file will abort the edit. If an error occurs while saving this file will be
# reopened with the relevant failures.
#
`;

function editCmd(ctx: Ctx): string {
  const { k, game, a } = ctx;
  const t = targets(a.pos);
  if ('error' in t || t.length !== 1 || t[0].names.length !== 1) return game.error("error: you must provide one or more resources by argument or filename.\nSee 'kubectl edit -h' for help and examples", 1);
  const kind = t[0].kind;
  const o = find(k, kind.kind, ctx.namespace, t[0].names[0]);
  if (!o) return game.error(notFound(kind, t[0].names[0]), 1);
  const original = EDIT_HEADER + toYaml(full(k, o)) + '\n';
  k.seq++;
  const temp = `/tmp/kubectl-edit-${String(1000000000 + ((k.seq * 7919) % 899999999))}.yaml`;
  const before = game.who;
  game.place('kubectl', temp, { type: 'file', content: original, owner: game.who, lines: true, mode: 'rw-------' });
  game.who = before;
  game.edition = {
    path: temp,
    text: original,
    root: game.who === 'root',
    message: game.t('nano-lines-read', { lines: original.split('\n').length - 1 }),
    conclude: true,
    after: () => {
      const text = game.read(temp) ?? '';
      const stripped = text.split('\n').filter((l) => !l.startsWith('#')).join('\n');
      if (!stripped.trim()) return 'Edit cancelled, no changes made.';
      if (stable(stripped.trim()) === stable(original.split('\n').filter((l) => !l.startsWith('#')).join('\n').trim())) {
        game.erase(temp);
        return 'Edit cancelled, no changes made.';
      }
      // What closing the editor prints (kubectl's errors included).
      const fail = (message: string) => {
        game.status = 1;
        return `${message}\nA copy of your changes has been stored to "${temp}"\nerror: Edit cancelled, no valid changes were saved.`;
      };
      const docs = readManifests(stripped, temp);
      if ('error' in docs) return fail(docs.error.replace(/^error: /, 'error: '));
      if (docs.length !== 1) return fail('error: the edited file had a syntax error');
      const d = decode(docs[0].doc, temp);
      if ('error' in d) return fail(d.error.replace(/error when creating "[^"]*": /, ''));
      if (d.obj.metadata?.name !== o.metadata.name) return fail(`error: At least one of apiVersion, kind and name was changed`);
      const body = withDefaults(k, o.kind, ns(o), o.metadata.name, (({ apiVersion, kind: _k, metadata, status, ...rest }) => (void apiVersion, void _k, void metadata, void status, rest))(d.obj), o);
      const problems = validate(o.kind, { metadata: d.obj.metadata, ...body }, o);
      if (o.kind === 'Pod') {
        const strip = (s: J) => {
          const x = clone(s ?? {});
          for (const c of x.containers ?? []) delete c.image;
          for (const f of ['nodeName', 'serviceAccount', 'serviceAccountName', 'tolerations', 'activeDeadlineSeconds', 'terminationGracePeriodSeconds']) delete x[f];
          return stable(x);
        };
        if (strip(o.body.spec) !== strip(body.spec))
          problems.push('spec: Forbidden: pod updates may not change fields other than `spec.containers[*].image`,`spec.initContainers[*].image`,`spec.activeDeadlineSeconds`,`spec.tolerations` (only additions to existing tolerations),`spec.terminationGracePeriodSeconds` (allow it to be set to 1 if it was previously negative)');
        delete body.spec.nodeName;
      }
      if (problems.length) return fail(`error: ${plural(kindOf(o.kind))} "${o.metadata.name}" is invalid\n${invalidMessage(o.kind, o.metadata.name, problems)}`);
      const annotations = { ...(d.obj.metadata?.annotations ?? {}) };
      for (const x of Object.keys(o.metadata.annotations)) if (x.startsWith('deployment.kubernetes.io/')) annotations[x] = o.metadata.annotations[x];
      update(k, o, body, d.obj.metadata?.labels ?? {}, annotations);
      k.journal.push({ t: k.now, what: 'edit', detail: `${o.kind}/${ns(o)}/${o.metadata.name}` });
      game.erase(temp);
      return `${resourceName(o)} edited`;
    },
  };
  return '';
}

// ——— rollout, scale, set image ———

function deploymentArg(ctx: Ctx, pos: string[], verb: string): Obj | { error: string } {
  const ref = pos[0];
  if (!ref) return { error: `error: required resource not specified` };
  let type = 'deployment';
  let name = pos[1];
  if (ref.includes('/')) [type, name] = ref.split('/');
  else type = ref;
  const kind = kindFor(type);
  if (!kind) return { error: `error: the server doesn't have a resource type "${type}"` };
  if (!name) return { error: `error: required resource not specified` };
  if (kind.kind !== 'Deployment' && !(verb === 'scale' && kind.kind === 'ReplicaSet')) return { error: `error: no ${verb} found for ${kind.kind.toLowerCase()} "${name}"` };
  const o = find(ctx.k, kind.kind, ctx.namespace, name);
  return o ?? { error: notFound(kind, name) };
}

function rolloutStatus(ctx: Ctx, d: Obj): string {
  const { k, game, a } = ctx;
  const timeout = flag(a, 'timeout');
  const limit = timeout ? (/^\d+$/.test(timeout) ? Number(timeout) : Number(timeout.replace(/[smh]$/, '')) * ({ s: 1, m: 60, h: 3600 }[timeout.slice(-1)] ?? 1)) * 1000 : Infinity;
  const name = d.metadata.name;
  const start = k.now;
  const lines: string[] = [];
  const status = () => {
    const f = full(k, d);
    const prog = f.status.conditions.find((c: J) => c.type === 'Progressing');
    if (prog?.reason === 'ProgressDeadlineExceeded') return { error: `error: deployment "${name}" exceeded its progress deadline` };
    const c = deploymentCounts(k, d);
    if (c.updated < c.want) return { line: `Waiting for deployment "${name}" rollout to finish: ${c.updated} out of ${c.want} new replicas have been updated...` };
    if (c.replicas > c.updated) return { line: `Waiting for deployment "${name}" rollout to finish: ${c.replicas - c.updated} old replicas are pending termination...` };
    if (c.available < c.updated) return { line: `Waiting for deployment "${name}" rollout to finish: ${c.available} of ${c.updated} updated replicas are available...` };
    return { done: `deployment "${name}" successfully rolled out` };
  };
  // Time passes while it waits, at most a quarter of an hour.
  for (;;) {
    const s = status();
    if ('error' in s) {
      game.error(s.error!, 1);
      return lines.join('\n');
    }
    if ('done' in s) {
      lines.push(s.done!);
      return lines.join('\n');
    }
    if (lines.at(-1) !== s.line) lines.push(s.line!);
    if (k.now - start >= Math.min(limit, 900_000)) {
      game.error('error: timed out waiting for the condition', 1);
      return lines.join('\n');
    }
    advance(game, k.now + 1000);
  }
}

function rollout(ctx: Ctx): string {
  const { k, game, a } = ctx;
  const [verb, ...rest] = a.pos;
  const valid = ['status', 'restart', 'undo', 'history', 'pause', 'resume'];
  if (!verb || !valid.includes(verb)) return game.error(verb ? `error: unknown command "${verb}" for "kubectl rollout"\nRun 'kubectl rollout --help' for usage.` : "Manage the rollout of one or many resources.\n\nValid resource types include:\n\n  *  deployments\n  *  daemonsets\n  *  statefulsets\n\nAvailable Commands:\n  history       View rollout history\n  pause         Mark the provided resource as paused\n  restart       Restart a resource\n  resume        Resume a paused resource\n  status        Show the status of the rollout\n  undo          Undo a previous rollout\n\nUsage:\n  kubectl rollout SUBCOMMAND [options]", 1);
  const d = deploymentArg(ctx, rest, 'rollout');
  if ('error' in d) return game.error(d.error, 1);
  const rss = k.objects.filter((o) => o.kind === 'ReplicaSet' && o.metadata.owner?.uid === d.metadata.uid).sort((x, y) => revisionOf(x) - revisionOf(y));
  switch (verb) {
    case 'status':
      return rolloutStatus(ctx, d);
    case 'restart': {
      const body = clone(d.body);
      body.spec.template.metadata ??= {};
      body.spec.template.metadata.annotations = { ...(body.spec.template.metadata.annotations ?? {}), 'kubectl.kubernetes.io/restartedAt': iso(k.now) };
      update(k, d, body);
      k.journal.push({ t: k.now, what: 'restart', detail: `${ns(d)}/${d.metadata.name}` });
      return `deployment.apps/${d.metadata.name} restarted`;
    }
    case 'history': {
      const rev = flag(a, 'revision');
      if (rev) {
        const rs = rss.find((x) => revisionOf(x) === Number(rev));
        if (!rs) return game.error(`error: unable to find the specified revision`, 1);
        const tpl = rs.body.spec.template;
        return tabwrite([`deployment.apps/${d.metadata.name} with revision #${rev}`, 'Pod Template:', ...describeLabels('Labels:', tpl.metadata?.labels ?? {}, '  '), '  Containers:', ...tpl.spec.containers.flatMap((c: J) => containerBlock(k, c, undefined, '   ', true)), ...volumesBlock(tpl.spec.volumes ?? [], '  '), '  Node-Selectors:\t<none>', '  Tolerations:\t<none>'].join('\n'), 0, 2);
      }
      return `deployment.apps/${d.metadata.name} \n${tabwrite([['REVISION', 'CHANGE-CAUSE'], ...rss.map((rs) => [String(revisionOf(rs)), rs.metadata.annotations['kubernetes.io/change-cause'] ?? '<none>'])].map((r) => r.join('\t')).join('\n'), 0, 2)}\n`;
    }
    case 'undo': {
      const want = flag(a, 'to-revision');
      const current = newReplicaSet(k, d);
      const target = want && want !== '0' ? rss.find((x) => revisionOf(x) === Number(want)) : [...rss].reverse().find((x) => x !== current);
      if (!target) return game.error(want && want !== '0' ? `error: unable to find specified revision ${want} in history` : `error: no rollout history found for deployment "${d.metadata.name}"`, 1);
      if (target === current) return `deployment.apps/${d.metadata.name} skipped rollback (current template already matches revision ${revisionOf(target)})`;
      const tpl = clone(target.body.spec.template);
      delete tpl.metadata.labels['pod-template-hash'];
      const body = clone(d.body);
      body.spec.template = tpl;
      // kubectl's undo also brings back the revision's change-cause (getDeploymentPatch).
      const annotations = { ...d.metadata.annotations };
      const cause = target.metadata.annotations['kubernetes.io/change-cause'];
      if (cause !== undefined) annotations['kubernetes.io/change-cause'] = cause;
      else delete annotations['kubernetes.io/change-cause'];
      update(k, d, body, d.metadata.labels, annotations);
      k.journal.push({ t: k.now, what: 'undo', detail: `${ns(d)}/${d.metadata.name}` });
      return `deployment.apps/${d.metadata.name} rolled back`;
    }
    case 'pause':
    case 'resume': {
      const body = clone(d.body);
      body.spec.paused = verb === 'pause' ? true : undefined;
      if (!body.spec.paused) delete body.spec.paused;
      update(k, d, body);
      return `deployment.apps/${d.metadata.name} ${verb === 'pause' ? 'paused' : 'resumed'}`;
    }
  }
  return '';
}

function scaleCmd(ctx: Ctx): string {
  const { k, game, a } = ctx;
  const n = flag(a, 'replicas');
  if (n === undefined) return game.error('error: required flag(s) "replicas" not set', 1);
  if (!/^\d+$/.test(n)) return game.error(`error: invalid argument "${n}" for "--replicas" flag: strconv.ParseInt: parsing "${n}": invalid syntax\nSee 'kubectl scale --help' for usage.`, 1);
  const d = deploymentArg(ctx, a.pos, 'scale');
  if ('error' in d) return game.error(d.error, 1);
  const body = clone(d.body);
  body.spec.replicas = Number(n);
  update(k, d, body);
  k.journal.push({ t: k.now, what: 'scale', detail: `${ns(d)}/${d.metadata.name}=${n}` });
  return `${resourceName(d)} scaled`;
}

function setCmd(ctx: Ctx): string {
  const { k, game, a } = ctx;
  const [what, ref, ...pairs] = a.pos;
  if (what !== 'image') return game.error(what ? `error: unknown command "${what}" for "kubectl set"\nRun 'kubectl set --help' for usage.` : 'Configure application resources.\n\nAvailable Commands:\n  env              Update environment variables on a pod template\n  image            Update the image of a pod template\n  resources        Update resource requests/limits on objects with pod templates\n\nUsage:\n  kubectl set SUBCOMMAND [options]', 1);
  if (!ref || !pairs.length) return game.error("error: one or more resources must be specified as <resource> <name> or <resource>/<name>\nSee 'kubectl set image -h' for help and examples", 1);
  const [type, name] = ref.includes('/') ? ref.split('/') : [ref, pairs.shift()!];
  const kind = kindFor(type);
  if (!kind) return game.error(`error: the server doesn't have a resource type "${type}"`, 1);
  const o = find(k, kind.kind, ctx.namespace, name);
  if (!o) return game.error(notFound(kind, name), 1);
  const body = clone(o.body);
  const spec = o.kind === 'Pod' ? body.spec : body.spec?.template?.spec;
  if (!spec) return game.error(`error: ${resourceName(o)} does not have a pod template`, 1);
  for (const p of pairs) {
    const [cname, image] = p.split('=');
    if (!image) return game.error(`error: there is no need to specify a resource type as a separate argument when passing arguments in resource/name form (e.g. 'kubectl get resource/<resource_name>' instead of 'kubectl get resource resource/<resource_name>'`, 1);
    const targetsC = cname === '*' ? spec.containers : spec.containers.filter((c: J) => c.name === cname);
    if (!targetsC.length) return game.error(`error: unable to find container named "${cname}"`, 1);
    for (const c of targetsC) c.image = image;
  }
  if (same(body, o.body)) return `${resourceName(o)} image updated`;
  const fixed = withDefaults(k, o.kind, ns(o), o.metadata.name, body, o);
  update(k, o, fixed);
  k.journal.push({ t: k.now, what: 'set-image', detail: `${o.kind}/${ns(o)}/${o.metadata.name}` });
  return `${resourceName(o)} image updated`;
}
const same = (x: J, y: J) => stable(x) === stable(y);

// ——— exec, port-forward ———

function execCmd(ctx: Ctx): string {
  const { k, game, a } = ctx;
  let command = a.after;
  let pos = a.pos;
  if (!command) {
    if (pos.length > 1) {
      game.error('kubectl exec [POD] [COMMAND] is DEPRECATED and will be removed in a future version. Use kubectl exec [POD] -- [COMMAND] instead.', 0);
      command = pos.slice(1);
      pos = pos.slice(0, 1);
    } else return game.error("error: you must specify at least one command for the container\nSee 'kubectl exec -h' for help and examples", 1);
  }
  if (!pos.length) return game.error("error: pod, type/name or --filename must be specified\nSee 'kubectl exec -h' for help and examples", 1);
  const r = podFor(ctx, pos[0]);
  if ('error' in r) return game.error(r.error, 1);
  const c = containerFor(ctx, r.pod);
  if ('error' in c) return game.error(c.error, 1);
  if (c.note) game.error(c.note, 0);
  const cr = r.pod.pod?.containers.find((x) => x.name === c.name);
  if (!cr || cr.state !== 'running') return game.error(`error: unable to upgrade connection: container not found ("${c.name}")`, 1);
  k.journal.push({ t: k.now, what: 'exec', detail: `${ns(r.pod)}/${r.pod.metadata.name}:${command.join(' ')}` });
  const shells = ['sh', '/bin/sh', 'ash', '/bin/ash'];
  if (['bash', '/bin/bash'].includes(command[0]))
    return game.error(`OCI runtime exec failed: exec failed: unable to start container process: exec: "${command[0]}": executable file not found in $PATH: unknown\ncommand terminated with exit code 126`, 126);
  if (shells.includes(command[0]) && command.length === 1) {
    if (!has(a, 'stdin')) return '';
    const pod = r.pod;
    const workdir = (pod.body.spec.containers.find((x: J) => x.name === c.name)?.workingDir as string) ?? '/';
    const prompt = () => `${workdir === '/root' ? '~' : workdir} # `;
    const loop = (): void =>
      game.ask(prompt(), (line) => {
        const words = line.trim().match(/'[^']*'|"[^"]*"|\S+/g)?.map((w) => w.replace(/^['"]|['"]$/g, '')) ?? [];
        if (words[0] === 'exit') return '';
        const live = pod.pod?.containers.find((x) => x.name === c.name);
        if (!live || live.state !== 'running') return 'command terminated with exit code 137';
        const res = containerExec(k, pod, c.name, words.length ? ['sh', '-c', line.trim()] : []);
        loop();
        return [res.out, res.err].filter(Boolean).join('\n');
      });
    if (has(a, 'tty')) loop();
    else return game.error('Unable to use a TTY - input is not a terminal or the right kind of file', 0);
    return '';
  }
  const res = containerExec(k, r.pod, c.name, command);
  if (res.err) game.error(res.err, res.code || 0);
  if (res.code) {
    game.error(`command terminated with exit code ${res.code}`, res.code);
  }
  return res.out;
}

function portForward(ctx: Ctx): string {
  const { k, game, a } = ctx;
  const [ref, ...ports] = a.pos;
  if (!ref || !ports.length) return game.error("error: TYPE/NAME and list of ports are required for port-forward\nSee 'kubectl port-forward -h' for help and examples", 1);
  const r = podFor(ctx, ref);
  if ('error' in r) return game.error(r.error, 1);
  if (phase(r.pod) !== 'Running') return game.error(`error: unable to forward port because pod is not running. Current status=${phase(r.pod)}`, 1);
  const lines: string[] = [];
  const svc = ref.startsWith('svc/') || ref.startsWith('service/') ? find(k, 'Service', ctx.namespace, ref.split('/')[1]) : null;
  for (const p of ports) {
    const [local, remote] = p.includes(':') ? p.split(':') : [p, p];
    let target = Number(remote);
    if (svc) {
      const sp = (svc.body.spec.ports ?? []).find((x: J) => x.port === target || x.name === remote);
      if (sp && typeof sp.targetPort === 'number') target = sp.targetPort;
    }
    const address = flag(a, 'address') ?? 'localhost';
    if (address === 'localhost') lines.push(`Forwarding from 127.0.0.1:${local || target} -> ${target}`, `Forwarding from [::1]:${local || target} -> ${target}`);
    else lines.push(`Forwarding from ${address}:${local || target} -> ${target}`);
  }
  k.journal.push({ t: k.now, what: 'port-forward', detail: `${ns(r.pod)}/${r.pod.metadata.name}:${ports.join(',')}` });
  // It holds the terminal until Ctrl-C, like the real one.
  if (ctx.last) game.follow = { read: () => '' };
  return lines.join('\n');
}

// ——— run, expose, create ———

function runCmd(ctx: Ctx): string {
  const { k, game, a } = ctx;
  const name = a.pos[0];
  const image = flag(a, 'image');
  if (!name) return game.error("error: NAME is required for run\nSee 'kubectl run -h' for help and examples", 1);
  if (!image) return game.error('error: required flag(s) "image" not set', 1);
  if (find(k, 'Pod', ctx.namespace, name)) return game.error(`Error from server (AlreadyExists): pods "${name}" already exists`, 1);
  const env = (a.flags.env ?? []).map((e) => ({ name: e.split('=')[0], value: e.split('=').slice(1).join('=') }));
  const port = flag(a, 'port');
  const container: J = { name, image, ...(env.length ? { env } : {}), ...(port ? { ports: [{ containerPort: Number(port) }] } : {}), ...(a.after?.length ? { args: a.after } : {}) };
  const labels = flag(a, 'labels') ? Object.fromEntries(flag(a, 'labels')!.split(',').map((x) => x.split('='))) : { run: name };
  const body = withDefaults(k, 'Pod', ctx.namespace, name, { spec: { containers: [container], restartPolicy: flag(a, 'restart') ?? 'Always' } });
  const problems = validate('Pod', { metadata: { name }, ...body }, undefined);
  if (problems.length) return game.error(invalidMessage('Pod', name, problems), 1);
  const dry = flag(a, 'dry-run');
  if (dry === 'client' && flag(a, 'output') === 'yaml') return toYaml({ apiVersion: 'v1', kind: 'Pod', metadata: { creationTimestamp: null, labels, name }, spec: { containers: [{ ...container, resources: {} }], dnsPolicy: 'ClusterFirst', restartPolicy: flag(a, 'restart') ?? 'Always' }, status: {} });
  if (!dry) {
    create(k, 'Pod', ctx.namespace, body, { name, labels });
    k.journal.push({ t: k.now, what: 'run', detail: `${ctx.namespace}/${name}` });
  }
  return `pod/${name} created${dry ? ' (dry run)' : ''}`;
}

function exposeCmd(ctx: Ctx): string {
  const { k, game, a } = ctx;
  const t = targets(a.pos);
  if ('error' in t || !t[0]?.names.length) return game.error("error: You must provide one or more resources by argument or filename.\nSee 'kubectl expose -h' for help and examples", 1);
  const o = find(k, t[0].kind.kind, ctx.namespace, t[0].names[0]);
  if (!o) return game.error(notFound(t[0].kind, t[0].names[0]), 1);
  const sel = o.kind === 'Deployment' || o.kind === 'ReplicaSet' ? o.body.spec.selector?.matchLabels : o.kind === 'Service' ? o.body.spec.selector : o.metadata.labels;
  const port = flag(a, 'port') ?? String(o.body.spec?.template?.spec?.containers?.[0]?.ports?.[0]?.containerPort ?? o.body.spec?.containers?.[0]?.ports?.[0]?.containerPort ?? '');
  if (!port) return game.error(`error: couldn't find port via --port flag or introspection\nSee 'kubectl expose -h' for help and examples`, 1);
  const name = flag(a, 'name') ?? o.metadata.name;
  if (find(k, 'Service', ctx.namespace, name)) return game.error(`Error from server (AlreadyExists): services "${name}" already exists`, 1);
  const tp = flag(a, 'target-port');
  const body = withDefaults(k, 'Service', ctx.namespace, name, { spec: { type: flag(a, 'type') ?? 'ClusterIP', selector: sel, ports: [{ port: Number(port), protocol: 'TCP', targetPort: tp ? (/^\d+$/.test(tp) ? Number(tp) : tp) : Number(port) }] } });
  const problems = validate('Service', { metadata: { name }, ...body }, undefined);
  if (problems.length) return game.error(invalidMessage('Service', name, problems), 1);
  create(k, 'Service', ctx.namespace, body, { name, labels: { ...o.metadata.labels } });
  k.journal.push({ t: k.now, what: 'expose', detail: `${ctx.namespace}/${name}` });
  return `service/${name} exposed`;
}

function createCmd(ctx: Ctx): string {
  const { k, game, a } = ctx;
  if (a.flags.filename) return applyCmd(ctx, 'create');
  const [what, ...rest] = a.pos;
  const dry = flag(a, 'dry-run');
  const output = flag(a, 'output');
  const finish = (kind: string, name: string, body: J, labels: Record<string, string> = {}) => {
    const kd = kindOf(kind);
    if (find(k, kind, ctx.namespace, name)) return game.error(`error: failed to create ${kind.toLowerCase()}: ${plural(kd)} "${name}" already exists`, 1);
    const problems = validate(kind, { metadata: { name }, ...body }, undefined);
    if (problems.length) return game.error(invalidMessage(kind, name, problems), 1);
    if (dry && (output === 'yaml' || output === 'json')) {
      const v = { apiVersion: kd.apiVersion, kind, metadata: { creationTimestamp: null, ...(Object.keys(labels).length ? { labels } : {}), name, ...(kd.namespaced && flag(a, 'namespace') ? { namespace: flag(a, 'namespace') } : {}) }, ...body };
      return output === 'yaml' ? toYaml(v) : toJson(v);
    }
    if (!dry) {
      create(k, kind, kd.namespaced ? ctx.namespace : undefined, withDefaults(k, kind, ctx.namespace, name, body), { name, labels: kind === 'Namespace' ? { 'kubernetes.io/metadata.name': name } : labels });
      k.journal.push({ t: k.now, what: 'create', detail: `${kind}/${ctx.namespace}/${name}` });
    }
    return `${kind.toLowerCase()}${kd.group ? `.${kd.group}` : ''}/${name} created${dry ? ' (dry run)' : ''}`;
  };
  const fromData = (): Record<string, string> | { error: string } => {
    const data: Record<string, string> = {};
    for (const l of a.flags['from-literal'] ?? []) {
      const i = l.indexOf('=');
      if (i <= 0) return { error: `error: invalid literal source ${l}, expected key=value` };
      data[l.slice(0, i)] = l.slice(i + 1);
    }
    for (const f of a.flags['from-file'] ?? []) {
      const i = f.indexOf('=');
      const [key, path] = i > 0 ? [f.slice(0, i), f.slice(i + 1)] : [f.split('/').at(-1)!, f];
      const n = game.find(path);
      if (!n) return { error: `error: error reading ${path}: no such file or directory` };
      if (n.type === 'directory') {
        for (const [name, c] of Object.entries(n.children)) if (c.type === 'file') data[name] = game.read(`${path}/${name}`) ?? '';
        continue;
      }
      if (!game.can(n, 'r')) return { error: `error: error reading ${path}: permission denied` };
      data[key] = (game.read(path) ?? '') + '\n';
    }
    for (const f of a.flags['from-env-file'] ?? []) {
      const text = game.read(f);
      if (text === null) return { error: `error: error reading ${f}: no such file or directory` };
      for (const l of text.split('\n')) {
        const m = /^\s*([^#=\s][^=]*)=(.*)$/.exec(l);
        if (m) data[m[1].trim()] = m[2];
      }
    }
    return data;
  };
  switch (what) {
    case 'namespace':
    case 'ns':
      if (!rest[0]) return game.error("error: exactly one NAME is required, got 0\nSee 'kubectl create namespace -h' for help and examples", 1);
      return finish('Namespace', rest[0], {});
    case 'configmap':
    case 'cm': {
      if (!rest[0]) return game.error("error: exactly one NAME is required, got 0\nSee 'kubectl create configmap -h' for help and examples", 1);
      const data = fromData();
      if ('error' in data) return game.error(data.error as string, 1);
      return finish('ConfigMap', rest[0], { data });
    }
    case 'secret': {
      const [type, name] = rest;
      if (type !== 'generic') return game.error(type ? `error: unknown command "${type}" for "kubectl create secret"` : 'Create a secret with specified type.\n\nAvailable Commands:\n  docker-registry   Create a secret for use with a Docker registry\n  generic           Create a secret from a local file, directory, or literal value\n  tls               Create a TLS secret', 1);
      if (!name) return game.error("error: exactly one NAME is required, got 0\nSee 'kubectl create secret generic -h' for help and examples", 1);
      const data = fromData();
      if ('error' in data) return game.error(data.error as string, 1);
      return finish('Secret', name, { data: Object.fromEntries(Object.entries(data).map(([x, v]) => [x, base64Encode(v as string)])), type: flag(a, 'type') ?? 'Opaque' });
    }
    case 'deployment':
    case 'deploy': {
      const name = rest[0];
      const image = flag(a, 'image');
      if (!name) return game.error("error: exactly one NAME is required, got 0\nSee 'kubectl create deployment -h' for help and examples", 1);
      if (!image) return game.error('error: required flag(s) "image" not set', 1);
      const container = { name: image.split('/').at(-1)!.split(':')[0], image, ...(flag(a, 'port') ? { ports: [{ containerPort: Number(flag(a, 'port')) }] } : {}), resources: {} };
      return finish('Deployment', name, { spec: { replicas: Number(flag(a, 'replicas') ?? 1), selector: { matchLabels: { app: name } }, strategy: {}, template: { metadata: { labels: { app: name } }, spec: { containers: [container] } } } }, { app: name });
    }
  }
  return game.error(what ? `error: unknown command "${what}" for "kubectl create"\nRun 'kubectl create --help' for usage.` : "error: must specify one of -f and -k\n\nSee 'kubectl create -h' for help and examples", 1);
}

// ——— top, explain, config, small ones ———

function topCmd(ctx: Ctx): string {
  const { k, game, a } = ctx;
  const [what, name] = a.pos;
  const ms = list(k, 'Pod', 'kube-system').find((p) => p.metadata.name.startsWith('metrics-server'));
  if (!ms || !podReady(ms)) return game.error('error: Metrics API not available', 1);
  if (what === 'node' || what === 'nodes' || what === 'no') {
    const u = nodeUsage(k);
    return tableOut([
      ['NAME', 'CPU(cores)', 'CPU(%)', 'MEMORY(bytes)', 'MEMORY(%)'],
      [k.node.name, `${u.cpu}m`, `${Math.round((u.cpu / k.node.cpu) * 100)}%`, mebibytes(u.memory), `${Math.round((u.memory / k.node.memory) * 100)}%`],
    ]);
  }
  if (what !== 'pod' && what !== 'pods' && what !== 'po') return game.error(what ? `error: unknown command "${what}" for "kubectl top"` : 'Display resource (CPU/memory) usage.\n\nAvailable Commands:\n  node          Display resource (CPU/memory) usage of nodes\n  pod           Display resource (CPU/memory) usage of pods', 1);
  const all = has(a, 'all-namespaces');
  const sel = flag(a, 'selector');
  const test = sel ? selector(sel) : () => true;
  let pods = list(k, 'Pod', all ? null : ctx.namespace).filter((p) => test?.(p.metadata.labels) && p.pod?.containers.some((c) => c.state === 'running'));
  if (name) {
    const p = find(k, 'Pod', ctx.namespace, name);
    if (!p) return game.error(`Error from server (NotFound): pods "${name}" not found`, 1);
    pods = [p];
  }
  const young = pods.find((p) => k.now - Math.min(...p.pod!.containers.map((c) => c.started || Infinity)) < 60_000);
  if (young && name) return game.error(`error: Metrics not available for pod ${ns(young)}/${young.metadata.name}, age: ${age(k.now - young.metadata.created)}`, 1);
  pods = pods.filter((p) => p !== young || !name);
  if (!pods.length) return game.error(all ? 'error: Metrics not available for pods' : `No resources found in ${ctx.namespace} namespace.`, all ? 1 : 0);
  if (has(a, 'containers'))
    return tableOut([[...(all ? ['NAMESPACE'] : []), 'POD', 'NAME', 'CPU(cores)', 'MEMORY(bytes)'], ...pods.flatMap((p) => podUsage(k, p).containers.map((c) => [...(all ? [ns(p)] : []), p.metadata.name, c.name, `${c.cpu}m`, mebibytes(c.memory)]))]);
  return tableOut([[...(all ? ['NAMESPACE'] : []), 'NAME', 'CPU(cores)', 'MEMORY(bytes)'], ...pods.map((p) => {
    const u = podUsage(k, p);
    return [...(all ? [ns(p)] : []), p.metadata.name, `${u.cpu}m`, mebibytes(u.memory)];
  })]);
}

const EXPLAIN: Record<string, { type: string; text: string }> = {
  pod: { type: '', text: 'Pod is a collection of containers that can run on a host. This resource is created by clients and scheduled onto hosts.' },
  deployment: { type: '', text: 'Deployment enables declarative updates for Pods and ReplicaSets.' },
  service: { type: '', text: 'Service is a named abstraction of software service (for example, mysql) consisting of local port (for example 3306) that the proxy listens on, and the selector that determines which pods will answer requests sent through the proxy.' },
  ingress: { type: '', text: 'Ingress is a collection of rules that allow inbound connections to reach the endpoints defined by a backend. An Ingress can be configured to give services externally-reachable urls, load balance traffic, terminate SSL, offer name based virtual hosting etc.' },
  configmap: { type: '', text: 'ConfigMap holds configuration data for pods to consume.' },
  secret: { type: '', text: 'Secret holds secret data of a certain type. The total bytes of the values in the Data field must be less than MaxSecretSize bytes.' },
  replicas: { type: '<integer>', text: 'Number of desired pods. This is a pointer to distinguish between explicit zero and not specified. Defaults to 1.' },
  selector: { type: '<map[string]string>', text: 'Route service traffic to pods with label keys and values matching this selector. If empty or not present, the service is assumed to have an external process managing its endpoints, which Kubernetes will not modify.' },
  readinessProbe: { type: '<Probe>', text: 'Periodic probe of container service readiness. Container will be removed from service endpoints if the probe fails. Cannot be updated.' },
  livenessProbe: { type: '<Probe>', text: 'Periodic probe of container liveness. Container will be restarted if the probe fails. Cannot be updated.' },
  env: { type: '<[]EnvVar>', text: 'List of environment variables to set in the container. Cannot be updated.' },
  envFrom: { type: '<[]EnvFromSource>', text: 'List of sources to populate environment variables in the container. The keys defined within a source must be a C_IDENTIFIER. All invalid keys will be reported as an event when the container is starting. When a key exists in multiple sources, the value associated with the last source will take precedence. Values defined by an Env with a duplicate key will take precedence. Cannot be updated.' },
  image: { type: '<string>', text: 'Container image name. More info: https://kubernetes.io/docs/concepts/containers/images' },
  resources: { type: '<ResourceRequirements>', text: 'Compute Resources required by this container. Cannot be updated. More info: https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/' },
  targetPort: { type: '<IntOrString>', text: "Number or name of the port to access on the pods targeted by the service. Number must be in the range 1 to 65535. Name must be an IANA_SVC_NAME. If this is a string, it will be looked up as a named port in the target Pod's container ports. If this is not specified, the value of the 'port' field is used (an identity map)." },
  port: { type: '<integer> -required-', text: 'The port that will be exposed by this service.' },
  pathType: { type: '<string> -required-', text: 'pathType determines the interpretation of the path matching. PathType can be one of the following values: * Exact: Matches the URL path exactly. * Prefix: Matches based on a URL path prefix split by \'/\'. * ImplementationSpecific: Interpretation of the Path matching is up to the IngressClass.' },
};

function explainCmd(ctx: Ctx): string {
  const { game, a } = ctx;
  const path = (a.pos[0] ?? '').split('.');
  if (!path[0]) return game.error("You must specify the type of resource to explain. Use \"kubectl api-resources\" for a complete list of supported resources.\n\nerror: Required resource not specified.\nSee 'kubectl explain -h' for help and examples", 1);
  const kind = kindFor(path[0]);
  if (!kind) return game.error(`error: the server doesn't have a resource type "${path[0]}"`, 1);
  const head = `GROUP:      ${kind.group}\nKIND:       ${kind.kind}\nVERSION:    ${kind.apiVersion.replace(/^.*\//, '')}\n`.replace(/^GROUP: {6}\n/, '');
  const field = path.at(-1)!;
  if (path.length === 1) return `${head}\nDESCRIPTION:\n    ${EXPLAIN[kind.kind.toLowerCase()]?.text ?? kind.kind}\n    \nFIELDS:\n  apiVersion\t<string>\n  kind\t<string>\n  metadata\t<ObjectMeta>\n  ${kind.kind === 'ConfigMap' || kind.kind === 'Secret' ? 'data\t<map[string]string>' : 'spec\t<Object>'}\n  status\t<Object>`;
  const e = EXPLAIN[field];
  if (!e) return game.error(`error: field "${field}" does not exist`, 1);
  return `${head}\nFIELD: ${field} ${e.type}\n\nDESCRIPTION:\n    ${e.text}`;
}

function configCmd(ctx: Ctx): string {
  const { game, a, config } = ctx;
  const [verb, arg] = a.pos;
  switch (verb) {
    case 'current-context':
      return config.context;
    case 'get-contexts':
      return tableOut([['CURRENT', 'NAME', 'CLUSTER', 'AUTHINFO', 'NAMESPACE'], ['*', config.context, 'default', 'default', config.namespace === 'default' && !/namespace:/.test(config.text) ? '' : config.namespace]]);
    case 'view': {
      const ctxNs = /namespace:/.test(config.text) ? `\n    namespace: ${config.namespace}` : '';
      return `apiVersion: v1\nclusters:\n- cluster:\n    certificate-authority-data: DATA+OMITTED\n    server: https://127.0.0.1:6443\n  name: default\ncontexts:\n- context:\n    cluster: default${ctxNs}\n    user: default\n  name: ${config.context}\ncurrent-context: ${config.context}\nkind: Config\npreferences: {}\nusers:\n- name: default\n  user:\n    client-certificate-data: DATA+OMITTED\n    client-key-data: DATA+OMITTED`;
    }
    case 'use-context':
      if (arg !== config.context) return game.error(`error: no context exists with the name: "${arg ?? ''}"`, 1);
      return `Switched to context "${arg}".`;
    case 'set-context': {
      const n = flag(a, 'namespace');
      if (!has(a, 'current') && arg !== config.context) return game.error(arg ? `error: no context exists with the name: "${arg}"` : 'error: you must specify a non-empty context name or --current', 1);
      if (n === undefined) return `Context "${config.context}" modified.`;
      const node = game.find(config.path);
      if (!node || node.type !== 'file' || !game.can(node, 'w')) return game.error(`error: open ${config.path}: permission denied`, 1);
      const lines = config.text.split('\n');
      const i = lines.findIndex((l) => /^\s+cluster:\s/.test(l) && lines.slice(0, lines.indexOf(l)).some((x) => /^- context:|^contexts:/.test(x)));
      const filtered = lines.filter((l) => !/^\s{4}namespace:/.test(l));
      const at = filtered.findIndex((l, j) => j > 0 && /^\s{4}cluster:\s/.test(l) && /context:/.test(filtered[j - 1]));
      void i;
      if (at >= 0 && n) filtered.splice(at + 1, 0, `    namespace: ${n}`);
      node.content = filtered.join('\n');
      return `Context "${config.context}" modified.`;
    }
  }
  return game.error(verb ? `error: unknown command "${verb}" for "kubectl config"` : 'Modify kubeconfig files using subcommands like "kubectl config set current-context my-context".\n\nAvailable Commands:\n  current-context   Display the current-context\n  get-contexts      Describe one or many contexts\n  set-context       Set a context entry in kubeconfig\n  use-context       Set the current-context in a kubeconfig file\n  view              Display merged kubeconfig settings or a specified kubeconfig file', 1);
}

function versionText(client: boolean) {
  return `Client Version: ${K3S_VERSION}\nKustomize Version: v5.4.2${client ? '' : `\nServer Version: ${K3S_VERSION}`}`;
}

// ——— Entry point ———

const SUBCOMMANDS = ['get', 'describe', 'logs', 'apply', 'create', 'delete', 'edit', 'rollout', 'scale', 'set', 'exec', 'port-forward', 'run', 'expose', 'top', 'explain', 'cluster-info', 'version', 'config', 'api-resources'];

export function kubectl(game: Shell, args: string[], input: string | null, last: boolean): string {
  const [sub, ...rest] = args;
  if (!sub) return game.t('kubectl-usage');
  if (!SUBCOMMANDS.includes(sub)) return game.error(`error: unknown command "${sub}" for "kubectl"${sub === 'proxy' || sub === 'cp' || sub === 'patch' || sub === 'label' ? `\n(${game.t('kubectl-not-simulated', { command: sub })})` : ''}\nRun 'kubectl --help' for usage.`, 1);
  const a = parse(rest, sub);
  if (a.error) return game.error(a.error, 1);
  if (sub === 'version' && has(a, 'client')) return versionText(true);
  const config = kubeconfig(game, a);
  if ('error' in config) return game.error(config.error, 1);
  const k = k8s(game);
  if (!k) return game.error(REFUSED, 1);
  if (sub === 'config') return configCmd({ game, k, a, namespace: config.namespace, config, last, input });
  if (!clusterUp(game)) {
    if (sub === 'version') {
      game.error(REFUSED, 1);
      return versionText(true);
    }
    return game.error(REFUSED, 1);
  }
  const namespace = flag(a, 'namespace') ?? config.namespace;
  const ctx: Ctx = { game, k, a, namespace, config, last, input };
  switch (sub) {
    case 'get':
      return get(ctx);
    case 'describe':
      return describeCmd(ctx);
    case 'logs':
      return logs(ctx);
    case 'apply':
      return applyCmd(ctx, 'apply');
    case 'create':
      return createCmd(ctx);
    case 'delete':
      return deleteCmd(ctx);
    case 'edit':
      return editCmd(ctx);
    case 'rollout':
      return rollout(ctx);
    case 'scale':
      return scaleCmd(ctx);
    case 'set':
      return setCmd(ctx);
    case 'exec':
      return execCmd(ctx);
    case 'port-forward':
      return portForward(ctx);
    case 'run':
      return runCmd(ctx);
    case 'expose':
      return exposeCmd(ctx);
    case 'top':
      return topCmd(ctx);
    case 'explain':
      return explainCmd(ctx);
    case 'version':
      return versionText(false);
    case 'cluster-info':
      return 'Kubernetes control plane is running at https://127.0.0.1:6443\nCoreDNS is running at https://127.0.0.1:6443/api/v1/namespaces/kube-system/services/kube-dns:dns/proxy\nMetrics-server is running at https://127.0.0.1:6443/api/v1/namespaces/kube-system/services/https:metrics-server:https/proxy\n\nTo further debug and diagnose cluster problems, use \'kubectl cluster-info dump\'.';
    case 'api-resources':
      return tableOut([['NAME', 'SHORTNAMES', 'APIVERSION', 'NAMESPACED', 'KIND'], ...[...KINDS].sort((x, y) => (x.plural < y.plural ? -1 : 1)).map((x) => [x.plural, x.names.filter((n) => n !== x.kind.toLowerCase()).join(','), x.apiVersion, String(x.namespaced), x.kind])]);
  }
  return '';
}

export const KUBECTL: Record<string, Command> = {
  kubectl: {
    ownOptions: true,
    launch: ({ args, game, input, last }) => kubectl(game, args, input, last),
  },
};

export { routes, podStatusText };
