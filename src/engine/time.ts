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

import type { Jeu } from './shell';
import { journaliser, systemd, versUtc } from './systemd';

export interface Heure {
  fuseau: string;
  // Horloge de la machine moins la vraie heure (ms) : négatif, elle retarde.
  decalage: number;
  synchronise: boolean;
  // Le serveur NTP qui a répondu (nom), une fois synchronisée.
  serveur?: string;
  // Les serveurs NTP que la machine peut joindre (nom → adresse), et ceux qui ne répondent pas.
  serveurs: Record<string, string>;
  muets: Record<string, string>;
  // La vraie heure du dernier changement de fuseau.
  fuseauChange?: number;
  // L'horloge a été réglée à la main (date -s, timedatectl set-time).
  manuel?: boolean;
}

export const heure = (j: Jeu): Heure | undefined => j.etat.heure;

/** Le fuseau existe-t-il (comme les fichiers de /usr/share/zoneinfo) ? */
export function fuseauValide(nom: string): boolean {
  if (nom === 'UTC' || nom === 'Etc/UTC') return true;
  try {
    new Intl.DateTimeFormat('en', { timeZone: nom });
    return /^[A-Za-z_]+(\/[A-Za-z0-9_+-]+)+$/.test(nom);
  } catch {
    return false;
  }
}

export function listeFuseaux(): string[] {
  const liste = (Intl as unknown as { supportedValuesOf?: (cle: string) => string[] }).supportedValuesOf?.('timeZone') ?? [
    'Europe/Paris',
    'Europe/Berlin',
    'America/New_York',
    'Asia/Tokyo',
  ];
  return [...new Set([...liste, 'Etc/UTC', 'UTC'])].sort();
}

/** L'écart d'un fuseau avec UTC à cet instant (ms). */
function ecartFuseau(fuseau: string, utc: number): number {
  if (fuseau === 'UTC' || fuseau === 'Etc/UTC') return 0;
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: fuseau,
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
function nomFuseau(fuseau: string, utc: number): { abrev: string; z: string } {
  const e = ecartFuseau(fuseau, utc) / 60_000;
  const z = `${e < 0 ? '-' : '+'}${String(Math.floor(Math.abs(e) / 60)).padStart(2, '0')}${String(Math.abs(e) % 60).padStart(2, '0')}`;
  if (fuseau === 'UTC' || fuseau === 'Etc/UTC') return { abrev: 'UTC', z };
  if (fuseau === 'Europe/Paris' || fuseau === 'Europe/Brussels' || fuseau === 'Europe/Berlin') return { abrev: e === 120 ? 'CEST' : 'CET', z };
  const court = new Intl.DateTimeFormat('en-US', { timeZone: fuseau, timeZoneName: 'short' })
    .formatToParts(new Date(utc))
    .find((x) => x.type === 'timeZoneName')?.value;
  return { abrev: court && /^[A-Z]{3,5}$/.test(court) ? court : z.slice(0, 3), z };
}

/**
 * L'heure telle que la machine la voit : `utc` (son horloge, en UTC), `mur`
 * (l'heure affichée dans son fuseau, lue comme UTC), son abréviation.
 */
export function heureMachine(j: Jeu): { utc: number; mur: number; abrev: string; z: string } {
  const sd = systemd(j)!;
  const h = heure(j);
  const vraie = versUtc(sd.horloge);
  if (!h) return { utc: vraie, mur: sd.horloge, abrev: '', z: '' };
  const utc = vraie + h.decalage;
  return { utc, mur: utc + ecartFuseau(h.fuseau, utc), ...nomFuseau(h.fuseau, utc) };
}

/** Le journal et systemctl affichent l'heure de la machine : on recalcule leur écart. */
export function majAffichage(j: Jeu) {
  const sd = systemd(j);
  if (!sd || !heure(j)) return;
  const m = heureMachine(j);
  sd.ecart = m.mur - sd.horloge;
  sd.zone = m.abrev;
}

/** Régler l'horloge (date -s, timedatectl set-time) : `mur` est l'heure voulue dans le fuseau de la machine. */
export function reglerHorloge(j: Jeu, mur: number) {
  const h = heure(j)!;
  const sd = systemd(j)!;
  const vraie = versUtc(sd.horloge);
  h.decalage = mur - ecartFuseau(h.fuseau, mur) - vraie;
  h.synchronise = false;
  h.manuel = true;
  majAffichage(j);
}

export function changerFuseau(j: Jeu, fuseau: string) {
  const h = heure(j)!;
  h.fuseau = fuseau;
  h.fuseauChange = systemd(j)!.horloge;
  majAffichage(j);
}

/** Les serveurs NTP de /etc/systemd/timesyncd.conf (NTP=, sinon FallbackNTP=), comme timesyncd. */
export function serveursConfigures(j: Jeu): string[] {
  let section = '';
  const valeurs: Record<string, string[]> = {};
  for (const ligne of (j.lire('/etc/systemd/timesyncd.conf') ?? '').split('\n')) {
    const l = ligne.trim();
    if (/^\[.*\]$/.test(l)) section = l;
    const m = /^(NTP|FallbackNTP)\s*=\s*(.*)$/.exec(l);
    if (m && section === '[Time]') valeurs[m[1]] = m[2].split(/\s+/).filter(Boolean);
  }
  return valeurs.NTP?.length
    ? valeurs.NTP
    : (valeurs.FallbackNTP ?? ['0.debian.pool.ntp.org', '1.debian.pool.ntp.org', '2.debian.pool.ntp.org', '3.debian.pool.ntp.org']);
}

/** systemd-timesyncd démarre : il essaie ses serveurs dans l'ordre ; le premier qui répond règle l'horloge. */
export function synchroniser(j: Jeu) {
  const h = heure(j)!;
  const sd = systemd(j)!;
  const unite = 'systemd-timesyncd.service';
  for (const nom of serveursConfigures(j)) {
    const adresse = h.serveurs[nom];
    if (!adresse) {
      journaliser(sd, unite, 'systemd-timesyncd', 702, `Timed out waiting for reply from ${h.muets[nom] ?? nom}:123 (${nom}).`, 6, false);
      continue;
    }
    journaliser(sd, unite, 'systemd-timesyncd', 702, `Contacted time server ${adresse}:123 (${nom}).`, 6, false);
    h.decalage = 0;
    h.synchronise = true;
    h.serveur = nom;
    majAffichage(j);
    const m = heureMachine(j);
    const d = new Date(m.mur).toISOString();
    journaliser(sd, unite, 'systemd-timesyncd', 702, `Initial clock synchronization to ${d.slice(0, 10)} ${d.slice(11, 19)} ${m.abrev}.`, 6, false);
    return;
  }
  h.synchronise = false;
  h.serveur = undefined;
}

/** timesyncd arrêté : l'horloge n'est plus suivie. */
export function desynchroniser(j: Jeu) {
  const h = heure(j);
  if (!h) return;
  h.synchronise = false;
  h.serveur = undefined;
}
