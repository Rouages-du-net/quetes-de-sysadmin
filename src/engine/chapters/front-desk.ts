// Story "The Pool", chapter "The Front Desk": a week later, the site
// booking.pool.example must be served by lane (its DNS now points there).
// Kemal, from the town's IT, removed the Deployment and applied his
// manifests on Friday: a readiness probe, a Service and an Ingress. The
// address answers "404 page not found" (Traefik has no route). Three
// mistakes in a row: the Ingress sends to the Service's port 8080 when the
// Service listens on 80 (Traefik: "service port not found"); the Service
// selects app=booking-web while the pods are labelled app=booking (no
// endpoints: kubectl get endpoints, endpointslices); the readiness probe
// asks /healthz, which the app doesn't have (404: pods Running but 0/1,
// so not in the endpoints; the Deployment exceeds its progress deadline).
// You follow the request with curl (the Host header), kubectl get/describe
// ingress, service, endpoints, the pods' events and Traefik's log
// (kubectl logs -n kube-system deploy/traefik), fix the files, apply.
// Objective checked on the state: http://booking.pool.example/ answers
// 200 through Traefik, the Deployment rolled out with a readiness probe
// that passes, the Service stays a ClusterIP (nothing open on the node's
// ports), and the files in ~/manifests are what runs.
// Traps: a NodePort (open to the whole internet, around Traefik),
// kubectl port-forward (works for you only, while it runs), the readiness
// probe removed (the pods would get traffic before they are ready), the
// pods' labels changed (the Deployment's selector is immutable).
// Sources: https://kubernetes.io/docs/concepts/services-networking/service/,
// https://kubernetes.io/docs/concepts/services-networking/ingress/,
// https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/,
// https://docs.k3s.io/networking/networking-services#traefik-ingress-controller,
// https://kubernetes.io/docs/tasks/debug/debug-application/debug-service/.

import { f, type Chapter } from '../world';
import type { Game } from '../shell';
import { endpointsOf, find, list, podReady, routes } from '../k8s';
import { HOME, PASSWORD, NAMESPACE, laneAccounts, laneState, laneWorld, initialiseLane, passTime, seen, cluster, container, rolledOut, filesInSync, journal, site } from './pool';

const FILES = ['namespace.yaml', 'config.yaml', 'booking.yaml', 'service.yaml', 'ingress.yaml'];
const service = (j: Game) => find(cluster(j), 'Service', NAMESPACE, 'booking');
const route = (j: Game) => routes(cluster(j)).find((r) => r.ingress.metadata.name === 'booking' && r.ingress.metadata.namespace === NAMESPACE);
const opened = (j: Game) => list(cluster(j), 'Service', NAMESPACE).filter((s) => s.body.spec?.type === 'NodePort' || s.body.spec?.type === 'LoadBalancer');
const probe = (j: Game) => container(j)?.readinessProbe;
const readyPods = (j: Game) => list(cluster(j), 'Pod', NAMESPACE).filter((p) => p.metadata.labels.app === 'booking' && podReady(p));
const done = (j: Game) => site(j) === 200 && rolledOut(j) && !!probe(j) && opened(j).length === 0;

export const frontDesk: Chapter = {
  id: 'front-desk',
  number: 2,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'nano', 'diff', 'sudo', 'kubectl', 'k3s', 'curl', 'systemctl', 'journalctl', 'sleep', 'exit'],
  home: HOME,
  welcome: 'message_from_folake.txt',
  names: true,
  final: 'end',
  steps: ['not-found', 'ingress-port', 'port-fixed', 'no-endpoints', 'selector-fixed', 'not-ready', 'probe-fixed', 'end'],
  password: PASSWORD,
  accounts: laneAccounts,
  state: (t) => laneState(t, 2),
  initialise: initialiseLane,
  createWorld: (t) =>
    laneWorld(t, 2, {
      'message_from_folake.txt': f(t('front-desk-message-folake')),
      'note_from_kemal.txt': f(t('front-desk-note-kemal')),
    }),
  afterCommand: passTime,
  events: [
    { id: 'not-found', condition: (j) => seen(j, /^404 page not found$/m), message: (j) => j.t('front-desk-event-not-found') },
    { id: 'ingress-port', condition: (j) => seen(j, /service port not found|booking:8080 \(\)/), message: (j) => j.t('front-desk-event-ingress-port') },
    { id: 'port-fixed', condition: (j) => !!route(j) && !['service port not found', 'service not found'].includes(route(j)!.problem), message: (j) => j.t('front-desk-event-port-fixed') },
    { id: 'no-endpoints', condition: (j) => seen(j, /^booking\s+<none>\s/m) || seen(j, 'Skipping service: no endpoints found'), message: (j) => j.t('front-desk-event-no-endpoints') },
    { id: 'labels-changed', condition: (j) => seen(j, /`selector` does not match template `labels`|spec\.selector: Invalid value: .*field is immutable/), message: (j) => j.t('front-desk-event-labels-changed') },
    { id: 'selector-fixed', condition: (j) => !!service(j) && endpointsOf(cluster(j), service(j)!).length > 0, message: (j) => j.t('front-desk-event-selector-fixed') },
    { id: 'not-ready', condition: (j) => seen(j, 'Readiness probe failed: HTTP probe failed with statuscode: 404'), message: (j) => j.t('front-desk-event-not-ready') },
    { id: 'node-port', condition: (j) => opened(j).length > 0, message: (j) => j.t('front-desk-event-node-port', { port: String(opened(j)[0].body.spec.ports?.[0]?.nodePort ?? '') }) },
    { id: 'port-forward', condition: (j) => journal(j, 'port-forward').length > 0, message: (j) => j.t('front-desk-event-port-forward') },
    { id: 'probe-removed', condition: (j) => !!container(j) && !probe(j), message: (j) => j.t('front-desk-event-probe-removed') },
    { id: 'probe-fixed', condition: (j) => !!probe(j) && readyPods(j).length > 0, message: (j) => j.t('front-desk-event-probe-fixed') },
    { id: 'drift', condition: (j) => done(j) && !filesInSync(j, FILES), message: (j) => j.t('front-desk-event-drift') },
    {
      id: 'end',
      condition: (j) => done(j) && filesInSync(j, FILES),
      message: (j) => j.t('front-desk-event-end'),
    },
  ],
};
