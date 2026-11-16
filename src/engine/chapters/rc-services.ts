// Story "The Other Unix" — chapter "No systemd Here": tonight's screening,
// and the club's programme must be online. Lucien's notes say "nginx".
// On FreeBSD:
//   - systemctl, apt: not found. Packages come from pkg (pkg install
//     nginx), and land in /usr/local (its configuration in
//     /usr/local/etc/nginx, its rc script in /usr/local/etc/rc.d);
//   - service nginx start refuses: "Cannot 'start' nginx. Set nginx_enable
//     to YES in /etc/rc.conf or use 'onestart'". A service runs only if
//     rc.conf says so; sysrc nginx_enable=YES (or service nginx enable)
//     writes the line; onestart would run it once, not after a reboot;
//   - sockstat -4l shows who listens (ss and netstat -p are Linux's).
// Objective checked on the state: nginx installed, enabled in rc.conf,
// running and listening on 80.
// Sources: https://docs.freebsd.org/en/books/handbook/ports/#pkgng-intro,
// https://docs.freebsd.org/en/books/handbook/config/#configtuning-starting-services,
// https://man.freebsd.org/cgi/man.cgi?query=rc.conf,
// https://man.freebsd.org/cgi/man.cgi?query=sysrc

import { f, type Chapter } from '../world';
import type { Game } from '../shell';
import { enabled, installed, rcState } from '../freebsd';
import type { Listening } from '../commands/ss';
import { M, PASSWORD, filmAccounts, filmState, filmWorld } from './film-club';

const running = (j: Game) => rcState(j).running.nginx !== undefined;
const listening = (j: Game) => ((j.state.listening ?? []) as Listening[]).some((l) => l.port === 80 && l.process === 'nginx');
const said = (j: Game, text: string) => j.last.errors.some((e) => e.includes(text)) || j.last.output.includes(text);

export const rcServices: Chapter = {
  id: 'rc-services',
  number: 2,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'nano', 'sudo', 'id', 'whoami', 'uname', 'freebsd-version', 'ps', 'pkg', 'service', 'sysrc', 'sockstat', 'which', 'find', 'du'],
  home: M,
  welcome: 'message_from_romy.txt',
  names: true,
  final: 'end',
  steps: ['installed', 'not-enabled', 'enabled', 'end'],
  password: PASSWORD,
  accounts: filmAccounts,
  state: () => filmState({}),
  createWorld: (t) => filmWorld(t, { home: { 'message_from_romy.txt': f(t('rc-services-message-romy')), 'lucien-notes.txt': f(t('rc-services-notes-lucien'), { lines: true }) } }),
  events: [
    { id: 'no-systemd', condition: (j) => said(j, 'systemctl: not found') || said(j, 'apt: not found') || said(j, 'apt-get: not found'), message: (j) => j.t('rc-services-event-no-systemd') },
    // Optional: ps -ef, a Linux habit, lists only your own processes, with their environment.
    { id: 'ps-ef', condition: (j) => j.last.commands.some((c) => c[0] === 'ps' && c.slice(1).some((a) => /^-\w*e/.test(a))) && j.last.output.includes('HOME='), message: (j) => j.t('rc-services-event-ps-ef') },
    { id: 'installed', condition: (j) => installed(j, 'nginx'), message: (j) => j.t('rc-services-event-installed') },
    { id: 'not-enabled', condition: (j) => said(j, "Cannot 'start' nginx"), message: (j) => j.t('rc-services-event-not-enabled') },
    { id: 'onestart', condition: (j) => running(j) && !enabled(j, 'nginx'), message: (j) => j.t('rc-services-event-onestart') },
    { id: 'enabled', condition: (j) => enabled(j, 'nginx'), message: (j) => j.t('rc-services-event-enabled') },
    { id: 'end', condition: (j) => installed(j, 'nginx') && enabled(j, 'nginx') && running(j) && listening(j), message: (j) => j.t('rc-services-event-end') },
  ],
};
