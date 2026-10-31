// Histoire « Le courrier indésirable » — chapitre « Le facteur » : SPF. Les
// Jardins partagés ont quitté leur hébergeur pour leur propre serveur ; depuis,
// les courriels de bienvenue du site restent dans la file d'attente de Postfix :
// mailbox.example les refuse (pour l'instant) parce que ni SPF ni DKIM ne
// passent. Le SPF publié est encore celui de l'ancien hébergeur.
// Commandes : mailq, grep sur /var/log/mail.log, dig TXT, la zone BIND
// (le serial !), rndc reload, dig @ns2.registry.example, postqueue -f.
// Objectif vérifié sur l'état : ce que publie internet (le secondaire)
// autorise 203.0.113.30 à envoyer pour gardens.example, et les cinq
// courriels sont partis (la file est vide).
// Sources : RFC 7208 (https://www.rfc-editor.org/rfc/rfc7208),
// https://www.postfix.org/postqueue.1.html, https://bind9.readthedocs.io/

import { f, type Chapitre } from '../world';
import type { Jeu } from '../shell';
import type { Traduire } from '../../texts';
import { courrier, heureLog, verifierSpf, txt, type Message } from '../mail';
import { comptes, DOMAINE, etatJardins, initialiserJardins, IP, MAILBOX, mondeJardins, SPF_ANCIEN, spfPasse, type Depart } from './gardens';

const M = '/home/vous';
const MAINTENANT = Date.UTC(2027, 4, 3, 9, 30, 0);
const HIER = Date.UTC(2027, 4, 2, 18, 4, 0);
const MEMBRES = ['amina', 'jules', 'leo', 'sami', 'ines'];
const IDS = ['3F2A9C1B7D', '41C07E2A93', '4A9D1F0C52', '52E8B3D716', '5C0F2A94E1'];
const RAISON = `host ${MAILBOX.mx}[${MAILBOX.ip}] said: 451 4.7.26 Unauthenticated mail from ${DOMAINE}: neither SPF nor DKIM passed for ${IP} (SPF: fail). Try again later. See https://support.mailbox.example/senders (in reply to end of DATA command)`;

// Les cinq courriels de bienvenue du site, en attente depuis hier.
const file = (t: Traduire): Message[] =>
  MEMBRES.map((qui, i) => ({
    id: IDS[i],
    de: `www-data@${DOMAINE}`,
    a: [`${qui}@${MAILBOX.domaine}`],
    from: `contact@${DOMAINE}`,
    sujet: t('jardins-sujet-bienvenue'),
    corps: t('jardins-corps-bienvenue'),
    arrive: HIER + i * 2_400_000,
    taille: 1342 + i * 7,
    raison: RAISON,
  }));

// mail.log depuis hier : chaque courriel reçu, refusé, puis réessayé.
const JOURNAL = (() => {
  const lignes: [number, string][] = [];
  MEMBRES.forEach((qui, i) => {
    const t = HIER + i * 2_400_000;
    const id = IDS[i];
    lignes.push([t, `postfix/pickup[2401]: ${id}: uid=33 from=<www-data>`]);
    lignes.push([t + 1000, `postfix/cleanup[2402]: ${id}: message-id=<${id}@mail.${DOMAINE}>`]);
    lignes.push([t + 1000, `postfix/qmgr[1188]: ${id}: from=<www-data@${DOMAINE}>, size=${1342 + i * 7}, nrcpt=1 (queue active)`]);
    for (const essai of [0, 1, 2, 3])
      lignes.push([
        t + 2000 + essai * 4_000_000,
        `postfix/smtp[2404]: ${id}: to=<${qui}@${MAILBOX.domaine}>, relay=${MAILBOX.mx}[${MAILBOX.ip}]:25, delay=${2 + essai * 4000}, delays=0.02/0.01/0.31/0.12, dsn=4.7.26, status=deferred (${RAISON})`,
      ]);
  });
  return lignes
    .filter(([t]) => t < MAINTENANT)
    .sort((a, b) => a[0] - b[0])
    .map(([t, l]) => `${heureLog(t)} jardin ${l}`)
    .join('\n');
})();

const depart: Depart = { zone: [SPF_ANCIEN], serie: 2027042801, mainCf: [], opendkim: 'absent', maintenant: MAINTENANT, file };

const spf = (j: Jeu, vue: 'primaire' | 'secondaire') => verifierSpf(j, IP, DOMAINE, undefined, vue).resultat;
const enAttente = (j: Jeu) => courrier(j)?.file.length ?? 0;
const vu = (j: Jeu, texte: string) => j.derniere.sortie.includes(texte) || j.derniere.erreurs.some((e) => e.includes(texte));

export const facteur: Chapitre = {
  id: 'facteur',
  numero: 1,
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
    'wc',
    'cp',
    'nano',
    'sudo',
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
    'postsuper',
  ],
  maison: M,
  accueil: 'courriel_nour.txt',
  noms: true,
  final: 'fin',
  etapes: ['differe', 'ancien', 'spf', 'fin'],
  motDePasse: 'semis-2027',
  comptes,
  etat: (t) => etatJardins(t, depart),
  initialiser: initialiserJardins,
  creerMonde: (t) => mondeJardins(t, depart, { 'courriel_nour.txt': f(t('facteur-courriel-nour')) }, JOURNAL),
  evenements: [
    { id: 'differe', condition: (j) => vu(j, 'status=deferred') || vu(j, '451 4.7.26'), message: (j) => j.t('facteur-evenement-differe') },
    { id: 'ancien', condition: (j) => vu(j, `include:_spf.old-hosting.example`), message: (j) => j.t('facteur-evenement-ancien') },
    {
      id: 'deux',
      condition: (j) => txt(j, DOMAINE, 'primaire').filter((x) => /^v=spf1(\s|$)/i.test(x)).length > 1,
      message: (j) => j.t('facteur-evenement-deux'),
    },
    { id: 'serie', condition: (j) => spf(j, 'primaire') === 'pass' && spf(j, 'secondaire') !== 'pass', message: (j) => j.t('facteur-evenement-serie') },
    { id: 'spf', condition: spfPasse, message: (j) => j.t('facteur-evenement-spf') },
    { id: 'fin', condition: (j) => spfPasse(j) && enAttente(j) === 0 && (courrier(j)?.remis.length ?? 0) >= MEMBRES.length, message: (j) => j.t('facteur-evenement-fin') },
  ],
};

