// Story "The Pool": what its chapters share. The town's swimming pool
// (Riverside Pool) moved its booking app (lane lessons, swimming courses)
// to a single-node k3s cluster on lane (couloir in French, 192.0.2.62), a
// Debian server, a month ago. Rui, the developer who set it up, writes the
// manifests in ~/manifests (namespace swim: Deployment booking, ConfigMap
// booking-config, then a Service and an Ingress); Folake runs the pool's
// office; Kemal works at the town's IT. The app's images come from the
// town's registry, registry.pool.example (2.2.0, 2.3.0, 2.3.1); the
// database lives outside the cluster, on db.pool.internal.
// The cluster is k8s.ts's (state.k8s): kube-system as k3s installs it,
// then what the story applied before the chapter starts, replayed second by
// second; each command, ten seconds pass (sleep, kubectl rollout status and
// kubectl get -w let more pass).
// Addresses: RFC 5737 (192.0.2.62); public names in .example, internal ones
// in .internal.
// Sources: https://docs.k3s.io/, https://kubernetes.io/docs/concepts/.

import { accountsFiles, d, f, type Accounts, type Directory, type Node, type Rights } from '../world';
import { machineName } from '../machines';
import type { Game, Shell } from '../shell';
import type { Translate } from '../../texts';
import { newSystemd, systemd, type DefinitionService } from '../systemd';
import type { Listening } from '../commands/ss';
import type { Process } from '../commands/system';
import { advance, bootstrap, remove, carryOut, decode, find, inSync, k8s, list, newK8s, plan, readManifests, request, tick, deploymentCounts, containerConfig, type AppRun, type K8s, type K8sApp, type Obj, type Repo } from '../k8s';
import type { MetricsNet, Reply } from '../prometheus';

export const HOME = '/home/you';
export const PASSWORD = 'splash-2029';
export const LANE = '192.0.2.62';
export const NAMESPACE = 'swim';
export const SITE = 'booking.pool.example';
export const REGISTRY = 'registry.pool.example';
export const IMAGE = `${REGISTRY}/booking`;
export const DB_HOST = 'db.pool.internal';

// k3s installed on 2 May 2029; chapter 1: Monday 4 June, 8:40; chapter 2: Monday 11 June, 8:50.
const INSTALLED = Date.UTC(2029, 4, 2, 10, 0, 0);
export const NOW_1 = Date.UTC(2029, 5, 4, 8, 40, 0);
export const NOW_2 = Date.UTC(2029, 5, 11, 8, 50, 0);
const BOOT = Date.UTC(2029, 4, 28, 6, 3, 0);
const GiB = 1024 ** 3;
const MiB = 1024 ** 2;

export type ChapterNo = 1 | 2;

export const laneAccounts = (): Accounts => ({
  users: {
    root: { uid: 0, group: 'root', home: '/root' },
    you: { uid: 1000, group: 'you' },
    rui: { uid: 1001, group: 'rui' },
  },
  groups: {
    root: { gid: 0, members: [] },
    adm: { gid: 4, members: ['you'] },
    sudo: { gid: 27, members: ['you', 'rui'] },
    you: { gid: 1000, members: [] },
    rui: { gid: 1001, members: [] },
  },
});

// ——— Helpers ———

const principal = (j: Game): Shell => (j as Shell).principal;
export const cluster = (j: Game): K8s => k8s(j)!;
export const sd = (j: Game) => systemd(principal(j))!;
/** What the machine last printed. */
export function seen(j: Game, text: string | RegExp): boolean {
  const s = principal(j);
  const all = `${s.last.output}\n${s.last.errors.join('\n')}`;
  return typeof text === 'string' ? all.includes(text) : text.test(all);
}
export const deployment = (j: Game) => find(cluster(j), 'Deployment', NAMESPACE, 'booking');
export const container = (j: Game) => deployment(j)?.body.spec?.template?.spec?.containers?.[0];
/** The booking Deployment has finished rolling out: every replica updated and available. */
export function rolledOut(j: Game): boolean {
  const d = deployment(j);
  if (!d) return false;
  const c = deploymentCounts(cluster(j), d);
  return c.want > 0 && c.updated === c.want && c.replicas === c.want && c.available === c.want;
}
/** The environment the Deployment's template gives its container (null: it can't start). */
export function templateEnv(j: Game): Record<string, string> | null {
  const d = deployment(j);
  const c = container(j);
  if (!d || !c) return null;
  const fake = { kind: 'Pod', apiVersion: 'v1', metadata: { ...d.metadata, namespace: NAMESPACE }, body: { spec: d.body.spec.template.spec }, pod: { ip: '10.42.0.250', scheduled: 1, started: 1, containers: [], readyAt: 0 } } as unknown as Obj;
  const r = containerConfig(cluster(j), fake, c);
  return 'error' in r ? null : r.env;
}
/** The manifests in ~/manifests are what runs (kubectl apply would change nothing). */
export function filesInSync(j: Game, files: string[]): boolean {
  const s = principal(j);
  return files.every((name) => {
    const text = s.read(`${s.home}/manifests/${name}`);
    return text !== null && inSync(cluster(j), text, name, NAMESPACE);
  });
}
/** Pods of the namespace no controller manages (kubectl run). */
export const lonePods = (j: Game) => list(cluster(j), 'Pod', NAMESPACE).filter((p) => !p.metadata.owner);
export const journal = (j: Game, what: string) => cluster(j).journal.filter((x) => x.what === what);
/** What a visitor gets at http://booking.pool.example/ (Traefik on lane). */
export function site(j: Game): number {
  const r = request(cluster(j), LANE, 80, { method: 'GET', path: '/', headers: { host: SITE }, query: {} });
  return r.kind === 'http' ? r.code : 0;
}

// ——— The booking app ———

/** The booking app of each release: 2.2 reads DB_HOST; 2.3 reads DATABASE_HOST, and answers /health. */
export function bookingApp(t: Translate, version: string): K8sApp {
  const v23 = version.startsWith('2.3');
  const files: Record<string, string> = {
    '/app/package.json': `{\n  "name": "booking",\n  "version": "${version}",\n  "main": "server.js",\n  "scripts": { "start": "node server.js" }\n}`,
    '/app/server.js': `const config = require('./config');\nconst app = require('./app');\napp.listen(8080);`,
    '/app/config.js': v23
      ? `// ${version}: settings come from DATABASE_HOST (DB_HOST is no longer read)\nconst host = process.env.DATABASE_HOST;\nif (!host) throw new Error('DATABASE_HOST is not set');`
      : `const host = process.env.DB_HOST;\nif (!host) throw new Error('DB_HOST is not set');`,
  };
  return {
    ports: [8080],
    files,
    workdir: '/app',
    user: 'node',
    start(run: AppRun, k: K8s) {
      const head = [`> booking@${version} start`, '> node server.js', ''];
      const crash = (lines: string[]) => ({ logs: head, exit: { after: 1, code: 1, logs: lines } });
      const host = v23 ? run.env.DATABASE_HOST : run.env.DB_HOST;
      if (!host) {
        const name = v23 ? 'DATABASE_HOST' : 'DB_HOST';
        return crash([
          '/app/config.js:3',
          `if (!host) throw new Error('${name} is not set');`,
          '                 ^',
          '',
          `Error: ${name} is not set${v23 && run.env.DB_HOST ? ' (DB_HOST is no longer read since 2.3.0)' : ''}`,
          '    at Object.<anonymous> (/app/config.js:3:18)',
          '    at Module._compile (node:internal/modules/cjs/loader:1554:14)',
          '    at Object..js (node:internal/modules/cjs/loader:1706:10)',
          '    at Module.load (node:internal/modules/cjs/loader:1289:32)',
          '',
          'Node.js v22.14.0',
        ]);
      }
      if (!k.outside[host.toLowerCase()])
        return crash([`Error: getaddrinfo ENOTFOUND ${host}`, '    at GetAddrInfoReqWrap.onlookup [as oncomplete] (node:dns:120:26) {', '  errno: -3008,', "  code: 'ENOTFOUND',", "  syscall: 'getaddrinfo',", `  hostname: '${host}'`, '}', '', 'Node.js v22.14.0']);
      return { logs: [...head, `booking ${version}: connected to postgres://${host}:5432/booking`, `booking ${version}: listening on :8080`] };
    },
    http(run, req) {
      const path = req.path.replace(/\/+$/, '') || '/';
      if (path === '/') return { code: 200, body: t('pool-booking-home', { version }), type: 'text/html; charset=utf-8' };
      if (v23 && path === '/health') return { code: 200, body: '{"status":"ok"}', type: 'application/json; charset=utf-8' };
      return { code: 404, body: `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>Error</title>\n</head>\n<body>\n<pre>Cannot ${req.method} ${req.path}</pre>\n</body>\n</html>`, type: 'text/html; charset=utf-8' };
    },
    memory: (run, at) => (58 + Math.min(6, Math.floor((at - run.started) / 600_000))) * MiB,
    cpu: () => 4,
  };
}

/** busybox and nginx, for whoever tries kubectl run. */
const busybox: K8sApp = { ports: [], start: () => ({ logs: [], exit: { after: 0, code: 0, logs: [] } }), files: { '/bin/busybox': '' } };
const nginx: K8sApp = {
  ports: [80],
  start: () => ({ logs: ['/docker-entrypoint.sh: Configuration complete; ready for start up', '2029/06/04 08:40:00 [notice] 1#1: nginx/1.27.3'] }),
  http: () => ({ code: 200, body: '<!DOCTYPE html>\n<html>\n<head>\n<title>Welcome to nginx!</title>\n</head>\n<body>\n<h1>Welcome to nginx!</h1>\n</body>\n</html>', type: 'text/html' }),
  memory: () => 9 * MiB,
};

export const REPOS: Record<string, Repo> = {
  [IMAGE]: { tags: { '2.2.0': { app: 'booking-2.2.0', size: 61_204_812 }, '2.3.0': { app: 'booking-2.3.0', size: 62_118_406 }, '2.3.1': { app: 'booking-2.3.1', size: 62_140_993 } } },
  'docker.io/library/busybox': { tags: { latest: { app: 'busybox', size: 2_160_000 }, '1.36': { app: 'busybox', size: 2_160_000 } } },
  'docker.io/library/nginx': { tags: { latest: { app: 'nginx', size: 72_100_000 }, '1.27': { app: 'nginx', size: 72_100_000 } } },
};

// ——— The manifests ———

const deploymentYaml = (t: Translate, version: string, env: 'DB_HOST' | 'DATABASE_HOST', probe: string | null) => `# ${t('pool-manifest-booking-comment')}
apiVersion: apps/v1
kind: Deployment
metadata:
  name: booking
  namespace: swim
  labels:
    app: booking
spec:
  replicas: 2
  minReadySeconds: 10
  selector:
    matchLabels:
      app: booking
  template:
    metadata:
      labels:
        app: booking
    spec:
      containers:
        - name: booking
          image: ${IMAGE}:${version}
          ports:
            - containerPort: 8080
          env:
            - name: ${env}
              valueFrom:
                configMapKeyRef:
                  name: booking-config
                  key: database_host${
                    probe
                      ? `
          readinessProbe:
            httpGet:
              path: ${probe}
              port: 8080
            periodSeconds: 10`
                      : ''
                  }
`;

const configYaml = (t: Translate) => `# ${t('pool-manifest-config-comment')}
apiVersion: v1
kind: ConfigMap
metadata:
  name: booking-config
  namespace: swim
data:
  database_host: ${DB_HOST}
  opening_hours: "07:00-21:00"
`;

const namespaceYaml = `apiVersion: v1
kind: Namespace
metadata:
  name: swim
`;

const serviceYaml = (t: Translate) => `# ${t('pool-manifest-service-comment')}
apiVersion: v1
kind: Service
metadata:
  name: booking
  namespace: swim
  labels:
    app: booking
spec:
  selector:
    app: booking-web
  ports:
    - port: 80
      targetPort: 8080
`;

const ingressYaml = (t: Translate) => `# ${t('pool-manifest-ingress-comment')}
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: booking
  namespace: swim
spec:
  ingressClassName: traefik
  rules:
    - host: ${SITE}
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: booking
                port:
                  number: 8080
`;

/** The manifests in ~/manifests at the start of a chapter. */
export function manifests(t: Translate, chapter: ChapterNo): Record<string, string> {
  if (chapter === 1) return { 'namespace.yaml': namespaceYaml, 'config.yaml': configYaml(t), 'booking.yaml': deploymentYaml(t, '2.31', 'DB_HOST', null) };
  return { 'namespace.yaml': namespaceYaml, 'config.yaml': configYaml(t), 'booking.yaml': deploymentYaml(t, '2.3.1', 'DATABASE_HOST', '/healthz'), 'service.yaml': serviceYaml(t), 'ingress.yaml': ingressYaml(t) };
}

/** kubectl apply -f, as Rui or Kemal typed it before the chapter. */
function applyText(k: K8s, text: string) {
  const docs = readManifests(text, 'manifest.yaml');
  if ('error' in docs) throw new Error(docs.error);
  for (const { doc } of docs) {
    const dd = decode(doc, 'manifest.yaml');
    if ('error' in dd) throw new Error(dd.error);
    const p = plan(k, dd.obj, dd.obj.metadata?.namespace ?? 'default');
    if (p.problems.length) throw new Error(p.problems.join('\n'));
    carryOut(k, p);
  }
}
const live = (k: K8s, seconds: number) => {
  for (let i = 0; i < seconds; i++) {
    k.now += 1000;
    tick(k);
  }
};

// ——— lane ———

const proc = (pid: number, user: string, command: string): Process => ({ pid, user, cpu: 0.4, mem: 1.2, command });

function laneServices(): Record<string, DefinitionService> {
  return {
    ssh: { description: 'OpenBSD Secure Shell server', active: true, executable: 'sshd', process: [proc(602, 'root', 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups')] },
    k3s: { description: 'Lightweight Kubernetes', active: true, executable: 'k3s', process: [proc(914, 'root', '/usr/local/bin/k3s server'), proc(1022, 'root', 'containerd')], unitFile: '/etc/systemd/system/k3s.service' },
  };
}

const LISTENING: Listening[] = [
  { proto: 'tcp', address: '0.0.0.0', port: 22, process: 'sshd', pid: 602 },
  { proto: 'tcp', address: '*', port: 6443, process: 'k3s-server', pid: 914 },
  { proto: 'tcp', address: '*', port: 10250, process: 'k3s-server', pid: 914 },
  { proto: 'tcp', address: '127.0.0.1', port: 10248, process: 'k3s-server', pid: 914 },
  { proto: 'tcp', address: '127.0.0.1', port: 10010, process: 'containerd', pid: 1022 },
];

/** curl on lane: Traefik on 80 and 443, NodePorts, ClusterIPs, pod addresses. */
const NET: MetricsNet = {
  addressOf: () => LANE,
  resolve(from, name) {
    const n = name.toLowerCase();
    if (['localhost', '127.0.0.1', '::1'].includes(n)) return '127.0.0.1';
    const k = k8s(from);
    const self = machineName(from.t, 'lane');
    if (n === self || n === `${self}.internal`) return LANE;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(n)) return n;
    return k?.publicNames[n] ?? k?.outside[n] ?? null;
  },
  request(from, address, port, method, path, query, _body, headers): Reply {
    const k = k8s(from);
    if (!k) return { kind: 'refused' };
    const r = request(k, address, port, { method, path, query, headers: headers ?? {} });
    return r.kind === 'http' ? { kind: 'http', code: r.code, body: r.body, type: r.type } : r;
  },
};

/** lane's state at the start of a chapter. */
export function laneState(t: Translate, chapter: ChapterNo) {
  const at = chapter === 1 ? NOW_1 : NOW_2;
  const services = laneServices();
  const k = newK8s({
    node: { name: machineName(t, 'lane'), ip: LANE, created: INSTALLED, cpu: 2000, memory: 3906 * MiB, kernel: '6.12.27-amd64', os: 'Debian GNU/Linux 13 (trixie)' },
    registry: REPOS,
    apps: { 'booking-2.2.0': bookingApp(t, '2.2.0'), 'booking-2.3.0': bookingApp(t, '2.3.0'), 'booking-2.3.1': bookingApp(t, '2.3.1'), busybox, nginx },
    publicNames: { [SITE]: LANE, [REGISTRY]: '203.0.113.88' },
    outside: { [DB_HOST]: '192.0.2.63' },
  });
  return {
    systemd: newSystemd(machineName(t, 'lane'), BOOT, at, services),
    process: Object.values(services).flatMap((s) => s.process ?? []),
    k8s: k,
    metricsNet: NET,
    metricsHere: true,
    listening: LISTENING,
    mounts: [{ path: '/', capacity: 40 * GiB, name: '/dev/vda1', system: 'ext4' }],
    chapter,
  };
}

/** The cluster's past: k3s installed, the app deployed, then what happened just before the chapter. */
export function initialiseLane(j: Game) {
  const s = j as Shell;
  const t = s.t;
  const k = cluster(j);
  const chapter = s.state.chapter as ChapterNo;
  const at = chapter === 1 ? NOW_1 : NOW_2;
  bootstrap(k);
  live(k, 40);
  // 14 May: Rui deploys 2.2.0.
  k.now = Date.UTC(2029, 4, 14, 16, 20, 0);
  applyText(k, namespaceYaml);
  applyText(k, configYaml(t));
  if (chapter === 1) {
    applyText(k, deploymentYaml(t, '2.2.0', 'DB_HOST', null));
    live(k, 60);
    // This morning, 8:15: Rui applies the new release before leaving for his train.
    k.now = at - 25 * 60_000;
    applyText(k, deploymentYaml(t, '2.31', 'DB_HOST', null));
    live(k, 25 * 60);
  } else {
    applyText(k, deploymentYaml(t, '2.3.1', 'DATABASE_HOST', null));
    live(k, 60);
    // Friday 8 June, 17:30: Kemal removes the Deployment and applies his manifests (labels, probe, Service, Ingress).
    k.now = Date.UTC(2029, 5, 8, 17, 30, 0);
    remove(k, find(k, 'Deployment', NAMESPACE, 'booking')!);
    for (const text of [deploymentYaml(t, '2.3.1', 'DATABASE_HOST', '/healthz'), serviceYaml(t), ingressYaml(t)]) applyText(k, text);
    live(k, 120);
    k.now = at - 15 * 60_000;
    live(k, 15 * 60);
  }
  k.now = at;
  sd(j).clock = at;
  // The unit file is k3s's installer's, read at boot (no daemon-reload pending).
  sd(j).services.k3s.overridesFingerprint = `/etc/systemd/system/k3s.service\n${s.read('/etc/systemd/system/k3s.service') ?? ''}`;
}

/** Each command, ten seconds pass (sleep: more). */
export function passTime(j: Game) {
  const p = principal(j);
  const slept = (p.state.slept as number) ?? 0;
  p.state.slept = 0;
  const k = cluster(p);
  advance(p, Math.max(k.now, sd(p).clock) + 10_000 + Math.min(slept, 86_400_000));
}

// ——— The world ———

const KUBECONFIG = `apiVersion: v1
clusters:
- cluster:
    certificate-authority-data: LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0tCk1JSUJkekNDQVIyZ0F3SUJBZ0lCQURBS0JnZ3Foa2pPUFFRREFqQWpNU0V3SHdZRFZRUUREQmhyTTNNdGMyVnkKLS0tLS1FTkQgQ0VSVElGSUNBVEUtLS0tLQo=
    server: https://127.0.0.1:6443
  name: default
contexts:
- context:
    cluster: default
    user: default
  name: default
current-context: default
kind: Config
preferences: {}
users:
- name: default
  user:
    client-certificate-data: LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0tCk1JSUJrVENDQVRlZ0F3SUJBZ0lJWVhPN3d4ZmJ3bzB3Q2dZSUtvWkl6ajBFQXdJd0l6RWhNQjhHQTFVRUF3d1kKLS0tLS1FTkQgQ0VSVElGSUNBVEUtLS0tLQo=
    client-key-data: LS0tLS1CRUdJTiBFQyBQUklWQVRFIEtFWS0tLS0tCk1IY0NBUUVFSUpYdDBmM3I0bnFOT1dJd0x5YmhhWWtOR3JyN0RlMHo1YWtEZ1JuNmxOZm9vQW9HQ0NxR1NNNDkKLS0tLS1FTkQgRUMgUFJJVkFURSBLRVktLS0tLQo=`;

const HOSTS = (t: Translate) =>
  ['127.0.0.1\tlocalhost', `${LANE}\t${machineName(t, 'lane')}.internal ${machineName(t, 'lane')}`, '', '# The following lines are desirable for IPv6 capable hosts', '::1     localhost ip6-localhost ip6-loopback'].join('\n');

const K3S_UNIT = `[Unit]
Description=Lightweight Kubernetes
Documentation=https://k3s.io
Wants=network-online.target
After=network-online.target

[Install]
WantedBy=multi-user.target

[Service]
Type=notify
EnvironmentFile=-/etc/default/%N
EnvironmentFile=-/etc/sysconfig/%N
EnvironmentFile=-/etc/systemd/system/k3s.service.env
KillMode=process
Delegate=yes
LimitNOFILE=1048576
LimitNPROC=infinity
LimitCORE=infinity
TasksMax=infinity
TimeoutStartSec=0
Restart=always
RestartSec=5s
ExecStartPre=-/sbin/modprobe br_netfilter
ExecStartPre=-/sbin/modprobe overlay
ExecStart=/usr/local/bin/k3s server`;

/** lane's world: the system, k3s's files, and the home directory with the manifests. */
export function laneWorld(t: Translate, chapter: ChapterNo, home: Record<string, Node>): Directory {
  const root: Rights = { owner: 'root' };
  const place = (children: Parameters<typeof d>[0], rights: Rights = root) => d(children, undefined, rights);
  const file = (text: string, rights: Rights = root) => f(text, { lines: true, ...rights });
  const mine: Rights = { owner: 'you' };
  return place({
    etc: place({
      ...accountsFiles(),
      hostname: file(machineName(t, 'lane')),
      hosts: file(HOSTS(t)),
      'resolv.conf': file('search internal\nnameserver 192.0.2.1'),
      rancher: place({ k3s: place({ 'k3s.yaml': file(KUBECONFIG, { owner: 'root', mode: 'rw-------' }) }) }),
      systemd: place({ system: place({ 'k3s.service': file(K3S_UNIT) }) }),
    }),
    home: place({
      you: d(
        {
          ...home,
          manifests: d(Object.fromEntries(Object.entries(manifests(t, chapter)).map(([n, text]) => [n, f(text, { lines: true, ...mine })])), undefined, mine),
          '.kube': d({ config: f(KUBECONFIG, { lines: true, owner: 'you', mode: 'rw-------' }) }, undefined, { owner: 'you', mode: 'rwx------' }),
        },
        undefined,
        mine,
      ),
      rui: place({}, { owner: 'rui', mode: 'rwx------' }),
    }),
    root: place({}, { owner: 'root', mode: 'rwx------' }),
    tmp: place({}, { owner: 'root', mode: 'rwxrwxrwt' }),
    usr: place({ local: place({ bin: place({ k3s: f('', { size: 71_000_000, owner: 'root', mode: 'rwxr-xr-x' }), kubectl: f('', { link: '/usr/local/bin/k3s', owner: 'root' }) }) }) }),
    var: place({ lib: place({ rancher: place({ k3s: place({}, { owner: 'root', mode: 'rwx------' }) }) }) }),
  });
}
