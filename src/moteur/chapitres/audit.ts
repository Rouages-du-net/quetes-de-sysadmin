// Histoire « L'Audit » : ce que ses chapitres ont en commun. Le serveur du
// Fournil (machine fournil), la boulangerie de Nadia qui prend ses commandes
// en ligne : un nginx, une appli de commandes (un compte de service), une base
// PostgreSQL et un Redis. Salomé, auditrice indépendante, a passé le serveur au
// crible et laisse un rapport : chaque chapitre en traite une partie. Les
// exemples restent défensifs : on lit le rapport, on vérifie, on répare.

import { d, f, fichiersComptes, joueur, type Comptes, type Dossier, type Noeud } from '../monde';
import { genererCle } from '../acces';
import { clePublique, machineDeHistoire } from '../machines';
import { journaliser, systemd, type DefinitionService } from '../systemd';
import { lireConfig } from '../sshd';
import type { Jeu } from '../shell';
import type { Traduire } from '../../textes';
import type { EtatScan, HoteScan, ServiceScan } from '../scan';
import type { Ecoute } from '../commandes/ss';
import { INSTALLES_DE_BASE, PAQUETS, type EtatApt } from '../commandes/apt';
import { SUDOERS } from './cooperative';

export const M = '/home/vous';
export const MOT_DE_PASSE = 'farine-2028';
// Mardi 14 mars 2028, 9 h 30.
export const MAINTENANT = Date.UTC(2028, 2, 14, 9, 30, 0);
// Une adresse quelconque d'internet (RFC 5737).
export const INTERNET = '198.51.100.23';

// Les clés publiques (fausses, de la bonne forme).
export const CLES = {
  nadia: genererCle('audit-nadia', 'nadia@boutique').publique,
  lucas: genererCle('audit-lucas', 'lucas@portable').publique,
  // Une clé qui se fait passer pour une clé de Nadia : seule son empreinte la trahit.
  inconnue: genererCle('audit-inconnue', 'nadia@portable').publique,
};

// Les comptes : Nadia (la gérante), Lucas (le stagiaire, parti fin février) et
// commandes, le compte de service de l'appli.
export const comptesFournil = (avecLucas = true): Comptes => {
  const c: Comptes = {
    utilisateurs: {
      root: { uid: 0, groupe: 'root', maison: '/root' },
      commandes: { uid: 997, groupe: 'commandes', maison: '/var/lib/commandes', shell: '/usr/sbin/nologin' },
      vous: { uid: 1000, groupe: 'vous' },
      nadia: { uid: 1001, groupe: 'nadia' },
      lucas: { uid: 1002, groupe: 'lucas' },
    },
    groupes: {
      root: { gid: 0, membres: [] },
      adm: { gid: 4, membres: ['vous'] },
      sudo: { gid: 27, membres: ['vous', 'lucas'] },
      commandes: { gid: 997, membres: ['nadia'] },
      vous: { gid: 1000, membres: [] },
      nadia: { gid: 1001, membres: [] },
      lucas: { gid: 1002, membres: [] },
    },
  };
  if (!avecLucas) {
    delete c.utilisateurs.lucas;
    delete c.groupes.lucas;
    for (const g of Object.values(c.groupes)) g.membres = g.membres.filter((m) => m !== 'lucas');
  }
  return c;
};

const racine = { proprio: 'root' };
export const fichier = (contenu: string, proprio = 'root', mode?: string) => f(contenu, { lignes: true, proprio, ...(mode ? { mode } : {}) });

// sshd_config de Debian, tel que l'hébergeur l'a laissé : root peut entrer.
export const SSHD_CONFIG = `
# This is the sshd server system-wide configuration file.  See
# sshd_config(5) for more information.

Include /etc/ssh/sshd_config.d/*.conf

#Port 22
PermitRootLogin yes
PasswordAuthentication no
KbdInteractiveAuthentication no

UsePAM yes

X11Forwarding yes
PrintMotd no

# Allow client to pass locale environment variables
AcceptEnv LANG LC_*

# override default of no subsystems
Subsystem	sftp	/usr/lib/openssh/sftp-server
`.trim();

type EtatSshd = { charge: Record<string, string>; connexionsAuChargement: number; recharges: number };
export const sshd = (j: Jeu) => j.etat.sshd as EtatSshd;

/** Le service ssh : comme celui de Debian, il vérifie sshd_config avant de recharger. */
export const serviceSsh = (): DefinitionService => ({
  description: 'OpenBSD Secure Shell server',
  active: true,
  executable: 'sshd',
  processus: [{ pid: 612, utilisateur: 'root', cpu: 0, mem: 0.2, commande: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' }],
  verifier: (j) => {
    const e = lireConfig(j).erreurs;
    return e.length ? e : null;
  },
  verifierAuRechargement: true,
  charger: (j) => {
    const c = sshd(j);
    if (!c) return;
    c.charge = lireConfig(j).valeurs;
    c.connexionsAuChargement = j.etat.connexions ?? 1;
    c.recharges++;
  },
});

/** Au début du chapitre, sshd tourne avec la configuration du disque. */
export const chargerSshd = (j: Jeu) => {
  sshd(j).charge = lireConfig(j).valeurs;
};

/** Une ligne au journal de ssh, à l'heure donnée (heure locale lue comme UTC). */
export const journalSsh = (j: Jeu, heure: number, pid: number, message: string) => {
  const sd = systemd(j)!;
  const avant = sd.horloge;
  sd.horloge = heure;
  journaliser(sd, 'ssh.service', 'sshd', pid, message, 6, false);
  sd.horloge = avant;
};

/** Le monde commun : /etc (comptes, sudoers, ssh), les maisons, /srv, et ce que le chapitre ajoute. */
export function mondeFournil(
  t: Traduire,
  o: {
    maison: Record<string, Noeud>;
    maisons?: Record<string, Noeud>;
    etc?: Record<string, Noeud>;
    sudoersD?: Record<string, Noeud>;
    ssh?: Record<string, Noeud>;
    plus?: Record<string, Noeud>;
    // Après « Le rapport » : le compte de Lucas n'existe plus.
    sansLucas?: boolean;
  },
): Dossier {
  const fournil = machineDeHistoire('audit')!;
  return d(
    {
      etc: d(
        {
          ...fichiersComptes(),
          hostname: fichier('fournil'),
          sudoers: fichier(SUDOERS, 'root', 'r--r-----'),
          'sudoers.d': d(
            { README: fichier('# See sudoers(5): files here are read unless their name has a dot or ends in ~.', 'root', 'r--r-----'), ...(o.sudoersD ?? {}) },
            undefined,
            { proprio: 'root', mode: 'rwxr-xr-x' },
          ),
          ssh: d({ sshd_config: f(SSHD_CONFIG, { lignes: true, proprio: 'root' }), ...(o.ssh ?? {}) }, undefined, racine),
          ...(o.etc ?? {}),
        },
        undefined,
        racine,
      ),
      home: d(
        {
          vous: d({
            ...o.maison,
            '.ssh': d({ authorized_keys: f(clePublique(fournil, joueur(t)), { lignes: true, mode: 'rw-------' }) }, undefined, { mode: 'rwx------' }),
          }),
          nadia: d({}, undefined, { proprio: 'nadia', mode: 'rwx------' }),
          ...(o.sansLucas ? {} : { lucas: d({}, undefined, { proprio: 'lucas', mode: 'rwx------' }) }),
          ...(o.maisons ?? {}),
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


// ——— Le réseau vu par nmap, et les paquets ———

export const PERIMETRE = ['192.0.2.22'];
export const VOISIN = { nom: 'voisin.internal', adresse: '192.0.2.24' };
// Le nom d'un paquet installé, tel que le service le dit à nmap : « Debian 7 » puis « Debian 7+deb13u1 ».
const revision = (j: Jeu) => ((j.etat.apt as EtatApt | undefined)?.installes['openssh-server'] ?? '1:10.0p1-7').split('-').slice(1).join('-');

const SERVICES: ServiceScan[] = [
  { port: 22, service: 'ssh', produit: (j) => `OpenSSH 10.0p1 Debian ${revision(j)} (protocol 2.0)` },
  { port: 80, service: 'http', produit: 'nginx 1.26.3' },
  { port: 443, service: 'http', ssl: true, produit: 'nginx 1.26.3' },
  { port: 3000, service: 'http', produit: 'Node.js Express framework' },
  { port: 5432, service: 'postgresql', produit: 'PostgreSQL DB 17.0 - 17.2' },
  { port: 6379, service: 'redis', produit: 'Redis key-value store 8.0.2' },
];

/** Ce que nmap peut sonder : le Fournil (son état suit la machine) et le serveur du voisin, hors périmètre. */
export const scanFournil = (): EtatScan => {
  const fournil: HoteScan = { adresse: '192.0.2.22', noms: ['fournil.internal', 'fournil.example', 'fournil'], local: true, services: SERVICES, latence: 0.011 };
  const voisin: HoteScan = {
    adresse: VOISIN.adresse,
    noms: [VOISIN.nom],
    latence: 0.014,
    services: [
      { port: 22, service: 'ssh', produit: 'OpenSSH 9.2p1 Debian 2+deb12u3 (protocol 2.0)' },
      { port: 80, service: 'http', produit: 'Apache httpd 2.4.62 ((Debian))' },
      { port: 3306, service: 'mysql', produit: 'MariaDB 10.11.6' },
    ],
  };
  return { hotes: [fournil, voisin], perimetre: [...PERIMETRE] };
};

/** Les sockets en écoute au départ : tout est ouvert, sauf l'appli de commandes (en local). */
export const ecouteFournil = (redisLocal = false): Ecoute[] => [
  { proto: 'tcp', adresse: '0.0.0.0', port: 22, processus: 'sshd', pid: 612 },
  { proto: 'tcp', adresse: '0.0.0.0', port: 80, processus: 'nginx', pid: 701 },
  { proto: 'tcp', adresse: '0.0.0.0', port: 443, processus: 'nginx', pid: 701 },
  { proto: 'tcp', adresse: '0.0.0.0', port: 5432, processus: 'postgres', pid: 744 },
  { proto: 'tcp', adresse: redisLocal ? '127.0.0.1' : '0.0.0.0', port: 6379, processus: 'redis-server', pid: 760 },
  { proto: 'tcp', adresse: '127.0.0.1', port: 3000, processus: 'node', pid: 731 },
];

/** L'état d'apt : la liste est à jour ; `mises` : les mises à jour de sécurité en attente. */
export const aptFournil = (enAttente: boolean): EtatApt => ({
  listes: true,
  installes: { ...Object.fromEntries(INSTALLES_DE_BASE.map((p) => [p, PAQUETS[p].version])), nginx: '1.26.3-3+deb13u1', openssl: '3.5.1-1' },
  mises: enAttente ? { 'openssh-server': '1:10.0p1-7+deb13u1', openssl: '3.5.4-1~deb13u1' } : {},
});

/** Un document Markdown rédigé par le joueur, section par section (titres « ## », lus dans la langue du jeu : <prefixe>-<nom>). */
export function sectionsMd(j: Jeu, texte: string, prefixe: string, noms: string[]): Record<string, string> {
  const titres = Object.fromEntries(noms.map((n) => [j.t(`${prefixe}-${n}`).toLowerCase(), n]));
  const r: Record<string, string> = {};
  let courante = '';
  for (const ligne of texte.split('\n')) {
    const titre = /^##\s+(.*)$/.exec(ligne);
    if (titre) {
      courante = titres[titre[1].trim().toLowerCase()] ?? '';
      continue;
    }
    if (courante) r[courante] = `${r[courante] ?? ''}${ligne}\n`;
  }
  return r;
}
