// Copier vers une autre machine : ssh-copy-id (installer sa clé publique
// dans ~/.ssh/authorized_keys d'en face) et scp (copier des fichiers par
// ssh). D'après https://man.openbsd.org/scp et ssh-copy-id(1) (paquet
// openssh-client de Debian). Les sauts, les clés d'hôte et
// l'authentification passent par ../acces.ts.
// Écarts : scp copie entre la machine où l'on est et une seule autre ; pas
// d'options de vitesse ni de compression ; la barre de progression est
// immédiate.

import type { Directory, File, Node } from '../world';
import type { Shell } from '../shell';
import { pass, prepare, publicFor } from '../access';
import { content, readable, sizeFor } from '../tools';
import type { Command } from './index';

const ID_COPY_SSH_NAME = '/usr/bin/ssh-copy-id';

// La clé publique à installer : -i (avec ou sans .pub), sinon la plus récente de ~/.ssh/id_*.pub.
function chosenPublicKey(game: Shell, data?: string): string | null {
  if (data) return data.endsWith('.pub') ? data : `${data}.pub`;
  const ssh = game.find('~/.ssh');
  if (ssh?.type !== 'directory') return null;
  const pub = Object.keys(ssh.children).filter((n) => /^id_.*\.pub$/.test(n));
  return pub.includes('id_ed25519.pub') ? '~/.ssh/id_ed25519.pub' : pub.length ? `~/.ssh/${pub[0]}` : null;
}

function sshCopyId(game: Shell, args: string[]): string {
  const value = (o: string) => (args.includes(o) ? args[args.indexOf(o) + 1] : undefined);
  const target = args.filter((a, i) => !a.startsWith('-') && !['-i', '-p', '-J'].includes(args[i - 1])).at(-1);
  if (!target)
    return game.error(
      'Usage: /usr/bin/ssh-copy-id [-h|-?|-f|-n|-s|-x] [-i [identity_file]] [-p port] [-F alternative ssh_config file] [-t target_path] [[-o <ssh -o options>] ...] [user@]hostname',
    );
  const file = chosenPublicKey(game, value('-i'));
  const text = file ? game.read(file) : null;
  if (!file || !text) return game.error(`${ID_COPY_SSH_NAME}: ERROR: No identities found`);
  const jumps = prepare(game, target, { port: value('-p'), hop: value('-J') });
  if (typeof jumps === 'string') return game.error(jumps);
  const d = jumps.at(-1)!;
  const key = text.trim();
  const start = [
    `${ID_COPY_SSH_NAME}: INFO: Source of key(s) to be installed: "${game.resolve(file)}"`,
    `${ID_COPY_SSH_NAME}: INFO: attempting to log in with the new key(s), to filter out any that are already installed`,
  ];
  const home = d.user === 'root' ? '/root' : (d.shell.accounts.users[d.user]?.home ?? `/home/${d.user}`);
  const allowed = (d.shell.read(`${home}/.ssh/authorized_keys`) ?? '').split('\n').map((l) => l.split(/\s+/).slice(0, 2).join(' '));
  if (allowed.includes(key.split(/\s+/).slice(0, 2).join(' ')))
    return [
      ...start,
      '',
      `${ID_COPY_SSH_NAME}: WARNING: All keys were skipped because they already exist on the remote system.`,
      '\t\t(if you think this is a mistake, you may want to use -f option)',
      '',
    ].join('\n');
  start.push(`${ID_COPY_SSH_NAME}: INFO: 1 key(s) remain to be installed -- if you are prompted now it is to install the new keys`);
  const output = pass(game, jumps, () => {
    // Comme le script : mkdir -p ~/.ssh (700), puis la clé ajoutée à authorized_keys (600), au nom du compte d'en face.
    const s = d.shell;
    const before = s.who;
    s.who = d.user;
    try {
      if (!s.exists(`${home}/.ssh`))
        s.place('mkdir', `${home}/.ssh`, { type: 'directory', children: {}, owner: d.user, mode: 'rwx------' });
      const n = s.find(`${home}/.ssh/authorized_keys`);
      if (n?.type === 'file') n.content = [s.read(`${home}/.ssh/authorized_keys`), key].filter(Boolean).join('\n');
      else
        s.place('ssh-copy-id', `${home}/.ssh/authorized_keys`, {
          type: 'file',
          content: key,
          lines: true,
          owner: d.user,
          mode: 'rw-------',
        });
    } finally {
      s.who = before;
    }
    return [
      '',
      'Number of key(s) added: 1',
      '',
      `Now try logging into the machine, with:   "ssh '${d.user}@${d.host}'"`,
      'and check to make sure that only the key(s) you wanted were added.',
      '',
    ].join('\n');
  });
  return [...start, output].filter((l) => l !== undefined).join('\n');
}

// « [compte@]machine:chemin » (un chemin local peut contenir « : » s'il commence par / ou ./).
const remote = (text: string) =>
  /^[^/.][^/]*:/.test(text) ? { target: text.slice(0, text.indexOf(':')), path: text.slice(text.indexOf(':') + 1) } : null;

/** Copier `chemin` de la machine `src` vers `dest` sur `dst` (récursif avec -r) ; renvoie les lignes de scp. */
export function copy(src: Shell, dst: Shell, path: string, dest: string, recursive: boolean, errors: string[]): string[] {
  const n = src.find(path);
  const absolute = src.resolve(path);
  if (!n) {
    errors.push(`scp: ${absolute}: No such file or directory`);
    return [];
  }
  if (n.type === 'directory' && !recursive) {
    errors.push(`scp: ${absolute}: not a regular file`);
    return [];
  }
  const name = absolute.split('/').at(-1)!;
  const existsTarget = dst.find(dest);
  const destination = existsTarget?.type === 'directory' ? `${dst.resolve(dest)}/${name}` : dst.resolve(dest);
  const lines: string[] = [];
  const put = (source: Node, to: string) => {
    if (source.type === 'directory') {
      if (!src.can(source, 'r') || !src.can(source, 'x')) return void errors.push(`scp: ${to}: Permission denied`);
      if (dst.find(to)?.type !== 'directory') {
        const e = dst.place('scp', to, { type: 'directory', children: {}, owner: dst.who });
        if (e) return void errors.push(`scp: ${to}: Permission denied`);
      }
      for (const [k, e] of Object.entries((source as Directory).children)) put(e, `${to}/${k}`);
      return;
    }
    const f = source as File;
    if (!src.can(f, 'r')) return void errors.push(`scp: ${src.resolve(path)}: Permission denied`);
    const copyOf: File = {
      type: 'file',
      content: content(f, src),
      lines: f.lines,
      prose: f.prose,
      size: f.size,
      owner: dst.who,
      mode: f.mode,
      mtime: f.mtime,
    };
    const old = dst.find(to);
    const e =
      old?.type === 'file' && dst.can(old, 'w')
        ? (Object.assign(old, { content: copyOf.content, size: copyOf.size }), null)
        : dst.place('scp', to, copyOf);
    if (e) return void errors.push(`scp: ${to}: Permission denied`);
    const size = sizeFor(f, src);
    lines.push(`${to.split('/').at(-1)!.padEnd(40)} 100% ${readable(size, 'en').padStart(5)}  ${readable(size * 4, 'en')}B/s   00:00`);
  };
  put(n, destination);
  return lines;
}

function scp(game: Shell, args: string[]): string {
  let recursive = false;
  let port: string | undefined;
  let hop: string | undefined;
  const identities: string[] = [];
  const paths: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-P' || a === '-J' || a === '-i') {
      const v = args[++i];
      if (v === undefined) return game.error(`scp: option requires an argument -- ${a.slice(1)}`);
      if (a === '-P') port = v;
      else if (a === '-J') hop = v;
      else identities.push(v);
    } else if (/^-[rpqC]+$/.test(a)) recursive ||= a.includes('r');
    else if (a.startsWith('-'))
      return game.error(
        `scp: unknown option -- ${a.slice(1)}\nusage: scp [-346ABCOpqRrsTv] [-c cipher] [-D sftp_server_path] [-F ssh_config]\n           [-i identity_file] [-J destination] [-l limit] [-o ssh_option]\n           [-P port] [-S program] [-X sftp_option] source ... target`,
      );
    else paths.push(a);
  }
  if (paths.length < 2)
    return game.error(
      'usage: scp [-346ABCOpqRrsTv] [-c cipher] [-D sftp_server_path] [-F ssh_config]\n           [-i identity_file] [-J destination] [-l limit] [-o ssh_option]\n           [-P port] [-S program] [-X sftp_option] source ... target',
    );
  const dest = paths.pop()!;
  const toRemote = remote(dest);
  const since = paths.map(remote);
  const other = toRemote ?? since.find(Boolean);
  // Sans machine d'en face : une simple copie locale, comme cp.
  if (!other) return game.error(game.t('scp-local'));
  if (toRemote && since.some(Boolean)) return game.error(game.t('scp-two-remote'));
  const jumps = prepare(game, other.target, { identities, port, hop, program: 'ssh' });
  if (typeof jumps === 'string') return game.error(jumps);
  const d = jumps.at(-1)!;
  return pass(game, jumps, () => {
    const errors: string[] = [];
    const lines: string[] = [];
    const before = d.shell.who;
    const cwd = d.shell.cwd;
    d.shell.who = d.user;
    d.shell.cwd = d.shell.home;
    try {
      if (toRemote) for (const c of paths) lines.push(...copy(game, d.shell, c, toRemote.path || '.', recursive, errors));
      else for (const c of since) lines.push(...copy(d.shell, game, c!.path || '.', dest, recursive, errors));
    } finally {
      d.shell.who = before;
      d.shell.cwd = cwd;
    }
    if (errors.length) game.status = 1;
    return [...lines, ...errors].join('\n');
  });
}

export const TRANSFERS: Record<string, Command> = {
  'ssh-copy-id': { ownOptions: true, launch: ({ args, game }) => sshCopyId(game, args) },
  scp: { ownOptions: true, launch: ({ args, game }) => scp(game, args) },
};

// Pour rsync vers ou depuis une autre machine (sauvegarde.ts).
export { remote as remotePath };
