// All the game's commands. Each chapter chooses the ones it knows
// (Chapter.commands). A command reads its arguments and the pipe's input,
// returns its output, and reports its errors with game.error().

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
  // What comes in through a pipe (null: nothing, the command is first).
  input: string | null;
  game: Shell;
  // True if the output goes to the screen (last command, without redirection).
  last: boolean;
}

export interface Command {
  // The man page's text is in src/texts/<language>/manual.ftl
  // (man-<command>); here, the technical part (see pages.ts).
  // Short options accepted. If present, an unknown option gives the real
  // error message, which points to --help.
  options?: string[];
  // GNU long options the game understands: their short equivalent ("all" → "a"),
  // or '' for a long option read as is (--max-depth=1). The others:
  // "unrecognized option '--x'", like the real tools.
  long?: Record<string, string>;
  // Example commands (their explanation: .example-N in manual.ftl).
  examples?: string[];
  see?: string[];
  // The command parses its options itself (no generic check).
  ownOptions?: boolean;
  // Manual section: 1 (commands), 8 (administration, e.g. usermod).
  section?: number;
  // A command outside the PATH (a monitoring plugin): it only runs by its
  // full path, in this directory.
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
  // Handled by the shell itself (see shell.ts): an entry here for the
  // manual and completion.
  sudo: { launch: ({ args, game }) => (/^-l+$/.test(args[0] ?? '') ? listSudo(game, args) : '') },
  clear: { launch: () => '' },
  man: { launch: () => '' },
  apropos: { launch: () => '' },
  whatis: { launch: () => '' },
  aide: { launch: () => '' },
};

// The manual's options, examples and cross-references (pages.ts).
for (const [name, complement] of Object.entries(PAGES)) if (COMMANDS[name]) Object.assign(COMMANDS[name], complement);
