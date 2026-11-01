// Histoire « La Veille » — chapitre « Le bulletin » : chaque semaine, un
// bulletin de sécurité (comme les avis Debian) liste plusieurs CVE. Avant de
// s'inquiéter, il faut vérifier que chacune concerne VRAIMENT ce serveur :
// un paquet absent, ou déjà à une version au-delà de celle corrigée, n'est
// pas une alerte. Deux CVE concernent le Fournil (nginx, rsync) ; une n'est
// pas installée (certbot) ; une est déjà corrigée par une mise à jour
// précédente (curl) ; une s'applique en théorie mais ne change rien ici
// (openssh-server : KbdInteractiveAuthentication est déjà à « no »).
// Objectif vérifié sur l'état : le tri dans veille.md classe chaque CVE du
// bon côté. Pièges prévus : classer certbot (absent) comme pertinent,
// classer curl (déjà corrigé) comme pertinent, oublier nginx ou rsync.
// Sources : https://www.debian.org/security/, https://www.cve.org/,
// https://www.first.org/cvss/calculator/4-0

import { path, f, name, type Chapter } from '../world';
import type { Game } from '../shell';
import { newSystemd } from '../systemd';
import { CVE, M, NOW, PASSWORD, watchApt, watchAccounts, watchListening, initialiseWatch, watchWorld, watchNginx, watchScan, sectionsMd, serviceSsh } from './watch';

const DOC = `${M}/watch.md`;
const SECTIONS = ['concerne', 'sansobjet'];
// Dix jours avant le début du chapitre : la machine tourne déjà depuis un moment.
const STARTED = NOW - 10 * 86_400_000;

const readDoc = (j: Game) => j.read(path(j.t, DOC));
const sections = (j: Game) => sectionsMd(j, readDoc(j) ?? '', 'bulletin-section', SECTIONS);
const words = (j: Game, key: string) => j.t(key).split(',').map((m) => m.trim().toLowerCase());

const concernsOk = (j: Game) => {
  const s = (sections(j).concerne ?? '').toLowerCase();
  const withoutObject = (sections(j).sansobjet ?? '').toLowerCase();
  return (
    [CVE.nginx.id, CVE.rsync.id, CVE.ssh.id].every((id) => s.includes(id.toLowerCase())) &&
    ![CVE.certbot.id, CVE.curl.id].some((id) => s.includes(id.toLowerCase())) &&
    !withoutObject.includes(CVE.nginx.id.toLowerCase()) &&
    !withoutObject.includes(CVE.rsync.id.toLowerCase())
  );
};
const withoutOkObject = (j: Game) => {
  const s = (sections(j).sansobjet ?? '').toLowerCase();
  return (
    s.includes(CVE.certbot.id.toLowerCase()) &&
    s.includes(CVE.curl.id.toLowerCase()) &&
    words(j, 'bulletin-mots-absent').some((m) => s.includes(m)) &&
    words(j, 'bulletin-mots-corrige').some((m) => s.includes(m))
  );
};
const okTemplate = (j: Game) => !(readDoc(j) ?? '').toLowerCase().includes(j.t('bulletin-a-completer').toLowerCase());
const okSort = (j: Game) => okTemplate(j) && concernsOk(j) && withoutOkObject(j);

const missing = (j: Game): string[] => {
  const m: string[] = [];
  if (!okTemplate(j)) m.push('modele');
  if (!concernsOk(j)) m.push('concerne');
  if (!withoutOkObject(j)) m.push('sansobjet');
  return m;
};

export const bulletin: Chapter = {
  id: 'bulletin',
  number: 1,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'nano', 'sudo', 'id', 'whoami', 'apt'],
  home: M,
  welcome: 'email_salome.txt',
  names: true,
  final: 'fin',
  steps: ['lu', 'tri', 'fin'],
  password: PASSWORD,
  accounts: watchAccounts,
  state: () => ({
    sshd: { load: {}, connectionsToLoad: 1, reloads: 0 },
    ecoute: watchListening(),
    nginx: watchNginx(),
    scan: watchScan(),
    apt: watchApt(),
    systemd: newSystemd('petrin', STARTED, NOW, {
      ssh: serviceSsh(),
      nginx: { description: 'A high performance web server and a reverse proxy server', active: true, executable: 'nginx' },
      cron: { description: 'Regular background program processing daemon', active: true, executable: 'cron' },
    }),
  }),
  initialise: initialiseWatch,
  createWorld: (t) =>
    watchWorld(t, {
      home: { 'email_salome.txt': f(t('bulletin-courriel-salome')), 'security_bulletin.txt': f(t('bulletin-fichier'), { lines: true }), 'watch.md': f(t('bulletin-modele'), { lines: true }) },
    }),
  afterCommand: (j) => {
    const text = readDoc(j);
    if (text === j.state.veilleLue || j.state.veilleFinie) return;
    j.state.veilleLue = text;
    const rest = missing(j);
    if (!rest.length) {
      j.state.veilleFinie = true;
      return;
    }
    return [j.t('bulletin-relecture'), ...rest.map((m) => `- ${j.t(`bulletin-manque-${m}`)}`)].join('\n');
  },
  events: [
    {
      id: 'lu',
      condition: (j) => j.last.commands.some((c) => c.some((a) => a.endsWith(name(j.t, 'security_bulletin.txt')))),
      message: (j) => j.t('bulletin-evenement-lu'),
    },
    { id: 'tri', condition: okSort, message: (j) => j.t('bulletin-evenement-tri') },
    { id: 'fin', condition: okSort, message: (j) => j.t('bulletin-evenement-fin') },
  ],
};

