// Reaching another machine over ssh (and scp, rsync, ssh-copy-id), like
// OpenSSH (https://man.openbsd.org/ssh, https://man.openbsd.org/ssh_config):
// the client configuration (~/.ssh/config: Host, HostName, User, Port,
// IdentityFile, ProxyJump), name resolution by the machine each jump
// starts from, the host key checked in known_hosts (question on the
// first connection), then authentication: a private key whose public
// key is in the remote account's ~/.ssh/authorized_keys, otherwise the
// password if sshd accepts it (PasswordAuthentication).
// This module serves the machines with the "real" ssh (etat.sshReel) and a
// story's internal machines; the others keep the simplified access
// of commands/ssh.ts (a key given by the game).
// Differences: no agent, no certificates; a single host key (ed25519).

import type { File } from './world';
import type { Shell } from './shell';
import { wildcard } from './tools';
import { base64, hostKey, condensed, fingerprint, MACHINES, WORKSTATION } from './machines';
import { allowed, methods } from './sshd';

export const KEYS_BY_DEFAULT = ['~/.ssh/id_ed25519', '~/.ssh/id_ecdsa', '~/.ssh/id_rsa'];

/** A reachable machine: its name, its full name and its address. */
export interface Host {
  name: string;
  domain: string;
  address: string;
}

/** A jump: where to, under which account, and the remote machine's session. */
export interface Jump {
  user: string;
  // The name as written in known_hosts (HostName, otherwise the alias).
  host: string;
  port: string;
  identities: string[];
  machine: Host;
  shell: Shell;
  // A story machine reached from the workstation (the console opens its chapter).
  story?: string;
}

// ——— Client configuration (ssh_config) ———

/** The "Host" blocks of ~/.ssh/config that apply; the first value found wins. */
export function configuration(game: Shell, alias: string): Record<string, string[]> {
  const options: Record<string, string[]> = {};
  let enabled = false;
  for (const rawValue of (game.read('~/.ssh/config') ?? '').split('\n')) {
    const line = rawValue.trim();
    if (!line || line.startsWith('#')) continue;
    const [key, ...rest] = line.split(/\s+/);
    const value = rest.join(' ');
    if (key.toLowerCase() === 'host') enabled = rest.some((pattern) => wildcard(pattern).test(alias));
    else if (enabled) (options[key.toLowerCase()] ??= []).push(value);
  }
  return options;
}

/** A name → an address, according to the /etc/hosts of the machine looking it up. */
export function resolveName(game: Shell, host: string): string | null {
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return host;
  for (const line of (game.read('/etc/hosts') ?? '').split('\n')) {
    const [address, ...names] = line.replace(/#.*/, '').trim().split(/\s+/);
    if (names.includes(host)) return address;
  }
  return null;
}

// ——— Keys ———

const PUBLIC_HEADER = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI';

/** An ed25519 key pair (fake, but well-formed), derived from a seed. */
export function generateKey(seed: string, comment: string): { isPrivate: string; isPublic: string } {
  const body = base64('cle-generee-' + seed, 70 * 5);
  const isPrivate = [
    '-----BEGIN OPENSSH PRIVATE KEY-----',
    ...body.match(/.{70}/g)!.map((l, i) => (i === 0 ? 'b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW' + l.slice(68) : l)),
    '-----END OPENSSH PRIVATE KEY-----',
  ].join('\n');
  return { isPrivate, isPublic: `${publicFor(isPrivate)} ${comment}` };
}

/** The public key (without comment) that goes with a private key. */
export const publicFor = (isPrivate: string) => `${PUBLIC_HEADER}${base64(condensed(isPrivate.replace(/\s+/g, '')) + '-publique', 43)}`;

// ——— Jumps ———

// The remote session: from the workstation, a story machine; from
// a story (or internal) machine, a machine of its internal network.
function machineInFace(origin: Shell, address: string): { machine: Host; shell: Shell; story?: string } | null {
  if (origin.host === 'desk') {
    const m = MACHINES.find((x) => x.address === address);
    const shell = m && (origin.state.remoteSession?.(m.name) as Shell | undefined);
    return m && shell ? { machine: m, shell, story: m.name } : null;
  }
  const internal = origin.internal_().find((h) => h.address === address);
  const shell = internal && origin.internal(internal.name);
  return internal && shell ? { machine: internal, shell } : null;
}

/**
 * Prepares the jumps to `cible` ([account@]name), going through `saut`
 * (-J, or ProxyJump in ~/.ssh/config): returns the jumps, or ssh's error
 * message.
 */
export function prepare(
  origin: Shell,
  target: string,
  o: { identities?: string[]; port?: string; hop?: string; program?: string } = {},
): Jump[] | string {
  const program = o.program ?? 'ssh';
  const steps: string[] = [];
  const [targetUser, targetAlias] = target.includes('@') ? target.split('@', 2) : [null, target];
  const jumps = o.hop ?? configuration(origin, targetAlias).proxyjump?.[0];
  if (jumps && jumps !== 'none') steps.push(...jumps.split(','));
  steps.push(target);
  const result: Jump[] = [];
  let since = origin;
  for (const [i, step] of steps.entries()) {
    const [givesUser, alias] = step.includes('@') ? step.split('@', 2) : [null, step];
    const config = configuration(origin, alias);
    const last = i === steps.length - 1;
    const host = (config.hostname?.[0] ?? alias).toLowerCase();
    const port = (last ? o.port : '') || config.port?.[0] || '22';
    const address = resolveName(since, host);
    if (!address) return `${program}: Could not resolve hostname ${host}: Name or service not known`;
    if (address === WORKSTATION.address || address.startsWith('127.') || port !== '22')
      return `${program}: connect to host ${host} port ${port}: Connection refused`;
    const inFace = machineInFace(since, address);
    if (!inFace) return `${program}: connect to host ${host} port ${port}: No route to host`;
    result.push({
      user: givesUser ?? (last ? targetUser : null) ?? config.user?.[0] ?? origin.who,
      host,
      port,
      identities: [...(last ? (o.identities ?? []) : []), ...(config.identityfile ?? [])],
      ...inFace,
    });
    since = inFace.shell;
  }
  return result;
}

// ——— Crossing the jumps: host keys, then authentication ———

// An ssh failure: the message (shown even in answer to a question) and exit code 255.
function failure(origin: Shell, text: string): string {
  origin.status = 255;
  return text;
}

const passwordFor = (s: Shell, account: string): string | undefined =>
  (s.state.passwords as Record<string, string> | undefined)?.[account] ?? (account === s.player ? s.playerPassword() : undefined);

// The public keys authorised for this account, on the remote machine.
function allowedKeys(s: Shell, account: string): string[] {
  const home = account === 'root' ? '/root' : (s.accounts.users[account]?.home ?? `/home/${account}`);
  return (s.read(`${home}/.ssh/authorized_keys`) ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split(/\s+/).slice(0, 2).join(' '));
}

// The remote machine keeps track of connections (for the stories): by key, by password.
function note(s: Jump, comment: 'key' | 'password') {
  const connections = (s.shell.state.sshConnections ??= { key: 0, password: 0 }) as Record<string, number>;
  connections[comment]++;
}

// The workstation's public keys, added to the remote player's ~/.ssh/authorized_keys (if not there yet).
function copyKeys(workstation: Shell, s: Shell) {
  const directory = workstation.find('~/.ssh');
  if (directory?.type !== 'directory') return;
  const keys = Object.keys(directory.children)
    .filter((n) => n.endsWith('.pub'))
    .map((n) => (workstation.read(`~/.ssh/${n}`) ?? '').trim())
    .filter((c) => c.startsWith('ssh-'));
  const home = s.accounts.users[s.player]?.home ?? `/home/${s.player}`;
  const path = `${home}/.ssh/authorized_keys`;
  const already = allowedKeys(s, s.player);
  const fresh = keys.filter((c) => !already.includes(c.split(/\s+/).slice(0, 2).join(' ')));
  if (!fresh.length) return;
  const n = s.find(path);
  if (n?.type === 'file') n.content = [s.read(path), ...fresh].filter(Boolean).join('\n');
  else if (s.find(`${home}/.ssh`)?.type === 'directory')
    s.place('ssh', path, { type: 'file', content: fresh.join('\n'), lines: true, owner: s.player, mode: 'rw-------' });
}

const octal = (mode: string) =>
  '0' + [0, 3, 6].map((i) => (mode[i] === 'r' ? 4 : 0) + (mode[i + 1] === 'w' ? 2 : 0) + (mode[i + 2] === 'x' ? 1 : 0)).join('');

/**
 * Goes through each jump (host key, then authentication), asking the
 * necessary questions (yes/no, password); at the end, `suite` receives
 * the jumps and returns what to display. Returns what ssh displays right
 * away.
 */
export function pass(origin: Shell, jumps: Jump[], next: () => string, i = 0): string {
  if (i >= jumps.length) return next();
  const s = jumps[i];
  const file = '~/.ssh/known_hosts';
  const lines = (origin.read(file) ?? '').split('\n');
  // A reinstalled story machine has a new host key (internal machines keep theirs).
  const generation = s.story ? ((origin.state.remoteKey?.(s.machine.name) as string | undefined) ?? '') : '';
  const key = hostKey(s.machine, generation);
  const number = lines.findIndex((l) => l.split(' ')[0].split(',').includes(s.host));
  if (number >= 0) {
    if (!lines.some((l) => l.split(' ')[0].split(',').includes(s.host) && l.endsWith(key)))
      return failure(
        origin,
        [
          '@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@',
          '@    WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!     @',
          '@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@',
          `Host key for ${s.host} has changed and you have requested strict checking.`,
          `Offending ED25519 key in ${origin.resolve(file)}:${number + 1}`,
          'Host key verification failed.',
        ].join('\n'),
      );
    return authenticate(origin, jumps, next, i);
  }
  const ask = (prompt: string) =>
    origin.ask(prompt, (response) => {
      if (response === 'yes' || response === fingerprint(s.machine, generation)) {
        const line = `${s.host} ${key}`;
        const n = origin.find(file);
        if (n?.type === 'file') n.content = [origin.read(file), line].filter(Boolean).join('\n');
        else origin.place('ssh', file, { type: 'file', content: line, lines: true, mode: 'rw-------' });
        return [`Warning: Permanently added '${s.host}' (ED25519) to the list of known hosts.`, authenticate(origin, jumps, next, i)]
          .filter(Boolean)
          .join('\n');
      }
      if (response === 'no') return 'Host key verification failed.';
      ask("Please type 'yes', 'no' or the fingerprint:");
      return '';
    });
  ask('Are you sure you want to continue connecting (yes/no/[fingerprint])?');
  return [
    `The authenticity of host '${s.host} (${s.machine.address})' can't be established.`,
    `ED25519 key fingerprint is ${fingerprint(s.machine, generation)}.`,
    'This key is not known by any other names.',
  ].join('\n');
}

function authenticate(origin: Shell, jumps: Jump[], next: () => string, i: number): string {
  const s = jumps[i];
  const warnings: string[] = [];
  // The configuration applied by the remote sshd (if simulated), otherwise Debian's default.
  const config: Record<string, string> = s.shell.state.sshd?.load ?? {};
  const existsAccount = !!s.shell.accounts.users[s.user];
  const permitted = existsAccount && allowed(config, s.user);
  // The workstation's keys, kept up to date on the story's machines (wherever the connection starts from).
  const workstation = origin.host === 'desk' ? origin : (s.shell.principal.state.workstation?.() as Shell | undefined);
  if (workstation && s.shell.principal.chapter.playerKeys) copyKeys(workstation, s.shell);
  const authorised = allowedKeys(s.shell, s.user);
  const paths = [...new Set([...s.identities, ...KEYS_BY_DEFAULT])];
  const refusal = `${s.user}@${s.host}: Permission denied (${methods(config) || 'publickey'}).`;
  const withValue = (text: string) => [...warnings, text].filter(Boolean).join('\n');

  // After the keys: the password (three tries), if sshd accepts it.
  const password = (): string => {
    if (config.passwordauthentication !== 'yes') return failure(origin, withValue(refusal));
    const attempt = (trial: number) =>
      origin.ask(
        `${s.user}@${s.host}'s password:`,
        (response) => {
          if (permitted && response === passwordFor(s.shell, s.user)) {
            note(s, 'password');
            return pass(origin, jumps, next, i + 1);
          }
          if (trial >= 3) return failure(origin, refusal);
          attempt(trial + 1);
          return 'Permission denied, please try again.';
        },
        true,
      );
    attempt(1);
    return withValue('');
  };

  // The keys, one by one: those requested (-i, IdentityFile), then the default ones.
  const key = (k: number): string => {
    if (k >= paths.length) return password();
    const path = paths[k];
    const n = origin.find(path);
    if (!n || n.type !== 'file') {
      if (s.identities.includes(path)) warnings.push(`Warning: Identity file ${path} not accessible: No such file or directory.`);
      return key(k + 1);
    }
    const mode = n.mode ?? 'rw-r--r--';
    if (mode.slice(3) !== '------') {
      warnings.push(
        '@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@',
        '@         WARNING: UNPROTECTED PRIVATE KEY FILE!          @',
        '@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@',
        `Permissions ${octal(mode)} for '${origin.resolve(path)}' are too open.`,
        'It is required that your private key files are NOT accessible by others.',
        'This private key will be ignored.',
      );
      return key(k + 1);
    }
    const text = (n as File).content;
    if (!permitted || typeof text !== 'string' || !authorised.includes(publicFor(text))) return key(k + 1);
    // A key protected by a passphrase: ssh asks for it before using it.
    const phrase = (origin.state.passPhrases as Record<string, string> | undefined)?.[origin.resolve(path)];
    if (!phrase) {
      note(s, 'key');
      return withValue(pass(origin, jumps, next, i + 1));
    }
    origin.ask(
      `Enter passphrase for key '${origin.resolve(path)}':`,
      (response) => {
        if (response !== phrase) return key(k + 1);
        note(s, 'key');
        return pass(origin, jumps, next, i + 1);
      },
      true,
    );
    return withValue('');
  };
  return key(0);
}

/**
 * A connection with no question (like ssh -o BatchMode=yes, which is what
 * Ansible does): the host key must already be in known_hosts, and a private
 * key without a passphrase must be authorised on the other side. Returns the
 * remote session, or ssh's error message.
 */
export function connectWithoutQuestion(origin: Shell, target: string, checkHostKey = true): { shell: Shell } | { error: string } {
  const jumps = prepare(origin, target);
  if (typeof jumps === 'string') return { error: jumps };
  const lines = (origin.read('~/.ssh/known_hosts') ?? '').split('\n');
  for (const s of jumps) {
    const key = hostKey(s.machine, '');
    const known = lines.filter((l) => l.split(' ')[0].split(',').includes(s.host));
    if (checkHostKey && !known.length) return { error: 'Host key verification failed.' };
    if (checkHostKey && !known.some((l) => l.endsWith(key))) return { error: `Host key for ${s.host} has changed and you have requested strict checking.\nHost key verification failed.` };
    const config: Record<string, string> = s.shell.state.sshd?.load ?? {};
    const permitted = !!s.shell.accounts.users[s.user] && allowed(config, s.user);
    const authorised = allowedKeys(s.shell, s.user);
    const phrases = (origin.state.passPhrases as Record<string, string> | undefined) ?? {};
    const ok = [...new Set([...s.identities, ...KEYS_BY_DEFAULT])].some((path) => {
      const n = origin.find(path);
      if (!n || n.type !== 'file' || typeof n.content !== 'string') return false;
      if ((n.mode ?? 'rw-r--r--').slice(3) !== '------' || phrases[origin.resolve(path)]) return false;
      return permitted && authorised.includes(publicFor(n.content));
    });
    if (!ok) return { error: `${s.user}@${s.host}: Permission denied (${methods(config) || 'publickey'}).` };
    note(s, 'key');
  }
  return { shell: jumps.at(-1)!.shell };
}
