// ss (iproute2, https://man7.org/linux/man-pages/man8/ss.8.html) and its
// elder netstat (net-tools, https://man7.org/linux/man-pages/man8/netstat.8.html):
// a machine's sockets. -t TCP, -u UDP, -l listening, -a all, -n without
// resolving service names, -p the process (only for root, like the real
// tools for other accounts' sockets).
// The sockets come from state.listening; the current ssh session appears as
// an established connection. Output in English (neither tool is translated).
// Differences: Internet sockets only (no Unix domain sockets), and netstat's
// -r (routing) and -i (interfaces) are not modelled.

import type { Shell } from '../shell';
import { MACHINES, WORKSTATION } from '../machines';
import { dockerListeners } from '../docker';
import type { Command } from './index';

export interface Listening {
  proto: 'tcp' | 'udp';
  address: string;
  port: number;
  process: string;
  pid: number;
}

export interface Connection {
  proto: 'tcp' | 'udp';
  state: 'LISTEN' | 'UNCONN' | 'ESTAB';
  local: { address: string; port: number };
  peer: { address: string; port: number | null };
  process: string;
  pid: number;
}

const NAMES: Record<number, string> = { 22: 'ssh', 80: 'http', 443: 'https', 3306: 'mysql', 53: 'domain', 5432: 'postgresql', 8080: 'http-alt', 8081: 'tproxy' };
/** A port as a service name (unless `numeric`); `null` is the wildcard "*". */
const portName = (p: number | null, numeric: boolean) => (p === null ? '*' : numeric ? String(p) : (NAMES[p] ?? String(p)));

/** The machine's Internet sockets: the listening ones, then the current ssh session. */
export function connections(game: Shell, o: { listening: boolean; established: boolean; tcp: boolean; udp: boolean }): Connection[] {
  const out: Connection[] = [];
  // The chapter's sockets, and docker-proxy's for the published ports.
  const listening: Listening[] = [...(game.state.listening ?? []), ...dockerListeners(game)];
  if (o.listening)
    for (const e of listening.filter((s) => (s.proto === 'tcp' ? o.tcp : o.udp)))
      out.push({
        proto: e.proto,
        state: e.proto === 'tcp' ? 'LISTEN' : 'UNCONN',
        local: { address: e.address, port: e.port },
        peer: { address: e.address === '*' ? '*' : e.address.includes(':') ? '[::]' : '0.0.0.0', port: null },
        process: e.process,
        pid: e.pid,
      });
  // The current ssh session, from the workstation (on the port we came in through).
  const here = MACHINES.find((m) => m.name === game.host);
  const portSession: number = game.state.portSession ?? 22;
  if (o.established && o.tcp && here && listening.some((e) => e.process === 'sshd'))
    out.push({ proto: 'tcp', state: 'ESTAB', local: { address: here.address, port: portSession }, peer: { address: WORKSTATION.address, port: 51234 }, process: 'sshd', pid: 2741 });
  return out;
}

export const SS: Record<string, Command> = {
  ss: {
    launch: ({ args, game }) => {
      const letters = new Set(args.filter((a) => /^-[a-z]+$/.test(a)).flatMap((a) => [...a.slice(1)]));
      const tcp = letters.has('t') || !letters.has('u');
      const udp = letters.has('u');
      const numeric = letters.has('n');
      const withProcess = letters.has('p') && game.who === 'root';
      const rows = connections(game, { listening: letters.has('l') || letters.has('a'), established: !letters.has('l') || letters.has('a'), tcp, udp });
      const lines: string[][] = [['State', 'Recv-Q', 'Send-Q', 'Local Address:Port', 'Peer Address:Port', 'Process']];
      for (const c of rows)
        lines.push([
          c.state,
          '0',
          c.state === 'LISTEN' ? '128' : '0',
          `${c.local.address}:${portName(c.local.port, numeric)}`,
          `${c.peer.address}:${portName(c.peer.port, numeric)}`,
          withProcess ? (c.state === 'ESTAB' ? `users:(("${c.process}",pid=${c.pid},fd=4))` : `users:(("${c.process}",pid=${c.pid},fd=3))`) : '',
        ]);
      const widths = [0, 1, 2, 3, 4].map((i) => Math.max(...lines.map((l) => l[i].length)));
      return lines
        .map((l) => [l[0].padEnd(widths[0]), l[1].padEnd(widths[1]), l[2].padEnd(widths[2]), l[3].padStart(widths[3]), l[4].padEnd(widths[4]), l[5]].join(' ').trimEnd())
        .join('\n');
    },
  },

  netstat: {
    launch: ({ args, game }) => {
      const letters = new Set(args.filter((a) => /^-[a-z]+$/.test(a)).flatMap((a) => [...a.slice(1)]));
      // -t TCP, -u UDP; without either, both. -l listening only, -a all, otherwise established.
      const tcp = letters.has('t') || !letters.has('u');
      const udp = letters.has('u') || !letters.has('t');
      const numeric = letters.has('n');
      const withProcess = letters.has('p') && game.who === 'root';
      const rows = connections(game, { listening: letters.has('l') || letters.has('a'), established: !letters.has('l') || letters.has('a'), tcp, udp });
      const title = letters.has('l') ? 'Active Internet connections (only servers)' : letters.has('a') ? 'Active Internet connections (servers and established)' : 'Active Internet connections (w/o servers)';
      const header = ['Proto', 'Recv-Q', 'Send-Q', 'Local Address', 'Foreign Address', 'State'];
      if (withProcess) header.push('PID/Program name');
      const address = (a: string, p: number | null) => `${a}:${portName(p, numeric)}`;
      const lines = rows.map((c) => {
        const proto = c.proto + (c.local.address.includes(':') ? '6' : '');
        const row = [proto.padEnd(5), '     0', '     0', address(c.local.address, c.local.port).padEnd(23), address(c.peer.address, c.peer.port).padEnd(23), c.proto === 'udp' ? '' : c.state === 'LISTEN' ? 'LISTEN' : 'ESTABLISHED'];
        if (withProcess) row.push(` ${c.pid}/${c.process}`);
        return row.join(' ').trimEnd();
      });
      return [title, header.join('  '), ...lines].join('\n');
    },
  },
};
