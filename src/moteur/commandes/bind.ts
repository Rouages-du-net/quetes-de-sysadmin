// BIND 9 : dig et host (les questions), named-checkzone, named-checkconf et
// rndc (le serveur). D'après https://bind9.readthedocs.io/en/stable/manpages.html.
// Le DNS simulé est dans dns.ts ; sans etat.dns, dig garde son ancien
// fonctionnement (Le Paquet perdu, reseau.ts).

import type { Shell } from '../shell';
import { dns, interroger, lireZone, rechargerZones, serveurDe, zonesDeclarees, type Rr } from '../dns';
import { heureEte, systemd, versUtc } from '../systemd';
import type { Commande } from './index';

const VERSION = '9.20.9-1-Debian';
const TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'NS', 'TXT', 'SOA'];
const JOURS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MOIS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// « Sat Mar 20 10:00:00 CET 2027 », comme dig.
const quand = (local: number) => {
  const d = new Date(local);
  return `${JOURS[d.getUTCDay()]} ${MOIS[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2, '0')} ${d.toISOString().slice(11, 19)} ${heureEte(local) ? 'CEST' : 'CET'} ${d.getUTCFullYear()}`;
};

const ligneRr = (r: Rr) => `${r.nom.padEnd(23)} ${String(r.ttl).padEnd(7)} IN\t${r.type}\t${r.donnees}`;

// Les noms et adresses des serveurs (pour @serveur et SERVER:).
function adresseDe(jeu: Shell, nom: string): string {
  const d = dns(jeu)!;
  const s = serveurDe(d, nom)!;
  return d.serveurs[s].find((x) => /^\d+\.\d+\.\d+\.\d+$/.test(x)) ?? nom;
}

/** Le serveur que le système interroge (/etc/resolv.conf). */
const resolveurSysteme = (jeu: Shell) => /^\s*nameserver\s+(\S+)/m.exec(jeu.lire('/etc/resolv.conf') ?? '')?.[1] ?? '127.0.0.1';

export function digDns(args: string[], jeu: Shell): string {
  const d = dns(jeu)!;
  const sd = systemd(jeu);
  const local = sd?.horloge ?? 0;
  const demande = args.find((a) => a.startsWith('@'))?.slice(1);
  const court = args.includes('+short');
  const reponseSeule = args.includes('+noall') && args.includes('+answer');
  const positionnels = args.filter((a) => !a.startsWith('@') && !a.startsWith('+') && !a.startsWith('-'));
  const type =
    positionnels
      .slice(1)
      .find((a) => TYPES.includes(a.toUpperCase()))
      ?.toUpperCase() ?? (positionnels.length > 1 && TYPES.includes(positionnels[0].toUpperCase()) ? positionnels[0].toUpperCase() : 'A');
  const nom = positionnels.find((a) => !TYPES.includes(a.toUpperCase()));
  if (!nom) return jeu.erreur(jeu.t('dig-usage'));
  const cible = demande ?? resolveurSysteme(jeu);
  const serveur = serveurDe(d, cible);
  if (!serveur) {
    if (demande) return jeu.erreur(`dig: couldn't get address for '${demande}': not found`);
    return jeu.erreur(`;; communications error to ${cible}#53: timed out\n;; no servers could be reached`);
  }
  // named arrêté : le serveur de la machine ne répond plus.
  if (serveur === 'primaire' && sd?.services.named?.etat !== 'active')
    return jeu.erreur(`;; communications error to ${adresseDe(jeu, cible)}#53: connection refused\n;; no servers could be reached`);
  const r = interroger(jeu, serveur, nom, type, versUtc(local));
  jeu.etat.dnsQuestions = [
    ...(jeu.etat.dnsQuestions ?? []),
    { serveur, nom: nom.replace(/\.?$/, '.').toLowerCase(), type, donnees: r.reponses.map((x) => x.donnees) },
  ];
  if (court) return r.reponses.map((x) => x.donnees).join('\n');
  if (reponseSeule) return r.reponses.map(ligneRr).join('\n');
  const q = nom.replace(/\.?$/, '.').toLowerCase();
  const recursif = serveur === 'resolveur';
  const adresse = adresseDe(jeu, cible);
  return [
    `; <<>> DiG ${VERSION} <<>> ${args.join(' ')}`,
    ';; global options: +cmd',
    ';; Got answer:',
    `;; ->>HEADER<<- opcode: QUERY, status: ${r.statut}, id: 4242`,
    `;; flags: qr${r.autorite ? ' aa' : ''} rd${recursif ? ' ra' : ''}; QUERY: 1, ANSWER: ${r.reponses.length}, AUTHORITY: 0, ADDITIONAL: 1`,
    ...(recursif ? [] : [';; WARNING: recursion requested but not available']),
    '',
    ';; QUESTION SECTION:',
    `;${q.padEnd(30)} IN\t${type}`,
    ...(r.reponses.length ? ['', ';; ANSWER SECTION:', ...r.reponses.map(ligneRr)] : []),
    '',
    `;; Query time: ${recursif ? 14 : 0} msec`,
    `;; SERVER: ${adresse}#53(${cible}) (UDP)`,
    `;; WHEN: ${quand(local)}`,
    `;; MSG SIZE  rcvd: ${40 + r.reponses.length * 16}`,
  ].join('\n');
}

export const BIND: Record<string, Commande> = {
  host: {
    propresOptions: true,
    lancer: ({ args, jeu }) => {
      const d = dns(jeu);
      const positionnels = args.filter((a) => !a.startsWith('-'));
      const [nom, serveurDemande] = positionnels;
      if (!nom || !d) return jeu.erreur(jeu.t('host-usage'));
      const cible = serveurDemande ?? resolveurSysteme(jeu);
      const serveur = serveurDe(d, cible);
      if (!serveur) return jeu.erreur(`host: couldn't get address for '${cible}': not found`);
      const maintenant = versUtc(systemd(jeu)?.horloge ?? 0);
      const entete = serveurDemande ? ['Using domain server:', `Name: ${cible}`, `Address: ${adresseDe(jeu, cible)}#53`, 'Aliases: ', ''] : [];
      const lignes: string[] = [];
      const vus = new Set<string>();
      for (const type of ['A', 'AAAA', 'MX']) {
        const r = interroger(jeu, serveur, nom, type, maintenant);
        if (type === 'A')
          jeu.etat.dnsQuestions = [...(jeu.etat.dnsQuestions ?? []), { serveur, nom, type, donnees: r.reponses.map((x) => x.donnees) }];
        if (r.statut === 'NXDOMAIN') return jeu.erreur([...entete, `Host ${nom} not found: 3(NXDOMAIN)`].join('\n'));
        if (r.statut === 'REFUSED') return jeu.erreur([...entete, `Host ${nom} not found: 5(REFUSED)`].join('\n'));
        for (const x of r.reponses) {
          const ligne =
            x.type === 'CNAME'
              ? `${x.nom.slice(0, -1)} is an alias for ${x.donnees}`
              : x.type === 'A'
                ? `${x.nom.slice(0, -1)} has address ${x.donnees}`
                : x.type === 'AAAA'
                  ? `${x.nom.slice(0, -1)} has IPv6 address ${x.donnees}`
                  : `${x.nom.slice(0, -1)} mail is handled by ${x.donnees}`;
          if (!vus.has(ligne)) (lignes.push(ligne), vus.add(ligne));
        }
      }
      return [...entete, ...lignes].join('\n');
    },
  },

  'named-checkzone': {
    section: 8,
    propresOptions: true,
    lancer: ({ args, jeu }) => {
      const [zone, fichier] = args.filter((a) => !a.startsWith('-'));
      if (!zone || !fichier) return jeu.erreur(jeu.t('named-checkzone-usage'));
      const n = jeu.trouver(fichier);
      if (!n || n.type !== 'fichier' || !jeu.peut(n, 'r'))
        return jeu.erreur(
          `zone ${zone}/IN: loading from master file ${fichier} failed: ${!n ? 'file not found' : 'permission denied'}\nzone ${zone}/IN: not loaded due to errors.`,
        );
      const { zone: z, erreurs } = lireZone(jeu.lire(fichier) ?? '', zone, fichier);
      if (erreurs.length) {
        const raison = erreurs[0].includes('dotted') ? 'bad dotted quad' : erreurs[0].includes('unknown RR') ? 'unknown class/type' : 'failure';
        return jeu.erreur(
          [...erreurs, `zone ${zone}/IN: loading from master file ${fichier} failed: ${raison}`, `zone ${zone}/IN: not loaded due to errors.`].join(
            '\n',
          ),
        );
      }
      jeu.etat.zoneVerifiee = true;
      return `zone ${zone}/IN: loaded serial ${z.serie}\nOK`;
    },
  },

  'named-checkconf': {
    section: 8,
    propresOptions: true,
    lancer: ({ jeu }) => {
      const d = dns(jeu);
      if (!d) return '';
      const texte = jeu.lire(d.conf) ?? '';
      // Les accolades, et les fichiers de zone qui manquent.
      const ouvertes = (texte.match(/\{/g) ?? []).length;
      const fermees = (texte.match(/\}/g) ?? []).length;
      if (ouvertes !== fermees) return jeu.erreur(`${d.conf}:${texte.split('\n').length}: unexpected end of input`);
      for (const [zone, fichier] of Object.entries(zonesDeclarees(jeu)))
        if (!jeu.existe(fichier)) return jeu.erreur(`${d.conf}: zone '${zone}': file '${fichier}' not found`);
      return '';
    },
  },

  rndc: {
    section: 8,
    propresOptions: true,
    lancer: ({ args, jeu }) => {
      const d = dns(jeu);
      if (!d) return jeu.erreur(jeu.t('commande-introuvable', { commande: 'rndc' }));
      if (jeu.qui !== 'root') return jeu.erreur('open: /etc/bind/rndc.key: permission denied\nrndc: could not load rndc configuration');
      const sd = systemd(jeu);
      if (sd?.services.named?.etat !== 'active') return jeu.erreur('rndc: connect failed: 127.0.0.1#953: connection refused');
      const [action, zone] = args;
      if (action === 'status')
        return [
          `version: BIND ${VERSION} (Stable Release) <id:>`,
          'running on localhost: Linux x86_64 6.12.0-quetes',
          `number of zones: ${Object.keys(d.primaire).length + 99} (99 automatic)`,
          'server is up and running',
        ].join('\n');
      if (action !== 'reload') return jeu.erreur(jeu.t('rndc-usage'));
      if (zone) {
        if (!zonesDeclarees(jeu)[zone.replace(/\.$/, '').toLowerCase()])
          return jeu.erreur(`rndc: 'reload' failed: not found\nno matching zone '${zone}' in any view`);
        const { erreurs, changees } = rechargerZones(jeu, zone);
        if (erreurs.length) return jeu.erreur("rndc: 'reload' failed: failure");
        return changees.length ? 'zone reload queued' : 'zone reload up-to-date';
      }
      const { erreurs } = rechargerZones(jeu);
      return erreurs.length ? jeu.erreur("rndc: 'reload' failed: failure") : 'server reload successful';
    },
  },
};
