// Copier vers une autre machine : ssh-copy-id (installer sa clé publique
// dans ~/.ssh/authorized_keys d'en face) et scp (copier des fichiers par
// ssh). D'après https://man.openbsd.org/scp et ssh-copy-id(1) (paquet
// openssh-client de Debian). Les sauts, les clés d'hôte et
// l'authentification passent par ../acces.ts.
// Écarts : scp copie entre la machine où l'on est et une seule autre ; pas
// d'options de vitesse ni de compression ; la barre de progression est
// immédiate.

import type { Dossier, Fichier, Noeud } from '../monde';
import type { Shell } from '../shell';
import { franchir, preparer, publiqueDe } from '../acces';
import { contenu, lisible, tailleDe } from '../outils';
import type { Commande } from './index';

const NOM_SSH_COPY_ID = '/usr/bin/ssh-copy-id';

// La clé publique à installer : -i (avec ou sans .pub), sinon la plus récente de ~/.ssh/id_*.pub.
function clePubliqueChoisie(jeu: Shell, donnee?: string): string | null {
  if (donnee) return donnee.endsWith('.pub') ? donnee : `${donnee}.pub`;
  const ssh = jeu.trouver('~/.ssh');
  if (ssh?.type !== 'dossier') return null;
  const pub = Object.keys(ssh.enfants).filter((n) => /^id_.*\.pub$/.test(n));
  return pub.includes('id_ed25519.pub') ? '~/.ssh/id_ed25519.pub' : pub.length ? `~/.ssh/${pub[0]}` : null;
}

function sshCopyId(jeu: Shell, args: string[]): string {
  const valeur = (o: string) => (args.includes(o) ? args[args.indexOf(o) + 1] : undefined);
  const cible = args.filter((a, i) => !a.startsWith('-') && !['-i', '-p', '-J'].includes(args[i - 1])).at(-1);
  if (!cible)
    return jeu.erreur(
      'Usage: /usr/bin/ssh-copy-id [-h|-?|-f|-n|-s|-x] [-i [identity_file]] [-p port] [-F alternative ssh_config file] [-t target_path] [[-o <ssh -o options>] ...] [user@]hostname',
    );
  const fichier = clePubliqueChoisie(jeu, valeur('-i'));
  const texte = fichier ? jeu.lire(fichier) : null;
  if (!fichier || !texte) return jeu.erreur(`${NOM_SSH_COPY_ID}: ERROR: No identities found`);
  const sauts = preparer(jeu, cible, { port: valeur('-p'), saut: valeur('-J') });
  if (typeof sauts === 'string') return jeu.erreur(sauts);
  const d = sauts.at(-1)!;
  const cle = texte.trim();
  const debut = [
    `${NOM_SSH_COPY_ID}: INFO: Source of key(s) to be installed: "${jeu.resoudre(fichier)}"`,
    `${NOM_SSH_COPY_ID}: INFO: attempting to log in with the new key(s), to filter out any that are already installed`,
  ];
  const maison = d.utilisateur === 'root' ? '/root' : (d.shell.comptes.utilisateurs[d.utilisateur]?.maison ?? `/home/${d.utilisateur}`);
  const autorisees = (d.shell.lire(`${maison}/.ssh/authorized_keys`) ?? '').split('\n').map((l) => l.split(/\s+/).slice(0, 2).join(' '));
  if (autorisees.includes(cle.split(/\s+/).slice(0, 2).join(' ')))
    return [
      ...debut,
      '',
      `${NOM_SSH_COPY_ID}: WARNING: All keys were skipped because they already exist on the remote system.`,
      '\t\t(if you think this is a mistake, you may want to use -f option)',
      '',
    ].join('\n');
  debut.push(`${NOM_SSH_COPY_ID}: INFO: 1 key(s) remain to be installed -- if you are prompted now it is to install the new keys`);
  const sortie = franchir(jeu, sauts, () => {
    // Comme le script : mkdir -p ~/.ssh (700), puis la clé ajoutée à authorized_keys (600), au nom du compte d'en face.
    const s = d.shell;
    const avant = s.qui;
    s.qui = d.utilisateur;
    try {
      if (!s.existe(`${maison}/.ssh`))
        s.placer('mkdir', `${maison}/.ssh`, { type: 'dossier', enfants: {}, proprio: d.utilisateur, mode: 'rwx------' });
      const n = s.trouver(`${maison}/.ssh/authorized_keys`);
      if (n?.type === 'fichier') n.contenu = [s.lire(`${maison}/.ssh/authorized_keys`), cle].filter(Boolean).join('\n');
      else
        s.placer('ssh-copy-id', `${maison}/.ssh/authorized_keys`, {
          type: 'fichier',
          contenu: cle,
          lignes: true,
          proprio: d.utilisateur,
          mode: 'rw-------',
        });
    } finally {
      s.qui = avant;
    }
    return [
      '',
      'Number of key(s) added: 1',
      '',
      `Now try logging into the machine, with:   "ssh '${d.utilisateur}@${d.hote}'"`,
      'and check to make sure that only the key(s) you wanted were added.',
      '',
    ].join('\n');
  });
  return [...debut, sortie].filter((l) => l !== undefined).join('\n');
}

// « [compte@]machine:chemin » (un chemin local peut contenir « : » s'il commence par / ou ./).
const distant = (texte: string) =>
  /^[^/.][^/]*:/.test(texte) ? { cible: texte.slice(0, texte.indexOf(':')), chemin: texte.slice(texte.indexOf(':') + 1) } : null;

/** Copier `chemin` de la machine `src` vers `dest` sur `dst` (récursif avec -r) ; renvoie les lignes de scp. */
function copier(src: Shell, dst: Shell, chemin: string, dest: string, recursif: boolean, erreurs: string[]): string[] {
  const n = src.trouver(chemin);
  const absolu = src.resoudre(chemin);
  if (!n) {
    erreurs.push(`scp: ${absolu}: No such file or directory`);
    return [];
  }
  if (n.type === 'dossier' && !recursif) {
    erreurs.push(`scp: ${absolu}: not a regular file`);
    return [];
  }
  const nom = absolu.split('/').at(-1)!;
  const cibleExiste = dst.trouver(dest);
  const destination = cibleExiste?.type === 'dossier' ? `${dst.resoudre(dest)}/${nom}` : dst.resoudre(dest);
  const lignes: string[] = [];
  const poser = (source: Noeud, vers: string) => {
    if (source.type === 'dossier') {
      if (!src.peut(source, 'r') || !src.peut(source, 'x')) return void erreurs.push(`scp: ${vers}: Permission denied`);
      if (dst.trouver(vers)?.type !== 'dossier') {
        const e = dst.placer('scp', vers, { type: 'dossier', enfants: {}, proprio: dst.qui });
        if (e) return void erreurs.push(`scp: ${vers}: Permission denied`);
      }
      for (const [k, e] of Object.entries((source as Dossier).enfants)) poser(e, `${vers}/${k}`);
      return;
    }
    const f = source as Fichier;
    if (!src.peut(f, 'r')) return void erreurs.push(`scp: ${src.resoudre(chemin)}: Permission denied`);
    const copie: Fichier = {
      type: 'fichier',
      contenu: contenu(f, src),
      lignes: f.lignes,
      prose: f.prose,
      taille: f.taille,
      proprio: dst.qui,
      mode: f.mode,
      mtime: f.mtime,
    };
    const ancien = dst.trouver(vers);
    const e =
      ancien?.type === 'fichier' && dst.peut(ancien, 'w')
        ? (Object.assign(ancien, { contenu: copie.contenu, taille: copie.taille }), null)
        : dst.placer('scp', vers, copie);
    if (e) return void erreurs.push(`scp: ${vers}: Permission denied`);
    const taille = tailleDe(f, src);
    lignes.push(`${vers.split('/').at(-1)!.padEnd(40)} 100% ${lisible(taille, 'en').padStart(5)}  ${lisible(taille * 4, 'en')}B/s   00:00`);
  };
  poser(n, destination);
  return lignes;
}

function scp(jeu: Shell, args: string[]): string {
  let recursif = false;
  let port: string | undefined;
  let saut: string | undefined;
  const identites: string[] = [];
  const chemins: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-P' || a === '-J' || a === '-i') {
      const v = args[++i];
      if (v === undefined) return jeu.erreur(`scp: option requires an argument -- ${a.slice(1)}`);
      if (a === '-P') port = v;
      else if (a === '-J') saut = v;
      else identites.push(v);
    } else if (/^-[rpqC]+$/.test(a)) recursif ||= a.includes('r');
    else if (a.startsWith('-'))
      return jeu.erreur(
        `scp: unknown option -- ${a.slice(1)}\nusage: scp [-346ABCOpqRrsTv] [-c cipher] [-D sftp_server_path] [-F ssh_config]\n           [-i identity_file] [-J destination] [-l limit] [-o ssh_option]\n           [-P port] [-S program] [-X sftp_option] source ... target`,
      );
    else chemins.push(a);
  }
  if (chemins.length < 2)
    return jeu.erreur(
      'usage: scp [-346ABCOpqRrsTv] [-c cipher] [-D sftp_server_path] [-F ssh_config]\n           [-i identity_file] [-J destination] [-l limit] [-o ssh_option]\n           [-P port] [-S program] [-X sftp_option] source ... target',
    );
  const dest = chemins.pop()!;
  const versDistant = distant(dest);
  const depuis = chemins.map(distant);
  const autre = versDistant ?? depuis.find(Boolean);
  // Sans machine d'en face : une simple copie locale, comme cp.
  if (!autre) return jeu.erreur(jeu.t('scp-local'));
  if (versDistant && depuis.some(Boolean)) return jeu.erreur(jeu.t('scp-deux-distants'));
  const sauts = preparer(jeu, autre.cible, { identites, port, saut, programme: 'ssh' });
  if (typeof sauts === 'string') return jeu.erreur(sauts);
  const d = sauts.at(-1)!;
  return franchir(jeu, sauts, () => {
    const erreurs: string[] = [];
    const lignes: string[] = [];
    const avant = d.shell.qui;
    const cwd = d.shell.cwd;
    d.shell.qui = d.utilisateur;
    d.shell.cwd = d.shell.maison;
    try {
      if (versDistant) for (const c of chemins) lignes.push(...copier(jeu, d.shell, c, versDistant.chemin || '.', recursif, erreurs));
      else for (const c of depuis) lignes.push(...copier(d.shell, jeu, c!.chemin || '.', dest, recursif, erreurs));
    } finally {
      d.shell.qui = avant;
      d.shell.cwd = cwd;
    }
    if (erreurs.length) jeu.statut = 1;
    return [...lignes, ...erreurs].join('\n');
  });
}

export const TRANSFERTS: Record<string, Commande> = {
  'ssh-copy-id': { propresOptions: true, lancer: ({ args, jeu }) => sshCopyId(jeu, args) },
  scp: { propresOptions: true, lancer: ({ args, jeu }) => scp(jeu, args) },
};

// Pour rsync vers ou depuis une autre machine (sauvegarde.ts).
export { distant as cheminDistant };
