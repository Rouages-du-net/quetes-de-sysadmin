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

import { d, f, fichiersComptes, type Chapitre, type Comptes, type Droits } from '../world';
import type { Jeu } from '../shell';
import { nouveauSystemd, systemd } from '../systemd';
import { postgres, type EtatPostgres, type Table } from '../postgres';

const M = '/home/vous';
const SAUVEGARDES = '/var/backups/postgresql';
const Go = 1_000_000_000;
const NOMBRES = { jeux: 412, membres: 230, prets: 1873 };

const comptes = (): Comptes => ({
  utilisateurs: {
    root: { uid: 0, groupe: 'root', maison: '/root' },
    postgres: { uid: 115, groupe: 'postgres', maison: '/var/lib/postgresql', shell: '/bin/bash' },
    vous: { uid: 1000, groupe: 'vous' },
    accueil: { uid: 1001, groupe: 'accueil' },
    berenice: { uid: 1002, groupe: 'berenice' },
  },
  groupes: {
    root: { gid: 0, membres: [] },
    sudo: { gid: 27, membres: ['vous', 'berenice'] },
    postgres: { gid: 122, membres: [] },
    vous: { gid: 1000, membres: [] },
    accueil: { gid: 1001, membres: [] },
    berenice: { gid: 1002, membres: [] },
    ludo: { gid: 1100, membres: ['vous', 'accueil', 'berenice'] },
  },
});

// Des données déterministes : des jeux, des membres (par numéro de carte, sans nom) et leurs prêts.
function tables(t: Jeu['t']): Record<string, Table> {
  const noms = t('base-noms-de-jeux').split(',');
  const quartiers = ['nord', 'sud', 'est', 'ouest', 'centre'];
  const jour = (n: number) => new Date(Date.UTC(2025, 8, 1) + n * 86_400_000).toISOString().slice(0, 10);
  return {
    jeux: {
      colonnes: ['id', 'nom', 'exemplaires'],
      lignes: Array.from({ length: NOMBRES.jeux }, (_, i) => [
        String(i + 1),
        `${noms[i % noms.length]}${i >= noms.length ? ` (${Math.floor(i / noms.length) + 1})` : ''}`,
        String((i % 4) + 1),
      ]),
    },
    membres: {
      colonnes: ['id', 'carte', 'quartier'],
      lignes: Array.from({ length: NOMBRES.membres }, (_, i) => [String(i + 1), `L-${String(1000 + i * 7)}`, quartiers[i % 5]]),
    },
    prets: {
      colonnes: ['id', 'jeu_id', 'membre_id', 'sorti_le', 'rendu_le'],
      lignes: Array.from({ length: NOMBRES.prets }, (_, i) => [
        String(i + 1),
        String(((i * 37) % NOMBRES.jeux) + 1),
        String(((i * 11) % NOMBRES.membres) + 1),
        jour(Math.floor(i / 6.5)),
        i > NOMBRES.prets - 40 ? '' : jour(Math.floor(i / 6.5) + 14),
      ]),
    },
  };
}

const pg = (j: Jeu): EtatPostgres => postgres(j)!;
const lignes = (j: Jeu, base: string, table: string) => pg(j).bases[base]?.tables[table]?.lignes.length ?? -1;
const crontabs = (j: Jeu): Record<string, string> => j.etat.crontabs ?? {};
// La tâche de sauvegarde : pg_dump de ludo, sous postgres (sa crontab, ou sudo -u postgres).
const tacheDump = (j: Jeu) => {
  const c = crontabs(j);
  const ligne = (texte: string) => texte.split('\n').some((l) => !l.trim().startsWith('#') && /pg_dump/.test(l) && /\bludo\b/.test(l));
  return (
    (c.postgres !== undefined && ligne(c.postgres)) ||
    (c.root !== undefined && c.root.split('\n').some((l) => /pg_dump/.test(l) && /\bludo\b/.test(l) && /-u postgres/.test(l)))
  );
};
const dumpRoot = (j: Jeu) =>
  (crontabs(j).root ?? '').split('\n').some((l) => !l.trim().startsWith('#') && /pg_dump/.test(l) && !/-u postgres/.test(l));
const archive = (j: Jeu) => {
  const n = j.trouver(SAUVEGARDES);
  return (
    n?.type === 'dossier' &&
    Object.values(n.enfants).some(
      (e) => e.type === 'fichier' && /^(PGDMP|--\n-- PostgreSQL database dump)/.test(typeof e.contenu === 'string' ? e.contenu : ''),
    )
  );
};
// Une autre base que ludo (une base de test) où l'on retrouve les mêmes nombres de lignes.
const testReussi = (j: Jeu) =>
  Object.keys(pg(j).bases).some((b) => b !== 'ludo' && b !== 'postgres' && Object.entries(NOMBRES).every(([table, n]) => lignes(j, b, table) === n));
const toutEstLa = (j: Jeu) => Object.entries(NOMBRES).every(([table, n]) => lignes(j, 'ludo', table) === n);
const sortie = (j: Jeu) => [j.derniere.sortie, ...j.derniere.erreurs].join('\n');

export const base: Chapitre = {
  id: 'base',
  numero: 3,
  commandes: [
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
  maison: M,
  accueil: 'message_de_berenice.txt',
  noms: true,
  final: 'fin',
  motDePasse: 'ludo-2027',
  comptes,
  etat: (t) => ({
    systemd: nouveauSystemd('ludotheque', Date.UTC(2027, 6, 1, 7, 0, 0), Date.UTC(2027, 6, 14, 10, 30, 0), {
      ssh: {
        description: 'OpenBSD Secure Shell server',
        active: true,
        executable: 'sshd',
        processus: [{ pid: 611, utilisateur: 'root', cpu: 0, mem: 0.2, commande: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' }],
      },
      postgresql: {
        description: 'PostgreSQL RDBMS',
        active: true,
        executable: 'postgres',
        processus: [
          {
            pid: 702,
            utilisateur: 'postgres',
            cpu: 0.2,
            mem: 2.4,
            commande: '/usr/lib/postgresql/16/bin/postgres -D /var/lib/postgresql/16/main -c config_file=/etc/postgresql/16/main/postgresql.conf',
          },
        ],
      },
      cron: { description: 'Regular background program processing daemon', active: true, executable: 'cron' },
    }),
    postgres: {
      bases: { postgres: { proprio: 'postgres', tables: {} }, ludo: { proprio: 'ludo', tables: tables(t) } },
      roles: ['postgres', 'ludo'],
      archives: {},
    } satisfies EtatPostgres,
    crontabs: { root: `# ${t('base-crontab-root')}\n30 3 * * * /usr/bin/rsnapshot daily\n0 3 * * 1 /usr/bin/rsnapshot weekly` },
    montages: [{ chemin: '/', capacite: 40 * Go, nom: '/dev/vda1', systeme: 'ext4' }],
    comptesVerrouilles: ['accueil'],
  }),
  // Après la restauration de test réussie : l'incident de 14 h 02.
  apresCommande: (j) => {
    if (j.etat.incident || !j.etat.testValide) return;
    j.etat.incident = true;
    pg(j).bases.ludo.tables.prets.lignes = [];
    const s = systemd(j)!;
    s.horloge = Date.UTC(2027, 6, 14, 14, 5, 0);
    return j.t('base-incident');
  },
  creerMonde: (t) => {
    const racine: Droits = { proprio: 'root' };
    const lieu = (enfants: Parameters<typeof d>[0], droits: Droits = racine) => d(enfants, undefined, droits);
    const fichier = (texte: string, droits: Droits = racine) => f(texte, { lignes: true, ...droits });
    const pgd: Droits = { proprio: 'postgres', groupe: 'postgres' };
    return lieu({
      etc: lieu({
        ...fichiersComptes(),
        hostname: fichier('ludotheque'),
        postgresql: lieu(
          {
            '16': lieu({ main: lieu({ 'postgresql.conf': fichier("data_directory = '/var/lib/postgresql/16/main'\nport = 5432", pgd) }, pgd) }, pgd),
          },
          pgd,
        ),
      }),
      home: lieu({
        vous: d({ 'message_de_berenice.txt': f(t('base-message-de-berenice')), 'mot_de_malo.txt': f(t('base-mot-de-malo')) }),
        berenice: lieu({}, { proprio: 'berenice', mode: 'rwx------' }),
      }),
      tmp: lieu({}, { proprio: 'root', mode: 'rwxrwxrwt' }),
      var: lieu({
        backups: lieu({ postgresql: lieu({}, { ...pgd, mode: 'rwxr-x---' }) }),
        lib: lieu({
          postgresql: lieu(
            {
              '16': lieu(
                {
                  main: lieu(
                    { base: lieu({}, pgd), global: lieu({}, pgd), pg_wal: lieu({}, pgd), PG_VERSION: fichier('16', pgd) },
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
  evenements: [
    { id: 'role', condition: (j) => new RegExp(`role "(${j.joueur}|root)" does not exist`).test(sortie(j)), message: (j) => j.t('base-evenement-role') },
    {
      id: 'sur-la-vraie',
      condition: (j) =>
        sortie(j).includes('already exists') && j.derniere.commandes.some((c) => c.includes('pg_restore') && c.includes('ludo')) && !j.etat.incident,
      message: (j) => j.t('base-evenement-sur-la-vraie'),
    },
    {
      id: 'test-reussi',
      condition: (j) => testReussi(j),
      // L'incident arrive à la commande suivante.
      action: (j) => (j.etat.testValide = true),
      message: (j) => j.t('base-evenement-test-reussi'),
    },
    {
      id: 'doublons',
      condition: (j) => !!j.etat.incident && sortie(j).includes('duplicate key value'),
      message: (j) => j.t('base-evenement-doublons'),
    },
    { id: 'cron-root', condition: (j) => dumpRoot(j), message: (j) => j.t('base-evenement-cron-root') },
    { id: 'prets-revenus', condition: (j) => !!j.etat.incident && toutEstLa(j), message: (j) => j.t('base-evenement-prets-revenus') },
    { id: 'fin', condition: (j) => !!j.etat.incident && toutEstLa(j) && tacheDump(j) && archive(j), message: (j) => j.t('base-evenement-fin') },
  ],
};
