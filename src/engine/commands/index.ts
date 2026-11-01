// Toutes les commandes du jeu. Chaque chapitre choisit celles qu'il connaît
// (Chapitre.commandes). Une commande lit ses arguments et l'entrée du tube,
// renvoie sa sortie, et signale ses erreurs avec jeu.erreur().

import type { Shell } from '../shell';
import { FILES } from './files';
import { TEXT } from './text';
import { SYSTEM } from './system';
import { NETWORK } from './network';
import { GIT } from './git';
import { PAGES } from './pages';
import { SSH } from './ssh';
import { ACCOUNTS } from './accounts';
import { COMMANDS_SUDOERS, listSudo } from './sudoers';
import { TMUX } from './tmux';
import { LAN } from './lan';
import { NFTABLES } from './nftables';
import { WIREGUARD } from './wireguard';
import { LDAP } from './ldap';
import { RADIUS } from './radius';
import { NMAP } from './nmap';
import { LYNIS } from './lynis';
import { SFTP } from './sftp';
import { LFTP } from './lftp';
import { SYSTEMD } from './systemd';
import { EDITOR } from './editor';
import { SSHD } from './sshd';
import { UFW } from './ufw';
import { SS } from './ss';
import { FAIL2BAN } from './fail2ban';
import { BACKUP } from './backup';
import { APT } from './apt';
import { IOSTAT } from './iostat';
import { UNATTENDED } from './unattended';
import { CERTBOT } from './certbot';
import { RESTIC } from './restic';
import { BIND } from './bind';
import { AWK } from './awk';
import { DOCKER } from './docker';
import { NC } from './nc';
import { DIFF } from './diff';
import { SCRIPTS } from './scripts';
import { DISKS } from './disks';
import { RSNAPSHOT } from './rsnapshot';
import { POSTGRES } from './postgres';
import { LOGS } from './logs';
import { MEMORY } from './memory';
import { TIME } from './time';
import { SUPERVISION } from './monitoring';
import { TRANSFERS } from './transfers';
import { STOCKAGE } from './storage';
import { LVM } from './lvm';
import { FSTAB } from './fstab';
import { APACHE } from './apache';
import { MAIL } from './mail';
import { ANSIBLE } from './ansible';
import { CADDY } from './caddy';

export interface Context {
  args: string[];
  // Ce qui arrive par un tube (null : rien, la commande est en tête).
  input: string | null;
  game: Shell;
  // Vrai si la sortie va à l'écran (dernière commande, sans redirection).
  last: boolean;
}

export interface Command {
  // Le texte de la page man est dans src/texts/<langue>/manuel.ftl
  // (man-<commande>) ; ici, la partie technique (voir pages.ts).
  // Options courtes acceptées. Si présent, une option inconnue donne le
  // vrai message d'erreur, qui renvoie vers --help.
  options?: string[];
  // Options longues de GNU que le jeu comprend : leur équivalent court (« all » → « a »),
  // ou '' pour une option longue lue telle quelle (--max-depth=1). Les autres :
  // « unrecognized option '--x' », comme les vrais outils.
  long?: Record<string, string>;
  // Commandes d'exemple (leur explication : .exemple-N dans manuel.ftl).
  examples?: string[];
  see?: string[];
  // La commande analyse elle-même ses options (pas de contrôle générique).
  ownOptions?: boolean;
  // Section du manuel : 1 (commandes), 8 (administration, ex. usermod).
  section?: number;
  // Une commande hors du PATH (un plugin de supervision) : on ne la lance que
  // par son chemin complet, dans ce dossier.
  directory?: string;
  launch: (c: Context) => string;
}

export const COMMANDS: Record<string, Command> = {
  ...FILES,
  ...TEXT,
  ...SYSTEM,
  ...NETWORK,
  ...GIT,
  ...SSH,
  ...ACCOUNTS,
  ...COMMANDS_SUDOERS,
  ...TMUX,
  ...LAN,
  ...NFTABLES,
  ...WIREGUARD,
  ...LDAP,
  ...RADIUS,
  ...NMAP,
  ...LYNIS,
  ...SFTP,
  ...LFTP,
  ...SYSTEMD,
  ...EDITOR,
  ...SSHD,
  ...UFW,
  ...SS,
  ...FAIL2BAN,
  ...BACKUP,
  ...APT,
  ...IOSTAT,
  ...UNATTENDED,
  ...CERTBOT,
  ...RESTIC,
  ...BIND,
  ...AWK,
  ...DOCKER,
  ...NC,
  ...DIFF,
  ...SCRIPTS,
  ...DISKS,
  ...STOCKAGE,
  ...LVM,
  ...FSTAB,
  ...RSNAPSHOT,
  ...POSTGRES,
  ...LOGS,
  ...MEMORY,
  ...TIME,
  ...SUPERVISION,
  ...TRANSFERS,
  ...APACHE,
  ...MAIL,
  ...ANSIBLE,
  ...CADDY,
  // Traités par le shell lui-même (voir shell.ts) : une entrée ici pour le
  // manuel et la complétion.
  sudo: { launch: ({ args, game }) => (/^-l+$/.test(args[0] ?? '') ? listSudo(game, args) : '') },
  clear: { launch: () => '' },
  man: { launch: () => '' },
  apropos: { launch: () => '' },
  whatis: { launch: () => '' },
  aide: { launch: () => '' },
};

// Options, exemples et renvois du manuel (pages.ts).
for (const [name, complement] of Object.entries(PAGES)) if (COMMANDS[name]) Object.assign(COMMANDS[name], complement);
