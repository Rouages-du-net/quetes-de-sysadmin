// exportfs and showmount (nfs-utils), on the model of ../nfs.ts; mount -t nfs
// is in disks.ts. After https://man7.org/linux/man-pages/man8/exportfs.8.html
// and https://man7.org/linux/man-pages/man8/showmount.8.html.
// Differences: exportfs knows -r, -a, -v, -s, -u; showmount -e (the exports)
// or the clients' addresses (no -a, -d), and asks rpcbind on port 111 (blocked by the server's firewall:
// a timeout).

import type { Shell } from '../shell';
import type { Command } from './index';
import { addressOf, clientsOf, effective, readExports, reload, server, serverFor } from '../nfs';
import { verdict, type Firewall } from '../firewall';

const line = (path: string, spec: string) => `${path.padEnd(14)}\t${spec}`;

function exportfs(game: Shell, args: string[]): string {
  let letters = '';
  const rest: string[] = [];
  for (const a of args) {
    if (/^-[a-z]+$/i.test(a)) letters += a.slice(1);
    else if (a.startsWith('-')) return game.error(`exportfs: invalid option -- '${a.replace(/^-+/, '')[0]}'\nusage: exportfs [-adfhioruvs] [host:/path]`);
    else rest.push(a);
  }
  const bad = [...letters].find((c) => !'arvsuf'.includes(c));
  if (bad) return game.error(`exportfs: invalid option -- '${bad}'\nusage: exportfs [-adfhioruvs] [host:/path]`);
  const verbose = letters.includes('v');
  const table = server(game).table;
  if (letters.includes('s')) {
    // -s: what the files say (the current table, as exportfs would load it).
    return readExports(game)
      .exports.map((e) => `${e.path}  ${e.clients.map((c) => `${c.spec}(${effective(c.options).join(',')})`).join(' ')}`)
      .join('\n');
  }
  if (!letters.includes('r') && !letters.includes('a') && !letters.includes('u'))
    return table.flatMap((e) => e.clients.map((c) => (verbose ? line(e.path, `${c.spec}(${effective(c.options).join(',')})`) : line(e.path, c.spec)))).join('\n');
  if (game.who !== 'root') {
    game.status = 1;
    return game.error('exportfs: could not open /var/lib/nfs/.etab.lock for locking: errno 13 (Permission denied)');
  }
  if (letters.includes('u')) {
    const out: string[] = [];
    for (const r of rest) {
      const [spec, path] = r.split(':');
      const e = table.find((x) => x.path === path);
      if (e) e.clients = e.clients.filter((c) => c.spec !== spec);
      if (verbose) out.push(`unexporting ${spec}:${path}`);
    }
    server(game).table = table.filter((e) => e.clients.length);
    return out.join('\n');
  }
  const messages = reload(game);
  for (const m of messages) game.error(m);
  if (verbose) return server(game).table.flatMap((e) => e.clients.map((c) => `exporting ${c.spec}:${e.path}`)).join('\n');
  return '';
}

function showmount(game: Shell, args: string[]): string {
  const rest = args.filter((a) => !a.startsWith('-'));
  const flags = args.filter((a) => a.startsWith('-'));
  const unknown = flags.find((f) => !['-e', '--exports'].includes(f));
  if (unknown) return game.error(`showmount: invalid option -- '${unknown.replace(/^-+/, '')[0]}'\nUsage: showmount [-adehv]\n       [--all] [--directories] [--exports]\n       [--no-headers] [--help] [--version] [host]`);
  const host = rest[0] ?? game.host;
  const local = host === game.host || host === 'localhost' || host.startsWith('127.');
  const target = local ? { shell: game, address: '127.0.0.1' } : serverFor(game, host);
  if (!target) return game.error('clnt_create: RPC: Unknown host'), '';
  const pf = target.shell.state.ufw as Firewall | undefined;
  if (!local && pf && verdict(pf, 111, addressOf(game)) !== 'accepted') return game.error('clnt_create: RPC: Timed out');
  const sd = target.shell.state.systemd as { services: Record<string, { state: string }> } | undefined;
  if (sd?.services['nfs-server'] && sd.services['nfs-server'].state !== 'active') return game.error('clnt_create: RPC: Program not registered');
  // Without -e: the clients that mounted something from it.
  if (!flags.length) return [`Hosts on ${host}:`, ...clientsOf(target.shell)].join('\n');
  // Every export of the table (showmount doesn't filter by the asking client).
  const lines = server(target.shell).table.map((e) => `${e.path} ${e.clients.map((c) => c.spec).join(',')}`);
  return [`Export list for ${host}:`, ...lines].join('\n');
}

export const NFS: Record<string, Command> = {
  exportfs: { section: 8, ownOptions: true, launch: ({ args, game }) => exportfs(game, args) },
  showmount: { section: 8, ownOptions: true, launch: ({ args, game }) => showmount(game, args) },
  // Manual pages only (configuration files).
  exports: { section: 5, launch: () => '' },
  nfs: { section: 5, launch: () => '' },
};
