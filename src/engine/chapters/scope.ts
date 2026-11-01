// Histoire « L'Audit » — chapitre « Le périmètre » : avant de balayer quoi que
// ce soit, on lit la lettre de mission : elle dit ce qu'on a le droit de sonder
// (le serveur fournil, 192.0.2.22) et ce qu'on n'a pas le droit de toucher. Le
// serveur du voisin (la pizzeria, 192.0.2.24) partage la box et paraît
// « intéressant » (une base ouverte) : il est hors périmètre. On fait
// l'inventaire du Fournil vu d'internet avec nmap, on garde la trace (-oN), et
// on rédige ses notes : ce qu'on a trouvé, et ce qu'on a repéré sans y toucher.
//   - nmap -sV fournil.internal -oN inventaire.txt : les ports ouverts et les
//     versions ; les ports 5432 (PostgreSQL) et 6379 (Redis) n'ont rien à faire là ;
//   - un balayage de tout le réseau (192.0.2.0/24) sonde le voisin : la faute.
//     Le jeu l'accepte (sans conséquence) et la raconte dans le débrief ;
//   - notes-audit.md : périmètre, constats, hors périmètre. Salomé relit à chaque
//     enregistrement et dit ce qui manque.
// Objectif vérifié sur l'état : une trace nmap -sV du Fournil gardée dans un
// fichier, des notes complétées qui nomment les ports 5432 et 6379 et la
// machine hors périmètre. Le débrief dépend de ce qui a été sondé.
// Sources : https://nmap.org/book/man.html, https://nmap.org/book/legal-issues.html

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
// Les adresses sondées hors de la lettre de mission, et si le voisin en fait partie.
const addressesOutside = (j: Game) => [...new Set(scans(j).flatMap((b) => b.outsideScope))];

// Les fichiers de la maison : le texte de chacun (la trace nmap peut avoir n'importe quel nom).
const texts = (j: Game): string[] => {
  const home = j.find((j as Shell).home);
  if (home?.type !== 'dossier') return [];
  return Object.entries(home.children)
    .filter(([, n]) => n.type === 'fichier')
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
    // Salomé ne relit que ce qui a changé : le modèle de départ compte comme déjà lu.
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
  // Salomé relit les notes après chaque enregistrement.
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
      message: (j) => j.t('scope-event-outside-scope', { adresses: addressesOutside(j).join(', '), voisin: addressesOutside(j).includes(NEIGHBOUR.address) ? 'oui' : 'non' }),
    },
    { id: 'trace', condition: traceOk, message: (j) => j.t('scope-event-trace') },
    {
      id: 'end',
      condition: (j) => traceOk(j) && notesOk(j),
      message: (j) => j.t('scope-event-end', { faute: outsideScope(j) ? 'oui' : 'non' }),
    },
  ],
};
