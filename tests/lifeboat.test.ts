// The Lifeboat: an inbound mail server (Postfix, Dovecot with Sieve,
// rspamd). Each chapter is replayed to the end from the workstation (ssh
// slipway), with another solution and false leads, in each language; the
// expected texts are checked in French. Also: the engine (Dovecot's
// configuration, the quota, Sieve, rspamd's UCL and scores) and the error
// explainer on its errors.

import { describe, expect, it } from 'vitest';
import { Console } from '../src/engine/console';
import { STORIES } from '../src/engine/chapters';
import { prerequisites } from '../src/engine/unlocking';
import { LANGUAGES, translator } from '../src/texts';
import { inLanguage, machinesInLanguage } from './names';
import { Shell } from '../src/engine/shell';
import { explain } from '../src/engine/explainer';
import { parseSize, readConf, quotaRoot, lookup, mailText } from '../src/engine/dovecot';
import { compile, execute } from '../src/engine/sieve';
import { readUcl, readConfig, scan, rspamd } from '../src/engine/rspamd';
import { spam, ham, newsletter, NOW, USER, DOMAIN } from '../src/engine/chapters/lifeboat';

const PASSWORD = 'storm-lantern-24';
const chapter = (id: string) => STORIES.flatMap((h) => h.chapters).find((c) => c.id === id)!;
const SAOIRSE = 'saoirse@lifeboat.example';
const QUOTA_CONF = '/etc/dovecot/conf.d/90-quota.conf';
const ACTIONS = '/etc/rspamd/local.d/actions.conf';
const MULTIMAP = '/etc/rspamd/local.d/multimap.conf';
const WARNING_COMMENTED = '  #quota_warning warn-90 {\n  #  quota_storage_percentage = 90\n  #  execute quota-warning {\n  #    args = 90 %{user}\n  #  }\n  #}';
const WARNING_ON = '  quota_warning warn-90 {\n    quota_storage_percentage = 90\n    execute quota-warning {\n      args = 90 %{user}\n    }\n  }';

describe('The Lifeboat: the engine', () => {
  it('reads sizes and Dovecot 2.4 configuration like doveconf', () => {
    expect(parseSize('1G')).toBe(1024 ** 3);
    expect(parseSize('500 M')).toBe(500 * 1024 ** 2);
    expect(parseSize('unlimited')).toBe(0);
    expect(parseSize('lots')).toBeNull();
    const sh = new Shell(chapter('mailbox-full'), 'en');
    expect(readConf(sh).error).toBeNull();
    const root = quotaRoot(sh, lookup(sh, SAOIRSE)!, readConf(sh).tree)!;
    expect(root).toMatchObject({ name: 'User quota', driver: 'maildir', limit: 1024 ** 3, grace: 10 * 1024 ** 2 });
    const n = sh.find(QUOTA_CONF) as { content: string };
    n.content = n.content.replace('quota_storage_size = 1G', 'quota_storag_size = 1G');
    expect(readConf(sh).error).toMatchObject({ file: QUOTA_CONF, message: 'Unknown setting: quota_storag_size' });
    n.content = n.content.replace('quota_storag_size = 1G', 'quota_storage_size = 1G').replace('protocol imap {', 'protocol imap {\n  mail_plugins {');
    expect(readConf(sh).error?.message).toBe("Missing '}'");
  });

  it('compiles and runs Sieve like Pigeonhole: errors with their line, vacation and its checks', () => {
    expect(compile('require "fileinto";\nfilein "x";', 'a').errors).toEqual(["a: line 2: error: unknown command 'filein' (only reported once at first occurrence)", 'a: error: validation failed']);
    expect(compile('fileinto "x";', 'b').errors[0]).toBe("b: line 1: error: unknown command 'fileinto' (only reported once at first occurrence)");
    expect(compile('require "fileinto"\nkeep;', 'c').errors[0]).toBe('c: line 1: error: the require command accepts no sub-tests, but tests are specified');
    expect(compile('require ["vacation"];\nvacation :adresses ["x@y"] "away";', 'd').errors[0]).toContain("unknown tagged argument ':adresses' for the vacation command");
    expect(compile('if true { keep; ', 'e').errors[1]).toBe('e: error: parse failed');
    const p = compile('require ["vacation"];\nvacation :days 3 :addresses ["treasurer@lifeboat.example"] "Away";', 'v').program!;
    const mail = (to: string, extra: [string, string][] = []) => ({ headers: [['From', 'a@mail.example'], ['To', to], ['Subject', 'Hi'], ...extra] as [string, string][], body: 'x' });
    const env = (dupes: Record<string, number> = {}) => ({ from: 'a@mail.example', to: 'aziz@lifeboat.example', user: 'aziz@lifeboat.example', now: 0, dupes });
    const sent = (r: ReturnType<typeof execute>) => r.actions.some((a) => a.type === 'vacation' && a.sent);
    expect(sent(execute(p, mail('aziz@lifeboat.example'), env()))).toBe(true);
    expect(sent(execute(p, mail('treasurer@lifeboat.example'), env()))).toBe(true);
    expect(sent(execute(p, mail('info@lifeboat.example'), env()))).toBe(false);
    expect(sent(execute(p, mail('aziz@lifeboat.example', [['List-Id', '<x.lists.example>']]), env()))).toBe(false);
    expect(sent(execute(p, mail('aziz@lifeboat.example', [['Auto-Submitted', 'auto-replied']]), env()))).toBe(false);
    const dupes = {};
    execute(p, mail('aziz@lifeboat.example'), env(dupes));
    expect(sent(execute(p, mail('aziz@lifeboat.example'), env(dupes)))).toBe(false);
    expect(execute(p, mail('aziz@lifeboat.example'), env()).keep).toBe(true);
  });

  it('reads UCL like rspamd, and local.d over the defaults', () => {
    expect(readUcl('reject = 15;\nadd_header = 6;\n# a comment\ngreylist = null;').value).toEqual({ reject: 15, add_header: 6, greylist: null });
    expect(readUcl('RULE {\n  type = "from";\n  map = ["a", "b"];\n}').value).toEqual({ RULE: { type: 'from', map: ['a', 'b'] } });
    expect(readUcl('reject = 15\nadd_header = 6;').error).toMatchObject({ line: 2, message: 'delimiter is missing' });
    const sh = new Shell(chapter('spam-tide'), 'en');
    expect(readConfig(sh).conf.actions).toMatchObject({ reject: 8, add_header: 12, greylist: 11 });
    expect(readConfig(sh).conf.minLearns).toBe(200);
  });

  it('scores the mail the same way in every language: each language learns its own words', () => {
    const verdicts = (language: (typeof LANGUAGES)[number], trained: boolean) => {
      const c = new Console({ language, finished: [...STORIES[0].chapters.map((x) => x.id), ...prerequisites('lifeboat'), 'mailbox-full'] });
      const t = translator(language);
      const run = (l: string) => {
        c.execute(machinesInLanguage(t, l));
        if (c.shell.waiting) c.execute(inLanguage(t, PASSWORD));
        if (c.shell.question) c.execute('yes');
      };
      run('ssh slipway');
      run('sudo nano /etc/rspamd/local.d/actions.conf');
      c.shell.saveEdition('reject = 15;\nadd_header = 6;\ngreylist = 4;');
      c.shell.quitEdition();
      run('sudo systemctl reload rspamd');
      const box = '/var/vmail/lifeboat.example/leilani/Maildir';
      if (trained) run(`sudo rspamc learn_spam ${box}/.Junk/cur > /dev/null`), run(`sudo rspamc learn_ham ${box}/.Archive/cur > /dev/null`);
      const sh = c.remote!.shell;
      const tr = sh.t as never;
      const refs = [spam(tr, 'p', USER('leilani'), NOW[2], 'phish'), spam(tr, 'i', USER('leilani'), NOW[2], 'invoice'), spam(tr, 'z', USER('leilani'), NOW[2], 'prize'), newsletter(tr, 'n', USER('leilani'), NOW[2]), ham(tr, 'b', `bookings@${DOMAIN}`, NOW[2]), ham(tr, 'c', USER('leilani'), NOW[2], 'crew')];
      expect(rspamd(sh)!.counts).toEqual(trained ? { spam: 214, ham: 236 } : { spam: 0, ham: 0 });
      return refs.map((x) => scan(sh, x.mail, { ip: x.ip, from: x.from, rcpt: x.rcpt }).action);
    };
    for (const trained of [false, true]) {
      const en = verdicts('en', trained);
      expect(en).toEqual(trained ? ['add header', 'add header', 'add header', 'add header', 'no action', 'no action'] : ['greylist', 'add header', 'add header', 'add header', 'no action', 'no action']);
      for (const language of LANGUAGES) expect(verdicts(language, trained), `${language}, trained: ${trained}`).toEqual(en);
    }
  });
});

for (const language of LANGUAGES)
  describe(`The Lifeboat — ${language}`, () => {
    const fr = language === 'fr';
    const t = translator(language);
    // The server's own commands name no translated place: only the player's files (cat, sieve-test…) are.
    const L = (line: string) => (line.startsWith('sudo ') || line.startsWith('rspamc ') ? machinesInLanguage(t, line) : inLanguage(t, machinesInLanguage(t, line)));
    const contains = (all: string, text: string) => fr && expect(all).toContain(text);

    function play(finished: string[]) {
      const c = new Console({ language, finished: [...STORIES[0].chapters.map((x) => x.id), ...prerequisites('lifeboat'), ...finished] });
      const one = (l: string) => {
        const o = c.execute(L(l));
        let out = typeof o === 'string' ? o : '';
        if (c.shell.waiting) {
          const p = c.execute(machinesInLanguage(t, inLanguage(t, PASSWORD)));
          out += '\n' + (typeof p === 'string' ? p : '');
        }
        if (c.shell.question && /continue connecting/.test(c.shell.question.prompt)) {
          const p = c.execute('yes');
          out += '\n' + (typeof p === 'string' ? p : '');
        }
        return out;
      };
      const log: string[] = [];
      const run = (...lines: string[]) => {
        const out = lines.map(one).join('\n');
        log.push(out);
        return out;
      };
      const edit = (command: string, change: (text: string) => string) => {
        const before = one(command);
        c.shell.saveEdition(change(c.shell.edition!.text));
        const out = `${before}\n${c.shell.quitEdition() ?? ''}`;
        log.push(out);
        return out;
      };
      run('ssh slipway');
      return { c, run, edit, everything: () => log.join('\n'), finished: () => c.remote!.shell.finished };
    }
    const wait = (run: (...l: string[]) => string, n: number) => run(...Array.from({ length: n }, () => 'sudo true'));

    // ——— Chapter 1: Mailbox Full ———

    it('chapter 1 — solution: the bounces, the quota, the old Trash expunged, 2G in the userdb, a warning', () => {
      const { run, edit, finished, everything } = play([]);
      let all = run('cat message_from_marisol.txt', 'cat note_from_yerlan.txt', `sudo grep ${SAOIRSE} /var/log/mail.log | tail -n 4`);
      expect(all).toContain('dsn=5.2.2, status=bounced');
      expect(all).toContain('Quota exceeded (mailbox for user is full)');
      contains(all, 'Le LMTP de Dovecot refuse');
      all = run(`sudo doveadm quota get -u ${SAOIRSE}`);
      expect(all).toMatch(/^Quota name Type\s+Value\s+Limit\s+%$/m);
      expect(all).toMatch(/^User quota STORAGE 10\d{5} 1048576 10\d$/m);
      contains(all, 'Elle dépasse 100 %');
      all = run(`sudo doveadm mailbox status -u ${SAOIRSE} "messages vsize" "*"`);
      expect(all).toMatch(/^Trash messages=134 vsize=\d{9}$/m);
      contains(all, 'Sa corbeille contient des centaines de mégaoctets');
      all = run(`sudo doveadm search -u ${SAOIRSE} mailbox Trash savedbefore 2031-01-01 | wc -l`, `sudo doveadm expunge -u ${SAOIRSE} mailbox Trash savedbefore 2031-01-01`, `sudo doveadm quota get -u ${SAOIRSE}`);
      expect(all).toMatch(/^128$/m);
      expect(all).toMatch(/^User quota STORAGE [45]\d{5} 1048576 [45]\d$/m);
      contains(all, 'La vieille corbeille est partie');
      wait(run, 2);
      all = edit('sudo nano /etc/dovecot/users', (x) => x.replace('/var/vmail/lifeboat.example/saoirse::', '/var/vmail/lifeboat.example/saoirse::userdb_quota_storage_size=2G'));
      all += run(`sudo doveadm user ${SAOIRSE}`, `sudo doveadm quota get -u ${SAOIRSE}`);
      expect(all).toMatch(/^ {2}quota_storage_size\s*: 2G$/m);
      expect(all).toMatch(/^User quota STORAGE \d+ 2097152 \d+$/m);
      contains(all, 'seulement la sienne');
      expect(finished()).toBe(false);
      edit(`sudo nano ${QUOTA_CONF}`, (x) => x.replace(WARNING_COMMENTED, WARNING_ON));
      all = run('sudo doveconf -n | grep -A4 quota_warning');
      expect(all).toContain('  quota_warning warn-90 {');
      expect(finished()).toBe(false);
      all = run('sudo doveadm reload', "sudo grep 'stored mail' /var/log/mail.log | tail -n 1");
      expect(all).toContain("stored mail into mailbox 'INBOX'");
      expect(finished()).toBe(true);
      contains(everything(), 'Tu as terminé Boîte pleine.');
    });

    it('chapter 1 — false leads: files removed by hand, an unlimited quota, a bad setting; another solution: recalc, systemctl reload', () => {
      const { run, edit, finished } = play([]);
      let all = run('sudo find /var/vmail/lifeboat.example/saoirse/Maildir/.Trash/cur -type f -delete', `sudo doveadm quota get -u ${SAOIRSE}`);
      expect(all).toMatch(/^User quota STORAGE 10\d{5} 1048576 10\d$/m);
      contains(all, 'Dovecot ne remarque pas les fichiers enlevés');
      all = run(`sudo doveadm quota recalc -u ${SAOIRSE}`, `sudo doveadm quota get -u ${SAOIRSE}`);
      expect(all).toMatch(/^User quota STORAGE [45]\d{5} 1048576 [45]\d$/m);
      edit(`sudo nano ${QUOTA_CONF}`, (x) => x.replace('quota_storage_size = 1G', 'quota_storage_size = unlimited'));
      all = run('sudo systemctl reload dovecot');
      contains(all, "Quelqu'un n'a plus de quota du tout");
      // A misspelled setting: doveconf stops, the reload keeps the configuration Dovecot runs.
      edit(`sudo nano ${QUOTA_CONF}`, (x) => x.replace('quota_storage_size = unlimited', 'quota_storage_size = 1G\n  quota_storage_grase = 20M'));
      all = run('sudo doveconf -n', 'sudo doveadm reload');
      expect(all).toContain(`doveconf: Fatal: Error in configuration file ${QUOTA_CONF} line 22: Unknown setting: quota_storage_grase`);
      edit(`sudo nano ${QUOTA_CONF}`, (x) => x.replace('\n  quota_storage_grase = 20M', '').replace(WARNING_COMMENTED, '  quota_warning warn-80 {\n    storage_percentage = 80\n    execute quota-warning {\n      args = 80 %{user}\n    }\n  }'));
      edit('sudo nano /etc/dovecot/users', (x) => x.replace('/var/vmail/lifeboat.example/saoirse::', '/var/vmail/lifeboat.example/saoirse::userdb_quota_storage_size=2048M'));
      expect(finished()).toBe(false);
      run('sudo systemctl reload dovecot');
      wait(run, 2);
      expect(finished()).toBe(true);
    });

    it('chapter 1 — the whole Maildir deleted: her mail is lost', () => {
      const { run, finished } = play([]);
      const all = run('sudo find /var/vmail/lifeboat.example/saoirse/Maildir/cur -type f -delete', 'sudo doveadm mailbox status -u saoirse@lifeboat.example messages INBOX');
      contains(all, 'Sa boîte de réception a perdu des messages');
      expect(finished()).toBe(false);
    });

    // ——— Chapter 2: Spam Tide ———

    const DEFAULT_ACTIONS = (x: string) => x.replace('reject = 8;\nadd_header = 12;\ngreylist = 11;', 'reject = 15;\nadd_header = 6;\ngreylist = 4;');
    const WHITELIST = (x: string) => `${x}\n\nWHITELIST_COASTWATCH {\n  type = "from";\n  extract_from = "mime";\n  map = "/etc/rspamd/local.d/coastwatch.map";\n  score = -6.0;\n  description = "The Coastwatch safety bulletin";\n}`;
    const LEILANI = '/var/vmail/lifeboat.example/leilani/Maildir';

    it('chapter 2 — solution: the scores, the thresholds, the bulletin whitelisted, Bayes trained', () => {
      const { run, edit, finished, everything } = play(['mailbox-full']);
      let all = run('cat message_from_leilani.txt', 'cat note_from_yerlan.txt', 'sudo tail -n 20 /var/log/rspamd/rspamd.log');
      expect(all).toMatch(/rspamd_task_write_log: id: <[^>]+>, qid: <[0-9A-F]+>, ip: 203\.0\.113\.\d+, from: <[^>]+>, \(default: F \(no action\): \[4\.80\/8\.00\]/);
      expect(all).toMatch(/\(default: T \(reject\): \[8\.89\/8\.00\] \[.*R_SUSPICIOUS_URL\(5\.00\)/);
      contains(all, 'Le bulletin fait 8,89');
      all = run('sudo grep "bounces+cw-" /var/log/mail.log | grep -c milter-reject');
      expect(Number(/^\d+$/m.exec(all)?.[0])).toBeGreaterThan(0);
      edit(`sudo nano ${ACTIONS}`, DEFAULT_ACTIONS);
      all = run('sudo rspamadm configtest', 'sudo systemctl reload rspamd', 'sudo rspamadm configdump actions');
      expect(all).toContain('syntax OK');
      expect(all).toContain('    reject = 15.0;');
      contains(all, 'Les seuils sont de nouveau sensés');
      all = wait(run, 4);
      contains(all, 'Le dernier bulletin est allé dans le Junk de Leilani');
      all = run(`sudo ls ${LEILANI}/.Junk/new | wc -l`);
      expect(Number(/^\d+$/m.exec(all)?.[0])).toBeGreaterThan(0);
      all = run('echo news@coastwatch.example | sudo tee /etc/rspamd/local.d/coastwatch.map');
      edit(`sudo nano ${MULTIMAP}`, WHITELIST);
      all = run('sudo rspamadm configtest', 'sudo systemctl reload rspamd');
      contains(all, 'Le bulletin passe maintenant sans action');
      expect(finished()).toBe(false);
      all = run(`sudo rspamc learn_spam ${LEILANI}/.Junk/cur | tail -n 4`, `sudo rspamc learn_ham ${LEILANI}/.Archive/cur > /dev/null`, 'rspamc stat');
      expect(all).toMatch(/^success = true;$/m);
      expect(all).toContain('Statfile: BAYES_SPAM type: redis; length: 0; free blocks: 0; total blocks: 0; free: 0.00%; learned: 214; users: 1; languages: 0');
      expect(all).toMatch(/learned: 236;/);
      expect(finished()).toBe(true);
      contains(everything(), 'Tu as terminé Marée de spam.');
      // Learning the same messages again: rspamd says so.
      all = run(`sudo rspamc learn_ham ${LEILANI}/.Archive/cur | head -n 2`);
      expect(all).toMatch(/HTTP error: 208, <[^>]+> has been already learned as ham, ignore it/);
    });

    it('chapter 2 — false leads: the milter removed, reject at 1, the platform whitelisted, bookings learned as spam; another solution: settings', () => {
      const { run, edit, finished } = play(['mailbox-full']);
      let all = run('sudo postconf -e "smtpd_milters ="', 'sudo postfix reload');
      contains(all, 'Postfix ne demande plus rien à rspamd');
      run('sudo postconf -e "smtpd_milters = inet:localhost:11332"', 'sudo postfix reload');
      edit(`sudo nano ${ACTIONS}`, () => 'reject = 1;\nadd_header = 0.5;');
      all = run('sudo systemctl reload rspamd');
      contains(all, 'Avec un reject aussi bas');
      // A syntax error: configtest says where, the reload keeps the running configuration.
      edit(`sudo nano ${ACTIONS}`, () => 'reject = 15\nadd_header = 6;\ngreylist = 4;');
      all = run('sudo rspamadm configtest', 'sudo systemctl reload rspamd', 'sudo rspamadm configdump actions');
      expect(all).toContain("ucl parser error: error while parsing /etc/rspamd/local.d/actions.conf: line: 2, column: 1 - 'delimiter is missing'");
      expect(all).toContain('config file test failed');
      edit(`sudo nano ${ACTIONS}`, () => 'reject = 15;\nadd_header = 6;\ngreylist = 4;');
      run('sudo systemctl reload rspamd');
      all = run('echo sendwave.example | sudo tee /etc/rspamd/local.d/platform.map');
      edit(`sudo nano ${MULTIMAP}`, (x) => `${x}\nWHITELIST_PLATFORM {\n  type = "from";\n  filter = "email:domain";\n  map = "/etc/rspamd/local.d/platform.map";\n  score = -10.0;\n}`);
      all = run('sudo systemctl reload rspamd');
      contains(all, 'cette règle baisse aussi le score du spam');
      all = run(`sudo rspamc learn_spam ${LEILANI}/.Archive/cur > /dev/null`, `sudo rspamc learn_ham ${LEILANI}/.Junk/cur > /dev/null`);
      contains(all, 'rspamd vient d\'apprendre des réservations comme du spam');
      // Put things right: relearn both classes, replace the platform with a settings rule on the bulletin's From:.
      run(`sudo rspamc learn_ham ${LEILANI}/.Archive/cur > /dev/null`, `sudo rspamc learn_spam ${LEILANI}/.Junk/cur > /dev/null`);
      edit(`sudo nano ${MULTIMAP}`, (x) => x.replace(/\nWHITELIST_PLATFORM \{[\s\S]*?\n\}\n?/, '\n'));
      edit('sudo nano /etc/rspamd/local.d/settings.conf', () => 'coastwatch {\n  from_mime = "news@coastwatch.example";\n  apply {\n    actions {\n      reject = null;\n      "add header" = null;\n      greylist = null;\n    }\n  }\n}');
      expect(finished()).toBe(false);
      all = run('sudo rspamadm configtest', 'sudo systemctl reload rspamd');
      expect(all).toContain('syntax OK');
      expect(finished()).toBe(true);
    });

    // ——— Chapter 3: The Sorting Office ———

    const SORTING = 'require ["fileinto", "mailbox", "envelope"];\\nif envelope :is "to" "bookings@lifeboat.example" {\\n  fileinto :create "Bookings";\\n}\\n';
    const AWAY = (addresses: boolean) =>
      `require ["vacation"];\\nvacation :days 7 ${addresses ? ':addresses ["treasurer@lifeboat.example"] ' : ''}:subject "Away until 24 November" "I am away until 24 November. For anything urgent, write to marisol@lifeboat.example.";\\n`;

    it('chapter 3 — solution: a sorting script and a vacation, checked, activated, seen at work', () => {
      const { run, finished, everything } = play(['mailbox-full', 'spam-tide']);
      let all = run('cat message_from_marisol.txt', 'cat note_from_yerlan.txt', 'sudo doveadm sieve list -u aziz@lifeboat.example', 'sudo cat /var/vmail/lifeboat.example/aziz/sieve/holiday.sieve');
      expect(all).toMatch(/^holiday$/m);
      contains(all, 'reject ne répond pas en gardant le message');
      all = run("printf 'require [\"fileinto\"]\\nif header :contains \"to\" \"bookings\" { filein \"Bookings\"; }\\n' > broken.sieve", 'sievec broken.sieve; echo "exit $?"');
      expect(all).toContain('broken: line 1: error: the require command accepts no sub-tests, but tests are specified');
      expect(all).toContain('exit 1');
      contains(all, 'Le compilateur s\'est arrêté à la ligne qu\'il donne');
      all = run(`printf '${SORTING}' > sorting.sieve`, 'sievec sorting.sieve', 'sieve-test sorting.sieve sample-booking.eml');
      expect(all).toContain('Performed actions:\n\n * store message in folder: Bookings\n\nImplicit keep:\n\n  (none)\n\ninfo: final result: success');
      all = run('sudo doveadm sieve put -a -u leilani@lifeboat.example sorting < sorting.sieve', 'sudo doveadm sieve list -u leilani@lifeboat.example');
      expect(all).toMatch(/^sorting ACTIVE$/m);
      contains(all, 'Le script de Leilani range un message pour bookings@ dans Bookings');
      all = run(`printf '${AWAY(false)}' > away.sieve`, 'sieve-test away.sieve sample-list.eml', 'sudo doveadm sieve put -a -u aziz@lifeboat.example away < away.sieve');
      expect(all).toContain(' * send vacation message:\n    => seconds : 604800\n    => subject : Away until 24 November');
      contains(all, 'mais pas à un message envoyé à treasurer@');
      all = wait(run, 5);
      all += run('sudo grep Bookings /var/log/mail.log | tail -n 2', 'sudo grep "vacation response" /var/log/mail.log | tail -n 4');
      expect(all).toContain("fileinto action: stored mail into mailbox 'Bookings'");
      expect(all).toMatch(/sieve: msgid=<[^>]+>: sent vacation response to <[a-z.]+@mail\.example>/);
      expect(all).toContain('discarding vacation response for implicitly delivered message; no known (envelope) recipient address found in message headers (recipient=<aziz@lifeboat.example>');
      expect(all).toContain('discarding vacation response to mailinglist recipient <stations-bounces@lists.coastfed.example>');
      expect(finished()).toBe(false);
      all = run(`printf '${AWAY(true)}' > away.sieve`, 'sudo doveadm sieve put -a -u aziz@lifeboat.example away < away.sieve');
      contains(all, 'Sa réponse couvre aussi treasurer@');
      expect(finished()).toBe(true);
      contains(everything(), 'Tu as terminé Le Centre de tri.');
    });

    it('chapter 3 — false leads: the old reject script, a script not active; another solution: a folder created, a link, header tests', () => {
      const { run, edit, finished } = play(['mailbox-full', 'spam-tide']);
      let all = run('sudo doveadm sieve activate -u aziz@lifeboat.example holiday', 'sudo doveadm sieve list -u aziz@lifeboat.example');
      expect(all).toMatch(/^holiday ACTIVE$/m);
      all += wait(run, 5);
      contains(all, 'le refus a répondu à son expéditeur');
      all = run('sudo grep "rejected message" /var/log/mail.log | tail -n 1');
      expect(all).toMatch(/sieve: msgid=<[^>]+>: rejected message from <[^>]+> \(reject\)/);
      // Leilani: a script written in ~/sieve by hand, not active yet.
      const home = '/var/vmail/lifeboat.example/leilani';
      run(`sudo mkdir ${home}/sieve`);
      all = edit(`sudo nano ${home}/sieve/bookings.sieve`, () => 'require ["fileinto"];\n# Leilani: the bookings in their own folder\nif address :is ["to", "cc"] "bookings@lifeboat.example" {\n  fileinto "Bookings";\n  stop;\n}\n');
      all += run('sudo true');
      contains(all, "mais aucun message n'y passe");
      all = run('sudo doveadm mailbox create -u leilani@lifeboat.example Bookings', `sudo ln -s sieve/bookings.sieve ${home}/.dovecot.sieve`, 'sudo doveadm sieve list -u leilani@lifeboat.example');
      expect(all).toMatch(/^bookings ACTIVE$/m);
      // Aziz: a vacation with its alias, the old script deactivated by activating the new one.
      run(`printf '${AWAY(true)}' > away.sieve`, 'sieve-test -a treasurer@lifeboat.example -r aziz@lifeboat.example away.sieve sample-booking.eml', 'sudo doveadm sieve put -u aziz@lifeboat.example away < away.sieve', 'sudo doveadm sieve activate -u aziz@lifeboat.example away');
      expect(finished()).toBe(false);
      wait(run, 5);
      expect(finished()).toBe(true);
    });
  });

describe('The Lifeboat: the error explainer', () => {
  for (const language of LANGUAGES)
    it(`${language}: reading the mail server explains nothing; its errors are explained`, () => {
      const sh = new Shell(chapter('sorting-office'), language);
      const t = translator(language);
      const run = (line: string, who = 'root') => {
        sh.who = who;
        const before = sh.commandsInError;
        const last = sh.last;
        const output = sh.execute(line) ?? '';
        const failed = sh.commandsInError > before;
        const errors = sh.last !== last ? sh.last.errors.filter((e) => e && output.includes(e)) : null;
        return explain({ failed, output, errors }, t);
      };
      for (const line of ['doveadm quota get -u saoirse@lifeboat.example', 'doveconf -n', 'cat /var/log/mail.log', 'doveadm user saoirse@lifeboat.example']) expect(run(line), line).toBeNull();
      expect(run('doveadm quota get -u nobody@lifeboat.example')).toBe('mail-unknown-user');
      expect(run('doveadm search -u saoirse@lifeboat.example mailbox Trash savedbefore 1y')).toBe('search-query');
      run("printf 'filein \"x\";\\n' > /tmp/x.sieve");
      expect(run('sievec /tmp/x.sieve')).toBe('sieve-compile');
      const n = sh.find(QUOTA_CONF) as { content: string };
      n.content = n.content.replace('quota_storage_size = 1G', 'quota_storage_sise = 1G');
      expect(run('doveconf -n')).toBe('dovecot-config');
      void mailText;
    });
});
