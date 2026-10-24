// Histoire « L'Audit » — chapitre « L'exposition » : deuxième partie du
// rapport de Salomé. Son balayage de ports, depuis internet, trouve la base
// PostgreSQL (5432) et Redis (6379) joignables par tout le monde ; le
// pare-feu (ufw) est installé mais éteint. Redis n'a pas de mot de passe et
// écoute sur toutes les interfaces (bind * -::*, protected-mode no).
//   - ss -tlnp : qui écoute où ;
//   - ufw : autoriser SSH (depuis le poste), 80 et 443 AVANT d'activer ;
//   - Redis : en plus du pare-feu, le faire écouter seulement sur
//     127.0.0.1 (bind dans /etc/redis/redis.conf, puis restart : un
//     programme ne relit pas sa configuration tout seul). Le pare-feu seul
//     laisserait Redis à une erreur de règle d'être public.
// Pièges réels : activer ufw avant d'autoriser SSH, couper le site, arrêter
// Redis (l'appli de commandes en a besoin), modifier redis.conf sans
// redémarrer.
// Objectif vérifié sur l'état : ufw actif (entrant refusé par défaut), SSH
// du poste, 80 et 443 joignables depuis internet, 5432 et 6379 fermés,
// Redis actif et à l'écoute sur 127.0.0.1 seulement, et une nouvelle
// connexion ssh réussie depuis l'activation.
// Sources : https://manpages.ubuntu.com/manpages/noble/man8/ufw.8.html,
// https://redis.io/docs/latest/operate/oss_and_stack/management/security/,
// https://www.postgresql.org/docs/current/runtime-config-connection.html

import { d, f, type Chapitre } from '../monde';
import type { Jeu } from '../shell';
import { POSTE } from '../machines';
import { nouveauPareFeu, type PareFeu } from '../parefeu';
import { etatPort } from '../ports';
import { nouveauSystemd, systemd } from '../systemd';
import type { Ecoute } from '../commandes/ss';
import { chargerSshd, comptesFournil, fichier, INTERNET, M, MAINTENANT, MOT_DE_PASSE, mondeFournil, serviceSsh } from './audit';

const REDIS_CONF = '/etc/redis/redis.conf';

// Le balayage de Salomé, comme nmap l'affiche.
const BALAYAGE = `Starting Nmap 7.94 ( https://nmap.org ) at 2028-03-13 17:41 CET
Nmap scan report for fournil.example (192.0.2.22)
Host is up (0.011s latency).
Not shown: 994 closed tcp ports (reset)
PORT     STATE SERVICE
22/tcp   open  ssh
80/tcp   open  http
443/tcp  open  https
5432/tcp open  postgresql
6379/tcp open  redis

Nmap done: 1 IP address (1 host up) scanned in 2.07 seconds`;

// redis.conf de Debian (extrait), tel que l'a laissé l'installation « pour que ça marche ».
const REDIS_CONFIG = `# Redis configuration file (excerpt)
bind * -::*
port 6379
protected-mode no
# requirepass foobared
daemonize no
supervised systemd
dir /var/lib/redis`;

const ecoute = (): Ecoute[] => [
  { proto: 'tcp', adresse: '0.0.0.0', port: 22, processus: 'sshd', pid: 612 },
  { proto: 'tcp', adresse: '0.0.0.0', port: 80, processus: 'nginx', pid: 701 },
  { proto: 'tcp', adresse: '0.0.0.0', port: 443, processus: 'nginx', pid: 701 },
  { proto: 'tcp', adresse: '0.0.0.0', port: 5432, processus: 'postgres', pid: 744 },
  { proto: 'tcp', adresse: '0.0.0.0', port: 6379, processus: 'redis-server', pid: 760 },
  { proto: 'tcp', adresse: '127.0.0.1', port: 3000, processus: 'node', pid: 731 },
];

/** Redis écoute-t-il seulement sur la boucle locale d'après ce redis.conf ? (sans « bind » : partout) */
export const redisLocal = (conf: string) => {
  const mots = conf
    .split('\n')
    .map((l) => l.replace(/#.*/, '').trim())
    .filter((l) => /^bind\s/i.test(l))
    .flatMap((l) => l.split(/\s+/).slice(1))
    .map((a) => a.replace(/^-/, ''));
  return mots.length > 0 && mots.every((a) => ['127.0.0.1', '::1', 'localhost'].includes(a));
};

const pf = (j: Jeu) => j.etat.ufw as PareFeu;
const ouvert = (j: Jeu, port: number, source = INTERNET) => etatPort(j, port, false, source) === 'ouvert';
const sshOuvert = (j: Jeu) => ouvert(j, 22, POSTE.adresse);
const siteOuvert = (j: Jeu) => ouvert(j, 80) && ouvert(j, 443);
const baseOuverte = (j: Jeu) => ouvert(j, 5432) || ouvert(j, 6379);
const filtre = (j: Jeu) => pf(j).actif && pf(j).entrant !== 'allow' && sshOuvert(j) && siteOuvert(j) && !baseOuverte(j);

const redis = (j: Jeu) => (j.etat.ecoute as Ecoute[]).find((e) => e.port === 6379);
const redisActif = (j: Jeu) => systemd(j)!.services['redis-server'].etat === 'active';
const redisEcouteLocale = (j: Jeu) => redisActif(j) && redis(j)?.adresse === '127.0.0.1';
const confLocale = (j: Jeu) => redisLocal(j.lire(REDIS_CONF) ?? '');

export const exposition: Chapitre = {
  id: 'exposition',
  numero: 3,
  commandes: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'ps', 'id', 'whoami', 'nano', 'sudo', 'systemctl', 'journalctl', 'ss', 'ufw'],
  maison: M,
  accueil: 'courriel_salome.txt',
  noms: true,
  final: 'fin',
  etapes: ['ecoute', 'pare-feu', 'redis-local', 'fin'],
  motDePasse: MOT_DE_PASSE,
  comptes: () => comptesFournil(false),
  etat: () => ({
    sshd: { charge: {}, connexionsAuChargement: 1, recharges: 0 },
    ufw: nouveauPareFeu(),
    ecoute: ecoute(),
    systemd: nouveauSystemd('fournil', MAINTENANT - 5 * 86_400_000, MAINTENANT, {
      ssh: serviceSsh(),
      nginx: { description: 'A high performance web server and a reverse proxy server', active: true, executable: 'nginx' },
      postgresql: { description: 'PostgreSQL RDBMS', active: true, executable: 'postgres' },
      'redis-server': {
        description: 'Advanced key-value store',
        active: true,
        executable: 'redis-server',
        processus: [{ pid: 760, utilisateur: 'redis', cpu: 0.2, mem: 0.6, commande: '/usr/bin/redis-server *:6379' }],
        // Redis lit redis.conf au démarrage : c'est là qu'il choisit où écouter.
        charger: (j) => {
          const e = redis(j);
          if (e) e.adresse = redisLocal(j.lire(REDIS_CONF) ?? '') ? '127.0.0.1' : '0.0.0.0';
        },
      },
      ufw: { description: 'Uncomplicated firewall', active: true, executable: 'ufw' },
    }),
  }),
  initialiser: (j) => chargerSshd(j),
  creerMonde: (t) =>
    mondeFournil(t, {
      sansLucas: true,
      maison: { 'courriel_salome.txt': f(t('exposition-courriel-salome')), 'balayage-audit.txt': f(BALAYAGE, { lignes: true }) },
      etc: { redis: d({ 'redis.conf': f(REDIS_CONFIG, { lignes: true, proprio: 'redis', groupe: 'redis', mode: 'rw-r-----' }) }, undefined, { proprio: 'root' }) },
      ssh: { 'sshd_config.d': d({ '00-durcissement.conf': fichier('PermitRootLogin no', 'root') }, undefined, { proprio: 'root' }) },
    }),
  evenements: [
    {
      id: 'ecoute',
      condition: (j) => j.derniere.commandes.some((c) => c[0] === 'ss') && /:(6379|redis)\b/.test(j.derniere.sortie),
      message: (j) => j.t('exposition-evenement-ecoute'),
    },
    { id: 'enferme', condition: (j) => pf(j).actif && !sshOuvert(j), message: (j) => j.t('exposition-evenement-enferme') },
    { id: 'site-coupe', condition: (j) => pf(j).actif && !siteOuvert(j), message: (j) => j.t('exposition-evenement-site-coupe') },
    { id: 'base-ouverte', condition: (j) => pf(j).actif && baseOuverte(j), message: (j) => j.t('exposition-evenement-base-ouverte') },
    { id: 'redis-arrete', condition: (j) => !redisActif(j), message: (j) => j.t('exposition-evenement-redis-arrete') },
    {
      id: 'sans-effet',
      condition: (j) => redisActif(j) && confLocale(j) && !redisEcouteLocale(j),
      message: (j) => j.t('exposition-evenement-sans-effet'),
    },
    { id: 'pare-feu', condition: filtre, message: (j) => j.t('exposition-evenement-pare-feu') },
    { id: 'redis-local', condition: redisEcouteLocale, message: (j) => j.t('exposition-evenement-redis-local') },
    {
      id: 'fin',
      condition: (j) => filtre(j) && redisEcouteLocale(j) && (j.etat.connexions ?? 1) > (pf(j).connexionsALActivation ?? Infinity),
      message: (j) => j.t('exposition-evenement-fin'),
    },
  ],
};
