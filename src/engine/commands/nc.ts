// nc (netcat-openbsd, Debian's netcat): here, only to test whether
// a TCP port answers (nc -zv machine port). Based on
// https://manpages.debian.org/trixie/netcat-openbsd/nc.1.en.html
// Difference: without -z, nc returns immediately instead of waiting for data.

import { machineDomain, machineByAddress, MACHINES, WORKSTATION } from '../machines';
import { portState, type PortState } from '../ports';
import type { Command } from './index';

const SERVICES: Record<number, string> = {
  22: 'ssh',
  25: 'smtp',
  53: 'domain',
  80: 'http',
  443: 'https',
  3306: 'mysql',
  5432: 'postgresql',
  6379: 'redis',
  8080: 'http-alt',
  8081: 'tproxy',
};

export const NC: Record<string, Command> = {
  nc: {
    ownOptions: true,
    launch: ({ args, game }) => {
      const verbose = args.some((a) => /^-[a-zA-Z]*v/.test(a));
      const positional = args.filter((a, i) => !a.startsWith('-') && args[i - 1] !== '-w');
      const [host, ports] = positional;
      if (!host || !ports)
        return game.error(
          'usage: nc [-46CDdFhklNnrStUuvZz] [-I length] [-i interval] [-M ttl]\n\t  [-m minttl] [-O length] [-P proxy_username] [-p source_port]\n\t  [-q seconds] [-s sourceaddr] [-T keyword] [-V rtable] [-W recvlimit]\n\t  [-w timeout] [-X proxy_protocol] [-x proxy_address[:port]]\n\t  [destination] [port]',
        );
      // The name: /etc/hosts, like the system.
      let address = /^\d+\.\d+\.\d+\.\d+$/.test(host) ? host : null;
      if (!address && host === 'localhost') address = '127.0.0.1';
      for (const line of (game.read('/etc/hosts') ?? '').split('\n')) {
        const [ip, ...names] = line.replace(/#.*/, '').trim().split(/\s+/);
        if (!address && names.includes(host)) address = ip;
      }
      const machine = address ? machineByAddress(address) : MACHINES.find((m) => m.name === game.host || machineDomain(game.t, m) === host);
      if (!address && machine?.name === game.host) address = machine.address;
      if (!address) return game.error(`nc: getaddrinfo for host "${host}" port ${ports}: Name or service not known`);
      const [start, end = start] = ports.split('-').map(Number);
      const lines: string[] = [];
      for (let port = start; port <= end && port - start < 1024; port++) {
        const name = SERVICES[port] ?? '*';
        // To itself: the loopback; to another machine: its firewall, its containers.
        const local = address.startsWith('127.') || machine?.name === game.host;
        const other = !local && machine && machine !== WORKSTATION ? (game.state.remotePort?.(machine.name, port) as PortState | undefined) : undefined;
        const state: PortState = local ? portState(game, port, true, '127.0.0.1') : (other ?? 'refused');
        const target = `${host} (${address})`;
        if (state === 'open') {
          if (verbose) lines.push(`Connection to ${target} ${port} port [tcp/${name}] succeeded!`);
        } else if (verbose || start === end) {
          game.error(
            state === 'filtered'
              ? `nc: connect to ${target} port ${port} (tcp) timed out: Operation now in progress`
              : `nc: connect to ${target} port ${port} (tcp) failed: Connection refused`,
          );
        }
      }
      return lines.join('\n');
    },
  },
};
