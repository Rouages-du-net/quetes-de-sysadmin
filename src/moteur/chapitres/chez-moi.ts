// Histoire « Les Lettres du quartier » — chapitre « Ça marche chez moi » :
// le DNS. Kofi a « fait pointer » cafe.example vers le serveur… en ajoutant
// une ligne dans le /etc/hosts de son propre ordinateur. Chez lui, le site du
// café marche ; chez les clients, le nom mène toujours à l'ancien hébergeur.
// Le serveur des Lettres fait autorité pour la zone (named, BIND 9) ; le
// registre en garde une copie (serveur secondaire). Il faut corriger la
// zone, augmenter son numéro de série, la vérifier, la recharger, ajouter
// www, et comprendre pourquoi les résolveurs donnent encore l'ancienne
// adresse (le TTL).
// Objectif vérifié sur l'état : les deux serveurs qui font autorité
// répondent la nouvelle adresse pour cafe.example et www.cafe.example, le
// courrier (MX) est toujours là, et la zone des Lettres n'a pas bougé.
// Sources : https://bind9.readthedocs.io/en/stable/chapter3.html (zones),
// https://bind9.readthedocs.io/en/stable/manpages.html (named-checkzone, rndc, dig),
// RFC 1034 et 1035 (TTL, SOA, CNAME).

import { d, f, fichiersComptes, type Chapitre, type Comptes, type Droits } from '../monde';
import type { Jeu } from '../shell';
import { nouveauSystemd, systemd, versUtc } from '../systemd';
import { dns, interroger, rechargerZones, type EtatDns } from '../dns';

const M = '/home/vous';
const NOUVELLE = '203.0.113.10';
const ANCIENNE = '198.51.100.80';
const ZONES = '/etc/bind/zones';

const comptes = (): Comptes => ({
  utilisateurs: {
    root: { uid: 0, groupe: 'root', maison: '/root' },
    bind: { uid: 104, groupe: 'bind', maison: '/var/cache/bind', shell: '/usr/sbin/nologin' },
    vous: { uid: 1000, groupe: 'vous' },
    rania: { uid: 1001, groupe: 'rania' },
  },
  groupes: {
    root: { gid: 0, membres: [] },
    adm: { gid: 4, membres: ['vous'] },
    sudo: { gid: 27, membres: ['vous', 'rania'] },
    bind: { gid: 104, membres: [] },
    vous: { gid: 1000, membres: [] },
    rania: { gid: 1001, membres: [] },
  },
});

const SOA = (serie: string) => `@       IN SOA  ns1.lettres.example. kofi.lettres.example. (
                ${serie} ; serial
                3600       ; refresh
                900        ; retry
                1209600    ; expire
                3600 )     ; negative cache TTL`;

// La zone du café, telle qu'elle était chez l'ancien hébergeur.
const ZONE_CAFE = `$TTL 86400
${SOA('2026091501')}
        IN NS   ns1.lettres.example.
        IN NS   ns2.registre.example.
        IN A    ${ANCIENNE}
        IN MX   10 mail.lettres.example.
        IN TXT  "v=spf1 mx -all"`;

// La zone des Lettres : un bon modèle.
const ZONE_LETTRES = `$TTL 3600
${SOA('2026111002')}
        IN NS   ns1.lettres.example.
        IN NS   ns2.registre.example.
        IN A    ${NOUVELLE}
        IN MX   10 mail
ns1     IN A    ${NOUVELLE}
mail    IN A    ${NOUVELLE}
www     IN CNAME lettres.example.`;

const NAMED_CONF = `// This is the primary configuration file for the BIND DNS server named.
//
// Please read /usr/share/doc/bind9/README.Debian for information on the
// structure of BIND configuration files in Debian, *BEFORE* you customize
// this configuration file.
//
// If you are just adding zones, please do that in /etc/bind/named.conf.local

include "/etc/bind/named.conf.options";
include "/etc/bind/named.conf.local";
include "/etc/bind/named.conf.default-zones";`;

const NAMED_CONF_LOCAL = `//
// Do any local configuration here
//

zone "lettres.example" {
    type primary;
    file "${ZONES}/db.lettres.example";
    notify yes;
    also-notify { 192.0.2.53; };
};

zone "cafe.example" {
    type primary;
    file "${ZONES}/db.cafe.example";
    notify yes;
    also-notify { 192.0.2.53; };
};`;

const NAMED_OPTIONS = `options {
    directory "/var/cache/bind";
    recursion no;
    allow-transfer { 192.0.2.53; };
    listen-on { any; };
    listen-on-v6 { any; };
};`;

const sd = (j: Jeu) => systemd(j)!;
const etat = (j: Jeu): EtatDns => dns(j)!;
// L'adresse finale d'un nom pour un serveur qui fait autorité (après les CNAME).
const adresse = (j: Jeu, serveur: 'primaire' | 'secondaire', nom: string) =>
  interroger(j, serveur, nom, 'A', 0)
    .reponses.filter((r) => r.type === 'A')
    .map((r) => r.donnees);
const bon = (j: Jeu, serveur: 'primaire' | 'secondaire') =>
  ['cafe.example', 'www.cafe.example'].every((n) => adresse(j, serveur, n).join() === NOUVELLE) &&
  interroger(j, serveur, 'cafe.example', 'MX', 0).reponses.some((r) => r.type === 'MX') &&
  adresse(j, serveur, 'lettres.example').join() === NOUVELLE;
// Un nom de la zone écrit sans le point final dans les données.
const pointOublie = (j: Jeu) =>
  (etat(j).primaire['cafe.example']?.rrs ?? []).some(
    (r) => /\.cafe\.example\.cafe\.example\.$/.test(r.donnees) || r.donnees.endsWith('.example.cafe.example.'),
  );
const meme = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export const chezMoi: Chapitre = {
  id: 'chez-moi',
  numero: 5,
  commandes: [
    'ls',
    'cd',
    'pwd',
    'cat',
    'less',
    'head',
    'tail',
    'grep',
    'cp',
    'mv',
    'nano',
    'sudo',
    'id',
    'whoami',
    'dig',
    'host',
    'named-checkzone',
    'named-checkconf',
    'rndc',
    'systemctl',
    'journalctl',
  ],
  maison: M,
  accueil: 'courriel_kofi.txt',
  noms: true,
  final: 'fin',
  motDePasse: 'fourmis-2026',
  comptes,
  etat: () => {
    const maintenant = Date.UTC(2027, 2, 20, 10, 0, 0);
    const etatDns: EtatDns = {
      conf: '/etc/bind/named.conf.local',
      primaire: {},
      secondaire: {},
      // Le résolveur public a demandé cafe.example hier à 16 h : il garde
      // l'ancienne adresse 24 heures (TTL 86400).
      cache: {
        'cafe.example. A': {
          rrs: [{ nom: 'cafe.example.', ttl: 86400, type: 'A', donnees: ANCIENNE }],
          expire: Date.UTC(2027, 2, 19, 15, 0, 0) + 86400 * 1000,
        },
      },
      serveurs: {
        primaire: ['localhost', '127.0.0.1', 'lettres', 'lettres.example', 'ns1.lettres.example', NOUVELLE],
        secondaire: ['ns2.registre.example', '192.0.2.53'],
        resolveur: ['9.9.9.9', 'dns.quad9.net'],
      },
      charges: {},
    };
    return {
      systemd: nouveauSystemd('lettres', Date.UTC(2027, 2, 1, 6, 12, 0), maintenant, {
        ssh: {
          description: 'OpenBSD Secure Shell server',
          active: true,
          executable: 'sshd',
          processus: [{ pid: 612, utilisateur: 'root', cpu: 0, mem: 0.2, commande: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' }],
        },
        named: {
          description: 'BIND Domain Name Server',
          active: true,
          executable: 'named',
          processus: [{ pid: 733, utilisateur: 'bind', cpu: 0.1, mem: 1.4, commande: '/usr/sbin/named -f -u bind' }],
          charger: (j) => void rechargerZones(j),
        },
      }),
      processus: [
        { pid: 1, utilisateur: 'root', cpu: 0, mem: 0.1, commande: '/sbin/init' },
        { pid: 612, utilisateur: 'root', cpu: 0, mem: 0.2, commande: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' },
        { pid: 733, utilisateur: 'bind', cpu: 0.1, mem: 1.4, commande: '/usr/sbin/named -f -u bind' },
      ],
      dns: etatDns,
    };
  },
  // named a chargé les zones au démarrage, et le registre en a une copie.
  initialiser: (j) => {
    rechargerZones(j);
    const e = etat(j);
    e.secondaire = JSON.parse(JSON.stringify(e.primaire));
    // Le journal de ce chargement ne date pas d'aujourd'hui : on le retire.
    sd(j).journal = sd(j).journal.filter((x) => x.unite !== 'named.service');
  },
  creerMonde: (t) => {
    const racine = { proprio: 'root' };
    const lieu = (enfants: Parameters<typeof d>[0], droits: Droits = racine) => d(enfants, undefined, droits);
    const fichier = (texte: string, droits: Droits = { proprio: 'root', groupe: 'bind' }) => f(texte, { lignes: true, ...droits });
    return lieu({
      etc: lieu({
        ...fichiersComptes(),
        hostname: fichier('lettres', racine),
        'resolv.conf': fichier('nameserver 9.9.9.9', racine),
        bind: lieu(
          {
            'named.conf': fichier(NAMED_CONF),
            'named.conf.local': fichier(NAMED_CONF_LOCAL),
            'named.conf.options': fichier(NAMED_OPTIONS),
            'named.conf.default-zones': fichier(
              '// prime the server with knowledge of the root servers\nzone "." {\n    type hint;\n    file "/usr/share/dns/root.hints";\n};',
            ),
            'rndc.key': f('key "rndc-key" {\n    algorithm hmac-sha256;\n    secret "q2V0b3VybmVyLWxlLWpldQ==";\n};', {
              lignes: true,
              proprio: 'bind',
              groupe: 'bind',
              mode: 'rw-r-----',
            }),
            zones: lieu({ 'db.lettres.example': fichier(ZONE_LETTRES), 'db.cafe.example': fichier(ZONE_CAFE) }, { proprio: 'root', groupe: 'bind' }),
          },
          { proprio: 'root', groupe: 'bind', mode: 'rwxr-sr-x' },
        ),
      }),
      home: lieu({ vous: d({ 'courriel_kofi.txt': f(t('chez-moi-courriel-kofi')), 'aide_dns.txt': f(t('chez-moi-aide-dns')) }) }),
      usr: lieu({ sbin: lieu({ named: f('', { proprio: 'root', mode: 'rwxr-xr-x', taille: 1_201_664 }) }) }),
    });
  },
  evenements: [
    {
      id: 'cache',
      // Juste après une question au résolveur public, qui répond encore l'ancienne adresse.
      condition: (j) => {
        const q: { serveur: string; donnees: string[] } | undefined = j.etat.dnsQuestions?.at(-1);
        return (
          j.derniere.commandes.some((c) => c[0] === 'dig' || c[0] === 'host') &&
          q?.serveur === 'resolveur' &&
          q.donnees.includes(ANCIENNE) &&
          adresse(j, 'primaire', 'cafe.example').join() === NOUVELLE
        );
      },
      message: (j) => {
        const memo = etat(j).cache['cafe.example. A'];
        const heures = Math.max(1, Math.round((memo.expire - versUtc(sd(j).horloge)) / 3_600_000));
        return j.t('chez-moi-evenement-cache', { heures });
      },
    },
    {
      id: 'erreur-zone',
      condition: (j) => j.derniere.erreurs.some((e) => e.includes("'reload' failed")),
      message: (j) => j.t('chez-moi-evenement-erreur-zone'),
    },
    {
      id: 'serial',
      condition: (j) => {
        const e = etat(j);
        return !meme(e.primaire['cafe.example']?.rrs, e.secondaire['cafe.example']?.rrs);
      },
      message: (j) => j.t('chez-moi-evenement-serial'),
    },
    {
      id: 'point-final',
      condition: pointOublie,
      message: (j) => j.t('chez-moi-evenement-point-final'),
    },
    {
      id: 'fin',
      condition: (j) => bon(j, 'primaire') && bon(j, 'secondaire'),
      message: (j) => j.t('chez-moi-evenement-fin'),
    },
  ],
};
