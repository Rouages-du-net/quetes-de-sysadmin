// Story "The Hostel", chapter "Need to Know": three days after the cut,
// Desta reads Ruslan's notes and finds that Bunks starts with the root
// token: the one printed by bao operator init, never revoked, kept in
// /etc/bunks/bunks.env. Anyone who reads that file (or the app's memory)
// can do anything on OpenBao, forever (a root token has no TTL).
// The way: read the secrets' paths (bao kv list, kv get), a policy for Bunks
// alone in HCL (read on secret/data/bunks/*: KV version 2 puts data/ in the
// API's path), bao policy write, bao token create -policy=bunks (with your
// own admin token, an orphan: not the root token), bao token capabilities to
// check, the new token in bunks.env, systemctl restart bunks, curl its
// health, then bao token revoke on the root token.
// Objective checked on the state: Bunks runs with a token that reads its two
// secrets and nothing else (no write there; the treasurer's, the Wi-Fi's, the
// policies, token creation: deny), a token with a TTL, the root token
// revoked, a health check after the switch.
// False leads: a policy on secret/bunks/* (without data/: permission
// denied), a policy too wide (secret/*, the admin policy), a token made with
// the root token (its child: revoked with it), the root token revoked while
// Bunks still uses it, flags after the arguments (ignored, with a warning).
// Sources: https://openbao.org/docs/concepts/policies/,
// https://openbao.org/docs/concepts/tokens/#root-tokens,
// https://openbao.org/docs/concepts/tokens/#token-hierarchies-and-orphan-tokens,
// https://openbao.org/docs/secrets/kv/kv-v2/#acl-rules.

import type { Chapter } from '../world';
import { f } from '../world';
import type { Game } from '../shell';
import { systemd } from '../systemd';
import { bao, capabilitiesOf, parsePolicy } from '../openbao';
import { DB_PATH, HOME, NOW, OTHERS, PASSWORD, ROOT_TOKEN, accounts, bunksUp, checkedSince, initialiseStory, narrow, padlockState, padlockWorld, passTime, runningToken, story } from './hostel';

const BUILT_IN = ['default', 'root', 'admin', 'treasurer'];
const playerPolicies = (j: Game) => Object.keys(bao(j)?.policies ?? {}).filter((p) => !BUILT_IN.includes(p));
const readsDb = (j: Game, p: string) => capabilitiesOf(bao(j)!, [p], DB_PATH).includes('read');
const rootGone = (j: Game) => !bao(j)?.tokens[ROOT_TOKEN];
/** Bunks runs with a token other than root, narrow, with a TTL. */
const switched = (j: Game) => {
  const t = runningToken(j);
  return !!t && t.id !== ROOT_TOKEN && t.ttl > 0 && narrow(j, t);
};
const failedWith = (j: Game, text: string) => systemd(j)!.log.some((e) => e.unit === 'bunks.service' && e.time > NOW[2] && e.message.includes(text));

export const needToKnow: Chapter = {
  id: 'need-to-know',
  number: 2,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'grep', 'nano', 'sudo', 'systemctl', 'journalctl', 'curl', 'bao', 'exit'],
  home: HOME,
  welcome: 'message_from_desta.txt',
  names: true,
  final: 'end',
  steps: ['policy', 'token', 'switched', 'checked', 'root-revoked', 'end'],
  password: PASSWORD,
  accounts,
  state: (t) => padlockState(t, 2),
  initialise: (j) => initialiseStory(j, 2),
  createWorld: (t) =>
    padlockWorld(t, 2, {
      home: {
        'message_from_desta.txt': f(t('need-to-know-message-desta')),
        'notes_from_ruslan.txt': f(t('need-to-know-notes-ruslan')),
      },
    }),
  afterCommand: (j) => passTime(j),
  events: [
    { id: 'resealed', condition: (j) => !!story(j).resealed, message: (j) => j.t('need-to-know-event-resealed') },
    {
      id: 'no-data',
      condition: (j) =>
        playerPolicies(j).some((p) => {
          const parsed = parsePolicy(bao(j)!.policies[p]);
          return 'rules' in parsed && parsed.rules.some((r) => /^secret\/(?!data\/|metadata\/|\*)/.test(r.path)) && !readsDb(j, p);
        }),
      message: (j) => j.t('need-to-know-event-no-data'),
    },
    {
      id: 'too-wide',
      condition: (j) => playerPolicies(j).some((p) => readsDb(j, p) && OTHERS.some((o) => capabilitiesOf(bao(j)!, [p], o).join() !== 'deny')),
      message: (j) => j.t('need-to-know-event-too-wide'),
    },
    { id: 'policy', condition: (j) => playerPolicies(j).some((p) => readsDb(j, p)), message: (j) => j.t('need-to-know-event-policy') },
    {
      id: 'from-root',
      condition: (j) => Object.values({ ...bao(j)!.tokens, ...bao(j)!.revoked }).some((t) => t.parent === ROOT_TOKEN && !!t.createdBy),
      message: (j) => j.t('need-to-know-event-from-root'),
    },
    { id: 'token', condition: (j) => Object.values(bao(j)!.tokens).some((t) => !!t.createdBy && narrow(j, t)), message: (j) => j.t('need-to-know-event-token') },
    { id: 'denied', condition: (j) => failedWith(j, 'permission denied'), message: (j) => j.t('need-to-know-event-denied') },
    { id: 'switched', condition: switched, message: (j) => j.t('need-to-know-event-switched') },
    { id: 'wide-app', condition: (j) => bunksUp(j) && !!runningToken(j) && runningToken(j)!.id !== ROOT_TOKEN && !narrow(j, runningToken(j)), message: (j) => j.t('need-to-know-event-wide-app') },
    { id: 'checked', condition: (j) => switched(j) && checkedSince(j, story(j).running!.at), message: (j) => j.t('need-to-know-event-checked') },
    { id: 'early-revoke', condition: (j) => rootGone(j) && story(j).running?.token === ROOT_TOKEN, message: (j) => j.t('need-to-know-event-early-revoke') },
    { id: 'root-revoked', condition: rootGone, message: (j) => j.t('need-to-know-event-root-revoked') },
    { id: 'end', condition: (j) => bunksUp(j) && switched(j) && rootGone(j) && checkedSince(j, story(j).running!.at), message: (j) => j.t('need-to-know-event-end') },
  ],
};
