// sshd -t (vérifier la configuration) et sshd -T (afficher la configuration
// qui serait appliquée), d'après https://man.openbsd.org/sshd.
// Comme le vrai sshd, il faut être root (lecture des clés d'hôte).
// Messages d'OpenSSH, en anglais.

import { afficherConfig, CONFIG, lireConfig } from '../sshd';
import type { Commande } from './index';

export const SSHD: Record<string, Commande> = {
  sshd: {
    propresOptions: true,
    lancer: ({ args, jeu }) => {
      let fichier = CONFIG;
      let mode: 't' | 'T' | null = null;
      for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a === '-t' || a === '-T') mode = a[1] as 't' | 'T';
        else if (a === '-f') fichier = args[++i] ?? '';
        else if (/^-./.test(a)) return jeu.erreur(`sshd: illegal option -- ${a[1]}\nusage: sshd [-46DdeGiqTtV] [-C connection_spec] [-c host_cert_file]\n            [-E log_file] [-f config_file] [-g login_grace_time]\n            [-h host_key_file] [-o option] [-p port] [-u len]`);
      }
      if (!mode) return jeu.erreur('sshd re-exec requires execution with an absolute path');
      if (jeu.qui !== 'root') return jeu.erreur('sshd: no hostkeys available -- exiting.');
      if (!jeu.existe(fichier)) return jeu.erreur(`${fichier}: No such file or directory`);
      const config = lireConfig(jeu, fichier);
      if (config.erreurs.length) return jeu.erreur(config.erreurs.join('\n'));
      return mode === 'T' ? afficherConfig(config) : '';
    },
  },
  // Une page de manuel de la section 5 (fichiers) : ce n'est pas une commande.
  sshd_config: { section: 5, lancer: () => '' },
};
