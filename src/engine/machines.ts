// The simulated network: the player's workstation, and one machine per
// story. Documentation addresses (RFC 5737), domain reserved for examples
// (RFC 6761). The SSH keys and fingerprints are fake but have the shape of
// real ones (ed25519), and never change: the game stays deterministic.

import { storyTranslated, type Translate } from '../texts';

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
  // Another system than Debian (see freebsd.ts): its login banner. A Windows
  // Server (windows.ts) shows no banner: its OpenSSH lands in cmd or PowerShell.
  os?: 'freebsd' | 'solaris' | 'ibmi' | 'windows' | 'rhel';
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
  // The Observatory: an amateur astronomy club, its photo gallery and the stacking of its night photos.
  machine('observatory', '192.0.2.27', 'observatory'),
  // The Theatre: a neighbourhood theatre, its ticket office and its PostgreSQL database.
  machine('theatre', '192.0.2.28', 'theatre'),
  // The Huts: a federation of mountain huts, and the valley's server that gathers their logs.
  machine('valley', '192.0.2.30', 'huts'),
  // The Photo Club: the club's NAS, and its darkroom computer behind it (NFS, Samba).
  machine('nas', '192.0.2.31', 'photo-club'),
  // The Bastion: the Bakery's delivery server, a year after The Watch (an incident to handle).
  machine('oven', '192.0.2.33', 'bastion'),
  // The Other Unix: the film club's FreeBSD server.
  { ...machine('projector', '192.0.2.34', 'other-unix'), os: 'freebsd' },
  // The Old Sun: the seed library's Sun Fire, Solaris 10 on SPARC (its new server, greenhouse, is behind it).
  { ...machine('herbarium', '192.0.2.35', 'old-sun'), os: 'solaris' },
  // The Night Batch: the Mutual's Debian server, where its nightly COBOL batch moved off the bureau's mainframe.
  machine('abacus', '192.0.2.37', 'night-batch'),
  // The Order Book: the flour mill's IBM i, which has taken its bakeries' orders since 1996 (sieve, its new reporting server, is behind it).
  { ...machine('mill', '192.0.2.38', 'order-book'), os: 'ibmi' },
  // Next Door Windows: the architects' Debian server, next to cabinet, their Windows Server file server (an internal host).
  machine('compass', '192.0.2.40', 'mixed-fleet'),
  // The Music School: its file server, a Windows Server 2022 (OpenSSH lands in cmd.exe).
  { ...machine('stave', '192.0.2.42', 'music-school'), os: 'windows' },
  // The Card Catalogue: the libraries' domain controller (lending.internal), a Windows Server 2022; stacks, their file server, is an internal host.
  { ...machine('register', '192.0.2.46', 'card-catalogue'), os: 'windows' },
  // The Pantry: the community grocery's Debian server; spare, a borrowed laptop for the restore drill, is an internal host.
  machine('crate', '192.0.2.48', 'pantry'),
  // The Ferry: the ferry cooperative's Debian server, in IPv4 and IPv6; lookout, islenet's monitoring box on the internet, is an internal host.
  machine('quay', '192.0.2.52', 'ferry'),
  // The Bike Share: the cooperative's monitoring server (Prometheus, Alertmanager); saddle and hub are internal hosts.
  machine('gauge', '192.0.2.54', 'bike-share'),
  // The Pool: the swimming pool's Debian server, a single-node k3s cluster (the booking app).
  machine('lane', '192.0.2.62', 'pool'),
  // The Staff Room: a primary school's print server (CUPS), with a leg on the staff and the pupils' networks.
  machine('chalk', '192.0.2.64', 'staff-room'),
  // The Airwaves: the community radio federation's Debian server, its internal certificate authority and its HTTPS services.
  machine('mast', '192.0.2.72', 'airwaves'),
  // The Tool Library: a nonprofit's git forge (Forgejo) and its CI runner, for its open-source lending software.
  machine('anvil', '192.0.2.80', 'tool-library'),
  // The Health Centre: a rural practice's Debian hypervisor (KVM, libvirt) and its virtual machines.
  machine('hearth', '192.0.2.88', 'health-centre'),
  // The Blood Drive: a blood service's two load balancers (keepalived, HAProxy); lb2 and the web servers are internal machines.
  machine('lb1', '192.0.2.104', 'blood-drive'),
  // The Choir: a community choir's server (nginx, PostgreSQL, restic) and the personal data it keeps.
  machine('baton', '192.0.2.112', 'choir'),
  // The Allotments: an allotments association's MariaDB server (trowel) and, behind it, the app's server and the replica.
  machine('trowel', '192.0.2.131', 'allotments'),
  // The Lifeboat: a volunteer lifeboat station's inbound mail server (Postfix, Dovecot with Sieve, rspamd).
  machine('slipway', '192.0.2.140', 'lifeboat'),
  // The Climbing Wall: the hall's server (belay) behind a UPS, and the NAS (harness) on the office network.
  machine('belay', '192.0.2.141', 'climbing-wall'),
  // The Dance Troupe: a community dance troupe's server, a node of its Garage cluster (S3 object storage).
  machine('wings', '192.0.2.160', 'dance-troupe'),
  // The Shelter: the animal shelters' offsite server (restic repository, the written plan, hidden primary DNS); paddock and haven are internal hosts.
  machine('meadow', '192.0.2.164', 'shelter'),
  // The Language Café: a nonprofit's Rocky Linux 10 server (httpd, firewalld, SELinux); noticeboard, the café's screen, is an internal host.
  { ...machine('kettle', '192.0.2.170', 'language-cafe'), os: 'rhel' },
  // The Mapping Party: a mapping collective's DNS server (BIND), its zone kept as code with OpenTofu.
  machine('cairn', '192.0.2.176', 'mapping-party'),
  // The Walking Club: a walking club's Debian server, its web app in a rootless Podman container behind nginx.
  machine('stile', '192.0.2.184', 'walking-club'),
  // The Zine Library: a volunteer zine library's Debian server (nginx, php-fpm and its AppArmor profile, a backup script to confine).
  machine('stapler', '192.0.2.190', 'zine-library'),
  // The Tenants' Union: a tenants' union's server (Repairline, its repairs app, and PostgreSQL), its secrets kept with sops and age in git.
  machine('latch', '192.0.2.196', 'tenants-union'),
  // The Hostel: a cooperative hostel's secrets server (OpenBao), behind its booking site Bunks.
  machine('padlock', '192.0.2.226', 'hostel'),
];

/**
 * A machine's name in the language (machines.ftl: royaume → kingdom); a
 * machine without a translation keeps its own, and so does the machine of a
 * story a draft language doesn't translate yet (its texts, in English, name it so).
 */
export const machineName = (t: Translate, id: string) => {
  const story = MACHINES.find((m) => m.name === id)?.story;
  if (story && !storyTranslated(t.language, story)) return id;
  return t.exists(`machine-${id}`) ? t(`machine-${id}`) : id;
};
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
