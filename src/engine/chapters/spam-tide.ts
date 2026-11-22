// Story "The Lifeboat", chapter "Spam Tide": a flood of phishing ("your
// mailbox will be suspended"), fake invoices and prize spam reaches
// Leilani's INBOX, while the Coastwatch safety bulletin, which the crew
// reads before every launch, no longer arrives at all. Yerlan's actions.conf
// put reject at 8 and add_header at 12: the bulletin (8.89, sent through the
// same mailing platform as the prize spam) is rejected, the spam under 8 is
// let through untagged; Bayes has never been trained.
// The fix: read the scores (rspamc symbols, rspamd.log), thresholds back to
// sensible values (reject 15, add_header 6, greylist 4), the bulletin
// whitelisted on its own address (multimap from with extract_from = mime, or
// settings from_mime), not on the platform; Bayes trained with
// rspamc learn_spam on the Junk folder and learn_ham on the Archive.
// Objective checked on the state: Postfix sends incoming mail to rspamd's
// milter, rspamd runs with reject ≥ 12 and add_header between 4 and 8, Bayes
// has min_learns in each class, a fresh phishing, invoice and prize spam are
// marked as spam, a fresh bulletin and a fresh booking pass with no action,
// and no whitelist lowers a spam's score.
// False leads: the milter removed, reject at 1, whitelisting sendwave.example
// (its prize spam goes through too), learning the bookings as spam.
// Sources: https://docs.rspamd.com/configuration/metrics/,
// https://docs.rspamd.com/modules/multimap/, https://docs.rspamd.com/configuration/settings/,
// https://docs.rspamd.com/configuration/statistic/.

import type { Chapter } from '../world';
import { f } from '../world';
import type { Game } from '../shell';
import { systemd } from '../systemd';
import { milterOn } from '../inbound';
import { rspamd, rspamdRunning, scan, type RspamdConf, type Scan } from '../rspamd';
import { classify, DOMAIN, HOME, MIN, NOW, PASSWORD, USER, ham, initialiseStory, newsletter, passTime, seen, slipwayAccounts, slipwayState, slipwayWorld, spam, story, tr, type Arrival } from './lifeboat';
import type { Incoming } from '../inbound';

const conf = (j: Game) => rspamd(j)?.loaded ?? null;
const refs = (j: Game): Record<string, Incoming> => ({
  phish: spam(tr(j), 'ref-phish', USER('leilani'), NOW[2], 'phish'),
  invoice: spam(tr(j), 'ref-invoice', USER('leilani'), NOW[2], 'invoice'),
  prize: spam(tr(j), 'ref-prize', USER('leilani'), NOW[2], 'prize'),
  newsletter: newsletter(tr(j), 'ref-bulletin', USER('leilani'), NOW[2]),
  booking: ham(tr(j), 'ref-booking', `bookings@${DOMAIN}`, NOW[2]),
  crew: ham(tr(j), 'ref-crew', USER('leilani'), NOW[2], 'crew'),
});
const scanRef = (j: Game, x: Incoming, c: RspamdConf): Scan => scan(j, x.mail, { ip: x.ip, from: x.from, rcpt: x.rcpt }, c);
const verdicts = (j: Game) => {
  const c = conf(j);
  if (!c) return null;
  const r = refs(j);
  return Object.fromEntries(Object.entries(r).map(([k, x]) => [k, scanRef(j, x, c)])) as Record<string, Scan>;
};

const milter = (j: Game) => milterOn(j) && systemd(j)?.services.postfix?.state === 'active';
const thresholds = (j: Game) => {
  const a = conf(j)?.actions;
  if (!a) return false;
  const reject = a.reject ?? Infinity;
  const header = a.add_header;
  return reject >= 12 && typeof header === 'number' && header >= 4 && header <= 8 && (a.greylist === null || a.greylist === undefined || a.greylist <= header);
};
const rejectLow = (j: Game) => (conf(j)?.actions.reject ?? 15) <= 3;
const bayesOn = (j: Game) => {
  const st = rspamd(j);
  const c = conf(j);
  return !!st && !!c && st.counts.spam >= c.minLearns && st.counts.ham >= c.minLearns;
};
const spamCaught = (j: Game) => {
  const v = verdicts(j);
  return !!v && ['phish', 'invoice', 'prize'].every((k) => v[k].isSpam);
};
const hamOk = (j: Game) => {
  const v = verdicts(j);
  return !!v && v.booking.action === 'no action' && v.crew.action === 'no action';
};
const newsletterOk = (j: Game) => verdicts(j)?.newsletter.action === 'no action';
/** A whitelist that also lowers a spam's score: the same spam scanned without the local maps and settings scores higher. */
const leak = (j: Game) => {
  const c = conf(j);
  if (!c || (!c.multimap.length && !c.settings.length)) return false;
  const bare: RspamdConf = { ...c, multimap: c.multimap.filter((m) => m.score >= 0 && !m.action), settings: [] };
  const r = refs(j);
  return ['phish', 'invoice', 'prize'].some((k) => {
    const a = scanRef(j, r[k], c);
    const b = scanRef(j, r[k], bare);
    return a.score < b.score || (b.isSpam && !a.isSpam);
  });
};
const poisoned = (j: Game) => Object.entries(rspamd(j)?.learned ?? {}).filter(([id, cls]) => cls === 'spam' && classify(id.replace(/^<|>$/g, '')) === 'ham').length >= 10;
const bulletinInJunk = (j: Game) => story(j).outcomes.some((o) => o.kind === 'newsletter' && o.outcome.deliveries.some((d) => d.mailbox === 'Junk'));

const FAMILIES = ['phish', 'invoice', 'prize', 'phish', 'invoice'] as const;
const arrivals: Arrival = (j, tick, now) => {
  const t = tr(j);
  const out: { kind: string; m: Incoming }[] = [];
  const fam = FAMILIES[tick % FAMILIES.length];
  const to = tick % 3 ? USER('leilani') : tick % 2 ? USER('marisol') : `bookings@${DOMAIN}`;
  out.push({ kind: fam, m: spam(t, `tide${tick}`, to, now, fam) });
  if (tick % 4 === 0) out.push({ kind: 'newsletter', m: newsletter(t, `bulletin${tick}`, USER('leilani'), now) });
  else if (tick % 2) out.push({ kind: 'ham', m: ham(t, `tide-ham${tick}`, `bookings@${DOMAIN}`, now) });
  return out;
};

export const spamTide: Chapter = {
  id: 'spam-tide',
  number: 2,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'wc', 'sort', 'uniq', 'find', 'nano', 'sudo', 'systemctl', 'journalctl', 'postconf', 'postfix', 'doveadm', 'rspamc', 'rspamadm', 'exit'],
  home: HOME,
  welcome: 'message_from_leilani.txt',
  names: true,
  final: 'end',
  steps: ['scores', 'thresholds', 'bulletin-junk', 'whitelist', 'bayes', 'caught', 'end'],
  password: PASSWORD,
  accounts: slipwayAccounts,
  state: (t) => slipwayState(t, 2),
  initialise: (j) => {
    initialiseStory(j, 2);
    // The last fifty minutes of mail, as the server lived them (mail.log, rspamd.log, the INBOX).
    const sd = systemd(j)!;
    sd.clock = NOW[2] - 50 * MIN;
    for (let i = 0; i < 25; i++) passTime(j, arrivals);
    story(j).ticks = 0;
    story(j).outcomes = [];
    const st = rspamd(j)!;
    st.asked = { symbols: 0, learn: [] };
  },
  createWorld: (t) =>
    slipwayWorld(t, 2, {
      home: { 'message_from_leilani.txt': f(t('spam-tide-message-leilani')), 'note_from_yerlan.txt': f(t('spam-tide-note-yerlan')) },
      log: '',
    }),
  afterCommand: (j) => passTime(j, arrivals),
  events: [
    { id: 'scores', condition: (j) => seen(j, /^Action: |rspamd_task_write_log: /m), message: (j) => j.t('spam-tide-event-scores') },
    { id: 'milter-off', condition: (j) => !milter(j), message: (j) => j.t('spam-tide-event-milter-off') },
    { id: 'reject-low', condition: rejectLow, message: (j) => j.t('spam-tide-event-reject-low') },
    { id: 'thresholds', condition: thresholds, message: (j) => j.t('spam-tide-event-thresholds') },
    { id: 'bulletin-junk', condition: (j) => bulletinInJunk(j) && !newsletterOk(j), message: (j) => j.t('spam-tide-event-bulletin-junk') },
    { id: 'leak', condition: leak, message: (j) => j.t('spam-tide-event-leak') },
    { id: 'whitelist', condition: (j) => newsletterOk(j) && !leak(j), message: (j) => j.t('spam-tide-event-whitelist') },
    { id: 'poisoned', condition: poisoned, message: (j) => j.t('spam-tide-event-poisoned') },
    { id: 'bayes', condition: bayesOn, message: (j) => j.t('spam-tide-event-bayes') },
    { id: 'caught', condition: (j) => thresholds(j) && spamCaught(j), message: (j) => j.t('spam-tide-event-caught') },
    {
      id: 'end',
      condition: (j) => milter(j) && rspamdRunning(j) && thresholds(j) && bayesOn(j) && spamCaught(j) && hamOk(j) && newsletterOk(j) && !leak(j),
      message: (j) => j.t('spam-tide-event-end'),
    },
  ],
};
