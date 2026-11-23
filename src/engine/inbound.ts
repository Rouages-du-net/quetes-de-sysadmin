// Postfix receiving mail for its virtual domains (Postfix 3.10, Debian 13):
// smtpd accepts a message from the internet, the milters see it
// (smtpd_milters: rspamd's proxy on inet:localhost:11332, rspamd.ts),
// virtual_alias_maps rewrites the recipients (bookings@ → leilani@),
// virtual_transport hands it to Dovecot's LMTP (dovecot.ts), and every step
// goes to /var/log/mail.log like Postfix writes it; a refused delivery
// bounces back to the sender (postfix/bounce).
// After https://www.postfix.org/VIRTUAL_README.html,
// https://www.postfix.org/MILTER_README.html, https://www.postfix.org/lmtp.8.html,
// https://doc.dovecot.org/2.4.1/howto/lmtp/postfix.html and
// https://docs.rspamd.com/tutorials/integration/.
// Differences: no real SMTP session; virtual_alias_maps is read from its
// text file (postmap is not needed); a deferred inbound message is retried
// by the sender's side of the story, not from Postfix's queue.

import type { Game } from './shell';
import { systemd } from './systemd';
import { mail as mailState, newId, parameter, readMainCf, MAIN_CF } from './mail';
import { addressesIn, header, lmtpDeliver, mailLog, running as dovecotRunning, sizeOf, type Delivery, type Mail } from './dovecot';
import { logScan, rspamd, rspamdRunning, scan, type Scan } from './rspamd';

export interface Incoming {
  mail: Mail;
  ip: string;
  // The sender's reverse DNS name (absent: unknown).
  rdns?: string;
  helo: string;
  from: string;
  rcpt: string[];
}

export interface Outcome {
  // accepted: Postfix took it (its deliveries say where it went); rejected: refused at SMTP; deferred: try again later.
  status: 'accepted' | 'rejected' | 'deferred' | 'down';
  qid?: string;
  scan?: Scan;
  reply?: string;
  deliveries: (Delivery & { status: 'sent' | 'bounced' | 'deferred'; to: string })[];
}

const PIDS = { smtpd: 2406, cleanup: 2402, qmgr: 1188, lmtp: 2410, bounce: 2411 };

/** virtual_alias_maps (hash:/etc/postfix/virtual): "address target[, target…]". */
export function aliases(game: Game): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const maps = parameter(game, 'virtual_alias_maps').split(/[\s,]+/).filter(Boolean);
  for (const m of maps) {
    const file = m.replace(/^(hash|lmdb|texthash):/, '');
    for (const l of (game.read(file) ?? '').split('\n')) {
      const t = l.replace(/#.*$/, '').trim();
      const x = /^(\S+)\s+(.+)$/.exec(t);
      if (x) out[x[1].toLowerCase()] = x[2].split(/[\s,]+/).filter(Boolean).map((a) => a.toLowerCase());
    }
  }
  return out;
}

const milterAt = (game: Game) => parameter(game, 'smtpd_milters').split(/[\s,]+/).filter(Boolean);
const isRspamd = (m: string) => /^inet:(localhost|127\.0\.0\.1|\[::1\]):11332$/.test(m);

/** Does main.cf (as Postfix runs it) send incoming mail through rspamd? */
export const milterOn = (game: Game) => milterAt(game).some(isRspamd);

/** A message arrives from the internet on port 25. */
export function receive(game: Game, m: Incoming): Outcome {
  const sd = systemd(game);
  if (sd?.services.postfix?.state !== 'active') return { status: 'down', deliveries: [] };
  const client = `${m.rdns ?? 'unknown'}[${m.ip}]`;
  const tail = `from=<${m.from}> to=<${m.rcpt[0]}> proto=ESMTP helo=<${m.helo}>`;
  mailLog(game, 'postfix/smtpd', PIDS.smtpd, `connect from ${client}`);
  const domains = parameter(game, 'virtual_mailbox_domains').split(/[\s,]+/).filter(Boolean).map((d) => d.toLowerCase());
  const rcpt = m.rcpt.filter((r) => domains.includes(r.replace(/^.*@/, '').toLowerCase()));
  if (!rcpt.length) {
    mailLog(game, 'postfix/smtpd', PIDS.smtpd, `NOQUEUE: reject: RCPT from ${client}: 554 5.7.1 <${m.rcpt[0]}>: Relay access denied; ${tail}`);
    mailLog(game, 'postfix/smtpd', PIDS.smtpd, `disconnect from ${client} ehlo=1 mail=1 rcpt=0/1 quit=1 commands=3/4`);
    return { status: 'rejected', reply: '554 5.7.1 Relay access denied', deliveries: [] };
  }
  const qid = newId(game);
  mailLog(game, 'postfix/smtpd', PIDS.smtpd, `${qid}: client=${client}`);
  mailLog(game, 'postfix/cleanup', PIDS.cleanup, `${qid}: message-id=${header(m.mail, 'Message-ID')[0] ?? '<>'}`);
  let mail = m.mail;
  let result: Scan | undefined;
  const disconnect = () => mailLog(game, 'postfix/smtpd', PIDS.smtpd, `disconnect from ${client} ehlo=1 mail=1 rcpt=${rcpt.length} data=0/1 quit=1 commands=${3 + rcpt.length}/${4 + rcpt.length}`);
  for (const milter of milterAt(game)) {
    if (!isRspamd(milter) || !rspamdRunning(game)) {
      mailLog(game, 'postfix/smtpd', PIDS.smtpd, `warning: connect to Milter service ${milter}: Connection refused`);
      if (parameter(game, 'milter_default_action') === 'accept') continue;
      mailLog(game, 'postfix/cleanup', PIDS.cleanup, `${qid}: milter-reject: END-OF-MESSAGE from ${client}: 4.7.1 Service unavailable - try again later; ${tail}`);
      disconnect();
      return { status: 'deferred', qid, reply: '451 4.7.1 Service unavailable - try again later', deliveries: [] };
    }
    result = scan(game, mail, { ip: m.ip, from: m.from, rcpt, helo: m.helo });
    const st = rspamd(game)!;
    // The greylist module: a first-time triplet is deferred, its retry after five minutes passes.
    if (result.action === 'greylist') {
      const key = `${m.ip}|${m.from}|${rcpt[0]}`;
      const first = st.greylist[key];
      const now = sd.clock;
      if (first === undefined || now - first < 300_000) {
        if (first === undefined) st.greylist[key] = now;
        result = { ...result, action: 'soft reject' };
      } else result = { ...result, action: 'no action' };
    }
    logScan(game, result, { qid, ip: m.ip, from: m.from, rcpts: rcpt, len: sizeOf(mail) });
    if (result.action === 'reject') {
      mailLog(game, 'postfix/cleanup', PIDS.cleanup, `${qid}: milter-reject: END-OF-MESSAGE from ${client}: 5.7.1 Spam message rejected; ${tail}`);
      disconnect();
      return { status: 'rejected', qid, scan: result, reply: '554 5.7.1 Spam message rejected', deliveries: [] };
    }
    if (result.action === 'soft reject') {
      mailLog(game, 'postfix/cleanup', PIDS.cleanup, `${qid}: milter-reject: END-OF-MESSAGE from ${client}: 4.7.1 Try again later; ${tail}`);
      disconnect();
      return { status: 'deferred', qid, scan: result, reply: '451 4.7.1 Try again later', deliveries: [] };
    }
    if (result.action === 'add header') mail = { ...mail, headers: [['X-Spam', 'Yes'], ...mail.headers] };
    if (result.action === 'rewrite subject') mail = { ...mail, headers: mail.headers.map(([k, v]) => (k.toLowerCase() === 'subject' ? [k, `*** SPAM *** ${v}`] : [k, v])) };
  }
  disconnect();
  const size = sizeOf(mail);
  mailLog(game, 'postfix/qmgr', PIDS.qmgr, `${qid}: from=<${m.from}>, size=${size}, nrcpt=${rcpt.length} (queue active)`);
  const table = aliases(game);
  const deliveries: Outcome['deliveries'] = [];
  const received: [string, string] = ['Received', `from ${m.helo} (${client}) by ${parameter(game, 'myhostname')} (Postfix) with ESMTPS id ${qid} for <${rcpt[0]}>`];
  const transport = parameter(game, 'virtual_transport');
  for (const r of rcpt) {
    const targets = table[r.toLowerCase()] ?? [r.toLowerCase()];
    for (const to of targets) {
      const orig = to !== r.toLowerCase() ? `, orig_to=<${r}>` : '';
      const delay = 'delay=0.42, delays=0.31/0.01/0.02/0.08';
      if (!/^lmtp:unix:private\/dovecot-lmtp$/.test(transport) || !dovecotRunning(game)) {
        const why = /^lmtp:/.test(transport) ? `connect to ${parameter(game, 'myhostname')}[private/dovecot-lmtp]: No such file or directory` : `mail transport unavailable`;
        mailLog(game, 'postfix/lmtp', PIDS.lmtp, `${qid}: to=<${to}>${orig}, relay=none, ${delay}, dsn=4.4.1, status=deferred (${why})`);
        deliveries.push({ time: sd.clock, user: to, mailbox: null, error: 'down', msgid: header(mail, 'Message-ID')[0] ?? '', status: 'deferred', to });
        continue;
      }
      const delivered: Mail = { ...mail, headers: [['Return-Path', `<${m.from}>`], ['Delivered-To', to], received, ...mail.headers.filter(([k]) => k.toLowerCase() !== 'return-path')] };
      const res = lmtpDeliver(game, to, delivered, { from: m.from, orig: r.toLowerCase(), time: sd.clock });
      const dsn = /^\d{3} (\d\.\d\.\d+)/.exec(res.code)?.[1] ?? '2.0.0';
      const status = res.code.startsWith('2') ? 'sent' : res.code.startsWith('4') ? 'deferred' : 'bounced';
      const host = parameter(game, 'myhostname');
      mailLog(
        game,
        'postfix/lmtp',
        PIDS.lmtp,
        `${qid}: to=<${to}>${orig}, relay=${host}[private/dovecot-lmtp], ${delay}, dsn=${dsn}, status=${status} (${status === 'sent' ? res.code : `host ${host}[private/dovecot-lmtp] said: ${res.code} (in reply to end of DATA command)`})`,
      );
      if (status === 'bounced') {
        const bounce = newId(game);
        mailLog(game, 'postfix/bounce', PIDS.bounce, `${qid}: sender non-delivery notification: ${bounce}`);
      }
      deliveries.push({ ...res.delivery, status, to });
    }
  }
  mailLog(game, 'postfix/qmgr', PIDS.qmgr, `${qid}: removed`);
  return { status: 'accepted', qid, scan: result, deliveries };
}

/** Is a parameter set in main.cf as Postfix runs it (after postfix reload)? */
export const loadedParameter = (game: Game, name: string) => {
  const c = mailState(game);
  return c?.postfix ? parameter(game, name, c.postfix.values) : parameter(game, name, readMainCf(game.read(MAIN_CF) ?? '').values);
};

export { addressesIn };
