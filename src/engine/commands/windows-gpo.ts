// The GroupPolicy module and the Group Policy programs (the model is
// ../windows-gpo.ts): Get-GPO, New-GPO, Remove-GPO, New-GPLink, Set-GPLink,
// Remove-GPLink, Get-GPInheritance, Set-GPInheritance, Get-GPPermission,
// Set-GPPermission, Get-GPOReport (XML or HTML, simplified), Invoke-GPUpdate;
// gpupdate (/force, /target:) and gpresult (/r, /scope:, /h) on a machine of
// the domain. New-NetFirewallRule -PolicyStore "domain\GPO" puts a rule in
// a GPO (windows-firewall.ts).
// Sources (Microsoft Learn, https://learn.microsoft.com/powershell/module/grouppolicy/):
// get-gpo, new-gpo, new-gplink, set-gplink, remove-gplink, get-gpinheritance,
// set-gpinheritance, get-gppermission, set-gppermission, get-gporeport,
// invoke-gpupdate; gpupdate and gpresult
// (https://learn.microsoft.com/windows-server/administration/windows-commands/gpupdate,
// https://learn.microsoft.com/windows-server/administration/windows-commands/gpresult).
// Differences (docs/SCENARIOS.md): Get-GPOReport's content is the game's
// short form; a few error texts (marked in the table of differences).

import type { Shell } from '../shell';
import { longDate, resolveWindows, toWindows, windows } from '../windows';
import { principal } from '../windows-acl';
import { adClock, byDn, canonicalName, defaultGpoPermissions, domainOf, newGuid, rdnValue, sameDn, settingSide, type AdObject, type Domain, type Gpo, type GpoSetting } from '../windows-ad';
import { appliedPolicy, applyPolicy, gpoById, gpoByName, linksInOrder } from '../windows-gpo';
import { FIREWALL_HOOKS } from './windows-firewall';
import { NET_HOOKS } from './windows-services';
import { adAvailable } from './windows-ad';
import { PSDate, str, text, type Cmdlet, type Failure, type Native, type PSObject, type Run, type View } from '../powershell';

const MODULE = 'GroupPolicy';
const VERSION = '1.0.0.0';

interface Ctx {
  ad: Domain;
  now: number;
}

const fqid = (cmdlet: string, id: string) => `${id},Microsoft.GroupPolicy.Commands.${cmdlet.replace('-', '')}Command`;

function need(r: Run, cmdlet: string): Ctx | null {
  const d = domainOf(r.game);
  if (!d) {
    r.fail({ message: 'The specified domain either does not exist or could not be contacted.', category: 'NotSpecified', target: ':', exception: 'ArgumentException', id: fqid(cmdlet, 'System.ArgumentException') });
    return null;
  }
  return { ad: d.ad, now: adClock(d.dc) };
}

/** -Name or -Guid (or a GPO from the pipeline): the GPO, or the module's error. */
function theGpo(r: Run, c: Ctx, cmdlet: string): Gpo | null {
  const fromPipe = (r.input ?? []).find((x): x is PSObject => typeof x === 'object' && x !== null && 'data' in x && !!(x as PSObject).data && typeof (x as PSObject).data === 'object' && 'settings' in ((x as PSObject).data as object));
  if (fromPipe && r.p.Name === undefined && r.p.Guid === undefined) return fromPipe.data as Gpo;
  const typed = str(r.p.Guid ?? r.p.Name);
  const byGuid = /^\{?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\}?$/i.test(typed);
  const g = byGuid ? gpoById(c.ad, typed) : gpoByName(c.ad, typed);
  if (!g) {
    const f: Failure = byGuid
      ? { message: `GPO with ID {${typed.replace(/[{}]/g, '').toLowerCase()}} was not found in the ${c.ad.dns} domain.`, category: 'InvalidArgument', target: ':', exception: 'ArgumentException', id: fqid(cmdlet, 'GpoWithIdNotFound') }
      : { message: `The "${typed}" GPO was not found in the ${c.ad.dns} domain.\nParameter name: gpoDisplayName`, category: 'InvalidArgument', target: `Microsoft.GroupPolicy.Gpo:Gpo`, exception: 'ArgumentException', id: fqid(cmdlet, 'GpoWithNameNotFound') };
    r.fail(f);
    return null;
  }
  return g;
}

const versionText = (n: number) => `AD Version: ${n}, SysVol Version: ${n}`;

function gpoObject(c: Ctx, g: Gpo): PSObject {
  return {
    type: 'Gpo',
    fullType: 'Microsoft.GroupPolicy.Gpo',
    data: g,
    text: 'Microsoft.GroupPolicy.Gpo',
    props: {
      DisplayName: g.name,
      DomainName: c.ad.dns,
      Owner: g.owner,
      Id: g.id,
      GpoStatus: g.status,
      Description: g.description,
      CreationTime: new PSDate(g.created),
      ModificationTime: new PSDate(g.modified),
      UserVersion: versionText(g.userVersion),
      ComputerVersion: versionText(g.computerVersion),
      WmiFilter: '',
    },
  };
}

/** A link's target (a DN): the container, or the module's error. */
function theTarget(r: Run, c: Ctx, cmdlet: string): AdObject | null {
  const t = str(r.p.Target);
  const o = byDn(c.ad, t);
  if (!o || !(o.cls === 'organizationalUnit' || o.cls === 'domainDNS')) {
    r.fail({ message: `The "${t}" Scope of Management (SOM) was not found in the ${c.ad.dns} domain. Specify a valid SOM path.\nParameter name: target`, category: 'InvalidArgument', target: ':', exception: 'ArgumentException', id: fqid(cmdlet, 'SomNotFound') });
    return null;
  }
  return o;
}

const yesNo = (v: unknown) => /^(yes|true|1)$/i.test(text(v));

function linkObject(c: Ctx, g: Gpo, som: AdObject): PSObject {
  const links = som.gpLinks ?? [];
  const i = links.findIndex((l) => l.gpo === g.id);
  return { type: 'GpoLink', fullType: 'Microsoft.GroupPolicy.GpoLink', props: { GpoId: g.id, DisplayName: g.name, Enabled: links[i].enabled, Enforced: links[i].enforced, Target: som.dn, Order: i + 1 } };
}

function newLink(r: Run): unknown[] {
  const c = need(r, 'New-GPLink');
  if (!c) return [];
  const g = theGpo(r, c, 'New-GPLink');
  const som = g && theTarget(r, c, 'New-GPLink');
  if (!g || !som) return [];
  if ((som.gpLinks ?? []).some((l) => l.gpo === g.id)) {
    r.fail({ message: `The GPO named '${g.name}' is already linked to a Scope of Management with Path '${som.dn}'.\nParameter name: target`, category: 'InvalidArgument', target: ':', exception: 'ArgumentException', id: fqid('New-GPLink', 'GpoLinkExists') });
    return [];
  }
  if (!r.should('Create', `${g.name} linked to ${som.dn}`)) return [];
  const link = { gpo: g.id, enabled: r.p.LinkEnabled === undefined ? true : yesNo(r.p.LinkEnabled), enforced: r.p.Enforced !== undefined && yesNo(r.p.Enforced) };
  const links = (som.gpLinks ??= []);
  const order = r.p.Order !== undefined ? Math.max(1, Math.min(links.length + 1, Number(r.p.Order))) : links.length + 1;
  links.splice(order - 1, 0, link);
  return [linkObject(c, g, som)];
}

function setLink(r: Run): unknown[] {
  const c = need(r, 'Set-GPLink');
  if (!c) return [];
  const g = theGpo(r, c, 'Set-GPLink');
  const som = g && theTarget(r, c, 'Set-GPLink');
  if (!g || !som) return [];
  const links = som.gpLinks ?? [];
  const i = links.findIndex((l) => l.gpo === g.id);
  if (i < 0) {
    r.fail({ message: `The GPO named '${g.name}' is not linked to a Scope of Management with Path '${som.dn}'.\nParameter name: target`, category: 'InvalidArgument', target: ':', exception: 'ArgumentException', id: fqid('Set-GPLink', 'GpoLinkNotFound') });
    return [];
  }
  if (!r.should('Set', `${g.name} linked to ${som.dn}`)) return [];
  const link = links[i];
  if (r.p.LinkEnabled !== undefined) link.enabled = yesNo(r.p.LinkEnabled);
  if (r.p.Enforced !== undefined) link.enforced = yesNo(r.p.Enforced);
  if (r.p.Order !== undefined) {
    links.splice(i, 1);
    links.splice(Math.max(0, Math.min(links.length, Number(r.p.Order) - 1)), 0, link);
  }
  return [linkObject(c, g, som)];
}

function removeLink(r: Run): unknown[] {
  const c = need(r, 'Remove-GPLink');
  if (!c) return [];
  const g = theGpo(r, c, 'Remove-GPLink');
  const som = g && theTarget(r, c, 'Remove-GPLink');
  if (!g || !som) return [];
  if (!(som.gpLinks ?? []).some((l) => l.gpo === g.id)) {
    r.fail({ message: `The GPO named '${g.name}' is not linked to a Scope of Management with Path '${som.dn}'.\nParameter name: target`, category: 'InvalidArgument', target: ':', exception: 'ArgumentException', id: fqid('Remove-GPLink', 'GpoLinkNotFound') });
    return [];
  }
  if (!r.should('Remove', `${g.name} linked to ${som.dn}`)) return [];
  som.gpLinks = (som.gpLinks ?? []).filter((l) => l.gpo !== g.id);
  return [];
}

/** Get-GPInheritance: a container's own links and those that reach it, in precedence order. */
function inheritance(c: Ctx, som: AdObject): PSObject {
  const names = (ids: string[]) => ids.map((id) => gpoById(c.ad, id)?.name ?? id);
  const inherited = linksInOrder(c.ad, som.dn, true).filter((e) => e.link.enabled).map((e) => e.gpo.id).reverse();
  return {
    type: 'Som',
    fullType: 'Microsoft.GroupPolicy.Som',
    data: som,
    props: {
      Name: (som.cls === 'domainDNS' ? c.ad.dns : rdnValue(som.dn)).toLowerCase(),
      ContainerType: som.cls === 'domainDNS' ? 'Domain' : 'OU',
      Path: som.dn.toLowerCase(),
      GpoInheritanceBlocked: som.blockInheritance ? 'Yes' : 'No',
      GpoLinks: names((som.gpLinks ?? []).map((l) => l.gpo)),
      InheritedGpoLinks: names(inherited),
    },
  };
}

function setInheritance(r: Run): unknown[] {
  const c = need(r, 'Set-GPInheritance');
  if (!c) return [];
  const som = theTarget(r, c, 'Set-GPInheritance');
  if (!som) return [];
  if (som.cls === 'domainDNS') {
    r.fail({ message: 'Inheritance cannot be blocked on a domain.', category: 'InvalidArgument', target: ':', exception: 'ArgumentException', id: fqid('Set-GPInheritance', 'System.ArgumentException') });
    return [];
  }
  if (!r.should('Set', som.dn)) return [];
  som.blockInheritance = yesNo(r.p.IsBlocked);
  return [inheritance(c, som)];
}

// ——— Permissions (security filtering) ———

const LEVELS = ['None', 'GpoRead', 'GpoApply', 'GpoEdit', 'GpoEditDeleteModifySecurity'] as const;
const levelRank = (p: string) => (p === 'GpoCustom' ? 3 : LEVELS.indexOf(p as (typeof LEVELS)[number]));

function trusteeType(c: Ctx, name: string, game: Shell): string {
  if (/^NT AUTHORITY\\|^Everyone$/i.test(name)) return 'WellKnownGroup';
  const p = principal(game, name);
  if (!p) return 'Unknown';
  if (/\$$/.test(name)) return 'Computer';
  void c;
  return p.kind === 'Group' ? 'Group' : 'User';
}

function permissionObject(r: Run, c: Ctx, p: Gpo['permissions'][number]): PSObject {
  return { type: 'GPPermission', fullType: 'Microsoft.GroupPolicy.GPPermission', props: { Trustee: p.trustee.replace(/^[^\\]*\\/, ''), TrusteeType: trusteeType(c, p.trustee, r.game), Permission: p.permission, Inherited: false } };
}

function getPermission(r: Run): unknown[] {
  const c = need(r, 'Get-GPPermission');
  if (!c) return [];
  const g = theGpo(r, c, 'Get-GPPermission');
  if (!g) return [];
  if (r.p.All) return g.permissions.map((p) => permissionObject(r, c, p));
  const who = principal(r.game, str(r.p.TargetName));
  const found = who && g.permissions.find((p) => p.trustee.toLowerCase() === who.name.toLowerCase());
  if (!found) {
    r.fail({ message: `The permissions for "${str(r.p.TargetName)}" could not be found.`, category: 'InvalidArgument', target: ':', exception: 'ArgumentException', id: fqid('Get-GPPermission', 'System.ArgumentException') });
    return [];
  }
  return [permissionObject(r, c, found)];
}

function setPermission(r: Run): unknown[] {
  const c = need(r, 'Set-GPPermission');
  if (!c) return [];
  const g = theGpo(r, c, 'Set-GPPermission');
  if (!g) return [];
  const who = principal(r.game, str(r.p.TargetName));
  if (!who) {
    r.fail({ message: `The trustee "${str(r.p.TargetName)}" could not be found.`, category: 'InvalidArgument', target: ':', exception: 'ArgumentException', id: fqid('Set-GPPermission', 'System.ArgumentException') });
    return [];
  }
  const level = LEVELS.find((l) => l.toLowerCase() === str(r.p.PermissionLevel).toLowerCase());
  if (!level) {
    r.fail({ message: `Cannot bind parameter 'PermissionLevel'. Cannot convert value "${str(r.p.PermissionLevel)}" to type "Microsoft.GroupPolicy.GPPermissionType".`, category: 'InvalidArgument', target: ':', exception: 'ParameterBindingException', id: fqid('Set-GPPermission', 'CannotConvertArgumentNoMessage') });
    return [];
  }
  const old = g.permissions.find((p) => p.trustee.toLowerCase() === who.name.toLowerCase());
  // Without -Replace, a permission is only raised, never lowered.
  if (old && levelRank(level) < levelRank(old.permission) && !r.p.Replace) {
    r.fail({ message: `The trustee "${who.name}" already has a higher permission level (${old.permission}) on the GPO "${g.name}". To lower it, use the -Replace parameter.`, category: 'InvalidOperation', target: ':', exception: 'InvalidOperationException', id: fqid('Set-GPPermission', 'System.InvalidOperationException') });
    return [];
  }
  if (!r.should('Set', g.name)) return [];
  g.permissions = g.permissions.filter((p) => p !== old);
  if (level !== 'None') g.permissions.push({ trustee: who.name, permission: level });
  g.modified = c.now;
  return [gpoObject(c, g)];
}

// ——— Reports ———

const settingText = (s: GpoSetting): string => {
  switch (s.kind) {
    case 'firewallRule':
      return `Windows Defender Firewall rule "${s.display}": ${s.action} ${s.direction ?? 'Inbound'} ${s.protocol} ${s.localPort.join(',')} from ${(s.remoteAddress ?? ['Any']).join(',')}`;
    case 'firewallProfile':
      return `Windows Defender Firewall: ${s.profile} Profile: ${s.enabled ? 'On' : 'Off'}`;
    case 'driveMap':
      return `Drive Maps: ${s.letter.replace(/:$/, '')}: ${s.path}${s.label ? ` (${s.label})` : ''}`;
    case 'logonScript':
      return `Scripts: Logon: ${s.script}`;
    case 'userRight':
      return `User Rights Assignment: ${s.right}: ${s.accounts.join(', ')}`;
    case 'passwordPolicy':
      return `Password Policy: minimum length ${s.minLength ?? '-'}, maximum age ${s.maxAge ?? '-'} days, complexity ${s.complexity === false ? 'Disabled' : 'Enabled'}, history ${s.history ?? '-'}`;
    case 'lockoutPolicy':
      return `Account Lockout Policy: threshold ${s.threshold ?? 0}, duration ${s.duration ?? '-'} minutes, reset after ${s.window ?? '-'} minutes`;
    case 'registry':
      return `Registry: ${s.key}\\${s.value} = ${s.data}`;
  }
};
const xmlEscape = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The game's short form of Get-GPOReport (XML or HTML): the GPO, its links, its settings by side. */
function report(c: Ctx, g: Gpo, kind: 'xml' | 'html'): string {
  const iso = (ms: number) => new Date(ms).toISOString().replace(/\.\d+Z$/, '');
  const links = c.ad.objects.filter((o) => (o.gpLinks ?? []).some((l) => l.gpo === g.id)).map((o) => ({ o, l: o.gpLinks!.find((l) => l.gpo === g.id)! }));
  const side = (s: 'computer' | 'user') => g.settings.filter((x) => settingSide(x) === s);
  if (kind === 'xml') {
    const sideXml = (s: 'computer' | 'user', tag: string, version: number) =>
      [`  <${tag}>`, `    <VersionDirectory>${version}</VersionDirectory>`, `    <VersionSysvol>${version}</VersionSysvol>`, `    <Enabled>${g.status === 'AllSettingsEnabled' || g.status === (s === 'user' ? 'ComputerSettingsDisabled' : 'UserSettingsDisabled') ? 'true' : 'false'}</Enabled>`, ...side(s).map((x) => `    <Setting kind="${x.kind}">${xmlEscape(settingText(x))}</Setting>`), `  </${tag}>`];
    return [
      '<?xml version="1.0" encoding="utf-16"?>',
      '<GPO xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="http://www.microsoft.com/GroupPolicy/Settings">',
      '  <Identifier>',
      `    <Identifier xmlns="http://www.microsoft.com/GroupPolicy/Types">{${g.id.toUpperCase()}}</Identifier>`,
      `    <Domain xmlns="http://www.microsoft.com/GroupPolicy/Types">${c.ad.dns}</Domain>`,
      '  </Identifier>',
      `  <Name>${xmlEscape(g.name)}</Name>`,
      `  <CreatedTime>${iso(g.created)}</CreatedTime>`,
      `  <ModifiedTime>${iso(g.modified)}</ModifiedTime>`,
      ...sideXml('computer', 'Computer', g.computerVersion),
      ...sideXml('user', 'User', g.userVersion),
      ...links.map(({ o, l }) => `  <LinksTo>\n    <SOMName>${xmlEscape(o.cls === 'domainDNS' ? c.ad.dns.split('.')[0] : o.name)}</SOMName>\n    <SOMPath>${xmlEscape(canonicalName(c.ad, o.dn).replace(/^([^/]+)\/?$/, '$1'))}</SOMPath>\n    <Enabled>${l.enabled}</Enabled>\n    <NoOverride>${l.enforced}</NoOverride>\n  </LinksTo>`),
      '</GPO>',
    ].join('\r\n');
  }
  const rows = (s: 'computer' | 'user') => side(s).map((x) => `<tr><td>${xmlEscape(settingText(x))}</td></tr>`).join('');
  return [
    '<html><head><title>' + xmlEscape(g.name) + '</title></head><body>',
    `<h1>${xmlEscape(g.name)}</h1>`,
    `<p>Domain: ${c.ad.dns} — Id: {${g.id}} — Status: ${g.status}</p>`,
    `<h2>Links</h2><table>${links.map(({ o, l }) => `<tr><td>${xmlEscape(canonicalName(c.ad, o.dn))}</td><td>Enforced: ${l.enforced ? 'Yes' : 'No'}</td><td>Link Status: ${l.enabled ? 'Enabled' : 'Disabled'}</td></tr>`).join('')}</table>`,
    `<h2>Security Filtering</h2><table>${g.permissions.filter((p) => p.permission === 'GpoApply').map((p) => `<tr><td>${xmlEscape(p.trustee)}</td></tr>`).join('')}</table>`,
    `<h2>Computer Configuration (Enabled)</h2><table>${rows('computer')}</table>`,
    `<h2>User Configuration (Enabled)</h2><table>${rows('user')}</table>`,
    '</body></html>',
  ].join('\r\n');
}

function getReport(r: Run): unknown[] {
  const c = need(r, 'Get-GPOReport');
  if (!c) return [];
  const kind = str(r.p.ReportType).toLowerCase();
  if (kind !== 'xml' && kind !== 'html') {
    r.fail({ message: `Cannot bind parameter 'ReportType'. Cannot convert value "${str(r.p.ReportType)}" to type "Microsoft.GroupPolicy.ReportType". Error: "Unable to match the identifier name ${str(r.p.ReportType)} to a valid enumerator name. Specify one of the following enumerator names and try again:\nXml, Html"`, category: 'InvalidArgument', target: ':', exception: 'ParameterBindingException', id: fqid('Get-GPOReport', 'CannotConvertArgumentNoMessage') });
    return [];
  }
  const gpos = r.p.All ? c.ad.gpos : [theGpo(r, c, 'Get-GPOReport')].filter((g): g is Gpo => !!g);
  const text = gpos.map((g) => report(c, g, kind)).join('\r\n');
  if (r.p.Path === undefined) return gpos.length ? [text] : [];
  const where = resolveWindows(r.game, str(r.p.Path));
  const parent = r.game.find(where.path.replace(/\/[^/]+$/, ''));
  if (parent?.type !== 'directory') {
    r.fail({ message: `Could not find a part of the path '${toWindows(where.path)}'.`, category: 'NotSpecified', target: ':', exception: 'DirectoryNotFoundException', id: fqid('Get-GPOReport', 'System.IO.DirectoryNotFoundException') });
    return [];
  }
  r.game.place('ssh', where.path, { type: 'file', content: text, lines: true });
  return [];
}

function newGpo(r: Run): unknown[] {
  const c = need(r, 'New-GPO');
  if (!c) return [];
  const name = str(r.p.Name);
  if (gpoByName(c.ad, name)) {
    r.fail({ message: `A GPO named "${name}" already exists in the ${c.ad.dns} domain.`, category: 'InvalidArgument', target: ':', exception: 'ArgumentException', id: fqid('New-GPO', 'GpoWithNameAlreadyExists') });
    return [];
  }
  if (!r.should('Create', name)) return [];
  const g: Gpo = { id: newGuid(c.ad), name, description: r.p.Comment !== undefined ? str(r.p.Comment) : '', owner: `${c.ad.netbios}\\Domain Admins`, created: c.now, modified: c.now, status: 'AllSettingsEnabled', userVersion: 0, computerVersion: 0, settings: [], permissions: defaultGpoPermissions(c.ad.netbios) };
  c.ad.gpos.push(g);
  return [gpoObject(c, g)];
}

function removeGpo(r: Run): unknown[] {
  const c = need(r, 'Remove-GPO');
  if (!c) return [];
  const g = theGpo(r, c, 'Remove-GPO');
  if (!g || !r.should('Remove', g.name)) return [];
  c.ad.gpos = c.ad.gpos.filter((x) => x !== g);
  for (const o of c.ad.objects) if (o.gpLinks) o.gpLinks = o.gpLinks.filter((l) => l.gpo !== g.id);
  return [];
}

/** Invoke-GPUpdate: this machine, or a machine of the domain (-Computer). */
function invokeUpdate(r: Run): unknown[] {
  const name = str(r.p.Computer);
  let target: Shell | null = r.game;
  if (name && name.toLowerCase() !== windows(r.game).computer.toLowerCase() && name !== 'localhost') {
    const p = r.game.principal;
    target = [p, ...Object.keys(p.chapter.hosts ?? {}).map((h) => p.internal(h))].find((s): s is Shell => !!s && !!s.state.windows && windows(s).computer.toLowerCase() === name.split('.')[0].toLowerCase()) ?? null;
    if (!target) {
      r.fail({ message: `Computer "${name}" is not responding. The target computer is either turned off or Remote Scheduled Tasks Management Firewall rules are disabled.`, category: 'OperationTimeout', target: ':', exception: 'COMException', id: fqid('Invoke-GPUpdate', 'COMException') });
      return [];
    }
  }
  const side = str(r.p.Target).toLowerCase();
  applyPolicy(target, side === 'user' ? 'user' : side === 'computer' ? 'computer' : 'both', target === r.game ? r.game.who : target.player);
  return [];
}

// GPO rules from New-NetFirewallRule -PolicyStore "school.internal\Server Firewall".
FIREWALL_HOOKS.gpoRule = (game, store, rule) => {
  const d = domainOf(game);
  const m = /^([^\\]+)\\(.+)$/.exec(store);
  if (!d || !m || m[1].toLowerCase() !== d.ad.dns.toLowerCase()) return 'The system cannot find the file specified.';
  const g = gpoByName(d.ad, m[2]);
  if (!g) return 'The system cannot find the file specified.';
  g.settings.push({ kind: 'firewallRule', name: rule.name, display: rule.display, protocol: rule.protocol, localPort: rule.localPort, remoteAddress: rule.remoteAddress, action: rule.action, direction: rule.direction });
  g.computerVersion++;
  g.modified = adClock(d.dc);
  return null;
};

const NAME = [{ name: 'Name', type: 'System.String', aliases: ['DisplayName'] }, { name: 'Guid', type: 'System.String', aliases: ['Id'] }, { name: 'Domain', type: 'System.String' }, { name: 'Server', type: 'System.String' }];
const base = (name: string, run: Cmdlet['run'], params: Cmdlet['params'], o: Partial<Cmdlet> = {}): Cmdlet => ({ name, module: MODULE, version: VERSION, params, run, available: adAvailable, ...o });

export const GPO_CMDLETS: Cmdlet[] = [
  base(
    'Get-GPO',
    (r) => {
      const c = need(r, 'Get-GPO');
      if (!c) return [];
      if (r.p.All) return c.ad.gpos.map((g) => gpoObject(c, g));
      if (r.p.Name === undefined && r.p.Guid === undefined) {
        r.fail({ message: 'Parameter set cannot be resolved using the specified named parameters.', category: 'InvalidArgument', target: ':', exception: 'ParameterBindingException', id: fqid('Get-GPO', 'AmbiguousParameterSet') });
        return [];
      }
      const g = theGpo(r, c, 'Get-GPO');
      return g ? [gpoObject(c, g)] : [];
    },
    [...NAME, { name: 'All', switch: true }],
    { positional: ['Name'] },
  ),
  base('New-GPO', newGpo, [{ name: 'Name', type: 'System.String' }, { name: 'Comment', type: 'System.String' }, { name: 'Domain', type: 'System.String' }], { positional: ['Name'], writes: true }),
  base('Remove-GPO', removeGpo, NAME, { positional: ['Name'], writes: true }),
  base('New-GPLink', newLink, [...NAME, { name: 'Target', type: 'System.String' }, { name: 'LinkEnabled', type: 'System.String' }, { name: 'Enforced', type: 'System.String' }, { name: 'Order', type: 'System.Int32' }], { positional: ['Name', 'Target'], writes: true }),
  base('Set-GPLink', setLink, [...NAME, { name: 'Target', type: 'System.String' }, { name: 'LinkEnabled', type: 'System.String' }, { name: 'Enforced', type: 'System.String' }, { name: 'Order', type: 'System.Int32' }], { positional: ['Name', 'Target'], writes: true }),
  base('Remove-GPLink', removeLink, [...NAME, { name: 'Target', type: 'System.String' }], { positional: ['Name', 'Target'], writes: true }),
  base(
    'Get-GPInheritance',
    (r) => {
      const c = need(r, 'Get-GPInheritance');
      const som = c && theTarget(r, c, 'Get-GPInheritance');
      return c && som ? [inheritance(c, som)] : [];
    },
    [{ name: 'Target', type: 'System.String' }, { name: 'Domain', type: 'System.String' }],
    { positional: ['Target'] },
  ),
  base('Set-GPInheritance', setInheritance, [{ name: 'Target', type: 'System.String' }, { name: 'IsBlocked', type: 'System.String' }], { positional: ['Target'], writes: true }),
  base('Get-GPPermission', getPermission, [...NAME, { name: 'TargetName', type: 'System.String' }, { name: 'TargetType', type: 'System.String' }, { name: 'All', switch: true }], { positional: ['Name'] }),
  base('Set-GPPermission', setPermission, [...NAME, { name: 'TargetName', type: 'System.String' }, { name: 'TargetType', type: 'System.String' }, { name: 'PermissionLevel', type: 'System.String' }, { name: 'Replace', switch: true }], { positional: ['Name'], writes: true }),
  base('Get-GPOReport', getReport, [...NAME, { name: 'ReportType', type: 'System.String' }, { name: 'Path', type: 'System.String' }, { name: 'All', switch: true }], { positional: ['Name', 'ReportType', 'Path'] }),
  base('Invoke-GPUpdate', invokeUpdate, [{ name: 'Computer', type: 'System.String' }, { name: 'Force', switch: true }, { name: 'Target', type: 'System.String' }, { name: 'RandomDelayInMinutes', type: 'System.Int32' }], { writes: true }),
];

export const GPO_VIEWS: Record<string, View> = Object.fromEntries(['Gpo', 'GpoLink', 'Som', 'GPPermission'].map((t) => [t, { columns: [], list: true }]));

// ——— gpupdate and gpresult ———

function gpupdate(game: Shell, args: string[]) {
  const target = args.map((a) => /^\/target:(user|computer)$/i.exec(a)?.[1]?.toLowerCase()).find(Boolean) as 'user' | 'computer' | undefined;
  const bad = args.find((a) => !/^\/(force|target:(user|computer)|wait:\d+|logoff|boot|sync)$/i.test(a));
  if (bad) return { out: '', err: `ERROR: Invalid argument/option - '${bad}'.\nType "GPUPDATE /?" for usage.\n`, code: 1 };
  applyPolicy(game, target ?? 'both');
  const out = ['Updating policy...', ''];
  if (target !== 'user') out.push('Computer Policy update has completed successfully.', '');
  if (target !== 'computer') out.push('User Policy update has completed successfully.', '');
  return { out: out.join('\n'), code: 0 };
}

/** "11/20/2029 at 9:00:00 AM": gpresult's dates. */
const at = (ms: number) => longDate(ms).replace(' ', ' at ');

function gpresult(game: Shell, args: string[]) {
  const low = args.map((a) => a.toLowerCase());
  const html = low.indexOf('/h');
  if (!args.length || (!low.includes('/r') && !low.includes('/v') && !low.includes('/z') && html < 0)) return { out: '', err: 'ERROR: Invalid Syntax.\nType "GPRESULT /?" for usage.\n', code: 1 };
  const d = domainOf(game);
  const w = windows(game);
  const gp = appliedPolicy(game);
  if (!d || (!gp.computer && !gp.user)) return { out: '', err: `\nINFO: The user "${w.computer.toLowerCase()}\\${game.who}" does not have RSoP data.\n`, code: 1 };
  const scope = low.map((a) => /^\/scope:(user|computer)$/.exec(a)?.[1]).find(Boolean);
  const userName = gp.user ? `${d.ad.netbios}\\${d.ad.objects.find((o) => sameDn(o.dn, gp.user!.dn))?.sam ?? game.who}` : `${w.computer}\\${game.who}`;
  const block = (title: string, r: { dn: string; at: number; from: string; applied: string[]; filtered: { name: string; reason: string }[]; groups: string[] }, who: string) => [
    title,
    '-'.repeat(title.length),
    `    ${r.dn}`,
    `    Last time Group Policy was applied: ${at(r.at)}`,
    `    Group Policy was applied from:      ${r.from}`,
    '    Group Policy slow link threshold:   500 kbps',
    `    Domain Name:                        ${d.ad.netbios}`,
    '    Domain Type:                        Windows 2008 or later',
    '',
    '    Applied Group Policy Objects',
    '    -----------------------------',
    ...(r.applied.length ? r.applied.map((n) => `        ${n}`) : ['        N/A']),
    '',
    '    The following GPOs were not applied because they were filtered out',
    '    -------------------------------------------------------------------',
    ...r.filtered.flatMap((f) => [`        ${f.name}`, `            Filtering:  ${f.reason}`, '']),
    `    The ${who} is a part of the following security groups`,
    '    ' + '-'.repeat(`The ${who} is a part of the following security groups`.length),
    ...r.groups.map((g) => `        ${g.replace(new RegExp(`^${d.ad.netbios}\\\\`, 'i'), '')}`),
    '',
  ];
  const lines = [
    '',
    'Microsoft (R) Windows (R) Operating System Group Policy Result tool v2.0',
    '© Microsoft Corporation. All rights reserved.',
    '',
    `Created on ${at(w.clock)}`,
    '',
    '',
    `RSOP data for ${userName} on ${w.computer} : Logging Mode`,
    '-'.repeat(`RSOP data for ${userName} on ${w.computer} : Logging Mode`.length),
    '',
    `OS Configuration:            ${game.state.ad ? 'Primary Domain Controller' : 'Member Server'}`,
    'OS version:                  10.0.20348',
    'Site Name:                   Default-First-Site-Name',
    'Roaming Profile:             N/A',
    `Local Profile:               C:\\Users\\${game.who}`,
    'Connected over a slow link?: No',
    '',
    '',
    ...(scope !== 'user' && gp.computer ? block('COMPUTER SETTINGS', gp.computer, 'computer') : []),
    ...(scope !== 'computer' && gp.user ? block('USER SETTINGS', gp.user, 'user') : []),
  ];
  const text = lines.join('\n');
  if (html >= 0) {
    const file = args[html + 1];
    if (!file) return { out: '', err: 'ERROR: Invalid Syntax. Value expected for \'/h\'.\nType "GPRESULT /?" for usage.\n', code: 1 };
    const where = resolveWindows(game, file);
    if (where.exists && !low.includes('/f')) return { out: '', err: `ERROR: The file "${file}" already exists.`, code: 1 };
    game.place('ssh', where.path, { type: 'file', content: `<html><body><pre>${xmlEscape(text)}</pre></body></html>`, lines: true });
    return { out: '', code: 0 };
  }
  return { out: text, code: 0 };
}

export const GPO_NATIVES: Native[] = [
  { name: 'gpupdate.exe', page: 'gpupdate', run: (game, args) => gpupdate(game, args) },
  { name: 'gpresult.exe', page: 'gpresult', run: (game, args) => gpresult(game, args) },
];

/** `net use`: the drives the user's policy mapped. */
export function netUse(game: Shell) {
  const drives = appliedPolicy(game).drives ?? [];
  const rows = drives.map((x) => `${'OK'.padEnd(13)}${`${x.letter}:`.padEnd(10)}${x.path.padEnd(25)} Microsoft Windows Network`);
  return { out: ['New connections will be remembered.', '', '', `${'Status'.padEnd(13)}${'Local'.padEnd(10)}${'Remote'.padEnd(26)}Network`, '', '-'.repeat(79), ...rows, 'The command completed successfully.', ''].join('\n'), code: 0 };
}

export { appliedPolicy };

NET_HOOKS.use = netUse;
export type { AdObject };
