// Histoire « La Veille » : ce que ses chapitres ont en commun. Six mois
// après « L'Audit », le Fournil a migré sur un nouveau serveur (petrin,
// même domaine public fournil.example) pendant que l'activité grandissait.
// Salomé revient non plus pour auditer, mais pour transmettre une habitude :
// la veille de sécurité hebdomadaire, qu'on tient seul·e une fois qu'elle
// n'est plus là. Aucune CVE réelle : des identifiants fictifs
// (CVE-2099-NNNNN), de la forme des vraies. On ne corrige qu'après avoir
// vérifié que ça concerne ce serveur ; on ne casse rien ; on prouve.

import { d, f, fichiersComptes, joueur, type Comptes, type Dossier, type Noeud } from '../world';
import { clePublique, machineDeHistoire } from '../machines';
import type { Traduire } from '../../texts';
import type { EtatApt } from '../commands/apt';
import { NGINX_CONF, MIME } from '../commands/apt';
import { chargerNginx } from '../nginx';
import type { EtatScan, HoteScan, ServiceScan } from '../scan';
import type { Ecoute } from '../commands/ss';
import type { Jeu } from '../shell';
import { SUDOERS } from './coop';
import { chargerSshd, fichier, journalSsh, sectionsMd, serviceSsh, sshd } from './audit';

export { journalSsh, sectionsMd, serviceSsh, sshd, fichier };

/** Au début de chaque chapitre : sshd et nginx appliquent la configuration du disque. */
export const initialiserVeille = (j: Jeu) => {
  chargerSshd(j);
  chargerNginx(j);
};

export const M = '/home/vous';
export const MOT_DE_PASSE = 'levain-2028';
// Mardi 15 septembre 2028, 9 h 30 : six mois après « L'Audit ».
export const MAINTENANT = Date.UTC(2028, 8, 15, 9, 30, 0);
// Une adresse quelconque d'internet (RFC 5737).
export const INTERNET = '198.51.100.23';
export const ADRESSE = '192.0.2.24';

// Les CVE fictives du bulletin (forme des vraies, aucune n'existe). Les
// versions suivent les paquets déjà simulés (src/engine/commands/apt.ts).
export const CVE = {
  // Publique (80/443), un correctif existe : à traiter en premier malgré un
  // score plus bas que rsync.
  nginx: {
    id: 'CVE-2099-41042',
    paquet: 'nginx',
    cvss: 8.2,
    installee: '1.26.3-3+deb13u2',
    corrigee: '1.26.3-3+deb13u3',
  },
  // Score plus haut, mais aucun port en écoute (outil local, lancé à la
  // main ou par une tâche planifiée) : à traiter après nginx malgré le score.
  rsync: {
    id: 'CVE-2099-37715',
    paquet: 'rsync',
    cvss: 9.8,
    installee: '3.4.1+ds1-4',
    corrigee: '3.4.1+ds1-5',
  },
  // Sans objet : le paquet n'est pas installé sur ce serveur.
  certbot: {
    id: 'CVE-2099-50288',
    paquet: 'python3-certbot-nginx',
    cvss: 5.3,
  },
  // Sans objet : la version installée est déjà au-delà de la version corrigée.
  curl: {
    id: 'CVE-2099-12003',
    paquet: 'curl',
    cvss: 6.1,
    installee: '8.14.1-3',
    affecteeJusqua: '8.14.1-2',
    corrigee: '8.14.1-3',
  },
  // Pertinente, mais déjà hors de portée : KbdInteractiveAuthentication est
  // à « no » depuis le début sur ce serveur, et aucun correctif Debian
  // n'existe encore.
  ssh: {
    id: 'CVE-2099-29107',
    paquet: 'openssh-server',
    cvss: 5.9,
  },
};

const racine = { proprio: 'root' };

// sshd_config déjà durci (ce que « L'Audit » laisse derrière lui, repris sur
// le nouveau serveur à l'installation).
export const SSHD_CONFIG = `
# This is the sshd server system-wide configuration file.  See
# sshd_config(5) for more information.

Include /etc/ssh/sshd_config.d/*.conf

#Port 22
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
MaxAuthTries 3

UsePAM yes

X11Forwarding no
AllowTcpForwarding no
AllowAgentForwarding no
PrintMotd no

# Allow client to pass locale environment variables
AcceptEnv LANG LC_*

# override default of no subsystems
Subsystem	sftp	/usr/lib/openssh/sftp-server
`.trim();

// Le site du Fournil : une page de commande, rien de dynamique.
export const SITE = `server {
    listen 80 default_server;
    listen [::]:80 default_server;

    server_name fournil.example www.fournil.example;

    root /var/www/fournil;
    index index.html;

    location ~ /\\. {
        deny all;
    }
}`;

const INDEX = `<!DOCTYPE html>
<html lang="fr">
<title>Le Fournil</title>
<h1>Le Fournil</h1>
<p>Commandez votre pain pour le retrait en boutique.</p>
</html>`;

// Les comptes : Nadia (la gérante, pas d'accès sudo) et le compte du joueur.
export const comptesVeille = (): Comptes => ({
  utilisateurs: {
    root: { uid: 0, groupe: 'root', maison: '/root' },
    vous: { uid: 1000, groupe: 'vous' },
    nadia: { uid: 1001, groupe: 'nadia' },
  },
  groupes: {
    root: { gid: 0, membres: [] },
    adm: { gid: 4, membres: ['vous'] },
    sudo: { gid: 27, membres: ['vous'] },
    vous: { gid: 1000, membres: [] },
    nadia: { gid: 1001, membres: [] },
  },
});

/** L'état d'apt au début d'un chapitre : le bulletin de la semaine, pas encore traité. */
export const aptVeille = (listes = true): EtatApt => ({
  listes,
  installes: {
    curl: CVE.curl.installee,
    rsync: CVE.rsync.installee,
    tar: '1.35+dfsg-3.1',
    'openssh-server': '1:10.0p1-7+deb13u1',
    nginx: CVE.nginx.installee,
    'nginx-common': CVE.nginx.installee,
    openssl: '3.5.4-1~deb13u1',
  },
  mises: { nginx: CVE.nginx.corrigee, rsync: CVE.rsync.corrigee },
});

// La version que nginx annonce ne change pas avec un correctif Debian (le
// numéro upstream seul est visible) : la preuve de « Le correctif » passe
// par apt (dpkg -l, apt list --upgradable), pas par nmap.
const SERVICES: ServiceScan[] = [
  { port: 22, service: 'ssh', produit: 'OpenSSH 10.0p1 Debian 7+deb13u1 (protocol 2.0)' },
  { port: 80, service: 'http', produit: 'nginx 1.26.3' },
  { port: 443, service: 'http', ssl: true, produit: 'nginx 1.26.3' },
];

/** Ce que nmap voit du Fournil, vu d'internet (un seul hôte : le périmètre est déjà acquis). */
export const scanVeille = (): EtatScan => ({
  hotes: [{ adresse: ADRESSE, noms: ['petrin.internal', 'fournil.example', 'petrin'], local: true, services: SERVICES, latence: 0.012 }],
  perimetre: [ADRESSE],
});

/** L'état initial de nginx (avant chargerNginx) : les noms qu'il sert, pour que curl les résolve. */
export const nginxVeille = () => ({ charge: null, noms: ['fournil.example', 'www.fournil.example', 'petrin', 'petrin.internal', ADRESSE] });

/** Les sockets en écoute : nginx et sshd seulement (rsync n'est pas un service, juste un outil en ligne de commande). */
export const ecouteVeille = (): Ecoute[] => [
  { proto: 'tcp', adresse: '0.0.0.0', port: 22, processus: 'sshd', pid: 612 },
  { proto: 'tcp', adresse: '0.0.0.0', port: 80, processus: 'nginx', pid: 701 },
  { proto: 'tcp', adresse: '0.0.0.0', port: 443, processus: 'nginx', pid: 701 },
];

/** Le monde commun : /etc (comptes, sudoers, ssh, nginx), les maisons, et ce que le chapitre ajoute. */
export function mondeVeille(
  t: Traduire,
  o: { maison: Record<string, Noeud>; etc?: Record<string, Noeud>; plus?: Record<string, Noeud>; accesLog?: string },
): Dossier {
  const petrin = machineDeHistoire('veille')!;
  return d(
    {
      etc: d(
        {
          ...fichiersComptes(),
          hostname: fichier('petrin'),
          sudoers: fichier(SUDOERS, 'root', 'r--r-----'),
          'sudoers.d': d({ README: fichier('# See sudoers(5): files here are read unless their name has a dot or ends in ~.', 'root', 'r--r-----') }, undefined, { proprio: 'root', mode: 'rwxr-xr-x' }),
          ssh: d({ sshd_config: f(SSHD_CONFIG, { lignes: true, proprio: 'root' }) }, undefined, racine),
          systemd: d({ system: d({}, undefined, racine) }, undefined, racine),
          nginx: d(
            {
              'nginx.conf': fichier(NGINX_CONF),
              'mime.types': fichier(MIME),
              'conf.d': d({}, undefined, racine),
              'modules-enabled': d({}, undefined, racine),
              'sites-available': d({ fournil: fichier(SITE) }, undefined, racine),
              'sites-enabled': d({ fournil: f('', { proprio: 'root', lien: '/etc/nginx/sites-available/fournil' }) }, undefined, racine),
            },
            undefined,
            racine,
          ),
          ...(o.etc ?? {}),
        },
        undefined,
        racine,
      ),
      home: d(
        {
          vous: d({
            ...o.maison,
            '.ssh': d({ authorized_keys: f(clePublique(petrin, joueur(t)), { lignes: true, mode: 'rw-------' }) }, undefined, { mode: 'rwx------' }),
          }),
          nadia: d({}, undefined, { proprio: 'nadia', mode: 'rwx------' }),
        },
        undefined,
        racine,
      ),
      var: d(
        {
          www: d({ fournil: d({ 'index.html': fichier(INDEX, 'root') }, undefined, racine) }, undefined, racine),
          log: d({ nginx: d({ 'access.log': f(o.accesLog ?? '', { lignes: true, proprio: 'www-data', groupe: 'adm', mode: 'rw-r-----' }) }, undefined, { proprio: 'root', groupe: 'adm' }) }, undefined, racine),
        },
        undefined,
        racine,
      ),
      tmp: d({}, undefined, { proprio: 'root', mode: 'rwxrwxrwt' }),
      ...(o.plus ?? {}),
    },
    undefined,
    racine,
  );
}
