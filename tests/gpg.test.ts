// gpg (GnuPG), the neutral encrypt/sign/verify tool. Driven through the
// commands table with a seeded keyring; the non-interactive paths use
// --batch --passphrase so no prompt is needed.

import { describe, it, expect, beforeEach } from 'vitest';
import { Shell } from '../src/engine/shell';
import { STORIES } from '../src/engine/chapters';
import { COMMANDS } from '../src/engine/commands';
import { f, type File } from '../src/engine/world';
import type { GpgKey } from '../src/engine/gpg';

const chapter = STORIES[0].chapters[0];
const KEY = (uid: string, fp: string, secret = false): GpgKey => ({ fingerprint: fp, uid, created: '2028-01-02', algo: 'ed25519', secret });

function world(secretKey = false) {
  const s = new Shell(chapter, 'en');
  s.who = 'you';
  s.state.gpg = { keyring: [KEY('You <you@example>', 'AAAA1111BBBB2222CCCC3333DDDD4444EEEE5555', secretKey), KEY('Admin <admin@example>', '1234123412341234123412341234123412341234')] };
  // A plaintext file in the current directory to work on.
  s.place('test', 'backup.tar', f('the whole backup', { owner: 'you' }));
  return s;
}
const run = (s: Shell, ...args: string[]) => (COMMANDS.gpg.launch({ args, input: null, game: s, last: true }) ?? '') + s.recoverErrors().map((e) => '\n' + e).join('');
const node = (s: Shell, path: string) => s.find(path) as File | undefined;

describe('gpg: keyring', () => {
  it('lists public and secret keys', () => {
    const s = world(true);
    const pub = run(s, '--list-keys');
    expect(pub).toContain('pub   ed25519 2028-01-02');
    expect(pub).toContain('You <you@example>');
    expect(pub).toContain('Admin <admin@example>');
    const sec = run(s, '-K');
    expect(sec).toContain('You <you@example>');
    expect(sec).not.toContain('Admin <admin@example>'); // no secret key for Admin
  });

  it('imports a key from a file, idempotently', () => {
    const s = world();
    const keyFile: File = { type: 'file', content: '-----BEGIN PGP PUBLIC KEY BLOCK-----', owner: 'you', crypto: { kind: 'key', key: { fingerprint: 'FFFF0000FFFF0000FFFF0000FFFF0000FFFF0000', uid: 'Release <release@example>', created: '2027-05-01', algo: 'rsa4096' } } };
    s.place('test', 'release.asc', keyFile);
    expect(run(s, '--import', 'release.asc')).toContain('imported');
    expect((s.state.gpg.keyring as GpgKey[]).some((k) => k.uid.startsWith('Release'))).toBe(true);
    expect(run(s, '--import', 'release.asc')).toContain('not changed');
  });
});

describe('gpg: encrypt and decrypt', () => {
  it('symmetric round-trip with a passphrase', () => {
    const s = world();
    run(s, '--batch', '--passphrase', 's3cret', '-c', 'backup.tar');
    const enc = node(s, 'backup.tar.gpg')!;
    expect(enc.content).toContain('-----BEGIN PGP MESSAGE-----'); // opaque on screen
    expect(String(enc.content)).not.toContain('the whole backup');
    // right passphrase gives it back; wrong one fails.
    expect(run(s, '--batch', '--passphrase', 's3cret', '-d', 'backup.tar.gpg')).toContain('the whole backup');
    expect(run(s, '--batch', '--passphrase', 'nope', '-d', 'backup.tar.gpg')).toContain('Bad session key');
  });

  it('public-key encrypt needs a known recipient, and decrypt needs the secret key', () => {
    const s = world(true); // we hold our own secret key
    expect(run(s, '-e', '-r', 'ghost@example', 'backup.tar')).toContain('No public key');
    run(s, '-o', 'backup.enc', '-e', '-r', 'you@example', 'backup.tar');
    expect(run(s, '-d', 'backup.enc')).toContain('the whole backup');
    // without the secret key, the same file can't be opened.
    const t = world(false);
    (t.state.gpg.keyring as GpgKey[]).length = 0;
    t.place('test', 'backup.enc', node(s, 'backup.enc')!);
    expect(run(t, '-d', 'backup.enc')).toContain('No secret key');
  });
});

describe('gpg: sign and verify', () => {
  it('a detached signature verifies, detects tampering, and warns on an unknown key', () => {
    const s = world(true);
    run(s, '-a', '-b', 'backup.tar'); // backup.tar.asc, signed by our secret key
    expect(run(s, '--verify', 'backup.tar.asc', 'backup.tar')).toContain('Good signature from "You <you@example>"');
    // tamper with the data: BAD signature.
    (node(s, 'backup.tar') as File).content = 'the whole backup, altered';
    expect(run(s, '--verify', 'backup.tar.asc', 'backup.tar')).toContain('BAD signature');
    // drop the signer's key from the ring: can't check.
    s.state.gpg = { keyring: [] };
    expect(run(s, '--verify', 'backup.tar.asc', 'backup.tar')).toContain('No public key');
  });

  it('clearsign wraps the text and verifies it', () => {
    const s = world(true);
    run(s, '--clearsign', 'backup.tar');
    const signed = node(s, 'backup.tar.asc')!;
    expect(signed.content).toContain('-----BEGIN PGP SIGNED MESSAGE-----');
    expect(String(signed.content)).toContain('the whole backup'); // clearsigned text is readable
    expect(run(s, '--verify', 'backup.tar.asc')).toContain('Good signature');
  });
});
