// Windows Defender Firewall from PowerShell and cmd (the model is
// ../windows-firewall.ts): the NetSecurity module's Get-NetFirewallProfile,
// Set-NetFirewallProfile, Get-NetFirewallRule (by -Name, -DisplayName,
// -DisplayGroup, -Group, -Enabled, -Direction, -Action, -PolicyStore; from
// a port or address filter in the pipeline), Get-NetFirewallPortFilter,
// Get-NetFirewallAddressFilter (from rules in the pipeline),
// New-NetFirewallRule (into the local store, or a Group Policy object with
// -PolicyStore "domain\GPO name"), Set-NetFirewallRule, Enable-/Disable-/
// Remove-NetFirewallRule; Get-/Set-NetConnectionProfile (the adapter's
// category); netsh advfirewall (show/add/delete/set rule, show/set
// profiles' state).
// Sources (Microsoft Learn): NetSecurity
// (https://learn.microsoft.com/powershell/module/netsecurity/get-netfirewallrule,
// new-netfirewallrule, set-netfirewallrule, get-netfirewallportfilter,
// get-netfirewallprofile), NetConnection (get-netconnectionprofile),
// "Netsh AdvFirewall Firewall commands"
// (https://learn.microsoft.com/troubleshoot/windows-server/networking/netsh-advfirewall-firewall-control-firewall-behavior).
// Differences (docs/SCENARIOS.md): the exact wording of a few errors, the
// properties shown are the ones the game models.

import type { Shell } from '../shell';
import { guid, windows } from '../windows';
import { firewall, PROFILES, type FwProfileName, type FwRule } from '../windows-firewall';
import { arr, isObject, str, text, wildcard, type Cmdlet, type Failure, type Native, type PSObject, type Run, type View } from '../powershell';

const MODULE = 'NetSecurity';

/** Where a GPO's firewall rules go (set by windows-gpo.ts): an error message, or null when added. */
export const FIREWALL_HOOKS: { gpoRule?: (game: Shell, store: string, rule: FwRule) => string | null } = {};

const profileText = (r: FwRule) => (r.profiles.length === 3 ? 'Any' : r.profiles.join(', '));
const portText = (l: string[]) => (l.length === 1 ? l[0] : l);

/** A rule as Get-NetFirewallRule returns it. */
export function ruleObject(r: FwRule): PSObject {
  return {
    type: 'MSFT_NetFirewallRule',
    fullType: 'Microsoft.Management.Infrastructure.CimInstance#root/standardcimv2/MSFT_NetFirewallRule',
    data: r,
    text: r.name,
    props: {
      Name: r.name,
      DisplayName: r.display,
      Description: r.description ?? '',
      DisplayGroup: r.group ?? '',
      Group: r.group ?? '',
      Enabled: r.enabled ? 'True' : 'False',
      Profile: profileText(r),
      Platform: [],
      Direction: r.direction,
      Action: r.action,
      EdgeTraversalPolicy: 'Block',
      LooseSourceMapping: false,
      LocalOnlyMapping: false,
      Owner: '',
      PrimaryStatus: 'OK',
      Status: 'The rule was parsed successfully from the store. (65536)',
      EnforcementStatus: 'NotApplicable',
      PolicyStoreSource: r.gpo ? `${r.gpo}` : 'PersistentStore',
      PolicyStoreSourceType: r.gpo ? 'GroupPolicy' : 'Local',
      RemoteDynamicKeywordAddresses: '',
    },
  };
}

const portFilter = (r: FwRule): PSObject => ({ type: 'MSFT_NetProtocolPortFilter', data: r, props: { Protocol: r.protocol, LocalPort: portText(r.localPort), RemotePort: portText(r.remotePort), IcmpType: r.icmpType ?? 'Any', DynamicTarget: 'Any' } });
const addressFilter = (r: FwRule): PSObject => ({ type: 'MSFT_NetAddressFilter', data: r, props: { LocalAddress: portText(r.localAddress ?? ['Any']), RemoteAddress: portText(r.remoteAddress) } });

/** The rule an object of the pipeline stands for (a rule, or one of its filters). */
const ruleOf = (x: unknown): FwRule | null => (isObject(x) && x.data && typeof x.data === 'object' && 'direction' in (x.data as object) ? (x.data as FwRule) : null);

/** GpoBoolean and friends: True, False, $true, 1. */
const bool = (v: unknown) => (typeof v === 'boolean' ? v : /^(true|1|yes)$/i.test(text(v)));

const notFound = (cmdlet: string, prop: string, value: string): Failure => ({
  message: `No MSFT_NetFirewallRule objects found with property '${prop}' equal to '${value}'.  Verify the value of the property and retry.`,
  category: 'ObjectNotFound',
  target: `${value}:String`,
  exception: 'CimJobException',
  id: `CmdletizationQuery_NotFound_${prop},${cmdlet}`,
});

/** The rules a cmdlet names: the pipeline's, or -Name / -DisplayName / -DisplayGroup / -Group (wildcards), and the filters. */
function selected(r: Run, cmdlet: string): FwRule[] {
  const fw = firewall(r.game);
  let all = fw.rules;
  if (r.input?.length) {
    const fromPipe = r.input.map(ruleOf).filter((x): x is FwRule => !!x);
    if (fromPipe.length || r.p.Name === undefined) all = [...new Set(fromPipe)];
  }
  for (const [param, prop, get] of [
    ['Name', 'InstanceID', (x: FwRule) => x.name],
    ['DisplayName', 'DisplayName', (x: FwRule) => x.display],
    ['DisplayGroup', 'DisplayGroup', (x: FwRule) => x.group ?? ''],
    ['Group', 'Group', (x: FwRule) => x.group ?? ''],
  ] as const) {
    const wanted = arr(r.p[param]);
    if (!wanted.length) continue;
    const out: FwRule[] = [];
    for (const w of wanted) {
      const found = all.filter((x) => wildcard(w).test(get(x)));
      if (!found.length && !/[*?]/.test(w)) r.fail(notFound(cmdlet, prop, w));
      out.push(...found.filter((x) => !out.includes(x)));
    }
    all = out;
  }
  if (r.p.Enabled !== undefined) all = all.filter((x) => x.enabled === bool(r.p.Enabled));
  if (r.p.Direction !== undefined) all = all.filter((x) => x.direction.toLowerCase() === str(r.p.Direction).toLowerCase());
  if (r.p.Action !== undefined) all = all.filter((x) => x.action.toLowerCase() === str(r.p.Action).toLowerCase());
  const store = str(r.p.PolicyStore).toLowerCase();
  if (store === 'persistentstore') all = all.filter((x) => !x.gpo);
  else if (store && store !== 'activestore') all = all.filter((x) => x.gpo?.toLowerCase() === store.split('\\').at(-1));
  return all;
}

/** Set-, Enable-, Disable-, Remove-NetFirewallRule need rules: from the pipeline or a selector. */
function chosen(r: Run, cmdlet: string): FwRule[] {
  if (!r.input && !['Name', 'DisplayName', 'DisplayGroup', 'Group'].some((k) => r.p[k] !== undefined)) {
    r.fail({ message: 'Parameter set cannot be resolved using the specified named parameters.', category: 'InvalidArgument', target: ':', exception: 'ParameterBindingException', id: `AmbiguousParameterSet,${cmdlet}` });
    return [];
  }
  return selected({ ...r, p: { Name: r.p.Name, DisplayName: r.p.DisplayName, DisplayGroup: r.p.DisplayGroup, Group: r.p.Group } }, cmdlet);
}

/** -Profile Domain,Private / Any → the profiles. */
function profilesOf(v: unknown): FwProfileName[] | null {
  const names = arr(v).flatMap((x) => x.split(',')).map((x) => x.trim()).filter(Boolean);
  if (!names.length || names.some((n) => /^any$/i.test(n))) return [...PROFILES];
  const out = names.map((n) => PROFILES.find((p) => p.toLowerCase() === n.toLowerCase()));
  return out.every(Boolean) ? (out as FwProfileName[]) : null;
}

const PROTOCOLS: Record<string, string> = { tcp: 'TCP', '6': 'TCP', udp: 'UDP', '17': 'UDP', icmpv4: 'ICMPv4', '1': 'ICMPv4', icmpv6: 'ICMPv6', '58': 'ICMPv6', any: 'Any' };

/** The changes -Protocol, -LocalPort, -RemoteAddress… make to a rule; a Failure if one is wrong. */
function applyChanges(r: Run, rule: FwRule, cmdlet: string): Failure | null {
  const bad = (param: string, value: string): Failure => ({ message: `Cannot process argument transformation on parameter '${param}'. Cannot convert value "${value}" to type "Microsoft.PowerShell.Cmdletization.GeneratedTypes.NetSecurity.${param}". Error: "Unable to match the identifier name ${value} to a valid enumerator name."`, category: 'InvalidData', target: ':', exception: 'ParameterBindingArgumentTransformationException', id: `ParameterArgumentTransformationError,${cmdlet}` });
  const p = r.p;
  if (p.Direction !== undefined) {
    const d = ['Inbound', 'Outbound'].find((x) => x.toLowerCase() === str(p.Direction).toLowerCase());
    if (!d) return bad('Direction', str(p.Direction));
    rule.direction = d as FwRule['direction'];
  }
  if (p.Action !== undefined) {
    const a = ['Allow', 'Block'].find((x) => x.toLowerCase() === str(p.Action).toLowerCase());
    if (!a) return bad('Action', str(p.Action));
    rule.action = a as FwRule['action'];
  }
  if (p.Profile !== undefined) {
    const pr = profilesOf(p.Profile);
    if (!pr) return bad('Profile', str(p.Profile));
    rule.profiles = pr;
  }
  if (p.Protocol !== undefined) {
    const pr = PROTOCOLS[str(p.Protocol).toLowerCase()];
    if (!pr) return { message: 'The protocol is not valid.', category: 'InvalidArgument', target: 'MSFT_NetFirewallRule:root/standardcimv2/MSFT_NetFirewallRule', exception: 'CimException', id: `Windows System Error 87,${cmdlet}` };
    rule.protocol = pr;
  }
  for (const [param, key] of [['LocalPort', 'localPort'], ['RemotePort', 'remotePort']] as const) {
    if (p[param] === undefined) continue;
    const ports = arr(p[param]).flatMap((x) => x.split(',')).map((x) => x.trim()).filter(Boolean);
    if (!['TCP', 'UDP'].includes(rule.protocol) && !ports.every((x) => /^any$/i.test(x)))
      return { message: 'The port filter is not valid: ports can only be specified for the TCP and UDP protocols.', category: 'InvalidArgument', target: 'MSFT_NetFirewallRule:root/standardcimv2/MSFT_NetFirewallRule', exception: 'CimException', id: `Windows System Error 87,${cmdlet}` };
    rule[key] = ports;
  }
  for (const [param, key] of [['RemoteAddress', 'remoteAddress'], ['LocalAddress', 'localAddress']] as const) {
    if (p[param] === undefined) continue;
    const list = arr(p[param]).flatMap((x) => x.split(',')).map((x) => x.trim()).filter(Boolean);
    const valid = (x: string) => /^(any|localsubnet|defaultgateway|dns|internet|intranet)$/i.test(x) || /^\d+\.\d+\.\d+\.\d+(?:\/\d+(?:\.\d+\.\d+\.\d+)?|-\d+\.\d+\.\d+\.\d+)?$/.test(x);
    const wrong = list.find((x) => !valid(x));
    if (wrong) return { message: 'The address is invalid. Addresses may be specified as IP addresses, ranges, or subnets. Also, the following address keywords are allowed in certain places: LocalSubnet, DNS, DHCP, WINS, DefaultGateway, Internet, Intranet, IntranetRemoteAccess, PlayToDevice. Keywords can be restricted to IPv4 or IPv6 by appending a 4 or 6.', category: 'InvalidArgument', target: 'MSFT_NetFirewallRule:root/standardcimv2/MSFT_NetFirewallRule', exception: 'CimException', id: `Windows System Error 87,${cmdlet}` };
    rule[key] = list.length ? list : ['Any'];
  }
  if (p.Enabled !== undefined) rule.enabled = bool(p.Enabled);
  if (p.Description !== undefined) rule.description = str(p.Description);
  if (p.Program !== undefined) rule.program = str(p.Program);
  if (p.IcmpType !== undefined) rule.icmpType = str(p.IcmpType);
  return null;
}

function getRule(r: Run): unknown[] {
  // Filters in the pipeline: the rules they belong to.
  return selected(r, 'Get-NetFirewallRule').map(ruleObject);
}

function newRule(r: Run): unknown[] {
  const fw = firewall(r.game);
  const display = str(r.p.DisplayName);
  const name = r.p.Name !== undefined ? str(r.p.Name) : guid(r.game);
  if (fw.rules.some((x) => x.name.toLowerCase() === name.toLowerCase())) {
    r.fail({ message: 'Cannot create a file when that file already exists.', category: 'ResourceExists', target: 'MSFT_NetFirewallRule:root/standardcimv2/MSFT_NetFirewallRule', exception: 'CimException', id: 'Windows System Error 183,New-NetFirewallRule' });
    return [];
  }
  const rule: FwRule = { name, display, group: r.p.Group !== undefined ? str(r.p.Group) : undefined, description: '', enabled: true, direction: 'Inbound', action: 'Allow', profiles: [...PROFILES], protocol: 'Any', localPort: ['Any'], remotePort: ['Any'], remoteAddress: ['Any'] };
  // The protocol first: ports need TCP or UDP.
  const failure = applyChanges(r, rule, 'New-NetFirewallRule');
  if (failure) {
    r.fail(failure);
    return [];
  }
  const store = str(r.p.PolicyStore);
  if (!r.should('New', `${display}`)) return [];
  if (store && !/^(persistentstore|localhost)$/i.test(store)) {
    const error = FIREWALL_HOOKS.gpoRule?.(r.game, store, rule) ?? 'The system cannot find the file specified.';
    if (error) {
      r.fail({ message: error, category: 'ObjectNotFound', target: 'MSFT_NetFirewallRule:root/standardcimv2/MSFT_NetFirewallRule', exception: 'CimException', id: 'Windows System Error 2,New-NetFirewallRule' });
      return [];
    }
    return [ruleObject({ ...rule, gpo: store })];
  }
  fw.rules.push(rule);
  return [ruleObject(rule)];
}

function setRule(r: Run): unknown[] {
  const out: unknown[] = [];
  for (const rule of chosen(r, 'Set-NetFirewallRule')) {
    if (!r.should('Set', rule.display)) continue;
    const copy = { ...rule };
    if (r.p.NewDisplayName !== undefined) copy.display = str(r.p.NewDisplayName);
    const failure = applyChanges(r, copy, 'Set-NetFirewallRule');
    if (failure) {
      r.fail(failure);
      continue;
    }
    Object.assign(rule, copy);
    if (r.p.PassThru) out.push(ruleObject(rule));
  }
  return out;
}

function toggle(r: Run, on: boolean, cmdlet: string): unknown[] {
  const out: unknown[] = [];
  for (const rule of chosen(r, cmdlet)) {
    if (!r.should(on ? 'Enable' : 'Disable', rule.display)) continue;
    rule.enabled = on;
    if (r.p.PassThru) out.push(ruleObject(rule));
  }
  return out;
}

function removeRule(r: Run): unknown[] {
  const fw = firewall(r.game);
  for (const rule of chosen(r, 'Remove-NetFirewallRule')) {
    if (!r.should('Delete', rule.display)) continue;
    fw.rules = fw.rules.filter((x) => x !== rule);
  }
  return [];
}

const profileObject = (name: FwProfileName, game: Shell): PSObject => {
  const p = firewall(game).profiles[name];
  return {
    type: 'MSFT_NetFirewallProfile',
    data: name,
    props: {
      Name: name,
      Enabled: p.enabled ? 'True' : 'False',
      DefaultInboundAction: p.defaultInbound,
      DefaultOutboundAction: p.defaultOutbound,
      AllowInboundRules: 'NotConfigured',
      AllowLocalFirewallRules: 'NotConfigured',
      AllowLocalIPsecRules: 'NotConfigured',
      AllowUserApps: 'NotConfigured',
      AllowUserPorts: 'NotConfigured',
      AllowUnicastResponseToMulticast: 'NotConfigured',
      NotifyOnListen: 'True',
      EnableStealthModeForIPsec: 'NotConfigured',
      LogFileName: '%systemroot%\\system32\\LogFiles\\Firewall\\pfirewall.log',
      LogMaxSizeKilobytes: 4096,
      LogAllowed: p.logAllowed ? 'True' : 'False',
      LogBlocked: p.logBlocked ? 'True' : 'False',
      LogIgnored: 'NotConfigured',
      DisabledInterfaceAliases: ['NotConfigured'],
    },
  };
};

function profilesSelected(r: Run, cmdlet: string): FwProfileName[] | null {
  const names = arr(r.p.Name).flatMap((x) => x.split(','));
  const fromPipe = (r.input ?? []).map((x) => (isObject(x) && typeof x.data === 'string' ? (x.data as FwProfileName) : null)).filter((x): x is FwProfileName => !!x);
  if (!names.length) return fromPipe.length ? fromPipe : [...PROFILES];
  const out: FwProfileName[] = [];
  for (const n of names) {
    const p = PROFILES.find((x) => x.toLowerCase() === n.trim().toLowerCase());
    if (!p) {
      r.fail({ message: `No MSFT_NetFirewallProfile objects found with property 'Name' equal to '${n}'.  Verify the value of the property and retry.`, category: 'ObjectNotFound', target: `${n}:String`, exception: 'CimJobException', id: `CmdletizationQuery_NotFound_Name,${cmdlet}` });
      return null;
    }
    out.push(p);
  }
  return out;
}

function setProfile(r: Run): unknown[] {
  const names = profilesSelected(r, 'Set-NetFirewallProfile');
  if (!names) return [];
  const actions = ['NotConfigured', 'Allow', 'Block'];
  for (const n of names) {
    if (!r.should('Set', n)) continue;
    const p = firewall(r.game).profiles[n];
    if (r.p.Enabled !== undefined) p.enabled = bool(r.p.Enabled);
    for (const [param, key] of [['DefaultInboundAction', 'defaultInbound'], ['DefaultOutboundAction', 'defaultOutbound']] as const) {
      if (r.p[param] === undefined) continue;
      const a = actions.find((x) => x.toLowerCase() === str(r.p[param]).toLowerCase());
      if (a) p[key] = a as typeof p.defaultInbound;
    }
    if (r.p.LogBlocked !== undefined) p.logBlocked = bool(r.p.LogBlocked);
    if (r.p.LogAllowed !== undefined) p.logAllowed = bool(r.p.LogAllowed);
  }
  return [];
}

function connectionProfile(game: Shell): PSObject {
  const fw = firewall(game);
  const d = windows(game).domain;
  const dns = d?.dns ?? (game.state.ad as { dns?: string } | undefined)?.dns;
  return {
    type: 'NetConnectionProfile',
    props: { Name: fw.category === 'Domain' && dns ? dns : 'Network', InterfaceAlias: 'Ethernet', InterfaceIndex: 4, NetworkCategory: fw.category === 'Domain' ? 'DomainAuthenticated' : fw.category, IPv4Connectivity: 'LocalNetwork', IPv6Connectivity: 'NoTraffic' },
  };
}

function setConnectionProfile(r: Run): unknown[] {
  const fw = firewall(r.game);
  const c = str(r.p.NetworkCategory);
  const cat = ['Private', 'Public'].find((x) => x.toLowerCase() === c.toLowerCase());
  if (!cat || fw.category === 'Domain') {
    r.fail({ message: 'Unable to set NetworkCategory to \'DomainAuthenticated\'. This NetworkCategory type will be set automatically when authenticated to a domain network.', category: 'PermissionDenied', target: 'MSFT_NetConnectionProfile:root/StandardCimv2/MSFT_NetConnectionProfile', exception: 'CimException', id: 'Windows System Error 5,Set-NetConnectionProfile' });
    return [];
  }
  if (r.should('Set', 'Ethernet')) fw.category = cat as FwProfileName;
  return [];
}

const RULE_SELECT = [{ name: 'Name', list: true, aliases: ['ID'] }, { name: 'DisplayName', list: true }, { name: 'DisplayGroup', list: true }, { name: 'Group', list: true }];
const RULE_SET = [
  { name: 'Direction', type: 'System.String' }, { name: 'Action', type: 'System.String' }, { name: 'Profile', list: true }, { name: 'Protocol', type: 'System.String' },
  { name: 'LocalPort', list: true }, { name: 'RemotePort', list: true }, { name: 'RemoteAddress', list: true }, { name: 'LocalAddress', list: true },
  { name: 'Enabled', type: 'System.Object' }, { name: 'Description', type: 'System.String' }, { name: 'Program', type: 'System.String' }, { name: 'IcmpType', list: true },
];

export const FIREWALL_CMDLETS: Cmdlet[] = [
  {
    name: 'Get-NetFirewallRule', module: MODULE, version: '2.0.0.0', kind: 'Function', positional: ['Name'],
    params: [...RULE_SELECT, { name: 'Enabled', type: 'System.Object' }, { name: 'Direction', type: 'System.String' }, { name: 'Action', type: 'System.String' }, { name: 'PolicyStore', type: 'System.String' }, { name: 'All', switch: true }, { name: 'AssociatedNetFirewallPortFilter', type: 'System.Object' }, { name: 'AssociatedNetFirewallAddressFilter', type: 'System.Object' }],
    run: getRule,
  },
  {
    name: 'New-NetFirewallRule', module: MODULE, version: '2.0.0.0', kind: 'Function', writes: true,
    params: [{ name: 'DisplayName', type: 'System.String' }, { name: 'Name', type: 'System.String' }, { name: 'Group', type: 'System.String' }, { name: 'PolicyStore', type: 'System.String' }, ...RULE_SET],
    run: newRule,
  },
  { name: 'Set-NetFirewallRule', module: MODULE, version: '2.0.0.0', kind: 'Function', writes: true, positional: ['Name'], params: [...RULE_SELECT, { name: 'NewDisplayName', type: 'System.String' }, ...RULE_SET, { name: 'PassThru', switch: true }], run: setRule },
  { name: 'Enable-NetFirewallRule', module: MODULE, version: '2.0.0.0', kind: 'Function', writes: true, positional: ['Name'], params: [...RULE_SELECT, { name: 'PassThru', switch: true }], run: (r) => toggle(r, true, 'Enable-NetFirewallRule') },
  { name: 'Disable-NetFirewallRule', module: MODULE, version: '2.0.0.0', kind: 'Function', writes: true, positional: ['Name'], params: [...RULE_SELECT, { name: 'PassThru', switch: true }], run: (r) => toggle(r, false, 'Disable-NetFirewallRule') },
  { name: 'Remove-NetFirewallRule', module: MODULE, version: '2.0.0.0', kind: 'Function', writes: true, positional: ['Name'], params: RULE_SELECT, run: removeRule },
  { name: 'Get-NetFirewallPortFilter', module: MODULE, version: '2.0.0.0', kind: 'Function', params: [{ name: 'AssociatedNetFirewallRule', type: 'System.Object' }, { name: 'Protocol', list: true }], run: (r) => (r.input ? r.input.map(ruleOf).filter((x): x is FwRule => !!x) : firewall(r.game).rules).filter((x) => !r.p.Protocol || arr(r.p.Protocol).some((p) => p.toLowerCase() === x.protocol.toLowerCase())).map(portFilter) },
  { name: 'Get-NetFirewallAddressFilter', module: MODULE, version: '2.0.0.0', kind: 'Function', params: [{ name: 'AssociatedNetFirewallRule', type: 'System.Object' }], run: (r) => (r.input ? r.input.map(ruleOf).filter((x): x is FwRule => !!x) : firewall(r.game).rules).map(addressFilter) },
  { name: 'Get-NetFirewallProfile', module: MODULE, version: '2.0.0.0', kind: 'Function', positional: ['Name'], params: [{ name: 'Name', list: true, aliases: ['Profile'] }, { name: 'All', switch: true }, { name: 'PolicyStore', type: 'System.String' }], run: (r) => (profilesSelected(r, 'Get-NetFirewallProfile') ?? []).map((n) => profileObject(n, r.game)) },
  {
    name: 'Set-NetFirewallProfile', module: MODULE, version: '2.0.0.0', kind: 'Function', writes: true, positional: ['Name'],
    params: [{ name: 'Name', list: true, aliases: ['Profile'] }, { name: 'All', switch: true }, { name: 'Enabled', type: 'System.Object' }, { name: 'DefaultInboundAction', type: 'System.String' }, { name: 'DefaultOutboundAction', type: 'System.String' }, { name: 'LogBlocked', type: 'System.Object' }, { name: 'LogAllowed', type: 'System.Object' }],
    run: setProfile,
  },
  { name: 'Get-NetConnectionProfile', module: 'NetConnection', version: '1.0.0.0', kind: 'Function', params: [{ name: 'InterfaceAlias', list: true }], run: (r) => [connectionProfile(r.game)] },
  { name: 'Set-NetConnectionProfile', module: 'NetConnection', version: '1.0.0.0', kind: 'Function', writes: true, params: [{ name: 'InterfaceAlias', list: true }, { name: 'NetworkCategory', type: 'System.String' }], run: setConnectionProfile },
];

export const FIREWALL_VIEWS: Record<string, View> = {
  MSFT_NetFirewallRule: { columns: [], list: true },
  MSFT_NetProtocolPortFilter: { columns: [], list: true },
  MSFT_NetAddressFilter: { columns: [], list: true },
  MSFT_NetFirewallProfile: { columns: [], list: true },
  NetConnectionProfile: { columns: [], list: true },
};

// ——— netsh advfirewall ———

const yes = (b: boolean) => (b ? 'Yes' : 'No');
const OK = 'Ok.\n';

function showRule(r: FwRule): string {
  const pad = (k: string, v: string) => `${`${k}:`.padEnd(38)}${v}`;
  return [
    '',
    pad('Rule Name', r.display),
    '-'.repeat(70),
    pad('Enabled', yes(r.enabled)),
    pad('Direction', r.direction === 'Inbound' ? 'In' : 'Out'),
    pad('Profiles', r.profiles.join(',')),
    pad('Grouping', r.group ?? ''),
    pad('LocalIP', (r.localAddress ?? ['Any']).join(',')),
    pad('RemoteIP', r.remoteAddress.join(',')),
    pad('Protocol', r.protocol),
    ...(['TCP', 'UDP'].includes(r.protocol) ? [pad('LocalPort', r.localPort.join(',')), pad('RemotePort', r.remotePort.join(','))] : []),
    pad('Edge traversal', 'No'),
    pad('Action', r.action),
  ].join('\n');
}

/** netsh's name=value arguments (values may be quoted). */
function pairs(args: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const a of args) {
    const m = /^([^=]+)=(.*)$/.exec(a);
    if (m) out[m[1].toLowerCase()] = m[2].replace(/^"|"$/g, '');
  }
  return out;
}

function netsh(game: Shell, args: string[]) {
  const words = args.map((a) => a.toLowerCase());
  const fw = firewall(game);
  if (words[0] !== 'advfirewall') return { out: `The following command was not found: ${args.join(' ')}.\n`, code: 1 };
  // netsh advfirewall show allprofiles [state] | set allprofiles|currentprofile|domainprofile… state on|off
  if (words[1] === 'show' && /profiles?$/.test(words[2] ?? '')) {
    const which: FwProfileName[] = words[2] === 'allprofiles' ? [...PROFILES] : words[2] === 'currentprofile' ? [fw.category] : PROFILES.filter((p) => `${p.toLowerCase()}profile` === words[2]);
    const onlyState = words[3] === 'state';
    const blocks = which.map((n) => {
      const p = fw.profiles[n];
      const pad = (k: string, v: string) => `${k.padEnd(38)}${v}`;
      return [`${n} Profile Settings: `, '-'.repeat(70), pad('State', p.enabled ? 'ON' : 'OFF'), ...(onlyState ? [] : [pad('Firewall Policy', `${p.defaultInbound === 'Allow' ? 'AllowInbound' : 'BlockInbound'},${p.defaultOutbound === 'Block' ? 'BlockOutbound' : 'AllowOutbound'}`), pad('LocalFirewallRules', 'N/A (GPO-store only)'), pad('LocalConSecRules', 'N/A (GPO-store only)'), pad('InboundUserNotification', 'Disable'), pad('RemoteManagement', 'Disable'), pad('UnicastResponseToMulticast', 'Enable'), '', 'Logging:', pad('LogAllowedConnections', p.logAllowed ? 'Enable' : 'Disable'), pad('LogDroppedConnections', p.logBlocked ? 'Enable' : 'Disable'), pad('FileName', '%systemroot%\\system32\\LogFiles\\Firewall\\pfirewall.log'), pad('MaxFileSize', '4096')])].join('\n');
    });
    return { out: `\n${blocks.join('\n\n')}\n${OK}`, code: 0 };
  }
  if (words[1] === 'set' && /profiles?$/.test(words[2] ?? '') && words[3] === 'state') {
    const which: FwProfileName[] = words[2] === 'allprofiles' ? [...PROFILES] : words[2] === 'currentprofile' ? [fw.category] : PROFILES.filter((p) => `${p.toLowerCase()}profile` === words[2]);
    if (!/^(on|off)$/.test(words[4] ?? '')) return { out: '', err: 'The parameter is incorrect.\n', code: 1 };
    for (const n of which) fw.profiles[n].enabled = words[4] === 'on';
    return { out: OK, code: 0 };
  }
  if (words[1] === 'firewall') {
    const v = pairs(args.slice(3));
    const dir = v.dir ? (v.dir.toLowerCase() === 'out' ? 'Outbound' : 'Inbound') : null;
    const named = (x: FwRule) => (v.name === undefined || v.name.toLowerCase() === 'all' || x.display.toLowerCase() === v.name.toLowerCase()) && (!dir || x.direction === dir);
    if (words[2] === 'show' && words[3] === 'rule') {
      const found = fw.rules.filter(named);
      if (!found.length) return { out: '\nNo rules match the specified criteria.\n', code: 1 };
      return { out: `${found.map(showRule).join('\n\n')}\n${OK}`, code: 0 };
    }
    if (words[2] === 'delete' && words[3] === 'rule') {
      const found = fw.rules.filter(named);
      if (!found.length) return { out: '\nNo rules match the specified criteria.\n', code: 1 };
      fw.rules = fw.rules.filter((x) => !found.includes(x));
      return { out: `\nDeleted ${found.length} rule(s).\n${OK}`, code: 0 };
    }
    if (words[2] === 'set' && words[3] === 'rule') {
      const at = words.indexOf('new');
      const sel = pairs(args.slice(4, at < 0 ? undefined : at));
      const change = pairs(at < 0 ? [] : args.slice(at + 1));
      const found = fw.rules.filter((x) => (sel.name === undefined || sel.name.toLowerCase() === 'all' || x.display.toLowerCase() === sel.name.toLowerCase()) && (!sel.dir || x.direction === (sel.dir.toLowerCase() === 'out' ? 'Outbound' : 'Inbound')));
      if (!found.length) return { out: '\nNo rules match the specified criteria.\n', code: 1 };
      for (const x of found) {
        if (change.enable) x.enabled = change.enable.toLowerCase() === 'yes';
        if (change.action) x.action = change.action.toLowerCase() === 'block' ? 'Block' : 'Allow';
        if (change.remoteip) x.remoteAddress = change.remoteip.split(',');
        if (change.localport) x.localPort = change.localport.split(',');
      }
      return { out: `\nUpdated ${found.length} rule(s).\n${OK}`, code: 0 };
    }
    if (words[2] === 'add' && words[3] === 'rule') {
      if (!v.name || !v.dir || !v.action) return { out: '', err: game.t('netsh-add-rule-usage'), code: 1 };
      const protocol = PROTOCOLS[(v.protocol ?? 'any').toLowerCase()] ?? 'Any';
      fw.rules.push({
        name: guid(game),
        display: v.name,
        description: v.description ?? '',
        enabled: (v.enable ?? 'yes').toLowerCase() === 'yes',
        direction: v.dir.toLowerCase() === 'out' ? 'Outbound' : 'Inbound',
        action: v.action.toLowerCase() === 'block' ? 'Block' : 'Allow',
        profiles: v.profile && v.profile.toLowerCase() !== 'any' ? PROFILES.filter((p) => v.profile.toLowerCase().split(',').includes(p.toLowerCase())) : [...PROFILES],
        protocol,
        localPort: v.localport ? v.localport.split(',') : ['Any'],
        remotePort: v.remoteport ? v.remoteport.split(',') : ['Any'],
        remoteAddress: v.remoteip ? v.remoteip.split(',') : ['Any'],
      });
      return { out: OK, code: 0 };
    }
  }
  return { out: `The following command was not found: ${args.join(' ')}.\n`, code: 1 };
}

export const FIREWALL_NATIVES: Native[] = [{ name: 'netsh.exe', page: 'netsh', run: (game, args) => netsh(game, args) }];
