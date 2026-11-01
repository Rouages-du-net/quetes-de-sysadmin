// sshd -t (check the configuration) and sshd -T (show the configuration
// that would be applied), after https://man.openbsd.org/sshd.
// Like the real sshd, you must be root (reading the host keys).
// OpenSSH's messages, in English.

import { showConfig, CONFIG, readConfig } from '../sshd';
import type { Command } from './index';

export const SSHD: Record<string, Command> = {
  sshd: {
    ownOptions: true,
    launch: ({ args, game }) => {
      let file = CONFIG;
      let mode: 't' | 'T' | null = null;
      for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a === '-t' || a === '-T') mode = a[1] as 't' | 'T';
        else if (a === '-f') file = args[++i] ?? '';
        else if (/^-./.test(a)) return game.error(`sshd: illegal option -- ${a[1]}\nusage: sshd [-46DdeGiqTtV] [-C connection_spec] [-c host_cert_file]\n            [-E log_file] [-f config_file] [-g login_grace_time]\n            [-h host_key_file] [-o option] [-p port] [-u len]`);
      }
      if (!mode) return game.error('sshd re-exec requires execution with an absolute path');
      if (game.who !== 'root') return game.error('sshd: no hostkeys available -- exiting.');
      if (!game.exists(file)) return game.error(`${file}: No such file or directory`);
      const config = readConfig(game, file);
      if (config.errors.length) return game.error(config.errors.join('\n'));
      return mode === 'T' ? showConfig(config) : '';
    },
  },
  // A manual page from section 5 (files): it isn't a command.
  sshd_config: { section: 5, launch: () => '' },
};
