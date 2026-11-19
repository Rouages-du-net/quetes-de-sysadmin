// The test domain of tests/ad.test.ts: HARBOUR (harbour.internal), a port
// authority's office. The story's main machine is a Linux admin box,
// bridge (192.0.2.69); behind it two Windows Servers 2022 as internal
// hosts: dc01, the domain controller (192.0.2.70), and files, a member file
// server (192.0.2.71) with a Docs share. OUs Staff/Pilots, Staff/Office,
// Servers, Contractors (inheritance blocked); a lockout policy (5 tries);
// GPOs for the servers' firewall, the pilots' drive, a disabled link, an
// enforced baseline.

import { Shell } from '../src/engine/shell';
import type { Chapter, Directory } from '../src/engine/world';
import { d, f } from '../src/engine/world';
import { domainController, windowsMachine, type WindowsOptions } from '../src/engine/windows-world';
import type { DomainSpec } from '../src/engine/windows-ad';

export const CLOCK = Date.UTC(2029, 10, 20, 9, 0, 0);
export const ADMIN_PASSWORD = 'Harbour-2029-adm';
export const DC_ADDRESS = '192.0.2.70';
export const FILES_ADDRESS = '192.0.2.71';
export const BRIDGE_ADDRESS = '192.0.2.69';

const NETWORK = (address: string) => ({ address, mask: '255.255.255.0', gateway: '192.0.2.1', dns: DC_ADDRESS, suffix: 'harbour.internal' });

export const DOMAIN: Omit<DomainSpec, 'dc'> = {
  dns: 'harbour.internal',
  netbios: 'HARBOUR',
  ous: [
    { path: 'Staff', description: 'Everyone who works here' },
    { path: 'Staff/Pilots' },
    { path: 'Staff/Office' },
    { path: 'Servers' },
    { path: 'Contractors', blockInheritance: true },
  ],
  users: [
    { sam: 'alice', given: 'Alice', surname: 'Martin', ou: 'Staff/Pilots', password: 'Alice-2029-pw', department: 'Pilotage', title: 'Pilot' },
    { sam: 'bob', given: 'Bob', surname: 'Diallo', ou: 'Staff/Office', password: 'Bob-2029-pw', department: 'Office', title: 'Clerk', manager: 'alice' },
    { sam: 'carla', given: 'Carla', surname: 'Nguyen', ou: 'Staff/Pilots', password: 'Carla-2029-pw', department: 'Pilotage', enabled: false },
    { sam: 'dmitri', given: 'Dmitri', surname: 'Ivanov', ou: 'Contractors', password: 'Dmitri-2029-pw', department: 'Contractor', lastLogon: 200 },
    { sam: 'svc_backup', name: 'Backup Service', ou: 'Servers', password: 'Backup-2029-svc', neverExpires: true, description: 'Backup service account' },
  ],
  groups: [
    { name: 'Pilots', ou: 'Staff', members: ['alice', 'carla'], description: 'The harbour pilots' },
    { name: 'Office Staff', ou: 'Staff', members: ['bob'] },
    { name: 'Docs Editors', ou: 'Staff', scope: 'DomainLocal', members: ['Pilots'], description: 'May change the Docs share' },
  ],
  computers: [{ name: 'FILES', ou: 'Servers', address: FILES_ADDRESS }],
  policy: { threshold: 5, duration: 30, window: 30 },
  gpos: [
    {
      name: 'Server Firewall',
      settings: [
        { kind: 'firewallRule', display: 'Allow SMB from the office', protocol: 'TCP', localPort: ['445'], remoteAddress: ['192.0.2.0/24'], action: 'Allow' },
        { kind: 'firewallRule', display: 'Allow ping from the office', protocol: 'ICMPv4', localPort: ['Any'], remoteAddress: ['192.0.2.0/24'], action: 'Allow' },
      ],
      links: [{ target: 'Servers' }],
    },
    { name: 'Pilots Drive', settings: [{ kind: 'driveMap', letter: 'P', path: '\\\\files\\Docs', label: 'Docs' }], links: [{ target: 'Staff/Pilots' }], apply: ['Pilots'] },
    { name: 'Office Drive', settings: [{ kind: 'driveMap', letter: 'O', path: '\\\\files\\Office' }], links: [{ target: 'Staff' }], apply: ['Office Staff'] },
    { name: 'Old Login Script', settings: [{ kind: 'logonScript', script: 'old.bat' }], links: [{ target: 'Staff', enabled: false }] },
    { name: 'Security Baseline', settings: [{ kind: 'userRight', right: 'SeDenyInteractiveLogonRight', accounts: ['HARBOUR\\Domain Guests'] }], links: [{ target: '', enforced: true }] },
  ],
};

const base: WindowsOptions = { computer: 'DC01', player: 'you', password: ADMIN_PASSWORD, clock: CLOCK };

export const DC_OPTIONS: WindowsOptions = { ...base, network: NETWORK(DC_ADDRESS), volumes: [{ letter: 'C', label: '', size: 120 * 1024 ** 3, base: 20 * 1024 ** 3 }] };

export const FILES_OPTIONS: WindowsOptions = {
  ...base,
  computer: 'FILES',
  network: NETWORK(FILES_ADDRESS),
  domain: { dns: 'harbour.internal', netbios: 'HARBOUR', dc: 'dc01', ou: 'OU=Servers,DC=harbour,DC=internal' },
  volumes: [
    { letter: 'C', label: '', size: 120 * 1024 ** 3, base: 20 * 1024 ** 3 },
    { letter: 'D', label: 'Data', size: 200 * 1024 ** 3, base: 1024 ** 3 },
  ],
  shares: [{ name: 'Docs', path: 'D:\\Shares\\Docs', description: 'Harbour documents', change: [], access: [{ account: 'Everyone', right: 'Full' }] }],
};

const linuxWorld = (): Directory =>
  d({
    home: d({ you: d({ '.ssh': d({}) }) }),
    etc: d({ hosts: f(`127.0.0.1\tlocalhost\n${BRIDGE_ADDRESS}\tbridge\n${DC_ADDRESS}\tdc01 dc01.harbour.internal\n${FILES_ADDRESS}\tfiles files.harbour.internal\n`, { lines: true }) }),
    tmp: d({}),
    mnt: d({ docs: d({}) }),
  });

/** The chapter: bridge (Linux) and its internal hosts dc01 and files. */
export function harbourChapter(options: { files?: Partial<WindowsOptions>; domain?: Partial<typeof DOMAIN> } = {}): Chapter {
  const dc = domainController(DC_OPTIONS, { ...DOMAIN, ...options.domain });
  const files = windowsMachine({ ...FILES_OPTIONS, ...options.files }, {
    D: {
      Shares: d({
        Docs: { type: 'directory', children: { 'tides.txt': f('High tide 06:12\r\n', { lines: true }) }, acl: { aces: [{ id: 'HARBOUR\\Docs Editors', mask: 0x1301bf, oi: true, ci: true }, { id: 'HARBOUR\\Domain Users', mask: 0x1200a9, oi: true, ci: true }] } },
      }),
    },
  });
  return {
    id: 'ad-test',
    number: 1,
    commands: ['ssh', 'smbclient', 'mount', 'ls', 'cat', 'exit', 'ping'],
    home: '/home/you',
    welcome: 'welcome.txt',
    final: '',
    events: [],
    createWorld: linuxWorld,
    hosts: {
      dc01: { address: DC_ADDRESS, domain: 'dc01.harbour.internal', home: dc.home, accounts: dc.accounts, state: dc.state, createWorld: dc.createWorld },
      files: { address: FILES_ADDRESS, domain: 'files.harbour.internal', home: files.home, accounts: files.accounts, state: files.state, createWorld: files.createWorld },
    },
  };
}

/** The Linux box, and a function that opens a Windows host's session (logged on as the player). */
export function harbour(options: Parameters<typeof harbourChapter>[0] = {}) {
  const bridge = new Shell(harbourChapter(options), 'en', 'bridge');
  const host = (name: 'dc01' | 'files') => bridge.internal(name)!;
  return { bridge, host };
}
