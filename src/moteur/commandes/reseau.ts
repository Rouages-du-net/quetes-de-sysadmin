// Commandes réseau simulées : ping, dig, traceroute, curl. Leurs sorties
// reprennent le format des vrais outils (en anglais, comme sur un vrai
// système) ; les machines et les routes viennent de l'état de l'histoire :
//
//   etat.reseau = {
//     machines:   { ip: { ping: répond-il au ping ?, ms: aller-retour } },
//     noms:       { nom: ip }           ce que savent les vrais serveurs DNS
//     resolveurs: [ip]                  serveurs DNS qui répondent
//     routes:     { ip: [{ ip, nom?, ms }] }  sauts jusqu'à la destination
//     web:        { nom: { entetes: [...], corps } }
//   }
//
// Le serveur DNS utilisé est lu, comme sous Linux, dans /etc/resolv.conf
// (ligne « nameserver … »). Les adresses et les noms sont réservés à la
// documentation (RFC 5737, RFC 6761), sauf 9.9.9.9 (le résolveur public Quad9).

import type { Shell } from '../shell';
import type { Commande } from './index';

interface Reseau {
  machines: Record<string, { ping: boolean; ms: number }>;
  noms: Record<string, string>;
  resolveurs: string[];
  routes: Record<string, { ip: string; nom?: string; ms: number }[]>;
  web: Record<string, { entetes: string[]; corps: string }>;
}

const estIp = (s: string) => /^\d{1,3}(\.\d{1,3}){3}$/.test(s);
const ms = (v: number) => v.toFixed(3);

function serveursDns(jeu: Shell): string[] {
  const conf = jeu.lire('/etc/resolv.conf') ?? '';
  return [...conf.matchAll(/^\s*nameserver\s+(\S+)/gm)].map((m) => m[1]);
}

// Résout un nom comme le ferait le système. `serveur` : forcer un serveur DNS.
function resoudreNom(jeu: Shell, nom: string, serveur?: string): { ip: string } | { erreur: 'delai' | 'inconnu'; serveurs: string[] } {
  if (estIp(nom)) return { ip: nom };
  const r: Reseau = jeu.etat.reseau;
  const serveurs = serveur ? [serveur] : serveursDns(jeu);
  if (!serveurs.some((s) => r.resolveurs.includes(s))) return { erreur: 'delai', serveurs };
  const ip = r.noms[nom.replace(/\.$/, '')];
  return ip ? { ip } : { erreur: 'inconnu', serveurs };
}

export const RESEAU: Record<string, Commande> = {
  ping: {
    manuel:
      'ping [-c N] machine — envoie de petits messages (ICMP « echo ») à une machine et mesure le temps de l’aller-retour. Ici, 4 envois par défaut (sous Linux, ping continue jusqu’à Ctrl+C). Attention : beaucoup de serveurs ne répondent pas au ping, sans être en panne pour autant.',
    lancer: ({ args, jeu }) => {
      let n = 4;
      const reste: string[] = [];
      for (let i = 0; i < args.length; i++) {
        if (args[i] === '-c') n = Math.max(1, Math.min(10, Number(args[++i]) || 4));
        else reste.push(args[i]);
      }
      const hote = reste[0];
      if (!hote) return jeu.erreur('ping: usage error: Destination address required');
      const res = resoudreNom(jeu, hote);
      if ('erreur' in res)
        return jeu.erreur(`ping: ${hote}: ${res.erreur === 'delai' ? 'Temporary failure in name resolution' : 'Name or service not known'}`);
      const r: Reseau = jeu.etat.reseau;
      const m = r.machines[res.ip];
      const sauts = r.routes[res.ip]?.length ?? 1;
      const lignes = [`PING ${hote} (${res.ip}) 56(84) bytes of data.`];
      const temps: number[] = [];
      if (m?.ping)
        for (let i = 1; i <= n; i++) {
          const t = m.ms + ((i * 37) % 11) / 20;
          temps.push(t);
          lignes.push(`64 bytes from ${res.ip}: icmp_seq=${i} ttl=${65 - sauts} time=${t.toFixed(t < 10 ? 2 : 1)} ms`);
        }
      const recus = temps.length;
      lignes.push(
        '',
        `--- ${hote} ping statistics ---`,
        `${n} packets transmitted, ${recus} received, ${Math.round((100 * (n - recus)) / n)}% packet loss, time ${(n - 1) * 1001 + 3}ms`,
      );
      if (recus) {
        const moy = temps.reduce((a, b) => a + b, 0) / recus;
        lignes.push(`rtt min/avg/max/mdev = ${ms(Math.min(...temps))}/${ms(moy)}/${ms(Math.max(...temps))}/0.080 ms`);
      }
      return lignes.join('\n');
    },
  },

  dig: {
    manuel:
      'dig [@serveur] nom [+short] — pose une question au DNS : « quelle est l’adresse IP de ce nom ? » (domain information groper). @serveur choisit le serveur DNS à interroger ; +short ne garde que la réponse.',
    lancer: ({ args, jeu }) => {
      const serveur = args.find((a) => a.startsWith('@'))?.slice(1);
      const court = args.includes('+short');
      const nom = args.find((a) => !a.startsWith('@') && !a.startsWith('+'));
      if (!nom) return jeu.erreur('Usage : dig nom (ex. : dig lettres.example)');
      const res = resoudreNom(jeu, nom, serveur);
      const entete = `; <<>> DiG 9.18.28 <<>> ${args.join(' ')}\n;; global options: +cmd`;
      if ('erreur' in res && res.erreur === 'delai') {
        const s = res.serveurs[0] ?? '?';
        const erreurs = Array(3).fill(`;; communications error to ${s}#53: timed out`).join('\n');
        return court ? erreurs : `${erreurs}\n\n${entete}\n;; no servers could be reached`;
      }
      const utilise = serveur ?? serveursDns(jeu).find((s) => (jeu.etat.reseau as Reseau).resolveurs.includes(s))!;
      if (court) return 'ip' in res ? res.ip : '';
      const fqdn = nom.replace(/\.$/, '') + '.';
      return [
        entete,
        ';; Got answer:',
        `;; ->>HEADER<<- opcode: QUERY, status: ${'ip' in res ? 'NOERROR' : 'NXDOMAIN'}, id: 4242`,
        '',
        ';; QUESTION SECTION:',
        `;${fqdn}\t\tIN\tA`,
        ...('ip' in res ? ['', ';; ANSWER SECTION:', `${fqdn}\t3600\tIN\tA\t${res.ip}`] : []),
        '',
        ';; Query time: 18 msec',
        `;; SERVER: ${utilise}#53(${utilise}) (UDP)`,
      ].join('\n');
    },
  },

  traceroute: {
    manuel:
      'traceroute machine — montre le chemin des paquets, routeur par routeur (« saut » par « saut »), avec le temps de réponse de chacun. « * * * » : ce saut n’a pas répondu.',
    lancer: ({ args, jeu }) => {
      const hote = args.find((a) => !a.startsWith('-'));
      if (!hote) return jeu.erreur('Usage : traceroute machine');
      const res = resoudreNom(jeu, hote);
      if ('erreur' in res)
        return jeu.erreur(
          `${hote}: ${res.erreur === 'delai' ? 'Temporary failure in name resolution' : 'Name or service not known'}\nCannot handle "host" cmdline arg \`${hote}' on position 1 (argc 1)`,
        );
      const r: Reseau = jeu.etat.reseau;
      const sauts = r.routes[res.ip] ?? [];
      const lignes = [`traceroute to ${hote} (${res.ip}), 30 hops max, 60 byte packets`];
      sauts.forEach((s, i) => {
        const t = [0, 1, 2].map((k) => ms(s.ms + k * 0.13)).join(' ms  ');
        lignes.push(`${String(i + 1).padStart(2)}  ${s.nom ?? s.ip} (${s.ip})  ${t} ms`);
      });
      const arrive = sauts.at(-1)?.ip === res.ip;
      if (!arrive) {
        for (let i = sauts.length + 1; i <= sauts.length + 3; i++) lignes.push(`${String(i).padStart(2)}  * * *`);
        // Écart volontaire : le vrai traceroute continue jusqu'à 30 sauts.
        lignes.push('    (… et ainsi de suite jusqu’à 30 : plus personne ne répond)');
      }
      return lignes.join('\n');
    },
  },

  curl: {
    manuel:
      'curl [-I] adresse — va chercher une page web, comme un navigateur mais sans l’afficher joliment. -I ne demande que l’en-tête de la réponse (le code d’état, par exemple 200 = OK).',
    lancer: ({ args, jeu }) => {
      const entetes = args.includes('-I') || args.includes('--head');
      const url = args.find((a) => !a.startsWith('-'));
      if (!url) return jeu.erreur('curl: try \'curl --help\' for more information');
      const m = /^(?:(https?):\/\/)?([^/:]+)(.*)$/.exec(url);
      if (!m) return jeu.erreur(`curl: (3) URL rejected: Malformed input to a URL function`);
      const hote = m[2];
      const res = resoudreNom(jeu, hote);
      if ('erreur' in res) return jeu.erreur(`curl: (6) Could not resolve host: ${hote}`);
      const site = (jeu.etat.reseau as Reseau).web[hote];
      if (!site) return jeu.erreur(`curl: (7) Failed to connect to ${hote} port ${m[1] === 'http' ? 80 : 443} after 3002 ms: Couldn't connect to server`);
      return entetes ? site.entetes.join('\n') : site.corps;
    },
  },
};
