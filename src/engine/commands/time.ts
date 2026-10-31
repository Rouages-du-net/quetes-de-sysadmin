// timedatectl : l'heure de la machine, son fuseau et NTP (systemd-timesyncd),
// sur le modèle de ../heure.ts. Sorties d'après timedatectl(1) de systemd 252
// (Debian 12) : https://www.freedesktop.org/software/systemd/man/latest/timedatectl.html
// Écarts : status, show, list-timezones, set-timezone, set-ntp, set-time et
// timesync-status seulement ; pas de RTC séparée (elle suit l'horloge).

import type { Shell } from '../shell';
import { changerFuseau, heure, heureMachine, listeFuseaux, fuseauValide, reglerHorloge, serveursConfigures } from '../time';
import { arreter, demarrer, systemd } from '../systemd';
import { lireDate } from './scripts';
import type { Commande } from './index';

const TIMESYNCD = 'systemd-timesyncd';

function jourCourt(ms: number, langue: string): string {
  return new Intl.DateTimeFormat(langue, { timeZone: 'UTC', weekday: 'short' }).format(new Date(ms));
}
const dateHeure = (ms: number) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ');

function statut(jeu: Shell): string {
  const h = heure(jeu)!;
  const m = heureMachine(jeu);
  const ntp = systemd(jeu)?.services[TIMESYNCD]?.etat === 'active';
  const l = jeu.t.langue;
  return [
    `               Local time: ${jourCourt(m.mur, l)} ${dateHeure(m.mur)} ${m.abrev}`,
    `           Universal time: ${jourCourt(m.utc, l)} ${dateHeure(m.utc)} UTC`,
    `                 RTC time: ${jourCourt(m.utc, l)} ${dateHeure(m.utc)}`,
    `                Time zone: ${h.fuseau} (${m.abrev}, ${m.z})`,
    `System clock synchronized: ${h.synchronise ? 'yes' : 'no'}`,
    `              NTP service: ${ntp ? 'active' : 'inactive'}`,
    `          RTC in local TZ: no`,
  ].join('\n');
}

function etatSynchro(jeu: Shell): string {
  const h = heure(jeu)!;
  if (systemd(jeu)?.services[TIMESYNCD]?.etat !== 'active')
    return jeu.erreur('Failed to query server: Unit systemd-timesyncd.service is not active.');
  const nom = h.serveur ?? serveursConfigures(jeu)[0] ?? '';
  const adresse = h.serveur ? h.serveurs[h.serveur] : (h.muets[nom] ?? nom);
  if (!h.synchronise) return [`       Server: ${adresse} (${nom})`, `Poll interval: 0 (min: 32s; max 34min 8s)`, ` Packet count: 0`].join('\n');
  return [
    `       Server: ${adresse} (${nom})`,
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

export const HEURE: Record<string, Commande> = {
  timedatectl: {
    propresOptions: true,
    lancer: ({ args, jeu }) => {
      const h = heure(jeu);
      const sd = systemd(jeu);
      if (!h || !sd) return jeu.erreur("System has not been booted with systemd as init system (PID 1). Can't operate.");
      const [action = 'status', ...reste] = args.filter((a) => a !== '--no-pager' && a !== '--no-ask-password');
      const root = jeu.qui === 'root';
      switch (action) {
        case 'status':
          return statut(jeu);
        case 'show': {
          const m = heureMachine(jeu);
          return [
            `Timezone=${h.fuseau}`,
            'LocalRTC=no',
            'CanNTP=yes',
            `NTP=${sd.services[TIMESYNCD]?.etat === 'active' ? 'yes' : 'no'}`,
            `NTPSynchronized=${h.synchronise ? 'yes' : 'no'}`,
            `TimeUSec=${jourCourt(m.mur, 'en-US').replace('.', '')} ${dateHeure(m.mur)} ${m.abrev}`,
          ].join('\n');
        }
        case 'list-timezones':
          return listeFuseaux().join('\n');
        case 'timesync-status':
          return etatSynchro(jeu);
        case 'set-timezone': {
          const [fuseau] = reste;
          if (!fuseau) return jeu.erreur('Too few arguments.');
          if (!fuseauValide(fuseau)) return jeu.erreur(`Failed to set time zone: Invalid or not installed time zone '${fuseau}'`);
          if (!root) return jeu.erreur('Failed to set time zone: Access denied');
          changerFuseau(jeu, fuseau);
          // Comme timedatectl : /etc/localtime devient un lien vers le fichier du fuseau (et /etc/timezone le nomme, sur Debian).
          const lien = jeu.trouver('/etc/localtime', false);
          if (lien?.type === 'fichier') lien.lien = `/usr/share/zoneinfo/${fuseau}`;
          const nom = jeu.trouver('/etc/timezone');
          if (nom?.type === 'fichier') nom.contenu = fuseau;
          return '';
        }
        case 'set-ntp': {
          const [valeur] = reste;
          const oui = ['true', 'yes', 'on', '1'].includes(valeur ?? '');
          const non = ['false', 'no', 'off', '0'].includes(valeur ?? '');
          if (!oui && !non) return jeu.erreur(valeur === undefined ? 'Too few arguments.' : `Failed to parse argument: ${valeur}`);
          if (!root) return jeu.erreur('Failed to set ntp: Access denied');
          const s = sd.services[TIMESYNCD];
          if (!s) return jeu.erreur('Failed to set ntp: NTP not supported');
          // Comme timedatectl : active et démarre systemd-timesyncd (ou l'arrête et le désactive).
          s.active = oui;
          if (oui && s.etat !== 'active') demarrer(jeu, sd, TIMESYNCD);
          if (non && s.etat === 'active') arreter(jeu, sd, TIMESYNCD);
          return '';
        }
        case 'set-time': {
          const [texte] = reste;
          if (!texte) return jeu.erreur('Too few arguments.');
          const mur = lireDate(jeu, texte);
          if (mur === null) return jeu.erreur(`Failed to parse time specification '${texte}': Invalid argument`);
          if (sd.services[TIMESYNCD]?.etat === 'active') return jeu.erreur('Failed to set time: Automatic time synchronization is enabled');
          if (!root) return jeu.erreur('Failed to set time: Access denied');
          reglerHorloge(jeu, mur);
          return '';
        }
        default:
          return jeu.erreur(`Unknown command verb '${action}'.`);
      }
    },
  },
};
