// Histoire « La Veille » — chapitre « La priorité » : deux CVE restent à
// traiter (nginx et rsync). Le score CVSS seul ne suffit pas pour décider
// quoi corriger en premier : il faut croiser avec l'exposition, déjà
// apprise dans « Le périmètre » et « L'exposition » (L'Audit). nginx (80,
// 443) est joignable depuis internet ; rsync n'a aucun port en écoute (un
// outil en ligne de commande, pas un service) : même avec un score plus
// bas, nginx passe avant.
// Objectif vérifié sur l'état : priorite.md classe nginx avant rsync, avec
// une justification qui cite l'exposition (pas seulement le score), et
// note que openssh-server n'a rien à faire ici (déjà protégé).
// Pièges prévus : classer uniquement par score CVSS décroissant (rsync
// avant nginx).
// Sources : https://man7.org/linux/man-pages/man8/ss.8.html,
// https://nmap.org/book/man.html, https://www.first.org/cvss/

import { path, f, type Chapter } from '../world';
import type { Game } from '../shell';
import { newSystemd } from '../systemd';
import { CVE, M, NOW, PASSWORD, watchApt, watchAccounts, watchListening, initialiseWatch, watchWorld, watchNginx, watchScan, serviceSsh } from './watch';

const DOC = `${M}/priority.md`;
const STARTED = NOW - 11 * 86_400_000;

const readDoc = (j: Game) => j.read(path(j.t, DOC)) ?? '';
const text = (j: Game) => readDoc(j).toLowerCase();
const words = (j: Game, key: string) => j.t(key).split(',').map((m) => m.trim().toLowerCase());

const okTemplate = (j: Game) => !text(j).includes(j.t('priority-a-completer').toLowerCase());
const okCity = (j: Game) => text(j).includes(CVE.nginx.id.toLowerCase()) && text(j).includes(CVE.rsync.id.toLowerCase());
const order = (j: Game) => {
  const t = text(j);
  const i1 = t.indexOf(CVE.nginx.id.toLowerCase());
  const i2 = t.indexOf(CVE.rsync.id.toLowerCase());
  return i1 >= 0 && i2 >= 0 ? i1 - i2 : null;
};
const okOrder = (j: Game) => (order(j) ?? 1) < 0;
const onlyScore = (j: Game) => okCity(j) && !okOrder(j);
const okExposure = (j: Game) => words(j, 'priority-mots-expose').some((m) => text(j).includes(m)) && words(j, 'priority-mots-local').some((m) => text(j).includes(m));
const sshOk = (j: Game) => text(j).includes(CVE.ssh.id.toLowerCase()) && words(j, 'priority-mots-protege').some((m) => text(j).includes(m));
const docOk = (j: Game) => okTemplate(j) && okCity(j) && okOrder(j) && okExposure(j) && sshOk(j);

const missing = (j: Game): string[] => {
  const m: string[] = [];
  if (!okTemplate(j)) m.push('modele');
  if (!okCity(j) || !okOrder(j)) m.push('ordre');
  if (okCity(j) && okOrder(j) && !okExposure(j)) m.push('exposition');
  if (okCity(j) && okOrder(j) && okExposure(j) && !sshOk(j)) m.push('ssh');
  return m;
};

export const priority: Chapter = {
  id: 'priority',
  number: 2,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'nano', 'sudo', 'id', 'whoami', 'ss', 'nmap'],
  home: M,
  welcome: 'email_salome.txt',
  names: true,
  final: 'fin',
  steps: ['expose', 'ordre', 'fin'],
  password: PASSWORD,
  accounts: watchAccounts,
  state: () => ({
    sshd: { load: {}, connectionsToLoad: 1, reloads: 0 },
    ecoute: watchListening(),
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
      home: { 'email_salome.txt': f(t('priority-courriel-salome')), 'priority.md': f(t('priority-modele'), { lines: true }) },
    }),
  afterCommand: (j) => {
    const text = readDoc(j);
    if (text === j.state.prioriteLue || j.state.prioriteFinie) return;
    j.state.prioriteLue = text;
    if (onlyScore(j)) return j.t('priority-evenement-score-seul');
    const rest = missing(j);
    if (!rest.length) {
      j.state.prioriteFinie = true;
      return;
    }
    return [j.t('priority-relecture'), ...rest.map((m) => `- ${j.t(`priority-manque-${m}`)}`)].join('\n');
  },
  events: [
    {
      id: 'expose',
      condition: (j) => j.last.commands.some((c) => c[0] === 'ss' || c[0] === 'nmap') && (/:(80|443)\b/.test(j.last.output) || /80\/tcp|443\/tcp/.test(j.last.output)),
      message: (j) => j.t('priority-evenement-expose'),
    },
    { id: 'ordre', condition: docOk, message: (j) => j.t('priority-evenement-ordre') },
    { id: 'fin', condition: docOk, message: (j) => j.t('priority-evenement-fin') },
  ],
};
