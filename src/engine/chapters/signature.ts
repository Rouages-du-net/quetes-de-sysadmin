// Story "Junk Mail", chapter "The Signature": DKIM with
// OpenDKIM. Mails go out, but mailbox.example files them as
// junk: SPF passes, DKIM is missing. Nour installed opendkim (Debian's
// configuration, which signs nothing); a checker
// (check-auth@verifier.example) answers with what it sees.
// Commands: mail, opendkim-genkey, chown, opendkim.conf (Domain, Selector,
// KeyFile, Socket), systemctl restart opendkim, journalctl -u opendkim,
// main.cf (non_smtpd_milters), the zone (mail._domainkey record,
// serial), opendkim-testkey.
// Real traps: the key created by root that opendkim can't read, a key
// readable by everyone ("key data is not secure"), the milter's socket (different
// syntaxes, Postfix's chroot), smtpd_milters alone (mail submitted on
// the machine goes through non_smtpd_milters), opendkim-testkey's "key not secure"
// (without DNSSEC, it isn't an error).
// Objective checked on the state: a mail submitted on the machine would be
// signed (d=gardens.example) and the signature verified with the key the internet publishes.
// Sources: opendkim.conf(5), opendkim-genkey(8), opendkim-testkey(8),
// https://www.postfix.org/MILTER_README.html, RFC 6376.

import { f, type Chapter } from '../world';
import type { Game } from '../shell';
import { mail, MAIL_LOG, checkDkim } from '../mail';
import { systemd } from '../systemd';
import { accounts, gardensState, initialiseGardens, gardensWorld, expectedSignature, GOOD_SPF, passSpf, type Departure } from './gardens';

const M = '/home/you';
const NOW = Date.UTC(2027, 4, 10, 18, 15, 0);

const departure: Departure = { zone: [GOOD_SPF], serial: 2027050301, mainCf: [], opendkim: 'debian', now: NOW };

const dkim = (j: Game, view: 'primary' | 'secondary') => {
  const s = expectedSignature(j);
  return s ? checkDkim(j, s, view).result : 'none';
};
const dkimLog = (j: Game, text: string) => systemd(j)!.log.some((e) => e.unit === 'opendkim.service' && e.message.includes(text));
const mailLog = (j: Game, text: string) => (j.read(MAIL_LOG) ?? '').includes(text);
const box = (j: Game) => j.read(`/var/mail/${j.player}`) ?? '';
const seen = (j: Game, text: string) => j.last.output.includes(text) || j.last.errors.some((e) => e.includes(text));

export const signature: Chapter = {
  id: 'signature',
  number: 2,
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
  home: M,
  welcome: 'message_from_nour.txt',
  names: true,
  final: 'end',
  steps: ['check', 'key', 'opendkim', 'milter', 'end'],
  password: 'seeds-2027',
  accounts,
  state: (t) => gardensState(t, departure),
  initialise: initialiseGardens,
  createWorld: (t) => gardensWorld(t, departure, { 'message_from_nour.txt': f(t('signature-message-nour')) }, ''),
  events: [
    { id: 'check', condition: (j) => /DKIM check: +none/.test(box(j)), message: (j) => j.t('signature-event-check') },
    {
      id: 'key',
      condition: (j) => {
        const n = j.find('/etc/dkimkeys');
        return n?.type === 'directory' && Object.keys(n.children).some((x) => x.endsWith('.private'));
      },
      message: (j) => j.t('signature-event-key'),
    },
    { id: 'unreadable', condition: (j) => dkimLog(j, 'Permission denied'), message: (j) => j.t('signature-event-unreadable') },
    { id: 'not-sure', condition: (j) => dkimLog(j, 'key data is not secure'), message: (j) => j.t('signature-event-not-sure') },
    {
      id: 'opendkim',
      condition: (j) => systemd(j)?.services.opendkim?.state === 'active' && !!mail(j)?.dkim?.key && (mail(j)?.dkim?.domains.length ?? 0) > 0,
      message: (j) => j.t('signature-event-opendkim'),
    },
    { id: 'chroot', condition: (j) => mailLog(j, 'connect to Milter service unix:'), message: (j) => j.t('signature-event-chroot') },
    { id: 'socket', condition: (j) => mailLog(j, 'connect to Milter service inet'), message: (j) => j.t('signature-event-socket') },
    {
      id: 'smtpd-only',
      condition: (j) => {
        const v = mail(j)?.postfix?.values ?? {};
        return !!v.smtpd_milters && !v.non_smtpd_milters;
      },
      message: (j) => j.t('signature-event-smtpd-only'),
    },
    { id: 'milter', condition: (j) => !!expectedSignature(j), message: (j) => j.t('signature-event-milter') },
    { id: 'not-secure', condition: (j) => seen(j, 'key not secure'), message: (j) => j.t('signature-event-not-secure') },
    { id: 'serial', condition: (j) => dkim(j, 'primary') === 'pass' && dkim(j, 'secondary') !== 'pass', message: (j) => j.t('signature-event-serial') },
    { id: 'end', condition: (j) => passSpf(j) && dkim(j, 'secondary') === 'pass', message: (j) => j.t('signature-event-end') },
  ],
};
