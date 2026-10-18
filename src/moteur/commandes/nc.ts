// nc (netcat-openbsd, le netcat de Debian) : ici, seulement pour tester si
// un port TCP répond (nc -zv machine port). D'après
// https://manpages.debian.org/trixie/netcat-openbsd/nc.1.en.html
// Écart : sans -z, nc rend la main au lieu d'attendre des données.

import { machineParAdresse, MACHINES, POSTE } from '../machines';
import { etatPort, type EtatPort } from '../ports';
import type { Commande } from './index';

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

export const NC: Record<string, Commande> = {
  nc: {
    propresOptions: true,
    lancer: ({ args, jeu }) => {
      const verbeux = args.some((a) => /^-[a-zA-Z]*v/.test(a));
      const positionnels = args.filter((a, i) => !a.startsWith('-') && args[i - 1] !== '-w');
      const [hote, ports] = positionnels;
      if (!hote || !ports)
        return jeu.erreur(
          'usage: nc [-46CDdFhklNnrStUuvZz] [-I length] [-i interval] [-M ttl]\n\t  [-m minttl] [-O length] [-P proxy_username] [-p source_port]\n\t  [-q seconds] [-s sourceaddr] [-T keyword] [-V rtable] [-W recvlimit]\n\t  [-w timeout] [-X proxy_protocol] [-x proxy_address[:port]]\n\t  [destination] [port]',
        );
      // Le nom : /etc/hosts, comme le système.
      let adresse = /^\d+\.\d+\.\d+\.\d+$/.test(hote) ? hote : null;
      if (!adresse && hote === 'localhost') adresse = '127.0.0.1';
      for (const ligne of (jeu.lire('/etc/hosts') ?? '').split('\n')) {
        const [ip, ...noms] = ligne.replace(/#.*/, '').trim().split(/\s+/);
        if (!adresse && noms.includes(hote)) adresse = ip;
      }
      const machine = adresse ? machineParAdresse(adresse) : MACHINES.find((m) => m.nom === jeu.hote || m.domaine === hote);
      if (!adresse && machine?.nom === jeu.hote) adresse = machine.adresse;
      if (!adresse) return jeu.erreur(`nc: getaddrinfo for host "${hote}" port ${ports}: Name or service not known`);
      const [debut, fin = debut] = ports.split('-').map(Number);
      const lignes: string[] = [];
      for (let port = debut; port <= fin && port - debut < 1024; port++) {
        const nom = SERVICES[port] ?? '*';
        // Vers soi-même : la boucle locale ; vers une autre machine : son pare-feu, ses conteneurs.
        const local = adresse.startsWith('127.') || machine?.nom === jeu.hote;
        const autre = !local && machine && machine !== POSTE ? (jeu.etat.portDistant?.(machine.nom, port) as EtatPort | undefined) : undefined;
        const etat: EtatPort = local ? etatPort(jeu, port, true, '127.0.0.1') : (autre ?? 'refuse');
        const cible = `${hote} (${adresse})`;
        if (etat === 'ouvert') {
          if (verbeux) lignes.push(`Connection to ${cible} ${port} port [tcp/${nom}] succeeded!`);
        } else if (verbeux || debut === fin) {
          jeu.erreur(
            etat === 'filtre'
              ? `nc: connect to ${cible} port ${port} (tcp) timed out: Operation now in progress`
              : `nc: connect to ${cible} port ${port} (tcp) failed: Connection refused`,
          );
        }
      }
      return lignes.join('\n');
    },
  },
};
