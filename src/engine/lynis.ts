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

import type { Jeu } from './shell';
import { lireConfig } from './sshd';
import { misesDisponibles, type EtatApt } from './commands/apt';
import type { PareFeu } from './firewall';

export const VERSION_LYNIS = '3.1.4';
export const RAPPORT = '/var/log/lynis-report.dat';
export const JOURNAL = '/var/log/lynis.log';
const TESTS = 238;

export interface Constat {
  id: string;
  type: 'warning' | 'suggestion';
  texte: string;
  detail?: string;
  poids: number;
}

// Les mots qui font d'une bannière un avertissement légal (comme Lynis, BANN-7126).
const MOTS_LEGAUX = /authori[sz]ed|unauthori[sz]ed|prohibited|forbidden|legal|monitor|audit|consent|restricted|private/i;

const oui = (v: string | undefined, defaut = 'yes') => (v ?? defaut).toLowerCase();

/** L'umask par défaut de /etc/login.defs (la dernière ligne UMASK). */
export function umaskDe(jeu: Jeu): string {
  let u = '022';
  for (const l of (jeu.lire('/etc/login.defs') ?? '').split('\n')) {
    const m = /^\s*UMASK\s+([0-7]{3,4})\s*(#.*)?$/.exec(l);
    if (m) u = m[1].slice(-3);
  }
  return u;
}

/** Les constats d'un audit de cette machine, d'après son état. */
export function constats(jeu: Jeu): Constat[] {
  const c: Constat[] = [];
  const apt: EtatApt | undefined = jeu.etat.apt;
  if (apt && misesDisponibles(apt).length) c.push({ id: 'PKGS-7392', type: 'warning', texte: 'Found one or more vulnerable packages.', poids: 8 });
  const ssh = lireConfig(jeu).valeurs;
  const option = (id: string, detail: string, poids = 3) => c.push({ id, type: 'suggestion', texte: 'Consider hardening SSH configuration', detail, poids });
  if (!['no', 'prohibit-password', 'without-password', 'forced-commands-only'].includes(oui(ssh.permitrootlogin, 'prohibit-password')))
    option('SSH-7408', 'PermitRootLogin (set YES to (NO|PROHIBIT-PASSWORD|FORCED-COMMANDS-ONLY))', 4);
  if (Number(ssh.maxauthtries ?? 6) > 3) option('SSH-7408', `MaxAuthTries (set ${ssh.maxauthtries ?? 6} to 3)`);
  if (oui(ssh.x11forwarding, 'no') === 'yes') option('SSH-7408', 'X11Forwarding (set YES to NO)');
  if (oui(ssh.allowtcpforwarding) !== 'no') option('SSH-7408', `AllowTcpForwarding (set ${oui(ssh.allowtcpforwarding).toUpperCase()} to NO)`);
  if (oui(ssh.allowagentforwarding) !== 'no') option('SSH-7408', `AllowAgentForwarding (set ${oui(ssh.allowagentforwarding).toUpperCase()} to NO)`);
  if (!['027', '077'].includes(umaskDe(jeu)))
    c.push({ id: 'AUTH-9328', type: 'suggestion', texte: 'Default umask in /etc/login.defs could be more strict like 027', poids: 4 });
  if (!MOTS_LEGAUX.test(jeu.lire('/etc/issue') ?? ''))
    c.push({ id: 'BANN-7126', type: 'suggestion', texte: 'Add a legal banner to /etc/issue, to warn unauthorized users', poids: 4 });
  // Ce qui ne se corrige pas dans le jeu : de bonnes idées, pas des urgences.
  c.push(
    { id: 'HRDN-7230', type: 'suggestion', texte: 'Harden the system by installing at least one malware scanner, to perform periodic file system scans', poids: 3 },
    { id: 'FINT-4350', type: 'suggestion', texte: 'Install a file integrity tool to monitor changes to critical and sensitive files', poids: 3 },
    { id: 'LOGG-2154', type: 'suggestion', texte: 'Enable logging to an external logging host for archiving purposes and additional protection', poids: 3 },
    { id: 'ACCT-9628', type: 'suggestion', texte: 'Enable auditd to collect audit information', poids: 3 },
  );
  return c;
}

export const indice = (liste: Constat[]) => Math.max(0, 100 - liste.reduce((n, x) => n + x.poids, 0));

const statut = (texte: string, etat: string) => `  ${texte.padEnd(58)}[ ${etat} ]`;

/** La sortie de « lynis audit system » et le contenu de /var/log/lynis-report.dat. */
export function audit(jeu: Jeu): { sortie: string; rapport: string; indice: number; constats: Constat[] } {
  const liste = constats(jeu);
  const a = (id: string) => liste.some((x) => x.id === id);
  const detail = (re: RegExp) => liste.some((x) => x.id === 'SSH-7408' && re.test(x.detail ?? ''));
  const pf: PareFeu | undefined = jeu.etat.ufw;
  const note = indice(liste);
  const avert = liste.filter((x) => x.type === 'warning');
  const sugg = liste.filter((x) => x.type === 'suggestion');
  const sections: string[] = [
    '[+] Initializing program',
    '------------------------------------',
    statut('- Detecting OS...', 'DONE'),
    statut('- Checking profiles...', 'DONE'),
    '',
    '  ---------------------------------------------------',
    `  Program version:           ${VERSION_LYNIS}`,
    '  Operating system:          Linux',
    '  Operating system name:     Debian',
    '  Operating system version:  13',
    '  Kernel version:            6.12.48',
    '  Hardware platform:         x86_64',
    `  Hostname:                  ${jeu.nomHote}`,
    '  ---------------------------------------------------',
    '  Profiles:                  /etc/lynis/default.prf',
    `  Log file:                  ${JOURNAL}`,
    `  Report file:               ${RAPPORT}`,
    '  Report version:            1.0',
    '  ---------------------------------------------------',
    statut('- Program update status...', 'NO UPDATE'),
    '',
    '[+] Software: firewalls',
    '------------------------------------',
    statut('- Checking ufw status', pf?.actif ? 'ENABLED' : 'DISABLED'),
    '',
    '[+] Software: package audit',
    '------------------------------------',
    statut('- Checking package vulnerabilities (apt)', a('PKGS-7392') ? 'WARNING' : 'NONE'),
    '',
    '[+] SSH Support',
    '------------------------------------',
    statut('- Checking running SSH daemon', 'FOUND'),
    statut('    - Searching SSH configuration', 'FOUND'),
    statut('    - OpenSSH option: AllowAgentForwarding', detail(/AllowAgentForwarding/) ? 'SUGGESTION' : 'OK'),
    statut('    - OpenSSH option: AllowTcpForwarding', detail(/AllowTcpForwarding/) ? 'SUGGESTION' : 'OK'),
    statut('    - OpenSSH option: MaxAuthTries', detail(/MaxAuthTries/) ? 'SUGGESTION' : 'OK'),
    statut('    - OpenSSH option: PermitRootLogin', detail(/PermitRootLogin/) ? 'SUGGESTION' : 'OK'),
    statut('    - OpenSSH option: X11Forwarding', detail(/X11Forwarding/) ? 'SUGGESTION' : 'OK'),
    '',
    '[+] Users, Groups and Authentication',
    '------------------------------------',
    statut('- Default umask in /etc/login.defs', a('AUTH-9328') ? 'SUGGESTION' : 'OK'),
    '',
    '[+] Banners and identification',
    '------------------------------------',
    statut('- /etc/issue', a('BANN-7126') ? 'WEAK' : 'FOUND'),
    statut('    - /etc/issue contents', a('BANN-7126') ? 'WEAK' : 'OK'),
    '',
    '[+] Logging and files',
    '------------------------------------',
    statut('- Checking for a running log daemon', 'OK'),
    statut('- Checking logrotate presence', 'OK'),
    statut('- Checking remote logging', 'NOT ENABLED'),
    '',
    '[+] File integrity',
    '------------------------------------',
    statut('- Checking file integrity tools', 'NOT FOUND'),
    '',
    '[+] Malware',
    '------------------------------------',
    statut('- Malware software components', 'NOT FOUND'),
    '',
  ];
  const blocs = [
    ...(avert.length ? ['  Warnings (' + avert.length + '):', '  ----------------------------', ...avert.flatMap((x) => [`  ! ${x.texte} [${x.id}]`, `      https://cisofy.com/lynis/controls/${x.id}/`]), ''] : []),
    ...(sugg.length
      ? [
          `  Suggestions (${sugg.length}):`,
          '  ----------------------------',
          ...sugg.flatMap((x) => [`  * ${x.texte} [${x.id}]`, ...(x.detail ? [`      - Details  : ${x.detail}`] : []), `      https://cisofy.com/lynis/controls/${x.id}/`]),
          '',
        ]
      : []),
  ];
  const barre = '#'.repeat(Math.floor(note / 5)).padEnd(20);
  const sortie = [
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
    ...blocs,
    '  Follow-up:',
    '  ----------------------------',
    '  - Show details of a test (lynis show details TEST-ID)',
    `  - Check the logfile for all details (less ${JOURNAL})`,
    '  - Read security controls texts (https://cisofy.com)',
    '',
    '================================================================================',
    '',
    '  Lynis security scan details:',
    '',
    `  Hardening index : ${note} [${barre}]`,
    `  Tests performed : ${TESTS}`,
    '  Plugins enabled : 0',
    '',
    '  Components:',
    `  - Firewall               [${pf?.actif ? 'V' : 'X'}]`,
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
    `  - Test and debug information      : ${JOURNAL}`,
    `  - Report data                     : ${RAPPORT}`,
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
  const rapport = [
    'report_version=1.0',
    `hostname=${jeu.nomHote}`,
    `lynis_version=${VERSION_LYNIS}`,
    `hardening_index=${note}`,
    `tests_executed=${TESTS}`,
    `firewall_active=${pf?.actif ? 1 : 0}`,
    ...avert.map((x) => `warning[]=${x.id}|${x.texte}|-|-|`),
    ...sugg.map((x) => `suggestion[]=${x.id}|${x.texte}|${x.detail ?? '-'}|-|`),
  ].join('\n');
  return { sortie, rapport, indice: note, constats: liste };
}
