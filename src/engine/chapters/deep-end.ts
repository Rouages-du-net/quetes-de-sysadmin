// Story "The Pool", chapter "The Deep End": Saturday 23 June, the
// regional swim meet, and everyone checks the timetable and the results on
// the booking app. Friday evening Rui applied 2.4.0 (a results cache) with
// memory limits copied from a tutorial (requests 64Mi, limits 128Mi):
// under the meet's load the app needs 190 to 230 MiB, so each container is
// killed by the kernel as soon as it starts (OOMKilled, exit code 137,
// restarts climbing, CrashLoopBackOff), and the site is down (Traefik's
// 404: no pod is ready). And
// 2.4.0's cache never forgets: given more room, its memory keeps growing
// (its log says so once a minute) until it reaches the new limit too.
// You read kubectl describe pod (Last State: Terminated, Reason:
// OOMKilled, Exit Code: 137), kubectl top pod and node, kubectl rollout
// history; you go back to 2.3.1 (kubectl rollout undo, or the image in the
// file), and set requests and limits from what was measured (Rui's note:
// 230Mi at the last meet's peak), in the file.
// Objective checked on the state: the Deployment rolled out on 2.3.1, the
// site answering through Traefik under the meet's load; a memory limit
// above the peak (230Mi) and no more than 1Gi; requests of at least 128Mi
// (what the app needs, so the scheduler keeps room for it); the files in
// ~/manifests what runs.
// Traps: the limits removed (a leak could then take the whole node), a
// limit as big as the node, kubectl rollout undo after a change of the
// limit (it goes back one revision: 2.4.0 again), requests the node can't hold (Pending:
// FailedScheduling, "Insufficient memory"), a limit raised on 2.4.0 (it
// fills it too), a limit below the peak, deleting the pods again and again.
// Sources: https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/,
// https://kubernetes.io/docs/tasks/configure-pod-container/assign-memory-resource/,
// https://kubernetes.io/docs/concepts/scheduling-eviction/node-pressure-eviction/,
// https://kubernetes.io/docs/reference/kubectl/generated/kubectl_top/,
// https://kubernetes.io/docs/concepts/workloads/controllers/deployment/#rolling-back-a-deployment.

import { f, type Chapter } from '../world';
import type { Game } from '../shell';
import { list, normalise, quantity } from '../k8s';
import { HOME, IMAGE, NAMESPACE, PASSWORD, PEAK_MIB, LEAKY_CAUSE, laneAccounts, laneState, laneWorld, initialiseLane, passTime, seen, cluster, container, rolledOut, filesInSync, journal, site } from './pool';

const MiB = 1024 ** 2;
const FILES = ['namespace.yaml', 'config.yaml', 'booking.yaml', 'service.yaml', 'ingress.yaml'];
const image = (j: Game) => (container(j) ? normalise(container(j).image) : '');
const rolledBack = (j: Game) => image(j) === `${IMAGE}:2.3.1`;
const leaky = (j: Game) => image(j) === `${IMAGE}:2.4.0`;
const memoryOf = (q: unknown) => (q === undefined ? null : quantity(q));
const limit = (j: Game) => memoryOf(container(j)?.resources?.limits?.memory);
const requests = (j: Game) => memoryOf(container(j)?.resources?.requests?.memory);
const aboveTutorial = (j: Game) => (limit(j) ?? 0) > 128 * MiB;
const limitOk = (j: Game) => limit(j) !== null && limit(j)! > PEAK_MIB * MiB && limit(j)! <= 1024 * MiB;
const requestsOk = (j: Game) => requests(j) !== null && requests(j)! >= 128 * MiB;
/** A booking pod with a limit above the peak whose container was OOMKilled: 2.4.0 filled it. */
const leakKilled = (j: Game) =>
  list(cluster(j), 'Pod', NAMESPACE).some((p) => {
    const c = p.body.spec?.containers?.[0];
    const lim = memoryOf(c?.resources?.limits?.memory);
    const cr = p.pod?.containers[0];
    return p.metadata.labels.app === 'booking' && lim !== null && lim > PEAK_MIB * MiB && [cr?.last?.reason, cr?.terminated?.reason].includes('OOMKilled');
  });
const done = (j: Game) => rolledOut(j) && rolledBack(j) && limitOk(j) && requestsOk(j) && site(j) === 200 && filesInSync(j, FILES);

export const deepEnd: Chapter = {
  id: 'deep-end',
  number: 4,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'nano', 'diff', 'sudo', 'kubectl', 'curl', 'sleep', 'exit'],
  home: HOME,
  welcome: 'message_from_folake.txt',
  names: true,
  final: 'end',
  steps: ['oom', 'top', 'history', 'leak', 'rolled-back', 'limit-raised', 'requests', 'end'],
  password: PASSWORD,
  accounts: laneAccounts,
  state: (t) => laneState(t, 4),
  initialise: initialiseLane,
  createWorld: (t) =>
    laneWorld(t, 4, {
      'message_from_folake.txt': f(t('deep-end-message-folake')),
      'note_from_rui.txt': f(t('deep-end-note-rui')),
    }),
  afterCommand: passTime,
  events: [
    { id: 'oom', condition: (j) => seen(j, 'OOMKilled'), message: (j) => j.t('deep-end-event-oom') },
    { id: 'top', condition: (j) => seen(j, /^booking-\S+\s+\d+m\s+\d+Mi$/m), message: (j) => j.t('deep-end-event-top') },
    { id: 'history', condition: (j) => seen(j, LEAKY_CAUSE), message: (j) => j.t('deep-end-event-history') },
    { id: 'leak', condition: (j) => seen(j, /results cache: \d+ entries/) || leakKilled(j), message: (j) => j.t('deep-end-event-leak') },
    { id: 'pending', condition: (j) => seen(j, 'Insufficient memory'), message: (j) => j.t('deep-end-event-pending') },
    { id: 'whole-node', condition: (j) => (limit(j) ?? 0) > 1024 * MiB, message: (j) => j.t('deep-end-event-whole-node') },
    { id: 'no-limits', condition: (j) => !!container(j) && limit(j) === null, message: (j) => j.t('deep-end-event-no-limits') },
    { id: 'pods-deleted', condition: (j) => journal(j, 'delete-pod').length >= 2, message: (j) => j.t('deep-end-event-pods-deleted') },
    { id: 'leak-fills', condition: (j) => leaky(j) && leakKilled(j), message: (j) => j.t('deep-end-event-leak-fills') },
    { id: 'undo-leaky', condition: (j) => journal(j, 'undo').length > 0 && leaky(j), message: (j) => j.t('deep-end-event-undo-leaky') },
    { id: 'rolled-back', condition: rolledBack, message: (j) => j.t('deep-end-event-rolled-back') },
    { id: 'below-peak', condition: (j) => rolledBack(j) && aboveTutorial(j) && limit(j)! <= PEAK_MIB * MiB, message: (j) => j.t('deep-end-event-below-peak') },
    { id: 'limit-raised', condition: (j) => aboveTutorial(j) && limit(j)! > PEAK_MIB * MiB, message: (j) => j.t('deep-end-event-limit-raised') },
    { id: 'requests-low', condition: (j) => rolledBack(j) && limitOk(j) && !requestsOk(j), message: (j) => j.t('deep-end-event-requests-low') },
    { id: 'requests', condition: (j) => rolledBack(j) && limitOk(j) && requestsOk(j) && rolledOut(j), message: (j) => j.t('deep-end-event-requests') },
    { id: 'drift', condition: (j) => rolledOut(j) && rolledBack(j) && limitOk(j) && requestsOk(j) && !filesInSync(j, FILES), message: (j) => j.t('deep-end-event-drift') },
    { id: 'end', condition: done, message: (j) => j.t('deep-end-event-end') },
  ],
};
