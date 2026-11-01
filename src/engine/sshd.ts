// Le serveur SSH (sshd) d'une machine : lecture de /etc/ssh/sshd_config
// comme OpenSSH (https://man.openbsd.org/sshd_config) :
//   - mots-clés insensibles à la casse, commentaires « # » ;
//   - Include, avec jokers, lu à l'endroit où il apparaît ;
//   - pour chaque mot-clé, la PREMIÈRE valeur lue l'emporte : un fichier de
//     sshd_config.d inclus en tête (comme sur Debian) gagne sur la suite ;
//   - sauf Port, qui peut être répété : sshd écoute sur chacun (les ports
//     sont gardés séparés par des espaces dans valeurs.port).
// La configuration appliquée est celle chargée au dernier démarrage ou
// rechargement du service ssh (etat.sshd.charge), pas celle du fichier.

import type { Game } from './shell';
import { wildcard } from './tools';

export const CONFIG = '/etc/ssh/sshd_config';

// Les mots-clés que le jeu connaît, et leurs valeurs permises (null : libre).
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

// Valeurs par défaut d'OpenSSH (celles que sshd -T affiche).
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

/** Lit la configuration comme sshd -t : valeurs effectives et erreurs. */
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

/** Ce que sshd -T affiche : « mot-clé valeur », en minuscules. */
export const showConfig = (c: ConfigSshd) =>
  Object.entries(c.values)
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([k, v]) => (k === 'port' ? v.split(' ').map((p) => `port ${p}`) : [`${k} ${v}`]))
    .join('\n');

/** La configuration appliquée laisse-t-elle entrer ce compte avec sa clé ? */
export function allowed(values: Record<string, string>, user: string): boolean {
  if (values.pubkeyauthentication === 'no') return false;
  if (user === 'root' && values.permitrootlogin === 'no') return false;
  const listing = (key: string) => values[key]?.split(/\s+/).filter(Boolean);
  if (listing('denyusers')?.includes(user)) return false;
  const permitted = listing('allowusers');
  if (permitted && !permitted.includes(user)) return false;
  return true;
}

/** Les méthodes que ssh annonce en cas de refus : « publickey » ou « publickey,password ». */
export const methods = (values: Record<string, string>) =>
  [values.pubkeyauthentication !== 'no' && 'publickey', values.passwordauthentication === 'yes' && 'password'].filter(Boolean).join(',');

/** Les ports sur lesquels sshd écoute avec cette configuration. */
export const portsSshd = (values: Record<string, string> | null | undefined): number[] => (values?.port ?? '22').split(' ').map(Number);
