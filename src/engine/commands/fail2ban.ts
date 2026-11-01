// fail2ban-client (https://manpages.debian.org/bookworm/fail2ban/fail2ban-client.1.en.html):
// status [jail], set <jail> banip|unbanip <ip>, unban <ip>, get <jail>
// bantime|findtime|maxretry|ignoreip|logpath, reload, ping, -t (test the
// configuration). Several jails (sshd, nginx-limit-req, recidive…).
// Reserved for root (the server's socket). Output in English, like the real tool.

import { actives, bannedFor, failuresFor, readConfig, note, type Fail2banState } from '../fail2ban';
import { systemd } from '../systemd';
import type { Command } from './index';

// The trees of fail2ban-client status: "|- " for an item, "`- " for the last one.
const tree = (lines: [string, string][], indent = '') =>
  lines.map(([key, value], i) => `${indent}${i === lines.length - 1 ? '`-' : '|-'} ${key}:\t${value}`).join('\n');

export const FAIL2BAN: Record<string, Command> = {
  'fail2ban-client': {
    ownOptions: true,
    launch: ({ args, game }) => {
      const f2b: Fail2banState | undefined = game.state.fail2ban;
      if (game.who !== 'root') return game.error('ERROR  Permission denied to socket: /var/run/fail2ban/fail2ban.sock, (you must be root)');
      if (!f2b) return game.error('ERROR  Failed to access socket path: /var/run/fail2ban/fail2ban.sock. Is fail2ban running?');
      const [action, jail, under] = args;
      if (action === '-t' || action === '--test') {
        const { errors } = readConfig(game);
        return errors.length ? game.error(errors.join('\n')) : 'OK: configuration test is successful';
      }
      const service = systemd(game)?.services.fail2ban;
      if (service && service.state !== 'active') return game.error('ERROR  Failed to access socket path: /var/run/fail2ban/fail2ban.sock. Is fail2ban running?');
      if (action === 'ping') return 'Server replied: pong';
      if (action === 'reload') {
        // Like systemctl reload fail2ban: check, then load.
        const { errors } = readConfig(game);
        if (errors.length) return game.error(errors.join('\n'));
        service?.load?.(game);
        return 'OK';
      }
      const jails = actives(f2b);
      const names = jails.map((p) => p.name).sort();
      if (action === 'status' && !jail) return ['Status', tree([['Number of jail', String(names.length)], ['Jail list', names.join(', ')]])].join('\n');
      // unban: lift an address's ban in every jail.
      if (action === 'unban' && jail) {
        if (args.slice(1).some((ip) => !/^\d+\.\d+\.\d+\.\d+$/.test(ip))) return game.error('ERROR  NOK: (\'Invalid IP address\',)');
        const ips = args.slice(1);
        let n = 0;
        for (const q of jails)
          for (const ip of ips) {
            const banned = bannedFor(f2b, q.name);
            if (banned.includes(ip)) {
              banned.splice(banned.indexOf(ip), 1);
              note(game, f2b, `Unban ${ip}`, q.name);
              n++;
            }
          }
        return String(n);
      }
      const p = jails.find((q) => q.name === jail);
      if (jail && !p) return game.error(`Sorry but the jail '${jail}' does not exist`);
      if (action === 'status' && p) {
        f2b.consulted = true;
        const banned = bannedFor(f2b, p.name);
        const total = [...failuresFor(game, p).values()].reduce((a, b) => a + b, 0);
        const source: [string, string] = p.log ? ['File list', p.log.replace('*', '')] : ['Journal matches', '_SYSTEMD_UNIT=sshd.service + _COMM=sshd'];
        return [
          `Status for the jail: ${p.name}`,
          '|- Filter',
          tree([['Currently failed', '0'], ['Total failed', String(total)], source], '|  '),
          '`- Actions',
          tree(
            [
              ['Currently banned', String(banned.length)],
              ['Total banned', String(p.name === 'sshd' ? f2b.bannedTotal : (f2b.other?.[p.name]?.total ?? 0))],
              ['Banned IP list', banned.join(' ')],
            ],
            '   ',
          ),
        ].join('\n');
      }
      if (action === 'set' && p && (under === 'banip' || under === 'unbanip')) {
        const ips = args.slice(3);
        if (!ips.length || ips.some((ip) => !/^\d+\.\d+\.\d+\.\d+$/.test(ip))) return game.error('ERROR  NOK: (\'Invalid IP address\',)');
        const banned = bannedFor(f2b, p.name);
        let n = 0;
        for (const ip of ips) {
          const i = banned.indexOf(ip);
          if (under === 'unbanip' && i >= 0) {
            banned.splice(i, 1);
            note(game, f2b, `Unban ${ip}`, p.name);
            n++;
          } else if (under === 'banip' && i < 0) {
            banned.push(ip);
            if (p.name === 'sshd') f2b.bannedTotal++;
            else f2b.other![p.name].total++;
            note(game, f2b, `Ban ${ip}`, p.name);
            n++;
          }
        }
        return String(n);
      }
      if (action === 'get' && p && under) {
        if (under === 'ignoreip') return ['These IP addresses/networks are ignored:', ...p.ignoreip.map((ip, i) => `${i === p.ignoreip.length - 1 ? '`-' : '|-'} ${ip}`)].join('\n');
        if (under === 'bantime' || under === 'findtime' || under === 'maxretry') return String(p[under]);
        if (under === 'logpath') return p.log ? `Current monitored log file(s):\n\`- ${p.log.replace('*', '')}` : 'No file is currently monitored';
      }
      return game.error('Sorry but the command is invalid');
    },
  },
  // A section 5 manual page (configuration file).
  'jail.conf': { section: 5, launch: () => '' },
};
