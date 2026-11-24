// Story "The Language Café": what its chapters share. Common Tongue, a
// nonprofit that runs free conversation tables for newcomers and their
// neighbours (le Café des langues in French), keeps its site, the week's
// tables and its volunteers' sign-up app on kettle (bouilloire in French),
// a small server in the café's back office that Seun installed with Rocky
// Linux 10 (the system he runs at work) before leaving for three months.
// Dilnoza coordinates the café, Itzel makes the site, Tenzin wrote the
// sign-up app, Thuy hosts the Vietnamese table and looks after the
// noticeboard, Kaveh lends a hand from the partner association next door.
// Machines: kettle, 192.0.2.170 (RFC 5737); noticeboard, the café's screen
// (a small Debian box that shows the site), 198.51.100.20 on the café's
// network 198.51.100.0/24, an internal host; the internet is 203.0.113.0/24.
// Chapter 1: a Debian sysadmin on a Rocky machine: dnf, systemctl,
// firewalld's runtime and permanent configurations; chapter 2: the site
// moved with mv keeps its home label: SELinux's denials, semanage fcontext
// and restorecon; chapter 3: a port to bind and a backend to reach:
// semanage port, setsebool -P, a rich rule for the café's network.
// Each command lets fifteen seconds pass; the noticeboard asks for the site
// every five minutes (its requests, their denials, in the logs).
// Sources: https://docs.rockylinux.org/guides/security/learning_selinux/,
// https://docs.rockylinux.org/guides/security/firewalld/,
// https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/10/html/using_selinux/,
// https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/10/html/configuring_firewalls_and_packet_filters/

import { accountsFiles, d, f, player, type Accounts, type Directory, type InternalHost, type Node, type Rights } from '../world';
import type { Game, Shell } from '../shell';
import type { Translate } from '../../texts';
import { newSystemd, start, stop, systemd, writeLog, type DefinitionService, type Systemd } from '../systemd';
import { generateKey } from '../access';
import { machineName } from '../machines';
import type { Process } from '../commands/system';
import type { Listening } from '../commands/ss';
import { boot as selinuxBoot, httpdAllows, labelMissing, labelTree, newSelinux, portType, restored, selinux, walk, auditText, type Avc, type SelinuxState } from '../selinux';
import { firewalld, newFirewalld, reloadFirewall, verdict, type FirewalldState } from '../firewalld';
import { CATALOGUE, httpdUnit, installFiles, newRpm, rpm, byName } from '../rpm';
import { headersOf, httpd, serve, type HttpdState } from '../httpd-rhel';
import { typeOf } from '../rhel';

export const HOME = '/home/you';
export const PASSWORD = 'samovar-24';
export type ChapterNo = 1 | 2 | 3;
export const KETTLE = '192.0.2.170';
export const NOTICEBOARD = '198.51.100.20';
export const OFFICE = '198.51.100.0/24';
export const OUTSIDE = '203.0.113.50';
export const SITE = 'www.commontongue.example';
export const SIGNUP = 'signup.commontongue.example';
export const DOCROOT = '/srv/site';
export const VOLUNTEERS_PORT = 8010;
export const APP_PORT = 8086;
const IFACE = 'enp1s0';
const MINUTE = 60_000;

// Monday 7 December 2026, 18:30; Saturday 12 December, 10:15; Monday 14 December, 18:40 (UTC, the server's time zone).
export const NOW: Record<ChapterNo, number> = { 1: Date.UTC(2026, 11, 7, 18, 30, 0), 2: Date.UTC(2026, 11, 12, 10, 15, 0), 3: Date.UTC(2026, 11, 14, 18, 40, 0) };
// Seun installed kettle on Monday 30 November.
const INSTALLED = Date.UTC(2026, 10, 30, 9, 12, 0);

// ——— Story state (on kettle) ———

export interface Story {
  chapter: ChapterNo;
  // The noticeboard's last request (ms), its results (the status codes).
  board: number;
  boardCodes: number[];
  // Chapter 2: Kaveh's reboot for the kernel update happened (and relabelled the disk).
  rebooted?: boolean;
  relabelled?: boolean;
}
const principal = (j: Game) => (j as Shell).principal;
export const story = (j: Game): Story => principal(j).state.cafe as Story;
export const kettle = (j: Game): Shell => principal(j);
export const sd = (j: Game): Systemd => systemd(kettle(j))!;
export const active = (j: Game): Shell => (principal(j).state.lastShell as Shell | undefined) ?? principal(j);
export const typed = (j: Game) => active(j).last.line ?? '';
/** The last command's output contains this (on any machine of the story); reading the manual doesn't count. */
export const seen = (j: Game, text: string | RegExp) => {
  if (/^\s*(man|apropos|whatis|help)\b|--help\b/.test(typed(j))) return false;
  const last = active(j).last;
  const all = `${last.output}\n${last.errors.join('\n')}`;
  return typeof text === 'string' ? all.includes(text) : text.test(all);
};
/** The last line ran this command (on kettle). */
export const ran = (j: Game, command: RegExp) => command.test(typed(j));

// ——— Files ———

const root: Rights = { owner: 'root', group: 'root' };
const place = (children: Record<string, Node>, rights: Rights = root) => d(children, undefined, rights);
const file = (text: string, rights: Rights = root) => f(text, { lines: true, ...rights });
export const host = (t: Translate, id: 'kettle' | 'noticeboard') => machineName(t, id);

/** A file tree from absolute paths (path → content), with rights. */
function tree(files: Record<string, string>, rights: (p: string) => Rights = () => root): Directory {
  const top: Directory = place({});
  for (const [p, content] of Object.entries(files)) {
    const parts = p.split('/').filter(Boolean);
    let n: Directory = top;
    parts.forEach((part, i) => {
      const at = '/' + parts.slice(0, i + 1).join('/');
      if (i === parts.length - 1) n.children[part] = file(content, rights(at));
      else {
        if (n.children[part]?.type !== 'directory') n.children[part] = place({}, rights(at));
        n = n.children[part] as Directory;
      }
    });
  }
  return top;
}
/** Merges trees (the later ones win). */
function merge(...trees: Directory[]): Directory {
  const out = place({});
  const into = (a: Directory, b: Directory) => {
    for (const [k, v] of Object.entries(b.children)) {
      const old = a.children[k];
      if (old?.type === 'directory' && v.type === 'directory') into(old, v);
      else a.children[k] = v;
    }
  };
  for (const t of trees) into(out, t);
  return out;
}

const OS_RELEASE = `NAME="Rocky Linux"
VERSION="10.3 (Red Quartz)"
ID="rocky"
ID_LIKE="rhel centos fedora"
VERSION_ID="10.3"
PLATFORM_ID="platform:el10"
PRETTY_NAME="Rocky Linux 10.3 (Red Quartz)"
ANSI_COLOR="0;32"
LOGO="fedora-logo-icon"
CPE_NAME="cpe:/o:rocky:rocky:10::baseos"
HOME_URL="https://rockylinux.org/"
VENDOR_NAME="RESF"
VENDOR_URL="https://resf.org/"
BUG_REPORT_URL="https://bugs.rockylinux.org/"
SUPPORT_END="2035-05-31"
ROCKY_SUPPORT_PRODUCT="Rocky-Linux-10"
ROCKY_SUPPORT_PRODUCT_VERSION="10.3"
REDHAT_SUPPORT_PRODUCT="Rocky Linux"
REDHAT_SUPPORT_PRODUCT_VERSION="10.3"`;
const RELEASE = 'Rocky Linux release 10.3 (Red Quartz)';

export const SELINUX_CONFIG = `# This file controls the state of SELinux on the system.
# SELINUX= can take one of these three values:
#     enforcing - SELinux security policy is enforced.
#     permissive - SELinux prints warnings instead of enforcing.
#     disabled - No SELinux policy is loaded.
# See also:
# https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/10/html/using_selinux/changing-selinux-states-and-modes_using-selinux
#
# NOTE: In earlier Fedora kernel builds, SELINUX=disabled would also
# fully disable SELinux during boot. If you need a system with SELinux
# fully disabled instead of SELinux running with no policy loaded, you
# need to pass selinux=0 to the kernel command line. You can use grubby
# to persistently set the bootloader to boot with selinux=0:
#
#    grubby --update-kernel ALL --args selinux=0
#
# To revert back to SELinux enabled:
#
#    grubby --update-kernel ALL --remove-args selinux
#
SELINUX=enforcing
# SELINUXTYPE= can take one of these three values:
#     targeted - Targeted processes are protected,
#     minimum - Modification of targeted policy. Only selected processes are protected.
#     mls - Multi Level Security protection.
SELINUXTYPE=targeted`;

/** /etc/firewalld/zones/public.xml: the permanent public zone, as firewalld writes it. */
const zoneXml = (j: Game) => {
  const z = firewalld(j)?.permanent.public;
  if (!z) return '';
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<zone>',
    '  <short>Public</short>',
    '  <description>For use in public areas. You do not trust the other computers on networks to not harm your computer. Only selected incoming connections are accepted.</description>',
    ...z.services.map((s) => `  <service name="${s}"/>`),
    ...z.ports.map((p) => `  <port port="${p.split('/')[0]}" protocol="${p.split('/')[1]}"/>`),
    ...z.richRules.map((r) => `  <rule>${r.replace(/^rule\s*/, ' ')}</rule>`),
    '  <forward/>',
    '</zone>',
  ].join('\n');
};

// The café's site (Itzel's), and the volunteers' rota (Tenzin's).
const siteFiles = (t: Translate): Record<string, string> => ({
  'index.html': t('language-cafe-site-index'),
  'tables.html': t('language-cafe-site-tables'),
  'css/style.css': 'body { font-family: sans-serif; margin: 2rem auto; max-width: 40rem; }\ntable { border-collapse: collapse; }\ntd, th { border: 1px solid #888; padding: 0.3rem 0.6rem; }',
});
export const SITE_MARK = 'common-tongue-site';
export const ROTA_MARK = 'common-tongue-rota';
export const SIGNUP_MARK = 'common-tongue-signup';

export const CAFE_CONF = `# The cafe's site (Itzel, 12 December): moved from /var/www/html to /srv/site.
<VirtualHost *:80>
    ServerName ${SITE}
    ServerAlias kettle kettle.internal ${KETTLE}
    DocumentRoot "${DOCROOT}"
</VirtualHost>

<Directory "${DOCROOT}">
    Options FollowSymLinks
    AllowOverride None
    Require all granted
</Directory>`;
export const SIGNUP_CONF = `# The volunteers' sign-up app (Tenzin): a small app on 127.0.0.1:${APP_PORT}, behind httpd.
<VirtualHost *:80>
    ServerName ${SIGNUP}
    ProxyPreserveHost On
    ProxyPass / http://127.0.0.1:${APP_PORT}/
    ProxyPassReverse / http://127.0.0.1:${APP_PORT}/
</VirtualHost>`;
export const VOLUNTEERS_CONF = `# The volunteers' rota (Tenzin): its own port, for the cafe's network only.
Listen ${VOLUNTEERS_PORT}

<VirtualHost *:${VOLUNTEERS_PORT}>
    DocumentRoot "/var/www/volunteers"
</VirtualHost>`;

// ——— Accounts ———

export const kettleAccounts =
  (n: ChapterNo) =>
  (): Accounts => ({
    users: {
      root: { uid: 0, group: 'root', home: '/root' },
      you: { uid: 1000, group: 'you' },
      seun: { uid: 1001, group: 'seun' },
      itzel: { uid: 1002, group: 'itzel' },
      ...(n === 3 ? { tenzin: { uid: 1003, group: 'tenzin' }, signup: { uid: 985, group: 'signup', home: '/opt/signup', shell: '/sbin/nologin' } } : {}),
      ...(n >= 2 ? { apache: { uid: 48, group: 'apache', home: '/usr/share/httpd', shell: '/sbin/nologin' } } : {}),
    },
    groups: {
      root: { gid: 0, members: [] },
      wheel: { gid: 10, members: ['you', 'seun'] },
      you: { gid: 1000, members: [] },
      seun: { gid: 1001, members: [] },
      itzel: { gid: 1002, members: [] },
      ...(n === 3 ? { tenzin: { gid: 1003, members: [] }, signup: { gid: 985, members: [] } } : {}),
      ...(n >= 2 ? { apache: { gid: 48, members: [] } } : {}),
    },
  });

const playerKey = (t: Translate) => generateKey('language-cafe-kettle', `you@${host(t, 'kettle')}`);

// ——— rsyslog's files (/var/log/messages and /var/log/secure, Red Hat's rsyslog.conf) ———

const DAYS: Record<ChapterNo, string> = { 1: 'Dec  7', 2: 'Dec 12', 3: 'Dec 14' };
function messagesLog(h: string, n: ChapterNo): string {
  const d = DAYS[n];
  const lines = [
    `${d} 16:31:02 ${h} systemd[1]: Started dnf-makecache.service - dnf makecache.`,
    `${d} 17:01:11 ${h} chronyd[744]: Selected source 203.0.113.123 (2.rocky.pool.ntp.org)`,
    `${d} 17:31:04 ${h} systemd[1]: Starting dnf-makecache.service - dnf makecache...`,
    `${d} 17:31:09 ${h} dnf[2871]: Metadata cache refreshed recently.`,
    `${d} 17:31:09 ${h} systemd[1]: dnf-makecache.service: Deactivated successfully.`,
  ];
  if (n === 2) lines.push(`${d} 09:41:27 ${h} systemd[1]: Stopping httpd.service - The Apache HTTP Server...`, `${d} 09:41:28 ${h} systemd[1]: Stopped httpd.service - The Apache HTTP Server.`, `${d} 09:41:28 ${h} systemd[1]: Starting httpd.service - The Apache HTTP Server...`, `${d} 09:41:28 ${h} httpd[2201]: Server configured, listening on: port 80`, `${d} 09:41:28 ${h} systemd[1]: Started httpd.service - The Apache HTTP Server.`);
  return lines.join('\n');
}
function secureLog(h: string, n: ChapterNo, you: string): string {
  const d = DAYS[n];
  const at = n === 1 ? '18:28' : n === 2 ? '10:13' : '18:38';
  return [
    ...(n === 2 ? [`${d} 09:38:51 ${h} sshd-session[2155]: Accepted publickey for itzel from 198.51.100.31 port 50122 ssh2: ED25519 SHA256:k3Vt0aXbQnR8LwEz2yHf6pUsJ1cMiDoG9tKqZ4vB7Ns`, `${d} 09:40:02 ${h} sudo[2190]:   itzel : TTY=pts/1 ; PWD=/home/itzel ; USER=root ; COMMAND=/usr/bin/mkdir /srv/site`, `${d} 09:40:19 ${h} sudo[2196]:   itzel : TTY=pts/1 ; PWD=/home/itzel/site ; USER=root ; COMMAND=/usr/bin/mv css index.html tables.html /srv/site/`, `${d} 09:41:27 ${h} sudo[2199]:   itzel : TTY=pts/1 ; PWD=/home/itzel ; USER=root ; COMMAND=/usr/bin/systemctl restart httpd`] : []),
    `${d} ${at}:11 ${h} sshd-session[${n === 1 ? 3120 : 3410}]: Accepted publickey for ${you} from 192.0.2.2 port 52814 ssh2: ED25519 SHA256:q4oG7v2Lw0c1sNf8YkTzR3bHmXe9JdUaPiQ5tVyW6Ko`,
    `${d} ${at}:11 ${h} sshd-session[${n === 1 ? 3120 : 3410}]: pam_unix(sshd:session): session opened for user ${you}(uid=1000) by ${you}(uid=0)`,
  ].join('\n');
}

// ——— kettle's world ———

export function kettleWorld(t: Translate, n: ChapterNo, home: Record<string, Node>): Directory {
  const key = playerKey(t);
  const itzel: Rights = { owner: 'itzel', group: 'itzel' };
  const hosts = ['127.0.0.1   localhost localhost.localdomain localhost4 localhost4.localdomain4', '::1         localhost localhost.localdomain localhost6 localhost6.localdomain6', `${KETTLE}  ${host(t, 'kettle')}.internal ${host(t, 'kettle')} ${SITE}`, `${NOTICEBOARD}  ${host(t, 'noticeboard')}.internal ${host(t, 'noticeboard')}`];
  const files: Directory[] = [
    place({
      etc: place({
        ...accountsFiles(),
        hostname: file(`${host(t, 'kettle')}.internal`),
        hosts: file(hosts.join('\n')),
        'os-release': file(OS_RELEASE),
        'redhat-release': file(RELEASE),
        'rocky-release': file(RELEASE),
        'system-release': file(RELEASE),
        selinux: place({ config: file(SELINUX_CONFIG) }),
        firewalld: place({ 'firewalld.conf': file('# firewalld config file\n\n# default zone\nDefaultZone=public\n\n# Clean up on exit\nCleanupOnExit=yes'), zones: place({ 'public.xml': f(zoneXml, { lines: true, owner: 'root', group: 'root' }) }) }),
        'yum.repos.d': place({
          'rocky.repo': file('[baseos]\nname=Rocky Linux $releasever - BaseOS\nmirrorlist=https://mirrors.rockylinux.org/mirrorlist?arch=$basearch&repo=BaseOS-$releasever$rltype\ngpgcheck=1\nenabled=1\ngpgkey=file:///etc/pki/rpm-gpg/RPM-GPG-KEY-Rocky-10\n\n[appstream]\nname=Rocky Linux $releasever - AppStream\nmirrorlist=https://mirrors.rockylinux.org/mirrorlist?arch=$basearch&repo=AppStream-$releasever$rltype\ngpgcheck=1\nenabled=1\ngpgkey=file:///etc/pki/rpm-gpg/RPM-GPG-KEY-Rocky-10'),
          'rocky-extras.repo': file('[extras]\nname=Rocky Linux $releasever - Extras\nmirrorlist=https://mirrors.rockylinux.org/mirrorlist?arch=$basearch&repo=extras-$releasever$rltype\ngpgcheck=1\nenabled=1\ngpgkey=file:///etc/pki/rpm-gpg/RPM-GPG-KEY-Rocky-10'),
        }),
        sysconfig: place({ selinux: f('', { owner: 'root', group: 'root', link: '../selinux/config' }), network: file('# Created by anaconda') }),
      }),
      home: place({
        you: d({ ...home, '.ssh': d({ id_ed25519: f(key.isPrivate, { lines: true, mode: 'rw-------' }), 'id_ed25519.pub': f(key.isPublic, { lines: true }) }, undefined, { mode: 'rwx------' }) }, undefined, { mode: 'rwx------' }),
        seun: d({}, undefined, { owner: 'seun', group: 'seun', mode: 'rwx------' }),
        itzel: d(n === 2 ? { site: d({}, undefined, itzel) } : {}, undefined, { ...itzel, mode: 'rwx------' }),
        ...(n === 3 ? { tenzin: d({}, undefined, { owner: 'tenzin', group: 'tenzin', mode: 'rwx------' }) } : {}),
      }, { owner: 'root', group: 'root' }),
      root: place({}, { owner: 'root', group: 'root', mode: 'r-xr-x---' }),
      srv: place({}),
      tmp: place({}, { owner: 'root', group: 'root', mode: 'rwxrwxrwt' }),
      opt: place({}),
      usr: place({ bin: place({}), sbin: place({}), share: place({}), lib: place({ systemd: place({ system: place({}) }) }) }),
      var: place({
        log: place({
          messages: file(messagesLog(host(t, 'kettle'), n), { owner: 'root', group: 'root', mode: 'rw-------' }),
          secure: file(secureLog(host(t, 'kettle'), n, player(t)), { owner: 'root', group: 'root', mode: 'rw-------' }),
          audit: place({ 'audit.log': f(auditText, { lines: true, owner: 'root', group: 'root', mode: 'rw-------' }) }, { owner: 'root', group: 'root', mode: 'rwx------' }),
        }),
        www: place({}),
      }),
    }),
  ];
  if (n >= 2) {
    // httpd as Seun's chapter left it, and Itzel's site in /srv/site, moved there from her home.
    files.push(
      tree({ [`/var/www/html/index.html`]: t('language-cafe-old-index') }),
      tree({ [`/etc/httpd/conf.d/commontongue.conf`]: CAFE_CONF }),
      tree(Object.fromEntries(Object.entries(siteFiles(t)).map(([k, v]) => [`${DOCROOT}/${k}`, v])), (p) => (p === DOCROOT ? root : itzel)),
    );
  }
  if (n === 3) {
    files.push(
      tree({ '/etc/httpd/conf.d/signup.conf': SIGNUP_CONF, '/etc/httpd/conf.d/volunteers.conf': VOLUNTEERS_CONF }),
      tree({ '/var/www/volunteers/index.html': t('language-cafe-rota') }),
      tree(
        {
          '/opt/signup/bin/signup': '#!/usr/bin/python3\n# The volunteers\' sign-up app (Tenzin).',
          '/opt/signup/README.md': t('language-cafe-signup-readme', { port: String(APP_PORT) }),
          '/etc/systemd/system/signup.service': `[Unit]\nDescription=Common Tongue volunteers' sign-up\nAfter=network.target\n\n[Service]\nUser=signup\nExecStart=/opt/signup/bin/signup --listen 127.0.0.1:${APP_PORT}\nRestart=on-failure\n\n[Install]\nWantedBy=multi-user.target`,
          '/home/tenzin/httpd-fix.te': `\nmodule httpd-fix 1.0;\n\nrequire {\n\ttype httpd_t;\n\ttype unreserved_port_t;\n\tclass tcp_socket { name_bind name_connect };\n}\n\n#============= httpd_t ==============\n\n#!!!! This avc can be allowed using the boolean 'nis_enabled'\nallow httpd_t unreserved_port_t:tcp_socket { name_bind name_connect };`,
        },
        (p) => (p.startsWith('/opt/signup/bin') ? { owner: 'root', group: 'root', mode: 'rwxr-xr-x' } : p.startsWith('/home/tenzin') ? { owner: 'tenzin', group: 'tenzin' } : root),
      ),
    );
  }
  return merge(...files);
}

// ——— kettle's state ———

const proc = (pid: number, user: string, command: string, label: string, mem = 0.4, ppid = 1): Process => ({ pid, user, cpu: 0, mem, command, ppid, label });
const service = (description: string, executable: string, process: Process[], extra: Partial<DefinitionService> = {}): DefinitionService => ({ description, executable, active: true, process, ...extra });

function kettleServices(n: ChapterNo): Record<string, DefinitionService> {
  return {
    'systemd-journald': service('Journal Service', 'systemd-journald', [proc(612, 'root', '/usr/lib/systemd/systemd-journald', 'system_u:system_r:syslogd_t:s0')], { static: true }),
    'systemd-udevd': service('Rule-based Manager for Device Events and Files', 'systemd-udevd', [proc(641, 'root', '/usr/lib/systemd/systemd-udevd', 'system_u:system_r:udev_t:s0-s0:c0.c1023')], { static: true }),
    auditd: service('Security Audit Logging Service', 'auditd', [proc(702, 'root', '/sbin/auditd', 'system_u:system_r:auditd_t:s0')]),
    'dbus-broker': service('D-Bus System Message Bus', 'dbus-broker-launch', [proc(731, 'dbus', '/usr/bin/dbus-broker-launch --scope system --audit', 'system_u:system_r:system_dbusd_t:s0-s0:c0.c1023')], { static: true }),
    chronyd: service('NTP client/server', 'chronyd', [proc(744, 'chrony', '/usr/sbin/chronyd -F 2', 'system_u:system_r:chronyd_t:s0')]),
    firewalld: service('firewalld - dynamic firewall daemon', 'firewalld', [proc(748, 'root', '/usr/bin/python3 -sP /usr/sbin/firewalld --nofork --nopid', 'system_u:system_r:firewalld_t:s0', 1.9)], { load: (j) => reloadFirewall(j) }),
    'systemd-logind': service('User Login Management', 'systemd-logind', [proc(752, 'root', '/usr/lib/systemd/systemd-logind', 'system_u:system_r:systemd_logind_t:s0')], { static: true }),
    NetworkManager: service('Network Manager', 'NetworkManager', [proc(790, 'root', '/usr/sbin/NetworkManager --no-daemon', 'system_u:system_r:NetworkManager_t:s0', 1.1)]),
    sshd: service('OpenSSH server daemon', 'sshd', [proc(1012, 'root', 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups', 'system_u:system_r:sshd_t:s0-s0:c0.c1023')]),
    rsyslog: service('System Logging Service', 'rsyslogd', [proc(1015, 'root', '/usr/sbin/rsyslogd -n', 'system_u:system_r:syslogd_t:s0')]),
    crond: service('Command Scheduler', 'crond', [proc(1021, 'root', '/usr/sbin/crond -n', 'system_u:system_r:crond_t:s0-s0:c0.c1023')]),
    'getty@tty1': service('Getty on tty1', 'agetty', [proc(1024, 'root', '/sbin/agetty -o -- \\u --noreset --noclear - linux', 'system_u:system_r:getty_t:s0-s0:c0.c1023', 0.1)]),
    ...(n >= 2 ? { httpd: { ...httpdUnit(), active: true, state: 'inactive' as const } } : {}),
    ...(n === 3
      ? {
          signup: service("Common Tongue volunteers' sign-up", 'signup', [proc(1480, 'signup', `/usr/bin/python3 /opt/signup/bin/signup --listen 127.0.0.1:${APP_PORT}`, 'system_u:system_r:unconfined_service_t:s0', 2.3)], {
            unitFile: '/etc/systemd/system/signup.service',
          }),
        }
      : {}),
  };
}

/** The kernel's and the session's processes (the services' come with systemd). */
function baseProcesses(game: Shell): Process[] {
  const bash = game.shellPid;
  const you = game.player;
  const login = 'unconfined_u:unconfined_r:unconfined_t:s0-s0:c0.c1023';
  return [
    proc(1, 'root', '/usr/lib/systemd/systemd --switched-root --system --deserialize=46 rhgb', 'system_u:system_r:init_t:s0', 0.7, 0),
    proc(2, 'root', '[kthreadd]', 'system_u:system_r:kernel_t:s0', 0, 0),
    proc(bash - 9, 'root', `sshd-session: ${you} [priv]`, 'system_u:system_r:sshd_t:s0-s0:c0.c1023', 0.5, 1012),
    proc(bash - 6, you, '/usr/lib/systemd/systemd --user', login, 0.6),
    proc(bash - 1, you, `sshd-session: ${you}@pts/0`, login, 0.3, bash - 9),
    proc(bash, you, '-bash', login, 0.2, bash - 1),
  ];
}

/** The noticeboard's past requests that SELinux refused (chapter 2: since Itzel's move at 09:41). */
function pastDenials(n: ChapterNo): Avc[] {
  if (n !== 2) return [];
  const out: Avc[] = [];
  let serial = 3800;
  for (let m = 42; m <= 72; m += 5) {
    const time = Math.floor((Date.UTC(2026, 11, 12, 9, 0, 0) + m * MINUTE + 7_000) / 1000);
    out.push({ time, serial: ++serial, perm: 'read', pid: 2205, comm: 'httpd', exe: '/usr/sbin/httpd', detail: `name="index.html" dev="dm-0" ino=1053921`, scontext: 'system_u:system_r:httpd_t:s0', tcontext: 'unconfined_u:object_r:user_home_t:s0', tclass: 'file', permissive: false, syscall: 257, uid: 48 });
  }
  return out;
}
/** Chapter 3: Friday's restart, refused port 8010. */
function fridayDenial(): Avc {
  return { time: Math.floor(Date.UTC(2026, 11, 11, 17, 52, 14) / 1000), serial: 4011, perm: 'name_bind', pid: 2201, comm: 'httpd', exe: '/usr/sbin/httpd', detail: `src=${VOLUNTEERS_PORT}`, scontext: 'system_u:system_r:httpd_t:s0', tcontext: 'system_u:object_r:unreserved_port_t:s0', tclass: 'tcp_socket', permissive: false, syscall: 49, uid: 0 };
}

const PAST_AUDIT = `type=DAEMON_START msg=audit(${Math.floor(INSTALLED / 1000)}.512:6913): op=start ver=4.2.1 format=enriched kernel=6.12.0-264.17.1.el10_3.x86_64 auid=4294967295 pid=702 uid=0 ses=4294967295 subj=system_u:system_r:auditd_t:s0 res=success
type=SERVICE_START msg=audit(${Math.floor(INSTALLED / 1000) + 3}.201:5): pid=1 uid=0 auid=4294967295 ses=4294967295 subj=system_u:system_r:init_t:s0 msg='unit=firewalld comm="systemd" exe="/usr/lib/systemd/systemd" hostname=? addr=? terminal=? res=success'`;

export function kettleState(t: Translate, n: ChapterNo): Record<string, unknown> {
  const services = kettleServices(n);
  const sdState = newSystemd(`${host(t, 'kettle')}`, NOW[n] - (n === 1 ? 2 * 3600_000 : n === 2 ? 26 * 3600_000 : 4 * 86_400_000), NOW[n], services);
  // Rocky's installer left the time zone at UTC.
  sdState.zone = 'UTC';
  const se: SelinuxState = newSelinux(PAST_AUDIT);
  se.audit.push(...pastDenials(n), ...(n === 3 ? [fridayDenial()] : []));
  se.serial = 4100;
  if (n === 3) se.fcontexts.push({ spec: `${DOCROOT}(/.*)?`, ftype: '', type: 'httpd_sys_content_t' });
  const fw: FirewalldState = newFirewalld(IFACE);
  if (n >= 2) for (const c of [fw.permanent.public, fw.runtime.public]) c.services.push('http', 'https');
  const httpdState: HttpdState = { loaded: null, pid: 2201, backends: n === 3 ? { [APP_PORT]: { service: 'signup', answer: () => t('language-cafe-signup-page') } } : {} };
  const extra = n >= 2 ? ['httpd', 'httpd-core', 'httpd-filesystem', 'httpd-tools', 'apr', 'apr-util', 'apr-util-lmdb', 'apr-util-openssl', 'mod_http2', 'mod_lua', 'rocky-logos-httpd'] : [];
  if (n === 3) extra.push('policycoreutils-python-utils', 'python3-policycoreutils', 'python3-libsemanage', 'python3-setools', 'python3-audit', 'checkpolicy');
  const r = newRpm(INSTALLED, extra);
  if (n >= 2) r.history.push({ id: 2, command: 'install httpd', at: NOW[1] + 4 * MINUTE, user: 'you', action: 'Install', packages: extra.filter((x) => !x.startsWith('p') && x !== 'checkpolicy') });
  if (n === 3) r.history.push({ id: 3, command: 'install policycoreutils-python-utils', at: NOW[2] + 20 * MINUTE, user: 'you', action: 'Install', packages: extra.filter((x) => x.startsWith('p') || x === 'checkpolicy') });
  r.metadata = NOW[n] - 47 * MINUTE;
  return {
    os: 'rhel',
    systemd: sdState,
    selinux: se,
    firewalld: fw,
    rpm: r,
    httpd: n >= 2 ? httpdState : undefined,
    cafe: { chapter: n, board: NOW[n] - 2 * MINUTE, boardCodes: [] } satisfies Story,
    kernel: { active: '6.12.0-264.17.1.el10_3.x86_64', installed: '6.12.0-264.17.1.el10_3.x86_64' },
    listening: [
      { proto: 'tcp', address: '0.0.0.0', port: 22, process: 'sshd', pid: 1012 },
      { proto: 'tcp', address: '[::]', port: 22, process: 'sshd', pid: 1012 },
      { proto: 'udp', address: '127.0.0.1', port: 323, process: 'chronyd', pid: 744 },
      ...(n === 3 ? [{ proto: 'tcp' as const, address: '127.0.0.1', port: APP_PORT, process: 'python3', pid: 1480 }] : []),
    ] satisfies Listening[],
    mounts: [
      { path: '/', capacity: 17.4 * 1024 ** 3, name: '/dev/mapper/rl-root', system: 'xfs', options: 'rw,seclabel,relatime,attr2,inode64,logbufs=8,logbsize=32k,noquota', bytesBase: 2.3 * 1024 ** 3 },
      { path: '/boot', capacity: 960 * 1024 ** 2, name: '/dev/vda2', system: 'xfs', options: 'rw,seclabel,relatime,attr2,inode64,logbufs=8,logbsize=32k,noquota', bytesBase: 310 * 1024 ** 2 },
    ],
    memory: { total: 1.7 * 1024 ** 3, kernel: 420 * 1024 ** 2, rss: {} },
    baseLan: {
      interfaces: {
        lo: { name: 'lo', up: true, addresses: ['127.0.0.1/8'], mac: '00:00:00:00:00:00', addresses6: ['::1/128'] },
        [IFACE]: { name: IFACE, up: true, addresses: [`${KETTLE}/24`], mac: '52:54:00:4c:61:6e' },
      },
      gateway: { via: '192.0.2.1', dev: IFACE },
      trunk: '',
      vlans: [],
      devices: [],
      order: ['lo', IFACE],
    },
    storyCurl,
    onBoot: (j: Game) => selinuxBoot(j),
  };
}

/** After the world exists: labels from the policy, the moved files' own, the services' state, the processes. */
export function initialiseKettle(j: Game, n: ChapterNo): void {
  const s = j as Shell;
  // The installer labelled everything from the policy.
  labelTree(j, s.root);
  if (n >= 2) {
    // Itzel's files kept the label of her home (mv keeps it); the place itself was made by root (mkdir: var_t).
    const site = s.find(DOCROOT)!;
    walk(site, DOCROOT, (node, path) => {
      node.context = path === DOCROOT ? 'unconfined_u:object_r:var_t:s0' : n === 2 ? 'unconfined_u:object_r:user_home_t:s0' : 'unconfined_u:object_r:httpd_sys_content_t:s0';
    });
    // httpd's package: its files (labelled by the policy), its account.
    for (const name of ['httpd', 'httpd-core', 'httpd-filesystem', 'rocky-logos-httpd']) installFiles(j, byName(name)!);
    if (n === 3) installFiles(j, CATALOGUE.find((p) => p.name === 'policycoreutils-python-utils')!);
    // Seun's old placeholder and Itzel's config were written by hand: their own labels from the policy.
    labelTree(j, s.root);
  }
  if (n === 2) {
    // Seun left /.autorelabel before leaving: the next boot relabels everything from the policy.
    s.root.children['.autorelabel'] = { type: 'file', content: '', owner: 'root', group: 'root', context: 'system_u:object_r:etc_runtime_t:s0' };
  }
  const systemdState = sd(j);
  // The base processes, then each running service's.
  const listing: Process[] = baseProcesses(s);
  for (const svc of Object.values(systemdState.services)) if (svc.state === 'active') for (const p of svc.process) if (!listing.some((q) => q.pid === p.pid)) listing.push({ ...p });
  j.state.process = listing.sort((a, b) => a.pid - b.pid);
  reloadFirewall(j);
  firewalld(j)!.lost = [];
  j.state.sessions = [{ user: s.player, tty: 'pts/0', since: new Date(NOW[n] - 2 * MINUTE).toISOString().slice(0, 16).replace('T', ' '), forEachOf: '192.0.2.2' }];
  if (n === 2) {
    // httpd runs with Itzel's configuration since 09:41.
    start(j, systemdState, 'httpd', true);
  }
  if (n === 3) {
    // Tenzin's restart on Friday: httpd stopped, then failed to bind 8010.
    const h = systemdState.services.httpd;
    h.state = 'failed';
    h.result = 'exit-code';
    h.since = Date.UTC(2026, 11, 11, 17, 52, 14);
    const at = (ms: number, ident: string, pid: number, message: string, priority = 6) => systemdState.log.push({ time: ms, boot: systemdState.boot, unit: 'httpd.service', ident, pid, message, priority });
    const fri = Date.UTC(2026, 11, 11, 17, 52, 13);
    at(fri, 'systemd', 1, 'Stopping httpd.service - The Apache HTTP Server...');
    at(fri, 'systemd', 1, 'Stopped httpd.service - The Apache HTTP Server.');
    at(fri, 'systemd', 1, 'Starting httpd.service - The Apache HTTP Server...');
    for (const m of [`(13)Permission denied: AH00072: make_sock: could not bind to address [::]:${VOLUNTEERS_PORT}`, `(13)Permission denied: AH00072: make_sock: could not bind to address 0.0.0.0:${VOLUNTEERS_PORT}`, 'no listening sockets available, shutting down', 'AH00015: Unable to open logs'])
      at(fri + 1000, 'httpd', 2201, m, 3);
    at(fri + 1000, 'systemd', 1, 'httpd.service: Main process exited, code=exited, status=1/FAILURE', 4);
    at(fri + 1000, 'systemd', 1, "httpd.service: Failed with result 'exit-code'.", 4);
    at(fri + 1000, 'systemd', 1, 'Failed to start httpd.service - The Apache HTTP Server.', 3);
    systemdState.log.sort((a, b) => a.time - b.time);
    j.state.process = (j.state.process as Process[]).filter((p) => !systemdState.services.httpd.process.some((q) => q.pid === p.pid));
  }
  // The logs httpd keeps (created by the package).
  if (n >= 2) {
    const logs = s.find('/var/log/httpd') as Directory;
    logs.children.error_log = { type: 'file', content: '', lines: true, owner: 'root', group: 'root', context: 'system_u:object_r:httpd_log_t:s0' };
    logs.children.access_log = { type: 'file', content: '', lines: true, owner: 'root', group: 'root', context: 'system_u:object_r:httpd_log_t:s0' };
    if (n === 2) {
      // The noticeboard's requests since 09:41.
      for (const a of pastDenials(2)) {
        const when = new Date(a.time * 1000);
        const stamp = `${String(when.getUTCDate()).padStart(2, '0')}/Dec/2026:${when.toISOString().slice(11, 19)} +0000`;
        (logs.children.access_log as { content: string }).content += `${(logs.children.access_log as { content: string }).content ? '\n' : ''}${NOTICEBOARD} - - [${stamp}] "GET / HTTP/1.1" 403 1046 "-" "Mozilla/5.0 (X11; Linux aarch64; rv:128.0) Gecko/20100101 Firefox/128.0"`;
      }
    }
    if (n === 3) (logs.children.error_log as { content: string }).content = '';
  }
  // The audit log is labelled; sd's clock back to the chapter's time.
  systemdState.clock = NOW[n];
  // ~/.ssh/known_hosts for the noticeboard is the player's to accept.
}

// ——— Time ———

/** Each command: fifteen seconds; the noticeboard asks for the site every five minutes. */
export function passTime(j: Game): void {
  const k = kettle(j);
  labelMissing(k);
  const s = sd(j);
  s.clock += 15_000;
  const st = story(j);
  while (s.clock - st.board >= 5 * MINUTE) {
    st.board += 5 * MINUTE;
    const a = serve(k, { client: NOTICEBOARD, host: SITE, port: 80, path: '/', agent: 'Mozilla/5.0 (X11; Linux aarch64; rv:128.0) Gecko/20100101 Firefox/128.0' });
    st.boardCodes.push(firewallLets(k, 80, NOTICEBOARD) ? (a?.code ?? 0) : 0);
  }
}

const firewallLets = (k: Game, port: number, source: string, config: 'runtime' | 'permanent' = 'runtime') => verdict(k, port, source, config) === 'accepted';

// ——— Requests between the story's machines (curl) ———

const CURL_WITH_VALUE = ['-H', '--header', '-o', '--output', '-w', '--write-out', '-X', '--request', '-A', '--user-agent', '-m', '--max-time', '--connect-timeout'];

/** The names and addresses kettle answers to. */
const kettleNames = (t: Translate) => ['localhost', '127.0.0.1', KETTLE, host(t, 'kettle'), `${host(t, 'kettle')}.internal`, SITE, SIGNUP, 'commontongue.example'];

/** curl towards kettle, from kettle itself or from the noticeboard; null: curl's own way. */
export function storyCurl(from: Shell, args: string[]): string | null {
  let requestHost: string | null = null;
  let writeOut: string | null = null;
  let output: string | null = null;
  const positional: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (CURL_WITH_VALUE.includes(args[i])) {
      const v = args[++i] ?? '';
      const h = /^host:\s*(\S+)/i.exec(v);
      if ((args[i - 1] === '-H' || args[i - 1] === '--header') && h) requestHost = h[1];
      if (args[i - 1] === '-w' || args[i - 1] === '--write-out') writeOut = v;
      if (args[i - 1] === '-o' || args[i - 1] === '--output') output = v;
    } else if (!args[i].startsWith('-')) positional.push(args[i]);
  }
  const m = /^(?:(https?):\/\/)?([^/:]+)(?::(\d+))?(.*)$/.exec(positional[0] ?? '');
  if (!m) return null;
  const k = from.principal;
  const target = m[2].toLowerCase();
  if (!kettleNames(k.t).includes(target)) return null;
  const onKettle = from === k;
  // From the noticeboard, localhost is the noticeboard itself.
  if (!onKettle && ['localhost', '127.0.0.1'].includes(target)) return null;
  const port = Number(m[3] ?? (m[1] === 'https' ? 443 : 80));
  const path = m[4] || '/';
  const client = onKettle ? (['localhost', '127.0.0.1'].includes(target) ? '127.0.0.1' : KETTLE) : NOTICEBOARD;
  const refused = () => from.error(`curl: (7) Failed to connect to ${target} port ${port} after ${onKettle ? 0 : 3} ms: Couldn't connect to server`, 7);
  // firewalld: what comes from outside (the noticeboard); kettle talking to itself goes through lo.
  if (!onKettle && !firewallLets(k, port, client)) {
    (k.state.cafeCurls ??= []).push({ from: from.host, port, code: 0 });
    return refused();
  }
  // The sign-up app, asked directly on its port (from kettle: it listens on 127.0.0.1 only).
  const h = httpd(k);
  if (port === APP_PORT) {
    const app = h?.backends[APP_PORT];
    if (!onKettle || client !== '127.0.0.1' || !app || sd(k).services[app.service]?.state !== 'active') return refused();
    return app.answer(path);
  }
  const a = serve(k, { client, host: requestHost ?? target, port, path });
  (k.state.cafeCurls ??= []).push({ from: from.host, port, code: a?.code ?? 0, host: requestHost ?? target });
  if (!a) return refused();
  const headers = args.includes('-I') || args.includes('--head');
  const withHeaders = args.includes('-i') || args.includes('--include');
  const after = writeOut === null ? '' : writeOut.replace(/%\{(http_code|response_code)\}/g, String(a.code)).replace(/\\n/g, '\n');
  if (output === '/dev/null') return after;
  const shown = headers ? headersOf(k, a).join('\n') : withHeaders ? `${headersOf(k, a).join('\n')}\n\n${a.body}` : a.body;
  return `${shown}${after}`;
}

// ——— What the story checks, without trace ———

/** A request as the noticeboard (office), someone on the internet, or kettle itself would make it now; 0: no answer. */
export function reach(j: Game, from: 'office' | 'internet', hostName: string, port: number, path = '/', config: 'runtime' | 'permanent' = 'runtime'): number {
  const k = kettle(j);
  const client = from === 'office' ? NOTICEBOARD : OUTSIDE;
  if (!firewallLets(k, port, client, config)) return 0;
  return serve(k, { client, host: hostName, port, path }, true)?.code ?? 0;
}
export const bodyFor = (j: Game, hostName: string, port: number, path = '/') => serve(kettle(j), { client: NOTICEBOARD, host: hostName, port, path }, true)?.body ?? '';

/** The packages, the service. */
export const installed = (j: Game, name: string) => !!rpm(kettle(j)).installed[name];
export const httpdUp = (j: Game) => sd(j).services.httpd?.state === 'active';
export const httpdEnabled = (j: Game) => !!sd(j).services.httpd?.active;
export const firewallUp = (j: Game) => sd(j).services.firewalld?.state === 'active' && !!sd(j).services.firewalld?.active;

/** Does the zone allow this port (a service or a port) for everyone, at runtime or permanently? */
export const openToAll = (j: Game, port: number, config: 'runtime' | 'permanent') => verdict(kettle(j), port, OUTSIDE, config) === 'accepted';
/** … and to the café's network. */
export const openToOffice = (j: Game, port: number, config: 'runtime' | 'permanent') => verdict(kettle(j), port, NOTICEBOARD, config) === 'accepted';

/** SELinux on: now, and at the next boot. */
export const enforcing = (j: Game) => selinux(kettle(j)).mode === 'enforcing';
export const enforcingAtBoot = (j: Game) => /^\s*SELINUX\s*=\s*enforcing\s*$/m.test(kettle(j).read('/etc/selinux/config') ?? '');

/** Every file httpd serves from a root: readable by httpd now and as the policy labels it (after a relabel). */
export function labelsHold(j: Game, docroot: string): { now: boolean; afterRelabel: boolean } {
  const k = kettle(j);
  const n = k.find(docroot);
  if (!n) return { now: false, afterRelabel: false };
  let now = true;
  let after = true;
  walk(n, docroot, (node, path) => {
    const tclass = node.type === 'directory' ? 'dir' : 'file';
    const perm = node.type === 'directory' ? 'search' : 'read';
    if (!httpdAllows(k, typeOf(node.context), tclass, perm)) now = false;
    const next = restored(k, node, path) ?? node.context;
    if (!httpdAllows(k, typeOf(next), tclass, perm, true)) after = false;
  });
  return { now, afterRelabel: after };
}

/** A module loaded from audit2allow (or Tenzin's) that lets httpd do something. */
export const customModules = (j: Game) => Object.values(selinux(kettle(j)).modules).some((rules) => rules.some((r) => r.source === 'httpd_t'));
export const boolSaved = (j: Game, name: string) => !!selinux(kettle(j)).booleans[name]?.saved;
export const boolNow = (j: Game, name: string) => !!selinux(kettle(j)).booleans[name]?.value;
export const portTypeOf = (j: Game, port: number) => portType(kettle(j), port);

/** Kaveh's reboot (chapter 2): the kernel update, /.autorelabel if it is there, the services back. */
export function rebootKettle(j: Game): void {
  const k = kettle(j);
  const s = sd(j);
  writeLog(s, '', 'systemd-logind', 752, 'The system will reboot now!');
  for (const name of ['httpd']) if (s.services[name]?.state === 'active') stop(k, s, name);
  s.clock += 3 * MINUTE;
  s.boot++;
  const relabel = k.exists('/.autorelabel');
  selinuxBoot(k);
  story(j).relabelled = relabel;
  reloadFirewall(k);
  for (const [name, svc] of Object.entries(s.services)) if (svc.active && svc.state !== 'active') start(k, s, name, true);
  if (s.services.httpd && !s.services.httpd.active && s.services.httpd.state === 'active') stop(k, s, 'httpd');
}

/** The noticeboard: the café's screen, a small Debian box on the café's network. */
export function noticeboardHost(): InternalHost {
  return {
    address: NOTICEBOARD,
    domain: 'noticeboard.internal',
    commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'curl', 'ping', 'hostname', 'exit'],
    accounts: () => ({ users: { root: { uid: 0, group: 'root', home: '/root' }, you: { uid: 1000, group: 'you' } }, groups: { root: { gid: 0, members: [] }, you: { gid: 1000, members: [] } } }),
    state: (t) => ({
      systemd: newSystemd(host(t, 'noticeboard'), NOW[1] - 9 * 86_400_000, NOW[1], {
        ssh: { description: 'OpenBSD Secure Shell server', active: true, executable: 'sshd', process: [{ pid: 611, user: 'root', cpu: 0, mem: 0.4, command: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' }] },
      }),
    }),
    afterCommand: (j) => passTime(j),
    createWorld: (t) =>
      place({
        etc: place({
          ...accountsFiles(),
          hostname: file(host(t, 'noticeboard')),
          hosts: file([`127.0.0.1\tlocalhost`, `${NOTICEBOARD}\t${host(t, 'noticeboard')}.internal ${host(t, 'noticeboard')}`, `${KETTLE}\t${host(t, 'kettle')}.internal ${host(t, 'kettle')} ${SITE} ${SIGNUP}`].join('\n')),
          kiosk: place({ 'kiosk.conf': file(`# The cafe's screen: a browser in kiosk mode, reloaded every five minutes.\nURL=http://${SITE}/\nRELOAD=300`) }),
        }),
        home: place({ you: d({ '.ssh': d({ authorized_keys: f(playerKey(t).isPublic, { lines: true, mode: 'rw-------' }) }, undefined, { mode: 'rwx------' }) }) }),
        tmp: place({}, { owner: 'root', mode: 'rwxrwxrwt' }),
      }),
  };
}
