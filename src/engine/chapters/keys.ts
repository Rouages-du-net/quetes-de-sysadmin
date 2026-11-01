// Story "The Community Centre" — chapter "The keys": a
// brand-new account on the gateway, with a temporary password.
// Create your key pair on your workstation (ssh-keygen), put the public key
// on the other side (ssh-copy-id, or by hand in ~/.ssh/authorized_keys), log in
// with the key, then close the door to passwords (PasswordAuthentication
// no, sshd -t, reload) and check that you can still log in.
// Objective checked on the state: sshd applies PasswordAuthentication no, a
// key is authorised for the player, and a key login happened after this
// reload.
// Sources: https://man.openbsd.org/ssh-keygen, https://man.openbsd.org/sshd_config,
// https://manpages.debian.org/bookworm/openssh-client/ssh-copy-id.1.en.html

import { password, path, f, type Chapter } from '../world';
import type { Game } from '../shell';
import { allowed, CONFIG, readConfig } from '../sshd';
import { publicKey, MACHINES } from '../machines';
import { loadSshd, homeAccounts, connectionsBy, homeState, internalHost, M, homeWorld, PASSWORD, sshd, homePlan } from './community-centre';

// The keys authorised for the player on community ("ssh-…" lines).
const authorised = (j: Game) =>
  (j.read(path(j.t, `${M}/.ssh/authorized_keys`)) ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('ssh-'))
    .map((l) => l.split(/\s+/).slice(0, 2).join(' '));
// The keys the game gave (id_kingdom…): ssh doesn't offer them to community.
const DATA = MACHINES.map((m) => publicKey(m).split(' ').slice(0, 2).join(' '));
const youKeys = (j: Game) => authorised(j).filter((c) => !DATA.includes(c));
const withoutPassword = (j: Game) => sshd(j).load.passwordauthentication === 'no';
const closed = (j: Game) => withoutPassword(j) && youKeys(j).length > 0 && allowed(sshd(j).load, j.player);

export const keys: Chapter = {
  id: 'keys',
  number: 1,
  plan: homePlan(),
  commands: [
    'ls',
    'cd',
    'pwd',
    'cat',
    'less',
    'head',
    'tail',
    'grep',
    'id',
    'whoami',
    'chmod',
    'mkdir',
    'nano',
    'sudo',
    'systemctl',
    'journalctl',
    'sshd',
  ],
  home: M,
  welcome: 'email_yasmine.txt',
  names: true,
  final: 'end',
  password: PASSWORD,
  accounts: homeAccounts,
  state: () => homeState(),
  initialise: loadSshd,
  hosts: { wiki: internalHost('wiki', '10.20.0.11'), archives: internalHost('archives', '10.20.0.12') },
  createWorld: (t) =>
    homeWorld(t, { passwords: null, home: { 'email_yasmine.txt': f(t('keys-email-yasmine', { password: password(t, PASSWORD) })) } }),
  events: [
    { id: 'error', condition: (j) => readConfig(j).errors.length > 0, message: (j) => j.t('keys-event-error', { config: CONFIG }) },
    { id: 'locked-out', condition: (j) => withoutPassword(j) && !youKeys(j).length, message: (j) => j.t('keys-event-locked-out') },
    {
      id: 'key-game',
      condition: (j) => authorised(j).some((c) => DATA.includes(c)) && !youKeys(j).length,
      message: (j) => j.t('keys-event-key-game'),
    },
    { id: 'copied', condition: (j) => youKeys(j).length > 0, message: (j) => j.t('keys-event-copied') },
    { id: 'by-key', condition: (j) => connectionsBy(j, 'key') > 0 && !withoutPassword(j), message: (j) => j.t('keys-event-by-key') },
    { id: 'closed', condition: closed, message: (j) => j.t('keys-event-closed') },
    {
      id: 'end',
      condition: (j) => j.flags.has('closed') && closed(j) && connectionsBy(j, 'key') > sshd(j).keysToLoad,
      message: (j) => j.t('keys-event-end'),
    },
  ],
};
