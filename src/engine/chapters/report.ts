// Histoire « L'Audit » — chapitre « Le rapport » : Salomé, auditrice, a relevé
// quatre constats d'hygiène sur le serveur du Fournil. À corriger sans rien
// casser :
//   - SSH : root peut entrer (PermitRootLogin yes dans sshd_config) ; la
//     configuration n'est appliquée qu'au rechargement (sshd -t, reload) ;
//   - un compte qui ne devrait plus exister : Lucas, le stagiaire parti fin
//     février, a toujours son compte et sudo (userdel, ou verrouiller +
//     expirer + le retirer de sudo) ;
//   - sudo sans mot de passe : /etc/sudoers.d/90-cloud-init-users donne à
//     « vous » NOPASSWD: ALL (sudo -l le montre) ;
//   - un secret lisible par tous : /srv/commandes/.env (mot de passe de la
//     base) en rw-r--r-- ; chmod 600 sans retirer l'accès à l'appli.
// Objectif vérifié sur l'état : root refusé par sshd (rechargé) sans
// s'enfermer dehors, plus de compte actif pour Lucas, plus de règle
// NOPASSWD pour « vous » (sudo marche encore), le fichier fermé aux autres
// mais lisible par l'appli.
// Sources : https://man.openbsd.org/sshd_config, https://www.sudo.ws/docs/man/sudoers.man/,
// https://man7.org/linux/man-pages/man8/userdel.8.html, https://man7.org/linux/man-pages/man1/chmod.1.html

import { d, f, player, type Chapter } from '../world';
import type { Game, Shell } from '../shell';
import { newSystemd } from '../systemd';
import { allowed } from '../sshd';
import { read, permitted, rulesFor } from '../sudoers';
import { loadSshd, bakeryAccounts, file, M, NOW, PASSWORD, bakeryWorld, serviceSsh, sshd } from './audit';

const ENV = '/srv/commandes/.env';
const sh = (j: Game) => j as Shell;

// Le cloud-init de l'hébergeur : le premier compte a sudo sans mot de passe.
const cloudInitSudo = (account: string) => `# Created by cloud-init v. 24.4 on Tue, 06 Dec 2027 15:51:43 +0000\n\n${account} ALL=(ALL) NOPASSWD:ALL`;

const CONTENT_ENV = `PORT=3000
DATABASE_URL=postgres://commandes:brioche-beurre-91@localhost:5432/commandes
REDIS_URL=redis://localhost:6379`;

const closedRoot = (j: Game) => sshd(j).load.permitrootlogin === 'no';
const between = (j: Game) => allowed(sshd(j).load, j.player);

const lucas = (j: Game) => j.accounts.users.lucas;
const lockedLucas = (j: Game) => ((j.state.comptesVerrouilles ?? []) as string[]).includes('lucas');
const lucasSudo = (j: Game) => !!j.accounts.groups.sudo?.members.includes('lucas');
const okAccount = (j: Game) => !lucas(j) || (lockedLucas(j) && !!lucas(j).expires && !lucasSudo(j));
// Verrouillé ou expiré, mais encore dans sudo : le constat n'est qu'à moitié traité.
const incompleteAccount = (j: Game) => !!lucas(j) && !okAccount(j) && (lockedLucas(j) || !!lucas(j).expires || !lucasSudo(j));

const validPolicy = (j: Game) => !read(sh(j)).error;
const withoutPassword = (j: Game) => rulesFor(sh(j), j.player).some((r) => r.includes('NOPASSWD'));
const sudoOk = (j: Game) => validPolicy(j) && !withoutPassword(j) && permitted(sh(j), j.player, '/usr/bin/bash');

const env = (j: Game) => j.find(ENV);
const closedToOther = (j: Game) => {
  const n = env(j);
  return n?.type === 'fichier' && (n.mode ?? 'rw-r--r--').slice(6) === '---';
};
// L'appli (compte commandes) doit pouvoir lire son fichier : propriétaire, ou groupe.
const readableByApp = (j: Game) => {
  const n = env(j);
  if (n?.type !== 'fichier') return false;
  const mode = n.mode ?? 'rw-r--r--';
  return ((n.owner ?? 'vous') === 'commandes' && mode[0] === 'r') || ((n.group ?? n.owner) === 'commandes' && mode[3] === 'r');
};
const secretOk = (j: Game) => closedToOther(j) && readableByApp(j);

export const report: Chapter = {
  id: 'report',
  number: 2,
  commands: [
    'ls',
    'cd',
    'pwd',
    'cat',
    'less',
    'head',
    'tail',
    'grep',
    'find',
    'rm',
    'nano',
    'sudo',
    'visudo',
    'id',
    'groups',
    'whoami',
    'chmod',
    'chown',
    'chage',
    'usermod',
    'userdel',
    'gpasswd',
    'systemctl',
    'journalctl',
    'sshd',
    'last',
  ],
  home: M,
  welcome: 'courriel_nadia.txt',
  names: true,
  final: 'fin',
  // Dans l'ordre du rapport de Salomé.
  steps: ['ssh', 'compte', 'sudo', 'secret', 'fin'],
  password: PASSWORD,
  accounts: () => bakeryAccounts(true),
  state: () => ({
    sshd: { load: {}, connectionsToLoad: 1, reloads: 0 },
    systemd: newSystemd('fournil', NOW - 5 * 86_400_000, NOW, {
      ssh: serviceSsh(),
      commandes: {
        description: 'Fournil orders (commandes)',
        active: true,
        executable: 'node',
        process: [{ pid: 731, user: 'commandes', cpu: 0.8, mem: 3.1, command: '/usr/bin/node /srv/commandes/app/server.js' }],
      },
    }),
  }),
  initialise: (j) => loadSshd(j),
  createWorld: (t) =>
    bakeryWorld(t, {
      home: { 'courriel_nadia.txt': f(t('report-courriel-nadia')), 'rapport-audit.txt': f(t('report-rapport-audit'), { lines: true }) },
      sudoersD: { '90-cloud-init-users': file(cloudInitSudo(player(t)), 'root', 'r--r-----') },
      more: {
        srv: d(
          {
            commandes: d(
              {
                '.env': f(CONTENT_ENV, { lines: true, owner: 'commandes', group: 'commandes', mode: 'rw-r--r--' }),
                app: d({ 'server.js': file('// orders application (excerpt)', 'commandes') }, undefined, { owner: 'commandes' }),
              },
              undefined,
              { owner: 'commandes' },
            ),
          },
          undefined,
          { owner: 'root' },
        ),
      },
    }),
  events: [
    { id: 'sudoers-casse', condition: (j) => !validPolicy(j), message: (j) => j.t('report-evenement-sudoers-casse') },
    { id: 'enferme', condition: (j) => !between(j), message: (j) => j.t('report-evenement-enferme') },
    {
      id: 'sans-effet',
      condition: (j) => sshd(j).reloads === 0 && /^\s*PermitRootLogin\s+no\b/im.test(j.read('/etc/ssh/sshd_config') ?? ''),
      message: (j) => j.t('report-evenement-sans-effet'),
    },
    { id: 'compte-incomplet', condition: incompleteAccount, message: (j) => j.t('report-evenement-compte-incomplet') },
    { id: 'appli-aveugle', condition: (j) => closedToOther(j) && !readableByApp(j), message: (j) => j.t('report-evenement-appli-aveugle') },
    { id: 'ssh', condition: (j) => closedRoot(j) && between(j), message: (j) => j.t('report-evenement-ssh') },
    { id: 'compte', condition: okAccount, message: (j) => j.t('report-evenement-compte') },
    { id: 'sudo', condition: sudoOk, message: (j) => j.t('report-evenement-sudo') },
    { id: 'secret', condition: secretOk, message: (j) => j.t('report-evenement-secret') },
    {
      id: 'fin',
      condition: (j) => closedRoot(j) && between(j) && okAccount(j) && sudoOk(j) && secretOk(j),
      message: (j) => j.t('report-evenement-fin'),
    },
  ],
};
