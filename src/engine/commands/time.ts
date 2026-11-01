// timedatectl : l'heure de la machine, son fuseau et NTP (systemd-timesyncd),
// sur le modèle de ../heure.ts. Sorties d'après timedatectl(1) de systemd 252
// (Debian 12) : https://www.freedesktop.org/software/systemd/man/latest/timedatectl.html
// Écarts : status, show, list-timezones, set-timezone, set-ntp, set-time et
// timesync-status seulement ; pas de RTC séparée (elle suit l'horloge).

import type { Shell } from '../shell';
import { changeZone, timeOfDay, machineTime, zonesList, validZone, setClock, configuresServers } from '../time';
import { stop, start, systemd } from '../systemd';
import { readDate } from './scripts';
import type { Command } from './index';

const TIMESYNCD = 'systemd-timesyncd';

function shortDay(ms: number, language: string): string {
  return new Intl.DateTimeFormat(language, { timeZone: 'UTC', weekday: 'short' }).format(new Date(ms));
}
const timeDate = (ms: number) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ');

function status(game: Shell): string {
  const h = timeOfDay(game)!;
  const m = machineTime(game);
  const ntp = systemd(game)?.services[TIMESYNCD]?.state === 'active';
  const l = game.t.language;
  return [
    `               Local time: ${shortDay(m.wall, l)} ${timeDate(m.wall)} ${m.abbrev}`,
    `           Universal time: ${shortDay(m.utc, l)} ${timeDate(m.utc)} UTC`,
    `                 RTC time: ${shortDay(m.utc, l)} ${timeDate(m.utc)}`,
    `                Time zone: ${h.zone} (${m.abbrev}, ${m.z})`,
    `System clock synchronized: ${h.synchronised ? 'yes' : 'no'}`,
    `              NTP service: ${ntp ? 'active' : 'inactive'}`,
    `          RTC in local TZ: no`,
  ].join('\n');
}

function synchroState(game: Shell): string {
  const h = timeOfDay(game)!;
  if (systemd(game)?.services[TIMESYNCD]?.state !== 'active')
    return game.error('Failed to query server: Unit systemd-timesyncd.service is not active.');
  const name = h.server ?? configuresServers(game)[0] ?? '';
  const address = h.server ? h.servers[h.server] : (h.muted[name] ?? name);
  if (!h.synchronised) return [`       Server: ${address} (${name})`, `Poll interval: 0 (min: 32s; max 34min 8s)`, ` Packet count: 0`].join('\n');
  return [
    `       Server: ${address} (${name})`,
    `Poll interval: 32s (min: 32s; max 34min 8s)`,
    `         Leap: normal`,
    `      Version: 4`,
    `      Stratum: 2`,
    `    Reference: C0000201`,
    `    Precision: 1us (-24)`,
    `Root distance: 1.236ms (max: 5s)`,
    `       Offset: +4us`,
    `        Delay: 412us`,
    `       Jitter: 0`,
    ` Packet count: 1`,
    `    Frequency: -12.345ppm`,
  ].join('\n');
}

export const TIME: Record<string, Command> = {
  timedatectl: {
    ownOptions: true,
    launch: ({ args, game }) => {
      const h = timeOfDay(game);
      const sd = systemd(game);
      if (!h || !sd) return game.error("System has not been booted with systemd as init system (PID 1). Can't operate.");
      const [action = 'status', ...rest] = args.filter((a) => a !== '--no-pager' && a !== '--no-ask-password');
      const root = game.who === 'root';
      switch (action) {
        case 'status':
          return status(game);
        case 'show': {
          const m = machineTime(game);
          return [
            `Timezone=${h.zone}`,
            'LocalRTC=no',
            'CanNTP=yes',
            `NTP=${sd.services[TIMESYNCD]?.state === 'active' ? 'yes' : 'no'}`,
            `NTPSynchronized=${h.synchronised ? 'yes' : 'no'}`,
            `TimeUSec=${shortDay(m.wall, 'en-US').replace('.', '')} ${timeDate(m.wall)} ${m.abbrev}`,
          ].join('\n');
        }
        case 'list-timezones':
          return zonesList().join('\n');
        case 'timesync-status':
          return synchroState(game);
        case 'set-timezone': {
          const [zone] = rest;
          if (!zone) return game.error('Too few arguments.');
          if (!validZone(zone)) return game.error(`Failed to set time zone: Invalid or not installed time zone '${zone}'`);
          if (!root) return game.error('Failed to set time zone: Access denied');
          changeZone(game, zone);
          // Comme timedatectl : /etc/localtime devient un lien vers le fichier du fuseau (et /etc/timezone le nomme, sur Debian).
          const link = game.find('/etc/localtime', false);
          if (link?.type === 'fichier') link.link = `/usr/share/zoneinfo/${zone}`;
          const name = game.find('/etc/timezone');
          if (name?.type === 'fichier') name.content = zone;
          return '';
        }
        case 'set-ntp': {
          const [value] = rest;
          const yes = ['true', 'yes', 'on', '1'].includes(value ?? '');
          const not = ['false', 'no', 'off', '0'].includes(value ?? '');
          if (!yes && !not) return game.error(value === undefined ? 'Too few arguments.' : `Failed to parse argument: ${value}`);
          if (!root) return game.error('Failed to set ntp: Access denied');
          const s = sd.services[TIMESYNCD];
          if (!s) return game.error('Failed to set ntp: NTP not supported');
          // Comme timedatectl : active et démarre systemd-timesyncd (ou l'arrête et le désactive).
          s.active = yes;
          if (yes && s.state !== 'active') start(game, sd, TIMESYNCD);
          if (not && s.state === 'active') stop(game, sd, TIMESYNCD);
          return '';
        }
        case 'set-time': {
          const [text] = rest;
          if (!text) return game.error('Too few arguments.');
          const wall = readDate(game, text);
          if (wall === null) return game.error(`Failed to parse time specification '${text}': Invalid argument`);
          if (sd.services[TIMESYNCD]?.state === 'active') return game.error('Failed to set time: Automatic time synchronization is enabled');
          if (!root) return game.error('Failed to set time: Access denied');
          setClock(game, wall);
          return '';
        }
        default:
          return game.error(`Unknown command verb '${action}'.`);
      }
    },
  },
};
