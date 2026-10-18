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
  titre: 'Le Paquet perdu',
  resume: 'Trouver où se perd un message, couche par couche : ping, dig, traceroute, curl.',
  commandes: ['ls', 'cd', 'pwd', 'cat', 'less', 'cp', 'ping', 'dig', 'traceroute', 'curl', 'sudo', 'grep'],
  maison: M,
  accueil: 'note_de_kofi.txt',
  final: 'curl',
  motDePasse: 'fourmiliere',
  etat: () => ({
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
          corps:
            '<!doctype html>\n<html lang="fr">\n<head><title>Les Lettres du quartier</title></head>\n<body>\n<h1>Les Lettres du quartier</h1>\n<p>Le site fonctionne ! Écrivez-nous.</p>\n</body>\n</html>',
        },
      },
    },
  }),
  creerMonde: () =>
    d(
      {
        home: d(
          {
            vous: d({
              'note_de_kofi.txt': f(`
Un mot de Kofi, bénévole au café associatif La Fourmilière :

« Au secours ! Internet ne marche plus sur l'ordinateur du café. Le site
des Lettres du quartier (lettres.example) ne s'ouvre pas, et c'est là que
l'on publie le programme de la semaine.

J'ai déjà redémarré la box. Rien. Peux-tu regarder ? Le mot de passe de cet
ordinateur, si tu en as besoin : fourmiliere

Il y a un carnet à côté de l'écran :  cat carnet.txt  »
`),
              'carnet.txt': f(`
CARNET DE DÉPANNAGE — trouver où le paquet se perd

On teste de proche en proche, du plus près au plus loin :

  1. Ma box répond-elle ?           ping 192.168.1.1
  2. Internet répond-il ?           ping 9.9.9.9   (un serveur DNS public)
  3. Les noms fonctionnent-ils ?    ping lettres.example
                                    dig lettres.example
  4. Par où passent les paquets ?   traceroute lettres.example
  5. Le site répond-il ?            curl -I https://lettres.example

Le DNS traduit un nom (lettres.example) en adresse IP (des chiffres).
L'ordinateur sait quel serveur DNS interroger grâce au fichier
/etc/resolv.conf (ligne « nameserver »).

Les commandes réseau répondent en anglais, comme sur un vrai système :
« packet loss » = paquets perdus, « timed out » = délai dépassé.
`),
            }),
          },
          undefined,
          { proprio: 'root' },
        ),
        etc: d(
          {
            'resolv.conf': f(
              `
# Écrit lors de l'installation, avec l'ancienne box
nameserver 192.168.1.250
`,
              { proprio: 'root', lignes: true },
            ),
            'resolv.conf.box': f(
              `
# Réglage conseillé par la nouvelle box
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
      message: `
La box répond, en une milliseconde à peine : le réseau local (le câble ou
le Wi-Fi jusqu'à la box) fonctionne. ping envoie un petit message ICMP
« echo » ; la machine renvoie la balle, et l'on mesure l'aller-retour.

Plus loin maintenant : un serveur sur internet,  ping 9.9.9.9
`,
    },
    {
      id: 'internet',
      condition: (j) => pingReussi(j, '9.9.9.9'),
      message: `
9.9.9.9 répond : les paquets sortent bien sur internet et reviennent.
Donc « internet » marche ! Le problème est ailleurs. Essaie le nom du site :
ping lettres.example
`,
    },
    {
      id: 'nom',
      condition: (j) => derniere(j)[0] === 'ping' && j.derniere.erreurs.some((e) => e.includes('name resolution')),
      message: `
« Temporary failure in name resolution » : l'ordinateur n'arrive pas à
traduire le nom en adresse IP. C'est le travail du DNS. Pose-lui la
question directement : dig lettres.example
`,
    },
    {
      id: 'dns-muet',
      condition: (j) => derniere(j)[0] === 'dig' && /no servers could be reached|timed out/.test(j.derniere.sortie + j.derniere.erreurs.join()),
      message: `
Le serveur DNS 192.168.1.250 ne répond pas : « timed out ». D'où vient cette
adresse ? Regarde cat /etc/resolv.conf

Et pour vérifier que le nom existe bien, demande à un autre serveur DNS :
dig @9.9.9.9 lettres.example
`,
    },
    {
      id: 'dns-autre',
      condition: (j) => derniere(j)[0] === 'dig' && j.derniere.sortie.includes(IP_SITE),
      message: `
Avec un autre serveur DNS, la réponse arrive : lettres.example = ${IP_SITE}.
Le nom existe, c'est le réglage de l'ordinateur qui est faux : il interroge
192.168.1.250, l'adresse de l'ANCIENNE box, qui n'existe plus.

Le bon réglage est dans /etc/resolv.conf.box. Ce fichier appartient à root :
sudo cp /etc/resolv.conf.box /etc/resolv.conf
`,
    },
    {
      id: 'dns-repare',
      condition: dnsRepare,
      message: `Le DNS est réparé : l'ordinateur interroge maintenant la nouvelle box. Réessaie :  ping lettres.example`,
    },
    {
      id: 'ping-perdu',
      condition: (j) => dnsRepare(j) && derniere(j)[0] === 'ping' && derniere(j).includes(SITE) && j.derniere.sortie.includes('100% packet loss'),
      message: `
Le nom est traduit (${IP_SITE})… mais 100 % des paquets sont perdus !
Le site serait-il en panne ? Ou les paquets se perdent-ils en route ?
Suis-les à la trace :  traceroute lettres.example
`,
    },
    {
      id: 'route',
      condition: (j) => dnsRepare(j) && derniere(j)[0] === 'traceroute' && j.derniere.sortie.includes('203.0.113.1'),
      message: `
Voilà le voyage du paquet, saut par saut :
 1. ta box ;
 2-3. les routeurs de ton opérateur (le FAI) ;
 4. un point d'échange, où les réseaux se raccordent entre eux ;
 5. le routeur de l'hébergeur du site.
Puis plus rien : « * * * ». Les paquets arrivent jusqu'à la porte de
l'hébergeur. Beaucoup de serveurs ignorent volontairement le ping et le
traceroute (leur pare-feu les filtre) : ce silence ne prouve pas une panne.

Le seul vrai test, c'est de demander la page :  curl -I https://lettres.example
`,
    },
    {
      id: 'curl',
      condition: (j) => dnsRepare(j) && derniere(j)[0] === 'curl' && /HTTP\/2 200|<html/.test(j.derniere.sortie),
      message: `
HTTP/2 200 : le site répond parfaitement ! Kofi peut publier le programme.

Résumé de l'enquête : le réseau local marchait (ping box), internet aussi
(ping 9.9.9.9). La panne était dans le DNS : l'ordinateur interrogeait une
ancienne box disparue. Une fois le DNS réparé, le ping du site échouait…
mais seulement parce que son pare-feu ignore le ping. curl l'a prouvé.

FIN DE L'HISTOIRE « LE PAQUET PERDU ».

La méthode à retenir : tester de proche en proche, et ne pas conclure trop
vite. « Pas de réponse au ping » ne veut pas dire « en panne ».
`,
    },
  ],
};
