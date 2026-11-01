// Histoire « La Maison des associations » — chapitre « Les transferts » :
// rapatrier le rapport d'activité du wiki sur son poste (scp, qui rebondit
// par maison grâce au raccourci du chapitre précédent), puis mettre la
// sauvegarde du dossier partagé à jour sur archives (rsync, depuis maison,
// avec la clé de sauvegarde que Gaspard a créée pour ça).
// Piège réel : la barre oblique finale de la source de rsync (/srv/partage/
// copie le CONTENU ; /srv/partage copie le dossier lui-même, qui se retrouve
// dans /srv/sauvegardes/partage/partage).
// Objectif vérifié sur l'état : le rapport (intact) sur le poste, et chaque
// fichier de /srv/partage présent, identique, au même endroit sur archives,
// sans le dossier copié en trop (rsync --delete le retire).
// Sources : https://man.openbsd.org/scp, https://download.samba.org/pub/rsync/rsync.1

import { path, d, f, name, type Chapter, type Directory, type Node } from '../world';
import type { Game, Shell } from '../shell';
import { generateKey } from '../access';
import { loadSshd, homeAccounts, sshDirectory, homeState, internalHost, M, homeWorld, PASSWORD, homePlan } from './community-centre';

const REPORT = 'report-2027.pdf';
const SHARE = '/srv/share';
const BACKUP = '/srv/backups/share';
// Un PDF (son début) : le contenu exact sert à vérifier que la copie est intacte.
const PDF = '%PDF-1.7\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 12 >>\nendobj';
// La clé de sauvegarde de maison vers archives (une clé par usage, pas celle d'une personne).
const BACKUP_KEY = generateKey('maison-sauvegarde', 'backup@community');

const you = { owner: 'you' };
const file = (content: string) => f(content, { lines: true, owner: 'you' });

// Le dossier partagé de maison : comptes rendus, affiches, planning.
const share = (t: (id: string) => string): Directory =>
  d(
    {
      'minutes': d(
        { 'agm-2026.txt': file(t('transfers-minutes-ag-2026')), 'board-2027-09.txt': file(t('transfers-minutes-it-2027-09')) },
        undefined,
        you,
      ),
      posters: d({ 'street-party.pdf': file('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj') }, undefined, you),
      'room-bookings.txt': file(t('transfers-schedule')),
    },
    undefined,
    you,
  );

// Tous les fichiers d'un dossier, par chemin relatif.
function files(j: Game, root: string): Record<string, string> {
  const res: Record<string, string> = {};
  const walk = (n: Node, path: string) => {
    if (n.type === 'dossier') for (const [name, e] of Object.entries(n.children)) walk(e, path ? `${path}/${name}` : name);
    else res[path] = j.read(`${root}/${path}`) ?? '';
  };
  const n = j.find(root);
  if (n?.type === 'dossier') walk(n, '');
  return res;
}

const archives = (j: Game) => (j as Shell).internal('archives')!;
const workstation = (j: Game) => (j.state.workstation as (() => Shell) | undefined)?.();

// Le rapport, intact, quelque part dans la maison du poste.
const reportOnWorkstation = (j: Game) => {
  const p = workstation(j);
  if (!p) return false;
  const all = files(p, p.resolve('~'));
  return Object.entries(all).some(([c, content]) => c.split('/').at(-1) === name(j.t, REPORT) && content === PDF);
};

const dayABackup = (j: Game) => {
  const copyOf = files(archives(j), path(j.t, BACKUP));
  return Object.entries(files(j, path(j.t, SHARE))).every(([c, content]) => copyOf[c] === content);
};
// La copie en trop : /srv/sauvegardes/partage/partage (dans la langue).
const nested = (j: Game) => path(j.t, `${BACKUP}/share`);

export const transfers: Chapter = {
  id: 'transfers',
  number: 4,
  plan: homePlan(),
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
    'du',
    'diff',
    'id',
    'whoami',
    'hostname',
    'rm',
    'mv',
    'ssh',
    'scp',
    'rsync',
  ],
  home: M,
  welcome: 'email_yasmine.txt',
  names: true,
  final: 'end',
  password: PASSWORD,
  accounts: homeAccounts,
  playerKeys: true,
  watchesWorkstation: true,
  state: () => homeState(),
  initialise: loadSshd,
  hosts: {
    wiki: internalHost('wiki', '10.20.0.11', {
      commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'find', 'du', 'id', 'whoami', 'hostname'],
      more: () => ({
        srv: d({ wiki: d({ exports: d({ [REPORT]: f(PDF, { lines: true, owner: 'www-data', mode: 'rw-r--r--' }) }) }) }, undefined, {
          owner: 'root',
        }),
      }),
    }),
    archives: internalHost('archives', '10.20.0.12', {
      commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'find', 'du', 'diff', 'id', 'whoami', 'hostname', 'rm', 'mv'],
      home: () => ({ '.ssh': sshDirectory({ authorized_keys: f(BACKUP_KEY.isPublic, { lines: true, owner: 'you', mode: 'rw-------' }) }) }),
      // La sauvegarde de l'an dernier : un seul compte rendu.
      more: (t) => ({
        srv: d(
          {
            backups: d(
              { share: d({ 'minutes': d({ 'agm-2026.txt': file(t('transfers-minutes-ag-2026')) }, undefined, you) }, undefined, you) },
              undefined,
              you,
            ),
          },
          undefined,
          { owner: 'root' },
        ),
      }),
    }),
  },
  createWorld: (t) =>
    homeWorld({
      passwords: 'no',
      home: {
        'email_yasmine.txt': f(t('transfers-email-yasmine')),
        '.ssh': sshDirectory({
          config: f('Host archives\n    IdentityFile ~/.ssh/id_sauvegarde', { lines: true, owner: 'you', mode: 'rw-r--r--' }),
          id_sauvegarde: f(BACKUP_KEY.isPrivate, { lines: true, owner: 'you', mode: 'rw-------' }),
          'id_sauvegarde.pub': f(BACKUP_KEY.isPublic, { lines: true, owner: 'you', mode: 'rw-r--r--' }),
        }),
      },
      more: { srv: d({ share: share(t) }, undefined, { owner: 'root' }) },
    }),
  events: [
    { id: 'report', condition: reportOnWorkstation, message: (j) => j.t('transfers-event-report') },
    {
      id: 'nested',
      condition: (j) => archives(j).exists(nested(j)),
      message: (j) => j.t('transfers-event-nested', { dossier: nested(j) }),
    },
    {
      id: 'backup',
      condition: (j) => dayABackup(j) && !archives(j).exists(nested(j)),
      message: (j) => j.t('transfers-event-backup'),
    },
    {
      id: 'end',
      condition: (j) => reportOnWorkstation(j) && dayABackup(j) && !archives(j).exists(nested(j)),
      message: (j) => j.t('transfers-event-end'),
    },
  ],
};
