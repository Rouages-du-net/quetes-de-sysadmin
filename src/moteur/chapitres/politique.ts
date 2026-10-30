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

import { d, f, type Chapitre } from '../monde';
import type { Jeu } from '../shell';
import { politiqueDmarc, txt } from '../courrier';
import {
  authJardins,
  authLettre,
  comptes,
  dkimBon,
  DMARC_NONE,
  DOMAINE,
  etatJardins,
  initialiserJardins,
  IP,
  MILTERS,
  mondeJardins,
  NEWSMAIL,
  SPF_BON,
  type Depart,
} from './jardins';

const M = '/home/vous';
const MAINTENANT = Date.UTC(2027, 4, 24, 9, 0, 0);
const USURPATEUR = '192.0.2.66';

const depart: Depart = { zone: [SPF_BON, dkimBon(), DMARC_NONE], serie: 2027051701, mainCf: MILTERS, opendkim: 'configure', maintenant: MAINTENANT };

// Un rapport agrégé DMARC (RFC 7489, annexe C), tel que les messageries l'envoient à l'adresse de rua=.
type Ligne = { ip: string; n: number; dkim: [string, string, string]; spf: [string, string]; dmarcDkim: string; dmarcSpf: string };
const rapport = (org: string, id: string, debut: number, lignes: Ligne[]) => `<?xml version="1.0" encoding="UTF-8" ?>
<feedback>
  <report_metadata>
    <org_name>${org}</org_name>
    <email>noreply-dmarc-support@${org}</email>
    <report_id>${id}</report_id>
    <date_range>
      <begin>${debut}</begin>
      <end>${debut + 86399}</end>
    </date_range>
  </report_metadata>
  <policy_published>
    <domain>${DOMAINE}</domain>
    <adkim>r</adkim>
    <aspf>r</aspf>
    <p>none</p>
    <sp>none</sp>
    <pct>100</pct>
  </policy_published>
${lignes
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
      <header_from>${DOMAINE}</header_from>
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

const NOUS: Omit<Ligne, 'n'> = { ip: IP, dkim: [DOMAINE, 'mail', 'pass'], spf: [DOMAINE, 'pass'], dmarcDkim: 'pass', dmarcSpf: 'pass' };
const LETTRE: Omit<Ligne, 'n'> = {
  ip: NEWSMAIL.ip,
  dkim: [NEWSMAIL.domaine, NEWSMAIL.selecteur, 'pass'],
  spf: [`bounce.${NEWSMAIL.domaine}`, 'pass'],
  dmarcDkim: 'fail',
  dmarcSpf: 'fail',
};
const FAUX: Omit<Ligne, 'n'> = { ip: USURPATEUR, dkim: [DOMAINE, 'mail', 'fail'], spf: [DOMAINE, 'fail'], dmarcDkim: 'fail', dmarcSpf: 'fail' };
const JOUR = 1810425600; // 2027-05-16 00:00 UTC

const politique = (j: Jeu) => politiqueDmarc(j, DOMAINE);
const stricte = (j: Jeu) => {
  const p = politique(j);
  return !!p && p !== 'permerror' && ['quarantine', 'reject'].includes(p.p.toLowerCase());
};
const lettreAlignee = (j: Jeu) => authLettre(j).dmarc === 'pass';
const vu = (j: Jeu, texte: string) => j.derniere.sortie.includes(texte);

export const politiqueChapitre: Chapitre = {
  id: 'politique',
  numero: 3,
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
    'postconf',
    'opendkim-testkey',
  ],
  maison: M,
  accueil: 'courriel_nour.txt',
  noms: true,
  final: 'fin',
  etapes: ['rapport', 'aligne', 'fin'],
  motDePasse: 'semis-2027',
  comptes,
  etat: (t) => etatJardins(t, depart),
  initialiser: initialiserJardins,
  creerMonde: (t) =>
    mondeJardins(
      t,
      depart,
      {
        'courriel_nour.txt': f(t('politique-courriel-nour')),
        'lettre_newsmail.txt': f(t('politique-lettre-newsmail')),
        rapports_dmarc: d({
          'mailbox.example-2027-05-16.xml': f(
            rapport('mailbox.example', '1810425600712204', JOUR, [
              { ...NOUS, n: 38 },
              { ...LETTRE, n: 412 },
              { ...FAUX, n: 17 },
            ]),
            { lignes: true },
          ),
          'post.example-2027-05-16.xml': f(
            rapport('post.example', 'f3a9c27e-2027-05-16', JOUR, [
              { ...NOUS, n: 9 },
              { ...LETTRE, n: 96 },
            ]),
            { lignes: true },
          ),
        }),
      },
      '',
    ),
  evenements: [
    { id: 'rapport', condition: (j) => vu(j, NEWSMAIL.ip), message: (j) => j.t('politique-evenement-rapport') },
    { id: 'usurpation', condition: (j) => vu(j, USURPATEUR), message: (j) => j.t('politique-evenement-usurpation') },
    {
      id: 'inclusion',
      condition: (j) => txt(j, DOMAINE, 'primaire').some((x) => /^v=spf1\b.*include:_spf\.newsmail\.example/i.test(x)),
      message: (j) => j.t('politique-evenement-inclusion'),
    },
    {
      id: 'point',
      condition: (j) => txt(j, `${NEWSMAIL.selecteur}._domainkey.${DOMAINE}`, 'primaire').length === 0 && /nm1\._domainkey\s+(\d+\s+)?(IN\s+)?CNAME\s+nm1\.dkim\.newsmail\.example\s*$/im.test(j.lire('/etc/bind/zones/db.gardens.example') ?? ''),
      message: (j) => j.t('politique-evenement-point'),
    },
    { id: 'deux', condition: (j) => politiqueDmarc(j, DOMAINE, 'primaire') === 'permerror', message: (j) => j.t('politique-evenement-deux') },
    { id: 'aligne', condition: lettreAlignee, message: (j) => j.t('politique-evenement-aligne') },
    { id: 'trop-tot', condition: (j) => stricte(j) && !lettreAlignee(j), message: (j) => j.t('politique-evenement-trop-tot') },
    {
      id: 'fin',
      condition: (j) => {
        const p = politique(j);
        return stricte(j) && !!p && p !== 'permerror' && !!p.rua && lettreAlignee(j) && authJardins(j).dmarc === 'pass';
      },
      message: (j) => j.t('politique-evenement-fin'),
    },
  ],
};
