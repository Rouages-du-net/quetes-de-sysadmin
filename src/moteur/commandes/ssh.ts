// ssh : se connecter à une autre machine du réseau simulé (machines.ts).
// Comme OpenSSH (https://man.openbsd.org/ssh, https://man.openbsd.org/ssh_config) :
//   1. ~/.ssh/config (Host, HostName, User, Port, IdentityFile) ;
//   2. résolution du nom par /etc/hosts ;
//   3. connexion au port (seul le 22 est ouvert) ;
//   4. clé d'hôte : vérifiée dans ~/.ssh/known_hosts, sinon question
//      « yes/no/[fingerprint] » (confiance à la première connexion) ; une clé
//      différente de celle qu'on connaît arrête tout (machine réinstallée,
//      ou quelqu'un qui se fait passer pour elle) ;
//   5. authentification par clé uniquement (comme PasswordAuthentication no) ;
//      une clé privée lisible par d'autres est ignorée, comme le vrai ssh.
// La session elle-même est ouverte par la console (console.ts).
// Écarts : pas d'agent, pas de mot de passe, pas de commande à distance ;
// message d'usage raccourci. OpenSSH n'est pas traduit : ses messages
// restent en anglais.

import type { Fichier } from '../monde';
import type { Shell } from '../shell';
import { joker } from '../outils';
import { cleHote, clePrivee, empreinte, empreinteDeCle, machineParAdresse, POSTE, type Machine } from '../machines';
import { autorise, methodes } from '../sshd';
import { verdict, type PareFeu } from '../parefeu';
import type { Commande } from './index';

const USAGE = 'usage: ssh [-i identity_file] [-p port] destination [command [argument ...]]';
const CLES_PAR_DEFAUT = ['~/.ssh/id_ed25519', '~/.ssh/id_ecdsa', '~/.ssh/id_rsa'];

interface Destination {
  utilisateur: string;
  hote: string;
  port: string;
  identites: string[];
}

// Les blocs « Host » de ~/.ssh/config qui s'appliquent : la première valeur
// trouvée l'emporte (ssh_config(5)).
function configuration(jeu: Shell, alias: string) {
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

function resoudre(jeu: Shell, hote: string): string | null {
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hote)) return hote;
  for (const ligne of (jeu.lire('/etc/hosts') ?? '').split('\n')) {
    const [adresse, ...noms] = ligne.replace(/#.*/, '').trim().split(/\s+/);
    if (noms.includes(hote)) return adresse;
  }
  return null;
}

// Mode « rw------- » → « 0600 ».
const octal = (mode: string) =>
  '0' + [0, 3, 6].map((i) => (mode[i] === 'r' ? 4 : 0) + (mode[i + 1] === 'w' ? 2 : 0) + (mode[i + 2] === 'x' ? 1 : 0)).join('');

function authentifier(jeu: Shell, d: Destination, m: Machine): string {
  const sortie: string[] = [];
  const identites = [...new Set([...d.identites, ...CLES_PAR_DEFAUT])];
  let acceptee = false;
  for (const chemin of identites) {
    const n = jeu.trouver(chemin);
    const absolu = jeu.resoudre(chemin);
    if (!n || n.type !== 'fichier') {
      if (d.identites.includes(chemin)) sortie.push(`Warning: Identity file ${chemin} not accessible: No such file or directory.`);
      continue;
    }
    const mode = n.mode ?? 'rw-r--r--';
    if (mode.slice(3) !== '------') {
      sortie.push(
        '@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@',
        '@         WARNING: UNPROTECTED PRIVATE KEY FILE!          @',
        '@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@',
        `Permissions ${octal(mode)} for '${absolu}' are too open.`,
        'It is required that your private key files are NOT accessible by others.',
        'This private key will be ignored.',
        `Load key "${absolu}": bad permissions`,
      );
      continue;
    }
    if (d.utilisateur === 'vous' && (n as Fichier).contenu === clePrivee(m)) {
      acceptee = true;
      break;
    }
  }
  // La configuration appliquée par le serveur d'en face (sshd_config).
  const config: Record<string, string> | null = jeu.etat.sshdDistant?.(m.nom) ?? null;
  const refuse = acceptee && config !== null && !autorise(config, d.utilisateur);
  if (acceptee && !refuse) jeu.demandeConnexion = m.nom;
  else sortie.push(`${d.utilisateur}@${d.hote}: Permission denied (${config ? methodes(config) : 'publickey'}).`);
  // La bonne clé, mais un serveur qui refuse le compte : on s'est enfermé dehors.
  if (refuse && d.utilisateur === 'vous') sortie.push(jeu.t('ssh-enferme', { machine: m.nom }));
  return sortie.join('\n');
}

// La génération de clé d'hôte de la machine d'en face (machines.ts).
const generation = (jeu: Shell, m: Machine): string => jeu.etat.cleDistante?.(m.nom) ?? '';

function ajouterHoteConnu(jeu: Shell, d: Destination, m: Machine) {
  const ligne = `${d.hote} ${cleHote(m, generation(jeu, m))}`;
  const n = jeu.trouver('~/.ssh/known_hosts');
  if (n?.type === 'fichier') n.contenu = [jeu.lire('~/.ssh/known_hosts'), ligne].filter(Boolean).join('\n');
  else jeu.placer('ssh', '~/.ssh/known_hosts', { type: 'fichier', contenu: ligne, lignes: true });
}

// Question de la première connexion : yes, no, ou l'empreinte elle-même.
function confirmer(jeu: Shell, d: Destination, m: Machine, invite: string) {
  jeu.demander(invite, (reponse) => {
    if (reponse === 'yes' || reponse === empreinte(m, generation(jeu, m))) {
      ajouterHoteConnu(jeu, d, m);
      return [`Warning: Permanently added '${d.hote}' (ED25519) to the list of known hosts.`, authentifier(jeu, d, m)].filter(Boolean).join('\n');
    }
    if (reponse === 'no') return 'Host key verification failed.';
    confirmer(jeu, d, m, "Please type 'yes', 'no' or the fingerprint:");
    return '';
  });
}

// La clé envoyée par le serveur n'est pas celle de known_hosts : OpenSSH
// refuse (StrictHostKeyChecking), et dit comment retirer l'ancienne.
function cleChangee(jeu: Shell, d: Destination, m: Machine, ligne: number): string {
  const fichier = jeu.resoudre('~/.ssh/known_hosts');
  const cadre = '@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@';
  return [
    cadre,
    '@    WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!     @',
    cadre,
    'IT IS POSSIBLE THAT SOMEONE IS DOING SOMETHING NASTY!',
    'Someone could be eavesdropping on you right now (man-in-the-middle attack)!',
    'It is also possible that a host key has just been changed.',
    'The fingerprint for the ED25519 key sent by the remote host is',
    `${empreinte(m, generation(jeu, m))}.`,
    'Please contact your system administrator.',
    `Add correct host key in ${fichier} to get rid of this message.`,
    `Offending ED25519 key in ${fichier}:${ligne}`,
    '  remove with:',
    `  ssh-keygen -f '${fichier}' -R '${d.hote}'`,
    `Host key for ${d.hote} has changed and you have requested strict checking.`,
    'Host key verification failed.',
    jeu.t('ssh-cle-changee', { machine: m.nom, empreinte: empreinte(m, generation(jeu, m)) }),
  ].join('\n');
}

export const SSH: Record<string, Commande> = {
  ssh: {
    lancer: ({ args, jeu }) => {
      const identites: string[] = [];
      let port = '';
      const reste: string[] = [];
      for (let i = 0; i < args.length; i++) {
        if (args[i] === '-i' || args[i] === '-p') {
          const valeur = args[++i];
          if (valeur === undefined) return jeu.erreur(`option requires an argument -- ${args[i - 1].slice(1)}\n${USAGE}`);
          if (args[i - 1] === '-i') identites.push(valeur);
          else port = valeur;
        } else reste.push(args[i]);
      }
      const [cible, ...commande] = reste;
      if (!cible) return jeu.erreur(USAGE);
      const [utilisateurDonne, alias] = cible.includes('@') ? cible.split('@', 2) : [null, cible];
      const config = configuration(jeu, alias);
      const d: Destination = {
        utilisateur: utilisateurDonne ?? config.user?.[0] ?? jeu.qui,
        hote: (config.hostname?.[0] ?? alias).toLowerCase(),
        port: port || config.port?.[0] || '22',
        identites: [...identites, ...(config.identityfile ?? [])],
      };
      const adresse = resoudre(jeu, d.hote);
      if (!adresse) return jeu.erreur(`ssh: Could not resolve hostname ${d.hote}: Name or service not known`);
      const m = machineParAdresse(adresse);
      // Le poste n'a pas de serveur SSH, et les machines n'écoutent que sur 22.
      if (m === POSTE || adresse.startsWith('127.') || (m && d.port !== '22'))
        return jeu.erreur(`ssh: connect to host ${d.hote} port ${d.port}: Connection refused`);
      if (!m) return jeu.erreur(`ssh: connect to host ${d.hote} port ${d.port}: No route to host`);
      // fail2ban d'en face a banni le poste : sur Debian, l'action par défaut
      // rejette (REJECT) les paquets de l'adresse vers le port surveillé.
      if ((jeu.etat.bannisDistant?.(m.nom) ?? []).includes(POSTE.adresse))
        return jeu.erreur(
          `ssh: connect to host ${d.hote} port ${d.port}: Connection refused\n` + jeu.t('ssh-banni', { machine: m.nom, adresse: POSTE.adresse }),
        );
      // Le pare-feu d'en face : deny laisse attendre (timeout), reject refuse tout de suite.
      const pf: PareFeu | null = jeu.etat.pareFeuDistant?.(m.nom) ?? null;
      const passe = pf ? verdict(pf, Number(d.port), POSTE.adresse) : 'accepte';
      if (passe !== 'accepte')
        return jeu.erreur(
          `ssh: connect to host ${d.hote} port ${d.port}: ${passe === 'bloque' ? 'Connection timed out' : 'Connection refused'}\n` +
            jeu.t('ssh-pare-feu', { machine: m.nom }),
        );
      const remarque = commande.length ? jeu.t('ssh-commande-distante') + '\n' : '';
      const lignes = (jeu.lire('~/.ssh/known_hosts') ?? '').split('\n');
      const numero = lignes.findIndex((l) => l.split(' ')[0] === d.hote);
      if (numero >= 0) {
        const cle = cleHote(m, generation(jeu, m));
        if (lignes.some((l) => l === `${d.hote} ${cle}`)) return remarque + authentifier(jeu, d, m);
        return jeu.erreur(cleChangee(jeu, d, m, numero + 1));
      }
      confirmer(jeu, d, m, 'Are you sure you want to continue connecting (yes/no/[fingerprint])?');
      return [
        remarque.trim(),
        `The authenticity of host '${d.hote} (${adresse})' can't be established.`,
        `ED25519 key fingerprint is ${empreinte(m, generation(jeu, m))}.`,
        'This key is not known by any other names.',
      ]
        .filter(Boolean)
        .join('\n');
    },
  },
  // ssh-keygen (https://man.openbsd.org/ssh-keygen) : seulement la gestion
  // de known_hosts (-R, -F) et les empreintes (-l). Écart : il ne crée pas
  // de clés (le jeu les donne).
  'ssh-keygen': {
    propresOptions: true,
    lancer: ({ args, jeu }) => {
      const usage = 'usage: ssh-keygen [-l] [-f file] [-F hostname] [-R hostname]';
      let fichier = '~/.ssh/known_hosts';
      let action: 'R' | 'F' | 'l' | null = null;
      let hote = '';
      for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a === '-f' || a === '-R' || a === '-F') {
          const valeur = args[++i];
          if (valeur === undefined) return jeu.erreur(`ssh-keygen: option requires an argument -- ${a.slice(1)}\n${usage}`);
          if (a === '-f') fichier = valeur;
          else [action, hote] = [a.slice(1) as 'R' | 'F', valeur];
        } else if (a === '-l') action ??= 'l';
        else if (a.startsWith('-')) return jeu.erreur(`ssh-keygen: illegal option -- ${a.slice(1, 2)}\n${usage}`);
        else return jeu.erreur(usage);
      }
      if (!action) return jeu.erreur(jeu.t('ssh-keygen-generer'));
      const chemin = jeu.resoudre(fichier);
      const n = jeu.trouver(fichier);
      if (!n || n.type !== 'fichier') return jeu.erreur(`${chemin}: No such file or directory`);
      if (!jeu.peut(n, 'r')) return jeu.erreur(`${chemin}: Permission denied`);
      const lignes = (jeu.lire(fichier) ?? '').split('\n').filter(Boolean);
      if (action === 'l')
        return lignes
          .map((l) => {
            const [nom, ...cle] = l.split(' ');
            // Une ligne de known_hosts commence par le nom ; une clé .pub finit par un commentaire.
            return nom.startsWith('ssh-')
              ? `256 ${empreinteDeCle(l)} ${cle.slice(1).join(' ') || 'no comment'} (ED25519)`
              : `256 ${empreinteDeCle(cle.join(' '))} ${nom} (ED25519)`;
          })
          .join('\n');
      const trouvees = lignes.map((l, i) => [l, i + 1] as const).filter(([l]) => l.split(' ')[0].split(',').includes(hote));
      if (action === 'F') {
        if (!trouvees.length) return '';
        return trouvees.flatMap(([l, i]) => [`# Host ${hote} found: line ${i}`, l]).join('\n');
      }
      if (!trouvees.length) return jeu.erreur(`Host ${hote} not found in ${chemin}`);
      if (!jeu.peut(n, 'w')) return jeu.erreur(`${chemin}: Permission denied`);
      jeu.placer('ssh-keygen', `${fichier}.old`, { ...n, lu: undefined });
      n.contenu = lignes.filter((l) => !trouvees.some(([t]) => t === l)).join('\n');
      return [
        ...trouvees.map(([, i]) => `# Host ${hote} found: line ${i}`),
        `${chemin} updated.`,
        `Original contents retained as ${chemin}.old`,
      ].join('\n');
    },
  },
  // exit est intégré au shell (shell.ts) ; cette entrée sert au manuel.
  exit: { lancer: () => '' },
};
