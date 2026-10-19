// Joindre une autre machine en ssh (et scp, rsync, ssh-copy-id), comme
// OpenSSH (https://man.openbsd.org/ssh, https://man.openbsd.org/ssh_config) :
// la configuration du client (~/.ssh/config : Host, HostName, User, Port,
// IdentityFile, ProxyJump), la résolution du nom par la machine d'où part
// chaque saut, la clé d'hôte vérifiée dans known_hosts (question à la
// première connexion), puis l'authentification : une clé privée dont la clé
// publique est dans ~/.ssh/authorized_keys du compte d'en face, sinon le
// mot de passe si sshd l'accepte (PasswordAuthentication).
// Ce module sert les machines au « vrai » ssh (etat.sshReel) et les
// machines internes d'une histoire ; les autres gardent l'accès simplifié
// de commandes/ssh.ts (une clé donnée par le jeu).
// Écarts : ni agent, ni certificats ; une seule clé d'hôte (ed25519).

import type { Fichier } from './monde';
import type { Shell } from './shell';
import { joker } from './outils';
import { base64, cleHote, condense, empreinte, MACHINES, POSTE } from './machines';
import { autorise, methodes } from './sshd';

export const CLES_PAR_DEFAUT = ['~/.ssh/id_ed25519', '~/.ssh/id_ecdsa', '~/.ssh/id_rsa'];

/** Une machine joignable : son nom, son nom complet et son adresse. */
export interface Hote {
  nom: string;
  domaine: string;
  adresse: string;
}

/** Un saut : où l'on va, sous quel compte, et la session de la machine d'en face. */
export interface Saut {
  utilisateur: string;
  // Le nom tel qu'il est écrit dans known_hosts (HostName, sinon l'alias).
  hote: string;
  port: string;
  identites: string[];
  machine: Hote;
  shell: Shell;
  // Une machine d'histoire jointe depuis le poste (la console ouvre son chapitre).
  histoire?: string;
}

// ——— Configuration du client (ssh_config) ———

/** Les blocs « Host » de ~/.ssh/config qui s'appliquent ; la première valeur trouvée l'emporte. */
export function configuration(jeu: Shell, alias: string): Record<string, string[]> {
  const options: Record<string, string[]> = {};
  let actif = false;
  for (const brute of (jeu.lire('~/.ssh/config') ?? '').split('\n')) {
    const ligne = brute.trim();
    if (!ligne || ligne.startsWith('#')) continue;
    const [cle, ...reste] = ligne.split(/\s+/);
    const valeur = reste.join(' ');
    if (cle.toLowerCase() === 'host') actif = reste.some((motif) => joker(motif).test(alias));
    else if (actif) (options[cle.toLowerCase()] ??= []).push(valeur);
  }
  return options;
}

/** Un nom → une adresse, d'après /etc/hosts de la machine qui cherche. */
export function resoudreNom(jeu: Shell, hote: string): string | null {
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hote)) return hote;
  for (const ligne of (jeu.lire('/etc/hosts') ?? '').split('\n')) {
    const [adresse, ...noms] = ligne.replace(/#.*/, '').trim().split(/\s+/);
    if (noms.includes(hote)) return adresse;
  }
  return null;
}

// ——— Clés ———

const ENTETE_PUBLIQUE = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI';

/** Une paire de clés ed25519 (fausse, mais de la bonne forme), tirée d'une graine. */
export function genererCle(graine: string, commentaire: string): { prive: string; publique: string } {
  const corps = base64('cle-generee-' + graine, 70 * 5);
  const prive = [
    '-----BEGIN OPENSSH PRIVATE KEY-----',
    ...corps.match(/.{70}/g)!.map((l, i) => (i === 0 ? 'b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW' + l.slice(68) : l)),
    '-----END OPENSSH PRIVATE KEY-----',
  ].join('\n');
  return { prive, publique: `${publiqueDe(prive)} ${commentaire}` };
}

/** La clé publique (sans commentaire) qui va avec une clé privée. */
export const publiqueDe = (prive: string) => `${ENTETE_PUBLIQUE}${base64(condense(prive.replace(/\s+/g, '')) + '-publique', 43)}`;

// ——— Les sauts ———

// La session d'en face : depuis le poste, une machine d'histoire ; depuis
// une machine d'histoire (ou interne), une machine de son réseau interne.
function machineEnFace(origine: Shell, adresse: string): { machine: Hote; shell: Shell; histoire?: string } | null {
  if (origine.hote === 'poste') {
    const m = MACHINES.find((x) => x.adresse === adresse);
    const shell = m && (origine.etat.sessionDistante?.(m.nom) as Shell | undefined);
    return m && shell ? { machine: m, shell, histoire: m.nom } : null;
  }
  const interne = origine.internes_().find((h) => h.adresse === adresse);
  const shell = interne && origine.interne(interne.nom);
  return interne && shell ? { machine: interne, shell } : null;
}

/**
 * Prépare les sauts vers `cible` ([compte@]nom), en passant par `saut`
 * (-J, ou ProxyJump de ~/.ssh/config) : renvoie les sauts, ou le message
 * d'erreur de ssh.
 */
export function preparer(
  origine: Shell,
  cible: string,
  o: { identites?: string[]; port?: string; saut?: string; programme?: string } = {},
): Saut[] | string {
  const programme = o.programme ?? 'ssh';
  const etapes: string[] = [];
  const [utilisateurCible, aliasCible] = cible.includes('@') ? cible.split('@', 2) : [null, cible];
  const sauts = o.saut ?? configuration(origine, aliasCible).proxyjump?.[0];
  if (sauts && sauts !== 'none') etapes.push(...sauts.split(','));
  etapes.push(cible);
  const resultat: Saut[] = [];
  let depuis = origine;
  for (const [i, etape] of etapes.entries()) {
    const [utilisateurDonne, alias] = etape.includes('@') ? etape.split('@', 2) : [null, etape];
    const config = configuration(origine, alias);
    const derniere = i === etapes.length - 1;
    const hote = (config.hostname?.[0] ?? alias).toLowerCase();
    const port = (derniere ? o.port : '') || config.port?.[0] || '22';
    const adresse = resoudreNom(depuis, hote);
    if (!adresse) return `${programme}: Could not resolve hostname ${hote}: Name or service not known`;
    if (adresse === POSTE.adresse || adresse.startsWith('127.') || port !== '22')
      return `${programme}: connect to host ${hote} port ${port}: Connection refused`;
    const enFace = machineEnFace(depuis, adresse);
    if (!enFace) return `${programme}: connect to host ${hote} port ${port}: No route to host`;
    resultat.push({
      utilisateur: utilisateurDonne ?? (derniere ? utilisateurCible : null) ?? config.user?.[0] ?? origine.qui,
      hote,
      port,
      identites: [...(derniere ? (o.identites ?? []) : []), ...(config.identityfile ?? [])],
      ...enFace,
    });
    depuis = enFace.shell;
  }
  return resultat;
}

// ——— Franchir les sauts : clés d'hôte, puis authentification ———

// Un échec de ssh : le message (affiché même en réponse à une question) et le code 255.
function echec(origine: Shell, texte: string): string {
  origine.statut = 255;
  return texte;
}

const motDePasseDe = (s: Shell, compte: string): string | undefined =>
  (s.etat.motsDePasse as Record<string, string> | undefined)?.[compte] ?? (compte === 'vous' ? s.chapitre.motDePasse : undefined);

// Les clés publiques autorisées pour ce compte, sur la machine d'en face.
function clesAutorisees(s: Shell, compte: string): string[] {
  const maison = compte === 'root' ? '/root' : (s.comptes.utilisateurs[compte]?.maison ?? `/home/${compte}`);
  return (s.lire(`${maison}/.ssh/authorized_keys`) ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split(/\s+/).slice(0, 2).join(' '));
}

// La machine d'en face garde trace des connexions (pour les histoires) : par clé, par mot de passe.
function noter(s: Saut, comment: 'cle' | 'motDePasse') {
  const connexions = (s.shell.etat.connexionsSsh ??= { cle: 0, motDePasse: 0 }) as Record<string, number>;
  connexions[comment]++;
}

// Les clés publiques du poste, ajoutées à ~/.ssh/authorized_keys de « vous » en face (si elles n'y sont pas).
function recopierCles(poste: Shell, s: Shell) {
  const dossier = poste.trouver('~/.ssh');
  if (dossier?.type !== 'dossier') return;
  const cles = Object.keys(dossier.enfants)
    .filter((n) => n.endsWith('.pub'))
    .map((n) => (poste.lire(`~/.ssh/${n}`) ?? '').trim())
    .filter((c) => c.startsWith('ssh-'));
  const chemin = '/home/vous/.ssh/authorized_keys';
  const deja = clesAutorisees(s, 'vous');
  const nouvelles = cles.filter((c) => !deja.includes(c.split(/\s+/).slice(0, 2).join(' ')));
  if (!nouvelles.length) return;
  const n = s.trouver(chemin);
  if (n?.type === 'fichier') n.contenu = [s.lire(chemin), ...nouvelles].filter(Boolean).join('\n');
  else if (s.trouver('/home/vous/.ssh')?.type === 'dossier')
    s.placer('ssh', chemin, { type: 'fichier', contenu: nouvelles.join('\n'), lignes: true, proprio: 'vous', mode: 'rw-------' });
}

const octal = (mode: string) =>
  '0' + [0, 3, 6].map((i) => (mode[i] === 'r' ? 4 : 0) + (mode[i + 1] === 'w' ? 2 : 0) + (mode[i + 2] === 'x' ? 1 : 0)).join('');

/**
 * Passe chaque saut (clé d'hôte, puis authentification), en posant les
 * questions nécessaires (yes/no, mot de passe) ; à la fin, `suite` reçoit
 * les sauts et rend ce qu'il faut afficher. Renvoie ce que ssh affiche tout
 * de suite.
 */
export function franchir(origine: Shell, sauts: Saut[], suite: () => string, i = 0): string {
  if (i >= sauts.length) return suite();
  const s = sauts[i];
  const fichier = '~/.ssh/known_hosts';
  const lignes = (origine.lire(fichier) ?? '').split('\n');
  // Une machine d'histoire réinstallée a changé de clé d'hôte (les machines internes gardent la leur).
  const generation = s.histoire ? ((origine.etat.cleDistante?.(s.machine.nom) as string | undefined) ?? '') : '';
  const cle = cleHote(s.machine, generation);
  const numero = lignes.findIndex((l) => l.split(' ')[0].split(',').includes(s.hote));
  if (numero >= 0) {
    if (!lignes.some((l) => l.split(' ')[0].split(',').includes(s.hote) && l.endsWith(cle)))
      return echec(
        origine,
        [
          '@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@',
          '@    WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!     @',
          '@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@',
          `Host key for ${s.hote} has changed and you have requested strict checking.`,
          `Offending ED25519 key in ${origine.resoudre(fichier)}:${numero + 1}`,
          'Host key verification failed.',
        ].join('\n'),
      );
    return authentifier(origine, sauts, suite, i);
  }
  const demander = (invite: string) =>
    origine.demander(invite, (reponse) => {
      if (reponse === 'yes' || reponse === empreinte(s.machine, generation)) {
        const ligne = `${s.hote} ${cle}`;
        const n = origine.trouver(fichier);
        if (n?.type === 'fichier') n.contenu = [origine.lire(fichier), ligne].filter(Boolean).join('\n');
        else origine.placer('ssh', fichier, { type: 'fichier', contenu: ligne, lignes: true, mode: 'rw-------' });
        return [`Warning: Permanently added '${s.hote}' (ED25519) to the list of known hosts.`, authentifier(origine, sauts, suite, i)]
          .filter(Boolean)
          .join('\n');
      }
      if (reponse === 'no') return 'Host key verification failed.';
      demander("Please type 'yes', 'no' or the fingerprint:");
      return '';
    });
  demander('Are you sure you want to continue connecting (yes/no/[fingerprint])?');
  return [
    `The authenticity of host '${s.hote} (${s.machine.adresse})' can't be established.`,
    `ED25519 key fingerprint is ${empreinte(s.machine, generation)}.`,
    'This key is not known by any other names.',
  ].join('\n');
}

function authentifier(origine: Shell, sauts: Saut[], suite: () => string, i: number): string {
  const s = sauts[i];
  const avertissements: string[] = [];
  // La configuration appliquée par sshd d'en face (s'il est simulé), sinon celle par défaut de Debian.
  const config: Record<string, string> = s.shell.etat.sshd?.charge ?? {};
  const compteExiste = !!s.shell.comptes.utilisateurs[s.utilisateur];
  const permis = compteExiste && autorise(config, s.utilisateur);
  // Les clés du poste, tenues à jour sur les machines de l'histoire (d'où que parte la connexion).
  const poste = origine.hote === 'poste' ? origine : (s.shell.principal.etat.poste?.() as Shell | undefined);
  if (poste && s.shell.principal.chapitre.clesDuJoueur) recopierCles(poste, s.shell);
  const autorisees = clesAutorisees(s.shell, s.utilisateur);
  const chemins = [...new Set([...s.identites, ...CLES_PAR_DEFAUT])];
  const refus = `${s.utilisateur}@${s.hote}: Permission denied (${methodes(config) || 'publickey'}).`;
  const avec = (texte: string) => [...avertissements, texte].filter(Boolean).join('\n');

  // Après les clés : le mot de passe (trois essais), si sshd l'accepte.
  const motDePasse = (): string => {
    if (config.passwordauthentication !== 'yes') return echec(origine, avec(refus));
    const essayer = (essai: number) =>
      origine.demander(
        `${s.utilisateur}@${s.hote}'s password:`,
        (reponse) => {
          if (permis && reponse === motDePasseDe(s.shell, s.utilisateur)) {
            noter(s, 'motDePasse');
            return franchir(origine, sauts, suite, i + 1);
          }
          if (essai >= 3) return echec(origine, refus);
          essayer(essai + 1);
          return 'Permission denied, please try again.';
        },
        true,
      );
    essayer(1);
    return avec('');
  };

  // Les clés, une à une : celles demandées (-i, IdentityFile), puis celles par défaut.
  const cle = (k: number): string => {
    if (k >= chemins.length) return motDePasse();
    const chemin = chemins[k];
    const n = origine.trouver(chemin);
    if (!n || n.type !== 'fichier') {
      if (s.identites.includes(chemin)) avertissements.push(`Warning: Identity file ${chemin} not accessible: No such file or directory.`);
      return cle(k + 1);
    }
    const mode = n.mode ?? 'rw-r--r--';
    if (mode.slice(3) !== '------') {
      avertissements.push(
        '@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@',
        '@         WARNING: UNPROTECTED PRIVATE KEY FILE!          @',
        '@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@',
        `Permissions ${octal(mode)} for '${origine.resoudre(chemin)}' are too open.`,
        'It is required that your private key files are NOT accessible by others.',
        'This private key will be ignored.',
      );
      return cle(k + 1);
    }
    const texte = (n as Fichier).contenu;
    if (!permis || typeof texte !== 'string' || !autorisees.includes(publiqueDe(texte))) return cle(k + 1);
    // Une clé protégée par une phrase de passe : ssh la demande avant de s'en servir.
    const phrase = (origine.etat.phrasesDePasse as Record<string, string> | undefined)?.[origine.resoudre(chemin)];
    if (!phrase) {
      noter(s, 'cle');
      return avec(franchir(origine, sauts, suite, i + 1));
    }
    origine.demander(
      `Enter passphrase for key '${origine.resoudre(chemin)}':`,
      (reponse) => {
        if (reponse !== phrase) return cle(k + 1);
        noter(s, 'cle');
        return franchir(origine, sauts, suite, i + 1);
      },
      true,
    );
    return avec('');
  };
  return cle(0);
}
