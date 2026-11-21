// Story "The Tool Library", chapter "The Leaky Pipeline": Rosa noticed a
// long line of base64 in the log of the CI run on Kwame's pull request.
// The workflow Tomasz wrote runs on pull_request_target (the base
// branch's workflow, with the repository's secrets) but checks out the
// fork's code; the deploy key is in the whole workflow's environment, and
// a "debug" step prints it in base64, which the log's masking doesn't
// recognise. The run logs of a public repository are public: the key has
// leaked. You read the runs and the log (the API, the job's logs), decode
// the line, and then: rotate the key (a new one with ssh-keygen, the old
// line out of the deploy account's authorized_keys, the new one restricted
// with restrict, command="rrsync /srv/www/docs" or from=), update the
// forge's secret (PUT …/actions/secrets/DEPLOY_KEY with {"data": …}, the
// key turned into JSON by jq -Rs), fix the workflow (pull requests on
// pull_request, without secrets; the deploy only on a push to main, the
// key only in its step; no printing), push it, and see the next runs:
// Kwame's pull request tested without secrets, main deployed with the new key.
// Objective checked on the state: the old key gone from authorized_keys,
// a new restricted one there, the secret is its private half, the latest
// runs of the pull request expose no secret to the fork's code and print
// none, and still test the pull request's code; the latest push to main
// deployed with the new key; the protection's required status check
// matches what the pull request reports now.
// False leads: masking only (removing the echo without rotating: the key is
// out already), deleting the workflow (no CI at all), pull_request_target
// without the fork's code (the pull request isn't tested), the key as
// JSON by hand ($(cat key) puts raw newlines in a JSON string), a new key
// without restriction, a stale required status check.
// Sources: https://forgejo.org/docs/latest/user/actions/reference/#onpull_request_target,
// https://forgejo.org/docs/latest/user/actions/security/ (secrets and forks),
// https://securitylab.github.com/resources/github-actions-preventing-pwn-requests/,
// https://man.openbsd.org/sshd#AUTHORIZED_KEYS_FILE_FORMAT, rrsync(1).

import type { Chapter } from '../world';
import type { Game } from '../shell';
import { base64Encode } from '../k8s';
import { HOME, KEYS, PASSWORD, anvilAccounts, anvilState, anvilWorld, contextOk, deployKeys, initialiseAnvil, kwameSync, latestPullRuns, mainHead, oldKeyGone, passTime, protectionFor, pullContexts, repo, restricted, secretKey, seen, workflowFiles } from './tool-library';

const OLD_LINE = KEYS.deploy.isPrivate.split('\n')[2];
const changed = (j: Game) => mainHead(j)!.id !== j.state.startHead;
const pullRuns = (j: Game) => (changed(j) && j.state.synced ? latestPullRuns(j) : []);
const exposed = (j: Game) => pullRuns(j).some((r) => r.jobs.some((x) => (x.secrets && x.forkCode) || x.printed));
const testsPull = (j: Game) => pullRuns(j).some((r) => r.jobs.some((x) => x.tested && x.forkCode && x.status === 'success'));
const safePull = (j: Game) => pullRuns(j).length > 0 && !exposed(j) && testsPull(j);
const newEntry = (j: Game) => deployKeys(j).find((e) => e.key === secretKey(j));
const rotated = (j: Game) => oldKeyGone(j) && !!secretKey(j) && !!newEntry(j) && restricted(newEntry(j)!);
const lastPush = (j: Game) => repo(j).runs.filter((r) => r.event === 'push' && r.ref === 'refs/heads/main').at(-1);
const deployed = (j: Game) => {
  const r = lastPush(j);
  return !!r && r.created > j.state.startClock && r.jobs.some((x) => x.deployed && x.deployed === secretKey(j));
};
const contextFresh = (j: Game) => contextOk(protectionFor(repo(j), 'main'), pullContexts(j));

export const leakyPipeline: Chapter = {
  id: 'leaky-pipeline',
  number: 2,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'echo', 'nano', 'sudo', 'git', 'curl', 'jq', 'base64', 'ssh-keygen', 'rm', 'cp', 'mv', 'mkdir', 'tee', 'forgejo', 'forgejo-runner', 'systemctl', 'journalctl', 'exit'],
  home: HOME,
  welcome: 'message_from_rosa.txt',
  names: true,
  final: 'end',
  steps: ['runs', 'log', 'decoded', 'workflow', 'old-key-gone', 'new-key', 'secret', 'pushed', 'safe', 'context', 'deployed', 'end'],
  password: PASSWORD,
  accounts: anvilAccounts,
  state: (t) => anvilState(t, 2),
  initialise: (j) => {
    initialiseAnvil(j);
    j.state.startClock = j.state.systemd.clock;
  },
  createWorld: (t) => anvilWorld(t, 2, { 'message_from_rosa.txt': t('leaky-pipeline-message-rosa') }),
  afterCommand: (j) => {
    passTime(j);
    // Kwame rebases his pull request on main whenever main moves.
    const head = mainHead(j)!.id;
    if (head !== j.state.seenHead) {
      j.state.seenHead = head;
      kwameSync(j);
      j.state.synced = true;
      return j.t('leaky-pipeline-kwame-sync');
    }
  },
  events: [
    { id: 'runs', condition: (j) => seen(j, '"workflow_runs"') || seen(j, /actions\/runs\/\d+\/jobs\/\d+\/logs/), message: (j) => j.t('leaky-pipeline-event-runs') },
    { id: 'log', condition: (j) => seen(j, base64Encode(`${KEYS.deploy.isPrivate}\n\n`).slice(0, 60)), message: (j) => j.t('leaky-pipeline-event-log') },
    { id: 'decoded', condition: (j) => seen(j, OLD_LINE), message: (j) => j.t('leaky-pipeline-event-decoded') },
    { id: 'workflow', condition: (j) => seen(j, 'pull_request_target:') && seen(j, 'github.event.pull_request.head.sha'), message: (j) => j.t('leaky-pipeline-event-workflow') },
    { id: 'old-key-gone', condition: oldKeyGone, message: (j) => j.t('leaky-pipeline-event-old-key-gone') },
    { id: 'unrestricted', condition: (j) => oldKeyGone(j) && deployKeys(j).some((e) => !restricted(e)), message: (j) => j.t('leaky-pipeline-event-unrestricted') },
    { id: 'new-key', condition: (j) => oldKeyGone(j) && deployKeys(j).some(restricted), message: (j) => j.t('leaky-pipeline-event-new-key') },
    { id: 'json-error', condition: (j) => seen(j, "invalid character '\\\\n' in string literal"), message: (j) => j.t('leaky-pipeline-event-json-error') },
    { id: 'secret', condition: (j) => !!secretKey(j), message: (j) => j.t('leaky-pipeline-event-secret') },
    { id: 'pushed', condition: changed, message: (j) => j.t('leaky-pipeline-event-pushed') },
    { id: 'no-ci', condition: (j) => changed(j) && !workflowFiles(mainHead(j)!).length, message: (j) => j.t('leaky-pipeline-event-no-ci') },
    { id: 'still-exposed', condition: (j) => exposed(j), message: (j) => j.t('leaky-pipeline-event-still-exposed') },
    { id: 'untested', condition: (j) => pullRuns(j).length > 0 && !exposed(j) && !testsPull(j) && workflowFiles(mainHead(j)!).length > 0, message: (j) => j.t('leaky-pipeline-event-untested') },
    { id: 'masked-only', condition: (j) => safePull(j) && !oldKeyGone(j), message: (j) => j.t('leaky-pipeline-event-masked-only') },
    { id: 'safe', condition: safePull, message: (j) => j.t('leaky-pipeline-event-safe') },
    { id: 'stale-context', condition: (j) => safePull(j) && !contextFresh(j), message: (j) => j.t('leaky-pipeline-event-stale-context') },
    { id: 'context', condition: (j) => safePull(j) && contextFresh(j), message: (j) => j.t('leaky-pipeline-event-context') },
    { id: 'deploy-failed', condition: (j) => !!lastPush(j)?.jobs.some((x) => x.deployFailed) && lastPush(j)!.created > j.state.startClock, message: (j) => j.t('leaky-pipeline-event-deploy-failed') },
    { id: 'deployed', condition: deployed, message: (j) => j.t('leaky-pipeline-event-deployed') },
    { id: 'end', condition: (j) => rotated(j) && safePull(j) && contextFresh(j) && deployed(j), message: (j) => j.t('leaky-pipeline-event-end') },
  ],
};
