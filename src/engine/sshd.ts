// A machine's SSH server (sshd): /etc/ssh/sshd_config read like OpenSSH
// (https://man.openbsd.org/sshd_config):
//   - case-insensitive keywords, "#" comments;
//   - Include, with wildcards, read where it appears;
//   - for each keyword, the FIRST value read wins: a sshd_config.d file
//     included at the top (as on Debian) wins over what follows;
//   - except Port, which can be repeated: sshd listens on each (the ports
//     are kept separated by spaces in values.port).
// The applied configuration is the one loaded at the ssh service's last
// start or reload (state.sshd.load), not the file's.

import type { Game } from './shell';
import { wildcard } from './tools';

export const CONFIG = '/etc/ssh/sshd_config';

// The keywords the game knows, and their allowed values (null: free).
const NOT_YES = ['yes', 'no'];
const KEYS_WORDS: Record<string, string[] | null> = {
  include: null,
  port: null,
  listenaddress: null,
  permitrootlogin: ['yes', 'prohibit-password', 'without-password', 'forced-commands-only', 'no'],
  passwordauthentication: NOT_YES,
  pubkeyauthentication: NOT_YES,
  kbdinteractiveauthentication: NOT_YES,
  challengeresponseauthentication: NOT_YES,
  permitemptypasswords: NOT_YES,
  usepam: NOT_YES,
  x11forwarding: NOT_YES,
  printmotd: NOT_YES,
  allowusers: null,
  denyusers: null,
  allowgroups: null,
  maxauthtries: null,
  allowtcpforwarding: null,
  allowagentforwarding: null,
  logingracetime: null,
  clientaliveinterval: null,
  acceptenv: null,
  subsystem: null,
  authorizedkeysfile: null,
};

// OpenSSH's defaults (those sshd -T displays).
const DEFAULTS: Record<string, string> = {
  port: '22',
  permitrootlogin: 'prohibit-password',
  passwordauthentication: 'yes',
  pubkeyauthentication: 'yes',
  kbdinteractiveauthentication: 'yes',
  permitemptypasswords: 'no',
  usepam: 'no',
  x11forwarding: 'no',
  printmotd: 'yes',
  maxauthtries: '6',
  logingracetime: '120',
  authorizedkeysfile: '.ssh/authorized_keys .ssh/authorized_keys2',
};

export interface ConfigSshd {
  values: Record<string, string>;
  errors: string[];
}

/** Reads the configuration like sshd -t: effective values and errors. */
export function readConfig(game: Game, path = CONFIG): ConfigSshd {
  const values: Record<string, string> = {};
  const errors: string[] = [];
  let bad = 0;
  const read = (file: string) => {
    const text = game.read(file);
    if (text === null) return;
    text.split('\n').forEach((rawValue, i) => {
      const line = rawValue.replace(/#.*/, '').trim();
      if (!line) return;
      const [word, ...rest] = line.split(/\s+/);
      const key = word.toLowerCase();
      const value = rest.join(' ');
      if (!(key in KEYS_WORDS)) {
        errors.push(`${file}: line ${i + 1}: Bad configuration option: ${word}`);
        bad++;
        return;
      }
      if (key === 'include') {
        for (const pattern of rest) {
          const absolute = pattern.startsWith('/') ? pattern : `/etc/ssh/${pattern}`;
          const k = absolute.lastIndexOf('/');
          const directory = game.find(absolute.slice(0, k));
          const re = wildcard(absolute.slice(k + 1));
          if (directory?.type === 'directory')
            for (const name of Object.keys(directory.children).sort()) if (re.test(name)) read(`${absolute.slice(0, k)}/${name}`);
        }
        return;
      }
      const permittedOnes = KEYS_WORDS[key];
      if (!value || (permittedOnes && !permittedOnes.includes(value.toLowerCase()))) {
        errors.push(value ? `${file} line ${i + 1}: unsupported option "${value}".` : `${file} line ${i + 1}: missing argument.`);
        return;
      }
      if (key === 'port') {
        const n = Number(value);
        if (!/^\d+$/.test(value) || n < 1 || n > 65535) errors.push(`${file} line ${i + 1}: Badly formatted port number.`);
        else if (!values.port?.split(' ').includes(value)) values.port = values.port ? `${values.port} ${value}` : value;
        return;
      }
      if (!(key in values)) values[key] = permittedOnes ? value.toLowerCase() : value;
    });
  };
  read(path);
  if (bad) errors.push(`${path}: terminating, ${bad} bad configuration options`);
  return { values: { ...DEFAULTS, ...values }, errors };
}

/** What sshd -T displays: "keyword value", in lower case. */
export const showConfig = (c: ConfigSshd) =>
  Object.entries(c.values)
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([k, v]) => (k === 'port' ? v.split(' ').map((p) => `port ${p}`) : [`${k} ${v}`]))
    .join('\n');

/** Does the applied configuration let this account in with its key? */
export function allowed(values: Record<string, string>, user: string): boolean {
  if (values.pubkeyauthentication === 'no') return false;
  if (user === 'root' && values.permitrootlogin === 'no') return false;
  const listing = (key: string) => values[key]?.split(/\s+/).filter(Boolean);
  if (listing('denyusers')?.includes(user)) return false;
  const permitted = listing('allowusers');
  if (permitted && !permitted.includes(user)) return false;
  return true;
}

/** The methods ssh announces on refusal: "publickey" or "publickey,password". */
export const methods = (values: Record<string, string>) =>
  [values.pubkeyauthentication !== 'no' && 'publickey', values.passwordauthentication === 'yes' && 'password'].filter(Boolean).join(',');

/** The ports sshd listens on with this configuration. */
export const portsSshd = (values: Record<string, string> | null | undefined): number[] => (values?.port ?? '22').split(' ').map(Number);
