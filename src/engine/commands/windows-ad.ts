// The ActiveDirectory module (the model is ../windows-ad.ts), on a domain
// controller or a member server with the management tools:
// Get-ADUser, New-ADUser, Set-ADUser, Remove-ADUser, Enable-ADAccount,
// Disable-ADAccount, Unlock-ADAccount, Set-ADAccountPassword,
// Search-ADAccount, Get-ADGroup, New-ADGroup, Remove-ADGroup,
// Get-ADGroupMember, Add-ADGroupMember, Remove-ADGroupMember,
// Get-ADPrincipalGroupMembership, Get-ADOrganizationalUnit,
// New-ADOrganizationalUnit, Set-ADOrganizationalUnit,
// Remove-ADOrganizationalUnit, Move-ADObject, Get-ADObject, Get-ADComputer,
// Get-ADDomain, Get-ADDomainController, Get-ADDefaultDomainPasswordPolicy,
// Set-ADDefaultDomainPasswordPolicy, the AD Recycle Bin (Get-ADObject
// -IncludeDeletedObjects, Restore-ADObject, Get-ADOptionalFeature); and
// `net user /domain`.
// An object shows its default property set, sorted by name like the
// module's (-Properties adds some, -Properties * every one the game models);
// -Identity takes a DN, a GUID, a SID or a sAMAccountName, or objects from
// the pipeline; an identity that isn't there is a terminating error
// (-ErrorAction SilentlyContinue doesn't hide it, as with the real module).
// Sources (Microsoft Learn, https://learn.microsoft.com/powershell/module/activedirectory/):
// get-aduser, new-aduser, set-aduser, remove-aduser, unlock-adaccount,
// set-adaccountpassword, search-adaccount, get-adgroupmember,
// add-adgroupmember, get-adprincipalgroupmembership,
// new-adorganizationalunit, move-adobject, get-addomain,
// get-addefaultdomainpasswordpolicy, restore-adobject, get-adoptionalfeature;
// "AD Recycle Bin" (https://learn.microsoft.com/windows-server/identity/ad-ds/get-started/adac/advanced-ad-ds-management-using-active-directory-administrative-center--level-200-#ad_recycle_bin);
// about_ActiveDirectory_Filter; net user
// (https://learn.microsoft.com/windows-server/administration/windows-commands/net-user).
// Differences (docs/SCENARIOS.md): the properties the game models, no
// -Server/-Credential (accepted, ignored), no -ResultPageSize paging.

import type { Shell } from '../shell';
import { windows } from '../windows';
import {
  COMPUTER_DEFAULT, GROUP_DEFAULT, OU_DEFAULT, USER_DEFAULT, AdFilterError, accountExpired, adClock, adProperties, addObject, below, byDn, directGroups, domainDn, domainOf, filterMatches, findIdentity, groupMembers, ldapAttributes, ldapMatch, lockedOut, moveObject, parentDn, parseAdFilter, passwordExpired, passwordExpiry, passwordRejected, removeObject, restoreObject, sameDn, setAdPassword, deletedObjectsContainer, findDeleted, formerDn,
  type AdClass, type AdObject, type Domain,
} from '../windows-ad';
import { PSDate, PSHashtable, PSScriptBlock, PSSecureString, arr, isObject, str, text, values, type Cmdlet, type Failure, type PSObject, type Run, type View } from '../powershell';
import { longDate } from '../windows';
import { NET_HOOKS } from './windows-services';

const MODULE = 'ActiveDirectory';
const VERSION = '1.0.1.0';
const DAY = 86_400_000;

/** The module is there on a domain controller, or on a member server with the management tools (RSAT). */
export const adAvailable = (game: Shell) => !!game.state.ad || (!!windows(game).domain?.tools && !!domainOf(game));

const cmdletType = (cmdlet: string) => `Microsoft.ActiveDirectory.Management.Commands.${cmdlet.replace('-', '')}`;
const adFailure = (cmdlet: string, message: string, category: string, exception: string, target = ':'): Failure => ({ message, category, target, exception, id: `ActiveDirectoryCmdlet:Microsoft.ActiveDirectory.Management.${exception},${cmdletType(cmdlet)}` });
const systemFailure = (cmdlet: string, message: string, category: string, exception: string, target = ':'): Failure => ({ message, category, target, exception, id: `ActiveDirectoryCmdlet:System.${exception},${cmdletType(cmdlet)}` });

interface Ctx {
  ad: Domain;
  dc: Shell;
  now: number;
}

/** The domain, or the module's "Unable to contact the server" error. */
function need(r: Run, cmdlet: string): Ctx | null {
  const d = domainOf(r.game);
  if (!d) {
    r.fail(adFailure(cmdlet, 'Unable to contact the server. This may be because this server does not exist, it is currently down, or it does not have the Active Directory Web Services running.', 'ResourceUnavailable', 'ADServerDownException'));
    return null;
  }
  return { ...d, now: adClock(d.dc) };
}

const TYPES: Record<AdClass, string> = { user: 'ADUser', group: 'ADGroup', computer: 'ADComputer', organizationalUnit: 'ADOrganizationalUnit', container: 'ADObject', domainDNS: 'ADObject', builtinDomain: 'ADObject' };
const DEFAULTS: Partial<Record<AdClass, string[]>> = { user: USER_DEFAULT, group: GROUP_DEFAULT, computer: COMPUTER_DEFAULT, organizationalUnit: OU_DEFAULT };

/** An object as the module returns it: its default properties, the ones asked for, sorted by name. */
export function adObject(c: Ctx, o: AdObject, wanted: string[] = [], as?: { type: string; keys: string[] }): PSObject {
  return adObjectOf(c, o, wanted, as);
}
function adObjectOf(c: Ctx, o: AdObject, wanted: string[] = [], as?: { type: string; keys: string[] }): PSObject {
  const all = adProperties(c.ad, o, c.now);
  const find = (n: string) => Object.keys(all).find((k) => k.toLowerCase() === n.toLowerCase());
  let keys: string[];
  if (as) keys = as.keys;
  else if (wanted.includes('*')) keys = Object.keys(all);
  else keys = [...(DEFAULTS[o.cls] ?? ['DistinguishedName', 'Name', 'ObjectClass', 'ObjectGUID']), ...(o.deleted ? ['Deleted'] : []), ...wanted.map((w) => find(w) ?? w)];
  const unique = keys.filter((k, i) => keys.findIndex((x) => x.toLowerCase() === k.toLowerCase()) === i).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  const props: Record<string, unknown> = {};
  for (const k of unique) {
    const real = find(k);
    props[k] = real === undefined ? null : all[real];
  }
  const type = as?.type ?? TYPES[o.cls];
  return { type, fullType: `Microsoft.ActiveDirectory.Management.${type}`, data: o, text: o.dn, props };
}

/** -Properties: '*' or names the game models; an unknown one is the module's error. */
function wantedProperties(r: Run, c: Ctx, cmdlet: string, sample: AdObject | undefined): string[] | null {
  const wanted = arr(r.p.Properties).flatMap((x) => x.split(',')).map((x) => x.trim()).filter(Boolean);
  if (!sample || wanted.includes('*')) return wanted;
  // The Recycle Bin's attributes exist on every object (empty when it isn't deleted).
  const known = [...Object.keys({ ...adProperties(c.ad, sample, c.now), ...ldapAttributes(c.ad, sample, c.now) }), 'Deleted', 'isDeleted', 'LastKnownParent', 'msDS-LastKnownRDN'].map((k) => k.toLowerCase());
  const bad = wanted.find((w) => !known.includes(w.toLowerCase()));
  if (bad) {
    r.fail(systemFailure(cmdlet, `One or more properties are invalid.\nParameter name: ${bad}`, 'InvalidArgument', 'ArgumentException'));
    return null;
  }
  return wanted;
}

/** The objects of -Identity (a value, or the pipeline's objects); a missing one stops the cmdlet. */
function identities(r: Run, c: Ctx, cmdlet: string, classes: AdClass[], label: string, param = 'Identity'): AdObject[] {
  const raw = r.p[param] !== undefined ? values(r.p[param]) : (r.input ?? []);
  const out: AdObject[] = [];
  for (const v of raw) {
    const fromObject = isObject(v) && v.data && typeof v.data === 'object' && 'cls' in (v.data as object) ? (v.data as AdObject) : null;
    const typed = fromObject ? fromObject.guid : isObject(v) ? text(v.props.DistinguishedName ?? v.props.distinguishedName ?? v.props.SamAccountName ?? v) : text(v);
    const o = (fromObject && c.ad.objects.includes(fromObject) ? fromObject : null) ?? findIdentity(c.ad, typed, classes);
    if (!o) r.stop(adFailure(cmdlet, `Cannot find an object with identity: '${typed}' under: '${domainDn(c.ad.dns)}'.`, 'ObjectNotFound', 'ADIdentityNotFoundException', `${typed}:${label}`));
    out.push(o!);
  }
  return out;
}

/** -SearchBase and -SearchScope: is this DN in the search? */
function inScope(r: Run, c: Ctx, cmdlet: string): ((dn: string) => boolean) | null {
  const base = r.p.SearchBase !== undefined ? str(r.p.SearchBase) : domainDn(c.ad.dns);
  if (!byDn(c.ad, base)) {
    r.stop(adFailure(cmdlet, 'Directory object not found', 'ObjectNotFound', 'ADIdentityNotFoundException', `:${TYPES.user}`));
    return null;
  }
  const scope = str(r.p.SearchScope).toLowerCase() || 'subtree';
  if (scope === 'base' || scope === '0') return (dn) => sameDn(dn, base);
  if (scope === 'onelevel' || scope === '1') return (dn) => sameDn(parentDn(dn), base);
  return (dn) => below(dn, base);
}

/** Get-AD*: -Identity, -Filter (the PowerShell Expression Language), -LDAPFilter; -SearchBase; -Properties. */
function getObjects(r: Run, cmdlet: string, classes: AdClass[], label: string): unknown[] {
  const c = need(r, cmdlet);
  if (!c) return [];
  const sample = c.ad.objects.find((o) => classes.includes(o.cls));
  const found = wantedProperties(r, c, cmdlet, sample);
  if (!found) return [];
  const wanted = found;
  // Get-ADObject returns ADObjects: their own default set, whatever the class (Deleted for a deleted one).
  const generic = cmdlet === 'Get-ADObject';
  const adObject = (c: Ctx, o: AdObject, w: string[]) => {
    if (!generic || w.includes('*')) return adObjectOf(c, o, w);
    const all = Object.keys(adProperties(c.ad, o, c.now));
    const keys = ['DistinguishedName', 'Name', 'ObjectClass', 'ObjectGUID', ...(o.deleted ? ['Deleted'] : []), ...w.map((x) => all.find((k) => k.toLowerCase() === x.toLowerCase()) ?? x)];
    return adObjectOf(c, o, [], { type: 'ADObject', keys });
  };
  // Get-ADObject -IncludeDeletedObjects: the Recycle Bin's objects too (and CN=Deleted Objects itself).
  const bin = r.p.IncludeDeletedObjects && c.ad.recycleBin ? [deletedObjectsContainer(c.ad), ...(c.ad.deleted ?? [])] : [];
  if (r.p.Identity !== undefined || (r.input?.length && r.p.Filter === undefined && r.p.LDAPFilter === undefined)) {
    if (bin.length && r.p.Identity !== undefined) {
      const typed = text(r.p.Identity);
      const gone = bin.find((o) => o.guid.toLowerCase() === typed.replace(/[{}]/g, '').toLowerCase() || sameDn(o.dn, typed));
      if (gone) return [adObject(c, gone, wanted)];
    }
    return identities(r, c, cmdlet, classes, label).map((o) => adObject(c, o, wanted));
  }
  const scope = inScope(r, c, cmdlet);
  if (!scope) return [];
  const pool = [...c.ad.objects, ...bin].filter((o) => classes.includes(o.cls) && scope(o.dn));
  let match: (o: AdObject) => boolean;
  if (r.p.LDAPFilter !== undefined) {
    const f = ldapMatch(c.ad, str(r.p.LDAPFilter), c.now);
    if (!f) r.stop(adFailure(cmdlet, 'The search filter cannot be recognized', 'NotSpecified', 'ADException'));
    match = f!;
  } else {
    const raw = r.p.Filter !== undefined ? r.p.Filter : r.read('Filter: ', false);
    const source = raw instanceof PSScriptBlock ? raw.text : text(raw);
    try {
      const node = parseAdFilter(source, (n) => r.variable(n));
      match = (o) => filterMatches(node, filterProperties(c, o));
    } catch (e) {
      if (!(e instanceof AdFilterError)) throw e;
      r.stop(adFailure(cmdlet, `Error parsing query: '${source.trim()}' Error Message: '${e.message}' at position: '${e.position + 1}'.`, 'ParserError', 'ADFilterParsingException'));
      return [];
    }
  }
  return pool.filter(match).map((o) => adObject(c, o, wanted));
}

/** What -Filter reads: the module's properties, then the LDAP attributes it doesn't name (sn, physicalDeliveryOfficeName…). */
function filterProperties(c: Ctx, o: AdObject): Record<string, unknown> {
  const out: Record<string, unknown> = { ...adProperties(c.ad, o, c.now) };
  const have = new Set(Object.keys(out).map((k) => k.toLowerCase()));
  for (const [k, v] of Object.entries(ldapAttributes(c.ad, o, c.now))) if (!have.has(k)) out[k] = v.length === 1 ? v[0] : v;
  return out;
}

// ——— Users ———

const bool = (v: unknown) => (typeof v === 'boolean' ? v : /^(true|1|\$true)$/i.test(text(v)));
const secure = (v: unknown) => (v instanceof PSSecureString ? v.plain : v === undefined ? undefined : text(v));

/** The changes of New-/Set-ADUser's named parameters. */
function applyUser(r: Run, c: Ctx, o: AdObject, cmdlet: string): boolean {
  const p = r.p;
  const set = <K extends keyof AdObject>(param: string, key: K, f: (v: unknown) => AdObject[K] = (v) => text(v) as AdObject[K]) => {
    if (p[param] !== undefined) o[key] = p[param] === null ? (undefined as AdObject[K]) : f(p[param]);
  };
  set('GivenName', 'given');
  set('Surname', 'surname');
  set('DisplayName', 'display');
  set('Description', 'description');
  set('Department', 'department');
  set('Title', 'title');
  set('Office', 'office');
  set('Company', 'company');
  set('EmailAddress', 'mail');
  set('UserPrincipalName', 'upn');
  set('SamAccountName', 'sam');
  set('Enabled', 'enabled', bool);
  set('PasswordNeverExpires', 'neverExpires', bool);
  set('CannotChangePassword', 'cannotChange', bool);
  set('ChangePasswordAtLogon', 'mustChange', bool);
  if (p.AccountExpirationDate !== undefined) o.accountExpires = p.AccountExpirationDate instanceof PSDate ? p.AccountExpirationDate.ms : null;
  if (p.Manager !== undefined) {
    if (p.Manager === null) o.manager = undefined;
    else {
      const m = identities({ ...r, p: { Identity: p.Manager } }, c, cmdlet, ['user'], 'ADUser');
      o.manager = m[0]?.dn;
    }
  }
  // -Replace @{title='Teacher'}, -Add, -Clear title: the LDAP attributes.
  const ldap: Record<string, keyof AdObject> = { title: 'title', department: 'department', description: 'description', physicaldeliveryofficename: 'office', mail: 'mail', givenname: 'given', sn: 'surname', displayname: 'display', company: 'company', userprincipalname: 'upn', samaccountname: 'sam' };
  for (const which of ['Replace', 'Add'] as const)
    if (p[which] instanceof PSHashtable)
      for (const [k, v] of (p[which] as PSHashtable).entries()) {
        const key = ldap[k.toLowerCase()];
        if (!key) {
          r.fail(adFailure(cmdlet, 'The specified directory service attribute or value does not exist', 'InvalidArgument', 'ADInvalidOperationException'));
          return false;
        }
        (o as unknown as Record<string, unknown>)[key] = text(Array.isArray(v) ? v[0] : v);
      }
  for (const k of arr(p.Clear)) {
    const key = ldap[k.toLowerCase()];
    if (key) delete (o as unknown as Record<string, unknown>)[key];
  }
  o.modified = c.now;
  return true;
}

function newUser(r: Run): unknown[] {
  const c = need(r, 'New-ADUser');
  if (!c) return [];
  const name = str(r.p.Name);
  const path = r.p.Path !== undefined ? str(r.p.Path) : `CN=Users,${domainDn(c.ad.dns)}`;
  if (!byDn(c.ad, path)) r.stop(adFailure('New-ADUser', 'Directory object not found', 'ObjectNotFound', 'ADIdentityNotFoundException', `CN=${name},${path}:String`));
  const dn = `CN=${name},${path}`;
  const sam = r.p.SamAccountName !== undefined ? str(r.p.SamAccountName) : name;
  if (byDn(c.ad, dn) || findIdentity(c.ad, sam)) r.stop(adFailure('New-ADUser', 'The specified account already exists', 'ResourceExists', 'ADIdentityAlreadyExistsException', `${dn}:String`));
  if (!r.should('New', dn)) return [];
  const o = addObject(c.ad, { dn, cls: 'user', name, sam, enabled: false, primaryGroup: 513, passwordLastSet: null, lastLogon: null, badPwdCount: 0 }, c.now);
  const enable = r.p.Enabled !== undefined && bool(r.p.Enabled);
  applyUser({ ...r, p: { ...r.p, Enabled: undefined } }, c, o, 'New-ADUser');
  o.enabled = false;
  const password = secure(r.p.AccountPassword);
  // The account is created first: a refused password leaves it there, disabled.
  if (password !== undefined && passwordRejected(c.ad, o, password)) {
    r.fail(adFailure('New-ADUser', 'The password does not meet the length, complexity, or history requirement of the domain.', 'InvalidData', 'ADPasswordComplexityException', `${dn}:String`));
    return [];
  }
  if (password !== undefined) setAdPassword(c.ad, o, password, c.now);
  if (bool(r.p.ChangePasswordAtLogon ?? false)) o.mustChange = true;
  if (enable) {
    if (password === undefined) {
      r.fail(adFailure('New-ADUser', 'The password does not meet the length, complexity, or history requirement of the domain.', 'InvalidData', 'ADPasswordComplexityException', `${dn}:String`));
      return [];
    }
    o.enabled = true;
  }
  return r.p.PassThru ? [adObject(c, o)] : [];
}

function setUser(r: Run, cmdlet = 'Set-ADUser', classes: AdClass[] = ['user']): unknown[] {
  const c = need(r, cmdlet);
  if (!c) return [];
  const out: unknown[] = [];
  for (const o of identities(r, c, cmdlet, classes, 'ADUser')) {
    if (!r.should('Set', o.dn)) continue;
    if (!applyUser(r, c, o, cmdlet)) continue;
    if (r.p.PassThru) out.push(adObject(c, o));
  }
  return out;
}

function removeObjects(r: Run, cmdlet: string, classes: AdClass[], label: string): unknown[] {
  const c = need(r, cmdlet);
  if (!c) return [];
  for (const o of identities(r, c, cmdlet, classes, label)) {
    if (!r.should('Remove', o.dn, true)) continue;
    if (o.protected) {
      r.fail(systemFailure(cmdlet, 'Access is denied', 'PermissionDenied', 'UnauthorizedAccessException', `${o.dn}:${label}`));
      continue;
    }
    if (o.cls === 'organizationalUnit' && !r.p.Recursive && c.ad.objects.some((x) => x !== o && below(x.dn, o.dn))) {
      r.fail(adFailure(cmdlet, 'The directory service can perform the requested operation only on a leaf object', 'NotSpecified', 'ADException', `${o.dn}:${label}`));
      continue;
    }
    removeObject(c.ad, o, c.now);
  }
  return [];
}

function enableAccount(r: Run, on: boolean): unknown[] {
  const cmdlet = on ? 'Enable-ADAccount' : 'Disable-ADAccount';
  const c = need(r, cmdlet);
  if (!c) return [];
  const out: unknown[] = [];
  for (const o of identities(r, c, cmdlet, ['user', 'computer'], 'ADAccount')) {
    if (!r.should('Set', o.dn)) continue;
    // An account with no password can't be enabled (the domain's length rule).
    if (on && o.cls === 'user' && c.ad.passwords[o.guid] === undefined && c.ad.policy.minLength > 0) {
      r.fail(adFailure(cmdlet, 'The password does not meet the length, complexity, or history requirement of the domain.', 'InvalidData', 'ADPasswordComplexityException', `${o.dn}:ADAccount`));
      continue;
    }
    o.enabled = on;
    o.modified = c.now;
    if (r.p.PassThru) out.push(adObject(c, o));
  }
  return out;
}

function unlock(r: Run): unknown[] {
  const c = need(r, 'Unlock-ADAccount');
  if (!c) return [];
  const out: unknown[] = [];
  for (const o of identities(r, c, 'Unlock-ADAccount', ['user', 'computer'], 'ADAccount')) {
    if (!r.should('Set', o.dn)) continue;
    o.lockoutTime = null;
    o.badPwdCount = 0;
    o.modified = c.now;
    if (r.p.PassThru) out.push(adObject(c, o));
  }
  return out;
}

function setPassword(r: Run): unknown[] {
  const c = need(r, 'Set-ADAccountPassword');
  if (!c) return [];
  for (const o of identities(r, c, 'Set-ADAccountPassword', ['user', 'computer'], 'ADAccount')) {
    const fresh = secure(r.p.NewPassword) ?? r.read(`Password: `, true);
    if (!r.p.Reset) {
      const old = secure(r.p.OldPassword) ?? r.read(`Password: `, true);
      if (c.ad.passwords[o.guid] !== old) {
        r.fail(adFailure('Set-ADAccountPassword', 'The specified network password is not correct', 'NotSpecified', 'ADInvalidPasswordException', `${o.dn}:ADAccount`));
        continue;
      }
    }
    if (passwordRejected(c.ad, o, fresh)) {
      r.fail(adFailure('Set-ADAccountPassword', 'The password does not meet the length, complexity, or history requirement of the domain.', 'InvalidData', 'ADPasswordComplexityException', `${o.dn}:ADAccount`));
      continue;
    }
    if (!r.should('Set-ADAccountPassword', o.dn)) continue;
    // A reset doesn't unlock the account (Unlock-ADAccount does).
    setAdPassword(c.ad, o, fresh, c.now);
  }
  return r.p.PassThru ? [] : [];
}

/** Search-ADAccount: locked out, disabled, inactive, expired accounts (users and computers). */
function searchAccount(r: Run): unknown[] {
  const c = need(r, 'Search-ADAccount');
  if (!c) return [];
  const scope = inScope(r, c, 'Search-ADAccount');
  if (!scope) return [];
  const span = r.p.TimeSpan !== undefined ? spanMs(r.p.TimeSpan) : null;
  const inactiveBefore = r.p.DateTime instanceof PSDate ? r.p.DateTime.ms : c.now - (span ?? 15 * DAY);
  const expiringBy = c.now + (span ?? 5 * DAY);
  const tests: ((o: AdObject) => boolean)[] = [];
  if (r.p.LockedOut) tests.push((o) => lockedOut(c.ad, o, c.now));
  if (r.p.AccountDisabled) tests.push((o) => o.enabled === false);
  // Accounts never logged on count as inactive.
  if (r.p.AccountInactive) tests.push((o) => !o.lastLogon || o.lastLogon < inactiveBefore);
  if (r.p.AccountExpired) tests.push((o) => accountExpired(o, c.now));
  if (r.p.AccountExpiring) tests.push((o) => !!o.accountExpires && o.accountExpires >= c.now && o.accountExpires <= expiringBy);
  if (r.p.PasswordExpired) tests.push((o) => passwordExpired(c.ad, o, c.now));
  if (r.p.PasswordNeverExpires) tests.push((o) => !!o.neverExpires);
  if (!tests.length) r.stop({ message: 'Parameter set cannot be resolved using the specified named parameters.', category: 'InvalidArgument', target: ':', exception: 'ParameterBindingException', id: 'AmbiguousParameterSet,Microsoft.ActiveDirectory.Management.Commands.SearchADAccount' });
  const classes: AdClass[] = r.p.UsersOnly ? ['user'] : r.p.ComputersOnly ? ['computer'] : ['user', 'computer'];
  const keys = ['AccountExpirationDate', 'DistinguishedName', 'Enabled', 'LastLogonDate', 'LockedOut', 'Name', 'ObjectClass', 'ObjectGUID', 'PasswordExpired', 'PasswordNeverExpires', 'SamAccountName', 'SID', 'UserPrincipalName'];
  return c.ad.objects.filter((o) => classes.includes(o.cls) && scope(o.dn) && tests.every((t) => t(o))).map((o) => adObject(c, o, [], { type: 'ADAccount', keys }));
}

/** A TimeSpan typed (90.00:00:00, 00:30:00, 90 for days) or a TimeSpan object, in ms. */
export function spanMs(v: unknown): number | null {
  if (isObject(v) && v.type === 'TimeSpan') return Number(v.props.TotalMilliseconds);
  if (typeof v === 'number') return v * DAY;
  const m = /^(?:(\d+)\.)?(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(text(v).trim());
  if (m) return ((Number(m[1] ?? 0) * 24 + Number(m[2])) * 60 + Number(m[3])) * 60_000 + Number(m[4] ?? 0) * 1000;
  return /^\d+$/.test(text(v).trim()) ? Number(text(v)) * DAY : null;
}

/** A TimeSpan as the module shows it (42.00:00:00, 00:30:00). */
function span(ms: number): PSObject {
  const days = Math.floor(ms / DAY);
  const rest = ms % DAY;
  const hh = [Math.floor(rest / 3_600_000), Math.floor((rest % 3_600_000) / 60_000), Math.floor((rest % 60_000) / 1000)].map((n) => String(n).padStart(2, '0')).join(':');
  return { type: 'TimeSpan', fullType: 'System.TimeSpan', props: { Days: days, Hours: Math.floor(rest / 3_600_000), Minutes: Math.floor((rest % 3_600_000) / 60_000), Seconds: Math.floor((rest % 60_000) / 1000), TotalDays: ms / DAY, TotalHours: ms / 3_600_000, TotalMinutes: ms / 60_000, TotalMilliseconds: ms }, text: `${days ? `${days}.` : ''}${hh}` };
}

// ——— Groups ———

function newGroup(r: Run): unknown[] {
  const c = need(r, 'New-ADGroup');
  if (!c) return [];
  const name = str(r.p.Name);
  const path = r.p.Path !== undefined ? str(r.p.Path) : `CN=Users,${domainDn(c.ad.dns)}`;
  if (!byDn(c.ad, path)) r.stop(adFailure('New-ADGroup', 'Directory object not found', 'ObjectNotFound', 'ADIdentityNotFoundException', `CN=${name},${path}:String`));
  const scope = ({ global: 'Global', '1': 'Global', domainlocal: 'DomainLocal', '0': 'DomainLocal', universal: 'Universal', '2': 'Universal' } as const)[str(r.p.GroupScope).toLowerCase() as 'global'];
  if (!scope) r.stop({ message: `Cannot bind parameter 'GroupScope'. Cannot convert value "${str(r.p.GroupScope)}" to type "Microsoft.ActiveDirectory.Management.ADGroupScope". Error: "Unable to match the identifier name ${str(r.p.GroupScope)} to a valid enumerator name. Specify one of the following enumerator names and try again:\nDomainLocal, Global, Universal"`, category: 'InvalidArgument', target: ':', exception: 'ParameterBindingException', id: 'CannotConvertArgumentNoMessage,Microsoft.ActiveDirectory.Management.Commands.NewADGroup' });
  const category = str(r.p.GroupCategory).toLowerCase() === 'distribution' || str(r.p.GroupCategory) === '0' ? 'Distribution' : 'Security';
  const dn = `CN=${name},${path}`;
  const sam = r.p.SamAccountName !== undefined ? str(r.p.SamAccountName) : name;
  if (byDn(c.ad, dn) || findIdentity(c.ad, sam)) r.stop(adFailure('New-ADGroup', 'The specified group already exists', 'ResourceExists', 'ADIdentityAlreadyExistsException', `${dn}:String`));
  if (!r.should('New', dn)) return [];
  const o = addObject(c.ad, { dn, cls: 'group', name, sam, scope, category, description: r.p.Description !== undefined ? str(r.p.Description) : undefined, members: [] }, c.now);
  return r.p.PassThru ? [adObject(c, o)] : [];
}

const PRINCIPAL_KEYS = ['distinguishedName', 'name', 'objectClass', 'objectGUID', 'SamAccountName', 'SID'];
const GROUP_KEYS = ['distinguishedName', 'GroupCategory', 'GroupScope', 'name', 'objectClass', 'objectGUID', 'SamAccountName', 'SID'];

/** An object with the module's lower-case names (Get-ADGroupMember, Get-ADPrincipalGroupMembership). */
function lowerCase(c: Ctx, o: AdObject, type: string, keys: string[]): PSObject {
  const x = adObject(c, o, [], { type, keys: keys.map((k) => k.replace(/^distinguishedName$/, 'DistinguishedName').replace(/^name$/, 'Name').replace(/^objectClass$/, 'ObjectClass').replace(/^objectGUID$/, 'ObjectGUID')) });
  const props: Record<string, unknown> = {};
  for (const k of keys) props[k] = x.props[Object.keys(x.props).find((n) => n.toLowerCase() === k.toLowerCase())!];
  return { ...x, props };
}

function groupMember(r: Run): unknown[] {
  const c = need(r, 'Get-ADGroupMember');
  if (!c) return [];
  return identities(r, c, 'Get-ADGroupMember', ['group'], 'ADGroup').flatMap((g) => groupMembers(c.ad, g, !!r.p.Recursive).map((o) => lowerCase(c, o, 'ADPrincipal', PRINCIPAL_KEYS)));
}

function changeMembers(r: Run, add: boolean): unknown[] {
  const cmdlet = add ? 'Add-ADGroupMember' : 'Remove-ADGroupMember';
  const c = need(r, cmdlet);
  if (!c) return [];
  const groups = identities(r, c, cmdlet, ['group'], 'ADGroup');
  const members = identities({ ...r, input: null }, c, cmdlet, ['user', 'group', 'computer'], 'ADPrincipal', 'Members');
  for (const g of groups) {
    if (!r.should('Set', g.dn, !add)) continue;
    for (const m of members) {
      const there = (g.members ?? []).some((x) => sameDn(x, m.dn));
      if (add && there) {
        r.fail(adFailure(cmdlet, 'The specified account name is already a member of the group', 'NotSpecified', 'ADException', `${g.dn}:ADGroup`));
        continue;
      }
      if (!add && !there) {
        r.fail(adFailure(cmdlet, primaryOf(g, m) ? PRIMARY : 'The specified account name is not a member of the group', 'NotSpecified', 'ADException', `${g.dn}:ADGroup`));
        continue;
      }
      if (add && m === g) continue;
      g.members = add ? [...(g.members ?? []), m.dn] : (g.members ?? []).filter((x) => !sameDn(x, m.dn));
      g.modified = c.now;
    }
  }
  return r.p.PassThru ? groups.map((g) => adObject(c, g)) : [];
}

/** Is this group the account's primary group (Domain Users), a membership kept by primaryGroupID, not by member? */
const primaryOf = (g: AdObject, m: AdObject) => !g.builtin && m.primaryGroup !== undefined && g.rid === m.primaryGroup;
const PRIMARY = "The user cannot be removed from a group because the group is currently the user's primary group";

/**
 * Add-ADPrincipalGroupMembership, Remove-ADPrincipalGroupMembership: the
 * same change as Add-/Remove-ADGroupMember, seen from the account (its
 * -MemberOf groups); removing asks first (ConfirmImpact High)
 * (https://learn.microsoft.com/powershell/module/activedirectory/remove-adprincipalgroupmembership).
 */
function changeMemberOf(r: Run, add: boolean): unknown[] {
  const cmdlet = add ? 'Add-ADPrincipalGroupMembership' : 'Remove-ADPrincipalGroupMembership';
  const c = need(r, cmdlet);
  if (!c) return [];
  const accounts = identities(r, c, cmdlet, ['user', 'group', 'computer'], 'ADPrincipal');
  const groups = identities({ ...r, input: null }, c, cmdlet, ['group'], 'ADGroup', 'MemberOf');
  for (const m of accounts) {
    if (!r.should('Set', m.dn, !add)) continue;
    for (const g of groups) {
      const there = (g.members ?? []).some((x) => sameDn(x, m.dn));
      if (add && there) {
        r.fail(adFailure(cmdlet, 'The specified account name is already a member of the group', 'NotSpecified', 'ADException', `${m.dn}:ADPrincipal`));
        continue;
      }
      if (!add && !there) {
        r.fail(adFailure(cmdlet, primaryOf(g, m) ? PRIMARY : 'The specified account name is not a member of the group', 'NotSpecified', 'ADException', `${m.dn}:ADPrincipal`));
        continue;
      }
      if (add && m === g) continue;
      g.members = add ? [...(g.members ?? []), m.dn] : (g.members ?? []).filter((x) => !sameDn(x, m.dn));
      g.modified = c.now;
    }
  }
  return r.p.PassThru ? accounts.map((m) => adObject(c, m)) : [];
}

function principalMembership(r: Run): unknown[] {
  const c = need(r, 'Get-ADPrincipalGroupMembership');
  if (!c) return [];
  return identities(r, c, 'Get-ADPrincipalGroupMembership', ['user', 'group', 'computer'], 'ADPrincipal').flatMap((o) => directGroups(c.ad, o).map((g) => lowerCase(c, g, 'ADGroup', GROUP_KEYS)));
}

// ——— OUs, objects, computers ———

function newOu(r: Run): unknown[] {
  const c = need(r, 'New-ADOrganizationalUnit');
  if (!c) return [];
  const name = str(r.p.Name);
  const path = r.p.Path !== undefined ? str(r.p.Path) : domainDn(c.ad.dns);
  if (!byDn(c.ad, path)) r.stop(adFailure('New-ADOrganizationalUnit', 'Directory object not found', 'ObjectNotFound', 'ADIdentityNotFoundException', `OU=${name},${path}:String`));
  const dn = `OU=${name},${path}`;
  if (byDn(c.ad, dn)) r.stop(adFailure('New-ADOrganizationalUnit', 'An attempt was made to add an object to the directory with a name that is already in use', 'NotSpecified', 'ADException', `${dn}:String`));
  if (!r.should('New', dn)) return [];
  const o = addObject(c.ad, { dn, cls: 'organizationalUnit', name, description: r.p.Description !== undefined ? str(r.p.Description) : undefined, protected: r.p.ProtectedFromAccidentalDeletion === undefined ? true : bool(r.p.ProtectedFromAccidentalDeletion) }, c.now);
  return r.p.PassThru ? [adObject(c, o)] : [];
}

function setOu(r: Run): unknown[] {
  const c = need(r, 'Set-ADOrganizationalUnit');
  if (!c) return [];
  const out: unknown[] = [];
  for (const o of identities(r, c, 'Set-ADOrganizationalUnit', ['organizationalUnit'], 'ADOrganizationalUnit')) {
    if (!r.should('Set', o.dn)) continue;
    if (r.p.ProtectedFromAccidentalDeletion !== undefined) o.protected = bool(r.p.ProtectedFromAccidentalDeletion);
    if (r.p.Description !== undefined) o.description = str(r.p.Description);
    o.modified = c.now;
    if (r.p.PassThru) out.push(adObject(c, o));
  }
  return out;
}

function moveAdObject(r: Run): unknown[] {
  const c = need(r, 'Move-ADObject');
  if (!c) return [];
  const target = str(r.p.TargetPath);
  const to = byDn(c.ad, target);
  if (!to) r.stop(adFailure('Move-ADObject', 'Directory object not found', 'ObjectNotFound', 'ADIdentityNotFoundException', `${target}:ADObject`));
  const out: unknown[] = [];
  for (const o of identities(r, c, 'Move-ADObject', ['user', 'group', 'computer', 'organizationalUnit', 'container'], 'ADObject')) {
    if (!r.should('Move', o.dn)) continue;
    if (o.protected) {
      r.fail(systemFailure('Move-ADObject', 'Access is denied', 'PermissionDenied', 'UnauthorizedAccessException', `${o.dn}:ADObject`));
      continue;
    }
    moveObject(c.ad, o, to!.dn, c.now);
    if (r.p.PassThru) out.push(adObject(c, o));
  }
  return out;
}

function getDomain(r: Run): unknown[] {
  const c = need(r, 'Get-ADDomain');
  if (!c) return [];
  const base = domainDn(c.ad.dns);
  const domain = byDn(c.ad, base)!;
  const dcHost = `${c.ad.dc.toLowerCase()}.${c.ad.dns}`;
  return [
    {
      type: 'ADDomain',
      fullType: 'Microsoft.ActiveDirectory.Management.ADDomain',
      data: domain,
      text: base,
      props: {
        AllowedDNSSuffixes: [],
        ChildDomains: [],
        ComputersContainer: `CN=Computers,${base}`,
        DeletedObjectsContainer: `CN=Deleted Objects,${base}`,
        DistinguishedName: base,
        DNSRoot: c.ad.dns,
        DomainControllersContainer: `OU=Domain Controllers,${base}`,
        DomainMode: 'Windows2016Domain',
        DomainSID: c.ad.sid,
        ForeignSecurityPrincipalsContainer: `CN=ForeignSecurityPrincipals,${base}`,
        Forest: c.ad.dns,
        InfrastructureMaster: dcHost,
        LastLogonReplicationInterval: '',
        LinkedGroupPolicyObjects: adProperties(c.ad, domain, c.now).LinkedGroupPolicyObjects,
        LostAndFoundContainer: `CN=LostAndFound,${base}`,
        ManagedBy: '',
        Name: c.ad.dns.split('.')[0],
        NetBIOSName: c.ad.netbios,
        ObjectClass: 'domainDNS',
        ObjectGUID: domain.guid,
        ParentDomain: '',
        PDCEmulator: dcHost,
        PublicKeyRequiredPasswordRolling: true,
        QuotasContainer: `CN=NTDS Quotas,${base}`,
        ReadOnlyReplicaDirectoryServers: [],
        ReplicaDirectoryServers: [dcHost],
        RIDMaster: dcHost,
        SubordinateReferences: [`DC=ForestDnsZones,${base}`, `DC=DomainDnsZones,${base}`, `CN=Configuration,${base}`],
        SystemsContainer: `CN=System,${base}`,
        UsersContainer: `CN=Users,${base}`,
      },
    },
  ];
}

function getDomainController(r: Run): unknown[] {
  const c = need(r, 'Get-ADDomainController');
  if (!c) return [];
  const base = domainDn(c.ad.dns);
  const dc = findIdentity(c.ad, `${c.ad.dc}$`, ['computer'])!;
  const host = `${c.ad.dc.toLowerCase()}.${c.ad.dns}`;
  return [
    {
      type: 'ADDomainController',
      fullType: 'Microsoft.ActiveDirectory.Management.ADDomainController',
      text: host,
      props: {
        ComputerObjectDN: dc.dn,
        DefaultPartition: base,
        Domain: c.ad.dns,
        Enabled: true,
        Forest: c.ad.dns,
        HostName: host,
        InvocationId: dc.guid,
        IPv4Address: c.ad.dcAddress ?? windows(c.dc).network?.address ?? '',
        IPv6Address: '',
        IsGlobalCatalog: true,
        IsReadOnly: false,
        LdapPort: 389,
        Name: c.ad.dc,
        NTDSSettingsObjectDN: `CN=NTDS Settings,CN=${c.ad.dc},CN=Servers,CN=Default-First-Site-Name,CN=Sites,CN=Configuration,${base}`,
        OperatingSystem: 'Windows Server 2022 Standard',
        OperatingSystemHotfix: '',
        OperatingSystemServicePack: '',
        OperatingSystemVersion: '10.0 (20348)',
        OperationMasterRoles: ['SchemaMaster', 'DomainNamingMaster', 'PDCEmulator', 'RIDMaster', 'InfrastructureMaster'],
        Partitions: [`DC=ForestDnsZones,${base}`, `DC=DomainDnsZones,${base}`, `CN=Schema,CN=Configuration,${base}`, `CN=Configuration,${base}`, base],
        ServerObjectDN: `CN=${c.ad.dc},CN=Servers,CN=Default-First-Site-Name,CN=Sites,CN=Configuration,${base}`,
        ServerObjectGuid: dc.guid,
        Site: 'Default-First-Site-Name',
        SslPort: 636,
      },
    },
  ];
}

function passwordPolicy(r: Run): unknown[] {
  const c = need(r, 'Get-ADDefaultDomainPasswordPolicy');
  if (!c) return [];
  const p = c.ad.policy;
  const base = domainDn(c.ad.dns);
  return [
    {
      type: 'ADDefaultDomainPasswordPolicy',
      fullType: 'Microsoft.ActiveDirectory.Management.ADDefaultDomainPasswordPolicy',
      text: base,
      props: {
        ComplexityEnabled: p.complexity,
        DistinguishedName: base,
        LockoutDuration: span(p.duration * 60_000),
        LockoutObservationWindow: span(p.window * 60_000),
        LockoutThreshold: p.threshold,
        MaxPasswordAge: span(p.maxAge * DAY),
        MinPasswordAge: span(p.minAge * DAY),
        MinPasswordLength: p.minLength,
        objectClass: ['domainDNS'],
        objectGuid: byDn(c.ad, base)!.guid,
        PasswordHistoryCount: p.history,
        ReversibleEncryptionEnabled: false,
      },
    },
  ];
}

function setPasswordPolicy(r: Run): unknown[] {
  const c = need(r, 'Set-ADDefaultDomainPasswordPolicy');
  if (!c) return [];
  if (!r.should('Set', domainDn(c.ad.dns))) return [];
  const p = c.ad.policy;
  const minutes = (param: string) => {
    const ms = spanMs(r.p[param]);
    return ms === null ? null : ms / 60_000;
  };
  if (r.p.LockoutThreshold !== undefined) p.threshold = Number(r.p.LockoutThreshold);
  if (r.p.LockoutDuration !== undefined) p.duration = minutes('LockoutDuration') ?? p.duration;
  if (r.p.LockoutObservationWindow !== undefined) p.window = minutes('LockoutObservationWindow') ?? p.window;
  if (r.p.MinPasswordLength !== undefined) p.minLength = Number(r.p.MinPasswordLength);
  if (r.p.PasswordHistoryCount !== undefined) p.history = Number(r.p.PasswordHistoryCount);
  if (r.p.ComplexityEnabled !== undefined) p.complexity = bool(r.p.ComplexityEnabled);
  if (r.p.MaxPasswordAge !== undefined) p.maxAge = (minutes('MaxPasswordAge') ?? p.maxAge * 1440) / 1440;
  if (r.p.MinPasswordAge !== undefined) p.minAge = (minutes('MinPasswordAge') ?? p.minAge * 1440) / 1440;
  // The Default Domain Policy holds the same values (the domain's own attributes are what Windows reads).
  const ddp = c.ad.gpos.find((g) => g.name === 'Default Domain Policy');
  if (ddp)
    ddp.settings = [...ddp.settings.filter((s) => s.kind !== 'passwordPolicy' && s.kind !== 'lockoutPolicy'), { kind: 'passwordPolicy', minLength: p.minLength, maxAge: p.maxAge, complexity: p.complexity, history: p.history }, { kind: 'lockoutPolicy', threshold: p.threshold, duration: p.duration, window: p.window }];
  return [];
}

// ——— The cmdlets ———

// ——— The AD Recycle Bin ———

/** Restore-ADObject: a deleted object (from the pipeline, its GUID or its DN in CN=Deleted Objects) back where it was. */
function restore(r: Run): unknown[] {
  const c = need(r, 'Restore-ADObject');
  if (!c) return [];
  const raw = r.p.Identity !== undefined ? values(r.p.Identity) : (r.input ?? []);
  const out: unknown[] = [];
  for (const v of raw) {
    const data = isObject(v) && v.data && typeof v.data === 'object' && 'cls' in (v.data as object) ? (v.data as AdObject) : null;
    const typed = data ? data.guid : isObject(v) ? text(v.props.ObjectGUID ?? v.props.DistinguishedName ?? v) : text(v);
    const o = (data && (c.ad.deleted ?? []).includes(data) ? data : null) ?? findDeleted(c.ad, typed);
    if (!o) {
      // A live object, or nothing: the module says it can't find it (it searches the deleted objects).
      r.fail(adFailure('Restore-ADObject', `Cannot find an object with identity: '${typed}' under: '${domainDn(c.ad.dns)}'.`, 'ObjectNotFound', 'ADIdentityNotFoundException', `${typed}:ADObject`));
      continue;
    }
    if (!r.should('Restore', formerDn(o))) continue;
    const error = restoreObject(c.ad, o, c.now, r.p.TargetPath !== undefined ? str(r.p.TargetPath) : undefined, r.p.NewName !== undefined ? str(r.p.NewName) : undefined);
    if (error) {
      r.fail(adFailure('Restore-ADObject', error, 'NotSpecified', 'ADException', `${o.dn}:ADObject`));
      continue;
    }
    if (r.p.PassThru) out.push(adObject(c, o));
  }
  return out;
}

const RECYCLE_BIN_GUID = '766ddcd8-acd0-445e-f3b9-a7f9b6744f2a';
const PAM_GUID = 'ec43e873-cce8-4640-b4ab-07ffe4ab5bcd';

/** Get-ADOptionalFeature: the Recycle Bin (enabled or not) and Privileged Access Management (not). */
function optionalFeature(r: Run): unknown[] {
  const c = need(r, 'Get-ADOptionalFeature');
  if (!c) return [];
  const base = domainDn(c.ad.dns);
  const config = `CN=Optional Features,CN=Directory Service,CN=Windows NT,CN=Services,CN=Configuration,${base}`;
  const feature = (name: string, guid: string, enabled: boolean, forestMode: string): PSObject => ({
    type: 'ADOptionalFeature',
    fullType: 'Microsoft.ActiveDirectory.Management.ADOptionalFeature',
    text: `CN=${name},${config}`,
    props: {
      DistinguishedName: `CN=${name},${config}`,
      EnabledScopes: enabled ? [`CN=Partitions,CN=Configuration,${base}`, `CN=NTDS Settings,CN=${c.ad.dc},CN=Servers,CN=Default-First-Site-Name,CN=Sites,CN=Configuration,${base}`] : [],
      FeatureGUID: guid,
      FeatureScope: ['ForestOrConfigurationSet'],
      IsDisableable: false,
      Name: name,
      ObjectClass: 'msDS-OptionalFeature',
      ObjectGUID: guid,
      RequiredDomainMode: null,
      RequiredForestMode: forestMode,
    },
  });
  const all = [feature('Recycle Bin Feature', RECYCLE_BIN_GUID, !!c.ad.recycleBin, 'Windows2008R2Forest'), feature('Privileged Access Management Feature', PAM_GUID, false, 'Windows2016Forest')];
  if (r.p.Identity !== undefined) {
    const typed = text(r.p.Identity);
    const one = all.find((f) => [f.props.Name, f.props.FeatureGUID, f.props.DistinguishedName].some((x) => text(x).toLowerCase() === typed.toLowerCase().replace(/[{}]/g, '')));
    if (!one) r.stop(adFailure('Get-ADOptionalFeature', `Cannot find an object with identity: '${typed}' under: '${config}'.`, 'ObjectNotFound', 'ADIdentityNotFoundException', `${typed}:ADOptionalFeature`));
    return [one];
  }
  if (r.p.Filter === undefined) r.stop({ message: 'Parameter set cannot be resolved using the specified named parameters.', category: 'InvalidArgument', target: ':', exception: 'ParameterBindingException', id: 'AmbiguousParameterSet,Microsoft.ActiveDirectory.Management.Commands.GetADOptionalFeature' });
  const raw = r.p.Filter;
  const source = raw instanceof PSScriptBlock ? raw.text : text(raw);
  try {
    const node = parseAdFilter(source, (n) => r.variable(n));
    return all.filter((f) => filterMatches(node, f.props));
  } catch (e) {
    if (!(e instanceof AdFilterError)) throw e;
    r.stop(adFailure('Get-ADOptionalFeature', `Error parsing query: '${source.trim()}' Error Message: '${e.message}' at position: '${e.position + 1}'.`, 'ParserError', 'ADFilterParsingException'));
    return [];
  }
}

const ID = { name: 'Identity', type: 'System.Object' };
const COMMON_AD = [{ name: 'Server', type: 'System.String' }, { name: 'Credential', type: 'System.Object' }, { name: 'AuthType', type: 'System.String' }];
const SEARCH = [ID, { name: 'Filter', type: 'System.Object' }, { name: 'LDAPFilter', type: 'System.String' }, { name: 'SearchBase', type: 'System.String' }, { name: 'SearchScope', type: 'System.String' }, { name: 'Properties', list: true, aliases: ['Property'] }, { name: 'ResultSetSize', type: 'System.Int32' }, ...COMMON_AD];
const USER_PARAMS = [
  ...['GivenName', 'Surname', 'DisplayName', 'Description', 'Department', 'Title', 'Office', 'Company', 'EmailAddress', 'UserPrincipalName', 'SamAccountName'].map((name) => ({ name, type: 'System.String' })),
  ...['Enabled', 'PasswordNeverExpires', 'CannotChangePassword', 'ChangePasswordAtLogon'].map((name) => ({ name, type: 'System.Boolean' })),
  { name: 'AccountExpirationDate', type: 'System.DateTime' },
  { name: 'Manager', type: 'System.Object' },
];
const base = (name: string, run: Cmdlet['run'], params: Cmdlet['params'], o: Partial<Cmdlet> = {}): Cmdlet => ({ name, module: MODULE, version: VERSION, params: [...params, ...COMMON_AD], run, available: adAvailable, ...o });

export const AD_CMDLETS: Cmdlet[] = [
  base('Get-ADUser', (r) => getObjects(r, 'Get-ADUser', ['user'], 'ADUser'), SEARCH.slice(0, -3), { positional: ['Identity'] }),
  base('Get-ADComputer', (r) => getObjects(r, 'Get-ADComputer', ['computer'], 'ADComputer'), SEARCH.slice(0, -3), { positional: ['Identity'] }),
  base('Get-ADGroup', (r) => getObjects(r, 'Get-ADGroup', ['group'], 'ADGroup'), SEARCH.slice(0, -3), { positional: ['Identity'] }),
  base('Get-ADOrganizationalUnit', (r) => getObjects(r, 'Get-ADOrganizationalUnit', ['organizationalUnit'], 'ADOrganizationalUnit'), SEARCH.slice(0, -3), { positional: ['Identity'] }),
  base('Get-ADObject', (r) => getObjects(r, 'Get-ADObject', ['user', 'group', 'computer', 'organizationalUnit', 'container', 'domainDNS', 'builtinDomain'], 'ADObject'), [...SEARCH.slice(0, -3), { name: 'IncludeDeletedObjects', switch: true }], { positional: ['Identity'] }),
  base('Restore-ADObject', restore, [ID, { name: 'NewName', type: 'System.String' }, { name: 'TargetPath', type: 'System.String' }, { name: 'Partition', type: 'System.String' }, { name: 'PassThru', switch: true }], { positional: ['Identity'], writes: true }),
  base('Get-ADOptionalFeature', optionalFeature, [ID, { name: 'Filter', type: 'System.Object' }, { name: 'LDAPFilter', type: 'System.String' }, { name: 'Properties', list: true, aliases: ['Property'] }], { positional: ['Identity'] }),
  base('New-ADUser', newUser, [{ name: 'Name', type: 'System.String' }, { name: 'Path', type: 'System.String' }, { name: 'AccountPassword', type: 'System.Security.SecureString' }, { name: 'PassThru', switch: true }, ...USER_PARAMS], { positional: ['Name'], writes: true }),
  base('Set-ADUser', (r) => setUser(r), [ID, ...USER_PARAMS, { name: 'Replace', type: 'System.Collections.Hashtable' }, { name: 'Add', type: 'System.Collections.Hashtable' }, { name: 'Clear', list: true }, { name: 'PassThru', switch: true }], { positional: ['Identity'], writes: true }),
  base('Remove-ADUser', (r) => removeObjects(r, 'Remove-ADUser', ['user'], 'ADUser'), [ID], { positional: ['Identity'], writes: true }),
  base('Enable-ADAccount', (r) => enableAccount(r, true), [ID, { name: 'PassThru', switch: true }], { positional: ['Identity'], writes: true }),
  base('Disable-ADAccount', (r) => enableAccount(r, false), [ID, { name: 'PassThru', switch: true }], { positional: ['Identity'], writes: true }),
  base('Unlock-ADAccount', unlock, [ID, { name: 'PassThru', switch: true }], { positional: ['Identity'], writes: true }),
  base('Set-ADAccountPassword', setPassword, [ID, { name: 'NewPassword', type: 'System.Security.SecureString' }, { name: 'OldPassword', type: 'System.Security.SecureString' }, { name: 'Reset', switch: true }, { name: 'PassThru', switch: true }], { positional: ['Identity'], writes: true }),
  base(
    'Search-ADAccount', searchAccount,
    [...['LockedOut', 'AccountDisabled', 'AccountInactive', 'AccountExpired', 'AccountExpiring', 'PasswordExpired', 'PasswordNeverExpires', 'UsersOnly', 'ComputersOnly'].map((name) => ({ name, switch: true })), { name: 'TimeSpan', type: 'System.Object' }, { name: 'DateTime', type: 'System.DateTime' }, { name: 'SearchBase', type: 'System.String' }, { name: 'SearchScope', type: 'System.String' }],
  ),
  base('New-ADGroup', newGroup, [{ name: 'Name', type: 'System.String' }, { name: 'GroupScope', type: 'System.String' }, { name: 'GroupCategory', type: 'System.String' }, { name: 'SamAccountName', type: 'System.String' }, { name: 'Path', type: 'System.String' }, { name: 'Description', type: 'System.String' }, { name: 'PassThru', switch: true }], { positional: ['Name', 'GroupScope'], writes: true }),
  base('Set-ADGroup', (r) => setUser(r, 'Set-ADGroup', ['group']), [ID, { name: 'Description', type: 'System.String' }, { name: 'Replace', type: 'System.Collections.Hashtable' }, { name: 'Clear', list: true }, { name: 'PassThru', switch: true }], { positional: ['Identity'], writes: true }),
  base('Remove-ADGroup', (r) => removeObjects(r, 'Remove-ADGroup', ['group'], 'ADGroup'), [ID], { positional: ['Identity'], writes: true }),
  base('Get-ADGroupMember', groupMember, [ID, { name: 'Recursive', switch: true }], { positional: ['Identity'] }),
  base('Add-ADGroupMember', (r) => changeMembers(r, true), [ID, { name: 'Members', list: true, type: 'System.Object[]' }, { name: 'PassThru', switch: true }], { positional: ['Identity', 'Members'], writes: true }),
  base('Remove-ADGroupMember', (r) => changeMembers(r, false), [ID, { name: 'Members', list: true, type: 'System.Object[]' }, { name: 'PassThru', switch: true }], { positional: ['Identity', 'Members'], writes: true }),
  base('Get-ADPrincipalGroupMembership', principalMembership, [ID], { positional: ['Identity'] }),
  base('Add-ADPrincipalGroupMembership', (r) => changeMemberOf(r, true), [ID, { name: 'MemberOf', list: true, type: 'System.Object[]' }, { name: 'PassThru', switch: true }], { positional: ['Identity', 'MemberOf'], writes: true }),
  base('Remove-ADPrincipalGroupMembership', (r) => changeMemberOf(r, false), [ID, { name: 'MemberOf', list: true, type: 'System.Object[]' }, { name: 'PassThru', switch: true }], { positional: ['Identity', 'MemberOf'], writes: true }),
  base('New-ADOrganizationalUnit', newOu, [{ name: 'Name', type: 'System.String' }, { name: 'Path', type: 'System.String' }, { name: 'Description', type: 'System.String' }, { name: 'ProtectedFromAccidentalDeletion', type: 'System.Boolean' }, { name: 'PassThru', switch: true }], { positional: ['Name'], writes: true }),
  base('Set-ADOrganizationalUnit', setOu, [ID, { name: 'Description', type: 'System.String' }, { name: 'ProtectedFromAccidentalDeletion', type: 'System.Boolean' }, { name: 'PassThru', switch: true }], { positional: ['Identity'], writes: true }),
  base('Remove-ADOrganizationalUnit', (r) => removeObjects(r, 'Remove-ADOrganizationalUnit', ['organizationalUnit'], 'ADOrganizationalUnit'), [ID, { name: 'Recursive', switch: true }], { positional: ['Identity'], writes: true }),
  base('Move-ADObject', moveAdObject, [ID, { name: 'TargetPath', type: 'System.String' }, { name: 'PassThru', switch: true }], { positional: ['Identity', 'TargetPath'], writes: true }),
  base('Get-ADDomain', getDomain, [ID], { positional: ['Identity'] }),
  base('Get-ADDomainController', getDomainController, [ID, { name: 'Discover', switch: true }, { name: 'DomainName', type: 'System.String' }], { positional: ['Identity'] }),
  base('Get-ADDefaultDomainPasswordPolicy', passwordPolicy, [ID], { positional: ['Identity'] }),
  base(
    'Set-ADDefaultDomainPasswordPolicy', setPasswordPolicy,
    [ID, { name: 'LockoutThreshold', type: 'System.Int32' }, { name: 'LockoutDuration', type: 'System.Object' }, { name: 'LockoutObservationWindow', type: 'System.Object' }, { name: 'MinPasswordLength', type: 'System.Int32' }, { name: 'PasswordHistoryCount', type: 'System.Int32' }, { name: 'ComplexityEnabled', type: 'System.Boolean' }, { name: 'MaxPasswordAge', type: 'System.Object' }, { name: 'MinPasswordAge', type: 'System.Object' }],
    { positional: ['Identity'], writes: true },
  ),
];

export const AD_VIEWS: Record<string, View> = Object.fromEntries(['ADUser', 'ADGroup', 'ADComputer', 'ADOrganizationalUnit', 'ADObject', 'ADAccount', 'ADPrincipal', 'ADDomain', 'ADDomainController', 'ADDefaultDomainPasswordPolicy', 'ADOptionalFeature'].map((t) => [t, { columns: [], list: true }]));

// ——— net user /domain ———

const OK = 'The command completed successfully.\n';
const yesNo = (b: boolean) => (b ? 'Yes' : 'No');
const when = (ms: number | null | undefined, never = 'Never') => (ms ? longDate(ms) : never);

/** net user [NAME] /domain: the domain's accounts, from the domain controller. */
export function netUserDomain(game: Shell, args: string[]) {
  const d = domainOf(game);
  if (!d) return { out: '', err: 'The request will be processed at a domain controller for domain WORKGROUP.\n\nSystem error 1355 has occurred.\n\nThe specified domain either does not exist or could not be contacted.\n', code: 2 };
  const { ad, dc } = d;
  const now = adClock(dc);
  const head = `The request will be processed at a domain controller for domain ${ad.dns}.\n`;
  const name = args.find((a) => !a.startsWith('/'));
  const users = ad.objects.filter((o) => o.cls === 'user');
  if (!name) {
    const names = users.map((u) => u.sam!).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    const rows: string[] = [];
    for (let i = 0; i < names.length; i += 3) rows.push(names.slice(i, i + 3).map((n, k) => (k < 2 ? n.padEnd(25) : n)).join('').trimEnd());
    return { out: [head, `User accounts for \\\\${ad.dc}.${ad.dns}`, '', '-'.repeat(79), ...rows, OK].join('\n'), code: 0 };
  }
  const u = findIdentity(ad, name, ['user']);
  if (!u) return { out: head, err: 'The user name could not be found.\n\nMore help is available by typing NET HELPMSG 2221.\n', code: 2 };
  const pad = (k: string, v: string) => `${k.padEnd(29)}${v}`.trimEnd();
  const groupsText = (gs: AdObject[]) => gs.map((g) => `*${g.name}`).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())).map((g, i) => (i % 2 ? g : g.padEnd(21))).join('').trimEnd() || '*None';
  const direct = directGroups(ad, u);
  const expires = passwordExpiry(ad, u);
  return {
    out: [
      head,
      pad('User name', u.sam!),
      pad('Full Name', u.display ?? u.name),
      pad('Comment', u.description ?? ''),
      pad("User's comment", ''),
      pad('Country/region code', '000 (System Default)'),
      pad('Account active', u.enabled === false ? 'No' : lockedOut(ad, u, now) ? 'Locked' : 'Yes'),
      pad('Account expires', when(u.accountExpires)),
      '',
      pad('Password last set', u.mustChange ? 'Never' : when(u.passwordLastSet)),
      pad('Password expires', u.mustChange ? 'Never' : when(expires)),
      pad('Password changeable', when(u.passwordLastSet ? u.passwordLastSet + ad.policy.minAge * DAY : null)),
      pad('Password required', 'Yes'),
      pad('User may change password', yesNo(!u.cannotChange)),
      '',
      pad('Workstations allowed', 'All'),
      pad('Logon script', ''),
      pad('User profile', ''),
      pad('Home directory', ''),
      pad('Last logon', when(u.lastLogon)),
      '',
      pad('Logon hours allowed', 'All'),
      '',
      pad('Local Group Memberships', groupsText(direct.filter((g) => g.scope === 'DomainLocal'))),
      pad('Global Group memberships', groupsText(direct.filter((g) => g.scope !== 'DomainLocal'))),
      OK,
    ].join('\n'),
    code: 0,
  };
}

NET_HOOKS.userDomain = netUserDomain;
