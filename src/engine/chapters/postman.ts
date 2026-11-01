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

import { f, type Chapter } from '../world';
import type { Game } from '../shell';
import type { Translate } from '../../texts';
import { mail, logTime, checkSpf, txt, type Message } from '../mail';
import { accounts, DOMAIN, gardensState, initialiseGardens, IP, MAILBOX, gardensWorld, OLD_SPF, passSpf, type Departure } from './gardens';

const M = '/home/you';
const NOW = Date.UTC(2027, 4, 3, 9, 30, 0);
const YESTERDAY = Date.UTC(2027, 4, 2, 18, 4, 0);
const MEMBERS = ['amina', 'jules', 'leo', 'sami', 'ines'];
const IDS = ['3F2A9C1B7D', '41C07E2A93', '4A9D1F0C52', '52E8B3D716', '5C0F2A94E1'];
const REASON = `host ${MAILBOX.mx}[${MAILBOX.ip}] said: 451 4.7.26 Unauthenticated mail from ${DOMAIN}: neither SPF nor DKIM passed for ${IP} (SPF: fail). Try again later. See https://support.mailbox.example/senders (in reply to end of DATA command)`;

// Les cinq courriels de bienvenue du site, en attente depuis hier.
const file = (t: Translate): Message[] =>
  MEMBERS.map((who, i) => ({
    id: IDS[i],
    forEachOf: `www-data@${DOMAIN}`,
    a: [`${who}@${MAILBOX.domain}`],
    from: `contact@${DOMAIN}`,
    subject: t('jardins-sujet-bienvenue'),
    body: t('jardins-corps-bienvenue'),
    arrives: YESTERDAY + i * 2_400_000,
    size: 1342 + i * 7,
    reason: REASON,
  }));

// mail.log depuis hier : chaque courriel reçu, refusé, puis réessayé.
const LOG = (() => {
  const lines: [number, string][] = [];
  MEMBERS.forEach((who, i) => {
    const t = YESTERDAY + i * 2_400_000;
    const id = IDS[i];
    lines.push([t, `postfix/pickup[2401]: ${id}: uid=33 from=<www-data>`]);
    lines.push([t + 1000, `postfix/cleanup[2402]: ${id}: message-id=<${id}@mail.${DOMAIN}>`]);
    lines.push([t + 1000, `postfix/qmgr[1188]: ${id}: from=<www-data@${DOMAIN}>, size=${1342 + i * 7}, nrcpt=1 (queue active)`]);
    for (const trial of [0, 1, 2, 3])
      lines.push([
        t + 2000 + trial * 4_000_000,
        `postfix/smtp[2404]: ${id}: to=<${who}@${MAILBOX.domain}>, relay=${MAILBOX.mx}[${MAILBOX.ip}]:25, delay=${2 + trial * 4000}, delays=0.02/0.01/0.31/0.12, dsn=4.7.26, status=deferred (${REASON})`,
      ]);
  });
  return lines
    .filter(([t]) => t < NOW)
    .sort((a, b) => a[0] - b[0])
    .map(([t, l]) => `${logTime(t)} garden ${l}`)
    .join('\n');
})();

const departure: Departure = { zone: [OLD_SPF], serial: 2027042801, mainCf: [], opendkim: 'absent', now: NOW, file };

const spf = (j: Game, view: 'primary' | 'secondary') => checkSpf(j, IP, DOMAIN, undefined, view).result;
const inWaiting = (j: Game) => mail(j)?.file.length ?? 0;
const seen = (j: Game, text: string) => j.last.output.includes(text) || j.last.errors.some((e) => e.includes(text));

export const postman: Chapter = {
  id: 'postman',
  number: 1,
  commands: [
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
  home: M,
  welcome: 'email_nour.txt',
  names: true,
  final: 'fin',
  steps: ['differe', 'ancien', 'spf', 'fin'],
  password: 'seeds-2027',
  accounts,
  state: (t) => gardensState(t, departure),
  initialise: initialiseGardens,
  createWorld: (t) => gardensWorld(t, departure, { 'email_nour.txt': f(t('postman-courriel-nour')) }, LOG),
  events: [
    { id: 'differe', condition: (j) => seen(j, 'status=deferred') || seen(j, '451 4.7.26'), message: (j) => j.t('postman-evenement-differe') },
    { id: 'ancien', condition: (j) => seen(j, `include:_spf.old-hosting.example`), message: (j) => j.t('postman-evenement-ancien') },
    {
      id: 'deux',
      condition: (j) => txt(j, DOMAIN, 'primary').filter((x) => /^v=spf1(\s|$)/i.test(x)).length > 1,
      message: (j) => j.t('postman-evenement-deux'),
    },
    { id: 'serie', condition: (j) => spf(j, 'primary') === 'pass' && spf(j, 'secondary') !== 'pass', message: (j) => j.t('postman-evenement-serie') },
    { id: 'spf', condition: passSpf, message: (j) => j.t('postman-evenement-spf') },
    { id: 'fin', condition: (j) => passSpf(j) && inWaiting(j) === 0 && (mail(j)?.restored.length ?? 0) >= MEMBERS.length, message: (j) => j.t('postman-evenement-fin') },
  ],
};

