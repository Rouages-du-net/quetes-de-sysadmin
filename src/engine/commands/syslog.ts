// logger (util-linux) and rsyslogd -N1, on the model of ../rsyslog.ts.
// After https://man7.org/linux/man-pages/man1/logger.1.html and
// https://www.rsyslog.com/doc/configuration/index.html (rsyslogd -N1, the
// configuration check).
// Differences: logger sends to the local rsyslog only (-n/--server not
// simulated); rsyslogd only knows -N (and -f for another file).

import type { Shell } from '../shell';
import type { Command } from './index';
import { FACILITIES, processMessage, rsyslog, SEVERITIES, validate } from '../rsyslog';

function logger(game: Shell, args: string[]): string {
  let tag = game.player;
  let facility = 'user';
  let severity = 'notice';
  const words: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-t' || a === '--tag') tag = args[++i] ?? tag;
    else if (a === '-p' || a === '--priority') {
      const [f, s] = (args[++i] ?? '').split('.');
      if (!FACILITIES.includes(f) || !SEVERITIES.includes(s)) return game.error(`logger: unknown priority name: ${args[i]}`);
      facility = f;
      severity = s;
    } else if (a === '-i' || a === '--id' || a === '-s' || a === '--stderr') continue;
    else if (a.startsWith('-') && a !== '--') return game.error(`logger: invalid option -- '${a.replace(/^-+/, '')[0]}'\nTry 'logger --help' for more information.`);
    else if (a !== '--') words.push(a);
  }
  const text = words.join(' ');
  if (!text) return game.error('logger: no message given (use logger -h for help)');
  processMessage(game, { host: game.hostName ?? 'localhost', address: '127.0.0.1', program: tag, facility, severity, text });
  return '';
}

export const SYSLOG: Record<string, Command> = {
  // Manual pages only (configuration files).
  'rsyslog.conf': { section: 5, launch: () => '' },
  'journald.conf': { section: 5, launch: () => '' },
  logger: { ownOptions: true, launch: ({ args, game }) => logger(game, args) },
  rsyslogd: {
    ownOptions: true,
    section: 8,
    launch: ({ args, game }) => {
      if (!args.some((a) => /^-N\d?$/.test(a))) return game.error('rsyslogd: already running (pid 611): use systemctl to restart it, or rsyslogd -N1 to check the configuration');
      if (!rsyslog(game)) return game.error('rsyslogd: command not found');
      const { output, ok } = validate(game);
      if (!ok) game.status = 1;
      return output;
    },
  },
};
