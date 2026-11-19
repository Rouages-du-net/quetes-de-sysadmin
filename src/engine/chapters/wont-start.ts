// Story "The Pool", chapter "The Pod That Won't Start": this morning Rui
// applied the booking app's new release (2.3.1, which opens the summer
// lessons' registration at 9:00) before leaving for his train, and the
// new pod never started. The old pods (2.2.0) still serve: the rolling
// update waits for the new ones (maxUnavailable rounds down to 0). The
// image tag has a typo (2.31: the registry answers "not found",
// ErrImagePull then ImagePullBackOff); once fixed, the new container
// crashes (CrashLoopBackOff): 2.3.0 renamed its setting DB_HOST to
// DATABASE_HOST, and the log of the crashed container says so
// (kubectl logs --previous). You read kubectl get pods -n swim, describe
// (its Events), logs, fix ~/manifests/booking.yaml, kubectl apply -f, and
// follow kubectl rollout status.
// Objective checked on the state: the Deployment rolled out (2/2 updated
// and available) on 2.3.1 with DATABASE_HOST set, no pod nobody manages
// in the namespace, and the files in ~/manifests the same as what runs
// (kubectl apply would change nothing).
// Traps: deleting the pod (its ReplicaSet makes another, with the same
// error), kubectl run of a lone pod, editing a pod rather than its
// Deployment, a fix made with kubectl edit or set image but not in the
// file (the next apply would undo it), a ConfigMap key that doesn't exist
// (CreateContainerConfigError).
// Sources: https://kubernetes.io/docs/tasks/debug/debug-application/debug-pods/,
// https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#container-restarts,
// https://kubernetes.io/docs/concepts/containers/images/#imagepullbackoff,
// https://kubernetes.io/docs/concepts/workloads/controllers/deployment/#rolling-update-deployment.

import { f, type Chapter } from '../world';
import type { Game } from '../shell';
import { normalise } from '../k8s';
import { HOME, IMAGE, PASSWORD, DB_HOST, laneAccounts, laneState, laneWorld, initialiseLane, passTime, seen, container, rolledOut, templateEnv, filesInSync, lonePods, journal } from './pool';

const FILES = ['namespace.yaml', 'config.yaml', 'booking.yaml'];
const goodImage = (j: Game) => !!container(j) && normalise(container(j).image) === `${IMAGE}:2.3.1`;
const envOk = (j: Game) => templateEnv(j)?.DATABASE_HOST === DB_HOST;
const fixed = (j: Game) => rolledOut(j) && goodImage(j) && envOk(j);

export const wontStart: Chapter = {
  id: 'wont-start',
  number: 1,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'nano', 'diff', 'sudo', 'kubectl', 'k3s', 'systemctl', 'journalctl', 'sleep', 'exit'],
  home: HOME,
  welcome: 'message_from_folake.txt',
  names: true,
  final: 'end',
  steps: ['pods', 'pull-error', 'tag-fixed', 'crash', 'logs', 'env-fixed', 'rolled-out', 'end'],
  password: PASSWORD,
  accounts: laneAccounts,
  state: (t) => laneState(t, 1),
  initialise: initialiseLane,
  createWorld: (t) =>
    laneWorld(t, 1, {
      'message_from_folake.txt': f(t('wont-start-message-folake')),
      'note_from_rui.txt': f(t('wont-start-note-rui')),
    }),
  afterCommand: passTime,
  events: [
    { id: 'default-namespace', condition: (j) => seen(j, 'No resources found in default namespace.'), message: (j) => j.t('wont-start-event-default-namespace') },
    { id: 'pods', condition: (j) => seen(j, /\b(ImagePullBackOff|ErrImagePull)\b/), message: (j) => j.t('wont-start-event-pods') },
    { id: 'pull-error', condition: (j) => seen(j, /failed to resolve reference "[^"]*booking:2\.31": [^\n]*: not found/), message: (j) => j.t('wont-start-event-pull-error') },
    { id: 'pod-deleted', condition: (j) => journal(j, 'delete-pod').length > 0, message: (j) => j.t('wont-start-event-pod-deleted') },
    { id: 'run', condition: (j) => journal(j, 'run').length > 0, message: (j) => j.t('wont-start-event-run') },
    { id: 'pod-edited', condition: (j) => [...journal(j, 'edit'), ...journal(j, 'set-image')].some((x) => x.detail.startsWith('Pod/')), message: (j) => j.t('wont-start-event-pod-edited') },
    { id: 'tag-fixed', condition: goodImage, message: (j) => j.t('wont-start-event-tag-fixed') },
    { id: 'crash', condition: (j) => goodImage(j) && seen(j, 'CrashLoopBackOff'), message: (j) => j.t('wont-start-event-crash') },
    { id: 'logs', condition: (j) => seen(j, 'Error: DATABASE_HOST is not set'), message: (j) => j.t('wont-start-event-logs') },
    { id: 'config-error', condition: (j) => seen(j, /CreateContainerConfigError|couldn't find key/), message: (j) => j.t('wont-start-event-config-error') },
    { id: 'env-fixed', condition: envOk, message: (j) => j.t('wont-start-event-env-fixed') },
    { id: 'rolled-out', condition: fixed, message: (j) => j.t('wont-start-event-rolled-out') },
    { id: 'drift', condition: (j) => fixed(j) && !filesInSync(j, FILES), message: (j) => j.t('wont-start-event-drift') },
    { id: 'lone-pod', condition: (j) => fixed(j) && lonePods(j).length > 0, message: (j) => j.t('wont-start-event-lone-pod', { pod: lonePods(j)[0].metadata.name }) },
    {
      id: 'end',
      condition: (j) => fixed(j) && filesInSync(j, FILES) && lonePods(j).length === 0,
      message: (j) => j.t('wont-start-event-end'),
    },
  ],
};
