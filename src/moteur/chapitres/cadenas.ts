// Histoire « La Rustine » — chapitre « Le cadenas » : Caddy, pour comparer
// avec nginx et certbot. L'atelier vélo associatif a un petit serveur neuf ;
// Inès y a installé Caddy « parce qu'il fait le HTTPS tout seul »… mais le
// site n'est servi qu'en HTTP : son Caddyfile commence par :80 (le modèle du
// paquet), et une adresse sans nom ne reçoit pas de certificat. Une fois le
// nom écrit, Caddy demande un certificat à Let's Encrypt, qui n'arrive pas
// à joindre la machine : le pare-feu ne laisse passer que ssh. Enfin, les
// affiches portent www.cycles.example.
// Commandes : systemctl status caddy, journalctl -u caddy, le Caddyfile,
// caddy validate, caddy fmt, systemctl reload caddy (ou caddy reload), ufw,
// curl -I, openssl x509.
// Objectif vérifié sur l'état : vu d'internet, https://cycles.example sert
// le site avec un certificat valable, http://cycles.example renvoie vers
// HTTPS, et https://www.cycles.example sert le site ou y renvoie ; Caddy
// tourne et démarrera avec la machine.
// Sources : https://caddyserver.com/docs/automatic-https,
// https://caddyserver.com/docs/caddyfile/concepts#addresses,
// https://caddyserver.com/docs/caddyfile/directives/redir,
// https://caddyserver.com/docs/running#linux-service,
// https://letsencrypt.org/docs/challenge-types/

import { d, f, fichiersComptes, type Chapitre, type Comptes, type Droits } from '../monde';
import type { Jeu } from '../shell';
import { nouveauSystemd, demarrer, systemd } from '../systemd';
import { arreterCaddy, certificatDe, chargerCaddy, etatCaddy, nomsGeres, PID, reessayer, requeteCaddy, verifierCaddy, type EtatCaddy, type ReponseCaddy } from '../caddy';
import type { PareFeu } from '../parefeu';
import type { Ecoute } from '../commandes/ss';

const M = '/home/vous';
export const SITE = 'cycles.example';
export const WWW = `www.${SITE}`;
export const IP = '203.0.113.40';

const comptes = (): Comptes => ({
  utilisateurs: {
    root: { uid: 0, groupe: 'root', maison: '/root' },
    caddy: { uid: 999, groupe: 'caddy', maison: '/var/lib/caddy', shell: '/usr/sbin/nologin' },
    vous: { uid: 1000, groupe: 'vous' },
    ines: { uid: 1001, groupe: 'ines' },
  },
  groupes: {
    root: { gid: 0, membres: [] },
    adm: { gid: 4, membres: ['vous'] },
    sudo: { gid: 27, membres: ['vous', 'ines'] },
    caddy: { gid: 999, membres: [] },
    vous: { gid: 1000, membres: [] },
    ines: { gid: 1001, membres: [] },
  },
});

// Le Caddyfile du paquet, où Inès a seulement changé le dossier du site.
export const CADDYFILE_INES = `# The Caddyfile is an easy way to configure your Caddy web server.
#
# Unless the file starts with a global options block, the first
# uncommented line is always the address of your site.
#
# To use your own domain name (with automatic HTTPS), first make
# sure your domain's A/AAAA DNS records are properly pointed to
# this machine's public IP, then replace ":80" below with your
# domain name.

:80 {
	# Set this path to your site's directory.
	root * /var/www/cycles

	# Enable the static file server.
	file_server

	# Another common task is to set up a reverse proxy:
	# reverse_proxy localhost:8080

	# Or serve a PHP site through php-fpm:
	# php_fastcgi localhost:9000
}

# Refer to the Caddy docs for more information:
# https://caddyserver.com/docs/caddyfile`;

const BIENVENUE_CADDY = `<!DOCTYPE html>
<html>
<head>
<title>Caddy works!</title>
</head>
<body>
<h1>Caddy works!</h1>
<p>This page indicates that Caddy is running. Customize this page by editing /usr/share/caddy/index.html, or edit your Caddyfile to serve your own site.</p>
</body>
</html>`;

// La machine : SSH, et Caddy (son API d'administration, et le port 80 du site :80).
const ECOUTE: Ecoute[] = [
  { proto: 'tcp', adresse: '0.0.0.0', port: 22, processus: 'sshd', pid: 604 },
  { proto: 'tcp', adresse: '[::]', port: 22, processus: 'sshd', pid: 604 },
];

const DEBUT = Date.UTC(2027, 3, 12, 18, 5, 0);
const MAINTENANT = Date.UTC(2027, 3, 13, 9, 40, 0);

const sd = (j: Jeu) => systemd(j)!;
const vu = (j: Jeu, texte: string) => j.derniere.sortie.includes(texte) || j.derniere.erreurs.some((e) => e.includes(texte));
const curl = (j: Jeu) => j.derniere.commandes.some((c) => c[0] === 'curl');
const site = (j: Jeu) => j.t('cadenas-site');
const reponse = (r: ReponseCaddy | null) => (r && !('tls' in r) ? r : null);
const lieu = (r: ReturnType<typeof reponse>) => r?.entetes.find((e) => /^location: /i.test(e))?.replace(/^location: /i, '') ?? '';
const redirige = (r: ReturnType<typeof reponse>) => !!r && r.code >= 300 && r.code < 400 && /^https:\/\/cycles\.example(\/|$)/.test(lieu(r));

// Vu d'internet (le pare-feu compte), comme un visiteur.
const visite = (j: Jeu, nom: string, port: number) => reponse(requeteCaddy(j, nom, '/', port, true));
export const httpsServi = (j: Jeu) => visite(j, SITE, 443)?.code === 200 && visite(j, SITE, 443)!.corps === site(j);
export const httpRedirige = (j: Jeu) => redirige(visite(j, SITE, 80));
export const wwwServi = (j: Jeu) => {
  const r = visite(j, WWW, 443);
  return (r?.code === 200 && r.corps === site(j)) || redirige(r);
};
const caddyTourne = (j: Jeu) => sd(j).services.caddy.etat === 'active' && sd(j).services.caddy.active;
const charge = (j: Jeu) => etatCaddy(j)?.charge ?? null;

export const cadenas: Chapitre = {
  id: 'cadenas',
  numero: 1,
  commandes: [
    'ls',
    'cd',
    'pwd',
    'cat',
    'less',
    'head',
    'tail',
    'grep',
    'find',
    'cp',
    'mv',
    'nano',
    'sudo',
    'systemctl',
    'journalctl',
    'curl',
    'ss',
    'ps',
    'ufw',
    'caddy',
    'openssl',
    'id',
    'whoami',
  ],
  maison: M,
  accueil: 'message_de_ines.txt',
  noms: true,
  final: 'fin',
  etapes: ['adresse', 'pare-feu', 'certificat', 'fin'],
  motDePasse: 'rayons-2027',
  comptes,
  etat: () => ({
    ecoute: ECOUTE.map((e) => ({ ...e })),
    ufw: {
      actif: true,
      entrant: 'deny',
      sortant: 'allow',
      regles: [{ action: 'allow', vers: 'OpenSSH', ports: [22], de: null }],
    } satisfies PareFeu,
    systemd: nouveauSystemd('rustine', DEBUT, DEBUT, {
      ssh: { description: 'OpenBSD Secure Shell server', active: true, executable: 'sshd' },
      ufw: { description: 'Uncomplicated firewall', active: true, executable: 'ufw', resteActif: true },
      caddy: {
        description: 'Caddy',
        etat: 'inactive',
        active: true,
        executable: 'caddy',
        processus: [{ pid: PID, utilisateur: 'caddy', cpu: 0.1, mem: 1.2, commande: '/usr/bin/caddy run --environ --config /etc/caddy/Caddyfile' }],
        verifier: verifierCaddy,
        charger: chargerCaddy,
        arret: arreterCaddy,
        verifierAuRechargement: true,
      },
    }),
    processus: [
      { pid: 1, utilisateur: 'root', cpu: 0, mem: 0.1, commande: '/sbin/init' },
      { pid: 604, utilisateur: 'root', cpu: 0, mem: 0.2, commande: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' },
    ],
    // Le DNS de cycles.example et de www.cycles.example mène déjà ici.
    caddy: {
      charge: null,
      noms: ['rustine', SITE, WWW, IP],
      ip: IP,
      dns: { [SITE]: IP, [WWW]: IP },
      attente: [],
      essais: {},
    } satisfies EtatCaddy,
  }),
  initialiser: (j) => {
    // Le service a démarré avec le Caddyfile d'Inès, hier soir.
    demarrer(j, sd(j), 'caddy', true);
    sd(j).horloge = MAINTENANT;
  },
  avantCommande: (j) => reessayer(j),
  creerMonde: (t) => {
    const racine = { proprio: 'root' };
    const dossier = (enfants: Parameters<typeof d>[0], droits: Droits = racine) => d(enfants, undefined, droits);
    const fichier = (texte: string, droits: Droits = racine) => f(texte, { lignes: true, ...droits });
    const caddy = { proprio: 'caddy', groupe: 'caddy', mode: 'rwx------' };
    return dossier({
      etc: dossier({
        ...fichiersComptes(),
        hostname: fichier('rustine'),
        caddy: dossier({ Caddyfile: fichier(CADDYFILE_INES) }),
      }),
      home: dossier({
        vous: d({ 'message_de_ines.txt': f(t('cadenas-message-ines')) }),
        ines: dossier({}, { proprio: 'ines', mode: 'rwx------' }),
      }),
      usr: dossier({
        bin: dossier({ caddy: f('', { proprio: 'root', mode: 'rwxr-xr-x', taille: 41_984_160 }) }),
        share: dossier({ caddy: dossier({ 'index.html': fichier(BIENVENUE_CADDY) }) }),
      }),
      var: dossier({
        www: dossier({ cycles: dossier({ 'index.html': fichier(t('cadenas-site'), { proprio: 'ines' }) }, { proprio: 'ines' }) }),
        lib: dossier({
          caddy: dossier(
            {
              '.local': dossier({ share: dossier({ caddy: dossier({}, caddy) }, caddy) }, caddy),
              '.config': dossier({ caddy: dossier({}, caddy) }, caddy),
            },
            { proprio: 'caddy', groupe: 'caddy', mode: 'rwxr-xr-x' },
          ),
        }),
      }),
    });
  },
  evenements: [
    {
      id: 'http-seul',
      condition: (j) => vu(j, 'no automatic HTTPS will be applied') || (curl(j) && vu(j, 'port 443') && vu(j, "Couldn't connect")),
      message: (j) => j.t('cadenas-evenement-http-seul'),
    },
    {
      id: 'schema-http',
      condition: (j) => !!charge(j)?.sites.some((s) => s.adresses.some((a) => a.hote === SITE && a.schema === 'http')),
      message: (j) => j.t('cadenas-evenement-schema-http'),
    },
    { id: 'adresse', condition: (j) => !!charge(j) && nomsGeres(charge(j)!).includes(SITE), message: (j) => j.t('cadenas-evenement-adresse') },
    { id: 'pare-feu', condition: (j) => vu(j, 'Timeout during connect (likely firewall problem)'), message: (j) => j.t('cadenas-evenement-pare-feu') },
    { id: 'alerte', condition: (j) => curl(j) && vu(j, 'tlsv1 alert internal error'), message: (j) => j.t('cadenas-evenement-alerte') },
    { id: 'format', condition: (j) => vu(j, 'Caddyfile input is not formatted'), message: (j) => j.t('cadenas-evenement-format') },
    { id: 'certificat', condition: (j) => !!certificatDe(j, SITE) && httpsServi(j), message: (j) => j.t('cadenas-evenement-certificat') },
    {
      id: 'fin',
      condition: (j) => caddyTourne(j) && httpsServi(j) && httpRedirige(j) && wwwServi(j),
      message: (j) => j.t('cadenas-evenement-fin'),
    },
  ],
};
