// Story "The Tool Library", chapter "Who Can Push": on 14 October, at
// 02:13, someone force-pushed Lendshed's main branch with Tomasz's
// credentials: Rosa's two commits vanished and a commit added a
// typosquatted dependency (requets). Rosa put main back two days later,
// but nobody knows who can still push. Tomasz stepped down in March: he
// left the maintainers' team but stayed a direct collaborator with write
// access, and his old personal access token (release-script, all scopes)
// still works; main isn't protected at all.
// You find the force-push (the bare repository keeps a reflog,
// core.logAllRefUpdates; Forgejo's log), remove the collaborator, make the
// token unusable (deleted, with basic authentication and Sudo; or the
// account blocked from signing in, prohibit_login), protect main (no force
// push, direct pushes for the maintainers only, an approval and the CI's
// status check for pull requests), and check that a force-push is refused.
// Objective checked on the state: tomasz is no collaborator, his token
// doesn't authenticate any more, a rule protects main with required
// approvals, a status check that exists and restricted pushes, a force-push
// was refused after that, main still holds its history, the repository is public.
// False leads: deleting Tomasz's account (refused: he owns his fork; with
// --purge, his issues and reviews lose their author), changing his password
// (tokens don't care), making the repository private (the tool libraries
// install from it; his write access stays), a force-push before protecting
// main (it rewrites history: put it back).
// Sources: https://forgejo.org/docs/latest/user/protection/,
// https://forgejo.org/docs/latest/user/api-usage/ (tokens, Sudo),
// https://forgejo.org/docs/latest/admin/command-line/#admin-user-delete,
// https://git-scm.com/docs/git-reflog, https://git-scm.com/docs/git-config#Documentation/git-config.txt-corelogAllRefUpdates.

import type { Chapter } from '../world';
import type { Game } from '../shell';
import { lineage } from '../commands/git';
import { HOME, PASSWORD, TOKENS, anvilAccounts, anvilState, anvilWorld, bare, contextOk, contexts, fs, history, initialiseAnvil, passTime, protectionFor, repo, seen } from './tool-library';

const tomasz = (j: Game) => fs(j).users.tomasz;
const removed = (j: Game) => !repo(j).collaborators.tomasz;
const tokenDead = (j: Game) => !fs(j).tokens.some((t) => t.value === TOKENS.tomasz) || !tomasz(j) || tomasz(j).prohibitLogin || !tomasz(j).active;
const rule = (j: Game) => protectionFor(repo(j), 'main');
const pushRestricted = (j: Game) => {
  const p = rule(j);
  return !!p && (!p.enablePush || (p.enablePushWhitelist && !p.pushWhitelist.includes('tomasz')));
};
const protectedWell = (j: Game) => {
  const p = rule(j);
  return !!p && p.requiredApprovals >= 1 && contextOk(p, contexts(j)) && pushRestricted(j);
};
// main still leads to Rosa's last commit (nobody rewrote it again).
const intact = (j: Game) => {
  const b = bare(j);
  return lineage(b, b.commits.at(-1)!).some((c) => c.id === history().c7.id);
};
const refused = (j: Game) => {
  const p = rule(j);
  return !!p && fs(j).rejections.some((r) => r.kind === 'force' && r.at >= p.created);
};

export const whoCanPush: Chapter = {
  id: 'who-can-push',
  number: 1,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'echo', 'nano', 'sudo', 'git', 'curl', 'jq', 'forgejo', 'systemctl', 'journalctl', 'exit'],
  home: HOME,
  welcome: 'message_from_wanjiru.txt',
  names: true,
  final: 'end',
  steps: ['history', 'collaborator', 'removed', 'token-dead', 'protected', 'refused', 'end'],
  password: PASSWORD,
  accounts: anvilAccounts,
  state: (t) => anvilState(t, 1),
  initialise: initialiseAnvil,
  createWorld: (t) =>
    anvilWorld(t, 1, {
      'message_from_wanjiru.txt': t('who-can-push-message-wanjiru'),
      'note_from_tomasz.txt': t('who-can-push-note-tomasz'),
    }),
  afterCommand: passTime,
  events: [
    { id: 'history', condition: (j) => seen(j, history().bad.id.slice(0, 7)), message: (j) => j.t('who-can-push-event-history') },
    { id: 'typosquat', condition: (j) => seen(j, '+requets==2.32.3'), message: (j) => j.t('who-can-push-event-typosquat') },
    { id: 'collaborator', condition: (j) => seen(j, '"login":"tomasz"') && (seen(j, '"permission":"write"') || /collaborators/.test(j.last.line ?? '')), message: (j) => j.t('who-can-push-event-collaborator') },
    { id: 'removed', condition: removed, message: (j) => j.t('who-can-push-event-removed') },
    { id: 'delete-refused', condition: (j) => seen(j, 'user still has ownership of repositories'), message: (j) => j.t('who-can-push-event-delete-refused') },
    { id: 'purged', condition: (j) => fs(j).purged.includes('tomasz'), message: (j) => j.t('who-can-push-event-purged') },
    { id: 'password-only', condition: (j) => !tokenDead(j) && /change-password\b.*\btomasz\b|admin\/users\/tomasz\b.*password/.test(j.last.line ?? '') && !j.last.errors.length, message: (j) => j.t('who-can-push-event-password-only') },
    { id: 'tokens-basic', condition: (j) => seen(j, '"message":"auth required"'), message: (j) => j.t('who-can-push-event-tokens-basic') },
    { id: 'token-dead', condition: tokenDead, message: (j) => j.t('who-can-push-event-token-dead') },
    { id: 'private', condition: (j) => repo(j).private, message: (j) => j.t('who-can-push-event-private') },
    { id: 'rewritten', condition: (j) => !intact(j), message: (j) => j.t('who-can-push-event-rewritten') },
    { id: 'weak', condition: (j) => !!rule(j) && !protectedWell(j), message: (j) => j.t('who-can-push-event-weak') },
    { id: 'bad-context', condition: (j) => !!rule(j)?.enableStatusCheck && !!rule(j)?.statusCheckContexts.length && !contextOk(rule(j), contexts(j)), message: (j) => j.t('who-can-push-event-bad-context') },
    { id: 'protected', condition: protectedWell, message: (j) => j.t('who-can-push-event-protected') },
    { id: 'refused', condition: refused, message: (j) => j.t('who-can-push-event-refused') },
    {
      id: 'end',
      condition: (j) => removed(j) && tokenDead(j) && protectedWell(j) && refused(j) && intact(j) && !repo(j).private,
      message: (j) => j.t(fs(j).purged.includes('tomasz') ? 'who-can-push-event-end-purged' : 'who-can-push-event-end'),
    },
  ],
};
