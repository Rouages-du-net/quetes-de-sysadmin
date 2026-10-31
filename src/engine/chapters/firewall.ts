// Histoire « Les Lettres du quartier » — chapitre « Le pare-feu » : ufw.
// Un scan montre la base de données du site (MariaDB, port 3306) joignable
// depuis internet. ss -tlnp montre qui écoute ; ufw ferme tout sauf SSH et
// le site web. Piège : activer ufw avant d'autoriser SSH (la session en
// cours tient, la suivante est bloquée).
// Objectif vérifié sur l'état : pare-feu actif, entrant refusé par défaut,
// SSH (depuis le poste) et le site (80, 443) joignables, 3306 fermé, et une
// nouvelle connexion ssh réussie depuis l'activation.
// Source : https://manpages.ubuntu.com/manpages/noble/man8/ufw.8.html

import { d, f, fichiersComptes, comptesParDefaut, type Chapitre } from '../world';
import type { Jeu } from '../shell';
import { POSTE } from '../machines';
import { nouveauPareFeu, verdict, type PareFeu } from '../firewall';
import { nouveauSystemd } from '../systemd';
import type { Ecoute } from '../commands/ss';

const M = '/home/vous';
// Une adresse quelconque d'internet (un robot de la nuit).
const INTERNET = '198.51.100.23';

// Le rapport de scan de Yasmine, comme nmap l'affiche.
const SCAN = `Starting Nmap 7.94 ( https://nmap.org ) at 2026-10-21 18:02 CEST
Nmap scan report for letters.example (203.0.113.10)
Host is up (0.012s latency).
Not shown: 996 closed tcp ports (reset)
PORT     STATE SERVICE
22/tcp   open  ssh
80/tcp   open  http
443/tcp  open  https
3306/tcp open  mysql

Nmap done: 1 IP address (1 host up) scanned in 1.84 seconds`;

const ECOUTE: Ecoute[] = [
  { proto: 'tcp', adresse: '0.0.0.0', port: 22, processus: 'sshd', pid: 612 },
  { proto: 'tcp', adresse: '0.0.0.0', port: 80, processus: 'nginx', pid: 701 },
  { proto: 'tcp', adresse: '0.0.0.0', port: 443, processus: 'nginx', pid: 701 },
  { proto: 'tcp', adresse: '0.0.0.0', port: 3306, processus: 'mariadbd', pid: 744 },
  { proto: 'tcp', adresse: '127.0.0.1', port: 9000, processus: 'php-fpm8.2', pid: 733 },
];

const pf = (j: Jeu) => j.etat.ufw as PareFeu;
const passe = (j: Jeu, port: number, source = INTERNET) => verdict(pf(j), port, source) === 'accepte';
const sshOuvert = (j: Jeu) => passe(j, 22, POSTE.adresse);
const siteOuvert = (j: Jeu) => passe(j, 80) && passe(j, 443);
const filtre = (j: Jeu) => pf(j).actif && pf(j).entrant !== 'allow' && sshOuvert(j) && siteOuvert(j) && !passe(j, 3306);

export const pareFeu: Chapitre = {
  id: 'pare-feu',
  numero: 2,
  commandes: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'id', 'whoami', 'nano', 'sudo', 'systemctl', 'journalctl', 'ss', 'ufw'],
  maison: M,
  accueil: 'courriel_kofi.txt',
  noms: true,
  final: 'fin',
  motDePasse: 'fourmis-2026',
  comptes: () => {
    const c = comptesParDefaut();
    c.groupes.adm = { gid: 4, membres: ['vous'] };
    return c;
  },
  etat: () => ({
    ufw: nouveauPareFeu(),
    ecoute: ECOUTE,
    systemd: nouveauSystemd('lettres', Date.UTC(2026, 9, 19, 22, 4, 0), Date.UTC(2026, 9, 21, 18, 30, 0), {
      ssh: { description: 'OpenBSD Secure Shell server', active: true, executable: 'sshd' },
      nginx: { description: 'A high performance web server and a reverse proxy server', active: true, executable: 'nginx' },
      mariadb: { description: 'MariaDB 10.11.6 database server', active: true, executable: 'mariadbd' },
      ufw: { description: 'Uncomplicated firewall', active: true, executable: 'ufw' },
    }),
  }),
  creerMonde: (t) => {
    const racine = { proprio: 'root' };
    return d(
      {
        etc: d(
          {
            ...fichiersComptes(),
            ssh: d({ 'sshd_config.d': d({ '00-hardening.conf': f('PermitRootLogin no\nPasswordAuthentication no', { lignes: true, proprio: 'root' }) }, undefined, racine) }, undefined, racine),
          },
          undefined,
          racine,
        ),
        home: d({ vous: d({ 'courriel_kofi.txt': f(t('pare-feu-courriel-kofi')), 'scan_yasmine.txt': f(SCAN, { lignes: true }) }) }, undefined, racine),
      },
      undefined,
      racine,
    );
  },
  evenements: [
    {
      id: 'ecoute',
      condition: (j) => j.derniere.commandes.some((c) => c[0] === 'ss') && /:(3306|mysql)\b/.test(j.derniere.sortie),
      message: (j) => j.t('pare-feu-evenement-ecoute'),
    },
    {
      id: 'enferme',
      condition: (j) => pf(j).actif && !sshOuvert(j),
      message: (j) => j.t('pare-feu-evenement-enferme'),
    },
    {
      id: 'site-coupe',
      condition: (j) => pf(j).actif && !siteOuvert(j),
      message: (j) => j.t('pare-feu-evenement-site-coupe'),
    },
    {
      id: 'base-ouverte',
      condition: (j) => pf(j).actif && passe(j, 3306),
      message: (j) => j.t('pare-feu-evenement-base-ouverte'),
    },
    {
      id: 'filtre',
      condition: filtre,
      message: (j) => j.t('pare-feu-evenement-filtre'),
    },
    {
      id: 'fin',
      condition: (j) => j.drapeaux.has('filtre') && filtre(j) && (j.etat.connexions ?? 1) > (pf(j).connexionsALActivation ?? Infinity),
      message: (j) => j.t('pare-feu-evenement-fin'),
    },
  ],
};
