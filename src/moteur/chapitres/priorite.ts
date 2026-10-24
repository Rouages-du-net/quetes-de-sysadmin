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

import { chemin, f, type Chapitre } from '../monde';
import type { Jeu } from '../shell';
import { nouveauSystemd } from '../systemd';
import { CVE, M, MAINTENANT, MOT_DE_PASSE, aptVeille, comptesVeille, ecouteVeille, initialiserVeille, mondeVeille, nginxVeille, scanVeille, serviceSsh } from './veille';

const DOC = `${M}/priorite.md`;
const DEMARRE = MAINTENANT - 11 * 86_400_000;

const lireDoc = (j: Jeu) => j.lire(chemin(j.t, DOC)) ?? '';
const texte = (j: Jeu) => lireDoc(j).toLowerCase();
const mots = (j: Jeu, cle: string) => j.t(cle).split(',').map((m) => m.trim().toLowerCase());

const modeleOk = (j: Jeu) => !texte(j).includes(j.t('priorite-a-completer').toLowerCase());
const citeOk = (j: Jeu) => texte(j).includes(CVE.nginx.id.toLowerCase()) && texte(j).includes(CVE.rsync.id.toLowerCase());
const ordre = (j: Jeu) => {
  const t = texte(j);
  const i1 = t.indexOf(CVE.nginx.id.toLowerCase());
  const i2 = t.indexOf(CVE.rsync.id.toLowerCase());
  return i1 >= 0 && i2 >= 0 ? i1 - i2 : null;
};
const ordreOk = (j: Jeu) => (ordre(j) ?? 1) < 0;
const scoreSeul = (j: Jeu) => citeOk(j) && !ordreOk(j);
const expositionOk = (j: Jeu) => mots(j, 'priorite-mots-expose').some((m) => texte(j).includes(m)) && mots(j, 'priorite-mots-local').some((m) => texte(j).includes(m));
const sshOk = (j: Jeu) => texte(j).includes(CVE.ssh.id.toLowerCase()) && mots(j, 'priorite-mots-protege').some((m) => texte(j).includes(m));
const docOk = (j: Jeu) => modeleOk(j) && citeOk(j) && ordreOk(j) && expositionOk(j) && sshOk(j);

const manques = (j: Jeu): string[] => {
  const m: string[] = [];
  if (!modeleOk(j)) m.push('modele');
  if (!citeOk(j) || !ordreOk(j)) m.push('ordre');
  if (citeOk(j) && ordreOk(j) && !expositionOk(j)) m.push('exposition');
  if (citeOk(j) && ordreOk(j) && expositionOk(j) && !sshOk(j)) m.push('ssh');
  return m;
};

export const priorite: Chapitre = {
  id: 'priorite',
  numero: 2,
  commandes: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'nano', 'sudo', 'id', 'whoami', 'ss', 'nmap'],
  maison: M,
  accueil: 'courriel_salome.txt',
  noms: true,
  final: 'fin',
  etapes: ['expose', 'ordre', 'fin'],
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
      maison: { 'courriel_salome.txt': f(t('priorite-courriel-salome')), 'priorite.md': f(t('priorite-modele'), { lignes: true }) },
    }),
  apresCommande: (j) => {
    const texte = lireDoc(j);
    if (texte === j.etat.prioriteLue || j.etat.prioriteFinie) return;
    j.etat.prioriteLue = texte;
    if (scoreSeul(j)) return j.t('priorite-evenement-score-seul');
    const reste = manques(j);
    if (!reste.length) {
      j.etat.prioriteFinie = true;
      return;
    }
    return [j.t('priorite-relecture'), ...reste.map((m) => `- ${j.t(`priorite-manque-${m}`)}`)].join('\n');
  },
  evenements: [
    {
      id: 'expose',
      condition: (j) => j.derniere.commandes.some((c) => c[0] === 'ss' || c[0] === 'nmap') && (/:(80|443)\b/.test(j.derniere.sortie) || /80\/tcp|443\/tcp/.test(j.derniere.sortie)),
      message: (j) => j.t('priorite-evenement-expose'),
    },
    { id: 'ordre', condition: docOk, message: (j) => j.t('priorite-evenement-ordre') },
    { id: 'fin', condition: docOk, message: (j) => j.t('priorite-evenement-fin') },
  ],
};
