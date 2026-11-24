// Story "The Mapping Party", chapter "Drift": on Thursday evening the old
// web host (198.51.100.40) died. Femi, on call, started a `tofu apply`,
// hesitated at its "Enter a value:", and moved the site by hand with
// nsupdate instead (www to 198.51.100.41, TTL 60), then added
// status.wayfinders.example for the status page; his apply still waits in
// a forgotten session and holds the state lock. The old host is gone for
// good: the code must follow the site, not the other way round.
// The way: the lock (tofu plan fails, Lock Info names femi's process; ps,
// then sudo kill: OpenTofu releases the lock as it stops; force-unlock
// can't, the local backend's lock belongs to its process); tofu plan shows
// the drift ("Objects have changed outside of OpenTofu") and what applying
// the old code would do (put the dead address back); records.tf updated
// (198.51.100.41, the TTL either way), plan, apply; a resource block for
// status and tofu import (or an import block), until tofu plan says No
// changes.
// Objective checked on the state: no process holds the lock, and for every
// resource of the configuration the code, the state and what named serves
// agree; www on 198.51.100.41, status managed, tiles and wiki as they were;
// the state file as tofu wrote it; a plan or apply that found nothing to do.
// False leads: tofu force-unlock (refused), -lock=false while the lock is
// held, applying the old code (the site points at the dead host),
// terraform.tfstate edited by hand, tofu state rm to make a diff go away,
// status created rather than imported (this provider allows it, most
// don't).
// Sources: https://opentofu.org/docs/language/state/locking/,
// https://opentofu.org/docs/cli/commands/force-unlock/,
// https://opentofu.org/docs/cli/commands/plan/#planning-modes,
// https://opentofu.org/docs/cli/import/, https://opentofu.org/docs/language/import/.

import type { Chapter } from '../world';
import { f } from '../world';
import type { Game, Shell } from '../shell';
import { desired, readRecord, tofuOf } from '../tofu';
import { dns } from '../dns';
import type { Process } from '../commands/system';
import { DIR, FEMI_PID, HOME, NEW_WWW, OLD_WWW, PASSWORD, STATE, STATUS, TILES, ZONE, accounts, addressesOf, cairnState, cairnWorld, initialiseStory, managed, passTime, runs, seen, served, stateNow, stateUntouched } from './mapping-party';

const lockHeld = (j: Game) => ((j.state.process ?? []) as Process[]).some((p) => p.pid === FEMI_PID);

/** Code, state and named agree on every resource of the configuration, and the state holds nothing else. */
function converged(j: Game): boolean {
  const want = desired(j as Shell, DIR);
  const state = stateNow(j);
  if (!want || !state) return false;
  const addresses = Object.keys(want).sort();
  if (state.resources.map((r) => `${r.type}.${r.name}`).sort().join() !== addresses.join()) return false;
  for (const address of addresses) {
    const [type, name] = address.split('.');
    const inst = state.resources.find((r) => r.type === type && r.name === name)!;
    const real = readRecord(dns(j)!, type, want[address]);
    if (!real || 'error' in real) return false;
    for (const [k, v] of Object.entries(want[address])) {
      const norm = (x: unknown) => JSON.stringify(Array.isArray(x) ? [...x].sort() : x);
      if (norm(v) !== norm(inst.attributes[k]) || (k in real && norm(v) !== norm((real as Record<string, unknown>)[k]))) return false;
    }
  }
  return true;
}
const wwwMoved = (j: Game) => addressesOf(j, 'www').join() === NEW_WWW;
const statusManaged = (j: Game) => (managed(j, 'status')?.attributes.addresses as string[] | undefined)?.join() === STATUS && addressesOf(j, 'status').join() === STATUS;
const othersKept = (j: Game) => addressesOf(j, 'tiles').join() === TILES && served(j, 'wiki', 'CNAME')[0]?.data === `www.${ZONE}.`;
const quiet = (j: Game) => runs(j).some((r) => (r.command === 'plan' || r.command === 'apply') && r.ok && r.changes === 0 && !r.refreshOnly && r.ranAfter === true);

export const drift: Chapter = {
  id: 'drift',
  number: 2,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'nano', 'sudo', 'systemctl', 'journalctl', 'dig', 'host', 'ps', 'kill', 'tofu', 'exit'],
  home: HOME,
  welcome: 'message_from_andile.txt',
  names: true,
  final: 'end',
  steps: ['locked', 'freed', 'drift', 'code', 'imported', 'end'],
  password: PASSWORD,
  accounts,
  state: (t) => cairnState(t, 2),
  initialise: (j) => initialiseStory(j, 2),
  createWorld: (t) => cairnWorld(t, 2, { home: { 'message_from_andile.txt': f(t('drift-message-andile')), 'message_from_femi.txt': f(t('drift-message-femi')) } }),
  afterCommand: (j) => {
    passTime(j);
    // A plan or apply that found nothing to do, once everything agrees.
    const last = runs(j).at(-1);
    if (last && last.ranAfter === undefined) last.ranAfter = converged(j) && statusManaged(j) && wwwMoved(j);
  },
  events: [
    { id: 'locked', condition: (j) => seen(j, 'Error acquiring the state lock'), message: (j) => j.t('drift-event-locked') },
    { id: 'force-unlock', condition: (j) => seen(j, 'Local state cannot be unlocked by another process.'), message: (j) => j.t('drift-event-force-unlock') },
    { id: 'no-lock', condition: (j) => lockHeld(j) && runs(j).some((r) => r.noLock && r.command !== 'plan'), message: (j) => j.t('drift-event-no-lock') },
    { id: 'freed', condition: (j) => !lockHeld(j), message: (j) => j.t(j.state.femiStopped === 'KILL' ? 'drift-event-freed-kill' : 'drift-event-freed') },
    { id: 'drift', condition: (j) => runs(j).some((r) => r.ok && (r.drift ?? []).includes('dns_a_record_set.www')), message: (j) => j.t('drift-event-drift') },
    { id: 'reverted', condition: (j) => addressesOf(j, 'www').includes(OLD_WWW), message: (j) => j.t('drift-event-reverted') },
    { id: 'hand-edit', condition: (j) => !stateUntouched(j), message: (j) => j.t('drift-event-hand-edit') },
    {
      id: 'state-rm',
      condition: (j) => runs(j).some((r) => (r.removed ?? []).some((a) => !!desired(j as Shell, DIR)?.[a])) && !converged(j),
      message: (j) => j.t('drift-event-state-rm'),
    },
    {
      id: 'code',
      condition: (j) => {
        const want = desired(j as Shell, DIR);
        return !!want && Object.values(want).some((r) => r.name === 'www' && (r.addresses as string[]).join() === NEW_WWW);
      },
      message: (j) => j.t('drift-event-code'),
    },
    { id: 'created-over', condition: (j) => runs(j).some((r) => (r.created ?? []).some((a) => tofuOf(j as Shell) && stateNow(j)?.resources.find((x) => `${x.type}.${x.name}` === a)?.attributes.name === 'status')), message: (j) => j.t('drift-event-created-over') },
    { id: 'imported', condition: statusManaged, message: (j) => j.t('drift-event-imported') },
    {
      id: 'end',
      condition: (j) => !lockHeld(j) && converged(j) && wwwMoved(j) && statusManaged(j) && othersKept(j) && stateUntouched(j) && quiet(j) && !!j.read(STATE),
      message: (j) => j.t('drift-event-end'),
    },
  ],
};
