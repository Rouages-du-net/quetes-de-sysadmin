// Lynis simulé (https://cisofy.com/documentation/lynis/) : l'audit d'un
// serveur Debian, lu sur l'état de la machine. Lynis ne change rien : il
// compare la configuration à de bonnes pratiques et range ses remarques en
// avertissements (warnings) et suggestions, chacune avec un identifiant de
// test (SSH-7408…), puis donne un « indice de durcissement » (hardening index).
// Ce que le jeu lit sur la machine : sshd_config (valeurs effectives, comme
// sshd -T), les mises à jour de sécurité en attente (apt), UMASK de
// /etc/login.defs, la bannière /etc/issue, ufw. Le reste (surveillance de
// l'intégrité des fichiers, logiciel antimalware, journalisation distante,
// comptabilité des processus) est « à installer » et ne se corrige pas dans le
// jeu : un audit sert aussi à décider ce qui vaut l'effort.
// Écarts : une soixantaine de lignes au lieu d'environ 300 ; l'indice se calcule
// par pénalités fixes (pas par la pondération de Lynis) ; pas de -Q, de
// profils, ni de `show details` ; sans root, l'audit est refusé.
// Sources : https://cisofy.com/documentation/lynis/, https://cisofy.com/lynis/controls/

import type { Game } from './shell';
import { readConfig } from './sshd';
import { availableUpdates, type AptState } from './commands/apt';
import type { Firewall } from './firewall';

export const VERSION_LYNIS = '3.1.4';
export const REPORT = '/var/log/lynis-report.dat';
export const LOG = '/var/log/lynis.log';
const TESTS = 238;

export interface Finding {
  id: string;
  type: 'warning' | 'suggestion';
  text: string;
  detail?: string;
  weight: number;
}

// Les mots qui font d'une bannière un avertissement légal (comme Lynis, BANN-7126).
const LEGAL_WORDS = /authori[sz]ed|unauthori[sz]ed|prohibited|forbidden|legal|monitor|audit|consent|restricted|private/i;

const yes = (v: string | undefined, fallback = 'yes') => (v ?? fallback).toLowerCase();

/** L'umask par défaut de /etc/login.defs (la dernière ligne UMASK). */
export function umaskFor(game: Game): string {
  let u = '022';
  for (const l of (game.read('/etc/login.defs') ?? '').split('\n')) {
    const m = /^\s*UMASK\s+([0-7]{3,4})\s*(#.*)?$/.exec(l);
    if (m) u = m[1].slice(-3);
  }
  return u;
}

/** Les constats d'un audit de cette machine, d'après son état. */
export function findings(game: Game): Finding[] {
  const c: Finding[] = [];
  const apt: AptState | undefined = game.state.apt;
  if (apt && availableUpdates(apt).length) c.push({ id: 'PKGS-7392', type: 'warning', text: 'Found one or more vulnerable packages.', weight: 8 });
  const ssh = readConfig(game).values;
  const option = (id: string, detail: string, weight = 3) => c.push({ id, type: 'suggestion', text: 'Consider hardening SSH configuration', detail, weight });
  if (!['no', 'prohibit-password', 'without-password', 'forced-commands-only'].includes(yes(ssh.permitrootlogin, 'prohibit-password')))
    option('SSH-7408', 'PermitRootLogin (set YES to (NO|PROHIBIT-PASSWORD|FORCED-COMMANDS-ONLY))', 4);
  if (Number(ssh.maxauthtries ?? 6) > 3) option('SSH-7408', `MaxAuthTries (set ${ssh.maxauthtries ?? 6} to 3)`);
  if (yes(ssh.x11forwarding, 'no') === 'yes') option('SSH-7408', 'X11Forwarding (set YES to NO)');
  if (yes(ssh.allowtcpforwarding) !== 'no') option('SSH-7408', `AllowTcpForwarding (set ${yes(ssh.allowtcpforwarding).toUpperCase()} to NO)`);
  if (yes(ssh.allowagentforwarding) !== 'no') option('SSH-7408', `AllowAgentForwarding (set ${yes(ssh.allowagentforwarding).toUpperCase()} to NO)`);
  if (!['027', '077'].includes(umaskFor(game)))
    c.push({ id: 'AUTH-9328', type: 'suggestion', text: 'Default umask in /etc/login.defs could be more strict like 027', weight: 4 });
  if (!LEGAL_WORDS.test(game.read('/etc/issue') ?? ''))
    c.push({ id: 'BANN-7126', type: 'suggestion', text: 'Add a legal banner to /etc/issue, to warn unauthorized users', weight: 4 });
  // Ce qui ne se corrige pas dans le jeu : de bonnes idées, pas des urgences.
  c.push(
    { id: 'HRDN-7230', type: 'suggestion', text: 'Harden the system by installing at least one malware scanner, to perform periodic file system scans', weight: 3 },
    { id: 'FINT-4350', type: 'suggestion', text: 'Install a file integrity tool to monitor changes to critical and sensitive files', weight: 3 },
    { id: 'LOGG-2154', type: 'suggestion', text: 'Enable logging to an external logging host for archiving purposes and additional protection', weight: 3 },
    { id: 'ACCT-9628', type: 'suggestion', text: 'Enable auditd to collect audit information', weight: 3 },
  );
  return c;
}

export const hint = (listing: Finding[]) => Math.max(0, 100 - listing.reduce((n, x) => n + x.weight, 0));

const status = (text: string, state: string) => `  ${text.padEnd(58)}[ ${state} ]`;

/** La sortie de « lynis audit system » et le contenu de /var/log/lynis-report.dat. */
export function audit(game: Game): { output: string; report: string; hint: number; findings: Finding[] } {
  const listing = findings(game);
  const a = (id: string) => listing.some((x) => x.id === id);
  const detail = (re: RegExp) => listing.some((x) => x.id === 'SSH-7408' && re.test(x.detail ?? ''));
  const pf: Firewall | undefined = game.state.ufw;
  const note = hint(listing);
  const avert = listing.filter((x) => x.type === 'warning');
  const sugg = listing.filter((x) => x.type === 'suggestion');
  const sections: string[] = [
    '[+] Initializing program',
    '------------------------------------',
    status('- Detecting OS...', 'DONE'),
    status('- Checking profiles...', 'DONE'),
    '',
    '  ---------------------------------------------------',
    `  Program version:           ${VERSION_LYNIS}`,
    '  Operating system:          Linux',
    '  Operating system name:     Debian',
    '  Operating system version:  13',
    '  Kernel version:            6.12.48',
    '  Hardware platform:         x86_64',
    `  Hostname:                  ${game.hostName}`,
    '  ---------------------------------------------------',
    '  Profiles:                  /etc/lynis/default.prf',
    `  Log file:                  ${LOG}`,
    `  Report file:               ${REPORT}`,
    '  Report version:            1.0',
    '  ---------------------------------------------------',
    status('- Program update status...', 'NO UPDATE'),
    '',
    '[+] Software: firewalls',
    '------------------------------------',
    status('- Checking ufw status', pf?.enabled ? 'ENABLED' : 'DISABLED'),
    '',
    '[+] Software: package audit',
    '------------------------------------',
    status('- Checking package vulnerabilities (apt)', a('PKGS-7392') ? 'WARNING' : 'NONE'),
    '',
    '[+] SSH Support',
    '------------------------------------',
    status('- Checking running SSH daemon', 'FOUND'),
    status('    - Searching SSH configuration', 'FOUND'),
    status('    - OpenSSH option: AllowAgentForwarding', detail(/AllowAgentForwarding/) ? 'SUGGESTION' : 'OK'),
    status('    - OpenSSH option: AllowTcpForwarding', detail(/AllowTcpForwarding/) ? 'SUGGESTION' : 'OK'),
    status('    - OpenSSH option: MaxAuthTries', detail(/MaxAuthTries/) ? 'SUGGESTION' : 'OK'),
    status('    - OpenSSH option: PermitRootLogin', detail(/PermitRootLogin/) ? 'SUGGESTION' : 'OK'),
    status('    - OpenSSH option: X11Forwarding', detail(/X11Forwarding/) ? 'SUGGESTION' : 'OK'),
    '',
    '[+] Users, Groups and Authentication',
    '------------------------------------',
    status('- Default umask in /etc/login.defs', a('AUTH-9328') ? 'SUGGESTION' : 'OK'),
    '',
    '[+] Banners and identification',
    '------------------------------------',
    status('- /etc/issue', a('BANN-7126') ? 'WEAK' : 'FOUND'),
    status('    - /etc/issue contents', a('BANN-7126') ? 'WEAK' : 'OK'),
    '',
    '[+] Logging and files',
    '------------------------------------',
    status('- Checking for a running log daemon', 'OK'),
    status('- Checking logrotate presence', 'OK'),
    status('- Checking remote logging', 'NOT ENABLED'),
    '',
    '[+] File integrity',
    '------------------------------------',
    status('- Checking file integrity tools', 'NOT FOUND'),
    '',
    '[+] Malware',
    '------------------------------------',
    status('- Malware software components', 'NOT FOUND'),
    '',
  ];
  const blocks = [
    ...(avert.length ? ['  Warnings (' + avert.length + '):', '  ----------------------------', ...avert.flatMap((x) => [`  ! ${x.text} [${x.id}]`, `      https://cisofy.com/lynis/controls/${x.id}/`]), ''] : []),
    ...(sugg.length
      ? [
          `  Suggestions (${sugg.length}):`,
          '  ----------------------------',
          ...sugg.flatMap((x) => [`  * ${x.text} [${x.id}]`, ...(x.detail ? [`      - Details  : ${x.detail}`] : []), `      https://cisofy.com/lynis/controls/${x.id}/`]),
          '',
        ]
      : []),
  ];
  const bar = '#'.repeat(Math.floor(note / 5)).padEnd(20);
  const output = [
    '',
    `[ Lynis ${VERSION_LYNIS} ]`,
    '',
    '################################################################################',
    '  Lynis comes with ABSOLUTELY NO WARRANTY. This is free software, and you are',
    '  welcome to redistribute it under the terms of the GNU General Public License.',
    '  See the LICENSE file for details about using this software.',
    '',
    '  2007-2024, CISOfy - https://cisofy.com/lynis/',
    '  Enterprise support available (compliance, plugins, interface and tools)',
    '################################################################################',
    '',
    ...sections,
    '================================================================================',
    '',
    `  -[ Lynis ${VERSION_LYNIS} Results ]-`,
    '',
    ...blocks,
    '  Follow-up:',
    '  ----------------------------',
    '  - Show details of a test (lynis show details TEST-ID)',
    `  - Check the logfile for all details (less ${LOG})`,
    '  - Read security controls texts (https://cisofy.com)',
    '',
    '================================================================================',
    '',
    '  Lynis security scan details:',
    '',
    `  Hardening index : ${note} [${bar}]`,
    `  Tests performed : ${TESTS}`,
    '  Plugins enabled : 0',
    '',
    '  Components:',
    `  - Firewall               [${pf?.enabled ? 'V' : 'X'}]`,
    '  - Malware scanner        [X]',
    '',
    '  Scan mode:',
    '  Normal [V]  Forensics [ ]  Integration [ ]  Pentest [ ]',
    '',
    '  Lynis modules:',
    '  - Compliance status      [?]',
    '  - Security audit         [V]',
    '  - Vulnerability scan     [V]',
    '',
    '  Files:',
    `  - Test and debug information      : ${LOG}`,
    `  - Report data                     : ${REPORT}`,
    '',
    '================================================================================',
    `  Lynis ${VERSION_LYNIS}`,
    '  Auditing, system hardening, and compliance for UNIX-based systems',
    '  (Linux, macOS, BSD, and others)',
    '',
    '  2007-2024, CISOfy - https://cisofy.com/lynis/',
    '  Enterprise support available (compliance, plugins, interface and tools)',
    '================================================================================',
  ].join('\n');
  const report = [
    'report_version=1.0',
    `hostname=${game.hostName}`,
    `lynis_version=${VERSION_LYNIS}`,
    `hardening_index=${note}`,
    `tests_executed=${TESTS}`,
    `firewall_active=${pf?.enabled ? 1 : 0}`,
    ...avert.map((x) => `warning[]=${x.id}|${x.text}|-|-|`),
    ...sugg.map((x) => `suggestion[]=${x.id}|${x.text}|${x.detail ?? '-'}|-|`),
  ].join('\n');
  return { output, report, hint: note, findings: listing };
}
