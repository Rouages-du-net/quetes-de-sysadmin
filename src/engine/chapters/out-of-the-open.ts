// Story "The Tenants' Union", chapter "Out of the Open": Repairline's .env,
// with the database password, has been in the repository in clear since
// January, and the repository spent three days on a public forge by
// mistake. The way: git log -p (the password is in the history), an age
// key of your own (age-keygen -o ~/.config/sops/age/keys.txt), a
// .sops.yaml whose creation rule covers every .env file (the server's
// deploy key and yours), sops --encrypt --in-place .env, a new password
// for the database (ALTER ROLE as postgres) and in the encrypted file
// (sops edit or sops set), deploy.sh decrypting with the server's key
// (SOPS_AGE_KEY_FILE), the deploy, commit and push.
// Objective checked on the state: the app runs with a new password, read
// from a file only root can read; HEAD's .env is a SOPS file for the
// server and for you that decrypts to that password; .sops.yaml's rule
// covers .env and mail.env; deploy.sh decrypts; origin has the same; no
// commit holds the new password in clear.
// False leads: base64 (an encoding, not encryption), .env in .gitignore
// (it stays in the history, and a tracked file stays tracked), a file
// encrypted without the server's key (the deploy fails) or without yours,
// the ciphertext deployed as is, the new password committed in clear.
// Sources: https://getsops.io/docs/#encrypting-using-age,
// https://getsops.io/docs/#using-sops-yaml-conf-to-select-kms-pgp-and-age-for-new-files,
// https://age-encryption.org/v1, https://git-scm.com/docs/gitignore.

import type { Chapter } from '../world';
import { f, name } from '../world';
import type { Game } from '../shell';
import { systemd } from '../systemd';
import { base64Encode } from '../base64';
import { ignoredBy } from '../commands/git';
import { isSopsFile } from '../sops';
import {
  ENV_FILE,
  HOME,
  LATCH,
  OLD_DB,
  PASSWORD,
  REPO,
  STARTING_COMMITS,
  accounts,
  appRunning,
  dbPassword,
  deployDecrypts,
  dotenvValue,
  envPrivate,
  forServer,
  head,
  inHistory,
  initialiseStory,
  latchState,
  latchWorld,
  openWith,
  origin,
  passTime,
  playerRecipients,
  recipientsOf,
  repo,
  rotated,
  ruleOf,
  seen,
  typed,
} from './tenants-union';

const work = (j: Game, file: string) => j.read(`${REPO}/${file}`);

/** A creation rule for .env and the next .env files, for the server and for you. */
const goodRule = (j: Game, config: string | null | undefined) => {
  const mine = playerRecipients(j);
  return ['.env', 'mail.env'].every((file) => {
    const r = ruleOf(config, file);
    return !!r && r.age.includes(LATCH.public) && r.age.some((a) => mine.includes(a));
  });
};
/** An encrypted .env for the server and for you, holding this password. */
const goodEnv = (j: Game, text: string | null | undefined) => {
  const mine = playerRecipients(j);
  if (!forServer(text) || !recipientsOf(text).some((a) => mine.includes(a))) return false;
  const d = openWith(text, LATCH);
  return !!d && d.items.some((i) => !i.comment && i.key === 'DB_PASSWORD' && i.value === dbPassword(j));
};
const committed = (j: Game) => {
  const h = head(repo(j));
  return goodEnv(j, h['.env']) && goodRule(j, h['.sops.yaml']) && deployDecrypts(h['deploy.sh']);
};
const pushed = (j: Game) => {
  const h = head(repo(j));
  const o = head(origin(j));
  return committed(j) && ['.env', '.sops.yaml', 'deploy.sh'].every((x) => o[x] === h[x]);
};
const deployed = (j: Game) => rotated(j, 1) && appRunning(j) && !(j.read(ENV_FILE) ?? '').includes('ENC[');
const clearCommit = (j: Game) => rotated(j, 1) && inHistory(repo(j), dbPassword(j), STARTING_COMMITS[1]);
const base64ed = (j: Game) => {
  const secrets = [OLD_DB[1], dbPassword(j)].flatMap((s) => [base64Encode(s), base64Encode(`${s}\n`)]);
  const dir = j.find(REPO);
  if (!dir || dir.type !== 'directory') return false;
  return Object.keys(dir.children).some((n) => secrets.some((s) => (work(j, n) ?? '').includes(s)));
};

export const outOfTheOpen: Chapter = {
  id: 'out-of-the-open',
  number: 1,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'nano', 'mkdir', 'chmod', 'cp', 'mv', 'rm', 'echo', 'export', 'install', 'sh', 'sudo', 'git', 'sops', 'age-keygen', 'psql', 'systemctl', 'journalctl', 'base64', 'exit'],
  home: HOME,
  welcome: 'message_from_taslima.txt',
  names: true,
  final: 'end',
  steps: ['history-seen', 'key-made', 'rule-written', 'encrypted', 'rotated', 'deployed', 'committed', 'pushed', 'end'],
  password: PASSWORD,
  accounts: accounts(1),
  state: (t) => latchState(t, 1),
  initialise: (j) => initialiseStory(j, 1),
  createWorld: (t) => latchWorld(t, 1, { home: { 'message_from_taslima.txt': f(t('out-of-the-open-message-taslima')) } }),
  afterCommand: (j) => passTime(j),
  events: [
    { id: 'history-seen', condition: (j) => /^\s*git\b/.test(typed(j)) && seen(j, OLD_DB[1]), message: (j) => j.t('out-of-the-open-event-history-seen') },
    { id: 'base64', condition: base64ed, message: (j) => j.t('out-of-the-open-event-base64') },
    { id: 'gitignore', condition: (j) => ignoredBy(work(j, '.gitignore'))('.env'), message: (j) => j.t('out-of-the-open-event-gitignore') },
    { id: 'key-made', condition: (j) => playerRecipients(j).length > 0, message: (j) => j.t('out-of-the-open-event-key-made') },
    { id: 'rule-written', condition: (j) => goodRule(j, work(j, '.sops.yaml')), message: (j) => j.t('out-of-the-open-event-rule-written') },
    { id: 'wrong-recipient', condition: (j) => isSopsFile(work(j, '.env')) && !forServer(work(j, '.env')), message: (j) => j.t('out-of-the-open-event-wrong-recipient', { key: LATCH.public }) },
    {
      id: 'not-yours',
      condition: (j) => forServer(work(j, '.env')) && !recipientsOf(work(j, '.env')).some((a) => playerRecipients(j).includes(a)),
      message: (j) => j.t('out-of-the-open-event-not-yours'),
    },
    { id: 'encrypted', condition: (j) => forServer(work(j, '.env')) && recipientsOf(work(j, '.env')).some((a) => playerRecipients(j).includes(a)), message: (j) => j.t('out-of-the-open-event-encrypted') },
    { id: 'rotated', condition: (j) => rotated(j, 1), message: (j) => j.t('out-of-the-open-event-rotated') },
    { id: 'ciphertext-deployed', condition: (j) => (j.read(ENV_FILE) ?? '').includes('ENC['), message: (j) => j.t('out-of-the-open-event-ciphertext-deployed') },
    { id: 'root-without-key', condition: (j) => seen(j, 'failed to load age identities') && /sudo|deploy/.test(typed(j)), message: (j) => j.t('out-of-the-open-event-root-without-key') },
    { id: 'app-down', condition: (j) => systemd(j)?.services.repairline?.state === 'failed', message: (j) => j.t('out-of-the-open-event-app-down') },
    { id: 'env-readable', condition: (j) => !envPrivate(j), message: (j) => j.t('out-of-the-open-event-env-readable') },
    { id: 'deployed', condition: (j) => deployed(j) && dotenvValue(j.read(ENV_FILE), 'DB_PASSWORD') === dbPassword(j), message: (j) => j.t('out-of-the-open-event-deployed') },
    { id: 'clear-commit', condition: clearCommit, message: (j) => j.t('out-of-the-open-event-clear-commit') },
    { id: 'committed-old', condition: (j) => forServer(head(repo(j))['.env']) && !rotated(j, 1), message: (j) => j.t('out-of-the-open-event-committed-old') },
    { id: 'committed', condition: committed, message: (j) => j.t('out-of-the-open-event-committed') },
    { id: 'pushed', condition: pushed, message: (j) => j.t('out-of-the-open-event-pushed') },
    {
      id: 'end',
      condition: (j) => pushed(j) && deployed(j) && envPrivate(j) && !clearCommit(j),
      message: (j) => j.t('out-of-the-open-event-end', { file: name(j.t, 'message_from_taslima.txt') }),
    },
  ],
};
