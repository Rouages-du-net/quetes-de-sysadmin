// sftp : transférer des fichiers par SSH, de façon interactive (sftp> ),
// comme le client d'OpenSSH. Les sauts, les clés d'hôte et
// l'authentification passent par ../acces.ts, comme ssh et scp.
// Sources : https://man.openbsd.org/sftp
// Écarts : les commandes courantes seulement (ls, cd, pwd, lcd, lls, lpwd,
// get, put, mkdir, rm, rmdir, rename, help, bye) ; pas de -b (fichier de
// commandes), de reget/reput ni de jokers.

import type { Shell } from '../shell';
import { franchir, preparer } from '../access';
import { copier } from './transfers';
import type { Commande } from './index';

interface SessionSftp {
  distant: Shell;
  utilisateur: string;
  cwdDistant: string;
  cwdLocal: string;
}

// Agir sur la machine d'en face, sous le compte de la connexion, dans le dossier distant.
function enFace<T>(s: SessionSftp, faire: (d: Shell) => T): T {
  const d = s.distant;
  const [qui, cwd] = [d.qui, d.cwd];
  d.qui = s.utilisateur;
  d.cwd = s.cwdDistant;
  try {
    return faire(d);
  } finally {
    d.qui = qui;
    d.cwd = cwd;
  }
}

function chezSoi<T>(jeu: Shell, s: SessionSftp, faire: () => T): T {
  const cwd = jeu.cwd;
  jeu.cwd = s.cwdLocal;
  try {
    return faire();
  } finally {
    jeu.cwd = cwd;
  }
}

/** Une commande sftp ; renvoie ce qu'elle affiche, ou null pour quitter. */
function commandeSftp(jeu: Shell, s: SessionSftp, ligne: string): string | null {
  const [cmd, ...args] = ligne.trim().split(/\s+/);
  if (!cmd) return '';
  const options = args.filter((a) => a.startsWith('-'));
  const [a, b] = args.filter((x) => !x.startsWith('-'));
  const recursif = options.some((o) => o.includes('r') || o.includes('R'));
  switch (cmd) {
    case 'bye':
    case 'exit':
    case 'quit':
      return null;
    case 'pwd':
      return `Remote working directory: ${s.cwdDistant}`;
    case 'lpwd':
      return `Local working directory: ${s.cwdLocal}`;
    case 'cd': {
      const cible = enFace(s, (d) => d.resoudre(a ?? '~'));
      const n = enFace(s, (d) => d.trouver(cible));
      if (!n) return jeu.erreur(`stat remote: No such file or directory`, 1);
      if (n.type !== 'dossier') return jeu.erreur(`Can't change directory: "${cible}" is not a directory`, 1);
      if (!enFace(s, (d) => d.traverse(cible) && d.peut(n, 'x'))) return jeu.erreur(`remote open("${cible}"): Permission denied`, 1);
      s.cwdDistant = cible;
      return '';
    }
    case 'lcd': {
      const cible = chezSoi(jeu, s, () => jeu.resoudre(a ?? '~'));
      if (jeu.trouver(cible)?.type !== 'dossier') return jeu.erreur(`Couldn't change local directory to "${cible}": No such file or directory`, 1);
      s.cwdLocal = cible;
      return '';
    }
    case 'ls':
    case 'dir':
      return enFace(s, (d) => {
        const r = d.sousCommande(['ls', ...args].join(' '), s.cwdDistant);
        return r.sortie;
      });
    case 'lls':
      return jeu.sousCommande(['ls', ...args].join(' '), s.cwdLocal).sortie;
    case 'get':
    case 'put': {
      if (!a) return jeu.erreur(`You must specify at least one path after a ${cmd} command.`, 1);
      const erreurs: string[] = [];
      const versDistant = cmd === 'put';
      const source = versDistant ? chezSoi(jeu, s, () => jeu.resoudre(a)) : enFace(s, (d) => d.resoudre(a));
      const nom = source.split('/').at(-1)!;
      const n = versDistant ? jeu.trouver(source) : enFace(s, (d) => d.trouver(source));
      if (!n) return jeu.erreur(versDistant ? `stat ${source}: No such file or directory` : `File "${source}" not found.`, 1);
      if (n.type === 'dossier' && !recursif)
        return jeu.erreur(versDistant ? `Skipping non-regular file ${source}` : `Cannot download non-regular file: ${source}`, 1);
      const dest = versDistant ? enFace(s, (d) => d.resoudre(b ?? nom)) : chezSoi(jeu, s, () => jeu.resoudre(b ?? nom));
      const lignes = versDistant
        ? [`Uploading ${source}${n.type === 'dossier' ? '/' : ''} to ${dest}`, ...(n.type === 'dossier' ? [`Entering ${source}/`] : [])]
        : [`Fetching ${source}${n.type === 'dossier' ? '/' : ''} to ${b ?? nom}`, ...(n.type === 'dossier' ? [`Retrieving ${source}`] : [])];
      // Comme sftp : un dossier qui existe déjà de l'autre côté reçoit le contenu (scp, lui, emboîterait).
      const cote = versDistant ? enFace(s, (d) => d.trouver(dest)) : chezSoi(jeu, s, () => jeu.trouver(dest));
      const enfants =
        n.type === 'dossier' && cote?.type === 'dossier' ? Object.keys(n.enfants).map((k) => [`${source}/${k}`, dest]) : [[source, dest]];
      const copie = enfants.flatMap(([de, vers]) =>
        versDistant
          ? chezSoi(jeu, s, () => enFace(s, (d) => copier(jeu, d, de, vers, recursif, erreurs)))
          : chezSoi(jeu, s, () => enFace(s, (d) => copier(d, jeu, de, vers, recursif, erreurs))),
      );
      erreurs.forEach((e) => jeu.erreur(e.replace(/^scp: /, ''), 1));
      return [...lignes, ...copie].join('\n');
    }
    case 'mkdir':
      return enFace(s, (d) => {
        if (!a) return jeu.erreur('You must specify a path after a mkdir command.', 1);
        const chemin = d.resoudre(a);
        if (d.trouver(chemin)) return jeu.erreur(`remote mkdir "${chemin}": Failure`, 1);
        const e = d.placer('mkdir', chemin, { type: 'dossier', enfants: {}, proprio: s.utilisateur });
        return e ? jeu.erreur(`remote mkdir "${chemin}": Permission denied`, 1) : '';
      });
    case 'rm':
    case 'rmdir':
      return enFace(s, (d) => {
        if (!a) return jeu.erreur(`You must specify a path after a ${cmd} command.`, 1);
        const chemin = d.resoudre(a);
        const n = d.trouver(chemin);
        if (!n) return jeu.erreur(`${cmd === 'rm' ? 'Remove' : 'Delete directory'} ${chemin}: No such file or directory`, 1);
        if (cmd === 'rm' && n.type === 'dossier') return jeu.erreur(`Remove ${chemin}: Failure`, 1);
        if (cmd === 'rmdir' && (n.type !== 'dossier' || Object.keys(n.enfants).length)) return jeu.erreur(`Delete directory ${chemin}: Failure`, 1);
        const parent = d.trouver(chemin.split('/').slice(0, -1).join('/') || '/');
        if (!parent || !d.peut(parent, 'w')) return jeu.erreur(`${cmd === 'rm' ? 'Remove' : 'Delete directory'} ${chemin}: Permission denied`, 1);
        d.effacer(chemin);
        return cmd === 'rm' ? `Removing ${chemin}` : '';
      });
    case 'rename':
      return enFace(s, (d) => {
        if (!a || !b) return jeu.erreur('You must specify two paths after a rename command.', 1);
        const r = d.sousCommande(`mv ${a} ${b}`, s.cwdDistant);
        return r.ok ? '' : jeu.erreur(`rename ${d.resoudre(a)}: Failure`, 1);
      });
    case 'help':
    case '?':
      return jeu.t('sftp-aide');
    default:
      return jeu.erreur('Invalid command.', 1);
  }
}

function boucle(jeu: Shell, s: SessionSftp) {
  const qui = jeu.qui;
  jeu.demander('sftp> ', (ligne) => {
    const avant = jeu.qui;
    jeu.qui = qui;
    try {
      const sortie = commandeSftp(jeu, s, ligne);
      if (sortie !== null) boucle(jeu, s);
      return [...jeu.recupererErreurs(), sortie ?? ''].filter(Boolean).join('\n');
    } finally {
      jeu.qui = avant;
    }
  });
}

function sftp(jeu: Shell, args: string[]): string {
  let port: string | undefined;
  let saut: string | undefined;
  const identites: string[] = [];
  const reste: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-P' || a === '-J' || a === '-i') {
      const v = args[++i];
      if (v === undefined) return jeu.erreur(`sftp: option requires an argument -- ${a.slice(1)}`, 1);
      if (a === '-P') port = v;
      else if (a === '-J') saut = v;
      else identites.push(v);
    } else if (/^-[rpqC]+$/.test(a)) continue;
    else if (a.startsWith('-')) return jeu.erreur(`sftp: unknown option -- ${a.slice(1)}\n${jeu.t('sftp-usage')}`, 1);
    else reste.push(a);
  }
  if (reste.length !== 1) return jeu.erreur(jeu.t('sftp-usage'), 1);
  const [cible, chemin] = reste[0].includes(':')
    ? [reste[0].slice(0, reste[0].indexOf(':')), reste[0].slice(reste[0].indexOf(':') + 1)]
    : [reste[0], ''];
  const sauts = preparer(jeu, cible, { identites, port, saut, programme: 'ssh' });
  if (typeof sauts === 'string') return jeu.erreur(`${sauts}\nConnection closed`, 255);
  const d = sauts.at(-1)!;
  return franchir(jeu, sauts, () => {
    const maison = d.utilisateur === 'root' ? '/root' : (d.shell.comptes.utilisateurs[d.utilisateur]?.maison ?? `/home/${d.utilisateur}`);
    const s: SessionSftp = { distant: d.shell, utilisateur: d.utilisateur, cwdDistant: maison, cwdLocal: jeu.cwd };
    if (chemin) {
      const r = commandeSftp(jeu, s, `cd ${chemin}`);
      if (r === null) return '';
    }
    boucle(jeu, s);
    return `Connected to ${cible.split('@').at(-1)}.`;
  });
}

export const SFTP: Record<string, Commande> = { sftp: { propresOptions: true, lancer: ({ args, jeu }) => sftp(jeu, args) } };
