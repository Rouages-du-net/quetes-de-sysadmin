// Histoire « La Coopérative » — chapitre « Le départ » : Marc, le bénévole
// qui tenait le serveur, part s'installer loin. Il faut lui retirer tous ses
// accès, proprement, sans rien casser :
//   - son compte : usermod -L ne verrouille que le mot de passe (sa clé SSH
//     passe toujours, comme le dit man usermod) ; il faut le faire expirer
//     (usermod -e 1, chage -E 0), lui retirer son shell, ou le supprimer ;
//   - sa clé est AUSSI dans le compte partagé deploy (le piège classique) :
//     retirer cette ligne-là, sans toucher aux autres ;
//   - sudo : le retirer du groupe sudo ;
//   - sa session est encore ouverte (who, ps -u marc) : la fermer ;
//   - sa crontab lance la sauvegarde de la caisse depuis son dossier : la
//     confier à un compte qui reste (root, ou deploy) avant de supprimer quoi
//     que ce soit (userdel -r effacerait le script ; cron ignore la crontab
//     d'un compte supprimé).
// Objectif vérifié sur l'état : marc ne peut plus entrer (ni mot de passe, ni
// clé, ni dans deploy), n'a plus sudo ni aucun processus, et la sauvegarde
// tourne toujours (le même script, hors de /home/marc, dans la crontab de
// root ou de deploy, ou dans /etc/cron.d).
// Sources : https://man7.org/linux/man-pages/man8/usermod.8.html,
// https://man7.org/linux/man-pages/man8/userdel.8.html,
// https://man7.org/linux/man-pages/man1/chage.1.html

import { path, d, f, player, name, type Chapter } from '../world';
import type { Translate } from '../../texts';
import type { Game, Shell } from '../shell';
import { parse } from '../cron';
import { TODAY, KEYS, cooperativeAccounts, M, cooperativeWorld, PASSWORD } from './coop';

// Le script de Marc, avec le dossier des sauvegardes dans la langue (/srv/backups…).
const script = (t: Translate) => {
  const backups = path(t, '/srv/backups');
  return `#!/bin/sh
# Nightly backup of the till and homes (Marc, 2024)
set -e
JOUR=$(date +%F)
mkdir -p ${backups}/$JOUR
tar -czf ${backups}/$JOUR/till.tar.gz /srv/till
tar -czf ${backups}/$JOUR/home.tar.gz /home`;
};
const SCRIPT = 'till-backup.sh';
const crontabMarc = (t: Translate) => `# m h  dom mon dow   command
30 2 * * * /home/marc/bin/${name(t, SCRIPT)}`;
const DEPLOY = '/home/deploy/.ssh/authorized_keys';
const file = (content: string, owner: string, mode?: string) => f(content, { lines: true, owner, ...(mode ? { mode } : {}) });
const sh = (j: Game) => j as Shell;
const key = (line: string) => line.trim().split(/\s+/).slice(0, 2).join(' ');
const MARC = key(KEYS.marc);

// Les clés autorisées d'un compte.
const allowed = (j: Game, account: string, home: string) =>
  (j.read(`${home}/.ssh/authorized_keys`) ?? '')
    .split('\n')
    .filter((l) => l.trim().startsWith('ssh-'))
    .map(key);

const openAccount = (j: Game, name: string) => {
  const u = j.accounts.users[name];
  if (!u) return false;
  if (u.expires && u.expires <= TODAY) return false;
  return !/(nologin|false)$/.test(u.shell ?? '/bin/bash');
};

// Marc peut-il encore entrer ? Par son compte (mot de passe, ou sa clé : -L n'y fait rien), ou par deploy.
const byItsAccount = (j: Game) => {
  if (!openAccount(j, 'marc')) return false;
  const locked = ((j.state.comptesVerrouilles ?? []) as string[]).includes('marc');
  return !locked || allowed(j, 'marc', '/home/marc').includes(MARC);
};
const byDeploy = (j: Game) => openAccount(j, 'deploy') && allowed(j, 'deploy', '/home/deploy').includes(MARC);
const deployIntact = (j: Game) => [KEYS.ci, KEYS.lina].map(key).every((c) => allowed(j, 'deploy', '/home/deploy').includes(c));
const sudoForMarc = (j: Game) => !!j.accounts.users.marc && sh(j).groupsFor('marc').includes('sudo');
const marcProcess = (j: Game) => ((j.state.processus ?? []) as { user: string }[]).some((p) => p.user === 'marc');

// Les tâches cron (commande et compte) : crontabs des comptes qui existent, et /etc/cron.d (avec la colonne du compte).
function tasks(j: Game): { account: string; command: string }[] {
  const res: { account: string; command: string }[] = [];
  for (const [account, text] of Object.entries((j.state.crontabs ?? {}) as Record<string, string>))
    if (j.accounts.users[account]) for (const t of parse(text, account).tasks) res.push({ account, command: t.command });
  const cronD = j.find('/etc/cron.d');
  if (cronD?.type === 'dossier')
    for (const name of Object.keys(cronD.children))
      for (const l of (j.read(`/etc/cron.d/${name}`) ?? '').split('\n')) {
        const words = l.trim().split(/\s+/);
        if (words.length >= 7 && !l.trim().startsWith('#') && !/=/.test(words[0])) res.push({ account: words[5], command: words.slice(6).join(' ') });
      }
  return res;
}

// La sauvegarde tourne-t-elle encore, confiée à un compte qui n'est pas celui d'une personne ?
const entrustedBackup = (j: Game, accounts = ['root', 'deploy']) =>
  tasks(j).some(({ account, command }) => {
    const path = command.split(/\s+/).find((m) => m.startsWith('/'));
    if (!path || path.startsWith('/home/marc/') || !accounts.includes(account) || !j.accounts.users[account]) return false;
    return (j.read(path) ?? '').trim() === script(j.t).trim();
  });

const closed = (j: Game) => !byItsAccount(j) && !byDeploy(j) && !sudoForMarc(j) && !marcProcess(j);

export const departure: Chapter = {
  id: 'departure',
  number: 1,
  commands: [
    'ls',
    'cd',
    'pwd',
    'cat',
    'less',
    'head',
    'tail',
    'grep',
    'cp',
    'mv',
    'mkdir',
    'rm',
    'chmod',
    'chown',
    'nano',
    'sudo',
    'id',
    'groups',
    'whoami',
    'who',
    'ps',
    'kill',
    'pkill',
    'usermod',
    'chage',
    'gpasswd',
    'userdel',
    'crontab',
  ],
  home: M,
  welcome: 'email_awa.txt',
  names: true,
  final: 'end',
  password: PASSWORD,
  accounts: () => cooperativeAccounts(),
  state: (t) => ({
    crontabs: { marc: crontabMarc(t) },
    processus: [
      { pid: 612, user: 'root', cpu: 0, mem: 0.2, command: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' },
      { pid: 731, user: 'till', cpu: 1.2, mem: 3.4, command: '/usr/bin/node /srv/till/app/server.js' },
      { pid: 2741, user: 'marc', cpu: 0, mem: 0.1, command: 'sshd: marc@pts/1' },
      { pid: 2745, user: 'marc', cpu: 0, mem: 0.1, command: '-bash', ppid: 2741 },
      { pid: 2790, user: 'marc', cpu: 0.1, mem: 0.1, command: 'tail -f /var/log/till/app.log', ppid: 2745 },
      { pid: 3102, user: player(t), cpu: 0, mem: 0.1, command: '-bash' },
    ],
    sessions: [
      { user: 'marc', tty: 'pts/1', since: '2027-10-19 08:12', forEachOf: '198.51.100.40', pid: 2741 },
      { user: player(t), tty: 'pts/0', since: '2027-10-19 09:28', forEachOf: '192.0.2.2' },
    ],
  }),
  createWorld: (t) =>
    cooperativeWorld({
      home: { 'email_awa.txt': f(t('departure-email-awa')) },
      homes: {
        marc: d(
          {
            '.ssh': d({ authorized_keys: file(KEYS.marc, 'marc', 'rw-------') }, undefined, { owner: 'marc', mode: 'rwx------' }),
            bin: d({ [SCRIPT]: file(script(t), 'marc', 'rwxr-xr-x') }, undefined, { owner: 'marc' }),
            'notes.txt': file(t('departure-notes-marc'), 'marc'),
          },
          undefined,
          { owner: 'marc', mode: 'rwxr-xr-x' },
        ),
      },
      more: {
        srv: d(
          {
            till: d({}, undefined, { owner: 'till', group: 'till' }),
            // La sauvegarde de la nuit dernière (elle contient /home : le script de Marc y est).
            backups: d(
              {
                '2027-10-18': d({ home: d({ marc: d({ bin: d({ [SCRIPT]: file(script(t), 'root', 'rwxr-xr-x') }) }) }) }, undefined, {
                  owner: 'root',
                }),
              },
              undefined,
              { owner: 'root', mode: 'rwx------' },
            ),
          },
          undefined,
          { owner: 'root' },
        ),
      },
    }),
  events: [
    {
      id: 'lock-only',
      condition: (j) => ((j.state.comptesVerrouilles ?? []) as string[]).includes('marc') && byItsAccount(j),
      message: (j) => j.t('departure-event-lock-only'),
    },
    { id: 'deploy-empty', condition: (j) => !deployIntact(j), message: (j) => j.t('departure-event-deploy-empty', { fichier: DEPLOY }) },
    {
      id: 'script-lost',
      condition: (j) => !j.exists('/home/marc/bin') && !entrustedBackup(j),
      message: (j) => j.t('departure-event-script-lost'),
    },
    {
      id: 'task-personal',
      condition: (j) => entrustedBackup(j, [j.player]) && !entrustedBackup(j),
      message: (j) => j.t('departure-event-task-personal'),
    },
    { id: 'backup', condition: (j) => entrustedBackup(j), message: (j) => j.t('departure-event-backup') },
    { id: 'closed', condition: (j) => closed(j) && deployIntact(j), message: (j) => j.t('departure-event-closed') },
    { id: 'end', condition: (j) => closed(j) && deployIntact(j) && entrustedBackup(j), message: (j) => j.t('departure-event-end') },
  ],
};
