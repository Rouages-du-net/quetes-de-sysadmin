// What the chapters of "The Photo Club" share: a photo club's NAS (nas,
// 192.0.2.31), where the members keep their photos in /srv/photos, and the
// club's darkroom computer (darkroom.internal, 192.0.2.32), on the club's
// network, reached over ssh from the NAS. Margot chairs the club. NFS is
// modelled by ../nfs.ts (exports, the client's mount, uids), Samba by
// ../samba.ts.
// Sources: https://man7.org/linux/man-pages/man5/exports.5.html,
// https://www.samba.org/samba/docs/current/man-html/smb.conf.5.html

import { accountsFiles, d, f, type Accounts, type Directory, type InternalHost, type Node, type Rights } from '../world';
import type { Translate } from '../../texts';
import type { Game, Shell } from '../shell';
import type { Process } from '../commands/system';
import { newSystemd, systemd, type DefinitionService } from '../systemd';
import { newFirewall, type Firewall } from '../firewall';
import { mountNfs, reload } from '../nfs';
import { generateKey } from '../access';

/** Your key on the NAS, authorised on the darkroom computer (Margot's nephew set it up). */
export const KEY = generateKey('photo-club-nas', 'you@nas');

export const HOME = '/home/you';
export const PASSWORD = 'shutter-2028';
export const NAS = '192.0.2.31';
export const DARKROOM = '192.0.2.32';
export const PHOTOS = '/srv/photos';
export const MOUNT = '/mnt/photos';
const G = 1024 ** 3;

export const proc = (pid: number, user: string, command: string): Process => ({ pid, user, cpu: 0, mem: 0.1, command });
export const sd = (j: Game) => systemd(j)!;
export const seen = (j: Game, text: string) => j.last.output.includes(text) || j.last.errors.some((e) => e.includes(text));
export const running = (j: Game, n: string) => sd(j).services[n]?.state === 'active';
export const darkroom = (j: Game): Shell | null => (j as Shell).internal('darkroom');
/** What was last typed or shown on the darkroom computer. */
export const seenOnDarkroom = (j: Game, text: string) => {
  const s = darkroom(j);
  return !!s && (s.last.output.includes(text) || s.last.errors.some((e) => e.includes(text)));
};

const common = {
  root: { uid: 0, group: 'root', home: '/root' },
  you: { uid: 1000, group: 'you' },
  nobody: { uid: 65534, group: 'nogroup', home: '/nonexistent', shell: '/usr/sbin/nologin' },
};
const commonGroups = {
  root: { gid: 0, members: [] },
  sudo: { gid: 27, members: ['you'] },
  you: { gid: 1000, members: [] },
  nogroup: { gid: 65534, members: [] },
};

/** The NAS's accounts: Nora got there first (1001), then Sam (1002), Margot, and Tom who left the club. */
export const nasAccounts = (): Accounts => ({
  users: {
    ...common,
    nora: { uid: 1001, group: 'nora' },
    sam: { uid: 1002, group: 'sam' },
    margot: { uid: 1003, group: 'margot' },
    tom: { uid: 1004, group: 'tom' },
  },
  groups: {
    ...commonGroups,
    nora: { gid: 1001, members: [] },
    sam: { gid: 1002, members: [] },
    margot: { gid: 1003, members: [] },
    tom: { gid: 1004, members: [] },
    club: { gid: 1500, members: ['nora', 'sam', 'margot'] },
  },
});

/** The darkroom computer's accounts: Sam's was created first there (1001). */
export const darkroomAccounts = (): Accounts => ({
  users: { ...common, sam: { uid: 1001, group: 'sam' } },
  groups: { ...commonGroups, sam: { gid: 1001, members: [] }, club: { gid: 1500, members: ['sam'] } },
});

/** Debian's /etc/exports, as nfs-kernel-server installs it. */
export const EXPORTS_DEBIAN = `# /etc/exports: the access control list for filesystems which may be exported
#		to NFS clients.  See exports(5).
#
# Example for NFSv2 and NFSv3:
# /srv/homes       hostname1(rw,sync,no_subtree_check) hostname2(ro,sync,no_subtree_check)
#
# Example for NFSv4:
# /srv/nfs4        gss/krb5i(rw,sync,fsid=0,crossmnt,no_subtree_check)
# /srv/nfs4/homes  gss/krb5i(rw,sync,no_subtree_check)
#`;
/** Chapter 1's solution. */
export const EXPORTS_CLUB = `${EXPORTS_DEBIAN}\n/srv/photos    192.0.2.32(rw,sync,no_subtree_check)`;

/** Debian's smb.conf, shortened (the comments), with its [printers] and [print$]. */
export const SMB_CONF_DEBIAN = `#
# Sample configuration file for the Samba suite for Debian GNU/Linux.
# See smb.conf(5). Run testparm after each change.
#

[global]
   workgroup = WORKGROUP
   server string = %h server (Samba, Debian)
   log file = /var/log/samba/log.%m
   max log size = 1000
   logging = file
   panic action = /usr/share/samba/panic-action %d
   server role = standalone server
   obey pam restrictions = yes
   unix password sync = yes
   passwd program = /usr/bin/passwd %u
   pam password change = yes
   map to guest = bad user
   usershare allow guests = yes

#======================= Share Definitions =======================

;[homes]
;   comment = Home Directories
;   browseable = no
;   read only = yes
;   create mask = 0700
;   directory mask = 0700
;   valid users = %S

[printers]
   comment = All Printers
   browseable = no
   path = /var/tmp
   printable = yes
   guest ok = no
   read only = yes
   create mask = 0700

[print$]
   comment = Printer Drivers
   path = /var/lib/samba/printers
   browseable = yes
   read only = yes
   guest ok = no`;

export interface Options {
  boot: number;
  now: number;
  firewall: Firewall;
  // nfs-server and smbd running.
  smbd?: boolean;
}

export function nasState(o: Options) {
  const services: Record<string, DefinitionService> = {
    ssh: { description: 'OpenBSD Secure Shell server', active: true, executable: 'sshd', process: [proc(702, 'root', 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups')] },
    'nfs-server': { description: 'NFS server and services', active: true, executable: 'rpc.nfsd', modelled: true, activeRest: true, process: [] },
    smbd: { description: 'Samba SMB Daemon', active: !!o.smbd, executable: 'smbd', modelled: true, process: [proc(830, 'root', '/usr/sbin/smbd --foreground --no-process-group')] },
    ufw: { description: 'Uncomplicated firewall', active: true, executable: 'ufw', activeRest: true },
  };
  return {
    systemd: newSystemd('nas', o.boot, o.now, services),
    process: [proc(1, 'root', '/sbin/init'), ...Object.values(services).flatMap((x) => (x.active ? (x.process ?? []) : []))],
    ufw: o.firewall,
    nfsAddress: NAS,
    mounts: [{ path: '/', capacity: 2000 * G, name: '/dev/md0', system: 'ext4' }],
    listening: [
      { proto: 'tcp', address: '0.0.0.0', port: 22, process: 'sshd', pid: 702 },
      { proto: 'tcp', address: '0.0.0.0', port: 2049, process: 'nfsd', pid: 0 },
      { proto: 'tcp', address: '0.0.0.0', port: 111, process: 'rpcbind', pid: 1 },
    ],
    samba: { passdb: {} },
  };
}

/** The firewall Margot's nephew left: SSH only. */
export const sshOnly = (): Firewall => ({ ...newFirewall(), enabled: true, rules: [{ action: 'allow', to: '22/tcp', ports: [22], forEachOf: null }] });
/** After chapter 1: NFS for the darkroom computer. */
export const withNfs = (): Firewall => ({ ...sshOnly(), rules: [...sshOnly().rules, { action: 'allow', to: '2049', ports: [2049], forEachOf: DARKROOM }] });

/** At the start: nfs-server loads the exports (and again each time it starts or reloads). */
export function prepareNas(j: Game) {
  sd(j).services['nfs-server'].load = (g) => void reload(g as Shell);
  reload(j as Shell);
}

/** The darkroom computer mounts the NAS (as at boot), for the chapters after the first. */
export function mountOnDarkroom(j: Game) {
  const s = darkroom(j);
  if (s) mountNfs(s, `nas.internal:${PHOTOS}`, MOUNT, 'defaults,_netdev');
}

const root: Rights = { owner: 'root' };
const directory = (children: Record<string, Node>, rights: Rights = root) => d(children, undefined, rights);
const file = (text: string, rights: Rights = root) => f(text, { lines: true, ...rights });
const photo = (bytes: number, rights: Rights) => f('', { ...rights, size: bytes });

/** /srv/photos: the club's albums, root:club with setgid, so new files belong to the club. */
export function photos(o: { scans?: Rights } = {}): Directory {
  const club = (owner: string, mode = 'rw-r--r--'): Rights => ({ owner, group: 'club', mode });
  const album = (owner: string, names: string[], mode = 'rw-r--r--') =>
    directory(Object.fromEntries(names.map((n, i) => [n, photo(3_400_000 + i * 170_000, club(owner, mode))])), { owner, group: 'club', mode: 'rwxrwsr-x' });
  return directory(
    {
      'README.txt': file('Club photos: one folder per album. Ask Margot before deleting anything.', { owner: 'margot', group: 'club', mode: 'rw-rw-r--' }),
      '2027-exhibition': album('nora', ['harbour.jpg', 'market.jpg', 'night-bus.jpg']),
      '2028-outings': album('sam', ['quarry.jpg', 'heron.jpg', 'fog.jpg', 'ferry.jpg']),
      ...(o.scans
        ? { '2028-film-scans': directory(Object.fromEntries(['roll-01.tif', 'roll-02.tif', 'roll-03.tif'].map((n, i) => [n, photo(48_000_000 + i * 1_000_000, { ...o.scans!, mode: 'rw-r--r--' })])), { ...o.scans, mode: 'rwxr-xr-x' }) }
        : {}),
    },
    { owner: 'root', group: 'club', mode: 'rwxrwsr-x' },
  );
}

export function nasWorld(o: { welcome: Record<string, string>; exports: string; smb?: string; photos: Directory }): Directory {
  return directory({
    etc: directory({
      ...accountsFiles(),
      hostname: file('nas'),
      hosts: file(`127.0.0.1\tlocalhost\n${NAS}\tnas nas.internal\n${DARKROOM}\tdarkroom darkroom.internal`),
      exports: file(o.exports),
      'exports.d': directory({}),
      samba: directory({ 'smb.conf': file(o.smb ?? SMB_CONF_DEBIAN) }),
    }),
    srv: directory({ photos: o.photos }),
    var: directory({ lib: directory({ samba: directory({ printers: directory({}) }) }), tmp: directory({}, { owner: 'root', mode: 'rwxrwxrwt' }) }),
    home: directory({
      you: d({
        ...Object.fromEntries(Object.entries(o.welcome).map(([n, x]) => [n, f(x)])),
        '.ssh': d({ id_ed25519: f(KEY.isPrivate, { lines: true, mode: 'rw-------' }), 'id_ed25519.pub': f(KEY.isPublic, { lines: true }) }, undefined, { mode: 'rwx------' }),
      }),
      margot: directory({}, { owner: 'margot', mode: 'rwx------' }),
    }),
    root: directory({}, { owner: 'root', mode: 'rwx------' }),
    tmp: directory({ 'contact-sheet.jpg': photo(820_000, { owner: 'you' }) }, { owner: 'root', mode: 'rwxrwxrwt' }),
  });
}

/** The darkroom computer: its hosts, its fstab, Sam's scans; its mount point exists or not yet. */
export function darkroomHost(o: { mountPoint: boolean; fstab?: string; samSession?: boolean; commands: string[] }): InternalHost {
  return {
    address: DARKROOM,
    domain: 'darkroom.internal',
    accounts: darkroomAccounts,
    commands: o.commands,
    state: () => ({
      systemd: newSystemd('darkroom', Date.UTC(2028, 8, 1, 7, 0, 0), Date.UTC(2028, 8, 12, 18, 30, 0), {
        ssh: { description: 'OpenBSD Secure Shell server', active: true, executable: 'sshd', process: [proc(640, 'root', 'sshd: /usr/sbin/sshd -D')] },
      }),
      process: [proc(1, 'root', '/sbin/init'), proc(640, 'root', 'sshd: /usr/sbin/sshd -D'), ...(o.samSession ? [proc(2210, 'sam', '-bash'), proc(2241, 'sam', 'darktable')] : [])],
      mounts: [{ path: '/', capacity: 500 * G, name: '/dev/nvme0n1p2', system: 'ext4' }],
    }),
    createWorld: () =>
      directory({
        etc: directory({
          ...accountsFiles(),
          hostname: file('darkroom'),
          hosts: file(`127.0.0.1\tlocalhost\n${DARKROOM}\tdarkroom darkroom.internal\n${NAS}\tnas nas.internal`),
          fstab: file(o.fstab ?? FSTAB),
        }),
        mnt: directory(o.mountPoint ? { photos: directory({}) } : {}),
        home: directory({
          you: d({ '.ssh': d({ authorized_keys: f(KEY.isPublic, { lines: true, mode: 'rw-------' }) }, undefined, { mode: 'rwx------' }) }),
          sam: directory(
            { scans: directory(Object.fromEntries(['roll-04.tif', 'roll-05.tif'].map((n, i) => [n, photo(49_000_000 + i * 900_000, { owner: 'sam', mode: 'rw-r--r--' })])), { owner: 'sam', mode: 'rwxr-xr-x' }) },
            { owner: 'sam', mode: 'rwxr-xr-x' },
          ),
        }),
        root: directory({}, { owner: 'root', mode: 'rwx------' }),
        tmp: directory({}, { owner: 'root', mode: 'rwxrwxrwt' }),
      }),
  };
}

export const FSTAB = `# /etc/fstab: static file system information.
# <file system>                             <mount point>  <type>  <options>          <dump>  <pass>
UUID=4f1c9d2e-7b3a-4c8e-9f21-6a5d3b8e1c07   /              ext4    errors=remount-ro  0       1`;
export const FSTAB_NFS = `${FSTAB}\nnas.internal:/srv/photos                    /mnt/photos    nfs     defaults,_netdev   0       0`;
