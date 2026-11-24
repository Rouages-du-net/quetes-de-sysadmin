// The Shelter: a disaster recovery plan made true, a rebuild on a spare
// machine from the backups, the switch, the review and the next drill.
// Each chapter is replayed from the workstation (ssh meadow), with another
// solution and false leads, in each language; the expected texts are
// checked in French. Also: the plan's reader, restic over sftp and its
// snapshots filters, the postgresql package.

import { describe, expect, it } from 'vitest';
import { Console } from '../src/engine/console';
import { STORIES } from '../src/engine/chapters';
import { prerequisites } from '../src/engine/unlocking';
import { translator } from '../src/texts';
import { inLanguage, machinesInLanguage, languagesFor } from './names';
import { machineName } from '../src/engine/machines';
import { duration, interval, planRows, serviceOf } from '../src/engine/chapters/shelter';

const BEFORE = [...new Set([...STORIES.find((h) => h.id === 'eraser')!.chapters.map((c) => c.id), ...prerequisites('shelter')])];
const PASSWORD = 'kibble-2031';
const ENVELOPE = 'lantern-thistle-otter-64';
const REPO = 'sftp:restic@meadow.internal:/srv/restic';

describe('The Shelter: the engine', () => {
  const t = translator('en');
  it('reads the plan\'s table, its durations and its services', () => {
    expect(duration('24h')).toBe(86_400_000);
    expect(duration('30 min')).toBe(1_800_000);
    expect(duration('2d')).toBe(172_800_000);
    expect(duration('1 w')).toBe(604_800_000);
    expect(duration('soon')).toBeNull();
    const rows = planRows(t, '| Owner | Service | RTO | RPO | Backup |\n|---|---|---|---|---|\n| Mirela | Vet records (vetlink) | 2d | 24h | restic |\n| you | Adoption app and database | 4h | 24h | pg_dump |');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ owner: 'Mirela', rpo: '24h', rto: '2d', backup: 'restic' });
    expect(rows.map(serviceOf)).toEqual(['vetlink', 'adoptions']);
    expect(serviceOf({ service: 'Newsletter (phpList)', rpo: '', rto: '', backup: '', owner: '', line: '' })).toBe('newsletter');
    expect(serviceOf({ service: 'Website (nginx)', rpo: '', rto: '', backup: '', owner: '', line: '' })).toBe('website');
    expect(interval('*-*-* 02:00:00', Date.UTC(2031, 10, 3, 9, 30))).toBe(86_400_000);
    expect(interval('hourly', Date.UTC(2031, 10, 3, 9, 30))).toBe(3_600_000);
  });
});

for (const language of languagesFor('shelter'))
  describe(`The Shelter — ${language}`, () => {
    const fr = language === 'fr';
    const t = translator(language);
    const L = (line: string) => inLanguage(t, machinesInLanguage(t, line));
    const contains = (all: string, text: string) => fr && expect(all).toContain(text);
    const paddock = machineName(t, 'paddock');
    const haven = machineName(t, 'haven');

    const part = (finished: string[] = []) => {
      const c = new Console({ language, finished: [...BEFORE, ...finished] });
      const one = (l: string) => {
        // A leading ! keeps the line's words (a path under a restore target: /srv/restore/var/backups).
        let output = c.execute(l.startsWith('!') ? machinesInLanguage(t, l.slice(1)) : L(l)) ?? '';
        if (c.shell.waiting) output += '\n' + (c.execute(L(PASSWORD)) ?? '');
        return output;
      };
      const play = (lines: string[]) => lines.map(one).join('\n');
      const edit = (command: string, change: (text: string) => string) => {
        one(command);
        c.save(change(c.edition!.text));
        return c.quitEdition() ?? '';
      };
      play(['ssh meadow', 'yes']);
      const main = () => ((c.shell as unknown as { principal: typeof c.shell }).principal ?? c.shell);
      return { c, play, edit, flag: (id: string) => main().flags.has(id), done: (id: string) => c.finished.includes(id) };
    };

    // The plan's table, in the language's headers.
    const head = `| ${t('shelter-plan-col-service')} | RPO | RTO | ${t('shelter-plan-col-backup')} | ${t('shelter-plan-col-owner')} |\n|---|---|---|---|---|`;
    const table = (rows: string[]) => `# Plan\n\n## Services\n\n${head}\n${rows.join('\n')}\n`;
    const GOOD = ['| Website (nginx) | 24h | 8h | restic, nightly | Teuila |', '| Adoption app and its database (PostgreSQL) | 24h | 8h | pg_dump then restic | Wiremu |', '| Vet records (vetlink) | 24h | 2d | restic, nightly | Mirela |'];

    // ——— Chapter 1: "What Do We Have?" ———

    it('chapter 1 — solution: the inventory, the table rewritten, vetlink in the job, a backup now', () => {
      const { play, edit, flag, done } = part();
      let all = play(['cat /srv/drp/plan.md']);
      expect(all).toContain('| RPO | RTO |');
      all = play([`ssh ${paddock}`, 'yes', 'systemctl list-units --type=service']);
      expect(all).toContain('adopt.service');
      expect(flag('units')).toBe(true);
      all = play(['systemctl list-timers']);
      expect(all).toContain('vetlink-sync.timer');
      contains(all, "vetlink n'est dans aucune ligne du plan");
      all = play(['sudo ss -tlnp']);
      expect(all).toMatch(/127\.0\.0\.1:8000 .*gunicorn/);
      all = play(['systemctl cat vetlink-sync.service', 'cat /usr/local/sbin/shelter-backup']);
      expect(all).toContain('restic backup /etc /var/www /srv/adopt /var/backups');
      expect(flag('script')).toBe(true);
      all = play([`sudo restic -r ${REPO} -p /root/.restic-pass snapshots --latest 1`]);
      expect(all).toMatch(/2031-11-03 02:0\d:\d\d +paddock|2031-11-03 02:0\d:\d\d +enclos/);
      expect(flag('snapshots')).toBe(true);
      all = edit('sudo nano /usr/local/sbin/shelter-backup', (x) => x.replace('/srv/adopt /var/backups', '/srv/adopt /srv/vetlink /var/backups'));
      expect(flag('fixed')).toBe(true);
      contains(all, 'referme le trou aujourd');
      all = play(['sudo /usr/local/sbin/shelter-backup']);
      expect(all).toMatch(/snapshot [0-9a-f]{8} saved/);
      expect(flag('saved')).toBe(true);
      play(['exit']);
      expect(done('what-we-have')).toBe(false);
      all = edit('nano /srv/drp/plan.md', () => table(GOOD));
      contains(all, 'Vous avez terminé le chapitre 1 du Refuge');
      expect(done('what-we-have')).toBe(true);
    });

    it('chapter 1 — another solution: an hourly backup for an RPO of one hour, the whole of /srv, restic backup by hand', () => {
      const { play, edit, flag, done } = part();
      play([`ssh ${paddock}`, 'yes']);
      edit('sudo nano /etc/systemd/system/shelter-backup.timer', (x) => x.replace('OnCalendar=*-*-* 02:00:00', 'OnCalendar=hourly'));
      edit('sudo nano /usr/local/sbin/shelter-backup', (x) => x.replace('restic backup /etc /var/www /srv/adopt /var/backups', 'restic backup /etc /var/www /srv /var/backups'));
      expect(flag('fixed')).toBe(true);
      play([`sudo restic -r ${REPO} -p /root/.restic-pass backup /srv/vetlink /var/www /var/backups`, 'exit']);
      expect(flag('saved')).toBe(true);
      edit('nano /srv/drp/plan.md', () => table(['| Vet records (vetlink) | 1h | 1d | restic, hourly | Mirela |', '| Adoption app and its database | 1h | 4h | pg_dump then restic, hourly | Rahel |', '| Website | 1h | 8h | restic, hourly | Teuila |']));
      expect(done('what-we-have')).toBe(true);
    });

    it('chapter 1 — false leads: an RPO the night can\'t keep, Dariusz, phpList kept, vetlink without a backup', () => {
      const { play, edit, flag, done } = part();
      let all = edit('nano /srv/drp/plan.md', (x) => x.replace('| Newsletter (phpList) |', '| Vet records (vetlink) | 24h | 2d | restic | Mirela |\n| Newsletter (phpList) |').replace(/\| Lettre d'information \(phpList\) \|/, "| Fiches (vetlink) | 24h | 2j | restic | Mirela |\n| Lettre d'information (phpList) |"));
      expect(flag('rpo-unmet')).toBe(true);
      expect(flag('old-owner')).toBe(true);
      expect(flag('stale-row')).toBe(true);
      expect(flag('unsaved')).toBe(true);
      contains(all, 'la pire nuit on perd jusqu');
      contains(all, 'Dariusz est parti il y a deux ans');
      all = edit('nano /srv/drp/plan.md', () => table(GOOD));
      expect(flag('rows')).toBe(true);
      // The table is right, but vetlink's records are still in no snapshot.
      expect(done('what-we-have')).toBe(false);
      all = play([`ssh ${paddock}`, 'yes', 'systemctl status phplist']);
      expect(flag('no-phplist')).toBe(true);
      edit('sudo nano /usr/local/sbin/shelter-backup', (x) => x.replace('/srv/adopt /var/backups', '/srv/adopt /srv/vetlink /var/backups'));
      play(['sudo systemctl start shelter-backup.service']);
      expect(done('what-we-have')).toBe(true);
    });

    // ——— Chapter 2: "Rebuild on the Spare" ———

    const RESTORE = [
      `ssh ${haven}`,
      'yes',
      'sudo apt update',
      'sudo apt install -y nginx postgresql',
      `sudo restic -r ${REPO} restore latest --target /srv/restore`,
      ENVELOPE,
      'sudo cp -r /srv/restore/var/www/shelter /var/www/',
      'sudo cp -r /srv/restore/srv/adopt /srv/restore/srv/vetlink /srv/',
      'sudo cp /srv/restore/etc/systemd/system/adopt.service /etc/systemd/system/',
      'sudo systemctl daemon-reload',
    ];
    const DATABASE = ['sudo -u postgres createdb shelter', '!sudo -u postgres psql shelter -f /srv/restore/var/backups/shelter.sql'];
    const SITE = ['sudo cp /srv/restore/etc/nginx/sites-available/shelter /etc/nginx/sites-available/', 'sudo ln -s /etc/nginx/sites-available/shelter /etc/nginx/sites-enabled/', 'sudo nginx -t', 'sudo systemctl reload nginx'];

    it('chapter 2 — solution: packages, restore beside, the database and its checksum, services in order, a local test', () => {
      const { play, flag, done } = part(['what-we-have']);
      let all = play(['tail -n 3 /var/log/sitewatch.log', `cat ${t('name-envelope-txt')}`]);
      expect(all).toContain('timeout after 10s');
      contains(all, 'au pire, 50 minutes');
      all = play([`ssh ${haven}`, 'yes', 'sudo apt update', 'sudo apt install -y nginx postgresql']);
      expect(all).toContain('Setting up postgresql (17+278) ...');
      expect(flag('packages')).toBe(true);
      all = play([`sudo restic -r ${REPO} snapshots`, ENVELOPE]);
      expect(all).toMatch(/2031-11-14 02:0\d:\d\d/);
      expect(flag('snapshots')).toBe(true);
      all = play([`sudo restic -r ${REPO} restore latest --target /srv/restore`, ENVELOPE]);
      expect(all).toContain('to /srv/restore');
      expect(flag('restored')).toBe(true);
      expect(flag('over-etc')).toBe(false);
      play(RESTORE.slice(6));
      expect(flag('copied')).toBe(true);
      all = play(DATABASE);
      expect(all).toMatch(/COPY \d+/);
      expect(flag('database')).toBe(true);
      all = play(['!cd /srv/restore/var/backups', 'sha256sum -c shelter.sha256', 'cat shelter.counts', 'cd']);
      expect(all).toContain('shelter.sql: OK');
      expect(flag('verified')).toBe(true);
      play(['sudo systemctl enable --now adopt']);
      expect(flag('adopt')).toBe(true);
      expect(flag('too-early')).toBe(false);
      all = play([...SITE, 'curl -H "Host: www.hillsideshelters.example" http://localhost/']);
      expect(flag('nginx')).toBe(true);
      expect(done('rebuild')).toBe(false);
      all = play(['curl -H "Host: www.hillsideshelters.example" http://localhost/adopt/animals']);
      expect(all).toMatch(/<p>\d+ /);
      contains(all, 'Vous avez terminé le chapitre 2 du Refuge');
      expect(done('rebuild')).toBe(true);
    });

    it('chapter 2 — false leads: paddock is gone, apt before update, the nightly password, a restore over /, the app before its database', () => {
      const { play, flag, done } = part(['what-we-have']);
      let all = play([`ssh ${paddock}`]);
      expect(all).toContain('No route to host');
      expect(flag('paddock-gone')).toBe(true);
      all = play([`ssh ${haven}`, 'yes', 'sudo apt install nginx postgresql']);
      expect(all).toContain('Unable to locate package nginx');
      expect(flag('no-lists')).toBe(true);
      all = play([`sudo restic -r ${REPO} snapshots`, 'guess-the-password']);
      expect(all).toContain('Fatal: wrong password or no key found');
      expect(flag('wrong-password')).toBe(true);
      all = play([`sudo restic -r ${REPO} restore latest --target /`, ENVELOPE]);
      expect(flag('over-etc')).toBe(true);
      contains(all, 'abri chercherait le disque');
      all = play(['cat /etc/hostname']);
      expect(all.trim()).toBe(haven);
      play(['sudo apt update', 'sudo apt install -y nginx postgresql', 'sudo cp /srv/restore/etc/systemd/system/adopt.service /etc/systemd/system/', 'sudo systemctl daemon-reload']);
      // The restore over / already put the site and the app in place; the database isn't there.
      all = play(['sudo systemctl start adopt', 'sudo journalctl -u adopt']);
      expect(all).toContain('database "shelter" does not exist');
      expect(flag('too-early')).toBe(true);
      contains(all, 'le plan démarre la base avant');
      play([`sudo restic -r ${REPO} restore latest --target /srv/restore`, ENVELOPE, ...DATABASE]);
      all = play(['sudo -u postgres psql shelter -c "SELECT count(*) FROM animals"', 'sudo -u postgres psql shelter -c "SELECT count(*) FROM adoptions"', '!cat /srv/restore/var/backups/shelter.counts']);
      expect(flag('verified')).toBe(true);
      play(['sudo systemctl restart adopt', ...SITE]);
      all = play(['curl http://localhost/']);
      expect(all).toContain('Welcome to nginx!');
      expect(flag('default-site')).toBe(true);
      play(['curl -H "Host: www.hillsideshelters.example" http://localhost/adopt/']);
      expect(done('rebuild')).toBe(true);
    });

    // ——— Chapter 3: "Switch and Learn" ———

    const review = (actions: string[], timeline = ['- 02:00 last backup', '- 02:50 first failed check', '- 13:30 www switched']) =>
      [
        '# Review',
        `## ${t('switch-and-learn-section-summary')}`,
        'The cellar flooded and paddock was lost; haven runs the site now.',
        `## ${t('switch-and-learn-section-timeline')}`,
        ...timeline,
        `## ${t('switch-and-learn-section-impact')}`,
        'Eleven hours without the site; at most fifty minutes of data lost.',
        `## ${t('switch-and-learn-section-went-well')}`,
        'The plan, the envelope and the nightly backups.',
        `## ${t('switch-and-learn-section-improve')}`,
        'A server in a cellar; the firewall step missing from the plan.',
        `## ${t('switch-and-learn-section-actions')}`,
        ...actions,
      ].join('\n');
    const ACTIONS = ['- Move the server upstairs (Wiremu)', '- Add the firewall step to the restore order (Mirela)', '- Seal a new envelope (Rahel)'];
    const DRILL = [
      '#!/bin/sh',
      'set -e',
      'export RESTIC_REPOSITORY=/srv/restic',
      'export RESTIC_PASSWORD_FILE=/root/.restic-drill',
      'restic restore latest --target /tmp/drill --include /var/backups',
      'cd /tmp/drill/var/backups && sha256sum -c shelter.sha256',
    ].join('\n');
    const ZONE = 'sudo nano /etc/bind/db.hillsideshelters.example';

    it('chapter 3 — solution: the firewall, a check from outside, the zone, the review, the drill in cron', () => {
      const { play, edit, flag, done } = part(['what-we-have', 'rebuild']);
      let all = play(['curl -H "Host: www.hillsideshelters.example" http://203.0.113.163/']);
      expect(all).toContain('curl: (28) Failed to connect to 203.0.113.163 port 80');
      expect(flag('outside-closed')).toBe(true);
      all = play([`ssh ${haven}`, 'yes', 'sudo ufw allow 80/tcp', 'exit']);
      expect(flag('opened')).toBe(true);
      all = play(['curl -H "Host: www.hillsideshelters.example" http://203.0.113.163/adopt/animals']);
      expect(all).toMatch(/<p>\d+ /);
      expect(flag('outside')).toBe(true);
      edit(ZONE, (x) => x.replace('198.51.100.163', '203.0.113.163').replace('2031110302', '2031111401'));
      all = play(['sudo named-checkzone hillsideshelters.example /etc/bind/db.hillsideshelters.example', 'sudo rndc reload', 'dig @ns1.registrar.example www.hillsideshelters.example +short']);
      expect(all).toContain('loaded serial 2031111401');
      expect(all).toContain('203.0.113.163');
      expect(flag('switched')).toBe(true);
      expect(flag('dark-switch')).toBe(false);
      for (let i = 0; i < 10 && !flag('resolver'); i++) play(['dig www.hillsideshelters.example']);
      expect(flag('resolver')).toBe(true);
      all = play(['curl http://www.hillsideshelters.example/']);
      expect(all).toContain('<h1>');
      edit(`nano ${t('name-review-md')}`, () => review(ACTIONS));
      expect(flag('review')).toBe(true);
      edit('sudo nano /usr/local/sbin/restore-drill', () => DRILL);
      expect(done('switch-and-learn')).toBe(false);
      all = edit('sudo crontab -e', (x) => `${x}\n0 4 1 * * /usr/local/sbin/restore-drill\n`);
      expect(flag('drill')).toBe(true);
      contains(all, 'Vous avez terminé Le Refuge');
      expect(done('switch-and-learn')).toBe(true);
      // The drill's run left meadow as it was.
      expect(play(['ls /tmp'])).not.toContain('drill');
    });

    it('chapter 3 — false leads: the name before the firewall, an unchanged serial, a drill that only lists, blame; a timer', () => {
      const { play, edit, flag, done } = part(['what-we-have', 'rebuild']);
      edit(ZONE, (x) => x.replace('198.51.100.163', '203.0.113.163'));
      let all = play(['sudo rndc reload', 'dig @ns1.registrar.example www.hillsideshelters.example +short']);
      expect(all).toContain('198.51.100.163');
      expect(flag('serial')).toBe(true);
      contains(all, "le numéro de série du SOA n'a pas augmenté");
      edit(ZONE, (x) => x.replace('2031110302', '2031111401'));
      all = play(['sudo rndc reload']);
      expect(flag('dark-switch')).toBe(true);
      contains(all, 'ne reçoivent rien');
      all = play(['dig www.hillsideshelters.example']);
      // The resolver still answers from its cache, then follows.
      all = play(['curl http://www.hillsideshelters.example/']);
      expect(all).toMatch(/curl: \((28|7)\)/);
      play([`ssh ${haven}`, 'yes', 'sudo ufw allow "Nginx HTTP"', 'exit', 'curl -H "Host: www.hillsideshelters.example" http://203.0.113.163/']);
      expect(flag('outside')).toBe(true);
      // Mirela's draft scheduled as it is: it only lists the snapshots.
      edit('sudo crontab -e', (x) => `${x}\n30 3 1 * * /usr/local/sbin/restore-drill\n`);
      expect(flag('drill-list-only')).toBe(true);
      all = edit(`nano ${t('name-review-md')}`, () => review(['- Never again', '- Buy a pump'], ['- 02:50 down', '- 13:30 back', fr ? 'C\'était la faute de Dariusz.' : 'It was Dariusz\'s fault: careless.']));
      expect(flag('blame')).toBe(true);
      expect(flag('no-owners')).toBe(true);
      edit(`nano ${t('name-review-md')}`, () => review(ACTIONS));
      expect(flag('review')).toBe(true);
      // A timer instead of cron: the crontab line goes, the service and its timer come.
      play(['echo "" | sudo crontab -']);
      edit('sudo nano /usr/local/sbin/restore-drill', () => DRILL);
      edit('sudo nano /etc/systemd/system/restore-drill.service', () => '[Unit]\nDescription=Monthly restore drill\n\n[Service]\nType=oneshot\nExecStart=/usr/local/sbin/restore-drill');
      edit('sudo nano /etc/systemd/system/restore-drill.timer', () => '[Unit]\nDescription=Monthly restore drill\n\n[Timer]\nOnCalendar=monthly\n\n[Install]\nWantedBy=timers.target');
      play(['sudo systemctl daemon-reload', 'sudo systemctl enable --now restore-drill.timer']);
      expect(flag('drill')).toBe(true);
      expect(done('switch-and-learn')).toBe(true);
    });
  });
