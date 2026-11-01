// Histoire « Le courrier indésirable » — chapitre « La politique » : DMARC.
// Les Jardins ont publié une politique DMARC p=none il y a une semaine, avec
// rua= : les rapports agrégés des messageries sont arrivés. Nour voudrait
// passer à p=quarantine (mailbox.example le demande aux expéditeurs qui
// envoient beaucoup), sans perdre la lettre d'information, envoyée par un
// prestataire (newsmail.example) qui signe… pour son propre domaine.
// Commandes : lire les rapports (grep, less), dig TXT _dmarc, la zone (un
// CNAME pour déléguer le sélecteur nm1 au prestataire, le point final !,
// le serial), la balise p=.
// Pièges réels : SPF qui passe pour le domaine du prestataire (l'enveloppe)
// n'aligne rien ; un CNAME sans point final ; deux enregistrements DMARC ;
// p=quarantine avant d'avoir aligné la lettre.
// Objectif vérifié sur l'état : internet voit une politique quarantine ou
// reject, avec rua ; la lettre et les courriels du serveur passent DMARC.
// Sources : RFC 7489 (https://www.rfc-editor.org/rfc/rfc7489), notamment
// l'alignement (3.1) et les rapports agrégés (7.2, annexe C).

import { d, f, type Chapter } from '../world';
import type { Game } from '../shell';
import { dmarcPolicy, txt } from '../mail';
import {
  gardensAuth,
  letterAuth,
  accounts,
  goodDkim,
  DMARC_NONE,
  DOMAIN,
  gardensState,
  initialiseGardens,
  IP,
  MILTERS,
  gardensWorld,
  NEWSMAIL,
  GOOD_SPF,
  type Departure,
} from './gardens';

const M = '/home/vous';
const NOW = Date.UTC(2027, 4, 24, 9, 0, 0);
const SPOOFER = '192.0.2.66';

const departure: Departure = { zone: [GOOD_SPF, goodDkim(), DMARC_NONE], serial: 2027051701, mainCf: MILTERS, opendkim: 'configure', now: NOW };

// Un rapport agrégé DMARC (RFC 7489, annexe C), tel que les messageries l'envoient à l'adresse de rua=.
type Line = { ip: string; n: number; dkim: [string, string, string]; spf: [string, string]; dmarcDkim: string; dmarcSpf: string };
const report = (org: string, id: string, start: number, lines: Line[]) => `<?xml version="1.0" encoding="UTF-8" ?>
<feedback>
  <report_metadata>
    <org_name>${org}</org_name>
    <email>noreply-dmarc-support@${org}</email>
    <report_id>${id}</report_id>
    <date_range>
      <begin>${start}</begin>
      <end>${start + 86399}</end>
    </date_range>
  </report_metadata>
  <policy_published>
    <domain>${DOMAIN}</domain>
    <adkim>r</adkim>
    <aspf>r</aspf>
    <p>none</p>
    <sp>none</sp>
    <pct>100</pct>
  </policy_published>
${lines
  .map(
    (l) => `  <record>
    <row>
      <source_ip>${l.ip}</source_ip>
      <count>${l.n}</count>
      <policy_evaluated>
        <disposition>none</disposition>
        <dkim>${l.dmarcDkim}</dkim>
        <spf>${l.dmarcSpf}</spf>
      </policy_evaluated>
    </row>
    <identifiers>
      <header_from>${DOMAIN}</header_from>
    </identifiers>
    <auth_results>
      <dkim>
        <domain>${l.dkim[0]}</domain>
        <selector>${l.dkim[1]}</selector>
        <result>${l.dkim[2]}</result>
      </dkim>
      <spf>
        <domain>${l.spf[0]}</domain>
        <result>${l.spf[1]}</result>
      </spf>
    </auth_results>
  </record>`,
  )
  .join('\n')}
</feedback>`;

const US: Omit<Line, 'n'> = { ip: IP, dkim: [DOMAIN, 'mail', 'pass'], spf: [DOMAIN, 'pass'], dmarcDkim: 'pass', dmarcSpf: 'pass' };
const LETTER: Omit<Line, 'n'> = {
  ip: NEWSMAIL.ip,
  dkim: [NEWSMAIL.domain, NEWSMAIL.selector, 'pass'],
  spf: [`bounce.${NEWSMAIL.domain}`, 'pass'],
  dmarcDkim: 'fail',
  dmarcSpf: 'fail',
};
const FALSE: Omit<Line, 'n'> = { ip: SPOOFER, dkim: [DOMAIN, 'mail', 'fail'], spf: [DOMAIN, 'fail'], dmarcDkim: 'fail', dmarcSpf: 'fail' };
const DAY = 1810425600; // 2027-05-16 00:00 UTC

const policy = (j: Game) => dmarcPolicy(j, DOMAIN);
const strict = (j: Game) => {
  const p = policy(j);
  return !!p && p !== 'permerror' && ['quarantine', 'reject'].includes(p.p.toLowerCase());
};
const alignedLetter = (j: Game) => letterAuth(j).dmarc === 'pass';
const seen = (j: Game, text: string) => j.last.output.includes(text);

export const chapterPolicy: Chapter = {
  id: 'policy',
  number: 3,
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
    'postconf',
    'opendkim-testkey',
  ],
  home: M,
  welcome: 'courriel_nour.txt',
  names: true,
  final: 'fin',
  steps: ['rapport', 'aligne', 'fin'],
  password: 'semis-2027',
  accounts,
  state: (t) => gardensState(t, departure),
  initialise: initialiseGardens,
  createWorld: (t) =>
    gardensWorld(
      t,
      departure,
      {
        'courriel_nour.txt': f(t('policy-courriel-nour')),
        'lettre_newsmail.txt': f(t('policy-lettre-newsmail')),
        rapports_dmarc: d({
          'mailbox.example-2027-05-16.xml': f(
            report('mailbox.example', '1810425600712204', DAY, [
              { ...US, n: 38 },
              { ...LETTER, n: 412 },
              { ...FALSE, n: 17 },
            ]),
            { lines: true },
          ),
          'post.example-2027-05-16.xml': f(
            report('post.example', 'f3a9c27e-2027-05-16', DAY, [
              { ...US, n: 9 },
              { ...LETTER, n: 96 },
            ]),
            { lines: true },
          ),
        }),
      },
      '',
    ),
  events: [
    { id: 'rapport', condition: (j) => seen(j, NEWSMAIL.ip), message: (j) => j.t('policy-evenement-rapport') },
    { id: 'usurpation', condition: (j) => seen(j, SPOOFER), message: (j) => j.t('policy-evenement-usurpation') },
    {
      id: 'inclusion',
      condition: (j) => txt(j, DOMAIN, 'primary').some((x) => /^v=spf1\b.*include:_spf\.newsmail\.example/i.test(x)),
      message: (j) => j.t('policy-evenement-inclusion'),
    },
    {
      id: 'point',
      condition: (j) => txt(j, `${NEWSMAIL.selector}._domainkey.${DOMAIN}`, 'primary').length === 0 && /nm1\._domainkey\s+(\d+\s+)?(IN\s+)?CNAME\s+nm1\.dkim\.newsmail\.example\s*$/im.test(j.read('/etc/bind/zones/db.gardens.example') ?? ''),
      message: (j) => j.t('policy-evenement-point'),
    },
    { id: 'deux', condition: (j) => dmarcPolicy(j, DOMAIN, 'primary') === 'permerror', message: (j) => j.t('policy-evenement-deux') },
    { id: 'aligne', condition: alignedLetter, message: (j) => j.t('policy-evenement-aligne') },
    { id: 'trop-tot', condition: (j) => strict(j) && !alignedLetter(j), message: (j) => j.t('policy-evenement-trop-tot') },
    {
      id: 'fin',
      condition: (j) => {
        const p = policy(j);
        return strict(j) && !!p && p !== 'permerror' && !!p.rua && alignedLetter(j) && gardensAuth(j).dmarc === 'pass';
      },
      message: (j) => j.t('policy-evenement-fin'),
    },
  ],
};
