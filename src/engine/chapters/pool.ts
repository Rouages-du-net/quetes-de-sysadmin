// Story "The Pool": what its chapters share. The town's swimming pool
// (Riverside Pool) moved its booking app (lane lessons, swimming courses)
// to a single-node k3s cluster on lane (couloir in French, 192.0.2.62), a
// Debian server, a month ago. Rui, the developer who set it up, writes the
// manifests in ~/manifests (namespace swim: Deployment booking, ConfigMap
// booking-config, then a Service and an Ingress); Folake runs the pool's
// office; Kemal works at the town's IT. The app's images come from the
// town's registry, registry.pool.example (2.2.0, 2.3.0, 2.3.1, 2.4.0); the
// database lives outside the cluster, on db.pool.internal: from 12 June
// it asks for a password (k.story.dbPassword), which 2.3 and later read
// from DATABASE_PASSWORD when they start. On the swim meet's Saturday
// (k.story.meet), the app's memory follows the load; 2.4.0's results
// cache never forgets (a leak).
// The cluster is k8s.ts's (state.k8s): kube-system as k3s installs it,
// then what the story applied before the chapter starts, replayed second by
// second; each command, ten seconds pass (sleep, kubectl rollout status and
// kubectl get -w let more pass).
// Addresses: RFC 5737 (192.0.2.62); public names in .example, internal ones
// in .internal.
// Sources: https://docs.k3s.io/, https://kubernetes.io/docs/concepts/.

import { accountsFiles, d, f, password, path, player, type Accounts, type Directory, type Node, type Rights } from '../world';
import { machineName } from '../machines';
import type { Game, Shell } from '../shell';
import type { Translate } from '../../texts';
import { newSystemd, systemd, type DefinitionService } from '../systemd';
import type { Listening } from '../commands/ss';
import type { Process } from '../commands/system';
import { newCommit, type Commit, type Repo as GitRepo } from '../commands/git';
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

// k3s installed on 2 May 2029; chapter 1: Monday 4 June, 8:40; chapter 2: Monday 11 June, 8:50;
// chapter 3: Monday 18 June, 9:10; chapter 4: Saturday 23 June (the swim meet), 9:20.
const INSTALLED = Date.UTC(2029, 4, 2, 10, 0, 0);
export const NOW_1 = Date.UTC(2029, 5, 4, 8, 40, 0);
export const NOW_2 = Date.UTC(2029, 5, 11, 8, 50, 0);
export const NOW_3 = Date.UTC(2029, 5, 18, 9, 10, 0);
export const NOW_4 = Date.UTC(2029, 5, 23, 9, 20, 0);
const NOW = [NOW_1, NOW_2, NOW_3, NOW_4];
/** The swim meet: Saturday 23 June, 8:00 to 13:00. */
export const MEET: [number, number] = [Date.UTC(2029, 5, 23, 8, 0, 0), Date.UTC(2029, 5, 23, 13, 0, 0)];
/** The most memory a 2.3.1 pod used at the last meet (kubectl top, Rui's note), in MiB. */
export const PEAK_MIB = 230;
/** The database's password until 18 June (in the ConfigMap, and in the repository's history). */
export const OLD_DB_PASSWORD = (t: Translate) => password(t, 'lane4-butterfly-17');
/** The one Kemal set on db.pool.internal on 18 June at 9:00 (in ~/new_db_password.txt). */
export const NEW_DB_PASSWORD = (t: Translate) => password(t, 'Tq8vR3mKx2Lw9pHz');
export const DB_USER = 'booking';
/** The shared repository Kemal pulls the manifests from. */
export const ORIGIN = '/srv/git/pool-manifests.git';
const BOOT = Date.UTC(2029, 4, 28, 6, 3, 0);
const GiB = 1024 ** 3;
const MiB = 1024 ** 2;

export type ChapterNo = 1 | 2 | 3 | 4;

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

/** Inside the swim meet's hours? */
const meeting = (k: K8s, at: number) => {
  const m = k.story?.meet as [number, number] | undefined;
  return !!m && at >= m[0] && at < m[1];
};

/**
 * The booking app of each release: 2.2 reads DB_HOST; 2.3 and later read
 * DATABASE_HOST (and DATABASE_PASSWORD once the database asks for one),
 * and answer /health. 2.4.0's results cache grows with every request and
 * is never emptied.
 */
export function bookingApp(t: Translate, version: string): K8sApp {
  const v23 = !version.startsWith('2.2');
  const leaky = version === '2.4.0';
  // The memory a container uses at a time (MiB): little at rest; under the meet's load, 190 to 230 (2.4.0: plus its cache).
  const mib = (run: AppRun, at: number, k: K8s) => {
    const meet = meeting(k, at);
    let m = meet ? 190 + ((Math.floor(at / 60_000) * 37) % 41) : 58 + Math.min(6, Math.floor((at - run.started) / 600_000));
    if (leaky) {
      const from = Math.max(run.started, (k.story?.meet as [number, number] | undefined)?.[0] ?? Infinity);
      m += Math.floor((at - run.started) / 3_600_000) + (meet && at > from ? Math.floor((at - from) / 10_000) * 3 : 0);
    }
    return m;
  };
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
      // The database asks for a password (from 12 June): node-postgres's errors.
      const wanted = k.story?.dbPassword as string | undefined;
      if (v23 && wanted !== undefined) {
        const given = run.env.DATABASE_PASSWORD;
        if (!given)
          return crash([`booking ${version}: connecting to postgres://${DB_USER}@${host}:5432/booking`, 'Error: SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string', '    at Client._handleAuthSASLContinue (/app/node_modules/pg/lib/client.js:259:18)', '', 'Node.js v22.14.0']);
        if (given !== wanted)
          return crash([
            `booking ${version}: connecting to postgres://${DB_USER}@${host}:5432/booking`,
            `error: password authentication failed for user "${DB_USER}"`,
            '    at Parser.parseErrorMessage (/app/node_modules/pg-protocol/dist/parser.js:283:98)',
            '    at Parser.handlePacket (/app/node_modules/pg-protocol/dist/parser.js:122:29)',
            '    at Socket.<anonymous> (/app/node_modules/pg-protocol/dist/index.js:11:42) {',
            "  severity: 'FATAL',",
            "  code: '28P01',",
            "  routine: 'auth_failed'",
            '}',
            '',
            'Node.js v22.14.0',
          ]);
      }
      return { logs: [...head, `booking ${version}: connected to postgres://${wanted !== undefined && v23 ? `${DB_USER}@` : ''}${host}:5432/booking`, `booking ${version}: listening on :8080`, ...(leaky ? [`booking ${version}: results cache enabled`] : [])] };
    },
    // 2.4.0 says how big its cache is, once a minute during the meet.
    tick(run, at, k) {
      if (!leaky || at % 60_000 !== 0 || !meeting(k, at)) return;
      const entries = Math.floor((at - Math.max(run.started, (k.story!.meet as [number, number])[0])) / 1000) * 37;
      return [`booking ${version}: results cache: ${entries} entries, heap used: ${mib(run, at, k)} MiB`];
    },
    http(run, req) {
      const path = req.path.replace(/\/+$/, '') || '/';
      if (path === '/') return { code: 200, body: t('pool-booking-home', { version }), type: 'text/html; charset=utf-8' };
      if (v23 && path === '/health') return { code: 200, body: '{"status":"ok"}', type: 'application/json; charset=utf-8' };
      return { code: 404, body: `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>Error</title>\n</head>\n<body>\n<pre>Cannot ${req.method} ${req.path}</pre>\n</body>\n</html>`, type: 'text/html; charset=utf-8' };
    },
    memory: (run, at, k) => mib(run, at, k) * MiB,
    cpu: (run, at, k) => (meeting(k, at) ? 140 : 4),
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
  [IMAGE]: { tags: { '2.2.0': { app: 'booking-2.2.0', size: 61_204_812 }, '2.3.0': { app: 'booking-2.3.0', size: 62_118_406 }, '2.3.1': { app: 'booking-2.3.1', size: 62_140_993 }, '2.4.0': { app: 'booking-2.4.0', size: 62_871_350 } } },
  'docker.io/library/busybox': { tags: { latest: { app: 'busybox', size: 2_160_000 }, '1.36': { app: 'busybox', size: 2_160_000 } } },
  'docker.io/library/nginx': { tags: { latest: { app: 'nginx', size: 72_100_000 }, '1.27': { app: 'nginx', size: 72_100_000 } } },
};

// ——— The manifests ———

interface Extra {
  // Where DATABASE_PASSWORD comes from.
  password?: 'configmap' | 'secret';
  resources?: { requests: string; limits: string };
  cause?: string;
}

const deploymentYaml = (t: Translate, version: string, env: 'DB_HOST' | 'DATABASE_HOST', probe: string | null, extra: Extra = {}) => `# ${t('pool-manifest-booking-comment')}
apiVersion: apps/v1
kind: Deployment
metadata:
  name: booking
  namespace: swim
  labels:
    app: booking${
      extra.cause
        ? `
  annotations:
    kubernetes.io/change-cause: "${extra.cause}"`
        : ''
    }
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
                    extra.password === 'configmap'
                      ? `
            - name: DATABASE_PASSWORD
              valueFrom:
                configMapKeyRef:
                  name: booking-config
                  key: database_password`
                      : extra.password === 'secret'
                        ? `
            - name: DATABASE_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: booking-db
                  key: password`
                        : ''
                  }${
                    probe
                      ? `
          readinessProbe:
            httpGet:
              path: ${probe}
              port: 8080
            periodSeconds: 10`
                      : ''
                  }${
                    extra.resources
                      ? `
          resources:
            requests:
              memory: ${extra.resources.requests}
            limits:
              memory: ${extra.resources.limits}`
                      : ''
                  }
`;

const configYaml = (t: Translate, dbPassword?: string) => `# ${t('pool-manifest-config-comment')}
apiVersion: v1
kind: ConfigMap
metadata:
  name: booking-config
  namespace: swim
data:
  database_host: ${DB_HOST}${dbPassword ? `\n  database_password: ${dbPassword}` : ''}
  opening_hours: "07:00-21:00"
`;

/** The Secret of chapter 4's past (a file nobody kept: kubectl create secret generic). */
const secretYaml = (pw: string) => `apiVersion: v1
kind: Secret
metadata:
  name: booking-db
  namespace: swim
type: Opaque
stringData:
  password: ${pw}
`;

const namespaceYaml = `apiVersion: v1
kind: Namespace
metadata:
  name: swim
`;

const serviceYaml = (t: Translate, fixed = false) => `# ${t('pool-manifest-service-comment')}
apiVersion: v1
kind: Service
metadata:
  name: booking
  namespace: swim
  labels:
    app: booking
spec:
  selector:
    app: ${fixed ? 'booking' : 'booking-web'}
  ports:
    - port: 80
      targetPort: 8080
`;

const ingressYaml = (t: Translate, fixed = false) => `# ${t('pool-manifest-ingress-comment')}
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
                  number: ${fixed ? 80 : 8080}
`;

/** Friday 22 June: Rui's 2.4.0, with limits copied from a tutorial. */
export const LEAKY_CAUSE = '2.4.0: results cache (faster timetable)';
const leakyDeployment = (t: Translate) => deploymentYaml(t, '2.4.0', 'DATABASE_HOST', '/health', { password: 'secret', resources: { requests: '64Mi', limits: '128Mi' }, cause: LEAKY_CAUSE });

/** The manifests in ~/manifests at the start of a chapter. */
export function manifests(t: Translate, chapter: ChapterNo): Record<string, string> {
  if (chapter === 1) return { 'namespace.yaml': namespaceYaml, 'config.yaml': configYaml(t), 'booking.yaml': deploymentYaml(t, '2.31', 'DB_HOST', null) };
  if (chapter === 2) return { 'namespace.yaml': namespaceYaml, 'config.yaml': configYaml(t), 'booking.yaml': deploymentYaml(t, '2.3.1', 'DATABASE_HOST', '/healthz'), 'service.yaml': serviceYaml(t), 'ingress.yaml': ingressYaml(t) };
  const fixed = { 'namespace.yaml': namespaceYaml, 'service.yaml': serviceYaml(t, true), 'ingress.yaml': ingressYaml(t, true) };
  if (chapter === 3) return { ...fixed, 'config.yaml': configYaml(t, OLD_DB_PASSWORD(t)), 'booking.yaml': deploymentYaml(t, '2.3.1', 'DATABASE_HOST', '/health', { password: 'configmap' }) };
  return { ...fixed, 'config.yaml': configYaml(t), 'booking.yaml': leakyDeployment(t) };
}

/** Chapter 3: the history of ~/manifests (shared with the town's IT through ORIGIN): the password came in on 12 June. */
export function manifestsHistory(t: Translate): Commit[] {
  // The files as the world keeps them (f(…, { lines: true }): no trailing newline).
  const trim = (files: Record<string, string>) => Object.fromEntries(Object.entries(files).map(([n, text]) => [n, text.replace(/^\n+|\s+$/g, '')]));
  const RUI = 'Rui Costa <rui@pool.example>';
  const KEMAL = 'Kemal Aydin <kemal@town.example>';
  const c1 = newCommit(null, t('pool-commit-1'), RUI, 'Mon May 14 18:12:40 2029 +0200', trim({ 'namespace.yaml': namespaceYaml, 'config.yaml': configYaml(t), 'booking.yaml': deploymentYaml(t, '2.2.0', 'DB_HOST', null) }));
  const c2 = newCommit(c1, t('pool-commit-2'), KEMAL, 'Mon Jun 11 09:31:05 2029 +0200', trim({
    'namespace.yaml': namespaceYaml,
    'config.yaml': configYaml(t),
    'booking.yaml': deploymentYaml(t, '2.3.1', 'DATABASE_HOST', '/health'),
    'service.yaml': serviceYaml(t, true),
    'ingress.yaml': ingressYaml(t, true),
  }));
  const c3 = newCommit(c2, t('pool-commit-3'), RUI, 'Tue Jun 12 20:04:51 2029 +0200', trim(manifests(t, 3)));
  return [c1, c2, c3];
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
  const at = NOW[chapter - 1];
  const services = laneServices();
  const k = newK8s({
    node: { name: machineName(t, 'lane'), ip: LANE, created: INSTALLED, cpu: 2000, memory: 3906 * MiB, kernel: '6.12.27-amd64', os: 'Debian GNU/Linux 13 (trixie)' },
    registry: REPOS,
    apps: { 'booking-2.2.0': bookingApp(t, '2.2.0'), 'booking-2.3.0': bookingApp(t, '2.3.0'), 'booking-2.3.1': bookingApp(t, '2.3.1'), 'booking-2.4.0': bookingApp(t, '2.4.0'), busybox, nginx },
    publicNames: { [SITE]: LANE, [REGISTRY]: '203.0.113.88' },
    outside: { [DB_HOST]: '192.0.2.63' },
  });
  k.story = chapter === 4 ? { meet: MEET } : {};
  // Chapter 3: ~/manifests is a git repository, pushed to the shared one.
  const repo = path(t, `${HOME}/manifests`);
  const history = chapter === 3 ? manifestsHistory(t) : [];
  const git: Record<string, GitRepo> | undefined =
    chapter === 3
      ? {
          [repo]: { commits: history, index: { ...history.at(-1)!.files }, remotes: { origin: ORIGIN } },
          [ORIGIN]: { commits: [...history], index: {}, bare: true },
        }
      : undefined;
  return {
    systemd: newSystemd(machineName(t, 'lane'), BOOT, at, services),
    process: Object.values(services).flatMap((s) => s.process ?? []),
    k8s: k,
    metricsNet: NET,
    metricsHere: true,
    listening: LISTENING,
    mounts: [{ path: '/', capacity: 40 * GiB, name: '/dev/vda1', system: 'ext4' }],
    chapter,
    ...(git ? { git, author: `${player(t)} <${player(t)}@pool.example>`, date: 'Mon Jun 18 09:10:00 2029 +0200' } : {}),
  };
}

/** The cluster's past: k3s installed, the app deployed, then what happened just before the chapter. */
export function initialiseLane(j: Game) {
  const s = j as Shell;
  const t = s.t;
  const k = cluster(j);
  const chapter = s.state.chapter as ChapterNo;
  const at = NOW[chapter - 1];
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
  } else if (chapter >= 3) {
    applyText(k, deploymentYaml(t, '2.3.1', 'DATABASE_HOST', null));
    live(k, 60);
    // Friday 8 June, then Monday 11 June: Kemal's manifests, fixed (The Front Desk).
    k.now = Date.UTC(2029, 5, 8, 17, 30, 0);
    remove(k, find(k, 'Deployment', NAMESPACE, 'booking')!);
    for (const text of [deploymentYaml(t, '2.3.1', 'DATABASE_HOST', '/health'), serviceYaml(t, true), ingressYaml(t, true)]) applyText(k, text);
    live(k, 120);
    // Tuesday 12 June, 18:00: the town's IT turns on the database's password; at 20:00, Rui puts it in the ConfigMap.
    k.story!.dbPassword = OLD_DB_PASSWORD(t);
    k.now = Date.UTC(2029, 5, 12, 18, 4, 0);
    applyText(k, configYaml(t, OLD_DB_PASSWORD(t)));
    applyText(k, deploymentYaml(t, '2.3.1', 'DATABASE_HOST', '/health', { password: 'configmap' }));
    live(k, 120);
    if (chapter === 3) {
      // Monday 18 June, 9:00: Kemal saw the password in the shared repository and changed it on the database.
      // The pods keep their open connections; a new start needs the new password.
      k.now = Date.UTC(2029, 5, 18, 9, 0, 0);
      k.story!.dbPassword = NEW_DB_PASSWORD(t);
      live(k, 10 * 60);
    } else {
      // Monday 18 June (The Locker Room): the password in a Secret, the ConfigMap without it.
      k.now = Date.UTC(2029, 5, 18, 9, 0, 0);
      k.story!.dbPassword = NEW_DB_PASSWORD(t);
      k.now = Date.UTC(2029, 5, 18, 9, 40, 0);
      applyText(k, secretYaml(NEW_DB_PASSWORD(t)));
      applyText(k, configYaml(t));
      applyText(k, deploymentYaml(t, '2.3.1', 'DATABASE_HOST', '/health', { password: 'secret' }));
      live(k, 120);
      // Friday 22 June, 18:10: Rui applies 2.4.0, with the limits of a tutorial.
      k.now = Date.UTC(2029, 5, 22, 18, 10, 0);
      applyText(k, leakyDeployment(t));
      live(k, 180);
      // Saturday: the meet starts at 8:00.
      k.now = MEET[0] - 60_000;
      live(k, (at - k.now) / 1000);
    }
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
          manifests: d(
            {
              ...(chapter === 3 ? { '.git': d({ HEAD: f('ref: refs/heads/main', { lines: true, ...mine }), config: f(`[core]\n\trepositoryformatversion = 0\n\tfilemode = true\n\tbare = false\n[remote "origin"]\n\turl = ${ORIGIN}\n\tfetch = +refs/heads/*:refs/remotes/origin/*`, { lines: true, ...mine }) }, undefined, mine) } : {}),
              ...Object.fromEntries(Object.entries(manifests(t, chapter)).map(([n, text]) => [n, f(text, { lines: true, ...mine })])),
            },
            undefined,
            mine,
          ),
          '.kube': d({ config: f(KUBECONFIG, { lines: true, owner: 'you', mode: 'rw-------' }) }, undefined, { owner: 'you', mode: 'rwx------' }),
        },
        undefined,
        mine,
      ),
      rui: place({}, { owner: 'rui', mode: 'rwx------' }),
    }),
    root: place({}, { owner: 'root', mode: 'rwx------' }),
    // The shared repository the town's IT pulls from (chapter 3).
    ...(chapter === 3
      ? {
          srv: place({
            git: place({
              'pool-manifests.git': d(
                { HEAD: f('ref: refs/heads/main', { lines: true, ...mine }), config: f('[core]\n\trepositoryformatversion = 0\n\tfilemode = true\n\tbare = true', { lines: true, ...mine }), hooks: d({}, undefined, mine), objects: d({}, undefined, mine), refs: d({ heads: d({}, undefined, mine) }, undefined, mine) },
                undefined,
                mine,
              ),
            }),
          }),
        }
      : {}),
    tmp: place({}, { owner: 'root', mode: 'rwxrwxrwt' }),
    usr: place({ local: place({ bin: place({ k3s: f('', { size: 71_000_000, owner: 'root', mode: 'rwxr-xr-x' }), kubectl: f('', { link: '/usr/local/bin/k3s', owner: 'root' }) }) }) }),
    var: place({ lib: place({ rancher: place({ k3s: place({}, { owner: 'root', mode: 'rwx------' }) }) }) }),
  });
}
