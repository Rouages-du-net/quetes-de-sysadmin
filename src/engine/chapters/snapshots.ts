// Histoire « La Ludothèque » — chapitre « Les instantanés » : après
// l'attaque, Malo veut pouvoir revenir à n'importe quel jour des deux
// dernières semaines. rsnapshot est installé avec la configuration de
// Debian ; il faut la régler (tabulations !) pour /srv/partage vers le second
// disque (/mnt/instantanes), 7 instantanés quotidiens et 4 hebdomadaires, et
// le lancer avec cron. Le jeu fait alors passer deux semaines : Bérénice
// travaille chaque jour, et le dernier soir écrase l'inventaire par erreur.
// Il faut le reprendre dans l'instantané de la veille.
// Objectif vérifié sur l'état : 7 instantanés du niveau le plus fréquent et
// au moins un du niveau suivant sur /mnt/instantanes, tous avec le partage,
// et l'inventaire du partage revenu à sa version de l'avant-veille.
// Sources : https://rsnapshot.org/rsnapshot/docs/docs.html,
// https://manpages.debian.org/bookworm/rsnapshot/rsnapshot.1.en.html

import { path, d, f, accountsFiles, type Chapter, type Accounts, type Rights, type Node } from '../world';
import type { Game, Shell } from '../shell';
import { newSystemd, systemd } from '../systemd';
import { pass } from '../cron';
import type { Device } from '../commands/disks';
import { CONF, CONF_DEBIAN, readConf } from '../commands/rsnapshot';

const M = '/home/you';
const SHARE = '/srv/share';
const DISK = '/mnt/snapshots';
const INVENTORY = `${SHARE}/inventory.csv`;
const Go = 1_000_000_000;
const DAY = 86_400_000;
const START = Date.UTC(2027, 5, 28, 10, 0, 0);

const accounts = (): Accounts => ({
  users: {
    root: { uid: 0, group: 'root', home: '/root' },
    you: { uid: 1000, group: 'you' },
    accueil: { uid: 1001, group: 'accueil' },
    berenice: { uid: 1002, group: 'berenice' },
  },
  groups: {
    root: { gid: 0, members: [] },
    sudo: { gid: 27, members: ['you', 'berenice'] },
    you: { gid: 1000, members: [] },
    accueil: { gid: 1001, members: [] },
    berenice: { gid: 1002, members: [] },
    ludo: { gid: 1100, members: ['you', 'accueil', 'berenice'] },
  },
});

// L'inventaire au soir du jour n (un jeu de plus chaque jour).
const inventory = (t: Game['t'], n: number) =>
  [t('ransom-inventory'), ...Array.from({ length: n }, (_, k) => t('snapshots-line-inventory', { numero: k + 1 }))].join('\n');

const sd = (j: Game) => systemd(j)!;
const conf = (j: Game) => readConf(j.read(CONF) ?? '');
const root = (j: Game) => conf(j).conf.root;
const snapshotList = (j: Game, level: string) => {
  const n = j.find(root(j));
  return n?.type === 'dossier' ? Object.keys(n.children).filter((k) => k.startsWith(`${level}.`)) : [];
};
const wellSaved = (j: Game) => {
  const { conf: c, errors } = conf(j);
  const share = path(j.t, SHARE);
  if (errors.length || c.levels.length < 2 || !c.root.startsWith(`${path(j.t, DISK)}/`)) return false;
  const [small, grand] = c.levels;
  const all = [...snapshotList(j, small.name), ...snapshotList(j, grand.name)];
  const b = c.backups.find((x) => x.source === `${share}/`);
  return (
    !!b &&
    snapshotList(j, small.name).length >= 7 &&
    snapshotList(j, grand.name).length >= 1 &&
    all.every((name) => j.find(`${c.root}${name}/${b.destination}${path(j.t, INVENTORY)}`)?.type === 'fichier')
  );
};
const crontabsRsnapshot = (j: Game) =>
  Object.values((j.state.crontabs ?? {}) as Record<string, string>)
    .join('\n')
    .includes('rsnapshot');

/** Deux semaines passent : le jour, Bérénice tient l'inventaire ; la nuit, cron. */
function twoWeeks(j: Game): string[] {
  const game = j as Shell;
  const mails: string[] = [];
  for (let n = 1; n <= 14; n++) {
    const evening = START + (n - 1) * DAY + 8 * 3600_000;
    sd(j).clock = evening;
    // Le quatorzième soir, une vieille copie de l'inventaire écrase la bonne.
    game.place(
      'cp',
      path(j.t, INVENTORY),
      f(n === 14 ? j.t('snapshots-inventory-old') : inventory(j.t, n), {
        lines: true,
        owner: 'berenice',
        group: 'ludo',
        mode: 'rw-rw-r--',
      }),
    );
    for (const e of pass(game, evening + 4 * 3600_000, evening + 12 * 3600_000)) if (e.output) mails.push(`${e.command}\n${e.output}`);
  }
  sd(j).clock = START + 14 * DAY + 2 * 3600_000;
  return mails;
}

export const chapterSnapshots: Chapter = {
  id: 'snapshots',
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
    'wc',
    'du',
    'df',
    'diff',
    'cp',
    'mv',
    'rm',
    'mkdir',
    'ln',
    'id',
    'whoami',
    'crontab',
    'lsblk',
    'mount',
    'rsnapshot',
    'rsync',
    'sudo',
    'nano',
  ],
  home: M,
  welcome: 'message_from_berenice.txt',
  names: true,
  final: 'end',
  password: 'ludo-2027',
  accounts,
  state: () => {
    const tree = d({}, undefined, { owner: 'root', mode: 'rwxr-xr-x' });
    const second: Device = {
      disk: '/dev/sdc',
      majmin: [8, 33],
      removable: false,
      size: 500 * Go,
      system: 'ext4',
      label: 'INSTANTANES',
      uuid: 'b2e41c07-5d3a-4f19-8c6e-0a7d93f1e258',
      tree,
    };
    return {
      systemd: newSystemd('games', Date.UTC(2027, 5, 21, 11, 0, 0), START, {
        ssh: {
          description: 'OpenBSD Secure Shell server',
          active: true,
          executable: 'sshd',
          process: [{ pid: 611, user: 'root', cpu: 0, mem: 0.2, command: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' }],
        },
        cron: { description: 'Regular background program processing daemon', active: true, executable: 'cron' },
      }),
      montages: [{ path: '/', capacity: 40 * Go, name: '/dev/vda1', system: 'ext4' }],
      peripheriques: { '/dev/sdc1': second },
      comptesVerrouilles: ['accueil'],
    };
  },
  initialise: (j) => {
    // Le second disque, monté au démarrage.
    const game = j as Shell;
    const before = game.who;
    game.who = 'root';
    game.underCommand(`mount /dev/sdc1 ${path(j.t, DISK)}`, '/');
    game.who = before;
  },
  // Une fois rsnapshot programmé avec une configuration valable, deux semaines passent.
  afterCommand: (j) => {
    if (j.state.semainesPassees || !crontabsRsnapshot(j) || conf(j).errors.length) return;
    j.state.semainesPassees = true;
    const mails = twoWeeks(j);
    j.state.mailsCron = mails;
    return j.t('snapshots-two-weeks', { mails: mails.length });
  },
  createWorld: (t) => {
    const root: Rights = { owner: 'root' };
    const place = (children: Parameters<typeof d>[0], rights: Rights = root) => d(children, undefined, rights);
    const file = (text: string, rights: Rights = root) => f(text, { lines: true, ...rights });
    const ludo = (owner: string, size?: number): Rights & { size?: number } => ({
      owner,
      group: 'ludo',
      mode: 'rw-rw-r--',
      ...(size ? { size } : {}),
    });
    const share: Record<string, Node> = {
      'inventory.csv': file(t('ransom-inventory'), ludo('berenice')),
      'volunteer-rota.txt': file(t('ransom-schedule'), ludo('berenice')),
      'games-day-poster.txt': file(t('ransom-shows'), ludo('berenice')),
      rules: place(
        {
          'goose-game.txt': file(t('ransom-rules-goose'), ludo('berenice')),
          'ludo.txt': file(t('ransom-rules-horses'), ludo('berenice')),
          'draughts.txt': file(t('ransom-rules-ladies'), ludo('berenice')),
          // Les règles numérisées : de gros fichiers qui ne changent jamais.
          'rules-scans.pdf': f(t('archives-document-pdf'), { lines: true, ...ludo('berenice', 48_000_000) }),
        },
        { owner: 'berenice', group: 'ludo', mode: 'rwxrwxr-x' },
      ),
    };
    return place({
      etc: place({ ...accountsFiles(), hostname: file('games'), 'rsnapshot.conf': file(CONF_DEBIAN) }),
      home: place({
        you: d({ 'message_from_berenice.txt': f(t('snapshots-message-berenice')) }),
        accueil: place({}, { owner: 'accueil', mode: 'rwxr-x---' }),
        berenice: place({}, { owner: 'berenice', mode: 'rwx------' }),
      }),
      tmp: place({}, { owner: 'root', mode: 'rwxrwxrwt' }),
      srv: place({ share: place(share, { owner: 'root', group: 'ludo', mode: 'rwxrwxr-x' }) }),
      mnt: place({ snapshots: place({}), usb: place({}) }),
      var: place({ cache: place({}) }),
    });
  },
  events: [
    {
      id: 'spaces',
      condition: (j) => j.last.errors.some((e) => e.includes('spaces where only tabs should be')),
      message: (j) => j.t('snapshots-event-spaces'),
    },
    {
      id: 'same-disk',
      condition: (j) => !!j.state.semainesPassees && !conf(j).conf.root.startsWith(`${path(j.t, DISK)}/`),
      message: (j) => j.t('snapshots-event-same-disk'),
    },
    {
      id: 'mails',
      condition: (j) => ((j.state.mailsCron ?? []) as string[]).some((m) => m.includes('ERROR')),
      message: (j) =>
        j.t('snapshots-event-mails', {
          exemple: ((j.state.mailsCron ?? []) as string[])
            .find((m) => m.includes('ERROR'))!
            .split('\n')
            .slice(0, 7)
            .join('\n'),
        }),
    },
    {
      id: 'links',
      condition: (j) =>
        !!j.state.semainesPassees &&
        j.last.commands.some((c) => c[0] === 'du' || (c[0] === 'rsnapshot' && c.includes('du'))) &&
        /\.1\/?\s*$/m.test(j.last.output),
      message: (j) => j.t('snapshots-event-links'),
    },
    { id: 'error-berenice', condition: (j) => wellSaved(j), message: (j) => j.t('snapshots-event-error-berenice') },
    {
      id: 'wrong-version',
      condition: (j) =>
        wellSaved(j) &&
        j.read(path(j.t, INVENTORY)) === j.t('snapshots-inventory-old') &&
        j.last.commands.some((c) => ['cp', 'rsync'].includes(c[0])),
      message: (j) => j.t('snapshots-event-wrong-version'),
    },
    { id: 'end', condition: (j) => wellSaved(j) && j.read(path(j.t, INVENTORY)) === inventory(j.t, 13), message: (j) => j.t('snapshots-event-end') },
  ],
};
