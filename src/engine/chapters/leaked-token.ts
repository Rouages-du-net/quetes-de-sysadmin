// Story "The Hostel", chapter "Leaked Token": at 14:02 Nnamdi asked for
// help on a public forum about a payments error, pasting the start of
// bunks.env: Bunks's token was in it. Desta saw it at 16:40. Bunks's
// policy is narrow (chapter 2), so the question is what the token could
// read, and what it did read: someone tried it from 203.0.113.77 at 14:31.
// The way: bao token lookup on the leaked token (whose is it, which
// policies, its accessor), the audit log (bao write sys/audit-hash/file
// input=TOKEN, then grep or jq on /var/log/openbao/audit.log; or the
// remote address): it read secret/data/bunks/payments, was refused the
// treasurer's secret, the policies and token creation; bao token revoke; a
// new token for Bunks with its policy, bunks.env, restart; the payment key
// rotated with the new one from the provider, keeping the account field
// (bao kv patch, or kv put with both fields), Bunks restarted to read it.
// Objective checked on the state: the leaked token revoked, the
// payments secret's latest version holding the new key and the account,
// the database secret untouched, Bunks running with a new narrow token
// started after the rotation, the attacker's requests seen in the audit
// log, a health check after the restart.
// False leads: kv put with only api_key (the account is gone: Bunks
// refuses to start), the database password changed in OpenBao only (it no
// longer matches the database's), Bunks restarted with the revoked token,
// a new token too wide.
// Sources: https://openbao.org/docs/commands/token/lookup/,
// https://openbao.org/docs/commands/token/revoke/,
// https://openbao.org/docs/audit/, https://openbao.org/docs/api-docs/system/audit-hash/,
// https://openbao.org/docs/commands/kv/patch/.

import type { Chapter } from '../world';
import { f } from '../world';
import type { Game } from '../shell';
import { systemd } from '../systemd';
import { bao, lookupToken } from '../openbao';
import { ACCOUNT, ATTACKER, DB_PASSWORD, HOME, LEAKED_TOKEN, NEW_API_KEY, NOW, OLD_API_KEY, PASSWORD, accounts, bunksUp, checkedSince, envText, initialiseStory, narrow, padlockState, padlockWorld, passTime, runningToken, seen, story } from './hostel';

const latest = (j: Game, key: string) => bao(j)?.kv[key]?.versions.at(-1);
const rotated = (j: Game) => latest(j, 'bunks/payments')?.data.api_key === NEW_API_KEY && latest(j, 'bunks/payments')?.data.account === ACCOUNT;
const rotatedAt = (j: Game) => latest(j, 'bunks/payments')?.created ?? Infinity;
const dbIntact = (j: Game) => latest(j, 'bunks/db')?.data.password === DB_PASSWORD;
const revoked = (j: Game) => !lookupToken(j, LEAKED_TOKEN);
/** Bunks runs with a new narrow token, started after the key was rotated. */
const switched = (j: Game) => {
  const t = runningToken(j);
  return !!t && t.id !== LEAKED_TOKEN && narrow(j, t) && story(j).running!.at >= rotatedAt(j);
};
const failedWith = (j: Game, text: string) => systemd(j)!.log.some((e) => e.unit === 'bunks.service' && e.time > NOW[3] && e.message.includes(text));
const traced = (j: Game) => !!j.state.attackerSeen;

export const leakedToken: Chapter = {
  id: 'leaked-token',
  number: 3,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'jq', 'nano', 'sudo', 'systemctl', 'journalctl', 'curl', 'bao', 'exit'],
  home: HOME,
  welcome: 'message_from_desta.txt',
  names: true,
  final: 'end',
  steps: ['identified', 'traced', 'revoked', 'rotated', 'switched', 'end'],
  password: PASSWORD,
  accounts,
  state: (t) => padlockState(t, 3),
  initialise: (j) => initialiseStory(j, 3),
  createWorld: (t) =>
    padlockWorld(t, 3, {
      home: {
        'message_from_desta.txt': f(t('leaked-token-message-desta', { key: NEW_API_KEY })),
        'forum_post.txt': f(t('leaked-token-forum-post', { env: envText(LEAKED_TOKEN).split('\n').slice(1, 3).join('\n    ') })),
      },
    }),
  afterCommand: (j) => {
    // The attacker's address, seen in an output (the audit log, a grep, jq).
    if (seen(j, ATTACKER)) j.state.attackerSeen = true;
    return passTime(j);
  },
  events: [
    { id: 'resealed', condition: (j) => !!story(j).resealed, message: (j) => j.t('leaked-token-event-resealed') },
    {
      id: 'identified',
      condition: (j) => {
        const b = bao(j)!;
        const t = b.tokens[LEAKED_TOKEN] ?? b.revoked[LEAKED_TOKEN];
        // A lookup of the leaked token: its accessor and its name on the screen.
        return !!t && seen(j, t.accessor) && seen(j, 'token-bunks');
      },
      message: (j) => j.t('leaked-token-event-identified'),
    },
    { id: 'hash', condition: (j) => seen(j, /hash\s+hmac-sha256:/), message: (j) => j.t('leaked-token-event-hash') },
    { id: 'traced', condition: traced, message: (j) => j.t('leaked-token-event-traced') },
    { id: 'revoked', condition: revoked, message: (j) => j.t('leaked-token-event-revoked') },
    { id: 'still-leaked', condition: (j) => revoked(j) && failedWith(j, 'permission denied'), message: (j) => j.t('leaked-token-event-still-leaked') },
    { id: 'lost-field', condition: (j) => !!latest(j, 'bunks/payments') && !latest(j, 'bunks/payments')!.data.account, message: (j) => j.t('leaked-token-event-lost-field') },
    { id: 'wrong-key', condition: (j) => ![OLD_API_KEY, NEW_API_KEY].includes(latest(j, 'bunks/payments')?.data.api_key ?? ''), message: (j) => j.t('leaked-token-event-wrong-key') },
    { id: 'db-touched', condition: (j) => !dbIntact(j), message: (j) => j.t('leaked-token-event-db-touched') },
    { id: 'rotated', condition: rotated, message: (j) => j.t('leaked-token-event-rotated') },
    { id: 'wide-app', condition: (j) => bunksUp(j) && !!runningToken(j) && runningToken(j)!.id !== LEAKED_TOKEN && !narrow(j, runningToken(j)), message: (j) => j.t('leaked-token-event-wide-app') },
    { id: 'old-key-loaded', condition: (j) => revoked(j) && rotated(j) && !!runningToken(j) && runningToken(j)!.id !== LEAKED_TOKEN && story(j).running!.at < rotatedAt(j), message: (j) => j.t('leaked-token-event-old-key-loaded') },
    { id: 'switched', condition: switched, message: (j) => j.t('leaked-token-event-switched') },
    {
      id: 'end',
      condition: (j) => revoked(j) && rotated(j) && dbIntact(j) && bunksUp(j) && switched(j) && traced(j) && checkedSince(j, story(j).running!.at),
      message: (j) => j.t('leaked-token-event-end'),
    },
  ],
};
