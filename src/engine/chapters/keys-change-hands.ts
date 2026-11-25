// Story "The Tenants' Union", chapter "Keys Change Hands": seven weeks
// later. Makoa is leaving the union's tech team, Ikenna joins it. .env and
// mail.env are encrypted for the server, for you and for Makoa. The way:
// Ikenna's public key into .sops.yaml, Makoa's out; sops updatekeys on each
// file (the keys that wrap the data key follow the rule); sops rotate -i
// (a new data key: Makoa may have kept the old one); a new database
// password (Makoa knew it), set in .env with sops; the deploy; commit and
// push. The relay's password changes at the provider tomorrow (Taslima).
// Objective checked on the state: the rule and both files are for the
// server, you and Ikenna, not Makoa; both data keys differ from the ones
// Makoa could open; a new database password, in .env, deployed and used
// by the app; HEAD and origin agree; your private key stayed yours.
// False leads: sharing your keys.txt with Ikenna (or making it readable),
// editing an ENC[…] value by hand (the tag or the MAC fails), updatekeys
// without rotate (the same data key), the rule changed but not the files.
// Sources: https://getsops.io/docs/#updatekeys-command,
// https://getsops.io/docs/#key-rotation,
// https://getsops.io/docs/#adding-and-removing-keys.

import type { Chapter, Directory, Node } from '../world';
import { f, name } from '../world';
import type { Game, Shell } from '../shell';
import { systemd } from '../systemd';
import {
  ENV_FILE,
  HOME,
  IKENNA,
  LATCH,
  MAKOA,
  PASSWORD,
  REPO,
  STARTING_COMMITS,
  YOURS,
  accounts,
  appRunning,
  dataKeyHex,
  dbPassword,
  deployDecrypts,
  dotenvValue,
  envPrivate,
  head,
  inHistory,
  initialiseStory,
  latchState,
  latchWorld,
  openWith,
  origin,
  passTime,
  recipientsOf,
  repo,
  rotated,
  ruleOf,
  seen,
} from './tenants-union';

const FILES = ['.env', 'mail.env'];
const work = (j: Game, file: string) => j.read(`${REPO}/${file}`);
const startKey = (j: Game, file: string) => (j.state.startKeys as Record<string, string | null>)?.[file === '.env' ? 'env' : 'mail'] ?? null;

/** The rule of .sops.yaml: for the server, you and Ikenna; not Makoa. */
const goodRule = (config: string | null | undefined) =>
  FILES.every((file) => {
    const r = ruleOf(config, file);
    return !!r && [LATCH.public, YOURS.public, IKENNA.public].every((k) => r.age.includes(k)) && !r.age.includes(MAKOA.public);
  });
/** A file for the same people, opened by Ikenna's key. */
const goodKeys = (text: string | null | undefined) => {
  const r = recipientsOf(text);
  return [LATCH.public, YOURS.public, IKENNA.public].every((k) => r.includes(k)) && !r.includes(MAKOA.public) && !!openWith(text, IKENNA);
};
const newDataKey = (j: Game, text: string | null | undefined, file: string) => {
  const k = dataKeyHex(text);
  return !!k && k !== startKey(j, file);
};
const envHolds = (j: Game, text: string | null | undefined) => openWith(text, LATCH)?.items.some((i) => !i.comment && i.key === 'DB_PASSWORD' && i.value === dbPassword(j)) ?? false;
const filesDone = (j: Game, files: Record<string, string | undefined>) => FILES.every((x) => goodKeys(files[x]) && newDataKey(j, files[x], x)) && envHolds(j, files['.env']);
const committed = (j: Game) => {
  const h = head(repo(j));
  return goodRule(h['.sops.yaml']) && filesDone(j, h) && deployDecrypts(h['deploy.sh']);
};
const pushed = (j: Game) => {
  const h = head(repo(j));
  const o = head(origin(j));
  return committed(j) && ['.env', 'mail.env', '.sops.yaml'].every((x) => o[x] === h[x]);
};
const deployed = (j: Game) => rotated(j, 2) && appRunning(j) && dotenvValue(j.read(ENV_FILE), 'DB_PASSWORD') === dbPassword(j);
const working = (j: Game) => Object.fromEntries(FILES.map((x) => [x, work(j, x) ?? undefined]));

/** Your private key somewhere else than your keys.txt, or that file readable by others. */
function keyShared(j: Game): boolean {
  const s = j as Shell;
  const own = `${s.home}/.config/sops/age/keys.txt`;
  const n = s.find(own);
  if (n && /r/.test((n.mode ?? 'rw-r--r--').slice(3))) return true;
  let found = false;
  const walk = (dir: Directory, at: string) => {
    for (const [k, c] of Object.entries(dir.children)) {
      if (found) return;
      const p = `${at}/${k}`;
      if (['/proc', '/usr', '/sys'].includes(p)) continue;
      if (c.type === 'directory') walk(c, p);
      else if (p !== own && typeof (c as Node & { content?: unknown }).content === 'string' && ((c as { content: string }).content.includes(YOURS.secret))) found = true;
    }
  };
  walk(s.root as Directory, '');
  return found;
}

export const keysChangeHands: Chapter = {
  id: 'keys-change-hands',
  number: 2,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'nano', 'mkdir', 'chmod', 'cp', 'mv', 'rm', 'echo', 'export', 'install', 'sh', 'sudo', 'git', 'sops', 'age-keygen', 'psql', 'systemctl', 'journalctl', 'exit'],
  home: HOME,
  welcome: 'message_from_taslima.txt',
  names: true,
  final: 'end',
  steps: ['config-updated', 'keys-updated', 'data-rotated', 'rotated', 'deployed', 'committed', 'pushed', 'end'],
  password: PASSWORD,
  accounts: accounts(2),
  state: (t) => latchState(t, 2),
  initialise: (j) => initialiseStory(j, 2),
  createWorld: (t) =>
    latchWorld(t, 2, {
      home: {
        'message_from_taslima.txt': f(t('keys-change-hands-message-taslima')),
        'message_from_ikenna.txt': f(t('keys-change-hands-message-ikenna', { key: IKENNA.public })),
        'message_from_makoa.txt': f(t('keys-change-hands-message-makoa')),
      },
    }),
  afterCommand: (j) => passTime(j),
  events: [
    { id: 'shared-key', condition: keyShared, message: (j) => j.t('keys-change-hands-event-shared-key') },
    {
      id: 'hand-edit',
      condition: (j) => seen(j, 'MAC mismatch') || seen(j, "does not match sops' data format") || seen(j, 'message authentication failed'),
      message: (j) => j.t('keys-change-hands-event-hand-edit'),
    },
    { id: 'config-updated', condition: (j) => goodRule(work(j, '.sops.yaml')), message: (j) => j.t('keys-change-hands-event-config-updated') },
    {
      id: 'config-only',
      condition: (j) => goodRule(work(j, '.sops.yaml')) && FILES.some((x) => recipientsOf(work(j, x)).includes(MAKOA.public)) && /\bgit\s+(commit|push)\b/.test((j as Shell).last.line ?? ''),
      message: (j) => j.t('keys-change-hands-event-config-only'),
    },
    { id: 'keys-updated', condition: (j) => FILES.every((x) => goodKeys(work(j, x))), message: (j) => j.t('keys-change-hands-event-keys-updated') },
    {
      id: 'same-data-key',
      condition: (j) => FILES.every((x) => goodKeys(work(j, x))) && FILES.some((x) => !newDataKey(j, work(j, x), x)),
      message: (j) => j.t('keys-change-hands-event-same-data-key'),
    },
    { id: 'data-rotated', condition: (j) => FILES.every((x) => newDataKey(j, work(j, x), x) && !recipientsOf(work(j, x)).includes(MAKOA.public)), message: (j) => j.t('keys-change-hands-event-data-rotated') },
    { id: 'rotated', condition: (j) => rotated(j, 2), message: (j) => j.t('keys-change-hands-event-rotated') },
    { id: 'app-down', condition: (j) => systemd(j)?.services.repairline?.state === 'failed', message: (j) => j.t('keys-change-hands-event-app-down') },
    { id: 'deployed', condition: (j) => deployed(j) && envHolds(j, work(j, '.env')), message: (j) => j.t('keys-change-hands-event-deployed') },
    { id: 'clear-commit', condition: (j) => rotated(j, 2) && inHistory(repo(j), dbPassword(j), STARTING_COMMITS[2]), message: (j) => j.t('keys-change-hands-event-clear-commit') },
    { id: 'committed', condition: committed, message: (j) => j.t('keys-change-hands-event-committed') },
    { id: 'pushed', condition: pushed, message: (j) => j.t('keys-change-hands-event-pushed') },
    {
      id: 'end',
      condition: (j) => pushed(j) && deployed(j) && envPrivate(j) && filesDone(j, working(j)) && !keyShared(j) && !inHistory(repo(j), dbPassword(j), STARTING_COMMITS[2]),
      message: (j) => j.t('keys-change-hands-event-end', { file: name(j.t, 'message_from_ikenna.txt') }),
    },
  ],
};
