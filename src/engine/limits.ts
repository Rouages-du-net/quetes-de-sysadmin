// A process's resource limits (here, the number of open files: RLIMIT_NOFILE).
// Each process has a soft limit (what it may use) and a hard limit (the
// ceiling up to which it may raise its soft limit itself; only root may
// raise the hard one). A process inherits its parent's; systemd sets those
// of a service when it starts it (LimitNOFILE=, by default 1024 soft and
// 524288 hard); a login session gets them from pam_limits
// (/etc/security/limits.conf), which systemd services never go through.
// Sources: https://man7.org/linux/man-pages/man2/getrlimit.2.html,
// https://www.freedesktop.org/software/systemd/man/latest/systemd.exec.html#LimitCPU=,
// https://man7.org/linux/man-pages/man5/proc_pid_limits.5.html
// Simplification: only the open-files limit is modelled; the other lines of
// /proc/PID/limits are those of a Debian machine.

import type { Process } from './commands/system';

export interface Limit {
  soft: number;
  hard: number;
}

// systemd's default for services (DefaultLimitNOFILE=1024:524288).
export const SERVICE_NOFILE: Limit = { soft: 1024, hard: 524288 };
// A login shell on Debian (soft 1024, hard 1048576).
export const SHELL_NOFILE: Limit = { soft: 1024, hard: 1048576 };

export const nofileOf = (p: Process | undefined): Limit => p?.nofile ?? SERVICE_NOFILE;

/** "4096", "4096:524288", "infinity" (LimitNOFILE=, prlimit) → the limit; null if unreadable. */
export function readLimit(text: string, current?: Limit): Limit | null {
  const one = (x: string) => (x === 'infinity' || x === 'unlimited' ? Infinity : /^\d+$/.test(x) ? Number(x) : null);
  const t = text.trim();
  if (!t.includes(':')) {
    const n = one(t);
    return n === null ? null : { soft: n, hard: n };
  }
  const [a, b] = t.split(':');
  // prlimit: an empty side keeps the current value.
  const soft = a === '' ? (current?.soft ?? null) : one(a);
  const hard = b === '' ? (current?.hard ?? null) : one(b);
  return soft === null || hard === null || soft > hard ? null : { soft, hard };
}

const show = (n: number) => (n === Infinity ? 'unlimited' : String(n));

/** The text of /proc/PID/limits (Debian's values, the open files those of the process). */
export function limitsFile(p: Process): string {
  const n = nofileOf(p);
  const row = (name: string, soft: string, hard: string, units = '') => `${name.padEnd(26)}${soft.padEnd(21)}${hard.padEnd(21)}${units}`.trimEnd();
  return [
    row('Limit', 'Soft Limit', 'Hard Limit', 'Units'),
    row('Max cpu time', 'unlimited', 'unlimited', 'seconds'),
    row('Max file size', 'unlimited', 'unlimited', 'bytes'),
    row('Max data size', 'unlimited', 'unlimited', 'bytes'),
    row('Max stack size', '8388608', 'unlimited', 'bytes'),
    row('Max core file size', '0', 'unlimited', 'bytes'),
    row('Max resident set', 'unlimited', 'unlimited', 'bytes'),
    row('Max processes', '15391', '15391', 'processes'),
    row('Max open files', show(n.soft), show(n.hard), 'files'),
    row('Max locked memory', '8388608', '8388608', 'bytes'),
    row('Max address space', 'unlimited', 'unlimited', 'bytes'),
    row('Max file locks', 'unlimited', 'unlimited', 'locks'),
    row('Max pending signals', '15391', '15391', 'signals'),
    row('Max msgqueue size', '819200', '819200', 'bytes'),
    row('Max nice priority', '0', '0'),
    row('Max realtime priority', '0', '0'),
    row('Max realtime timeout', 'unlimited', 'unlimited', 'us'),
  ].join('\n');
}

export { show as showLimit };
