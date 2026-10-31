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

import { f, type Chapitre } from '../world';
import type { Jeu } from '../shell';
import { nouveauSystemd } from '../systemd';
import type { EtatApt } from '../commands/apt';
import { CVE, M, MAINTENANT, MOT_DE_PASSE, aptVeille, comptesVeille, ecouteVeille, initialiserVeille, mondeVeille, nginxVeille, scanVeille, serviceSsh } from './watch';

const DEMARRE = MAINTENANT - 13 * 86_400_000;
const SUSPECTE = '203.0.113.77';

// Un journal d'accès ordinaire, avec une tentative suspecte avant le correctif : une
// requête HTTP/2 vide, sans navigateur déclaré, refusée par nginx (400).
const ACCES = `192.0.2.44 - - [05/Sep/2028:09:12:33 +0200] "GET / HTTP/1.1" 200 612 "-" "Mozilla/5.0 (X11; Linux x86_64)"
192.0.2.51 - - [06/Sep/2028:11:40:02 +0200] "GET / HTTP/1.1" 200 612 "-" "Mozilla/5.0 (Android 14)"
${SUSPECTE} - - [09/Sep/2028:02:14:07 +0200] "GET / HTTP/2.0" 400 0 "-" "-"
192.0.2.60 - - [11/Sep/2028:08:03:51 +0200] "GET / HTTP/1.1" 200 612 "-" "Mozilla/5.0 (Macintosh)"
192.0.2.44 - - [14/Sep/2028:17:22:09 +0200] "GET / HTTP/1.1" 200 612 "-" "Mozilla/5.0 (X11; Linux x86_64)"`;

const apt = (j: Jeu) => j.etat.apt as EtatApt;
const ajourOk = (j: Jeu) => apt(j).installes.nginx === CVE.nginx.corrigee && apt(j).installes.rsync === CVE.rsync.corrigee;
const trouveOk = (j: Jeu) =>
  j.derniere.commandes.some((c) => ['grep', 'cat', 'less', 'head', 'tail'].includes(c[0])) && j.derniere.sortie.includes(SUSPECTE);
const siteOk = (j: Jeu) => j.derniere.commandes.some((c) => c[0] === 'curl') && /200/.test(j.derniere.sortie);

export const preuve: Chapitre = {
  id: 'preuve',
  numero: 4,
  commandes: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'wc', 'sudo', 'id', 'whoami', 'apt', 'curl', 'nano'],
  maison: M,
  accueil: 'courriel_salome.txt',
  noms: true,
  final: 'fin',
  etapes: ['versions', 'trouve', 'fin'],
  motDePasse: MOT_DE_PASSE,
  comptes: comptesVeille,
  etat: () => ({
    sshd: { charge: {}, connexionsAuChargement: 1, recharges: 0 },
    ecoute: ecouteVeille(),
    nginx: nginxVeille(),
    scan: scanVeille(),
    apt: { ...aptVeille(true), installes: { ...aptVeille(true).installes, nginx: CVE.nginx.corrigee, rsync: CVE.rsync.corrigee }, mises: {} },
    systemd: nouveauSystemd('petrin', DEMARRE, MAINTENANT, {
      ssh: serviceSsh(),
      nginx: { description: 'A high performance web server and a reverse proxy server', active: true, executable: 'nginx' },
      cron: { description: 'Regular background program processing daemon', active: true, executable: 'cron' },
    }),
  }),
  initialiser: initialiserVeille,
  creerMonde: (t) =>
    mondeVeille(t, {
      maison: { 'courriel_salome.txt': f(t('preuve-courriel-salome')) },
      accesLog: ACCES,
    }),
  evenements: [
    {
      id: 'versions',
      condition: (j) => j.derniere.commandes.some((c) => c[0] === 'apt') && ajourOk(j) && /Listing\.\.\. Done/.test(j.derniere.sortie),
      message: (j) => j.t('preuve-evenement-versions'),
    },
    { id: 'trouve', condition: trouveOk, message: (j) => j.t('preuve-evenement-trouve', { adresse: SUSPECTE }) },
    { id: 'fin', condition: (j) => ajourOk(j) && j.drapeaux.has('trouve') && siteOk(j), message: (j) => j.t('preuve-evenement-fin') },
  ],
};
