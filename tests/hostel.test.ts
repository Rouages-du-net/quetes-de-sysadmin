// The Hostel: secrets in OpenBao (bao, on padlock). Each chapter is replayed
// to the end from the workstation (ssh padlock), with another solution and
// false leads, in each language; the expected texts are checked in French.
// Also: the engine (the CLI's tables, policies and their priority, HMAC,
// durations) and the error explainer on its errors.

import { describe, expect, it } from 'vitest';
import { Console } from '../src/engine/console';
import { STORIES } from '../src/engine/chapters';
import { prerequisites } from '../src/engine/unlocking';
import { translator } from '../src/texts';
import { machinesInLanguage, languagesFor } from './names';
import { name } from '../src/engine/world';
import { explain } from '../src/engine/explainer';
import { capabilitiesOf, hmacSha256, humanDuration, matches, newBao, parseDuration, parsePolicy } from '../src/engine/openbao';
import { columnize, goValue, headerFor, table } from '../src/engine/commands/bao';
import { ADMIN_TOKEN, ATTACKER, BLURRED, LEAKED_TOKEN, NEW_API_KEY, ROOT_TOKEN, SHARES } from '../src/engine/chapters/hostel';

const PASSWORD = 'bunk-bed-42';
const POLICY = 'path "secret/data/bunks/*" {\n  capabilities = ["read"]\n}\n';

describe('The Hostel: the engine', () => {
  it('prints tables like the CLI (columnize, n/a, %v, headers)', () => {
    expect(table(['Key', 'Value'], [['Sealed', 'true'], ['Unseal Nonce', '']])).toBe('Key             Value\n---             -----\nSealed          true\nUnseal Nonce    n/a');
    expect(columnize([['a', 'b'], ['ccc', 'd']])).toBe('a      b\nccc    d');
    expect(goValue(['bunks', 'default'])).toBe('[bunks default]');
    expect(goValue(null)).toBe('<nil>');
    expect(goValue({ b: 1, a: 'x' })).toBe('map[a:x b:1]');
    expect(headerFor('Metadata', ['created_time', 'custom_metadata', 'version'])).toBe('======= Metadata =======');
    expect(headerFor('Data', ['password', 'username'])).toBe('====== Data ======');
    expect(humanDuration(768 * 3600)).toBe('768h');
    expect(humanDuration(2 * 3600 + 30)).toBe('2h30s');
    expect(humanDuration(767 * 3600 + 59 * 60 + 40)).toBe('767h59m40s');
    expect(parseDuration('1h30m')).toBe(5400);
    expect(parseDuration('90')).toBe(90);
    expect(parseDuration('soon')).toBeNull();
  });

  it('reads policies and decides like OpenBao (globs, +, priority, deny)', () => {
    expect(parsePolicy(POLICY)).toEqual({ rules: [{ path: 'secret/data/bunks/*', capabilities: ['read'] }] });
    expect((parsePolicy('path "x" {\n  capabilities = ["reed"]\n}') as { error: string }).error).toBe('failed to parse policy: path "x": path "x": invalid capability "reed"');
    expect((parsePolicy('path "x" {\n  capabilities = ["read"]\n') as { error: string }).error).toBe('failed to parse policy: At 3:1: object expected closing RBRACE got: EOF');
    expect((parsePolicy('paths "x" {\n}') as { error: string }).error).toBe('failed to parse policy: 1 error occurred:\n\t* invalid key "paths" on line 1\n\n');
    expect(matches('secret/data/bunks/*', 'secret/data/bunks/db')).toBe(true);
    expect(matches('secret/data/bunks/*', 'secret/data/bunks')).toBe(false);
    expect(matches('secret/+/bunks/db', 'secret/data/bunks/db')).toBe(true);
    expect(matches('secret/bunks/*', 'secret/data/bunks/db')).toBe(false);
    const b = newBao({ shares: [], threshold: 3, sealed: false, salt: 's', auditFile: '', seed: 'x' });
    b.policies.p = 'path "secret/*" { capabilities = ["read", "list"] }\npath "secret/data/private/*" { capabilities = ["deny"] }\npath "secret/data/+/note" { capabilities = ["update"] }';
    expect(capabilitiesOf(b, ['p'], 'secret/data/bunks/db')).toEqual(['list', 'read']);
    expect(capabilitiesOf(b, ['p'], 'secret/data/private/x')).toEqual(['deny']);
    // The first wildcard later wins: secret/data/+/note over secret/*.
    expect(capabilitiesOf(b, ['p'], 'secret/data/any/note')).toEqual(['update']);
    expect(capabilitiesOf(b, ['p'], 'sys/policies/acl/x')).toEqual(['deny']);
    expect(capabilitiesOf(b, ['root'], 'anything')).toEqual(['root']);
  });

  it('computes HMAC-SHA256 (RFC 4231, test case 2)', () => {
    expect(hmacSha256('Jefe', 'what do ya want for nothing?')).toBe('5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843');
  });

  it('explains its errors', () => {
    const t = translator('en');
    const e = (errors: string[]) => explain({ failed: true, output: '', errors }, t);
    expect(e(['Error making API request.\n\nURL: GET https://127.0.0.1:8200/v1/sys/internal/ui/mounts/secret/bunks/db\nCode: 503. Errors:\n\n* Vault is sealed'])).toBe('bao-sealed');
    expect(e(['Error reading secret/data/x: Error making API request.\n\nURL: GET https://127.0.0.1:8200/v1/secret/data/x\nCode: 403. Errors:\n\n* 1 error occurred:\n\t* permission denied\n\n'])).toBe('bao-denied');
    expect(e(['Error looking up token: Error making API request.\n\nURL: POST https://127.0.0.1:8200/v1/auth/token/lookup\nCode: 403. Errors:\n\n* bad token'])).toBe('bao-denied');
    expect(e(['Code: 403. Errors:\n\n* preflight capability check returned 403, please ensure client\'s policies grant access to path "x/"'])).toBe('bao-preflight');
  });
});

for (const language of languagesFor('hostel'))
  describe(`The Hostel — ${language}`, () => {
    const fr = language === 'fr';
    const t = translator(language);
    const L = (line: string) => machinesInLanguage(t, line);
    const contains = (all: string, text: string) => fr && expect(all).toContain(text);

    function play(finished: string[]) {
      const c = new Console({ language, finished: [...STORIES[0].chapters.map((x) => x.id), ...prerequisites('hostel'), ...finished] });
      const sh = () => c.remote?.shell ?? c.shell;
      const one = (l: string) => {
        const o = c.execute(L(l));
        let out = typeof o === 'string' ? o : '';
        if (sh().waiting) {
          const p = c.execute(machinesInLanguage(t, PASSWORD));
          out += '\n' + (typeof p === 'string' ? p : '');
        }
        if (c.shell.question && /continue connecting/.test(c.shell.question.prompt)) {
          const p = c.execute('yes');
          out += '\n' + (typeof p === 'string' ? p : '');
        }
        return out + '\n' + (sh().last?.errors ?? []).join('\n');
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
      run('ssh padlock');
      return { c, run, edit, everything: () => log.join('\n'), finished: () => c.remote!.shell.finished, state: () => c.remote!.shell.state };
    }
    const tokenIn = (out: string) => /^token\s+(s\.\w+)$/m.exec(out)![1];

    // ——— Chapter 1: Sealed ———

    it('chapter 1 — solution: status, three shares at the prompt, Bunks restarted, its health', () => {
      const { run, finished, everything } = play([]);
      let all = run(`cat ~/${name(t, 'message_from_desta.txt')}`, 'bao status');
      expect(all).toContain('Seal Type          shamir');
      expect(all).toContain('Sealed             true');
      expect(all).toContain('Unseal Progress    0/3');
      expect(all).toContain('Unseal Nonce       n/a');
      expect(all).toContain('Storage Type       pebbledb');
      contains(all, 'scellé');
      all = run(`cat /media/${name(t, 'usb')}/unseal-share-3.txt`, 'bao operator unseal', SHARES[2]);
      expect(all).toContain(`${SHARES[2]}\n`);
      expect(all).toContain('Unseal Progress    1/3');
      expect(all).not.toContain(SHARES[2] + '\n\nKey');
      all = run(`bao operator unseal ${SHARES[3]}`, `bao operator unseal ${SHARES[4]}`);
      expect(all).toContain('Sealed          false');
      expect(all).toMatch(/Cluster Name    vault-cluster-[0-9a-f]{8}/);
      all = run('systemctl status bunks', 'journalctl -u bunks --no-pager');
      expect(all).toContain("Failed with result 'start-limit-hit'");
      expect(all).toContain('error="Vault is sealed"');
      run('sudo systemctl restart bunks');
      expect(finished()).toBe(false);
      all = run('curl http://127.0.0.1:8080/health');
      expect(all).toContain('"status":"ok"');
      expect(finished()).toBe(true);
      contains(everything(), 'Tu as terminé Scellé.');
    });

    it('chapter 1 — false leads: init, Bunks too early, the same share twice, the blurred share, OpenBao restarted', () => {
      const { run, finished } = play([]);
      let all = run('bao operator init');
      expect(all).toContain('Error initializing: Error making API request.\n\nURL: PUT https://127.0.0.1:8200/v1/sys/init\nCode: 400. Errors:\n\n* Vault is already initialized');
      contains(all, 'déjà initialisé');
      all = run('sudo systemctl restart bunks');
      contains(all, "Descelle d'abord");
      all = run(`bao operator unseal ${SHARES[2]}`, `bao operator unseal ${SHARES[2]}`);
      expect(all).not.toContain('2/3');
      contains(all, 'déjà comptée');
      all = run(`bao operator unseal ${BLURRED}`, `bao operator unseal ${SHARES[3]}`);
      expect(all).toContain('* invalid key: failed to decrypt keys from storage: cipher: message authentication failed');
      contains(all, 'photo floue');
      all = run('bao status');
      expect(all).toContain('Unseal Progress    0/3');
      all = run('bao operator unseal not-a-share');
      expect(all).toContain("* 'key' must be a valid hex or base64 string");
      all = run(`bao operator unseal ${SHARES[2]}`, 'sudo systemctl restart openbao');
      contains(all, 'oubliées');
      all = run('bao status');
      expect(all).toContain('Unseal Progress    0/3');
      run(`bao operator unseal ${SHARES[2]}`, `bao operator unseal ${SHARES[3]}`, `bao operator unseal ${SHARES[4]}`);
      expect(finished()).toBe(false);
    });

    // ——— Chapter 2: Need to Know ———

    it('chapter 2 — solution: a policy, a token, bunks.env, restart, health, the root token revoked', () => {
      const { run, edit, finished, everything } = play(['sealed']);
      let all = run(`cat ~/${name(t, 'notes_from_ruslan.txt')}`, 'sudo cat /etc/bunks/bunks.env', 'bao kv list secret/', 'bao kv get secret/bunks/db');
      expect(all).toContain(`BAO_TOKEN=${ROOT_TOKEN}`);
      expect(all).toContain('Keys\n----\nbunks/\ntreasurer/\nwifi/');
      expect(all).toContain('==== Secret Path ====\nsecret/data/bunks/db\n\n======= Metadata =======');
      expect(all).toContain('custom_metadata    <nil>');
      expect(all).toContain('deletion_time      n/a');
      edit('nano bunks.hcl', () => POLICY);
      all = run('bao policy write bunks bunks.hcl', 'bao policy list');
      expect(all).toContain('Success! Uploaded policy: bunks');
      expect(all).toContain('admin\nbunks\ntreasurer\nroot');
      all = run('bao token create -policy=bunks -display-name=bunks -ttl=768h');
      expect(all).toMatch(/^token_duration\s+768h$/m);
      expect(all).toContain('token_policies       ["bunks" "default"]');
      const token = tokenIn(all);
      all = run(`bao token capabilities ${token} secret/data/bunks/db`, `bao token capabilities ${token} secret/data/treasurer/bank`);
      expect(all).toContain('read\n');
      expect(all).toContain('deny');
      edit('sudo nano /etc/bunks/bunks.env', (x) => x.replace(ROOT_TOKEN, token));
      all = run('sudo systemctl restart bunks', 'journalctl -u bunks -n 2 --no-pager');
      expect(all).toContain('policies="bunks default"');
      run('curl -s http://127.0.0.1:8080/health');
      expect(finished()).toBe(false);
      all = run(`bao token revoke ${ROOT_TOKEN}`, `bao token lookup ${ROOT_TOKEN}`);
      expect(all).toContain('Success! Revoked token (if it existed)');
      expect(all).toContain('Code: 403. Errors:\n\n* bad token');
      expect(finished()).toBe(true);
      contains(everything(), 'Tu as terminé Besoin d');
    });

    it('chapter 2 — false leads: secret/bunks/* without data/, a token from the root token, a policy too wide', () => {
      const { run, edit, finished } = play(['sealed']);
      edit('nano bunks.hcl', () => 'path "secret/bunks/*" {\n  capabilities = ["read"]\n}\n');
      let all = run('bao policy write bunks bunks.hcl');
      contains(all, 'data/');
      all = run(`BAO_TOKEN=${ROOT_TOKEN} bao token create -policy=bunks`);
      contains(all, 'enfant');
      const token = tokenIn(all);
      all = run(`BAO_TOKEN=${token} bao kv get secret/bunks/db`);
      expect(all).toContain('Error reading secret/data/bunks/db: Error making API request.\n\nURL: GET https://127.0.0.1:8200/v1/secret/data/bunks/db\nCode: 403. Errors:\n\n* 1 error occurred:\n\t* permission denied');
      edit('sudo nano /etc/bunks/bunks.env', (x) => x.replace(ROOT_TOKEN, token));
      all = run('sudo systemctl restart bunks');
      contains(all, 'permission denied');
      edit('nano wide.hcl', () => 'path "secret/*" {\n  capabilities = ["read"]\n}\n');
      all = run('bao policy write bunks wide.hcl');
      contains(all, 'plus que');
      all = run(`bao token revoke ${ROOT_TOKEN}`, `bao token lookup ${token}`);
      expect(all).toContain('* bad token');
      all = run('sudo systemctl restart openbao');
      contains(all, 'de nouveau descellé');
      expect(run('bao status')).toContain('Sealed          false');
      all = run('bao token create -policy=bunks -ttl 1h', 'bao kv get secret/bunks/db -field=password');
      expect(all).toContain('Command flags must be provided before positional arguments. The following arguments will not be parsed as flags: [-field=password]');
      expect(all).toContain('Too many arguments (expected 1, got 2)');
      expect(finished()).toBe(false);
    });

    // ——— Chapter 3: Leaked Token ———

    it('chapter 3 — solution: lookup, the audit log, revoke, the key patched, a new token, restart', () => {
      const { run, edit, finished, everything, state } = play(['sealed', 'need-to-know']);
      let all = run(`cat ~/${name(t, 'forum_post.txt')}`, `bao token lookup ${LEAKED_TOKEN}`);
      expect(all).toContain('display_name        token-bunks');
      expect(all).toContain('policies            [bunks default]');
      contains(all, 'accesseur');
      all = run(`bao write sys/audit-hash/file input=${LEAKED_TOKEN}`);
      const hash = /hmac-sha256:[0-9a-f]{64}/.exec(all)![0];
      all = run(`sudo grep -c ${hash} /var/log/openbao/audit.log`, `sudo jq -r 'select(.type == "request") | select(.request.remote_address == "${ATTACKER}") | .request.path' /var/log/openbao/audit.log`);
      expect(all).toContain('secret/data/bunks/payments');
      expect(all).toContain('secret/data/treasurer/bank');
      expect(state().attackerSeen).toBeUndefined();
      all = run(`sudo grep ${ATTACKER} /var/log/openbao/audit.log`);
      contains(all, 'a tenu');
      all = run(`bao token revoke ${LEAKED_TOKEN}`, `bao kv patch secret/bunks/payments api_key=${NEW_API_KEY}`);
      expect(all).toContain('Success! Revoked token (if it existed)');
      expect(all).toMatch(/^version\s+2$/m);
      all = run('bao token create -policy=bunks -display-name=bunks');
      const token = tokenIn(all);
      edit('sudo nano /etc/bunks/bunks.env', (x) => x.replace(LEAKED_TOKEN, token));
      run('sudo systemctl restart bunks');
      expect(finished()).toBe(false);
      run('curl http://127.0.0.1:8080/health');
      expect(finished()).toBe(true);
      contains(everything(), 'Tu as terminé Jeton divulgué.');
    });

    it('chapter 3 — false leads: kv put drops a field, the database secret changed, Bunks restarted with the revoked token', () => {
      const { run, edit, finished } = play(['sealed', 'need-to-know']);
      let all = run(`bao token revoke ${LEAKED_TOKEN}`, 'sudo systemctl restart bunks');
      contains(all, 'révoqué');
      all = run(`bao kv put secret/bunks/payments api_key=${NEW_API_KEY}`);
      contains(all, 'account');
      all = run('bao kv put secret/bunks/db username=bunks password=new-one');
      contains(all, 'base de données');
      all = run('bao kv rollback -version=1 secret/bunks/db', `bao kv patch secret/bunks/payments account=HOSTEL-0412`, 'bao kv metadata get secret/bunks/payments');
      expect(all).toContain('====== Version 3 ======');
      const token = tokenIn(run('bao token create -policy=bunks'));
      edit('sudo nano /etc/bunks/bunks.env', (x) => x.replace(LEAKED_TOKEN, token));
      run('sudo systemctl restart bunks', 'curl http://127.0.0.1:8080/health');
      // The attacker's requests were never looked at.
      expect(finished()).toBe(false);
      run('sudo tail -n 40 /var/log/openbao/audit.log');
      run('curl http://127.0.0.1:8080/health');
      expect(finished()).toBe(true);
    });

    it('the admin token: revoked by mistake, Desta gives a new one', () => {
      const { run } = play(['sealed']);
      let all = run('bao token revoke -self', 'bao token lookup');
      all = run('bao token lookup');
      expect(all).toContain('display_name        token-you');
      expect(all).not.toContain(ADMIN_TOKEN);
    });
  });
