// Story "The Audit" — chapter "The follow-up visit": the fixes of
// parts 1 to 4 are in place. Before handing in her report, Salomé comes back
// to check, like an auditor: scan again, run Lynis,
// fix what matters, prove it, then write the closing report.
//   - nmap -sV bakery.internal: only 22, 80 and 443 seen from the internet; but
//     the SSH version is the one from before the security update;
//   - sudo lynis audit system: a warning (PKGS-7392, vulnerable
//     packages) and suggestions of uneven severity. Some can be
//     fixed here (sshd_config, UMASK in login.defs, /etc/issue banner),
//     others need real work (file integrity, antimalware,
//     remote logging, auditd): they go in the report with their
//     identifier rather than being installed in a hurry;
//   - sudo apt update; sudo apt upgrade: fixes PKGS-7392 AND changes the
//     SSH version nmap shows (the proof); a modified sshd_config needs
//     sshd -t then reload: Lynis reads the file, not the running service;
//   - closing_report.md: a summary, the fixed findings, the proofs
//     (the Lynis index and the scan), what remains to do. Salomé rereads it
//     on every save.
// Objective checked on the state: no more Lynis warning and an index of at
// least 70, ssh's configuration applied, a last scan that sees only
// 22, 80 and 443 with the updated SSH version, a last Lynis audit that
// reflects the machine, and a complete report that cites the index and a
// finding still open.
// Sources: https://cisofy.com/documentation/lynis/, https://nmap.org/book/man.html,
// https://man.openbsd.org/sshd_config

import { path, d, f, type Chapter } from '../world';
import type { Game } from '../shell';
import { newFirewall, type Rule } from '../firewall';
import { newSystemd } from '../systemd';
import { allowed, readConfig } from '../sshd';
import { availableUpdates, type AptState } from '../commands/apt';
import { findings, hint as hintFor } from '../lynis';
import type { Scan } from '../scan';
import { bakeryApt, loadSshd, sectionsMd, bakeryAccounts, bakeryListening, file, M, NOW, PASSWORD, bakeryWorld, bakeryScan, serviceSsh, sshd, NEIGHBOUR } from './audit';

const REPORT = `${M}/closing_report.md`;
const TARGET = 70;
const SSH_KEYS = ['permitrootlogin', 'x11forwarding', 'maxauthtries', 'allowtcpforwarding', 'allowagentforwarding'];
const SECTIONS = ['summary', 'findings', 'evidence', 'remaining'];
const SUBJECTS = ['ssh', 'account', 'sudo', 'secret', 'network', 'key'];

const LOGIN_DEFS = `# /etc/login.defs - Configuration control definitions for the login package.
MAIL_DIR        /var/mail
FAILLOG_ENAB            yes
LOG_UNKFAIL_ENAB        no
LOG_OK_LOGINS           no
UMASK           022
PASS_MAX_DAYS   99999
PASS_MIN_DAYS   0
PASS_WARN_AGE   7
ENCRYPT_METHOD  YESCRYPT`;

// The firewall after "The Exposure": SSH, 80 and 443.
const RULES: Rule[] = [
  { action: 'allow', to: 'OpenSSH', ports: [22], forEachOf: null },
  { action: 'allow', to: 'Nginx Full', ports: [80, 443], forEachOf: null },
];

const apt = (j: Game) => j.state.apt as AptState;
const scans = (j: Game): Scan[] => j.state.scans ?? [];
const inScope = (b: Scan) => b.versions && b.outsideScope.length === 0 && b.addresses.includes('192.0.2.22');
const lastScan = (j: Game) => scans(j).filter(inScope).at(-1);
const outsideScope = (j: Game) => scans(j).some((b) => b.outsideScope.length > 0);
const addressesOutside = (j: Game) => [...new Set(scans(j).flatMap((b) => b.outsideScope))];
const three = (b: Scan | undefined) => !!b && JSON.stringify(b.openSet['192.0.2.22']) === JSON.stringify([22, 80, 443]);
const dayASsh = (b: Scan | undefined) => !!b && (b.products['192.0.2.22'] ?? []).some((p) => /^OpenSSH.*\+deb13u1/.test(p));

const dayA = (j: Game) => availableUpdates(apt(j)).length === 0;
const listing = (j: Game) => findings(j);
const warnings = (j: Game) => listing(j).filter((c) => c.type === 'warning').length;
const realHint = (j: Game) => hintFor(listing(j));
const hardened = (j: Game) => warnings(j) === 0 && realHint(j) >= TARGET;
const lynis = (j: Game) => j.state.lynis as { hint: number; ids: string[]; warnings: number } | undefined;
const lynisProof = (j: Game) => !!lynis(j) && lynis(j)!.hint === realHint(j) && lynis(j)!.warnings === 0 && lynis(j)!.hint >= TARGET;
const appliesSsh = (j: Game) => {
  const sshFile = readConfig(j).values;
  return SSH_KEYS.every((k) => sshFile[k] === sshd(j).load[k]);
};
const sshChange = (j: Game) => !appliesSsh(j);
const errorSsh = (j: Game) => readConfig(j).errors.length > 0;
const between = (j: Game) => allowed(sshd(j).load, j.player);
const nmapOk = (j: Game) => {
  const b = lastScan(j);
  return three(b) && dayASsh(b);
};

const sections = (j: Game, text: string) => sectionsMd(j, text, 'follow-up-section', SECTIONS);
const words = (j: Game, key: string) => j.t(key).split(',').map((m) => m.trim().toLowerCase());
// The numbers written just after the word "index" (or "indice", "hardening"…): "hardening index 80".
const digits = (j: Game, text: string) => {
  const word = words(j, 'follow-up-words-hint').map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  return [...text.matchAll(new RegExp(`(?:${word})\\D{0,40}(\\d+)`, 'gi'))].map((x) => Number(x[1]));
};
const readReport = (j: Game) => j.read(path(j.t, REPORT));

const missing = (j: Game): string[] => {
  const text = readReport(j) ?? '';
  const s = sections(j, text);
  const m: string[] = [];
  if (text.toLowerCase().includes(j.t('follow-up-a-complete').toLowerCase())) m.push('template');
  if ((s.summary ?? '').trim().length < 30) m.push('summary');
  const bas = (s.findings ?? '').toLowerCase();
  if (SUBJECTS.filter((x) => words(j, `follow-up-words-${x}`).some((w) => bas.includes(w))).length < 5) m.push('findings');
  const l = lynis(j);
  if (!l) m.push('lynis');
  else if (!digits(j, s.evidence ?? '').includes(l.hint) || !/443/.test(s.evidence ?? '')) m.push('proofs');
  const ids = (s.remaining ?? '').match(/\b[A-Z]{3,4}-\d{4}\b/g) ?? [];
  if (!ids.some((id) => lynis(j)?.ids.includes(id))) m.push('rest');
  return m;
};
const okReport = (j: Game) => missing(j).length === 0;

export const againstVisit: Chapter = {
  id: 'follow-up',
  number: 5,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'find', 'nano', 'id', 'whoami', 'sudo', 'systemctl', 'journalctl', 'sshd', 'ss', 'ufw', 'apt', 'nmap', 'lynis'],
  home: M,
  welcome: 'email_salome.txt',
  names: true,
  final: 'end',
  steps: ['scan', 'lynis', 'update', 'hardened', 'proof-lynis', 'nmap-own', 'end'],
  password: PASSWORD,
  accounts: () => bakeryAccounts(false),
  state: (t) => ({
    sshd: { load: {}, connectionsToLoad: 1, reloads: 0 },
    ufw: { ...newFirewall(), enabled: true, rules: RULES.map((r) => ({ ...r })) },
    listening: bakeryListening(true),
    scan: bakeryScan(t),
    apt: bakeryApt(true),
    systemd: newSystemd('bakery', NOW - 5 * 86_400_000, NOW, {
      ssh: serviceSsh(),
      nginx: { description: 'A high performance web server and a reverse proxy server', active: true, executable: 'nginx' },
      cron: { description: 'Regular background program processing daemon', active: true, executable: 'cron' },
    }),
  }),
  initialise: (j) => {
    loadSshd(j);
    // Salomé only rereads what has changed: the initial state counts as already read.
    j.state.readReport = readReport(j);
  },
  createWorld: (t) =>
    bakeryWorld(t, {
      withoutLucas: true,
      home: { 'email_salome.txt': f(t('follow-up-email-salome')), 'closing_report.md': f(t('follow-up-template'), { lines: true }) },
      etc: {
        'login.defs': file(LOGIN_DEFS),
        issue: file('Debian GNU/Linux 13 \\n \\l\n'),
      },
      ssh: { 'sshd_config.d': d({ '00-hardening.conf': file('PermitRootLogin no', 'root') }, undefined, { owner: 'root' }) },
      more: { var: d({ log: d({}, undefined, { owner: 'root' }) }, undefined, { owner: 'root' }) },
    }),
  // Salomé rereads the closing report after each save.
  afterCommand: (j) => {
    const text = readReport(j);
    if (text === j.state.readReport || j.state.finishedReport) return;
    j.state.readReport = text;
    const rest = missing(j);
    if (!rest.length) {
      j.state.finishedReport = true;
      return;
    }
    return [j.t('follow-up-review'), ...rest.map((m) => `- ${j.t(`follow-up-missing-${m}`, { target: String(TARGET) })}`)].join('\n');
  },
  events: [
    { id: 'error-ssh', condition: errorSsh, message: (j) => j.t('follow-up-event-error-ssh') },
    { id: 'locked-out', condition: (j) => !between(j), message: (j) => j.t('follow-up-event-locked-out') },
    {
      id: 'outside-scope',
      condition: outsideScope,
      message: (j) => j.t('follow-up-event-outside-scope', { addresses: addressesOutside(j).join(', '), neighbour: addressesOutside(j).includes(NEIGHBOUR.address) ? 'yes' : 'no' }),
    },
    {
      id: 'scan',
      condition: (j) => !!lastScan(j),
      message: (j) => j.t('follow-up-event-scan', { outdated: dayASsh(lastScan(j)) ? 'no' : 'yes' }),
    },
    {
      id: 'lynis',
      condition: (j) => !!lynis(j),
      message: (j) => j.t('follow-up-event-lynis', { hint: String(lynis(j)!.hint), warnings: String(lynis(j)!.warnings) }),
    },
    { id: 'update', condition: dayA, message: (j) => j.t('follow-up-event-update') },
    {
      id: 'ssh-a-reload',
      condition: (j) => sshChange(j) && !errorSsh(j),
      message: (j) => j.t('follow-up-event-ssh-a-reload'),
    },
    { id: 'hardened', condition: (j) => hardened(j) && appliesSsh(j), message: (j) => j.t('follow-up-event-hardened', { target: String(TARGET) }) },
    { id: 'proof-lynis', condition: (j) => lynisProof(j) && appliesSsh(j), message: (j) => j.t('follow-up-event-proof-lynis') },
    { id: 'nmap-own', condition: nmapOk, message: (j) => j.t('follow-up-event-nmap-own') },
    {
      id: 'end',
      condition: (j) => lynisProof(j) && appliesSsh(j) && nmapOk(j) && okReport(j),
      message: (j) => j.t('follow-up-event-end', { mistake: outsideScope(j) ? 'yes' : 'no' }),
    },
  ],
};
