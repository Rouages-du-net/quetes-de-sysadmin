// Les journaux qui grossissent : lsof (qui tient quel fichier ouvert),
// truncate (vider un fichier sans le supprimer) et logrotate (faire tourner
// les journaux). D'après lsof(8), truncate (coreutils) et logrotate(8)
// (https://man7.org/linux/man-pages/man8/logrotate.8.html).
// Écarts : lsof ne connaît que les fichiers ouverts décrits par le jeu
// (etat.ouverts) ; logrotate : une partie des directives, un état par
// journal, sorties de -d et -v abrégées.

import type { Fichier, Noeud } from '../world';
import type { Shell } from '../shell';
import { joker } from '../tools';
import { inode } from './files';
import { efface, ouverts, tenu } from '../open-files';
import { executerScript } from '../script';
import { systemd } from '../systemd';
import type { Commande } from './index';

const taille = (n: Fichier) => n.taille ?? (typeof n.contenu === 'string' ? n.contenu.length : 0);

// ——— lsof ———

function lsof(jeu: Shell, args: string[]): string {
  const liens = args.includes('+L1');
  const pid = args.includes('-p') ? args[args.indexOf('-p') + 1] : undefined;
  const compte = args.includes('-u') ? args[args.indexOf('-u') + 1] : undefined;
  const chemins = args.filter((a, i) => !a.startsWith('-') && !a.startsWith('+') && !['-p', '-u'].includes(args[i - 1])).map((a) => jeu.resoudre(a));
  // Sans être root, on ne voit que ses propres processus.
  const lignes = ouverts(jeu).filter(
    (o) =>
      tenu(jeu, o) &&
      (jeu.qui === 'root' || o.utilisateur === jeu.qui) &&
      (!liens || efface(jeu, o)) &&
      (!pid || String(o.pid) === pid) &&
      (!compte || o.utilisateur === compte) &&
      (!chemins.length || chemins.includes(o.chemin)),
  );
  if (!lignes.length) return jeu.erreur('');
  const entete = liens
    ? 'COMMAND  PID     USER   FD   TYPE DEVICE    SIZE/OFF NLINK   NODE NAME'
    : 'COMMAND  PID     USER   FD   TYPE DEVICE    SIZE/OFF   NODE NAME';
  return [
    entete,
    ...lignes.map((o) => {
      const fin = `${String(inode(o.noeud)).padStart(7)} ${o.chemin}${efface(jeu, o) ? ' (deleted)' : ''}`;
      const debut = `${o.commande.slice(0, 8).padEnd(8)} ${String(o.pid).padEnd(7)} ${o.utilisateur.padEnd(6)} ${`${o.fd}w`.padStart(4)}   REG  254,1 ${String(taille(o.noeud)).padStart(11)}`;
      return liens ? `${debut} ${(efface(jeu, o) ? '0' : '1').padStart(5)} ${fin}` : `${debut} ${fin}`;
    }),
  ].join('\n');
}

// ——— truncate ———

// « 0 », « 10K », « 1M », « 2G » → octets.
function octets(texte: string): number | null {
  const m = /^(\d+)([KMG]?)$/i.exec(texte);
  if (!m) return null;
  return Number(m[1]) * { '': 1, K: 1024, M: 1024 ** 2, G: 1024 ** 3 }[m[2].toUpperCase() as '' | 'K' | 'M' | 'G'];
}

function tronquer(jeu: Shell, args: string[]): string {
  const i = args.findIndex((a) => a === '-s' || a.startsWith('--size='));
  const brut = i < 0 ? undefined : args[i] === '-s' ? args[i + 1] : args[i].slice(7);
  const fichiers = args.filter((a, k) => !a.startsWith('-') && !(i >= 0 && args[i] === '-s' && k === i + 1));
  if (brut === undefined) return jeu.erreur(jeu.t('truncate-taille'));
  const n = octets(brut);
  if (n === null) return jeu.erreur(jeu.t('truncate-taille-incorrecte', { taille: brut }));
  if (!fichiers.length) return jeu.erreur(jeu.t('truncate-operande'));
  for (const f of fichiers) {
    const noeud = jeu.trouver(f);
    if (noeud?.type === 'dossier') jeu.erreur(jeu.t('truncate-dossier', { fichier: f }));
    else if (noeud) {
      if (!jeu.peut(noeud, 'w')) jeu.erreur(jeu.t('truncate-permission', { fichier: f }));
      else {
        noeud.contenu = typeof noeud.contenu === 'string' ? noeud.contenu.slice(0, n) : '';
        noeud.taille = n;
      }
    } else if (!args.includes('-c')) {
      const e = jeu.placer('truncate', f, { type: 'fichier', contenu: '', taille: n, proprio: jeu.qui });
      if (e) jeu.erreur(e);
    }
  }
  return '';
}

// ——— logrotate ———

interface Bloc {
  motifs: string[];
  periode: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | null;
  rotation: number;
  compresser: boolean;
  differer: boolean;
  manquantOk: boolean;
  siVide: boolean;
  copierTronquer: boolean;
  creer: { mode?: string; proprio?: string; groupe?: string } | null;
  taille: number | null;
  apres: string[];
}

const SANS_ARGUMENT = [
  'daily',
  'weekly',
  'monthly',
  'yearly',
  'hourly',
  'compress',
  'nocompress',
  'delaycompress',
  'missingok',
  'nomissingok',
  'notifempty',
  'ifempty',
  'copytruncate',
  'nocopytruncate',
  'nocreate',
  'sharedscripts',
  'nosharedscripts',
  'dateext',
  'nodateext',
];
const AVEC_ARGUMENT = [
  'rotate',
  'size',
  'maxsize',
  'minsize',
  'maxage',
  'su',
  'olddir',
  'compresscmd',
  'compressext',
  'dateformat',
  'include',
  'create',
  'tabooext',
];

/** Lit un fichier de configuration de logrotate (et ce qu'il inclut). */
function lireConfig(jeu: Shell, fichier: string, erreurs: string[], defaut?: Partial<Bloc>, lus: string[] = []): Bloc[] {
  lus.push(fichier);
  const texte = jeu.lire(fichier);
  if (texte === null) {
    erreurs.push(`error: cannot stat ${fichier}: No such file or directory`);
    return [];
  }
  const globaux: Partial<Bloc> = { ...defaut };
  const blocs: Bloc[] = [];
  let courant: Bloc | null = null;
  let script: string[] | null = null;
  const lignes = texte.split('\n');
  const appliquer = (cible: Partial<Bloc>, mots: string[], numero: number) => {
    const [cle, ...args] = mots;
    if (!SANS_ARGUMENT.includes(cle) && !AVEC_ARGUMENT.includes(cle))
      return erreurs.push(`error: ${fichier}:${numero} unknown option '${cle}' -- ignoring line`);
    if (['daily', 'weekly', 'monthly', 'yearly', 'hourly'].includes(cle)) cible.periode = cle as Bloc['periode'];
    else if (cle === 'rotate') {
      if (!/^\d+$/.test(args[0] ?? '')) return erreurs.push(`error: ${fichier}:${numero} bad rotation count '${args[0] ?? ''}'`);
      cible.rotation = Number(args[0]);
    } else if (cle === 'compress') cible.compresser = true;
    else if (cle === 'nocompress') cible.compresser = false;
    else if (cle === 'delaycompress') cible.differer = true;
    else if (cle === 'missingok') cible.manquantOk = true;
    else if (cle === 'nomissingok') cible.manquantOk = false;
    else if (cle === 'notifempty') cible.siVide = false;
    else if (cle === 'ifempty') cible.siVide = true;
    else if (cle === 'copytruncate') cible.copierTronquer = true;
    else if (cle === 'nocreate') cible.creer = null;
    else if (cle === 'create') cible.creer = { mode: args[0], proprio: args[1], groupe: args[2] };
    else if (cle === 'size' || cle === 'maxsize') cible.taille = octets(args[0] ?? '') ?? null;
    else if (cle === 'include') {
      const n = jeu.trouver(args[0] ?? '');
      const fichiers =
        n?.type === 'dossier'
          ? Object.keys(n.enfants)
              .sort()
              .map((k) => `${args[0].replace(/\/$/, '')}/${k}`)
          : [args[0]];
      for (const f of fichiers) blocs.push(...lireConfig(jeu, f, erreurs, { ...globaux }, lus));
    }
    return 0;
  };
  lignes.forEach((brute, i) => {
    const numero = i + 1;
    const ligne = brute.replace(/(^|\s)#.*$/, '').trim();
    if (script) {
      if (ligne === 'endscript') script = null;
      else script.push(brute.trim());
      return;
    }
    if (!ligne) return;
    if (courant) {
      if (ligne === '}') {
        blocs.push(courant);
        courant = null;
      } else if (ligne === 'postrotate' || ligne === 'prerotate') {
        script = ligne === 'postrotate' ? courant.apres : [];
      } else appliquer(courant, ligne.split(/\s+/), numero);
      return;
    }
    const ouvre = /^(.+?)\s*\{$/.exec(ligne);
    if (ouvre) {
      courant = {
        motifs: ouvre[1].split(/\s+/),
        periode: null,
        rotation: 0,
        compresser: false,
        differer: false,
        manquantOk: false,
        siVide: true,
        copierTronquer: false,
        creer: {},
        taille: null,
        ...globaux,
        apres: [],
      } as Bloc;
      return;
    }
    if (ligne === '{' || ligne === '}') return void erreurs.push(`error: ${fichier}:${numero} unexpected ${ligne}`);
    appliquer(globaux, ligne.split(/\s+/), numero);
  });
  if (courant) erreurs.push(`error: ${fichier}:${lignes.length} missing '}' at end of file`);
  return blocs;
}

// Les journaux qu'un motif désigne (un joker dans le nom du fichier).
function journaux(jeu: Shell, motif: string): string[] {
  const dossier = motif.slice(0, motif.lastIndexOf('/')) || '/';
  const nom = motif.slice(motif.lastIndexOf('/') + 1);
  const n = jeu.trouver(dossier);
  if (n?.type !== 'dossier') return [];
  const re = joker(nom);
  return Object.keys(n.enfants)
    .filter((k) => re.test(k) && n.enfants[k].type === 'fichier')
    .sort()
    .map((k) => `${dossier}/${k}`);
}

const PERIODES: Record<string, number> = {
  hourly: 3600_000,
  daily: 86_400_000,
  weekly: 7 * 86_400_000,
  monthly: 30 * 86_400_000,
  yearly: 365 * 86_400_000,
};

function logrotate(jeu: Shell, args: string[]): string {
  const debug = args.includes('-d') || args.includes('--debug');
  const force = args.includes('-f') || args.includes('--force');
  const bavard = debug || args.includes('-v') || args.includes('--verbose');
  const configs = args.filter((a) => !a.startsWith('-'));
  if (!configs.length) return jeu.erreur(jeu.t('logrotate-usage'));
  if (jeu.qui !== 'root' && !debug) return jeu.erreur('error: error creating output file /var/lib/logrotate/status.tmp: Permission denied');
  const erreurs: string[] = [];
  const blocs = configs.flatMap((c) => lireConfig(jeu, c, erreurs));
  const sortie: string[] = [];
  if (debug)
    sortie.push(
      'warning: logrotate in debug mode does nothing except printing debug messages!  Consider using verbose mode (-v) instead if this is not what you want.',
      '',
    );
  if (bavard)
    sortie.push(
      ...configs.map((c) => `reading config file ${c}`),
      'Reading state from file: /var/lib/logrotate/status',
      '',
      `Handling ${blocs.length} logs`,
      '',
    );
  const etat: Record<string, number> = (jeu.etat.logrotateEtat ??= {});
  const maintenant = systemd(jeu)?.horloge ?? 0;
  const parent = (chemin: string) => jeu.trouver(chemin.replace(/\/[^/]+$/, '')) as { enfants: Record<string, Noeud> };
  const nom = (chemin: string) => chemin.split('/').at(-1)!;
  for (const b of blocs) {
    if (bavard)
      sortie.push(
        `rotating pattern: ${b.motifs.join(' ')}  ${b.periode ? `after 1 ${b.periode.replace('ly', '').replace('dai', 'day')}s` : 'forced from command line'} ${b.siVide ? '' : 'empty log files are not rotated, '}(${b.rotation} rotations), old logs are removed`,
      );
    const fichiers = b.motifs.flatMap((m) => journaux(jeu, m));
    if (!fichiers.length && !b.manquantOk) for (const m of b.motifs) erreurs.push(`error: stat of ${m} failed: No such file or directory`);
    for (const chemin of fichiers) {
      const n = jeu.trouver(chemin) as Fichier;
      if (bavard) sortie.push(`considering log ${chemin}`);
      const dernier = etat[chemin];
      // Un journal jamais vu : logrotate note la date, sans le faire tourner (sauf -f).
      const echeance = b.taille !== null ? taille(n) >= b.taille : dernier !== undefined && maintenant - dernier >= PERIODES[b.periode ?? 'daily'];
      if (dernier === undefined && !debug) etat[chemin] = maintenant;
      if (!force && !echeance) {
        if (bavard) sortie.push(`  log does not need rotating (log has been ${dernier === undefined ? 'already rotated' : 'rotated recently'})`);
        continue;
      }
      if (!b.siVide && taille(n) === 0) {
        if (bavard) sortie.push('  log does not need rotating (log is empty)');
        continue;
      }
      if (bavard) sortie.push(`  log needs rotating`, `rotating log ${chemin}, log->rotateCount is ${b.rotation}`);
      if (debug) {
        sortie.push(
          b.copierTronquer ? `copying ${chemin} to ${chemin}.1` : `renaming ${chemin} to ${chemin}.1`,
          b.copierTronquer ? `truncating ${chemin}` : `creating new ${chemin}`,
        );
        continue;
      }
      const lieu = parent(chemin);
      const nomDe = (k: number, gz: boolean) => `${nom(chemin)}.${k}${gz ? '.gz' : ''}`;
      // Les anciens journaux remontent d'un cran ; le plus vieux disparaît.
      for (let k = b.rotation; k >= 1; k--)
        for (const gz of [true, false]) {
          const e = lieu.enfants[nomDe(k, gz)];
          if (!e) continue;
          delete lieu.enfants[nomDe(k, gz)];
          if (k < b.rotation) lieu.enfants[nomDe(k + 1, gz)] = e;
        }
      if (b.rotation === 0) {
        if (b.copierTronquer) Object.assign(n, { contenu: '', taille: 0 });
        else delete lieu.enfants[nom(chemin)];
      } else if (b.copierTronquer) {
        // Une copie, puis le fichier vidé : le programme continue d'écrire dans le même fichier.
        lieu.enfants[nomDe(1, false)] = { ...n };
        Object.assign(n, { contenu: '', taille: 0 });
      } else {
        // Renommé : le programme qui l'a ouvert écrit toujours dedans, sous son nouveau nom.
        lieu.enfants[nomDe(1, false)] = n;
        for (const o of ouverts(jeu)) if (o.noeud === n) o.chemin = `${chemin}.1`;
        if (b.creer)
          lieu.enfants[nom(chemin)] = {
            type: 'fichier',
            contenu: '',
            lignes: true,
            taille: 0,
            proprio: b.creer.proprio ?? n.proprio,
            groupe: b.creer.groupe ?? n.groupe,
            mode: n.mode,
          };
      }
      etat[chemin] = maintenant;
      if (b.apres.length) {
        if (bavard) sortie.push('running postrotate script');
        const r = executerScript(jeu, b.apres.join('\n'), { cwd: '/', nom: 'postrotate' });
        if (r.sortie) sortie.push(r.sortie);
        if (r.code !== 0) erreurs.push(`error: error running non-shared postrotate script for ${chemin} of '${b.motifs.join(' ')}'`);
      }
      // Puis la compression (après le postrotate, comme logrotate).
      // compress (sans delaycompress, dès .1) : gzip écrit le .gz et efface l'original.
      const aCompresser = b.compresser ? (b.differer ? 2 : 1) : 0;
      if (aCompresser) {
        const e = lieu.enfants[nomDe(aCompresser, false)];
        if (e?.type === 'fichier') {
          lieu.enfants[nomDe(aCompresser, true)] = {
            type: 'fichier',
            contenu: '',
            taille: Math.round(taille(e) / 10),
            proprio: e.proprio,
            groupe: e.groupe,
            mode: e.mode,
          };
          delete lieu.enfants[nomDe(aCompresser, false)];
          if (bavard) sortie.push(`compressing log with: /bin/gzip`);
        }
      }
    }
  }
  jeu.etat.logrotateTours = (jeu.etat.logrotateTours ?? 0) + (debug ? 0 : 1);
  if (erreurs.length) jeu.erreur(erreurs.join('\n'));
  return bavard ? sortie.join('\n') : '';
}

export const JOURNAUX: Record<string, Commande> = {
  lsof: { section: 8, propresOptions: true, lancer: ({ args, jeu }) => lsof(jeu, args) },
  truncate: { propresOptions: true, lancer: ({ args, jeu }) => tronquer(jeu, args) },
  logrotate: { section: 8, propresOptions: true, lancer: ({ args, jeu }) => logrotate(jeu, args) },
};
