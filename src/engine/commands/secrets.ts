// sops and age-keygen (the secrets family): see ../sops.ts for the model.
// sops 3.10.2's command line (urfave/cli v1: flags before the file), its
// subcommands encrypt, decrypt, edit, rotate, updatekeys, set and
// filestatus, the -e/-d/-r/-i flags, its messages and exit codes
// (cmd/sops/codes); age-keygen 1.2.1 (-o, -y). The editor is SOPS_EDITOR,
// EDITOR, or else vim, nano, vi: the game has nano.
// Sources: https://getsops.io/docs/,
// https://github.com/getsops/sops/blob/v3.10.2/cmd/sops/main.go,
// https://github.com/FiloSottile/age/blob/v1.2.1/cmd/age-keygen/keygen.go.

import type { Command } from './index';
import type { Shell } from '../shell';
import type { File } from '../world';
import { systemd } from '../systemd';
import {
  AGE_VERSION,
  SOPS_VERSION,
  ageKey,
  metadataItems,
  wrapKey,
  decryptFile,
  emitDotenv,
  encryptFile,
  findConfig,
  identityFile,
  newDataKey,
  nextSeed,
  openFile,
  parseIdentities,
  parseRecipient,
  readDotenv,
  readSopsConfig,
  rfc3339,
  ruleFor,
  rulesOf,
  splitMetadata,
  wordWrap,
  type Identities,
  type Item,
  type Metadata,
  type Rules,
} from '../sops';

// ——— Files, as Go reports them ———

const parentOf = (p: string) => p.replace(/\/[^/]+$/, '') || '/';

/** Reads a file as the current account; Go's error ("open P: …") otherwise. */
function readGo(game: Shell, path: string, shown = path): { text: string } | { error: string } {
  const abs = game.resolve(path);
  const n = game.find(abs);
  if (!n) return { error: `open ${shown}: no such file or directory` };
  if (!game.traverses(abs) || !game.can(n, 'r')) return { error: `open ${shown}: permission denied` };
  if (n.type === 'directory') return { error: `read ${shown}: is a directory` };
  return { text: game.read(abs) ?? '' };
}

/** Writes a file (os.Create: an existing one keeps its owner and mode); Go's error otherwise. */
function writeGo(game: Shell, path: string, text: string, shown = path, mode?: string, exclusive = false): string | null {
  const abs = game.resolve(path);
  const n = game.find(abs);
  const body = text.replace(/\n$/, '');
  if (n) {
    if (exclusive) return `open ${shown}: file exists`;
    if (n.type === 'directory') return `open ${shown}: is a directory`;
    if (!game.traverses(abs) || !game.can(n, 'w')) return `open ${shown}: permission denied`;
    const f = n as File;
    f.content = body;
    f.lines = true;
    delete f.size;
    return null;
  }
  const parent = game.find(parentOf(abs));
  if (!parent || parent.type !== 'directory') return `open ${shown}: no such file or directory`;
  const error = game.place('sops', abs, { type: 'file', content: body, lines: true, owner: game.who, ...(mode ? { mode } : {}) });
  return error ? `open ${shown}: permission denied` : null;
}

const env = (game: Shell) => game.environment ?? {};
const homeOf = (game: Shell) => env(game).HOME ?? (game.who === 'root' ? '/root' : (game.accounts.users[game.who]?.home ?? `/home/${game.who}`));
/** os.UserConfigDir(): $XDG_CONFIG_HOME, or $HOME/.config. */
const configDir = (game: Shell) => env(game).XDG_CONFIG_HOME ?? `${homeOf(game)}/.config`;
export const keysFile = (game: Shell) => `${configDir(game)}/sops/age/keys.txt`;

/** The age identities SOPS loads (age/keysource.go loadIdentities). */
export function loadIdentities(game: Shell): Identities {
  const e = env(game);
  const recipients: string[] = [];
  const texts: string[] = [];
  if (e.SOPS_AGE_KEY !== undefined) texts.push(e.SOPS_AGE_KEY);
  if (e.SOPS_AGE_KEY_FILE !== undefined) {
    const r = readGo(game, e.SOPS_AGE_KEY_FILE);
    if ('error' in r) return { recipients, error: `failed to open SOPS_AGE_KEY_FILE file: ${r.error}` };
    texts.push(r.text);
  }
  const path = keysFile(game);
  const r = readGo(game, path);
  if ('error' in r) {
    if (!r.error.endsWith('no such file or directory') || !texts.length) return { recipients, error: `failed to open file: ${r.error}` };
  } else texts.push(r.text);
  for (const t of texts) {
    const ids = parseIdentities(t);
    if ('error' in ids) return { recipients, error: `failed to parse and add to age identities: ${ids.error}` };
    recipients.push(...ids.recipients);
  }
  return { recipients };
}

// ——— The command line ———

interface Flags {
  encrypt?: boolean;
  decrypt?: boolean;
  rotate?: boolean;
  inPlace?: boolean;
  output?: string;
  age?: string;
  addAge?: string;
  rmAge?: string;
  extract?: string;
  inputType?: string;
  outputType?: string;
  ignoreMac?: boolean;
  config?: string;
  yes?: boolean;
  version?: boolean;
  help?: boolean;
  disableVersionCheck?: boolean;
  idempotent?: boolean;
  rules: Rules;
  files: string[];
  ignored: string[];
}

const VALUED: Record<string, keyof Flags | 'rule'> = {
  output: 'output',
  age: 'age',
  a: 'age',
  'add-age': 'addAge',
  'rm-age': 'rmAge',
  extract: 'extract',
  'input-type': 'inputType',
  'output-type': 'outputType',
  config: 'config',
  'encrypted-regex': 'rule',
  'unencrypted-regex': 'rule',
  'encrypted-suffix': 'rule',
  'unencrypted-suffix': 'rule',
};
const BOOLEAN: Record<string, keyof Flags> = {
  e: 'encrypt',
  encrypt: 'encrypt',
  d: 'decrypt',
  decrypt: 'decrypt',
  r: 'rotate',
  rotate: 'rotate',
  i: 'inPlace',
  'in-place': 'inPlace',
  'ignore-mac': 'ignoreMac',
  y: 'yes',
  yes: 'yes',
  v: 'version',
  version: 'version',
  h: 'help',
  help: 'help',
  'disable-version-check': 'disableVersionCheck',
  'check-for-updates': 'disableVersionCheck',
  verbose: 'disableVersionCheck',
  idempotent: 'idempotent',
};
const RULE_FIELD: Record<string, keyof Rules> = {
  'encrypted-regex': 'encryptedRegex',
  'unencrypted-regex': 'unencryptedRegex',
  'encrypted-suffix': 'encryptedSuffix',
  'unencrypted-suffix': 'unencryptedSuffix',
};

/** urfave/cli: flags before the first positional argument; -x or --x, a value glued with = or next. */
function parseFlags(args: string[]): Flags | { error: string } {
  const f: Flags = { rules: {}, files: [], ignored: [] };
  for (let k = 0; k < args.length; k++) {
    const a = args[k];
    if (f.files.length) {
      f.files.push(a);
      if (/^-/.test(a)) f.ignored.push(a);
      continue;
    }
    const m = /^--?([\w-]+)(?:=(.*))?$/.exec(a);
    if (!m || a === '-') {
      f.files.push(a);
      continue;
    }
    const name = m[1];
    if (name in VALUED) {
      const value = m[2] ?? args[++k];
      if (value === undefined) return { error: `flag needs an argument: -${name}` };
      const field = VALUED[name];
      if (field === 'rule') f.rules[RULE_FIELD[name]] = value;
      else (f as unknown as Record<string, string>)[field] = value;
    } else if (name in BOOLEAN) (f as unknown as Record<string, boolean>)[BOOLEAN[name]] = true;
    else return { error: `flag provided but not defined: -${name}` };
  }
  return f;
}

const USAGE = `NAME:
   sops - sops - encrypted file editor with AWS KMS, GCP KMS, Azure Key Vault, age, and GPG support

USAGE:
   sops is an editor of encrypted files that supports AWS KMS, GCP, AZKV,
  PGP, and Age

   To encrypt or decrypt a document with AWS KMS, specify the KMS ARN
   in the -k flag or in the SOPS_KMS_ARN environment variable.
   (…)
   To encrypt or decrypt using age, specify the recipient in the -a flag,
   or in the SOPS_AGE_RECIPIENTS environment variable.

   To use a different GPG binary than the one in your PATH, set SOPS_GPG_EXEC.

   To select a different editor than the default (vim), set SOPS_EDITOR or
   EDITOR.

   Note that flags must always be provided before the filename to operate on.
   Otherwise, they will be ignored.

   For more information, see the README at https://github.com/getsops/sops

VERSION:
   ${SOPS_VERSION}

COMMANDS:
   decrypt     decrypt a file, and output the results to stdout
   encrypt     encrypt a file, and output the results to stdout
   rotate      generate a new data encryption key and reencrypt all values with the new key
   edit        edit an encrypted file
   set         set a specific key or branch in the input document. value must be a JSON encoded string, for example '/path/to/file ["somekey"] "value"'
   updatekeys  update the keys of SOPS files using the config file
   filestatus  check the status of the file, returning encryption status
   help, h     Shows a list of commands or help for one command

GLOBAL OPTIONS:
   --decrypt, -d                  decrypt a file and output the result to stdout
   --encrypt, -e                  encrypt a file and output the result to stdout
   --rotate, -r                   generate a new data encryption key and reencrypt all values with the new key
   --age value, -a value          comma separated list of age recipients [$SOPS_AGE_RECIPIENTS]
   --in-place, -i                 write output back to the same file instead of stdout
   --extract value                extract a specific key or branch from the input document. Decrypt mode only. Example: --extract '["somekey"][0]'
   --input-type value             currently json, yaml, dotenv and binary are supported. If not set, sops will use the file's extension to determine the type
   --output-type value            currently json, yaml, dotenv and binary are supported. If not set, sops will use the input file's extension to determine the output format
   --rm-age value                 remove the provided comma-separated list of age recipients from the list of master keys on the given file
   --add-age value                add the provided comma-separated list of age recipients fingerprints to the list of master keys on the given file
   --ignore-mac                   ignore Message Authentication Code during decryption
   --unencrypted-suffix value     override the unencrypted key suffix.
   --encrypted-suffix value       override the encrypted key suffix. When empty, all keys will be encrypted, unless otherwise marked with unencrypted-suffix.
   --unencrypted-regex value      set the unencrypted key regex. When specified, only keys matching the regex will be left unencrypted.
   --encrypted-regex value        set the encrypted key regex. When specified, only keys matching the regex will be encrypted.
   --config value                 path to sops' config file. If set, sops will not search for the config file recursively.
   --output value                 Save the output after encryption or decryption to the file specified
   --verbose                      Enable verbose logging output
   --help, -h                     show help
   --version, -v                  print the version`;

// ——— The store of a file (by its extension, or --input-type) ———

type Store = 'dotenv' | 'binary';
function storeOf(file: string, type?: string): Store | { error: string } {
  if (type) {
    if (type === 'dotenv') return 'dotenv';
    if (type === 'binary') return 'binary';
    return { error: `Invalid input type ${type}` };
  }
  return /\.env$/.test(file) ? 'dotenv' : 'binary';
}

// The binary store: the whole file is one value, "data", in a JSON document
// with the metadata (stores/json BinaryStore), indented with tabs.
function binaryToDotenvLike(text: string): string | null {
  try {
    const doc = JSON.parse(text) as { data?: string; sops?: Record<string, unknown> };
    if (typeof doc.data !== 'string' || !doc.sops) return null;
    const s = doc.sops as { age?: { recipient: string; enc: string }[]; lastmodified?: string; mac?: string; [k: string]: unknown };
    const items: Item[] = [{ key: 'data', value: doc.data }];
    (s.age ?? []).forEach((a, n) => items.push({ key: `sops_age__list_${n}__map_enc`, value: a.enc }, { key: `sops_age__list_${n}__map_recipient`, value: a.recipient }));
    for (const k of ['lastmodified', 'mac', 'unencrypted_suffix', 'encrypted_suffix', 'unencrypted_regex', 'encrypted_regex', 'version'])
      if (typeof s[k] === 'string') items.push({ key: `sops_${k}`, value: s[k] as string });
    return emitDotenv(items);
  } catch {
    return null;
  }
}
function dotenvLikeToBinary(text: string): string {
  const items = readDotenv(text) as Item[];
  const { items: rest, flat } = splitMetadata(items);
  const age: { recipient: string; enc: string }[] = [];
  for (let n = 0; `age__list_${n}__map_recipient` in flat; n++) age.push({ recipient: flat[`age__list_${n}__map_recipient`], enc: flat[`age__list_${n}__map_enc`] });
  const sops: Record<string, unknown> = { age, lastmodified: flat.lastmodified, mac: flat.mac };
  for (const k of ['unencrypted_suffix', 'encrypted_suffix', 'unencrypted_regex', 'encrypted_regex']) if (flat[k]) sops[k] = flat[k];
  sops.version = flat.version;
  return JSON.stringify({ data: rest.find((i) => i.key === 'data')?.value ?? '', sops }, null, '\t') + '\n';
}

/** A file's text as the dotenv model reads it. */
function toModel(text: string, store: Store, encrypted: boolean): string {
  if (store === 'dotenv') return text;
  if (encrypted) return binaryToDotenvLike(text) ?? text;
  return emitDotenv([{ key: 'data', value: text }]);
}
const fromModel = (text: string, store: Store) => (store === 'dotenv' ? text : dotenvLikeToBinary(text));
const plainOut = (items: Item[], store: Store) => (store === 'dotenv' ? emitDotenv(items) : (items.find((i) => i.key === 'data')?.value ?? ''));

// ——— The keys a new file gets ———

interface KeysChoice {
  recipients: string[];
  rules: Rules;
}

/** The recipients for a new file (getEncryptConfig): --age, or the creation rule of .sops.yaml. */
function keysFor(game: Shell, f: Flags, abs: string): KeysChoice | { error: string } {
  if (f.age) {
    const recipients: string[] = [];
    for (const r of f.age.split(',').map((x) => x.trim())) {
      const p = parseRecipient(r);
      if (typeof p !== 'string') return { error: `failed to parse input as Bech32-encoded age public key: ${p.error}` };
      recipients.push(p);
    }
    return { recipients, rules: f.rules };
  }
  const base = 'config file not found, or has no creation rules, and no keys provided through command line options';
  const configPath = f.config ? game.resolve(f.config) : findConfig(game, game.cwd);
  if (!configPath) return { error: base };
  const c = readGo(game, configPath, f.config ?? configPath);
  if ('error' in c) return { error: `${base}: could not read config file: ${c.error}` };
  const rules = readSopsConfig(c.text);
  if (rules === null) return { error: base };
  if ('error' in rules) return { error: `${base}: ${rules.error}` };
  const rule = ruleFor(rules, configPath, abs);
  if (!rule) return { error: `${base}: error loading config: no matching creation rules found` };
  const recipients: string[] = [];
  for (const r of rule.age) {
    const p = parseRecipient(r);
    if (typeof p !== 'string') return { error: `${base}: failed to parse input as Bech32-encoded age public key: ${p.error}` };
    recipients.push(p);
  }
  const fromRule: Rules = {};
  for (const k of ['encryptedRegex', 'unencryptedRegex', 'encryptedSuffix', 'unencryptedSuffix'] as const) if (rule[k]) fromRule[k] = rule[k];
  return { recipients, rules: Object.keys(f.rules).length ? f.rules : fromRule };
}

// ——— Actions ———

const fail = (game: Shell, message: string, code: number) => game.error(message, code);

function encryptAction(game: Shell, f: Flags, file: string, store: Store): string {
  const abs = game.resolve(file);
  if (!game.find(abs)) return fail(game, `Error: cannot operate on non-existent file "${abs}"`, 100);
  const r = readGo(game, abs, file);
  if ('error' in r) return fail(game, `Error reading file: ${r.error}`, 2);
  const items = readDotenv(toModel(r.text, store, false));
  if ('error' in items) return fail(game, `Error unmarshalling file: ${items.error}`, 2);
  if (store === 'dotenv' && items.some((i) => !i.comment && i.key.startsWith('sops_'))) {
    const message =
      "The file you have provided contains a top-level entry called 'sops', or for flat file formats top-level entries starting with 'sops_'. This is generally due to the file already being encrypted. SOPS uses a top-level entry called 'sops' to store the metadata required to decrypt the file. For this reason, SOPS can not encrypt files that already contain such an entry.\n\nIf this is an unencrypted file, rename the 'sops' entry.\n\nIf this is an encrypted file and you want to edit it, use the editor mode, for example: `sops my_file.yaml`";
    return fail(game, wordWrap(message, 75), 203);
  }
  if (!items.length) return fail(game, 'File cannot be completely empty, it must contain at least one document', 92);
  const keys = keysFor(game, f, abs);
  if ('error' in keys) return fail(game, keys.error, 1);
  const seed = nextSeed(game, abs);
  const out = fromModel(encryptFile(items, newDataKey(game, abs), keys.recipients, keys.rules, rfc3339(game), seed), store);
  return emit(game, f, abs, file, out);
}

/** Where the result goes: in place, --output, or the standard output. */
function emit(game: Shell, f: Flags, abs: string, file: string, out: string): string {
  if (f.inPlace) {
    const e = writeGo(game, abs, out, file);
    if (e) return fail(game, `Could not open in-place file for writing: ${e}`, 3);
    return '';
  }
  if (f.output) {
    const e = writeGo(game, f.output, out);
    if (e) return fail(game, `Could not open output file for writing: ${e}`, 3);
    return '';
  }
  return out.replace(/\n$/, '');
}

/** Opens and decrypts a SOPS file; the error (and its exit code) written otherwise. */
function load(game: Shell, f: Flags, file: string, store: Store) {
  const abs = game.resolve(file);
  if (!game.find(abs)) return { failed: fail(game, `Error: cannot operate on non-existent file "${abs}"`, 100) };
  const r = readGo(game, abs, file);
  if ('error' in r) return { failed: fail(game, `Error reading file: ${r.error}`, 2) };
  const d = decryptFile(toModel(r.text, store, true), loadIdentities(game), f.ignoreMac);
  if ('error' in d) return { failed: fail(game, d.error, d.code) };
  return { abs, d };
}

function decryptAction(game: Shell, f: Flags, file: string, store: Store): string {
  const l = load(game, f, file, store);
  if ('failed' in l) return '';
  if (f.extract !== undefined) {
    const m = /^\["([^"]*)"\]$/.exec(f.extract);
    if (!m) return fail(game, `error parsing --extract path: component ${f.extract} doesn't end with ]`, 91);
    const item = l.d.items.find((i) => !i.comment && i.key === m[1]);
    if (!item) return fail(game, `Error dumping file: component ['${m[1]}'] not found`, 4);
    return item.value;
  }
  return emit(game, f, l.abs, file, plainOut(l.d.items, store));
}

function rotateAction(game: Shell, f: Flags, file: string, store: Store): string {
  const l = load(game, f, file, store);
  if ('failed' in l) return '';
  const recipients = l.d.metadata.recipients.map((r) => r.recipient);
  for (const add of (f.addAge ?? '').split(',').map((x) => x.trim()).filter(Boolean)) {
    const p = parseRecipient(add);
    if (typeof p !== 'string') return fail(game, `failed to parse input as Bech32-encoded age public key: ${p.error}`, 1);
    recipients.push(p);
  }
  const removed = new Set((f.rmAge ?? '').split(',').map((x) => x.trim()).filter(Boolean));
  const kept = recipients.filter((r) => !removed.has(r));
  const out = fromModel(encryptFile(l.d.items, newDataKey(game, l.abs), kept, rulesOf(l.d.metadata), rfc3339(game), nextSeed(game, l.abs)), store);
  return emit(game, f, l.abs, file, out);
}

function setAction(game: Shell, f: Flags, file: string, index: string, value: string, store: Store): string {
  const m = /^\["([^"]*)"\]$/.exec(index);
  if (!m) return fail(game, 'Invalid set index format', 7);
  let v: unknown;
  try {
    v = JSON.parse(value);
  } catch (e) {
    return fail(game, (e as Error).message.replace(/^Unexpected token.*$/, `invalid character '${value[0]}' looking for beginning of value`), 1);
  }
  if (typeof v !== 'string') return fail(game, `the dotenv store only supports emitting strings, got ${typeof v === 'number' ? 'float64' : typeof v}`, 1);
  const l = load(game, f, file, store);
  if ('failed' in l) return '';
  const items = [...l.d.items];
  const at = items.findIndex((i) => !i.comment && i.key === m[1]);
  if (at >= 0 && items[at].value === v && f.idempotent) return '';
  if (at >= 0) items[at] = { ...items[at], value: v };
  else items.push({ key: m[1], value: v });
  const out = fromModel(encryptFile(items, l.d.dataKey, l.d.metadata.recipients.map((r) => r.recipient), rulesOf(l.d.metadata), rfc3339(game), nextSeed(game, l.abs), l.d.metadata.recipients), store);
  const e = writeGo(game, l.abs, out, file);
  if (e) return fail(game, `Could not open in-place file for writing: ${e}`, 3);
  return '';
}

// ——— edit: the editor on a temporary copy ———

function editAction(game: Shell, f: Flags, file: string, store: Store): string {
  const abs = game.resolve(file);
  // The editor: SOPS_EDITOR, EDITOR, or else vim, nano, vi (the game has nano).
  const e = env(game);
  const editor = (e.SOPS_EDITOR || e.EDITOR || 'nano').trim();
  const program = editor.split(/\s+/)[0];
  if (!/(^|\/)nano$/.test(program)) return fail(game, `Could not run editor: exec: "${program}": executable file not found in $PATH`, 201);
  let items: Item[];
  let dataKey: Uint8Array;
  let recipients: string[];
  let keepEnc: { recipient: string; enc: string }[] | undefined;
  let rules: Rules;
  if (game.find(abs)) {
    const l = load(game, f, file, store);
    if ('failed' in l) return '';
    items = l.d.items;
    dataKey = l.d.dataKey;
    recipients = l.d.metadata.recipients.map((r) => r.recipient);
    keepEnc = l.d.metadata.recipients;
    rules = rulesOf(l.d.metadata);
  } else {
    const keys = keysFor(game, f, abs);
    if ('error' in keys) return fail(game, keys.error, 1);
    // A new file starts from the store's example (stores.ExampleFlatTree).
    items = [
      { key: '', value: ' This is an example file.', comment: true },
      { key: 'hello', value: 'Welcome to SOPS! Edit this file as you please!' },
      { key: 'example_key', value: 'example_value' },
      { key: 'example_multiline', value: 'foo\nbar\nbaz' },
    ];
    dataKey = newDataKey(game, abs);
    recipients = keys.recipients;
    rules = keys.rules;
  }
  // os.MkdirTemp("", ""), then the file's own name in it.
  const seq = nextSeed(game, `edit:${abs}`);
  const dir = `/tmp/${String(1_000_000_000 + (parseInt(seq.replace(/\D/g, '').slice(-6) || '1', 10) * 7_919) % 899_999_999)}`;
  const temp = `${dir}/${abs.split('/').pop()}`;
  const original = plainOut(items, store);
  const before = game.who;
  game.place('sops', dir, { type: 'directory', children: {}, owner: game.who, group: game.who, mode: 'rwx------' });
  game.place('sops', temp, { type: 'file', content: original.replace(/\n$/, ''), lines: true, owner: game.who, mode: 'rw-------' });
  game.who = before;
  game.edition = {
    path: temp,
    text: original,
    root: game.who === 'root',
    message: game.t('nano-lines-read', { lines: original.split('\n').length - (original.endsWith('\n') ? 1 : 0) }),
    conclude: true,
    after: () => {
      const edited = game.read(temp) ?? '';
      const cleanup = () => game.erase(dir);
      if (edited.replace(/\n$/, '') === original.replace(/\n$/, '')) {
        cleanup();
        game.status = 200;
        return 'File has not changed, exiting.';
      }
      const parsed = store === 'dotenv' ? readDotenv(edited) : [{ key: 'data', value: edited.endsWith('\n') ? edited : `${edited}\n` }];
      cleanup();
      if ('error' in parsed) {
        game.status = 1;
        return `[SOPS]\t ERRO[0000] Could not load tree, probably due to invalid syntax. Press a key to return to the editor, or Ctrl+C to exit.  error="${parsed.error}"`;
      }
      const out = fromModel(encryptFile(parsed, dataKey, recipients, rules, rfc3339(game), nextSeed(game, abs), keepEnc), store);
      const w = writeGo(game, abs, out, file);
      if (w) {
        game.status = 3;
        return `Could not open in-place file for writing: ${w}`;
      }
      return '';
    },
  };
  return '';
}

// ——— updatekeys ———

/** Go's log.Printf: the local date and time first. */
const goLog = (game: Shell, message: string) => {
  const d = new Date(systemd(game)?.clock ?? 0)
    .toISOString()
    .replace(/^(\d+)-(\d+)-(\d+)T(\d+:\d+:\d+).*$/, '$1/$2/$3 $4');
  return `${d} ${message}`;
};

function updateKeysAction(game: Shell, f: Flags): string {
  const configPath = f.config ? game.resolve(f.config) : findConfig(game, game.cwd);
  if (!configPath) return fail(game, 'config file not found', 1);
  if (!f.files.length) return fail(game, 'Error: no file specified', 100);
  const c = readGo(game, configPath, f.config ?? configPath);
  if ('error' in c) return fail(game, `could not read config file: ${c.error}`, 1);
  const rules = readSopsConfig(c.text);
  if (rules !== null && 'error' in rules) return fail(game, rules.error, 1);
  const files = [...f.files];
  const out: string[] = [];
  let failed = 0;
  const one = (file: string): string | null => {
    const abs = game.resolve(file);
    game.error(goLog(game, `Syncing keys for file ${abs}`));
    const node = game.find(abs);
    if (!node) {
      failed++;
      return fail(game, `stat ${abs}: no such file or directory`, 1);
    }
    if (node.type === 'directory') {
      failed++;
      return fail(game, "can't operate on a directory", 1);
    }
    const store = storeOf(abs, f.inputType);
    if (typeof store !== 'string') return fail(game, store.error, 1);
    const r = readGo(game, abs);
    if ('error' in r) return fail(game, `Error reading file: ${r.error}`, 2);
    const o = openFile(toModel(r.text, store, true));
    if ('error' in o) {
      failed++;
      return fail(game, o.error, o.code);
    }
    if (rules === null) return fail(game, `The config file ${configPath} does not contain any creation rule`, 1);
    const rule = ruleFor(rules, configPath, abs);
    if (!rule) {
      failed++;
      return fail(game, 'error loading config: no matching creation rules found', 1);
    }
    for (const a of rule.age) {
      const p = parseRecipient(a);
      if (typeof p !== 'string') return fail(game, `failed to parse input as Bech32-encoded age public key: ${p.error}`, 1);
    }
    const have = o.metadata.recipients.map((x) => x.recipient);
    const common = have.filter((x) => rule.age.includes(x));
    const added = rule.age.filter((x) => !have.includes(x));
    const removed = have.filter((x) => !rule.age.includes(x));
    if (!added.length && !removed.length) {
      game.error(goLog(game, `File ${abs} already up to date`));
      game.status = 0;
      return null;
    }
    out.push(["The following changes will be made to the file's groups:", 'Group 1', ...common.map((x) => `    ${x}`), ...added.map((x) => `+++ ${x}`), ...removed.map((x) => `--- ${x}`)].join('\n'));
    const apply = () => {
      const d = decryptFile(toModel(r.text, store, true), loadIdentities(game), true);
      if ('error' in d) return fail(game, d.error, 128);
      // The data key is the same: only the keys that wrap it change (UpdateMasterKeys).
      const items = (readDotenv(toModel(r.text, store, true)) as Item[]).filter((i) => i.comment || !i.key.startsWith('sops_'));
      const keep = o.metadata.recipients.filter((x) => rule.age.includes(x.recipient));
      const seed = nextSeed(game, abs);
      const recipients = rule.age.map((x) => keep.find((k) => k.recipient === x) ?? { recipient: x, enc: wrapKey(d.dataKey, x, seed) });
      const text = emitDotenv([...items, ...metaWith(o.metadata, recipients)]);
      const w = writeGo(game, abs, fromModel(text, store), file);
      if (w) return fail(game, `could not open file for writing: ${w}`, 1);
      game.error(goLog(game, `File ${abs} synced with new keys`));
      game.status = 0;
      return null;
    };
    if (f.yes) return apply();
    return 'ask';
  };
  // Each file in turn; without -y, a question for each one that changes.
  const next = (): string => {
    while (files.length) {
      const file = files.shift()!;
      const r = one(file);
      if (r === 'ask') {
        const shown = out.join('\n');
        out.length = 0;
        const abs = game.resolve(file);
        game.question = {
          prompt: 'Is this okay? (y/n):',
          answer: (response) => {
            game.question = null;
            const a = response.trim();
            if (a === 'y') {
              f.yes = true;
              const res = one(file);
              f.yes = false;
              void res;
            } else if (a === 'n') game.error(goLog(game, `File ${abs} left unchanged`));
            else {
              // Anything else: the question again (fmt.Scanln until y or n).
              files.unshift(file);
            }
            return next();
          },
        };
        return shown;
      }
    }
    if (failed && f.files.length > 1) return fail(game, `failed updating ${failed} key(s)`, 1);
    const shown = out.join('\n');
    out.length = 0;
    return shown;
  };
  return next();
}

const metaWith = (m: Metadata, recipients: Metadata['recipients']) => metadataItems({ ...m, recipients });

// ——— sops ———

function sops(game: Shell, args: string[]): string {
  const sub = ['encrypt', 'decrypt', 'edit', 'rotate', 'updatekeys', 'set', 'filestatus', 'help', 'h'].includes(args[0] ?? '') ? args[0] : null;
  const f = parseFlags(sub ? args.slice(1) : args);
  if ('error' in f) return fail(game, `Incorrect Usage. ${f.error}\n\n${USAGE}`, 1);
  for (const x of f.ignored)
    game.error(`[SOPS]\t WARN[0000] Note that one of the ignored positional argument is "${x}", which looks like a flag. Flags must always be provided before the first positional argument!`);
  if (f.help || sub === 'help' || sub === 'h') return USAGE;
  if (f.version)
    return f.disableVersionCheck
      ? `sops ${SOPS_VERSION}`
      : `sops ${SOPS_VERSION}\n[warning] failed to retrieve latest version from upstream: Get "https://api.github.com/repos/getsops/sops/releases/latest": dial tcp: lookup api.github.com: Temporary failure in name resolution\n\n[warning] Note that in a future version, sops will no longer check whether the current version is the latest when asking for sops' version. If you want to check for the latest version, use --check-for-updates instead.`;
  if (sub === 'updatekeys') return updateKeysAction(game, f);
  if (sub === 'set') {
    if (f.files.length !== 3) return fail(game, 'Error: no file specified, or index and value are missing', 100);
    const store = storeOf(f.files[0], f.inputType);
    if (typeof store !== 'string') return fail(game, store.error, 1);
    return setAction(game, f, f.files[0], f.files[1], f.files[2], store);
  }
  const file = f.files[0];
  if (!file) {
    if (!sub && !f.encrypt && !f.decrypt && !f.rotate) return USAGE;
    return fail(game, 'Error: no file specified', 100);
  }
  if (f.inPlace && f.output) return fail(game, 'Error: cannot operate on both --output and --in-place', 8);
  const store = storeOf(file, f.inputType);
  if (typeof store !== 'string') return fail(game, store.error, 1);
  if (sub === 'filestatus') {
    const r = readGo(game, file);
    if ('error' in r) return fail(game, `Error reading file: ${r.error}`, 2);
    return JSON.stringify({ encrypted: !('error' in openFile(toModel(r.text, store, true))) });
  }
  if (sub === 'encrypt' || f.encrypt) return encryptAction(game, f, file, store);
  if (sub === 'decrypt' || f.decrypt) return decryptAction(game, f, file, store);
  if (sub === 'rotate' || f.rotate) return rotateAction(game, f, file, store);
  return editAction(game, f, file, store);
}

// ——— age-keygen ———

const AGE_USAGE = `Usage:
    age-keygen [-o OUTPUT]
    age-keygen -y [-o OUTPUT] [INPUT]

Options:
    -o, --output OUTPUT       Write the result to the file at path OUTPUT.
    -y                        Convert an identity file to a recipients file.

age-keygen generates a new native X25519 key pair, and outputs it to
standard output or to the OUTPUT file.

If an OUTPUT file is specified, the public key is printed to standard error.
If OUTPUT already exists, it is not overwritten.

In -y mode, age-keygen reads an identity file from INPUT or from standard
input and writes the corresponding recipient(s) to OUTPUT or to standard
output, one per line, with no comments.

Examples:

    $ age-keygen
    # created: 2021-01-02T15:30:45+01:00
    # public key: age1lvyvwawkr0mcnnnncaghunadrqkmuf9e6507x9y920xxpp866cnql7dp2z
    AGE-SECRET-KEY-1N9JEPW6DWJ0ZQUDX63F5A03GX8QUW7PXDE39N8UYF82VZ9PC8UFS3M7XA9

    $ age-keygen -o key.txt
    Public key: age1ql3z7hjy54pw3hyww5ayyfg7zqgvc7w3j2elw8zmrj2kg5sfn9aqmcac8p

    $ age-keygen -y key.txt
    age1ql3z7hjy54pw3hyww5ayyfg7zqgvc7w3j2elw8zmrj2kg5sfn9aqmcac8p`;

const REPORT = 'age-keygen: report unexpected or unhelpful errors at https://filippo.io/age/report';

function ageKeygen(game: Shell, args: string[], input: string | null, last: boolean): string {
  const failGo = (message: string) => game.error(`age-keygen: error: ${message}\n${REPORT}`, 1);
  let out = '';
  let convert = false;
  const rest: string[] = [];
  for (let k = 0; k < args.length; k++) {
    const a = args[k];
    const m = /^--?([\w-]+)(?:=(.*))?$/.exec(a);
    if (!m || a === '-') {
      rest.push(a);
      continue;
    }
    if (m[1] === 'o' || m[1] === 'output') {
      const v = m[2] ?? args[++k];
      if (v === undefined) return game.error(`flag needs an argument: -${m[1]}\n${AGE_USAGE}`, 2);
      out = v;
    } else if (m[1] === 'y') convert = true;
    else if (m[1] === 'version') return `v${AGE_VERSION}`;
    else if (m[1] === 'h' || m[1] === 'help') {
      game.error(AGE_USAGE);
      game.status = 0;
      return '';
    } else return game.error(`flag provided but not defined: -${m[1]}\n${AGE_USAGE}`, 2);
  }
  if (rest.length && !convert) return failGo('too many arguments');
  if (rest.length > 1) return failGo('too many arguments');
  if (out) {
    // os.O_CREATE|os.O_EXCL, 0600: an existing file is never overwritten.
    const abs = game.resolve(out);
    const n = game.find(abs);
    if (n) return failGo(`failed to open output file "${out}": open ${out}: file exists`);
    const parent = game.find(parentOf(abs));
    if (!parent || parent.type !== 'directory') return failGo(`failed to open output file "${out}": open ${out}: no such file or directory`);
    if (!game.traverses(abs) || !game.can(parent, 'w') || !game.can(parent, 'x')) return failGo(`failed to open output file "${out}": open ${out}: permission denied`);
  }
  let result: string;
  if (convert) {
    let text: string;
    if (rest[0] && rest[0] !== '-') {
      const r = readGo(game, rest[0]);
      if ('error' in r) return failGo(`failed to open input file "${rest[0]}": ${r.error}`);
      text = r.text;
    } else text = input ?? '';
    const ids = parseIdentities(text);
    if ('error' in ids) return ids.error === 'no secret keys found' ? failGo('no identities found in the input') : failGo(`failed to parse input: ${ids.error}`);
    result = ids.recipients.map((r) => `${r}\n`).join('');
  } else {
    const k = ageKey(nextSeed(game, `${game.who}:keygen`));
    result = identityFile(k, rfc3339(game));
    // The public key on the error output when the output isn't a terminal.
    if (out || !last) {
      game.error(`Public key: ${k.public}`);
      if (!out && !game.inPipeline) game.error('age-keygen: warning: writing secret key to a world-readable file');
      game.status = 0;
    }
  }
  if (out) {
    const e = writeGo(game, out, result, out, 'rw-------', true);
    if (e) return failGo(`failed to open output file "${out}": ${e}`);
    return '';
  }
  return result.replace(/\n$/, '');
}

export const SECRETS: Record<string, Command> = {
  sops: { ownOptions: true, launch: ({ args, game }) => sops(game, args) },
  'age-keygen': { ownOptions: true, launch: ({ args, game, input, last }) => ageKeygen(game, args, input, last) },
};

