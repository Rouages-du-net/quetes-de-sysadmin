// Story "La Veille" — chapter "The priority": two CVEs remain to
// handle (nginx and rsync). The CVSS score alone isn't enough to decide
// what to fix first: it must be crossed with exposure, already
// learnt in "Le périmètre" and "L'exposition" (L'Audit). nginx (80,
// 443) is reachable from the internet; rsync has no listening port (a
// command-line tool, not a service): even with a lower score,
// nginx comes first.
// Objective checked on the state: priority.md ranks nginx before rsync, with
// a justification that cites exposure (not only the score), and
// notes that openssh-server has nothing to do here (already protected).
// Expected traps: ranking only by decreasing CVSS score (rsync
// before nginx).
// Sources: https://man7.org/linux/man-pages/man8/ss.8.html,
// https://nmap.org/book/man.html, https://www.first.org/cvss/

import { path, f, type Chapter } from '../world';
import type { Game } from '../shell';
import { newSystemd } from '../systemd';
import { CVE, M, NOW, PASSWORD, watchApt, watchAccounts, watchListening, initialiseWatch, watchWorld, watchNginx, watchScan, serviceSsh } from './watch';

const DOC = `${M}/priority.md`;
const STARTED = NOW - 11 * 86_400_000;

const readDoc = (j: Game) => j.read(path(j.t, DOC)) ?? '';
const text = (j: Game) => readDoc(j).toLowerCase();
const words = (j: Game, key: string) => j.t(key).split(',').map((m) => m.trim().toLowerCase());

const okTemplate = (j: Game) => !text(j).includes(j.t('priority-a-complete').toLowerCase());
const okCity = (j: Game) => text(j).includes(CVE.nginx.id.toLowerCase()) && text(j).includes(CVE.rsync.id.toLowerCase());
const order = (j: Game) => {
  const t = text(j);
  const i1 = t.indexOf(CVE.nginx.id.toLowerCase());
  const i2 = t.indexOf(CVE.rsync.id.toLowerCase());
  return i1 >= 0 && i2 >= 0 ? i1 - i2 : null;
};
const okOrder = (j: Game) => (order(j) ?? 1) < 0;
const onlyScore = (j: Game) => okCity(j) && !okOrder(j);
const okExposure = (j: Game) => words(j, 'priority-words-expose').some((m) => text(j).includes(m)) && words(j, 'priority-words-local').some((m) => text(j).includes(m));
const sshOk = (j: Game) => text(j).includes(CVE.ssh.id.toLowerCase()) && words(j, 'priority-words-protected').some((m) => text(j).includes(m));
const docOk = (j: Game) => okTemplate(j) && okCity(j) && okOrder(j) && okExposure(j) && sshOk(j);

const missing = (j: Game): string[] => {
  const m: string[] = [];
  if (!okTemplate(j)) m.push('template');
  if (!okCity(j) || !okOrder(j)) m.push('order');
  if (okCity(j) && okOrder(j) && !okExposure(j)) m.push('exposure');
  if (okCity(j) && okOrder(j) && okExposure(j) && !sshOk(j)) m.push('ssh');
  return m;
};

export const priority: Chapter = {
  id: 'priority',
  number: 2,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'nano', 'sudo', 'id', 'whoami', 'ss', 'nmap'],
  home: M,
  welcome: 'email_salome.txt',
  names: true,
  final: 'end',
  steps: ['expose', 'order', 'end'],
  password: PASSWORD,
  accounts: watchAccounts,
  state: () => ({
    sshd: { load: {}, connectionsToLoad: 1, reloads: 0 },
    listening: watchListening(),
    nginx: watchNginx(),
    scan: watchScan(),
    apt: watchApt(false),
    systemd: newSystemd('petrin', STARTED, NOW, {
      ssh: serviceSsh(),
      nginx: { description: 'A high performance web server and a reverse proxy server', active: true, executable: 'nginx' },
      cron: { description: 'Regular background program processing daemon', active: true, executable: 'cron' },
    }),
  }),
  initialise: initialiseWatch,
  createWorld: (t) =>
    watchWorld(t, {
      home: { 'email_salome.txt': f(t('priority-email-salome')), 'priority.md': f(t('priority-template'), { lines: true }) },
    }),
  afterCommand: (j) => {
    const text = readDoc(j);
    if (text === j.state.readPriority || j.state.finishedPriority) return;
    j.state.readPriority = text;
    if (onlyScore(j)) return j.t('priority-event-score-only');
    const rest = missing(j);
    if (!rest.length) {
      j.state.finishedPriority = true;
      return;
    }
    return [j.t('priority-review'), ...rest.map((m) => `- ${j.t(`priority-missing-${m}`)}`)].join('\n');
  },
  events: [
    {
      id: 'expose',
      condition: (j) => j.last.commands.some((c) => c[0] === 'ss' || c[0] === 'nmap') && (/:(80|443)\b/.test(j.last.output) || /80\/tcp|443\/tcp/.test(j.last.output)),
      message: (j) => j.t('priority-event-expose'),
    },
    { id: 'order', condition: docOk, message: (j) => j.t('priority-event-order') },
    { id: 'end', condition: docOk, message: (j) => j.t('priority-event-end') },
  ],
};
