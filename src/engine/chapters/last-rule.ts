// Story "The Other Unix" — chapter "The Last Rule Wins": the club's old
// database (MySQL) answers on 3306 to the whole internet. Yanis wrote a pf
// configuration the way he would write iptables — accept ssh and the web
// first, then block the rest — and didn't dare switch it on. In pf, every
// rule is evaluated and the LAST one that matches decides (unless a rule
// is "quick"): his "block in all", last, blocks ssh and the web too.
//   - pfctl -nf /etc/pf.conf checks the syntax without loading anything;
//   - pf_enable="YES" in rc.conf (sysrc), service pf start (or pfctl -e);
//   - fix the order (block first, then pass) or mark the passes "quick",
//     reload with pfctl -f /etc/pf.conf, check with pfctl -sr.
// Objective checked on the state: pf enabled, and enabled at boot; ssh and
// http reachable from the internet, your workstation still allowed on 22,
// 3306 no longer reachable from outside; the rules in force are those of
// /etc/pf.conf.
// Sources: https://man.freebsd.org/cgi/man.cgi?query=pf.conf (the last
// matching rule wins, quick), https://man.freebsd.org/cgi/man.cgi?query=pfctl,
// https://docs.freebsd.org/en/books/handbook/firewalls/#firewalls-pf

import { f, type Chapter } from '../world';
import type { Game } from '../shell';
import { enabled, parsePf, pf, pfVerdict } from '../freebsd';
import { WORKSTATION } from '../machines';
import { M, PASSWORD, baseRcConf, filmAccounts, filmState, filmWorld, proc } from './film-club';

const INTERNET = '198.51.100.23';
const NGINX = 901;
const MYSQL = 640;

export const PF_CONF = `# pf.conf for the club's server - Yanis
# Let ssh and the web in, then block everything else (like iptables).
pass in proto tcp to port { 22 80 }
block in all
pass out all keep state`;

const on = (j: Game) => !!pf(j)?.enabled;
const pass = (j: Game, port: number, source = INTERNET) => !!pf(j) && pfVerdict(pf(j)!, port, source) === 'accepted';
const fileRules = (j: Game) => {
  const r = parsePf(j.read('/etc/pf.conf') ?? '', '/etc/pf.conf');
  return 'errors' in r ? null : r.rules.map((x) => x.text).join('\n');
};
const loadedIsFile = (j: Game) => fileRules(j) === (pf(j)?.rules ?? []).map((x) => x.text).join('\n');
const good = (j: Game) => on(j) && pass(j, 22) && pass(j, 80) && pass(j, 22, WORKSTATION.address) && !pass(j, 3306);

export const lastRule: Chapter = {
  id: 'last-rule',
  number: 3,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'nano', 'sudo', 'id', 'whoami', 'uname', 'freebsd-version', 'ps', 'service', 'sysrc', 'sockstat', 'pfctl', 'nc'],
  home: M,
  welcome: 'message_from_romy.txt',
  names: true,
  final: 'end',
  steps: ['checked', 'on', 'end'],
  password: PASSWORD,
  accounts: filmAccounts,
  state: () =>
    filmState({
      installed: ['nginx'],
      running: { nginx: NGINX, 'mysql-server': MYSQL },
      listening: [
        { proto: 'tcp', address: '0.0.0.0', port: 80, process: 'nginx', pid: NGINX },
        { proto: 'tcp', address: '0.0.0.0', port: 3306, process: 'mysqld', pid: MYSQL },
      ],
      process: [proc(MYSQL, 'mysql', '/usr/local/libexec/mysqld --basedir=/usr/local', { mem: 9.8 }), proc(NGINX, 'root', 'nginx: master process /usr/local/sbin/nginx')],
    }),
  createWorld: (t) =>
    filmWorld(t, {
      installed: ['nginx'],
      rcConf: `${baseRcConf(t)}\nnginx_enable="YES"\nmysql_enable="YES"`,
      home: { 'message_from_romy.txt': f(t('last-rule-message-romy')) },
      etc: { 'pf.conf': f(PF_CONF, { lines: true, owner: 'root', group: 'wheel' }) },
    }),
  events: [
    { id: 'checked', condition: (j) => j.last.commands.some((c) => c.includes('pfctl') && c.some((a) => a === '-nf' || a === '-n')), message: (j) => j.t('last-rule-event-checked') },
    { id: 'locked-out', condition: (j) => on(j) && !pass(j, 22, WORKSTATION.address), message: (j) => j.t('last-rule-event-locked-out') },
    { id: 'on', condition: (j) => on(j) && pass(j, 22, WORKSTATION.address), message: (j) => j.t('last-rule-event-on') },
    { id: 'not-at-boot', condition: (j) => good(j) && !enabled(j, 'pf'), message: (j) => j.t('last-rule-event-not-at-boot') },
    { id: 'file-differs', condition: (j) => good(j) && enabled(j, 'pf') && !loadedIsFile(j), message: (j) => j.t('last-rule-event-file-differs') },
    { id: 'end', condition: (j) => good(j) && enabled(j, 'pf') && loadedIsFile(j), message: (j) => j.t('last-rule-event-end') },
  ],
};
