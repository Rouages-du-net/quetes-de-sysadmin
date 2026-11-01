// A machine's time: its time zone, the gap between its clock and the real
// time, and NTP synchronisation (systemd-timesyncd). The real time is
// systemd's (sd.clock, Paris time read as UTC); the machine shows its own:
// real UTC time + offset, in its time zone. Based on timedatectl(1) and
// timesyncd.conf(5):
// https://www.freedesktop.org/software/systemd/man/latest/timedatectl.html,
// https://www.freedesktop.org/software/systemd/man/latest/timesyncd.conf.html
//
//   state.clockTime = { zone, offset, synchronised, server?, servers, changeZone? }
// Differences: synchronisation is immediate (no gradual adjustment);
// time zones come from Intl (ICU), without /usr/share/zoneinfo.

import type { Game } from './shell';
import { writeLog, systemd, toUtc } from './systemd';

export interface Time {
  zone: string;
  // The machine's clock minus the real time (ms): negative, it is behind.
  offset: number;
  synchronised: boolean;
  // The NTP server that answered (name), once synchronised.
  server?: string;
  // The NTP servers the machine can reach (name → address), and those that do not answer.
  servers: Record<string, string>;
  muted: Record<string, string>;
  // The real time of the last time zone change.
  changeZone?: number;
  // The clock was set by hand (date -s, timedatectl set-time).
  manual?: boolean;
}

export const timeOfDay = (j: Game): Time | undefined => j.state.clockTime;

/** Does the time zone exist (like the files of /usr/share/zoneinfo)? */
export function validZone(name: string): boolean {
  if (name === 'UTC' || name === 'Etc/UTC') return true;
  try {
    new Intl.DateTimeFormat('en', { timeZone: name });
    return /^[A-Za-z_]+(\/[A-Za-z0-9_+-]+)+$/.test(name);
  } catch {
    return false;
  }
}

export function zonesList(): string[] {
  const listing = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.('timeZone') ?? [
    'Europe/Paris',
    'Europe/Berlin',
    'America/New_York',
    'Asia/Tokyo',
  ];
  return [...new Set([...listing, 'Etc/UTC', 'UTC'])].sort();
}

/** A time zone's offset from UTC at this instant (ms). */
function zoneDifference(zone: string, utc: number): number {
  if (zone === 'UTC' || zone === 'Etc/UTC') return 0;
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    })
      .formatToParts(new Date(utc))
      .map((x) => [x.type, Number(x.value)]),
  );
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(utc / 1000) * 1000;
}

/** The time zone's abbreviation (CEST, UTC…) and its offset (+0200). */
function zoneName(zone: string, utc: number): { abbrev: string; z: string } {
  const e = zoneDifference(zone, utc) / 60_000;
  const z = `${e < 0 ? '-' : '+'}${String(Math.floor(Math.abs(e) / 60)).padStart(2, '0')}${String(Math.abs(e) % 60).padStart(2, '0')}`;
  if (zone === 'UTC' || zone === 'Etc/UTC') return { abbrev: 'UTC', z };
  if (zone === 'Europe/Paris' || zone === 'Europe/Brussels' || zone === 'Europe/Berlin') return { abbrev: e === 120 ? 'CEST' : 'CET', z };
  const short = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'short' })
    .formatToParts(new Date(utc))
    .find((x) => x.type === 'timeZoneName')?.value;
  return { abbrev: short && /^[A-Z]{3,5}$/.test(short) ? short : z.slice(0, 3), z };
}

/**
 * The time as the machine sees it: `utc` (its clock, in UTC), `wall`
 * (the time displayed in its time zone, read as UTC), its abbreviation.
 */
export function machineTime(j: Game): { utc: number; wall: number; abbrev: string; z: string } {
  const sd = systemd(j)!;
  const h = timeOfDay(j);
  const yes = toUtc(sd.clock);
  if (!h) return { utc: yes, wall: sd.clock, abbrev: '', z: '' };
  const utc = yes + h.offset;
  return { utc, wall: utc + zoneDifference(h.zone, utc), ...zoneName(h.zone, utc) };
}

/** The journal and systemctl show the machine's time: their offset is recomputed. */
export function displayUpdate(j: Game) {
  const sd = systemd(j);
  if (!sd || !timeOfDay(j)) return;
  const m = machineTime(j);
  sd.difference = m.wall - sd.clock;
  sd.zone = m.abbrev;
}

/** Setting the clock (date -s, timedatectl set-time): `wall` is the wanted time in the machine's time zone. */
export function setClock(j: Game, wall: number) {
  const h = timeOfDay(j)!;
  const sd = systemd(j)!;
  const yes = toUtc(sd.clock);
  h.offset = wall - zoneDifference(h.zone, wall) - yes;
  h.synchronised = false;
  h.manual = true;
  displayUpdate(j);
}

export function changeZone(j: Game, zone: string) {
  const h = timeOfDay(j)!;
  h.zone = zone;
  h.changeZone = systemd(j)!.clock;
  displayUpdate(j);
}

/** The NTP servers of /etc/systemd/timesyncd.conf (NTP=, else FallbackNTP=), like timesyncd. */
export function configuresServers(j: Game): string[] {
  let section = '';
  const values: Record<string, string[]> = {};
  for (const line of (j.read('/etc/systemd/timesyncd.conf') ?? '').split('\n')) {
    const l = line.trim();
    if (/^\[.*\]$/.test(l)) section = l;
    const m = /^(NTP|FallbackNTP)\s*=\s*(.*)$/.exec(l);
    if (m && section === '[Time]') values[m[1]] = m[2].split(/\s+/).filter(Boolean);
  }
  return values.NTP?.length
    ? values.NTP
    : (values.FallbackNTP ?? ['0.debian.pool.ntp.org', '1.debian.pool.ntp.org', '2.debian.pool.ntp.org', '3.debian.pool.ntp.org']);
}

/** systemd-timesyncd starts: it tries its servers in order; the first that answers sets the clock. */
export function synchronise(j: Game) {
  const h = timeOfDay(j)!;
  const sd = systemd(j)!;
  const unit = 'systemd-timesyncd.service';
  for (const name of configuresServers(j)) {
    const address = h.servers[name];
    if (!address) {
      writeLog(sd, unit, 'systemd-timesyncd', 702, `Timed out waiting for reply from ${h.muted[name] ?? name}:123 (${name}).`, 6, false);
      continue;
    }
    writeLog(sd, unit, 'systemd-timesyncd', 702, `Contacted time server ${address}:123 (${name}).`, 6, false);
    h.offset = 0;
    h.synchronised = true;
    h.server = name;
    displayUpdate(j);
    const m = machineTime(j);
    const d = new Date(m.wall).toISOString();
    writeLog(sd, unit, 'systemd-timesyncd', 702, `Initial clock synchronization to ${d.slice(0, 10)} ${d.slice(11, 19)} ${m.abbrev}.`, 6, false);
    return;
  }
  h.synchronised = false;
  h.server = undefined;
}

/** timesyncd stopped: the clock is no longer followed. */
export function desync(j: Game) {
  const h = timeOfDay(j);
  if (!h) return;
  h.synchronised = false;
  h.server = undefined;
}
