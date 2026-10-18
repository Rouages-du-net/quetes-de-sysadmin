// fail2ban-client (https://manpages.debian.org/bookworm/fail2ban/fail2ban-client.1.en.html) :
// status [prison], set <prison> banip|unbanip <ip>, get <prison> bantime|
// findtime|maxretry|ignoreip, reload, ping, -t (tester la configuration).
// Réservé à root (socket du serveur). Sortie en anglais, comme le vrai outil.

import { echecs, lireConfig, noter, type EtatFail2ban } from '../fail2ban';
import { systemd } from '../systemd';
import type { Commande } from './index';

// Les arbres de fail2ban-client status : « |- » pour un élément, « `- » pour le dernier.
const arbre = (lignes: [string, string][], retrait = '') =>
  lignes.map(([cle, valeur], i) => `${retrait}${i === lignes.length - 1 ? '`-' : '|-'} ${cle}:\t${valeur}`).join('\n');

export const FAIL2BAN: Record<string, Commande> = {
  'fail2ban-client': {
    propresOptions: true,
    lancer: ({ args, jeu }) => {
      const f2b: EtatFail2ban | undefined = jeu.etat.fail2ban;
      if (jeu.qui !== 'root') return jeu.erreur('ERROR  Permission denied to socket: /var/run/fail2ban/fail2ban.sock, (you must be root)');
      if (!f2b) return jeu.erreur('ERROR  Failed to access socket path: /var/run/fail2ban/fail2ban.sock. Is fail2ban running?');
      const [action, prison, sous] = args;
      if (action === '-t' || action === '--test') {
        const { erreurs } = lireConfig(jeu);
        return erreurs.length ? jeu.erreur(erreurs.join('\n')) : 'OK: configuration test is successful';
      }
      const service = systemd(jeu)?.services.fail2ban;
      if (service && service.etat !== 'active') return jeu.erreur('ERROR  Failed to access socket path: /var/run/fail2ban/fail2ban.sock. Is fail2ban running?');
      if (action === 'ping') return 'Server replied: pong';
      if (action === 'reload') {
        // Comme systemctl reload fail2ban : vérifier, puis charger.
        const { erreurs } = lireConfig(jeu);
        if (erreurs.length) return jeu.erreur(erreurs.join('\n'));
        service?.charger?.(jeu);
        return 'OK';
      }
      const actif = f2b.charge?.enabled;
      if (action === 'status' && !prison)
        return ['Status', arbre([['Number of jail', actif ? '1' : '0'], ['Jail list', actif ? 'sshd' : '']])].join('\n');
      if (prison && (prison !== 'sshd' || !actif)) return jeu.erreur(`Sorry but the jail '${prison}' does not exist`);
      if (action === 'status') {
        f2b.consulte = true;
        const total = [...echecs(jeu).values()].reduce((a, b) => a + b, 0);
        return [
          `Status for the jail: ${prison}`,
          '|- Filter',
          arbre([['Currently failed', '0'], ['Total failed', String(total)], ['Journal matches', '_SYSTEMD_UNIT=sshd.service + _COMM=sshd']], '|  '),
          '`- Actions',
          arbre([['Currently banned', String(f2b.bannis.length)], ['Total banned', String(f2b.totalBannis)], ['Banned IP list', f2b.bannis.join(' ')]], '   '),
        ].join('\n');
      }
      if (action === 'set' && (sous === 'banip' || sous === 'unbanip')) {
        const ips = args.slice(3);
        if (!ips.length || ips.some((ip) => !/^\d+\.\d+\.\d+\.\d+$/.test(ip))) return jeu.erreur('ERROR  NOK: (\'Invalid IP address\',)');
        let n = 0;
        for (const ip of ips) {
          const banni = f2b.bannis.includes(ip);
          if (sous === 'unbanip' && banni) {
            f2b.bannis = f2b.bannis.filter((b) => b !== ip);
            noter(jeu, f2b, `Unban ${ip}`);
            n++;
          } else if (sous === 'banip' && !banni) {
            f2b.bannis.push(ip);
            f2b.totalBannis++;
            noter(jeu, f2b, `Ban ${ip}`);
            n++;
          }
        }
        return String(n);
      }
      if (action === 'get' && sous) {
        const p = f2b.charge!;
        if (sous === 'ignoreip') return ['These IP addresses/networks are ignored:', ...p.ignoreip.map((ip, i) => `${i === p.ignoreip.length - 1 ? '`-' : '|-'} ${ip}`)].join('\n');
        if (sous === 'bantime' || sous === 'findtime' || sous === 'maxretry') return String(p[sous]);
      }
      return jeu.erreur('Sorry but the command is invalid');
    },
  },
  // Une page de manuel de la section 5 (fichier de configuration).
  'jail.conf': { section: 5, lancer: () => '' },
};
