// Story "The Community Centre" — chapter "The Jump": the wiki can only be
// reached from the gateway. Gaspard connected in two steps (ssh community,
// then ssh wiki), with a copy of his private key on community. Jump from
// the workstation (ssh -J community wiki), without leaving a private key on
// the gateway, then write the shortcut (ProxyJump in ~/.ssh/config) so that
// "ssh wiki" is enough.
// Objective checked on the state: a key-based connection to the wiki, a
// Host block in the workstation's ~/.ssh/config that leads there by jumping
// through community (checked the way ssh sees it: HostName resolved by
// community, ProxyJump), and no private key in community's ~/.ssh.
// Sources: https://man.openbsd.org/ssh#J, https://man.openbsd.org/ssh_config#ProxyJump

import { path, d, f, type Chapter, type Directory } from '../world';
import { hostInLanguage } from '../machines';
import type { Game, Shell } from '../shell';
import { configuration, resolveName } from '../access';
import { loadSshd, homeAccounts, connectionsBy, sshDirectory, homeState, internalHost, M, homeWorld, PASSWORD, homePlan } from './community-centre';

const WIKI = '10.20.0.11';
const INTERNAL_COMMANDS = ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'id', 'whoami', 'hostname'];

const workstation = (j: Game) => (j.state.workstation as (() => Shell) | undefined)?.();
const wiki = (j: Game) => (j as Shell).internal('wiki');
const connectionsToWiki = (j: Game) => (wiki(j) ? connectionsBy(wiki(j)!, 'key') : 0);

// The names written in a Host block of the workstation's ~/.ssh/config (no wildcards).
function alias(p: Shell): string[] {
  return (p.read('~/.ssh/config') ?? '')
    .split('\n')
    .map((l) => l.trim().split(/\s+/))
    .filter(([key]) => key?.toLowerCase() === 'host')
    .flatMap(([, ...names]) => names.filter((n) => !/[*?!]/.test(n)));
}

// A shortcut on the workstation that leads to the wiki by jumping through community.
const shortcut = (j: Game) => {
  const p = workstation(j);
  if (!p) return false;
  return alias(p).some((a) => {
    const c = configuration(p, a);
    const hop = c.proxyjump?.[0]?.split(',').at(-1)?.split('@').at(-1);
    if (!hop || !['community', 'community.internal', '192.0.2.19'].map((n) => hostInLanguage(j.t, n)).includes(hop)) return false;
    return resolveName(j as Shell, (c.hostname?.[0] ?? a).toLowerCase()) === WIKI;
  });
};

// A private key left in community's ~/.ssh.
const privateKeyOnHome = (j: Game) => {
  const ssh = j.find(path(j.t, `${M}/.ssh`)) as Directory | null;
  if (ssh?.type !== 'directory') return false;
  return Object.keys(ssh.children).some((n) => (j.read(`${path(j.t, M)}/.ssh/${n}`) ?? '').includes('PRIVATE KEY'));
};

export const jump: Chapter = {
  id: 'jump',
  number: 2,
  plan: homePlan(),
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'id', 'whoami', 'hostname', 'chmod', 'rm', 'nano', 'ssh'],
  home: M,
  welcome: 'email_yasmine.txt',
  names: true,
  final: 'end',
  password: PASSWORD,
  accounts: homeAccounts,
  playerKeys: true,
  watchesWorkstation: true,
  state: () => homeState(),
  initialise: loadSshd,
  hosts: {
    wiki: internalHost('wiki', WIKI, {
      commands: INTERNAL_COMMANDS,
      home: (t) => ({ 'note_gaspard.txt': f(t('jump-note-gaspard')) }),
      more: (t) => ({ srv: d({ wiki: d({ pages: d({ 'home.md': f(t('jump-wiki-welcome')) }) }) }, undefined, { owner: 'root' }) }),
    }),
    archives: internalHost('archives', '10.20.0.12', { commands: INTERNAL_COMMANDS }),
  },
  createWorld: (t) => homeWorld(t, { passwords: 'no', home: { 'email_yasmine.txt': f(t('jump-email-yasmine')), '.ssh': sshDirectory() } }),
  events: [
    { id: 'key-private', condition: privateKeyOnHome, message: (j) => j.t('jump-event-key-private') },
    { id: 'to-wiki', condition: (j) => connectionsToWiki(j) > 0 && !privateKeyOnHome(j), message: (j) => j.t('jump-event-to-wiki') },
    { id: 'shortcut', condition: shortcut, message: (j) => j.t('jump-event-shortcut') },
    {
      id: 'end',
      condition: (j) => j.flags.has('shortcut') && shortcut(j) && connectionsToWiki(j) > 0 && !privateKeyOnHome(j),
      message: (j) => j.t('jump-event-end'),
    },
  ],
};
