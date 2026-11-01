// L'heure d'une machine : son fuseau horaire, l'écart de son horloge avec
// la vraie heure, et la synchronisation NTP (systemd-timesyncd). La vraie
// heure est celle de systemd (sd.horloge, heure de Paris lue comme UTC) ;
// la machine affiche la sienne : vraie heure UTC + décalage, dans son
// fuseau. D'après timedatectl(1) et timesyncd.conf(5) :
// https://www.freedesktop.org/software/systemd/man/latest/timedatectl.html,
// https://www.freedesktop.org/software/systemd/man/latest/timesyncd.conf.html
//
//   etat.heure = { fuseau, decalage, synchronise, serveur?, serveurs, fuseauChange? }
// Écarts : la synchronisation est immédiate (pas d'ajustement progressif) ;
// les fuseaux viennent de Intl (ICU), sans /usr/share/zoneinfo.

import type { Game } from './shell';
import { writeLog, systemd, toUtc } from './systemd';

export interface Time {
  zone: string;
  // Horloge de la machine moins la vraie heure (ms) : négatif, elle retarde.
  offset: number;
  synchronised: boolean;
  // Le serveur NTP qui a répondu (nom), une fois synchronisée.
  server?: string;
  // Les serveurs NTP que la machine peut joindre (nom → adresse), et ceux qui ne répondent pas.
  servers: Record<string, string>;
  muted: Record<string, string>;
  // La vraie heure du dernier changement de fuseau.
  changeZone?: number;
  // L'horloge a été réglée à la main (date -s, timedatectl set-time).
  manual?: boolean;
}

export const timeOfDay = (j: Game): Time | undefined => j.state.heure;

/** Le fuseau existe-t-il (comme les fichiers de /usr/share/zoneinfo) ? */
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

/** L'écart d'un fuseau avec UTC à cet instant (ms). */
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

/** L'abréviation du fuseau (CEST, UTC…) et son écart (+0200). */
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
 * L'heure telle que la machine la voit : `utc` (son horloge, en UTC), `mur`
 * (l'heure affichée dans son fuseau, lue comme UTC), son abréviation.
 */
export function machineTime(j: Game): { utc: number; wall: number; abbrev: string; z: string } {
  const sd = systemd(j)!;
  const h = timeOfDay(j);
  const yes = toUtc(sd.clock);
  if (!h) return { utc: yes, wall: sd.clock, abbrev: '', z: '' };
  const utc = yes + h.offset;
  return { utc, wall: utc + zoneDifference(h.zone, utc), ...zoneName(h.zone, utc) };
}

/** Le journal et systemctl affichent l'heure de la machine : on recalcule leur écart. */
export function displayUpdate(j: Game) {
  const sd = systemd(j);
  if (!sd || !timeOfDay(j)) return;
  const m = machineTime(j);
  sd.difference = m.wall - sd.clock;
  sd.zone = m.abbrev;
}

/** Régler l'horloge (date -s, timedatectl set-time) : `mur` est l'heure voulue dans le fuseau de la machine. */
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

/** Les serveurs NTP de /etc/systemd/timesyncd.conf (NTP=, sinon FallbackNTP=), comme timesyncd. */
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

/** systemd-timesyncd démarre : il essaie ses serveurs dans l'ordre ; le premier qui répond règle l'horloge. */
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

/** timesyncd arrêté : l'horloge n'est plus suivie. */
export function desync(j: Game) {
  const h = timeOfDay(j);
  if (!h) return;
  h.synchronised = false;
  h.server = undefined;
}
