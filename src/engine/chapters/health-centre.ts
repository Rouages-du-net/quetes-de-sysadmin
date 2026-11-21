// Story "The Health Centre": what its chapters share. Millbrook Health
// Centre, a rural practice (three GPs, two nurses, a physiotherapist, a
// reception desk), runs its few servers as virtual machines on one Debian
// hypervisor in the back office: hearth (foyer in French, 192.0.2.88), KVM
// with libvirt. Its guests: ledger (the accounting, for Priya), agenda (the
// appointment book the reception uses all day), records (the medical
// records application), and, from chapter 2, portal (the patients'
// appointment portal Hamid set up) and agenda-training (Hamid's copy of
// agenda, for training new receptionists). Ilse, the volunteer who built
// it all, moved away; Grace manages the practice.
// The office's network: 192.0.2.0/24 (RFC 5737), its router 192.0.2.1
// serves DHCP and DNS (the .internal names of what it leased); hearth is
// on it through its bridge br0 (on eno1), and so are the guests whose
// interface is on br0. libvirt's default network (virbr0, 192.168.122.0/24,
// NAT) is only reachable from hearth itself. reception (192.0.2.95) is the
// reception desk's PC.
// Each command, twenty seconds pass: guests boot, shut down, write.
// Sources: https://wiki.debian.org/KVM, https://libvirt.org/formatnetwork.html,
// https://wiki.libvirt.org/Networking.html, https://www.freedesktop.org/software/systemd/man/latest/machine-id.html.

import { accountsFiles, d, f, type Accounts, type Directory, type File, type InternalHost, type Node, type Rights } from '../world';
import type { Game, Shell } from '../shell';
import type { Translate } from '../../texts';
import { newSystemd, systemd, type DefinitionService } from '../systemd';
import { generateKey } from '../access';
import { machineName } from '../machines';
import {
  GiB, IMAGES, MiB, QEMU_USER, advance, clientIdOf, answering, bootGuest, guestAddress, hash, imageFile, libvirt, macOf, machineIdOf, stopDomain, sync, topOf, uuidOf,
  type DiskImage, type DomConfig, type Domain, type LibvirtState, type Snapshot, type Where,
} from '../libvirt';

export const HOME = '/home/you';
export const PASSWORD = 'waiting-room-30';
export const HEARTH = '192.0.2.88';
export const RECEPTION = '192.0.2.95';
export const ROUTER = '192.0.2.1';
export const NAT_HOST = '192.168.122.1';

// Monday 11 March 2030, 8:05 (chapter 1: the storm was on Saturday night);
// Tuesday 26 March, 9:10 (chapter 2); Thursday 18 April, 14:00 (chapter 3).
export const NOW_1 = Date.UTC(2030, 2, 11, 8, 5, 0);
export const NOW_2 = Date.UTC(2030, 2, 26, 9, 10, 0);
export const NOW_3 = Date.UTC(2030, 3, 18, 14, 0, 0);
const BOOT_1 = Date.UTC(2030, 2, 9, 23, 48, 12);
const BOOT_2 = Date.UTC(2030, 2, 11, 9, 2, 0);
export type ChapterNo = 1 | 2 | 3;

// The guests' MAC addresses and identities.
export const MAC = {
  ledger: '52:54:00:3e:71:0a',
  agenda: '52:54:00:a6:3e:10',
  records: '52:54:00:9c:42:7b',
  portal: '52:54:00:5b:9e:41',
};
export const MACHINE_ID = {
  ledger: machineIdOf('millbrook-ledger'),
  agenda: machineIdOf('millbrook-agenda'),
  records: machineIdOf('millbrook-records'),
  portal: machineIdOf('millbrook-portal'),
};
export const PORTAL_NAT = '192.168.122.47';
export const LAN_IP = { ledger: '192.0.2.89', agenda: '192.0.2.90', records: '192.0.2.92' };

// ——— Accounts ———

export const hearthAccounts = (): Accounts => ({
  users: {
    root: { uid: 0, group: 'root', home: '/root' },
    you: { uid: 1000, group: 'you' },
    'libvirt-qemu': { uid: 64055, group: 'kvm', home: '/var/lib/libvirt', shell: '/usr/sbin/nologin' },
    'libvirt-dnsmasq': { uid: 64056, group: 'libvirt-dnsmasq', home: '/var/lib/libvirt/dnsmasq', shell: '/usr/sbin/nologin' },
  },
  groups: {
    root: { gid: 0, members: [] },
    adm: { gid: 4, members: ['you'] },
    sudo: { gid: 27, members: ['you'] },
    kvm: { gid: 994, members: [] },
    libvirt: { gid: 993, members: ['you'] },
    'libvirt-dnsmasq': { gid: 64056, members: [] },
    you: { gid: 1000, members: [] },
  },
});

const guestAccounts = (): Accounts => ({
  users: { root: { uid: 0, group: 'root', home: '/root' }, you: { uid: 1000, group: 'you' } },
  groups: { root: { gid: 0, members: [] }, adm: { gid: 4, members: ['you'] }, sudo: { gid: 27, members: ['you'] }, you: { gid: 1000, members: [] } },
});

// ——— Helpers ———

const root: Rights = { owner: 'root' };
const dir = (children: Record<string, Node>, rights: Rights = root) => d(children, undefined, rights);
const file = (text: string, rights: Rights = root): File => f(text, { lines: true, ...rights });
const proc = (pid: number, user: string, command: string) => ({ pid, user, cpu: 0, mem: 0.3, command });
export const host = (j: Game) => (j as Shell).principal;
export const sd = (j: Game) => systemd(host(j))!;
export const seen = (j: Game, text: string | RegExp) => {
  // The manual quotes the tools' messages: reading it is not meeting them.
  if (/^\s*(man|apropos|whatis|help)\b|--help\b/.test(typed(j))) return false;
  const all = `${j.last.output}\n${j.last.errors.join('\n')}`;
  return typeof text === 'string' ? all.includes(text) : text.test(all);
};
export const typed = (j: Game) => (j as Shell).last.line ?? '';
export const dom = (j: Game, name: string): Domain | undefined => libvirt(j).domains[name];
export const guest = (j: Game, name: string): Shell | null => host(j).internals.get(name) ?? null;
/** How many times the player connected to an internal machine (by key or password). */
export const connections = (j: Game, name: string) => {
  const c = guest(j, name)?.state.sshConnections as { key: number; password: number } | undefined;
  return c ? c.key + c.password : 0;
};

// ——— Domains ———

const vm = (name: string, memory: number, vcpus: number, source: string, iface: { type: 'network' | 'bridge'; source: string; mac: string } | null): DomConfig => ({
  name,
  uuid: uuidOf(`millbrook-${name}`),
  memory: memory * 1024 * 1024,
  currentMemory: memory * 1024 * 1024,
  vcpus,
  maxVcpus: vcpus,
  osId: 'http://debian.org/debian/13',
  disks: [{ target: 'vda', source, format: 'qcow2', device: 'disk', bus: 'virtio' }],
  ifaces: iface ? [{ ...iface, model: 'virtio' }] : [],
});

const domainOf = (config: DomConfig, o: Partial<Domain> = {}): Domain => ({
  config,
  live: null,
  state: 'shut off',
  reason: 'unknown',
  id: null,
  pid: null,
  autostart: true,
  persistent: true,
  snapshots: [],
  current: null,
  booting: 0,
  cpuTime: 0,
  ...o,
});

const br = (mac: string) => ({ type: 'bridge' as const, source: 'br0', mac });

/** The images under /var/lib/libvirt/images for a chapter: name → [disk, size on the host, date]. */
export function images(n: ChapterNo): Record<string, [DiskImage, number, number]> {
  const G = (x: number) => Math.round(x * GiB);
  const out: Record<string, [DiskImage, number, number]> = {
    'agenda.qcow2': [{ format: 'qcow2', virtual: 40 * GiB, fresh: G(21.4) }, G(21.4), Date.UTC(2028, 8, 14, 10, 2, 0)],
    'debian-13.1.0-amd64-netinst.iso': [{ format: 'iso', virtual: 754 * MiB }, 754 * MiB, Date.UTC(2029, 8, 6, 15, 31, 0)],
  };
  if (n === 1) {
    out['records.qcow2'] = [{ format: 'qcow2', virtual: 20 * GiB, fresh: G(19.4) }, G(19.4), Date.UTC(2028, 8, 15, 9, 40, 0)];
    out['ledger.qcow2'] = [{ format: 'qcow2', virtual: 200 * GiB, fresh: G(58) }, G(58), Date.UTC(2029, 2, 2, 18, 41, 7)];
    out['ledger.before-update'] = [{ format: 'qcow2', virtual: 200 * GiB, backing: `${IMAGES}/ledger.qcow2`, fresh: G(3.1) }, G(41.5), Date.UTC(2029, 11, 28, 17, 5, 44)];
    out['ledger.before-yearend'] = [{ format: 'qcow2', virtual: 200 * GiB, backing: `${IMAGES}/ledger.before-update`, fresh: G(2.4) }, G(37.2), Date.UTC(2030, 1, 22, 19, 12, 3)];
    out['ledger.before-upgrade'] = [{ format: 'qcow2', virtual: 200 * GiB, backing: `${IMAGES}/ledger.before-yearend`, fresh: G(1.8) }, G(18.6), Date.UTC(2030, 2, 9, 23, 41, 50)];
    out['ledger-test-clone.qcow2'] = [{ format: 'qcow2', virtual: 200 * GiB, fresh: G(12.3) }, G(12.3), Date.UTC(2030, 0, 17, 11, 20, 0)];
    out['records.qcow2'][1] = G(45);
    out['records.qcow2'][0] = { format: 'qcow2', virtual: 80 * GiB, fresh: G(45) };
  } else {
    out['ledger.qcow2'] = [{ format: 'qcow2', virtual: 200 * GiB, fresh: G(69.4) }, G(69.4), Date.UTC(2030, 2, 11, 8, 40, 0)];
    out['portal.qcow2'] = [{ format: 'qcow2', virtual: 20 * GiB, fresh: G(4.1) }, G(4.1), Date.UTC(2030, 2, 22, 16, 2, 0)];
    out['agenda-training.qcow2'] = [{ format: 'qcow2', virtual: 40 * GiB, fresh: G(21.6) }, G(21.6), Date.UTC(2030, 2, 25, 15, 47, 0)];
    out['records.qcow2'] =
      n === 2
        ? [{ format: 'qcow2', virtual: 20 * GiB, fresh: G(19.4) }, G(19.4), Date.UTC(2028, 8, 15, 9, 40, 0)]
        : [
            {
              format: 'qcow2',
              virtual: 20 * GiB,
              fresh: G(19.6),
              snapshots: [{ id: 1, tag: 'before-trixie', vmSize: Math.round(3.9 * GiB), date: Date.UTC(2029, 9, 12, 18, 3, 21), vmClock: 7_481_000, virtual: 20 * GiB }],
            },
            G(23.6),
            Date.UTC(2028, 8, 15, 9, 40, 0),
          ];
  }
  return out;
}

export function domains(n: ChapterNo): Record<string, Domain> {
  const out: Record<string, Domain> = {};
  out.agenda = domainOf(vm('agenda', 8, 2, `${IMAGES}/agenda.qcow2`, br(MAC.agenda)), { state: 'running', reason: 'booted', id: 1, guestUsed: 2 * MiB, guestCache: Math.round(5.5 * MiB) });
  out.records = domainOf(vm('records', 16, 4, `${IMAGES}/records.qcow2`, br(MAC.records)), { state: 'running', reason: 'booted', id: 2, guestUsed: Math.round(3.4 * MiB), guestCache: 12 * MiB });
  if (n === 1) {
    out.records = domainOf(vm('records', 8, 4, `${IMAGES}/records.qcow2`, br(MAC.records)), { state: 'running', reason: 'booted', id: 2, guestUsed: Math.round(3.4 * MiB), guestCache: 4 * MiB });
    out.ledger = domainOf(vm('ledger', 6, 2, `${IMAGES}/ledger.before-upgrade`, br(MAC.ledger)), {
      autostart: false,
      reason: 'unknown',
      writes: { rate: 3 * GiB, left: 0, total: 6 * GiB },
      guestUsed: Math.round(1.5 * MiB),
      guestCache: Math.round(4.5 * MiB),
      snapshots: ledgerSnapshots(),
      current: 'before-upgrade',
    });
    return out;
  }
  out.ledger = domainOf(vm('ledger', 6, 2, `${IMAGES}/ledger.qcow2`, br(MAC.ledger)), { state: 'running', reason: 'booted', id: 3, guestUsed: Math.round(1.5 * MiB), guestCache: Math.round(4.5 * MiB) });
  if (n === 2) {
    out.portal = domainOf(vm('portal', 4, 2, `${IMAGES}/portal.qcow2`, { type: 'network', source: 'default', mac: MAC.portal }), { state: 'running', reason: 'booted', id: 4, guestUsed: Math.round(0.8 * MiB), guestCache: Math.round(3.2 * MiB) });
    out['agenda-training'] = domainOf(vm('agenda-training', 4, 2, `${IMAGES}/agenda-training.qcow2`, br(MAC.agenda)), { state: 'running', reason: 'booted', id: 5, autostart: false, guestUsed: 1 * MiB, guestCache: 2 * MiB });
    // Hamid removed the uuid line (virsh define refused his copy otherwise): libvirt gave it a new one.
    out['agenda-training'].config.uuid = uuidOf('millbrook-agenda-training-hamid');
  } else {
    out.portal = domainOf(vm('portal', 4, 2, `${IMAGES}/portal.qcow2`, br(MAC.portal)), { state: 'running', reason: 'booted', id: 4, guestUsed: Math.round(0.8 * MiB), guestCache: Math.round(3.2 * MiB) });
    out['agenda-training'] = domainOf(vm('agenda-training', 4, 2, `${IMAGES}/agenda-training.qcow2`, br(macOf('millbrook-agenda-training'))), { autostart: false, reason: 'shutdown' });
    out.records.snapshots = [{ name: 'before-trixie', description: 'Ilse: before the upgrade to Debian 13', created: Date.UTC(2029, 9, 12, 18, 3, 21), state: 'running', location: 'internal', parent: null }];
    out.records.current = 'before-trixie';
  }
  return out;
}

function ledgerSnapshots(): Snapshot[] {
  const ext = (name: string, created: number, parent: string | null, frozen: string, description: string): Snapshot => ({
    name, created, parent, description, state: 'disk-snapshot', location: 'external', overlay: { vda: `${IMAGES}/ledger.${name}` }, frozen: { vda: frozen },
  });
  return [
    ext('before-update', Date.UTC(2029, 2, 2, 18, 41, 7), null, `${IMAGES}/ledger.qcow2`, 'Ilse: before the accounting software update'),
    ext('before-yearend', Date.UTC(2029, 11, 28, 17, 5, 44), 'before-update', `${IMAGES}/ledger.before-update`, 'Ilse: before the year-end closing'),
    ext('before-upgrade', Date.UTC(2030, 1, 22, 19, 12, 3), 'before-yearend', `${IMAGES}/ledger.before-yearend`, 'Ilse: before the upgrade to Debian 13'),
  ];
}

export function libvirtState(n: ChapterNo): LibvirtState {
  return {
    domains: domains(n),
    networks: {
      default: {
        name: 'default', uuid: uuidOf('millbrook-net-default'), bridge: 'virbr0', active: true, autostart: true, forward: 'nat', address: NAT_HOST, prefix: 24,
        range: ['192.168.122.2', '192.168.122.254'], mac: '52:54:00:1f:8a:c2',
        leases: n === 2 ? [{ mac: MAC.portal, ip: PORTAL_NAT, hostname: 'portal', clientId: clientIdOf(MACHINE_ID.portal), expiry: NOW_2 + 1800_000 }] : [],
      },
    },
    pools: { default: { name: 'default', uuid: uuidOf('millbrook-pool-default'), path: IMAGES, active: true, autostart: true } },
    lan: {
      leases: [
        { clientId: clientIdOf(MACHINE_ID.ledger), mac: MAC.ledger, ip: LAN_IP.ledger, hostname: 'ledger' },
        { clientId: clientIdOf(MACHINE_ID.agenda), mac: MAC.agenda, ip: LAN_IP.agenda, hostname: 'agenda' },
        { clientId: clientIdOf(MACHINE_ID.records), mac: MAC.records, ip: LAN_IP.records, hostname: 'records' },
      ],
      next: 150,
      router: ROUTER,
      prefix: '192.0.2',
      bridge: 'br0',
      uplink: 'eno1',
    },
    hostMemory: 32 * 1024 * 1024,
    hostReserve: Math.round(1.5 * 1024 * 1024),
    hostSwap: 8 * 1024 * 1024,
    hostCpus: 8,
    nextId: n === 1 ? 3 : 6,
    nextPid: 4100,
    jobs: [],
    written: {},
    flip: 0,
    removed: [],
    guests: {
      ledger: { machineId: MACHINE_ID.ledger, hostname: 'ledger' },
      agenda: { machineId: MACHINE_ID.agenda, hostname: 'agenda' },
      records: { machineId: MACHINE_ID.records, hostname: 'records' },
      portal: { machineId: MACHINE_ID.portal, hostname: 'portal' },
      'agenda-training': { machineId: MACHINE_ID.agenda, hostname: 'agenda-training' },
    },
  };
}

// ——— hearth's state and world ———

export function hearthState(t: Translate, n: ChapterNo) {
  const now = n === 1 ? NOW_1 : n === 2 ? NOW_2 : NOW_3;
  const name = machineName(t, 'hearth');
  const services: Record<string, DefinitionService> = {
    ssh: { description: 'OpenBSD Secure Shell server', active: true, executable: 'sshd', process: [proc(702, 'root', 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups')] },
    libvirtd: { description: 'libvirt legacy monolithic daemon', active: true, executable: 'libvirtd', process: [proc(911, 'root', '/usr/sbin/libvirtd --timeout 120')] },
    'libvirt-guests': { description: 'libvirt guests suspend/resume service', active: true, executable: 'libvirt-guests.sh', process: [] },
    cron: { description: 'Regular background program processing daemon', active: true, executable: 'cron', process: [proc(540, 'root', '/usr/sbin/cron -f')] },
  };
  return {
    systemd: newSystemd(name, n === 1 ? BOOT_1 : BOOT_2, now, services),
    process: [proc(1, 'root', '/sbin/init'), proc(1288, 'libvirt-dnsmasq', '/usr/sbin/dnsmasq --conf-file=/var/lib/libvirt/dnsmasq/default.conf --leasefile-ro --dhcp-script=/usr/lib/libvirt/libvirt_leaseshelper'), ...Object.values(services).flatMap((x) => x.process ?? [])],
    mounts: [
      { path: '/', capacity: 29.5 * GiB, name: '/dev/sda2', system: 'ext4', bytesBase: 3.1 * GiB },
      { path: '/var', capacity: (n === 1 ? 240 : 480) * GiB, name: '/dev/sda3', system: 'ext4', bytesBase: 1.2 * GiB },
    ],
    listening: [{ proto: 'tcp', address: '0.0.0.0', port: 22, process: 'sshd', pid: 702 }, { proto: 'udp', address: NAT_HOST, port: 67, process: 'dnsmasq', pid: 1288 }],
    baseLan: {
      interfaces: {
        lo: { name: 'lo', up: true, addresses: ['127.0.0.1/8'], mac: '00:00:00:00:00:00', addresses6: ['::1/128'] },
        eno1: { name: 'eno1', up: true, addresses: [], mac: '3c:ec:ef:41:9a:20' },
        br0: { name: 'br0', up: true, addresses: [`${HEARTH}/24`], mac: '3c:ec:ef:41:9a:20' },
        virbr0: { name: 'virbr0', up: true, addresses: [`${NAT_HOST}/24`], mac: '52:54:00:1f:8a:c2' },
      },
      gateway: { via: ROUTER, dev: 'br0' },
      trunk: '',
      vlans: [],
      devices: [],
      order: ['lo', 'eno1', 'br0', 'virbr0'],
    },
    libvirt: libvirtState(n),
    passwords: {},
  };
}

const INTERFACES = `# This file describes the network interfaces available on your system
# and how to activate them. For more information, see interfaces(5).

source /etc/network/interfaces.d/*

# The loopback network interface
auto lo
iface lo inet loopback

# The physical port is a member of the bridge: no address of its own.
iface eno1 inet manual

# br0: the bridge to the office's network, for hearth and for the guests
# whose interface is on it (Ilse, 2028).
auto br0
iface br0 inet static
	address 192.0.2.88/24
	gateway 192.0.2.1
	bridge_ports eno1
	bridge_stp off
	bridge_fd 0`;

const DEFAULT_NET = `<!--
WARNING: THIS IS AN AUTO-GENERATED FILE. CHANGES TO IT ARE LIKELY TO BE
OVERWRITTEN AND LOST. Changes to this xml configuration should be made using:
  virsh net-edit default
or other application using the libvirt API.
-->

<network>
  <name>default</name>
  <uuid>${uuidOf('millbrook-net-default')}</uuid>
  <forward mode='nat'/>
  <bridge name='virbr0' stp='on' delay='0'/>
  <mac address='52:54:00:1f:8a:c2'/>
  <ip address='192.168.122.1' netmask='255.255.255.0'>
    <dhcp>
      <range start='192.168.122.2' end='192.168.122.254'/>
    </dhcp>
  </ip>
</network>`;

export const hearthKey = (t: Translate) => generateKey('millbrook-hearth', `you@${machineName(t, 'hearth')}`);

export function hearthWorld(t: Translate, n: ChapterNo, welcome: Record<string, string>): Directory {
  const name = machineName(t, 'hearth');
  const key = hearthKey(t);
  const imgs: Record<string, Node> = {};
  for (const [file, [disk, size, mtime]] of Object.entries(images(n))) imgs[file] = imageFile(disk, size, mtime, disk.format === 'iso' ? 'root' : 'root');
  if (n !== 1) imgs['debian-13.1.0-amd64-netinst.iso'] = { ...(imgs['debian-13.1.0-amd64-netinst.iso'] as File), mode: 'rw-r--r--' };
  return dir({
    etc: dir({
      ...accountsFiles(),
      hostname: file(name),
      hosts: file(`127.0.0.1\tlocalhost\n${HEARTH}\t${name}.internal ${name}\n${RECEPTION}\treception.internal reception`),
      'resolv.conf': file(`search internal\nnameserver ${ROUTER}`),
      'nsswitch.conf': file('passwd:         files\ngroup:          files\nshadow:         files\n\nhosts:          files libvirt libvirt_guest dns\nnetworks:       files\n\nprotocols:      db files\nservices:       db files\nethers:         db files\nrpc:            db files'),
      network: dir({ interfaces: file(INTERFACES), 'interfaces.d': dir({}) }),
      libvirt: dir({
        'libvirt.conf': file('#uri_default = "qemu:///system"'),
        'qemu.conf': file('# Master configuration file for the QEMU driver.\n#user = "libvirt-qemu"\n#group = "libvirt-qemu"\n#dynamic_ownership = 1'),
        qemu: dir({ networks: dir({ 'default.xml': file(DEFAULT_NET, { owner: 'root', mode: 'rw-------' }), autostart: dir({ 'default.xml': { type: 'file', content: '', link: '/etc/libvirt/qemu/networks/default.xml', owner: 'root' } }) }), autostart: dir({}) }, { owner: 'root', mode: 'rwxr-xr-x' }),
      }),
    }),
    var: dir({
      lib: dir({
        libvirt: dir({
          images: dir(imgs, { owner: 'root', mode: 'rwx--x--x' }),
          qemu: dir({ snapshot: dir({}, { owner: 'root', mode: 'rwx------' }) }, { owner: QEMU_USER, group: 'kvm', mode: 'rwxr-x--x' }),
          dnsmasq: dir({ 'default.conf': file('strict-order\npid-file=/run/libvirt/network/default.pid\nexcept-interface=lo\nbind-dynamic\ninterface=virbr0\ndhcp-range=192.168.122.2,192.168.122.254,255.255.255.0\ndhcp-no-override\ndhcp-authoritative\ndhcp-lease-max=253\naddn-hosts=/var/lib/libvirt/dnsmasq/default.addnhosts', { owner: 'root', mode: 'rw-------' }) }, { owner: 'libvirt-dnsmasq', mode: 'rwxr-xr-x' }),
        }),
      }),
      log: dir({
        libvirt: dir({ qemu: dir(logs(n), { owner: 'root', mode: 'rwx------' }) }, { owner: 'root', mode: 'rwx------' }),
      }),
    }),
    home: dir({
      you: d({
        ...Object.fromEntries(Object.entries(welcome).map(([k, v]) => [k, f(v)])),
        '.ssh': d({ id_ed25519: f(key.isPrivate, { lines: true, mode: 'rw-------' }), 'id_ed25519.pub': f(key.isPublic, { lines: true }) }, undefined, { mode: 'rwx------' }),
        '.config': d({ libvirt: d({ 'libvirt.conf': f('# Ilse: virsh talks to the system instance, not to a session of its own.\nuri_default = "qemu:///system"', { lines: true }) }) }),
      }),
    }),
    root: dir({}, { owner: 'root', mode: 'rwx------' }),
    tmp: dir({}, { owner: 'root', mode: 'rwxrwxrwt' }),
  });
}

function logs(n: ChapterNo): Record<string, Node> {
  const log = (text: string) => file(text, { owner: 'root', mode: 'rw-------' });
  const start = (name: string, at: string) => `${at}: starting up libvirt version: 11.3.0, package: 1 (Debian), qemu version: 10.0.2Debian 1:10.0.2+ds-2, kernel: 6.12.48+deb13-amd64, hostname: hearth\nLC_ALL=C \\\nPATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin \\\n/usr/bin/qemu-system-x86_64 \\\n-name guest=${name},debug-threads=on \\\n-machine pc-q35-10.0,usb=off,vmport=off,dump-guest-core=off \\\n-accel kvm`;
  const out: Record<string, Node> = {
    'agenda.log': log(`${start('agenda', '2030-03-09 23:48:41.102+0000')}\n2030-03-09 23:48:41.391+0000: Domain id=1 is tainted: host-cpu`),
    'records.log': log(`${start('records', '2030-03-09 23:48:42.020+0000')}\n2030-03-09 23:48:42.301+0000: Domain id=2 is tainted: host-cpu`),
  };
  if (n === 1)
    out['ledger.log'] = log(`${start('ledger', '2030-03-07 08:02:10.441+0000')}\n2030-03-09 23:31:02.117+0000: shutting down, reason=crashed\n2030-03-09 23:31:02.118+0000: qemu-system-x86_64: terminating on signal 15 from pid 1 (/sbin/init)`);
  return out;
}

/** A line in a domain's QEMU log (/var/log/libvirt/qemu/NAME.log). */
export function qemuLog(j: Game, name: string, line: string) {
  const h = host(j);
  const path = `/var/log/libvirt/qemu/${name}.log`;
  const n = h.find(path);
  if (n?.type === 'file') n.content = `${typeof n.content === 'string' ? n.content : ''}\n${line}`;
}

/** At the start: the running guests have their address, the host shows what runs. */
export function initialiseHearth(j: Game) {
  const lv = libvirt(j);
  for (const [name, d] of Object.entries(lv.domains)) {
    if (d.state !== 'running') continue;
    d.live = structuredClone(d.config);
    d.pid = lv.nextPid;
    lv.nextPid += 37;
    d.started = sd(j).clock - 3 * 3_600_000;
    d.cpuTime = 812.4 + (hash(name) % 400);
    d.held = {};
    for (const disk of d.live.disks) {
      let path: string | undefined = disk.source;
      while (path) {
        const node = j.find(path);
        if (node?.type !== 'file') break;
        d.held[path] = node;
        node.owner = QEMU_USER;
        node.group = 'kvm';
        path = node.disk?.backing;
      }
    }
    d.console = ['', `Debian GNU/Linux 13 ${name} ttyS0`, '', `${name} login:`];
    bootGuest(j, name);
  }
  j.state.network = networkView(j as Shell);
  j.state.resolve = (name: string) => resolve(j as Shell, name);
  j.state.reach = (from: Shell, address: string) => reach(from, address);
  sync(j);
}

/** A command passes on the host or in a guest: twenty seconds. */
export function passTime(j: Game) {
  const h = host(j);
  sd(h).clock += 20_000;
  const lv = libvirt(h);
  const paused = Object.entries(lv.domains).filter(([, d]) => d.state === 'paused').map(([n]) => n);
  advance(h);
  // A guest paused by a full disk: QEMU writes it in the domain's log.
  for (const [name, d] of Object.entries(lv.domains))
    if (d.state === 'paused' && d.ioError && !paused.includes(name)) qemuLog(h, name, `block I/O error in device 'libvirt-1-format': No space left on device (28)`);
}

// ——— The network seen by each machine ———

/** Where a session is: hearth itself, the office's network, or behind libvirt's NAT. */
export function whereOf(s: Shell): Where {
  if (s === s.principal) return 'host';
  const name = s.host;
  const d = libvirt(s).domains[name];
  if (d?.live?.ifaces[0]?.type === 'network') return 'nat';
  return 'lan';
}

/** A name, as each machine resolves it: hearth's libvirt NSS module knows its NAT guests; everyone asks the office's DNS. */
export function resolve(s: Shell, name: string): string | null {
  const n = name.toLowerCase().replace(/\.$/, '').replace(/\.internal$/, '');
  const lv = libvirt(s);
  const h = s.principal;
  if (n === h.hostName || n === 'hearth') return HEARTH;
  if (n === 'reception') return RECEPTION;
  if (n === 'router' || n === 'gateway') return ROUTER;
  if (whereOf(s) === 'host' && !name.endsWith('.internal')) {
    for (const net of Object.values(lv.networks)) {
      const l = [...net.leases].reverse().find((x) => x.hostname === n);
      if (l) return l.ip;
    }
  }
  // The office's dnsmasq: the names its DHCP clients gave (the last one to ask wins).
  const l = [...lv.lan.leases].reverse().find((x) => x.hostname === n || x.names?.includes(n));
  return l?.ip ?? null;
}

/** Who answers at an address from a session (an internal machine's name), and whether it is the host or the router. */
export function target(s: Shell, address: string): { kind: 'guest'; name: string } | { kind: 'host' | 'reception' | 'router' } | null {
  const where = whereOf(s);
  if (address === HEARTH || (address === NAT_HOST && where !== 'lan')) return { kind: 'host' };
  if (address === ROUTER) return { kind: 'router' };
  if (address === RECEPTION) return { kind: 'reception' };
  const name = answering(s, address, where);
  if (name) {
    if (where === 'lan' && name === 'portal') s.principal.state.receptionSawPortal = s.host === 'reception' || s.principal.state.receptionSawPortal;
    return { kind: 'guest', name };
  }
  return null;
}

/** ssh's route (see access.ts): the internal machine reached, or why not. */
export function reach(from: Shell, address: string): { host: string } | 'unreachable' | 'timeout' | null {
  const t = target(from, address);
  if (t?.kind === 'reception') return { host: 'reception' };
  if (t?.kind === 'guest') return from.principal.chapter.hosts?.[t.name] ? { host: t.name } : 'unreachable';
  if (t) return 'unreachable';
  // A private address the office's network has no route to: packets go to the router, and nothing comes back.
  if (address.startsWith('192.168.122.') && whereOf(from) === 'lan') return 'timeout';
  return 'unreachable';
}

/** What a guest's web application answers (its home page). */
const PAGES: Record<string, string> = {
  agenda: '<!DOCTYPE html>\n<html><head><title>Agenda - Millbrook Health Centre</title></head>\n<body><h1>Appointment book</h1><p>Today: 46 appointments, 3 GPs, 2 nurses.</p></body></html>',
  'agenda-training': '<!DOCTYPE html>\n<html><head><title>Agenda - TRAINING COPY</title></head>\n<body><h1>TRAINING COPY - not real appointments</h1><p>Today: 12 appointments (sample patients).</p></body></html>',
  portal: '<!DOCTYPE html>\n<html><head><title>Patient portal - Millbrook Health Centre</title></head>\n<body><h1>Book an appointment</h1><p>Choose a GP, a nurse or the physiotherapist.</p></body></html>',
  ledger: '<!DOCTYPE html>\n<html><head><title>Ledger - sign in</title></head>\n<body><h1>Accounting</h1><form action="/login" method="post"></form></body></html>',
};

/** The network as ping and curl see it from a session (network.ts's model, computed on demand). */
export function networkView(s: Shell) {
  const ip = (k: string | symbol) => (typeof k === 'string' ? (/^\d+\.\d+\.\d+\.\d+$/.test(k) ? k : resolve(s, k)) : null);
  return {
    resolvers: [ROUTER, NAT_HOST],
    routes: {},
    names: new Proxy({} as Record<string, string>, { get: (_, k) => (typeof k === 'string' ? (resolve(s, k) ?? undefined) : undefined) }),
    machines: new Proxy({} as Record<string, { ping: boolean; ms: number }>, {
      get: (_, k) => {
        const a = typeof k === 'string' ? k : null;
        const t = a ? target(s, a) : null;
        return t ? { ping: true, ms: t.kind === 'guest' ? 0.31 : 0.42 } : undefined;
      },
    }),
    web: new Proxy({} as Record<string, { headers: string[]; body: string }>, {
      get: (_, k) => {
        const a = ip(k);
        const t = a ? target(s, a) : null;
        const body = t?.kind === 'guest' ? PAGES[t.name] : undefined;
        return body ? { headers: ['HTTP/1.1 200 OK', 'Server: nginx/1.26.3', 'Content-Type: text/html', `Content-Length: ${body.length + 1}`], body } : undefined;
      },
    }),
  };
}

// ——— The guests ———

export interface GuestOptions {
  name: string;
  commands: string[];
  machineId: string;
  hostname?: string;
  // The guest's own files (home and /srv).
  files?: (t: Translate) => Record<string, Node>;
  // The root file system: its size and what it holds besides the world's files.
  rootGiB?: number;
  full?: boolean;
  services?: Record<string, DefinitionService>;
}

/** The guest's view of its disk: the size of its image (the chain's top) when the host knows it. */
function guestDisk(s: Shell) {
  const h = s.principal;
  if (h === s) return;
  const d = libvirt(h).domains[s.host];
  const root = ((s.state.mounts ?? []) as { path: string; disk?: number }[]).find((m) => m.path === '/');
  const top = d ? topOf(h, d) : null;
  if (root && top?.file?.disk) root.disk = top.file.disk.virtual;
}

/** The guest's interface, as ip shows it: the address it was given at its last boot. */
function guestLan(s: Shell) {
  const h = s.principal;
  if (h === s) return;
  const d = libvirt(h).domains[s.host];
  const a = guestAddress(h, s.host);
  const nat = d?.live?.ifaces[0]?.type === 'network';
  s.state.baseLan = {
    interfaces: {
      lo: { name: 'lo', up: true, addresses: ['127.0.0.1/8'], mac: '00:00:00:00:00:00', addresses6: ['::1/128'] },
      enp1s0: { name: 'enp1s0', up: true, addresses: a ? [`${a.ip}/24`] : [], mac: d?.live?.ifaces[0]?.mac ?? '52:54:00:00:00:01' },
    },
    gateway: { via: nat ? NAT_HOST : ROUTER, dev: 'enp1s0' },
    trunk: '',
    vlans: [],
    devices: [],
    order: ['lo', 'enp1s0'],
  };
}

/** A guest powered off or rebooted from inside: the domain follows (a guest reboot keeps its QEMU). */
function guestPower(s: Shell) {
  // reboot, poweroff, halt and shutdown all end the session (Shell.reboot); poweroff also counts in state.poweredOff.
  const count = (s.state.poweredOff as number | undefined) ?? 0;
  const off = count !== (s.state.poweredSeen ?? 0);
  s.state.poweredSeen = count;
  if (!s.reboot) return;
  const h = s.principal;
  const name = s.host;
  const d = libvirt(h).domains[name];
  if (!d) return;
  if (!off || /\breboot\b|shutdown\s+-r|--reboot/.test(s.last.line ?? '')) {
    d.booting = 1;
    bootGuest(h, name);
  } else stopDomain(h, name, 'shutdown');
  sync(h);
}

export function guestHost(o: GuestOptions, ip: string): InternalHost {
  return {
    address: ip,
    domain: `${o.name}.internal`,
    accounts: guestAccounts,
    commands: o.commands,
    state: (t) => ({
      systemd: newSystemd(o.name, NOW_1 - 3_600_000, NOW_1, {
        ssh: { description: 'OpenBSD Secure Shell server', active: true, executable: 'sshd', process: [proc(588, 'root', 'sshd: /usr/sbin/sshd -D')] },
        'systemd-networkd': { description: 'Network Configuration', active: true, executable: 'systemd-networkd', process: [proc(402, 'systemd-network', '/usr/lib/systemd/systemd-networkd')] },
        ...(o.services ?? {}),
      }),
      mounts: [
        {
          path: '/',
          name: '/dev/vda1',
          system: 'ext4',
          capacity: Math.floor(((o.rootGiB ?? 20) * GiB - (2048 + 33) * 512) / 4096) * 4096,
          part: ((o.rootGiB ?? 20) * GiB) / 512 * 512 - (2048 + 33) * 512,
          disk: (o.rootGiB ?? 20) * GiB,
          bytesBase: 2.2 * GiB,
        },
      ],
      passwords: {},
      kernel: [{ time: NOW_1 - 3_600_000, text: 'Linux version 6.12.48+deb13-amd64 (debian-kernel@lists.debian.org)' }],
      guestFull: !!o.full,
      language: t.language,
    }),
    attached: (s) => {
      s.state.network = networkView(s as Shell);
      s.state.resolve = (name: string) => resolve(s as Shell, name);
      s.state.poweredSeen = s.state.poweredOff ?? 0;
      // The clock is the host's.
      const own = systemd(s);
      if (own) own.clock = sd(s).clock;
      // A full root: what the world holds, and the rest up to the last few megabytes.
      const root = ((s.state.mounts ?? []) as { path: string; capacity: number; bytesBase?: number }[]).find((m) => m.path === '/');
      const top = s.find('/');
      if (root && top && o.full) root.bytesBase = root.capacity - (s as Shell).size(top) - 41 * MiB;
      guestDisk(s as Shell);
      guestLan(s as Shell);
    },
    beforeCommand: (s) => {
      guestDisk(s as Shell);
      guestLan(s as Shell);
      const own = systemd(s);
      if (own) own.clock = sd(s).clock;
    },
    afterCommand: (s) => {
      guestPower(s as Shell);
      passTime(s);
    },
    createWorld: (t) => {
      const key = hearthKey(t);
      return merge(dir({
        etc: dir({
          ...accountsFiles(),
          hostname: file(o.hostname ?? o.name),
          'machine-id': file(o.machineId, { owner: 'root', mode: 'r--r--r--' }),
          hosts: file(`127.0.0.1\tlocalhost\n127.0.1.1\t${o.hostname ?? o.name}`),
          'resolv.conf': file(`search internal\nnameserver ${ROUTER}`),
          systemd: dir({ network: dir({ '20-wired.network': file('[Match]\nName=enp1s0\n\n[Network]\nDHCP=yes') }) }),
        }),
        home: dir({ you: d({ '.ssh': d({ authorized_keys: f(key.isPublic, { lines: true, mode: 'rw-------' }) }, undefined, { mode: 'rwx------' }) }) }),
        root: dir({}, { owner: 'root', mode: 'rwx------' }),
        tmp: dir({}, { owner: 'root', mode: 'rwxrwxrwt' }),
        var: dir({ lib: dir({ dbus: dir({ 'machine-id': { type: 'file', content: '', link: '/etc/machine-id', owner: 'root' } }) }), log: dir({}) }),
      }), o.files?.(t) ?? {});
    },
  };
}

/** A world with more places and files in it (directories merged, files replaced). */
function merge(base: Directory, extra: Record<string, Node>): Directory {
  for (const [k, v] of Object.entries(extra)) {
    const here = base.children[k];
    if (here?.type === 'directory' && v.type === 'directory') merge(here, v.children);
    else base.children[k] = v;
  }
  return base;
}

// The reception desk's PC: a Debian desktop on the office's network.
export function receptionHost(commands: string[], note: (t: Translate) => Record<string, Node> = () => ({})): InternalHost {
  return {
    address: RECEPTION,
    domain: 'reception.internal',
    accounts: guestAccounts,
    commands,
    state: () => ({
      systemd: newSystemd('reception', NOW_2 - 3_600_000, NOW_2, {
        ssh: { description: 'OpenBSD Secure Shell server', active: true, executable: 'sshd', process: [proc(611, 'root', 'sshd: /usr/sbin/sshd -D')] },
      }),
      passwords: {},
    }),
    attached: (s) => {
      s.state.network = networkView(s as Shell);
      s.state.resolve = (name: string) => resolve(s as Shell, name);
    },
    afterCommand: (s) => passTime(s),
    createWorld: (t) => {
      const key = hearthKey(t);
      return dir({
        etc: dir({ ...accountsFiles(), hostname: file('reception'), hosts: file('127.0.0.1\tlocalhost\n127.0.1.1\treception'), 'resolv.conf': file(`search internal\nnameserver ${ROUTER}`) }),
        home: dir({ you: d({ '.ssh': d({ authorized_keys: f(key.isPublic, { lines: true, mode: 'rw-------' }) }, undefined, { mode: 'rwx------' }), ...note(t) }) }),
        root: dir({}, { owner: 'root', mode: 'rwx------' }),
        tmp: dir({}, { owner: 'root', mode: 'rwxrwxrwt' }),
      });
    },
  };
}

// What a guest needs to be looked at and repaired (an internal host's commands are its own).
export const GUEST_COMMANDS = [
  'ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'cp', 'mv', 'rm', 'mkdir', 'touch', 'truncate', 'nano', 'sudo', 'df', 'du', 'lsblk', 'free', 'dmesg',
  'ip', 'ping', 'curl', 'hostname', 'hostnamectl', 'systemctl', 'journalctl', 'systemd-machine-id-setup', 'reboot', 'poweroff', 'shutdown', 'echo', 'exit', 'man', 'ssh',
];
export const RECEPTION_COMMANDS = ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'ping', 'curl', 'wget', 'ssh', 'ip', 'hostname', 'echo', 'exit', 'man'];

/** The guests of a chapter, as internal hosts (their address is the one they had on the office's network; the story's routing decides). */
export function guests(n: ChapterNo, extra: Partial<Record<string, Partial<GuestOptions>>> = {}): Record<string, InternalHost> {
  const g = (name: string, machineId: string, ip: string, o: Partial<GuestOptions> = {}) => guestHost({ name, machineId, commands: GUEST_COMMANDS, ...o, ...(extra[name] ?? {}) }, ip);
  const out: Record<string, InternalHost> = {
    ledger: g('ledger', MACHINE_ID.ledger, LAN_IP.ledger, { rootGiB: 200, files: () => ({ srv: dir({ ledger: dir({ 'README.txt': file('Ledger - the practice accounting (Priya).\nData: /srv/ledger/books/') , books: dir({ '2029.db': f('', { size: 812 * MiB, owner: 'root' }), '2030.db': f('', { size: 96 * MiB, owner: 'root' }) }) }) }) }) }),
    agenda: g('agenda', MACHINE_ID.agenda, LAN_IP.agenda, { rootGiB: 40 }),
    records: g('records', MACHINE_ID.records, LAN_IP.records, { rootGiB: n === 1 ? 80 : 20 }),
  };
  if (n >= 2) {
    out.portal = g('portal', MACHINE_ID.portal, '192.0.2.150', { rootGiB: 20 });
    out['agenda-training'] = g('agenda-training', MACHINE_ID.agenda, '192.0.2.151', { rootGiB: 40, hostname: 'agenda-training' });
  }
  return out;
}
