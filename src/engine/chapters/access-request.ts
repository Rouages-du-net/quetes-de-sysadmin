// Story "The Choir", chapter "The Access Request": Priya Raman, an alto,
// asks for a copy of all the personal data the choir holds about her
// (GDPR article 15). Amara wants the answer ready in
// /srv/choir/gdpr-requests/priya-raman/. Her data is in many places: her row in
// the members table, but also the rehearsals she attended, her
// subscriptions, the newsletter, her photo and its consent form in the
// uploads, her lines in the members' area's security log (this month's and
// last month's, gzipped) and in the mail log, and a forgotten phone-tree
// export with her old address. The nightly dump holds the same data again
// (a backup: the answer says it exists and how long it is kept).
// Objective checked on the state: the files under the requests directory
// hold her member row, every rehearsal date, every subscription reference,
// her newsletter subscription, a copy of her photo and of her consent form,
// her audit and mail log lines, her phone-tree line; and nobody else's
// email or phone number.
// False leads: answering from the members table only; copying whole files
// (the dump, the whole log, the whole export) with other members' data.
// Sources: https://eur-lex.europa.eu/eli/reg/2016/679/oj (art. 12 and 15),
// https://www.postgresql.org/docs/16/app-psql.html, zgrep(1).

import type { Chapter, Directory, Node } from '../world';
import type { Game } from '../shell';
import { f, path } from '../world';
import {
  HOME, PASSWORD, PRIYA, REQUESTS, UPLOADS, choirAccounts, choirState, referenceTables, choirWorld, consentOf, initialiseChoir, member, members, passTime, phoneTree, photoOf, priyaAudit, priyaMail, seen, textOf, typed,
} from './choir';

// ——— What the export holds ———

/** The files under the requests directory: their path and text. */
function exported(j: Game): { path: string; text: string; raw: string }[] {
  const root = j.find(path(j.t, REQUESTS));
  if (root?.type !== 'directory') return [];
  const out: { path: string; text: string; raw: string }[] = [];
  const walk = (d: Directory, here: string) => {
    for (const [n, c] of Object.entries(d.children) as [string, Node][]) {
      if (c.type === 'directory') walk(c, `${here}/${n}`);
      else if (c.type === 'file' && !c.link && typeof c.content === 'string') out.push({ path: `${here}/${n}`, text: textOf(c), raw: c.content });
    }
  };
  walk(root, path(j.t, REQUESTS));
  return out;
}

export type Part = 'member' | 'attendance' | 'payments' | 'newsletter' | 'photo' | 'consent' | 'audit' | 'mail' | 'phone-tree';
export const PARTS: Part[] = ['member', 'attendance', 'payments', 'newsletter', 'photo', 'consent', 'audit', 'mail', 'phone-tree'];

interface Answer {
  has: Set<Part>;
  leak: boolean;
  empty: boolean;
}

/** What the export holds of Priya's data, and whether it holds anyone else's. */
export function answer(j: Game): Answer {
  const t = j.t;
  const files = exported(j);
  const all = files.map((x) => x.text).join('\n');
  const p = member(t, PRIYA, 2);
  const tables = referenceTables(t, 2);
  const mine = (table: string, col: number) => tables[table].lines.filter((l) => l[col] === PRIYA);
  const tree = phoneTree(t)
    .split('\n')
    .find((l) => l.includes(p.phone))!;
  const newsletter = tables.newsletter.lines.find((l) => l[1] === p.email)!;
  const has = new Set<Part>();
  if (all.includes(p.email) && all.includes(p.phone) && all.includes(p.address)) has.add('member');
  if (mine('attendance', 1).every((l) => all.includes(l[2]))) has.add('attendance');
  if (mine('payments', 1).every((l) => all.includes(l[6]))) has.add('payments');
  if (all.includes(newsletter[2])) has.add('newsletter');
  if (files.some((x) => x.raw === photoOf(PRIYA).content)) has.add('photo');
  if (files.some((x) => x.raw === consentOf(PRIYA).content)) has.add('consent');
  if (priyaAudit(t).every((l) => all.includes(l))) has.add('audit');
  if (priyaMail(t).every((l) => all.includes(l))) has.add('mail');
  if (all.includes(tree)) has.add('phone-tree');
  const others = members(t, 2).filter((m) => m.id !== PRIYA);
  const strangers = tables.newsletter.lines.map((l) => l[1]).filter((e) => e !== p.email);
  const leak = others.some((m) => all.includes(m.email) || all.includes(m.phone)) || strangers.some((e) => all.includes(e));
  return { has, leak, empty: files.length === 0 };
}

const complete = (a: Answer) => PARTS.every((x) => a.has.has(x));
const missing = (j: Game, a: Answer) => {
  const names = PARTS.filter((x) => !a.has.has(x)).map((x) => j.t(`access-request-part-${x}`));
  return new Intl.ListFormat(j.t('choir-list-locale'), { type: 'conjunction' }).format(names);
};
const looking = (j: Game) => /\b(ls|find|cat|less|tree|du|grep|head)\b.*(gdpr-requests|demandes-rgpd)/.test(typed(j)) || /\b(ls|find|du)\b/.test(typed(j)) && /priya-raman/.test(typed(j));

export const accessRequest: Chapter = {
  id: 'access-request',
  number: 2,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'zcat', 'zgrep', 'find', 'mkdir', 'cp', 'mv', 'rm', 'tee', 'echo', 'nano', 'sudo', 'psql', 'tar', 'exit'],
  home: HOME,
  welcome: 'message_from_amara.txt',
  names: true,
  final: 'end',
  steps: ['her-row', 'tables', 'uploads', 'logs', 'old-copy', 'end'],
  password: PASSWORD,
  accounts: choirAccounts,
  state: (t) => choirState(t, 2),
  initialise: (j) => initialiseChoir(j, 2),
  createWorld: (t) =>
    choirWorld(t, 2, {
      'message_from_amara.txt': f(t('access-request-message-amara')),
      'request_from_priya.txt': f(t('access-request-request-priya')),
    }),
  afterCommand: (j) => passTime(j),
  events: [
    {
      id: 'her-row',
      condition: (j) => {
        const p = member(j.t, PRIYA, 2);
        return seen(j, p.email) && seen(j, p.phone);
      },
      message: (j) => j.t('access-request-event-her-row'),
    },
    {
      id: 'tables',
      condition: (j) => referenceTables(j.t, 2).payments.lines.some((l) => l[1] === PRIYA && seen(j, l[6])) && seen(j, /\b\d{4}-\d{2}-\d{2}\b/),
      message: (j) => j.t('access-request-event-tables'),
    },
    { id: 'backups', condition: (j) => /\/var\/backups/.test(typed(j)) && seen(j, member(j.t, PRIYA, 2).email), message: (j) => j.t('access-request-event-backups') },
    { id: 'uploads', condition: (j) => seen(j, 'consent-form.pdf') && typed(j).includes(`${UPLOADS.split('/').at(-1)}/${PRIYA}`), message: (j) => j.t('access-request-event-uploads') },
    { id: 'logs', condition: (j) => [...priyaAudit(j.t), ...priyaMail(j.t)].some((l) => seen(j, l)), message: (j) => j.t('access-request-event-logs') },
    {
      id: 'old-copy',
      condition: (j) => {
        const p = member(j.t, PRIYA, 2);
        const line = phoneTree(j.t)
          .split('\n')
          .find((l) => l.includes(p.phone))!;
        return seen(j, line);
      },
      message: (j) => j.t('access-request-event-old-copy'),
    },
    {
      id: 'members-only',
      condition: (j) => {
        const a = answer(j);
        return a.has.has('member') && !a.has.has('attendance') && !a.has.has('payments') && !a.has.has('newsletter');
      },
      message: (j) => j.t('access-request-event-members-only'),
    },
    { id: 'leak', condition: (j) => answer(j).leak, message: (j) => j.t('access-request-event-leak') },
    {
      id: 'incomplete',
      condition: (j) => {
        const a = answer(j);
        return looking(j) && a.has.size >= 3 && !complete(a);
      },
      message: (j) => j.t('access-request-event-incomplete', { missing: missing(j, answer(j)) }),
    },
    {
      id: 'end',
      condition: (j) => {
        const a = answer(j);
        return complete(a) && !a.leak;
      },
      message: (j) => j.t('access-request-event-end'),
    },
  ],
};
