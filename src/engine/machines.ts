// The simulated network: the player's workstation, and one machine per
// story. Documentation addresses (RFC 5737), domain reserved for examples
// (RFC 6761). The SSH keys and fingerprints are fake but have the shape of
// real ones (ed25519), and never change: the game stays deterministic.

import type { Translate } from '../texts';

export interface Machine {
  // The machine's identifier (in French); the name you type depends on the language (machineName).
  name: string;
  // Full name, resolved by the workstation's /etc/hosts.
  domain: string;
  address: string;
  // Story played on this machine (absent for the workstation).
  story?: string;
  // The game gives no key: you create your own (ssh-keygen, ssh-copy-id).
  withoutKey?: boolean;
}

const machine = (name: string, address: string, story?: string, withoutKey = false): Machine => ({
  name,
  domain: `${name}.internal`,
  address,
  story,
  ...(withoutKey ? { withoutKey } : {}),
});

export const WORKSTATION = machine('desk', '192.0.2.2');

export const MACHINES: Machine[] = [
  machine('kingdom', '192.0.2.10', 'eraser'),
  machine('datacenter', '192.0.2.11', 'datacenter'),
  machine('anthill', '192.0.2.12', 'packet'),
  machine('manuscript', '192.0.2.13', 'time-machine'),
  machine('library', '192.0.2.14', 'archives'),
  // The Neighbourhood Letters' server: the same address as letters.example
  // in The Lost Package.
  machine('letters', '203.0.113.10', 'letters'),
  machine('workshop', '192.0.2.15', 'fablab'),
  machine('gazette', '192.0.2.16', 'gazette'),
  machine('games', '192.0.2.17', 'game-library'),
  machine('radio', '192.0.2.18', 'on-call'),
  // The Community Centre: a gateway, in front of its internal network.
  machine('community', '192.0.2.19', 'community-centre', true),
  machine('coop', '192.0.2.20', 'coop'),
  machine('hive', '192.0.2.21', 'hive'),
  machine('bakery', '192.0.2.22', 'audit'),
  machine('lab', '192.0.2.23', 'lab'),
  // The Bakery, six months later (story 16): a new server (migration as the
  // business grew), same characters.
  machine('kneader', '192.0.2.24', 'watch'),
  // The Shared Gardens: their server, with their public name gardens.example (same address).
  machine('garden', '203.0.113.30', 'junk-mail'),
  // The community centres' control station: Ansible, and behind it three servers.
  machine('pilot', '192.0.2.25', 'fleet'),
  // La Rustine, the bike workshop: its small public server (cycles.example), with Caddy.
  machine('patch', '203.0.113.40', 'patch'),
  // The Canteen: the neighbourhood's solidarity canteen, its menu and bookings server.
  machine('canteen', '192.0.2.26', 'canteen'),
];

/** A machine's name in the language (machines.ftl: royaume → kingdom); a machine without a translation keeps its own. */
export const machineName = (t: Translate, id: string) => (t.exists(`machine-${id}`) ? t(`machine-${id}`) : id);
/** Its full name (royaume.internal → kingdom.internal). */
export const machineDomain = (t: Translate, m: Machine) => `${machineName(t, m.name)}.internal`;

/** A host name in the language: royaume → kingdom, royaume.internal → kingdom.internal, wiki.maison.internal → wiki.community.internal. */
export function hostInLanguage(t: Translate, n: string): string {
  const id = (x: string) => [WORKSTATION, ...MACHINES].some((m) => m.name === x);
  if (id(n)) return machineName(t, n);
  return n.replace(/(?<=^|\.)([a-z0-9-]+)(?=\.internal$)/, (x) => (id(x) ? machineName(t, x) : x));
}

/**
 * The machine names of a saved text (known_hosts, ~/.ssh/config) put into
 * the game's language: a save made in French (royaume, royaume.internal,
 * id_royaume) also works in English (kingdom…).
 */
export function translateHosts(text: string, t: Translate, other: Translate[]): string {
  let r = text;
  for (const m of [WORKSTATION, ...MACHINES]) {
    const wanted = machineName(t, m.name);
    for (const a of other) {
      const old = machineName(a, m.name);
      if (old === wanted) continue;
      r = r.replace(new RegExp(`(?:(?<![\\w.-])|(?<=id_))${old}(?![\\w-])|(?<=\\.)${old}(?=\\.internal\\b)`, 'g'), wanted);
    }
  }
  return r;
}

export const storyMachine = (story: string) => MACHINES.find((m) => m.story === story);
export const machineByAddress = (address: string) => [WORKSTATION, ...MACHINES].find((m) => m.address === address);

// A string of base64 characters derived from a name (FNV-1a), always the same.
export function base64(seed: string, length: number): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let h = 0x811c9dc5;
  let s = '';
  for (let i = 0; s.length < length; i++) {
    h ^= seed.charCodeAt(i % seed.length) + i;
    h = Math.imul(h, 0x01000193) >>> 0;
    s += alphabet[h % 64];
  }
  return s;
}

// A reinstalled machine has a new host key: `generation` comes from the
// chapter being played (Chapter.hostKey), empty for the original key.

/** Public host key (known_hosts line, without the name). */
export const hostKey = (m: Machine, generation = '') => `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI${base64('cle-hote-' + m.name + generation, 43)}`;

/** A text of any length summed up in 8 hexadecimal digits (FNV-1a): base64 only reads the start of its seed. */
export function condensed(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(16).padStart(8, '0');
}

/** Fingerprint of a public key, as ssh shows it: SHA256:… (43 characters). */
export const keyFingerprint = (key: string) => `SHA256:${base64(condensed(key.split(' ').slice(0, 2).join(' ')) + '-empreinte', 43)}`;

/** Fingerprint of a machine's host key. */
export const fingerprint = (m: Machine, generation = '') => keyFingerprint(hostKey(m, generation));

/** The private key that opens a session on the machine. */
export const privateKey = (m: Machine) =>
  [
    '-----BEGIN OPENSSH PRIVATE KEY-----',
    ...base64('cle-privee-' + m.name, 70 * 5)
      .match(/.{70}/g)!
      .map((l, i) => (i === 0 ? 'b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW' + l.slice(68) : l)),
    '-----END OPENSSH PRIVATE KEY-----',
  ].join('\n');

/** The matching public key (~/.ssh/id_<machine>.pub), with the comment of the account that created it on the workstation (vous@poste, you@desk…). */
export const publicKey = (m: Machine, account = 'you', workstation = 'desk') => `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI${base64('cle-publique-' + m.name, 43)} ${account}@${workstation}`;
