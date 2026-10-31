// Histoire « La Veille » — chapitre « Le correctif » : corriger nginx et
// rsync, dans cet ordre décidé au chapitre précédent, sans rien casser.
// apt upgrade installe les deux correctifs d'un coup (les paquets Debian ne
// se mettent pas à jour un par un), mais encore faut-il rafraîchir la liste
// avant : sans apt update, apt upgrade ne trouve rien à faire.
// Objectif vérifié sur l'état : nginx et rsync à la version corrigée, et le
// site du Fournil toujours servi (curl).
// Pièges prévus : apt upgrade sans apt update d'abord (« 0 upgraded »).
// Sources : https://manpages.debian.org/trixie/apt/apt.8.en.html

import { f, type Chapitre } from '../world';
import type { Jeu } from '../shell';
import { nouveauSystemd } from '../systemd';
import type { EtatApt } from '../commands/apt';
import { CVE, M, MAINTENANT, MOT_DE_PASSE, aptVeille, comptesVeille, ecouteVeille, initialiserVeille, mondeVeille, nginxVeille, scanVeille, serviceSsh } from './watch';

const DEMARRE = MAINTENANT - 12 * 86_400_000;

const apt = (j: Jeu) => j.etat.apt as EtatApt;
const nginxOk = (j: Jeu) => apt(j).installes.nginx === CVE.nginx.corrigee;
const rsyncOk = (j: Jeu) => apt(j).installes.rsync === CVE.rsync.corrigee;
const corrigeOk = (j: Jeu) => nginxOk(j) && rsyncOk(j);
// Une tentative d'apt upgrade sans apt update d'abord (0 mise à jour trouvée).
const tenteSansMaj = (j: Jeu) =>
  j.derniere.commandes.some((c) => c[0] === 'apt' && (c[1] === 'upgrade' || c[1] === 'full-upgrade')) && /Upgrading: 0/.test(j.derniere.sortie) && !corrigeOk(j);
const siteOk = (j: Jeu) => j.derniere.commandes.some((c) => c[0] === 'curl') && /200/.test(j.derniere.sortie);

export const correctif: Chapitre = {
  id: 'correctif',
  numero: 3,
  commandes: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'sudo', 'id', 'whoami', 'apt', 'curl', 'systemctl'],
  maison: M,
  accueil: 'courriel_salome.txt',
  noms: true,
  final: 'fin',
  etapes: ['corrige', 'verifie', 'fin'],
  motDePasse: MOT_DE_PASSE,
  comptes: comptesVeille,
  etat: () => ({
    sshd: { charge: {}, connexionsAuChargement: 1, recharges: 0 },
    ecoute: ecouteVeille(),
    nginx: nginxVeille(),
    scan: scanVeille(),
    apt: aptVeille(false),
    systemd: nouveauSystemd('petrin', DEMARRE, MAINTENANT, {
      ssh: serviceSsh(),
      nginx: { description: 'A high performance web server and a reverse proxy server', active: true, executable: 'nginx' },
      cron: { description: 'Regular background program processing daemon', active: true, executable: 'cron' },
    }),
  }),
  initialiser: initialiserVeille,
  creerMonde: (t) =>
    mondeVeille(t, {
      maison: { 'courriel_salome.txt': f(t('correctif-courriel-salome')) },
    }),
  evenements: [
    { id: 'sans-maj', condition: tenteSansMaj, message: (j) => j.t('correctif-evenement-sans-maj') },
    { id: 'corrige', condition: corrigeOk, message: (j) => j.t('correctif-evenement-corrige') },
    { id: 'verifie', condition: (j) => corrigeOk(j) && siteOk(j), message: (j) => j.t('correctif-evenement-verifie') },
    { id: 'fin', condition: (j) => corrigeOk(j) && siteOk(j), message: (j) => j.t('correctif-evenement-fin') },
  ],
};
