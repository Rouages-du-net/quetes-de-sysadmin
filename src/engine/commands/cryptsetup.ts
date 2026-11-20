// cryptsetup (2.7, LUKS2): encrypting a device, opening and closing it,
// its key slots; and Debian's cryptdisks_start / cryptdisks_stop, which open
// what /etc/crypttab describes. The messages and prompts are cryptsetup's
// (https://man7.org/linux/man-pages/man8/cryptsetup.8.html,
// https://gitlab.com/cryptsetup/cryptsetup/-/blob/main/src/cryptsetup.c);
// cryptdisks_start after Debian's cryptsetup package
// (https://salsa.debian.org/cryptsetup-team/cryptsetup/-/tree/debian/latest/debian/scripts).
// The model is in luks.ts.
// Differences: see docs/SCENARIOS.md (cryptsetup): no plain/LUKS1/BitLocker
// modes, no --header, no tokens, no reencrypt, no benchmark; a single try for
// luksAddKey's existing passphrase.

import type { Shell } from '../shell';
import type { Command } from './index';
import { storageOf, type StorageState } from '../storage';
import { systemFor } from '../fstab';
import { hex } from './restic';
import {
  busy,
  close,
  cryptOf,
  deviceFor,
  format,
  freeSlot,
  luksOf,
  mappedBytes,
  mapperUpdate,
  mappingOf,
  open,
  readCrypttab,
  slotFor,
  HEADER_BYTES,
  type Header,
  type Keyslot,
} from '../luks';

const VERSION = 'cryptsetup 2.7.5 flags: UDEV BLKID KEYRING KERNEL_CAPI';
const NO_KEY = 'No key available with this passphrase.';
const DM = 'Cannot initialize device-mapper. Is dm_mod kernel module loaded?\nCannot use device-mapper, name is invalid or still in use.';

/** Asks a hidden question, the answer run as the same user (sudo). */
function secret(game: Shell, prompt: string, then: (typed: string) => string): void {
  const who = game.who;
  game.ask(
    prompt,
    (typed) => {
      const before = game.who;
      game.who = who;
      try {
        return then(typed);
      } finally {
        game.who = before;
      }
    },
    true,
  );
}
function question(game: Shell, prompt: string, then: (typed: string) => string): void {
  const who = game.who;
  game.ask(prompt, (typed) => {
    const before = game.who;
    game.who = who;
    try {
      return then(typed);
    } finally {
      game.who = before;
    }
  });
}

/** An error written as the answer to a prompt: the text, and the exit code. */
function failed(game: Shell, text: string, code: number): string {
  game.status = code;
  game.lastStatus = code;
  return text;
}

interface Parsed {
  positional: string[];
  keyFile?: string;
  newKeyFile?: string;
  headerBackup?: string;
  batch: boolean;
  label?: string;
  readOnly: boolean;
  verbose: boolean;
  type?: string;
  unknown?: string;
}

function parse(args: string[]): Parsed {
  const p: Parsed = { positional: [], batch: false, readOnly: false, verbose: false };
  const valueOf = (i: number, a: string, long: string) => (a.startsWith(`${long}=`) ? [a.slice(long.length + 1), i] as const : [args[i + 1], i + 1] as const);
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-q' || a === '--batch-mode') p.batch = true;
    else if (a === '-v' || a === '--verbose') p.verbose = true;
    else if (a === '--readonly' || a === '-r') p.readOnly = true;
    else if (a === '-d' || a === '--key-file' || a.startsWith('--key-file=')) [p.keyFile, i] = valueOf(i, a, '--key-file');
    else if (a === '--new-keyfile' || a.startsWith('--new-keyfile=')) [p.newKeyFile, i] = valueOf(i, a, '--new-keyfile');
    else if (a === '--label' || a.startsWith('--label=')) [p.label, i] = valueOf(i, a, '--label');
    else if (a === '--header-backup-file' || a.startsWith('--header-backup-file=')) [p.headerBackup, i] = valueOf(i, a, '--header-backup-file');
    else if (a === '-M' || a === '--type' || a.startsWith('--type=')) [p.type, i] = valueOf(i, a, '--type');
    else if (['-y', '--verify-passphrase', '--debug'].includes(a)) continue;
    // Options that only tune the cipher or the key derivation: accepted, the model keeps its defaults.
    else if (['-c', '--cipher', '-s', '--key-size', '-h', '--hash', '--pbkdf', '--iter-time', '-i', '--sector-size'].includes(a)) i++;
    else if (/^--(cipher|key-size|hash|pbkdf|iter-time|sector-size)=/.test(a)) continue;
    else if (a.startsWith('-') && a !== '-') p.unknown ??= a;
    else p.positional.push(a);
  }
  return p;
}

/** Reads a key file (cryptsetup reads it whole); null if it can't. */
function readKey(game: Shell, path: string): string | null {
  const n = game.find(path);
  if (!n || n.type !== 'file' || !game.traverses(path) || !game.can(n, 'r')) return null;
  return game.read(path) ?? '';
}

// The device argument: its /dev path, or cryptsetup's error.
function device(game: Shell, st: StorageState, given: string | undefined): string | null {
  if (!given) {
    game.error('Command requires device as argument.', 1);
    return null;
  }
  const d = deviceFor(st, given);
  if (!d || game.who !== 'root') {
    game.error(`Device ${given} does not exist or access denied.`, 4);
    return null;
  }
  return d;
}

function header(game: Shell, st: StorageState, given: string | undefined): [string, Header] | null {
  const d = device(game, st, given);
  if (!d) return null;
  const h = luksOf(st)[d];
  if (!h) {
    game.error(`Device ${given} is not a valid LUKS device.`, 1);
    return null;
  }
  return [d, h];
}

// ——— luksFormat ———

function luksFormat(game: Shell, st: StorageState, p: Parsed): string {
  const given = p.positional[0];
  const d = device(game, st, given);
  if (!d) return '';
  if (p.type && !/^luks2?$/.test(p.type)) return game.error(game.t('cryptsetup-only-luks2'), 1);
  if (busy(game, st, d)) {
    game.state.luksFormatRefused = d;
    return game.error(`Device ${given} is in use. Can not proceed with format operation.`, 5);
  }
  const keyPath = p.positional[1] ?? p.keyFile;
  let key: Keyslot | null = null;
  if (keyPath) {
    const k = readKey(game, keyPath);
    if (k === null) return game.error('Failed to open key file.', 1);
    key = { kind: 'keyfile', secret: k };
  }
  const seed = `${game.state.luksFormats ?? 0}`;
  const done = (k: Keyslot) => {
    format(st, d, k, seed, p.label);
    game.state.luksFormats = (game.state.luksFormats ?? 0) + 1;
    game.state.luksFormatted = [...((game.state.luksFormatted as string[] | undefined) ?? []), d];
    return '';
  };
  const passphrase = () => {
    if (key) return done(key);
    secret(game, `Enter passphrase for ${given}: `, (first) => {
      secret(game, 'Verify passphrase: ', (second) => (first === second ? done({ kind: 'passphrase', secret: first }) : failed(game, 'Passphrases do not match.', 2)));
      return '';
    });
    return '';
  };
  if (p.batch) return passphrase();
  const old = systemFor(st, d);
  const table = st.disks[d.replace(/^\/dev\//, '')]?.table;
  // cryptsetup 2.7 (checked on a file image): one line per signature found,
  // then a blank line and the warning; the blank line comes first otherwise.
  const warning = [
    ...(old ? [`WARNING: Device ${given} already contains a '${old.type}' superblock signature.`] : []),
    ...(table ? [`WARNING: Device ${given} already contains a 'gpt' partition signature.`] : []),
    '',
    'WARNING!',
    '========',
    `This will overwrite data on ${given} irrevocably.`,
    '',
  ].join('\n');
  question(game, "Are you sure? (Type 'yes' in capital letters): ", (typed) => {
    if (typed !== 'YES') {
      game.state.luksFormatAborted = typed;
      return failed(game, 'Operation aborted.', 1);
    }
    return passphrase();
  });
  return warning;
}

// ——— open ———

function luksOpen(game: Shell, st: StorageState, p: Parsed, by: string): string {
  if (p.type && !/^luks2?$/.test(p.type)) return game.error(game.t('cryptsetup-only-luks2'), 1);
  const [given, name] = p.positional;
  if (!name) return game.error(`Command requires device and mapped name as arguments.`, 1);
  const found = header(game, st, given);
  if (!found) return '';
  const [d, h] = found;
  if (cryptOf(st)[name]) return game.error(`Device ${name} already exists.`, 5);
  if (mappingOf(st, d) || busy(game, st, d)) return game.error(`Cannot use device ${given} which is in use (already mapped or mounted).`, 5);
  const opened = (slot: number) => {
    open(st, d, name, slot);
    mapperUpdate(game);
    game.state.luksOpened = [...((game.state.luksOpened as string[] | undefined) ?? []), `${name}:${h.slots[slot].kind}`];
    return '';
  };
  if (p.keyFile) {
    const k = readKey(game, p.keyFile);
    if (k === null) return game.error('Failed to open key file.', 1);
    const slot = slotFor(h, k);
    if (slot === null) return game.error(NO_KEY, 2);
    return opened(slot);
  }
  const attempt = (left: number) =>
    secret(game, `Enter passphrase for ${by === 'crypttab' ? name : given}: `, (typed) => {
      const slot = slotFor(h, typed);
      if (slot !== null) return opened(slot);
      game.state.luksWrongPassphrase = true;
      if (left > 1) {
        attempt(left - 1);
        return NO_KEY;
      }
      return failed(game, NO_KEY, 2);
    });
  attempt(3);
  return '';
}

// ——— close, status ———

const mappingName = (given: string) => given.replace(/^\/dev\/mapper\//, '');

function luksClose(game: Shell, st: StorageState, p: Parsed): string {
  const given = p.positional[0];
  if (!given) return game.error('Command requires device as argument.', 1);
  if (game.who !== 'root') return game.error(DM, 4);
  const name = mappingName(given);
  if (!cryptOf(st)[name]) return game.error(`Device ${name} is not active.`, 4);
  const mounts = (game.state.mounts ?? []) as { name: string }[];
  if (mounts.some((m) => m.name === `/dev/mapper/${name}`)) {
    game.state.luksCloseBusy = true;
    return game.error(`Device ${name} is still in use.`, 5);
  }
  close(st, name);
  mapperUpdate(game);
  return '';
}

function status(game: Shell, st: StorageState, p: Parsed): string {
  const given = p.positional[0];
  if (!given) return game.error('Command requires device as argument.', 1);
  if (game.who !== 'root') return game.error(DM, 4);
  const name = mappingName(given);
  const m = cryptOf(st)[name];
  if (!m) {
    game.status = 4;
    return `/dev/mapper/${name} is inactive.`;
  }
  const mounted = ((game.state.mounts ?? []) as { name: string }[]).some((x) => x.name === `/dev/mapper/${name}`);
  return [
    `/dev/mapper/${name} is active${mounted ? ' and is in use' : ''}.`,
    '  type:    LUKS2',
    '  cipher:  aes-xts-plain64',
    '  keysize: 512 bits',
    '  key location: keyring',
    `  device:  ${m.device}`,
    '  sector size:  512',
    `  offset:  ${HEADER_BYTES / 512} sectors`,
    `  size:    ${mappedBytes(st, m.device) / 512} sectors`,
    '  mode:    read/write',
  ].join('\n');
}

// ——— luksDump ———

function luksDump(game: Shell, st: StorageState, p: Parsed): string {
  const found = header(game, st, p.positional[0]);
  if (!found) return '';
  const [, h] = found;
  const salt = (n: number | string) => hex(`salt-${h.uuid}-${n}`, 64).replace(/(..)/g, '$1 ').trim().replace(/((?:.. ){15}..) /g, '$1\n\t            ');
  const slots = Object.keys(h.slots)
    .map(Number)
    .sort((a, b) => a - b)
    .flatMap((n) => [
      `  ${n}: luks2`,
      '\tKey:        512 bits',
      '\tPriority:   normal',
      '\tCipher:     aes-xts-plain64',
      '\tCipher key: 512 bits',
      '\tPBKDF:      argon2id',
      '\tTime cost:  4',
      '\tMemory:     1048576',
      '\tThreads:    4',
      `\tSalt:       ${salt(n)}`,
      '\tAF stripes: 4000',
      '\tAF hash:    sha256',
      `\tArea offset:${32768 + n * 258048} [bytes]`,
      '\tArea length:258048 [bytes]',
      '\tDigest ID:  0',
    ]);
  return [
    'LUKS header information',
    'Version:       \t2',
    `Epoch:         \t${h.epoch}`,
    'Metadata area: \t16384 [bytes]',
    'Keyslots area: \t16744448 [bytes]',
    `UUID:          \t${h.uuid}`,
    `Label:         \t${h.label ?? '(no label)'}`,
    'Subsystem:     \t(no subsystem)',
    'Flags:       \t(no flags)',
    '',
    'Data segments:',
    '  0: crypt',
    `\toffset: ${HEADER_BYTES} [bytes]`,
    '\tlength: (whole device)',
    '\tcipher: aes-xts-plain64',
    '\tsector: 512 [bytes]',
    '',
    'Keyslots:',
    ...slots,
    'Tokens:',
    'Digests:',
    '  0: pbkdf2',
    '\tHash:       sha256',
    '\tIterations: 129774',
    `\tSalt:       ${salt('digest')}`,
    `\tDigest:     ${hex(`digest-${h.uuid}`, 64).replace(/(..)/g, '$1 ').trim().replace(/((?:.. ){15}..) /g, '$1\n\t            ')}`,
  ].join('\n');
}

// ——— Key slots ———

/** Authenticates with an existing key (a key file, or the prompt), then runs `then` with the slot. */
function authenticate(game: Shell, h: Header, p: Parsed, prompt: string, then: (slot: number) => string): string {
  if (p.keyFile) {
    const k = readKey(game, p.keyFile);
    if (k === null) return game.error('Failed to open key file.', 1);
    const slot = slotFor(h, k);
    if (slot === null) return game.error(NO_KEY, 2);
    return then(slot);
  }
  secret(game, prompt, (typed) => {
    const slot = slotFor(h, typed);
    if (slot === null) {
      game.state.luksWrongPassphrase = true;
      return failed(game, NO_KEY, 2);
    }
    return then(slot);
  });
  return '';
}

function luksAddKey(game: Shell, st: StorageState, p: Parsed): string {
  const found = header(game, st, p.positional[0]);
  if (!found) return '';
  const [d, h] = found;
  const newPath = p.positional[1] ?? p.newKeyFile;
  let newKey: string | null = null;
  if (newPath) {
    newKey = readKey(game, newPath);
    if (newKey === null) return game.error('Failed to open key file.', 1);
  }
  if (freeSlot(h) === null) return game.error('All key slots full.', 1);
  const add = (k: Keyslot) => {
    const slot = freeSlot(h)!;
    h.slots[slot] = k;
    h.epoch++;
    game.state.luksKeyAdded = [...((game.state.luksKeyAdded as string[] | undefined) ?? []), `${d}:${k.kind}`];
    return p.verbose ? `Key slot ${slot} created.\nCommand successful.` : '';
  };
  return authenticate(game, h, p, 'Enter any existing passphrase: ', () => {
    if (newKey !== null) return add({ kind: 'keyfile', secret: newKey });
    secret(game, 'Enter new passphrase for key slot: ', (first) => {
      secret(game, 'Verify passphrase: ', (second) => (first === second ? add({ kind: 'passphrase', secret: first }) : failed(game, 'Passphrases do not match.', 2)));
      return '';
    });
    return '';
  });
}

function removeSlot(game: Shell, h: Header, slot: number, batch: boolean): string {
  const remove = () => {
    delete h.slots[slot];
    h.epoch++;
    game.state.luksKeyRemoved = (game.state.luksKeyRemoved ?? 0) + 1;
    return '';
  };
  if (Object.keys(h.slots).length > 1 || batch) return remove();
  // cryptsetup 2.7 (checked on a file image): the keyslot kept, exit code 2.
  question(game, "Are you sure? (Type 'yes' in capital letters): ", (typed) => (typed === 'YES' ? remove() : failed(game, 'Operation aborted, the keyslot was NOT wiped.', 2)));
  return '\nWARNING!\n========\nThis is the last keyslot. Device will become unusable after purging this key.\n';
}

function luksRemoveKey(game: Shell, st: StorageState, p: Parsed): string {
  const found = header(game, st, p.positional[0]);
  if (!found) return '';
  const [, h] = found;
  const path = p.positional[1] ?? p.keyFile;
  if (path) {
    const k = readKey(game, path);
    if (k === null) return game.error('Failed to open key file.', 1);
    const slot = slotFor(h, k);
    if (slot === null) return game.error(NO_KEY, 2);
    return removeSlot(game, h, slot, p.batch);
  }
  secret(game, 'Enter passphrase to be deleted: ', (typed) => {
    const slot = slotFor(h, typed);
    if (slot === null) return failed(game, NO_KEY, 2);
    const out = removeSlot(game, h, slot, p.batch);
    return out;
  });
  return '';
}

function luksKillSlot(game: Shell, st: StorageState, p: Parsed): string {
  const found = header(game, st, p.positional[0]);
  if (!found) return '';
  const [, h] = found;
  const n = Number(p.positional[1]);
  if (p.positional[1] === undefined || !Number.isInteger(n)) return game.error('Command requires device and key slot number as arguments.', 1);
  if (!h.slots[n]) return game.error(`Keyslot ${n} is not active.`, 1);
  if (Object.keys(h.slots).length === 1) return removeSlot(game, h, n, p.batch);
  const kill = (slot: number) => (slot === n ? failed(game, NO_KEY, 2) : removeSlot(game, h, n, true));
  return authenticate(game, h, p, 'Enter any remaining passphrase: ', kill);
}

// ——— The command ———

function cryptsetup(game: Shell, args: string[]): string {
  if (args.includes('--version') || args.includes('-V')) return VERSION;
  const p = parse(args);
  if (p.unknown) return game.error(`cryptsetup: ${p.unknown}: unknown option\nUsage: cryptsetup [-?vyrqVDIMPTcsdhlwSbo] [OPTION...] <action> <action-specific>`, 1);
  const action = p.positional.shift();
  const st = storageOf(game);
  if (!action) return game.error(game.t('cryptsetup-usage'), 1);
  if (!st) return game.error(`Device ${p.positional[0] ?? ''} does not exist or access denied.`, 4);
  switch (action) {
    case 'luksFormat':
      return luksFormat(game, st, p);
    case 'open':
    case 'luksOpen':
      return luksOpen(game, st, p, 'command');
    case 'close':
    case 'luksClose':
    case 'remove':
      return luksClose(game, st, p);
    case 'status':
      return status(game, st, p);
    case 'luksDump':
      return luksDump(game, st, p);
    case 'luksAddKey':
      return luksAddKey(game, st, p);
    case 'luksRemoveKey':
      return luksRemoveKey(game, st, p);
    case 'luksKillSlot':
      return luksKillSlot(game, st, p);
    case 'luksHeaderBackup': {
      const found = header(game, st, p.positional[0]);
      if (!found) return '';
      if (!p.headerBackup) return game.error('Command requires device and header backup file as arguments.', 1);
      if (game.exists(p.headerBackup)) return game.error(`Requested header backup file ${p.headerBackup} already exists.`, 1);
      // The header itself (16 MiB): its UUID and its slots, unreadable without a key.
      const refused = game.place('cryptsetup', p.headerBackup, {
        type: 'file',
        content: `LUKS\u00ba\u00be\u0000\u0002${found[1].uuid}`,
        size: HEADER_BYTES,
        charset: 'binary',
        owner: game.who,
        mode: 'r--------',
      });
      if (refused) return game.error(`Cannot write header backup file ${p.headerBackup}.`, 1);
      game.state.luksHeaderBackup = game.resolve(p.headerBackup);
      return '';
    }
    case 'isLuks': {
      const d = deviceFor(st, p.positional[0] ?? '');
      if (!d || !luksOf(st)[d]) {
        game.status = 1;
        return p.verbose ? `Device ${p.positional[0] ?? ''} is not a valid LUKS device.` : '';
      }
      return p.verbose ? 'Command successful.' : '';
    }
    case 'luksUUID': {
      const found = header(game, st, p.positional[0]);
      return found ? found[1].uuid : '';
    }
    default:
      return game.error(`Unknown action.`, 1);
  }
}

// ——— cryptdisks_start / cryptdisks_stop (Debian) ———
// Their texts follow Debian's scripts (cryptsetup 2.7, /usr/sbin/cryptdisks_start,
// /lib/cryptsetup/cryptdisks-functions and functions) and the LSB logging of
// /lib/lsb/init-functions: log_action_begin_msg prints "TEXT...",
// device_msg "NAME (STATE)...", log_action_end_msg "done." or "failed.",
// log_warning_msg "TEXT ... (warning).", cryptsetup_message "cryptsetup: TEXT"
// on stderr, folded at 80 columns (fold -s) with following lines indented.

/** cryptsetup_message of Debian's functions: one line, or folded like fold -s | sed '1! s/^/    /'. */
function cryptsetupMessage(text: string): string {
  const line = `cryptsetup: ${text}`;
  if (text.length < 70) return line;
  const out: string[] = [];
  let rest = line;
  while (rest.length > 80) {
    const cut = rest.lastIndexOf(' ', 79);
    const at = cut < 0 ? 80 : cut + 1;
    out.push(rest.slice(0, at).trimEnd());
    rest = rest.slice(at);
  }
  out.push(rest);
  return out.map((l, i) => (i ? `    ${l}` : l)).join('\n');
}

function cryptdisks(game: Shell, args: string[], start: boolean): string {
  const self = start ? 'cryptdisks_start' : 'cryptdisks_stop';
  // $0 is the path the script was run from.
  const usage = start
    ? `Usage: /usr/sbin/cryptdisks_start [-r|--readonly] <name> [.. <name>]\n\nreads /etc/crypttab and starts the mapping corresponding to <name>`
    : `usage: /usr/sbin/cryptdisks_stop <name>\n\nreads /etc/crypttab and stops the mapping corresponding to <name>`;
  const names: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!start) {
      names.push(a);
      continue;
    }
    if (names.length || a === '--') {
      names.push(...args.slice(a === '--' ? i + 1 : i));
      break;
    }
    if (a === '-r' || a === '--readonly') continue;
    if (a === '-h' || a === '--help' || a === '-?') return failed(game, usage, 0);
    if (a.startsWith('-')) return game.error(`Error: unknown option '${a}'\n${usage}`, 1);
    names.push(a);
  }
  const name = names[0];
  if (!name) return game.error(usage, 1);
  if (game.who !== 'root') return game.error(`/usr/sbin/${self} needs root privileges ... (warning).`, 1);
  const st = storageOf(game);
  const title = start ? 'Starting crypto disk...' : 'Stopping crypto disk...';
  if (!start) {
    // remove_mapping doesn't read crypttab: only the mapping's name counts.
    if (!st || !cryptOf(st)[name]) return `${title}${name} (stopped)...done.`;
    if (((game.state.mounts ?? []) as { name: string }[]).some((m) => m.name === `/dev/mapper/${name}`)) return game.error(`${title}${name} (busy)...failed.`, 1);
    close(st, name);
    mapperUpdate(game);
    return `${title}${name} (stopping)...done.`;
  }
  const entry = readCrypttab(game.read('/etc/crypttab') ?? '').find((e) => e.name === name);
  if (!st || !entry) return game.error(`${title}${name} (failed, not found in crypttab)...failed.`, 1);
  if (cryptOf(st)[name]) return `${title}${name} (running)...done.`;
  const d = deviceFor(st, entry.source);
  const h = d ? luksOf(st)[d] : undefined;
  if (!d || !h) return game.error(`${title}${name} (skipped, device ${entry.source} does not exist)...failed.`, 1);
  const inUse = () => !!mappingOf(st, d);
  const opened = (slot: number) => {
    open(st, d, name, slot);
    mapperUpdate(game);
    game.state.luksOpened = [...((game.state.luksOpened as string[] | undefined) ?? []), `${name}:${h.slots[slot].kind}`];
  };
  // cryptsetup's own message when a try fails, null when the mapping is open.
  const attempt = (key: string | null): string | null => {
    if (key === null) return 'Failed to open key file.';
    const slot = slotFor(h, key);
    if (slot === null) return NO_KEY;
    if (inUse()) return `Cannot use device ${entry.source} which is in use (already mapped or mounted).`;
    opened(slot);
    return null;
  };
  if (entry.key !== 'none' && entry.key !== '-') {
    // crypttab_key_check: a missing key file only warns; a key file not owned
    // by root, or that its group or others can use, warns too (mode %04a not ending in 00).
    const n = game.find(entry.key);
    let warning = '';
    if (!n || n.type !== 'file') warning = `${cryptsetupMessage(`WARNING: ${name}: keyfile '${entry.key}' not found`)}\n`;
    else if (n.owner !== 'root' || !/^...------$/.test(n.mode ?? 'rw-r--r--')) {
      warning = `${cryptsetupMessage(`WARNING: ${name}: key file ${entry.key} has insecure ownership, see /usr/share/doc/cryptsetup/README.Debian.gz.`)}\n`;
      game.state.cryptdisksInsecure = true;
    }
    // With a key file, a single try (tries=1).
    const problem = attempt(n && n.type === 'file' ? (game.read(entry.key) ?? '') : null);
    if (problem) return game.error(`${title}${warning}${name} (starting)...${problem}\n${name} (failed)...failed.`, 1);
    return `${title}${warning}${name} (starting)...${name} (started)...done.`;
  }
  // Asked with askpass, three tries by default.
  const ask = (left: number) =>
    secret(game, `Please unlock disk ${name}: `, (typed) => {
      const problem = attempt(typed);
      if (!problem) return `${name} (started)...done.`;
      if (left > 1) {
        ask(left - 1);
        return problem;
      }
      return failed(game, `${problem}\n${name} (failed)...failed.`, 1);
    });
  ask(3);
  return `${title}${name} (starting)...`;
}

export const CRYPTSETUP: Record<string, Command> = {
  cryptsetup: { section: 8, ownOptions: true, launch: ({ args, game }) => cryptsetup(game, args) },
  cryptdisks_start: { section: 8, ownOptions: true, launch: ({ args, game }) => cryptdisks(game, args, true) },
  cryptdisks_stop: { section: 8, ownOptions: true, launch: ({ args, game }) => cryptdisks(game, args, false) },
  // The page of /etc/crypttab (man 5 crypttab).
  crypttab: { section: 5, launch: () => '' },
};
