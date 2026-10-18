// Les outils de PostgreSQL 16 : psql (une requête avec -c, un fichier avec
// -f, la liste des bases avec -l), pg_dump (texte ou -Fc), pg_restore,
// createdb et dropdb. Le serveur est simulé dans postgres.ts.
// D'après https://www.postgresql.org/docs/16/app-pgdump.html,
// https://www.postgresql.org/docs/16/app-pgrestore.html et
// https://www.postgresql.org/docs/16/app-psql.html.
// Écarts : SQL réduit à SELECT count(*), SELECT … [WHERE col = v] [ORDER BY]
// [LIMIT], DELETE [WHERE col = v], TRUNCATE, DROP TABLE, et aux méta-commandes
// \l, \dt, \d ; psql sans -c ni -f ne s'ouvre pas en mode interactif.

import type { Shell } from '../shell';
import { connexion, copie, dumpSql, lireDumpSql, postgres, tableau, type Table } from '../postgres';
import { hex } from './restic';
import { systemd } from '../systemd';
import type { Commande } from './index';

// Les options d'une commande : -x valeur, --long=valeur, -Fc.
function lireOptions(args: string[], avecValeur: string[]) {
  const options: Record<string, string> = {};
  const listes: Record<string, string[]> = {};
  const positionnels: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--') && a.includes('=')) {
      const [k, v] = [a.slice(0, a.indexOf('=')), a.slice(a.indexOf('=') + 1)];
      options[k] = v;
      (listes[k] ??= []).push(v);
    } else if (avecValeur.includes(a)) {
      options[a] = args[++i] ?? '';
      (listes[a] ??= []).push(options[a]);
    } else if (/^-[A-Za-z]./.test(a) && avecValeur.includes(a.slice(0, 2))) {
      options[a.slice(0, 2)] = a.slice(2);
      (listes[a.slice(0, 2)] ??= []).push(a.slice(2));
    } else if (a.startsWith('-')) options[a] = 'oui';
    else positionnels.push(a);
  }
  return { options, listes, positionnels };
}

const valeur = (v: string) => v.replace(/^'(.*)'$/, '$1');

/** Exécute une instruction SQL (ou une méta-commande) ; renvoie la sortie de psql. */
function sql(jeu: Shell, base: string, requete: string): string {
  const pg = postgres(jeu)!;
  const b = pg.bases[base];
  const r = requete.trim().replace(/;\s*$/, '');
  const table = (nom: string): Table | string => b.tables[nom.toLowerCase()] ?? `ERROR:  relation "${nom}" does not exist`;
  if (/^\\l(ist)?\+?$/.test(r))
    return tableau(
      ['Name', 'Owner', 'Encoding'],
      Object.entries(pg.bases)
        .sort(([a], [z]) => a.localeCompare(z))
        .map(([nom, x]) => [nom, x.proprio, 'UTF8']),
      'List of databases',
    );
  if (/^\\dt\+?$/.test(r)) {
    const noms = Object.keys(b.tables).sort();
    if (!noms.length) return 'Did not find any relations.';
    return tableau(
      ['Schema', 'Name', 'Type', 'Owner'],
      noms.map((n) => ['public', n, 'table', b.proprio]),
      'List of relations',
    );
  }
  const d = /^\\d\s+(\w+)$/.exec(r);
  if (d) {
    const t = table(d[1]);
    if (typeof t === 'string') return jeu.erreur(`Did not find any relation named "${d[1]}".`);
    return tableau(
      ['Column', 'Type'],
      t.colonnes.map((c, i) => [c, i === 0 ? 'integer' : 'text']),
      `Table "public.${d[1]}"`,
    );
  }
  // WHERE col = valeur (une seule condition).
  const filtrer = (t: Table, ou?: string): string[][] | string => {
    if (!ou) return t.lignes;
    const m = /^(\w+)\s*=\s*('?[^']*'?|\d+)$/.exec(ou.trim());
    if (!m) return `ERROR:  syntax error at or near "${ou.trim().split(/\s+/)[1] ?? ou}"`;
    const i = t.colonnes.indexOf(m[1]);
    if (i < 0) return `ERROR:  column "${m[1]}" does not exist`;
    return t.lignes.filter((l) => l[i] === valeur(m[2]));
  };
  const compte = /^select\s+count\(\*\)\s+from\s+(\w+)(?:\s+where\s+(.+))?$/i.exec(r);
  if (compte) {
    const t = table(compte[1]);
    if (typeof t === 'string') return jeu.erreur(t);
    const lignes = filtrer(t, compte[2]);
    if (typeof lignes === 'string') return jeu.erreur(lignes);
    return tableau(['count'], [[String(lignes.length)]]);
  }
  const selection = /^select\s+(.+?)\s+from\s+(\w+)(?:\s+where\s+(.+?))?(?:\s+order\s+by\s+(\w+)(\s+desc)?)?(?:\s+limit\s+(\d+))?$/i.exec(r);
  if (selection) {
    const t = table(selection[2]);
    if (typeof t === 'string') return jeu.erreur(t);
    const colonnes = selection[1].trim() === '*' ? t.colonnes : selection[1].split(',').map((c) => c.trim());
    const inconnue = colonnes.find((c) => !t.colonnes.includes(c));
    if (inconnue) return jeu.erreur(`ERROR:  column "${inconnue}" does not exist`);
    let lignes = filtrer(t, selection[3]);
    if (typeof lignes === 'string') return jeu.erreur(lignes);
    if (selection[4]) {
      const i = t.colonnes.indexOf(selection[4]);
      if (i < 0) return jeu.erreur(`ERROR:  column "${selection[4]}" does not exist`);
      lignes = [...lignes].sort((a, z) => (/^\d+$/.test(a[i]) ? Number(a[i]) - Number(z[i]) : a[i].localeCompare(z[i])) * (selection[5] ? -1 : 1));
    }
    if (selection[6]) lignes = lignes.slice(0, Number(selection[6]));
    return tableau(
      colonnes,
      lignes.map((l) => colonnes.map((c) => l[t.colonnes.indexOf(c)])),
    );
  }
  const suppression = /^delete\s+from\s+(\w+)(?:\s+where\s+(.+))?$/i.exec(r);
  if (suppression) {
    const t = table(suppression[1]);
    if (typeof t === 'string') return jeu.erreur(t);
    const visees = filtrer(t, suppression[2]);
    if (typeof visees === 'string') return jeu.erreur(visees);
    t.lignes = t.lignes.filter((l) => !visees.includes(l));
    return `DELETE ${visees.length}`;
  }
  const vider = /^truncate\s+(?:table\s+)?(\w+)$/i.exec(r);
  if (vider) {
    const t = table(vider[1]);
    if (typeof t === 'string') return jeu.erreur(t);
    t.lignes = [];
    return 'TRUNCATE TABLE';
  }
  const effacer = /^drop\s+table\s+(\w+)$/i.exec(r);
  if (effacer) {
    const t = table(effacer[1]);
    if (typeof t === 'string') return jeu.erreur(t);
    delete b.tables[effacer[1].toLowerCase()];
    return 'DROP TABLE';
  }
  return jeu.erreur(`ERROR:  syntax error at or near "${r.split(/\s+/)[0]}"\nLINE 1: ${r}\n        ^`);
}

/** Restaure des tables dans une base, comme pg_restore (ou psql -f) ; renvoie les erreurs. */
function restaurer(jeu: Shell, base: string, tables: Record<string, Table>, donneesSeules: boolean, nettoyer: boolean): string[] {
  const b = postgres(jeu)!.bases[base];
  const erreurs: string[] = [];
  for (const [nom, t] of Object.entries(copie(tables))) {
    if (!donneesSeules) {
      if (b.tables[nom] && !nettoyer) {
        erreurs.push(
          `pg_restore: error: could not execute query: ERROR:  relation "${nom}" already exists`,
          `Command was: CREATE TABLE public.${nom} (\n${t.colonnes.map((c, i) => `    ${c} ${i === 0 ? 'integer NOT NULL' : 'text'}`).join(',\n')}\n);`,
        );
      } else b.tables[nom] = { colonnes: t.colonnes, lignes: [] };
    }
    const cible = b.tables[nom];
    if (!cible) {
      erreurs.push(`pg_restore: error: could not execute query: ERROR:  relation "public.${nom}" does not exist`);
      continue;
    }
    // La clé primaire (la première colonne) : un doublon fait échouer tout le COPY de la table.
    const cles = new Set(cible.lignes.map((l) => l[0]));
    const doublon = t.lignes.find((l) => cles.has(l[0]));
    if (doublon) {
      erreurs.push(
        `pg_restore: error: COPY failed for table "${nom}": ERROR:  duplicate key value violates unique constraint "${nom}_pkey"`,
        `DETAIL:  Key (${t.colonnes[0]})=(${doublon[0]}) already exists.`,
      );
      continue;
    }
    cible.lignes.push(...t.lignes);
  }
  return erreurs;
}

const CUSTOM = /^PGDMP ([0-9a-f]{16})$/;

export const POSTGRES: Record<string, Commande> = {
  psql: {
    propresOptions: true,
    lancer: ({ args, jeu }) => {
      const { options, positionnels } = lireOptions(args, ['-d', '--dbname', '-c', '--command', '-f', '--file', '-U', '--username']);
      if (options['-l'] || options['--list']) {
        const e = connexion(jeu, 'psql', 'postgres');
        return e ? jeu.erreur(e) : sql(jeu, 'postgres', '\\l');
      }
      const base = options['-d'] ?? options['--dbname'] ?? positionnels[0] ?? jeu.qui;
      const e = connexion(jeu, 'psql', base);
      if (e) return jeu.erreur(e);
      const requete = options['-c'] ?? options['--command'];
      if (requete) return sql(jeu, base, requete);
      const fichier = options['-f'] ?? options['--file'];
      if (fichier) {
        const texte = jeu.lirePour('psql', fichier);
        if (texte === null) return '';
        const tables = lireDumpSql(texte);
        if (!tables) return jeu.erreur(`psql:${fichier}:1: ERROR:  syntax error at or near "${texte.split(/\s+/)[0] ?? ''}"`);
        const erreurs = restaurer(jeu, base, tables, false, false).map((l) =>
          l.replace(/^pg_restore: error: (could not execute query: |COPY failed for table "\w+": )?/, `psql:${fichier}: `),
        );
        if (erreurs.length) jeu.erreur(erreurs.join('\n'));
        return ['SET', ...Object.keys(tables).flatMap((n) => ['CREATE TABLE', 'ALTER TABLE', `COPY ${tables[n].lignes.length}`])].join('\n');
      }
      return jeu.erreur(jeu.t('psql-interactif'));
    },
  },

  pg_dump: {
    propresOptions: true,
    lancer: ({ args, jeu }) => {
      const { options, listes, positionnels } = lireOptions(args, [
        '-f',
        '--file',
        '-F',
        '--format',
        '-t',
        '--table',
        '-d',
        '--dbname',
        '-U',
        '--username',
      ]);
      const base = options['-d'] ?? options['--dbname'] ?? positionnels[0] ?? jeu.qui;
      const e = connexion(jeu, 'pg_dump', base);
      if (e) return jeu.erreur(e);
      const b = postgres(jeu)!.bases[base];
      const choisies = [...(listes['-t'] ?? []), ...(listes['--table'] ?? [])];
      const inconnue = choisies.find((t) => !b.tables[t]);
      if (inconnue) return jeu.erreur(`pg_dump: error: no matching tables were found for pattern "${inconnue}"`);
      const tables = copie(Object.fromEntries(Object.entries(b.tables).filter(([n]) => !choisies.length || choisies.includes(n))));
      const format = (options['-F'] ?? options['--format'] ?? 'p').toLowerCase()[0];
      let texte: string;
      if (format === 'c') {
        const temps = systemd(jeu)?.horloge ?? 0;
        const id = hex(
          `pgdump-${base}-${temps}-${JSON.stringify(Object.keys(tables))}-${Object.values(tables).reduce((t, x) => t + x.lignes.length, 0)}`,
          16,
        );
        postgres(jeu)!.archives[id] = { base, tables, temps };
        texte = `PGDMP ${id}`;
      } else texte = dumpSql(base, tables, b.proprio);
      const fichier = options['-f'] ?? options['--file'];
      if (!fichier) return texte;
      const n = jeu.trouver(fichier);
      if (n?.type === 'fichier') {
        if (!jeu.peut(n, 'w')) return jeu.erreur(`pg_dump: error: could not open output file "${fichier}": Permission denied`);
        n.contenu = texte;
        delete n.taille;
        return '';
      }
      const erreur = jeu.placer('pg_dump', fichier, { type: 'fichier', contenu: texte, lignes: true, proprio: jeu.qui, mode: 'rw-r--r--' });
      return erreur
        ? jeu.erreur(
            `pg_dump: error: could not open output file "${fichier}": ${jeu.trouver(fichier + '/..') ? 'Permission denied' : 'No such file or directory'}`,
          )
        : '';
    },
  },

  pg_restore: {
    propresOptions: true,
    lancer: ({ args, jeu }) => {
      const { options, listes, positionnels } = lireOptions(args, ['-d', '--dbname', '-t', '--table', '-f', '--file', '-U', '--username']);
      const fichier = positionnels[0];
      if (!fichier) return jeu.erreur(jeu.t('pg-restore-entree'));
      const texte = jeu.lirePour('pg_restore', fichier);
      if (texte === null) return '';
      const m = CUSTOM.exec(texte.trim());
      if (!m) {
        if (lireDumpSql(texte)) return jeu.erreur('pg_restore: error: input file appears to be a text format dump. Please use psql.');
        return jeu.erreur('pg_restore: error: input file does not appear to be a valid archive');
      }
      const archive = postgres(jeu)?.archives[m[1]];
      if (!archive) return jeu.erreur('pg_restore: error: input file does not appear to be a valid archive');
      const choisies = [...(listes['-t'] ?? []), ...(listes['--table'] ?? [])];
      const tables = Object.fromEntries(Object.entries(archive.tables).filter(([n]) => !choisies.length || choisies.includes(n)));
      if (options['-l'] || options['--list'])
        return [
          ';',
          `; Archive created at ${new Date(archive.temps).toISOString().slice(0, 19).replace('T', ' ')} CEST`,
          `;     dbname: ${archive.base}`,
          `;     TOC Entries: ${Object.keys(archive.tables).length * 2}`,
          ';     Format: CUSTOM',
          ';',
          ...Object.keys(archive.tables).flatMap((n, i) => [
            `${210 + i}; 1259 ${16400 + i} TABLE public ${n} ludo`,
            `${3360 + i}; 0 ${16400 + i} TABLE DATA public ${n} ludo`,
          ]),
        ].join('\n');
      const base = options['-d'] ?? options['--dbname'];
      // Sans -d, pg_restore écrit le SQL (comme un dump texte).
      if (!base) return dumpSql(archive.base, tables, 'ludo');
      const e = connexion(jeu, 'pg_restore', base);
      if (e) return jeu.erreur(e);
      const erreurs = restaurer(jeu, base, tables, !!(options['-a'] || options['--data-only']), !!(options['-c'] || options['--clean']));
      if (erreurs.length)
        return jeu.erreur(
          [...erreurs, `pg_restore: warning: errors ignored on restore: ${erreurs.filter((x) => x.startsWith('pg_restore: error')).length}`].join(
            '\n',
          ),
        );
      jeu.etat.pgRestaurations = [...(jeu.etat.pgRestaurations ?? []), { base, archive: m[1], tables: Object.keys(tables) }];
      return '';
    },
  },

  createdb: {
    propresOptions: true,
    lancer: ({ args, jeu }) => {
      const { options, positionnels } = lireOptions(args, ['-O', '--owner', '-U', '--username']);
      const nom = positionnels[0] ?? jeu.qui;
      const e = connexion(jeu, 'createdb', 'postgres');
      if (e) return jeu.erreur(e);
      const pg = postgres(jeu)!;
      if (jeu.qui !== 'postgres') return jeu.erreur('createdb: error: database creation failed: ERROR:  permission denied to create database');
      if (pg.bases[nom]) return jeu.erreur(`createdb: error: database creation failed: ERROR:  database "${nom}" already exists`);
      pg.bases[nom] = { proprio: options['-O'] ?? options['--owner'] ?? jeu.qui, tables: {} };
      return '';
    },
  },

  dropdb: {
    propresOptions: true,
    lancer: ({ args, jeu }) => {
      const { positionnels } = lireOptions(args, ['-U', '--username']);
      const nom = positionnels[0];
      if (!nom) return jeu.erreur('dropdb: error: missing required argument database name');
      const e = connexion(jeu, 'dropdb', 'postgres');
      if (e) return jeu.erreur(e);
      const pg = postgres(jeu)!;
      if (!pg.bases[nom]) return jeu.erreur(`dropdb: error: database removal failed: ERROR:  database "${nom}" does not exist`);
      if (jeu.qui !== 'postgres' && pg.bases[nom].proprio !== jeu.qui)
        return jeu.erreur(`dropdb: error: database removal failed: ERROR:  must be owner of database ${nom}`);
      delete pg.bases[nom];
      return '';
    },
  },
};
