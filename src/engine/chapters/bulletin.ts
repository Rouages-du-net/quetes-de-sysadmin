// Story "The Watch", chapter "The Bulletin": every week, a
// security bulletin (like Debian's advisories) lists several CVEs. Before
// worrying, you must check that each one REALLY concerns this server:
// a package that isn't installed, or already at a version beyond the fixed one, is
// not an alert. Two CVEs concern Le Fournil (nginx, rsync); one is
// not installed (certbot); one is already fixed by a previous
// update (curl); one applies in theory but changes nothing here
// (openssh-server: KbdInteractiveAuthentication is already "no").
// Objective checked on the state: the triage in veille.md puts each CVE on the
// right side. Expected traps: classing certbot (absent) as relevant,
// classing curl (already fixed) as relevant, forgetting nginx or rsync.
// Sources: https://www.debian.org/security/, https://www.cve.org/,
// https://www.first.org/cvss/calculator/4-0

import { path, f, name, type Chapter } from '../world';
import type { Game } from '../shell';
import { newSystemd } from '../systemd';
import { CVE, M, NOW, PASSWORD, watchApt, watchAccounts, watchListening, initialiseWatch, watchWorld, watchNginx, watchScan, sectionsMd, serviceSsh } from './watch';

const DOC = `${M}/watch.md`;
const SECTIONS = ['affected', 'not-applicable'];
// Ten days before the chapter starts: the machine has already been running for a while.
const STARTED = NOW - 10 * 86_400_000;

const readDoc = (j: Game) => j.read(path(j.t, DOC));
const sections = (j: Game) => sectionsMd(j, readDoc(j) ?? '', 'bulletin-section', SECTIONS);
const words = (j: Game, key: string) => j.t(key).split(',').map((m) => m.trim().toLowerCase());

const concernsOk = (j: Game) => {
  const s = (sections(j).affected ?? '').toLowerCase();
  const withoutObject = (sections(j)['not-applicable'] ?? '').toLowerCase();
  return (
    [CVE.nginx.id, CVE.rsync.id, CVE.ssh.id].every((id) => s.includes(id.toLowerCase())) &&
    ![CVE.certbot.id, CVE.curl.id].some((id) => s.includes(id.toLowerCase())) &&
    !withoutObject.includes(CVE.nginx.id.toLowerCase()) &&
    !withoutObject.includes(CVE.rsync.id.toLowerCase())
  );
};
const withoutOkObject = (j: Game) => {
  const s = (sections(j)['not-applicable'] ?? '').toLowerCase();
  return (
    s.includes(CVE.certbot.id.toLowerCase()) &&
    s.includes(CVE.curl.id.toLowerCase()) &&
    words(j, 'bulletin-words-missing').some((m) => s.includes(m)) &&
    words(j, 'bulletin-words-fixed').some((m) => s.includes(m))
  );
};
const okTemplate = (j: Game) => !(readDoc(j) ?? '').toLowerCase().includes(j.t('bulletin-a-complete').toLowerCase());
const okSort = (j: Game) => okTemplate(j) && concernsOk(j) && withoutOkObject(j);

const missing = (j: Game): string[] => {
  const m: string[] = [];
  if (!okTemplate(j)) m.push('template');
  if (!concernsOk(j)) m.push('concerns');
  if (!withoutOkObject(j)) m.push('not-applicable');
  return m;
};

export const bulletin: Chapter = {
  id: 'bulletin',
  number: 1,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'nano', 'sudo', 'id', 'whoami', 'apt'],
  home: M,
  welcome: 'email_salome.txt',
  names: true,
  final: 'end',
  steps: ['read', 'sort', 'end'],
  password: PASSWORD,
  accounts: watchAccounts,
  state: () => ({
    sshd: { load: {}, connectionsToLoad: 1, reloads: 0 },
    listening: watchListening(),
    nginx: watchNginx(),
    scan: watchScan(),
    apt: watchApt(),
    systemd: newSystemd('petrin', STARTED, NOW, {
      ssh: serviceSsh(),
      nginx: { description: 'A high performance web server and a reverse proxy server', active: true, executable: 'nginx' },
      cron: { description: 'Regular background program processing daemon', active: true, executable: 'cron' },
    }),
  }),
  initialise: initialiseWatch,
  createWorld: (t) =>
    watchWorld(t, {
      home: { 'email_salome.txt': f(t('bulletin-email-salome')), 'security_bulletin.txt': f(t('bulletin-file'), { lines: true }), 'watch.md': f(t('bulletin-template'), { lines: true }) },
    }),
  afterCommand: (j) => {
    const text = readDoc(j);
    if (text === j.state.readWatch || j.state.finishedWatch) return;
    j.state.readWatch = text;
    const rest = missing(j);
    if (!rest.length) {
      j.state.finishedWatch = true;
      return;
    }
    return [j.t('bulletin-review'), ...rest.map((m) => `- ${j.t(`bulletin-missing-${m}`)}`)].join('\n');
  },
  events: [
    {
      id: 'read',
      condition: (j) => j.last.commands.some((c) => c.some((a) => a.endsWith(name(j.t, 'security_bulletin.txt')))),
      message: (j) => j.t('bulletin-event-read'),
    },
    { id: 'sort', condition: okSort, message: (j) => j.t('bulletin-event-sort') },
    { id: 'end', condition: okSort, message: (j) => j.t('bulletin-event-end') },
  ],
};

