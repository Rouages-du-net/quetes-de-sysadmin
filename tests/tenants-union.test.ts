// The Tenants' Union: secrets in git with sops and age. Each chapter is
// replayed to the end from the workstation (ssh latch), with another
// solution and false leads, in each language; the expected texts are
// checked in French. Also: the engine (Bech32, the dotenv store, the MAC,
// the errors) and the error explainer on its errors.

import { describe, expect, it } from 'vitest';
import { Console } from '../src/engine/console';
import { STORIES } from '../src/engine/chapters';
import { prerequisites } from '../src/engine/unlocking';
import { translator } from '../src/texts';
import { machinesInLanguage, languagesFor } from './names';
import { name } from '../src/engine/world';
import { explain } from '../src/engine/explainer';
import { ageKey, bech32Decode, bech32Encode, decryptFile, encryptFile, noKeyError, parseRecipient, readSopsConfig, ruleFor, wordWrap } from '../src/engine/sops';
import { ignoredBy } from '../src/engine/commands/git';
import { IKENNA, LATCH, MAKOA, OLD_DB } from '../src/engine/chapters/tenants-union';

const PASSWORD = 'mind-the-damp-24';
const NEW_DB = 'Tq9-new-boiler-Lz42';
const NEWER_DB = 'Wx3-fresh-radiator-Pv77';

describe("The Tenants' Union: the engine", () => {
  it('writes and checks Bech32 like age', () => {
    const k = ageKey('test');
    expect(k.public).toMatch(/^age1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{58}$/);
    expect(k.secret).toMatch(/^AGE-SECRET-KEY-1[QPZRY9X8GF2TVDW0S3JN54KHCE6MUA7L]{58}$/);
    expect(parseRecipient(k.public)).toBe(k.public);
    const typo = k.public.slice(0, 10) + (k.public[10] === 'q' ? 'p' : 'q') + k.public.slice(11);
    expect(parseRecipient(typo)).toEqual({ error: `malformed recipient "${typo}": invalid checksum` });
    // A known vector (BIP 173).
    expect('error' in bech32Decode('A12UEL5L')).toBe(false);
    expect(bech32Encode('a', new Uint8Array())).toBe('a12uel5l');
  });

  it('encrypts a dotenv file, checks its tags and its MAC', () => {
    const key = new Uint8Array(32).fill(7);
    const text = encryptFile([{ key: 'A', value: 'one' }, { key: 'B_unencrypted', value: 'two' }], key, [LATCH.public], {}, '2033-03-08T19:00:00Z', 's');
    expect(text).toMatch(/^A=ENC\[AES256_GCM,data:[^,]+,iv:[^,]+,tag:[^,]+,type:str\]\nB_unencrypted=two\nsops_age__list_0__map_enc=-----BEGIN AGE ENCRYPTED FILE-----\\n/);
    expect(text).toContain('\nsops_unencrypted_suffix=_unencrypted\nsops_version=3.10.2\n');
    const ok = decryptFile(text, { recipients: [LATCH.public] });
    expect('error' in ok ? ok.error : ok.items.map((i) => i.value)).toEqual(['one', 'two']);
    const wrong = decryptFile(text, { recipients: [MAKOA.public] });
    expect('error' in wrong && wrong.code).toBe(128);
    expect('error' in wrong && wrong.error).toContain('no identity matched any of the recipients');
    const edited = decryptFile(text.replace('B_unencrypted=two', 'B_unencrypted=three'), { recipients: [LATCH.public] });
    expect('error' in edited && edited.error).toMatch(/^MAC mismatch\. File has [0-9A-F]{128}, computed [0-9A-F]{128}$/);
    const clear = decryptFile(text.replace(/^A=.*$/m, 'A=plain'), { recipients: [LATCH.public] });
    expect('error' in clear && clear.error).toBe("Error decrypting tree: Error walking tree: Could not decrypt value: Input string plain does not match sops' data format");
  });

  it('prints the no-key error like SOPS', () => {
    expect(noKeyError(['age1x'], 'failed to create reader for decrypting sops data key with age: no identity matched any of the recipients').split('\n')).toEqual([
      'Failed to get the data key required to decrypt the SOPS file.',
      '',
      'Group 0: FAILED',
      '  age1x: FAILED',
      '    - | failed to create reader for decrypting sops data key with',
      '      | age: no identity matched any of the recipients',
      '',
      'Recovery failed because no master key was able to decrypt the file. In',
      'order for SOPS to recover the file, at least one key has to be successful,',
      'but none were.',
    ]);
    expect(wordWrap('aaa bbb ccc', 7)).toBe('aaa bbb\nccc');
  });

  it('reads .sops.yaml and .gitignore', () => {
    const rules = readSopsConfig(`creation_rules:\n  - path_regex: \\.env$\n    age: >-\n      ${LATCH.public},\n      ${IKENNA.public}\n  - path_regex: secrets/.*\n    key_groups:\n      - age:\n          - ${MAKOA.public}\n`);
    expect(rules).toEqual([
      { pathRegex: '\\.env$', age: [LATCH.public, IKENNA.public] },
      { pathRegex: 'secrets/.*', age: [MAKOA.public] },
    ]);
    expect(ruleFor(rules as never, '/r/.sops.yaml', '/r/mail.env')?.age).toEqual([LATCH.public, IKENNA.public]);
    expect(ruleFor(rules as never, '/r/.sops.yaml', '/r/secrets/x.json')?.age).toEqual([MAKOA.public]);
    expect(readSopsConfig('# nothing\n')).toBeNull();
    const ignored = ignoredBy('# settings\n.env\n*.log\nbuild/\n!keep.log\n/top.txt');
    expect(['.env', 'a/.env', 'x.log', 'build/out', 'top.txt'].map(ignored)).toEqual([true, true, true, true, true]);
    expect(['keep.log', 'a/top.txt', 'build', 'app.py'].map(ignored)).toEqual([false, false, false, false]);
  });

  it('explains its errors', () => {
    const t = translator('en');
    const e = (errors: string[]) => explain({ failed: true, output: '', errors }, t);
    expect(e(['Failed to get the data key required to decrypt the SOPS file.'])).toBe('sops-no-key');
    expect(e(['MAC mismatch. File has 1, computed 2'])).toBe('sops-mac');
    expect(e(['config file not found, or has no creation rules, and no keys provided through command line options'])).toBe('sops-no-rule');
    expect(e(['age-keygen: error: failed to open output file "k": open k: file exists'])).toBe('age-keygen-exists');
  });
});

for (const language of languagesFor('tenants-union'))
  describe(`The Tenants' Union — ${language}`, () => {
    const fr = language === 'fr';
    const t = translator(language);
    const L = (line: string) => machinesInLanguage(t, line);
    const contains = (all: string, text: string) => fr && expect(all).toContain(text);

    function play(finished: string[]) {
      const c = new Console({ language, finished: [...STORIES[0].chapters.map((x) => x.id), ...prerequisites('tenants-union'), ...finished] });
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
        const s = sh();
        s.saveEdition(change(s.edition!.text));
        const out = `${before}\n${s.quitEdition() ?? ''}`;
        log.push(out);
        return out;
      };
      const answer = (text: string) => {
        const o = c.execute(text);
        const out = (typeof o === 'string' ? o : '') + '\n' + (sh().last?.errors ?? []).join('\n');
        log.push(out);
        return out;
      };
      run('ssh latch');
      return { c, sh, run, edit, answer, everything: () => log.join('\n'), finished: () => c.remote!.shell.finished, state: () => c.remote!.shell.state };
    }

    const SERVER_RULE = (mine: string) => `creation_rules:\n  - path_regex: \\.env$\n    age: >-\n      ${LATCH.public},\n      ${mine}\n`;
    const DEPLOY = `#!/bin/sh
set -e
cd /srv/repairline
export SOPS_AGE_KEY_FILE=/etc/repairline/age.key
sops --decrypt .env > /etc/repairline/env
systemctl restart repairline
`;

    // ——— Chapter 1: Out of the Open ———

    function makeKey(p: ReturnType<typeof play>) {
      p.run('mkdir -p ~/.config/sops/age', 'age-keygen -o ~/.config/sops/age/keys.txt');
      return p.run('age-keygen -y ~/.config/sops/age/keys.txt').trim().split('\n')[0];
    }

    it('chapter 1 — solution: the history, a key, the rule, encrypt, rotate, deploy, commit, push', () => {
      const p = play([]);
      const { run, edit, finished, everything } = p;
      let all = run(`cat ~/${name(t, 'message_from_taslima.txt')}`, 'cd /srv/repairline', 'git log -p');
      expect(all).toContain(OLD_DB[1]);
      contains(all, "chaque clone du dépôt");
      const mine = makeKey(p);
      expect(mine).toMatch(/^age1/);
      edit('nano .sops.yaml', () => SERVER_RULE(mine));
      all = run('sops --encrypt --in-place .env', 'cat .env');
      expect(all).toContain('DB_PASSWORD=ENC[AES256_GCM,data:');
      expect(all).not.toContain(OLD_DB[1]);
      all = run(`sudo -u postgres psql -c "ALTER ROLE repairline PASSWORD '${NEW_DB}'"`);
      expect(all).toContain('ALTER ROLE');
      all = run(`sops set .env '["DB_PASSWORD"]' '"${NEW_DB}"'`, 'sops -d --extract \'["DB_PASSWORD"]\' .env');
      expect(all).toContain(NEW_DB);
      edit('nano deploy.sh', () => DEPLOY);
      all = run('sudo ./deploy.sh', 'systemctl status repairline');
      expect(all).toContain('active (running)');
      all = run('git add .env .sops.yaml deploy.sh', 'git commit -m "Encrypt .env with sops and age"', 'git push');
      expect(finished()).toBe(true);
      contains(everything(), 'Tu as terminé Hors de vue');
    });

    it('chapter 1 — another solution: sops edit, a deploy with --output, the rule as a key group', () => {
      const p = play([]);
      const { run, edit, finished } = p;
      run('cd /srv/repairline');
      const mine = makeKey(p);
      // The password changed in the clear file first, then the whole file encrypted.
      run(`sudo -u postgres psql -c "ALTER USER repairline WITH PASSWORD '${NEW_DB}'"`);
      edit('nano .sops.yaml', () => `creation_rules:\n  - path_regex: .*\\.env$\n    key_groups:\n      - age:\n          - ${LATCH.public}\n          - ${mine}\n`);
      run('sops encrypt --in-place .env');
      edit('sops edit .env', (text) => text.replace(OLD_DB[1], NEW_DB));
      expect(run('sops -d .env')).toContain(`DB_PASSWORD=${NEW_DB}`);
      edit('nano deploy.sh', () => DEPLOY.replace('sops --decrypt .env > /etc/repairline/env', 'sops --decrypt --output /etc/repairline/env .env'));
      run('sudo sh deploy.sh', 'git commit -am "Secrets encrypted with sops"', 'git add .sops.yaml', 'git commit -m "The sops rule"', 'git push origin main');
      expect(finished()).toBe(true);
    });

    it('chapter 1 — false leads: base64, .gitignore, the wrong recipient, the ciphertext deployed, root without a key, a password in clear', () => {
      const p = play([]);
      const { run, edit, finished, everything } = p;
      const flags = () => (p.sh() as unknown as { flags: Set<string> }).flags;
      run('cd /srv/repairline');
      run(`echo "DB_PASSWORD=$(echo ${OLD_DB[1]} | base64)" > notes.txt`);
      expect(flags().has('base64')).toBe(true);
      contains(everything(), "base64 est un encodage");
      run('rm notes.txt', "echo '.env' > .gitignore");
      expect(flags().has('gitignore')).toBe(true);
      expect(run('git rm --cached .env', 'git add .env')).toContain('The following paths are ignored by one of your .gitignore files:');
      run('rm .gitignore', 'git add .env');
      // Encrypted for Makoa only: the server can't decrypt it.
      run(`sops --encrypt --age ${MAKOA.public} --in-place .env`);
      expect(flags().has('wrong-recipient')).toBe(true);
      run('sudo ./deploy.sh');
      expect(flags().has('ciphertext-deployed')).toBe(true);
      expect(flags().has('app-down')).toBe(true);
      expect(run('sudo journalctl -u repairline')).toContain('password authentication failed for user "repairline"');
      expect(finished()).toBe(false);
      const mine = makeKey(p);
      expect(run('sops -d .env')).toContain('Failed to get the data key required to decrypt the SOPS file.');
      expect(run('age-keygen -o ~/.config/sops/age/keys.txt')).toContain('age-keygen: error: failed to open output file');
      // Back to clear: the file from git, then encrypted for the server and you.
      run('git checkout -- .env');
      expect(run('sops -e -i .env')).toContain('config file not found, or has no creation rules');
      edit('nano .sops.yaml', () => SERVER_RULE(mine));
      run('sops -e -i .env');
      expect(run('sops -e -i .env')).toContain('generally due to the file already being encrypted.');
      edit('nano deploy.sh', () => DEPLOY.replace('export SOPS_AGE_KEY_FILE=/etc/repairline/age.key\n', ''));
      expect(run('sudo ./deploy.sh')).toContain('failed to load age identities');
      expect(flags().has('root-without-key')).toBe(true);
      // The new password, committed in clear: it is in the history now.
      run(`sudo -u postgres psql -c "ALTER ROLE repairline PASSWORD '${NEW_DB}'"`, `echo "${NEW_DB}" > password.txt`, 'git add password.txt', 'git commit -m "oops"');
      expect(flags().has('clear-commit')).toBe(true);
      edit('nano deploy.sh', () => DEPLOY);
      run(`sops set .env '["DB_PASSWORD"]' '"${NEW_DB}"'`, 'sudo ./deploy.sh', 'git rm password.txt', 'git commit -am "Encrypted"', 'git add .sops.yaml', 'git commit -m "Rule"', 'git push');
      expect(finished()).toBe(false);
      // Another password, never committed in clear: done.
      run(`sudo -u postgres psql -c "ALTER ROLE repairline PASSWORD '${NEWER_DB}'"`, `sops set .env '["DB_PASSWORD"]' '"${NEWER_DB}"'`, 'sudo ./deploy.sh', 'git commit -am "Another password"', 'git push');
      expect(finished()).toBe(true);
    });

    // ——— Chapter 2: Keys Change Hands ———

    const CH2_RULE = (keys: string[]) => `creation_rules:\n  - path_regex: \\.env$\n    age: >-\n      ${keys.join(',\n      ')}\n`;

    it('chapter 2 — solution: the rule, updatekeys, rotate, a new password, deploy, commit, push', () => {
      const p = play(['out-of-the-open']);
      const { run, edit, answer, finished, everything, sh } = p;
      let all = run(`cat ~/${name(t, 'message_from_ikenna.txt')}`, 'cd /srv/repairline', 'cat .sops.yaml');
      expect(all).toContain(IKENNA.public);
      expect(all).toContain(MAKOA.public);
      edit('nano .sops.yaml', (text) => text.replace(MAKOA.public, IKENNA.public));
      all = run('sops updatekeys .env');
      expect(all).toContain('The following changes will be made to the file\'s groups:');
      expect(all).toContain(`+++ ${IKENNA.public}`);
      expect(all).toContain(`--- ${MAKOA.public}`);
      expect(sh().question?.prompt).toBe('Is this okay? (y/n):');
      all = answer('y');
      expect(all).toContain('synced with new keys');
      run('sops updatekeys -y mail.env');
      expect((sh() as unknown as { flags: Set<string> }).flags.has('same-data-key')).toBe(true);
      contains(everything(), 'sops rotate');
      run('sops rotate -i .env', 'sops rotate --in-place mail.env');
      run(`sudo -u postgres psql -c "ALTER ROLE repairline PASSWORD '${NEWER_DB}'"`);
      edit('sops edit .env', (text) => text.replace(OLD_DB[2], NEWER_DB));
      all = run('sudo /srv/repairline/deploy.sh', 'git add .sops.yaml .env mail.env', 'git commit -m "Ikenna in, Makoa out, new keys"', 'git push');
      expect(finished()).toBe(true);
      contains(everything(), 'Tu as terminé Les clés changent de mains');
    });

    it('chapter 2 — another solution: rotate with --add-age and --rm-age, sops set', () => {
      const p = play(['out-of-the-open']);
      const { run, edit, finished } = p;
      run('cd /srv/repairline');
      for (const f of ['.env', 'mail.env']) run(`sops rotate -i --add-age ${IKENNA.public} --rm-age ${MAKOA.public} ${f}`);
      edit('nano .sops.yaml', (text) => text.replace(MAKOA.public, IKENNA.public));
      run(`sudo -u postgres psql -c "ALTER ROLE repairline PASSWORD '${NEWER_DB}'"`, `sops set .env '["DB_PASSWORD"]' '"${NEWER_DB}"'`);
      run('sudo ./deploy.sh', 'git commit -am "Keys change hands"', 'git push');
      expect(finished()).toBe(true);
    });

    it('chapter 2 — false leads: your private key shared, an ENC value edited by hand, the rule without the files', () => {
      const p = play(['out-of-the-open']);
      const { run, edit, finished, everything } = p;
      const flags = () => (p.sh() as unknown as { flags: Set<string> }).flags;
      run('cd /srv/repairline', 'cp ~/.config/sops/age/keys.txt /tmp/for-ikenna.txt');
      expect(flags().has('shared-key')).toBe(true);
      contains(everything(), "n'est plus à toi");
      run('rm /tmp/for-ikenna.txt');
      // A value changed by hand in the encrypted file.
      edit('nano .env', (text) => text.replace(/^DB_PASSWORD=ENC\[[^\n]*$/m, `DB_PASSWORD=${NEWER_DB}`));
      expect(run('sops -d .env')).toContain("does not match sops' data format");
      expect(flags().has('hand-edit')).toBe(true);
      edit('nano .env', (text) => text.replace(/^DB_PASSWORD=.*\n/m, ''));
      expect(run('sops -d .env')).toContain('MAC mismatch. File has');
      run('git checkout -- .env');
      edit('nano .sops.yaml', (text) => text.replace(MAKOA.public, IKENNA.public));
      run('git commit -am "Ikenna in"');
      expect(flags().has('config-only')).toBe(true);
      expect(finished()).toBe(false);
      void CH2_RULE;
    });
  });
