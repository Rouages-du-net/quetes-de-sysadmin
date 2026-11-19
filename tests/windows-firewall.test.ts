// The Windows engine, step 2: Windows Defender Firewall. The decision (a
// block rule wins, inbound blocked by default, a profile turned off lets
// everything in, remote addresses as subnets, ranges, LocalSubnet), the
// NetSecurity cmdlets and netsh on LEDGER, and the network paths of the
// HARBOUR domain (ssh, smbclient, Test-NetConnection, ping) that go
// through the target's firewall, including rules a GPO brings.

import { describe, expect, it } from 'vitest';
import type { Shell } from '../src/engine/shell';
import { ledger } from './windows-fixture';
import { harbour, BRIDGE_ADDRESS } from './ad-fixture';
import { firewall, firewallAllows, addressMatches, portMatches } from '../src/engine/windows-firewall';
import { windowsLogin } from '../src/engine/windows-accounts';

const run = (s: Shell, ...lines: string[]) => lines.map((l) => s.execute(l) ?? '').filter(Boolean).join('\n');

describe('Windows Defender Firewall: the decision', () => {
  it('default rules: ssh and SMB in, Remote Desktop and ping not; outbound allowed', () => {
    const s = ledger();
    const inbound = (port: number | null, remote = '198.51.100.20') => firewallAllows(s, port === null ? { protocol: 'ICMPv4', port: null, remote } : { protocol: 'TCP', port, remote });
    expect(inbound(22)).toBe(true);
    expect(inbound(445)).toBe(true);
    expect(inbound(3389)).toBe(false);
    expect(inbound(null)).toBe(false);
    expect(inbound(8080)).toBe(false);
    expect(firewallAllows(s, { protocol: 'TCP', port: 443, remote: '203.0.113.9', direction: 'Outbound' })).toBe(true);
    // WinRM on a Private network: from anywhere; its Public rule only from the local subnet.
    expect(inbound(5985)).toBe(true);
    firewall(s).category = 'Public';
    expect(inbound(5985, '192.0.2.200')).toBe(true);
    expect(inbound(5985, '198.51.100.20')).toBe(false);
  });

  it('a block rule wins over an allow rule; a profile turned off lets everything in', () => {
    const s = ledger();
    firewall(s).rules.push({ name: 'block-ssh', display: 'Block ssh from the guest network', enabled: true, direction: 'Inbound', action: 'Block', profiles: ['Domain', 'Private', 'Public'], protocol: 'TCP', localPort: ['22'], remotePort: ['Any'], remoteAddress: ['198.51.100.0/24'] });
    expect(firewallAllows(s, { protocol: 'TCP', port: 22, remote: '198.51.100.7' })).toBe(false);
    expect(firewallAllows(s, { protocol: 'TCP', port: 22, remote: '192.0.2.7' })).toBe(true);
    firewall(s).profiles.Private.enabled = false;
    expect(firewallAllows(s, { protocol: 'TCP', port: 3389, remote: '198.51.100.7' })).toBe(true);
  });

  it('addresses and ports as Windows writes them', () => {
    const s = ledger();
    expect(addressMatches(s, ['192.0.2.0/24'], '192.0.2.99')).toBe(true);
    expect(addressMatches(s, ['192.0.2.0/255.255.255.128'], '192.0.2.200')).toBe(false);
    expect(addressMatches(s, ['192.0.2.10-192.0.2.20'], '192.0.2.15')).toBe(true);
    expect(addressMatches(s, ['LocalSubnet'], '192.0.2.250')).toBe(true);
    expect(addressMatches(s, ['LocalSubnet'], '198.51.100.1')).toBe(false);
    expect(portMatches(['49152-65535'], 50000)).toBe(true);
    expect(portMatches(['80', '443'], 22)).toBe(false);
  });
});

describe('Windows Defender Firewall: the cmdlets', () => {
  it('Get-NetFirewallRule: a rule as a list, its filters, the rule behind a port', () => {
    const s = ledger();
    const rule = run(s, 'Get-NetFirewallRule -DisplayName "OpenSSH SSH Server (sshd)"');
    expect(rule).toMatch(/^Name +: OpenSSH-Server-In-TCP$/m);
    expect(rule).toMatch(/^Enabled +: True$/m);
    expect(rule).toMatch(/^PolicyStoreSource +: PersistentStore$/m);
    expect(run(s, 'Get-NetFirewallRule -DisplayName "OpenSSH SSH Server (sshd)" | Get-NetFirewallPortFilter')).toBe('\nProtocol      : TCP\nLocalPort     : 22\nRemotePort    : Any\nIcmpType      : Any\nDynamicTarget : Any');
    expect(run(s, 'Get-NetFirewallPortFilter | Where-Object LocalPort -eq 3389 | Get-NetFirewallRule | Select-Object -ExpandProperty Name')).toBe('RemoteDesktop-UserMode-In-TCP\nRemoteDesktop-UserMode-In-UDP');
    expect(run(s, 'Get-NetFirewallRule -DisplayName "Windows Remote Management (HTTP-In)" | Get-NetFirewallAddressFilter | Select-Object -ExpandProperty RemoteAddress')).toBe('Any\nLocalSubnet');
    const missing = run(s, 'Get-NetFirewallRule -DisplayName nope');
    expect(missing).toContain("Get-NetFirewallRule : No MSFT_NetFirewallRule objects found with property 'DisplayName' equal to 'nope'.  Verify the value of the property and retry.");
    expect(missing).toContain('CmdletizationQuery_NotFound_DisplayName,Get-NetFirewallRule');
    expect(run(s, 'Get-NetFirewallRule -Enabled False | Measure-Object | Select-Object -ExpandProperty Count')).toBe('3');
  });

  it('New-, Set-, Enable-, Disable-, Remove-NetFirewallRule change what gets in', () => {
    const s = ledger();
    const ping = () => firewallAllows(s, { protocol: 'ICMPv4', port: null, remote: '192.0.2.5' });
    run(s, 'Enable-NetFirewallRule -DisplayName "File and Printer Sharing (Echo Request - ICMPv4-In)"');
    expect(ping()).toBe(true);
    run(s, 'Disable-NetFirewallRule -Name FPS-ICMP4-ERQ-In');
    expect(ping()).toBe(false);
    run(s, 'New-NetFirewallRule -DisplayName "Backup agent" -Direction Inbound -Protocol TCP -LocalPort 9102 -RemoteAddress 192.0.2.10 -Action Allow');
    expect(firewallAllows(s, { protocol: 'TCP', port: 9102, remote: '192.0.2.10' })).toBe(true);
    expect(firewallAllows(s, { protocol: 'TCP', port: 9102, remote: '192.0.2.11' })).toBe(false);
    run(s, 'Set-NetFirewallRule -DisplayName "Backup agent" -RemoteAddress 192.0.2.0/24');
    expect(firewallAllows(s, { protocol: 'TCP', port: 9102, remote: '192.0.2.11' })).toBe(true);
    expect(run(s, 'Remove-NetFirewallRule -DisplayName "Backup agent" -WhatIf')).toBe('What if: Performing the operation "Delete" on target "Backup agent".');
    run(s, 'Remove-NetFirewallRule -DisplayName "Backup agent"');
    expect(firewallAllows(s, { protocol: 'TCP', port: 9102, remote: '192.0.2.11' })).toBe(false);
    // Ports need TCP or UDP; Set- needs to know which rules.
    expect(run(s, 'New-NetFirewallRule -DisplayName x -LocalPort 22')).toContain('ports can only be specified for the TCP and UDP protocols');
    expect(run(s, 'Set-NetFirewallRule -Enabled False')).toContain('Parameter set cannot be resolved using the specified named parameters.');
    expect(run(s, 'New-NetFirewallRule -DisplayName y -Protocol TCP -LocalPort 80 -RemoteAddress "the office"')).toContain('The address is invalid.');
  });

  it('profiles: Get-/Set-NetFirewallProfile, the adapter\'s category', () => {
    const s = ledger();
    expect(run(s, 'Get-NetFirewallProfile | Select-Object Name, Enabled')).toMatch(/Domain +True\nPrivate +True\nPublic +True/);
    expect(run(s, 'Get-NetConnectionProfile | Select-Object -ExpandProperty NetworkCategory')).toBe('Private');
    run(s, 'Set-NetFirewallProfile -Profile Private -Enabled False');
    expect(firewall(s).profiles.Private.enabled).toBe(false);
    expect(run(s, 'Get-NetFirewallProfile -Name Private | Select-Object -ExpandProperty Enabled')).toBe('False');
    run(s, 'Set-NetConnectionProfile -InterfaceAlias Ethernet -NetworkCategory Public');
    expect(firewall(s).category).toBe('Public');
  });

  it('netsh advfirewall: show, add, set, delete rule; profiles\' state', () => {
    const s = ledger();
    const show = run(s, 'netsh advfirewall firewall show rule name="OpenSSH SSH Server (sshd)"');
    expect(show).toContain('Rule Name:                            OpenSSH SSH Server (sshd)');
    expect(show).toContain('LocalPort:                            22');
    expect(show.trimEnd().endsWith('Ok.')).toBe(true);
    expect(run(s, 'netsh advfirewall firewall show rule name=nothing')).toContain('No rules match the specified criteria.');
    expect(run(s, 'netsh advfirewall firewall add rule name="Agent" dir=in action=allow protocol=TCP localport=9102')).toContain('Ok.');
    expect(firewallAllows(s, { protocol: 'TCP', port: 9102, remote: '192.0.2.10' })).toBe(true);
    expect(run(s, 'netsh advfirewall firewall set rule name="Agent" new enable=no')).toContain('Updated 1 rule(s).');
    expect(run(s, 'netsh advfirewall firewall delete rule name="Agent"')).toContain('Deleted 1 rule(s).');
    expect(run(s, 'netsh advfirewall show allprofiles state')).toContain('Private Profile Settings: \n----------------------------------------------------------------------\nState                                 ON');
    run(s, 'netsh advfirewall set allprofiles state off');
    expect(firewall(s).profiles.Public.enabled).toBe(false);
  });
});

describe('Windows Defender Firewall on the network of a domain', () => {
  it('ssh to a member server: allowed by its OpenSSH rule, timed out once disabled', () => {
    const { bridge, host } = harbour();
    const files = host('files');
    expect(run(bridge, "ssh 'HARBOUR\\alice'@files", 'yes')).toContain("Warning: Permanently added 'files' (ED25519) to the list of known hosts.");
    // The password: accepted by the domain controller (ssh then opens the session).
    expect(run(bridge, 'Alice-2029-pw')).toBe('');
    expect(bridge.sessionRequest?.shell).toBe(files);
    run(files, 'Disable-NetFirewallRule -Name OpenSSH-Server-In-TCP');
    expect(run(bridge, 'ssh you@files')).toBe('ssh: connect to host files port 22: Connection timed out');
  });

  it('SMB to the member: a block rule for the admin box makes smbclient time out', () => {
    const { bridge, host } = harbour();
    const files = host('files');
    run(files, `New-NetFirewallRule -DisplayName "No SMB from bridge" -Protocol TCP -LocalPort 445 -RemoteAddress ${BRIDGE_ADDRESS} -Action Block`);
    expect(run(bridge, "smbclient //files/Docs -U 'HARBOUR\\alice%Alice-2029-pw' -c ls")).toBe('do_connect: Connection to files failed (Error NT_STATUS_IO_TIMEOUT)');
    run(files, 'Remove-NetFirewallRule -DisplayName "No SMB from bridge"');
    expect(run(bridge, "smbclient //files/Docs -U 'HARBOUR\\alice%Alice-2029-pw' -c ls")).toContain('tides.txt');
  });

  it('Test-NetConnection and ping from the member to the domain controller', () => {
    const { host } = harbour();
    const files = host('files');
    const dc = host('dc01');
    expect(run(files, 'Test-NetConnection dc01 -Port 389')).toMatch(/TcpTestSucceeded : True/);
    expect(run(files, 'Test-NetConnection dc01 -Port 3389')).toContain('WARNING: TCP connect to (192.0.2.70 : 3389) failed');
    // Echo requests are off on a fresh Windows Server.
    expect(run(files, 'ping dc01')).toContain('Request timed out.');
    run(dc, 'Enable-NetFirewallRule -Name FPS-ICMP4-ERQ-In');
    expect(run(files, 'ping dc01')).toContain('Reply from 192.0.2.70');
    // The domain controller's own rules: LDAP, Kerberos, DNS.
    expect(run(dc, 'Get-NetFirewallRule -DisplayGroup "Active Directory Domain Services" | Measure-Object | Select-Object -ExpandProperty Count')).toBe('4');
    expect(run(dc, 'Get-NetConnectionProfile | Select-Object -ExpandProperty NetworkCategory')).toBe('DomainAuthenticated');
  });

  it("a GPO's rules: applied at logon (PolicyStoreSource GroupPolicy), New-NetFirewallRule -PolicyStore, gpupdate", () => {
    const { host } = harbour();
    const files = host('files');
    const dc = host('dc01');
    windowsLogin(files);
    expect(run(files, 'Get-NetFirewallRule -PolicyStore ActiveStore -DisplayName "Allow SMB*" | Select-Object -ExpandProperty PolicyStoreSourceType')).toBe('GroupPolicy');
    expect(run(files, 'Get-NetFirewallRule -PolicyStore PersistentStore -DisplayName "Allow SMB*" -ErrorAction SilentlyContinue')).toBe('');
    expect(firewallAllows(files, { protocol: 'ICMPv4', port: null, remote: '192.0.2.69' })).toBe(true);
    windowsLogin(dc);
    run(dc, 'New-NetFirewallRule -DisplayName "Allow WinRM from bridge" -Protocol TCP -LocalPort 5986 -RemoteAddress 192.0.2.69 -PolicyStore "harbour.internal\\Server Firewall"');
    expect(firewallAllows(files, { protocol: 'TCP', port: 5986, remote: '192.0.2.69' })).toBe(false);
    expect(run(files, 'gpupdate /force')).toBe('Updating policy...\n\nComputer Policy update has completed successfully.\n\nUser Policy update has completed successfully.');
    expect(firewallAllows(files, { protocol: 'TCP', port: 5986, remote: '192.0.2.69' })).toBe(true);
    expect(run(dc, 'New-NetFirewallRule -DisplayName z -Protocol TCP -LocalPort 1 -PolicyStore "harbour.internal\\Nope"')).toContain('The system cannot find the file specified.');
  });
});
