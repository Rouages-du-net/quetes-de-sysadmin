// Story "The Watch" — chapter "No Proof, No Certainty": a fix that has not
// been checked is only an intention (the lesson of "The Follow-up Visit",
// again). We prove again that nginx and rsync are up to date, and look in
// the logs for whether someone had already tried to exploit nginx's HTTP/2
// flaw before the fix: an empty HTTP/2 request, with no header, that nginx
// refused (400), but that is worth noting.
// Objective checked on the state: both packages confirmed up to date (apt
// list --upgradable empty), the attempt found in access.log (grep), and the
// site still served.
// Sources: https://manpages.debian.org/trixie/apt/apt.8.en.html,
// https://nginx.org/en/docs/http/ngx_http_log_module.html

import { f, type Chapter } from '../world';
import type { Game } from '../shell';
import { newSystemd } from '../systemd';
import type { AptState } from '../commands/apt';
import { CVE, M, NOW, PASSWORD, watchApt, watchAccounts, watchListening, initialiseWatch, watchWorld, watchNginx, watchScan, serviceSsh } from './watch';

const STARTED = NOW - 13 * 86_400_000;
const SUSPICIOUS = '203.0.113.77';

// An ordinary access log, with a suspicious attempt before the fix: an
// empty HTTP/2 request, with no declared browser, refused by nginx (400).
const ACCESS = `192.0.2.44 - - [05/Sep/2028:09:12:33 +0200] "GET / HTTP/1.1" 200 612 "-" "Mozilla/5.0 (X11; Linux x86_64)"
192.0.2.51 - - [06/Sep/2028:11:40:02 +0200] "GET / HTTP/1.1" 200 612 "-" "Mozilla/5.0 (Android 14)"
${SUSPICIOUS} - - [09/Sep/2028:02:14:07 +0200] "GET / HTTP/2.0" 400 0 "-" "-"
192.0.2.60 - - [11/Sep/2028:08:03:51 +0200] "GET / HTTP/1.1" 200 612 "-" "Mozilla/5.0 (Macintosh)"
192.0.2.44 - - [14/Sep/2028:17:22:09 +0200] "GET / HTTP/1.1" 200 612 "-" "Mozilla/5.0 (X11; Linux x86_64)"`;

const apt = (j: Game) => j.state.apt as AptState;
const okUpToDate = (j: Game) => apt(j).installed.nginx === CVE.nginx.corrigee && apt(j).installed.rsync === CVE.rsync.corrigee;
const okFound = (j: Game) =>
  j.last.commands.some((c) => ['grep', 'cat', 'less', 'head', 'tail'].includes(c[0])) && j.last.output.includes(SUSPICIOUS);
const siteOk = (j: Game) => j.last.commands.some((c) => c[0] === 'curl') && /200/.test(j.last.output);

export const proof: Chapter = {
  id: 'proof',
  number: 4,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'wc', 'sudo', 'id', 'whoami', 'apt', 'curl', 'nano'],
  home: M,
  welcome: 'email_salome.txt',
  names: true,
  final: 'end',
  steps: ['versions', 'found', 'end'],
  password: PASSWORD,
  accounts: watchAccounts,
  state: (t) => ({
    sshd: { load: {}, connectionsToLoad: 1, reloads: 0 },
    listening: watchListening(),
    nginx: watchNginx(t),
    scan: watchScan(t),
    apt: { ...watchApt(true), installed: { ...watchApt(true).installed, nginx: CVE.nginx.corrigee, rsync: CVE.rsync.corrigee }, updates: {} },
    systemd: newSystemd('kneader', STARTED, NOW, {
      ssh: serviceSsh(),
      nginx: { description: 'A high performance web server and a reverse proxy server', active: true, executable: 'nginx' },
      cron: { description: 'Regular background program processing daemon', active: true, executable: 'cron' },
    }),
  }),
  initialise: initialiseWatch,
  createWorld: (t) =>
    watchWorld(t, {
      home: { 'email_salome.txt': f(t('proof-email-salome')) },
      logAccess: ACCESS,
    }),
  events: [
    {
      id: 'versions',
      condition: (j) => j.last.commands.some((c) => c[0] === 'apt') && okUpToDate(j) && /Listing\.\.\. Done/.test(j.last.output),
      message: (j) => j.t('proof-event-versions'),
    },
    { id: 'found', condition: okFound, message: (j) => j.t('proof-event-found', { address: SUSPICIOUS }) },
    { id: 'end', condition: (j) => okUpToDate(j) && j.flags.has('found') && siteOk(j), message: (j) => j.t('proof-event-end') },
  ],
};
