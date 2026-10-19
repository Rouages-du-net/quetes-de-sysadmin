// lftp, le client FTP (et FTPS) en ligne de commande, vers un hébergement
// mutualisé simulé (../hebergeur.ts). Une session interactive (lftp> ), ou
// des commandes données par -c et -e. Sorties en anglais, comme lftp 4.9.
// Par défaut, lftp chiffre (ftp:ssl-allow yes : AUTH TLS) et vérifie le
// certificat (ssl:verify-certificate yes) : le nom demandé doit être celui
// du certificat.
// Sources : https://lftp.yar.ru/lftp-man.html
// Écarts : FTP seulement (pas de SFTP ni de HTTP par lftp), pas de
// ~/.lftprc ni de ~/.netrc, pas de transferts en arrière-plan ni de
// file d'attente ; la connexion se fait à la première commande distante.

import type { Dossier, Fichier, Noeud } from '../monde';
import type { Shell } from '../shell';
import { contenu } from '../outils';
import { couvre, definition, fichiersDe, hebergement, noeud, normaliser, type DefHebergement } from '../hebergeur';
import type { Commande } from './index';

interface Session {
  hote: string | null;
  utilisateur: string | null;
  motDePasse: string | null;
  connecte: boolean;
  distant: string;
  local: string;
  reglages: Record<string, string>;
  // La connexion en cours : chiffrée, certificat vérifié.
  tls: boolean;
  verifie: boolean;
}

const VRAI = (v: string | undefined) => /^(yes|on|true|1)$/i.test(v ?? '');

// Les arguments d'une ligne lftp (guillemets simples ou doubles).
const mots = (ligne: string) => (ligne.match(/"[^"]*"|'[^']*'|\S+/g) ?? []).map((m) => m.replace(/^(['"])(.*)\1$/, '$2'));

// Les commandes séparées par « ; » (dans -c et -e).
const commandes = (texte: string) =>
  texte
    .split(';')
    .map((c) => c.trim())
    .filter(Boolean);

/** Se connecter (à la première commande distante) : le nom, TLS, le certificat, le compte. Renvoie l'erreur, ou null. */
function connecter(jeu: Shell, s: Session, commande: string): string | null {
  if (s.connecte) return null;
  if (!s.hote) return `${commande}: Not connected`;
  const d = definition(s.hote);
  if (!d) return `${commande}: ${s.hote}: Name or service not known`;
  const [cle, def] = d;
  const tls = s.reglages['ftp:ssl-allow'] !== 'no';
  const verifie = s.reglages['ssl:verify-certificate'] !== 'no';
  const refus = (quoi: string) => ((jeu.etat.refusFtp ??= []) as string[]).push(quoi);
  if (!tls) {
    refus('clair');
    return `${commande}: Login failed: 421 Sorry, cleartext sessions and weak ciphers are not accepted on this server.\nPlease reconnect using TLS security mechanisms.`;
  }
  if (verifie && !couvre(def.certificat, s.hote)) {
    refus('certificat');
    return `${commande}: Fatal error: Certificate verification: certificate common name doesn't match requested host name \u2018${s.hote}\u2019`;
  }
  if (!s.utilisateur || def.comptes[s.utilisateur] !== s.motDePasse) return `${commande}: Login failed: 530 Login authentication failed`;
  s.connecte = true;
  s.tls = tls;
  s.verifie = verifie;
  hebergement(jeu, cle).journal.push({ compte: s.utilisateur, tls, verifie, envoi: false });
  return null;
}

const racineDe = (jeu: Shell, s: Session): Dossier => {
  const [cle] = definition(s.hote!)!;
  return hebergement(jeu, cle).racines[s.utilisateur!];
};

const date = 'Nov 08 08:15';
function ligneLs(nom: string, n: Noeud, compte: string): string {
  const taille = n.type === 'dossier' ? 4096 : typeof n.contenu === 'string' ? n.contenu.length : 0;
  return `${n.type === 'dossier' ? 'drwxr-xr-x' : '-rw-r--r--'}   ${n.type === 'dossier' ? 2 : 1} ${compte.padEnd(8)} ${compte.padEnd(8)} ${String(taille).padStart(8)} ${date} ${nom}`;
}

// Copier un dossier (et ses fichiers) d'un côté à l'autre : mirror.
interface Bilan {
  dossiers: number;
  nouveaux: number;
  modifies: number;
  supprimes: number;
  octets: number;
  lignes: string[];
}

function mirror(jeu: Shell, s: Session, args: string[]): string {
  const inverse = args.some((a) => a === '-R' || a === '--reverse');
  const effacer = args.includes('--delete') || args.includes('-e');
  const essai = args.includes('--dry-run');
  const bavard = args.some((a) => /^-v+$/.test(a) || a === '--verbose');
  const inconnue = args.find(
    (a) => a.startsWith('-') && !['-R', '--reverse', '--delete', '-e', '--dry-run', '--verbose'].includes(a) && !/^-v+$/.test(a),
  );
  if (inconnue) return jeu.erreur(`mirror: invalid option -- '${inconnue.replace(/^-+/, '')}'\nTry ` + "`help mirror'" + ' for more information.', 1);
  const [source, cible] = args.filter((a) => !a.startsWith('-'));
  const e = connecter(jeu, s, 'mirror');
  if (e) return jeu.erreur(e, 1);
  const racine = racineDe(jeu, s);
  const bilan: Bilan = { dossiers: 0, nouveaux: 0, modifies: 0, supprimes: 0, octets: 0, lignes: [] };
  if (inverse) {
    // Local → distant.
    const src = jeu.resoudre(source ? (source.startsWith('/') ? source : `${s.local}/${source}`) : s.local);
    const n = jeu.trouver(src);
    if (n?.type !== 'dossier') return jeu.erreur(`mirror: ${source ?? src}: No such file or directory`, 1);
    const dest = normaliser(s.distant, cible ?? src.split('/').at(-1)!);
    parcourirLocal(
      jeu,
      n,
      '',
      (rel, f) => {
        const texte = contenu(f, jeu);
        const avant = noeud(racine, `${dest}/${rel}`);
        if (avant?.type === 'fichier' && avant.contenu === texte) return;
        if (avant) bilan.modifies++;
        else bilan.nouveaux++;
        bilan.octets += texte.length;
        const dossier = rel.includes('/') ? `${dest}/${rel.split('/').slice(0, -1).join('/')}` : dest;
        bilan.lignes.push(essai ? `put -O ${dossier} ${src}/${rel}` : `Transferring file \`${rel}'`);
        if (!essai) dossierDistant(racine, dossier).enfants[rel.split('/').at(-1)!] = { type: 'fichier', contenu: texte, lignes: true };
      },
      (rel) => {
        bilan.dossiers++;
        if (!essai) dossierDistant(racine, rel ? `${dest}/${rel}` : dest);
      },
    );
    if (effacer) {
      const restants = fichiersDe(racine, dest) ?? {};
      for (const rel of Object.keys(restants)) {
        if (jeu.trouver(`${src}/${rel}`)) continue;
        bilan.supprimes++;
        bilan.lignes.push(essai ? `rm ${dest}/${rel}` : `Removing old file \`${rel}'`);
        if (!essai) supprimer(racine, `${dest}/${rel}`);
      }
    }
    if (!essai) {
      const [cle] = definition(s.hote!)!;
      const journal = hebergement(jeu, cle).journal;
      journal.push({ compte: s.utilisateur!, tls: s.tls, verifie: s.verifie, envoi: true });
    }
  } else {
    // Distant → local.
    const src = normaliser(s.distant, source ?? '.');
    const n = noeud(racine, src);
    if (n?.type !== 'dossier') return jeu.erreur(`mirror: Access failed: 550 Can't change directory to ${src}: No such file or directory`, 1);
    const dest = jeu.resoudre(cible ? (cible.startsWith('/') ? cible : `${s.local}/${cible}`) : `${s.local}/${src.split('/').at(-1) || 'ftp'}`);
    for (const [rel, texte] of Object.entries(fichiersDe(racine, src) ?? {})) {
      const chemin = `${dest}/${rel}`;
      const avant = jeu.trouver(chemin);
      if (avant?.type === 'fichier' && contenu(avant, jeu) === texte) continue;
      if (avant) bilan.modifies++;
      else bilan.nouveaux++;
      bilan.octets += texte.length;
      bilan.lignes.push(essai ? `get -O ${dest} ${src}/${rel}` : `Transferring file \`${rel}'`);
      if (essai) continue;
      const parties = rel.split('/');
      for (let k = 1; k < parties.length; k++) {
        const dossier = `${dest}/${parties.slice(0, k).join('/')}`;
        if (!jeu.trouver(dossier)) jeu.placer('mirror', dossier, { type: 'dossier', enfants: {}, proprio: jeu.qui });
      }
      if (!jeu.trouver(dest)) jeu.placer('mirror', dest, { type: 'dossier', enfants: {}, proprio: jeu.qui });
      if (avant?.type === 'fichier') Object.assign(avant, { contenu: texte, lignes: true });
      else jeu.placer('mirror', chemin, { type: 'fichier', contenu: texte, lignes: true, proprio: jeu.qui });
    }
  }
  const pluriel = (n: number, mot: string) => `${n} ${mot}${n === 1 ? '' : 's'}`;
  const resume = [
    `Total: ${pluriel(bilan.dossiers || 1, 'director' + (bilan.dossiers === 1 ? 'y' : 'ie'))}, ${pluriel(bilan.nouveaux + bilan.modifies, 'file')}, 0 symlinks`,
    ...(bilan.nouveaux ? [`New: ${pluriel(bilan.nouveaux, 'file')}, 0 symlinks`] : []),
    ...(bilan.modifies ? [`Modified: ${pluriel(bilan.modifies, 'file')}, 0 symlinks`] : []),
    ...(bilan.supprimes ? [`Removed: ${pluriel(bilan.supprimes, 'file')}, 0 directories, 0 symlinks`] : []),
    ...(bilan.octets ? [`${bilan.octets} bytes transferred`] : []),
  ];
  return [...(bavard || essai ? bilan.lignes : []), ...(essai ? [] : resume)]
    .join('\n')
    .replace('1 directorys', '1 directory')
    .replace(/(\d+) directoryies/, '$1 directories');
}

function parcourirLocal(jeu: Shell, n: Noeud, rel: string, fichier: (rel: string, f: Fichier) => void, dossier: (rel: string) => void) {
  if (n.type === 'fichier') return fichier(rel, n);
  dossier(rel);
  for (const [k, e] of Object.entries(n.enfants)) parcourirLocal(jeu, e, rel ? `${rel}/${k}` : k, fichier, dossier);
}

// Le dossier distant (créé, avec ses parents, s'il n'existe pas).
function dossierDistant(racine: Dossier, chemin: string): Dossier {
  let d = racine;
  for (const p of chemin.split('/').filter(Boolean)) {
    if (d.enfants[p]?.type !== 'dossier') d.enfants[p] = { type: 'dossier', enfants: {} };
    d = d.enfants[p] as Dossier;
  }
  return d;
}

function supprimer(racine: Dossier, chemin: string) {
  const parties = chemin.split('/').filter(Boolean);
  const parent = noeud(racine, '/' + parties.slice(0, -1).join('/'));
  if (parent?.type === 'dossier') delete parent.enfants[parties.at(-1)!];
}

/** Une commande lftp ; renvoie ce qu'elle affiche, ou null pour quitter. */
function commandeLftp(jeu: Shell, s: Session, ligne: string): string | null {
  const [cmd, ...args] = mots(ligne);
  if (!cmd) return '';
  if (['bye', 'exit', 'quit'].includes(cmd)) return null;
  if (cmd === 'set') {
    const [nom, valeur] = args;
    if (!nom)
      return Object.entries(s.reglages)
        .map(([k, v]) => `set ${k} ${v}`)
        .join('\n');
    if (!/^(ftp|ssl|net|mirror|cmd):[\w-]+$/.test(nom)) return jeu.erreur(`set: no such variable \`${nom}'`, 1);
    s.reglages[nom] = VRAI(valeur) ? 'yes' : /^(no|off|false|0)$/i.test(valeur ?? '') ? 'no' : (valeur ?? '');
    // Un nouveau réglage s'applique à la prochaine connexion.
    s.connecte = false;
    return '';
  }
  if (cmd === 'open') {
    const k = args.indexOf('-u');
    if (k >= 0) {
      const [u, p] = (args[k + 1] ?? '').split(',');
      s.utilisateur = u;
      s.motDePasse = p ?? s.motDePasse;
    }
    s.hote = args.filter((a, i) => !a.startsWith('-') && args[i - 1] !== '-u').at(-1) ?? s.hote;
    s.connecte = false;
    s.distant = '/';
    return '';
  }
  if (cmd === 'user') {
    s.utilisateur = args[0] ?? null;
    s.motDePasse = args[1] ?? null;
    s.connecte = false;
    return '';
  }
  if (cmd === 'lcd') {
    const dest = jeu.resoudre(args[0] ? (args[0].startsWith('/') || args[0].startsWith('~') ? args[0] : `${s.local}/${args[0]}`) : '~');
    if (jeu.trouver(dest)?.type !== 'dossier') return jeu.erreur(`lcd: ${dest}: No such file or directory`, 1);
    s.local = dest;
    return `lcd ok, local cwd=${dest}`;
  }
  if (cmd === 'lpwd') return s.local;
  if (cmd === 'help') return jeu.t('lftp-aide');
  if (cmd === 'mirror') return mirror(jeu, s, args);
  // Les commandes distantes : la connexion d'abord.
  if (!['ls', 'dir', 'cd', 'pwd', 'mkdir', 'rm', 'get', 'put', 'cat'].includes(cmd)) return jeu.erreur(`Unknown command \`${cmd}'.`, 1);
  if (cmd === 'pwd') return `ftp://${s.utilisateur ? `${s.utilisateur}@` : ''}${s.hote ?? ''}${s.distant === '/' ? '' : s.distant}`;
  const e = connecter(jeu, s, cmd);
  if (e) return jeu.erreur(e, 1);
  const racine = racineDe(jeu, s);
  if (cmd === 'ls' || cmd === 'dir') {
    const chemin = normaliser(s.distant, args.find((a) => !a.startsWith('-')) ?? '.');
    const n = noeud(racine, chemin);
    if (!n) return jeu.erreur(`ls: Access failed: 550 ${chemin}: No such file or directory`, 1);
    if (n.type === 'fichier') return ligneLs(chemin.split('/').at(-1)!, n, s.utilisateur!);
    return Object.entries(n.enfants)
      .map(([k, x]) => ligneLs(k, x, s.utilisateur!))
      .join('\n');
  }
  if (cmd === 'cd') {
    const chemin = normaliser(s.distant, args[0] ?? '~');
    if (noeud(racine, chemin)?.type !== 'dossier')
      return jeu.erreur(`cd: Access failed: 550 Can't change directory to ${args[0]}: No such file or directory`, 1);
    s.distant = chemin;
    return `cd ok, cwd=${chemin === '/' ? '~' : `~${chemin}`}`;
  }
  if (cmd === 'cat') {
    const n = noeud(racine, normaliser(s.distant, args[0] ?? ''));
    if (n?.type !== 'fichier') return jeu.erreur(`cat: Access failed: 550 ${args[0]}: No such file or directory`, 1);
    return typeof n.contenu === 'string' ? n.contenu : '';
  }
  if (cmd === 'mkdir') {
    const chemin = normaliser(s.distant, args.find((a) => !a.startsWith('-')) ?? '');
    const parent = noeud(racine, chemin.split('/').slice(0, -1).join('/') || '/');
    if (parent?.type !== 'dossier') return jeu.erreur(`mkdir: Access failed: 550 ${chemin}: No such file or directory`, 1);
    parent.enfants[chemin.split('/').at(-1)!] ??= { type: 'dossier', enfants: {} };
    return 'mkdir ok, `' + chemin.split('/').at(-1) + "' created";
  }
  if (cmd === 'rm') {
    const chemin = normaliser(s.distant, args.find((a) => !a.startsWith('-')) ?? '');
    const n = noeud(racine, chemin);
    if (!n || (n.type === 'dossier' && !args.includes('-r'))) return jeu.erreur(`rm: Access failed: 550 ${chemin}: No such file or directory`, 1);
    supprimer(racine, chemin);
    return `rm ok, \`${chemin.split('/').at(-1)}' removed`;
  }
  if (cmd === 'put') {
    const local = jeu.resoudre(args[0]?.startsWith('/') ? args[0] : `${s.local}/${args[0] ?? ''}`);
    const n = jeu.trouver(local);
    if (n?.type !== 'fichier') return jeu.erreur(`put: ${local}: No such file or directory`, 1);
    const nom = local.split('/').at(-1)!;
    const dossier = noeud(racine, s.distant) as Dossier;
    dossier.enfants[nom] = { type: 'fichier', contenu: contenu(n, jeu), lignes: true };
    return `${contenu(n, jeu).length} bytes transferred`;
  }
  // get
  const n = noeud(racine, normaliser(s.distant, args[0] ?? ''));
  if (n?.type !== 'fichier') return jeu.erreur(`get: Access failed: 550 ${args[0]}: No such file or directory`, 1);
  const nom = (args[0] ?? '').split('/').at(-1)!;
  const texte = typeof n.contenu === 'string' ? n.contenu : '';
  const err = jeu.placer('get', `${s.local}/${nom}`, { type: 'fichier', contenu: texte, lignes: true, proprio: jeu.qui });
  if (err) return jeu.erreur(`get: ${s.local}/${nom}: Permission denied`, 1);
  return `${texte.length} bytes transferred`;
}

const invite = (s: Session) => `lftp ${s.utilisateur ? `${s.utilisateur}@` : ''}${s.hote ?? ''}:${s.distant === '/' ? '~' : `~${s.distant}`}> `;

// La session interactive : une question par commande, jusqu'à bye.
function interactive(jeu: Shell, s: Session) {
  const qui = jeu.qui;
  jeu.demander(invite(s), (ligne) => {
    const avant = jeu.qui;
    jeu.qui = qui;
    try {
      const sortie = commandeLftp(jeu, s, ligne);
      if (sortie !== null) interactive(jeu, s);
      return [...jeu.recupererErreurs(), sortie ?? ''].filter(Boolean).join('\n');
    } finally {
      jeu.qui = avant;
    }
  });
}

function lftp(jeu: Shell, args: string[]): string {
  const s: Session = {
    hote: null,
    utilisateur: null,
    motDePasse: null,
    connecte: false,
    distant: '/',
    local: jeu.cwd,
    reglages: {},
    tls: false,
    verifie: false,
  };
  let c: string | null = null;
  let e: string | null = null;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-u') {
      const [u, p] = (args[++i] ?? '').split(',');
      s.utilisateur = u;
      s.motDePasse = p ?? null;
    } else if (a === '-c') c = args[++i] ?? '';
    else if (a === '-e') e = args[++i] ?? '';
    else if (a === '-p') i++;
    else if (a === '-v' || a === '--version') return 'LFTP | Version 4.9.2 | Copyright (c) 1996-2020 Alexander V. Lukyanov';
    else if (a.startsWith('-')) return jeu.erreur(`lftp: invalid option -- '${a.replace(/^-+/, '')}'\nTry \`lftp --help' for more information`, 1);
    else {
      const url = /^ftps?:\/\/(?:([^@:/]+)(?::([^@/]*))?@)?([^/:]+)/.exec(a);
      if (url) {
        s.utilisateur = url[1] ?? s.utilisateur;
        s.motDePasse = url[2] ?? s.motDePasse;
        s.hote = url[3];
      } else s.hote = a;
    }
  }
  const lancer = (): string => {
    if (c !== null) {
      const sorties: string[] = [];
      for (const ligne of commandes(c)) {
        const r = commandeLftp(jeu, s, ligne);
        if (r === null) break;
        if (r) sorties.push(r);
      }
      return sorties.join('\n');
    }
    const sorties: string[] = [];
    let fini = false;
    for (const ligne of commandes(e ?? '')) {
      const r = commandeLftp(jeu, s, ligne);
      if (r === null) {
        fini = true;
        break;
      }
      if (r) sorties.push(r);
    }
    if (!fini) interactive(jeu, s);
    return sorties.join('\n');
  };
  // -u compte sans mot de passe : lftp le demande tout de suite.
  if (s.utilisateur && s.motDePasse === null) {
    const qui = jeu.qui;
    jeu.demander(
      'Password: ',
      (mdp) => {
        const avant = jeu.qui;
        jeu.qui = qui;
        try {
          s.motDePasse = mdp;
          const sortie = lancer();
          return [...jeu.recupererErreurs(), sortie].filter(Boolean).join('\n');
        } finally {
          jeu.qui = avant;
        }
      },
      true,
    );
    return '';
  }
  return lancer();
}

export type { DefHebergement };
export const LFTP: Record<string, Commande> = { lftp: { propresOptions: true, lancer: ({ args, jeu }) => lftp(jeu, args) } };
