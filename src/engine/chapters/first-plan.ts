// Story "The Mapping Party", chapter "The First Plan": Saturday's mapping
// party needs tiles.wayfinders.example for Dilnoza's tile server. Andile
// added the record to /srv/dns/records.tf, by hand, the night before: a
// misindented block, a typo (adresses) and a variable without a value. The
// configuration was never initialised on cairn (no lock file, no provider).
// The way: tofu init (the provider from the local mirror, the lock file),
// tofu fmt, tofu validate (Missing required argument, Unsupported argument
// "adresses": did you mean "addresses"?), the value of tiles_address in
// terraform.tfvars, tofu plan (1 to add), tofu apply and its "yes", then dig
// to see what named serves.
// Objective checked on the state: named serves tiles.wayfinders.example.
// with 192.0.2.180, OpenTofu's state manages it, www and wiki unchanged,
// every .tf file formatted, the variable's value kept in a .tfvars file (the
// next volunteer's plan must work), a lookup of the name that got the
// address.
// False leads: the zone file edited by hand (a dynamic zone: rndc reload
// refuses it, and the next update would ignore it), the value given only
// with -var, the state file deleted.
// Sources: https://opentofu.org/docs/cli/commands/init/,
// https://opentofu.org/docs/cli/commands/fmt/,
// https://opentofu.org/docs/cli/commands/validate/,
// https://opentofu.org/docs/language/values/variables/,
// https://opentofu.org/docs/cli/commands/plan/, https://opentofu.org/docs/cli/commands/apply/.

import type { Chapter } from '../world';
import { f } from '../world';
import type { Game, Shell } from '../shell';
import { desired, formatted, readRecord } from '../tofu';
import { dns } from '../dns';
import { DIR, HOME, PASSWORD, STATE, TILES, OLD_WWW, ZONE, ZONE_FILE, accounts, addressesOf, cairnState, cairnWorld, initialiseStory, looked, managed, passTime, runs, seen, served } from './mapping-party';

const tilesServed = (j: Game) => addressesOf(j, 'tiles').join() === TILES;
const tilesManaged = (j: Game) => (managed(j, 'tiles')?.attributes.addresses as string[] | undefined)?.join() === TILES;
const othersKept = (j: Game) => addressesOf(j, 'www').join() === OLD_WWW && served(j, 'wiki', 'CNAME')[0]?.data === `www.${ZONE}.`;
const kept = (j: Game) => {
  const want = desired(j as Shell, DIR);
  return !!want && Object.values(want).some((r) => r.name === 'tiles' && (r.addresses as string[]).join() === TILES);
};
const initialised = (j: Game) => !!j.read(`${DIR}/.terraform.lock.hcl`) && !!j.find(`${DIR}/.terraform`);
const zoneTouched = (j: Game) => j.state.zoneText !== undefined && j.read(ZONE_FILE) !== j.state.zoneText;

export const firstPlan: Chapter = {
  id: 'first-plan',
  number: 1,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'nano', 'sudo', 'systemctl', 'journalctl', 'dig', 'host', 'rndc', 'named-checkzone', 'tofu', 'exit'],
  home: HOME,
  welcome: 'message_from_andile.txt',
  names: true,
  final: 'end',
  steps: ['initialised', 'formatted', 'valid', 'planned', 'applied', 'checked', 'end'],
  password: PASSWORD,
  accounts,
  state: (t) => cairnState(t, 1),
  initialise: (j) => {
    initialiseStory(j, 1);
    j.state.zoneText = j.read(ZONE_FILE);
  },
  createWorld: (t) => cairnWorld(t, 1, { home: { 'message_from_andile.txt': f(t('first-plan-message-andile')), 'notes_from_yusra.txt': f(t('first-plan-notes-yusra')) } }),
  afterCommand: (j) => passTime(j),
  events: [
    { id: 'not-initialised', condition: (j) => seen(j, 'Inconsistent dependency lock file') || seen(j, 'Missing required provider'), message: (j) => j.t('first-plan-event-not-initialised') },
    { id: 'initialised', condition: initialised, message: (j) => j.t('first-plan-event-initialised') },
    { id: 'formatted', condition: (j) => formatted(j as Shell, DIR), message: (j) => j.t('first-plan-event-formatted') },
    { id: 'invalid', condition: (j) => seen(j, 'An argument named "adresses" is not expected here.'), message: (j) => j.t('first-plan-event-invalid') },
    { id: 'valid', condition: (j) => runs(j).some((r) => (r.command === 'validate' && r.valid) || (r.command === 'plan' && r.ok)), message: (j) => j.t('first-plan-event-valid') },
    { id: 'no-value', condition: (j) => seen(j, 'The root module input variable "tiles_address" is not set'), message: (j) => j.t('first-plan-event-no-value') },
    { id: 'planned', condition: (j) => runs(j).some((r) => r.command === 'plan' && r.ok && (r.changes ?? 0) > 0), message: (j) => j.t('first-plan-event-planned') },
    { id: 'zone-by-hand', condition: zoneTouched, message: (j) => j.t('first-plan-event-zone-by-hand') },
    { id: 'state-gone', condition: (j) => !j.read(STATE), message: (j) => j.t('first-plan-event-state-gone') },
    { id: 'applied', condition: (j) => tilesServed(j) && tilesManaged(j), message: (j) => j.t('first-plan-event-applied') },
    { id: 'cli-var', condition: (j) => tilesServed(j) && !kept(j), message: (j) => j.t('first-plan-event-cli-var') },
    { id: 'checked', condition: (j) => tilesServed(j) && looked(j, 'tiles', TILES), message: (j) => j.t('first-plan-event-checked') },
    {
      id: 'end',
      condition: (j) => tilesServed(j) && tilesManaged(j) && othersKept(j) && formatted(j as Shell, DIR) && kept(j) && looked(j, 'tiles', TILES) && !!readRecord(dns(j)!, 'dns_a_record_set', { zone: `${ZONE}.`, name: 'tiles' }),
      message: (j) => j.t('first-plan-event-end'),
    },
  ],
};
