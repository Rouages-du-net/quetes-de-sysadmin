// Histoire « La Maison des associations » — chapitre « Les clés » : un
// compte tout neuf sur la passerelle, avec un mot de passe provisoire.
// Créer sa paire de clés sur son poste (ssh-keygen), poser la clé publique
// en face (ssh-copy-id, ou à la main dans ~/.ssh/authorized_keys), entrer
// par la clé, puis fermer la porte aux mots de passe (PasswordAuthentication
// no, sshd -t, reload) et vérifier qu'on entre toujours.
// Objectif vérifié sur l'état : sshd applique PasswordAuthentication no, une
// clé est autorisée pour vous, et une connexion par clé a eu lieu après ce
// chargement.
// Sources : https://man.openbsd.org/ssh-keygen, https://man.openbsd.org/sshd_config,
// https://manpages.debian.org/bookworm/openssh-client/ssh-copy-id.1.en.html

import { f, type Chapitre } from '../monde';
import type { Jeu } from '../shell';
import { autorise, CONFIG, lireConfig } from '../sshd';
import { clePublique, MACHINES } from '../machines';
import { chargerSshd, comptesMaison, connexionsPar, etatMaison, hoteInterne, M, mondeMaison, MOT_DE_PASSE, sshd } from './maison';

// Les clés autorisées pour vous sur maison (lignes « ssh-… »).
const autorisees = (j: Jeu) =>
  (j.lire(`${M}/.ssh/authorized_keys`) ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('ssh-'))
    .map((l) => l.split(/\s+/).slice(0, 2).join(' '));
// Les clés que le jeu a données (id_royaume…) : ssh ne les propose pas à maison.
const DONNEES = MACHINES.map((m) => clePublique(m).split(' ').slice(0, 2).join(' '));
const clesDeVous = (j: Jeu) => autorisees(j).filter((c) => !DONNEES.includes(c));
const sansMotDePasse = (j: Jeu) => sshd(j).charge.passwordauthentication === 'no';
const ferme = (j: Jeu) => sansMotDePasse(j) && clesDeVous(j).length > 0 && autorise(sshd(j).charge, 'vous');

export const cles: Chapitre = {
  id: 'cles',
  numero: 1,
  commandes: [
    'ls',
    'cd',
    'pwd',
    'cat',
    'less',
    'head',
    'tail',
    'grep',
    'id',
    'whoami',
    'chmod',
    'mkdir',
    'nano',
    'sudo',
    'systemctl',
    'journalctl',
    'sshd',
  ],
  maison: M,
  accueil: 'courriel_yasmine.txt',
  noms: true,
  final: 'fin',
  motDePasse: MOT_DE_PASSE,
  comptes: comptesMaison,
  etat: () => etatMaison(),
  initialiser: chargerSshd,
  hotes: { wiki: hoteInterne('wiki', '10.20.0.11'), archives: hoteInterne('archives', '10.20.0.12') },
  creerMonde: (t) =>
    mondeMaison({ motsDePasse: null, maison: { 'courriel_yasmine.txt': f(t('cles-courriel-yasmine', { motdepasse: MOT_DE_PASSE })) } }),
  evenements: [
    { id: 'erreur', condition: (j) => lireConfig(j).erreurs.length > 0, message: (j) => j.t('cles-evenement-erreur', { config: CONFIG }) },
    { id: 'enferme', condition: (j) => sansMotDePasse(j) && !clesDeVous(j).length, message: (j) => j.t('cles-evenement-enferme') },
    {
      id: 'cle-du-jeu',
      condition: (j) => autorisees(j).some((c) => DONNEES.includes(c)) && !clesDeVous(j).length,
      message: (j) => j.t('cles-evenement-cle-du-jeu'),
    },
    { id: 'copiee', condition: (j) => clesDeVous(j).length > 0, message: (j) => j.t('cles-evenement-copiee') },
    { id: 'par-cle', condition: (j) => connexionsPar(j, 'cle') > 0 && !sansMotDePasse(j), message: (j) => j.t('cles-evenement-par-cle') },
    { id: 'fermee', condition: ferme, message: (j) => j.t('cles-evenement-fermee') },
    {
      id: 'fin',
      condition: (j) => j.drapeaux.has('fermee') && ferme(j) && connexionsPar(j, 'cle') > sshd(j).clesAuChargement,
      message: (j) => j.t('cles-evenement-fin'),
    },
  ],
};
