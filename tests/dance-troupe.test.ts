// The Dance Troupe: S3 object storage on a Garage cluster (garage, aws,
// rclone, curl). Each chapter is replayed to the end from the workstation
// (ssh wings), with another solution and false leads, in each language; the
// expected texts are checked in French. Also: the engine (Garage's checks,
// presigned URLs, the web endpoint) and the error explainer on its errors.

import { describe, expect, it } from 'vitest';
import { Console } from '../src/engine/console';
import { STORIES } from '../src/engine/chapters';
import { prerequisites } from '../src/engine/unlocking';
import { LANGUAGES, translator } from '../src/texts';
import { machinesInLanguage } from './names';
import { name } from '../src/engine/world';
import { explain } from '../src/engine/explainer';
import { parseCapacity, presign, readPresigned, scope, type Garage } from '../src/engine/garage';
import { readIni, setIni } from '../src/engine/objects-client';
import { ADMIN, NODE } from '../src/engine/chapters/dance-troupe';

const PASSWORD = 'spring-gala-58';
const RCLONE = 'sudo rclone --config /etc/rclone/office.conf';
const DOC = 'https://www.kestrel.example/members/medical-contacts-2032.csv';

describe('The Dance Troupe: the engine', () => {
  it('reads INI files, capacities and presigned URLs', () => {
    expect(readIni('[a]\nx = 1\n# c\n[b]\ny=2')).toEqual({ a: { x: '1' }, b: { y: '2' } });
    expect(setIni('[a]\nx = 1\n\n[b]\ny = 2', 'a', 'z', '3')).toBe('[a]\nx = 1\nz = 3\n\n[b]\ny = 2');
    expect(setIni('[a]\nx = 1', 'b', 'y', '2')).toBe('[a]\nx = 1\n\n[b]\ny = 2');
    expect(parseCapacity('4T')).toBe(4e12);
    expect(parseCapacity('500GiB')).toBe(500 * 1024 ** 3);
    expect(parseCapacity('lots')).toBeNull();
    expect(scope(Date.UTC(2032, 4, 13, 8, 0), 'garage')).toBe('20320513/garage/s3/aws4_request');
    const url = presign('https://s3.kestrel.example', 'media', 'videos/a b.mp4', { keyId: 'GKx', secret: 's', date: Date.UTC(2032, 4, 13, 8, 0), region: 'garage' }, 604800);
    expect(url).toMatch(/^https:\/\/s3\.kestrel\.example\/media\/videos\/a%20b\.mp4\?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=GKx%2F20320513%2Fgarage%2Fs3%2Faws4_request&X-Amz-Date=20320513T080000Z&X-Amz-Expires=604800&X-Amz-SignedHeaders=host&X-Amz-Signature=[0-9a-f]{64}$/);
    const g = { keys: [{ id: 'GKx', secret: 's' }] } as unknown as Garage;
    const [path, query] = url.replace('https://s3.kestrel.example', '').split('?');
    expect(readPresigned(g, path, query)).toMatchObject({ bucket: 'media', key: 'videos/a b.mp4', expires: 604800, valid: true });
    expect(readPresigned({ keys: [{ id: 'GKx', secret: 'other' }] } as unknown as Garage, path, query)?.valid).toBe(false);
  });

  it('explains its errors', () => {
    const t = translator('en');
    const e = (errors: string[]) => explain({ failed: true, output: '', errors }, t);
    expect(e(['An error occurred (AccessDenied) when calling the PutObject operation: Forbidden: Operation is not allowed for this key.'])).toBe('s3-access-denied');
    expect(e(['An error occurred (NoSuchBucket) when calling the ListObjectsV2 operation: Bucket not found: x'])).toBe('s3-no-bucket');
    expect(e(['2032/04/09 05:40:12 ERROR : Attempt 1/3 failed with 1 errors and: InvalidRequest: Bad request: Date is too old'])).toBe('s3-date');
    expect(e(["An error occurred (AuthorizationHeaderMalformed) when calling the ListObjectsV2 operation: Authorization header malformed, unexpected scope: '20320409/us-east-1/s3/aws4_request', expected: '20320409/garage/s3/aws4_request'"])).toBe('s3-region');
    expect(e(['Unable to locate credentials. You can configure credentials by running "aws configure".'])).toBe('s3-credentials');
    expect(e(['Error: Please pass the new layout version number to ensure that you are writing the correct version of the cluster layout.'])).toBe('garage-layout');
  });
});

for (const language of LANGUAGES)
  describe(`The Dance Troupe — ${language}`, () => {
    const fr = language === 'fr';
    const t = translator(language);
    const L = (line: string) => machinesInLanguage(t, line);
    const contains = (all: string, text: string) => fr && expect(all).toContain(text);

    function play(finished: string[]) {
      const c = new Console({ language, finished: [...STORIES[0].chapters.map((x) => x.id), ...prerequisites('dance-troupe'), ...finished] });
      const one = (l: string) => {
        const o = c.execute(L(l));
        let out = typeof o === 'string' ? o : '';
        if (c.shell.waiting) {
          const p = c.execute(machinesInLanguage(t, PASSWORD));
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
      run('ssh wings');
      const g = () => c.remote!.shell.state.garage as Garage;
      const key = (n: string) => g().keys.find((k) => k.name === n)!;
      return { c, run, edit, g, key, everything: () => log.join('\n'), finished: () => c.remote!.shell.finished };
    }

    // ——— Chapter 1: The Public Bucket ———

    it('chapter 1 — solution: the bucket, the documents moved, a key per tool', () => {
      const { run, edit, key, finished, everything } = play([]);
      let all = run(`cat ${name(t, 'message_from_esperanza.txt')}`, `curl ${DOC}`);
      expect(all).toMatch(/,07700 900127,/);
      contains(all, "N'importe qui peut le lire");
      all = run('sudo garage bucket list', 'sudo garage bucket info www.kestrel.example');
      expect(all).toMatch(/^Website access:\s+true$/m);
      expect(all).toMatch(/^RWO\s+GK[0-9a-f]{24}\s+troupe-admin$/m);
      contains(all, "l'accès web");
      all = run('aws s3 ls s3://www.kestrel.example/', 'sudo garage bucket create members', 'sudo garage bucket allow --read --write --owner members --key troupe-admin', 'aws s3 mv s3://www.kestrel.example/members/ s3://members/ --recursive');
      expect(all).toMatch(/^ {27}PRE members\/$/m);
      expect(all).toContain('move: s3://www.kestrel.example/members/medical-contacts-2032.csv to s3://members/medical-contacts-2032.csv');
      contains(all, 'Les documents des membres ne sont plus');
      all = run(`curl -i ${DOC}`);
      expect(all).toMatch(/^HTTP\/2 404$/m);
      expect(all).toContain(fr ? "Cette page n'existe pas" : "This page doesn't exist");
      contains(all, 'répond maintenant 404');
      all = run('sudo garage key create site-deploy');
      const deploy = key('site-deploy');
      expect(all).toContain(`Secret key:          ${deploy.secret}`);
      all = run('sudo garage bucket allow --read --write www.kestrel.example --key site-deploy', `aws configure set aws_access_key_id ${deploy.id} --profile deploy`, `aws configure set aws_secret_access_key ${deploy.secret} --profile deploy`, '~/bin/deploy-site', 'aws --profile deploy s3 ls s3://members/');
      expect(all).toMatch(new RegExp(`^RW +${deploy.id} +site-deploy$`, 'm'));
      expect(all).toContain('An error occurred (AccessDenied) when calling the ListObjectsV2 operation: Forbidden: Operation is not allowed for this key.');
      contains(all, 'sa propre clé');
      expect(finished()).toBe(false);
      run('sudo garage key create office-backup', 'sudo garage bucket allow --read --write backups --key office-backup');
      const backup = key('office-backup');
      edit('sudo nano /etc/rclone/office.conf', (x) => x.replace(ADMIN.id, backup.id).replace(ADMIN.secret, backup.secret));
      all = run(`${RCLONE} ls garage:backups/office`);
      expect(all).toMatch(/^\s+\d+ grants\/arts-council-report-2031\.txt$/m);
      expect(finished()).toBe(true);
      contains(everything(), 'Tu as terminé Le Bucket public.');
    });

    it('chapter 1 — false leads: the documents deleted, the website off, a key with owner rights', () => {
      const { run, edit, key, finished } = play([]);
      let all = run('sudo garage bucket website --deny www.kestrel.example');
      contains(all, 'Le site ne répond plus');
      run('sudo garage bucket website --allow www.kestrel.example --index-document index.html --error-document 404.html');
      run('sudo garage key create deploy-all', 'sudo garage bucket allow --read --write --owner www.kestrel.example --key deploy-all', 'sudo garage bucket allow --read --write backups --key deploy-all');
      const wide = key('deploy-all');
      all = edit('nano ~/.aws/credentials', (x) => x.replace(/\[deploy\][^[]*/, `[deploy]\naws_access_key_id = ${wide.id}\naws_secret_access_key = ${wide.secret}\n`));
      contains(all, 'Cette clé peut plus que son travail');
      all = run('aws s3 rm s3://www.kestrel.example/members/ --recursive');
      expect(all).toContain('delete: s3://www.kestrel.example/members/register-2032.csv');
      contains(all, "Un document des membres n'est plus dans aucun bucket");
      expect(finished()).toBe(false);
    });

    it('chapter 1 — another solution: rclone copy then aws s3 rm, keys through ~/.aws/credentials by hand', () => {
      const { run, edit, key, finished } = play([]);
      run('sudo garage bucket create private-docs', 'sudo garage bucket allow --read --write private-docs --key troupe-admin', 'sudo garage key create site-deploy', 'sudo garage key create office-backup');
      edit('sudo nano /etc/rclone/office.conf', (x) => x);
      let all = run('aws s3 cp s3://www.kestrel.example/members/ s3://private-docs/members/ --recursive', 'aws s3 rm s3://www.kestrel.example/members/ --recursive', `curl -s -o /dev/null -w '%{http_code}' ${DOC}`);
      expect(all).toMatch(/^404$/m);
      const d = key('site-deploy');
      const b = key('office-backup');
      run('sudo garage bucket allow --read --write www.kestrel.example --key site-deploy', 'sudo garage bucket allow --read --write backups --key office-backup');
      edit('nano ~/.aws/credentials', (x) => x.replace(/\[deploy\][^[]*/, `[deploy]\naws_access_key_id = ${d.id}\naws_secret_access_key = ${d.secret}\n`));
      edit('sudo nano /etc/rclone/office.conf', (x) => x.replace(ADMIN.id, b.id).replace(ADMIN.secret, b.secret));
      all = run(`aws --profile deploy s3 cp ~/site/index.html s3://www.kestrel.example/index.html`);
      expect(all).toContain('upload: ');
      expect(finished()).toBe(false);
      run(`${RCLONE} lsd garage:backups`);
      expect(finished()).toBe(true);
    });

    // ——— Chapter 2: The Offsite Copy ———

    const SAFE = (x: string) => x.replace('sync /srv/office garage:backups/office', 'sync /srv/office garage:backups/office --backup-dir garage:backups/office-old/$(date +%F)');

    it('chapter 2 — solution: the clock, the region, the key, the report restored, --backup-dir, check', () => {
      const { run, edit, finished, everything } = play(['public-bucket']);
      let all = run(`cat ${name(t, 'message_from_linh.txt')}`, 'journalctl -u office-backup -n 9', 'date', 'timedatectl');
      expect(all).toContain('InvalidRequest: Bad request: Date is too old');
      expect(all).toMatch(/NTP service: inactive/);
      contains(all, 'Garage refuse les requêtes de la sauvegarde');
      all = run('sudo timedatectl set-ntp true', `${RCLONE} ls garage:backups/office`);
      expect(all).toContain("AuthorizationHeaderMalformed: Authorization header malformed, unexpected scope: '20320412/us-east-1/s3/aws4_request', expected: '20320412/garage/s3/aws4_request'");
      contains(all, "L'horloge est de nouveau juste");
      edit('sudo nano /etc/rclone/office.conf', (x) => x.replace('region = us-east-1', 'region = garage'));
      all = run(`${RCLONE} copyto garage:backups/office/grants/arts-council-report-2031.txt /srv/office/grants/arts-council-report-2031.txt`, 'head -n 2 /srv/office/grants/arts-council-report-2031.txt');
      expect(all).toMatch(/112/);
      contains(all, 'Le rapport est de retour');
      all = run('sudo /usr/local/bin/office-backup');
      expect(all).toContain('AccessDenied: Forbidden: Operation is not allowed for this key.');
      expect(all).toContain('not deleting files as there were IO errors');
      all = run('sudo garage bucket info backups', 'sudo garage bucket allow --read --write backups --key office-backup');
      expect(all).toMatch(/^R {2}\s+GK/m);
      contains(all, 'peut de nouveau écrire');
      edit('sudo nano /usr/local/bin/office-backup', SAFE);
      all = run(`${RCLONE} sync -n /srv/office garage:backups/office --backup-dir garage:backups/office-old/test`);
      expect(all).toContain('rehearsals/old-winter-plan.txt: Skipped move as --dry-run is set');
      expect(all).toContain('rehearsals/gala-running-order.txt: Skipped copy as --dry-run is set');
      contains(all, 'Un essai à blanc');
      expect(finished()).toBe(false);
      all = run('sudo systemctl start office-backup', 'systemctl status office-backup', `${RCLONE} ls garage:backups/office-old`, `${RCLONE} check /srv/office garage:backups/office`);
      expect(all).toMatch(/rehearsals\/old-winter-plan\.txt$/m);
      expect(all).toContain('0 differences found');
      expect(finished()).toBe(true);
      contains(everything(), 'Tu as terminé La Copie hors site.');
    });

    it('chapter 2 — false leads: the wrong direction, TLS checks off, a sync that overwrites the report', () => {
      const { run, edit, finished } = play(['public-bucket']);
      run('sudo timedatectl set-ntp true', 'sudo garage bucket allow --read --write backups --key office-backup');
      let all = run(`${RCLONE} ls garage:backups --no-check-certificate`);
      contains(all, 'Couper la vérification des certificats');
      edit('sudo nano /etc/rclone/office.conf', (x) => x.replace('region = us-east-1', 'region = garage'));
      all = run(`${RCLONE} sync garage:backups/office /srv/office`);
      contains(all, 'Des fichiers nouveaux du partage ont disparu');
      expect(finished()).toBe(false);
    });

    it('chapter 2 — a sync before restoring, without --backup-dir: the good report is lost', () => {
      const { run, edit, finished } = play(['public-bucket']);
      run('sudo timedatectl set-ntp true', 'sudo garage bucket allow --read --write backups --key office-backup');
      edit('sudo nano /etc/rclone/office.conf', (x) => x.replace('region = us-east-1', 'region = garage'));
      const all = run('sudo /usr/local/bin/office-backup');
      contains(all, 'Le bon rapport a disparu partout');
      expect(finished()).toBe(false);
    });

    it('chapter 2 — another solution: aws s3 cp for the report, an rclone sync with --backup-dir by hand', () => {
      const { run, edit, finished } = play(['public-bucket']);
      run('sudo systemctl enable --now systemd-timesyncd', 'sudo garage bucket allow --write backups --key troupe-admin');
      edit('sudo nano /etc/rclone/office.conf', (x) => x.replace('region = us-east-1', 'region = garage'));
      run('sudo garage bucket allow --read --write backups --key office-backup');
      run('aws s3 cp s3://backups/office/grants/arts-council-report-2031.txt /srv/office/grants/arts-council-report-2031.txt');
      edit('sudo nano /usr/local/bin/office-backup', (x) => x.replace('garage:backups/office', 'garage:backups/office --backup-dir garage:backups/replaced/nightly'));
      run(`${RCLONE} sync /srv/office garage:backups/office --backup-dir garage:backups/replaced/manual -v`);
      expect(finished()).toBe(false);
      run(`${RCLONE} check /srv/office garage:backups/office`);
      expect(finished()).toBe(true);
    });

    // ——— Chapter 3: The Big File ———

    const link = `~/${name(t, 'link_for_zuri.txt')}`;

    it('chapter 3 — solution: a read-only key, a week-long link, porch replaced in its zone', () => {
      const { run, key, g, finished, everything } = play(['public-bucket', 'offsite-copy']);
      let all = run(`cat ${name(t, 'message_from_farrukh.txt')}`, 'sudo garage status');
      expect(all).toContain('==== FAILED NODES ====');
      expect(all).toMatch(/NO ROLE ASSIGNED/);
      contains(all, 'porch est un nœud en panne');
      all = run('sudo garage layout show');
      expect(all).toContain('Current cluster layout version: 3');
      contains(all, 'Trois copies étaient prévues');
      all = run('sudo garage key create festival-share', 'sudo garage bucket allow --read media --key festival-share');
      contains(all, 'ne peut que lire media');
      const k = key('festival-share');
      run(`aws configure set aws_access_key_id ${k.id} --profile festival`, `aws configure set aws_secret_access_key ${k.secret} --profile festival`, 'aws configure set region garage --profile festival', 'aws configure set endpoint_url https://s3.kestrel.example --profile festival');
      contains(all, 'ne peut que lire media');
      all = run(`aws --profile festival s3 presign s3://media/videos/spring-gala-2032-full.mp4 --expires-in 604800 > ${link}`, `curl -I "$(cat ${link})"`);
      expect(all).toMatch(/^HTTP\/2 200$/m);
      expect(all).toContain('content-length: 3814296412');
      contains(all, 'Le lien est prêt');
      expect(finished()).toBe(false);
      all = run(`sudo garage layout assign -z home -c 4T ${NODE.newPorch.slice(0, 6)} --replace ${NODE.porch.slice(0, 6)}`, 'sudo garage layout show', 'sudo garage layout apply --version 4', 'sudo garage status');
      expect(all).toContain('garage layout apply --version 4');
      expect(all).toContain('New cluster layout with updated role assignment has been applied in cluster.');
      expect(all).not.toContain('FAILED NODES');
      expect(g().layout.version).toBe(4);
      expect(finished()).toBe(true);
      contains(everything(), 'Tu as terminé Le Gros Fichier.');
    });

    it('chapter 3 — false leads: thirty days, the bucket public, the admin key, the same zone; another solution: remove then assign', () => {
      const { run, finished } = play(['public-bucket', 'offsite-copy']);
      let all = run(`aws s3 presign s3://media/videos/spring-gala-2032-full.mp4 --expires-in 2592000 > ${link}`, `curl "$(cat ${link})"`);
      expect(all).toContain('<Code>InvalidRequest</Code><Message>Bad request: X-Amz-Expires may not exceed a week</Message>');
      contains(all, 'Garage refuse ce lien');
      contains(all, 'pense à sa clé');
      all = run(`aws s3 presign s3://media/videos/spring-gala-2032-full.mp4 --expires-in 604800 > ${link}`, `curl -s -o /dev/null -w '%{http_code}' "$(cat ${link})"`);
      expect(all).toMatch(/^200$/m);
      all = run('sudo garage bucket website --allow media');
      contains(all, "l'accès web");
      run('sudo garage bucket website --deny media');
      all = run('sudo garage layout apply');
      expect(all).toContain('Please pass the new layout version number');
      all = run(`sudo garage layout remove ${NODE.porch.slice(0, 8)}`, 'sudo garage layout apply --version 4');
      expect(all).toContain('Error: ApplyClusterLayout returned InternalError (500): Internal error: The number of nodes with positive capacity (2) is smaller than the replication factor (3).');
      all = run(`sudo garage layout assign -z studio -c 4T ${NODE.newPorch.slice(0, 8)}`, 'sudo garage layout apply --version 4');
      contains(all, 'dans la même zone');
      run(`sudo garage layout assign -z home ${NODE.newPorch.slice(0, 8)}`, 'sudo garage layout apply --version 5');
      expect(finished()).toBe(false);
      // The link is still signed with the admin key: not finished.
      expect(finished()).toBe(false);
    });

  });
