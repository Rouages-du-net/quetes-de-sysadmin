// testparm, smbpasswd, pdbedit and smbclient, on the model of ../samba.ts.
// After https://www.samba.org/samba/docs/current/man-html/testparm.1.html,
// smbpasswd.8.html, pdbedit.8.html and smbclient.1.html.
// Differences: testparm doesn't wait for Enter before the dump; smbclient
// runs the commands of -c (ls, cd, put, get, mkdir, rm) and has no
// interactive session; pdbedit only lists (-L).

import type { Shell } from '../shell';
import type { Command } from './index';
import type { Directory, File, Node } from '../world';
import { allowed, dump, guestOk, modeFor, readConfig, samba, SMB_CONF, shareFor, writable, type Share } from '../samba';
import { serverFor, addressOf } from '../nfs';
import { verdict, type Firewall } from '../firewall';

function testparm(game: Shell, args: string[]): string {
  const quiet = args.includes('-s') || args.includes('--suppress-prompt');
  const unknown = args.find((a) => a.startsWith('-') && !['-s', '--suppress-prompt'].includes(a));
  if (unknown) return game.error(`testparm: unknown option ${unknown}\nUsage: testparm [-s] [config-file]`);
  const file = args.find((a) => !a.startsWith('-')) ?? SMB_CONF;
  if (game.read(file) === null) return game.error(`Load smb config files from ${file}\nError loading services.`, 1);
  const config = readConfig(game);
  const err: string[] = [`Load smb config files from ${file}`];
  for (const u of config.unknown) err.push(`Unknown parameter encountered: "${u}"`, `Ignoring unknown parameter "${u}"`);
  for (const s of config.shares)
    if (!['homes', 'printers', 'print$'].includes(s.name.toLowerCase()) && !s.params.path) err.push(`WARNING: No path in service ${s.name} - making it unavailable!`);
  err.push('Loaded services file OK.', 'Weak crypto is allowed by GnuTLS (e.g. NTLM as a compatibility fallback)', '', 'Server role: ROLE_STANDALONE', '');
  if (!quiet) err.push('Press enter to see a dump of your service definitions', '');
  for (const e of err) game.error(e);
  return `# Global parameters\n${dump(game)}`;
}

function smbpasswd(game: Shell, args: string[]): string {
  const flags = args.filter((a) => a.startsWith('-'));
  const user = args.find((a) => !a.startsWith('-'));
  const db = samba(game).passdb;
  const usage = 'When run by root:\n    smbpasswd [options] [username]\notherwise:\n    smbpasswd [options]\n\noptions:\n  -a                   add user\n  -x                   delete user\n  -d                   disable user\n  -e                   enable user';
  if (!flags.length || !user || flags.some((f) => !['-a', '-x', '-d', '-e'].includes(f))) return game.error(usage);
  if (game.who !== 'root') return game.error(usage);
  if (flags.includes('-x')) {
    if (!(user in db)) return game.error(`Failed to find entry for user ${user}.\nFailed to delete entry for user ${user}.`, 1);
    delete db[user];
    return `Deleted user ${user}.`;
  }
  if (flags.includes('-d') || flags.includes('-e')) {
    if (!(user in db)) return game.error(`Failed to find entry for user ${user}.`, 1);
    const disabled: string[] = (game.state.sambaDisabled ??= []);
    game.state.sambaDisabled = flags.includes('-d') ? [...new Set([...disabled, user])] : disabled.filter((x) => x !== user);
    return flags.includes('-d') ? `Disabled user ${user}.` : `Enabled user ${user}.`;
  }
  // -a: the Unix account must exist; Samba keeps its own password.
  const exists = !!game.accounts.users[user];
  game.ask(
    'New SMB password:',
    (first) => {
      game.ask(
        'Retype new SMB password:',
        (second) => {
          if (first !== second) {
            game.status = 1;
            return 'Mismatch - password unchanged.\nUnable to get new password.';
          }
          if (!exists) {
            game.status = 1;
            return `Failed to add entry for user ${user}.`;
          }
          const added = !(user in db);
          db[user] = first;
          return added ? `Added user ${user}.` : '';
        },
        true,
      );
      return '';
    },
    true,
  );
  return '';
}

function pdbedit(game: Shell, args: string[]): string {
  if (!args.includes('-L') && !args.includes('--list')) return game.error(game.t('pdbedit-usage'));
  if (game.who !== 'root') return game.error('Unable to open passdb database.', 1);
  return Object.keys(samba(game).passdb)
    .sort()
    .map((u) => `${u}:${game.accounts.users[u]?.uid ?? ''}:`)
    .join('\n');
}

// ——— smbclient ———

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function date(ms: number): string {
  const d = new Date(ms);
  const two = (n: number) => String(n).padStart(2, '0');
  return `${DAYS[d.getUTCDay()]} ${MONTHS[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2, ' ')} ${two(d.getUTCHours())}:${two(d.getUTCMinutes())}:${two(d.getUTCSeconds())} ${d.getUTCFullYear()}`;
}

/** What a connected user may do on a node: their own rights, or those of force user / force group. */
function canAs(server: Shell, share: Share, n: Node, right: 'r' | 'w' | 'x', user: string): boolean {
  const as = share.params.forceuser ?? user;
  if (server.can(n, right, as)) return true;
  const g = share.params.forcegroup?.replace(/^\+/, '');
  if (!g || (n.owner ?? server.player) === as) return false;
  const mode = n.mode ?? (n.type === 'directory' ? 'rwxr-xr-x' : 'rw-r--r--');
  return (n.group ?? n.owner) === g && (mode.slice(3, 6).includes(right) || (right === 'x' && /[st]$/.test(mode.slice(3, 6))));
}

interface Session {
  server: Shell;
  share: Share;
  user: string;
  cwd: string;
  host: string;
}

const join = (a: string, b: string) => (b.startsWith('/') ? b : `${a.replace(/\/$/, '')}/${b}`).replace(/\\/g, '/');
const remote = (s: Session, name: string) => join(join(s.share.params.path, s.cwd.replace(/^\/+/, '')), name).replace(/\/+$/, '') || '/';
const windows = (s: Session, name: string) => `\\${join(s.cwd, name).replace(/^\//, '').replace(/\//g, '\\')}`;

function run(game: Shell, s: Session, line: string): string[] {
  const [cmd, ...a] = line.trim().split(/\s+/);
  const out: string[] = [];
  const clock = (s.server.state.systemd as { clock?: number } | undefined)?.clock ?? 0;
  if (cmd === 'ls' || cmd === 'dir') {
    const dir = s.server.find(remote(s, ''));
    if (dir?.type !== 'directory' || !canAs(s.server, s.share, dir, 'r', s.user)) return ['NT_STATUS_ACCESS_DENIED listing \\*'];
    const row = (name: string, n: Node) => `  ${name.padEnd(36)}${n.type === 'directory' ? 'D' : 'N'}${String(n.type === 'directory' ? 0 : s.server.size(n)).padStart(9)}  ${date((n as File).mtime ?? clock)}`;
    out.push(row('.', dir), row('..', dir));
    for (const [name, n] of Object.entries(dir.children).sort(([x], [y]) => x.localeCompare(y))) if (!name.startsWith('.')) out.push(row(name, n));
    out.push('', '\t\t20511312 blocks of size 1024. 9182736 blocks available');
    return out;
  }
  if (cmd === 'cd') {
    const next = join(s.cwd, a[0] ?? '/');
    const n = s.server.find(join(s.share.params.path, next.replace(/^\/+/, '')));
    if (n?.type !== 'directory') return [`cd ${windows(s, a[0] ?? '')}\\: NT_STATUS_OBJECT_NAME_NOT_FOUND`];
    s.cwd = next;
    return [];
  }
  if (cmd === 'put' || cmd === 'mkdir') {
    const name = cmd === 'put' ? (a[1] ?? a[0]?.split('/').pop() ?? '') : (a[0] ?? '');
    const local = cmd === 'put' ? game.find(a[0] ?? '') : null;
    if (cmd === 'put' && (local?.type !== 'file' || !game.can(local, 'r'))) return [`${a[0]} does not exist`];
    const path = remote(s, name);
    const parent = s.server.find(`${path}/..`);
    const denied = cmd === 'put' ? `NT_STATUS_ACCESS_DENIED opening remote file ${windows(s, name)}` : `NT_STATUS_ACCESS_DENIED making remote directory ${windows(s, name)}`;
    if (!writable(s.share) || parent?.type !== 'directory' || !canAs(s.server, s.share, parent, 'w', s.user) || !canAs(s.server, s.share, parent, 'x', s.user)) return [denied];
    const owner = s.share.params.forceuser ?? s.user;
    const group = s.share.params.forcegroup?.replace(/^\+/, '') ?? (/[sS]/.test(parent.mode?.[5] ?? '') ? (parent.group ?? parent.owner) : s.server.accounts.users[owner]?.group);
    let mode = modeFor(s.share, cmd === 'mkdir');
    if (cmd === 'mkdir' && /[sS]/.test(parent.mode?.[5] ?? '')) mode = mode.slice(0, 5) + (mode[5] === 'x' ? 's' : 'S') + mode.slice(6);
    const node: Node =
      cmd === 'put'
        ? { ...(local as File), owner, group, mode, read: undefined, isProtected: undefined, mtime: clock }
        : ({ type: 'directory', children: {}, owner, group, mode } as Directory);
    (parent as Directory).children[name] = node;
    if (cmd === 'put') {
      const kb = ((s.server.size(node) / 1024) / 0.5).toFixed(1);
      out.push(`putting file ${a[0]} as ${windows(s, name)} (${kb} kb/s) (average ${kb} kb/s)`);
    }
    return out;
  }
  if (cmd === 'get') {
    const n = s.server.find(remote(s, a[0] ?? ''));
    if (n?.type !== 'file') return [`NT_STATUS_OBJECT_NAME_NOT_FOUND opening remote file ${windows(s, a[0] ?? '')}`];
    if (!canAs(s.server, s.share, n, 'r', s.user)) return [`NT_STATUS_ACCESS_DENIED opening remote file ${windows(s, a[0] ?? '')}`];
    const error = game.place('smbclient', a[1] ?? a[0].split('/').pop()!, { ...n, owner: game.who, group: undefined, mode: undefined });
    if (error) return [error];
    const kb = ((s.server.size(n) / 1024) / 0.5).toFixed(1);
    return [`getting file ${windows(s, a[0])} of size ${s.server.size(n)} as ${a[1] ?? a[0]} (${kb} KiloBytes/sec) (average ${kb} KiloBytes/sec)`];
  }
  if (cmd === 'rm' || cmd === 'del') {
    const path = remote(s, a[0] ?? '');
    const parent = s.server.find(`${path}/..`);
    if (!s.server.find(path)) return [`NT_STATUS_NO_SUCH_FILE listing ${windows(s, a[0] ?? '')}`];
    if (!writable(s.share) || parent?.type !== 'directory' || !canAs(s.server, s.share, parent, 'w', s.user)) return [`NT_STATUS_ACCESS_DENIED deleting remote file ${windows(s, a[0] ?? '')}`];
    delete (parent as Directory).children[path.split('/').pop()!];
    return [];
  }
  return [`${cmd}: command not found`];
}

function smbclient(game: Shell, args: string[]): string {
  let user: string | null = null;
  let password: string | null = null;
  let commands: string | null = null;
  let list: string | null = null;
  let anonymous = false;
  let service: string | null = null;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-U' || a === '--user') [user, password] = ((args[++i] ?? '').split('%', 2) as [string, string | undefined]).map((x) => x ?? null) as [string, string | null];
    else if (a === '-c' || a === '--command') commands = args[++i] ?? '';
    else if (a === '-L' || a === '--list') list = args[++i] ?? '';
    else if (a === '-N' || a === '--no-pass') anonymous = true;
    else if (a.startsWith('-')) return game.error(`smbclient: unknown option ${a}\nUsage: smbclient [-?EgqBNPkV] [-?|--help] [--usage] [-M|--message=HOST] [-I|--ip-address=IP] [-L|--list=HOST] [-U|--user=USERNAME] [-N|--no-pass] [-c|--command=STRING] service <password>`);
    else service = a;
  }
  const target = list ?? /^\/\/([^/]+)\/?/.exec(service ?? '')?.[1] ?? null;
  if (!target) return game.error('Usage: smbclient [OPTIONS] service <password>\n(e.g. smbclient //localhost/share -U user)');
  const shareName = list === null ? (/^\/\/[^/]+\/([^/]+)/.exec(service ?? '')?.[1] ?? null) : null;
  if (list === null && !shareName) return game.error(`\\\\${target}: Not enough '\\' characters in service`);
  const who = user ?? game.who;
  const connect = (secret: string | null): string => {
    const local = ['localhost', game.host].includes(target) || target.startsWith('127.');
    const found = local ? { shell: game, address: '127.0.0.1' } : serverFor(game, target);
    if (!found) return game.error(`do_connect: Connection to ${target} failed (Error NT_STATUS_UNSUCCESSFUL)`, 1), '';
    const server = found.shell;
    const pf = server.state.ufw as Firewall | undefined;
    if (!local && pf && verdict(pf, 445, addressOf(game)) !== 'accepted') return game.error(`do_connect: Connection to ${target} failed (Error NT_STATUS_IO_TIMEOUT)`, 1), '';
    const sd = server.state.systemd as { services: Record<string, { state: string }> } | undefined;
    if (sd?.services.smbd?.state !== 'active') return game.error(`do_connect: Connection to ${target} failed (Error NT_STATUS_CONNECTION_REFUSED)`, 1), '';
    const config = readConfig(server);
    const db = samba(server).passdb;
    // Authentication: Samba's password; "map to guest = bad user" turns an unknown account (or -N) into the guest.
    const disabled = (server.state.sambaDisabled ?? []) as string[];
    const guest = anonymous || (!(who in db) && !server.accounts.users[who] && /bad user/i.test(config.global.maptoguest ?? ''));
    if (!guest && (!(who in db) || db[who] !== secret || disabled.includes(who))) return game.error('session setup failed: NT_STATUS_LOGON_FAILURE', 1), '';
    if (list !== null) {
      const rows = config.shares
        .filter((s) => !/^no$/i.test(s.params.browseable ?? 'yes') && s.name.toLowerCase() !== 'homes')
        .map((s) => `\t${s.name.padEnd(16)}Disk      ${s.params.comment ?? ''}`);
      return ['', '\tSharename       Type      Comment', '\t---------       ----      -------', ...rows, `\tIPC$            IPC       IPC Service (${config.global.serverstring?.replace('%h', server.host) ?? 'Samba'})`, 'SMB1 disabled -- no workgroup available'].join('\n');
    }
    const share = shareFor(config, shareName!, guest ? null : who);
    if (!share || !share.params.path || server.find(share.params.path)?.type !== 'directory') return game.error('tree connect failed: NT_STATUS_BAD_NETWORK_NAME', 1), '';
    const account = guest ? 'nobody' : who;
    if ((guest && !guestOk(share)) || (!guest && !allowed(server, share, who))) return game.error('tree connect failed: NT_STATUS_ACCESS_DENIED', 1), '';
    const session: Session = { server, share, user: account, cwd: '/', host: target };
    (server.state.smbSessions ??= []).push({ user: account, share: share.name, guest });
    if (commands === null) return game.error(game.t('smbclient-interactive')), '';
    const out = commands
      .split(';')
      .filter((c) => c.trim())
      .flatMap((c) => run(game, session, c));
    return out.join('\n');
  };
  if (anonymous || password !== null) return connect(password);
  const workgroup = 'WORKGROUP';
  game.ask(`Password for [${workgroup}\\${who}]:`, (secret) => connect(secret) || game.recoverErrors().join('\n'), true);
  return '';
}

export const SAMBA: Record<string, Command> = {
  testparm: { ownOptions: true, launch: ({ args, game }) => testparm(game, args) },
  smbpasswd: { section: 8, ownOptions: true, launch: ({ args, game }) => smbpasswd(game, args) },
  pdbedit: { section: 8, ownOptions: true, launch: ({ args, game }) => pdbedit(game, args) },
  smbclient: { ownOptions: true, launch: ({ args, game }) => smbclient(game, args) },
  // Manual page only (configuration file).
  'smb.conf': { section: 5, launch: () => '' },
};
