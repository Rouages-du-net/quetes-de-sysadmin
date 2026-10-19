// fail2ban-client (https://manpages.debian.org/bookworm/fail2ban/fail2ban-client.1.en.html) :
// status [prison], set <prison> banip|unbanip <ip>, unban <ip>, get <prison>
// bantime|findtime|maxretry|ignoreip|logpath, reload, ping, -t (tester la
// configuration). Plusieurs prisons (sshd, nginx-limit-req, recidive…).
// Réservé à root (socket du serveur). Sortie en anglais, comme le vrai outil.

import { actives, bannisDe, echecsDe, lireConfig, noter, type EtatFail2ban } from '../fail2ban';
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
      const prisons = actives(f2b);
      const noms = prisons.map((p) => p.nom).sort();
      if (action === 'status' && !prison) return ['Status', arbre([['Number of jail', String(noms.length)], ['Jail list', noms.join(', ')]])].join('\n');
      // unban : lever le bannissement d'une adresse dans toutes les prisons.
      if (action === 'unban' && prison) {
        if (args.slice(1).some((ip) => !/^\d+\.\d+\.\d+\.\d+$/.test(ip))) return jeu.erreur('ERROR  NOK: (\'Invalid IP address\',)');
        const ips = args.slice(1);
        let n = 0;
        for (const q of prisons)
          for (const ip of ips) {
            const bannis = bannisDe(f2b, q.nom);
            if (bannis.includes(ip)) {
              bannis.splice(bannis.indexOf(ip), 1);
              noter(jeu, f2b, `Unban ${ip}`, q.nom);
              n++;
            }
          }
        return String(n);
      }
      const p = prisons.find((q) => q.nom === prison);
      if (prison && !p) return jeu.erreur(`Sorry but the jail '${prison}' does not exist`);
      if (action === 'status' && p) {
        f2b.consulte = true;
        const bannis = bannisDe(f2b, p.nom);
        const total = [...echecsDe(jeu, p).values()].reduce((a, b) => a + b, 0);
        const source: [string, string] = p.journal ? ['File list', p.journal.replace('*', '')] : ['Journal matches', '_SYSTEMD_UNIT=sshd.service + _COMM=sshd'];
        return [
          `Status for the jail: ${p.nom}`,
          '|- Filter',
          arbre([['Currently failed', '0'], ['Total failed', String(total)], source], '|  '),
          '`- Actions',
          arbre(
            [
              ['Currently banned', String(bannis.length)],
              ['Total banned', String(p.nom === 'sshd' ? f2b.totalBannis : (f2b.autres?.[p.nom]?.total ?? 0))],
              ['Banned IP list', bannis.join(' ')],
            ],
            '   ',
          ),
        ].join('\n');
      }
      if (action === 'set' && p && (sous === 'banip' || sous === 'unbanip')) {
        const ips = args.slice(3);
        if (!ips.length || ips.some((ip) => !/^\d+\.\d+\.\d+\.\d+$/.test(ip))) return jeu.erreur('ERROR  NOK: (\'Invalid IP address\',)');
        const bannis = bannisDe(f2b, p.nom);
        let n = 0;
        for (const ip of ips) {
          const i = bannis.indexOf(ip);
          if (sous === 'unbanip' && i >= 0) {
            bannis.splice(i, 1);
            noter(jeu, f2b, `Unban ${ip}`, p.nom);
            n++;
          } else if (sous === 'banip' && i < 0) {
            bannis.push(ip);
            if (p.nom === 'sshd') f2b.totalBannis++;
            else f2b.autres![p.nom].total++;
            noter(jeu, f2b, `Ban ${ip}`, p.nom);
            n++;
          }
        }
        return String(n);
      }
      if (action === 'get' && p && sous) {
        if (sous === 'ignoreip') return ['These IP addresses/networks are ignored:', ...p.ignoreip.map((ip, i) => `${i === p.ignoreip.length - 1 ? '`-' : '|-'} ${ip}`)].join('\n');
        if (sous === 'bantime' || sous === 'findtime' || sous === 'maxretry') return String(p[sous]);
        if (sous === 'logpath') return p.journal ? `Current monitored log file(s):\n\`- ${p.journal.replace('*', '')}` : 'No file is currently monitored';
      }
      return jeu.erreur('Sorry but the command is invalid');
    },
  },
  // Une page de manuel de la section 5 (fichier de configuration).
  'jail.conf': { section: 5, lancer: () => '' },
};
