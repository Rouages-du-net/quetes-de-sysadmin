// The Pool: a single-node k3s cluster (k8s.ts) and kubectl. Replayed with
// the console, in every language; the expected texts are checked in
// French. Also: manifests as the API server reads them, kubectl's
// printers (Go's tabwriter, ages), the Deployment controller's rolling
// update, base64.

import { describe, expect, it } from 'vitest';
import { Console } from '../src/engine/console';
import { prerequisites } from '../src/engine/unlocking';
import { LANGUAGES, translator } from '../src/texts';
import { inLanguage, machinesInLanguage } from './names';
import { age, decode, readManifests, tabwrite, templateHash, toYaml, quantity, validate, normalise, newK8s, bootstrap, plan, carryOut, tick, list, podStatusText, type K8s } from '../src/engine/k8s';
import { Shell } from '../src/engine/shell';
import { STORIES } from '../src/engine/chapters';
import { COMMANDS } from '../src/engine/commands';

const MDP = 'splash-2029';

describe('k8s: manifests and printers', () => {
  it('reads manifests like the API server: strict fields, types, YAML errors with their line', () => {
    const docs = readManifests('apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: a\ndata:\n  x: "1"\n---\napiVersion: v1\nkind: Namespace\nmetadata:\n  name: b\n', 'f.yaml');
    expect(Array.isArray(docs) && docs.length).toBe(2);
    const bad = readManifests('apiVersion: v1\nkind: Pod\nmetadata:\n  name: a\n\tspec: {}\n', 'f.yaml');
    expect('error' in bad && bad.error).toMatch(/^error: error parsing f\.yaml: error converting YAML to JSON: yaml: line 5: /);
    const unknown = decode({ apiVersion: 'apps/v1', kind: 'Deployment', metadata: { name: 'a' }, spec: { template: { spec: { containers: [{ name: 'a', image: 'b', imagePullPolice: 'Always' }] } } } }, 'd.yaml');
    expect('error' in unknown && unknown.error).toBe('Error from server (BadRequest): error when creating "d.yaml": Deployment in version "v1" cannot be handled as a Deployment: strict decoding error: unknown field "spec.template.spec.containers[0].imagePullPolice"');
    const types = decode({ apiVersion: 'apps/v1', kind: 'Deployment', metadata: { name: 'a' }, spec: { replicas: 'two' } }, 'd.yaml');
    expect('error' in types && types.error).toContain('cannot unmarshal string into Go struct field spec.replicas of type int32');
    const ok = decode({ apiVersion: 'apps/v1', kind: 'Deployment', metadata: { name: 'a' }, spec: { replicas: '2' } }, 'd.yaml');
    expect('obj' in ok && ok.obj.spec.replicas).toBe(2);
    const old = decode({ apiVersion: 'extensions/v1beta1', kind: 'Ingress', metadata: { name: 'a' } }, 'i.yaml');
    expect('error' in old && old.error).toBe('error: resource mapping not found for name: "a" namespace: "" from "i.yaml": no matches for kind "Ingress" in version "extensions/v1beta1"\nensure CRDs are installed first');
    expect(validate('Deployment', { metadata: { name: 'a' }, spec: { selector: { matchLabels: { app: 'x' } }, template: { metadata: { labels: { app: 'y' } }, spec: { containers: [{ name: 'a', image: 'b' }] } } } }, undefined)).toEqual([
      'spec.template.metadata.labels: Invalid value: map[string]string{"app":"y"}: `selector` does not match template `labels`',
    ]);
    expect(validate('Ingress', { metadata: { name: 'a' }, spec: { rules: [{ http: { paths: [{ path: '/', backend: { service: { name: 's', port: { number: 80 } } } }] } }] } }, undefined)).toEqual(['spec.rules[0].http.paths[0].pathType: Required value: pathType must be specified']);
  });

  it("writes like kubectl: Go's tabwriter, ages, YAML, hashes, quantities, image references", () => {
    expect(tabwrite('NAME\tREADY\tAGE\nbooking-1\t1/1\t5m', 6, 3)).toBe('NAME        READY   AGE\nbooking-1   1/1     5m');
    expect([age(59_000), age(150_000), age(3_600_000 * 5 + 60_000 * 7), age(86_400_000 * 20)]).toEqual(['59s', '2m30s', '5h7m', '20d']);
    expect(toYaml({ b: { c: ['x', 'y'] }, a: '5', t: '2029-06-04T08:00:00Z', m: 'say "hi"', e: '' })).toBe('a: "5"\nb:\n  c:\n  - x\n  - "y"\ne: ""\nm: say "hi"\nt: "2029-06-04T08:00:00Z"');
    expect(templateHash({ spec: {} })).toMatch(/^[bcdfghjklmnpqrstvwxz2456789]{9,10}$/);
    expect([quantity('250m'), quantity('128Mi'), quantity('1Gi'), quantity('2'), quantity('12x')]).toEqual([0.25, 134217728, 1073741824, 2, null]);
    expect(normalise('nginx')).toBe('docker.io/library/nginx:latest');
    expect(normalise('registry.pool.example/booking:2.3.1')).toBe('registry.pool.example/booking:2.3.1');
  });

  it('the kubelet: OOMKilled (137) past the memory limit, a liveness probe that restarts, Pending without room', () => {
    const MiB = 1024 ** 2;
    const k: K8s = newK8s({
      node: { name: 'n', ip: '192.0.2.200', created: 0, cpu: 2000, memory: 2048 * MiB, kernel: 'k', os: 'o' },
      registry: { 'registry.example/leak': { tags: { '1': { app: 'leak', size: 1000 } } }, 'registry.example/sleepy': { tags: { '1': { app: 'sleepy', size: 1000 } } } },
      apps: {
        // 10 MiB more every second.
        leak: { ports: [8080], start: () => ({ logs: ['up'] }), memory: (run, t) => (20 + ((t - run.started) / 1000) * 10) * MiB },
        sleepy: { ports: [8080], start: () => ({ logs: ['up'] }), http: () => ({ code: 500, body: '' }) },
      },
      publicNames: {},
      outside: {},
    });
    bootstrap(k);
    const apply = (doc: object) => carryOut(k, plan(k, doc, 'default'));
    const dep = (name: string, image: string, extra: object) => ({ apiVersion: 'apps/v1', kind: 'Deployment', metadata: { name }, spec: { selector: { matchLabels: { app: name } }, template: { metadata: { labels: { app: name } }, spec: { containers: [{ name, image, ...extra }] } } } });
    apply(dep('leak', 'registry.example/leak:1', { resources: { limits: { memory: '128Mi' } } }));
    apply(dep('sleepy', 'registry.example/sleepy:1', { livenessProbe: { httpGet: { path: '/', port: 8080 }, periodSeconds: 5, failureThreshold: 2 } }));
    apply(dep('huge', 'registry.example/sleepy:1', { resources: { requests: { memory: '4Gi' } } }));
    for (let i = 0; i < 60; i++) {
      k.now += 1000;
      tick(k);
    }
    const pod = (app: string) => list(k, 'Pod', 'default').find((p) => p.metadata.labels.app === app)!;
    const leak = pod('leak').pod!.containers[0];
    expect(leak.last?.reason ?? leak.terminated?.reason).toBe('OOMKilled');
    expect(leak.last?.exitCode ?? leak.terminated?.exitCode).toBe(137);
    expect(leak.restarts).toBeGreaterThan(0);
    expect(k.events.some((e) => e.reason === 'Killing' && e.message === 'Container sleepy failed liveness probe, will be restarted')).toBe(true);
    expect(podStatusText(pod('huge'))).toBe('Pending');
    expect(k.events.some((e) => e.reason === 'FailedScheduling' && e.message.startsWith('0/1 nodes are available: 1 Insufficient memory.'))).toBe(true);
  });

  it('base64: encoding is not encryption', () => {
    const sh = new Shell(STORIES[0].chapters[0], 'en');
    const run = (args: string[], input: string | null) => COMMANDS.base64.launch({ args, input, game: sh, last: true });
    sh.commandLine = 'echo s3cret | base64';
    expect(run([], 's3cret')).toBe('czNjcmV0Cg==');
    sh.commandLine = 'echo -n s3cret | base64';
    expect(run([], 's3cret')).toBe('czNjcmV0');
    expect(run(['-d'], 'czNjcmV0')).toBe('s3cret');
  });
});

for (const language of LANGUAGES)
  describe(`The Pool — ${language}`, () => {
    const fr = language === 'fr';
    const t = translator(language);
    const L = (line: string) => inLanguage(t, line);
    const contains = (all: string, text: string) => fr && expect(all).toContain(text);
    const part = (finished: string[] = []) => {
      const c = new Console({ language, finished: [...prerequisites('pool'), ...finished] });
      const one = (l: string) => {
        let output = c.execute(machinesInLanguage(c.t, L(l))) ?? '';
        if (c.shell.waiting) output += '\n' + (c.execute(machinesInLanguage(c.t, MDP)) ?? '');
        return output;
      };
      const play = (lines: string[]) => lines.map(one).join('\n');
      const edit = (command: string, change: (text: string) => string) => {
        one(command);
        c.save(change(c.edition!.text));
        return c.quitEdition();
      };
      play(['ssh lane', 'yes']);
      const main = () => (c.shell as unknown as { principal: typeof c.shell }).principal ?? c.shell;
      const pods = (filter = '') => (c.execute('kubectl get pods -n swim -o name') ?? '').split('\n').filter((p) => p.includes(filter));
      // The pod whose line of kubectl get pods shows this state.
      const podIn = (state: RegExp) => {
        const line = (c.execute('kubectl get pods -n swim') ?? '').split('\n').find((l) => state.test(l));
        return line ? `pod/${line.split(/\s+/)[0]}` : '';
      };
      return { c, one, play, edit, pods, podIn, flag: (id: string) => main().flags.has(id), done: (id: string) => c.finished.includes(id) };
    };

    // ——— Chapter 1: "The Pod That Won't Start" ———

    const tag = (x: string) => x.replace('image: registry.pool.example/booking:2.31', 'image: registry.pool.example/booking:2.3.1');
    const env = (x: string) => x.replace('- name: DB_HOST', '- name: DATABASE_HOST');

    it("chapter 1 — solution: get, describe's Events, the tag, logs --previous, the variable, apply, rollout status", () => {
      const { play, edit, pods, podIn, flag, done } = part();
      let all = play(['kubectl get pods']);
      expect(all).toContain('No resources found in default namespace.');
      contains(all, "l'appli de réservation vit dans swim");
      all = play(['kubectl get pods -n swim']);
      expect(all).toMatch(/booking-\w+-\w{5} +0\/1 +ImagePullBackOff +0 +25m/);
      expect(all.match(/1\/1 +Running +0 +20d/g)).toHaveLength(2);
      expect(flag('pods')).toBe(true);
      all = play([`kubectl describe ${pods()[0]} -n swim`]);
      expect(all).toContain('rpc error: code = NotFound desc = failed to pull and unpack image "registry.pool.example/booking:2.31": failed to resolve reference "registry.pool.example/booking:2.31": registry.pool.example/booking:2.31: not found');
      expect(all).toMatch(/Warning +Failed +\S+ \(x\d+ over 25m\) +kubelet +Error: ImagePullBackOff/);
      expect(flag('pull-error')).toBe(true);
      all = play([`kubectl logs ${pods()[0]} -n swim`]);
      expect(all).toMatch(/Error from server \(BadRequest\): container "booking" in pod "booking-\w+-\w+" is waiting to start: trying and failing to pull image/);
      edit('nano manifests/booking.yaml', tag);
      all = play(['kubectl apply -f manifests/']);
      expect(all).toContain('deployment.apps/booking configured\nconfigmap/booking-config unchanged\nnamespace/swim unchanged');
      expect(flag('tag-fixed')).toBe(true);
      all = play(['kubectl get pods -n swim', 'sleep 20', 'kubectl get pods -n swim']);
      expect(all).toMatch(/CrashLoopBackOff +\d+ \(\d+s ago\)/);
      expect(flag('crash')).toBe(true);
      all = play([`kubectl logs ${podIn(/CrashLoopBackOff|Error/)} -n swim --previous`]);
      expect(all).toContain('Error: DATABASE_HOST is not set (DB_HOST is no longer read since 2.3.0)');
      expect(flag('logs')).toBe(true);
      contains(all, 'depuis la 2.3.0, elle lit DATABASE_HOST');
      edit('nano manifests/booking.yaml', env);
      all = play(['kubectl apply -f manifests/', 'kubectl rollout status deployment/booking -n swim']);
      expect(all).toContain('deployment "booking" successfully rolled out');
      expect(done('wont-start')).toBe(true);
      contains(all, 'Vous avez terminé Le Pod qui ne démarre pas');
      all = play(['kubectl apply -f manifests/', 'kubectl get pods -n swim']);
      expect(all).toContain('deployment.apps/booking unchanged');
      expect(all.match(/1\/1 +Running +0/g)).toHaveLength(2);
    });

    it('chapter 1 — another solution: the context namespace, kubectl edit on the Deployment, then the file brought in line', () => {
      const { play, edit, flag, done } = part();
      play(['kubectl config set-context --current --namespace=swim']);
      const out = edit('kubectl edit deployment booking', (x) => env(tag(x)));
      expect(out).toContain('deployment.apps/booking edited');
      play(['kubectl rollout status deploy/booking']);
      expect(flag('rolled-out')).toBe(true);
      expect(flag('drift')).toBe(true);
      expect(done('wont-start')).toBe(false);
      edit('nano manifests/booking.yaml', (x) => env(tag(x)));
      const all = play(['kubectl apply -f manifests/booking.yaml', 'kubectl get deploy']);
      expect(all).toContain('deployment.apps/booking configured');
      expect(all).toMatch(/booking +2\/2 +2 +2/);
      expect(done('wont-start')).toBe(true);
    });

    it('chapter 1 — false leads: a pod deleted, a lone pod, a pod edited, a ConfigMap key that does not exist', () => {
      const { play, edit, pods, podIn, flag, done } = part();
      const first = pods()[0];
      let all = play([`kubectl delete ${first} -n swim`, 'kubectl get pods -n swim']);
      expect(all).toContain(`pod "${first.split('/')[1]}" deleted`);
      expect(flag('pod-deleted')).toBe(true);
      expect(pods()).not.toContain(first);
      expect(all).toMatch(/ImagePullBackOff|ErrImagePull/);
      contains(all, 'un autre a pris sa place');
      all = play(['kubectl run test -n swim --image=registry.pool.example/booking:2.3.1']);
      expect(all).toContain('pod/test created');
      expect(flag('run')).toBe(true);
      const pulling = podIn(/ImagePullBackOff|ErrImagePull/);
      all = edit(`kubectl edit ${pulling} -n swim`, tag);
      expect(all).toContain(`pod/${pulling.split('/')[1]} edited`);
      expect(flag('pod-edited')).toBe(true);
      all = edit(`kubectl edit ${pulling} -n swim`, env);
      expect(all).toContain('spec: Forbidden: pod updates may not change fields other than `spec.containers[*].image`');
      edit('nano manifests/booking.yaml', (x) => tag(env(x)).replace('key: database_host', 'key: DATABASE_HOST'));
      all = play(['kubectl apply -f manifests/', 'sleep 15', 'kubectl get pods -n swim']);
      expect(all).toContain('CreateContainerConfigError');
      expect(flag('config-error')).toBe(true);
      all = play([`kubectl describe ${podIn(/CreateContainerConfigError/)} -n swim`]);
      expect(all).toContain("Error: couldn't find key DATABASE_HOST in ConfigMap swim/booking-config");
      edit('nano manifests/booking.yaml', (x) => x.replace('key: DATABASE_HOST', 'key: database_host'));
      all = play(['kubectl apply -f manifests/', 'kubectl rollout status deployment/booking -n swim']);
      expect(flag('lone-pod')).toBe(true);
      expect(done('wont-start')).toBe(false);
      play(['kubectl delete pod test -n swim']);
      expect(done('wont-start')).toBe(true);
    });

    // ——— Chapter 2: "The Front Desk" ———

    const C1 = ['wont-start'];
    const site = "curl -s -H 'Host: booking.pool.example' http://localhost/";

    it('chapter 2 — solution: the Ingress, the endpoints, the readiness probe, through Traefik', () => {
      const { play, edit, pods, flag, done } = part(C1);
      let all = play([site]);
      expect(all).toContain('404 page not found');
      expect(flag('not-found')).toBe(true);
      contains(all, "la réponse de Traefik, pas celle de l'appli");
      all = play(['kubectl describe ingress booking -n swim', 'kubectl logs -n kube-system deploy/traefik']);
      expect(all).toMatch(/^ {4} +\/ +booking:8080 \(\)$/m);
      expect(all).toContain('level=error msg="Cannot create service: service port not found" ingress=booking namespace=swim providerName=kubernetes serviceName=booking servicePort="&ServiceBackendPort{Name:,Number:8080,}"');
      expect(flag('ingress-port')).toBe(true);
      edit('nano manifests/ingress.yaml', (x) => x.replace('number: 8080', 'number: 80'));
      all = play(['kubectl apply -f manifests/', 'kubectl get endpoints booking -n swim']);
      expect(all).toContain('ingress.networking.k8s.io/booking configured');
      expect(all).toMatch(/^booking +<none> +2d15h$/m);
      expect(flag('port-fixed') && flag('no-endpoints')).toBe(true);
      all = play(['kubectl get pods -n swim --show-labels', 'kubectl describe service booking -n swim']);
      expect(all).toContain('app=booking,pod-template-hash=');
      expect(all).toMatch(/Selector: +app=booking-web/);
      edit('nano manifests/service.yaml', (x) => x.replace('app: booking-web', 'app: booking'));
      all = play(['kubectl apply -f manifests/', 'kubectl get endpointslices -n swim', 'kubectl get endpoints -n swim']);
      expect(flag('selector-fixed')).toBe(true);
      expect(all).toMatch(/booking-\w{5} +IPv4 +8080 +10\.42\.0\.\d+,10\.42\.0\.\d+/);
      expect(all).toMatch(/^booking +<none>/m);
      all = play([`kubectl describe ${pods()[0]} -n swim`]);
      expect(all).toMatch(/Warning +Unhealthy +\S+ \(x\d+ over 2d15h\) +kubelet +Readiness probe failed: HTTP probe failed with statuscode: 404/);
      expect(flag('not-ready')).toBe(true);
      const ip = play([`kubectl get ${pods()[0]} -n swim -o jsonpath='{.status.podIP}'`]).trim();
      expect(ip).toMatch(/^10\.42\.0\.\d+$/);
      all = play([`curl -s http://${ip}:8080/healthz`, `curl -s http://${ip}:8080/health`]);
      expect(all).toContain('Cannot GET /healthz');
      expect(all).toContain('{"status":"ok"}');
      edit('nano manifests/booking.yaml', (x) => x.replace('path: /healthz', 'path: /health'));
      all = play(['kubectl apply -f manifests/', 'kubectl rollout status deployment/booking -n swim', site]);
      expect(all).toContain('deployment "booking" successfully rolled out');
      expect(flag('probe-fixed')).toBe(true);
      expect(all).toContain('<h1>');
      expect(done('front-desk')).toBe(true);
      contains(all, "Vous avez terminé L'Accueil");
      all = play(['kubectl get endpoints booking -n swim', 'curl -s http://booking.pool.example/']);
      expect(all).toMatch(/^booking +10\.42\.0\.\d+:8080,10\.42\.0\.\d+:8080/m);
      expect(all).toContain('booking 2.3.1');
    });

    it("chapter 2 — another solution: the Service's port moved to 8080, a tcpSocket probe", () => {
      const { play, edit, done } = part(C1);
      edit('nano manifests/service.yaml', (x) => x.replace('app: booking-web', 'app: booking').replace('- port: 80', '- port: 8080'));
      edit('nano manifests/booking.yaml', (x) => x.replace('httpGet:\n              path: /healthz\n              port: 8080', 'tcpSocket:\n              port: 8080'));
      const all = play(['kubectl apply -f manifests/', 'sleep 60', site]);
      expect(all).toContain('service/booking configured');
      expect(done('front-desk')).toBe(true);
    });

    it('chapter 2 — false leads: the labels changed, a NodePort, port-forward, the probe removed', () => {
      const { c, play, edit, flag, done } = part(C1);
      edit('nano manifests/booking.yaml', (x) => x.replace(/app: booking\n/g, 'app: booking-web\n'));
      let all = play(['kubectl apply -f manifests/booking.yaml']);
      expect(all).toMatch(/spec\.selector: Invalid value: v1\.LabelSelector\{MatchLabels:map\[string\]string\{"app":"booking-web"\}, MatchExpressions:\[\]v1\.LabelSelectorRequirement\(nil\)\}: field is immutable/);
      expect(flag('labels-changed')).toBe(true);
      contains(all, "Laissez les étiquettes des pods tranquilles");
      edit('nano manifests/booking.yaml', (x) => x.replace(/app: booking-web\n/g, 'app: booking\n'));
      all = play(['kubectl port-forward deploy/booking -n swim 8080:8080']);
      expect(all).toContain('Forwarding from 127.0.0.1:8080 -> 8080');
      expect(flag('port-forward')).toBe(true);
      expect(c.follows).toBe(true);
      c.interrupt();
      edit('nano manifests/service.yaml', (x) => x.replace('app: booking-web', 'app: booking').replace('spec:\n', 'spec:\n  type: NodePort\n'));
      all = play(['kubectl apply -f manifests/', 'kubectl get svc -n swim']);
      expect(all).toMatch(/booking +NodePort +10\.43\.\d+\.\d+ +<none> +80:3\d{4}\/TCP/);
      expect(flag('node-port')).toBe(true);
      contains(all, "à tout internet");
      edit('nano manifests/service.yaml', (x) => x.replace('  type: NodePort\n', ''));
      edit('nano manifests/booking.yaml', (x) => x.replace(/ {10}readinessProbe:\n(.*\n){4}/, ''));
      edit('nano manifests/ingress.yaml', (x) => x.replace('number: 8080', 'number: 80'));
      all = play(['kubectl apply -f manifests/', 'kubectl rollout status deployment/booking -n swim', site]);
      expect(flag('probe-removed')).toBe(true);
      expect(all).toContain('<h1>');
      expect(done('front-desk')).toBe(false);
      edit('nano manifests/booking.yaml', (x) => x.replace('              key: database_host\n', '              key: database_host\n          readinessProbe:\n            httpGet:\n              path: /health\n              port: 8080\n'));
      all = play(['kubectl apply -f manifests/', 'kubectl rollout status deployment/booking -n swim']);
      expect(done('front-desk')).toBe(true);
    });
  });
