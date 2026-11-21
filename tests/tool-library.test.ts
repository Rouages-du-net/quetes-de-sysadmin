// The Tool Library: a nonprofit's Forgejo forge and its CI. Each chapter is
// replayed to the end from the workstation (ssh anvil), with false leads, in
// each language; the expected texts are checked in French. Also: the git
// additions (signed commits and tags, reflog, reset, push --force, archive,
// config), ssh-keygen -Y, the forge's API and its workflows.

import { describe, expect, it } from 'vitest';
import { Console } from '../src/engine/console';
import { Shell } from '../src/engine/shell';
import { STORIES } from '../src/engine/chapters';
import { prerequisites } from '../src/engine/unlocking';
import { LANGUAGES, translator } from '../src/texts';
import { inLanguage, machinesInLanguage } from './names';
import { evaluate, forge } from '../src/engine/forge';
import { readAllowedSigners, readSignature, sign } from '../src/engine/sshsig';
import { generateKey } from '../src/engine/access';
import { KEYS, OLD_WORKFLOW, SAFE_WORKFLOW } from '../src/engine/chapters/tool-library';

const chapter = (id: string) => STORIES.flatMap((h) => h.chapters).find((c) => c.id === id)!;
const PASSWORD = 'pegboard-47';
const API = 'https://forge.lendshed.example/api/v1';
const BARE = '/var/lib/forgejo/data/forgejo-repositories/lendshed/lendshed.git';
const AUTH = '-H "Authorization: token $(cat ~/.forgejo-token)"';
const JSON_ = '-H "Content-Type: application/json"';

describe('SSH signatures, allowed signers, expressions', () => {
  it('signs and reads back a signature; allowed_signers lines with options', () => {
    const k = generateKey('test', 'me@example');
    const armour = sign(k.isPrivate, 'file', 'hello\n');
    expect(armour.split('\n')[0]).toBe('-----BEGIN SSH SIGNATURE-----');
    expect(armour.split('\n')[1].startsWith('U1NIU0lH')).toBe(true);
    expect(readSignature(armour)!.namespace).toBe('file');
    const list = readAllowedSigners(`# maintainers\nme@example,*@lendshed.example namespaces="git,file" ${k.isPublic}\nbad line`);
    expect(list).toHaveLength(1);
    expect(list[0].principals).toEqual(['me@example', '*@lendshed.example']);
    expect(list[0].namespaces).toEqual(['git', 'file']);
  });

  it('evaluates workflow expressions like Forgejo', () => {
    const ctx = { github: { event_name: 'pull_request_target', ref: 'refs/heads/main', event: { pull_request: { head: { sha: 'abc' } } } }, secrets: {}, env: {} };
    expect(evaluate("github.ref == 'refs/heads/main'", ctx)).toBe(true);
    expect(evaluate("github.event_name == 'push' && github.ref == 'refs/heads/main'", ctx)).toBe(false);
    expect(evaluate('github.event.pull_request.head.sha', ctx)).toBe('abc');
    expect(evaluate("startsWith(github.ref, 'refs/heads/') || false", ctx)).toBe(true);
    expect(OLD_WORKFLOW).toContain('pull_request_target');
    expect(SAFE_WORKFLOW).not.toContain('pull_request_target');
  });
});

for (const language of LANGUAGES)
  describe(`The Tool Library — ${language}`, () => {
    const fr = language === 'fr';
    const t = translator(language);
    const L = (line: string) => inLanguage(t, machinesInLanguage(t, line));
    const contains = (all: string, text: string) => fr && expect(all).toContain(text);
    const me = fr ? 'vous' : 'you';

    function play(finished: string[]) {
      const c = new Console({ language, finished: [...STORIES[0].chapters.map((x) => x.id), ...prerequisites('tool-library'), ...finished] });
      const one = (l: string) => {
        const o = c.execute(L(l));
        let out = typeof o === 'string' ? o : '';
        if (c.shell.waiting) {
          const p = c.execute(machinesInLanguage(t, PASSWORD));
          out += '\n' + (typeof p === 'string' ? p : '');
        }
        return out;
      };
      const run = (...lines: string[]) => lines.map(one).join('\n');
      const edit = (command: string, change: (text: string) => string) => {
        const before = one(command);
        c.shell.saveEdition(change(c.shell.edition!.text));
        return `${before}\n${c.shell.quitEdition() ?? ''}`;
      };
      run('ssh anvil', 'yes');
      return { c, run, edit, anvil: () => c.remote!.shell as Shell, finished: () => c.remote!.shell.finished };
    }

    it('chapter 1 — solution: the reflog, the collaborator, the token (Sudo), the protection, a refused force-push', () => {
      const { run, finished, anvil } = play([]);
      let all = run('cat message_from_wanjiru.txt', 'cat note_from_tomasz.txt', `sudo git --git-dir=${BARE} reflog --date=iso`);
      expect(all).toMatch(/[0-9a-f]{7} HEAD@\{2030-10-14 02:13:00 \+0000\}: push/);
      contains(all, 'force');
      const bad = /([0-9a-f]{7}) HEAD@\{2030-10-14/.exec(all)![1];
      all = run(`sudo git --git-dir=${BARE} show ${bad}`);
      expect(all).toContain('+requets==2.32.3');
      expect(all).toContain('Author: Tomasz Nowak <tomasz@lendshed.example>');
      all = run(`curl -s ${AUTH} ${API}/repos/lendshed/lendshed/collaborators | jq -r '.[].login'`);
      expect(all).toContain('tomasz');
      all = run(`curl -s ${AUTH} ${API}/repos/lendshed/lendshed/collaborators/tomasz/permission | jq -c .`);
      expect(all).toContain('"permission":"write"');
      all = run(`curl -s -X DELETE ${AUTH} ${API}/repos/lendshed/lendshed/collaborators/tomasz -w '%{http_code}'`);
      expect(all).toContain('204');
      all = run(`curl -s ${AUTH} -H "Sudo: tomasz" ${API}/users/tomasz/tokens`);
      expect(all).toContain('auth required');
      all = run(`curl -s -u ${me}:${PASSWORD} -H "Sudo: tomasz" ${API}/users/tomasz/tokens`);
      expect(all).toContain('"name":"release-script"');
      expect(all).toContain('"scopes":["all"]');
      run(`curl -s -u ${me}:${PASSWORD} -H "Sudo: tomasz" -X DELETE ${API}/users/tomasz/tokens/3`);
      expect(forge(anvil())!.tokens.some((x) => x.owner === 'tomasz')).toBe(false);
      all = run(`curl -s ${AUTH} ${API}/repos/lendshed/lendshed/commits/main/statuses | jq -r '.[].context'`);
      expect(all).toContain('ci / test (push)');
      all = run(
        `curl -s -X POST ${AUTH} ${JSON_} -d '{"rule_name":"main","enable_push":true,"enable_push_whitelist":true,"push_whitelist_usernames":["wanjiru","rosa","${me}"],"required_approvals":1,"enable_status_check":true,"status_check_contexts":["ci / test (*)"]}' ${API}/repos/lendshed/lendshed/branch_protections`,
      );
      expect(all).toContain('"required_approvals":1');
      expect(finished()).toBe(false);
      all = run('cd lendshed', 'git reset --hard HEAD~1', 'git push --force');
      expect(all).toContain('remote: Forgejo: branch main is protected from force push');
      expect(all).toContain(' ! [remote rejected] main -> main (pre-receive hook declined)');
      expect(finished()).toBe(true);
      all = run('git reset --hard HEAD@{1}', 'git status');
      expect(all).toContain('HEAD is now at');
    });
    it('chapter 1 — false leads: a force-push before protecting, a password, deleting the account, a private repository; prohibit_login', () => {
      const { run, finished, anvil } = play([]);
      let all = run('cd lendshed', 'git reset --hard HEAD~1', 'git push --force');
      expect(all).toMatch(/ \+ [0-9a-f]{7}\.\.\.[0-9a-f]{7} main -> main \(forced update\)/);
      contains(all, 'réécrit');
      all = run('git reflog', 'git reset --hard HEAD@{1}', 'git push');
      expect(all).toMatch(/[0-9a-f]{7}\.\.[0-9a-f]{7} {2}main -> main/);
      all = run(`sudo -u forgejo forgejo --config /etc/forgejo/app.ini admin user change-password --username tomasz --password 'n3w-and-l0ng'`);
      expect(all).toContain("tomasz's password has been successfully updated!");
      contains(all, 'jeton');
      all = run('sudo -u forgejo forgejo --config /etc/forgejo/app.ini admin user delete --username tomasz');
      expect(all).toContain('user still has ownership of repositories [uid: 3]');
      contains(all, 'prohibit_login');
      all = run(`curl -s -X PATCH ${AUTH} ${JSON_} -d '{"private":true}' ${API}/repos/lendshed/lendshed | jq .private`);
      expect(all).toContain('true');
      contains(all, 'privé');
      all = run(`curl -s -X PATCH ${AUTH} ${JSON_} -d '{"prohibit_login":true}' ${API}/admin/users/tomasz | jq .prohibit_login`);
      expect(all).toContain('true');
      // The token no longer opens anything.
      const token = forge(anvil())!.tokens.find((x) => x.owner === 'tomasz')!.value;
      expect(run(`curl -s -H "Authorization: token ${token}" ${API}/user`)).toContain('This account is prohibited from signing in');
      run(`curl -s -X DELETE ${AUTH} ${API}/repos/lendshed/lendshed/collaborators/tomasz`);
      // A rule that lets every collaborator push directly, and a context that never comes.
      all = run(`curl -s -X POST ${AUTH} ${JSON_} -d '{"rule_name":"main","enable_push":true,"required_approvals":1,"enable_status_check":true,"status_check_contexts":["tests"]}' ${API}/repos/lendshed/lendshed/branch_protections`);
      contains(all, 'mainteneur');
      contains(all, 'jamais');
      all = run(`curl -s -X PATCH ${AUTH} ${JSON_} -d '{"enable_push_whitelist":true,"push_whitelist_usernames":["wanjiru","rosa","${me}"],"status_check_contexts":["ci / test (pull_request_target)"]}' ${API}/repos/lendshed/lendshed/branch_protections/main`);
      all = run('git reset --hard HEAD~1', 'git push -f origin main');
      expect(all).toContain('branch main is protected from force push');
      expect(finished()).toBe(false);
      run(`curl -s -X PATCH ${AUTH} ${JSON_} -d '{"private":false}' ${API}/repos/lendshed/lendshed`);
      expect(finished()).toBe(true);
      expect(forge(anvil())!.users.tomasz).toBeTruthy();
    });

    it('chapter 1 — another way: forgejo admin user delete --purge (accepted, at a cost)', () => {
      const { run, finished } = play([]);
      let all = run('sudo -u forgejo forgejo --config /etc/forgejo/app.ini admin user delete --username tomasz --purge');
      contains(all, 'Ghost');
      all = run(`curl -s ${AUTH} ${API}/repos/lendshed/lendshed/collaborators`);
      expect(all).toBe('[]');
      run(`curl -s -X POST ${AUTH} ${JSON_} -d '{"branch_name":"main","enable_push":false,"required_approvals":2,"enable_status_check":true,"status_check_contexts":["ci / test (pull_request_target)"]}' ${API}/repos/lendshed/lendshed/branch_protections`);
      all = run('cd lendshed', 'git reset --hard HEAD~2', 'git push --force');
      expect(all).toContain('remote: Forgejo: branch main is protected from force push');
      expect(finished()).toBe(true);
    });

    it('chapter 2 — solution: the runs, the log decoded, a new restricted key, the secret, the workflow, the status check', () => {
      const { run, edit, finished, anvil } = play(['who-can-push']);
      let all = run('cat message_from_rosa.txt', `curl -s ${API}/repos/lendshed/lendshed/actions/runs | jq -c '.workflow_runs[] | {index_in_repo, event, title}'`);
      expect(all).toContain('{"index_in_repo":2,"event":"pull_request_target","title":"Translate the catalogue to Swahili"}');
      all = run('curl -s https://forge.lendshed.example/lendshed/lendshed/actions/runs/2/jobs/0/logs');
      expect(all).toContain('Run Main Show deploy configuration');
      const blob = /Z (LS0tLS1CRUdJTi[A-Za-z0-9+/=]+)/.exec(all)![1];
      contains(all, 'base64');
      all = run(`echo ${blob} | base64 -d`);
      expect(all).toContain('-----BEGIN OPENSSH PRIVATE KEY-----');
      contains(all, 'volée');
      all = run('cat lendshed/.forgejo/workflows/ci.yml');
      contains(all, 'pwn request');
      all = run(
        "ssh-keygen -t ed25519 -N '' -C ci-deploy -f ~/deploy_key",
        'echo "restrict,from=\\"192.0.2.80\\",command=\\"rrsync /srv/www/docs\\" $(cat ~/deploy_key.pub)" | sudo tee /home/deploy/.ssh/authorized_keys',
      );
      contains(all, 'restreinte');
      all = run(`curl -s -X PUT ${AUTH} ${JSON_} -d "{\\"data\\": \\"$(cat ~/deploy_key)\\"}" ${API}/repos/lendshed/lendshed/actions/secrets/DEPLOY_KEY`);
      expect(all).toContain(`"message":"invalid character '\\\\n' in string literal"`);
      contains(all, 'jq');
      all = run(`jq -Rs '{data: .}' < ~/deploy_key | curl -s -X PUT ${AUTH} ${JSON_} --data-binary @- -w '%{http_code}' ${API}/repos/lendshed/lendshed/actions/secrets/DEPLOY_KEY`, 'rm ~/deploy_key');
      expect(all).toContain('204');
      expect(run(`curl -s ${AUTH} ${API}/repos/lendshed/lendshed/actions/secrets`)).toBe('[{"name":"DEPLOY_KEY","created_at":"2030-02-11T19:00:00Z"}]');
      edit('nano lendshed/.forgejo/workflows/ci.yml', () => SAFE_WORKFLOW);
      all = run('cd lendshed', 'git commit -am "CI: test pull requests without secrets, deploy from main only"', 'git push');
      expect(all).toMatch(/[0-9a-f]{7}\.\.[0-9a-f]{7} {2}main -> main/);
      contains(all, 'Kwame');
      expect(finished()).toBe(false);
      all = run(`curl -s ${API}/repos/lendshed/lendshed/actions/runs | jq -c '.workflow_runs[0] | {event, status, jobs: [.jobs[].name]}'`);
      expect(all).toContain('{"event":"pull_request","status":"success","jobs":["test","deploy"]}');
      all = run(`curl -s -X PATCH ${AUTH} ${JSON_} -d '{"status_check_contexts":["ci / test (pull_request)"]}' ${API}/repos/lendshed/lendshed/branch_protections/main`);
      contains(all, 'CE QUI S');
      expect(finished()).toBe(true);
      const runs = forge(anvil())!.repos['lendshed/lendshed'].runs;
      expect(runs.at(-1)!.jobs[0].secrets).toBe(false);
      expect(runs.find((r) => r.event === 'push' && r.index > 2)!.jobs[1].deployed).toBeTruthy();
    });

    it('chapter 2 — false leads: the echo removed only, the workflow deleted, an unrestricted key, a wrong from=; then fixed', () => {
      const { run, edit, finished } = play(['who-can-push']);
      // Only the debug step goes: the key is still in every job and given to the fork's code.
      edit('nano lendshed/.forgejo/workflows/ci.yml', (x) => x.replace('      - name: Show deploy configuration\n        run: echo "$DEPLOY_KEY" | base64 -w0\n', ''));
      let all = run('cd lendshed', 'git commit -am "CI: no debug output"', 'git push');
      contains(all, 'encore');
      all = run('git rm .forgejo/workflows/ci.yml', 'git commit -m "CI: off for now"', 'git push');
      contains(all, 'plus aucun workflow');
      run('mkdir -p .forgejo/workflows');
      edit('nano .forgejo/workflows/ci.yml', () => SAFE_WORKFLOW);
      all = run('git add .forgejo/workflows/ci.yml', 'git commit -m "CI: test pull requests without secrets"', 'git push');
      contains(all, 'Kwame');
      contains(all, 'fuite');
      all = run("ssh-keygen -t ed25519 -N '' -C ci-deploy -f ~/deploy_key", 'cat ~/deploy_key.pub | sudo tee /home/deploy/.ssh/authorized_keys');
      contains(all, 'restrict');
      run(`jq -Rs '{data: .}' < ~/deploy_key > /tmp/secret.json`, `curl -s -X PUT ${AUTH} ${JSON_} -d @/tmp/secret.json ${API}/repos/lendshed/lendshed/actions/secrets/DEPLOY_KEY`);
      run(`curl -s -X PATCH ${AUTH} ${JSON_} -d '{"status_check_contexts":["ci / test (pull_request)"]}' ${API}/repos/lendshed/lendshed/branch_protections/main`);
      expect(finished()).toBe(false);
      all = run('echo "from=\\"127.0.0.1\\" $(cat ~/deploy_key.pub)" | sudo tee /home/deploy/.ssh/authorized_keys', 'git commit --allow-empty -m "Redeploy"', 'git push');
      contains(all, 'déploiement');
      expect(finished()).toBe(false);
      run('echo "restrict,from=\\"192.0.2.80\\" $(cat ~/deploy_key.pub)" | sudo tee /home/deploy/.ssh/authorized_keys', 'git commit --allow-empty -m "Redeploy"', 'git push');
      expect(finished()).toBe(true);
    });

    it('chapter 3 — solution: SSH signing, allowed_signers, signed commits required, a signed tag, signed checksums, the downstream check', () => {
      const { run, edit, finished, anvil } = play(['who-can-push', 'leaky-pipeline']);
      let all = run('cat message_from_aroha.txt', 'cat note_from_wanjiru.txt', 'git config --global gpg.format ssh', 'git config --global user.signingkey ~/.ssh/id_ed25519.pub', 'git config --global commit.gpgsign true');
      contains(all, 'SSH');
      edit('nano lendshed/lendshed/__init__.py', (x) => x.replace('2.3.0', '2.4.0'));
      all = run('cd lendshed', 'git commit -am "Release 2.4.0"', 'git verify-commit HEAD');
      expect(all).toContain('gpg.ssh.allowedSignersFile');
      all = run(
        `echo "${me}@lendshed.example $(cut -d' ' -f1,2 ~/.ssh/id_ed25519.pub)" > allowed_signers`,
        `curl -s https://forge.lendshed.example/wanjiru.keys | sed 's/^/wanjiru@lendshed.example /' >> allowed_signers`,
        'git config --global gpg.ssh.allowedSignersFile ~/lendshed/allowed_signers',
        'git verify-commit HEAD',
      );
      expect(all).toMatch(new RegExp(`Good "git" signature for ${me}@lendshed\\.example with ED25519 key SHA256:`));
      all = run('git add allowed_signers', `git commit -m "Add the maintainers' signing keys"`, 'git log --show-signature -2');
      expect(all.match(/Good "git" signature/g)).toHaveLength(2);
      all = run(`curl -s -X PATCH ${AUTH} ${JSON_} -d '{"require_signed_commits":true}' ${API}/repos/lendshed/lendshed/branch_protections/main | jq .require_signed_commits`, 'git push');
      expect(all).toMatch(/[0-9a-f]{7}\.\.[0-9a-f]{7} {2}main -> main/);
      all = run('git tag -s v2.4.0 -m "Lendshed 2.4.0"', 'git verify-tag v2.4.0', 'git push origin v2.4.0');
      expect(all).toContain(' * [new tag]         v2.4.0 -> v2.4.0');
      all = run('git archive --format=tar.gz --prefix=lendshed-2.4.0/ -o /srv/www/downloads/lendshed-2.4.0.tar.gz v2.4.0', 'cd /srv/www/downloads', 'sha256sum lendshed-2.4.0.tar.gz > SHA256SUMS', 'ssh-keygen -Y sign -f ~/.ssh/id_ed25519 -n file SHA256SUMS');
      expect(all).toContain('Signing file SHA256SUMS\nWrite signature to SHA256SUMS.sig');
      expect(finished()).toBe(false);
      all = run('sha256sum -c SHA256SUMS', `ssh-keygen -Y verify -f ~/lendshed/allowed_signers -I ${me}@lendshed.example -n file -s SHA256SUMS.sig < SHA256SUMS`);
      expect(all).toContain('lendshed-2.4.0.tar.gz: OK');
      contains(all, 'CE QUI S');
      expect(finished()).toBe(true);
      expect(forge(anvil())!.rejections).toEqual([]);
    });

    it('chapter 3 — false leads: the old key, an unsigned push refused, a lightweight tag, unsigned checksums, a tampered file', () => {
      const { run, edit, finished } = play(['who-can-push', 'leaky-pipeline']);
      run(`curl -s -X PATCH ${AUTH} ${JSON_} -d '{"require_signed_commits":true}' ${API}/repos/lendshed/lendshed/branch_protections/main`);
      edit('nano lendshed/lendshed/__init__.py', (x) => x.replace('2.3.0', '2.4.0'));
      let all = run('cd lendshed', 'git commit -am "Release 2.4.0"', 'git push');
      expect(all).toMatch(/remote: Forgejo: branch main is protected from unverified commit [0-9a-f]{40}/);
      contains(all, 'refusé');
      all = run('git config gpg.format ssh', 'git config user.signingkey ~/.ssh/old_ed25519', 'git commit --amend -S --no-edit', 'git push');
      expect(all).toContain('protected from unverified commit');
      contains(all, 'ancien');
      all = run('git config user.signingkey ~/.ssh/id_ed25519', 'git commit --amend -S --no-edit', 'git push');
      expect(all).toMatch(/main -> main/);
      contains(all, 'allowed_signers');
      all = run('git tag v2.4.0', 'git verify-tag v2.4.0', 'git push origin v2.4.0');
      expect(all).toContain('error: v2.4.0: cannot verify a non-tag object of type commit.');
      contains(all, 'légère');
      all = run(`echo "${me}@lendshed.example $(cat ~/.ssh/id_ed25519.pub)" > allowed_signers`, 'git add allowed_signers', 'git commit -S -m "Add allowed_signers"', 'git push', 'git config gpg.ssh.allowedSignersFile ~/lendshed/allowed_signers', 'git tag -s -f v2.4.0 -m "Lendshed 2.4.0"', 'git push origin v2.4.0');
      expect(all).toContain('(already exists)');
      all = run('git push --force origin v2.4.0', 'git verify-tag v2.4.0');
      expect(all).toContain('(forced update)');
      run('git archive --format=tar.gz --prefix=lendshed-2.4.0/ -o /srv/www/downloads/lendshed-2.4.0.tar.gz v2.4.0', 'cd /srv/www/downloads', 'sha256sum lendshed-2.4.0.tar.gz > SHA256SUMS');
      all = run('sha256sum -c SHA256SUMS');
      contains(all, 'ne prouve rien');
      run('ssh-keygen -Y sign -f ~/.ssh/id_ed25519 -n file SHA256SUMS', 'cp SHA256SUMS /tmp/sums', `echo 'tampered' >> /tmp/sums`);
      all = run(`ssh-keygen -Y verify -f ~/lendshed/allowed_signers -I ${me}@lendshed.example -n file -s SHA256SUMS.sig < /tmp/sums`);
      expect(all).toContain('Signature verification failed: incorrect signature\nCould not verify signature.');
      all = run(`ssh-keygen -Y verify -f ~/lendshed/allowed_signers -I wanjiru@lendshed.example -n file -s SHA256SUMS.sig < SHA256SUMS`);
      expect(all).toContain('Could not verify signature.');
      expect(finished()).toBe(false);
      run(`ssh-keygen -Y verify -f ~/lendshed/allowed_signers -I ${me}@lendshed.example -n file -s SHA256SUMS.sig < SHA256SUMS`);
      expect(finished()).toBe(true);
    });
  });
