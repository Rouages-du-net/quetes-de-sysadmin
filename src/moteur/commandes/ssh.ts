// ssh : se connecter à une autre machine du réseau simulé (machines.ts).
// Comme OpenSSH (https://man.openbsd.org/ssh, https://man.openbsd.org/ssh_config) :
//   1. ~/.ssh/config (Host, HostName, User, Port, IdentityFile) ;
//   2. résolution du nom par /etc/hosts ;
//   3. connexion au port : ceux où écoute le sshd d'en face (22 par défaut) ;
//   4. clé d'hôte : vérifiée dans ~/.ssh/known_hosts, sinon question
//      « yes/no/[fingerprint] » (confiance à la première connexion) ; sur un
//      autre port que 22, l'hôte est noté « [nom]:port » ; une clé
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
import { cleHote, clePrivee, condense, empreinte, empreinteDeCle, machineParAdresse, POSTE, type Machine } from '../machines';
import { autorise, methodes, portsSshd } from '../sshd';
import { CLES_PAR_DEFAUT, configuration, franchir, genererCle, preparer } from '../acces';
import { verdict, type PareFeu } from '../parefeu';
import type { Commande } from './index';

const USAGE = 'usage: ssh [-i identity_file] [-p port] destination [command [argument ...]]';

interface Destination {
  utilisateur: string;
  hote: string;
  port: string;
  identites: string[];
  // Le nom sous lequel known_hosts connaît l'hôte : « nom », ou « [nom]:port » hors du port 22.
  connu: string;
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
    if (d.utilisateur === jeu.joueur && (n as Fichier).contenu === clePrivee(m)) {
      acceptee = true;
      break;
    }
  }
  // La configuration appliquée par le serveur d'en face (sshd_config).
  const config: Record<string, string> | null = jeu.etat.sshdDistant?.(m.nom) ?? null;
  const refuse = acceptee && config !== null && !autorise(config, d.utilisateur);
  if (acceptee && !refuse) {
    jeu.demandeConnexion = m.nom;
    jeu.etat.portConnexion = Number(d.port);
  } else sortie.push(`${d.utilisateur}@${d.hote}: Permission denied (${config ? methodes(config) : 'publickey'}).`);
  // La bonne clé, mais un serveur qui refuse le compte : on s'est enfermé dehors.
  if (refuse && d.utilisateur === jeu.joueur) sortie.push(jeu.t('ssh-enferme', { machine: m.nom }));
  return sortie.join('\n');
}

// La génération de clé d'hôte de la machine d'en face (machines.ts).
const generation = (jeu: Shell, m: Machine): string => jeu.etat.cleDistante?.(m.nom) ?? '';

function ajouterHoteConnu(jeu: Shell, d: Destination, m: Machine) {
  const ligne = `${d.connu} ${cleHote(m, generation(jeu, m))}`;
  const n = jeu.trouver('~/.ssh/known_hosts');
  if (n?.type === 'fichier') n.contenu = [jeu.lire('~/.ssh/known_hosts'), ligne].filter(Boolean).join('\n');
  else jeu.placer('ssh', '~/.ssh/known_hosts', { type: 'fichier', contenu: ligne, lignes: true });
}

// Question de la première connexion : yes, no, ou l'empreinte elle-même.
function confirmer(jeu: Shell, d: Destination, m: Machine, invite: string) {
  jeu.demander(invite, (reponse) => {
    if (reponse === 'yes' || reponse === empreinte(m, generation(jeu, m))) {
      ajouterHoteConnu(jeu, d, m);
      return [`Warning: Permanently added '${d.connu}' (ED25519) to the list of known hosts.`, authentifier(jeu, d, m)].filter(Boolean).join('\n');
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
    `  ssh-keygen -f '${fichier}' -R '${d.connu}'`,
    `Host key for ${d.connu} has changed and you have requested strict checking.`,
    'Host key verification failed.',
    jeu.t('ssh-cle-changee', { machine: m.nom, empreinte: empreinte(m, generation(jeu, m)) }),
  ].join('\n');
}

// La machine d'histoire visée gère-t-elle ses clés (authorized_keys, mot de passe) ? Ou faut-il rebondir ?
function vraiSsh(jeu: Shell, cible: string): boolean {
  const alias = cible.includes('@') ? cible.split('@', 2)[1] : cible;
  // Un rebond demandé par ~/.ssh/config (ProxyJump).
  const saut = configuration(jeu, alias).proxyjump?.[0];
  if (saut && saut !== 'none') return true;
  const adresse = resoudre(jeu, (configuration(jeu, alias).hostname?.[0] ?? alias).toLowerCase());
  const m = adresse ? machineParAdresse(adresse) : undefined;
  return !!m && m !== POSTE && !!(jeu.etat.sessionDistante?.(m.nom) as Shell | undefined)?.etat.sshReel;
}

interface OptionsSsh {
  identites: string[];
  port: string;
  saut?: string;
  tunnels: string[];
  sansSession: boolean;
  arrierePlan: boolean;
}

/** -L [adresse:]port:hôte:port → le tunnel ; null si la forme est fausse. */
function lireTunnel(texte: string): { port: number; hote: string; portDistant: number } | null {
  const m = /^(?:[^:]+:)?(\d+):([^:]+):(\d+)$/.exec(texte);
  return m ? { port: Number(m[1]), hote: m[2], portDistant: Number(m[3]) } : null;
}

function sshComplet(jeu: Shell, cible: string, commande: string[], o: OptionsSsh): string {
  for (const t of o.tunnels) if (!lireTunnel(t)) return jeu.erreur(`Bad local forwarding specification '${t}'`);
  const sauts = preparer(jeu, cible, { identites: o.identites, port: o.port, saut: o.saut });
  if (typeof sauts === 'string') return jeu.erreur(sauts);
  const dernier = sauts.at(-1)!;
  return franchir(jeu, sauts, () => {
    // Les tunnels : un port de cette machine mène à un service vu depuis la machine d'en face.
    for (const t of o.tunnels.map(lireTunnel)) {
      const vers = t!.hote === 'localhost' || t!.hote === '127.0.0.1' ? dernier.shell : null;
      const adresse = vers ? null : resoudre(dernier.shell, t!.hote);
      const interne = adresse ? dernier.shell.internes_().find((h) => h.adresse === adresse) : null;
      const shell = vers ?? (interne ? dernier.shell.interne(interne.nom) : null);
      if (!shell) continue;
      // Le tunnel vit tant que ce processus ssh tourne (kill le ferme).
      const pid = 4100 + (jeu.etat.tunnels?.length ?? 0) * 7;
      // En passant par une autre adresse que localhost, un service qui n'écoute que sur 127.0.0.1 reste injoignable.
      (jeu.etat.tunnels ??= []).push({ port: t!.port, shell, portDistant: t!.portDistant, machine: dernier.machine.nom, pid, boucle: !!vers });
      (jeu.etat.processus ??= []).push({
        pid,
        utilisateur: jeu.qui,
        cpu: 0,
        mem: 0.1,
        commande:
          `ssh ${['-f', '-N'].filter((x) => (x === '-f' ? o.arrierePlan : o.sansSession)).join(' ')} -L ${o.tunnels.join(' -L ')} ${cible}`.replace(
            /\s+/g,
            ' ',
          ),
      });
    }
    // Une commande à distance : elle tourne sous le compte d'en face, sa sortie revient ici.
    if (commande.length) {
      const avant = dernier.shell.qui;
      dernier.shell.qui = dernier.utilisateur;
      try {
        const r = dernier.shell.sousCommande(commande.join(' '), dernier.shell.maison);
        jeu.statut = r.code;
        return r.sortie;
      } finally {
        dernier.shell.qui = avant;
      }
    }
    if (o.sansSession) return o.arrierePlan ? '' : jeu.t('ssh-sans-arriere-plan');
    if (sauts.length === 1 && dernier.histoire) jeu.demandeConnexion = dernier.histoire;
    else jeu.demandeSession = { shell: dernier.shell, domaine: dernier.machine.domaine, adresse: dernier.machine.adresse, via: sauts[0].histoire };
    return '';
  });
}

// ssh -G : les options qui s'appliqueraient (un extrait, dans l'ordre d'OpenSSH), sans se connecter.
function configurationEffective(jeu: Shell, cible: string, o: { identites: string[]; port: string; saut?: string }): string {
  const [utilisateur, alias] = cible.includes('@') ? cible.split('@', 2) : [null, cible];
  const c = configuration(jeu, alias);
  const saut = o.saut ?? c.proxyjump?.[0];
  const identites = [...o.identites, ...(c.identityfile ?? [])];
  return [
    `host ${alias}`,
    `user ${utilisateur ?? c.user?.[0] ?? jeu.qui}`,
    `hostname ${(c.hostname?.[0] ?? alias).toLowerCase()}`,
    `port ${o.port || c.port?.[0] || '22'}`,
    ...(saut ? [`proxyjump ${saut}`] : []),
    ...(identites.length ? identites : CLES_PAR_DEFAUT).map((i) => `identityfile ${i}`),
  ].join('\n');
}

// L'image de la clé (randomart), comme ssh-keygen : l'« évêque ivre » part
// du centre d'un plateau de 17 × 9 et se déplace en diagonale selon chaque
// paire de bits de l'empreinte ; plus une case est visitée, plus son
// caractère est dense. S : le départ, E : l'arrivée.
function randomart(emp: string): string[] {
  const [L, H] = [17, 9];
  const visites = Array.from({ length: H }, () => Array<number>(L).fill(0));
  let [x, y] = [8, 4];
  // Les 32 octets de l'empreinte (tirés d'elle, toujours les mêmes).
  for (let o = 0; o < 32; o++)
    for (let b = parseInt(condense(emp + o).slice(0, 2), 16), k = 0; k < 4; k++, b >>= 2) {
      x = Math.max(0, Math.min(L - 1, x + (b & 1 ? 1 : -1)));
      y = Math.max(0, Math.min(H - 1, y + (b & 2 ? 1 : -1)));
      visites[y][x]++;
    }
  const symboles = ' .o+=*BOX@%&#/^';
  return visites.map(
    (ligne, j) =>
      `|${ligne.map((n, i) => (i === 8 && j === 4 ? 'S' : i === x && j === y ? 'E' : symboles[Math.min(n, symboles.length - 1)])).join('')}|`,
  );
}

// ssh-keygen sans -R/-F/-l : une nouvelle paire de clés (ed25519), comme
// ssh-keygen -t ed25519 [-C commentaire] [-N phrase] [-f fichier]. Les
// questions (fichier, phrase de passe) ne sont posées que pour ce qui manque.
function generer(jeu: Shell, args: string[]): string {
  const valeur = (o: string) => (args.includes(o) ? args[args.indexOf(o) + 1] : undefined);
  const type = valeur('-t') ?? 'ed25519';
  if (type !== 'ed25519') return jeu.erreur(jeu.t('ssh-keygen-type', { type }));
  const commentaire = valeur('-C') ?? `${jeu.qui}@${jeu.hote}`;
  const parDefaut = `${jeu.resoudre('~')}/.ssh/id_ed25519`;
  const lignes = ['Generating public/private ed25519 key pair.'];
  const ecrire = (fichier: string, phrase: string): string => {
    const chemin = jeu.resoudre(fichier.replace(/^~/, jeu.maison));
    const dossier = chemin.replace(/\/[^/]+$/, '');
    if (!jeu.existe(dossier)) {
      if (dossier !== `${jeu.resoudre('~')}/.ssh`) return `Saving key "${chemin}" failed: No such file or directory`;
      jeu.placer('ssh-keygen', dossier, { type: 'dossier', enfants: {}, proprio: jeu.qui, mode: 'rwx------' });
      lignes.push(`Created directory '${dossier}'.`);
    }
    const n = (jeu.etat.clesGenerees = ((jeu.etat.clesGenerees as number | undefined) ?? 0) + 1);
    const cle = genererCle(`${jeu.hote}:${jeu.qui}:${chemin}:${n}`, commentaire);
    for (const [c, contenu, mode] of [
      [chemin, cle.prive, 'rw-------'],
      [`${chemin}.pub`, cle.publique, 'rw-r--r--'],
    ] as const) {
      const ancien = jeu.trouver(c);
      if (ancien?.type === 'fichier') Object.assign(ancien, { contenu, mode, lignes: true, taille: undefined });
      else {
        const e = jeu.placer('ssh-keygen', c, { type: 'fichier', contenu, lignes: true, proprio: jeu.qui, mode });
        if (e) return `Saving key "${chemin}" failed: Permission denied`;
      }
    }
    if (phrase) (jeu.etat.phrasesDePasse ??= {})[chemin] = phrase;
    else if (jeu.etat.phrasesDePasse) delete jeu.etat.phrasesDePasse[chemin];
    const emp = empreinteDeCle(cle.publique);
    const art = randomart(emp);
    return [
      ...lignes,
      `Your identification has been saved in ${chemin}`,
      `Your public key has been saved in ${chemin}.pub`,
      'The key fingerprint is:',
      `${emp} ${commentaire}`,
      "The key's randomart image is:",
      '+--[ED25519 256]--+',
      ...art,
      '+----[SHA256]-----+',
    ].join('\n');
  };
  // La phrase de passe (deux fois), sauf si -N la donne.
  const phrase = (fichier: string): string => {
    const donnee = valeur('-N');
    if (donnee !== undefined) return ecrire(fichier, donnee);
    jeu.demander(
      'Enter passphrase (empty for no passphrase):',
      (premiere) => {
        jeu.demander(
          'Enter same passphrase again:',
          (seconde) => (seconde === premiere ? ecrire(fichier, premiere) : 'Passphrases do not match.  Try again.'),
          true,
        );
        return '';
      },
      true,
    );
    return '';
  };
  // Le fichier : -f, sinon la question ; s'il existe, on demande avant d'écraser.
  const fichier = (chemin: string): string => {
    if (!jeu.existe(chemin)) return phrase(chemin);
    jeu.demander(`${jeu.resoudre(chemin)} already exists.\nOverwrite (y/n)?`, (r) => (r.trim().toLowerCase().startsWith('y') ? phrase(chemin) : ''));
    return '';
  };
  const f = valeur('-f');
  if (f) return [lignes.shift(), fichier(f)].filter(Boolean).join('\n');
  jeu.demander(`Enter file in which to save the key (${parDefaut}):`, (r) => fichier(r.trim() || parDefaut));
  return lignes.shift()!;
}

export const SSH: Record<string, Commande> = {
  ssh: {
    lancer: ({ args, jeu }) => {
      const identites: string[] = [];
      let port = '';
      let saut: string | undefined;
      const tunnels: string[] = [];
      let sansSession = false;
      let arrierePlan = false;
      const reste: string[] = [];
      for (let i = 0; i < args.length; i++) {
        if (['-i', '-p', '-J', '-L'].includes(args[i])) {
          const valeur = args[++i];
          if (valeur === undefined) return jeu.erreur(`option requires an argument -- ${args[i - 1].slice(1)}\n${USAGE}`);
          if (args[i - 1] === '-i') identites.push(valeur);
          else if (args[i - 1] === '-p') port = valeur;
          else if (args[i - 1] === '-J') saut = valeur;
          else tunnels.push(valeur);
        } else if (args[i] === '-G') {
          continue;
        } else if (/^-[Nf]+$/.test(args[i])) {
          if (args[i].includes('N')) sansSession = true;
          if (args[i].includes('f')) arrierePlan = true;
        } else if (reste.length === 0 && /^-./.test(args[i])) return jeu.erreur(`unknown option -- ${args[i].slice(1)}\n${USAGE}`);
        else reste.push(args[i]);
      }
      const [cible, ...commande] = reste;
      if (!cible) return jeu.erreur(USAGE);
      if (args.includes('-G')) return configurationEffective(jeu, cible, { identites, port, saut });
      // Le « vrai » ssh (acces.ts) : rebonds, tunnels, réseau interne, machines où l'on gère ses clés.
      if (jeu.hote !== 'poste' || saut || tunnels.length || sansSession || vraiSsh(jeu, cible))
        return sshComplet(jeu, cible, commande, { identites, port, saut, tunnels, sansSession, arrierePlan });
      const [utilisateurDonne, alias] = cible.includes('@') ? cible.split('@', 2) : [null, cible];
      const config = configuration(jeu, alias);
      const hote = (config.hostname?.[0] ?? alias).toLowerCase();
      const portVise = port || config.port?.[0] || '22';
      const d: Destination = {
        utilisateur: utilisateurDonne ?? config.user?.[0] ?? jeu.qui,
        hote,
        port: portVise,
        identites: [...identites, ...(config.identityfile ?? [])],
        connu: portVise === '22' ? hote : `[${hote}]:${portVise}`,
      };
      const adresse = resoudre(jeu, d.hote);
      if (!adresse) return jeu.erreur(`ssh: Could not resolve hostname ${d.hote}: Name or service not known`);
      const m = machineParAdresse(adresse);
      // Le poste n'a pas de serveur SSH ; les machines écoutent sur les ports de leur sshd.
      if (m === POSTE || adresse.startsWith('127.')) return jeu.erreur(`ssh: connect to host ${d.hote} port ${d.port}: Connection refused`);
      const ecoute = m ? portsSshd(jeu.etat.sshdDistant?.(m.nom)) : [];
      if (m && !ecoute.includes(Number(d.port)))
        return jeu.erreur(
          `ssh: connect to host ${d.hote} port ${d.port}: Connection refused` +
            // Un serveur qu'on a soi-même déplacé : rappeler où il écoute.
            (ecoute.join() !== '22' ? `\n${jeu.t('ssh-autre-port', { machine: m.nom, port: d.port, ports: ecoute.join(', ') })}` : ''),
        );
      if (!m) return jeu.erreur(`ssh: connect to host ${d.hote} port ${d.port}: No route to host`);
      // fail2ban d'en face a banni le poste : sur Debian, l'action par défaut
      // rejette (REJECT) les paquets de l'adresse vers les ports de la prison.
      if ((jeu.etat.bannisDistant?.(m.nom, Number(d.port)) ?? []).includes(POSTE.adresse))
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
      const cle = cleHote(m, generation(jeu, m));
      const numero = lignes.findIndex((l) => l.split(' ')[0].split(',').includes(d.connu));
      if (numero >= 0) {
        if (lignes[numero].endsWith(` ${cle}`)) return remarque + authentifier(jeu, d, m);
        return jeu.erreur(cleChangee(jeu, d, m, numero + 1));
      }
      // La même clé déjà connue sous un autre nom (le même hôte, sur le port 22) : OpenSSH le signale.
      const autres = lignes.map((l, i) => [l, i + 1] as const).filter(([l]) => l.endsWith(` ${cle}`));
      const fichier = jeu.resoudre('~/.ssh/known_hosts');
      confirmer(jeu, d, m, 'Are you sure you want to continue connecting (yes/no/[fingerprint])?');
      return [
        remarque.trim(),
        `The authenticity of host '${d.connu} (${d.port === '22' ? adresse : `[${adresse}]:${d.port}`})' can't be established.`,
        `ED25519 key fingerprint is ${empreinte(m, generation(jeu, m))}.`,
        ...(autres.length
          ? ['This host key is known by the following other names/addresses:', ...autres.map(([l, i]) => `    ${fichier}:${i}: ${l.split(' ')[0]}`)]
          : ['This key is not known by any other names.']),
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
      const usage = 'usage: ssh-keygen [-t ed25519] [-C comment] [-N passphrase] [-f file] ; ssh-keygen [-l] [-f file] [-F hostname] [-R hostname]';
      let fichier = '~/.ssh/known_hosts';
      let action: 'R' | 'F' | 'l' | null = null;
      let hote = '';
      for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a === '-t' || a === '-C' || a === '-N' || a === '-b') {
          if (args[++i] === undefined) return jeu.erreur(`ssh-keygen: option requires an argument -- ${a.slice(1)}\n${usage}`);
        } else if (a === '-f' || a === '-R' || a === '-F') {
          const valeur = args[++i];
          if (valeur === undefined) return jeu.erreur(`ssh-keygen: option requires an argument -- ${a.slice(1)}\n${usage}`);
          if (a === '-f') fichier = valeur;
          else [action, hote] = [a.slice(1) as 'R' | 'F', valeur];
        } else if (a === '-l') action ??= 'l';
        else if (a.startsWith('-')) return jeu.erreur(`ssh-keygen: illegal option -- ${a.slice(1, 2)}\n${usage}`);
        else return jeu.erreur(usage);
      }
      if (!action) return generer(jeu, args);
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
