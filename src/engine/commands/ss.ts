// ss (iproute2, https://man7.org/linux/man-pages/man8/ss.8.html) : les
// sockets d'une machine. -t TCP, -u UDP, -l en écoute, -a toutes, -n sans
// résoudre les noms de services, -p le processus (seulement pour root,
// comme le vrai ss pour les sockets des autres comptes).
// Les sockets viennent de etat.ecoute ; la session ssh en cours apparaît
// comme connexion établie. Sortie en anglais (iproute2 n'est pas traduit).

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
      // Les sockets du chapitre, et celles de docker-proxy pour les ports publiés.
      const listening: Listening[] = [...(game.state.ecoute ?? []), ...dockerListeners(game)];
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
      // La session ssh en cours, depuis le poste (sur le port par lequel on est entré).
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
