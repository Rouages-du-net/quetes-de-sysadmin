// Histoire « Le Paquet perdu » : diagnostiquer une panne réseau couche par
// couche, avec ping, dig, traceroute et curl. Prolonge le module « De
// l'Entrée à la page » (DNS, voyage des paquets, réponse du serveur).
//
// Adresses : réseau local privé (192.168.x.x, RFC 1918), réseau de collecte
// d'opérateur (100.64.x.x, RFC 6598), le reste réservé à la documentation
// (RFC 5737) ; noms en .example (RFC 6761). Seule exception : 9.9.9.9, le
// résolveur DNS public de la fondation Quad9.

import { d, f, type Chapter } from '../world';

const M = '/home/you';
const SITE = 'letters.example';
const IP_SITE = '203.0.113.10';

const hop = (ip: string, name: string, ms: number) => ({ ip, name, ms });
const BOX = hop('192.168.1.1', 'box.maison', 0.9);
const TO_ISP = [BOX, hop('100.64.0.1', 'backhaul.isp.example', 4.2), hop('198.51.100.1', 'core.isp.example', 7.9)];

const last = (j: { last: { commands: string[][] } }) => j.last.commands[0] ?? [];
const succeededPing = (j: any, target: string) =>
  last(j)[0] === 'ping' && last(j).includes(target) && j.last.output.includes(' 0% packet loss');
const repairedDns = (j: any) => /^\s*nameserver\s+(192\.168\.1\.1|9\.9\.9\.9)\s*$/m.test(j.read('/etc/resolv.conf') ?? '');

export const pkg: Chapter = {
  id: 'lost-packet',
  number: 1,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'cp', 'ping', 'dig', 'traceroute', 'curl', 'sudo', 'grep'],
  home: M,
  welcome: 'note_from_kofi.txt',
  names: true,
  final: 'curl',
  password: 'anthill',
  // t : les textes dans la langue du jeu (français tant que le shell ne le
  // transmet pas).
  state: (t) => ({
    reseau: {
      machines: {
        '192.168.1.1': { ping: true, ms: 0.9 },
        '9.9.9.9': { ping: true, ms: 11.8 },
        // Le serveur du site ne répond pas au ping : son pare-feu l'ignore.
        [IP_SITE]: { ping: false, ms: 12.6 },
      },
      names: { [SITE]: IP_SITE, 'box.maison': '192.168.1.1' },
      resolvers: ['192.168.1.1', '9.9.9.9'],
      routes: {
        '192.168.1.1': [BOX],
        '9.9.9.9': [...TO_ISP, hop('9.9.9.9', 'dns9.quad9.net', 11.8)],
        [IP_SITE]: [...TO_ISP, hop('198.51.100.130', 'exchange.ix.example', 9.1), hop('203.0.113.1', 'router.hosting.example', 11.4)],
      },
      web: {
        [SITE]: {
          headers: ['HTTP/2 200', 'content-type: text/html; charset=utf-8', 'content-length: 1342', 'server: nginx', 'date: Tue, 13 Oct 2026 19:42:07 GMT'],
          body: `<!doctype html>\n<html lang="${t.language}">\n<head><title>${t('lost-packet-site-titre')}</title></head>\n<body>\n<h1>${t('lost-packet-site-titre')}</h1>\n<p>${t('lost-packet-site-texte')}</p>\n</body>\n</html>`,
        },
      },
    },
  }),
  createWorld: (t) =>
    d(
      {
        home: d(
          {
            you: d({
              'note_from_kofi.txt': f(t('lost-packet-note-de-kofi')),
              'notebook.txt': f(t('lost-packet-carnet')),
            }),
          },
          undefined,
          { owner: 'root' },
        ),
        etc: d(
          {
            'resolv.conf': f(
              `
# ${t('lost-packet-resolv-commentaire')}
nameserver 192.168.1.250
`,
              { owner: 'root', lines: true },
            ),
            'resolv.conf.box': f(
              `
# ${t('lost-packet-resolv-box-commentaire')}
nameserver 192.168.1.1
`,
              { owner: 'root', lines: true },
            ),
          },
          undefined,
          { owner: 'root' },
        ),
      },
      undefined,
      { owner: 'root' },
    ),
  events: [
    {
      id: 'box',
      condition: (j) => succeededPing(j, '192.168.1.1'),
      message: (j) => j.t('lost-packet-evenement-box'),
    },
    {
      id: 'internet',
      condition: (j) => succeededPing(j, '9.9.9.9'),
      message: (j) => j.t('lost-packet-evenement-internet'),
    },
    {
      id: 'nom',
      condition: (j) => last(j)[0] === 'ping' && j.last.errors.some((e) => e.includes('name resolution')),
      message: (j) => j.t('lost-packet-evenement-nom'),
    },
    {
      id: 'dns-muet',
      condition: (j) => last(j)[0] === 'dig' && /no servers could be reached|timed out/.test(j.last.output + j.last.errors.join()),
      message: (j) => j.t('lost-packet-evenement-dns-muet'),
    },
    {
      id: 'dns-autre',
      condition: (j) => last(j)[0] === 'dig' && j.last.output.includes(IP_SITE),
      message: (j) => j.t('lost-packet-evenement-dns-autre', { ip: IP_SITE }),
    },
    {
      id: 'dns-repare',
      condition: repairedDns,
      message: (j) => j.t('lost-packet-evenement-dns-repare'),
    },
    {
      id: 'ping-perdu',
      condition: (j) => repairedDns(j) && last(j)[0] === 'ping' && last(j).includes(SITE) && j.last.output.includes('100% packet loss'),
      message: (j) => j.t('lost-packet-evenement-ping-perdu', { ip: IP_SITE }),
    },
    {
      id: 'route',
      condition: (j) => repairedDns(j) && last(j)[0] === 'traceroute' && j.last.output.includes('203.0.113.1'),
      message: (j) => j.t('lost-packet-evenement-route'),
    },
    {
      id: 'curl',
      condition: (j) => repairedDns(j) && last(j)[0] === 'curl' && /HTTP\/2 200|<html/.test(j.last.output),
      message: (j) => j.t('lost-packet-evenement-curl'),
    },
  ],
};
