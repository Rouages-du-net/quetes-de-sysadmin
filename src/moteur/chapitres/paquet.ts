// Histoire « Le Paquet perdu » : diagnostiquer une panne réseau couche par
// couche, avec ping, dig, traceroute et curl. Prolonge le module « De
// l'Entrée à la page » (DNS, voyage des paquets, réponse du serveur).
//
// Adresses : réseau local privé (192.168.x.x, RFC 1918), réseau de collecte
// d'opérateur (100.64.x.x, RFC 6598), le reste réservé à la documentation
// (RFC 5737) ; noms en .example (RFC 6761). Seule exception : 9.9.9.9, le
// résolveur DNS public de la fondation Quad9.

import { d, f, type Chapitre } from '../monde';

const M = '/home/vous';
const SITE = 'lettres.example';
const IP_SITE = '203.0.113.10';

const saut = (ip: string, nom: string, ms: number) => ({ ip, nom, ms });
const BOX = saut('192.168.1.1', 'box.maison', 0.9);
const VERS_FAI = [BOX, saut('100.64.0.1', 'collecte.fai.example', 4.2), saut('198.51.100.1', 'coeur.fai.example', 7.9)];

const derniere = (j: { derniere: { commandes: string[][] } }) => j.derniere.commandes[0] ?? [];
const pingReussi = (j: any, cible: string) =>
  derniere(j)[0] === 'ping' && derniere(j).includes(cible) && j.derniere.sortie.includes(' 0% packet loss');
const dnsRepare = (j: any) => /^\s*nameserver\s+(192\.168\.1\.1|9\.9\.9\.9)\s*$/m.test(j.lire('/etc/resolv.conf') ?? '');

export const paquet: Chapitre = {
  id: 'paquet-perdu',
  numero: 1,
  commandes: ['ls', 'cd', 'pwd', 'cat', 'less', 'cp', 'ping', 'dig', 'traceroute', 'curl', 'sudo', 'grep'],
  maison: M,
  accueil: 'note_de_kofi.txt',
  noms: true,
  final: 'curl',
  motDePasse: 'fourmiliere',
  // t : les textes dans la langue du jeu (français tant que le shell ne le
  // transmet pas).
  etat: (t) => ({
    reseau: {
      machines: {
        '192.168.1.1': { ping: true, ms: 0.9 },
        '9.9.9.9': { ping: true, ms: 11.8 },
        // Le serveur du site ne répond pas au ping : son pare-feu l'ignore.
        [IP_SITE]: { ping: false, ms: 12.6 },
      },
      noms: { [SITE]: IP_SITE, 'box.maison': '192.168.1.1' },
      resolveurs: ['192.168.1.1', '9.9.9.9'],
      routes: {
        '192.168.1.1': [BOX],
        '9.9.9.9': [...VERS_FAI, saut('9.9.9.9', 'dns9.quad9.net', 11.8)],
        [IP_SITE]: [...VERS_FAI, saut('198.51.100.130', 'echange.ix.example', 9.1), saut('203.0.113.1', 'routeur.hebergeur.example', 11.4)],
      },
      web: {
        [SITE]: {
          entetes: ['HTTP/2 200', 'content-type: text/html; charset=utf-8', 'content-length: 1342', 'server: nginx', 'date: Tue, 13 Oct 2026 19:42:07 GMT'],
          corps: `<!doctype html>\n<html lang="${t.langue}">\n<head><title>${t('paquet-perdu-site-titre')}</title></head>\n<body>\n<h1>${t('paquet-perdu-site-titre')}</h1>\n<p>${t('paquet-perdu-site-texte')}</p>\n</body>\n</html>`,
        },
      },
    },
  }),
  creerMonde: (t) =>
    d(
      {
        home: d(
          {
            vous: d({
              'note_de_kofi.txt': f(t('paquet-perdu-note-de-kofi')),
              'carnet.txt': f(t('paquet-perdu-carnet')),
            }),
          },
          undefined,
          { proprio: 'root' },
        ),
        etc: d(
          {
            'resolv.conf': f(
              `
# ${t('paquet-perdu-resolv-commentaire')}
nameserver 192.168.1.250
`,
              { proprio: 'root', lignes: true },
            ),
            'resolv.conf.box': f(
              `
# ${t('paquet-perdu-resolv-box-commentaire')}
nameserver 192.168.1.1
`,
              { proprio: 'root', lignes: true },
            ),
          },
          undefined,
          { proprio: 'root' },
        ),
      },
      undefined,
      { proprio: 'root' },
    ),
  evenements: [
    {
      id: 'box',
      condition: (j) => pingReussi(j, '192.168.1.1'),
      message: (j) => j.t('paquet-perdu-evenement-box'),
    },
    {
      id: 'internet',
      condition: (j) => pingReussi(j, '9.9.9.9'),
      message: (j) => j.t('paquet-perdu-evenement-internet'),
    },
    {
      id: 'nom',
      condition: (j) => derniere(j)[0] === 'ping' && j.derniere.erreurs.some((e) => e.includes('name resolution')),
      message: (j) => j.t('paquet-perdu-evenement-nom'),
    },
    {
      id: 'dns-muet',
      condition: (j) => derniere(j)[0] === 'dig' && /no servers could be reached|timed out/.test(j.derniere.sortie + j.derniere.erreurs.join()),
      message: (j) => j.t('paquet-perdu-evenement-dns-muet'),
    },
    {
      id: 'dns-autre',
      condition: (j) => derniere(j)[0] === 'dig' && j.derniere.sortie.includes(IP_SITE),
      message: (j) => j.t('paquet-perdu-evenement-dns-autre', { ip: IP_SITE }),
    },
    {
      id: 'dns-repare',
      condition: dnsRepare,
      message: (j) => j.t('paquet-perdu-evenement-dns-repare'),
    },
    {
      id: 'ping-perdu',
      condition: (j) => dnsRepare(j) && derniere(j)[0] === 'ping' && derniere(j).includes(SITE) && j.derniere.sortie.includes('100% packet loss'),
      message: (j) => j.t('paquet-perdu-evenement-ping-perdu', { ip: IP_SITE }),
    },
    {
      id: 'route',
      condition: (j) => dnsRepare(j) && derniere(j)[0] === 'traceroute' && j.derniere.sortie.includes('203.0.113.1'),
      message: (j) => j.t('paquet-perdu-evenement-route'),
    },
    {
      id: 'curl',
      condition: (j) => dnsRepare(j) && derniere(j)[0] === 'curl' && /HTTP\/2 200|<html/.test(j.derniere.sortie),
      message: (j) => j.t('paquet-perdu-evenement-curl'),
    },
  ],
};
