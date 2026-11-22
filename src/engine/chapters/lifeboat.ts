// Story "The Lifeboat": what its chapters share. Seaholme Lifeboat (la
// Station de sauvetage de Seaholme in French) is a volunteer-run, independent
// lifeboat station: its crew, its open days and school visits, its
// fundraising. Its mail for lifeboat.example arrives on slipway (cale in
// French, the story's main machine, 192.0.2.140, RFC 5737): Postfix
// receives it, rspamd scores it through the milter, Dovecot's LMTP stores it
// in Maildirs under /var/vmail with Sieve on the way. Marisol chairs the
// station, Yerlan set the server up years ago and left notes, Leilani is the
// secretary (bookings@ arrives in her mailbox), Aziz the treasurer
// (treasurer@), Saoirse runs the fundraising.
// Chapter 1: a mailbox over quota (bounces, doveadm quota, a userdb quota,
// an old Trash expunged, a quota warning); chapter 2: rspamd's thresholds, a
// newsletter whitelisted, Bayes trained; chapter 3: Sieve sorting and a
// vacation reply that answers neither mailing lists nor aliases wrongly.
// The mail contents are data from the internet: they stay in English, like
// the logs (the characters' messages are in the texts).
// Sources: https://doc.dovecot.org/2.4.1/, https://docs.rspamd.com/,
// https://www.postfix.org/VIRTUAL_README.html, RFC 5228 and RFC 5230.

import { accountsFiles, d, f, type Accounts, type Directory, type File, type Node, type Rights } from '../world';
import type { Game, Shell } from '../shell';
import type { Translate } from '../../texts';
import { newSystemd, systemd, type DefinitionService } from '../systemd';
import { machineName } from '../machines';
import { loadPostfix, logTime, type MailState } from '../mail';
import { attachDovecot, dovecot, lookup, mailText, newDovecot, parseMail, VMAIL, type Mail, type MailUser } from '../dovecot';
import { attachRspamd, newRspamd, rspamd, type RspamdNet } from '../rspamd';
import { receive, type Incoming, type Outcome } from '../inbound';

export const HOME = '/home/you';
export const PASSWORD = 'storm-lantern-24';
export type ChapterNo = 1 | 2 | 3;
export const DOMAIN = 'lifeboat.example';
export const MX = 'mail.lifeboat.example';
export const IP = '192.0.2.140';
export const VMAIL_DIR = `/var/vmail/${DOMAIN}`;
export const DAY = 86_400_000;
export const MIN = 60_000;
export const USER = (name: string) => `${name}@${DOMAIN}`;
export const PEOPLE = ['marisol', 'yerlan', 'leilani', 'aziz', 'saoirse'] as const;

// Tuesday 16 September 2031, 9:10; Monday 6 October, 8:40; Monday 3 November, 9:05.
export const NOW: Record<ChapterNo, number> = { 1: Date.UTC(2031, 8, 16, 9, 10, 0), 2: Date.UTC(2031, 9, 6, 8, 40, 0), 3: Date.UTC(2031, 10, 3, 9, 5, 0) };
const BOOT: Record<ChapterNo, number> = { 1: Date.UTC(2031, 8, 2, 6, 12, 0), 2: Date.UTC(2031, 9, 1, 6, 3, 0), 3: Date.UTC(2031, 9, 1, 6, 3, 0) };
// How long a command takes in the story (the mail keeps arriving meanwhile).
const STEP: Record<ChapterNo, number> = { 1: MIN, 2: 2 * MIN, 3: MIN };

// ——— Story state (on slipway) ———

export interface Story {
  chapter: ChapterNo;
  ticks: number;
  // Messages deferred by greylisting, sent again by their servers later.
  pending: { due: number; m: Incoming }[];
  // What arrived and what happened to it.
  outcomes: { tick: number; kind: string; to: string; outcome: Outcome }[];
  // A message id → its family (phish, invoice, prize, newsletter, ham…), to check what rspamd learned.
  family: Record<string, string>;
  // Chapter 1: the mailboxes' messages at the start (to tell a cleanup from a loss).
  start?: Record<string, number>;
}
export const story = (j: Game): Story => (j as Shell).state.lifeboat as Story;
export const typed = (j: Game) => (j as Shell).last.line ?? '';
/** The last command's output contains this; reading the manual doesn't count. */
export const seen = (j: Game, text: string | RegExp) => {
  if (/^\s*(man|apropos|whatis|help)\b|--help\b/.test(typed(j))) return false;
  const last = (j as Shell).last;
  const all = `${last.output}\n${last.errors.join('\n')}`;
  return typeof text === 'string' ? all.includes(text) : text.test(all);
};
export const mailUser = (j: Game, name: string): MailUser => lookup(j, USER(name))!;

// ——— Making messages ———

const hash = (s: string) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h;
};
const pick = <T,>(list: readonly T[], seed: string): T => list[hash(seed) % list.length];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const rfcDate = (ms: number) => {
  const x = new Date(ms);
  return `${DAYS[x.getUTCDay()]}, ${x.getUTCDate()} ${MONTHS[x.getUTCMonth()]} ${x.getUTCFullYear()} ${x.toISOString().slice(11, 19)} +0100`;
};

export interface Spec {
  from: string;
  to: string;
  cc?: string;
  subject: string;
  date: number;
  body: string;
  id: string;
  extra?: [string, string][];
  html?: boolean;
  size?: number;
}
export function message(s: Spec): Mail {
  return {
    headers: [
      ...(s.extra ?? []).filter(([k]) => k === 'Received' || k === 'DKIM-Signature'),
      ['From', s.from],
      ['To', s.to],
      ...(s.cc ? ([['Cc', s.cc]] as [string, string][]) : []),
      ['Subject', s.subject],
      ['Date', rfcDate(s.date)],
      ['Message-ID', `<${s.id}>`],
      ['MIME-Version', '1.0'],
      ['Content-Type', s.html ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8'],
      ...(s.extra ?? []).filter(([k]) => k !== 'Received' && k !== 'DKIM-Signature'),
    ],
    body: s.body,
    ...(s.size ? { size: s.size } : {}),
  };
}

// ——— The senders on the internet (what rspamd's DNS lookups find) ———

export const SENDWAVE = { a: '198.51.100.20', b: '198.51.100.21' };
export const FRIENDLY = '203.0.113.50';
export const PHISH_IPS = ['203.0.113.181', '203.0.113.182', '203.0.113.187', '203.0.113.190'];
export const NET: RspamdNet = {
  senders: {
    [SENDWAVE.a]: { rdns: 'out1.sendwave.example', listed: ['RBL_SPAMCOP'] },
    [SENDWAVE.b]: { rdns: 'out2.sendwave.example', listed: ['RBL_SPAMCOP'] },
    [FRIENDLY]: { rdns: 'smtp.mail.example' },
    '198.51.100.60': { rdns: 'mx.coastfed.example' },
  },
  domains: {
    'sendwave.example': { spf: ['198.51.100.16/28'] },
    'coastwatch.example': { spf: ['198.51.100.16/28'], dmarc: 'none' },
    'mail.example': { spf: [`${FRIENDLY}/32`], dmarc: 'none' },
    'lists.coastfed.example': { spf: ['198.51.100.60/32'] },
    'coastfed.example': { spf: ['198.51.100.60/32'], dmarc: 'none' },
    [DOMAIN]: { spf: [`${IP}/32`], dmarc: 'quarantine' },
  },
  dkim: ['sendwave.example', 'mail.example', 'coastfed.example'],
};

const received = (helo: string, rdns: string | undefined, ip: string, date: number): [string, string] => ['Received', `from ${helo} (${rdns ?? 'unknown'} [${ip}]) by ${helo}; ${rfcDate(date)}`];

const FRIENDS = ['amara.okafor', 'tom.whitlock', 'mei.chen', 'rafael.duarte', 'ingrid.solberg', 'kofi.mensah', 'nadia.haddad', 'oisin.kelly', 'priya.raman', 'tane.walker', 'zeynep.arslan', 'lucia.moreno'];
const SCHOOLS = ['Harbour Primary', 'St Brendan\'s', 'Northcliff Scouts', 'Seaholme Sea Cadets', 'Westbay Academy', 'the Rockpool Nursery', 'Cliffside Rangers'];
const HAM_WORDS = ['visit', 'station', 'group', 'children', 'saturday', 'boathouse', 'crew', 'training', 'launch', 'rota', 'volunteers', 'donation', 'raffle', 'tour', 'teachers', 'lunch', 'parking', 'harbour', 'lifejackets', 'drill', 'tide', 'thanks', 'morning', 'afternoon', 'tickets', 'gift', 'shop', 'coffee', 'minibus'];

/** A friendly message: a booking, the crew rota, a donation (ham). */
export function ham(seed: string, to: string, date: number, kind: 'booking' | 'crew' = 'booking'): Incoming {
  const who = pick(FRIENDS, `${seed}:who`);
  const name = who.split('.').map((x) => x[0].toUpperCase() + x.slice(1)).join(' ');
  const school = pick(SCHOOLS, `${seed}:school`);
  const words = Array.from({ length: 6 }, (_, i) => pick(HAM_WORDS, `${seed}:w${i}`));
  const day = 1 + (hash(`${seed}:day`) % 27);
  const subject = kind === 'booking' ? `Visit request: ${school}, ${day} ${pick(['November', 'December', 'March', 'April'], `${seed}:m`)}` : `Crew rota: ${pick(['launch', 'training', 'drill', 'tractor'], `${seed}:r`)} on ${pick(['Saturday', 'Sunday', 'Wednesday'], `${seed}:d`)}`;
  const body =
    kind === 'booking'
      ? `Hello,\n\nWe would love to bring a group from ${school} to visit the station and the boathouse, around ${12 + (hash(seed) % 30)} children and four teachers. Could we book a tour on the ${day}th, in the morning if the tide allows? We can bring our own lunch.\n\nNotes: ${words.join(', ')}.\n\nThanks so much,\n${name}`
      : `Hi all,\n\nThe rota for the next ${pick(['launch', 'training'], `${seed}:t`)} is up on the board at the station. Please check your lifejackets and tell me if you can't make it.\n\nNotes: ${words.join(', ')}.\n\n${name}`;
  const id = `${(hash(seed) >>> 0).toString(36)}.${Math.floor(date / 1000)}@mail.example`;
  const from = `${who}@mail.example`;
  return {
    mail: message({ from: `${name} <${from}>`, to, subject, date, body, id, extra: [received('smtp.mail.example', 'smtp.mail.example', FRIENDLY, date), ['DKIM-Signature', 'v=1; a=rsa-sha256; d=mail.example; s=s1; bh=Zm9v; b=YmFy']] }),
    ip: FRIENDLY,
    rdns: 'smtp.mail.example',
    helo: 'smtp.mail.example',
    from,
    rcpt: [to],
  };
}

const PHISH_WORDS = ['verify', 'account', 'suspended', 'mailbox', 'password', 'immediately', 'confirm', 'login', 'security', 'deactivation', 'storage', 'quota', 'upgrade', 'validate', 'credentials', 'restore', 'access', 'expire'];
const INVOICE_WORDS = ['invoice', 'payment', 'overdue', 'outstanding', 'remittance', 'transfer', 'settle', 'amount', 'balance', 'penalty', 'reference', 'urgent', 'accounts', 'final', 'notice'];
const PRIZE_WORDS = ['winner', 'prize', 'claim', 'reward', 'crypto', 'wallet', 'bonus', 'jackpot', 'lucky', 'draw', 'selected', 'congratulations', 'exclusive', 'voucher', 'free'];

/** A spam of one of the flood's three families. */
export function spam(seed: string, to: string, date: number, family: 'phish' | 'invoice' | 'prize'): Incoming {
  const words = (list: string[], n: number) => Array.from({ length: n }, (_, i) => pick(list, `${seed}:${i}`));
  const n = hash(seed);
  if (family === 'prize') {
    const ip = n % 2 ? SENDWAVE.a : SENDWAVE.b;
    const rdns = NET.senders[ip].rdns!;
    const code = (n % 1_000_000).toString(36).toUpperCase().padStart(12, 'Q');
    const body = `<html><body><img src="https://cdn.sendwave.example/i/${code}.png"><p>Congratulations! You were selected in our ${words(PRIZE_WORDS, 3).join(' ')} draw.</p><p><a href="https://t.sendwave.example/r/${code}">Claim your reward now</a></p><p>${words(PRIZE_WORDS, 8).join(' ')}</p><p><a href="https://t.sendwave.example/u/${code}">Unsubscribe</a></p></body></html>`;
    const from = `bounces+${code.toLowerCase()}@sendwave.example`;
    return {
      mail: message({
        from: `Lucky Draw <win@prize-vault.example>`, to, subject: pick(['You have WON!', 'Claim your crypto bonus now!', 'Your exclusive reward is waiting!'], seed), date, body, id: `${code}@sendwave.example`, html: true,
        extra: [received(rdns, rdns, ip, date), received('relay.sendwave.example', 'relay.sendwave.example', '198.51.100.17', date), ['DKIM-Signature', 'v=1; a=rsa-sha256; d=sendwave.example; s=s1; bh=cHJp; b=emU='], ['List-Unsubscribe', `<https://t.sendwave.example/u/${code}>`], ['Return-Path', `<${from}>`]],
      }),
      ip, rdns, helo: rdns, from, rcpt: [to],
    };
  }
  const ip = PHISH_IPS[n % PHISH_IPS.length];
  const host = `vps${n % 900}.cloud.example`;
  if (family === 'phish') {
    const body = `<html><body><p>Dear ${to.split('@')[0]},</p><p>Your ${DOMAIN} mailbox has reached its storage limit and will be suspended. ${words(PHISH_WORDS, 10).join(' ')}.</p><p><a href="https://webmail-${DOMAIN.replace('.', '-')}.cloud.example/login">Verify your account</a></p><p>${DOMAIN} Mail Administrator</p></body></html>`;
    const from = `no-reply@mailadmin-${n % 97}.cloud.example`;
    return {
      mail: message({ from: `Mail Administrator <${from}>`, to, subject: pick(['Action required: your mailbox will be suspended', 'Mailbox storage limit reached', 'Confirm your account to avoid deactivation'], seed), date, body, id: `${n.toString(16)}.${Math.floor(date / 1000)}@${host}`, html: true, extra: [received(host, undefined, ip, date)] }),
      ip, helo: host, from, rcpt: [to],
    };
  }
  const body = `<html><body><p>Hello,</p><p>Please find attached the final notice for the overdue invoice ${10_000 + (n % 89_999)}. ${words(INVOICE_WORDS, 10).join(' ')}.</p><p>Accounts Department</p></body></html>`;
  const from = `accounts@billing-${n % 89}.cloud.example`;
  return {
    mail: message({ from: `Accounts <${from}>`, to, subject: pick(['INVOICE OVERDUE - FINAL NOTICE', 'PAYMENT REMINDER - URGENT ACTION', 'OUTSTANDING BALANCE NOTICE'], seed), date, body, id: `${n.toString(16)}.${Math.floor(date / 1000)}@${host}`, html: true, extra: [received(host, undefined, ip, date)] }),
    ip, helo: host, from, rcpt: [to],
  };
}

/** The Coastwatch safety bulletin: a legitimate newsletter sent through sendwave.example, the same platform as the prize spam. */
export function newsletter(seed: string, to: string, date: number): Incoming {
  const code = (hash(seed) % 1_000_000).toString(36).toUpperCase().padStart(12, 'C');
  const ip = SENDWAVE.a;
  const rdns = NET.senders[ip].rdns!;
  const from = `bounces+cw-${code.toLowerCase()}@sendwave.example`;
  const day = new Date(date).getUTCDate();
  const body = `<html><body><img src="https://cdn.sendwave.example/i/coastwatch-logo.png"><p>Coastwatch safety bulletin, ${day} ${MONTHS[new Date(date).getUTCMonth()]}: gale warning for the outer bay from tonight, spring tides at the weekend, the forecast for the harbour.</p><p><a href="https://t.sendwave.example/r/${code}">Read the full bulletin</a></p><p><a href="https://t.sendwave.example/u/${code}">Unsubscribe</a></p></body></html>`;
  return {
    mail: message({
      from: 'Coastwatch <news@coastwatch.example>', to, subject: `Coastwatch safety bulletin: weather and tides, ${day} ${MONTHS[new Date(date).getUTCMonth()]}`, date, body, id: `${code}.${Math.floor(date / 1000)}@sendwave.example`, html: true,
      extra: [received(rdns, rdns, ip, date), received('relay.sendwave.example', 'relay.sendwave.example', '198.51.100.17', date), ['DKIM-Signature', 'v=1; a=rsa-sha256; d=sendwave.example; s=s1; bh=Y3c=; b=Y3c='], ['List-Unsubscribe', `<https://t.sendwave.example/u/${code}>`], ['Precedence', 'bulk'], ['Return-Path', `<${from}>`]],
    }),
    ip, rdns, helo: rdns, from, rcpt: [to],
  };
}

/** A message from the federation's mailing list (List-Id, Precedence: list). */
export function listMail(seed: string, to: string, date: number): Incoming {
  const from = 'stations-bounces@lists.coastfed.example';
  const topic = pick(['winter training dates', 'the new pagers', 'insurance renewal', 'the regional open day', 'fuel prices'], seed);
  return {
    mail: message({
      from: pick(['Hamid Rahimi <hamid@coastfed.example>', 'Elin Johansson <elin@coastfed.example>', 'Ruth Mbeki <ruth@coastfed.example>'], `${seed}:w`), to: 'stations@lists.coastfed.example', subject: `[stations] About ${topic}`, date,
      body: `Dear stations,\n\nA short note about ${topic}: details at the next meeting.\n\n-- \nstations mailing list\nstations@lists.coastfed.example`, id: `${(hash(seed) >>> 0).toString(36)}@coastfed.example`,
      extra: [received('mx.coastfed.example', 'mx.coastfed.example', '198.51.100.60', date), ['DKIM-Signature', 'v=1; a=rsa-sha256; d=coastfed.example; s=s1; bh=bGk=; b=bGk='], ['List-Id', 'Federation of coastal stations <stations.lists.coastfed.example>'], ['List-Post', '<mailto:stations@lists.coastfed.example>'], ['Precedence', 'list'], ['Return-Path', `<${from}>`]],
    }),
    ip: '198.51.100.60', rdns: 'mx.coastfed.example', helo: 'mx.coastfed.example', from, rcpt: [to],
  };
}

/** A direct message to someone of the station (a supplier, the accountant…). */
export function direct(seed: string, to: string, headerTo: string, date: number, subject: string, body: string): Incoming {
  const who = pick(FRIENDS, `${seed}:who`);
  const from = `${who}@mail.example`;
  return {
    mail: message({ from: `${who.split('.').map((x) => x[0].toUpperCase() + x.slice(1)).join(' ')} <${from}>`, to: headerTo, subject, date, body, id: `${(hash(seed) >>> 0).toString(36)}.${Math.floor(date / 1000)}@mail.example`, extra: [received('smtp.mail.example', 'smtp.mail.example', FRIENDLY, date), ['DKIM-Signature', 'v=1; a=rsa-sha256; d=mail.example; s=s1; bh=Zm9v; b=YmFy']] }),
    ip: FRIENDLY, rdns: 'smtp.mail.example', helo: 'smtp.mail.example', from, rcpt: [to],
  };
}

// ——— Configuration files ———

const MAIN_CF = (milter: boolean) => `# See /usr/share/postfix/main.cf.dist for a commented, more complete version

smtpd_banner = $myhostname ESMTP $mail_name (Debian/GNU)
biff = no
append_dot_mydomain = no
readme_directory = no
compatibility_level = 3.6

# TLS parameters
smtpd_tls_cert_file = /etc/ssl/certs/ssl-cert-snakeoil.pem
smtpd_tls_key_file = /etc/ssl/private/ssl-cert-snakeoil.key
smtpd_tls_security_level = may
smtp_tls_CApath = /etc/ssl/certs
smtp_tls_security_level = may

smtpd_relay_restrictions = permit_mynetworks permit_sasl_authenticated defer_unauth_destination
myhostname = ${MX}
alias_maps = hash:/etc/aliases
alias_database = hash:/etc/aliases
myorigin = /etc/mailname
mydestination = localhost
relayhost =
mynetworks = 127.0.0.0/8 [::ffff:127.0.0.0]/104 [::1]/128
mailbox_size_limit = 0
recipient_delimiter = +
inet_interfaces = all
inet_protocols = all

# The station's mail (Yerlan, 2028): Dovecot stores it, over LMTP.
virtual_mailbox_domains = ${DOMAIN}
virtual_alias_maps = hash:/etc/postfix/virtual
virtual_transport = lmtp:unix:private/dovecot-lmtp

# rspamd (its proxy worker speaks the milter protocol)
${milter ? '' : '#'}smtpd_milters = inet:localhost:11332
${milter ? '' : '#'}non_smtpd_milters = $smtpd_milters
milter_default_action = accept
milter_protocol = 6`;

const VIRTUAL = `# Addresses of the station that are not mailboxes (Yerlan).
# After a change: postmap /etc/postfix/virtual && postfix reload
bookings@${DOMAIN}     leilani@${DOMAIN}
treasurer@${DOMAIN}    aziz@${DOMAIN}
postmaster@${DOMAIN}   marisol@${DOMAIN}
abuse@${DOMAIN}        marisol@${DOMAIN}
info@${DOMAIN}         marisol@${DOMAIN}`;

const MASTER_CF = `#
# Postfix master process configuration file.  For details on the format
# of the file, see the master(5) manual page (command: "man 5 master" or
# on-line: https://www.postfix.org/master.5.html).
#
# ==========================================================================
# service type  private unpriv  chroot  wakeup  maxproc command + args
#               (yes)   (yes)   (no)    (never) (100)
# ==========================================================================
smtp      inet  n       -       y       -       -       smtpd
pickup    unix  n       -       y       60      1       pickup
cleanup   unix  n       -       y       -       0       cleanup
qmgr      unix  n       -       n       300     1       qmgr
bounce    unix  -       -       y       -       0       bounce
smtp      unix  -       -       y       -       -       smtp
lmtp      unix  -       -       y       -       -       lmtp`;

const DOVECOT_CONF = `## Dovecot configuration file (Debian)
# See https://doc.dovecot.org/latest/core/config/overview.html

dovecot_config_version = 2.4.0
dovecot_storage_version = 2.4.0

# Enable installed protocols
!include_try /usr/share/dovecot/protocols.d/*.protocol

# Most of the actual configuration gets included below. The filenames are
# first sorted by their ASCII value and parsed in that order.
!include conf.d/*.conf

# A config file can also tried to be included without giving an error if
# it's not found:
!include_try local.conf`;

const AUTH_CONF = `##
## Authentication processes
##

# Disable LOGIN command and all other plaintext authentications unless
# SSL/TLS is used (LOGINDISABLED capability).
auth_allow_cleartext = no

auth_mechanisms = plain

# The station's users (Yerlan): /etc/dovecot/users, one line per mailbox,
# in passwd-file format (user:password:uid:gid::home::userdb_* fields).
passdb passwd-file {
  passwd_file_path = /etc/dovecot/users
}
userdb passwd-file {
  passwd_file_path = /etc/dovecot/users
}`;

const MAIL_CONF = `##
## Mailbox locations and namespaces
##

# Maildir in each user's home (/var/vmail/<domain>/<user>, set by the userdb).
mail_driver = maildir
mail_path = ~/Maildir
mail_home = /var/vmail/%{user | domain}/%{user | username}

# The virtual mail user (vmail, 5000:5000) owns every mailbox.
mail_uid = vmail
mail_gid = vmail
first_valid_uid = 5000

namespace inbox {
  inbox = yes
  separator = /
}`;

const MAILBOXES_CONF = `##
## Mailbox definitions
##

namespace inbox {
  mailbox Drafts {
    special_use = \\Drafts
    auto = subscribe
  }
  mailbox Junk {
    special_use = \\Junk
    auto = subscribe
  }
  mailbox Trash {
    special_use = \\Trash
    auto = subscribe
  }
  mailbox Sent {
    special_use = \\Sent
    auto = subscribe
  }
}`;

const MASTER_CONF = `service lmtp {
  unix_listener /var/spool/postfix/private/dovecot-lmtp {
    mode = 0600
    user = postfix
    group = postfix
  }
}

service imap-login {
  inet_listener imap {
    port = 0
  }
  inet_listener imaps {
    port = 993
  }
}`;

const LMTP_CONF = `##
## LMTP specific settings
##

protocol lmtp {
  postmaster_address = postmaster@${DOMAIN}
  mail_plugins {
    sieve = yes
  }
}`;

export const QUOTA_CONF = (warning: boolean) => `##
## Quota configuration.
##

# Note that you also have to enable quota plugin in mail_plugins setting.
# <https://doc.dovecot.org/latest/core/plugins/quota.html>

mail_plugins {
  quota = yes
}

protocol imap {
  mail_plugins {
    imap_quota = yes
  }
}

# Yerlan, 2028: Maildir++ quota (maildirsize), like the old Courier server.
quota "User quota" {
  quota_driver = maildir
  quota_storage_size = 1G
${warning ? `  quota_warning warn-90 {
    quota_storage_percentage = 90
    execute quota-warning {
      args = 90 %{user}
    }
  }
` : `  # Run a script when a mailbox gets almost full (the highest first):
  #quota_warning warn-90 {
  #  quota_storage_percentage = 90
  #  execute quota-warning {
  #    args = 90 %{user}
  #  }
  #}
`}}

# The script the warnings run (it writes to the user and to the postmaster).
service quota-warning {
  executable = script /usr/local/bin/quota-warning.sh
  user = vmail
  unix_listener quota-warning {
    user = vmail
  }
}`;

const SIEVE_CONF = `##
## Settings for the Sieve interpreter
##

# The global script run before the users' own: spam to Junk (Yerlan).
sieve_script spam {
  type = before
  path = /etc/dovecot/sieve/before.d
}

# Each user's scripts: ~/sieve/NAME.sieve, the active one linked from
# ~/.dovecot.sieve (doveadm sieve activate, or ManageSieve).
sieve_script personal {
  driver = file
  path = ~/sieve
  active_path = ~/.dovecot.sieve
}`;

const SPAM_SIEVE = `# rspamd adds "X-Spam: Yes" to what it scores above add_header:
# file it into Junk, and stop there.
require ["fileinto"];
if header :is "X-Spam" "Yes" {
  fileinto "Junk";
  stop;
}`;

const QUOTA_SCRIPT = `#!/bin/sh
# Run by Dovecot's quota-warning service: $1 the percentage, $2 the user.
PERCENT=$1
USER=$2
cat << EOF | /usr/lib/dovecot/dovecot-lda -d $USER -o quota_enforce=no
From: postmaster@${DOMAIN}
Subject: Your mailbox is $PERCENT% full

Your mailbox at ${DOMAIN} is now $PERCENT% full. Please empty your Trash
and remove old attachments, or ask the postmaster for more room.
EOF`;

export const ACTIONS_CONF = (n: ChapterNo) =>
  n === 2
    ? `# Yerlan, May 2031: the [SPAM] warnings annoyed everyone, and the flood had
# to stop: header later, reject earlier.
reject = 8;
add_header = 12;
greylist = 11;`
    : `# Thresholds of the actions (rspamd's defaults: reject 15, add_header 6, greylist 4).
reject = 15;
add_header = 6;
greylist = 4;`;

const MULTIMAP_CONF = `# Local multimap rules: see https://docs.rspamd.com/modules/multimap/
# Example (a map of addresses, one per line):
#WHITELIST_SENDERS {
#  type = "from";
#  map = "/etc/rspamd/local.d/whitelist_senders.map";
#  score = -5.0;
#  description = "Senders we trust";
#}`;

// ——— The users and their Maildirs ———

export const PASSWORD_HASH = (name: string) => `{BLF-CRYPT}$2y$05$${(hash(name) >>> 0).toString(36).padEnd(22, 'q')}${(hash(name + 'x') >>> 0).toString(36).padEnd(31, 'z')}`;
const usersFile = () =>
  PEOPLE.map((p) => `${USER(p)}:${PASSWORD_HASH(p)}:${VMAIL.uid}:${VMAIL.gid}::${VMAIL_DIR}/${p}::`).join('\n');

const vm: Rights = { owner: VMAIL.user, group: VMAIL.user };
const vdir = (children: Record<string, Node>) => d(children, undefined, { ...vm, mode: 'rwx------' });

interface Seed {
  mailbox: string;
  received: number;
  mail: Mail;
  seen?: boolean;
}
let fileCounter = 0;
/** A Maildir: INBOX (cur, new, tmp) and its Maildir++ folders, the files named like Dovecot's. */
function maildir(host: string, seeds: Seed[], folders: string[], limit: number | null): Directory {
  const boxes: Record<string, Record<string, Node>> = {};
  for (const name of ['INBOX', ...folders]) boxes[name] = {};
  for (const s of seeds) {
    const text = mailText(s.mail);
    const size = s.mail.size ?? text.length;
    fileCounter++;
    const name = `${Math.floor(s.received / 1000)}.M${(fileCounter * 7919) % 1_000_000}P${2100 + (fileCounter % 900)}.${host},S=${size},W=${size + Math.round(size / 60)}:2,${s.seen === false ? '' : 'S'}`;
    (boxes[s.mailbox] ??= {})[name] = f(text, { lines: true, ...vm, mode: 'rw-------', size, mtime: s.received });
  }
  const sub = (files: Record<string, Node>) => ({ cur: vdir(files), new: vdir({}), tmp: vdir({}) });
  const children: Record<string, Node> = { ...sub(boxes.INBOX) };
  for (const name of Object.keys(boxes)) if (name !== 'INBOX') children[`.${name}`] = vdir(sub(boxes[name]));
  if (limit !== null) {
    const total = seeds.reduce((t, s) => t + (s.mail.size ?? mailText(s.mail).length), 0);
    // Maildir++: "limit S", then the lines Dovecot appended (a recalculation, then each delivery).
    const head = seeds.slice(0, seeds.length - 3);
    const first = head.reduce((t, s) => t + (s.mail.size ?? mailText(s.mail).length), 0);
    const rest = seeds.slice(seeds.length - 3).map((s) => `${s.mail.size ?? mailText(s.mail).length} 1`);
    children.maildirsize = f([`${limit}S`, `${first} ${head.length}`, ...rest].join('\n'), { lines: true, ...vm, mode: 'rw-------' });
    void total;
  }
  children['dovecot-uidlist'] = f('3 V1757900000 N1 G0c2f6e1a', { lines: true, ...vm, mode: 'rw-------' });
  return vdir(children);
}

const photo = (seed: string) => 3_800_000 + (hash(seed) % 1_700_000);
/** Saoirse's mailbox in chapter 1: photos of the open day, sponsors, and an old Trash full of attachments. */
function saoirseSeeds(): Seed[] {
  const seeds: Seed[] = [];
  const mk = (mailbox: string, i: number, at: number, subject: string, from: string, size: number) =>
    seeds.push({ mailbox, received: at, mail: message({ from, to: USER('saoirse'), subject, date: at, body: `Hi Saoirse,\n\n${subject}: the files are attached.\n\n[attachment: photos-${i}.zip]`, id: `s${i}.${Math.floor(at / 1000)}@mail.example`, size }) });
  for (let i = 0; i < 128; i++) mk('Trash', i, Date.UTC(2029, 10, 2) + i * 3 * DAY + (i % 5) * 3_600_000, `Open day photos, batch ${i + 1}`, 'Tom Whitlock <tom.whitlock@mail.example>', photo(`t${i}`));
  for (let i = 0; i < 6; i++) mk('Trash', 200 + i, Date.UTC(2031, 8, 1) + i * 2 * DAY, `Draft poster ${i + 1}`, 'Mei Chen <mei.chen@mail.example>', 1_200_000 + i * 90_000);
  for (let i = 0; i < 40; i++) mk('INBOX', 300 + i, Date.UTC(2031, 2, 1) + i * 4 * DAY, pick(['Sponsorship form', 'Raffle prizes', 'Summer fair photos', 'Grant application', 'Boat naming ceremony'], `i${i}`), pick(['Amara Okafor <amara.okafor@mail.example>', 'Rafael Duarte <rafael.duarte@mail.example>', 'Ingrid Solberg <ingrid.solberg@mail.example>'], `f${i}`), 7_700_000 + (hash(`i${i}`) % 1_200_000));
  for (let i = 0; i < 25; i++) mk('Sent', 400 + i, Date.UTC(2031, 2, 3) + i * 6 * DAY, `Re: Summer fair, part ${i + 1}`, `Saoirse <${USER('saoirse')}>`, 5_600_000 + (hash(`s${i}`) % 900_000));
  return seeds.sort((a, b) => a.received - b.received);
}

/** Leilani's mailbox in chapter 2: her INBOX, the spam she moved to Junk, the archive of bookings. */
function leilaniSeeds(n: ChapterNo, family: Record<string, string>): Seed[] {
  const seeds: Seed[] = [];
  const add = (mailbox: string, x: Incoming, kind: string, at: number) => {
    seeds.push({ mailbox, received: at, mail: x.mail });
    family[(x.mail.headers.find(([k]) => k === 'Message-ID')?.[1] ?? '').replace(/^<|>$/g, '')] = kind;
  };
  const to = USER('leilani');
  if (n === 2) {
    const families = ['phish', 'invoice', 'prize'] as const;
    for (let i = 0; i < 214; i++) {
      const fam = families[i % 3];
      add('Junk', spam(`junk${i}`, to, Date.UTC(2031, 6, 1) + i * 7 * 3_600_000, fam), fam, Date.UTC(2031, 6, 1) + i * 7 * 3_600_000);
    }
    for (let i = 0; i < 236; i++) add('Archive', ham(`arch${i}`, i % 4 ? `bookings@${DOMAIN}` : to, Date.UTC(2030, 8, 1) + i * 30 * 3_600_000, i % 3 ? 'booking' : 'crew'), 'ham', Date.UTC(2030, 8, 1) + i * 30 * 3_600_000);
    for (let i = 0; i < 26; i++) {
      const at = NOW[2] - (26 - i) * 2 * 3_600_000;
      if (i % 3 === 0) add('INBOX', ham(`inbox${i}`, `bookings@${DOMAIN}`, at), 'ham', at);
      else add('INBOX', spam(`flood${i}`, to, at, i % 3 === 1 ? 'phish' : 'invoice'), i % 3 === 1 ? 'phish' : 'invoice', at);
    }
  } else {
    for (let i = 0; i < 18; i++) add('INBOX', ham(`l${n}-${i}`, i % 2 ? `bookings@${DOMAIN}` : to, NOW[n] - (18 - i) * 9 * 3_600_000), 'ham', NOW[n] - (18 - i) * 9 * 3_600_000);
  }
  return seeds;
}

function plainSeeds(name: string, n: ChapterNo): Seed[] {
  return Array.from({ length: 8 }, (_, i) => {
    const at = NOW[n] - (8 - i) * 15 * 3_600_000;
    return { mailbox: 'INBOX', received: at, mail: ham(`${name}${n}-${i}`, USER(name), at, 'crew').mail };
  });
}

// The old reject script of Aziz's last holiday (chapter 3): not active, and it would refuse every message.
export const HOLIDAY_SIEVE = `# Aziz, August 2030 (written by Yerlan): "tell them I'm away"
require ["reject"];
reject "I am away until 25 August. For anything urgent, write to Marisol.";`;

// ——— The machine ———

const root: Rights = { owner: 'root' };
const dir = (children: Record<string, Node>, rights: Rights = root) => d(children, undefined, rights);
const file = (text: string, rights: Rights = root): File => f(text, { lines: true, ...rights });
const proc = (pid: number, user: string, command: string) => ({ pid, user, cpu: 0, mem: 0.6, command });

export const slipwayAccounts = (): Accounts => ({
  users: {
    root: { uid: 0, group: 'root', home: '/root' },
    postfix: { uid: 105, group: 'postfix', home: '/var/spool/postfix', shell: '/usr/sbin/nologin' },
    dovecot: { uid: 106, group: 'dovecot', home: '/usr/lib/dovecot', shell: '/usr/sbin/nologin' },
    dovenull: { uid: 107, group: 'dovenull', home: '/nonexistent', shell: '/usr/sbin/nologin' },
    _rspamd: { uid: 108, group: '_rspamd', home: '/var/lib/rspamd', shell: '/usr/sbin/nologin' },
    redis: { uid: 109, group: 'redis', home: '/var/lib/redis', shell: '/usr/sbin/nologin' },
    vmail: { uid: VMAIL.uid, group: 'vmail', home: '/var/vmail', shell: '/usr/sbin/nologin' },
    you: { uid: 1000, group: 'you' },
  },
  groups: {
    root: { gid: 0, members: [] },
    adm: { gid: 4, members: ['you'] },
    mail: { gid: 8, members: [] },
    sudo: { gid: 27, members: ['you'] },
    postfix: { gid: 110, members: [] },
    postdrop: { gid: 111, members: [] },
    dovecot: { gid: 112, members: [] },
    dovenull: { gid: 113, members: [] },
    _rspamd: { gid: 114, members: [] },
    redis: { gid: 115, members: [] },
    vmail: { gid: VMAIL.gid, members: [] },
    you: { gid: 1000, members: [] },
  },
});

export function slipwayState(t: Translate, n: ChapterNo) {
  const services: Record<string, DefinitionService> = {
    ssh: { description: 'OpenBSD Secure Shell server', active: true, executable: 'sshd', process: [proc(611, 'root', 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups')] },
    postfix: { description: 'Postfix Mail Transport Agent (instance -)', active: true, executable: 'master', process: [proc(1180, 'root', '/usr/lib/postfix/sbin/master -w')], load: loadPostfix },
    dovecot: { description: 'Dovecot IMAP/POP3 email server', active: true, executable: 'dovecot', process: [proc(1102, 'root', '/usr/sbin/dovecot -F')] },
    rspamd: { description: 'rapid spam filtering system', active: true, executable: 'rspamd', process: [proc(1390, '_rspamd', 'rspamd: main process')] },
    'redis-server': { description: 'Advanced key-value store', active: true, executable: 'redis-server', process: [proc(1011, 'redis', '/usr/bin/redis-server 127.0.0.1:6379')] },
  };
  const mailState: MailState = { ip: IP, file: [], counter: 60 + n * 100, postfix: null, dkim: null, providers: {}, restored: [] };
  return {
    systemd: newSystemd(machineName(t, 'slipway'), BOOT[n], NOW[n], services),
    mail: mailState,
    dovecot: newDovecot(),
    rspamd: newRspamd(JSON.parse(JSON.stringify(NET))),
    listening: [
      { proto: 'tcp', address: '0.0.0.0', port: 22, process: 'sshd', pid: 611 },
      { proto: 'tcp', address: '0.0.0.0', port: 25, process: 'master', pid: 1180 },
      { proto: 'tcp', address: '0.0.0.0', port: 993, process: 'dovecot', pid: 1102 },
      { proto: 'tcp', address: '127.0.0.1', port: 11332, process: 'rspamd', pid: 1390 },
      { proto: 'tcp', address: '127.0.0.1', port: 11333, process: 'rspamd', pid: 1390 },
      { proto: 'tcp', address: '127.0.0.1', port: 11334, process: 'rspamd', pid: 1390 },
      { proto: 'tcp', address: '127.0.0.1', port: 6379, process: 'redis-server', pid: 1011 },
    ],
    apt: {
      installed: {
        postfix: '3.10.13-0+deb13u1', 'dovecot-core': '1:2.4.1+dfsg1-6+deb13u7', 'dovecot-imapd': '1:2.4.1+dfsg1-6+deb13u7', 'dovecot-lmtpd': '1:2.4.1+dfsg1-6+deb13u7',
        'dovecot-sieve': '1:2.4.1+dfsg1-6+deb13u7', 'dovecot-managesieved': '1:2.4.1+dfsg1-6+deb13u7', rspamd: '3.12.1-1', 'redis-server': '5:8.0.2-3',
      },
    },
    mounts: [{ path: '/', capacity: 200 * 1024 ** 3, name: '/dev/vda1', system: 'ext4' }],
  };
}

export interface WorldOptions {
  home: Record<string, Node>;
  log: string;
  rspamdLog?: string;
}

export function slipwayWorld(t: Translate, n: ChapterNo, o: WorldOptions): Directory {
  const family: Record<string, string> = {};
  const host = machineName(t, 'slipway');
  fileCounter = n * 10_000;
  const people: Record<string, Node> = {};
  for (const p of PEOPLE) {
    const seeds = p === 'saoirse' && n === 1 ? saoirseSeeds() : p === 'leilani' ? leilaniSeeds(n, family) : plainSeeds(p, n);
    const folders = ['Drafts', 'Junk', 'Sent', 'Trash', ...(p === 'leilani' && n === 2 ? ['Archive'] : [])];
    const home: Record<string, Node> = { Maildir: maildir(host, seeds, folders, 1024 ** 3) };
    if (p === 'aziz' && n === 3) home.sieve = vdir({ 'holiday.sieve': f(HOLIDAY_SIEVE, { lines: true, ...vm, mode: 'rw-------', mtime: Date.UTC(2030, 7, 2) }) });
    people[p] = vdir(home);
  }
  return dir({
    etc: dir({
      ...accountsFiles(),
      hostname: file(host),
      mailname: file(DOMAIN),
      hosts: file(`127.0.0.1\tlocalhost\n${IP}\t${MX} ${host}\n\n::1\tlocalhost ip6-localhost ip6-loopback`),
      aliases: file('# See man 5 aliases for format\npostmaster:    root\nroot:          you'),
      postfix: dir({ 'main.cf': file(MAIN_CF(true)), 'master.cf': file(MASTER_CF), virtual: file(VIRTUAL), 'virtual.db': f('', { owner: 'root', size: 12_288, charset: 'binary' }) }),
      dovecot: dir(
        {
          'dovecot.conf': file(DOVECOT_CONF),
          'conf.d': dir({
            '10-auth.conf': file(AUTH_CONF),
            '10-mail.conf': file(MAIL_CONF),
            '10-master.conf': file(MASTER_CONF),
            '15-mailboxes.conf': file(MAILBOXES_CONF),
            '20-lmtp.conf': file(LMTP_CONF),
            '90-quota.conf': file(QUOTA_CONF(n !== 1)),
            '90-sieve.conf': file(SIEVE_CONF),
          }),
          users: file(usersFile(), { owner: 'root', group: 'dovecot', mode: 'rw-r-----' }),
          sieve: dir({ 'before.d': dir({ '10-spam.sieve': file(SPAM_SIEVE), '10-spam.svbin': f('', { owner: 'root', size: 389, charset: 'binary' }) }) }),
        },
        { owner: 'root', group: 'dovecot', mode: 'rwxr-xr-x' },
      ),
      rspamd: dir({
        'rspamd.conf': file('# Rspamd main configuration file (Debian): do not edit.\n# Put local changes in /etc/rspamd/local.d/ (merged) or override.d/ (replacing).\n.include "$CONFDIR/common.conf"\n.include(try=true; priority=1,duplicate=merge) "$LOCAL_CONFDIR/local.d/options.inc"'),
        'local.d': dir({
          'actions.conf': file(ACTIONS_CONF(n)),
          'redis.conf': file('# Bayes, greylisting and the history live in the local Redis.\nservers = "127.0.0.1";'),
          'classifier-bayes.conf': file('# Bayes in Redis; it classifies once each class has min_learns messages.\nbackend = "redis";\nautolearn = false;\nmin_learns = 200;'),
          'worker-proxy.inc': file('# The milter Postfix talks to (smtpd_milters = inet:localhost:11332).\nmilter = yes;\nbind_socket = "localhost:11332";\ntimeout = 120s;\nupstream "local" {\n  default = yes;\n  self_scan = yes;\n}'),
          'multimap.conf': file(MULTIMAP_CONF),
        }),
        'override.d': dir({}),
      }),
    }),
    home: dir({ you: d(o.home) }),
    root: dir({}, { owner: 'root', mode: 'rwx------' }),
    tmp: dir({}, { owner: 'root', mode: 'rwxrwxrwt' }),
    usr: dir({ local: dir({ bin: dir({ 'quota-warning.sh': file(QUOTA_SCRIPT, { owner: 'root', mode: 'rwxr-xr-x' }) }) }) }),
    var: dir({
      vmail: dir({ [DOMAIN]: dir(people, { ...vm, mode: 'rwx------' }) }, { ...vm, mode: 'rwx------' }),
      log: dir({
        'mail.log': f(o.log, { lines: true, owner: 'root', group: 'adm', mode: 'rw-r-----' }),
        rspamd: dir({ 'rspamd.log': f(o.rspamdLog ?? '', { lines: true, owner: '_rspamd', group: 'adm', mode: 'rw-r-----' }) }, { owner: '_rspamd', group: 'adm', mode: 'rwxr-x---' }),
      }),
      spool: dir({ postfix: dir({ private: dir({ 'dovecot-lmtp': f('', { owner: 'postfix', group: 'postfix', mode: 'rw-------' }) }, { owner: 'postfix', mode: 'rwx------' }) }) }),
    }),
  });
}

// ——— The log's past ———

/** mail.log lines in the past, like Postfix and Dovecot wrote them. */
export function pastLog(host: string, entries: [number, string, number, string][]): string {
  return entries.map(([time, program, pid, text]) => `${logTime(time)} ${host} ${program}[${pid}]: ${text}`).join('\n');
}

// ——— Starting a chapter ———

export function initialiseStory(j: Game, n: ChapterNo) {
  const family: Record<string, string> = {};
  const p = j as Shell;
  p.state.lifeboat = { chapter: n, ticks: 0, pending: [], outcomes: [], family } satisfies Story;
  loadPostfix(p);
  attachDovecot(p);
  attachRspamd(p);
  systemd(p)!.services.dovecot.load!(p);
  systemd(p)!.services.rspamd.load!(p);
  if (n === 1) {
    const s = story(p);
    const u = mailUser(p, 'saoirse');
    s.start = { INBOX: countIn(p, u, 'INBOX'), Sent: countIn(p, u, 'Sent') };
  }
}
const countIn = (j: Game, u: MailUser, box: string) => {
  const n = j.find(box === 'INBOX' ? `${u.home}/Maildir/cur` : `${u.home}/Maildir/.${box}/cur`);
  const m = j.find(box === 'INBOX' ? `${u.home}/Maildir/new` : `${u.home}/Maildir/.${box}/new`);
  return (n?.type === 'directory' ? Object.keys(n.children).length : 0) + (m?.type === 'directory' ? Object.keys(m.children).length : 0);
};
export { countIn };

// ——— Time passing: the mail keeps arriving ———

export type Arrival = (j: Game, tick: number, now: number) => { kind: string; m: Incoming }[];

/** Each command: a minute or two pass, the mail of that time arrives (and what greylisting deferred comes back). */
export function passTime(j: Game, arrivals: Arrival) {
  const p = j as Shell;
  const st = story(p);
  const sd = systemd(p)!;
  sd.clock += STEP[st.chapter];
  st.ticks++;
  const now = sd.clock;
  const due = st.pending.filter((x) => x.due <= now);
  st.pending = st.pending.filter((x) => x.due > now);
  const all = [...due.map((x) => ({ kind: 'retry', m: x.m })), ...arrivals(p, st.ticks, now)];
  for (const a of all) {
    const id = (a.m.mail.headers.find(([k]) => k === 'Message-ID')?.[1] ?? '').replace(/^<|>$/g, '');
    if (a.kind !== 'retry') st.family[id] = a.kind;
    const outcome = receive(p, a.m);
    st.outcomes.push({ tick: st.ticks, kind: st.family[id] ?? a.kind, to: a.m.rcpt[0], outcome });
    if (outcome.status === 'deferred' || outcome.status === 'down') st.pending.push({ due: now + 6 * MIN, m: a.m });
  }
  if (st.outcomes.length > 400) st.outcomes.splice(0, st.outcomes.length - 400);
}

/** A message's family from its id (the senders' software names them its own way). */
export function classify(id: string): string {
  if (/@mail\.example$/.test(id)) return 'ham';
  if (/@coastfed\.example$/.test(id)) return 'list';
  if (/^[0-9A-Z]+\.\d+@sendwave\.example$/.test(id)) return 'newsletter';
  if (/@sendwave\.example$/.test(id)) return 'prize';
  if (/@vps\d+\.cloud\.example$/.test(id)) return 'spam';
  return 'other';
}
export const familyOf = (j: Game, m: Mail) => {
  const id = (m.headers.find(([k]) => k.toLowerCase() === 'message-id')?.[1] ?? '').replace(/^<|>$/g, '');
  return story(j).family[id] ?? classify(id);
};
export { parseMail, dovecot, rspamd };
