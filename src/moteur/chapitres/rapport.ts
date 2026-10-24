// Histoire « L'Audit » — chapitre « Le rapport » : Salomé, auditrice, a relevé
// quatre constats d'hygiène sur le serveur du Fournil. À corriger sans rien
// casser :
//   - SSH : root peut entrer (PermitRootLogin yes dans sshd_config) ; la
//     configuration n'est appliquée qu'au rechargement (sshd -t, reload) ;
//   - un compte qui ne devrait plus exister : Lucas, le stagiaire parti fin
//     février, a toujours son compte et sudo (userdel, ou verrouiller +
//     expirer + le retirer de sudo) ;
//   - sudo sans mot de passe : /etc/sudoers.d/90-cloud-init-users donne à
//     « vous » NOPASSWD: ALL (sudo -l le montre) ;
//   - un secret lisible par tous : /srv/commandes/.env (mot de passe de la
//     base) en rw-r--r-- ; chmod 600 sans retirer l'accès à l'appli.
// Objectif vérifié sur l'état : root refusé par sshd (rechargé) sans
// s'enfermer dehors, plus de compte actif pour Lucas, plus de règle
// NOPASSWD pour « vous » (sudo marche encore), le fichier fermé aux autres
// mais lisible par l'appli.
// Sources : https://man.openbsd.org/sshd_config, https://www.sudo.ws/docs/man/sudoers.man/,
// https://man7.org/linux/man-pages/man8/userdel.8.html, https://man7.org/linux/man-pages/man1/chmod.1.html

import { d, f, joueur, type Chapitre } from '../monde';
import type { Jeu, Shell } from '../shell';
import { nouveauSystemd } from '../systemd';
import { autorise } from '../sshd';
import { lire, permis, reglesDe } from '../sudoers';
import { chargerSshd, comptesFournil, fichier, M, MAINTENANT, MOT_DE_PASSE, mondeFournil, serviceSsh, sshd } from './audit';

const ENV = '/srv/commandes/.env';
const sh = (j: Jeu) => j as Shell;

// Le cloud-init de l'hébergeur : le premier compte a sudo sans mot de passe.
const cloudInitSudo = (compte: string) => `# Created by cloud-init v. 24.4 on Tue, 06 Dec 2027 15:51:43 +0000\n\n${compte} ALL=(ALL) NOPASSWD:ALL`;

const ENV_CONTENU = `PORT=3000
DATABASE_URL=postgres://commandes:brioche-beurre-91@localhost:5432/commandes
REDIS_URL=redis://localhost:6379`;

const racineFermee = (j: Jeu) => sshd(j).charge.permitrootlogin === 'no';
const entre = (j: Jeu) => autorise(sshd(j).charge, j.joueur);

const lucas = (j: Jeu) => j.comptes.utilisateurs.lucas;
const lucasVerrouille = (j: Jeu) => ((j.etat.comptesVerrouilles ?? []) as string[]).includes('lucas');
const lucasSudo = (j: Jeu) => !!j.comptes.groupes.sudo?.membres.includes('lucas');
const compteOk = (j: Jeu) => !lucas(j) || (lucasVerrouille(j) && !!lucas(j).expire && !lucasSudo(j));
// Verrouillé ou expiré, mais encore dans sudo : le constat n'est qu'à moitié traité.
const compteIncomplet = (j: Jeu) => !!lucas(j) && !compteOk(j) && (lucasVerrouille(j) || !!lucas(j).expire || !lucasSudo(j));

const politiqueValide = (j: Jeu) => !lire(sh(j)).erreur;
const sansMotDePasse = (j: Jeu) => reglesDe(sh(j), j.joueur).some((r) => r.includes('NOPASSWD'));
const sudoOk = (j: Jeu) => politiqueValide(j) && !sansMotDePasse(j) && permis(sh(j), j.joueur, '/usr/bin/bash');

const env = (j: Jeu) => j.trouver(ENV);
const fermeAuxAutres = (j: Jeu) => {
  const n = env(j);
  return n?.type === 'fichier' && (n.mode ?? 'rw-r--r--').slice(6) === '---';
};
// L'appli (compte commandes) doit pouvoir lire son fichier : propriétaire, ou groupe.
const lisibleParAppli = (j: Jeu) => {
  const n = env(j);
  if (n?.type !== 'fichier') return false;
  const mode = n.mode ?? 'rw-r--r--';
  return ((n.proprio ?? 'vous') === 'commandes' && mode[0] === 'r') || ((n.groupe ?? n.proprio) === 'commandes' && mode[3] === 'r');
};
const secretOk = (j: Jeu) => fermeAuxAutres(j) && lisibleParAppli(j);

export const rapport: Chapitre = {
  id: 'rapport',
  numero: 2,
  commandes: [
    'ls',
    'cd',
    'pwd',
    'cat',
    'less',
    'head',
    'tail',
    'grep',
    'find',
    'rm',
    'nano',
    'sudo',
    'visudo',
    'id',
    'groups',
    'whoami',
    'chmod',
    'chown',
    'chage',
    'usermod',
    'userdel',
    'gpasswd',
    'systemctl',
    'journalctl',
    'sshd',
    'last',
  ],
  maison: M,
  accueil: 'courriel_nadia.txt',
  noms: true,
  final: 'fin',
  // Dans l'ordre du rapport de Salomé.
  etapes: ['ssh', 'compte', 'sudo', 'secret', 'fin'],
  motDePasse: MOT_DE_PASSE,
  comptes: () => comptesFournil(true),
  etat: () => ({
    sshd: { charge: {}, connexionsAuChargement: 1, recharges: 0 },
    systemd: nouveauSystemd('fournil', MAINTENANT - 5 * 86_400_000, MAINTENANT, {
      ssh: serviceSsh(),
      commandes: {
        description: 'Fournil orders (commandes)',
        active: true,
        executable: 'node',
        processus: [{ pid: 731, utilisateur: 'commandes', cpu: 0.8, mem: 3.1, commande: '/usr/bin/node /srv/commandes/app/server.js' }],
      },
    }),
  }),
  initialiser: (j) => chargerSshd(j),
  creerMonde: (t) =>
    mondeFournil(t, {
      maison: { 'courriel_nadia.txt': f(t('rapport-courriel-nadia')), 'rapport-audit.txt': f(t('rapport-rapport-audit'), { lignes: true }) },
      sudoersD: { '90-cloud-init-users': fichier(cloudInitSudo(joueur(t)), 'root', 'r--r-----') },
      plus: {
        srv: d(
          {
            commandes: d(
              {
                '.env': f(ENV_CONTENU, { lignes: true, proprio: 'commandes', groupe: 'commandes', mode: 'rw-r--r--' }),
                app: d({ 'server.js': fichier('// orders application (excerpt)', 'commandes') }, undefined, { proprio: 'commandes' }),
              },
              undefined,
              { proprio: 'commandes' },
            ),
          },
          undefined,
          { proprio: 'root' },
        ),
      },
    }),
  evenements: [
    { id: 'sudoers-casse', condition: (j) => !politiqueValide(j), message: (j) => j.t('rapport-evenement-sudoers-casse') },
    { id: 'enferme', condition: (j) => !entre(j), message: (j) => j.t('rapport-evenement-enferme') },
    {
      id: 'sans-effet',
      condition: (j) => sshd(j).recharges === 0 && /^\s*PermitRootLogin\s+no\b/im.test(j.lire('/etc/ssh/sshd_config') ?? ''),
      message: (j) => j.t('rapport-evenement-sans-effet'),
    },
    { id: 'compte-incomplet', condition: compteIncomplet, message: (j) => j.t('rapport-evenement-compte-incomplet') },
    { id: 'appli-aveugle', condition: (j) => fermeAuxAutres(j) && !lisibleParAppli(j), message: (j) => j.t('rapport-evenement-appli-aveugle') },
    { id: 'ssh', condition: (j) => racineFermee(j) && entre(j), message: (j) => j.t('rapport-evenement-ssh') },
    { id: 'compte', condition: compteOk, message: (j) => j.t('rapport-evenement-compte') },
    { id: 'sudo', condition: sudoOk, message: (j) => j.t('rapport-evenement-sudo') },
    { id: 'secret', condition: secretOk, message: (j) => j.t('rapport-evenement-secret') },
    {
      id: 'fin',
      condition: (j) => racineFermee(j) && entre(j) && compteOk(j) && sudoOk(j) && secretOk(j),
      message: (j) => j.t('rapport-evenement-fin'),
    },
  ],
};
