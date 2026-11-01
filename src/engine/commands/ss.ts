// ss (iproute2, https://man7.org/linux/man-pages/man8/ss.8.html): a
// machine's sockets. -t TCP, -u UDP, -l listening, -a all, -n without
// resolving service names, -p the process (only for root,
// like the real ss for other accounts' sockets).
// The sockets come from state.listening; the current ssh session appears
// as an established connection. Output in English (iproute2 isn't translated).

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

const NAMES: Record<number, string> = { 22: 'ssh', 80: 'http', 443: 'https', 3306: 'mysql', 53: 'domain', 5432: 'postgresql', 8080: 'http-alt', 8081: 'tproxy' };

export const SS: Record<string, Command> = {
  ss: {
    launch: ({ args, game }) => {
      const letters = new Set(args.filter((a) => /^-[a-z]+$/.test(a)).flatMap((a) => [...a.slice(1)]));
      const tcp = letters.has('t') || !letters.has('u');
      const udp = letters.has('u');
      const inListening = letters.has('l') || letters.has('a');
      const established = !letters.has('l') || letters.has('a');
      const port = (p: number) => (letters.has('n') ? String(p) : (NAMES[p] ?? String(p)));
      const lines: string[][] = [['State', 'Recv-Q', 'Send-Q', 'Local Address:Port', 'Peer Address:Port', 'Process']];
      // The chapter's sockets, and docker-proxy's for the published ports.
      const listening: Listening[] = [...(game.state.listening ?? []), ...dockerListeners(game)];
      if (inListening)
        for (const e of listening.filter((s) => (s.proto === 'tcp' ? tcp : udp)))
          lines.push([
            e.proto === 'tcp' ? 'LISTEN' : 'UNCONN',
            '0',
            e.proto === 'tcp' ? '128' : '0',
            `${e.address}:${port(e.port)}`,
            `${e.address === '*' ? '*' : e.address.includes(':') ? '[::]' : '0.0.0.0'}:*`,
            letters.has('p') && game.who === 'root' ? `users:(("${e.process}",pid=${e.pid},fd=3))` : '',
          ]);
      // The current ssh session, from the workstation (on the port we came in through).
      const here = MACHINES.find((m) => m.name === game.host);
      const portSession: number = game.state.portSession ?? 22;
      if (established && tcp && here && listening.some((e) => e.process === 'sshd'))
        lines.push(['ESTAB', '0', '0', `${here.address}:${port(portSession)}`, `${WORKSTATION.address}:51234`, letters.has('p') && game.who === 'root' ? 'users:(("sshd",pid=2741,fd=4))' : '']);
      const widths = [0, 1, 2, 3, 4].map((i) => Math.max(...lines.map((l) => l[i].length)));
      return lines
        .map((l) => [l[0].padEnd(widths[0]), l[1].padEnd(widths[1]), l[2].padEnd(widths[2]), l[3].padStart(widths[3]), l[4].padEnd(widths[4]), l[5]].join(' ').trimEnd())
        .join('\n');
    },
  },
};
