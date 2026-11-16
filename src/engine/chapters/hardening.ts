// Story "The Bastion" — chapter "Hardening": Monday, 8:40. Clean again;
// now close the door it came through, and the ones next to it, before
// Selma deploys again:
//   - passwords: /etc/ssh/sshd_config already says "PasswordAuthentication
//     no", but sshd_config.d/50-delivery.conf (included at the top, the
//     first value wins) says yes. Remove or fix the drop-in, then reload
//     ssh (sshd -T shows what applies);
//   - the firewall: a policy that drops by default (iptables -P INPUT
//     DROP), with what must stay open first: the loopback (nginx talks to
//     the app on 127.0.0.1), the replies to the server's own connections
//     (-m state --state ESTABLISHED,RELATED), ssh, http and https. The app's
//     port 3000, open to the world by mistake, closes with the policy;
//   - make it survive a reboot: iptables-save into /etc/iptables/rules.v4
//     (read at boot by iptables-persistent);
//   - give Selma her account back, by key only: lift the expiry (usermod -e
//     "" or chage -E -1) and restore the shell if it was changed.
// Objective checked on the state: password authentication off in the
// applied configuration, INPUT policy DROP with lo, ESTABLISHED, 22, 80
// and 443 accepted and 3000 closed from outside, your workstation still
// allowed, the rules saved, deploy usable again.
// Sources: https://man.openbsd.org/sshd_config (Include, first value),
// https://man7.org/linux/man-pages/man8/iptables.8.html,
// https://man7.org/linux/man-pages/man8/iptables-save.8.html,
// https://wiki.debian.org/iptables (iptables-persistent, rules.v4),
// https://csrc.nist.gov/pubs/sp/800/61/r2/final (post-incident activity)

import { f, type Chapter } from '../world';
import type { Game } from '../shell';
import { iptables, verdict } from '../iptables';
import { readConfig } from '../sshd';
import { APP_PORT, M, PASSWORD, bastionAccounts, bastionState, bastionWorld, containedIptables, initialiseBastion, sshd, workstationIn } from './bastion';

const INTERNET = '198.51.100.23';
const RULES = '/etc/iptables/rules.v4';
// Monday 16 April 2029.
const NOW_DAY = '2029-04-16';

const applied = (j: Game) => (sshd(j).load as Record<string, string> | undefined)?.passwordauthentication;
const passwordsOff = (j: Game) => applied(j) === 'no';
const fileSaysNo = (j: Game) => readConfig(j).values.passwordauthentication === 'no';
const ipt = (j: Game) => iptables(j.state);
const policyDrop = (j: Game) => ipt(j)?.filter.chains.INPUT.policy === 'DROP';
const inputRules = (j: Game) => ipt(j)?.filter.chains.INPUT.rules ?? [];
const loopback = (j: Game) => inputRules(j).some((r) => r.inFace === 'lo' && r.target === 'ACCEPT');
const replies = (j: Game) => inputRules(j).some((r) => (r.states ?? []).includes('ESTABLISHED') && r.target === 'ACCEPT');
const open = (j: Game, port: number) => !!ipt(j) && verdict(ipt(j)!, port, INTERNET) === 'accepted';
const firewallOk = (j: Game) => policyDrop(j) && loopback(j) && replies(j) && open(j, 22) && open(j, 80) && open(j, 443) && !open(j, APP_PORT) && workstationIn(j);
const saved = (j: Game) => {
  const text = j.read(RULES) ?? '';
  return /^:INPUT DROP/m.test(text) && /--dport 22 -j ACCEPT/.test(text) && /--dport 443 -j ACCEPT/.test(text);
};
const deployBack = (j: Game) => {
  const u = j.accounts.users.deploy;
  return !!u && (u.expires === undefined || u.expires > NOW_DAY) && ['/bin/bash', '/bin/sh', undefined].includes(u.shell);
};
const done = (j: Game) => passwordsOff(j) && firewallOk(j) && saved(j) && deployBack(j);

export const hardening: Chapter = {
  id: 'hardening',
  number: 4,
  commands: [
    'ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'find', 'nano', 'sudo', 'id', 'whoami', 'rm', 'mv', 'sshd', 'systemctl',
    'journalctl', 'iptables', 'iptables-save', 'tee', 'usermod', 'chage', 'nmap', 'ss', 'netstat',
  ],
  home: M,
  welcome: 'email_nadia.txt',
  names: true,
  final: 'end',
  steps: ['passwords', 'firewall', 'saved', 'deploy', 'end'],
  password: PASSWORD,
  accounts: () => {
    const c = bastionAccounts();
    c.users.deploy.expires = '1970-01-02';
    return c;
  },
  state: (t) => ({
    ...bastionState(t, { miner: false, iptables: containedIptables(), crontab: '# m h  dom mon dow   command\n*/15 * * * * /srv/delivery/bin/sync-orders' }),
    scan: {
      hosts: [
        {
          address: '192.0.2.33',
          names: ['oven.internal', 'oven'],
          local: true,
          latency: 0.011,
          services: [
            { port: 22, service: 'ssh', product: 'OpenSSH 10.0p1 Debian 7+deb13u1 (protocol 2.0)' },
            { port: 80, service: 'http', product: 'nginx 1.26.3' },
            { port: 443, service: 'http', ssl: true, product: 'nginx 1.26.3' },
            { port: APP_PORT, service: 'ppp', product: 'Node.js Express framework' },
          ],
        },
      ],
      scope: ['192.0.2.33'],
    },
  }),
  initialise: initialiseBastion,
  createWorld: (t) =>
    bastionWorld(t, {
      tampered: false,
      intruderFiles: false,
      intruderKey: false,
      home: { 'email_nadia.txt': f(t('hardening-email-nadia')), 'incident.md': f(t('hardening-incident'), { lines: true }) },
    }),
  events: [
    { id: 'looked', condition: (j) => j.last.commands.some((c) => c.includes('sshd') && c.includes('-T')) && j.last.output.includes('passwordauthentication yes'), message: (j) => j.t('hardening-event-looked') },
    { id: 'not-reloaded', condition: (j) => fileSaysNo(j) && !passwordsOff(j), message: (j) => j.t('hardening-event-not-reloaded') },
    { id: 'passwords', condition: passwordsOff, message: (j) => j.t('hardening-event-passwords') },
    { id: 'locked-out', condition: (j) => !workstationIn(j), message: (j) => j.t('hardening-event-locked-out') },
    { id: 'no-loopback', condition: (j) => policyDrop(j) && !loopback(j) && open(j, 22), message: (j) => j.t('hardening-event-no-loopback') },
    { id: 'firewall', condition: firewallOk, message: (j) => j.t('hardening-event-firewall', { port: String(APP_PORT) }) },
    { id: 'saved', condition: (j) => saved(j) && firewallOk(j), message: (j) => j.t('hardening-event-saved') },
    { id: 'deploy', condition: deployBack, message: (j) => j.t('hardening-event-deploy') },
    { id: 'end', condition: done, message: (j) => j.t('hardening-event-end') },
  ],
};
