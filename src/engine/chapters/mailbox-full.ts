// Story "The Lifeboat", chapter "Mailbox Full": since Saturday, Saoirse
// (fundraising) receives nothing, and the sponsors who write to her get a
// bounce. Her mailbox is over its quota (1 GiB, Maildir++ quota): Dovecot's
// LMTP answers "552 5.2.2 … Quota exceeded (mailbox for user is full)" and
// Postfix bounces. Her Trash holds two years of open day photos.
// The fix: read the bounces (mail.log), the quota (doveadm quota get),
// expunge the old Trash with a search query (doveadm expunge … mailbox Trash
// savedbefore …), give her the 2 GiB the board agreed, in the userdb
// (userdb_quota_storage_size in /etc/dovecot/users), and a quota warning so
// that next time she is told before it is full.
// Objective checked on the state: her limit between 1.5 and 10 GiB and no
// user unlimited, no Trash message from before 2031, her INBOX and Sent
// whole, the quota's usage right (maildirsize agrees with the files), a
// message delivered to her since, a quota warning between 50 and 99 %
// running the quota-warning service, in the configuration Dovecot runs.
// False leads: deleting her whole Maildir, a global quota set to unlimited,
// removing files by hand (maildirsize doesn't notice: doveadm quota recalc).
// Sources: https://doc.dovecot.org/2.4.1/core/plugins/quota.html,
// https://doc.dovecot.org/2.4.1/core/man/doveadm-quota.1.html,
// https://doc.dovecot.org/2.4.1/core/man/doveadm-expunge.1.html,
// https://doc.dovecot.org/2.4.1/core/man/doveadm-search-query.7.html.

import type { Chapter } from '../world';
import { f } from '../world';
import type { Game } from '../shell';
import { actualUsage, confPath, dovecot, messagesOf, quotaRoot, usage, users } from '../dovecot';
import { DAY, DOMAIN, HOME, MIN, MX, NOW, PASSWORD, USER, countIn, direct, ham, initialiseStory, mailUser, pastLog, passTime, seen, slipwayAccounts, slipwayState, slipwayWorld, story, typed, type Arrival } from './lifeboat';
import { machineName } from '../machines';

const GIB = 1024 ** 3;
const saoirse = (j: Game) => mailUser(j, 'saoirse');
const root = (j: Game) => quotaRoot(j, saoirse(j));
const limitOk = (j: Game) => {
  const r = root(j);
  return !!r && r.limit >= 1.5 * GIB && r.limit <= 10 * GIB;
};
const unlimited = (j: Game) => users(j).some((u) => quotaRoot(j, u)?.limit === 0);
const oldTrashGone = (j: Game) => !messagesOf(j, saoirse(j), 'Trash').some((m) => m.received < Date.UTC(2031, 0, 1));
const kept = (j: Game) => {
  const s = story(j).start!;
  return countIn(j, saoirse(j), 'INBOX') >= s.INBOX && countIn(j, saoirse(j), 'Sent') >= s.Sent;
};
const lost = (j: Game) => countIn(j, saoirse(j), 'INBOX') < story(j).start!.INBOX;
const stale = (j: Game) => {
  const r = root(j);
  return !!r && Math.abs(usage(j, saoirse(j), r).bytes - actualUsage(j, saoirse(j)).bytes) > 1024 * 1024;
};
const consistent = (j: Game) => !stale(j);
const warningOk = (j: Game) => {
  const r = root(j);
  const loaded = dovecot(j)?.loaded;
  return !!r && !!loaded && r.warnings.some((w) => w.percentage >= 50 && w.percentage <= 99 && !!w.args.trim() && confPath(loaded, `service/${w.service}`).length > 0);
};
const delivered = (j: Game) => !!dovecot(j)?.deliveries.some((x) => x.user === USER('saoirse') && x.mailbox);

const SPONSORS = ['Your sponsorship pack for the winter appeal', 'Signed form for the boat naming', 'Photos from the summer fair', 'Grant: the documents you asked for', 'Raffle prizes from the chandlery'];

const arrivals: Arrival = (_j, tick, now) => {
  if (tick % 2 === 1) {
    const subject = SPONSORS[Math.floor(tick / 2) % SPONSORS.length];
    const m = direct(`sponsor${tick}`, USER('saoirse'), USER('saoirse'), now, subject, `Hello Saoirse,\n\n${subject}: attached, as promised.\n\n[attachment: documents-${tick}.pdf]`);
    m.mail.size = 1_400_000 + tick * 23_000;
    return [{ kind: 'ham', m }];
  }
  return [{ kind: 'ham', m: ham(`ch1-${tick}`, tick % 4 ? `bookings@${DOMAIN}` : USER('marisol'), now, tick % 4 ? 'booking' : 'crew') }];
};

/** mail.log since Saturday: deliveries, and every message to Saoirse bounced. */
function history(host: string): string {
  const entries: [number, string, number, string][] = [];
  const start = Date.UTC(2031, 8, 13, 7, 2, 0);
  for (let i = 0; i < 18; i++) {
    const at = start + i * 3 * 3_600_000 + (i % 4) * 600_000;
    const qid = `4C${(0x3a10f + i * 977).toString(16).toUpperCase()}${'ABCDEF'[i % 6]}`;
    const toSaoirse = i % 2 === 0;
    const to = toSaoirse ? USER('saoirse') : i % 3 ? USER('leilani') : USER('marisol');
    const from = toSaoirse ? ['amara.okafor', 'rafael.duarte', 'ingrid.solberg'][i % 3] + '@mail.example' : 'tom.whitlock@mail.example';
    entries.push(
      [at, 'postfix/smtpd', 2406, `connect from smtp.mail.example[203.0.113.50]`],
      [at, 'postfix/smtpd', 2406, `${qid}: client=smtp.mail.example[203.0.113.50]`],
      [at + 200, 'postfix/cleanup', 2402, `${qid}: message-id=<${i}x${qid.toLowerCase()}@mail.example>`],
      [at + 900, 'postfix/qmgr', 1188, `${qid}: from=<${from}>, size=${toSaoirse ? 1_830_412 + i * 1009 : 4210 + i * 17}, nrcpt=1 (queue active)`],
    );
    if (toSaoirse) {
      entries.push(
        [at + 1200, 'dovecot', 4201, `lmtp(${to})<${4200 + i}><Qd${i}Kp7vZ2Mmk1aBc3lQ>: sieve: msgid=<${i}x${qid.toLowerCase()}@mail.example>: failed to store into mailbox 'INBOX': Quota exceeded (mailbox for user is full)`],
        [at + 1300, 'postfix/lmtp', 2410, `${qid}: to=<${to}>, relay=${MX}[private/dovecot-lmtp], delay=0.41, delays=0.3/0.01/0.02/0.08, dsn=5.2.2, status=bounced (host ${MX}[private/dovecot-lmtp] said: 552 5.2.2 <${to}> Quota exceeded (mailbox for user is full) (in reply to end of DATA command))`],
        [at + 1400, 'postfix/bounce', 2411, `${qid}: sender non-delivery notification: 5E${(0x51a2 + i).toString(16).toUpperCase()}B2`],
      );
    } else
      entries.push(
        [at + 1200, 'dovecot', 4201, `lmtp(${to})<${4200 + i}><Rk${i}Lp8wA3Nnl2bCd4mR>: sieve: msgid=<${i}x${qid.toLowerCase()}@mail.example>: stored mail into mailbox 'INBOX'`],
        [at + 1300, 'postfix/lmtp', 2410, `${qid}: to=<${to}>, relay=${MX}[private/dovecot-lmtp], delay=0.38, delays=0.29/0.01/0.02/0.06, dsn=2.0.0, status=sent (250 2.0.0 <${to}> Rk${i}Lp8wA3Nnl2bCd4mR Saved)`],
      );
    entries.push([at + 1500, 'postfix/qmgr', 1188, `${qid}: removed`]);
  }
  return pastLog(host, entries);
}

export const mailboxFull: Chapter = {
  id: 'mailbox-full',
  number: 1,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'wc', 'sort', 'du', 'df', 'find', 'nano', 'sudo', 'systemctl', 'journalctl', 'postconf', 'postqueue', 'mailq', 'doveadm', 'doveconf', 'exit'],
  home: HOME,
  welcome: 'message_from_marisol.txt',
  names: true,
  final: 'end',
  steps: ['bounces', 'quota-get', 'trash', 'expunged', 'raised', 'delivered', 'warning', 'end'],
  password: PASSWORD,
  accounts: slipwayAccounts,
  state: (t) => slipwayState(t, 1),
  initialise: (j) => initialiseStory(j, 1),
  createWorld: (t) =>
    slipwayWorld(t, 1, {
      home: { 'message_from_marisol.txt': f(t('mailbox-full-message-marisol')), 'note_from_yerlan.txt': f(t('mailbox-full-note-yerlan')) },
      log: history(machineName(t, 'slipway')),
    }),
  afterCommand: (j) => passTime(j, arrivals),
  events: [
    { id: 'bounces', condition: (j) => seen(j, 'Quota exceeded (mailbox for user is full)'), message: (j) => j.t('mailbox-full-event-bounces') },
    { id: 'quota-get', condition: (j) => seen(j, /User quota\s+STORAGE\s+\d+/), message: (j) => j.t('mailbox-full-event-quota-get') },
    { id: 'trash', condition: (j) => seen(j, /^Trash messages=\d+/m) || (/doveadm\b.*\btrash\b/i.test(typed(j)) && seen(j, /messages=\d+|vsize=\d+|mailbox: Trash|^[0-9a-f]{32} \d+$/m)) || (/\.Trash/.test(typed(j)) && seen(j, /^\d+(\.\d+)?[KMG]?\s/m)), message: (j) => j.t('mailbox-full-event-trash') },
    { id: 'lost', condition: lost, message: (j) => j.t('mailbox-full-event-lost') },
    { id: 'unlimited', condition: unlimited, message: (j) => j.t('mailbox-full-event-unlimited') },
    { id: 'stale', condition: (j) => stale(j), message: (j) => j.t('mailbox-full-event-stale') },
    { id: 'expunged', condition: (j) => oldTrashGone(j) && consistent(j) && kept(j), message: (j) => j.t('mailbox-full-event-expunged') },
    { id: 'raised', condition: limitOk, message: (j) => j.t('mailbox-full-event-raised') },
    { id: 'delivered', condition: delivered, message: (j) => j.t('mailbox-full-event-delivered') },
    { id: 'warning', condition: warningOk, message: (j) => j.t('mailbox-full-event-warning') },
    {
      id: 'end',
      condition: (j) => limitOk(j) && !unlimited(j) && oldTrashGone(j) && kept(j) && consistent(j) && delivered(j) && warningOk(j),
      message: (j) => j.t('mailbox-full-event-end'),
    },
  ],
};

export { DAY, MIN, NOW };
