// ss (iproute2, https://man7.org/linux/man-pages/man8/ss.8.html) : les
// sockets d'une machine. -t TCP, -u UDP, -l en écoute, -a toutes, -n sans
// résoudre les noms de services, -p le processus (seulement pour root,
// comme le vrai ss pour les sockets des autres comptes).
// Les sockets viennent de etat.ecoute ; la session ssh en cours apparaît
// comme connexion établie. Sortie en anglais (iproute2 n'est pas traduit).

import { MACHINES, POSTE } from '../machines';
import { ecoutesDocker } from '../docker';
import type { Commande } from './index';

export interface Ecoute {
  proto: 'tcp' | 'udp';
  adresse: string;
  port: number;
  processus: string;
  pid: number;
}

const NOMS: Record<number, string> = { 22: 'ssh', 80: 'http', 443: 'https', 3306: 'mysql', 53: 'domain', 5432: 'postgresql', 8080: 'http-alt', 8081: 'tproxy' };

export const SS: Record<string, Commande> = {
  ss: {
    lancer: ({ args, jeu }) => {
      const lettres = new Set(args.filter((a) => /^-[a-z]+$/.test(a)).flatMap((a) => [...a.slice(1)]));
      const tcp = lettres.has('t') || !lettres.has('u');
      const udp = lettres.has('u');
      const enEcoute = lettres.has('l') || lettres.has('a');
      const etablies = !lettres.has('l') || lettres.has('a');
      const port = (p: number) => (lettres.has('n') ? String(p) : (NOMS[p] ?? String(p)));
      const lignes: string[][] = [['State', 'Recv-Q', 'Send-Q', 'Local Address:Port', 'Peer Address:Port', 'Process']];
      // Les sockets du chapitre, et celles de docker-proxy pour les ports publiés.
      const ecoute: Ecoute[] = [...(jeu.etat.ecoute ?? []), ...ecoutesDocker(jeu)];
      if (enEcoute)
        for (const e of ecoute.filter((s) => (s.proto === 'tcp' ? tcp : udp)))
          lignes.push([
            e.proto === 'tcp' ? 'LISTEN' : 'UNCONN',
            '0',
            e.proto === 'tcp' ? '128' : '0',
            `${e.adresse}:${port(e.port)}`,
            `${e.adresse === '*' ? '*' : e.adresse.includes(':') ? '[::]' : '0.0.0.0'}:*`,
            lettres.has('p') && jeu.qui === 'root' ? `users:(("${e.processus}",pid=${e.pid},fd=3))` : '',
          ]);
      // La session ssh en cours, depuis le poste (sur le port par lequel on est entré).
      const ici = MACHINES.find((m) => m.nom === jeu.hote);
      const portSession: number = jeu.etat.portSession ?? 22;
      if (etablies && tcp && ici && ecoute.some((e) => e.processus === 'sshd'))
        lignes.push(['ESTAB', '0', '0', `${ici.adresse}:${port(portSession)}`, `${POSTE.adresse}:51234`, lettres.has('p') && jeu.qui === 'root' ? 'users:(("sshd",pid=2741,fd=4))' : '']);
      const largeurs = [0, 1, 2, 3, 4].map((i) => Math.max(...lignes.map((l) => l[i].length)));
      return lignes
        .map((l) => [l[0].padEnd(largeurs[0]), l[1].padEnd(largeurs[1]), l[2].padEnd(largeurs[2]), l[3].padStart(largeurs[3]), l[4].padEnd(largeurs[4]), l[5]].join(' ').trimEnd())
        .join('\n');
    },
  },
};
