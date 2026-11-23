// A single-node k3s cluster: the API's objects (namespaces, Deployments,
// ReplicaSets, Pods, Services, Endpoints and EndpointSlices, Ingresses,
// ConfigMaps, Secrets, the node, events), their controllers and the
// kubelet, run second by second on the machine's clock.
//
//   state.k8s = { now, node, objects, events, images, registry, apps, … }
//
// What it follows (https://kubernetes.io/docs/concepts/):
// - workloads/controllers/deployment/: a Deployment owns ReplicaSets named
//   after the pod template's hash (pod-template-hash), a rolling update
//   scales the new one up and the old ones down within maxSurge and
//   maxUnavailable (25 % each by default), revisions, progressDeadlineSeconds;
// - workloads/pods/pod-lifecycle/: phases, container states and their
//   reasons (ContainerCreating, ErrImagePull, ImagePullBackOff,
//   CreateContainerConfigError, CrashLoopBackOff, OOMKilled), restarts
//   with an exponential back-off (10 s doubled up to 5 minutes, reset after
//   10 minutes of running), probes (httpGet, tcpSocket, exec;
//   initialDelaySeconds, periodSeconds, failureThreshold, successThreshold);
// - services-networking/service/ and /ingress/: a Service selects ready
//   pods (Endpoints, EndpointSlices), ClusterIP, NodePort; k3s's Traefik
//   routes an Ingress's hosts and paths to a Service's port;
// - configuration/configmap/ and /secret/: env, envFrom and volumes, read
//   when the container starts;
// - configuration/manage-resources-containers/: requests for the
//   scheduler (Insufficient memory), limits (OOMKilled, exit code 137);
// - k3s: https://docs.k3s.io/ (Traefik, ServiceLB, CoreDNS,
//   local-path-provisioner, metrics-server in kube-system; 10.42.0.0/16 for
//   pods, 10.43.0.0/16 for services).
// The images' applications are declared by the story (state.k8s.apps,
// like docker.ts's APPS): they read their environment and files, answer
// HTTP, use memory. Simplified: one node, no DaemonSet nor Job objects
// (their pods are shown), pods deleted at once, lists replaced wholesale
// by kubectl apply (no strategic merge by key), no admission webhooks.

import { readYaml, YamlError } from './ansible';
import { identifier } from './docker';
import { systemd } from './systemd';
import type { Game } from './shell';

export const K3S_VERSION = 'v1.31.6+k3s1';
export const TRAEFIK_VERSION = '2.11.18';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type J = any;

// ——— The model ———

export interface Meta {
  name: string;
  namespace?: string;
  uid: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  created: number;
  generation: number;
  rv: number;
  owner?: { kind: string; name: string; uid: string; apiVersion: string };
  generateName?: string;
}

export interface Obj {
  kind: string;
  apiVersion: string;
  metadata: Meta;
  // Everything but metadata and status (spec, data, type…), as JSON.
  body: J;
  pod?: PodRun;
  deploy?: { progressAt: number; reason: string; lastReplicas: number; lastAvailable: number; created: number };
}

export interface ProbeState {
  next: number;
  fails: number;
  oks: number;
}

export interface Logged {
  t: number;
  text: string;
}

export interface Terminated {
  reason: string;
  exitCode: number;
  started: number;
  finished: number;
  id: string;
  logs: Logged[];
}

export interface ContainerRun {
  name: string;
  state: 'waiting' | 'running' | 'terminated';
  reason: string;
  message: string;
  started: number;
  terminated?: Terminated;
  last?: Terminated;
  restarts: number;
  ready: boolean;
  step: 'image' | 'config' | 'run' | 'backoff';
  nextAt: number;
  pullBackoff: number;
  backoff: number;
  noticeAt: number;
  ran: boolean;
  logs: Logged[];
  run?: AppRun;
  exit?: { at: number; code: number; logs: string[] };
  readiness: ProbeState;
  liveness: ProbeState;
  id: string;
}

export interface PodRun {
  scheduled: number;
  ip: string;
  started: number;
  containers: ContainerRun[];
  fixed?: 'Succeeded';
  mountError?: string;
  readyAt: number;
}

export interface AppRun {
  namespace: string;
  pod: string;
  container: string;
  env: Record<string, string>;
  files: Record<string, string>;
  started: number;
  ip: string;
  data: Record<string, unknown>;
}

export interface HttpRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  query: Record<string, string>;
}

export interface HttpReply {
  code: number;
  body: string;
  type?: string;
}

/** What an image's application does (declared by the story). */
export interface K8sApp {
  // The ports it listens on.
  ports: number[];
  start(run: AppRun, k: K8s): { logs: string[]; exit?: { after: number; code: number; logs: string[] } };
  http?(run: AppRun, request: HttpRequest, k: K8s): HttpReply;
  // Memory in use (bytes) and CPU (millicores) at a time.
  memory?(run: AppRun, t: number, k: K8s): number;
  cpu?(run: AppRun, t: number, k: K8s): number;
  // Called every second while it runs: new log lines.
  tick?(run: AppRun, t: number, k: K8s): string[] | void;
  // The image's own files (absolute paths), and its working directory.
  files?: Record<string, string>;
  workdir?: string;
  user?: 'root' | string;
}

export interface Tag {
  app: string;
  size: number;
}

export interface Repo {
  tags: Record<string, Tag>;
  // Pulled only with credentials (imagePullSecrets).
  private?: boolean;
}

export interface Ev {
  namespace: string;
  kind: string;
  name: string;
  uid: string;
  type: 'Normal' | 'Warning';
  reason: string;
  message: string;
  source: string;
  first: number;
  last: number;
  count: number;
  id: string;
}

export interface K8sNode {
  name: string;
  ip: string;
  created: number;
  cpu: number; // millicores
  memory: number; // bytes
  kernel: string;
  os: string;
}

export interface K8s {
  now: number;
  node: K8sNode;
  objects: Obj[];
  events: Ev[];
  images: string[];
  registry: Record<string, Repo>;
  apps: Record<string, K8sApp>;
  // Public names that lead to the node (DNS), and names the pods resolve outside the cluster.
  publicNames: Record<string, string>;
  outside: Record<string, string>;
  seq: number;
  rv: number;
  ipNext: number;
  rr: number;
  // What was asked of the cluster (for the chapters): kubectl run, port-forward, deleted pods…
  journal: { t: number; what: string; detail: string }[];
  // What the story keeps for its apps (a database's password, the day's load).
  story?: Record<string, unknown>;
}

export const k8s = (game: Game): K8s | undefined => ((game as unknown as { principal?: Game }).principal ?? game).state.k8s;

// ——— Small helpers ———

const fnv = (s: string) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h;
};
// Kubernetes's rand.SafeEncodeString alphabet (no vowels, no confusable characters).
const ALPHANUMS = 'bcdfghjklmnpqrstvwxz2456789';
/** A pod-template-hash: FNV-32a of the template, written in decimal, each digit encoded like SafeEncodeString. */
export const templateHash = (template: J) => [...String(fnv(stable(template)))].map((c) => ALPHANUMS[c.charCodeAt(0) % ALPHANUMS.length]).join('');
const suffix = (seed: string, n = 5) => {
  let h = fnv(seed);
  let s = '';
  for (let i = 0; i < n; i++) {
    s += ALPHANUMS[h % ALPHANUMS.length];
    h = Math.imul(h ^ (i + 7), 0x01000193) >>> 0;
  }
  return s;
};
export const uidFor = (seed: string) => {
  const h = identifier(seed);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
};

/** JSON with sorted keys (for comparisons and hashes). */
export function stable(v: J): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`;
  return JSON.stringify(v);
}
export const clone = <T>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
export const same = (a: J, b: J) => stable(a) === stable(b);

export const iso = (t: number) => new Date(t).toISOString().replace(/\.\d{3}Z$/, 'Z');
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** Go's RFC1123Z, as kubectl describe writes times. */
export const rfc1123z = (t: number) => {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${DAYS[d.getUTCDay()]}, ${p(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} +0000`;
};

/** k8s.io/apimachinery's duration.HumanDuration (the AGE column). */
export function age(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < -1) return '<invalid>';
  if (seconds < 0) return '0s';
  if (seconds < 120) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 10) return seconds % 60 === 0 ? `${minutes}m` : `${minutes}m${seconds % 60}s`;
  if (minutes < 180) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 8) return minutes % 60 === 0 ? `${hours}h` : `${hours}h${minutes % 60}m`;
  if (hours < 48) return `${hours}h`;
  if (hours < 24 * 8) return hours % 24 === 0 ? `${Math.floor(hours / 24)}d` : `${Math.floor(hours / 24)}d${hours % 24}h`;
  if (hours < 24 * 365 * 2) return `${Math.floor(hours / 24)}d`;
  const dy = Math.floor(hours / 24) % 365;
  if (hours < 24 * 365 * 8) return dy === 0 ? `${Math.floor(hours / 24 / 365)}y` : `${Math.floor(hours / 24 / 365)}y${dy}d`;
  return `${Math.floor(hours / 24 / 365)}y`;
}

/** Go's text/tabwriter (kubectl get: minwidth 6, padding 3; describe: 0 and 2). */
export function tabwrite(text: string, minwidth: number, padding: number): string {
  const lines = text.split('\n').map((l) => l.split('\t'));
  const out: string[] = lines.map(() => '');
  const widths: number[] = [];
  const width = (s: string) => [...s].length;
  const write = (l0: number, l1: number) => {
    for (let i = l0; i < l1; i++) {
      const cells = lines[i];
      out[i] = cells.map((c, j) => (j < cells.length - 1 && j < widths.length ? c + ' '.repeat(Math.max(0, widths[j] - width(c))) : j < cells.length - 1 ? c : c)).join('');
    }
  };
  const format = (l0: number, l1: number) => {
    const column = widths.length;
    for (let i = l0; i < l1; i++) {
      if (column >= lines[i].length - 1) continue;
      write(l0, i);
      l0 = i;
      let w = minwidth;
      for (; i < l1; i++) {
        if (column >= lines[i].length - 1) break;
        w = Math.max(w, width(lines[i][column]) + padding);
      }
      widths.push(w);
      format(l0, i);
      widths.pop();
      l0 = i;
      i--;
    }
    write(l0, l1);
  };
  format(0, lines.length);
  return out.join('\n');
}

import { base64Decode, base64Encode } from './base64';
export { base64Decode, base64Encode };
const b64 = base64Encode;

// ——— Quantities (https://kubernetes.io/docs/reference/kubernetes-api/common-definitions/quantity/) ———

const SUFFIX: Record<string, number> = { '': 1, m: 0.001, k: 1e3, M: 1e6, G: 1e9, T: 1e12, P: 1e15, Ki: 1024, Mi: 1024 ** 2, Gi: 1024 ** 3, Ti: 1024 ** 4, Pi: 1024 ** 5 };
export const QUANTITY_ERROR = "quantities must match the regular expression '^([+-]?[0-9.]+)([eEinumkKMGTP]*[-+]?[0-9]*)$'";
/** A quantity in base units (cores, bytes); null if it doesn't read. */
export function quantity(q: J): number | null {
  if (typeof q === 'number') return q;
  if (typeof q !== 'string') return null;
  const m = /^([+-]?[0-9.]+)(m|k|M|G|T|P|Ki|Mi|Gi|Ti|Pi|[eE][-+]?[0-9]+)?$/.exec(q.trim());
  if (!m || !/^[+-]?(\d+\.?\d*|\.\d+)$/.test(m[1])) return null;
  if (m[2] && /^[eE]/.test(m[2])) return Number(m[1] + m[2]);
  return Number(m[1]) * SUFFIX[m[2] ?? ''];
}
export const millicores = (q: J) => Math.round((quantity(q) ?? 0) * 1000);
/** Bytes written like kubectl top (Mi). */
export const mebibytes = (bytes: number) => `${Math.round(bytes / 1024 ** 2)}Mi`;

// ——— Kinds ———

export interface Kind {
  kind: string;
  apiVersion: string;
  plural: string;
  names: string[];
  namespaced: boolean;
  group: string;
}

export const KINDS: Kind[] = [
  { kind: 'Pod', apiVersion: 'v1', plural: 'pods', names: ['pod', 'po'], namespaced: true, group: '' },
  { kind: 'Service', apiVersion: 'v1', plural: 'services', names: ['service', 'svc'], namespaced: true, group: '' },
  { kind: 'Endpoints', apiVersion: 'v1', plural: 'endpoints', names: ['ep'], namespaced: true, group: '' },
  { kind: 'ConfigMap', apiVersion: 'v1', plural: 'configmaps', names: ['configmap', 'cm'], namespaced: true, group: '' },
  { kind: 'Secret', apiVersion: 'v1', plural: 'secrets', names: ['secret'], namespaced: true, group: '' },
  { kind: 'Namespace', apiVersion: 'v1', plural: 'namespaces', names: ['namespace', 'ns'], namespaced: false, group: '' },
  { kind: 'Node', apiVersion: 'v1', plural: 'nodes', names: ['node', 'no'], namespaced: false, group: '' },
  { kind: 'Event', apiVersion: 'v1', plural: 'events', names: ['event', 'ev'], namespaced: true, group: '' },
  { kind: 'Deployment', apiVersion: 'apps/v1', plural: 'deployments', names: ['deployment', 'deploy'], namespaced: true, group: 'apps' },
  { kind: 'ReplicaSet', apiVersion: 'apps/v1', plural: 'replicasets', names: ['replicaset', 'rs'], namespaced: true, group: 'apps' },
  { kind: 'Ingress', apiVersion: 'networking.k8s.io/v1', plural: 'ingresses', names: ['ingress', 'ing'], namespaced: true, group: 'networking.k8s.io' },
  { kind: 'IngressClass', apiVersion: 'networking.k8s.io/v1', plural: 'ingressclasses', names: ['ingressclass'], namespaced: false, group: 'networking.k8s.io' },
  { kind: 'EndpointSlice', apiVersion: 'discovery.k8s.io/v1', plural: 'endpointslices', names: ['endpointslice'], namespaced: true, group: 'discovery.k8s.io' },
];

/** A resource type as kubectl reads it (pods, po, deploy, deployments.apps…). */
export function kindFor(word: string): Kind | null {
  const w = word.toLowerCase();
  return KINDS.find((k) => k.plural === w || k.names.includes(w) || k.kind.toLowerCase() === w || (k.group && (w === `${k.plural}.${k.group}` || w === `${k.kind.toLowerCase()}.${k.group}`))) ?? null;
}
export const kindOf = (kind: string) => KINDS.find((k) => k.kind === kind)!;
/** deployment.apps/booking, pod/booking-…, service/booking. */
export const resourceName = (o: { kind: string; metadata: { name: string } }) => {
  const k = kindOf(o.kind);
  return `${k.kind.toLowerCase()}${k.group ? `.${k.group}` : ''}/${o.metadata.name}`;
};

// ——— Reading manifests (YAML or JSON), with a schema ———
// The YAML subset of ansible.ts, document by document. Every field is
// checked against the schema of its kind (kubectl's strict decoding: an
// unknown field is refused), and scalars get their type from it.

type Schema = 's' | 'n' | 'b' | 'map' | 'any' | 'intstr' | 'quantity' | Schema[] | { [k: string]: Schema };
const S = 's';
const N = 'n';
const B = 'b';
const M = 'map';
const A = 'any';
const IS = 'intstr';
const META: Schema = { name: S, namespace: S, labels: M, annotations: M, generateName: S, uid: A, resourceVersion: A, creationTimestamp: A, generation: A, managedFields: A, ownerReferences: A, finalizers: A, deletionTimestamp: A, deletionGracePeriodSeconds: A, selfLink: A };
const KEYREF: Schema = { name: S, key: S, optional: B };
const ENV: Schema = { name: S, value: S, valueFrom: { configMapKeyRef: KEYREF, secretKeyRef: KEYREF, fieldRef: { apiVersion: S, fieldPath: S }, resourceFieldRef: { containerName: S, resource: S, divisor: A } } };
const ENVFROM: Schema = { prefix: S, configMapRef: { name: S, optional: B }, secretRef: { name: S, optional: B } };
const PROBE: Schema = {
  httpGet: { path: S, port: IS, host: S, scheme: S, httpHeaders: [{ name: S, value: S }] },
  tcpSocket: { port: IS, host: S },
  exec: { command: [S] },
  grpc: { port: N, service: S },
  initialDelaySeconds: N,
  periodSeconds: N,
  timeoutSeconds: N,
  successThreshold: N,
  failureThreshold: N,
  terminationGracePeriodSeconds: N,
};
const CONTAINER: Schema = {
  name: S,
  image: S,
  imagePullPolicy: S,
  command: [S],
  args: [S],
  workingDir: S,
  ports: [{ name: S, containerPort: N, protocol: S, hostPort: N, hostIP: S }],
  env: [ENV],
  envFrom: [ENVFROM],
  resources: { limits: { cpu: 'quantity', memory: 'quantity', 'ephemeral-storage': 'quantity' }, requests: { cpu: 'quantity', memory: 'quantity', 'ephemeral-storage': 'quantity' }, claims: A },
  volumeMounts: [{ name: S, mountPath: S, readOnly: B, subPath: S, mountPropagation: S, subPathExpr: S, recursiveReadOnly: S }],
  livenessProbe: PROBE,
  readinessProbe: PROBE,
  startupProbe: PROBE,
  lifecycle: A,
  securityContext: A,
  terminationMessagePath: S,
  terminationMessagePolicy: S,
  stdin: B,
  stdinOnce: B,
  tty: B,
  resizePolicy: A,
  restartPolicy: S,
};
const ITEMS: Schema = [{ key: S, path: S, mode: N }];
const VOLUME: Schema = {
  name: S,
  configMap: { name: S, items: ITEMS, defaultMode: N, optional: B },
  secret: { secretName: S, items: ITEMS, defaultMode: N, optional: B },
  emptyDir: { medium: S, sizeLimit: A },
  persistentVolumeClaim: { claimName: S, readOnly: B },
  hostPath: { path: S, type: S },
  projected: A,
  downwardAPI: A,
};
const POD_SPEC: Schema = {
  containers: [CONTAINER],
  initContainers: [CONTAINER],
  volumes: [VOLUME],
  restartPolicy: S,
  terminationGracePeriodSeconds: N,
  dnsPolicy: S,
  nodeSelector: M,
  nodeName: S,
  serviceAccountName: S,
  serviceAccount: S,
  automountServiceAccountToken: B,
  securityContext: A,
  imagePullSecrets: [{ name: S }],
  affinity: A,
  tolerations: A,
  schedulerName: S,
  hostname: S,
  subdomain: S,
  priorityClassName: S,
  priority: N,
  enableServiceLinks: B,
  preemptionPolicy: S,
  activeDeadlineSeconds: N,
  hostNetwork: B,
  topologySpreadConstraints: A,
  dnsConfig: A,
  hostAliases: A,
  runtimeClassName: S,
  overhead: A,
  readinessGates: A,
  setHostnameAsFQDN: B,
  shareProcessNamespace: B,
};
const SELECTOR: Schema = { matchLabels: M, matchExpressions: [{ key: S, operator: S, values: [S] }] };
const TEMPLATE: Schema = { metadata: META, spec: POD_SPEC };
const BACKEND: Schema = { service: { name: S, port: { number: N, name: S } }, resource: A };
const TOP = (rest: Record<string, Schema>): Schema => ({ apiVersion: S, kind: S, metadata: META, status: A, ...rest });
const SCHEMAS: Record<string, Schema> = {
  Deployment: TOP({
    spec: { replicas: N, selector: SELECTOR, template: TEMPLATE, strategy: { type: S, rollingUpdate: { maxSurge: IS, maxUnavailable: IS } }, minReadySeconds: N, revisionHistoryLimit: N, progressDeadlineSeconds: N, paused: B },
  }),
  ReplicaSet: TOP({ spec: { replicas: N, selector: SELECTOR, template: TEMPLATE, minReadySeconds: N } }),
  Pod: TOP({ spec: POD_SPEC }),
  Service: TOP({
    spec: {
      type: S,
      selector: M,
      ports: [{ name: S, port: N, targetPort: IS, protocol: S, nodePort: N, appProtocol: S }],
      clusterIP: S,
      clusterIPs: [S],
      externalIPs: [S],
      sessionAffinity: S,
      sessionAffinityConfig: A,
      externalTrafficPolicy: S,
      internalTrafficPolicy: S,
      ipFamilies: [S],
      ipFamilyPolicy: S,
      loadBalancerIP: S,
      loadBalancerSourceRanges: [S],
      loadBalancerClass: S,
      externalName: S,
      publishNotReadyAddresses: B,
      allocateLoadBalancerNodePorts: B,
      healthCheckNodePort: N,
      trafficDistribution: S,
    },
  }),
  ConfigMap: TOP({ data: M, binaryData: M, immutable: B }),
  Secret: TOP({ data: M, stringData: M, type: S, immutable: B }),
  Namespace: TOP({ spec: A }),
  Ingress: TOP({ spec: { ingressClassName: S, defaultBackend: BACKEND, tls: [{ hosts: [S], secretName: S }], rules: [{ host: S, http: { paths: [{ path: S, pathType: S, backend: BACKEND }] } }] } }),
};

export class ManifestError extends Error {}

const GO_TYPES: Record<string, string> = { s: 'string', n: 'int32', b: 'bool', map: 'map[string]string', intstr: 'intstr.IntOrString', quantity: 'resource.Quantity' };

/** Converts a value read from YAML to the type its schema gives; collects unknown fields. */
function conform(v: J, schema: Schema, path: string, unknown: string[], kind: string): J {
  if (v === null || v === undefined || v === '~' || v === 'null') return null;
  if (v === '') return schema === S || schema === IS || schema === A ? '' : null;
  const type = typeof v === 'string' ? 'string' : Array.isArray(v) ? 'array' : typeof v === 'object' ? 'object' : typeof v;
  const refuse = (want: string) => {
    throw new ManifestError(`json: cannot unmarshal ${type} into Go struct field ${path.replace(/\[\d+\]/g, '')} of type ${want}`);
  };
  if (schema === A) return typeOf(v);
  if (schema === S) {
    if (typeof v !== 'string') refuse('string');
    return v;
  }
  if (schema === N) {
    if (typeof v === 'number') return v;
    if (typeof v !== 'string' || !/^-?\d+$/.test(v)) refuse(GO_TYPES.n);
    return Number(v);
  }
  if (schema === B) {
    if (v === 'true' || v === true) return true;
    if (v === 'false' || v === false) return false;
    refuse('bool');
  }
  if (schema === IS) {
    if (typeof v !== 'string') refuse(GO_TYPES.intstr);
    return /^\d+$/.test(v) ? Number(v) : v;
  }
  if (schema === 'quantity') {
    if (typeof v !== 'string') refuse(GO_TYPES.quantity);
    if (quantity(v) === null) throw new ManifestError(QUANTITY_ERROR);
    return /^\d+$/.test(v) ? Number(v) : v;
  }
  if (schema === M) {
    if (type !== 'object') refuse('map[string]string');
    const out: Record<string, string> = {};
    for (const [k, x] of Object.entries(v)) {
      if (typeof x !== 'string') throw new ManifestError(`json: cannot unmarshal ${Array.isArray(x) ? 'array' : 'object'} into Go struct field ${path}.${k} of type string`);
      out[k] = x;
    }
    return out;
  }
  if (Array.isArray(schema)) {
    if (!Array.isArray(v)) refuse(`[]${typeof schema[0] === 'string' ? GO_TYPES[schema[0] as string] : 'v1.Object'}`);
    return (v as J[]).map((x, i) => conform(x, schema[0], `${path}[${i}]`, unknown, kind));
  }
  if (type !== 'object') refuse('v1.Object');
  const out: J = {};
  for (const [k, x] of Object.entries(v)) {
    const sub = (schema as Record<string, Schema>)[k];
    const p = path ? `${path}.${k}` : k;
    if (sub === undefined) {
      unknown.push(p);
      continue;
    }
    const c = conform(x, sub, p, unknown, kind);
    if (c !== null) out[k] = c;
  }
  return out;
}

// Scalars without a schema: numbers and booleans as YAML 1.1 reads them.
function typeOf(v: J): J {
  if (Array.isArray(v)) return v.map(typeOf);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, typeOf(x)]));
  if (typeof v !== 'string') return v;
  if (/^-?\d+$/.test(v)) return Number(v);
  if (v === 'true' || v === 'false') return v === 'true';
  return v;
}

export interface Parsed {
  doc: J;
  index: number;
}

/** The documents of a manifest file (--- separates them), or the error kubectl prints. */
export function readManifests(text: string, file: string): Parsed[] | { error: string } {
  if (/^\s*[[{]/.test(text)) {
    try {
      const v = JSON.parse(text);
      const docs = v && v.kind === 'List' && Array.isArray(v.items) ? v.items : [v];
      return docs.map((doc: J, index: number) => ({ doc, index }));
    } catch (e) {
      return { error: `error: error parsing ${file}: ${(e as Error).message}` };
    }
  }
  const chunks: { text: string; offset: number }[] = [];
  let current: string[] = [];
  let offset = 0;
  text.split('\n').forEach((l, i) => {
    if (/^---\s*(#.*)?$/.test(l)) {
      chunks.push({ text: current.join('\n'), offset });
      current = [];
      offset = i + 1;
    } else current.push(l);
  });
  chunks.push({ text: current.join('\n'), offset });
  const out: Parsed[] = [];
  for (const c of chunks) {
    if (!c.text.trim() || c.text.split('\n').every((l) => !l.trim() || /^\s*#/.test(l))) continue;
    try {
      const doc = readYaml(c.text);
      if (doc === '') continue;
      if (typeof doc !== 'object' || Array.isArray(doc)) return { error: `error: error validating "${file}": error validating data: invalid object to validate; if you choose to ignore these errors, turn validation off with --validate=false` };
      out.push({ doc, index: out.length });
    } catch (e) {
      if (e instanceof YamlError) return { error: `error: error parsing ${file}: error converting YAML to JSON: yaml: line ${e.line + c.offset}: ${e.message}` };
      throw e;
    }
  }
  return out;
}

/** A document read with its kind's schema: the object, or kubectl's error (strict decoding, types). */
export function decode(doc: J, file: string): { obj: J } | { error: string } {
  const kind = typeof doc.kind === 'string' ? doc.kind : '';
  const apiVersion = typeof doc.apiVersion === 'string' ? doc.apiVersion : '';
  if (!kind) return { error: `error: error validating "${file}": error validating data: kind not set; if you choose to ignore these errors, turn validation off with --validate=false` };
  if (!apiVersion) return { error: `error: error validating "${file}": error validating data: apiVersion not set; if you choose to ignore these errors, turn validation off with --validate=false` };
  const known = KINDS.find((k) => k.kind === kind);
  const name = typeof doc.metadata?.name === 'string' ? doc.metadata.name : '';
  const ns = typeof doc.metadata?.namespace === 'string' ? doc.metadata.namespace : '';
  if (!known || known.apiVersion !== apiVersion || !SCHEMAS[kind])
    return { error: `error: resource mapping not found for name: "${name}" namespace: "${ns}" from "${file}": no matches for kind "${kind}" in version "${apiVersion}"\nensure CRDs are installed first` };
  const unknown: string[] = [];
  let obj: J;
  try {
    obj = conform(doc, SCHEMAS[kind], '', unknown, kind);
  } catch (e) {
    if (e instanceof ManifestError) return { error: `Error from server (BadRequest): error when creating "${file}": ${kind} in version "${apiVersion.replace(/^.*\//, '')}" cannot be handled as a ${kind}: ${e.message}` };
    throw e;
  }
  if (unknown.length)
    return { error: `Error from server (BadRequest): error when creating "${file}": ${kind} in version "${apiVersion.replace(/^.*\//, '')}" cannot be handled as a ${kind}: strict decoding error: ${unknown.map((u) => `unknown field "${u}"`).join(', ')}` };
  return { obj };
}

// ——— YAML and JSON output (kubectl -o yaml: go-yaml, sorted keys, sequences not indented) ———

function yamlScalar(v: J): string {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  const s = String(v);
  if (s === '') return '""';
  // What YAML 1.1 would read as something else (go-yaml quotes it): booleans, null, numbers, timestamps.
  const other = /^(true|false|yes|no|on|off|y|n|null|~)$/i.test(s) || /^[-+]?(\d[\d_]*(\.\d*)?|\.\d+)([eE][-+]?\d+)?$/.test(s) || /^\d{4}-\d\d-\d\d/.test(s) || /^0x[0-9a-f]+$/i.test(s) || /^[-+]?\d+(:[0-5]?\d)+$/.test(s) || /^[-+]?\.(inf|nan)$/i.test(s);
  const indicator = /^[-?:,[\]{}#&*!|>'"%@`\s]/.test(s) && !/^-[^\s-]/.test(s);
  if (other || indicator || /\s$/.test(s) || /: |\s#|:$|[\n\t]/.test(s)) return JSON.stringify(s);
  return s;
}
export function toYaml(v: J, indent = 0): string {
  const pad = ' '.repeat(indent);
  if (Array.isArray(v)) {
    if (!v.length) return `${pad}[]`;
    return v
      .map((x) => {
        if (x && typeof x === 'object' && !Array.isArray(x) && Object.keys(x).length) {
          const inner = toYaml(x, indent + 2);
          return `${pad}- ${inner.slice(indent + 2)}`;
        }
        if (Array.isArray(x) && x.length) return `${pad}-\n${toYaml(x, indent + 2)}`;
        return `${pad}- ${scalarOrEmpty(x)}`;
      })
      .join('\n');
  }
  if (v && typeof v === 'object') {
    const keys = Object.keys(v).sort();
    if (!keys.length) return `${pad}{}`;
    return keys
      .map((k) => {
        const x = v[k];
        const key = yamlScalar(k);
        if (Array.isArray(x)) return x.length ? `${pad}${key}:\n${toYaml(x, indent)}` : `${pad}${key}: []`;
        if (x && typeof x === 'object') return Object.keys(x).length ? `${pad}${key}:\n${toYaml(x, indent + 2)}` : `${pad}${key}: {}`;
        if (typeof x === 'string' && x.includes('\n')) {
          const keep = x.endsWith('\n') ? '' : '-';
          const body = x.replace(/\n$/, '').split('\n').map((l) => (l ? `${pad}  ${l}` : '')).join('\n');
          return `${pad}${key}: |${keep}\n${body}`;
        }
        return `${pad}${key}: ${yamlScalar(x)}`;
      })
      .join('\n');
  }
  return pad + yamlScalar(v);
}
const scalarOrEmpty = (x: J) => (Array.isArray(x) ? '[]' : x && typeof x === 'object' ? '{}' : yamlScalar(x));

/** JSON like kubectl -o json (4 spaces, keys sorted). */
export function toJson(v: J): string {
  const sort = (x: J): J => (Array.isArray(x) ? x.map(sort) : x && typeof x === 'object' ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, sort(x[k])])) : x);
  return JSON.stringify(sort(v), null, 4);
}

// ——— Defaults (what the API server fills in) ———

const percentOr = (v: J, total: number, up: boolean) => {
  if (typeof v === 'number') return v;
  const m = /^(\d+)%$/.exec(String(v ?? ''));
  if (!m) return 0;
  const x = (Number(m[1]) * total) / 100;
  return up ? Math.ceil(x) : Math.floor(x);
};

function defaultProbe(p: J) {
  if (!p) return;
  p.timeoutSeconds ??= 1;
  p.periodSeconds ??= 10;
  p.successThreshold ??= 1;
  p.failureThreshold ??= 3;
  if (p.httpGet) {
    p.httpGet.scheme ??= 'HTTP';
    p.httpGet.path ??= '/';
  }
}

export function defaultPodSpec(spec: J) {
  spec.restartPolicy ??= 'Always';
  spec.dnsPolicy ??= 'ClusterFirst';
  spec.schedulerName ??= 'default-scheduler';
  spec.securityContext ??= {};
  spec.terminationGracePeriodSeconds ??= 30;
  for (const c of spec.containers ?? []) {
    const tag = /:([^/:@]+)$/.exec(c.image ?? '')?.[1];
    c.imagePullPolicy ??= !tag || tag === 'latest' ? 'Always' : 'IfNotPresent';
    c.terminationMessagePath ??= '/dev/termination-log';
    c.terminationMessagePolicy ??= 'File';
    c.resources ??= {};
    // Limits without requests: the requests equal the limits.
    if (c.resources.limits) {
      c.resources.requests ??= {};
      for (const [r, q] of Object.entries(c.resources.limits)) c.resources.requests[r] ??= q;
    }
    for (const p of c.ports ?? []) p.protocol ??= 'TCP';
    defaultProbe(c.readinessProbe);
    defaultProbe(c.livenessProbe);
    defaultProbe(c.startupProbe);
  }
  for (const v of spec.volumes ?? []) {
    if (v.configMap) v.configMap.defaultMode ??= 420;
    if (v.secret) v.secret.defaultMode ??= 420;
  }
}

const clusterIp = (k: K8s, seed: string) => {
  const used = new Set(k.objects.filter((o) => o.kind === 'Service').map((o) => o.body.spec?.clusterIP));
  let h = fnv(seed);
  for (;;) {
    const ip = `10.43.${(h >>> 8) % 256}.${(h % 253) + 2}`;
    if (!used.has(ip) && ip !== '10.43.0.10') return ip;
    h = Math.imul(h ^ 0x9e37, 0x01000193) >>> 0;
  }
};
const nodePortFor = (k: K8s, seed: string) => {
  const used = new Set(k.objects.filter((o) => o.kind === 'Service').flatMap((o) => (o.body.spec?.ports ?? []).map((p: J) => p.nodePort)));
  let h = fnv(seed);
  for (;;) {
    const p = 30000 + (h % 2768);
    if (!used.has(p)) return p;
    h = Math.imul(h ^ 0x51, 0x01000193) >>> 0;
  }
};

/** Fills in what the API server defaults, keeping what the live object already has (clusterIP, nodePort…). */
export function withDefaults(k: K8s, kind: string, ns: string, name: string, body: J, live?: Obj): J {
  const b = clone(body);
  if (kind === 'Deployment') {
    const s = (b.spec ??= {});
    s.replicas ??= 1;
    s.revisionHistoryLimit ??= 10;
    s.progressDeadlineSeconds ??= 600;
    s.strategy ??= {};
    s.strategy.type ??= 'RollingUpdate';
    if (s.strategy.type === 'RollingUpdate') {
      s.strategy.rollingUpdate ??= {};
      s.strategy.rollingUpdate.maxSurge ??= '25%';
      s.strategy.rollingUpdate.maxUnavailable ??= '25%';
    }
    s.template ??= {};
    s.template.metadata ??= {};
    s.template.spec ??= {};
    defaultPodSpec(s.template.spec);
  } else if (kind === 'Pod') {
    defaultPodSpec((b.spec ??= {}));
  } else if (kind === 'Service') {
    const s = (b.spec ??= {});
    s.type ??= 'ClusterIP';
    s.sessionAffinity ??= 'None';
    s.internalTrafficPolicy ??= 'Cluster';
    s.ipFamilies ??= ['IPv4'];
    s.ipFamilyPolicy ??= 'SingleStack';
    s.clusterIP ??= live?.body.spec?.clusterIP ?? clusterIp(k, `${ns}/${name}`);
    s.clusterIPs ??= [s.clusterIP];
    if (s.type === 'NodePort' || s.type === 'LoadBalancer') s.externalTrafficPolicy ??= 'Cluster';
    if (s.type === 'LoadBalancer') s.allocateLoadBalancerNodePorts ??= true;
    for (const [i, p] of (s.ports ?? []).entries()) {
      p.protocol ??= 'TCP';
      p.targetPort ??= p.port;
      if (s.type === 'NodePort' || s.type === 'LoadBalancer') p.nodePort ??= live?.body.spec?.ports?.[i]?.nodePort ?? nodePortFor(k, `${ns}/${name}/${i}`);
      else delete p.nodePort;
    }
  } else if (kind === 'Secret') {
    b.type ??= 'Opaque';
    if (b.stringData) {
      b.data ??= {};
      for (const [key, v] of Object.entries(b.stringData)) b.data[key] = b64(String(v));
      delete b.stringData;
    }
  } else if (kind === 'Namespace') {
    b.spec ??= { finalizers: ['kubernetes'] };
  }
  return b;
}

// ——— Validation (the API server's "is invalid" messages) ———

const goMap = (m: Record<string, string> | undefined) => `map[string]string{${Object.keys(m ?? {}).sort().map((k) => `"${k}":"${m![k]}"`).join(', ')}}`;
export const matches = (selector: Record<string, string> | undefined, labels: Record<string, string> | undefined) =>
  !!selector && Object.keys(selector).length > 0 && Object.entries(selector).every(([k, v]) => labels?.[k] === v);
/** A Deployment's selector (matchLabels and matchExpressions) against labels. */
export function selects(sel: J, labels: Record<string, string>): boolean {
  if (!sel) return false;
  const okLabels = Object.entries(sel.matchLabels ?? {}).every(([k, v]) => labels[k] === v);
  const okExpr = (sel.matchExpressions ?? []).every((e: J) => {
    const has = Object.hasOwn(labels, e.key);
    if (e.operator === 'In') return has && (e.values ?? []).includes(labels[e.key]);
    if (e.operator === 'NotIn') return !has || !(e.values ?? []).includes(labels[e.key]);
    if (e.operator === 'Exists') return has;
    if (e.operator === 'DoesNotExist') return !has;
    return false;
  });
  return okLabels && okExpr && (Object.keys(sel.matchLabels ?? {}).length > 0 || (sel.matchExpressions ?? []).length > 0);
}

const NAME_RE = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$/;

function validateContainers(prefix: string, spec: J, problems: string[]) {
  const cs = spec?.containers;
  if (!Array.isArray(cs) || !cs.length) {
    problems.push(`${prefix}.containers: Required value`);
    return;
  }
  const names = new Set<string>();
  cs.forEach((c: J, i: number) => {
    const p = `${prefix}.containers[${i}]`;
    if (!c.name) problems.push(`${p}.name: Required value`);
    else if (names.has(c.name)) problems.push(`${p}.name: Duplicate value: "${c.name}"`);
    names.add(c.name);
    if (!c.image) problems.push(`${p}.image: Required value`);
    (c.env ?? []).forEach((e: J, j: number) => {
      if (!e.name) problems.push(`${p}.env[${j}].name: Required value`);
      if (e.valueFrom && e.value !== undefined) problems.push(`${p}.env[${j}].valueFrom: Invalid value: "": may not be specified when \`value\` is not empty`);
    });
    (c.ports ?? []).forEach((port: J, j: number) => {
      if (!(port.containerPort >= 1 && port.containerPort <= 65535)) problems.push(`${p}.ports[${j}].containerPort: Invalid value: ${port.containerPort ?? 0}: must be between 1 and 65535, inclusive`);
    });
    for (const probe of ['readinessProbe', 'livenessProbe', 'startupProbe'])
      if (c[probe] && !c[probe].httpGet && !c[probe].tcpSocket && !c[probe].exec && !c[probe].grpc) problems.push(`${p}.${probe}: Required value: must specify a handler type`);
    for (const r of ['cpu', 'memory']) {
      const lim = c.resources?.limits?.[r];
      const req = c.resources?.requests?.[r];
      if (lim !== undefined && req !== undefined && (quantity(req) ?? 0) > (quantity(lim) ?? 0))
        problems.push(`${p}.resources.requests: Invalid value: "${req}": must be less than or equal to ${r} limit of ${lim}`);
    }
    const mounts = new Set((spec.volumes ?? []).map((v: J) => v.name));
    (c.volumeMounts ?? []).forEach((m: J, j: number) => {
      if (!mounts.has(m.name)) problems.push(`${p}.volumeMounts[${j}].name: Not found: "${m.name}"`);
    });
  });
}

/** The API server's checks of an object: [] when valid. */
export function validate(kind: string, obj: J, live: Obj | undefined): string[] {
  const problems: string[] = [];
  const name = obj.metadata?.name;
  if (!name) problems.push('metadata.name: Required value: name or generateName is required');
  else if (!NAME_RE.test(name) || name.length > 253)
    problems.push(`metadata.name: Invalid value: "${name}": a lowercase RFC 1123 subdomain must consist of lower case alphanumeric characters, '-' or '.', and must start and end with an alphanumeric character (e.g. 'example.com', regex used for validation is '[a-z0-9]([-a-z0-9]*[a-z0-9])?(\\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*')`);
  const spec = obj.spec;
  if (kind === 'Deployment') {
    if (!spec?.selector || (!Object.keys(spec.selector.matchLabels ?? {}).length && !(spec.selector.matchExpressions ?? []).length)) problems.push('spec.selector: Required value');
    else if (!selects(spec.selector, spec.template?.metadata?.labels ?? {}))
      problems.push(`spec.template.metadata.labels: Invalid value: ${goMap(spec.template?.metadata?.labels)}: \`selector\` does not match template \`labels\``);
    if (live && !same(live.body.spec?.selector, spec?.selector)) {
      const ml = spec?.selector?.matchLabels;
      problems.push(`spec.selector: Invalid value: v1.LabelSelector{MatchLabels:${goMap(ml)}, MatchExpressions:[]v1.LabelSelectorRequirement(nil)}: field is immutable`);
    }
    if (spec?.replicas < 0) problems.push(`spec.replicas: Invalid value: ${spec.replicas}: must be greater than or equal to 0`);
    validateContainers('spec.template.spec', spec?.template?.spec, problems);
  } else if (kind === 'Pod') {
    validateContainers('spec', spec, problems);
  } else if (kind === 'Service') {
    const ports = spec?.ports ?? [];
    if (!ports.length && spec?.type !== 'ExternalName') problems.push('spec.ports: Required value');
    if (spec?.type && !['ClusterIP', 'NodePort', 'LoadBalancer', 'ExternalName'].includes(spec.type)) problems.push(`spec.type: Unsupported value: "${spec.type}": supported values: "ClusterIP", "ExternalName", "LoadBalancer", "NodePort"`);
    ports.forEach((p: J, i: number) => {
      if (!(p.port >= 1 && p.port <= 65535)) problems.push(`spec.ports[${i}].port: Invalid value: ${p.port ?? 0}: must be between 1 and 65535, inclusive`);
      if (p.nodePort !== undefined && !(p.nodePort >= 30000 && p.nodePort <= 32767))
        problems.push(`spec.ports[${i}].nodePort: Invalid value: ${p.nodePort}: provided port is not in the valid range. The range of valid ports is 30000-32767`);
      if (ports.length > 1 && !p.name) problems.push(`spec.ports[${i}].name: Required value`);
    });
    if (live && spec?.clusterIP && live.body.spec?.clusterIP && spec.clusterIP !== live.body.spec.clusterIP) problems.push(`spec.clusterIPs[0]: Invalid value: []string{"${spec.clusterIP}"}: may not change once set`);
  } else if (kind === 'Ingress') {
    (spec?.rules ?? []).forEach((r: J, i: number) =>
      (r.http?.paths ?? []).forEach((p: J, j: number) => {
        const at = `spec.rules[${i}].http.paths[${j}]`;
        if (!p.pathType) problems.push(`${at}.pathType: Required value: pathType must be specified`);
        else if (!['Exact', 'Prefix', 'ImplementationSpecific'].includes(p.pathType)) problems.push(`${at}.pathType: Unsupported value: "${p.pathType}": supported values: "Exact", "ImplementationSpecific", "Prefix"`);
        if (p.path && !p.path.startsWith('/')) problems.push(`${at}.path: Invalid value: "${p.path}": must be an absolute path`);
        if (!p.backend?.service?.name && !p.backend?.resource) problems.push(`${at}.backend: Invalid value: "": resource or service backend is required`);
        const port = p.backend?.service?.port;
        if (p.backend?.service && !port?.number && !port?.name) problems.push(`${at}.backend.service.port: Invalid value: "": port name or number is required`);
      }),
    );
  } else if (kind === 'ConfigMap' || kind === 'Secret') {
    for (const key of Object.keys({ ...(obj.data ?? {}), ...(obj.stringData ?? {}) }))
      if (!/^[-._a-zA-Z0-9]+$/.test(key)) problems.push(`data[${key}]: Invalid value: "${key}": a valid config key must consist of alphanumeric characters, '-', '_' or '.' (e.g. 'key.name',  or 'KEY_NAME',  or 'key-name', regex used for validation is '[-._a-zA-Z0-9]+')`);
    if (kind === 'Secret' && obj.data) for (const [key, v] of Object.entries(obj.data)) if (base64Decode(String(v)) === null) problems.push(`data[${key}]: Invalid value: "<secret contents redacted>": illegal base64 data at input byte 0`);
    if (live?.body.immutable && !same(live.body.data, obj.data)) problems.push('data: Forbidden: field is immutable when `immutable` is set');
  }
  return problems;
}

export const invalidMessage = (kind: string, name: string, problems: string[]) =>
  problems.length === 1 ? `The ${kind} "${name}" is invalid: ${problems[0]}` : `The ${kind} "${name}" is invalid: \n${problems.map((p) => `* ${p}`).join('\n')}`;

// ——— The store ———

export const ns = (o: Obj) => o.metadata.namespace ?? '';
export const find = (k: K8s, kind: string, namespace: string, name: string) =>
  k.objects.find((o) => o.kind === kind && o.metadata.name === name && (!kindOf(kind).namespaced || ns(o) === namespace));
export const list = (k: K8s, kind: string, namespace: string | null) =>
  k.objects.filter((o) => o.kind === kind && (namespace === null || !kindOf(kind).namespaced || ns(o) === namespace)).sort((a, b) => (ns(a) + '/' + a.metadata.name < ns(b) + '/' + b.metadata.name ? -1 : 1));

export function newMeta(k: K8s, name: string, namespace: string | undefined, created: number, labels: Record<string, string> = {}, annotations: Record<string, string> = {}): Meta {
  k.seq++;
  return { name, ...(namespace !== undefined ? { namespace } : {}), uid: uidFor(`${namespace}/${name}/${k.seq}`), labels: { ...labels }, annotations: { ...annotations }, created, generation: 1, rv: ++k.rv };
}

/** Adds an object to the cluster (already validated and defaulted). */
export function create(k: K8s, kind: string, namespace: string | undefined, body: J, metadata: { name: string; labels?: Record<string, string>; annotations?: Record<string, string> }, owner?: Obj): Obj {
  const kd = kindOf(kind);
  const o: Obj = { kind, apiVersion: kd.apiVersion, metadata: newMeta(k, metadata.name, kd.namespaced ? namespace : undefined, k.now, metadata.labels, metadata.annotations), body: clone(body) };
  if (owner) o.metadata.owner = { kind: owner.kind, name: owner.metadata.name, uid: owner.metadata.uid, apiVersion: owner.apiVersion };
  if (kind === 'Pod') o.pod = newPodRun(o);
  if (kind === 'Deployment') o.deploy = { progressAt: k.now, reason: 'NewReplicaSetCreated', lastReplicas: 0, lastAvailable: 0, created: k.now };
  k.objects.push(o);
  return o;
}

export function remove(k: K8s, o: Obj) {
  k.objects = k.objects.filter((x) => x !== o);
  // Garbage collection: what it owns goes with it.
  for (const child of k.objects.filter((x) => x.metadata.owner?.uid === o.metadata.uid)) remove(k, child);
}

// ——— Events ———

export function record(k: K8s, o: Obj | { kind: string; metadata: { name: string; namespace?: string; uid: string } }, type: 'Normal' | 'Warning', reason: string, message: string, source = 'kubelet') {
  const namespace = o.metadata.namespace ?? 'default';
  const e = k.events.find((x) => x.uid === o.metadata.uid && x.reason === reason && x.message === message && x.type === type);
  if (e) {
    e.count++;
    e.last = k.now;
    return;
  }
  k.seq++;
  k.events.push({ namespace, kind: o.kind, name: o.metadata.name, uid: o.metadata.uid, type, reason, message, source, first: k.now, last: k.now, count: 1, id: `${o.metadata.name}.${(fnv(`${o.metadata.uid}${k.seq}`) * 65536 + k.seq).toString(16).padStart(16, '0').slice(-16)}` });
}
export const eventsFor = (k: K8s, uid: string) => k.events.filter((e) => e.uid === uid).sort((a, b) => a.last - b.last || a.first - b.first);

// ——— Images and the registry ———

/** "nginx" → docker.io/library/nginx:latest; "registry.example/a/b:1" stays. */
export function normalise(image: string): string {
  let ref = image;
  const first = ref.split('/')[0];
  if (!ref.includes('/') || (!first.includes('.') && !first.includes(':') && first !== 'localhost')) ref = `docker.io/${ref.includes('/') ? ref : `library/${ref}`}`;
  if (!/:[^/]+$/.test(ref) && !ref.includes('@')) ref += ':latest';
  return ref;
}
const splitRef = (ref: string) => {
  const m = /^(.*):([^/:]+)$/.exec(ref)!;
  return { repo: m[1], tag: m[2], host: ref.split('/')[0], path: m[1].split('/').slice(1).join('/') };
};
export const tagFor = (k: K8s, image: string): Tag | null => {
  const { repo, tag } = splitRef(normalise(image));
  return k.registry[repo]?.tags[tag] ?? null;
};
const digest = (ref: string) => `sha256:${identifier(`digest:${ref}`)}`;
/** registry.example/app@sha256:… (a pulled image's ID). */
export const imageDigest = (image: string) => `${normalise(image).replace(/:[^:/]+$/, '')}@${digest(normalise(image))}`;

/** Pulling an image: ok, or containerd's message (rpc error: code = …). */
function pull(k: K8s, image: string, pod: Obj): { ok: true; size: number } | { ok: false; message: string } {
  const ref = normalise(image);
  const { repo, tag, host, path } = splitRef(ref);
  const r = k.registry[repo];
  if (!r) {
    if (host === 'docker.io')
      return { ok: false, message: `rpc error: code = Unknown desc = failed to pull and unpack image "${ref}": failed to resolve reference "${ref}": pull access denied, repository does not exist or may require authorization: server message: insufficient_scope: authorization failed` };
    const known = Object.keys(k.registry).some((x) => x.startsWith(`${host}/`));
    if (!known) return { ok: false, message: `rpc error: code = Unknown desc = failed to pull and unpack image "${ref}": failed to resolve reference "${ref}": failed to do request: Head "https://${host}/v2/${path}/manifests/${tag}": dial tcp: lookup ${host}: no such host` };
    return { ok: false, message: `rpc error: code = NotFound desc = failed to pull and unpack image "${ref}": failed to resolve reference "${ref}": ${ref}: not found` };
  }
  if (r.private && !(pod.body.spec?.imagePullSecrets ?? []).some((s: J) => find(k, 'Secret', ns(pod), s.name)?.body.type === 'kubernetes.io/dockerconfigjson'))
    return {
      ok: false,
      message: `rpc error: code = Unknown desc = failed to pull and unpack image "${ref}": failed to resolve reference "${ref}": failed to authorize: failed to fetch anonymous token: unexpected status from GET request to https://${host}/token?scope=repository%3A${path.replace(/\//g, '%2F')}%3Apull&service=${host}: 401 Unauthorized`,
    };
  const t = r.tags[tag];
  if (!t) return { ok: false, message: `rpc error: code = NotFound desc = failed to pull and unpack image "${ref}": failed to resolve reference "${ref}": ${ref}: not found` };
  return { ok: true, size: t.size };
}

// ——— Pods: the kubelet ———

const containerSpecs = (o: Obj): J[] => o.body.spec?.containers ?? [];
const newContainer = (name: string): ContainerRun => ({
  name,
  state: 'waiting',
  reason: 'ContainerCreating',
  message: '',
  started: 0,
  restarts: 0,
  ready: false,
  step: 'image',
  nextAt: 0,
  pullBackoff: 0,
  backoff: 0,
  noticeAt: 0,
  ran: false,
  logs: [],
  readiness: { next: 0, fails: 0, oks: 0 },
  liveness: { next: 0, fails: 0, oks: 0 },
  id: '',
});
function newPodRun(o: Obj): PodRun {
  return { scheduled: 0, ip: '', started: 0, containers: containerSpecs(o).map((c) => newContainer(c.name)), readyAt: 0 };
}

/** The configuration a container gets: its environment and mounted files, or the error that keeps it from starting. */
export function containerConfig(k: K8s, pod: Obj, c: J): { env: Record<string, string>; files: Record<string, string> } | { error: string; mount?: boolean } {
  const namespace = ns(pod);
  const env: Record<string, string> = {};
  const files: Record<string, string> = {};
  const cm = (name: string) => find(k, 'ConfigMap', namespace, name);
  const secret = (name: string) => find(k, 'Secret', namespace, name);
  const secretData = (s: Obj) => Object.fromEntries(Object.entries(s.body.data ?? {}).map(([key, v]) => [key, base64Decode(String(v)) ?? '']));
  // Volumes first: a missing ConfigMap or Secret keeps the pod in ContainerCreating (FailedMount).
  for (const v of pod.body.spec?.volumes ?? []) {
    const mount = (c.volumeMounts ?? []).find((m: J) => m.name === v.name);
    const source = v.configMap ? cm(v.configMap.name) : v.secret ? secret(v.secret.secretName) : null;
    if ((v.configMap || v.secret) && !source) {
      if ((v.configMap ?? v.secret).optional) continue;
      return { error: `MountVolume.SetUp failed for volume "${v.name}" : ${v.configMap ? 'configmap' : 'secret'} "${v.configMap?.name ?? v.secret.secretName}" not found`, mount: true };
    }
    if (!mount || !source) continue;
    const data: Record<string, string> = v.configMap ? { ...(source.body.data ?? {}) } : secretData(source);
    const items: J[] | undefined = (v.configMap ?? v.secret).items;
    const entries = items ? items.map((i) => [i.path, data[i.key]] as const) : Object.entries(data);
    if (items) for (const i of items) if (!(i.key in data)) return { error: `MountVolume.SetUp failed for volume "${v.name}" : configmap references non-existent config key: ${i.key}`, mount: true };
    if (mount.subPath) {
      const content = data[mount.subPath] ?? entries.find(([p]) => p === mount.subPath)?.[1];
      if (content !== undefined) files[mount.mountPath] = content;
    } else for (const [p, content] of entries) files[`${mount.mountPath.replace(/\/$/, '')}/${p}`] = content ?? '';
  }
  for (const from of c.envFrom ?? []) {
    const prefix = from.prefix ?? '';
    if (from.configMapRef) {
      const m = cm(from.configMapRef.name);
      if (!m) {
        if (from.configMapRef.optional) continue;
        return { error: `configmap "${from.configMapRef.name}" not found` };
      }
      for (const [key, v] of Object.entries(m.body.data ?? {})) env[prefix + key] = String(v);
    }
    if (from.secretRef) {
      const s = secret(from.secretRef.name);
      if (!s) {
        if (from.secretRef.optional) continue;
        return { error: `secret "${from.secretRef.name}" not found` };
      }
      for (const [key, v] of Object.entries(secretData(s))) env[prefix + key] = v;
    }
  }
  for (const e of c.env ?? []) {
    if (e.value !== undefined) env[e.name] = String(e.value).replace(/\$\(([A-Za-z_][A-Za-z0-9_]*)\)/g, (all, n) => env[n] ?? all);
    else if (e.valueFrom?.configMapKeyRef) {
      const r = e.valueFrom.configMapKeyRef;
      const m = cm(r.name);
      if (!m) {
        if (r.optional) continue;
        return { error: `configmap "${r.name}" not found` };
      }
      if (!Object.hasOwn(m.body.data ?? {}, r.key)) {
        if (r.optional) continue;
        return { error: `couldn't find key ${r.key} in ConfigMap ${namespace}/${r.name}` };
      }
      env[e.name] = String(m.body.data[r.key]);
    } else if (e.valueFrom?.secretKeyRef) {
      const r = e.valueFrom.secretKeyRef;
      const s = secret(r.name);
      if (!s) {
        if (r.optional) continue;
        return { error: `secret "${r.name}" not found` };
      }
      const data = secretData(s);
      if (!Object.hasOwn(data, r.key)) {
        if (r.optional) continue;
        return { error: `couldn't find key ${r.key} in Secret ${namespace}/${r.name}` };
      }
      env[e.name] = data[r.key];
    } else if (e.valueFrom?.fieldRef) {
      const p = e.valueFrom.fieldRef.fieldPath;
      env[e.name] = p === 'metadata.name' ? pod.metadata.name : p === 'metadata.namespace' ? namespace : p === 'status.podIP' ? pod.pod!.ip : p === 'spec.nodeName' ? k.node.name : p === 'status.hostIP' ? k.node.ip : '';
    } else env[e.name] = '';
  }
  // Like every pod: the services' variables and the service account's files (enableServiceLinks).
  env.HOSTNAME = pod.metadata.name;
  env.KUBERNETES_SERVICE_HOST = '10.43.0.1';
  env.KUBERNETES_SERVICE_PORT = '443';
  files['/var/run/secrets/kubernetes.io/serviceaccount/namespace'] = namespace;
  files['/var/run/secrets/kubernetes.io/serviceaccount/token'] = `eyJhbGciOiJSUzI1NiIsImtpZCI6Ij${identifier(pod.metadata.uid).slice(0, 40)}`;
  files['/etc/hostname'] = pod.metadata.name;
  files['/etc/resolv.conf'] = `search ${namespace}.svc.cluster.local svc.cluster.local cluster.local\nnameserver 10.43.0.10\noptions ndots:5`;
  return { env, files };
}

const appFor = (k: K8s, image: string): K8sApp | null => {
  const t = tagFor(k, image);
  return t ? (k.apps[t.app] ?? null) : null;
};
const limitBytes = (c: J) => (c.resources?.limits?.memory !== undefined ? quantity(c.resources.limits.memory) : null);

/** A probe's result, from the kubelet (on the pod's address). */
export function probe(k: K8s, pod: Obj, cr: ContainerRun, c: J, p: J): { ok: boolean; message: string } {
  const ip = pod.pod!.ip;
  const app = appFor(k, c.image);
  const portOf = (port: J) => (typeof port === 'number' ? port : Number((c.ports ?? []).find((x: J) => x.name === port)?.containerPort ?? NaN));
  if (p.httpGet) {
    const port = portOf(p.httpGet.port);
    const path = p.httpGet.path ?? '/';
    const url = `${(p.httpGet.scheme ?? 'HTTP').toLowerCase()}://${ip}:${port}${path}`;
    if (!app || !app.ports.includes(port) || !cr.run) return { ok: false, message: `Get "${url}": dial tcp ${ip}:${port}: connect: connection refused` };
    const r = app.http?.(cr.run, { method: 'GET', path: path.split('?')[0], headers: { 'User-Agent': 'kube-probe/1.31' }, query: {} }, k) ?? { code: 404, body: '' };
    if (r.code >= 200 && r.code < 400) return { ok: true, message: '' };
    return { ok: false, message: `HTTP probe failed with statuscode: ${r.code}` };
  }
  if (p.tcpSocket) {
    const port = portOf(p.tcpSocket.port);
    if (!app || !app.ports.includes(port) || !cr.run) return { ok: false, message: `dial tcp ${ip}:${port}: connect: connection refused` };
    return { ok: true, message: '' };
  }
  if (p.exec) {
    const r = containerExec(k, pod, c.name, p.exec.command ?? []);
    return r.code === 0 ? { ok: true, message: '' } : { ok: false, message: (r.err || r.out).trim() };
  }
  return { ok: true, message: '' };
}

function terminate(k: K8s, pod: Obj, cr: ContainerRun, reason: string, code: number) {
  const t = k.now;
  cr.terminated = { reason, exitCode: code, started: cr.started, finished: t, id: cr.id, logs: cr.logs };
  cr.state = 'terminated';
  cr.reason = reason;
  cr.ready = false;
  cr.run = undefined;
  cr.exit = undefined;
  const policy = pod.body.spec?.restartPolicy ?? 'Always';
  if (policy === 'Never' || (policy === 'OnFailure' && code === 0)) {
    cr.step = 'run';
    cr.nextAt = Infinity;
    return;
  }
  // Exponential back-off: 10 s, doubled, at most 5 minutes; reset after 10 minutes of running.
  cr.backoff = t - cr.started >= 600_000 || !cr.backoff ? 10 : Math.min(cr.backoff * 2, 300);
  cr.step = 'backoff';
  cr.nextAt = t + cr.backoff * 1000;
  cr.noticeAt = t + 1000;
}

function stepContainer(k: K8s, pod: Obj, cr: ContainerRun, c: J) {
  const t = k.now;
  const podRef = `${pod.metadata.name}_${ns(pod)}(${pod.metadata.uid})`;
  if (cr.step === 'backoff') {
    if (t >= cr.noticeAt && cr.state === 'terminated') {
      cr.last = cr.terminated;
      cr.terminated = undefined;
      cr.state = 'waiting';
      cr.reason = 'CrashLoopBackOff';
      cr.message = `back-off ${age(cr.backoff * 1000).replace(/^(\d+)m$/, '$1m0s')} restarting failed container=${cr.name} pod=${podRef}`;
    }
    if (t < cr.nextAt) {
      if (cr.state === 'waiting' && (t - cr.noticeAt) % 10_000 === 0) record(k, pod, 'Warning', 'BackOff', `Back-off restarting failed container ${cr.name} in pod ${podRef}`);
      return;
    }
    cr.step = 'image';
  }
  if (cr.step === 'image') {
    if (t < cr.nextAt) {
      if (t >= cr.noticeAt && cr.reason === 'ErrImagePull') {
        cr.reason = 'ImagePullBackOff';
        cr.message = `Back-off pulling image "${c.image}": ErrImagePull: ${cr.message}`;
      }
      if (cr.reason === 'ImagePullBackOff' && (t - cr.noticeAt) % 10_000 === 0) {
        record(k, pod, 'Normal', 'BackOff', `Back-off pulling image "${c.image}"`);
        record(k, pod, 'Warning', 'Failed', 'Error: ImagePullBackOff');
      }
      return;
    }
    const ref = normalise(c.image);
    const present = k.images.includes(ref);
    if (present && c.imagePullPolicy !== 'Always') {
      record(k, pod, 'Normal', 'Pulled', `Container image "${c.image}" already present on machine`);
    } else {
      record(k, pod, 'Normal', 'Pulling', `Pulling image "${c.image}"`);
      const r = pull(k, c.image, pod);
      if (!r.ok) {
        record(k, pod, 'Warning', 'Failed', `Failed to pull image "${c.image}": ${r.message}`);
        record(k, pod, 'Warning', 'Failed', 'Error: ErrImagePull');
        cr.state = 'waiting';
        cr.reason = 'ErrImagePull';
        cr.message = r.message;
        cr.pullBackoff = cr.pullBackoff ? Math.min(cr.pullBackoff * 2, 300) : 10;
        cr.nextAt = t + cr.pullBackoff * 1000;
        cr.noticeAt = t + 2000;
        return;
      }
      if (!present) k.images.push(ref);
      const took = (1.2 + (r.size / 1e8) * 3).toFixed(3);
      record(k, pod, 'Normal', 'Pulled', `Successfully pulled image "${c.image}" in ${took}s (${took}s including waiting). Image size: ${r.size} bytes.`);
    }
    cr.pullBackoff = 0;
    cr.step = 'config';
  }
  if (cr.step === 'config') {
    if (t < cr.nextAt) return;
    const conf = containerConfig(k, pod, c);
    if ('error' in conf) {
      cr.state = 'waiting';
      cr.reason = 'CreateContainerConfigError';
      cr.message = conf.error;
      record(k, pod, 'Warning', 'Failed', `Error: ${conf.error}`);
      cr.nextAt = t + 10_000;
      return;
    }
    // A new instance: the previous one's logs stay for --previous.
    if (cr.ran) cr.restarts++;
    cr.ran = true;
    cr.id = identifier(`${pod.metadata.uid}/${cr.name}/${cr.restarts}`);
    record(k, pod, 'Normal', 'Created', `Created container ${cr.name}`);
    record(k, pod, 'Normal', 'Started', `Started container ${cr.name}`);
    cr.state = 'running';
    cr.reason = '';
    cr.message = '';
    cr.started = t;
    cr.logs = [];
    cr.terminated = undefined;
    cr.step = 'run';
    const app = appFor(k, c.image);
    cr.run = { namespace: ns(pod), pod: pod.metadata.name, container: cr.name, env: conf.env, files: conf.files, started: t, ip: pod.pod!.ip, data: {} };
    const out = app ? app.start(cr.run, k) : { logs: [] };
    cr.logs.push(...out.logs.map((text) => ({ t, text })));
    cr.exit = out.exit ? { at: t + out.exit.after * 1000, code: out.exit.code, logs: out.exit.logs } : undefined;
    const r = c.readinessProbe;
    cr.ready = !r;
    cr.readiness = { next: t + (r?.initialDelaySeconds ?? 0) * 1000 + (r?.initialDelaySeconds ? 0 : 1000), fails: 0, oks: 0 };
    const l = c.livenessProbe;
    cr.liveness = { next: t + (l?.initialDelaySeconds ?? 0) * 1000 + (l?.initialDelaySeconds ? 0 : 1000), fails: 0, oks: 0 };
    return;
  }
  // Running.
  if (cr.state !== 'running' || !cr.run) return;
  const app = appFor(k, c.image);
  const more = app?.tick?.(cr.run, t, k);
  if (more) cr.logs.push(...more.map((text) => ({ t, text })));
  if (cr.exit && t >= cr.exit.at) {
    cr.logs.push(...cr.exit.logs.map((text) => ({ t, text })));
    terminate(k, pod, cr, cr.exit.code === 0 ? 'Completed' : 'Error', cr.exit.code);
    return;
  }
  const limit = limitBytes(c);
  if (limit !== null && app?.memory && app.memory(cr.run, t, k) > limit) {
    terminate(k, pod, cr, 'OOMKilled', 137);
    return;
  }
  const l = c.livenessProbe;
  if (l && t >= cr.liveness.next) {
    cr.liveness.next = t + (l.periodSeconds ?? 10) * 1000;
    const r = probe(k, pod, cr, c, l);
    if (r.ok) cr.liveness.fails = 0;
    else {
      cr.liveness.fails++;
      record(k, pod, 'Warning', 'Unhealthy', `Liveness probe failed: ${r.message}`);
      if (cr.liveness.fails >= (l.failureThreshold ?? 3)) {
        record(k, pod, 'Normal', 'Killing', `Container ${cr.name} failed liveness probe, will be restarted`);
        terminate(k, pod, cr, 'Error', 137);
        return;
      }
    }
  }
  const rp = c.readinessProbe;
  if (rp && t >= cr.readiness.next) {
    cr.readiness.next = t + (rp.periodSeconds ?? 10) * 1000;
    const r = probe(k, pod, cr, c, rp);
    if (r.ok) {
      cr.readiness.fails = 0;
      cr.readiness.oks++;
      if (cr.readiness.oks >= (rp.successThreshold ?? 1)) cr.ready = true;
    } else {
      cr.readiness.oks = 0;
      cr.readiness.fails++;
      record(k, pod, 'Warning', 'Unhealthy', `Readiness probe failed: ${r.message}`);
      if (cr.readiness.fails >= (rp.failureThreshold ?? 3)) cr.ready = false;
    }
  }
}

/** Requests of a pod (sums of its containers), in millicores and bytes. */
export function podRequests(o: Obj): { cpu: number; memory: number } {
  return containerSpecs(o).reduce((s, c) => ({ cpu: s.cpu + millicores(c.resources?.requests?.cpu ?? 0), memory: s.memory + (quantity(c.resources?.requests?.memory ?? 0) ?? 0) }), { cpu: 0, memory: 0 });
}

function stepPod(k: K8s, pod: Obj) {
  const r = pod.pod!;
  if (r.fixed) return;
  const t = k.now;
  if (!r.scheduled) {
    const others = k.objects.filter((o) => o.kind === 'Pod' && o !== pod && o.pod?.scheduled && !o.pod.fixed);
    const used = others.reduce((s, o) => ({ cpu: s.cpu + podRequests(o).cpu, memory: s.memory + podRequests(o).memory }), { cpu: 0, memory: 0 });
    const want = podRequests(pod);
    const missing = [want.cpu + used.cpu > k.node.cpu ? 'cpu' : '', want.memory + used.memory > k.node.memory ? 'memory' : ''].filter(Boolean);
    if (missing.length) {
      if ((t - pod.metadata.created) % 10_000 === 0)
        record(k, pod, 'Warning', 'FailedScheduling', `0/1 nodes are available: ${missing.map((m) => `1 Insufficient ${m}`).join(', ')}. preemption: 0/1 nodes are available: 1 No preemption victims found for incoming pod.`, 'default-scheduler');
      return;
    }
    r.scheduled = t;
    record(k, pod, 'Normal', 'Scheduled', `Successfully assigned ${ns(pod)}/${pod.metadata.name} to ${k.node.name}`, 'default-scheduler');
    return;
  }
  if (!r.ip) {
    r.ip = `10.42.0.${k.ipNext++}`;
    r.started = t;
    return;
  }
  const specs = containerSpecs(pod);
  // Volumes: mounted before any container starts.
  if (r.mountError !== '') {
    const conf = specs.length ? containerConfig(k, pod, specs[0]) : { env: {} };
    if ('error' in conf && conf.mount) {
      if (r.mountError === undefined || (t - r.started) % 15_000 === 0) record(k, pod, 'Warning', 'FailedMount', conf.error);
      r.mountError = conf.error;
      return;
    }
    r.mountError = '';
  }
  specs.forEach((c, i) => {
    r.containers[i] ??= newContainer(c.name);
    stepContainer(k, pod, r.containers[i], c);
  });
  const ready = r.containers.length > 0 && r.containers.every((c) => c.ready);
  if (ready && !r.readyAt) r.readyAt = t;
  if (!ready) r.readyAt = 0;
}

export const podReady = (o: Obj) => !!o.pod && (o.pod.fixed ? false : o.pod.containers.length > 0 && o.pod.containers.every((c) => c.ready));
export function podAvailable(o: Obj, minReady: number, t: number) {
  return podReady(o) && o.pod!.readyAt > 0 && t - o.pod!.readyAt >= minReady * 1000;
}

export function phase(o: Obj): string {
  const r = o.pod!;
  if (r.fixed) return r.fixed;
  if (!r.scheduled || !r.ip) return 'Pending';
  if (r.containers.some((c) => c.ran)) {
    const policy = o.body.spec?.restartPolicy ?? 'Always';
    if (policy !== 'Always' && r.containers.every((c) => c.state === 'terminated')) return r.containers.every((c) => c.terminated?.exitCode === 0) ? 'Succeeded' : 'Failed';
    return 'Running';
  }
  return 'Pending';
}

/** The STATUS column of kubectl get pods (its printer's rules). */
export function podStatusText(o: Obj): string {
  const r = o.pod!;
  if (r.fixed) return 'Completed';
  if (!r.scheduled) return 'Pending';
  let reason = phase(o);
  let running = false;
  for (const c of [...r.containers].reverse()) {
    if (c.state === 'waiting' && c.reason) reason = c.reason;
    else if (c.state === 'terminated') reason = c.terminated?.reason || `ExitCode:${c.terminated?.exitCode}`;
    else if (c.state === 'running' && c.ready) running = true;
  }
  if (reason === 'Completed' && running) reason = podReady(o) ? 'Running' : 'NotReady';
  return reason;
}

// ——— Controllers ———

const rsOf = (k: K8s, d: Obj) => k.objects.filter((o) => o.kind === 'ReplicaSet' && o.metadata.owner?.uid === d.metadata.uid);
const podsOf = (k: K8s, rs: Obj) => k.objects.filter((o) => o.kind === 'Pod' && o.metadata.owner?.uid === rs.metadata.uid);
export const revisionOf = (rs: Obj) => Number(rs.metadata.annotations['deployment.kubernetes.io/revision'] ?? 0);
/** A template without the pod-template-hash label (to compare a ReplicaSet with its Deployment). */
const bareTemplate = (template: J) => {
  const t = clone(template ?? {});
  if (t.metadata?.labels) {
    delete t.metadata.labels['pod-template-hash'];
    if (!Object.keys(t.metadata.labels).length) delete t.metadata.labels;
  }
  return t;
};
// A template's stable form, kept per object (bodies are replaced, not changed in place, by update()): the controllers compare them every second.
const stableCache = new WeakMap<object, string>();
const stableOf = (template: J, bare: boolean): string => {
  if (!template || typeof template !== 'object') return stable(bare ? bareTemplate(template) : template);
  let s = stableCache.get(template);
  if (s === undefined) stableCache.set(template, (s = stable(bare ? bareTemplate(template) : template)));
  return s;
};
export const newReplicaSet = (k: K8s, d: Obj) => {
  const want = stableOf(d.body.spec.template, false);
  return rsOf(k, d).find((rs) => stableOf(rs.body.spec.template, true) === want);
};

function syncReplicaSet(k: K8s, rs: Obj) {
  const want = rs.body.spec.replicas ?? 1;
  const pods = podsOf(k, rs);
  if (pods.length < want) {
    for (let i = pods.length; i < want; i++) {
      let name = '';
      for (let n = 0; !name || find(k, 'Pod', ns(rs), name); n++) name = `${rs.metadata.name}-${suffix(`${rs.metadata.uid}/${k.seq}/${n}`)}`;
      const template = rs.body.spec.template;
      const pod = create(k, 'Pod', ns(rs), { spec: clone(template.spec) }, { name, labels: template.metadata?.labels ?? {}, annotations: template.metadata?.annotations ?? {} }, rs);
      pod.metadata.generateName = `${rs.metadata.name}-`;
      record(k, rs, 'Normal', 'SuccessfulCreate', `Created pod: ${name}`, 'replicaset-controller');
    }
  } else if (pods.length > want) {
    // Who goes first: not scheduled, then not ready, then the youngest.
    const rank = (p: Obj) => (p.pod?.scheduled ? 0 : 4) + (podReady(p) ? 0 : 2);
    const order = [...pods].sort((a, b) => rank(b) - rank(a) || b.metadata.created - a.metadata.created);
    for (const p of order.slice(0, pods.length - want)) {
      remove(k, p);
      record(k, rs, 'Normal', 'SuccessfulDelete', `Deleted pod: ${p.metadata.name}`, 'replicaset-controller');
    }
  }
}

function scale(k: K8s, d: Obj, rs: Obj, to: number) {
  const from = rs.body.spec.replicas ?? 0;
  if (from === to) return;
  rs.body.spec.replicas = to;
  rs.metadata.generation++;
  record(k, d, 'Normal', 'ScalingReplicaSet', `Scaled ${to > from ? 'up' : 'down'} replica set ${rs.metadata.name} from ${from} to ${to}`, 'deployment-controller');
}

export function deploymentCounts(k: K8s, d: Obj) {
  const all = rsOf(k, d);
  const fresh = newReplicaSet(k, d);
  const min = d.body.spec.minReadySeconds ?? 0;
  const pods = all.flatMap((rs) => podsOf(k, rs));
  const freshPods = fresh ? podsOf(k, fresh) : [];
  return {
    replicas: pods.length,
    updated: freshPods.length,
    ready: pods.filter(podReady).length,
    available: pods.filter((p) => podAvailable(p, min, k.now)).length,
    want: d.body.spec.replicas ?? 1,
  };
}

function syncDeployment(k: K8s, d: Obj) {
  const spec = d.body.spec;
  const want = spec.replicas ?? 1;
  let fresh = newReplicaSet(k, d);
  const all = rsOf(k, d);
  const maxRevision = Math.max(0, ...all.map(revisionOf));
  if (!fresh) {
    const hash = templateHash(spec.template);
    const template = clone(spec.template);
    template.metadata ??= {};
    template.metadata.labels = { ...(template.metadata.labels ?? {}), 'pod-template-hash': hash };
    const selector = clone(spec.selector);
    selector.matchLabels = { ...(selector.matchLabels ?? {}), 'pod-template-hash': hash };
    fresh = create(
      k,
      'ReplicaSet',
      ns(d),
      { spec: { replicas: 0, selector, template, ...(spec.minReadySeconds ? { minReadySeconds: spec.minReadySeconds } : {}) } },
      { name: `${d.metadata.name}-${hash}`, labels: template.metadata.labels, annotations: { 'deployment.kubernetes.io/desired-replicas': String(want), 'deployment.kubernetes.io/max-replicas': String(want + percentOr(spec.strategy?.rollingUpdate?.maxSurge, want, true)), 'deployment.kubernetes.io/revision': String(maxRevision + 1) } },
      d,
    );
    // Like the controller's setNewReplicaSetAnnotations: the Deployment's change-cause goes to its new ReplicaSet (rollout history).
    const cause = d.metadata.annotations['kubernetes.io/change-cause'];
    if (cause !== undefined) fresh.metadata.annotations['kubernetes.io/change-cause'] = cause;
    d.deploy!.progressAt = k.now;
    d.deploy!.reason = 'NewReplicaSetCreated';
  } else if (revisionOf(fresh) < maxRevision) {
    // Back to an older template (rollout undo): it becomes the newest revision.
    fresh.metadata.annotations['deployment.kubernetes.io/revision'] = String(maxRevision + 1);
    d.deploy!.progressAt = k.now;
  }
  for (const rs of all) {
    rs.metadata.annotations['deployment.kubernetes.io/desired-replicas'] = String(want);
  }
  const old = rsOf(k, d).filter((rs) => rs !== fresh);
  const min = spec.minReadySeconds ?? 0;
  const availableOf = (rs: Obj) => podsOf(k, rs).filter((p) => podAvailable(p, min, k.now)).length;
  if (spec.paused) return;
  if (spec.strategy?.type === 'Recreate') {
    for (const rs of old) scale(k, d, rs, 0);
    if (old.every((rs) => podsOf(k, rs).length === 0)) scale(k, d, fresh, want);
    return;
  }
  const surge = percentOr(spec.strategy?.rollingUpdate?.maxSurge ?? '25%', want, true);
  let unavailable = percentOr(spec.strategy?.rollingUpdate?.maxUnavailable ?? '25%', want, false);
  if (surge === 0 && unavailable === 0) unavailable = 1;
  const total = () => rsOf(k, d).reduce((s, rs) => s + (rs.body.spec.replicas ?? 0), 0);
  // Scale up the new ReplicaSet (deployment controller's reconcileNewReplicaSet).
  const freshReplicas = fresh.body.spec.replicas ?? 0;
  if (freshReplicas > want) scale(k, d, fresh, want);
  else if (freshReplicas < want) {
    const up = Math.min(want, freshReplicas + Math.max(0, want + surge - total()));
    if (up > freshReplicas) {
      scale(k, d, fresh, up);
      d.deploy!.progressAt = k.now;
      d.deploy!.reason = 'ReplicaSetUpdated';
    }
  }
  // Scale down the old ones (reconcileOldReplicaSets): the unhealthy first.
  const minAvailable = want - unavailable;
  const freshUnavailable = (fresh.body.spec.replicas ?? 0) - availableOf(fresh);
  let maxDown = total() - minAvailable - freshUnavailable;
  if (maxDown > 0) {
    for (const rs of [...old].sort((a, b) => a.metadata.created - b.metadata.created)) {
      if (maxDown <= 0) break;
      const r = rs.body.spec.replicas ?? 0;
      const unhealthy = r - availableOf(rs);
      const down = Math.min(unhealthy, maxDown);
      if (down > 0) {
        scale(k, d, rs, r - down);
        maxDown -= down;
      }
    }
    const allAvailable = rsOf(k, d).reduce((s, rs) => s + availableOf(rs), 0);
    let canDown = allAvailable - minAvailable;
    for (const rs of [...old].sort((a, b) => a.metadata.created - b.metadata.created)) {
      if (canDown <= 0) break;
      const r = rs.body.spec.replicas ?? 0;
      const down = Math.min(r, canDown);
      if (down > 0) {
        scale(k, d, rs, r - down);
        canDown -= down;
      }
    }
  }
  const c = deploymentCounts(k, d);
  if (c.available > d.deploy!.lastAvailable || c.updated > d.deploy!.lastReplicas) d.deploy!.progressAt = k.now;
  d.deploy!.lastAvailable = c.available;
  d.deploy!.lastReplicas = c.updated;
  const complete = c.updated === want && c.replicas === want && c.available === want;
  if (complete) d.deploy!.reason = 'NewReplicaSetAvailable';
  else if (k.now - d.deploy!.progressAt > (spec.progressDeadlineSeconds ?? 600) * 1000) d.deploy!.reason = 'ProgressDeadlineExceeded';
  else if (d.deploy!.reason === 'NewReplicaSetAvailable' || d.deploy!.reason === 'ProgressDeadlineExceeded') d.deploy!.reason = 'ReplicaSetUpdated';
  d.metadata.annotations['deployment.kubernetes.io/revision'] = String(revisionOf(fresh));
}

/** One second of the cluster's life. */
export function tick(k: K8s) {
  for (const d of k.objects.filter((o) => o.kind === 'Deployment')) syncDeployment(k, d);
  for (const rs of k.objects.filter((o) => o.kind === 'ReplicaSet')) syncReplicaSet(k, rs);
  for (const p of k.objects.filter((o) => o.kind === 'Pod')) stepPod(k, p);
  // Events live an hour (the API server's --event-ttl).
  if (k.now % 60_000 === 0) k.events = k.events.filter((e) => k.now - e.last < 3_600_000);
}

/** Lets the cluster live until `to` (second by second; beyond two hours, the clock just jumps). */
export function advance(game: Game, to: number, live = true) {
  const k = k8s(game);
  if (!k) return;
  const up = clusterUp(game);
  const end = Math.min(to, k.now + 7_200_000);
  if (live && up) {
    k.now = Math.ceil(k.now / 1000) * 1000;
    while (k.now < end) {
      k.now += 1000;
      tick(k);
    }
  }
  k.now = to;
  const sd = systemd(game);
  if (sd && sd.clock < to) sd.clock = to;
}

export const clusterUp = (game: Game) => {
  const sd = systemd((game as unknown as { principal?: Game }).principal ?? game);
  return !sd || sd.services.k3s?.state === 'active';
};

// ——— Services, endpoints, network ———

const portNumber = (pod: Obj, target: J): number | null => {
  if (typeof target === 'number') return target;
  for (const c of containerSpecs(pod)) for (const p of c.ports ?? []) if (p.name === target) return p.containerPort;
  return null;
};

/** The pods a Service selects, and for each port, the target port on each. */
export function endpointsOf(k: K8s, svc: Obj): { pod: Obj; ready: boolean; ports: { name: string; port: number; protocol: string }[] }[] {
  const sel = svc.body.spec?.selector;
  if (!sel || !Object.keys(sel).length) return [];
  return list(k, 'Pod', ns(svc))
    .filter((p) => matches(sel, p.metadata.labels) && p.pod?.ip && !p.pod.fixed)
    .map((p) => ({
      pod: p,
      ready: podReady(p),
      ports: (svc.body.spec.ports ?? []).map((sp: J) => ({ name: sp.name ?? '', port: portNumber(p, sp.targetPort) ?? 0, protocol: sp.protocol ?? 'TCP' })).filter((x: { port: number }) => x.port),
    }));
}

const listening = (k: K8s, pod: Obj, port: number): { app: K8sApp; run: AppRun } | null => {
  if (!pod.pod) return null;
  for (const [i, c] of containerSpecs(pod).entries()) {
    const cr = pod.pod.containers[i];
    const app = appFor(k, c.image);
    if (cr?.state === 'running' && cr.run && app?.ports.includes(port)) return { app, run: cr.run };
  }
  return null;
};

export type NetReply = { kind: 'http'; code: number; body: string; type?: string } | { kind: 'refused' } | { kind: 'timeout' };

function toPod(k: K8s, pod: Obj, port: number, req: HttpRequest): NetReply {
  const l = listening(k, pod, port);
  if (!l) return { kind: 'refused' };
  const r = l.app.http?.(l.run, req, k) ?? { code: 404, body: '' };
  return { kind: 'http', code: r.code, body: r.body, type: r.type };
}

function toService(k: K8s, svc: Obj, servicePort: J, req: HttpRequest): NetReply {
  const sp = (svc.body.spec.ports ?? []).find((p: J) => p.port === servicePort || (typeof servicePort === 'string' && p.name === servicePort));
  if (!sp) return { kind: 'refused' };
  const eps = endpointsOf(k, svc).filter((e) => e.ready);
  if (!eps.length) return { kind: 'refused' };
  const e = eps[k.rr++ % eps.length];
  const port = portNumber(e.pod, sp.targetPort);
  return port ? toPod(k, e.pod, port, req) : { kind: 'refused' };
}

// Traefik (k3s's ingress controller): its routers, from the Ingresses.
// https://doc.traefik.io/traefik/v2.11/providers/kubernetes-ingress/
export interface Route {
  ingress: Obj;
  host: string;
  path: string;
  pathType: string;
  service: string;
  port: J;
  problem: '' | 'service not found' | 'service port not found' | 'no endpoints found';
}
export function routes(k: K8s): Route[] {
  const out: Route[] = [];
  for (const ing of list(k, 'Ingress', null)) {
    const cls = ing.body.spec?.ingressClassName ?? ing.metadata.annotations['kubernetes.io/ingress.class'];
    if (cls && cls !== 'traefik') continue;
    for (const rule of ing.body.spec?.rules ?? [])
      for (const p of rule.http?.paths ?? []) {
        const name = p.backend?.service?.name;
        const port = p.backend?.service?.port?.number ?? p.backend?.service?.port?.name;
        const svc = name ? find(k, 'Service', ns(ing), name) : undefined;
        const sp = svc && (svc.body.spec.ports ?? []).find((x: J) => x.port === port || x.name === port);
        const problem = !svc ? 'service not found' : !sp ? 'service port not found' : !endpointsOf(k, svc).some((e) => e.ready) ? 'no endpoints found' : '';
        out.push({ ingress: ing, host: rule.host ?? '', path: p.path ?? '/', pathType: p.pathType ?? 'Prefix', service: name ?? '', port, problem });
      }
  }
  return out;
}

const pathMatches = (r: Route, path: string) => {
  if (r.pathType === 'Exact') return path === r.path;
  const prefix = r.path.replace(/\/$/, '');
  return prefix === '' || path === prefix || path.startsWith(prefix + '/') || (r.pathType === 'ImplementationSpecific' && path.startsWith(prefix));
};
const hostMatches = (rule: string, host: string) => !rule || rule === host || (rule.startsWith('*.') && host.endsWith(rule.slice(1)) && !host.slice(0, -rule.length + 1).includes('.'));

function traefik(k: K8s, req: HttpRequest, scheme: string): NetReply {
  const tr = list(k, 'Pod', 'kube-system').find((p) => p.metadata.labels['app.kubernetes.io/name'] === 'traefik');
  if (!tr || !podReady(tr)) return { kind: 'refused' };
  const host = (req.headers.host ?? '').replace(/:\d+$/, '').toLowerCase();
  const candidates = routes(k)
    .filter((r) => !r.problem && hostMatches(r.host, host) && pathMatches(r, req.path))
    .sort((a, b) => (b.host ? 1 : 0) - (a.host ? 1 : 0) || b.path.length - a.path.length);
  const r = candidates[0];
  if (!r) return { kind: 'http', code: 404, body: '404 page not found\n', type: 'text/plain; charset=utf-8' };
  const svc = find(k, 'Service', ns(r.ingress), r.service)!;
  return toService(k, svc, r.port, { ...req, headers: { ...req.headers, 'X-Forwarded-Proto': scheme, 'X-Forwarded-Host': host, 'X-Forwarded-Server': tr.metadata.name } });
}

/** A request from the node (curl) or from a pod (wget) to an address and port. */
export function request(k: K8s, address: string, port: number, req: HttpRequest): NetReply {
  if (address === k.node.ip || address === '127.0.0.1') {
    if (port === 80 || port === 443) {
      const lb = k.objects.find((o) => o.kind === 'Service' && o.body.spec?.type === 'LoadBalancer' && (o.body.spec.ports ?? []).some((p: J) => p.port === port));
      if (lb && lb.metadata.name !== 'traefik') return toService(k, lb, port, req);
      return traefik(k, req, port === 443 ? 'https' : 'http');
    }
    if (port === 6443 || port === 10250)
      return { kind: 'http', code: 401, body: JSON.stringify({ kind: 'Status', apiVersion: 'v1', metadata: {}, status: 'Failure', message: 'Unauthorized', reason: 'Unauthorized', code: 401 }) + '\n', type: 'application/json' };
    const svc = k.objects.find((o) => o.kind === 'Service' && (o.body.spec?.ports ?? []).some((p: J) => p.nodePort === port));
    if (svc) return toService(k, svc, (svc.body.spec.ports as J[]).find((p) => p.nodePort === port).port, req);
    return { kind: 'refused' };
  }
  if (address.startsWith('10.43.')) {
    const svc = k.objects.find((o) => o.kind === 'Service' && o.body.spec?.clusterIP === address);
    if (!svc) return { kind: 'timeout' };
    return toService(k, svc, port, req);
  }
  if (address.startsWith('10.42.')) {
    const pod = k.objects.find((o) => o.kind === 'Pod' && o.pod?.ip === address);
    if (!pod) return { kind: 'timeout' };
    return toPod(k, pod, port, req);
  }
  return { kind: 'timeout' };
}

/** A name as a pod resolves it (CoreDNS: services, then the outside). */
export function resolveInPod(k: K8s, namespace: string, name: string): string | null {
  const n = name.toLowerCase().replace(/\.$/, '');
  if (/^\d+\.\d+\.\d+\.\d+$/.test(n)) return n;
  const parts = n.replace(/\.svc\.cluster\.local$/, '').replace(/\.svc$/, '').split('.');
  if (parts.length <= 2) {
    const svc = find(k, 'Service', parts[1] ?? namespace, parts[0]);
    if (svc?.body.spec?.clusterIP) return svc.body.spec.clusterIP;
  }
  if (n === 'kubernetes' || n === 'kubernetes.default') return '10.43.0.1';
  return k.outside[n] ?? k.publicNames[n] ?? null;
}

// ——— Inside a container (kubectl exec, exec probes) ———

/** A container's files: the image's, then what is mounted. */
export function containerFiles(k: K8s, pod: Obj, container: string): Record<string, string> {
  const c = containerSpecs(pod).find((x) => x.name === container);
  const cr = pod.pod?.containers.find((x) => x.name === container);
  const app = c ? appFor(k, c.image) : null;
  return { ...(app?.files ?? {}), '/etc/os-release': 'NAME="Alpine Linux"\nID=alpine\nVERSION_ID=3.20.3\nPRETTY_NAME="Alpine Linux v3.20"', ...(cr?.run?.files ?? {}) };
}

/** Runs a command in a running container (BusyBox's sh and a few applets). */
export function containerExec(k: K8s, pod: Obj, container: string, argv: string[]): { out: string; err: string; code: number } {
  const cr = pod.pod?.containers.find((x) => x.name === container);
  const c = containerSpecs(pod).find((x) => x.name === container);
  if (!cr || cr.state !== 'running' || !cr.run || !c) return { out: '', err: `error: unable to upgrade connection: container not found ("${container}")`, code: 1 };
  const app = appFor(k, c.image);
  const files = containerFiles(k, pod, container);
  const env = { PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin', ...cr.run.env, HOME: app?.user && app.user !== 'root' ? `/home/${app.user}` : '/root' };
  const cwd = c.workingDir ?? app?.workdir ?? '/';
  const abs = (p: string) => (p.startsWith('/') ? p : `${cwd.replace(/\/$/, '')}/${p}`).replace(/\/\.\//g, '/');
  let [cmd, ...args] = argv;
  if ((cmd === 'sh' || cmd === '/bin/sh') && args[0] === '-c') {
    const words = (args[1] ?? '').match(/'[^']*'|"[^"]*"|\S+/g) ?? [];
    [cmd, ...args] = words.map((w) => w.replace(/^['"]|['"]$/g, '').replace(/^\$([A-Z_][A-Z0-9_]*)$/, (_, v) => env[v as keyof typeof env] ?? ''));
  }
  const ok = (out: string) => ({ out, err: '', code: 0 });
  const dirs = (p: string) => {
    const base = abs(p).replace(/\/$/, '') + '/';
    const names = new Set<string>();
    for (const f of Object.keys(files)) if (f.startsWith(base)) names.add(f.slice(base.length).split('/')[0]);
    return [...names].sort();
  };
  switch (cmd) {
    case undefined:
      return ok('');
    case 'env':
    case 'printenv':
      if (args[0]) return env[args[0] as keyof typeof env] !== undefined ? ok(env[args[0] as keyof typeof env]) : { out: '', err: '', code: 1 };
      return ok(Object.entries(env).map(([n, v]) => `${n}=${v}`).join('\n'));
    case 'cat': {
      const out: string[] = [];
      for (const a of args) {
        const f = files[abs(a)];
        if (f === undefined) return { out: out.join('\n'), err: dirs(a).length ? `cat: read error: Is a directory` : `cat: can't open '${a}': No such file or directory`, code: 1 };
        out.push(f.replace(/\n$/, ''));
      }
      return ok(out.join('\n'));
    }
    case 'ls': {
      const target = args.filter((a) => !a.startsWith('-'))[0] ?? cwd;
      if (files[abs(target)] !== undefined) return ok(target);
      const d = dirs(target);
      if (!d.length && !['/', '/tmp', cwd].includes(abs(target))) return { out: '', err: `ls: ${target}: No such file or directory`, code: 1 };
      return ok(d.join('\n'));
    }
    case 'pwd':
      return ok(cwd);
    case 'echo':
      return ok(args.join(' '));
    case 'hostname':
      return ok(pod.metadata.name);
    case 'whoami':
      return ok(app?.user ?? 'root');
    case 'id':
      return ok(app?.user && app.user !== 'root' ? `uid=1000(${app.user}) gid=1000(${app.user}) groups=1000(${app.user})` : 'uid=0(root) gid=0(root) groups=0(root),1(bin),2(daemon),3(sys),4(adm),6(disk),10(wheel),11(floppy),20(dialout),26(tape),27(video)');
    case 'true':
      return ok('');
    case 'false':
      return { out: '', err: '', code: 1 };
    case 'test':
    case '[': {
      const a = args.filter((x) => x !== ']');
      if (a[0] === '-f' || a[0] === '-e') return { out: '', err: '', code: files[abs(a[1] ?? '')] !== undefined ? 0 : 1 };
      return { out: '', err: '', code: 1 };
    }
    case 'ps':
      return ok(`PID   USER     TIME  COMMAND\n    1 ${(app?.user ?? 'root').padEnd(8)}  0:01 ${(c.command ?? ['node', 'server.js']).concat(c.args ?? []).join(' ')}\n   ${17 + cr.restarts} ${(app?.user ?? 'root').padEnd(8)}  0:00 ps`);
    case 'nslookup': {
      const name = args[0] ?? '';
      const ip = resolveInPod(k, cr.run.namespace, name);
      const fq = ip?.startsWith('10.43.') && !name.includes('.svc') ? `${name.split('.')[0]}.${name.split('.')[1] ?? cr.run.namespace}.svc.cluster.local` : name;
      if (!ip) return { out: `Server:\t\t10.43.0.10\nAddress:\t10.43.0.10:53\n\n** server can't find ${name}: NXDOMAIN`, err: '', code: 1 };
      return ok(`Server:\t\t10.43.0.10\nAddress:\t10.43.0.10:53\n\n\nName:\t${fq}\nAddress: ${ip}`);
    }
    case 'wget': {
      const url = args.filter((a) => !a.startsWith('-') && a !== '-')[0] ?? '';
      const quiet = args.some((a) => /^-q/.test(a));
      const m = /^(?:(https?):\/\/)?([^/:]+)(?::(\d+))?(\/[^?]*)?/.exec(url);
      if (!m) return { out: '', err: 'BusyBox v1.36.1 (2024-06-10 07:11:47 UTC) multi-call binary.\n\nUsage: wget [-cqS] [-O FILE] URL...', code: 1 };
      // localhost, inside a pod, is the pod itself.
      const ip = ['localhost', '127.0.0.1'].includes(m[2]) ? pod.pod!.ip : resolveInPod(k, cr.run.namespace, m[2]);
      if (!ip) return { out: '', err: `wget: bad address '${m[2]}'`, code: 1 };
      const port = Number(m[3] ?? (m[1] === 'https' ? 443 : 80));
      const r = request(k, ip, port, { method: 'GET', path: m[4] ?? '/', headers: { host: m[2], 'User-Agent': 'Wget' }, query: {} });
      const conn = quiet ? '' : `Connecting to ${m[2]}${m[3] ? `:${m[3]}` : ''} (${ip}:${port})\n`;
      if (r.kind === 'refused') return { out: '', err: `${conn}wget: can't connect to remote host (${ip}): Connection refused`, code: 1 };
      if (r.kind === 'timeout') return { out: '', err: `${conn}wget: download timed out`, code: 1 };
      if (r.code >= 400) return { out: '', err: `${conn}wget: server returned error: HTTP/1.1 ${r.code} ${r.code === 404 ? 'Not Found' : r.code === 503 ? 'Service Unavailable' : 'Error'}`, code: 1 };
      return { out: r.body.replace(/\n$/, ''), err: quiet ? '' : `${conn}writing to stdout\n-                    100% |********************************|  ${r.body.length}  0:00:00 ETA\nwritten to stdout`, code: 0 };
    }
    case 'bash':
    case 'curl':
    case 'apt':
    case 'apt-get':
    case 'systemctl':
    default:
      return { out: '', err: `sh: ${cmd}: not found`, code: 127 };
  }
}

// ——— Status as the API returns it (kubectl get -o yaml/json) ———

const metaOut = (o: Obj): J => {
  const m = o.metadata;
  return {
    ...(Object.keys(m.annotations).length ? { annotations: { ...m.annotations } } : {}),
    creationTimestamp: iso(m.created),
    ...(o.kind === 'Deployment' || o.kind === 'ReplicaSet' || o.kind === 'Ingress' || o.kind === 'Service' ? { generation: m.generation } : {}),
    ...(m.generateName ? { generateName: m.generateName } : {}),
    ...(Object.keys(m.labels).length ? { labels: { ...m.labels } } : {}),
    name: m.name,
    ...(m.namespace !== undefined ? { namespace: m.namespace } : {}),
    ...(m.owner ? { ownerReferences: [{ apiVersion: m.owner.apiVersion, blockOwnerDeletion: true, controller: true, kind: m.owner.kind, name: m.owner.name, uid: m.owner.uid }] } : {}),
    resourceVersion: String(m.rv),
    uid: m.uid,
  };
};

const containerState = (k: K8s, cr: ContainerRun, image: string): J => {
  const term = (x: Terminated) => ({ containerID: `containerd://${x.id}`, exitCode: x.exitCode, finishedAt: iso(x.finished), reason: x.reason, startedAt: iso(x.started) });
  return {
    ...(cr.id ? { containerID: `containerd://${cr.id}` } : {}),
    image: normalise(image),
    imageID: k.images.includes(normalise(image)) ? `${normalise(image).replace(/:[^:/]+$/, '')}@${digest(normalise(image))}` : '',
    lastState: cr.last ? { terminated: term(cr.last) } : {},
    name: cr.name,
    ready: cr.ready,
    restartCount: cr.restarts,
    started: cr.state === 'running',
    state:
      cr.state === 'running'
        ? { running: { startedAt: iso(cr.started) } }
        : cr.state === 'terminated' && cr.terminated
          ? { terminated: term(cr.terminated) }
          : { waiting: { ...(cr.message ? { message: cr.message } : {}), reason: cr.reason || 'ContainerCreating' } },
  };
};

export const qosClass = (o: Obj) => {
  const cs = containerSpecs(o);
  const req = (c: J, r: string) => c.resources?.requests?.[r];
  const lim = (c: J, r: string) => c.resources?.limits?.[r];
  if (cs.every((c) => !req(c, 'cpu') && !req(c, 'memory') && !lim(c, 'cpu') && !lim(c, 'memory'))) return 'BestEffort';
  if (cs.every((c) => ['cpu', 'memory'].every((r) => lim(c, r) !== undefined && quantity(req(c, r) ?? lim(c, r)) === quantity(lim(c, r))))) return 'Guaranteed';
  return 'Burstable';
};

export function podConditions(k: K8s, o: Obj): { type: string; status: string; time: number; reason?: string; message?: string }[] {
  const r = o.pod!;
  if (!r.scheduled) {
    const ev = k.events.filter((e) => e.uid === o.metadata.uid && e.reason === 'FailedScheduling').at(-1);
    return [{ type: 'PodScheduled', status: 'False', time: o.metadata.created, reason: 'Unschedulable', message: ev?.message ?? '' }];
  }
  const ready = podReady(o);
  const notReady = r.containers.filter((c) => !c.ready).map((c) => c.name);
  const msg = notReady.length ? `containers with unready status: [${notReady.join(' ')}]` : undefined;
  return [
    { type: 'PodReadyToStartContainers', status: r.ip ? 'True' : 'False', time: r.started || r.scheduled },
    { type: 'Initialized', status: 'True', time: r.scheduled },
    { type: 'Ready', status: ready ? 'True' : 'False', time: r.readyAt || r.started || r.scheduled, ...(ready ? {} : { reason: 'ContainersNotReady', message: msg }) },
    { type: 'ContainersReady', status: ready ? 'True' : 'False', time: r.readyAt || r.started || r.scheduled, ...(ready ? {} : { reason: 'ContainersNotReady', message: msg }) },
    { type: 'PodScheduled', status: 'True', time: r.scheduled },
  ];
}

/** The whole object, as the API server returns it. */
export function full(k: K8s, o: Obj): J {
  const base: J = { apiVersion: o.apiVersion, kind: o.kind, metadata: metaOut(o), ...clone(o.body) };
  if (o.kind === 'Pod') {
    const r = o.pod!;
    base.spec.nodeName = r.scheduled ? k.node.name : undefined;
    if (!base.spec.nodeName) delete base.spec.nodeName;
    base.spec.serviceAccountName ??= 'default';
    base.spec.serviceAccount ??= base.spec.serviceAccountName;
    base.spec.tolerations ??= [
      { effect: 'NoExecute', key: 'node.kubernetes.io/not-ready', operator: 'Exists', tolerationSeconds: 300 },
      { effect: 'NoExecute', key: 'node.kubernetes.io/unreachable', operator: 'Exists', tolerationSeconds: 300 },
    ];
    base.status = {
      conditions: podConditions(k, o).map((c) => ({ lastProbeTime: null, lastTransitionTime: iso(c.time), ...(c.message !== undefined ? { message: c.message } : {}), ...(c.reason ? { reason: c.reason } : {}), status: c.status, type: c.type })),
      ...(r.scheduled ? { containerStatuses: r.containers.map((cr, i) => containerState(k, cr, containerSpecs(o)[i]?.image ?? '')), hostIP: k.node.ip, hostIPs: [{ ip: k.node.ip }] } : {}),
      phase: phase(o),
      ...(r.ip ? { podIP: r.ip, podIPs: [{ ip: r.ip }], startTime: iso(r.started) } : {}),
      qosClass: qosClass(o),
    };
  } else if (o.kind === 'Deployment') {
    const c = deploymentCounts(k, o);
    const d = o.deploy!;
    const fresh = newReplicaSet(k, o);
    const minOk = c.available >= c.want - percentOr(o.body.spec.strategy?.rollingUpdate?.maxUnavailable ?? '25%', c.want, false);
    base.status = {
      ...(c.available ? { availableReplicas: c.available } : {}),
      conditions: [
        { lastTransitionTime: iso(d.created), lastUpdateTime: iso(d.created), message: minOk ? 'Deployment has minimum availability.' : 'Deployment does not have minimum availability.', reason: minOk ? 'MinimumReplicasAvailable' : 'MinimumReplicasUnavailable', status: minOk ? 'True' : 'False', type: 'Available' },
        {
          lastTransitionTime: iso(d.progressAt),
          lastUpdateTime: iso(d.progressAt),
          message:
            d.reason === 'NewReplicaSetAvailable'
              ? `ReplicaSet "${fresh?.metadata.name}" has successfully progressed.`
              : d.reason === 'ProgressDeadlineExceeded'
                ? `ReplicaSet "${fresh?.metadata.name}" has timed out progressing.`
                : `ReplicaSet "${fresh?.metadata.name}" is progressing.`,
          reason: d.reason,
          status: d.reason === 'ProgressDeadlineExceeded' ? 'False' : 'True',
          type: 'Progressing',
        },
      ],
      observedGeneration: o.metadata.generation,
      ...(c.ready ? { readyReplicas: c.ready } : {}),
      ...(c.replicas ? { replicas: c.replicas } : {}),
      ...(c.want - c.available > 0 ? { unavailableReplicas: c.want - c.available } : {}),
      ...(c.updated ? { updatedReplicas: c.updated } : {}),
    };
  } else if (o.kind === 'ReplicaSet') {
    const pods = podsOf(k, o);
    base.status = {
      ...(pods.filter(podReady).length ? { availableReplicas: pods.filter(podReady).length, readyReplicas: pods.filter(podReady).length } : {}),
      fullyLabeledReplicas: pods.length,
      observedGeneration: o.metadata.generation,
      replicas: pods.length,
    };
  } else if (o.kind === 'Service') {
    base.status = { loadBalancer: o.body.spec.type === 'LoadBalancer' ? { ingress: [{ ip: k.node.ip, ipMode: 'VIP' }] } : {} };
  } else if (o.kind === 'Ingress') {
    base.status = { loadBalancer: { ingress: [{ ip: k.node.ip }] } };
  } else if (o.kind === 'Namespace') {
    base.status = { phase: 'Active' };
  }
  return base;
}

/** Endpoints and EndpointSlices, computed from the Services (as the endpoint controllers keep them). */
export function endpointsObject(k: K8s, svc: Obj): J {
  const eps = endpointsOf(k, svc);
  const ports = (svc.body.spec.ports ?? []).map((p: J, i: number) => ({ ...(p.name ? { name: p.name } : {}), port: eps[0]?.ports[i]?.port ?? (typeof p.targetPort === 'number' ? p.targetPort : p.port), protocol: p.protocol ?? 'TCP' }));
  const addr = (e: (typeof eps)[number]) => ({ ip: e.pod.pod!.ip, nodeName: k.node.name, targetRef: { kind: 'Pod', name: e.pod.metadata.name, namespace: ns(e.pod), uid: e.pod.metadata.uid } });
  const ready = eps.filter((e) => e.ready);
  const notReady = eps.filter((e) => !e.ready);
  return {
    apiVersion: 'v1',
    kind: 'Endpoints',
    metadata: { creationTimestamp: iso(svc.metadata.created), ...(Object.keys(svc.metadata.labels).length ? { labels: { ...svc.metadata.labels } } : {}), name: svc.metadata.name, namespace: ns(svc), resourceVersion: String(svc.metadata.rv + 1), uid: uidFor(`ep/${svc.metadata.uid}`) },
    ...(eps.length ? { subsets: [{ ...(ready.length ? { addresses: ready.map(addr) } : {}), ...(notReady.length ? { notReadyAddresses: notReady.map(addr) } : {}), ports }] } : {}),
  };
}
export const sliceName = (svc: Obj) => `${svc.metadata.name}-${suffix(`slice/${svc.metadata.uid}`)}`;

// ——— The cluster's system part (k3s) ———

const sysApp = (logs: string[], ports: number[] = [], memory = 30): K8sApp => ({ ports, start: () => ({ logs }), http: () => ({ code: 200, body: 'ok' }), memory: () => memory * 1024 ** 2, cpu: () => 3 });

/** k3s's own applications: CoreDNS, local-path-provisioner, metrics-server, Traefik. */
export function systemApps(): Record<string, K8sApp> {
  return {
    coredns: sysApp(['.:53', '[INFO] plugin/reload: Running configuration SHA512 = 1f2f4a8f…', 'CoreDNS-1.12.0', 'linux/amd64, go1.23.3, 51e11f1'], [53, 8080, 8181], 18),
    'local-path-provisioner': sysApp(['time="…" level=info msg="Starting provisioner controller rancher.io/local-path_local-path-provisioner"'], [], 9),
    'metrics-server': sysApp(['I0101 Serving securely on [::]:10250', 'I0101 Generating self-signed cert'], [10250], 22),
    traefik: {
      ports: [8000, 8443, 9000, 9100],
      start: (run) => {
        run.data.seen = '';
        return { logs: [`time="${iso(run.started)}" level=info msg="Configuration loaded from flags."`, `time="${iso(run.started)}" level=info msg="Traefik version ${TRAEFIK_VERSION} built on 2025-01-07T12:44:49Z"`] };
      },
      // Traefik writes an error each time its routers change because of a backend it can't build.
      tick: (run, t, k) => {
        const problems = routes(k)
          .filter((r) => r.problem)
          .map((r) => {
            const port = typeof r.port === 'number' ? `&ServiceBackendPort{Name:,Number:${r.port},}` : `&ServiceBackendPort{Name:${r.port ?? ''},Number:0,}`;
            const msg = r.problem === 'no endpoints found' ? 'Skipping service: no endpoints found' : `Cannot create service: ${r.problem}`;
            return `time="${iso(t)}" level=error msg="${msg}" ingress=${r.ingress.metadata.name} namespace=${ns(r.ingress)} providerName=kubernetes serviceName=${r.service} servicePort="${port}"`;
          });
        const key = problems.map((p) => p.replace(/^time="[^"]*" /, '')).join('\n');
        if (key === run.data.seen) return;
        run.data.seen = key;
        return problems;
      },
      http: (run, req) => (req.path === '/ping' ? { code: 200, body: 'OK' } : { code: 404, body: '404 page not found\n' }),
      memory: () => 41 * 1024 ** 2,
      cpu: () => 2,
    },
  };
}

export const SYSTEM_IMAGES: Record<string, Tag> = {
  'docker.io/rancher/mirrored-coredns-coredns:1.12.0': { app: 'coredns', size: 21_000_000 },
  'docker.io/rancher/local-path-provisioner:v0.0.30': { app: 'local-path-provisioner', size: 20_000_000 },
  'docker.io/rancher/mirrored-metrics-server:v0.7.2': { app: 'metrics-server', size: 19_000_000 },
  'docker.io/rancher/mirrored-library-traefik:2.11.18': { app: 'traefik', size: 47_000_000 },
  'docker.io/rancher/klipper-lb:v0.4.9': { app: 'klipper-lb', size: 5_000_000 },
  'docker.io/rancher/klipper-helm:v0.9.3-build20241008': { app: 'klipper-helm', size: 60_000_000 },
};

export interface ClusterOptions {
  node: K8sNode;
  registry: Record<string, Repo>;
  apps: Record<string, K8sApp>;
  publicNames: Record<string, string>;
  outside: Record<string, string>;
}

/** A fresh k3s cluster's state (the system objects are added by bootstrap()). */
export function newK8s(o: ClusterOptions): K8s {
  const registry: Record<string, Repo> = { ...o.registry };
  for (const [ref, tag] of Object.entries(SYSTEM_IMAGES)) {
    const { repo, tag: t } = splitRef(ref);
    registry[repo] ??= { tags: {} };
    registry[repo].tags[t] = tag;
  }
  return { now: o.node.created, node: o.node, objects: [], events: [], images: Object.keys(SYSTEM_IMAGES), registry, apps: { ...systemApps(), ...o.apps, 'klipper-lb': sysApp([], [], 1), 'klipper-helm': sysApp([], [], 1) }, publicNames: o.publicNames, outside: o.outside, seq: 0, rv: 400, ipNext: 2, rr: 0, journal: [] };
}

const deployment = (name: string, image: string, labels: Record<string, string>, extra: J = {}) => ({
  spec: {
    replicas: 1,
    selector: { matchLabels: labels },
    template: { metadata: { labels }, spec: { containers: [{ name, image, ...extra }], priorityClassName: 'system-cluster-critical' } },
  },
});

/** The cluster as k3s installs it: namespaces, kube-system's Deployments and Services, the traefik IngressClass. */
export function bootstrap(k: K8s) {
  const at = k.node.created;
  k.now = at;
  for (const n of ['default', 'kube-system', 'kube-public', 'kube-node-lease'])
    create(k, 'Namespace', undefined, withDefaults(k, 'Namespace', '', n, {}), { name: n, labels: { 'kubernetes.io/metadata.name': n } });
  create(k, 'Node', undefined, { spec: { podCIDR: '10.42.0.0/24', podCIDRs: ['10.42.0.0/24'], providerID: `k3s://${k.node.name}` } }, { name: k.node.name, labels: { 'kubernetes.io/hostname': k.node.name, 'kubernetes.io/os': 'linux', 'kubernetes.io/arch': 'amd64', 'node-role.kubernetes.io/control-plane': 'true', 'node-role.kubernetes.io/master': 'true', 'node.kubernetes.io/instance-type': 'k3s' } });
  create(k, 'IngressClass', undefined, { spec: { controller: 'traefik.io/ingress-controller' } }, { name: 'traefik', annotations: { 'ingressclass.kubernetes.io/is-default-class': 'true' } });
  const svc = (namespace: string, name: string, spec: J, labels: Record<string, string> = {}) => create(k, 'Service', namespace, withDefaults(k, 'Service', namespace, name, { spec }), { name, labels });
  const kubernetes = svc('default', 'kubernetes', { ports: [{ name: 'https', port: 443, targetPort: 6443 }], clusterIP: '10.43.0.1' }, { component: 'apiserver', provider: 'kubernetes' });
  void kubernetes;
  const dep = (name: string, image: string, labels: Record<string, string>, extra: J = {}) => {
    const b = deployment(name, image, labels, extra);
    create(k, 'Deployment', 'kube-system', withDefaults(k, 'Deployment', 'kube-system', name, b), { name, labels: { 'k8s-app': name } });
  };
  dep('coredns', 'rancher/mirrored-coredns-coredns:1.12.0', { 'k8s-app': 'kube-dns' }, { resources: { limits: { memory: '170Mi' }, requests: { cpu: '100m', memory: '70Mi' } }, ports: [{ containerPort: 53, name: 'dns', protocol: 'UDP' }, { containerPort: 53, name: 'dns-tcp' }, { containerPort: 9153, name: 'metrics' }] });
  dep('local-path-provisioner', 'rancher/local-path-provisioner:v0.0.30', { app: 'local-path-provisioner' });
  dep('metrics-server', 'rancher/mirrored-metrics-server:v0.7.2', { 'k8s-app': 'metrics-server' }, { resources: { requests: { cpu: '100m', memory: '70Mi' } }, ports: [{ containerPort: 10250, name: 'https' }] });
  dep('traefik', 'rancher/mirrored-library-traefik:2.11.18', { 'app.kubernetes.io/instance': 'traefik-kube-system', 'app.kubernetes.io/name': 'traefik' }, { ports: [{ containerPort: 9100, name: 'metrics' }, { containerPort: 9000, name: 'traefik' }, { containerPort: 8000, name: 'web' }, { containerPort: 8443, name: 'websecure' }], readinessProbe: { httpGet: { path: '/ping', port: 9000 }, initialDelaySeconds: 2, periodSeconds: 10 } });
  svc('kube-system', 'kube-dns', { selector: { 'k8s-app': 'kube-dns' }, clusterIP: '10.43.0.10', ports: [{ name: 'dns', port: 53, protocol: 'UDP', targetPort: 53 }, { name: 'dns-tcp', port: 53, targetPort: 53 }, { name: 'metrics', port: 9153, targetPort: 9153 }] }, { 'k8s-app': 'kube-dns', 'kubernetes.io/name': 'CoreDNS' });
  svc('kube-system', 'metrics-server', { selector: { 'k8s-app': 'metrics-server' }, ports: [{ name: 'https', port: 443, targetPort: 'https' }] }, { 'k8s-app': 'metrics-server' });
  svc('kube-system', 'traefik', { type: 'LoadBalancer', selector: { 'app.kubernetes.io/instance': 'traefik-kube-system', 'app.kubernetes.io/name': 'traefik' }, ports: [{ name: 'web', port: 80, targetPort: 'web' }, { name: 'websecure', port: 443, targetPort: 'websecure' }] }, { 'app.kubernetes.io/name': 'traefik' });
  for (const cm of ['default', 'kube-system']) create(k, 'ConfigMap', cm, { data: { 'ca.crt': '-----BEGIN CERTIFICATE-----\nMIIBdzCCAR2gAwIBAgIBADAKBggqhkjOPQQDAjAjMSEwHwYDVQQDDBhrM3Mtc2Vy\n-----END CERTIFICATE-----\n' } }, { name: 'kube-root-ca.crt' });
  // Pods of a DaemonSet (ServiceLB) and of the Helm install Jobs: shown, not modelled.
  const fixed = (name: string, image: string, status: 'Succeeded' | 'Running', owner: string) => {
    const p = create(k, 'Pod', 'kube-system', withDefaults(k, 'Pod', 'kube-system', name, { spec: { containers: [{ name: owner.startsWith('svclb') ? 'lb-tcp-80' : 'helm', image }], restartPolicy: status === 'Succeeded' ? 'OnFailure' : 'Always' } }), { name, labels: { app: owner } });
    p.metadata.owner = { kind: owner.startsWith('svclb') ? 'DaemonSet' : 'Job', name: owner, uid: uidFor(owner), apiVersion: owner.startsWith('svclb') ? 'apps/v1' : 'batch/v1' };
    p.pod!.scheduled = at;
    p.pod!.ip = `10.42.0.${k.ipNext++}`;
    p.pod!.started = at;
    if (status === 'Succeeded') {
      p.pod!.fixed = 'Succeeded';
      p.pod!.containers[0] = { ...newContainer('helm'), state: 'terminated', ran: true, terminated: { reason: 'Completed', exitCode: 0, started: at + 5000, finished: at + 31_000, id: identifier(name), logs: [] }, reason: 'Completed' };
    }
  };
  fixed(`helm-install-traefik-crd-${suffix('crd')}`, 'rancher/klipper-helm:v0.9.3-build20241008', 'Succeeded', 'helm-install-traefik-crd');
  fixed(`helm-install-traefik-${suffix('traefik')}`, 'rancher/klipper-helm:v0.9.3-build20241008', 'Succeeded', 'helm-install-traefik');
  const lb = create(k, 'Pod', 'kube-system', withDefaults(k, 'Pod', 'kube-system', 'svclb', { spec: { containers: [{ name: 'lb-tcp-80', image: 'rancher/klipper-lb:v0.4.9' }, { name: 'lb-tcp-443', image: 'rancher/klipper-lb:v0.4.9' }] } }), { name: `svclb-traefik-${suffix('svclb').slice(0, 8)}-${suffix('svclb-pod')}`, labels: { app: 'svclb-traefik', 'svccontroller.k3s.cattle.io/svcname': 'traefik' } });
  lb.metadata.owner = { kind: 'DaemonSet', name: 'svclb-traefik', uid: uidFor('svclb-traefik'), apiVersion: 'apps/v1' };
}

/** The node's usage (kubectl top node): the pods' plus the system's. */
export function nodeUsage(k: K8s): { cpu: number; memory: number } {
  let cpu = 85;
  let memory = 980 * 1024 ** 2;
  for (const p of k.objects.filter((o) => o.kind === 'Pod' && o.pod?.ip)) {
    const u = podUsage(k, p);
    cpu += u.cpu;
    memory += u.memory;
  }
  return { cpu, memory };
}

/** A pod's usage (kubectl top pod), container by container. */
export function podUsage(k: K8s, p: Obj): { cpu: number; memory: number; containers: { name: string; cpu: number; memory: number }[] } {
  const containers = containerSpecs(p).map((c, i) => {
    const cr = p.pod?.containers[i];
    const app = appFor(k, c.image);
    if (!cr?.run || cr.state !== 'running') return { name: c.name, cpu: 0, memory: 0 };
    return { name: c.name, cpu: Math.max(1, Math.round(app?.cpu?.(cr.run, k.now, k) ?? 1)), memory: app?.memory?.(cr.run, k.now, k) ?? 12 * 1024 ** 2 };
  });
  return { cpu: containers.reduce((s, c) => s + c.cpu, 0), memory: containers.reduce((s, c) => s + c.memory, 0), containers };
}

// ——— kubectl apply: what changes ———

const LAST = 'kubectl.kubernetes.io/last-applied-configuration';

function mergeInto(live: J, config: J, last: J): J {
  if (!live || typeof live !== 'object' || Array.isArray(live) || !config || typeof config !== 'object' || Array.isArray(config)) return clone(config);
  const out = clone(live);
  for (const [key, v] of Object.entries(config)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && out[key] && typeof out[key] === 'object' && !Array.isArray(out[key])) out[key] = mergeInto(out[key], v, last?.[key]);
    else out[key] = clone(v);
  }
  if (last && typeof last === 'object') for (const key of Object.keys(last)) if (!(key in config)) delete out[key];
  return out;
}

const bodyOf = (doc: J) => {
  const b = clone(doc);
  delete b.apiVersion;
  delete b.kind;
  delete b.metadata;
  delete b.status;
  return b;
};

export interface Plan {
  kind: string;
  name: string;
  namespace: string;
  action: 'created' | 'configured' | 'unchanged';
  body: J;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  live?: Obj;
  problems: string[];
}

/** What kubectl apply would do with a decoded document, in a namespace. */
export function plan(k: K8s, doc: J, namespace: string): Plan {
  const kind = doc.kind;
  const kd = kindOf(kind);
  const name = doc.metadata?.name ?? '';
  const live = find(k, kind, namespace, name);
  const config = clone(doc);
  if (kd.namespaced) config.metadata = { ...config.metadata, namespace };
  const annotation = JSON.stringify(JSON.parse(stable(config))) + '\n';
  const last = live?.metadata.annotations[LAST] ? JSON.parse(live.metadata.annotations[LAST]) : null;
  const liveBody = live ? clone(live.body) : {};
  const body = withDefaults(k, kind, namespace, name, live ? mergeInto(liveBody, bodyOf(config), last ? bodyOf(last) : null) : bodyOf(config), live);
  const labels = live ? mergeInto(live.metadata.labels, config.metadata?.labels ?? {}, last?.metadata?.labels ?? null) : { ...(config.metadata?.labels ?? {}) };
  const annotations = { ...(live ? mergeInto(live.metadata.annotations, config.metadata?.annotations ?? {}, last?.metadata?.annotations ?? null) : (config.metadata?.annotations ?? {})), [LAST]: annotation };
  const problems = validate(kind, { metadata: config.metadata, ...body }, live);
  if (kind === 'Pod' && live && !same(withoutImages(live.body.spec), withoutImages(body.spec)))
    problems.push('spec: Forbidden: pod updates may not change fields other than `spec.containers[*].image`,`spec.initContainers[*].image`,`spec.activeDeadlineSeconds`,`spec.tolerations` (only additions to existing tolerations),`spec.terminationGracePeriodSeconds` (allow it to be set to 1 if it was previously negative)');
  const action = !live ? 'created' : same(live.body, body) && same(live.metadata.labels, labels) && same(live.metadata.annotations, annotations) ? 'unchanged' : 'configured';
  return { kind, name, namespace, action, body, labels, annotations, live, problems };
}
const withoutImages = (spec: J) => {
  const s = clone(spec ?? {});
  for (const c of s.containers ?? []) delete c.image;
  delete s.activeDeadlineSeconds;
  delete s.tolerations;
  delete s.terminationGracePeriodSeconds;
  return s;
};

/** Carries out a plan (already checked). */
export function carryOut(k: K8s, p: Plan): Obj {
  if (!p.live) {
    const o = create(k, p.kind, p.namespace, p.body, { name: p.name, labels: p.labels, annotations: p.annotations });
    if (p.kind === 'Namespace') o.metadata.labels['kubernetes.io/metadata.name'] = p.name;
    return o;
  }
  update(k, p.live, p.body, p.labels, p.annotations);
  return p.live;
}

/** Changes a live object (apply, edit, set, scale…): generation and resource version move on. */
export function update(k: K8s, o: Obj, body: J, labels = o.metadata.labels, annotations = o.metadata.annotations) {
  const specChanged = !same(o.body.spec, body.spec);
  const templateChanged = o.kind === 'Deployment' && !same(o.body.spec?.template, body.spec?.template);
  const images = containerSpecs(o).map((c) => c.image);
  o.body = clone(body);
  o.metadata.labels = { ...labels };
  o.metadata.annotations = { ...annotations };
  o.metadata.rv = ++k.rv;
  if (specChanged) o.metadata.generation++;
  if (templateChanged && o.deploy) {
    o.deploy.progressAt = k.now;
    o.deploy.reason = 'ReplicaSetUpdated';
  }
  // A pod's image changed: the kubelet stops the container and starts it again with the new one.
  if (o.kind === 'Pod' && o.pod)
    containerSpecs(o).forEach((c, i) => {
      const cr = o.pod!.containers[i];
      if (!cr || c.image === images[i]) return;
      if (cr.state === 'running') {
        record(k, o, 'Normal', 'Killing', `Container ${cr.name} definition changed, will be restarted`);
        terminate(k, o, cr, 'Error', 137);
      }
      cr.step = 'image';
      cr.nextAt = 0;
      cr.pullBackoff = 0;
      cr.backoff = 0;
    });
}

/** Would kubectl apply -f change anything for these documents? (the files on disk are what runs). */
export function inSync(k: K8s, text: string, file: string, namespace: string): boolean {
  const docs = readManifests(text, file);
  if ('error' in docs) return false;
  return docs.every(({ doc }) => {
    const d = decode(doc, file);
    if ('error' in d) return false;
    const p = plan(k, d.obj, d.obj.metadata?.namespace ?? namespace);
    return p.action === 'unchanged' && !p.problems.length;
  });
}
