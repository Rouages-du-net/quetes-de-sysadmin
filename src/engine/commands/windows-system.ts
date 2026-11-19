// A Windows machine's volumes, drives, SMB shares and network, from
// PowerShell and cmd: Get-Volume, Get-PSDrive, Get-SmbShare,
// Get-SmbShareAccess, Grant-SmbShareAccess, Revoke-SmbShareAccess,
// New-SmbShare, Remove-SmbShare (a high-impact change: it asks unless
// -Force), Get-ComputerInfo, Get-NetIPAddress, Test-NetConnection;
// hostname, ipconfig, ping, and the shells themselves (cmd, powershell).
// Sources (Microsoft Learn): Get-Volume (Storage), Get-PSDrive, SmbShare
// module (https://learn.microsoft.com/powershell/module/smbshare/grant-smbshareaccess),
// Get-ComputerInfo, Get-NetIPAddress (NetTCPIP), Test-NetConnection
// (NetConnection), ipconfig, ping
// (https://learn.microsoft.com/windows-server/administration/windows-commands/ipconfig).
// Differences (docs/SCENARIOS.md): one network adapter, ping answers for
// the addresses the machine knows (its hosts file, itself, its gateway).

import type { Shell } from '../shell';
import { volumeUsed, windows, type ShareAce, type ShareRight, type WinShare } from '../windows';
import { canonical, principal, shareAces } from '../windows-acl';
import { isWindows } from '../windows';
import { machineAt, reaches, windowsResolve } from '../windows-firewall';
import { SSH } from './ssh';
import { PSDate, arr, str, wildcard, storageSize, type Cmdlet, type Native, type PSObject, type Run, type View } from '../powershell';

const GB = 1024 ** 3;

function getPSDrive(r: Run): unknown[] {
  const { game, p } = r;
  const w = windows(game);
  const here = game.cwd.split('/').filter(Boolean);
  const fs = w.volumes.map((v): PSObject => {
    const used = volumeUsed(game, v.letter);
    return { type: 'PSDriveInfo', props: { Name: v.letter, Used: used, Free: v.size - used, Provider: 'FileSystem', Root: `${v.letter}:\\`, CurrentLocation: here[0] === v.letter && !w.location ? here.slice(1).join('\\') : '' } };
  });
  const other = (name: string, provider: string, root = ''): PSObject => ({ type: 'PSDriveInfo', props: { Name: name, Used: null, Free: null, Provider: provider, Root: root, CurrentLocation: w.location?.startsWith(`${name}:`) ? w.location.slice(name.length + 2) : '' } });
  let all = [other('Alias', 'Alias'), ...fs, other('Cert', 'Certificate', '\\'), other('Env', 'Environment'), other('Function', 'Function'), other('HKCU', 'Registry', 'HKEY_CURRENT_USER'), other('HKLM', 'Registry', 'HKEY_LOCAL_MACHINE'), other('Variable', 'Variable'), other('WSMan', 'WSMan')].sort((a, b) => String(a.props.Name).localeCompare(String(b.props.Name)));
  if (p.PSProvider !== undefined) all = all.filter((d) => arr(p.PSProvider).some((x) => wildcard(x).test(String(d.props.Provider))));
  const names = arr(p.Name);
  if (!names.length) return all;
  const out: unknown[] = [];
  for (const n of names) {
    const found = all.filter((d) => wildcard(n.replace(/:$/, '')).test(String(d.props.Name)));
    if (!found.length) r.fail({ message: `Cannot find drive. A drive with the name '${n}' does not exist.`, category: 'ObjectNotFound', target: `${n}:String`, exception: 'DriveNotFoundException', id: 'GetLocationNoMatchingDrive,Microsoft.PowerShell.Commands.GetPSDriveCommand' });
    out.push(...found);
  }
  return out;
}

function getVolume(r: Run): unknown[] {
  const { game, p } = r;
  const all = [...windows(game).volumes].reverse().map((v): PSObject => ({
    type: 'MSFT_Volume',
    props: { DriveLetter: v.letter, FriendlyName: v.label, FileSystemType: 'NTFS', DriveType: 'Fixed', HealthStatus: 'Healthy', OperationalStatus: 'OK', SizeRemaining: v.size - volumeUsed(game, v.letter), Size: v.size },
  }));
  const letters = arr(p.DriveLetter);
  if (!letters.length) return all;
  const out: unknown[] = [];
  for (const l of letters) {
    const found = all.filter((v) => String(v.props.DriveLetter).toLowerCase() === l.replace(/:$/, '').toLowerCase());
    if (!found.length) r.fail({ message: `No MSFT_Volume objects found with property 'DriveLetter' equal to '${l}'.  Verify the value of the property and retry.`, category: 'ObjectNotFound', target: `${l}:Char`, exception: 'CimJobException', id: 'CmdletizationQuery_NotFound_DriveLetter,Get-Volume' });
    out.push(...found);
  }
  return out;
}

// ——— SMB shares ———

const shareObject = (s: WinShare): PSObject => ({ type: 'MSFT_SmbShare', data: s, props: { Name: s.name, ScopeName: '*', Path: s.path, Description: s.description, ShareState: 'Online', FolderEnumerationMode: 'Unrestricted', CurrentUsers: 0 } });

function shares(r: Run, cmdlet: string, param = 'Name'): WinShare[] {
  const all = windows(r.game).shares;
  const names = [...arr(r.p[param]), ...(r.input ?? []).map((x) => (typeof x === 'object' && x && 'data' in x ? (x as PSObject & { data: WinShare }).data.name : String(x)))];
  if (!names.length) return all;
  const out: WinShare[] = [];
  for (const n of names) {
    const found = all.filter((s) => wildcard(n).test(s.name));
    if (!found.length) r.fail({ message: `No MSFT_SMBShare objects found with property 'Name' equal to '${n}'.  Verify the value of the property and retry.`, category: 'ObjectNotFound', target: `${n}:String`, exception: 'CimJobException', id: `CmdletizationQuery_NotFound_Name,${cmdlet}` });
    out.push(...found);
  }
  return out;
}

const accessObjects = (game: Shell, s: WinShare): PSObject[] =>
  shareAces(s).map((a) => ({ type: 'MSFT_SmbShareAccessControlEntry', props: { Name: s.name, ScopeName: '*', AccountName: canonical(game, a.account), AccessControlType: a.deny ? 'Deny' : 'Allow', AccessRight: a.right } }));

/** A share's own permission list (made from story 30's short form the first time it changes). */
const ownAccess = (s: WinShare): ShareAce[] => (s.access ??= shareAces(s).map((a) => ({ ...a })));

function grantRevoke(r: Run, op: 'grant' | 'revoke' | 'block' | 'unblock'): unknown[] {
  const cmdlet = { grant: 'Grant-SmbShareAccess', revoke: 'Revoke-SmbShareAccess', block: 'Block-SmbShareAccess', unblock: 'Unblock-SmbShareAccess' }[op];
  const right = str(r.p.AccessRight) || 'Read';
  const rights: ShareRight[] = ['Full', 'Change', 'Read'];
  const out: unknown[] = [];
  if (op === 'grant' && !rights.some((x) => x.toLowerCase() === right.toLowerCase())) {
    r.fail({ message: `Cannot process argument transformation on parameter 'AccessRight'. Cannot convert value "${right}" to type "Microsoft.PowerShell.Cmdletization.GeneratedTypes.SmbShare.ShareAccessRight". Error: "Unable to match the identifier name ${right} to a valid enumerator name. Specify one of the following enumerator names and try again:\nFull, Change, Read, Custom"`, category: 'InvalidData', target: ':', exception: 'ParameterBindingArgumentTransformationException', id: `ParameterArgumentTransformationError,${cmdlet}` });
    return [];
  }
  for (const s of shares(r, cmdlet)) {
    const accounts = arr(r.p.AccountName);
    const resolved = accounts.map((a) => ({ typed: a, p: principal(r.game, a) }));
    const bad = resolved.find((x) => !x.p);
    if (bad) {
      r.fail({ message: 'No mapping between account names and security IDs was done.', category: 'NotSpecified', target: `MSFT_SmbShare (Name = "${s.name}", ScopeName = "*"):ROOT/Microsoft/Windows/SMB/MSFT_SmbShare`, exception: 'CimException', id: `Windows System Error 1332,${cmdlet}` });
      continue;
    }
    if (!r.should('Modify', `*,${s.name}`, true)) continue;
    const list = ownAccess(s);
    for (const { p } of resolved) {
      const id = p!.name;
      if (op === 'grant') {
        const exact = rights.find((x) => x.toLowerCase() === right.toLowerCase())!;
        s.access = list.filter((a) => !(canonical(r.game, a.account) === id && !a.deny));
        s.access.push({ account: id, right: exact });
      } else if (op === 'revoke') s.access = list.filter((a) => !(canonical(r.game, a.account) === id && !a.deny));
      else if (op === 'block') s.access = [...list.filter((a) => !(canonical(r.game, a.account) === id && a.deny)), { account: id, right: 'Full', deny: true }];
      else s.access = list.filter((a) => !(canonical(r.game, a.account) === id && a.deny));
    }
    out.push(...accessObjects(r.game, s));
  }
  return out;
}

function newSmbShare(r: Run): unknown[] {
  const name = str(r.p.Name);
  const w = windows(r.game);
  if (w.shares.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
    r.fail({ message: 'The name has already been shared.', category: 'NotSpecified', target: 'MSFT_SMBShare:ROOT/Microsoft/Windows/SMB/MSFT_SMBShare', exception: 'CimException', id: 'Windows System Error 2118,New-SmbShare' });
    return [];
  }
  const path = str(r.p.Path).replace(/\//g, '\\');
  const internal = '/' + path.replace(/:\\?/, '\\').split('\\').filter(Boolean).join('/');
  if (r.game.find(internal)?.type !== 'directory') {
    r.fail({ message: 'The system cannot find the file specified.', category: 'ObjectNotFound', target: 'MSFT_SMBShare:ROOT/Microsoft/Windows/SMB/MSFT_SMBShare', exception: 'CimException', id: 'Windows System Error 2,New-SmbShare' });
    return [];
  }
  if (!r.should('Create', `*,${name}`)) return [];
  const access: ShareAce[] = [];
  for (const [param, right] of [['FullAccess', 'Full'], ['ChangeAccess', 'Change'], ['ReadAccess', 'Read']] as const) for (const a of arr(r.p[param])) access.push({ account: canonical(r.game, a), right });
  for (const a of arr(r.p.NoAccess)) access.push({ account: canonical(r.game, a), right: 'Full', deny: true });
  const real = r.game.find(internal) ? path.replace(/^([a-z]):/, (m) => m.toUpperCase()) : path;
  const s: WinShare = { name, path: real, description: str(r.p.Description), change: [], access: access.length ? access : [{ account: 'Everyone', right: 'Read' }] };
  w.shares.push(s);
  return [shareObject(s)];
}

function removeSmbShare(r: Run): unknown[] {
  for (const s of shares(r, 'Remove-SmbShare')) {
    if (s.special) continue;
    if (!r.should('Remove-Share', `*,${s.name}`, true)) continue;
    const w = windows(r.game);
    w.shares = w.shares.filter((x) => x !== s);
  }
  return [];
}

// ——— The computer and its network ———

const net = (game: Shell) => windows(game).network ?? { address: '192.0.2.50', mask: '255.255.255.0', gateway: '192.0.2.1', suffix: 'internal' };
const prefix = (mask: string) => mask.split('.').reduce((n, o) => n + (Number(o).toString(2).match(/1/g)?.length ?? 0), 0);

function getComputerInfo(r: Run): unknown[] {
  const w = windows(r.game);
  const props: Record<string, unknown> = {
    WindowsBuildLabEx: '20348.1.amd64fre.fe_release.210507-1500',
    WindowsCurrentVersion: '6.3',
    WindowsEditionId: 'ServerStandard',
    WindowsInstallationType: 'Server',
    WindowsProductName: 'Windows Server 2022 Standard',
    WindowsVersion: '2009',
    CsName: w.computer,
    CsDomain: w.domain?.dns ?? 'WORKGROUP',
    CsPartOfDomain: !!w.domain,
    OsName: 'Microsoft Windows Server 2022 Standard',
    OsVersion: '10.0.20348',
    OsBuildNumber: '20348',
    OsLastBootUpTime: new PSDate(w.boot ?? w.clock - 6 * 86_400_000),
    OsLocalDateTime: new PSDate(w.clock),
    TimeZone: '(UTC) Coordinated Universal Time',
  };
  const names = arr(r.p.Property);
  const picked = names.length ? Object.fromEntries(Object.entries(props).filter(([k]) => names.some((n) => wildcard(n).test(k)))) : props;
  return [{ type: 'ComputerInfo', props: picked }];
}

function getNetIPAddress(r: Run): unknown[] {
  const n = net(r.game);
  const all: PSObject[] = [
    { type: 'NetIPAddress', props: { IPAddress: n.address, InterfaceIndex: 4, InterfaceAlias: 'Ethernet', AddressFamily: 'IPv4', Type: 'Unicast', PrefixLength: prefix(n.mask), PrefixOrigin: 'Manual', SuffixOrigin: 'Manual', AddressState: 'Preferred' } },
    { type: 'NetIPAddress', props: { IPAddress: '127.0.0.1', InterfaceIndex: 1, InterfaceAlias: 'Loopback Pseudo-Interface 1', AddressFamily: 'IPv4', Type: 'Unicast', PrefixLength: 8, PrefixOrigin: 'WellKnown', SuffixOrigin: 'WellKnown', AddressState: 'Preferred' } },
  ];
  const family = str(r.p.AddressFamily);
  return all.filter((a) => !family || String(a.props.AddressFamily).toLowerCase() === family.toLowerCase());
}

const resolveHost = windowsResolve;

// The ports a Windows machine listens on, by the service that opens them.
const LISTENERS: Record<number, string> = { 22: 'sshd', 445: 'LanmanServer', 139: 'LanmanServer', 5985: 'WinRM', 3389: 'TermService', 88: 'Kdc', 389: 'NTDS', 636: 'NTDS', 3268: 'NTDS', 53: 'DNS' };

/** Does a machine of the story listen on this TCP port (its service running)? */
function listens(server: Shell, port: number): boolean {
  const name = LISTENERS[port];
  if (!name || !isWindows(server)) return false;
  if (['Kdc', 'NTDS', 'DNS'].includes(name)) return !!server.state.ad;
  return windows(server).services.some((s) => s.name.toLowerCase() === name.toLowerCase() && s.status === 'Running');
}

/** Does an address answer a ping (or a TCP port)? Itself, its gateway, its hosts file; another Windows machine of the story through its firewall. */
function answers(game: Shell, address: string, port: number | null = null): boolean {
  const n = net(game);
  const peer = address === n.address ? null : machineAt(game, address);
  if (peer && isWindows(peer)) return reaches(game, peer, port) && (port === null || listens(peer, port));
  if (peer) return true;
  if ([n.address, n.gateway, '127.0.0.1'].includes(address)) return true;
  return (game.read('/C/Windows/System32/drivers/etc/hosts') ?? '').split('\n').some((l) => l.replace(/#.*/, '').trim().split(/\s+/)[0] === address);
}

function testNetConnection(r: Run): unknown[] {
  const host = str(r.p.ComputerName) || 'internetbeacon.msedge.net';
  const address = resolveHost(r.game, host);
  const port = r.p.Port !== undefined ? Number(r.p.Port) : null;
  if (!address) {
    r.host(`WARNING: Name resolution of ${host} failed`);
    return [{ type: 'TestNetConnectionResult', props: { ComputerName: host, RemoteAddress: '', InterfaceAlias: 'Ethernet', SourceAddress: net(r.game).address, PingSucceeded: false } }];
  }
  const ok = answers(r.game, address, port);
  if (port !== null) {
    if (!ok) r.host(`WARNING: TCP connect to (${address} : ${port}) failed`);
    return [{ type: 'TestNetConnectionResult', props: { ComputerName: host, RemoteAddress: address, RemotePort: port, InterfaceAlias: 'Ethernet', SourceAddress: net(r.game).address, TcpTestSucceeded: ok } }];
  }
  return [{ type: 'TestNetConnectionResult', props: { ComputerName: host, RemoteAddress: address, InterfaceAlias: 'Ethernet', SourceAddress: net(r.game).address, PingSucceeded: ok, PingReplyDetails: ok ? '(RTT) : 0 ms' : '' } }];
}

const SMB = 'SmbShare';
const ACCOUNTS = { name: 'AccountName', list: true };

export const SYSTEM_CMDLETS: Cmdlet[] = [
  { name: 'Get-PSDrive', module: 'Microsoft.PowerShell.Management', version: '3.1.0.0', positional: ['Name'], params: [{ name: 'Name', list: true }, { name: 'PSProvider', list: true }], run: getPSDrive },
  { name: 'Get-Volume', module: 'Storage', version: '2.0.0.0', kind: 'Function', positional: ['DriveLetter'], params: [{ name: 'DriveLetter', list: true, type: 'System.Char[]' }], run: getVolume },
  { name: 'Get-SmbShare', module: SMB, version: '2.0.0.0', kind: 'Function', positional: ['Name'], params: [{ name: 'Name', list: true }, { name: 'Special', switch: true }], run: (r) => shares(r, 'Get-SmbShare').filter((s) => !r.p.Special || s.special).map(shareObject) },
  { name: 'Get-SmbShareAccess', module: SMB, version: '2.0.0.0', kind: 'Function', positional: ['Name'], params: [{ name: 'Name', list: true }], run: (r) => shares(r, 'Get-SmbShareAccess').flatMap((s) => accessObjects(r.game, s)) },
  { name: 'Grant-SmbShareAccess', module: SMB, version: '2.0.0.0', kind: 'Function', writes: true, positional: ['Name'], params: [{ name: 'Name', list: true }, ACCOUNTS, { name: 'AccessRight', type: 'System.String' }, { name: 'Force', switch: true }], run: (r) => grantRevoke(r, 'grant') },
  { name: 'Revoke-SmbShareAccess', module: SMB, version: '2.0.0.0', kind: 'Function', writes: true, positional: ['Name'], params: [{ name: 'Name', list: true }, ACCOUNTS, { name: 'Force', switch: true }], run: (r) => grantRevoke(r, 'revoke') },
  { name: 'Block-SmbShareAccess', module: SMB, version: '2.0.0.0', kind: 'Function', writes: true, positional: ['Name'], params: [{ name: 'Name', list: true }, ACCOUNTS, { name: 'Force', switch: true }], run: (r) => grantRevoke(r, 'block') },
  { name: 'Unblock-SmbShareAccess', module: SMB, version: '2.0.0.0', kind: 'Function', writes: true, positional: ['Name'], params: [{ name: 'Name', list: true }, ACCOUNTS, { name: 'Force', switch: true }], run: (r) => grantRevoke(r, 'unblock') },
  {
    name: 'New-SmbShare', module: SMB, version: '2.0.0.0', kind: 'Function', writes: true, positional: ['Name', 'Path'],
    params: [{ name: 'Name', type: 'System.String' }, { name: 'Path', type: 'System.String' }, { name: 'Description', type: 'System.String' }, { name: 'FullAccess', list: true }, { name: 'ChangeAccess', list: true }, { name: 'ReadAccess', list: true }, { name: 'NoAccess', list: true }],
    run: newSmbShare,
  },
  { name: 'Remove-SmbShare', module: SMB, version: '2.0.0.0', kind: 'Function', writes: true, positional: ['Name'], params: [{ name: 'Name', list: true }, { name: 'Force', switch: true }], run: removeSmbShare },
  { name: 'Get-ComputerInfo', module: 'Microsoft.PowerShell.Management', version: '3.1.0.0', positional: ['Property'], params: [{ name: 'Property', list: true }], run: getComputerInfo },
  { name: 'Get-NetIPAddress', module: 'NetTCPIP', version: '1.0.0.0', kind: 'Function', params: [{ name: 'AddressFamily', type: 'System.String' }, { name: 'InterfaceAlias', list: true }], run: getNetIPAddress },
  { name: 'Test-NetConnection', module: 'NetConnection', version: '1.0.0.0', kind: 'Function', positional: ['ComputerName'], params: [{ name: 'ComputerName', type: 'System.String' }, { name: 'Port', type: 'System.Int32' }, { name: 'InformationLevel', type: 'System.String' }], run: testNetConnection },
];

export const SYSTEM_VIEWS: Record<string, View> = {
  PSDriveInfo: {
    columns: [
      { label: 'Name', value: (o) => o.props.Name },
      { label: 'Used (GB)', value: (o) => (o.props.Used === null ? '' : ((o.props.Used as number) / GB).toFixed(2)), right: true },
      { label: 'Free (GB)', value: (o) => (o.props.Free === null ? '' : ((o.props.Free as number) / GB).toFixed(2)), right: true },
      { label: 'Provider', value: (o) => o.props.Provider },
      { label: 'Root', value: (o) => o.props.Root },
      { label: 'CurrentLocation', value: (o) => o.props.CurrentLocation, right: true },
    ],
  },
  MSFT_Volume: {
    columns: [
      ...['DriveLetter', 'FriendlyName', 'FileSystemType', 'DriveType', 'HealthStatus', 'OperationalStatus'].map((n) => ({ label: n, value: (o: PSObject) => o.props[n] })),
      { label: 'SizeRemaining', value: (o) => storageSize(o.props.SizeRemaining as number), right: true },
      { label: 'Size', value: (o) => storageSize(o.props.Size as number), right: true },
    ],
  },
  MSFT_SmbShare: { columns: ['Name', 'ScopeName', 'Path', 'Description'].map((n) => ({ label: n, value: (o: PSObject) => o.props[n] })) },
  MSFT_SmbShareAccessControlEntry: { columns: ['Name', 'ScopeName', 'AccountName', 'AccessControlType', 'AccessRight'].map((n) => ({ label: n, value: (o: PSObject) => o.props[n] })) },
  ComputerInfo: { columns: [], list: true },
  NetIPAddress: { columns: [], list: true },
  TestNetConnectionResult: { columns: [], list: true },
};

// ——— Natives ———

function ipconfig(game: Shell, args: string[]) {
  const n = net(game);
  const all = args.some((a) => a.toLowerCase() === '/all');
  const lines = ['', 'Windows IP Configuration', ''];
  if (all) lines.push(`   Host Name . . . . . . . . . . . . : ${windows(game).computer}`, '   Primary Dns Suffix  . . . . . . . :', '   Node Type . . . . . . . . . . . . : Hybrid', '   IP Routing Enabled. . . . . . . . : No', '   WINS Proxy Enabled. . . . . . . . : No', '');
  lines.push(
    '',
    'Ethernet adapter Ethernet:',
    '',
    `   Connection-specific DNS Suffix  . : ${n.suffix ?? ''}`.trimEnd(),
    ...(all ? ['   Description . . . . . . . . . . . : Microsoft Hyper-V Network Adapter', `   Physical Address. . . . . . . . . : ${n.mac ?? '00-15-5D-01-2A-07'}`, '   DHCP Enabled. . . . . . . . . . . : No'] : []),
    '   Link-local IPv6 Address . . . . . : fe80::4c1d:2e9a:7b3f:91c2%4',
    `   IPv4 Address. . . . . . . . . . . : ${n.address}${all ? '(Preferred)' : ''}`,
    `   Subnet Mask . . . . . . . . . . . : ${n.mask}`,
    `   Default Gateway . . . . . . . . . : ${n.gateway}`,
    ...(all && n.dns ? [`   DNS Servers . . . . . . . . . . . : ${n.dns}`] : []),
  );
  return { out: lines.join('\n'), code: 0 };
}

function ping(game: Shell, args: string[]) {
  const host = args.find((a) => !a.startsWith('-') && !a.startsWith('/'));
  if (!host) return { out: game.t('ping-windows-usage'), code: 1 };
  const address = resolveHost(game, host);
  if (!address) return { out: `Ping request could not find host ${host}. Please check the name and try again.`, code: 1 };
  const ok = answers(game, address);
  const named = address === host ? address : `${host} [${address}]`;
  const reply = ok ? `Reply from ${address}: bytes=32 time<1ms TTL=${address === net(game).address || address === '127.0.0.1' ? 128 : 64}` : 'Request timed out.';
  return {
    out: ['', `Pinging ${named} with 32 bytes of data:`, reply, reply, reply, reply, '', `Ping statistics for ${address}:`, `    Packets: Sent = 4, Received = ${ok ? 4 : 0}, Lost = ${ok ? 0 : 4} (${ok ? 0 : 100}% loss),`, ...(ok ? ['Approximate round trip times in milli-seconds:', '    Minimum = 0ms, Maximum = 0ms, Average = 0ms'] : [])].join('\n'),
    code: ok ? 0 : 1,
  };
}

function hostname(game: Shell, args: string[]) {
  if (args.length) return { out: '', err: 'sethostname: Use the Network Control Panel Applet to set hostname.\nhostname -s is not supported.', code: 1 };
  return { out: windows(game).computer, code: 0 };
}

export const SYSTEM_NATIVES: Native[] = [
  { name: 'hostname.exe', run: (game, args) => hostname(game, args) },
  { name: 'ipconfig.exe', page: 'ipconfig', run: (game, args) => ipconfig(game, args) },
  { name: 'PING.EXE', run: (game, args) => ping(game, args) },
  // The OpenSSH client Windows Server 2019 and later install by default
  // (C:\Windows\System32\OpenSSH\ssh.exe): the game's ssh, which resolves names
  // with the hosts file and the domain's DNS, and reads keys in the profile's .ssh
  // (https://learn.microsoft.com/windows-server/administration/openssh/openssh_overview).
  {
    name: 'ssh.exe',
    run: (game, args) => {
      game.status = 0;
      const out = SSH.ssh.launch({ args, game, input: null, last: true });
      return { out, code: game.status ?? 0 };
    },
  },
];
