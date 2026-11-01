// Histoire « La Veille » — chapitre « Sans preuve, pas de certitude » : un
// correctif qu'on n'a pas vérifié n'est qu'une intention (la leçon de « La
// contre-visite », reprise). On reprouve que nginx et rsync sont à jour, et
// on regarde dans les journaux si quelqu'un avait déjà essayé d'exploiter
// la faille HTTP/2 de nginx avant le correctif : une requête HTTP/2 vide,
// sans en-tête, que nginx a refusée (400), mais qui vaut la peine d'être
// notée.
// Objectif vérifié sur l'état : les deux paquets confirmés à jour (apt list
// --upgradable vide), la tentative trouvée dans access.log (grep), et le
// site toujours servi.
// Sources : https://manpages.debian.org/trixie/apt/apt.8.en.html,
// https://nginx.org/en/docs/http/ngx_http_log_module.html

import { f, type Chapter } from '../world';
import type { Game } from '../shell';
import { newSystemd } from '../systemd';
import type { AptState } from '../commands/apt';
import { CVE, M, NOW, PASSWORD, watchApt, watchAccounts, watchListening, initialiseWatch, watchWorld, watchNginx, watchScan, serviceSsh } from './watch';

const STARTED = NOW - 13 * 86_400_000;
const SUSPICIOUS = '203.0.113.77';

// Un journal d'accès ordinaire, avec une tentative suspecte avant le correctif : une
// requête HTTP/2 vide, sans navigateur déclaré, refusée par nginx (400).
const ACCESS = `192.0.2.44 - - [05/Sep/2028:09:12:33 +0200] "GET / HTTP/1.1" 200 612 "-" "Mozilla/5.0 (X11; Linux x86_64)"
192.0.2.51 - - [06/Sep/2028:11:40:02 +0200] "GET / HTTP/1.1" 200 612 "-" "Mozilla/5.0 (Android 14)"
${SUSPICIOUS} - - [09/Sep/2028:02:14:07 +0200] "GET / HTTP/2.0" 400 0 "-" "-"
192.0.2.60 - - [11/Sep/2028:08:03:51 +0200] "GET / HTTP/1.1" 200 612 "-" "Mozilla/5.0 (Macintosh)"
192.0.2.44 - - [14/Sep/2028:17:22:09 +0200] "GET / HTTP/1.1" 200 612 "-" "Mozilla/5.0 (X11; Linux x86_64)"`;

const apt = (j: Game) => j.state.apt as AptState;
const okUpToDate = (j: Game) => apt(j).installed.nginx === CVE.nginx.corrigee && apt(j).installed.rsync === CVE.rsync.corrigee;
const okFound = (j: Game) =>
  j.last.commands.some((c) => ['grep', 'cat', 'less', 'head', 'tail'].includes(c[0])) && j.last.output.includes(SUSPICIOUS);
const siteOk = (j: Game) => j.last.commands.some((c) => c[0] === 'curl') && /200/.test(j.last.output);

export const proof: Chapter = {
  id: 'proof',
  number: 4,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'wc', 'sudo', 'id', 'whoami', 'apt', 'curl', 'nano'],
  home: M,
  welcome: 'email_salome.txt',
  names: true,
  final: 'end',
  steps: ['versions', 'found', 'end'],
  password: PASSWORD,
  accounts: watchAccounts,
  state: () => ({
    sshd: { load: {}, connectionsToLoad: 1, reloads: 0 },
    listening: watchListening(),
    nginx: watchNginx(),
    scan: watchScan(),
    apt: { ...watchApt(true), installed: { ...watchApt(true).installed, nginx: CVE.nginx.corrigee, rsync: CVE.rsync.corrigee }, updates: {} },
    systemd: newSystemd('petrin', STARTED, NOW, {
      ssh: serviceSsh(),
      nginx: { description: 'A high performance web server and a reverse proxy server', active: true, executable: 'nginx' },
      cron: { description: 'Regular background program processing daemon', active: true, executable: 'cron' },
    }),
  }),
  initialise: initialiseWatch,
  createWorld: (t) =>
    watchWorld(t, {
      home: { 'email_salome.txt': f(t('proof-email-salome')) },
      logAccess: ACCESS,
    }),
  events: [
    {
      id: 'versions',
      condition: (j) => j.last.commands.some((c) => c[0] === 'apt') && okUpToDate(j) && /Listing\.\.\. Done/.test(j.last.output),
      message: (j) => j.t('proof-event-versions'),
    },
    { id: 'found', condition: okFound, message: (j) => j.t('proof-event-found', { adresse: SUSPICIOUS }) },
    { id: 'end', condition: (j) => okUpToDate(j) && j.flags.has('found') && siteOk(j), message: (j) => j.t('proof-event-end') },
  ],
};
