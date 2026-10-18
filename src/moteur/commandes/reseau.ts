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
import { requete, type Reponse } from '../nginx';
import { requeteDocker } from '../docker';
import { digDns } from './bind';
import { couvre, lire } from '../tls';
import { systemd, versUtc } from '../systemd';

// Ce que curl ajoute quand la vérification du certificat échoue (curl 8).
const AIDE_SSL = `More details here: https://curl.se/docs/sslcerts.html

curl failed to verify the legitimacy of the server and therefore could not
establish a secure connection to it. To learn more about this situation and
how to fix it, please visit the webpage mentioned above.`;

// La réponse d'une appli dans un conteneur, avec ses en-têtes.
function reponseAppli(jeu: Shell, r: { code: number; corps: string }): Reponse {
  const raisons: Record<number, string> = { 200: 'OK', 404: 'Not Found', 500: 'Internal Server Error' };
  const date = new Date(versUtc(systemd(jeu)?.horloge ?? 0)).toUTCString();
  return {
    code: r.code,
    corps: r.corps,
    entetes: [`HTTP/1.1 ${r.code} ${raisons[r.code] ?? ''}`.trimEnd(), 'Content-Type: text/html; charset=utf-8', `Content-Length: ${new TextEncoder().encode(r.corps).length}`, `Date: ${date}`],
  };
}

/** Le problème du certificat présenté, au format de curl ; null s'il est bon. */
export function verifierCertificat(jeu: Shell, contenu: string | null, hote: string): string | null {
  const c = lire(contenu);
  if (!c) return 'SSL certificate problem: unable to get local issuer certificate';
  const maintenant = versUtc(systemd(jeu)?.horloge ?? 0);
  if (maintenant > c.fin) return 'SSL certificate problem: certificate has expired';
  if (maintenant < c.debut) return 'SSL certificate problem: certificate is not yet valid';
  if (!couvre(c, hote)) return `SSL: no alternative certificate subject name matches target hostname '${hote}'`;
  return null;
}

interface Reseau {
  machines: Record<string, { ping: boolean; ms: number }>;
  noms: Record<string, string>;
  resolveurs: string[];
  routes: Record<string, { ip: string; nom?: string; ms: number }[]>;
  web: Record<string, { entetes: string[]; corps: string }>;
}

// Les noms sous lesquels une machine avec nginx se joint elle-même : etat.nginx.noms.
const LOCAL_DE_BASE = ['localhost', '127.0.0.1'];

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
    propresOptions: true,
    lancer: ({ args, jeu }) => {
      // Une machine avec un vrai DNS simulé (zones, serveurs, cache) : bind.ts.
      if (jeu.etat.dns) return digDns(args, jeu);
      const serveur = args.find((a) => a.startsWith('@'))?.slice(1);
      const court = args.includes('+short');
      const nom = args.find((a) => !a.startsWith('@') && !a.startsWith('+'));
      if (!nom) return jeu.erreur(jeu.t('dig-usage'));
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
    lancer: ({ args, jeu }) => {
      const hote = args.find((a) => !a.startsWith('-'));
      if (!hote) return jeu.erreur(jeu.t('traceroute-usage'));
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
        lignes.push('    ' + jeu.t('traceroute-plus-personne'));
      }
      return lignes.join('\n');
    },
  },

  curl: {
    // curl a beaucoup d'options (-s, -L, -v…) : on ignore celles qu'on ne simule pas.
    propresOptions: true,
    lancer: ({ args, jeu }) => {
      // Les options qui prennent une valeur ; -H « Host: nom » choisit le site demandé.
      const AVEC_VALEUR = ['-H', '--header', '-o', '--output', '-X', '--request', '-d', '--data', '-A', '--user-agent', '-u', '--user', '-w', '--write-out', '-e', '--referer'];
      let hoteDemande: string | null = null;
      const positionnels: string[] = [];
      for (let i = 0; i < args.length; i++) {
        if (AVEC_VALEUR.includes(args[i])) {
          const valeur = args[++i] ?? '';
          const h = /^host:\s*(\S+)/i.exec(valeur);
          if ((args[i - 1] === '-H' || args[i - 1] === '--header') && h) hoteDemande = h[1];
        } else if (!args[i].startsWith('-')) positionnels.push(args[i]);
      }
      const entetes = args.includes('-I') || args.includes('--head');
      const suivre = args.includes('-L') || args.includes('--location');
      const url = positionnels[0];
      if (!url) return jeu.erreur("curl: try 'curl --help' for more information");
      const m = /^(?:(https?):\/\/)?([^/:]+)(?::(\d+))?(.*)$/.exec(url);
      if (!m) return jeu.erreur(`curl: (3) URL rejected: Malformed input to a URL function`);
      const hote = m[2];
      // Une machine avec nginx : la requête part vers elle-même (localhost,
      // son nom, son adresse), et nginx répond selon sa configuration chargée.
      if (jeu.etat.nginx || jeu.etat.docker) {
        const conteneurs: string[] = (jeu.etat.docker?.conteneurs ?? []).map((c: { ip: string }) => c.ip);
        const locaux = [...LOCAL_DE_BASE, ...(jeu.etat.nginx?.noms ?? jeu.etat.docker?.noms ?? []), ...conteneurs];
        const blocs: string[] = [];
        let [schema, cible, port, chemin, nom] = [m[1] ?? 'http', hote, Number(m[3] ?? (m[1] === 'https' ? 443 : 80)), m[4] || '/', hoteDemande ?? hote];
        // -L suit les redirections (au plus 5 ici).
        for (let saut = 0; saut < 6; saut++) {
          if (!locaux.includes(cible.toLowerCase())) return jeu.erreur(`curl: (6) Could not resolve host: ${cible}`);
          // Un port publié par un conteneur (docker run -p) : c'est lui qui répond.
          const viaDocker = requeteDocker(jeu, cible.toLowerCase() === 'localhost' ? '127.0.0.1' : cible, port, chemin);
          const r =
            viaDocker !== undefined
              ? viaDocker && viaDocker.code !== 0 && reponseAppli(jeu, viaDocker)
              : jeu.etat.nginx && (port === 80 || port === 443)
                ? requete(jeu, nom, chemin, port)
                : null;
          // Un service qui ne parle pas HTTP (une base de données) : réponse vide.
          if (viaDocker?.code === 0) return jeu.erreur('curl: (52) Empty reply from server');
          if (!r) return jeu.erreur(`curl: (7) Failed to connect to ${cible} port ${port} after 0 ms: Couldn't connect to server`);
          // HTTPS : curl vérifie le certificat présenté (dates, nom), sauf avec -k.
          const insecure = args.some((a) => a === '-k' || a === '--insecure');
          const probleme = schema === 'https' && !insecure ? verifierCertificat(jeu, r.certificat ?? null, cible) : null;
          if (probleme) return jeu.erreur(`curl: (60) ${probleme}\n${AIDE_SSL}`);
          const ailleurs = r.entetes.find((e) => e.startsWith('Location: '))?.slice(10);
          if (!suivre || !ailleurs || r.code < 300 || r.code >= 400) {
            blocs.push(entetes ? r.entetes.join('\n') : r.corps);
            return blocs.join('\n\n');
          }
          if (entetes) blocs.push(r.entetes.join('\n'));
          const suite = /^(https?):\/\/([^/:]+)(?::(\d+))?(.*)$/.exec(ailleurs);
          if (!suite) return jeu.erreur(`curl: (3) URL rejected: Malformed input to a URL function`);
          [schema, cible, port, chemin, nom] = [suite[1], suite[2], Number(suite[3] ?? (suite[1] === 'https' ? 443 : 80)), suite[4] || '/', suite[2]];
        }
        return jeu.erreur('curl: (47) Maximum (5) redirects followed');
      }
      const res = resoudreNom(jeu, hote);
      if ('erreur' in res) return jeu.erreur(`curl: (6) Could not resolve host: ${hote}`);
      const site = (jeu.etat.reseau as Reseau).web[hote];
      if (!site)
        return jeu.erreur(`curl: (7) Failed to connect to ${hote} port ${m[1] === 'http' ? 80 : 443} after 3002 ms: Couldn't connect to server`);
      return entetes ? site.entetes.join('\n') : site.corps;
    },
  },
};
