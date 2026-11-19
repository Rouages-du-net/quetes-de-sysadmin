// Story "The Pool", chapter "The Locker Room": on Tuesday 12 June the
// town's IT turned on the database's password, and Rui put it in the
// ConfigMap, so in clear in ~/manifests, a git repository pushed to the
// one the town's IT pulls from (/srv/git/pool-manifests.git). Kemal saw it
// this morning and changed the password on db.pool.internal at 9:00 (the
// new one is in ~/new_db_password.txt): the running pods keep their open
// connections, but any new start fails ("password authentication failed").
// You move the password to a Secret (kubectl create secret generic
// --from-literal, or a manifest kept out of the repository), reference it
// with secretKeyRef (or envFrom), take it out of the ConfigMap (which keeps
// database_host), restart the pods (a variable is read at the container's
// start: kubectl rollout restart, or the template's change), and push a
// commit without it. base64 is an encoding: kubectl get secret -o
// jsonpath='{.data.password}' | base64 -d gives it back. git's history
// keeps the old one (git log -p): changing it on the database was the real
// fix.
// Objective checked on the state: a Secret holds the new password; the
// Deployment's template takes DATABASE_PASSWORD from it (no ConfigMap holds
// a password, plain or in base64; no literal value in the Deployment); the
// rollout done and every running pod started with the new password; the
// site answers; the files in ~/manifests are what runs and hold no
// password; the last commit, here and in the shared repository, holds none.
// Traps: the old password copied into the Secret (auth failed), the value
// base64-encoded in the ConfigMap, the ConfigMap deleted (it still gives
// database_host), the value changed without a restart (the running pods
// keep their environment), a Secret manifest with the password left in the
// repository, a commit not pushed.
// Sources: https://kubernetes.io/docs/concepts/configuration/secret/,
// https://kubernetes.io/docs/tasks/configure-pod-container/configure-pod-configmap/,
// https://kubernetes.io/docs/tasks/inject-data-application/distribute-credentials-secure/,
// https://kubernetes.io/docs/concepts/security/secrets-good-practices/,
// https://kubernetes.io/docs/tasks/administer-cluster/encrypt-data/.

import { f, path, type Chapter } from '../world';
import type { Game, Shell } from '../shell';
import type { Repo as GitRepo } from '../commands/git';
import { base64Decode, base64Encode, find, list, type Obj } from '../k8s';
import { HOME, NAMESPACE, ORIGIN, PASSWORD, OLD_DB_PASSWORD, NEW_DB_PASSWORD, laneAccounts, laneState, laneWorld, initialiseLane, passTime, seen, cluster, deployment, rolledOut, templateEnv, filesInSync, site } from './pool';

const FILES = ['namespace.yaml', 'config.yaml', 'booking.yaml', 'service.yaml', 'ingress.yaml'];
const oldPw = (j: Game) => OLD_DB_PASSWORD(j.t);
const newPw = (j: Game) => NEW_DB_PASSWORD(j.t);
/** A text holds this password: in clear, or in base64 (with or without a newline). */
const holds = (text: string, pw: string) => text.includes(pw) || [pw, `${pw}\n`].some((x) => text.includes(base64Encode(x).replace(/=+$/, '')));
const holdsAny = (j: Game, text: string) => holds(text, oldPw(j)) || holds(text, newPw(j));

const secretValues = (s: Obj) => Object.values(s.body.data ?? {}).map((v) => base64Decode(String(v)) ?? '');
const secretWith = (j: Game, pw: string) => list(cluster(j), 'Secret', NAMESPACE).some((s) => secretValues(s).includes(pw));
const configMaps = (j: Game) => list(cluster(j), 'ConfigMap', NAMESPACE).filter((c) => c.metadata.name !== 'kube-root-ca.crt');
const configHolds = (j: Game) => configMaps(j).some((c) => Object.values(c.body.data ?? {}).some((v) => holdsAny(j, String(v))));
const configBase64 = (j: Game) => configMaps(j).some((c) => Object.values(c.body.data ?? {}).some((v) => [oldPw(j), newPw(j)].some((pw) => [pw, `${pw}\n`].includes(base64Decode(String(v)) ?? ''))));
const bookingConfig = (j: Game) => find(cluster(j), 'ConfigMap', NAMESPACE, 'booking-config');
/** The password written in the Deployment itself (a value:). */
const literal = (j: Game) => !!deployment(j) && holdsAny(j, JSON.stringify(deployment(j)!.body.spec));
const templatePw = (j: Game) => templateEnv(j)?.DATABASE_PASSWORD;
const referenced = (j: Game) => templatePw(j) === newPw(j) && !configHolds(j) && !literal(j);
/** The booking pods that run, and the password each one started with. */
const runningPods = (j: Game) =>
  list(cluster(j), 'Pod', NAMESPACE)
    .filter((p) => p.metadata.labels.app === 'booking')
    .flatMap((p) => p.pod?.containers.filter((c) => c.state === 'running' && c.run) ?? []);
const stale = (j: Game) => runningPods(j).some((c) => c.run!.env.DATABASE_PASSWORD !== newPw(j));
const restarted = (j: Game) => rolledOut(j) && runningPods(j).length > 0 && !stale(j);

// The repository: ~/manifests's files, its last commit, and the shared one's.
const sh = (j: Game) => (j as Shell).principal;
const repoPath = (j: Game) => path(j.t, `${HOME}/manifests`);
const repo = (j: Game, p: string): GitRepo | undefined => sh(j).state.git?.[p];
const headClean = (j: Game, p: string) => {
  const c = repo(j, p)?.commits.at(-1);
  return !!c && !Object.values(c.files).some((text) => holdsAny(j, text));
};
const workingFiles = (j: Game) => {
  const s = sh(j);
  const dir = s.find(`${s.home}/manifests`);
  if (dir?.type !== 'directory') return [];
  return Object.entries(dir.children)
    .filter(([n, node]) => node.type === 'file' && !n.startsWith('.'))
    .map(([n]) => ({ name: n, text: s.read(`${s.home}/manifests/${n}`) ?? '' }));
};
const leakingFile = (j: Game) => workingFiles(j).find((x) => holdsAny(j, x.text));
/** A file of the repository that holds the new password (a Secret's manifest…). */
const newLeak = (j: Game) => workingFiles(j).find((x) => holds(x.text, newPw(j)));
const pushed = (j: Game) => headClean(j, ORIGIN);

const done = (j: Game) =>
  secretWith(j, newPw(j)) && referenced(j) && !!bookingConfig(j) && restarted(j) && site(j) === 200 && filesInSync(j, FILES) && !leakingFile(j) && headClean(j, repoPath(j)) && pushed(j);

export const lockerRoom: Chapter = {
  id: 'locker-room',
  number: 3,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'nano', 'diff', 'echo', 'rm', 'sudo', 'kubectl', 'base64', 'git', 'curl', 'sleep', 'exit'],
  home: HOME,
  welcome: 'message_from_folake.txt',
  names: true,
  final: 'end',
  steps: ['config-read', 'secret-created', 'decoded', 'referenced', 'config-cleaned', 'restarted', 'committed', 'pushed', 'end'],
  password: PASSWORD,
  accounts: laneAccounts,
  state: (t) => laneState(t, 3),
  initialise: initialiseLane,
  createWorld: (t) =>
    laneWorld(t, 3, {
      'message_from_folake.txt': f(t('locker-room-message-folake')),
      'note_from_kemal.txt': f(t('locker-room-note-kemal')),
      'new_db_password.txt': f(`${NEW_DB_PASSWORD(t)}\n`, { lines: true, owner: 'you', mode: 'rw-------' }),
    }),
  afterCommand: passTime,
  events: [
    { id: 'config-read', condition: (j) => seen(j, oldPw(j)), message: (j) => j.t('locker-room-event-config-read') },
    { id: 'history-seen', condition: (j) => seen(j, `+  database_password: ${oldPw(j)}`), message: (j) => j.t('locker-room-event-history-seen') },
    { id: 'old-secret', condition: (j) => secretWith(j, oldPw(j)), message: (j) => j.t('locker-room-event-old-secret') },
    { id: 'auth-failed', condition: (j) => seen(j, 'password authentication failed for user "booking"'), message: (j) => j.t('locker-room-event-auth-failed') },
    { id: 'newline', condition: (j) => secretWith(j, `${newPw(j)}\n`), message: (j) => j.t('locker-room-event-newline') },
    { id: 'secret-created', condition: (j) => secretWith(j, newPw(j)), message: (j) => j.t('locker-room-event-secret-created') },
    { id: 'decoded', condition: (j) => secretWith(j, newPw(j)) && seen(j, newPw(j)) && /base64\s+(-d|--decode)/.test(sh(j).last.line), message: (j) => j.t('locker-room-event-decoded') },
    { id: 'base64-config', condition: configBase64, message: (j) => j.t('locker-room-event-base64-config') },
    { id: 'config-deleted', condition: (j) => !bookingConfig(j), message: (j) => j.t('locker-room-event-config-deleted') },
    { id: 'literal', condition: literal, message: (j) => j.t('locker-room-event-literal') },
    { id: 'referenced', condition: (j) => templatePw(j) === newPw(j) && !literal(j) && list(cluster(j), 'Secret', NAMESPACE).length > 0 && !configMaps(j).some((c) => Object.values(c.body.data ?? {}).includes(newPw(j))), message: (j) => j.t('locker-room-event-referenced') },
    { id: 'config-cleaned', condition: (j) => !!bookingConfig(j) && !configHolds(j), message: (j) => j.t('locker-room-event-config-cleaned') },
    { id: 'stale-env', condition: (j) => templatePw(j) === newPw(j) && rolledOut(j) && stale(j), message: (j) => j.t('locker-room-event-stale-env') },
    { id: 'restarted', condition: (j) => referenced(j) && restarted(j), message: (j) => j.t('locker-room-event-restarted') },
    { id: 'secret-file', condition: (j) => !!newLeak(j), message: (j) => j.t('locker-room-event-secret-file', { file: newLeak(j)!.name }) },
    { id: 'committed', condition: (j) => headClean(j, repoPath(j)), message: (j) => j.t('locker-room-event-committed') },
    { id: 'pushed', condition: pushed, message: (j) => j.t('locker-room-event-pushed') },
    { id: 'drift', condition: (j) => referenced(j) && restarted(j) && !filesInSync(j, FILES), message: (j) => j.t('locker-room-event-drift') },
    { id: 'end', condition: done, message: (j) => j.t('locker-room-event-end') },
  ],
};
