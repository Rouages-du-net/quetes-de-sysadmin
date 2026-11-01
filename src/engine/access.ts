// Joindre une autre machine en ssh (et scp, rsync, ssh-copy-id), comme
// OpenSSH (https://man.openbsd.org/ssh, https://man.openbsd.org/ssh_config) :
// la configuration du client (~/.ssh/config : Host, HostName, User, Port,
// IdentityFile, ProxyJump), la résolution du nom par la machine d'où part
// chaque saut, la clé d'hôte vérifiée dans known_hosts (question à la
// première connexion), puis l'authentification : une clé privée dont la clé
// publique est dans ~/.ssh/authorized_keys du compte d'en face, sinon le
// mot de passe si sshd l'accepte (PasswordAuthentication).
// Ce module sert les machines au « vrai » ssh (etat.sshReel) et les
// machines internes d'une histoire ; les autres gardent l'accès simplifié
// de commands/ssh.ts (une clé donnée par le jeu).
// Écarts : ni agent, ni certificats ; une seule clé d'hôte (ed25519).

import type { File } from './world';
import type { Shell } from './shell';
import { wildcard } from './tools';
import { base64, hostKey, condensed, fingerprint, MACHINES, WORKSTATION } from './machines';
import { allowed, methods } from './sshd';

export const KEYS_BY_DEFAULT = ['~/.ssh/id_ed25519', '~/.ssh/id_ecdsa', '~/.ssh/id_rsa'];

/** Une machine joignable : son nom, son nom complet et son adresse. */
export interface Host {
  name: string;
  domain: string;
  address: string;
}

/** Un saut : où l'on va, sous quel compte, et la session de la machine d'en face. */
export interface Jump {
  user: string;
  // Le nom tel qu'il est écrit dans known_hosts (HostName, sinon l'alias).
  host: string;
  port: string;
  identities: string[];
  machine: Host;
  shell: Shell;
  // Une machine d'histoire jointe depuis le poste (la console ouvre son chapitre).
  story?: string;
}

// ——— Configuration du client (ssh_config) ———

/** Les blocs « Host » de ~/.ssh/config qui s'appliquent ; la première valeur trouvée l'emporte. */
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

/** Un nom → une adresse, d'après /etc/hosts de la machine qui cherche. */
export function resolveName(game: Shell, host: string): string | null {
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return host;
  for (const line of (game.read('/etc/hosts') ?? '').split('\n')) {
    const [address, ...names] = line.replace(/#.*/, '').trim().split(/\s+/);
    if (names.includes(host)) return address;
  }
  return null;
}

// ——— Clés ———

const PUBLIC_HEADER = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI';

/** Une paire de clés ed25519 (fausse, mais de la bonne forme), tirée d'une graine. */
export function generateKey(seed: string, comment: string): { isPrivate: string; isPublic: string } {
  const body = base64('cle-generee-' + seed, 70 * 5);
  const isPrivate = [
    '-----BEGIN OPENSSH PRIVATE KEY-----',
    ...body.match(/.{70}/g)!.map((l, i) => (i === 0 ? 'b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW' + l.slice(68) : l)),
    '-----END OPENSSH PRIVATE KEY-----',
  ].join('\n');
  return { isPrivate, isPublic: `${publicFor(isPrivate)} ${comment}` };
}

/** La clé publique (sans commentaire) qui va avec une clé privée. */
export const publicFor = (isPrivate: string) => `${PUBLIC_HEADER}${base64(condensed(isPrivate.replace(/\s+/g, '')) + '-publique', 43)}`;

// ——— Les sauts ———

// La session d'en face : depuis le poste, une machine d'histoire ; depuis
// une machine d'histoire (ou interne), une machine de son réseau interne.
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
 * Prépare les sauts vers `cible` ([compte@]nom), en passant par `saut`
 * (-J, ou ProxyJump de ~/.ssh/config) : renvoie les sauts, ou le message
 * d'erreur de ssh.
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

// ——— Franchir les sauts : clés d'hôte, puis authentification ———

// Un échec de ssh : le message (affiché même en réponse à une question) et le code 255.
function failure(origin: Shell, text: string): string {
  origin.status = 255;
  return text;
}

const passwordFor = (s: Shell, account: string): string | undefined =>
  (s.state.passwords as Record<string, string> | undefined)?.[account] ?? (account === s.player ? s.playerPassword() : undefined);

// Les clés publiques autorisées pour ce compte, sur la machine d'en face.
function allowedKeys(s: Shell, account: string): string[] {
  const home = account === 'root' ? '/root' : (s.accounts.users[account]?.home ?? `/home/${account}`);
  return (s.read(`${home}/.ssh/authorized_keys`) ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split(/\s+/).slice(0, 2).join(' '));
}

// La machine d'en face garde trace des connexions (pour les histoires) : par clé, par mot de passe.
function note(s: Jump, comment: 'key' | 'password') {
  const connections = (s.shell.state.sshConnections ??= { key: 0, password: 0 }) as Record<string, number>;
  connections[comment]++;
}

// Les clés publiques du poste, ajoutées à ~/.ssh/authorized_keys du joueur en face (si elles n'y sont pas).
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
 * Passe chaque saut (clé d'hôte, puis authentification), en posant les
 * questions nécessaires (yes/no, mot de passe) ; à la fin, `suite` reçoit
 * les sauts et rend ce qu'il faut afficher. Renvoie ce que ssh affiche tout
 * de suite.
 */
export function pass(origin: Shell, jumps: Jump[], next: () => string, i = 0): string {
  if (i >= jumps.length) return next();
  const s = jumps[i];
  const file = '~/.ssh/known_hosts';
  const lines = (origin.read(file) ?? '').split('\n');
  // Une machine d'histoire réinstallée a changé de clé d'hôte (les machines internes gardent la leur).
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
  // La configuration appliquée par sshd d'en face (s'il est simulé), sinon celle par défaut de Debian.
  const config: Record<string, string> = s.shell.state.sshd?.load ?? {};
  const existsAccount = !!s.shell.accounts.users[s.user];
  const permitted = existsAccount && allowed(config, s.user);
  // Les clés du poste, tenues à jour sur les machines de l'histoire (d'où que parte la connexion).
  const workstation = origin.host === 'desk' ? origin : (s.shell.principal.state.workstation?.() as Shell | undefined);
  if (workstation && s.shell.principal.chapter.playerKeys) copyKeys(workstation, s.shell);
  const authorised = allowedKeys(s.shell, s.user);
  const paths = [...new Set([...s.identities, ...KEYS_BY_DEFAULT])];
  const refusal = `${s.user}@${s.host}: Permission denied (${methods(config) || 'publickey'}).`;
  const withValue = (text: string) => [...warnings, text].filter(Boolean).join('\n');

  // Après les clés : le mot de passe (trois essais), si sshd l'accepte.
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

  // Les clés, une à une : celles demandées (-i, IdentityFile), puis celles par défaut.
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
    // Une clé protégée par une phrase de passe : ssh la demande avant de s'en servir.
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
 * Une connexion sans question (comme ssh -o BatchMode=yes, ce que fait
 * Ansible) : la clé d'hôte doit déjà être dans known_hosts, et une clé
 * privée sans phrase de passe doit être autorisée en face. Renvoie la
 * session d'en face, ou le message d'erreur de ssh.
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
