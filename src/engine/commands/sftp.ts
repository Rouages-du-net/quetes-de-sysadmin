// sftp : transférer des fichiers par SSH, de façon interactive (sftp> ),
// comme le client d'OpenSSH. Les sauts, les clés d'hôte et
// l'authentification passent par ../acces.ts, comme ssh et scp.
// Sources : https://man.openbsd.org/sftp
// Écarts : les commandes courantes seulement (ls, cd, pwd, lcd, lls, lpwd,
// get, put, mkdir, rm, rmdir, rename, help, bye) ; pas de -b (fichier de
// commandes), de reget/reput ni de jokers.

import type { Shell } from '../shell';
import { pass, prepare } from '../access';
import { copy } from './transfers';
import type { Command } from './index';

interface SessionSftp {
  remote: Shell;
  user: string;
  remoteCwd: string;
  cwdLocal: string;
}

// Agir sur la machine d'en face, sous le compte de la connexion, dans le dossier distant.
function inFace<T>(s: SessionSftp, run: (d: Shell) => T): T {
  const d = s.remote;
  const [who, cwd] = [d.who, d.cwd];
  d.who = s.user;
  d.cwd = s.remoteCwd;
  try {
    return run(d);
  } finally {
    d.who = who;
    d.cwd = cwd;
  }
}

function atSelf<T>(game: Shell, s: SessionSftp, run: () => T): T {
  const cwd = game.cwd;
  game.cwd = s.cwdLocal;
  try {
    return run();
  } finally {
    game.cwd = cwd;
  }
}

/** Une commande sftp ; renvoie ce qu'elle affiche, ou null pour quitter. */
function sftpCommand(game: Shell, s: SessionSftp, line: string): string | null {
  const [cmd, ...args] = line.trim().split(/\s+/);
  if (!cmd) return '';
  const options = args.filter((a) => a.startsWith('-'));
  const [a, b] = args.filter((x) => !x.startsWith('-'));
  const recursive = options.some((o) => o.includes('r') || o.includes('R'));
  switch (cmd) {
    case 'bye':
    case 'exit':
    case 'quit':
      return null;
    case 'pwd':
      return `Remote working directory: ${s.remoteCwd}`;
    case 'lpwd':
      return `Local working directory: ${s.cwdLocal}`;
    case 'cd': {
      const target = inFace(s, (d) => d.resolve(a ?? '~'));
      const n = inFace(s, (d) => d.find(target));
      if (!n) return game.error(`stat remote: No such file or directory`, 1);
      if (n.type !== 'dossier') return game.error(`Can't change directory: "${target}" is not a directory`, 1);
      if (!inFace(s, (d) => d.traverses(target) && d.can(n, 'x'))) return game.error(`remote open("${target}"): Permission denied`, 1);
      s.remoteCwd = target;
      return '';
    }
    case 'lcd': {
      const target = atSelf(game, s, () => game.resolve(a ?? '~'));
      if (game.find(target)?.type !== 'dossier') return game.error(`Couldn't change local directory to "${target}": No such file or directory`, 1);
      s.cwdLocal = target;
      return '';
    }
    case 'ls':
    case 'dir':
      return inFace(s, (d) => {
        const r = d.underCommand(['ls', ...args].join(' '), s.remoteCwd);
        return r.output;
      });
    case 'lls':
      return game.underCommand(['ls', ...args].join(' '), s.cwdLocal).output;
    case 'get':
    case 'put': {
      if (!a) return game.error(`You must specify at least one path after a ${cmd} command.`, 1);
      const errors: string[] = [];
      const toRemote = cmd === 'put';
      const source = toRemote ? atSelf(game, s, () => game.resolve(a)) : inFace(s, (d) => d.resolve(a));
      const name = source.split('/').at(-1)!;
      const n = toRemote ? game.find(source) : inFace(s, (d) => d.find(source));
      if (!n) return game.error(toRemote ? `stat ${source}: No such file or directory` : `File "${source}" not found.`, 1);
      if (n.type === 'dossier' && !recursive)
        return game.error(toRemote ? `Skipping non-regular file ${source}` : `Cannot download non-regular file: ${source}`, 1);
      const dest = toRemote ? inFace(s, (d) => d.resolve(b ?? name)) : atSelf(game, s, () => game.resolve(b ?? name));
      const lines = toRemote
        ? [`Uploading ${source}${n.type === 'dossier' ? '/' : ''} to ${dest}`, ...(n.type === 'dossier' ? [`Entering ${source}/`] : [])]
        : [`Fetching ${source}${n.type === 'dossier' ? '/' : ''} to ${b ?? name}`, ...(n.type === 'dossier' ? [`Retrieving ${source}`] : [])];
      // Comme sftp : un dossier qui existe déjà de l'autre côté reçoit le contenu (scp, lui, emboîterait).
      const cote = toRemote ? inFace(s, (d) => d.find(dest)) : atSelf(game, s, () => game.find(dest));
      const children =
        n.type === 'dossier' && cote?.type === 'dossier' ? Object.keys(n.children).map((k) => [`${source}/${k}`, dest]) : [[source, dest]];
      const copyOf = children.flatMap(([forEachOf, to]) =>
        toRemote
          ? atSelf(game, s, () => inFace(s, (d) => copy(game, d, forEachOf, to, recursive, errors)))
          : atSelf(game, s, () => inFace(s, (d) => copy(d, game, forEachOf, to, recursive, errors))),
      );
      errors.forEach((e) => game.error(e.replace(/^scp: /, ''), 1));
      return [...lines, ...copyOf].join('\n');
    }
    case 'mkdir':
      return inFace(s, (d) => {
        if (!a) return game.error('You must specify a path after a mkdir command.', 1);
        const path = d.resolve(a);
        if (d.find(path)) return game.error(`remote mkdir "${path}": Failure`, 1);
        const e = d.place('mkdir', path, { type: 'dossier', children: {}, owner: s.user });
        return e ? game.error(`remote mkdir "${path}": Permission denied`, 1) : '';
      });
    case 'rm':
    case 'rmdir':
      return inFace(s, (d) => {
        if (!a) return game.error(`You must specify a path after a ${cmd} command.`, 1);
        const path = d.resolve(a);
        const n = d.find(path);
        if (!n) return game.error(`${cmd === 'rm' ? 'Remove' : 'Delete directory'} ${path}: No such file or directory`, 1);
        if (cmd === 'rm' && n.type === 'dossier') return game.error(`Remove ${path}: Failure`, 1);
        if (cmd === 'rmdir' && (n.type !== 'dossier' || Object.keys(n.children).length)) return game.error(`Delete directory ${path}: Failure`, 1);
        const parent = d.find(path.split('/').slice(0, -1).join('/') || '/');
        if (!parent || !d.can(parent, 'w')) return game.error(`${cmd === 'rm' ? 'Remove' : 'Delete directory'} ${path}: Permission denied`, 1);
        d.erase(path);
        return cmd === 'rm' ? `Removing ${path}` : '';
      });
    case 'rename':
      return inFace(s, (d) => {
        if (!a || !b) return game.error('You must specify two paths after a rename command.', 1);
        const r = d.underCommand(`mv ${a} ${b}`, s.remoteCwd);
        return r.ok ? '' : game.error(`rename ${d.resolve(a)}: Failure`, 1);
      });
    case 'help':
    case '?':
      return game.t('sftp-help');
    default:
      return game.error('Invalid command.', 1);
  }
}

function loop(game: Shell, s: SessionSftp) {
  const who = game.who;
  game.ask('sftp> ', (line) => {
    const before = game.who;
    game.who = who;
    try {
      const output = sftpCommand(game, s, line);
      if (output !== null) loop(game, s);
      return [...game.recoverErrors(), output ?? ''].filter(Boolean).join('\n');
    } finally {
      game.who = before;
    }
  });
}

function sftp(game: Shell, args: string[]): string {
  let port: string | undefined;
  let hop: string | undefined;
  const identities: string[] = [];
  const rest: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-P' || a === '-J' || a === '-i') {
      const v = args[++i];
      if (v === undefined) return game.error(`sftp: option requires an argument -- ${a.slice(1)}`, 1);
      if (a === '-P') port = v;
      else if (a === '-J') hop = v;
      else identities.push(v);
    } else if (/^-[rpqC]+$/.test(a)) continue;
    else if (a.startsWith('-')) return game.error(`sftp: unknown option -- ${a.slice(1)}\n${game.t('sftp-usage')}`, 1);
    else rest.push(a);
  }
  if (rest.length !== 1) return game.error(game.t('sftp-usage'), 1);
  const [target, path] = rest[0].includes(':')
    ? [rest[0].slice(0, rest[0].indexOf(':')), rest[0].slice(rest[0].indexOf(':') + 1)]
    : [rest[0], ''];
  const jumps = prepare(game, target, { identities, port, hop, program: 'ssh' });
  if (typeof jumps === 'string') return game.error(`${jumps}\nConnection closed`, 255);
  const d = jumps.at(-1)!;
  return pass(game, jumps, () => {
    const home = d.user === 'root' ? '/root' : (d.shell.accounts.users[d.user]?.home ?? `/home/${d.user}`);
    const s: SessionSftp = { remote: d.shell, user: d.user, remoteCwd: home, cwdLocal: game.cwd };
    if (path) {
      const r = sftpCommand(game, s, `cd ${path}`);
      if (r === null) return '';
    }
    loop(game, s);
    return `Connected to ${target.split('@').at(-1)}.`;
  });
}

export const SFTP: Record<string, Command> = { sftp: { ownOptions: true, launch: ({ args, game }) => sftp(game, args) } };
