// Histoire « La Maison des associations » — chapitre « Le rebond » : le
// wiki n'est joignable que depuis la passerelle. Gaspard s'y connectait en
// deux temps (ssh maison, puis ssh wiki), avec une copie de sa clé privée
// sur maison. Rebondir depuis son poste (ssh -J maison wiki), sans laisser
// de clé privée sur la passerelle, puis écrire le raccourci (ProxyJump dans
// ~/.ssh/config) pour que « ssh wiki » suffise.
// Objectif vérifié sur l'état : une connexion par clé au wiki, un bloc Host
// de ~/.ssh/config du poste qui y mène en rebondissant par maison (vérifié
// au sens de ssh : HostName résolu par maison, ProxyJump), et aucune clé
// privée dans ~/.ssh de maison.
// Sources : https://man.openbsd.org/ssh#J, https://man.openbsd.org/ssh_config#ProxyJump

import { path, d, f, type Chapter, type Directory } from '../world';
import { hostInLanguage } from '../machines';
import type { Game, Shell } from '../shell';
import { configuration, resolveName } from '../access';
import { loadSshd, homeAccounts, connectionsBy, sshDirectory, homeState, internalHost, M, homeWorld, PASSWORD, homePlan } from './community-centre';

const WIKI = '10.20.0.11';
const INTERNAL_COMMANDS = ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'id', 'whoami', 'hostname'];

const workstation = (j: Game) => (j.state.poste as (() => Shell) | undefined)?.();
const wiki = (j: Game) => (j as Shell).internal('wiki');
const connectionsToWiki = (j: Game) => (wiki(j) ? connectionsBy(wiki(j)!, 'cle') : 0);

// Les noms écrits dans un bloc Host de ~/.ssh/config du poste (sans jokers).
function alias(p: Shell): string[] {
  return (p.read('~/.ssh/config') ?? '')
    .split('\n')
    .map((l) => l.trim().split(/\s+/))
    .filter(([key]) => key?.toLowerCase() === 'host')
    .flatMap(([, ...names]) => names.filter((n) => !/[*?!]/.test(n)));
}

// Un raccourci du poste qui mène au wiki en rebondissant par maison.
const shortcut = (j: Game) => {
  const p = workstation(j);
  if (!p) return false;
  return alias(p).some((a) => {
    const c = configuration(p, a);
    const hop = c.proxyjump?.[0]?.split(',').at(-1)?.split('@').at(-1);
    if (!hop || !['maison', 'maison.internal', '192.0.2.19'].map((n) => hostInLanguage(j.t, n)).includes(hop)) return false;
    return resolveName(j as Shell, (c.hostname?.[0] ?? a).toLowerCase()) === WIKI;
  });
};

// Une clé privée laissée dans ~/.ssh de maison.
const privateKeyOnHome = (j: Game) => {
  const ssh = j.find(path(j.t, `${M}/.ssh`)) as Directory | null;
  if (ssh?.type !== 'dossier') return false;
  return Object.keys(ssh.children).some((n) => (j.read(`${path(j.t, M)}/.ssh/${n}`) ?? '').includes('PRIVATE KEY'));
};

export const jump: Chapter = {
  id: 'jump',
  number: 2,
  plan: homePlan(),
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'id', 'whoami', 'hostname', 'chmod', 'rm', 'nano', 'ssh'],
  home: M,
  welcome: 'courriel_yasmine.txt',
  names: true,
  final: 'fin',
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
      more: (t) => ({ srv: d({ wiki: d({ pages: d({ 'accueil.md': f(t('jump-wiki-accueil')) }) }) }, undefined, { owner: 'root' }) }),
    }),
    archives: internalHost('archives', '10.20.0.12', { commands: INTERNAL_COMMANDS }),
  },
  createWorld: (t) => homeWorld({ passwords: 'no', home: { 'courriel_yasmine.txt': f(t('jump-courriel-yasmine')), '.ssh': sshDirectory() } }),
  events: [
    { id: 'cle-privee', condition: privateKeyOnHome, message: (j) => j.t('jump-evenement-cle-privee') },
    { id: 'au-wiki', condition: (j) => connectionsToWiki(j) > 0 && !privateKeyOnHome(j), message: (j) => j.t('jump-evenement-au-wiki') },
    { id: 'raccourci', condition: shortcut, message: (j) => j.t('jump-evenement-raccourci') },
    {
      id: 'fin',
      condition: (j) => j.flags.has('raccourci') && shortcut(j) && connectionsToWiki(j) > 0 && !privateKeyOnHome(j),
      message: (j) => j.t('jump-evenement-fin'),
    },
  ],
};
