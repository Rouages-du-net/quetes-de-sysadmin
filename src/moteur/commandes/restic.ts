// restic : des sauvegardes chiffrées, dédupliquées, en instantanés
// (snapshots). D'après la documentation de restic 0.18
// (https://restic.readthedocs.io/en/stable/) : backup, snapshots, ls, find,
// diff, dump, restore, forget (politiques --keep-*), prune, check, stats,
// init. Le dépôt est rangé dans etat.restic (comme les dépôts git) ; ses
// fichiers sur le disque (config, keys/, snapshots/, data/…) sont illisibles
// sans le mot de passe, et leur taille suit ce que le dépôt contient : df
// voit la place libérée par prune.
//
//   etat.restic = { [chemin du dépôt]: Depot }
//
// Écarts : pas de variables d'environnement (RESTIC_REPOSITORY…), il faut
// -r et --password-file (ou taper le mot de passe) ; une ligne de sortie
// par étape au lieu des barres de progression ; un « pack » par instantané.

import type { Fichier, Noeud } from '../monde';
import type { Shell } from '../shell';
import { joker } from '../outils';
import type { Commande } from './index';

export interface Version {
  contenu: string;
  taille: number;
  // Date de modification (heure locale de la machine, millisecondes).
  modifie: number;
}

export interface Instantane {
  id: string;
  temps: number;
  hote: string;
  chemins: string[];
  fichiers: Record<string, Version>;
}

export interface Depot {
  id: string;
  motDePasse: string;
  instantanes: Instantane[];
  // Les données rangées : un pack par sauvegarde, avec ses blobs (taille stockée).
  packs: { id: string; blobs: Record<string, number> }[];
  // check a été lancé depuis la dernière modification du dépôt.
  verifie: boolean;
  // forget a retiré des instantanés, sans prune : la place n'est pas encore rendue.
  aElaguer: boolean;
}

// Empreinte hexadécimale tirée d'un texte (FNV-1a), toujours la même.
export function hex(graine: string, longueur = 64): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < graine.length; i++) h = Math.imul(h ^ graine.charCodeAt(i), 0x01000193) >>> 0;
  let s = '';
  for (let i = 0; s.length < longueur; i++) {
    h = Math.imul(h ^ (i + 0x9e), 0x01000193) >>> 0;
    s += (h >>> 24).toString(16).padStart(2, '0');
  }
  return s.slice(0, longueur);
}

// Un blob par contenu de fichier : la même version n'est stockée qu'une fois.
const blob = (chemin: string, v: Version) => hex(`${chemin}|${v.taille}|${v.contenu}`);
// restic compresse (zstd) : le texte se réduit, les médias presque pas.
const stocke = (chemin: string, v: Version) => Math.round(v.taille * (/\.(png|jpe?g|ogg|mp3|pdf|tiff?|gz)$/i.test(chemin) ? 0.99 : 0.4));

/** Ajoute un instantané au dépôt (sauvegarde) ; renvoie ce qui était nouveau. */
export function ajouterInstantane(depot: Depot, i: Instantane) {
  const connus = new Set(depot.packs.flatMap((p) => Object.keys(p.blobs)));
  const precedent = depot.instantanes.filter((s) => s.chemins.join() === i.chemins.join()).at(-1);
  const nouveaux: Record<string, number> = {};
  let nouveauxFichiers = 0;
  let changes = 0;
  for (const [chemin, v] of Object.entries(i.fichiers)) {
    const b = blob(chemin, v);
    const avant = precedent?.fichiers[chemin];
    if (!avant) nouveauxFichiers++;
    else if (blob(chemin, avant) !== b) changes++;
    if (!connus.has(b)) {
      nouveaux[b] = stocke(chemin, v);
      connus.add(b);
    }
  }
  if (Object.keys(nouveaux).length) depot.packs.push({ id: hex(`pack-${i.id}`), blobs: nouveaux });
  depot.instantanes.push(i);
  depot.verifie = false;
  return {
    nouveauxFichiers,
    changes,
    inchanges: Object.keys(i.fichiers).length - nouveauxFichiers - changes,
    ajoute: Object.values(nouveaux).reduce((a, b) => a + b, 0),
    precedent,
  };
}

export const tailleDepot = (d: Depot) => d.packs.reduce((t, p) => t + Object.values(p.blobs).reduce((a, b) => a + b, 0), 0);

// ——— Affichage ———

/** « 54.120 MiB », comme restic. */
export function taille(octets: number): string {
  const unites = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  let v = octets;
  let u = 0;
  while (v >= 1024 && u < unites.length - 1) {
    v /= 1024;
    u++;
  }
  return u === 0 ? `${v} B` : `${v.toFixed(3)} ${unites[u]}`;
}

const date = (ms: number) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
const court = (id: string) => id.slice(0, 8);

// ——— Le dépôt sur le disque ———

// Un fichier chiffré : du texte illisible, de la taille voulue.
const chiffre = (graine: string, octets?: number): Fichier => ({
  type: 'fichier',
  contenu: hex(graine, 96)
    .replace(/(.{48})/g, '$1\n')
    .trim(),
  taille: octets,
  lignes: true,
  mode: 'r--r--r--',
});

/** Réécrit les fichiers du dépôt (sous `chemin`) selon son contenu. */
export function ecrireDepot(jeu: Shell, chemin: string, depot: Depot) {
  const n = jeu.trouver(chemin);
  if (n?.type !== 'dossier') return;
  const lieu = (enfants: Record<string, Noeud>) => ({ type: 'dossier' as const, enfants, mode: 'rwx------' });
  n.enfants = {
    config: chiffre(`config-${depot.id}`, 155),
    keys: lieu({ [hex(`cle-${depot.id}`)]: chiffre(`cle-${depot.id}`, 455) }),
    snapshots: lieu(Object.fromEntries(depot.instantanes.map((i) => [i.id, chiffre(`instantane-${i.id}`, 290)]))),
    index: lieu({ [hex(`index-${depot.packs.length}-${tailleDepot(depot)}`)]: chiffre(`index-${depot.id}`, 1200 + depot.packs.length * 180) }),
    data: lieu(Object.fromEntries(depot.packs.map((p) => [p.id, chiffre(p.id, Object.values(p.blobs).reduce((a, b) => a + b, 0) + 512)]))),
    locks: lieu({}),
  };
}

// ——— Politique de rétention (forget) ———

const semaineIso = (ms: number) => {
  const d = new Date(ms);
  const jeudi = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7)));
  const debut = new Date(Date.UTC(jeudi.getUTCFullYear(), 0, 4));
  return `${jeudi.getUTCFullYear()}-${Math.round(((jeudi.getTime() - debut.getTime()) / 86_400_000 + ((debut.getUTCDay() + 6) % 7) - 3) / 7) + 1}`;
};

const POLITIQUES: { option: string; nom: string; seau: (ms: number, i: number) => string }[] = [
  { option: '--keep-last', nom: 'last', seau: (_, i) => String(i) },
  { option: '--keep-hourly', nom: 'hourly', seau: (ms) => date(ms).slice(0, 13) },
  { option: '--keep-daily', nom: 'daily', seau: (ms) => date(ms).slice(0, 10) },
  { option: '--keep-weekly', nom: 'weekly', seau: (ms) => semaineIso(ms) },
  { option: '--keep-monthly', nom: 'monthly', seau: (ms) => date(ms).slice(0, 7) },
  { option: '--keep-yearly', nom: 'yearly', seau: (ms) => date(ms).slice(0, 4) },
];

/** Les instantanés gardés par une politique, avec leurs raisons (comme restic). */
export function appliquerPolitique(instantanes: Instantane[], politique: Record<string, number>) {
  const raisons = new Map<string, string[]>();
  const recents = [...instantanes].sort((a, b) => b.temps - a.temps);
  for (const p of POLITIQUES) {
    const n = politique[p.nom];
    if (!n) continue;
    let restant = n;
    let dernier: string | null = null;
    recents.forEach((s, i) => {
      const seau = p.seau(s.temps, i);
      if (restant > 0 && seau !== dernier) {
        raisons.set(s.id, [...(raisons.get(s.id) ?? []), `${p.nom} snapshot`]);
        restant--;
      }
      dernier = seau;
    });
  }
  return raisons;
}

// ——— La commande ———

interface Contexte {
  jeu: Shell;
  chemin: string;
  depot: Depot;
}

const ENTETE = (d: Depot) => `repository ${court(d.id)} opened (version 2, compression level auto)`;

function trouverInstantane(depot: Depot, id: string | undefined): Instantane | string {
  if (!id) return 'Fatal: no snapshot ID specified';
  if (id === 'latest') return depot.instantanes.at(-1) ?? `Fatal: failed to find snapshot: no snapshot found`;
  const trouves = depot.instantanes.filter((s) => s.id.startsWith(id));
  if (trouves.length === 1) return trouves[0];
  return trouves.length
    ? `Fatal: failed to find snapshot: multiple IDs with prefix "${id}" found`
    : `Fatal: failed to find snapshot: no matching ID found for prefix "${id}"`;
}

const ligneInstantane = (s: Instantane) =>
  `${court(s.id)}  ${date(s.temps)}  ${s.hote.padEnd(12)}  ${s.chemins.join(', ').padEnd(16)}  ${taille(Object.values(s.fichiers).reduce((t, v) => t + v.taille, 0)).padStart(11)}`;

function snapshots({ depot }: Contexte): string {
  const titre = `ID        Time                 Host          Paths             ${'Size'.padStart(11)}`;
  const trait = '-'.repeat(titre.length);
  return [ENTETE(depot), titre, trait, ...depot.instantanes.map(ligneInstantane), trait, `${depot.instantanes.length} snapshots`].join('\n');
}

function auPluriel(n: number, mot: string) {
  return `${n} ${mot}${n === 1 ? '' : 's'}`;
}

function tableau(liste: Instantane[], raisons?: Map<string, string[]>) {
  return liste.map((s) =>
    `${court(s.id)}  ${date(s.temps)}  ${s.hote.padEnd(12)}  ${(raisons?.get(s.id) ?? []).join(', ').padEnd(16)}  ${s.chemins.join(', ')}`.trimEnd(),
  );
}

// Les blobs encore utilisés par un instantané : prune garde ceux-là.
function elaguer(c: Contexte): string[] {
  const { depot } = c;
  const utilises = new Set(depot.instantanes.flatMap((s) => Object.entries(s.fichiers).map(([chemin, v]) => blob(chemin, v))));
  const avant = tailleDepot(depot);
  let packsSupprimes = 0;
  let reecrits = 0;
  depot.packs = depot.packs
    .map((p) => {
      const garde = Object.fromEntries(Object.entries(p.blobs).filter(([b]) => utilises.has(b)));
      if (!Object.keys(garde).length) {
        packsSupprimes++;
        return null;
      }
      if (Object.keys(garde).length < Object.keys(p.blobs).length) {
        reecrits++;
        return { id: hex(`reecrit-${p.id}`), blobs: garde };
      }
      return p;
    })
    .filter((p): p is Depot['packs'][number] => p !== null);
  const apres = tailleDepot(depot);
  depot.aElaguer = false;
  depot.verifie = false;
  c.jeu.etat.resticElague = true;
  ecrireDepot(c.jeu, c.chemin, depot);
  return [
    'loading indexes...',
    'loading all snapshots...',
    `finding data that is still in use for ${auPluriel(depot.instantanes.length, 'snapshot')}`,
    `[0:00] 100.00%  ${depot.instantanes.length} / ${depot.instantanes.length} snapshots`,
    'searching used packs...',
    'collecting packs for deletion and repacking',
    '',
    `to repack:          ${taille(reecrits ? Math.round((avant - apres) / 10) : 0)}`,
    `to delete:          ${taille(avant - apres)}`,
    `total prune:        ${taille(avant - apres)}`,
    `remaining:          ${taille(apres)}`,
    `unused size after prune: 0 B (0.00% of remaining size)`,
    '',
    ...(reecrits ? [`repacking packs`, `[0:00] 100.00%  ${reecrits} / ${reecrits} packs repacked`] : []),
    'rebuilding index',
    `removing ${auPluriel(packsSupprimes + reecrits, 'old pack')}`,
    'done',
  ];
}

function lancer(c: Contexte, action: string, args: string[]): string {
  const { jeu, depot } = c;
  const options = new Set(args.filter((a) => a.startsWith('-')));
  const valeurs = (nom: string) => {
    const liste: string[] = [];
    args.forEach((a, i) => {
      if (a === nom) liste.push(args[i + 1] ?? '');
      else if (a.startsWith(`${nom}=`)) liste.push(a.slice(nom.length + 1));
    });
    return liste;
  };
  // Les arguments qui ne sont pas des options (ni leurs valeurs).
  const avecValeur = ['--target', '--include', '-i', '--exclude', '-e', '--host', '--tag', '--path', ...POLITIQUES.map((p) => p.option), '--mode'];
  const positionnels = args.filter((a, i) => !a.startsWith('-') && !avecValeur.includes(args[i - 1] ?? ''));

  if (action === 'snapshots') return snapshots(c);

  if (action === 'ls') {
    const s = trouverInstantane(depot, positionnels[0]);
    if (typeof s === 'string') return jeu.erreur(s);
    const filtre = positionnels.slice(1);
    const tous = Object.keys(s.fichiers).sort();
    const lus = filtre.length ? tous.filter((p) => filtre.some((f) => p === f || p.startsWith(f.replace(/\/$/, '') + '/'))) : tous;
    const lignes = lus.map((p) =>
      options.has('-l') || options.has('--long')
        ? `-rw-r--r--  1000  1000 ${String(s.fichiers[p].taille).padStart(10)} ${date(s.fichiers[p].modifie)} ${p}`
        : p,
    );
    return [
      ENTETE(depot),
      `snapshot ${court(s.id)} of [${s.chemins.join(' ')}] at ${date(s.temps)} by vous@${s.hote}${filtre.length ? ` filtered by [${filtre.join(' ')}]` : ''}:`,
      ...lignes,
    ].join('\n');
  }

  if (action === 'find') {
    const motif = positionnels[0];
    if (!motif) return jeu.erreur('Fatal: wrong number of arguments');
    const re = joker(motif);
    const long = options.has('-l') || options.has('--long');
    const blocs: string[] = [];
    for (const s of depot.instantanes) {
      const trouves = Object.keys(s.fichiers).filter((p) => re.test(p) || re.test(p.split('/').at(-1)!));
      if (!trouves.length) continue;
      blocs.push(
        `Found matching entries in snapshot ${court(s.id)} from ${date(s.temps)}`,
        ...trouves.map((p) => (long ? `-rw-r--r--  1000  1000 ${String(s.fichiers[p].taille).padStart(10)} ${date(s.fichiers[p].modifie)} ${p}` : p)),
        '',
      );
    }
    return [ENTETE(depot), ...blocs].join('\n').trimEnd();
  }

  if (action === 'diff') {
    const [a, b] = positionnels.map((id) => trouverInstantane(depot, id));
    if (positionnels.length !== 2) return jeu.erreur('Fatal: specify two snapshot IDs');
    if (typeof a === 'string') return jeu.erreur(a);
    if (typeof b === 'string') return jeu.erreur(b);
    const chemins = [...new Set([...Object.keys(a.fichiers), ...Object.keys(b.fichiers)])].sort();
    const lignes: string[] = [];
    let n = 0;
    let r = 0;
    let m = 0;
    for (const p of chemins) {
      const va = a.fichiers[p];
      const vb = b.fichiers[p];
      if (!va) (lignes.push(`+    ${p}`), n++);
      else if (!vb) (lignes.push(`-    ${p}`), r++);
      else if (blob(p, va) !== blob(p, vb)) (lignes.push(`M    ${p}`), m++);
    }
    return [
      ENTETE(depot),
      `comparing snapshot ${court(a.id)} to ${court(b.id)}:`,
      '',
      ...lignes,
      '',
      `Files:     ${String(n).padStart(5)} new, ${String(r).padStart(5)} removed, ${String(m).padStart(5)} changed`,
    ].join('\n');
  }

  if (action === 'dump') {
    const s = trouverInstantane(depot, positionnels[0]);
    if (typeof s === 'string') return jeu.erreur(s);
    const p = positionnels[1];
    if (!p) return jeu.erreur('Fatal: no file and no snapshot specified');
    const v = s.fichiers[p];
    if (!v) return jeu.erreur(`Fatal: cannot dump file: path "${p}" not found in snapshot`);
    return v.contenu;
  }

  if (action === 'restore') {
    const s = trouverInstantane(depot, positionnels[0]);
    if (typeof s === 'string') return jeu.erreur(s);
    const [cible] = valeurs('--target');
    if (!cible) return jeu.erreur('Fatal: Please specify a directory to restore to (--target)');
    const inclus = [...valeurs('--include'), ...valeurs('-i')];
    const choisis = Object.keys(s.fichiers).filter(
      (p) =>
        !inclus.length ||
        inclus.some((i) => p === i || p.startsWith(i.replace(/\/$/, '') + '/') || joker(i).test(p) || joker(i).test(p.split('/').at(-1)!)),
    );
    const base = jeu.resoudre(cible).replace(/\/$/, '');
    // restic recrée le chemin complet sous --target.
    const erreurs: string[] = [];
    let octets = 0;
    if (!options.has('--dry-run'))
      for (const p of choisis) {
        const v = s.fichiers[p];
        const parties = p.split('/').filter(Boolean);
        let lieu = base === '' ? '' : base;
        if (lieu && !jeu.existe(lieu)) {
          const e = jeu.placer('restic', lieu, { type: 'dossier', enfants: {}, proprio: jeu.qui });
          if (e) erreurs.push(e);
        }
        for (const part of parties.slice(0, -1)) {
          lieu = `${lieu}/${part}`;
          if (!jeu.existe(lieu)) jeu.placer('restic', lieu, { type: 'dossier', enfants: {}, proprio: jeu.qui });
        }
        const e = jeu.placer('restic', `${lieu}/${parties.at(-1)}`, {
          type: 'fichier',
          contenu: v.contenu,
          taille: v.taille === v.contenu.length ? undefined : v.taille,
          lignes: true,
          proprio: jeu.qui,
        });
        if (e) erreurs.push(e);
        else octets += v.taille;
      }
    if (erreurs.length) return jeu.erreur(erreurs.join('\n'));
    return [
      ENTETE(depot),
      `restoring snapshot ${court(s.id)} of [${s.chemins.join(' ')}] at ${date(s.temps)} by vous@${s.hote} to ${cible}`,
      `Summary: Restored ${choisis.length} files/dirs (${taille(octets)}) in 0:00`,
    ].join('\n');
  }

  if (action === 'backup') {
    const chemins = positionnels.map((p) => jeu.resoudre(p).replace(/\/$/, ''));
    if (!chemins.length) return jeu.erreur('Fatal: nothing to backup, please specify source files/dirs');
    const fichiers: Record<string, Version> = {};
    const horloge = jeu.etat.resticHorloge ?? 0;
    const parcourir = (chemin: string) => {
      const n = jeu.trouver(chemin);
      if (!n) return;
      if (n.type === 'fichier') {
        const contenu = jeu.lire(chemin) ?? '';
        fichiers[chemin] = {
          contenu,
          taille: n.taille ?? new TextEncoder().encode(contenu).length,
          modifie: (n as Fichier & { modifie?: number }).modifie ?? horloge,
        };
      } else for (const nom of Object.keys(n.enfants).sort()) parcourir(`${chemin}/${nom}`);
    };
    for (const ch of chemins) {
      if (!jeu.existe(ch)) return jeu.erreur(`Fatal: unable to save snapshot: lstat ${ch}: no such file or directory`);
      parcourir(ch);
    }
    jeu.etat.resticHorloge = horloge + 60_000;
    const i: Instantane = { id: hex(`instantane-${depot.instantanes.length}-${horloge}`), temps: horloge, hote: jeu.hote, chemins, fichiers };
    const r = ajouterInstantane(depot, i);
    ecrireDepot(jeu, c.chemin, depot);
    const total = Object.values(fichiers).reduce((t, v) => t + v.taille, 0);
    return [
      ENTETE(depot),
      r.precedent ? `using parent snapshot ${court(r.precedent.id)}` : 'no parent snapshot found, will read all files',
      '',
      `Files:       ${String(r.nouveauxFichiers).padStart(4)} new, ${String(r.changes).padStart(4)} changed, ${String(r.inchanges).padStart(4)} unmodified`,
      `Added to the repository: ${taille(r.ajoute)}`,
      '',
      `processed ${auPluriel(Object.keys(fichiers).length, 'file')}, ${taille(total)} in 0:01`,
      `snapshot ${court(i.id)} saved`,
    ].join('\n');
  }

  if (action === 'forget') {
    const politique: Record<string, number> = {};
    for (const p of POLITIQUES) {
      const v = valeurs(p.option)[0];
      if (v !== undefined) {
        if (!/^\d+$/.test(v))
          return jeu.erreur(`Fatal: invalid argument "${v}" for "${p.option}" flag: strconv.ParseInt: parsing "${v}": invalid syntax`);
        politique[p.nom] = Number(v);
      }
    }
    const ids = positionnels;
    const essai = options.has('--dry-run') || options.has('-n');
    let retires: Instantane[];
    const sortie = [ENTETE(depot)];
    if (ids.length) {
      const trouves = ids.map((id) => trouverInstantane(depot, id));
      const erreur = trouves.find((t): t is string => typeof t === 'string');
      if (erreur) return jeu.erreur(erreur);
      retires = trouves as Instantane[];
      sortie.push(...retires.map((s) => `removed snapshot ${court(s.id)}`));
    } else {
      if (!Object.keys(politique).length) return [...sortie, 'no policy was specified, no snapshots will be removed'].join('\n');
      const raisons = appliquerPolitique(depot.instantanes, politique);
      const gardes = depot.instantanes.filter((s) => raisons.has(s.id));
      retires = depot.instantanes.filter((s) => !raisons.has(s.id));
      sortie.push(
        `Applying Policy: keep ${Object.entries(politique)
          .map(([k, v]) => `${v} ${k}`)
          .join(', ')} snapshots`,
        `keep ${auPluriel(gardes.length, 'snapshot')}:`,
        'ID        Time                 Host          Reasons           Paths',
        ...tableau(gardes, raisons),
        '',
      );
      if (retires.length)
        sortie.push(
          `remove ${auPluriel(retires.length, 'snapshot')}:`,
          'ID        Time                 Host                            Paths',
          ...tableau(retires),
          '',
        );
    }
    if (essai) return [...sortie, 'Would have removed the snapshots above (dry run).'].join('\n');
    depot.instantanes = depot.instantanes.filter((s) => !retires.includes(s));
    depot.verifie = false;
    if (retires.length) depot.aElaguer = true;
    jeu.etat.resticOublie = true;
    ecrireDepot(jeu, c.chemin, depot);
    if (retires.length) sortie.push(`[0:00] 100.00%  ${retires.length} / ${retires.length} files deleted`);
    if (options.has('--prune')) sortie.push(...elaguer(c));
    return sortie.join('\n');
  }

  if (action === 'prune') return [ENTETE(depot), ...elaguer(c)].join('\n');

  if (action === 'check') {
    depot.verifie = true;
    return [
      'using temporary cache in /tmp/restic-check-cache-4012',
      ENTETE(depot),
      'created new cache in /tmp/restic-check-cache-4012',
      'create exclusive lock for repository',
      'load indexes',
      'check all packs',
      'check snapshots, trees and blobs',
      `[0:00] 100.00%  ${depot.instantanes.length} / ${depot.instantanes.length} snapshots`,
      'no errors were found',
    ].join('\n');
  }

  if (action === 'stats') {
    const brut = valeurs('--mode')[0] === 'raw-data';
    if (brut)
      return [
        ENTETE(depot),
        'scanning...',
        'Stats in raw-data mode:',
        `     Snapshots processed:  ${depot.instantanes.length}`,
        `              Total Size:  ${taille(tailleDepot(depot))}`,
      ].join('\n');
    return [
      ENTETE(depot),
      'scanning...',
      'Stats in restore-size mode:',
      `     Snapshots processed:  ${depot.instantanes.length}`,
      `        Total File Count:  ${depot.instantanes.reduce((t, s) => t + Object.keys(s.fichiers).length, 0)}`,
      `              Total Size:  ${taille(depot.instantanes.reduce((t, s) => t + Object.values(s.fichiers).reduce((a, v) => a + v.taille, 0), 0))}`,
    ].join('\n');
  }

  return jeu.erreur(`Fatal: unknown command "${action}" for "restic"\n${jeu.t('restic-usage')}`);
}

const ACTIONS = ['snapshots', 'ls', 'find', 'diff', 'dump', 'restore', 'backup', 'forget', 'prune', 'check', 'stats', 'init'];

export const RESTIC: Record<string, Commande> = {
  restic: {
    propresOptions: true,
    lancer: ({ args, jeu }) => {
      if (args.includes('version')) return 'restic 0.18.0 compiled with go1.24.4 on linux/amd64';
      // Les options globales : -r dépôt, --password-file / -p fichier.
      let depotChemin = '';
      let fichierMdp = '';
      const reste: string[] = [];
      for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a === '-r' || a === '--repo') depotChemin = args[++i] ?? '';
        else if (a.startsWith('--repo=')) depotChemin = a.slice(7);
        else if (a === '-p' || a === '--password-file') fichierMdp = args[++i] ?? '';
        else if (a.startsWith('--password-file=')) fichierMdp = a.slice(16);
        else reste.push(a);
      }
      const action = reste.find((a) => !a.startsWith('-'));
      if (!action) return jeu.erreur(jeu.t('restic-usage'));
      if (!ACTIONS.includes(action)) return jeu.erreur(`Error: unknown command "${action}" for "restic"\nRun 'restic --help' for usage.`);
      const suite = reste.slice(reste.indexOf(action) + 1);
      if (!depotChemin) return jeu.erreur('Fatal: Please specify repository location (-r or --repository-file)');
      const chemin = jeu.resoudre(depotChemin).replace(/\/$/, '');
      const depots: Record<string, Depot> = (jeu.etat.restic ??= {});
      // Un dépôt se reconnaît à son fichier config, où qu'il soit monté (une clé USB, par exemple).
      const depot = depots[chemin] ?? Object.values(depots).find((d) => jeu.lire(`${chemin}/config`) === chiffre(`config-${d.id}`).contenu);
      if (action === 'init') {
        if (depot || jeu.existe(`${chemin}/config`))
          return jeu.erreur(`Fatal: create repository at ${depotChemin} failed: config file already exists`);
        return jeu.erreur(jeu.t('restic-init'));
      }
      if (!depot || !jeu.existe(`${chemin}/config`))
        return jeu.erreur(
          `Fatal: repository does not exist: unable to open config file: stat ${chemin}/config: no such file or directory\nIs there a repository at the following location?\n${depotChemin}`,
        );
      const c: Contexte = { jeu, chemin, depot };
      const executer = (mdp: string) => {
        if (mdp !== depot.motDePasse) {
          jeu.etat.resticMauvaisMdp = true;
          return jeu.erreur('Fatal: wrong password or no key found');
        }
        return lancer(c, action, suite);
      };
      if (fichierMdp) {
        const n = jeu.trouver(fichierMdp);
        if (!n || n.type !== 'fichier') return jeu.erreur(`Fatal: Load(<password file>): open ${fichierMdp}: no such file or directory`);
        if (!jeu.traverse(fichierMdp) || !jeu.peut(n, 'r')) return jeu.erreur(`Fatal: Load(<password file>): open ${fichierMdp}: permission denied`);
        jeu.etat.resticFichierMdp = jeu.resoudre(fichierMdp);
        return executer((jeu.lire(fichierMdp) ?? '').trim());
      }
      // Sans fichier, restic demande le mot de passe (la saisie suit, en clair ici).
      const qui = jeu.qui;
      jeu.demander('enter password for repository: ', (reponse) => {
        const avant = jeu.qui;
        jeu.qui = qui;
        try {
          // Les erreurs d'une réponse s'affichent avec elle.
          const sortie = executer(reponse);
          return [...jeu.recupererErreurs(), sortie].filter(Boolean).join('\n');
        } finally {
          jeu.qui = avant;
        }
      });
      return '';
    },
  },
};
