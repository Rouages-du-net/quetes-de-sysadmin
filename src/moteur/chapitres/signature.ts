// Histoire « Le courrier indésirable » — chapitre « La signature » : DKIM avec
// OpenDKIM. Les courriels partent, mais mailbox.example les range dans les
// indésirables : SPF passe, DKIM manque. Nour a installé opendkim (la
// configuration de Debian, qui ne signe rien) ; un vérificateur
// (check-auth@verifier.example) répond avec ce qu'il voit.
// Commandes : mail, opendkim-genkey, chown, opendkim.conf (Domain, Selector,
// KeyFile, Socket), systemctl restart opendkim, journalctl -u opendkim,
// main.cf (non_smtpd_milters), la zone (enregistrement mail._domainkey,
// serial), opendkim-testkey.
// Pièges réels : la clé créée par root qu'opendkim ne peut pas lire, une clé
// lisible par tous (« key data is not secure »), la prise du milter (syntaxes
// différentes, chroot de Postfix), smtpd_milters seul (le courrier déposé sur
// la machine passe par non_smtpd_milters), « key not secure » d'opendkim-testkey
// (sans DNSSEC, ce n'est pas une erreur).
// Objectif vérifié sur l'état : un courriel déposé sur la machine serait
// signé (d=gardens.example) et la signature vérifiée avec la clé que publie internet.
// Sources : opendkim.conf(5), opendkim-genkey(8), opendkim-testkey(8),
// https://www.postfix.org/MILTER_README.html, RFC 6376.

import { f, type Chapitre } from '../monde';
import type { Jeu } from '../shell';
import { courrier, MAIL_LOG, verifierDkim } from '../courrier';
import { systemd } from '../systemd';
import { comptes, etatJardins, initialiserJardins, mondeJardins, signatureAttendue, SPF_BON, spfPasse, type Depart } from './jardins';

const M = '/home/vous';
const MAINTENANT = Date.UTC(2027, 4, 10, 18, 15, 0);

const depart: Depart = { zone: [SPF_BON], serie: 2027050301, mainCf: [], opendkim: 'debian', maintenant: MAINTENANT };

const dkim = (j: Jeu, vue: 'primaire' | 'secondaire') => {
  const s = signatureAttendue(j);
  return s ? verifierDkim(j, s, vue).resultat : 'none';
};
const journalDkim = (j: Jeu, texte: string) => systemd(j)!.journal.some((e) => e.unite === 'opendkim.service' && e.message.includes(texte));
const journalMail = (j: Jeu, texte: string) => (j.lire(MAIL_LOG) ?? '').includes(texte);
const boite = (j: Jeu) => j.lire(`/var/mail/${j.joueur}`) ?? '';
const vu = (j: Jeu, texte: string) => j.derniere.sortie.includes(texte) || j.derniere.erreurs.some((e) => e.includes(texte));

export const signature: Chapitre = {
  id: 'signature',
  numero: 2,
  commandes: [
    'ls',
    'cd',
    'pwd',
    'cat',
    'echo',
    'less',
    'head',
    'tail',
    'grep',
    'cp',
    'nano',
    'sudo',
    'chown',
    'chmod',
    'id',
    'whoami',
    'systemctl',
    'journalctl',
    'dig',
    'host',
    'named-checkzone',
    'rndc',
    'mail',
    'mailq',
    'postqueue',
    'postconf',
    'postfix',
    'opendkim-genkey',
    'opendkim-testkey',
  ],
  maison: M,
  accueil: 'message_de_nour.txt',
  noms: true,
  final: 'fin',
  etapes: ['verifier', 'cle', 'opendkim', 'milter', 'fin'],
  motDePasse: 'semis-2027',
  comptes,
  etat: (t) => etatJardins(t, depart),
  initialiser: initialiserJardins,
  creerMonde: (t) => mondeJardins(t, depart, { 'message_de_nour.txt': f(t('signature-message-nour')) }, ''),
  evenements: [
    { id: 'verifier', condition: (j) => /DKIM check: +none/.test(boite(j)), message: (j) => j.t('signature-evenement-verifier') },
    {
      id: 'cle',
      condition: (j) => {
        const n = j.trouver('/etc/dkimkeys');
        return n?.type === 'dossier' && Object.keys(n.enfants).some((x) => x.endsWith('.private'));
      },
      message: (j) => j.t('signature-evenement-cle'),
    },
    { id: 'illisible', condition: (j) => journalDkim(j, 'Permission denied'), message: (j) => j.t('signature-evenement-illisible') },
    { id: 'pas-sure', condition: (j) => journalDkim(j, 'key data is not secure'), message: (j) => j.t('signature-evenement-pas-sure') },
    {
      id: 'opendkim',
      condition: (j) => systemd(j)?.services.opendkim?.etat === 'active' && !!courrier(j)?.dkim?.cle && (courrier(j)?.dkim?.domaines.length ?? 0) > 0,
      message: (j) => j.t('signature-evenement-opendkim'),
    },
    { id: 'chroot', condition: (j) => journalMail(j, 'connect to Milter service unix:'), message: (j) => j.t('signature-evenement-chroot') },
    { id: 'prise', condition: (j) => journalMail(j, 'connect to Milter service inet'), message: (j) => j.t('signature-evenement-prise') },
    {
      id: 'smtpd-seul',
      condition: (j) => {
        const v = courrier(j)?.postfix?.valeurs ?? {};
        return !!v.smtpd_milters && !v.non_smtpd_milters;
      },
      message: (j) => j.t('signature-evenement-smtpd-seul'),
    },
    { id: 'milter', condition: (j) => !!signatureAttendue(j), message: (j) => j.t('signature-evenement-milter') },
    { id: 'pas-secure', condition: (j) => vu(j, 'key not secure'), message: (j) => j.t('signature-evenement-pas-secure') },
    { id: 'serie', condition: (j) => dkim(j, 'primaire') === 'pass' && dkim(j, 'secondaire') !== 'pass', message: (j) => j.t('signature-evenement-serie') },
    { id: 'fin', condition: (j) => spfPasse(j) && dkim(j, 'secondaire') === 'pass', message: (j) => j.t('signature-evenement-fin') },
  ],
};
