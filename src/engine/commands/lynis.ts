// lynis (https://cisofy.com/documentation/lynis/), the server audit
// tool: "lynis audit system". Output in English, like the real tool;
// it is read in src/engine/lynis.ts. After the audit, /var/log/lynis-report.dat
// keeps the findings (hardening_index=, warning[]=, suggestion[]=).

import { audit, VERSION_LYNIS, REPORT, LOG } from '../lynis';
import type { Command } from './index';

export const LYNIS: Record<string, Command> = {
  lynis: {
    section: 8,
    ownOptions: true,
    launch: ({ args, game }) => {
      const [action, ...rest] = args;
      if (action === '--version' || action === '-V' || (action === 'show' && rest[0] === 'version')) return VERSION_LYNIS;
      if (action === 'audit' && rest[0] === 'system') {
        if (game.who !== 'root') return game.error(game.t('lynis-without-root'), 1);
        const r = audit(game);
        const rights = { type: 'file' as const, lines: true, owner: 'root', mode: 'rw-------' };
        game.place('lynis', REPORT, { ...rights, content: r.report });
        game.place('lynis', LOG, { ...rights, content: `# Lynis ${VERSION_LYNIS}\n${r.report}` });
        game.state.lynis = { hint: r.hint, ids: r.findings.map((c) => c.id), warnings: r.findings.filter((c) => c.type === 'warning').length };
        return r.output;
      }
      if (action === 'audit') return game.error(game.t('lynis-audit-target', { target: rest[0] ?? '' }), 1);
      if (!action) return game.error(game.t('lynis-usage'), 1);
      return game.error(game.t('lynis-command-unknown', { command: action }), 1);
    },
  },
};
