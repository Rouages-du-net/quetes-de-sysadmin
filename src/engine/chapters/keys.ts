// Histoire « La Maison des associations » — chapitre « Les clés » : un
// compte tout neuf sur la passerelle, avec un mot de passe provisoire.
// Créer sa paire de clés sur son poste (ssh-keygen), poser la clé publique
// en face (ssh-copy-id, ou à la main dans ~/.ssh/authorized_keys), entrer
// par la clé, puis fermer la porte aux mots de passe (PasswordAuthentication
// no, sshd -t, reload) et vérifier qu'on entre toujours.
// Objectif vérifié sur l'état : sshd applique PasswordAuthentication no, une
// clé est autorisée pour vous, et une connexion par clé a eu lieu après ce
// chargement.
// Sources : https://man.openbsd.org/ssh-keygen, https://man.openbsd.org/sshd_config,
// https://manpages.debian.org/bookworm/openssh-client/ssh-copy-id.1.en.html

import { password, path, f, type Chapter } from '../world';
import type { Game } from '../shell';
import { allowed, CONFIG, readConfig } from '../sshd';
import { publicKey, MACHINES } from '../machines';
import { loadSshd, homeAccounts, connectionsBy, homeState, internalHost, M, homeWorld, PASSWORD, sshd, homePlan } from './community-centre';

// Les clés autorisées pour vous sur maison (lignes « ssh-… »).
const authorised = (j: Game) =>
  (j.read(path(j.t, `${M}/.ssh/authorized_keys`)) ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('ssh-'))
    .map((l) => l.split(/\s+/).slice(0, 2).join(' '));
// Les clés que le jeu a données (id_royaume…) : ssh ne les propose pas à maison.
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
    homeWorld({ passwords: null, home: { 'email_yasmine.txt': f(t('keys-email-yasmine', { motdepasse: password(t, PASSWORD) })) } }),
  events: [
    { id: 'error', condition: (j) => readConfig(j).errors.length > 0, message: (j) => j.t('keys-event-error', { config: CONFIG }) },
    { id: 'locked-out', condition: (j) => withoutPassword(j) && !youKeys(j).length, message: (j) => j.t('keys-event-locked-out') },
    {
      id: 'key-game',
      condition: (j) => authorised(j).some((c) => DATA.includes(c)) && !youKeys(j).length,
      message: (j) => j.t('keys-event-key-game'),
    },
    { id: 'copied', condition: (j) => youKeys(j).length > 0, message: (j) => j.t('keys-event-copied') },
    { id: 'by-key', condition: (j) => connectionsBy(j, 'cle') > 0 && !withoutPassword(j), message: (j) => j.t('keys-event-by-key') },
    { id: 'closed', condition: closed, message: (j) => j.t('keys-event-closed') },
    {
      id: 'end',
      condition: (j) => j.flags.has('closed') && closed(j) && connectionsBy(j, 'cle') > sshd(j).keysToLoad,
      message: (j) => j.t('keys-event-end'),
    },
  ],
};
