// sshd -t (vérifier la configuration) et sshd -T (afficher la configuration
// qui serait appliquée), d'après https://man.openbsd.org/sshd.
// Comme le vrai sshd, il faut être root (lecture des clés d'hôte).
// Messages d'OpenSSH, en anglais.

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
  // Une page de manuel de la section 5 (fichiers) : ce n'est pas une commande.
  sshd_config: { section: 5, launch: () => '' },
};
