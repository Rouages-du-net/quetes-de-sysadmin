// Story "L'Audit" — chapter "The scope": before scanning anything at all,
// you read the engagement letter: it says what you are allowed to probe
// (the fournil server, 192.0.2.22) and what you are not allowed to touch.
// The neighbour's server (the pizzeria, 192.0.2.24) shares the router and
// looks "interesting" (an open database): it is out of scope. You inventory
// Le Fournil as seen from the internet with nmap, keep a record (-oN), and
// write your notes: what you found, and what you spotted without touching it.
//   - nmap -sV fournil.internal -oN inventaire.txt: the open ports and the
//     versions; ports 5432 (PostgreSQL) and 6379 (Redis) have no business there;
//   - a scan of the whole network (192.0.2.0/24) probes the neighbour: the mistake.
//     The game accepts it (without consequence) and tells it in the debrief;
//   - notes-audit.md: scope, findings, out of scope. Salomé rereads at each
//     save and says what is missing.
// Objective checked on the state: a record of nmap -sV of Le Fournil kept in
// a file, completed notes that name ports 5432 and 6379 and the machine out
// of scope. The debrief depends on what was probed.
// Sources: https://nmap.org/book/man.html, https://nmap.org/book/legal-issues.html

import { path, f, name, type Chapter } from '../world';
import type { Game, Shell } from '../shell';
import { newSystemd } from '../systemd';
import type { Scan } from '../scan';
import { PACKAGES, BASE_INSTALLED } from '../commands/apt';
import { machineName } from '../machines';
import { loadSshd, bakeryAccounts, sectionsMd, bakeryListening, file, M, NOW, PASSWORD, bakeryWorld, bakeryScan, serviceSsh, NEIGHBOUR } from './audit';

const NOTES = `${M}/audit_notes.md`;
const NOTES_TEMPLATE = 'scope-notes-template';

const scans = (j: Game): Scan[] => j.state.scans ?? [];
const probe = (b: Scan) => b.addresses.includes('192.0.2.22') || b.addresses.includes('127.0.0.1');
const outsideScope = (j: Game) => scans(j).some((b) => b.outsideScope.length > 0);
// The addresses probed outside the engagement letter, and whether the neighbour is one of them.
const addressesOutside = (j: Game) => [...new Set(scans(j).flatMap((b) => b.outsideScope))];

// The files of the home folder: the text of each (the nmap record can have any name).
const texts = (j: Game): string[] => {
  const home = j.find((j as Shell).home);
  if (home?.type !== 'directory') return [];
  return Object.entries(home.children)
    .filter(([, n]) => n.type === 'file')
    .map(([name]) => j.read(`${(j as Shell).home}/${name}`) ?? '');
};
const traceOk = (j: Game) => texts(j).some((t) => /^# Nmap .* as: nmap .*-sV/m.test(t) && t.includes(`Nmap scan report for ${machineName(j.t, 'bakery')}`) && /5432\/tcp/.test(t) && /6379\/tcp/.test(t));

const readNotes = (j: Game) => j.read(path(j.t, NOTES));
const words = (j: Game, key: string) => j.t(key).split(',').map((m) => m.trim().toLowerCase());
const missing = (j: Game): string[] => {
  const raw = readNotes(j) ?? '';
  const s = sectionsMd(j, raw, 'scope-section', ['scope', 'found', 'outside']);
  const found = (s.found ?? '').toLowerCase();
  const outside = (s.outside ?? '').toLowerCase();
  const m: string[] = [];
  if (raw.toLowerCase().includes(j.t('scope-a-complete').toLowerCase())) m.push('template');
  if (!found.includes('5432') || !found.includes('6379')) m.push('ports');
  if (!outside.includes(NEIGHBOUR.address) && !outside.includes('voisin')) m.push('neighbour');
  else if (!words(j, 'scope-words-outside').some((x) => outside.includes(x))) m.push('outside');
  return m;
};
const notesOk = (j: Game) => missing(j).length === 0;

export const scope: Chapter = {
  id: 'scope',
  number: 1,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'nano', 'id', 'whoami', 'sudo', 'ss', 'nmap'],
  home: M,
  welcome: 'email_salome.txt',
  names: true,
  final: 'end',
  steps: ['letter', 'scan', 'trace', 'end'],
  password: PASSWORD,
  accounts: () => bakeryAccounts(true),
  state: () => ({
    sshd: { load: {}, connectionsToLoad: 1, reloads: 0 },
    listening: bakeryListening(),
    scan: bakeryScan(),
    apt: {
      lists: true,
      installed: Object.fromEntries(BASE_INSTALLED.map((p) => [p, PACKAGES[p].version])),
      updates: {},
    },
    systemd: newSystemd('bakery', NOW - 5 * 86_400_000, NOW, { ssh: serviceSsh() }),
  }),
  initialise: (j) => {
    loadSshd(j);
    // Salomé only rereads what changed: the starting template counts as already read.
    j.state.notesRead = readNotes(j);
  },
  createWorld: (t) =>
    bakeryWorld(t, {
      home: {
        'email_salome.txt': f(t('scope-email-salome')),
        'engagement_letter.txt': f(t('scope-letter-mission'), { lines: true }),
        'audit_notes.md': f(t(NOTES_TEMPLATE), { lines: true }),
      },
      sudoersD: { '90-cloud-init-users': file('# Created by cloud-init\n\nvous ALL=(ALL) NOPASSWD:ALL', 'root', 'r--r-----') },
    }),
  // Salomé rereads the notes after each save.
  afterCommand: (j) => {
    const text = readNotes(j);
    if (text === j.state.notesRead || j.state.finishedNotes) return;
    j.state.notesRead = text;
    const rest = missing(j);
    if (!rest.length) {
      j.state.finishedNotes = true;
      return;
    }
    return [j.t('scope-review'), ...rest.map((m) => `- ${j.t(`scope-missing-${m}`)}`)].join('\n');
  },
  events: [
    {
      id: 'letter',
      condition: (j) => j.last.commands.some((c) => c.some((a) => a.endsWith(name(j.t, 'engagement_letter.txt')))),
      message: (j) => j.t('scope-event-letter'),
    },
    {
      id: 'scan',
      condition: (j) => scans(j).some(probe),
      message: (j) => j.t('scope-event-scan'),
    },
    {
      id: 'outside-scope',
      condition: outsideScope,
      message: (j) => j.t('scope-event-outside-scope', { addresses: addressesOutside(j).join(', '), neighbour: addressesOutside(j).includes(NEIGHBOUR.address) ? 'yes' : 'no' }),
    },
    { id: 'trace', condition: traceOk, message: (j) => j.t('scope-event-trace') },
    {
      id: 'end',
      condition: (j) => traceOk(j) && notesOk(j),
      message: (j) => j.t('scope-event-end', { mistake: outsideScope(j) ? 'yes' : 'no' }),
    },
  ],
};
