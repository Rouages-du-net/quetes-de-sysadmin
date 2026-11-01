// Story "La Veille" — chapter "The fix": fix nginx and rsync, in the order
// decided in the previous chapter, without breaking anything. apt upgrade
// installs both fixes at once (Debian packages are not updated one by one),
// but the list must still be refreshed first: without apt update, apt
// upgrade finds nothing to do.
// Objective checked on the state: nginx and rsync at the fixed version, and
// Le Fournil's site still served (curl).
// Expected traps: apt upgrade without apt update first ("0 upgraded").
// Sources: https://manpages.debian.org/trixie/apt/apt.8.en.html

import { f, type Chapter } from '../world';
import type { Game } from '../shell';
import { newSystemd } from '../systemd';
import type { AptState } from '../commands/apt';
import { CVE, M, NOW, PASSWORD, watchApt, watchAccounts, watchListening, initialiseWatch, watchWorld, watchNginx, watchScan, serviceSsh } from './watch';

const STARTED = NOW - 12 * 86_400_000;

const apt = (j: Game) => j.state.apt as AptState;
const nginxOk = (j: Game) => apt(j).installed.nginx === CVE.nginx.corrigee;
const rsyncOk = (j: Game) => apt(j).installed.rsync === CVE.rsync.corrigee;
const okFixed = (j: Game) => nginxOk(j) && rsyncOk(j);
// An attempt at apt upgrade without apt update first (0 updates found).
const triesWithoutUpdate = (j: Game) =>
  j.last.commands.some((c) => c[0] === 'apt' && (c[1] === 'upgrade' || c[1] === 'full-upgrade')) && /Upgrading: 0/.test(j.last.output) && !okFixed(j);
const siteOk = (j: Game) => j.last.commands.some((c) => c[0] === 'curl') && /200/.test(j.last.output);

export const fix: Chapter = {
  id: 'fix',
  number: 3,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'sudo', 'id', 'whoami', 'apt', 'curl', 'systemctl'],
  home: M,
  welcome: 'email_salome.txt',
  names: true,
  final: 'end',
  steps: ['fixed', 'checked', 'end'],
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
      home: { 'email_salome.txt': f(t('fix-email-salome')) },
    }),
  events: [
    { id: 'without-update', condition: triesWithoutUpdate, message: (j) => j.t('fix-event-without-update') },
    { id: 'fixed', condition: okFixed, message: (j) => j.t('fix-event-fixed') },
    { id: 'checked', condition: (j) => okFixed(j) && siteOk(j), message: (j) => j.t('fix-event-checked') },
    { id: 'end', condition: (j) => okFixed(j) && siteOk(j), message: (j) => j.t('fix-event-end') },
  ],
};
