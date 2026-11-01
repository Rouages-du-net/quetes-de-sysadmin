// Histoire « La Ludothèque » — chapitre « La base » : les prêts de jeux
// vivent dans une base PostgreSQL. Malo la « sauvegarde » en copiant ses
// fichiers (/var/lib/postgresql) avec rsnapshot, pendant qu'elle tourne :
// rien ne garantit que la copie soit cohérente. Il faut une vraie sauvegarde
// (pg_dump), chaque nuit, et vérifier qu'elle se restaure (dans une base de
// test, jamais par-dessus la vraie). Puis, en début d'après-midi, un
// bénévole vide la table des prêts par erreur : on ne remet que cette table.
// Objectif vérifié sur l'état : une tâche cron fait le pg_dump de ludo sous
// un rôle qui en a le droit, une archive existe, une restauration de test a
// redonné les mêmes nombres de lignes, et la table prets est revenue.
// Sources : https://www.postgresql.org/docs/16/backup-dump.html,
// https://www.postgresql.org/docs/16/backup-file.html,
// https://www.postgresql.org/docs/16/app-pgrestore.html

import { d, f, accountsFiles, type Chapter, type Accounts, type Rights } from '../world';
import type { Game } from '../shell';
import { newSystemd, systemd } from '../systemd';
import { postgres, type PostgresState, type Table } from '../postgres';

const M = '/home/you';
const BACKUPS = '/var/backups/postgresql';
const Go = 1_000_000_000;
const NUMBERS = { jeux: 412, membres: 230, prets: 1873 };

const accounts = (): Accounts => ({
  users: {
    root: { uid: 0, group: 'root', home: '/root' },
    postgres: { uid: 115, group: 'postgres', home: '/var/lib/postgresql', shell: '/bin/bash' },
    you: { uid: 1000, group: 'you' },
    accueil: { uid: 1001, group: 'accueil' },
    berenice: { uid: 1002, group: 'berenice' },
  },
  groups: {
    root: { gid: 0, members: [] },
    sudo: { gid: 27, members: ['you', 'berenice'] },
    postgres: { gid: 122, members: [] },
    you: { gid: 1000, members: [] },
    accueil: { gid: 1001, members: [] },
    berenice: { gid: 1002, members: [] },
    ludo: { gid: 1100, members: ['you', 'accueil', 'berenice'] },
  },
});

// Des données déterministes : des jeux, des membres (par numéro de carte, sans nom) et leurs prêts.
function tables(t: Game['t']): Record<string, Table> {
  const names = t('database-noms-de-jeux').split(',');
  const neighbourhoods = ['nord', 'sud', 'est', 'ouest', 'centre'];
  const day = (n: number) => new Date(Date.UTC(2025, 8, 1) + n * 86_400_000).toISOString().slice(0, 10);
  return {
    jeux: {
      columns: ['id', 'nom', 'exemplaires'],
      lines: Array.from({ length: NUMBERS.jeux }, (_, i) => [
        String(i + 1),
        `${names[i % names.length]}${i >= names.length ? ` (${Math.floor(i / names.length) + 1})` : ''}`,
        String((i % 4) + 1),
      ]),
    },
    membres: {
      columns: ['id', 'carte', 'quartier'],
      lines: Array.from({ length: NUMBERS.membres }, (_, i) => [String(i + 1), `L-${String(1000 + i * 7)}`, neighbourhoods[i % 5]]),
    },
    prets: {
      columns: ['id', 'jeu_id', 'membre_id', 'sorti_le', 'rendu_le'],
      lines: Array.from({ length: NUMBERS.prets }, (_, i) => [
        String(i + 1),
        String(((i * 37) % NUMBERS.jeux) + 1),
        String(((i * 11) % NUMBERS.membres) + 1),
        day(Math.floor(i / 6.5)),
        i > NUMBERS.prets - 40 ? '' : day(Math.floor(i / 6.5) + 14),
      ]),
    },
  };
}

const pg = (j: Game): PostgresState => postgres(j)!;
const lines = (j: Game, base: string, table: string) => pg(j).bases[base]?.tables[table]?.lines.length ?? -1;
const crontabs = (j: Game): Record<string, string> => j.state.crontabs ?? {};
// La tâche de sauvegarde : pg_dump de ludo, sous postgres (sa crontab, ou sudo -u postgres).
const dumpTask = (j: Game) => {
  const c = crontabs(j);
  const line = (text: string) => text.split('\n').some((l) => !l.trim().startsWith('#') && /pg_dump/.test(l) && /\bludo\b/.test(l));
  return (
    (c.postgres !== undefined && line(c.postgres)) ||
    (c.root !== undefined && c.root.split('\n').some((l) => /pg_dump/.test(l) && /\bludo\b/.test(l) && /-u postgres/.test(l)))
  );
};
const dumpRoot = (j: Game) =>
  (crontabs(j).root ?? '').split('\n').some((l) => !l.trim().startsWith('#') && /pg_dump/.test(l) && !/-u postgres/.test(l));
const archive = (j: Game) => {
  const n = j.find(BACKUPS);
  return (
    n?.type === 'dossier' &&
    Object.values(n.children).some(
      (e) => e.type === 'fichier' && /^(PGDMP|--\n-- PostgreSQL database dump)/.test(typeof e.content === 'string' ? e.content : ''),
    )
  );
};
// Une autre base que ludo (une base de test) où l'on retrouve les mêmes nombres de lignes.
const succeededTest = (j: Game) =>
  Object.keys(pg(j).bases).some((b) => b !== 'ludo' && b !== 'postgres' && Object.entries(NUMBERS).every(([table, n]) => lines(j, b, table) === n));
const allIsFor = (j: Game) => Object.entries(NUMBERS).every(([table, n]) => lines(j, 'ludo', table) === n);
const output = (j: Game) => [j.last.output, ...j.last.errors].join('\n');

export const base: Chapter = {
  id: 'database',
  number: 3,
  commands: [
    'ls',
    'cd',
    'pwd',
    'cat',
    'less',
    'head',
    'tail',
    'grep',
    'wc',
    'du',
    'df',
    'cp',
    'mv',
    'rm',
    'mkdir',
    'id',
    'whoami',
    'crontab',
    'systemctl',
    'journalctl',
    'psql',
    'pg_dump',
    'pg_restore',
    'createdb',
    'dropdb',
    'sudo',
    'nano',
  ],
  home: M,
  welcome: 'message_from_berenice.txt',
  names: true,
  final: 'fin',
  password: 'ludo-2027',
  accounts,
  state: (t) => ({
    systemd: newSystemd('games', Date.UTC(2027, 6, 1, 7, 0, 0), Date.UTC(2027, 6, 14, 10, 30, 0), {
      ssh: {
        description: 'OpenBSD Secure Shell server',
        active: true,
        executable: 'sshd',
        process: [{ pid: 611, user: 'root', cpu: 0, mem: 0.2, command: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' }],
      },
      postgresql: {
        description: 'PostgreSQL RDBMS',
        active: true,
        executable: 'postgres',
        process: [
          {
            pid: 702,
            user: 'postgres',
            cpu: 0.2,
            mem: 2.4,
            command: '/usr/lib/postgresql/16/bin/postgres -D /var/lib/postgresql/16/main -c config_file=/etc/postgresql/16/main/postgresql.conf',
          },
        ],
      },
      cron: { description: 'Regular background program processing daemon', active: true, executable: 'cron' },
    }),
    postgres: {
      bases: { postgres: { owner: 'postgres', tables: {} }, ludo: { owner: 'ludo', tables: tables(t) } },
      roles: ['postgres', 'ludo'],
      archives: {},
    } satisfies PostgresState,
    crontabs: { root: `# ${t('database-crontab-root')}\n30 3 * * * /usr/bin/rsnapshot daily\n0 3 * * 1 /usr/bin/rsnapshot weekly` },
    montages: [{ path: '/', capacity: 40 * Go, name: '/dev/vda1', system: 'ext4' }],
    comptesVerrouilles: ['accueil'],
  }),
  // Après la restauration de test réussie : l'incident de 14 h 02.
  afterCommand: (j) => {
    if (j.state.incident || !j.state.testValide) return;
    j.state.incident = true;
    pg(j).bases.ludo.tables.prets.lines = [];
    const s = systemd(j)!;
    s.clock = Date.UTC(2027, 6, 14, 14, 5, 0);
    return j.t('database-incident');
  },
  createWorld: (t) => {
    const root: Rights = { owner: 'root' };
    const place = (children: Parameters<typeof d>[0], rights: Rights = root) => d(children, undefined, rights);
    const file = (text: string, rights: Rights = root) => f(text, { lines: true, ...rights });
    const pgd: Rights = { owner: 'postgres', group: 'postgres' };
    return place({
      etc: place({
        ...accountsFiles(),
        hostname: file('games'),
        postgresql: place(
          {
            '16': place({ main: place({ 'postgresql.conf': file("data_directory = '/var/lib/postgresql/16/main'\nport = 5432", pgd) }, pgd) }, pgd),
          },
          pgd,
        ),
      }),
      home: place({
        you: d({ 'message_from_berenice.txt': f(t('database-message-de-berenice')), 'note_from_malo.txt': f(t('database-mot-de-malo')) }),
        berenice: place({}, { owner: 'berenice', mode: 'rwx------' }),
      }),
      tmp: place({}, { owner: 'root', mode: 'rwxrwxrwt' }),
      var: place({
        backups: place({ postgresql: place({}, { ...pgd, mode: 'rwxr-x---' }) }),
        lib: place({
          postgresql: place(
            {
              '16': place(
                {
                  main: place(
                    { base: place({}, pgd), global: place({}, pgd), pg_wal: place({}, pgd), PG_VERSION: file('16', pgd) },
                    { ...pgd, mode: 'rwx------' },
                  ),
                },
                pgd,
              ),
            },
            pgd,
          ),
        }),
      }),
    });
  },
  events: [
    { id: 'role', condition: (j) => new RegExp(`role "(${j.player}|root)" does not exist`).test(output(j)), message: (j) => j.t('database-evenement-role') },
    {
      id: 'sur-la-vraie',
      condition: (j) =>
        output(j).includes('already exists') && j.last.commands.some((c) => c.includes('pg_restore') && c.includes('ludo')) && !j.state.incident,
      message: (j) => j.t('database-evenement-sur-la-vraie'),
    },
    {
      id: 'test-reussi',
      condition: (j) => succeededTest(j),
      // L'incident arrive à la commande suivante.
      action: (j) => (j.state.testValide = true),
      message: (j) => j.t('database-evenement-test-reussi'),
    },
    {
      id: 'doublons',
      condition: (j) => !!j.state.incident && output(j).includes('duplicate key value'),
      message: (j) => j.t('database-evenement-doublons'),
    },
    { id: 'cron-root', condition: (j) => dumpRoot(j), message: (j) => j.t('database-evenement-cron-root') },
    { id: 'prets-revenus', condition: (j) => !!j.state.incident && allIsFor(j), message: (j) => j.t('database-evenement-prets-revenus') },
    { id: 'fin', condition: (j) => !!j.state.incident && allIsFor(j) && dumpTask(j) && archive(j), message: (j) => j.t('database-evenement-fin') },
  ],
};
