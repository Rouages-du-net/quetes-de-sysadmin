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

import { chemin, f, nom, type Chapitre } from '../world';
import type { Jeu } from '../shell';
import { nouveauSystemd } from '../systemd';
import { CVE, M, MAINTENANT, MOT_DE_PASSE, aptVeille, comptesVeille, ecouteVeille, initialiserVeille, mondeVeille, nginxVeille, scanVeille, sectionsMd, serviceSsh } from './watch';

const DOC = `${M}/veille.md`;
const SECTIONS = ['concerne', 'sansobjet'];
// Dix jours avant le début du chapitre : la machine tourne déjà depuis un moment.
const DEMARRE = MAINTENANT - 10 * 86_400_000;

const lireDoc = (j: Jeu) => j.lire(chemin(j.t, DOC));
const sections = (j: Jeu) => sectionsMd(j, lireDoc(j) ?? '', 'bulletin-section', SECTIONS);
const mots = (j: Jeu, cle: string) => j.t(cle).split(',').map((m) => m.trim().toLowerCase());

const concerneOk = (j: Jeu) => {
  const s = (sections(j).concerne ?? '').toLowerCase();
  const sansObjet = (sections(j).sansobjet ?? '').toLowerCase();
  return (
    [CVE.nginx.id, CVE.rsync.id, CVE.ssh.id].every((id) => s.includes(id.toLowerCase())) &&
    ![CVE.certbot.id, CVE.curl.id].some((id) => s.includes(id.toLowerCase())) &&
    !sansObjet.includes(CVE.nginx.id.toLowerCase()) &&
    !sansObjet.includes(CVE.rsync.id.toLowerCase())
  );
};
const sansObjetOk = (j: Jeu) => {
  const s = (sections(j).sansobjet ?? '').toLowerCase();
  return (
    s.includes(CVE.certbot.id.toLowerCase()) &&
    s.includes(CVE.curl.id.toLowerCase()) &&
    mots(j, 'bulletin-mots-absent').some((m) => s.includes(m)) &&
    mots(j, 'bulletin-mots-corrige').some((m) => s.includes(m))
  );
};
const modeleOk = (j: Jeu) => !(lireDoc(j) ?? '').toLowerCase().includes(j.t('bulletin-a-completer').toLowerCase());
const triOk = (j: Jeu) => modeleOk(j) && concerneOk(j) && sansObjetOk(j);

const manques = (j: Jeu): string[] => {
  const m: string[] = [];
  if (!modeleOk(j)) m.push('modele');
  if (!concerneOk(j)) m.push('concerne');
  if (!sansObjetOk(j)) m.push('sansobjet');
  return m;
};

export const bulletin: Chapitre = {
  id: 'bulletin',
  numero: 1,
  commandes: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'nano', 'sudo', 'id', 'whoami', 'apt'],
  maison: M,
  accueil: 'courriel_salome.txt',
  noms: true,
  final: 'fin',
  etapes: ['lu', 'tri', 'fin'],
  motDePasse: MOT_DE_PASSE,
  comptes: comptesVeille,
  etat: () => ({
    sshd: { charge: {}, connexionsAuChargement: 1, recharges: 0 },
    ecoute: ecouteVeille(),
    nginx: nginxVeille(),
    scan: scanVeille(),
    apt: aptVeille(),
    systemd: nouveauSystemd('petrin', DEMARRE, MAINTENANT, {
      ssh: serviceSsh(),
      nginx: { description: 'A high performance web server and a reverse proxy server', active: true, executable: 'nginx' },
      cron: { description: 'Regular background program processing daemon', active: true, executable: 'cron' },
    }),
  }),
  initialiser: initialiserVeille,
  creerMonde: (t) =>
    mondeVeille(t, {
      maison: { 'courriel_salome.txt': f(t('bulletin-courriel-salome')), 'bulletin-securite.txt': f(t('bulletin-fichier'), { lignes: true }), 'veille.md': f(t('bulletin-modele'), { lignes: true }) },
    }),
  apresCommande: (j) => {
    const texte = lireDoc(j);
    if (texte === j.etat.veilleLue || j.etat.veilleFinie) return;
    j.etat.veilleLue = texte;
    const reste = manques(j);
    if (!reste.length) {
      j.etat.veilleFinie = true;
      return;
    }
    return [j.t('bulletin-relecture'), ...reste.map((m) => `- ${j.t(`bulletin-manque-${m}`)}`)].join('\n');
  },
  evenements: [
    {
      id: 'lu',
      condition: (j) => j.derniere.commandes.some((c) => c.some((a) => a.endsWith(nom(j.t, 'bulletin-securite.txt')))),
      message: (j) => j.t('bulletin-evenement-lu'),
    },
    { id: 'tri', condition: triOk, message: (j) => j.t('bulletin-evenement-tri') },
    { id: 'fin', condition: triOk, message: (j) => j.t('bulletin-evenement-fin') },
  ],
};

