// lftp, le client FTP (et FTPS) en ligne de commande, vers un hébergement
// mutualisé simulé (../hebergeur.ts). Une session interactive (lftp> ), ou
// des commandes données par -c et -e. Sorties en anglais, comme lftp 4.9.
// Par défaut, lftp chiffre (ftp:ssl-allow yes : AUTH TLS) et vérifie le
// certificat (ssl:verify-certificate yes) : le nom demandé doit être celui
// du certificat.
// Sources : https://lftp.yar.ru/lftp-man.html
// Écarts : FTP seulement (pas de SFTP ni de HTTP par lftp), pas de
// ~/.lftprc ni de ~/.netrc, pas de transferts en arrière-plan ni de
// file d'attente ; la connexion se fait à la première commande distante.

import type { Directory, File, Node } from '../world';
import type { Shell } from '../shell';
import { content } from '../tools';
import { covers, definition, filesFor, hosting, node, normalise, type HostingDef } from '../web-host';
import type { Command } from './index';

interface Session {
  host: string | null;
  user: string | null;
  password: string | null;
  connected: boolean;
  remote: string;
  local: string;
  settings: Record<string, string>;
  // La connexion en cours : chiffrée, certificat vérifié.
  tls: boolean;
  checked: boolean;
}

const TRUE = (v: string | undefined) => /^(yes|on|true|1)$/i.test(v ?? '');

// Les arguments d'une ligne lftp (guillemets simples ou doubles).
const words = (line: string) => (line.match(/"[^"]*"|'[^']*'|\S+/g) ?? []).map((m) => m.replace(/^(['"])(.*)\1$/, '$2'));

// Les commandes séparées par « ; » (dans -c et -e).
const commands = (text: string) =>
  text
    .split(';')
    .map((c) => c.trim())
    .filter(Boolean);

/** Se connecter (à la première commande distante) : le nom, TLS, le certificat, le compte. Renvoie l'erreur, ou null. */
function connect(game: Shell, s: Session, command: string): string | null {
  if (s.connected) return null;
  if (!s.host) return `${command}: Not connected`;
  const d = definition(s.host);
  if (!d) return `${command}: ${s.host}: Name or service not known`;
  const [key, def] = d;
  const tls = s.settings['ftp:ssl-allow'] !== 'no';
  const checked = s.settings['ssl:verify-certificate'] !== 'no';
  const refusal = (what: string) => ((game.state.ftpRefusal ??= []) as string[]).push(what);
  if (!tls) {
    refusal('plain');
    return `${command}: Login failed: 421 Sorry, cleartext sessions and weak ciphers are not accepted on this server.\nPlease reconnect using TLS security mechanisms.`;
  }
  if (checked && !covers(def.certificate, s.host)) {
    refusal('certificate');
    return `${command}: Fatal error: Certificate verification: certificate common name doesn't match requested host name \u2018${s.host}\u2019`;
  }
  if (!s.user || def.accounts[s.user] !== s.password) return `${command}: Login failed: 530 Login authentication failed`;
  s.connected = true;
  s.tls = tls;
  s.checked = checked;
  hosting(game, key).log.push({ account: s.user, tls, checked, send: false });
  return null;
}

const rootFor = (game: Shell, s: Session): Directory => {
  const [key] = definition(s.host!)!;
  return hosting(game, key).roots[s.user!];
};

const date = 'Nov 08 08:15';
function lsLine(name: string, n: Node, account: string): string {
  const size = n.type === 'directory' ? 4096 : typeof n.content === 'string' ? n.content.length : 0;
  return `${n.type === 'directory' ? 'drwxr-xr-x' : '-rw-r--r--'}   ${n.type === 'directory' ? 2 : 1} ${account.padEnd(8)} ${account.padEnd(8)} ${String(size).padStart(8)} ${date} ${name}`;
}

// Copier un dossier (et ses fichiers) d'un côté à l'autre : mirror.
interface Summary {
  directories: number;
  fresh: number;
  modified: number;
  removed: number;
  bytes: number;
  lines: string[];
}

function mirror(game: Shell, s: Session, args: string[]): string {
  const inverse = args.some((a) => a === '-R' || a === '--reverse');
  const erase = args.includes('--delete') || args.includes('-e');
  const trial = args.includes('--dry-run');
  const verbose = args.some((a) => /^-v+$/.test(a) || a === '--verbose');
  const unknown = args.find(
    (a) => a.startsWith('-') && !['-R', '--reverse', '--delete', '-e', '--dry-run', '--verbose'].includes(a) && !/^-v+$/.test(a),
  );
  if (unknown) return game.error(`mirror: invalid option -- '${unknown.replace(/^-+/, '')}'\nTry ` + "`help mirror'" + ' for more information.', 1);
  const [source, target] = args.filter((a) => !a.startsWith('-'));
  const e = connect(game, s, 'mirror');
  if (e) return game.error(e, 1);
  const root = rootFor(game, s);
  const summary: Summary = { directories: 0, fresh: 0, modified: 0, removed: 0, bytes: 0, lines: [] };
  if (inverse) {
    // Local → distant.
    const src = game.resolve(source ? (source.startsWith('/') ? source : `${s.local}/${source}`) : s.local);
    const n = game.find(src);
    if (n?.type !== 'directory') return game.error(`mirror: ${source ?? src}: No such file or directory`, 1);
    const dest = normalise(s.remote, target ?? src.split('/').at(-1)!);
    walkLocal(
      game,
      n,
      '',
      (rel, f) => {
        const text = content(f, game);
        const before = node(root, `${dest}/${rel}`);
        if (before?.type === 'file' && before.content === text) return;
        if (before) summary.modified++;
        else summary.fresh++;
        summary.bytes += text.length;
        const directory = rel.includes('/') ? `${dest}/${rel.split('/').slice(0, -1).join('/')}` : dest;
        summary.lines.push(trial ? `put -O ${directory} ${src}/${rel}` : `Transferring file \`${rel}'`);
        if (!trial) remoteDirectory(root, directory).children[rel.split('/').at(-1)!] = { type: 'file', content: text, lines: true };
      },
      (rel) => {
        summary.directories++;
        if (!trial) remoteDirectory(root, rel ? `${dest}/${rel}` : dest);
      },
    );
    if (erase) {
      const remaining = filesFor(root, dest) ?? {};
      for (const rel of Object.keys(remaining)) {
        if (game.find(`${src}/${rel}`)) continue;
        summary.removed++;
        summary.lines.push(trial ? `rm ${dest}/${rel}` : `Removing old file \`${rel}'`);
        if (!trial) remove(root, `${dest}/${rel}`);
      }
    }
    if (!trial) {
      const [key] = definition(s.host!)!;
      const log = hosting(game, key).log;
      log.push({ account: s.user!, tls: s.tls, checked: s.checked, send: true });
    }
  } else {
    // Distant → local.
    const src = normalise(s.remote, source ?? '.');
    const n = node(root, src);
    if (n?.type !== 'directory') return game.error(`mirror: Access failed: 550 Can't change directory to ${src}: No such file or directory`, 1);
    const dest = game.resolve(target ? (target.startsWith('/') ? target : `${s.local}/${target}`) : `${s.local}/${src.split('/').at(-1) || 'ftp'}`);
    for (const [rel, text] of Object.entries(filesFor(root, src) ?? {})) {
      const path = `${dest}/${rel}`;
      const before = game.find(path);
      if (before?.type === 'file' && content(before, game) === text) continue;
      if (before) summary.modified++;
      else summary.fresh++;
      summary.bytes += text.length;
      summary.lines.push(trial ? `get -O ${dest} ${src}/${rel}` : `Transferring file \`${rel}'`);
      if (trial) continue;
      const parts = rel.split('/');
      for (let k = 1; k < parts.length; k++) {
        const directory = `${dest}/${parts.slice(0, k).join('/')}`;
        if (!game.find(directory)) game.place('mirror', directory, { type: 'directory', children: {}, owner: game.who });
      }
      if (!game.find(dest)) game.place('mirror', dest, { type: 'directory', children: {}, owner: game.who });
      if (before?.type === 'file') Object.assign(before, { content: text, lines: true });
      else game.place('mirror', path, { type: 'file', content: text, lines: true, owner: game.who });
    }
  }
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  const recap = [
    `Total: ${plural(summary.directories || 1, 'director' + (summary.directories === 1 ? 'y' : 'ie'))}, ${plural(summary.fresh + summary.modified, 'file')}, 0 symlinks`,
    ...(summary.fresh ? [`New: ${plural(summary.fresh, 'file')}, 0 symlinks`] : []),
    ...(summary.modified ? [`Modified: ${plural(summary.modified, 'file')}, 0 symlinks`] : []),
    ...(summary.removed ? [`Removed: ${plural(summary.removed, 'file')}, 0 directories, 0 symlinks`] : []),
    ...(summary.bytes ? [`${summary.bytes} bytes transferred`] : []),
  ];
  return [...(verbose || trial ? summary.lines : []), ...(trial ? [] : recap)]
    .join('\n')
    .replace('1 directorys', '1 directory')
    .replace(/(\d+) directoryies/, '$1 directories');
}

function walkLocal(game: Shell, n: Node, rel: string, file: (rel: string, f: File) => void, directory: (rel: string) => void) {
  if (n.type === 'file') return file(rel, n);
  directory(rel);
  for (const [k, e] of Object.entries(n.children)) walkLocal(game, e, rel ? `${rel}/${k}` : k, file, directory);
}

// Le dossier distant (créé, avec ses parents, s'il n'existe pas).
function remoteDirectory(root: Directory, path: string): Directory {
  let d = root;
  for (const p of path.split('/').filter(Boolean)) {
    if (d.children[p]?.type !== 'directory') d.children[p] = { type: 'directory', children: {} };
    d = d.children[p] as Directory;
  }
  return d;
}

function remove(root: Directory, path: string) {
  const parts = path.split('/').filter(Boolean);
  const parent = node(root, '/' + parts.slice(0, -1).join('/'));
  if (parent?.type === 'directory') delete parent.children[parts.at(-1)!];
}

/** Une commande lftp ; renvoie ce qu'elle affiche, ou null pour quitter. */
function lftpCommand(game: Shell, s: Session, line: string): string | null {
  const [cmd, ...args] = words(line);
  if (!cmd) return '';
  if (['bye', 'exit', 'quit'].includes(cmd)) return null;
  if (cmd === 'set') {
    const [name, value] = args;
    if (!name)
      return Object.entries(s.settings)
        .map(([k, v]) => `set ${k} ${v}`)
        .join('\n');
    if (!/^(ftp|ssl|net|mirror|cmd):[\w-]+$/.test(name)) return game.error(`set: no such variable \`${name}'`, 1);
    s.settings[name] = TRUE(value) ? 'yes' : /^(no|off|false|0)$/i.test(value ?? '') ? 'no' : (value ?? '');
    // Un nouveau réglage s'applique à la prochaine connexion.
    s.connected = false;
    return '';
  }
  if (cmd === 'open') {
    const k = args.indexOf('-u');
    if (k >= 0) {
      const [u, p] = (args[k + 1] ?? '').split(',');
      s.user = u;
      s.password = p ?? s.password;
    }
    s.host = args.filter((a, i) => !a.startsWith('-') && args[i - 1] !== '-u').at(-1) ?? s.host;
    s.connected = false;
    s.remote = '/';
    return '';
  }
  if (cmd === 'user') {
    s.user = args[0] ?? null;
    s.password = args[1] ?? null;
    s.connected = false;
    return '';
  }
  if (cmd === 'lcd') {
    const dest = game.resolve(args[0] ? (args[0].startsWith('/') || args[0].startsWith('~') ? args[0] : `${s.local}/${args[0]}`) : '~');
    if (game.find(dest)?.type !== 'directory') return game.error(`lcd: ${dest}: No such file or directory`, 1);
    s.local = dest;
    return `lcd ok, local cwd=${dest}`;
  }
  if (cmd === 'lpwd') return s.local;
  if (cmd === 'help') return game.t('lftp-help');
  if (cmd === 'mirror') return mirror(game, s, args);
  // Les commandes distantes : la connexion d'abord.
  if (!['ls', 'dir', 'cd', 'pwd', 'mkdir', 'rm', 'get', 'put', 'cat'].includes(cmd)) return game.error(`Unknown command \`${cmd}'.`, 1);
  if (cmd === 'pwd') return `ftp://${s.user ? `${s.user}@` : ''}${s.host ?? ''}${s.remote === '/' ? '' : s.remote}`;
  const e = connect(game, s, cmd);
  if (e) return game.error(e, 1);
  const root = rootFor(game, s);
  if (cmd === 'ls' || cmd === 'dir') {
    const path = normalise(s.remote, args.find((a) => !a.startsWith('-')) ?? '.');
    const n = node(root, path);
    if (!n) return game.error(`ls: Access failed: 550 ${path}: No such file or directory`, 1);
    if (n.type === 'file') return lsLine(path.split('/').at(-1)!, n, s.user!);
    return Object.entries(n.children)
      .map(([k, x]) => lsLine(k, x, s.user!))
      .join('\n');
  }
  if (cmd === 'cd') {
    const path = normalise(s.remote, args[0] ?? '~');
    if (node(root, path)?.type !== 'directory')
      return game.error(`cd: Access failed: 550 Can't change directory to ${args[0]}: No such file or directory`, 1);
    s.remote = path;
    return `cd ok, cwd=${path === '/' ? '~' : `~${path}`}`;
  }
  if (cmd === 'cat') {
    const n = node(root, normalise(s.remote, args[0] ?? ''));
    if (n?.type !== 'file') return game.error(`cat: Access failed: 550 ${args[0]}: No such file or directory`, 1);
    return typeof n.content === 'string' ? n.content : '';
  }
  if (cmd === 'mkdir') {
    const path = normalise(s.remote, args.find((a) => !a.startsWith('-')) ?? '');
    const parent = node(root, path.split('/').slice(0, -1).join('/') || '/');
    if (parent?.type !== 'directory') return game.error(`mkdir: Access failed: 550 ${path}: No such file or directory`, 1);
    parent.children[path.split('/').at(-1)!] ??= { type: 'directory', children: {} };
    return 'mkdir ok, `' + path.split('/').at(-1) + "' created";
  }
  if (cmd === 'rm') {
    const path = normalise(s.remote, args.find((a) => !a.startsWith('-')) ?? '');
    const n = node(root, path);
    if (!n || (n.type === 'directory' && !args.includes('-r'))) return game.error(`rm: Access failed: 550 ${path}: No such file or directory`, 1);
    remove(root, path);
    return `rm ok, \`${path.split('/').at(-1)}' removed`;
  }
  if (cmd === 'put') {
    const local = game.resolve(args[0]?.startsWith('/') ? args[0] : `${s.local}/${args[0] ?? ''}`);
    const n = game.find(local);
    if (n?.type !== 'file') return game.error(`put: ${local}: No such file or directory`, 1);
    const name = local.split('/').at(-1)!;
    const directory = node(root, s.remote) as Directory;
    directory.children[name] = { type: 'file', content: content(n, game), lines: true };
    return `${content(n, game).length} bytes transferred`;
  }
  // get
  const n = node(root, normalise(s.remote, args[0] ?? ''));
  if (n?.type !== 'file') return game.error(`get: Access failed: 550 ${args[0]}: No such file or directory`, 1);
  const name = (args[0] ?? '').split('/').at(-1)!;
  const text = typeof n.content === 'string' ? n.content : '';
  const err = game.place('get', `${s.local}/${name}`, { type: 'file', content: text, lines: true, owner: game.who });
  if (err) return game.error(`get: ${s.local}/${name}: Permission denied`, 1);
  return `${text.length} bytes transferred`;
}

const prompt = (s: Session) => `lftp ${s.user ? `${s.user}@` : ''}${s.host ?? ''}:${s.remote === '/' ? '~' : `~${s.remote}`}> `;

// La session interactive : une question par commande, jusqu'à bye.
function interactive(game: Shell, s: Session) {
  const who = game.who;
  game.ask(prompt(s), (line) => {
    const before = game.who;
    game.who = who;
    try {
      const output = lftpCommand(game, s, line);
      if (output !== null) interactive(game, s);
      return [...game.recoverErrors(), output ?? ''].filter(Boolean).join('\n');
    } finally {
      game.who = before;
    }
  });
}

function lftp(game: Shell, args: string[]): string {
  const s: Session = {
    host: null,
    user: null,
    password: null,
    connected: false,
    remote: '/',
    local: game.cwd,
    settings: {},
    tls: false,
    checked: false,
  };
  let c: string | null = null;
  let e: string | null = null;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-u') {
      const [u, p] = (args[++i] ?? '').split(',');
      s.user = u;
      s.password = p ?? null;
    } else if (a === '-c') c = args[++i] ?? '';
    else if (a === '-e') e = args[++i] ?? '';
    else if (a === '-p') i++;
    else if (a === '-v' || a === '--version') return 'LFTP | Version 4.9.2 | Copyright (c) 1996-2020 Alexander V. Lukyanov';
    else if (a.startsWith('-')) return game.error(`lftp: invalid option -- '${a.replace(/^-+/, '')}'\nTry \`lftp --help' for more information`, 1);
    else {
      const url = /^ftps?:\/\/(?:([^@:/]+)(?::([^@/]*))?@)?([^/:]+)/.exec(a);
      if (url) {
        s.user = url[1] ?? s.user;
        s.password = url[2] ?? s.password;
        s.host = url[3];
      } else s.host = a;
    }
  }
  const launch = (): string => {
    if (c !== null) {
      const outputs: string[] = [];
      for (const line of commands(c)) {
        const r = lftpCommand(game, s, line);
        if (r === null) break;
        if (r) outputs.push(r);
      }
      return outputs.join('\n');
    }
    const outputs: string[] = [];
    let finished = false;
    for (const line of commands(e ?? '')) {
      const r = lftpCommand(game, s, line);
      if (r === null) {
        finished = true;
        break;
      }
      if (r) outputs.push(r);
    }
    if (!finished) interactive(game, s);
    return outputs.join('\n');
  };
  // -u compte sans mot de passe : lftp le demande tout de suite.
  if (s.user && s.password === null) {
    const who = game.who;
    game.ask(
      'Password: ',
      (mdp) => {
        const before = game.who;
        game.who = who;
        try {
          s.password = mdp;
          const output = launch();
          return [...game.recoverErrors(), output].filter(Boolean).join('\n');
        } finally {
          game.who = before;
        }
      },
      true,
    );
    return '';
  }
  return launch();
}

export type { HostingDef };
export const LFTP: Record<string, Command> = { lftp: { ownOptions: true, launch: ({ args, game }) => lftp(game, args) } };
