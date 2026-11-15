// gpg (GnuPG): list the keyring, import/export keys, encrypt and decrypt
// (symmetric with a passphrase, or to a recipient's public key), and sign
// and verify. On the model of ../gpg.ts. After gpg(1)
// (https://www.gnupg.org/documentation/manuals/gnupg/).
// The cryptography is simulated (see ../gpg.ts): gpg here teaches the
// workflow — encrypt a backup, verify a release — not real secrecy.
// Differences: no key generation (the chapter seeds the keyring), one
// passphrase for the secret key, no web of trust / expiry / subkeys.

import type { Shell } from '../shell';
import type { Command } from './index';
import type { CryptoBlob, File } from '../world';
import { armour, blob, digest, findKey, gpg, keyId, open, shortId, spacedFingerprint, verify, type GpgKey } from '../gpg';

interface Options {
  list: 'public' | 'secret' | null;
  doImport: boolean;
  doExport: boolean;
  symmetric: boolean;
  encrypt: boolean;
  sign: 'inline' | 'detach' | 'clear' | null;
  decrypt: boolean;
  doVerify: boolean;
  armor: boolean;
  recipients: string[];
  user: string | null;
  output: string | null;
  passphrase: string | null;
  batch: boolean;
  files: string[];
  bad?: string;
}

function parse(args: string[]): Options {
  const o: Options = { list: null, doImport: false, doExport: false, symmetric: false, encrypt: false, sign: null, decrypt: false, doVerify: false, armor: false, recipients: [], user: null, output: null, passphrase: null, batch: false, files: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-o' || a === '--output') o.output = args[++i] ?? null;
    else if (a === '-r' || a === '--recipient') o.recipients.push(args[++i] ?? '');
    else if (a === '-u' || a === '--local-user') o.user = args[++i] ?? null;
    else if (a === '--passphrase') o.passphrase = args[++i] ?? '';
    else if (a === '--batch' || a === '--yes' || a === '--no-tty' || a === '-q' || a === '--quiet') o.batch = o.batch || a === '--batch';
    else if (a === '--pinentry-mode') i++;
    else if (a === '-k' || a === '--list-keys' || a === '--list-public-keys') o.list = 'public';
    else if (a === '-K' || a === '--list-secret-keys') o.list = 'secret';
    else if (a === '--import') o.doImport = true;
    else if (a === '--export') o.doExport = true;
    else if (a === '-c' || a === '--symmetric') o.symmetric = true;
    else if (a === '-e' || a === '--encrypt') o.encrypt = true;
    else if (a === '-s' || a === '--sign') o.sign = 'inline';
    else if (a === '-b' || a === '--detach-sign') o.sign = 'detach';
    else if (a === '--clearsign' || a === '--clear-sign') o.sign = 'clear';
    else if (a === '-d' || a === '--decrypt') o.decrypt = true;
    else if (a === '--verify') o.doVerify = true;
    else if (a === '-a' || a === '--armor' || a === '--armour') o.armor = true;
    // combined short flags like -ca, -se, -ab
    else if (/^-[ckesbdauq]+$/.test(a)) {
      for (const f of a.slice(1)) {
        if (f === 'c') o.symmetric = true;
        else if (f === 'e') o.encrypt = true;
        else if (f === 's') o.sign = o.sign ?? 'inline';
        else if (f === 'b') o.sign = 'detach';
        else if (f === 'a') o.armor = true;
        else if (f === 'd') o.decrypt = true;
        else if (f === 'k') o.list = 'public';
      }
    } else if (a.startsWith('-') && a !== '-') o.bad = a;
    else o.files.push(a);
  }
  return o;
}

// ——— key listing ———

function listKeys(game: Shell, secret: boolean): string {
  const keys = gpg(game).keyring.filter((k) => !secret || k.secret);
  if (!keys.length) return '';
  const path = `/home/${game.player}/.gnupg/pubring.kbx`;
  const out: string[] = [`${path}`, '-'.repeat(path.length)];
  for (const k of keys) {
    out.push(`${secret ? 'sec' : 'pub'}   ${k.algo} ${k.created} [SC]`, `      ${k.fingerprint}`, `uid           [ultimate] ${k.uid}`, '');
  }
  return out.join('\n').trimEnd();
}

// ——— import / export ———

function importKeys(game: Shell, files: string[]): string {
  const out: string[] = [];
  for (const path of files) {
    const n = game.find(path);
    if (n?.type !== 'file' || n.crypto?.kind !== 'key' || !n.crypto.key) {
      game.error(`gpg: can't open '${path}': No such file or directory`, 2);
      continue;
    }
    const key = n.crypto.key;
    const ring = gpg(game).keyring;
    if (ring.some((k) => k.fingerprint === key.fingerprint)) {
      out.push(`gpg: key ${key.fingerprint.slice(-16)}: "${key.uid}" not changed`, 'gpg: Total number processed: 1', 'gpg:              unchanged: 1');
    } else {
      ring.push({ fingerprint: key.fingerprint, uid: key.uid, created: key.created, algo: key.algo });
      out.push(`gpg: key ${key.fingerprint.slice(-16)}: public key "${key.uid}" imported`, 'gpg: Total number processed: 1', 'gpg:               imported: 1');
    }
  }
  return out.join('\n');
}

function exportKey(game: Shell, o: Options): string {
  const who = o.files[0] ?? o.recipients[0];
  const key = who ? findKey(game, who) : gpg(game).keyring[0];
  if (!key) return game.error(`gpg: WARNING: nothing exported`, 2);
  const node: File = { type: 'file', content: armour('PUBLIC KEY BLOCK', key.fingerprint), lines: true, owner: game.who, crypto: { kind: 'key', key: { fingerprint: key.fingerprint, uid: key.uid, created: key.created, algo: key.algo } } };
  if (o.output) {
    const e = game.place('gpg', o.output, node);
    return e ? game.error(e) : '';
  }
  return typeof node.content === 'string' ? node.content : '';
}

// ——— the passphrase prompt (reused by -c, -d, signing) ———

/** Runs `use(passphrase)`; asks for it (once, or twice to confirm) when not given with --passphrase. */
function withPassphrase(game: Shell, o: Options, confirm: boolean, use: (pass: string) => string): string {
  if (o.passphrase !== null) return use(o.passphrase);
  if (o.batch) return game.error('gpg: Sorry, no terminal at all requested - can\'t get input', 2);
  game.ask(
    'Enter passphrase: ',
    (first) => {
      if (!confirm) return use(first);
      game.ask(
        'Repeat passphrase: ',
        (second) => (first === second ? use(first) : game.error("gpg: passphrase not correctly repeated; try again.", 2) || game.recoverErrors().join('\n')),
        true,
      );
      return '';
    },
    true,
  );
  return '';
}

// ——— encrypt ———

function targetName(input: string, o: Options, kind: 'message' | 'sig'): string {
  if (o.output) return o.output;
  return `${input}.${kind === 'sig' ? (o.armor ? 'asc' : 'sig') : o.armor ? 'asc' : 'gpg'}`;
}

function encrypt(game: Shell, o: Options): string {
  const input = o.files[0];
  const n = input ? game.find(input) : null;
  if (!input || n?.type !== 'file') return game.error(`gpg: can't open '${input ?? ''}': No such file or directory`, 2);
  const data = typeof n.content === 'string' ? n.content : '';
  const write = (crypto: CryptoBlob) => {
    const out = targetName(input, o, 'message');
    const e = game.place('gpg', out, blob(o.armor ? 'MESSAGE' : 'MESSAGE', input + out, crypto, game.who));
    return e ? game.error(e) : '';
  };
  if (o.symmetric && !o.encrypt) {
    return withPassphrase(game, o, true, (pass) => write({ kind: 'message', mode: 'symmetric', passDigest: digest(pass), data }));
  }
  // public-key: every -r must name a known key.
  const keys: GpgKey[] = [];
  for (const r of o.recipients) {
    const k = findKey(game, r);
    if (!k) return game.error(`gpg: ${r}: skipped: No public key\ngpg: ${input}: encryption failed: No public key`, 2);
    keys.push(k);
  }
  if (!keys.length) return game.error('gpg: no valid addressees\ngpg: encryption failed: No such file or directory', 2);
  return write({ kind: 'message', mode: 'public', recipients: keys.map(keyId), data });
}

// ——— decrypt (explicit -d, or a bare "gpg FILE.gpg") ———

function decrypt(game: Shell, o: Options, path: string): string {
  const n = game.find(path);
  if (n?.type !== 'file') return game.error(`gpg: can't open '${path}': No such file or directory`, 2);
  const show = (data: string) => {
    if (o.output) {
      const e = game.place('gpg', o.output, { type: 'file', content: data, lines: true, owner: game.who });
      return e ? game.error(e) : '';
    }
    return data;
  };
  const once = (pass: string | null) => {
    const r = open(game, n, pass);
    if ('data' in r) return show(r.data);
    if (r.error === 'ask') return withPassphrase(game, o, false, (p) => {
      const r2 = open(game, n, p);
      return 'data' in r2 ? show(r2.data) : game.error(r2.error, 2);
    });
    return game.error(r.error, 2);
  };
  return once(o.passphrase);
}

// ——— sign ———

function sign(game: Shell, o: Options): string {
  const key = (o.user ? findKey(game, o.user) : gpg(game).keyring.find((k) => k.secret)) ?? null;
  if (!key || !key.secret) return game.error('gpg: signing failed: No secret key\ngpg: no default secret key: No secret key', 2);
  const input = o.files[0];
  const n = input ? game.find(input) : null;
  if (!input || n?.type !== 'file') return game.error(`gpg: can't open '${input ?? ''}'`, 2);
  const data = typeof n.content === 'string' ? n.content : '';
  const sig: CryptoBlob = { kind: o.sign === 'detach' ? 'signature' : 'signed', signer: keyId(key), signerUid: key.uid, digest: digest(data), data };
  const make = () => {
    if (o.sign === 'detach') {
      const out = targetName(input, o, 'sig');
      const e = game.place('gpg', out, blob('SIGNATURE', input + out, { kind: 'signature', signer: sig.signer, signerUid: sig.signerUid, digest: sig.digest }, game.who));
      return e ? game.error(e) : '';
    }
    if (o.sign === 'clear') {
      const out = o.output ?? `${input}.asc`;
      const content = `-----BEGIN PGP SIGNED MESSAGE-----\nHash: SHA256\n\n${data}\n${armour('SIGNATURE', input + out)}`;
      const e = game.place('gpg', out, { type: 'file', content, lines: true, owner: game.who, crypto: sig });
      return e ? game.error(e) : '';
    }
    const out = targetName(input, o, 'message');
    const e = game.place('gpg', out, blob('MESSAGE', input + out, sig, game.who));
    return e ? game.error(e) : '';
  };
  if (gpg(game).passphrase === undefined) return make();
  return withPassphrase(game, o, false, (pass) => (pass === gpg(game).passphrase ? make() : game.error('gpg: signing failed: Bad passphrase', 2)));
}

// ——— verify ———

function doVerify(game: Shell, o: Options): string {
  const [first, second] = o.files;
  const a = first ? game.find(first) : null;
  if (a?.type !== 'file' || !a.crypto) return game.error(`gpg: verify signatures failed: No signature\ngpg: can't open '${first ?? ''}'`, 2);
  // Detached: a signature file plus the data file (named, or the sibling).
  if (a.crypto.kind === 'signature') {
    const dataPath = second ?? first.replace(/\.(asc|sig)$/, '');
    const text = game.read(dataPath);
    if (text === null) return game.error(`gpg: can't open signed data '${dataPath}'\ngpg: can't hash datafile: No data`, 2);
    return `gpg: Signature made (simulated)\n${verify(game, a.crypto, text)}`;
  }
  // A clearsigned or inline-signed file carries the text it covers.
  if (a.crypto.kind === 'signed') return `gpg: Signature made (simulated)\n${verify(game, a.crypto, a.crypto.data ?? '')}`;
  return game.error('gpg: no signature found', 2);
}

// ——— the command ———

function run(game: Shell, args: string[]): string {
  const o = parse(args);
  if (o.bad) return game.error(`gpg: invalid option "${o.bad}"`, 2);
  if (o.list) return listKeys(game, o.list === 'secret');
  if (o.doImport) return importKeys(game, o.files);
  if (o.doExport) return exportKey(game, o);
  if (o.doVerify) return doVerify(game, o);
  if (o.sign && !o.encrypt && !o.symmetric) return sign(game, o);
  if (o.encrypt || o.symmetric) return encrypt(game, o);
  if (o.decrypt) {
    if (!o.files[0]) return game.error('gpg: decrypt: no input file', 2);
    return decrypt(game, o, o.files[0]);
  }
  // No action given: gpg decides from the input (a .gpg/.asc message, or a signature).
  const path = o.files[0];
  const n = path ? game.find(path) : null;
  if (n?.type === 'file' && n.crypto?.kind === 'message') return decrypt(game, o, path);
  if (n?.type === 'file' && (n.crypto?.kind === 'signature' || n.crypto?.kind === 'signed')) return doVerify(game, o);
  return game.error(game.t('gpg-usage'), 2);
}

export const GPG: Record<string, Command> = {
  gpg: { ownOptions: true, launch: ({ args, game }) => run(game, args) },
};
