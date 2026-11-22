// Story "The Blood Drive", chapter "The Sick Server": a week later, one
// donor in three gets an error page. web3's app answers 500 to everything
// (its database refuses new connections), but HAProxy's servers have no
// health check at all: it keeps sending web3 its share. A `check` alone is
// a TCP check (the port is open: L4OK, web3 stays UP); the fix is an HTTP
// check of the app's /health (option httpchk GET /health, http-check expect
// status 200) on both load balancers, reloaded: web3 goes DOWN after `fall`
// failed checks. Meanwhile a technician waits to replace web2's memory:
// take it out of the pool without cutting anyone's booking, with the
// runtime API (set server be_booking/web2 state drain, or maint), wait for
// its sessions to end (show stat's scur), let him work, then put it back
// (state ready) instead of editing the configuration and reloading.
// Objective checked on the state: an HTTP check loaded on both load
// balancers, web3 DOWN on the master, the technician's visit done without a
// cut, web2 back in the pool (ready, UP) and still in both configuration
// files, the donors served.
// False leads: `check` without httpchk (L4OK), removing web2's server line
// (it must come back afterwards; the runtime API was made for this),
// stopping web2's app or rebooting it while donors are on it.
// Sources: https://docs.haproxy.org/3.0/configuration.html (option httpchk,
// http-check expect, server check, inter, fall, rise),
// https://docs.haproxy.org/3.0/management.html (9.3: set server, show stat,
// show servers state).

import type { Chapter } from '../world';
import type { Game } from '../shell';
import { CFG, type HaproxyRun } from '../haproxy';
import { HOME, PASSWORD, ha, holders, initialiseStory, lb1Accounts, lbState, lbWorld, machine, passTime, seen, servedLately, story, storyHosts, typed } from './blood-drive';

const LBS = ['lb1', 'lb2'] as const;
const back = (r: HaproxyRun | null) => r?.conf.backends.find((b) => b.name === 'be_booking');
const httpChecked = (r: HaproxyRun | null) => {
  const b = back(r);
  return !!b?.httpchk && b.servers.length > 0 && b.servers.every((s) => s.check);
};
const masterRun = (j: Game) => (holders(j).length === 1 ? ha(j, holders(j)[0] as 'lb1' | 'lb2') : null);
const server = (r: HaproxyRun | null, name: string) => r?.servers.find((s) => s.backend === 'be_booking' && s.name === name);
const inFile = (j: Game, lb: string) => /^\s*server\s+web2\s+198\.51\.100\.22:8080\b(?!.*\bdisabled\b)/m.test(machine(j, lb).read(CFG) ?? '');
const drainedOn = (r: HaproxyRun | null) => {
  const s = server(r, 'web2');
  return !!s && s.admin !== 'ready';
};

export const sickServer: Chapter = {
  id: 'sick-server',
  number: 2,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'cut', 'diff', 'cp', 'nano', 'sudo', 'ssh', 'exit', 'echo', 'systemctl', 'journalctl', 'ip', 'curl', 'sleep', 'haproxy', 'socat'],
  home: HOME,
  welcome: 'message_from_zainab.txt',
  names: true,
  final: 'end',
  steps: ['errors', 'no-check', 'http-check', 'lb2-synced', 'drained', 'tech-working', 'tech-done', 'end'],
  password: PASSWORD,
  accounts: lb1Accounts,
  state: (t) => lbState(t, 'lb1', 2),
  initialise: (j) => initialiseStory(j, 2),
  hosts: storyHosts(2),
  createWorld: (t) =>
    lbWorld(t, 'lb1', 2, {
      'message_from_zainab.txt': t('sick-server-message-zainab'),
      'message_from_teodor.txt': t('sick-server-message-teodor'),
    }),
  afterCommand: (j) => passTime(j),
  events: [
    { id: 'errors', condition: (j) => seen(j, /be_booking\/web3 \S+ 500 /) || seen(j, 'Server Error (500)') || seen(j, 'x-served-by: web3'), message: (j) => j.t('sick-server-event-errors') },
    { id: 'denied', condition: (j) => /socat/.test(typed(j)) && seen(j, 'Permission denied'), message: (j) => j.t('sick-server-event-denied') },
    { id: 'no-check', condition: (j) => seen(j, ',no check,'), message: (j) => j.t('sick-server-event-no-check') },
    {
      id: 'tcp-only',
      condition: (j) => {
        const r = masterRun(j);
        const b = back(r);
        return !!b && !b.httpchk && b.servers.some((s) => s.check) && server(r, 'web3')?.status === 'L4OK';
      },
      message: (j) => j.t('sick-server-event-tcp-only'),
    },
    { id: 'http-check', condition: (j) => httpChecked(masterRun(j)) && server(masterRun(j), 'web3')?.up === false, message: (j) => j.t('sick-server-event-http-check') },
    { id: 'lb2-synced', condition: (j) => httpChecked(ha(j, 'lb1')) && httpChecked(ha(j, 'lb2')), message: (j) => j.t('sick-server-event-lb2-synced') },
    { id: 'wrong-node', condition: (j) => holders(j).length === 1 && LBS.some((l) => l !== holders(j)[0] && drainedOn(ha(j, l))) && !drainedOn(masterRun(j)), message: (j) => j.t('sick-server-event-wrong-node') },
    { id: 'removed', condition: (j) => LBS.some((l) => !inFile(j, l)), message: (j) => j.t('sick-server-event-removed') },
    { id: 'drained', condition: (j) => drainedOn(masterRun(j)), message: (j) => j.t('sick-server-event-drained') },
    { id: 'cut', condition: (j) => !!story(j).cut, message: (j) => j.t('sick-server-event-cut') },
    { id: 'tech-working', condition: (j) => story(j).tech === 'working' || story(j).tech === 'done', message: (j) => j.t('sick-server-event-tech-working') },
    { id: 'tech-done', condition: (j) => story(j).tech === 'done', message: (j) => j.t('sick-server-event-tech-done') },
    {
      id: 'end',
      condition: (j) => {
        const r = masterRun(j);
        const w2 = server(r, 'web2');
        return (
          httpChecked(ha(j, 'lb1')) && httpChecked(ha(j, 'lb2')) && server(r, 'web3')?.up === false && story(j).tech === 'done' && !!w2 && w2.admin === 'ready' && w2.up && LBS.every((l) => inFile(j, l)) && servedLately(j)
        );
      },
      message: (j) => j.t('sick-server-event-end'),
    },
  ],
};
