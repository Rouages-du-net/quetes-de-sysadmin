// Histoire « L'Audit » — chapitre « La contre-visite » : les correctifs des
// parties 1 à 4 sont en place. Avant de rendre son rapport, Salomé revient
// vérifier, comme une auditrice : on refait le balayage, on passe Lynis, on
// corrige ce qui compte, on prouve, puis on écrit le rapport de clôture.
//   - nmap -sV fournil.internal : plus que 22, 80 et 443 vus d'internet ; mais
//     la version de SSH est celle d'avant la mise à jour de sécurité ;
//   - sudo lynis audit system : un avertissement (PKGS-7392, des paquets
//     vulnérables) et des suggestions de gravité inégale. Certaines se
//     corrigent ici (sshd_config, UMASK de login.defs, bannière /etc/issue),
//     d'autres demandent un vrai chantier (intégrité des fichiers, antimalware,
//     journalisation distante, auditd) : on les met au rapport avec leur
//     identifiant plutôt que de les installer à la va-vite ;
//   - sudo apt update ; sudo apt upgrade : corrige PKGS-7392 ET change la
//     version de SSH que nmap affiche (la preuve) ; sshd_config modifié demande
//     sshd -t puis reload : Lynis lit le fichier, pas le service qui tourne ;
//   - rapport-cloture.md : un résumé, les constats corrigés, les preuves
//     (l'indice Lynis et le balayage), ce qui reste à faire. Salomé relit à
//     chaque enregistrement.
// Objectif vérifié sur l'état : plus d'avertissement Lynis et un indice d'au
// moins 70, la configuration de ssh appliquée, un dernier balayage qui ne voit
// que 22, 80 et 443 avec la version de SSH à jour, un dernier audit Lynis qui
// reflète la machine, et un rapport complet qui cite l'indice et un constat
// encore ouvert.
// Sources : https://cisofy.com/documentation/lynis/, https://nmap.org/book/man.html,
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
const SECTIONS = ['resume', 'constats', 'preuves', 'reste'];
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

// Le pare-feu après « L'exposition » : SSH, 80 et 443.
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
// Les nombres écrits juste après le mot « indice » (ou « index », « hardening »…) : « indice de durcissement 80 ».
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
  if ((s.resume ?? '').trim().length < 30) m.push('summary');
  const bas = (s.constats ?? '').toLowerCase();
  if (SUBJECTS.filter((x) => words(j, `follow-up-words-${x}`).some((w) => bas.includes(w))).length < 5) m.push('findings');
  const l = lynis(j);
  if (!l) m.push('lynis');
  else if (!digits(j, s.preuves ?? '').includes(l.hint) || !/443/.test(s.preuves ?? '')) m.push('proofs');
  const ids = (s.reste ?? '').match(/\b[A-Z]{3,4}-\d{4}\b/g) ?? [];
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
  state: () => ({
    sshd: { load: {}, connectionsToLoad: 1, reloads: 0 },
    ufw: { ...newFirewall(), enabled: true, rules: RULES.map((r) => ({ ...r })) },
    ecoute: bakeryListening(true),
    scan: bakeryScan(),
    apt: bakeryApt(true),
    systemd: newSystemd('bakery', NOW - 5 * 86_400_000, NOW, {
      ssh: serviceSsh(),
      nginx: { description: 'A high performance web server and a reverse proxy server', active: true, executable: 'nginx' },
      cron: { description: 'Regular background program processing daemon', active: true, executable: 'cron' },
    }),
  }),
  initialise: (j) => {
    loadSshd(j);
    // Salomé ne relit que ce qui a changé : l'état de départ compte comme déjà lu.
    j.state.rapportLu = readReport(j);
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
  // Salomé relit le rapport de clôture après chaque enregistrement.
  afterCommand: (j) => {
    const text = readReport(j);
    if (text === j.state.rapportLu || j.state.rapportFini) return;
    j.state.rapportLu = text;
    const rest = missing(j);
    if (!rest.length) {
      j.state.rapportFini = true;
      return;
    }
    return [j.t('follow-up-review'), ...rest.map((m) => `- ${j.t(`follow-up-missing-${m}`, { cible: String(TARGET) })}`)].join('\n');
  },
  events: [
    { id: 'error-ssh', condition: errorSsh, message: (j) => j.t('follow-up-event-error-ssh') },
    { id: 'locked-out', condition: (j) => !between(j), message: (j) => j.t('follow-up-event-locked-out') },
    {
      id: 'outside-scope',
      condition: outsideScope,
      message: (j) => j.t('follow-up-event-outside-scope', { adresses: addressesOutside(j).join(', '), voisin: addressesOutside(j).includes(NEIGHBOUR.address) ? 'oui' : 'non' }),
    },
    {
      id: 'scan',
      condition: (j) => !!lastScan(j),
      message: (j) => j.t('follow-up-event-scan', { ancienne: dayASsh(lastScan(j)) ? 'non' : 'oui' }),
    },
    {
      id: 'lynis',
      condition: (j) => !!lynis(j),
      message: (j) => j.t('follow-up-event-lynis', { indice: String(lynis(j)!.hint), avertissements: String(lynis(j)!.warnings) }),
    },
    { id: 'update', condition: dayA, message: (j) => j.t('follow-up-event-update') },
    {
      id: 'ssh-a-reload',
      condition: (j) => sshChange(j) && !errorSsh(j),
      message: (j) => j.t('follow-up-event-ssh-a-reload'),
    },
    { id: 'hardened', condition: (j) => hardened(j) && appliesSsh(j), message: (j) => j.t('follow-up-event-hardened', { cible: String(TARGET) }) },
    { id: 'proof-lynis', condition: (j) => lynisProof(j) && appliesSsh(j), message: (j) => j.t('follow-up-event-proof-lynis') },
    { id: 'nmap-own', condition: nmapOk, message: (j) => j.t('follow-up-event-nmap-own') },
    {
      id: 'end',
      condition: (j) => lynisProof(j) && appliesSsh(j) && nmapOk(j) && okReport(j),
      message: (j) => j.t('follow-up-event-end', { faute: outsideScope(j) ? 'oui' : 'non' }),
    },
  ],
};
