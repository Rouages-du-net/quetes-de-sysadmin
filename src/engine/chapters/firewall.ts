// Histoire « Les Lettres du quartier » — chapitre « Le pare-feu » : ufw.
// Un scan montre la base de données du site (MariaDB, port 3306) joignable
// depuis internet. ss -tlnp montre qui écoute ; ufw ferme tout sauf SSH et
// le site web. Piège : activer ufw avant d'autoriser SSH (la session en
// cours tient, la suivante est bloquée).
// Objectif vérifié sur l'état : pare-feu actif, entrant refusé par défaut,
// SSH (depuis le poste) et le site (80, 443) joignables, 3306 fermé, et une
// nouvelle connexion ssh réussie depuis l'activation.
// Source : https://manpages.ubuntu.com/manpages/noble/man8/ufw.8.html

import { d, f, accountsFiles, accountsByDefault, type Chapter } from '../world';
import type { Game } from '../shell';
import { WORKSTATION } from '../machines';
import { newFirewall, verdict, type Firewall } from '../firewall';
import { newSystemd } from '../systemd';
import type { Listening } from '../commands/ss';

const M = '/home/you';
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

const LISTENING: Listening[] = [
  { proto: 'tcp', address: '0.0.0.0', port: 22, process: 'sshd', pid: 612 },
  { proto: 'tcp', address: '0.0.0.0', port: 80, process: 'nginx', pid: 701 },
  { proto: 'tcp', address: '0.0.0.0', port: 443, process: 'nginx', pid: 701 },
  { proto: 'tcp', address: '0.0.0.0', port: 3306, process: 'mariadbd', pid: 744 },
  { proto: 'tcp', address: '127.0.0.1', port: 9000, process: 'php-fpm8.2', pid: 733 },
];

const pf = (j: Game) => j.state.ufw as Firewall;
const pass = (j: Game, port: number, source = INTERNET) => verdict(pf(j), port, source) === 'accepte';
const openSsh = (j: Game) => pass(j, 22, WORKSTATION.address);
const openSite = (j: Game) => pass(j, 80) && pass(j, 443);
const filter = (j: Game) => pf(j).enabled && pf(j).incoming !== 'allow' && openSsh(j) && openSite(j) && !pass(j, 3306);

export const firewall: Chapter = {
  id: 'firewall',
  number: 2,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'id', 'whoami', 'nano', 'sudo', 'systemctl', 'journalctl', 'ss', 'ufw'],
  home: M,
  welcome: 'email_kofi.txt',
  names: true,
  final: 'end',
  password: 'ants-2026',
  accounts: () => {
    const c = accountsByDefault();
    c.groups.adm = { gid: 4, members: ['you'] };
    return c;
  },
  state: () => ({
    ufw: newFirewall(),
    listening: LISTENING,
    systemd: newSystemd('letters', Date.UTC(2026, 9, 19, 22, 4, 0), Date.UTC(2026, 9, 21, 18, 30, 0), {
      ssh: { description: 'OpenBSD Secure Shell server', active: true, executable: 'sshd' },
      nginx: { description: 'A high performance web server and a reverse proxy server', active: true, executable: 'nginx' },
      mariadb: { description: 'MariaDB 10.11.6 database server', active: true, executable: 'mariadbd' },
      ufw: { description: 'Uncomplicated firewall', active: true, executable: 'ufw' },
    }),
  }),
  createWorld: (t) => {
    const root = { owner: 'root' };
    return d(
      {
        etc: d(
          {
            ...accountsFiles(),
            ssh: d({ 'sshd_config.d': d({ '00-hardening.conf': f('PermitRootLogin no\nPasswordAuthentication no', { lines: true, owner: 'root' }) }, undefined, root) }, undefined, root),
          },
          undefined,
          root,
        ),
        home: d({ you: d({ 'email_kofi.txt': f(t('firewall-email-kofi')), 'scan_yasmine.txt': f(SCAN, { lines: true }) }) }, undefined, root),
      },
      undefined,
      root,
    );
  },
  events: [
    {
      id: 'listening',
      condition: (j) => j.last.commands.some((c) => c[0] === 'ss') && /:(3306|mysql)\b/.test(j.last.output),
      message: (j) => j.t('firewall-event-listening'),
    },
    {
      id: 'locked-out',
      condition: (j) => pf(j).enabled && !openSsh(j),
      message: (j) => j.t('firewall-event-locked-out'),
    },
    {
      id: 'site-cut',
      condition: (j) => pf(j).enabled && !openSite(j),
      message: (j) => j.t('firewall-event-site-cut'),
    },
    {
      id: 'base-open',
      condition: (j) => pf(j).enabled && pass(j, 3306),
      message: (j) => j.t('firewall-event-base-open'),
    },
    {
      id: 'filter',
      condition: filter,
      message: (j) => j.t('firewall-event-filter'),
    },
    {
      id: 'end',
      condition: (j) => j.flags.has('filter') && filter(j) && (j.state.connections ?? 1) > (pf(j).activationAlConnections ?? Infinity),
      message: (j) => j.t('firewall-event-end'),
    },
  ],
};
