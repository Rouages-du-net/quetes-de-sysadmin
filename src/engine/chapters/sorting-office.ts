// Story "The Lifeboat", chapter "The Sorting Office": the winter bookings
// start, and Leilani wants what is written to bookings@ in a Bookings folder
// rather than mixed with everything else; Aziz, the treasurer, is away for
// three weeks and wants an out-of-office reply, for his own address and for
// treasurer@ (an alias that arrives in his mailbox), but never to the
// federation's mailing list. His old holiday script uses reject: it would
// refuse every message and answer the list.
// The fix: a Sieve script for Leilani (fileinto, with :create or a mailbox
// created with doveadm mailbox create), a vacation for Aziz with
// :addresses ["treasurer@lifeboat.example"], both checked (sievec,
// sieve-test), activated (doveadm sieve activate, or the ~/.dovecot.sieve
// link), then seen at work on new mail delivered by LMTP.
// Objective checked on the state: Leilani's active scripts file a fresh
// bookings@ message into Bookings (a folder that exists, or :create) and
// keep a direct one in her INBOX; Aziz's answer a direct message and a
// treasurer@ one, not a list's, and keep them all; real deliveries did the
// same (a booking stored in Bookings, a vacation reply sent).
// False leads: the old reject script activated, a script written but not
// active (or in the wrong place), a syntax error, a vacation without
// :addresses (treasurer@ gets no answer).
// Sources: https://www.rfc-editor.org/rfc/rfc5228, https://www.rfc-editor.org/rfc/rfc5230,
// https://doc.dovecot.org/2.4.1/core/plugins/sieve.html,
// https://doc.dovecot.org/2.4.1/core/config/sieve/extensions/vacation.html,
// https://doc.dovecot.org/2.4.1/core/man/doveadm-sieve.1.html.

import type { Chapter } from '../world';
import { f } from '../world';
import type { Game } from '../shell';
import { dovecot, mailText, mailboxes, runSieve, sieveScripts, type MailUser, type SieveRun } from '../dovecot';
import { DOMAIN, HOME, NOW, PASSWORD, USER, direct, ham, initialiseStory, listMail, mailUser, passTime, seen, slipwayAccounts, slipwayState, slipwayWorld, tr, type Arrival } from './lifeboat';
import type { Incoming } from '../inbound';

const TREASURER = `treasurer@${DOMAIN}`;
const BOOKINGS = `bookings@${DOMAIN}`;

const refs = (j: Game) => {
  const t = tr(j);
  return {
    booking: ham(t, 'ref3-booking', BOOKINGS, NOW[3]),
    leilani: direct(t, 'ref3-leilani', USER('leilani'), USER('leilani'), NOW[3], 'raffle'),
    aziz: direct(t, 'ref3-aziz', USER('aziz'), USER('aziz'), NOW[3], 'tyres'),
    treasurer: direct(t, 'ref3-treasurer', USER('aziz'), TREASURER, NOW[3], 'year-end'),
    list: listMail(t, 'ref3-list', USER('aziz'), NOW[3]),
  };
};
/** What the user's scripts would do with a message delivered to them (alias: the original recipient). */
const trial = (j: Game, u: MailUser, x: Incoming, orig?: string): SieveRun => runSieve(j, u, x.mail, { from: x.from, orig: orig ?? u.user, time: NOW[3] }, {}, true);
const boxes = (j: Game, u: MailUser) => mailboxes(j, u).map((b) => b.toLowerCase());
const leilaniOk = (j: Game) => {
  const u = mailUser(j, 'leilani');
  const r = refs(j);
  const b = trial(j, u, r.booking, BOOKINGS);
  const sorted = b.stores.some((s) => s.toLowerCase() === 'bookings') && (boxes(j, u).includes('bookings') || b.create.some((c) => c.toLowerCase() === 'bookings'));
  const d = trial(j, u, r.leilani);
  const inbox = !d.stores.some((s) => s.toLowerCase() === 'bookings') && (d.stores.includes('INBOX') || (d.keep && !d.stores.length)) && !d.rejected;
  return sorted && inbox && !b.rejected;
};
const kept = (r: SieveRun) => !r.rejected && (r.stores.includes('INBOX') || (r.keep && !r.stores.length));
const replied = (r: SieveRun) => r.log.some((l) => l.startsWith('vacation:'));
const aziz = (j: Game) => {
  const u = mailUser(j, 'aziz');
  const r = refs(j);
  return { direct: trial(j, u, r.aziz), treasurer: trial(j, u, r.treasurer, TREASURER), list: trial(j, u, r.list) };
};
const vacationOk = (j: Game) => {
  const a = aziz(j);
  return replied(a.direct) && replied(a.treasurer) && !replied(a.list) && !a.list.rejected && kept(a.direct) && kept(a.treasurer) && kept(a.list);
};
const st = (j: Game) => dovecot(j)!;
const sortedLive = (j: Game) => st(j).deliveries.some((d) => d.user === USER('leilani') && d.orig === BOOKINGS && d.mailbox?.toLowerCase() === 'bookings');
const repliedLive = (j: Game) => st(j).replies.some((r) => r.kind === 'vacation' && r.from === USER('aziz') && /@mail\.example$/.test(r.to));
const listAnswered = (j: Game) => st(j).replies.some((r) => r.from === USER('aziz') && /lists\.coastfed\.example$/.test(r.to));
const rejectedLive = (j: Game) => st(j).deliveries.some((d) => d.error === 'rejected');
const written = (j: Game, name: string) => {
  const u = mailUser(j, name);
  const s = sieveScripts(j, u);
  const n = j.find(s.storage.path);
  return n?.type === 'directory' && Object.keys(n.children).some((k) => k.endsWith('.sieve') && k !== 'holiday.sieve') && !s.personal;
};

/** A message as a file (what sieve-test reads): its envelope sender as Return-Path. */
const eml = (x: Incoming) => mailText({ ...x.mail, headers: [['Return-Path', `<${x.from}>`], ...x.mail.headers.filter(([k]) => k !== 'Return-Path')] });

const arrivals: Arrival = (j, tick, now) => {
  const t = tr(j);
  const k = tick % 5;
  if (k === 0) return [{ kind: 'ham', m: ham(t, `ch3-b${tick}`, BOOKINGS, now) }];
  if (k === 1) return [{ kind: 'ham', m: direct(t, `ch3-l${tick}`, USER('leilani'), USER('leilani'), now, 'shop') }];
  if (k === 2) return [{ kind: 'ham', m: direct(t, `ch3-a${tick}`, USER('aziz'), USER('aziz'), now, 'fuel') }];
  if (k === 3) return [{ kind: 'ham', m: direct(t, `ch3-t${tick}`, USER('aziz'), TREASURER, now, 'gift-aid') }];
  return [{ kind: 'list', m: listMail(t, `ch3-list${tick}`, USER('aziz'), now) }];
};

export const sortingOffice: Chapter = {
  id: 'sorting-office',
  number: 3,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'mkdir', 'ln', 'chown', 'chmod', 'nano', 'sudo', 'systemctl', 'doveadm', 'doveconf', 'sievec', 'sieve-test', 'exit'],
  home: HOME,
  welcome: 'message_from_marisol.txt',
  names: true,
  final: 'end',
  steps: ['read-old', 'folder', 'sorted-live', 'vacation', 'alias', 'replied-live', 'end'],
  password: PASSWORD,
  accounts: slipwayAccounts,
  state: (t) => slipwayState(t, 3),
  initialise: (j) => initialiseStory(j, 3),
  createWorld: (t) =>
    slipwayWorld(t, 3, {
      home: {
        'message_from_marisol.txt': f(t('sorting-office-message-marisol')),
        'note_from_yerlan.txt': f(t('sorting-office-note-yerlan')),
        'sample-booking.eml': f(eml(ham(t, 'sample-booking', BOOKINGS, NOW[3] - 3 * 86_400_000)), { lines: true }),
        'sample-list.eml': f(eml(listMail(t, 'sample-list', USER('aziz'), NOW[3] - 2 * 86_400_000)), { lines: true }),
      },
      log: '',
    }),
  afterCommand: (j) => passTime(j, arrivals),
  events: [
    { id: 'read-old', condition: (j) => seen(j, `reject "${j.t('lifeboat-holiday-reply')}"`), message: (j) => j.t('sorting-office-event-read-old') },
    { id: 'syntax', condition: (j) => seen(j, /error: (validation|parse) failed|Compilation failed/), message: (j) => j.t('sorting-office-event-syntax') },
    { id: 'reject-live', condition: (j) => rejectedLive(j) || listAnswered(j), message: (j) => j.t('sorting-office-event-reject-live') },
    { id: 'not-active', condition: (j) => written(j, 'leilani') || written(j, 'aziz'), message: (j) => j.t('sorting-office-event-not-active') },
    { id: 'folder', condition: leilaniOk, message: (j) => j.t('sorting-office-event-folder') },
    { id: 'sorted-live', condition: sortedLive, message: (j) => j.t('sorting-office-event-sorted-live') },
    { id: 'alias-missing', condition: (j) => { const a = aziz(j); return replied(a.direct) && !replied(a.treasurer); }, message: (j) => j.t('sorting-office-event-alias-missing') },
    { id: 'vacation', condition: (j) => replied(aziz(j).direct), message: (j) => j.t('sorting-office-event-vacation') },
    { id: 'alias', condition: vacationOk, message: (j) => j.t('sorting-office-event-alias') },
    { id: 'replied-live', condition: repliedLive, message: (j) => j.t('sorting-office-event-replied-live') },
    { id: 'end', condition: (j) => leilaniOk(j) && vacationOk(j) && sortedLive(j) && repliedLive(j), message: (j) => j.t('sorting-office-event-end') },
  ],
};
