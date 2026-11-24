// The Choir: personal data and its retention on a choir's server. Each
// chapter is replayed to the end from the workstation (ssh baton), with
// another solution and false leads, in each language; the expected texts
// are checked in French. Also: the engine pieces the story extended
// (logrotate's maxage, nginx's map and log_format, journald's
// MaxRetentionSec=, psql's WHERE and INSERT, restic's --keep-within).

import { describe, expect, it } from 'vitest';
import { Console } from '../src/engine/console';
import { STORIES } from '../src/engine/chapters';
import { prerequisites } from '../src/engine/unlocking';
import { translator } from '../src/texts';
import { inLanguage, machinesInLanguage, languagesFor } from './names';
import { where, values } from '../src/engine/sql-where';
import { timeSpan } from '../src/engine/journal-files';
import { readWithin } from '../src/engine/commands/restic';
import { Shell } from '../src/engine/shell';
import { ANONYMISE_CONF } from '../src/engine/chapters/choir';
import { explain } from '../src/engine/explainer';

const chapter = (id: string) => STORIES.flatMap((h) => h.chapters).find((c) => c.id === id)!;
const PASSWORD = 'choir-loft-31';
const NOW = Date.UTC(2031, 3, 7, 9, 30, 0);

describe('The Choir: the engine pieces it extended', () => {
  it('reads a WHERE clause like PostgreSQL: comparisons, AND/OR, NULL, LIKE, IN, dates and intervals', () => {
    const cols = ['id', 'name', 'left_on'];
    const rows = [
      ['1', 'Gwen', '2027-06-30'],
      ['2', 'Ivan', '2029-06-30'],
      ['3', 'Priya', ''],
    ];
    const ids = (w: string) => where(cols, rows, w, NOW).map((r) => r[0]);
    expect(ids("left_on < current_date - interval '2 years'")).toEqual(['1']);
    expect(ids("left_on < now() - interval '2 years'")).toEqual(['1']);
    expect(ids("left_on < DATE '2030-01-01'")).toEqual(['1', '2']);
    expect(ids("left_on < '2030-01-01'::date")).toEqual(['1', '2']);
    expect(ids('left_on IS NULL')).toEqual(['3']);
    expect(ids("left_on IS NOT NULL AND name LIKE 'I%'")).toEqual(['2']);
    expect(ids("name ILIKE 'priya' OR id = 1")).toEqual(['1', '3']);
    expect(ids('id IN (1, 3)')).toEqual(['1', '3']);
    expect(ids('NOT (id >= 2)')).toEqual(['1']);
    expect(() => ids('nom = 1')).toThrow('column "nom" does not exist');
    expect(() => ids('id = ')).toThrow('syntax error at end of input');
    expect(values("41, 'Tomas', NULL, current_date", NOW)).toEqual(['41', 'Tomas', '', '2031-04-07']);
  });

  it('reads systemd time spans and restic durations', () => {
    expect(timeSpan('30day')).toBe(30 * 86_400_000);
    expect(timeSpan('1month')).toBe(2_629_800_000);
    expect(timeSpan('4w 2d')).toBe(30 * 86_400_000);
    expect(timeSpan('86400')).toBe(86_400_000);
    expect(timeSpan('30 jours')).toBeNull();
    expect(readWithin('1y6m')).toEqual({ y: 1, m: 6, d: 0, h: 0 });
    expect(readWithin('3x')).toBeNull();
  });

  it('nginx: map and log_format checked like nginx -t, the log written in the format', () => {
    const s = new Shell(chapter('kept-forever'), 'en');
    s.who = 'root';
    s.execute(`nginx -t`);
    expect(s.last.errors.join('\n') + s.last.output).toContain('test is successful');
    const write = (text: string) => {
      const n = s.find('/etc/nginx/conf.d') as { children: Record<string, unknown> };
      n.children['anonymise.conf'] = { type: 'file', content: text, lines: true, owner: 'root' };
    };
    write(ANONYMISE_CONF.replace('$ip.0', '$ipx.0'));
    s.execute('nginx -t');
    expect(s.last.errors.join('\n')).toContain('[emerg]');
    expect(s.last.errors.join('\n')).toContain('unknown "ipx" variable in /etc/nginx/conf.d/anonymise.conf:2');
    write(ANONYMISE_CONF.replace("log_format anonymised '", "log_format combined '"));
    s.execute('nginx -t');
    expect(s.last.errors.join('\n')).toContain('duplicate "log_format" name "combined" in /etc/nginx/conf.d/anonymise.conf:8');
    write(ANONYMISE_CONF.replace('default                     0.0.0.0;', 'default 0.0.0.0 x;'));
    s.execute('nginx -t');
    expect(s.last.errors.join('\n')).toContain('invalid number of the map parameters in /etc/nginx/conf.d/anonymise.conf:5');
  });
});

for (const language of languagesFor('choir'))
  describe(`The Choir — ${language}`, () => {
    const fr = language === 'fr';
    const t = translator(language);
    // SQL between double quotes keeps its English table names (members is also a translated place name).
    const L = (line: string) =>
      line
        .split(/("[^"]*")/)
        .map((part) => (part.startsWith('"') ? part : inLanguage(t, machinesInLanguage(t, part))))
        .join('');
    const contains = (all: string, text: string) => fr && expect(all).toContain(text);

    function play(finished: string[]) {
      const c = new Console({ language, finished: [...STORIES[0].chapters.map((x) => x.id), ...prerequisites('choir'), ...finished] });
      const one = (l: string) => {
        const o = c.execute(L(l));
        let out = typeof o === 'string' ? o : '';
        if (c.shell.waiting) {
          const p = c.execute(machinesInLanguage(t, inLanguage(t, PASSWORD)));
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
      run('ssh baton', 'yes');
      return { c, run, edit, everything: () => log.join('\n'), finished: () => c.remote!.shell.finished, shell: () => c.remote!.shell };
    }

    // ——— Chapter 1: Kept Forever ———

    const anonymised = (x: string) => x.replace('access_log /var/log/nginx/access.log;', 'access_log /var/log/nginx/access.log anonymised;');

    it('chapter 1 — solution: the policy, logrotate to thirty days, the old archives removed, addresses truncated, the journal', () => {
      const { run, edit, finished, everything, shell } = play([]);
      let all = run('cat message_from_amara.txt', 'cat /srv/choir/docs/retention-policy.txt');
      contains(all, 'Voilà la promesse du bureau');
      all = run('ls /var/log/nginx | wc -l', 'cat /etc/logrotate.d/nginx', 'ls /var/log/nginx');
      expect(all).toContain('rotate 520');
      contains(all, 'semaines de journaux d\'accès');
      all = edit('sudo nano /etc/logrotate.d/nginx', (x) => x.replace('weekly', 'daily').replace('rotate 520', 'rotate 30'));
      contains(all, 'ne garde plus que trente jours');
      all = run('sudo logrotate -v -f /etc/logrotate.d/nginx');
      expect(all).toContain('rotating log /var/log/nginx/access.log, log->rotateCount is 30');
      contains(all, 'anciennes archives sont toujours là');
      all = run('find /var/log/nginx -name "access.log.*" -mtime +30 | wc -l', 'sudo find /var/log/nginx -name "access.log.*" -mtime +30 -delete', 'ls /var/log/nginx');
      contains(all, 'Plus rien de plus de trente jours');
      expect(all).toContain('access.log.2.gz');
      all = run('sudo tail -n 2 /var/log/nginx/access.log');
      expect(all).toMatch(/^(203\.0\.113|198\.51\.100)\.\d*[1-9] - - \[/m);
      run('sudo touch /etc/nginx/conf.d/anonymise.conf');
      edit('sudo nano /etc/nginx/conf.d/anonymise.conf', () => ANONYMISE_CONF);
      edit('sudo nano /etc/nginx/nginx.conf', anonymised);
      all = run('sudo nginx -t', 'sudo systemctl reload nginx', 'cat /etc/hostname', 'sudo tail -n 4 /var/log/nginx/access.log');
      expect(all).toContain('nginx: configuration file /etc/nginx/nginx.conf test is successful');
      expect(all).toMatch(/^(203\.0\.113\.0|198\.51\.100\.0|2001:db8::) - - \[/m);
      expect(all).not.toMatch(/^203\.0\.113\.\d*[1-9] /m);
      contains(all, 'adresse tronquée');
      all = run('journalctl --disk-usage');
      expect(all).toMatch(/Archived and active journals take up [\d.]+G in the file system\./);
      edit('sudo nano /etc/systemd/journald.conf', (x) => x.replace('#MaxRetentionSec=0', 'MaxRetentionSec=30day'));
      all = run('sudo systemctl restart systemd-journald', 'journalctl --disk-usage');
      contains(all, 'journald garde maintenant trente jours');
      expect(finished()).toBe(true);
      expect(shell().find('/var/log/choir/audit.log.11.gz')).not.toBeNull();
      contains(everything(), 'Vous avez terminé Gardé pour toujours.');
    });

    it('chapter 1 — false leads: today\'s log only, a blanket find, access_log off, IPv6 kept whole, a vacuum only; another solution: maxage', () => {
      const { run, edit, finished, shell } = play([]);
      let all = run('sudo rm /var/log/nginx/access.log');
      contains(all, 'le problème n\'a jamais été le fichier du jour');
      // logrotate's maxage: archives older than 30 days among the first 31 go, the ones beyond stay.
      edit('sudo nano /etc/logrotate.d/nginx', (x) => x.replace('weekly', 'daily').replace('rotate 520', 'rotate 30\n\tmaxage 30'));
      all = run('sudo logrotate -v -f /etc/logrotate.d/nginx');
      expect(all).toContain('removing old log /var/log/nginx/access.log.6.gz');
      expect(shell().find('/var/log/nginx/access.log.40.gz')).not.toBeNull();
      run('sudo find /var/log/nginx -mtime +30 -delete');
      // access_log off, then a map that keeps IPv6 addresses whole.
      edit('sudo nano /etc/nginx/nginx.conf', (x) => x.replace('access_log /var/log/nginx/access.log;', 'access_log off;'));
      all = run('sudo systemctl reload nginx');
      contains(all, 'access_log off');
      run('sudo touch /etc/nginx/conf.d/anonymise.conf');
      edit('sudo nano /etc/nginx/conf.d/anonymise.conf', () => ANONYMISE_CONF.replace('default                     0.0.0.0;', 'default $remote_addr;').replace(/^.*\[\^:\].*$/m, ''));
      edit('sudo nano /etc/nginx/nginx.conf', (x) => x.replace('access_log off;', 'access_log /var/log/nginx/access.log anonymised;'));
      all = run('sudo systemctl reload nginx');
      contains(all, 'gardent leur adresse complète');
      edit('sudo nano /etc/nginx/conf.d/anonymise.conf', () => ANONYMISE_CONF);
      run('sudo systemctl reload nginx');
      all = run('sudo journalctl --vacuum-time=30d');
      contains(all, 'rien ne dit à journald');
      expect(finished()).toBe(false);
      edit('sudo nano /etc/systemd/journald.conf', (x) => x.replace('#MaxRetentionSec=0', 'MaxRetentionSec=1month'));
      run('journalctl --disk-usage');
      expect(finished()).toBe(false);
      all = run('sudo systemctl restart systemd-journald');
      expect(finished()).toBe(true);
    });

    it('chapter 1 — false lead: every log older than 30 days, the audit log included', () => {
      const { run, finished } = play([]);
      const all = run('sudo find /var/log -name "*.gz" -mtime +30 -delete');
      contains(all, 'que la politique demande de garder');
      expect(finished()).toBe(false);
    });

    // ——— Chapter 2: The Access Request ———

    const R = '/srv/choir/gdpr-requests/priya-raman';
    const sql = (q: string, to: string, csv = false) => `sudo -u postgres psql choir${csv ? ' --csv' : ''} -c "${q}" > ${R}/${to}`;

    it('chapter 2 — solution: the tables, the uploads, the logs (one gzipped), the forgotten export', () => {
      const { run, finished, everything } = play(['kept-forever']);
      let all = run('cat request_from_priya.txt', "sudo -u postgres psql choir -c '\\dt'", "sudo -u postgres psql choir -c \"SELECT * FROM members WHERE last_name = 'Raman'\"");
      expect(all).toContain('priya.raman@mail.example');
      contains(all, 'Voilà sa fiche');
      all = run(`mkdir -p ${R}`, sql('SELECT * FROM members WHERE id = 27', 'member.txt'), sql('SELECT * FROM attendance WHERE member_id = 27', 'attendance.txt'), sql('SELECT * FROM payments WHERE member_id = 27', 'payments.csv', true), `cat ${R}/payments.csv`);
      expect(all).toContain('SUB-2030-027');
      contains(all, 'Ses répétitions et ses cotisations');
      run(sql("SELECT * FROM newsletter WHERE email = 'priya.raman@mail.example'", 'newsletter.txt'));
      all = run('sudo ls /srv/choir/uploads/27', `sudo cp /srv/choir/uploads/27/photo.jpg /srv/choir/uploads/27/consent-form.pdf ${R}/`);
      contains(all, 'Sa photo et son formulaire');
      all = run('grep -rl priya.raman /var/log', `grep priya.raman@mail.example /var/log/choir/audit.log > ${R}/audit.txt`, `zgrep priya.raman@mail.example /var/log/choir/audit.log.1.gz >> ${R}/audit.txt`, `grep priya.raman@mail.example /var/log/mail.log > ${R}/mail.txt`);
      expect(all).toContain('/var/log/choir/audit.log');
      contains(all, 'Les journaux parlent d\'elle aussi');
      expect(finished()).toBe(false);
      all = run("sudo grep -r 'Priya Raman' /srv/choir", `sudo grep 'Priya Raman' /srv/choir/exports/phone-tree-2030-10.csv > ${R}/phone-tree.txt`);
      contains(all, 'Une copie oubliée');
      expect(finished()).toBe(true);
      contains(everything(), 'Vous avez terminé La Demande d\'accès.');
    });

    it('chapter 2 — false leads: the members table only, a whole dump copied; another solution: one file', () => {
      const { run, finished } = play(['kept-forever']);
      let all = run(`mkdir ${R}`, sql('SELECT * FROM members WHERE id = 27', 'member.txt'));
      contains(all, 'La table des choristes est un endroit parmi d\'autres');
      all = run(`sudo cp /var/backups/choir.sql ${R}/`);
      contains(all, 'violation de données');
      run(`sudo rm ${R}/choir.sql`);
      // Everything in one file, appended.
      const F = `${R}/member.txt`;
      all = run(
        `sudo -u postgres psql choir -A -c "SELECT * FROM attendance WHERE member_id = 27" >> ${F}`,
        `sudo -u postgres psql choir -A -c "SELECT * FROM payments WHERE member_id = 27" >> ${F}`,
        `sudo -u postgres psql choir -A -t -c "SELECT * FROM newsletter WHERE email = 'priya.raman@mail.example'" >> ${F}`,
        `sudo cp /srv/choir/uploads/27/photo.jpg ${R}/`,
        `grep -h priya.raman@mail.example /var/log/choir/audit.log /var/log/mail.log >> ${F}`,
      );
      contains(all, 'Il manque encore');
      run(`sudo cp /srv/choir/uploads/27/consent-form.pdf ${R}/`, `zgrep priya.raman@mail.example /var/log/choir/audit.log.1.gz >> ${F}`, `sudo grep 'Priya Raman' /srv/choir/exports/phone-tree-2030-10.csv >> ${F}`);
      expect(finished()).toBe(true);
    });

    // ——— Chapter 3: Forget Me ———

    const RESTIC = 'sudo restic -r /var/backups/restic --password-file /root/.restic-pass';
    const purgeService = (x: string) => x.replace('User=www-data', 'User=postgres');
    const attendance = (x: string) => `${x}\npsql choir -c "DELETE FROM attendance WHERE rehearsed_on < current_date - interval '2 years'"`;

    it('chapter 3 — solution: Tomas erased but his payments kept, the purge fixed and scheduled, the backups ageing out', () => {
      const { run, edit, finished, everything } = play(['kept-forever', 'access-request']);
      let all = run('cat message_from_tomas.txt', "sudo -u postgres psql choir -c \"SELECT * FROM members WHERE last_name = 'Novak'\"", 'sudo -u postgres psql choir -c "SELECT * FROM payments WHERE member_id = 41"');
      expect(all).toContain('SUB-2029-041');
      contains(all, 'Voilà Tomas, choriste 41');
      all = run("sudo -u postgres psql choir -c \"DELETE FROM attendance WHERE member_id = 41; DELETE FROM newsletter WHERE email = 'tomas.novak@mail.example'; DELETE FROM members WHERE id = 41\"");
      expect(all).toContain('DELETE 1');
      contains(all, 'ses cotisations restent dans les livres');
      all = run('sudo rm /srv/choir/uploads/41/photo.jpg /srv/choir/uploads/41/consent-form.pdf', 'sudo rmdir /srv/choir/uploads/41');
      contains(all, 'ont disparu des fichiers');
      all = run('systemctl list-timers --all', 'sudo systemctl start choir-purge.service', 'sudo journalctl -u choir-purge');
      expect(all).toContain('FATAL:  role "www-data" does not exist');
      contains(all, 'La purge de Ruben n\'a jamais tourné');
      edit('sudo nano /etc/systemd/system/choir-purge.service', purgeService);
      all = run('sudo systemctl daemon-reload', 'sudo systemctl enable --now choir-purge.timer');
      contains(all, 'fait la moitié du travail');
      all = edit('sudo nano /usr/local/sbin/choir-purge', attendance);
      all += run('sudo systemctl start choir-purge.service', 'sudo journalctl -u choir-purge -n 4');
      expect(all).toContain('DELETE 3');
      contains(all, 'Cette nuit, et chaque nuit');
      all = run('sudo cat /usr/local/sbin/choir-backup', `${RESTIC} snapshots`);
      expect(all).toContain('84 snapshots');
      contains(all, '84 instantanés hebdomadaires');
      all = run(`${RESTIC} forget --keep-daily 7 --keep-weekly 4 --keep-monthly 3 --dry-run`, `${RESTIC} forget --keep-daily 7 --keep-weekly 4 --keep-monthly 3 --prune`);
      expect(all).toContain('Would have removed the snapshots above (dry run).');
      contains(all, 'environ trois mois de sauvegardes');
      expect(finished()).toBe(false);
      all = edit('sudo nano /usr/local/sbin/choir-backup', (x) => x.replace('restic backup /var/backups/choir.sql /srv/choir/uploads', 'restic backup /var/backups/choir.sql /srv/choir/uploads\nrestic forget --keep-daily 7 --keep-weekly 4 --keep-monthly 3 --prune'));
      expect(finished()).toBe(true);
      contains(everything(), 'Vous avez terminé Oubliez-moi.');
    });

    it('chapter 3 — false leads: the payments deleted (and put back), a purge that deletes too much, forget without prune; another solution: --keep-within', () => {
      const { run, edit, finished } = play(['kept-forever', 'access-request']);
      let all = run('sudo -u postgres psql choir -c "DELETE FROM payments WHERE member_id = 41"');
      contains(all, 'ce sont les pièces comptables');
      all = run('sudo grep SUB-20..-041 /var/backups/choir.sql');
      const rows = all.split('\n').filter((l) => /SUB-20\d\d-041$/.test(l));
      expect(rows.length).toBe(2);
      run(`sudo -u postgres psql choir -c "INSERT INTO payments VALUES ${rows.map((r) => `(${r.split('\t').map((v, i) => (i < 2 ? v : `'${v}'`)).join(', ')})`).join(', ')}"`);
      all = run("sudo -u postgres psql choir -c \"DELETE FROM attendance WHERE member_id = 41; DELETE FROM newsletter WHERE email = 'tomas.novak@mail.example'; DELETE FROM members WHERE id = 41\"");
      contains(all, 'ses cotisations restent dans les livres');
      run('sudo rm /srv/choir/uploads/41/photo.jpg /srv/choir/uploads/41/consent-form.pdf', 'sudo rmdir /srv/choir/uploads/41');
      // A purge that deletes by the joining date: everybody who joined more than two years ago.
      edit('sudo nano /etc/systemd/system/choir-purge.service', purgeService);
      edit('sudo nano /usr/local/sbin/choir-purge', (x) => attendance(x).replace('left_on <', 'joined_on <'));
      all = run('sudo systemctl daemon-reload', 'sudo systemctl enable --now choir-purge.timer');
      contains(all, 'supprimerait des données que la politique garde');
      all = edit('sudo nano /usr/local/sbin/choir-purge', (x) => x.replace('joined_on <', 'left_on <'));
      all += run('systemctl list-timers');
      contains(all, 'Cette nuit, et chaque nuit');
      all = run(`${RESTIC} forget --keep-within 3m`);
      contains(all, 'prune supprime les données');
      run(`${RESTIC} prune`);
      edit('sudo nano /usr/local/sbin/choir-backup', (x) => `${x}\nrestic forget --keep-within 3m --prune`);
      expect(finished()).toBe(true);
    });

    it('chapter 3 — false lead: keeping a single snapshot', () => {
      const { run, finished } = play(['kept-forever', 'access-request']);
      const all = run(`${RESTIC} forget --keep-last 1 --prune`);
      contains(all, 'Il reste trop peu de sauvegardes');
      expect(finished()).toBe(false);
    });
  });

describe('The Choir: the error explainer', () => {
  // As the interface does (game.ts): the line failed, its own errors read rather than the output.
  function session(id: string, language: string) {
    const sh = new Shell(chapter(id), language);
    const t = translator(language);
    sh.who = 'root';
    const run = (line: string) => {
      const before = sh.commandsInError;
      const last = sh.last;
      const output = sh.execute(inLanguage(t, line)) ?? '';
      const failed = sh.commandsInError > before;
      const errors = sh.last !== last ? sh.last.errors.filter((e) => e && output.includes(e)) : null;
      return explain({ failed, output, errors }, t);
    };
    return run;
  }

  for (const language of languagesFor('choir'))
    it(`${language}: reading logs, the policy and the database explains nothing; real errors are explained`, () => {
      const run = session('kept-forever', language);
      for (const line of ['cat /srv/choir/docs/retention-policy.txt', 'tail /var/log/nginx/access.log', 'zcat /var/log/nginx/access.log.2.gz', 'cat /var/log/nginx/error.log', 'cat /etc/logrotate.d/nginx', 'logrotate -d /etc/logrotate.d/nginx', 'nginx -t', 'journalctl --disk-usage'])
        expect(run(line), line).toBeNull();
      const request = session('access-request', language);
      for (const line of ['grep -r priya.raman /var/log/choir', 'zgrep priya.raman /var/log/choir/audit.log.1.gz', 'grep priya /var/log/mail.log', 'cat /var/backups/choir.sql', 'su postgres -c "psql choir -c \'\\dt\'"'])
        expect(request(line), line).toBeNull();
      const forget = session('forget-me', language);
      expect(forget('systemctl start choir-purge.service')).toBe('unit-failed');
      expect(forget('cat /usr/local/sbin/choir-purge')).toBeNull();
      expect(forget('rm /srv/choir/uploads/41')).toBe('is-directory');
    });
});
