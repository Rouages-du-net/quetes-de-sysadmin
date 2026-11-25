// The packages of a Debian 13 ("trixie") server: what a minimal installation
// with the SSH server and the standard utilities has (`dpkg -l` on a fresh
// cloud image), their versions, sections and short descriptions as the
// archive gives them (https://packages.debian.org/trixie/), and the files the
// game cares about (dpkg -L, dpkg -S: the programs and their manual pages).
// A chapter's own packages (state.apt.installed, the catalogue of
// commands/apt.ts) come on top; a removed base package is in state.apt.removed.
// Differences: about sixty packages rather than three hundred (no libraries
// but libc6), indicative versions and sizes, no maintainer.

export interface BasePackage {
  version: string;
  architecture: 'amd64' | 'all';
  section: string;
  priority: 'required' | 'important' | 'standard' | 'optional';
  // Essential: yes (dpkg refuses to remove it without --force-remove-essential).
  essential?: boolean;
  description: string;
  // Installed size (kB).
  size: number;
  // Its files: programs (/usr/bin/…, /usr/sbin/…) and configuration (/etc/…).
  files?: string[];
  depends?: string;
  homepage?: string;
}

const bin = (...names: string[]) => names.map((n) => `/usr/bin/${n}`);
const sbin = (...names: string[]) => names.map((n) => `/usr/sbin/${n}`);

export const BASE: Record<string, BasePackage> = {
  adduser: { version: '3.152', architecture: 'all', section: 'admin', priority: 'important', description: 'add and remove users and groups', size: 271, files: [...sbin('adduser', 'deluser', 'addgroup', 'delgroup'), '/etc/adduser.conf', '/etc/deluser.conf'], depends: 'passwd (>= 1:4.17.2-5)' },
  apt: { version: '3.0.3', architecture: 'amd64', section: 'admin', priority: 'required', description: 'commandline package manager', size: 4419, files: bin('apt', 'apt-get', 'apt-cache', 'apt-config', 'apt-mark', 'apt-key'), depends: 'base-passwd (>= 3.6.1) | adduser, gpgv | gpgv2 | gpgv1, libapt-pkg7.0 (>= 3.0.3), debian-archive-keyring, libc6 (>= 2.38)', homepage: 'https://wiki.debian.org/Apt' },
  'base-files': { version: '13.8+deb13u1', architecture: 'amd64', section: 'admin', priority: 'required', essential: true, description: 'Debian base system miscellaneous files', size: 346, files: ['/etc/debian_version', '/etc/issue', '/etc/issue.net', '/etc/motd', '/usr/lib/os-release', '/etc/os-release'] },
  'base-passwd': { version: '3.6.7', architecture: 'amd64', section: 'admin', priority: 'required', essential: true, description: 'Debian base system master password and group files', size: 243, files: sbin('update-passwd') },
  bash: { version: '5.2.37-2+b5', architecture: 'amd64', section: 'shells', priority: 'required', essential: true, description: 'GNU Bourne Again SHell', size: 7262, files: [...bin('bash', 'bashbug', 'clear_console'), '/etc/bash.bashrc', '/etc/skel/.bash_logout', '/etc/skel/.bashrc', '/etc/skel/.profile'], homepage: 'https://tiswww.case.edu/php/chet/bash/bashtop.html' },
  bsdextrautils: { version: '2.41-5', architecture: 'amd64', section: 'utils', priority: 'standard', description: 'extra utilities from 4.4BSD-Lite', size: 335, files: bin('column', 'hexdump', 'look', 'ul', 'write') },
  'bind9-dnsutils': { version: '1:9.20.15-1~deb13u1', architecture: 'amd64', section: 'net', priority: 'standard', description: 'Clients provided with BIND 9', size: 791, files: bin('dig', 'nslookup', 'nsupdate', 'delv'), homepage: 'https://www.isc.org/bind/' },
  'bind9-host': { version: '1:9.20.15-1~deb13u1', architecture: 'amd64', section: 'net', priority: 'standard', description: 'DNS Lookup Utility', size: 151, files: bin('host'), homepage: 'https://www.isc.org/bind/' },
  bsdutils: { version: '1:2.41-5', architecture: 'amd64', section: 'utils', priority: 'required', essential: true, description: 'basic utilities from 4.4BSD-Lite', size: 360, files: bin('logger', 'renice', 'script', 'scriptreplay', 'wall') },
  bzip2: { version: '1.0.8-6', architecture: 'amd64', section: 'utils', priority: 'standard', description: 'high-quality block-sorting file compressor - utilities', size: 116, files: bin('bzip2', 'bunzip2', 'bzcat', 'bzgrep', 'bzless'), homepage: 'https://sourceware.org/bzip2/' },
  'ca-certificates': { version: '20250419', architecture: 'all', section: 'misc', priority: 'standard', description: 'Common CA certificates', size: 405, files: [...sbin('update-ca-certificates'), '/etc/ca-certificates.conf'] },
  coreutils: {
    version: '9.7-3',
    architecture: 'amd64',
    section: 'utils',
    priority: 'required',
    essential: true,
    description: 'GNU core utilities',
    size: 19207,
    files: [
      ...bin('base64', 'basename', 'cat', 'chgrp', 'chmod', 'chown', 'cp', 'cut', 'date', 'dd', 'df', 'dir', 'dirname', 'du', 'echo', 'env', 'expand', 'expr', 'false', 'head', 'id', 'ln', 'ls', 'md5sum', 'mkdir', 'mktemp', 'mv', 'nice', 'nl', 'nohup', 'nproc', 'paste', 'printenv', 'printf', 'pwd', 'readlink', 'realpath', 'rm', 'rmdir', 'seq', 'sha256sum', 'sleep', 'sort', 'split', 'stat', 'sync', 'tac', 'tail', 'tee', 'test', 'timeout', 'touch', 'tr', 'true', 'truncate', 'uname', 'uniq', 'wc', 'whoami', 'yes'),
      ...sbin('chroot'),
    ],
    homepage: 'https://www.gnu.org/software/coreutils/',
  },
  cron: { version: '3.0pl1-197', architecture: 'amd64', section: 'admin', priority: 'important', description: 'process scheduling daemon', size: 220, files: [...bin('crontab'), ...sbin('cron'), '/etc/crontab', '/etc/cron.d/e2scrub_all'], depends: 'cron-daemon-common, libc6 (>= 2.38), libpam0g (>= 0.99.7.1), libselinux1 (>= 3.1~), sensible-utils' },
  'cron-daemon-common': { version: '3.0pl1-197', architecture: 'all', section: 'admin', priority: 'important', description: 'process scheduling daemon\'s configuration files', size: 48, files: ['/etc/cron.daily/.placeholder'] },
  curl: { version: '8.14.1-2', architecture: 'amd64', section: 'web', priority: 'optional', description: 'command line tool for transferring data with URL syntax', size: 497, files: bin('curl'), homepage: 'https://curl.se' },
  dash: { version: '0.5.12-12', architecture: 'amd64', section: 'shells', priority: 'required', essential: true, description: 'POSIX-compliant shell', size: 211, files: bin('dash', 'sh') },
  dbus: { version: '1.16.2-2', architecture: 'amd64', section: 'admin', priority: 'standard', description: 'simple interprocess messaging system (system message bus)', size: 89, files: bin('dbus-daemon') },
  debconf: { version: '1.5.91', architecture: 'all', section: 'admin', priority: 'required', description: 'Debian configuration management system', size: 515, files: bin('debconf', 'debconf-show') },
  'debian-archive-keyring': { version: '2025.1', architecture: 'all', section: 'misc', priority: 'important', description: 'OpenPGP archive certificates of the Debian archive', size: 263, files: ['/usr/share/keyrings/debian-archive-keyring.gpg'] },
  debianutils: { version: '5.23.2', architecture: 'amd64', section: 'utils', priority: 'required', essential: true, description: 'Miscellaneous utilities specific to Debian', size: 243, files: [...bin('run-parts', 'savelog', 'which', 'ischroot'), ...sbin('add-shell', 'remove-shell')] },
  diffutils: { version: '1:3.10-4', architecture: 'amd64', section: 'utils', priority: 'required', essential: true, description: 'File comparison utilities', size: 1599, files: bin('cmp', 'diff', 'diff3', 'sdiff'), homepage: 'https://www.gnu.org/software/diffutils/' },
  'dhcpcd-base': { version: '1:10.1.0-11', architecture: 'amd64', section: 'net', priority: 'important', description: 'DHCPv4 and DHCPv6 dual-stack client (binaries and exit hooks)', size: 418, files: sbin('dhcpcd') },
  dpkg: { version: '1.22.21', architecture: 'amd64', section: 'admin', priority: 'required', essential: true, description: 'Debian package management system', size: 6588, files: bin('dpkg', 'dpkg-deb', 'dpkg-query', 'dpkg-divert', 'dpkg-statoverride', 'update-alternatives'), homepage: 'https://wiki.debian.org/Teams/Dpkg' },
  e2fsprogs: { version: '1.47.2-3+b3', architecture: 'amd64', section: 'admin', priority: 'important', description: 'ext2/ext3/ext4 file system utilities', size: 1543, files: [...sbin('e2fsck', 'mke2fs', 'mkfs.ext4', 'resize2fs', 'tune2fs', 'dumpe2fs', 'fsck.ext4'), ...bin('chattr', 'lsattr')], homepage: 'http://e2fsprogs.sourceforge.net' },
  findutils: { version: '4.10.0-3', architecture: 'amd64', section: 'utils', priority: 'required', essential: true, description: 'utilities for finding files--find, xargs', size: 1888, files: bin('find', 'xargs'), homepage: 'https://savannah.gnu.org/projects/findutils/' },
  gpgv: { version: '2.4.7-21', architecture: 'amd64', section: 'utils', priority: 'important', description: 'GNU privacy guard - signature verification tool', size: 418, files: bin('gpgv') },
  grep: { version: '3.11-4', architecture: 'amd64', section: 'utils', priority: 'required', essential: true, description: 'GNU grep, egrep and fgrep', size: 1159, files: bin('grep', 'egrep', 'fgrep'), homepage: 'https://www.gnu.org/software/grep/' },
  gzip: { version: '1.13-1', architecture: 'amd64', section: 'utils', priority: 'required', essential: true, description: 'GNU compression utilities', size: 247, files: bin('gzip', 'gunzip', 'zcat', 'zgrep', 'zless', 'zmore', 'zdiff') },
  hostname: { version: '3.25', architecture: 'amd64', section: 'admin', priority: 'required', essential: true, description: 'utility to set/show the host name or domain name', size: 47, files: bin('hostname', 'dnsdomainname', 'domainname') },
  ifupdown: { version: '0.8.44', architecture: 'amd64', section: 'admin', priority: 'important', description: 'high level tools to configure network interfaces', size: 222, files: [...sbin('ifup', 'ifdown', 'ifquery'), '/etc/network/interfaces'] },
  init: { version: '1.69', architecture: 'amd64', section: 'metapackages', priority: 'required', essential: true, description: 'metapackage ensuring an init system is installed', size: 15 },
  'init-system-helpers': { version: '1.69', architecture: 'all', section: 'admin', priority: 'required', description: 'helper tools for all init systems', size: 133, files: [...bin('deb-systemd-helper', 'deb-systemd-invoke'), ...sbin('invoke-rc.d', 'service', 'update-rc.d')] },
  iproute2: { version: '6.15.0-1', architecture: 'amd64', section: 'net', priority: 'important', description: 'networking and traffic control tools', size: 3698, files: [...bin('ip', 'ss', 'bridge'), ...sbin('tc')], homepage: 'https://wiki.linuxfoundation.org/networking/iproute2' },
  'iputils-ping': { version: '3:20240905-3', architecture: 'amd64', section: 'net', priority: 'important', description: 'Tools to test the reachability of network hosts', size: 118, files: bin('ping', 'ping4', 'ping6') },
  less: { version: '668-1', architecture: 'amd64', section: 'text', priority: 'important', description: 'pager program similar to more', size: 381, files: bin('less', 'lessecho', 'lesskey', 'lesspipe') },
  'libc-bin': { version: '2.41-12', architecture: 'amd64', section: 'libs', priority: 'required', essential: true, description: 'GNU C Library: Binaries', size: 2700, files: [...bin('getent', 'getconf', 'iconv', 'ldd', 'locale'), ...sbin('ldconfig')], homepage: 'https://www.gnu.org/software/libc/libc.html' },
  libc6: { version: '2.41-12', architecture: 'amd64', section: 'libs', priority: 'required', description: 'GNU C Library: Shared libraries', size: 12960, files: ['/usr/lib/x86_64-linux-gnu/libc.so.6'], homepage: 'https://www.gnu.org/software/libc/libc.html' },
  'linux-image-amd64': { version: '6.12.48-1', architecture: 'amd64', section: 'kernel', priority: 'optional', description: 'Linux for 64-bit PCs (meta-package)', size: 13 },
  login: { version: '1:4.16.0-2+really2.41-5', architecture: 'amd64', section: 'admin', priority: 'required', essential: true, description: 'system login tools', size: 106, files: [...bin('login', 'newgrp', 'sg'), '/etc/login.defs'] },
  logrotate: { version: '3.22.0-1', architecture: 'amd64', section: 'admin', priority: 'important', description: 'Log rotation utility', size: 167, files: [...sbin('logrotate'), '/etc/logrotate.conf'] },
  'man-db': { version: '2.13.1-1', architecture: 'amd64', section: 'doc', priority: 'standard', description: 'tools for reading manual pages', size: 2805, files: bin('man', 'apropos', 'whatis', 'mandb'), homepage: 'https://gitlab.com/man-db/man-db' },
  mawk: { version: '1.3.4.20250131-1', architecture: 'amd64', section: 'interpreters', priority: 'required', description: 'Pattern scanning and text processing language', size: 263, files: bin('mawk', 'awk') },
  mount: { version: '2.41-5', architecture: 'amd64', section: 'admin', priority: 'required', description: 'tools for mounting and manipulating filesystems', size: 352, files: [...bin('mount', 'umount', 'findmnt'), ...sbin('losetup', 'swapon', 'swapoff')] },
  nano: { version: '8.4-1', architecture: 'amd64', section: 'editors', priority: 'important', description: 'small, friendly text editor inspired by Pico', size: 2997, files: [...bin('nano', 'rnano'), '/etc/nanorc'], homepage: 'https://www.nano-editor.org/' },
  'ncurses-bin': { version: '6.5+20250216-2', architecture: 'amd64', section: 'utils', priority: 'required', essential: true, description: 'terminal-related programs and man pages', size: 641, files: bin('clear', 'reset', 'tput', 'tset', 'infocmp') },
  netbase: { version: '6.5', architecture: 'all', section: 'admin', priority: 'important', description: 'Basic TCP/IP networking system', size: 44, files: ['/etc/protocols', '/etc/services', '/etc/rpc'] },
  'openssh-client': { version: '1:10.0p1-7', architecture: 'amd64', section: 'net', priority: 'standard', description: 'secure shell (SSH) client, for secure access to remote machines', size: 5003, files: [...bin('ssh', 'scp', 'sftp', 'ssh-keygen', 'ssh-copy-id', 'ssh-add', 'ssh-agent', 'ssh-keyscan'), '/etc/ssh/ssh_config'], homepage: 'https://www.openssh.com/' },
  'openssh-server': { version: '1:10.0p1-7', architecture: 'amd64', section: 'net', priority: 'optional', description: 'secure shell (SSH) server, for secure access from remote machines', size: 2132, files: [...sbin('sshd'), '/usr/lib/openssh/sshd-session', '/etc/ssh/sshd_config', '/etc/ssh/moduli'], depends: 'openssh-client (= 1:10.0p1-7), openssh-sftp-server, libc6 (>= 2.38)', homepage: 'https://www.openssh.com/' },
  'openssh-sftp-server': { version: '1:10.0p1-7', architecture: 'amd64', section: 'net', priority: 'optional', description: 'secure shell (SSH) sftp server module, for SFTP access from remote machines', size: 156, files: ['/usr/lib/openssh/sftp-server'] },
  passwd: { version: '1:4.17.4-2', architecture: 'amd64', section: 'admin', priority: 'required', description: 'change and administer password and group data', size: 2900, files: [...bin('passwd', 'chage', 'chfn', 'chsh', 'gpasswd', 'expiry'), ...sbin('useradd', 'userdel', 'usermod', 'groupadd', 'groupdel', 'groupmod', 'chpasswd', 'pwck', 'grpck', 'vipw')], homepage: 'https://github.com/shadow-maint/shadow' },
  procps: { version: '2:4.0.4-9', architecture: 'amd64', section: 'admin', priority: 'important', description: '/proc file system utilities', size: 2389, files: [...bin('free', 'kill', 'pgrep', 'pidof', 'pkill', 'pmap', 'ps', 'pwdx', 'slabtop', 'tload', 'top', 'uptime', 'vmstat', 'w', 'watch'), ...sbin('sysctl')], homepage: 'https://gitlab.com/procps-ng/procps' },
  'readline-common': { version: '8.2-6', architecture: 'all', section: 'utils', priority: 'important', description: 'GNU readline and history libraries, common files', size: 94, files: ['/etc/inputrc'] },
  rsync: { version: '3.4.1+ds1-5', architecture: 'amd64', section: 'net', priority: 'optional', description: 'fast, versatile, remote (and local) file-copying tool', size: 806, files: bin('rsync'), homepage: 'https://rsync.samba.org/' },
  sed: { version: '4.9-2', architecture: 'amd64', section: 'utils', priority: 'required', essential: true, description: 'GNU stream editor for filtering/transforming text', size: 885, files: bin('sed'), homepage: 'https://www.gnu.org/software/sed/' },
  'sensible-utils': { version: '0.0.25', architecture: 'all', section: 'utils', priority: 'required', description: 'Utilities for sensible alternative selection', size: 59, files: bin('sensible-editor', 'sensible-pager', 'sensible-browser') },
  sudo: { version: '1.9.16p2-3', architecture: 'amd64', section: 'admin', priority: 'optional', description: 'Provide limited super user privileges to specific users', size: 6230, files: [...bin('sudo', 'sudoedit', 'sudoreplay'), ...sbin('visudo'), '/etc/sudoers', '/etc/sudoers.d/README'], homepage: 'https://www.sudo.ws/' },
  systemd: { version: '257.8-1~deb13u2', architecture: 'amd64', section: 'admin', priority: 'important', description: 'system and service manager', size: 11283, files: [...bin('systemctl', 'journalctl', 'hostnamectl', 'timedatectl', 'localectl', 'loginctl', 'networkctl', 'systemd-analyze', 'systemd-cgtop', 'busctl'), '/usr/lib/systemd/systemd', '/etc/systemd/journald.conf', '/etc/systemd/system.conf'], homepage: 'https://systemd.io/' },
  'systemd-sysv': { version: '257.8-1~deb13u2', architecture: 'amd64', section: 'admin', priority: 'important', description: 'system and service manager - SysV compatibility symlinks', size: 76, files: sbin('init', 'halt', 'poweroff', 'reboot', 'shutdown', 'runlevel', 'telinit') },
  'systemd-timesyncd': { version: '257.8-1~deb13u2', architecture: 'amd64', section: 'admin', priority: 'important', description: 'minimalistic service to synchronize local time with NTP servers', size: 189, files: ['/usr/lib/systemd/systemd-timesyncd', '/etc/systemd/timesyncd.conf'] },
  tar: { version: '1.35+dfsg-3.1', architecture: 'amd64', section: 'utils', priority: 'required', essential: true, description: 'GNU version of the tar archiving utility', size: 3234, files: bin('tar'), homepage: 'https://www.gnu.org/software/tar/' },
  traceroute: { version: '1:2.1.6-1', architecture: 'amd64', section: 'net', priority: 'standard', description: 'Traces the route taken by packets over an IPv4/IPv6 network', size: 162, files: bin('traceroute.db', 'traceroute6.db', 'lft.db', 'tcptraceroute.db'), homepage: 'https://traceroute.sourceforge.net/' },
  tzdata: { version: '2025b-4+deb13u1', architecture: 'all', section: 'localization', priority: 'required', description: 'time zone and daylight-saving time data', size: 1384, files: ['/usr/share/zoneinfo/Europe/Paris', '/usr/share/zoneinfo/UTC'], homepage: 'https://www.iana.org/time-zones' },
  udev: { version: '257.8-1~deb13u2', architecture: 'amd64', section: 'admin', priority: 'important', description: '/dev/ and hotplug management daemon', size: 11500, files: [...bin('udevadm'), '/usr/lib/systemd/systemd-udevd'] },
  'util-linux': {
    version: '2.41-5',
    architecture: 'amd64',
    section: 'utils',
    priority: 'required',
    essential: true,
    description: 'miscellaneous system utilities',
    size: 5076,
    files: [...bin('dmesg', 'flock', 'ionice', 'lsblk', 'lscpu', 'more', 'prlimit', 'su', 'taskset', 'whereis', 'lastlog2', 'mesg'), ...sbin('blkid', 'fsck', 'mkfs', 'mkswap', 'runuser', 'wipefs', 'agetty', 'sulogin')],
    homepage: 'https://www.kernel.org/pub/linux/utils/util-linux/',
  },
  'vim-tiny': { version: '2:9.1.1230-2', architecture: 'amd64', section: 'editors', priority: 'important', description: 'Vi IMproved - enhanced vi editor - compact version', size: 1773, files: bin('vim.tiny'), homepage: 'https://www.vim.org/' },
  wget: { version: '1.25.0-2', architecture: 'amd64', section: 'web', priority: 'standard', description: 'retrieves files from the web', size: 3699, files: [...bin('wget'), '/etc/wgetrc'], homepage: 'https://www.gnu.org/software/wget/' },
  whiptail: { version: '0.52.25-1', architecture: 'amd64', section: 'utils', priority: 'important', description: 'Displays user-friendly dialog boxes from shell scripts', size: 75, files: bin('whiptail') },
  'xz-utils': { version: '5.8.1-1', architecture: 'amd64', section: 'utils', priority: 'standard', description: 'XZ-format compression utilities', size: 520, files: bin('xz', 'unxz', 'xzcat', 'xzgrep', 'xzless'), homepage: 'https://tukaani.org/xz/' },
};

// Packages of the archive that aren't installed, but that apt can show and
// install (besides the catalogue of commands/apt.ts). lsb-release: since
// Debian 12, no longer installed by default.
export const ARCHIVE: Record<string, BasePackage> = {
  'lsb-release': { version: '12.1-1', architecture: 'all', section: 'misc', priority: 'optional', description: 'Linux Standard Base version reporting utility (minimal implementation)', size: 20, files: bin('lsb_release'), homepage: 'https://salsa.debian.org/gioele/lsb-release-minimal' },
  nginx: { version: '1.26.3-3', architecture: 'amd64', section: 'httpd', priority: 'optional', description: 'small, powerful, scalable web/proxy server', size: 1210, files: [...sbin('nginx'), '/etc/nginx/nginx.conf'], depends: 'nginx-common (= 1.26.3-3), iproute2, libc6 (>= 2.38), libcrypt1 (>= 1:4.1.0), libpcre2-8-0 (>= 10.22), libssl3t64 (>= 3.0.0), zlib1g (>= 1:1.1.4)', homepage: 'https://nginx.org' },
  'nginx-common': { version: '1.26.3-3', architecture: 'all', section: 'httpd', priority: 'optional', description: 'small, powerful, scalable web/proxy server - common files', size: 486, files: ['/etc/nginx/mime.types', '/etc/nginx/sites-available/default', '/var/www/html/index.nginx-debian.html'], homepage: 'https://nginx.org' },
  certbot: { version: '4.0.0-2', architecture: 'all', section: 'web', priority: 'optional', description: 'automatically configure HTTPS using Let\'s Encrypt', size: 1530, files: bin('certbot'), homepage: 'https://certbot.eff.org/' },
  'python3-certbot-nginx': { version: '4.0.0-1', architecture: 'all', section: 'python', priority: 'optional', description: 'Nginx plugin for Certbot', size: 318, files: ['/usr/lib/python3/dist-packages/certbot_nginx/__init__.py'], homepage: 'https://certbot.eff.org/' },
  'cifs-utils': { version: '2:7.2-2', architecture: 'amd64', section: 'otherosfs', priority: 'optional', description: 'Common Internet File System utilities', size: 337, files: sbin('mount.cifs', 'mount.smb3', 'cifs.upcall'), homepage: 'https://wiki.samba.org/index.php/LinuxCIFS_utils' },
  'nut-server': { version: '2.8.1-5+deb13u1', architecture: 'amd64', section: 'admin', priority: 'optional', description: 'network UPS tools - core system', size: 1250, files: [...sbin('upsd', 'upsdrvctl'), '/lib/nut/usbhid-ups', '/etc/nut/ups.conf', '/etc/nut/upsd.conf', '/etc/nut/upsd.users'], depends: 'adduser, libusb-1.0-0, nut-client (= 2.8.1-5+deb13u1)', homepage: 'https://www.networkupstools.org/' },
  'nut-client': { version: '2.8.1-5+deb13u1', architecture: 'amd64', section: 'admin', priority: 'optional', description: 'network UPS tools - clients', size: 512, files: [...bin('upsc', 'upscmd', 'upsrw', 'upssched-cmd'), ...sbin('upsmon', 'upssched'), '/etc/nut/nut.conf', '/etc/nut/upsmon.conf', '/etc/nut/upssched.conf'], depends: 'adduser, lsb-base, libupsclient6', homepage: 'https://www.networkupstools.org/' },
  ipmitool: { version: '1.8.19-9', architecture: 'amd64', section: 'utils', priority: 'optional', description: 'utility for IPMI control with kernel driver or LAN interface (daemon)', size: 2190, files: bin('ipmitool'), homepage: 'https://codeberg.org/IPMITool/ipmitool' },
  smbclient: { version: '2:4.22.3+dfsg-4', architecture: 'amd64', section: 'net', priority: 'optional', description: 'command-line SMB/CIFS clients for Unix', size: 1680, files: bin('smbclient', 'smbget', 'smbtar'), homepage: 'https://www.samba.org' },
  'mariadb-server': { version: '1:11.8.9+ds-0+deb13u1', architecture: 'amd64', section: 'database', priority: 'optional', description: 'MariaDB database server binaries', size: 72, files: [...sbin('mariadbd'), ...bin('mariadb-secure-installation'), '/etc/mysql/mariadb.conf.d/50-server.cnf'], depends: 'mariadb-client (>= 1:11.8.9+ds-0+deb13u1), mariadb-server-core (>= 1:11.8.9+ds-0+deb13u1), mariadb-common, galera-4 (>= 26.4), adduser, debconf', homepage: 'https://mariadb.org/' },
  'mariadb-client': { version: '1:11.8.9+ds-0+deb13u1', architecture: 'amd64', section: 'database', priority: 'optional', description: 'MariaDB database client binaries', size: 31_200, files: [...bin('mariadb', 'mariadb-dump', 'mariadb-admin', 'mariadb-check'), '/etc/mysql/mariadb.conf.d/50-client.cnf'], depends: 'mariadb-client-core (>= 1:11.8.9+ds-0+deb13u1), mariadb-common, libmariadb3', homepage: 'https://mariadb.org/' },
  'mariadb-client-compat': { version: '1:11.8.9+ds-0+deb13u1', architecture: 'all', section: 'database', priority: 'optional', description: 'MariaDB database client symlinks (mysql, mysqldump…)', size: 40, files: bin('mysql', 'mysqldump', 'mysqladmin', 'mysqlcheck'), depends: 'mariadb-client (>= 1:11.8.9+ds-0+deb13u1)', homepage: 'https://mariadb.org/' },
  'mariadb-common': { version: '1:11.8.9+ds-0+deb13u1', architecture: 'all', section: 'database', priority: 'optional', description: 'MariaDB database common config files (main configuration and scripts)', size: 104, files: ['/etc/mysql/mariadb.cnf', '/etc/mysql/my.cnf'], homepage: 'https://mariadb.org/' },
  postfix: { version: '3.10.13-0+deb13u1', architecture: 'amd64', section: 'mail', priority: 'optional', description: 'High-performance mail transport agent', size: 4160, files: [...sbin('postfix', 'postconf', 'postqueue', 'postsuper', 'postmap', 'sendmail'), '/etc/postfix/main.cf'], homepage: 'https://www.postfix.org' },
  'dovecot-core': { version: '1:2.4.1+dfsg1-6+deb13u7', architecture: 'amd64', section: 'mail', priority: 'optional', description: 'secure POP3/IMAP server - core files', size: 13_830, files: [...sbin('dovecot'), ...bin('doveadm', 'doveconf'), '/etc/dovecot/dovecot.conf', '/etc/dovecot/conf.d/10-mail.conf', '/etc/dovecot/conf.d/90-quota.conf'], homepage: 'https://www.dovecot.org/' },
  'dovecot-imapd': { version: '1:2.4.1+dfsg1-6+deb13u7', architecture: 'amd64', section: 'mail', priority: 'optional', description: 'secure POP3/IMAP server - IMAP daemon', size: 1012, files: ['/usr/lib/dovecot/imap', '/usr/lib/dovecot/imap-login'], depends: 'dovecot-core (= 1:2.4.1+dfsg1-6+deb13u7)', homepage: 'https://www.dovecot.org/' },
  'dovecot-lmtpd': { version: '1:2.4.1+dfsg1-6+deb13u7', architecture: 'amd64', section: 'mail', priority: 'optional', description: 'secure POP3/IMAP server - LMTP server', size: 214, files: ['/usr/lib/dovecot/lmtp', '/etc/dovecot/conf.d/20-lmtp.conf'], depends: 'dovecot-core (= 1:2.4.1+dfsg1-6+deb13u7)', homepage: 'https://www.dovecot.org/' },
  'dovecot-sieve': { version: '1:2.4.1+dfsg1-6+deb13u7', architecture: 'amd64', section: 'mail', priority: 'optional', description: 'secure POP3/IMAP server - Sieve filters support', size: 2620, files: [...bin('sievec', 'sieve-test', 'sieve-dump', 'sieve-filter'), '/etc/dovecot/conf.d/90-sieve.conf'], depends: 'dovecot-core (= 1:2.4.1+dfsg1-6+deb13u7)', homepage: 'https://pigeonhole.dovecot.org/' },
  'dovecot-managesieved': { version: '1:2.4.1+dfsg1-6+deb13u7', architecture: 'amd64', section: 'mail', priority: 'optional', description: 'secure POP3/IMAP server - ManageSieve server', size: 196, files: ['/usr/lib/dovecot/managesieve', '/usr/lib/dovecot/managesieve-login'], depends: 'dovecot-sieve (= 1:2.4.1+dfsg1-6+deb13u7)', homepage: 'https://pigeonhole.dovecot.org/' },
  awscli: { version: '2.23.6-1', architecture: 'all', section: 'admin', priority: 'optional', description: 'Universal Command Line Environment for AWS', size: 102_940, files: bin('aws', 'aws_completer'), depends: 'python3, python3-botocore, python3-awscrt', homepage: 'https://aws.amazon.com/cli/' },
  // OpenTofu's own Debian package (packages.opentofu.org), not in Debian's archive.
  tofu: { version: '1.13.10', architecture: 'amd64', section: 'default', priority: 'optional', description: 'The open source infrastructure as code tool.', size: 92_000, files: bin('tofu'), homepage: 'https://opentofu.org' },
  // OpenBao's own Debian package (its GitHub releases), not in Debian's archive.
  openbao: { version: '2.7.3', architecture: 'amd64', section: 'default', priority: 'optional', description: 'OpenBao exists to provide a software solution to manage, store, and distribute sensitive data including secrets, certificates, and keys.', size: 176_000, files: [...bin('bao'), '/etc/openbao/openbao.hcl', '/etc/openbao/openbao.env', '/usr/lib/systemd/system/openbao.service'], depends: 'openssl', homepage: 'https://openbao.org' },
  rclone: { version: '1.60.1+dfsg-4', architecture: 'amd64', section: 'net', priority: 'optional', description: 'rsync for commercial cloud storage', size: 61_220, files: bin('rclone'), depends: 'libc6', homepage: 'https://rclone.org' },
  rspamd: { version: '3.12.1-1', architecture: 'amd64', section: 'mail', priority: 'optional', description: 'Rapid spam filtering system', size: 30_480, files: [...bin('rspamd', 'rspamc', 'rspamadm'), '/etc/rspamd/rspamd.conf'], depends: 'libc6, liblua5.1-0, libhyperscan5, libsodium23', homepage: 'https://rspamd.com' },
  'redis-server': { version: '5:8.0.2-3', architecture: 'amd64', section: 'database', priority: 'optional', description: 'Persistent key-value database with network interface', size: 220, files: [...bin('redis-server'), '/etc/redis/redis.conf'], depends: 'redis-tools (= 5:8.0.2-3)', homepage: 'https://redis.io/' },
  zip: { version: '3.0-15', architecture: 'amd64', section: 'utils', priority: 'optional', description: 'Archiver for .zip files', size: 610, files: bin('zip', 'zipcloak', 'zipnote', 'zipsplit'), homepage: 'https://infozip.sourceforge.net/Zip.html' },
  unzip: { version: '6.0-29', architecture: 'amd64', section: 'utils', priority: 'optional', description: 'De-archiver for .zip files', size: 389, files: bin('unzip', 'funzip', 'unzipsfx', 'zipinfo'), homepage: 'https://infozip.sourceforge.net/UnZip.html' },
  dos2unix: { version: '7.5.2-1', architecture: 'amd64', section: 'text', priority: 'optional', description: 'convert text file line endings between CRLF and LF', size: 1946, files: bin('dos2unix', 'unix2dos', 'mac2unix'), homepage: 'https://waterlan.home.xs4all.nl/dos2unix.html' },
  'printer-driver-hpcups': { version: '3.25.2+dfsg0-1', architecture: 'amd64', section: 'text', priority: 'optional', description: 'HP Linux Printing and Imaging - CUPS Raster driver (hpcups)', size: 2154, files: ['/usr/lib/cups/filter/hpcups', '/usr/share/cups/drv/hpcups.drv'], homepage: 'https://developers.hp.com/hp-linux-imaging-and-printing' },
};

/** A package the game knows (installed or not): base, archive. */
export const known = (name: string): BasePackage | undefined => BASE[name] ?? ARCHIVE[name];
