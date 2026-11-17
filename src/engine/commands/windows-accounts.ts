// Local users and groups from PowerShell (Microsoft.PowerShell.LocalAccounts)
// and from cmd (net user, net localgroup, net accounts), whoami, and the
// secure strings a password goes through (Read-Host -AsSecureString,
// ConvertTo-SecureString -AsPlainText -Force). Changing a password does
// not tell the services and tasks that kept the old one (see
// windows-services.ts, windows-tasks.ts).
// Sources (Microsoft Learn): Get-LocalUser, New-LocalUser, Set-LocalUser,
// Remove-LocalUser, Enable-LocalUser, Disable-LocalUser, Get-LocalGroup,
// New-LocalGroup, Get-LocalGroupMember, Add-LocalGroupMember,
// Remove-LocalGroupMember
// (https://learn.microsoft.com/powershell/module/microsoft.powershell.localaccounts/?view=powershell-5.1),
// ConvertTo-SecureString (Microsoft.PowerShell.Security), net user, net
// localgroup, net accounts
// (https://learn.microsoft.com/windows-server/administration/windows-commands/net-user),
// whoami (https://learn.microsoft.com/windows-server/administration/windows-commands/whoami).
// Differences (docs/SCENARIOS.md): no domain accounts, no password history,
// net user's "*" prompt is not simulated.

import type { Shell } from '../shell';
import { longDate, windows } from '../windows';
import { BUILTIN_RIDS, WELL_KNOWN, canonical, machineSid, principal, token } from '../windows-acl';
import {
  ensureAccounts, findGroup, findUser, groupId, groups, passwordExpires, passwordProblem, setPassword, syncAccounts, users, type WinGroup, type WinUser,
} from '../windows-accounts';
import { PSDate, PSSecureString, arr, isObject, str, text, values, wildcard, type Cmdlet, type Native, type PSObject, type Run, type View } from '../powershell';

const LOCAL = 'Microsoft.PowerShell.LocalAccounts';
const DAY = 86_400_000;
const fq = (c: string, id: string) => `${id},Microsoft.PowerShell.Commands.${c}Command`;

function userObject(game: Shell, u: WinUser): PSObject {
  const expires = passwordExpires(game, u);
  return {
    type: 'LocalUser',
    fullType: 'Microsoft.PowerShell.Commands.LocalUser',
    text: u.name,
    data: u,
    props: {
      AccountExpires: null,
      Description: u.description,
      Enabled: u.enabled,
      FullName: u.fullName,
      PasswordChangeableDate: u.passwordLastSet === null ? null : new PSDate(u.passwordLastSet + DAY),
      PasswordExpires: expires === null ? null : new PSDate(expires),
      UserMayChangePassword: u.mayChange !== false,
      PasswordRequired: u.name !== 'Guest' && u.name !== 'DefaultAccount' && u.name !== 'WDAGUtilityAccount',
      PasswordLastSet: u.passwordLastSet === null ? null : new PSDate(u.passwordLastSet),
      LastLogon: u.lastLogon === null ? null : new PSDate(u.lastLogon),
      Name: u.name,
      SID: `${machineSid(game)}-${u.rid}`,
      PrincipalSource: 'Local',
      ObjectClass: 'User',
    },
  };
}

function groupObject(game: Shell, g: WinGroup): PSObject {
  return {
    type: 'LocalGroup',
    fullType: 'Microsoft.PowerShell.Commands.LocalGroup',
    text: g.name,
    data: g,
    props: { Description: g.description, Name: g.name, SID: g.builtin ? `S-1-5-32-${g.rid}` : `${machineSid(game)}-${g.rid}`, PrincipalSource: 'Local', ObjectClass: 'Group' },
  };
}

const userNotFound = (r: Run, cmdlet: string, name: string) =>
  r.fail({ message: `User ${name} was not found.`, category: 'ObjectNotFound', target: `${name}:String`, exception: 'UserNotFoundException', id: fq(cmdlet, 'UserNotFound') });
const groupNotFound = (r: Run, cmdlet: string, name: string) =>
  r.fail({ message: `Group ${name} was not found.`, category: 'ObjectNotFound', target: `${name}:String`, exception: 'GroupNotFoundException', id: fq(cmdlet, 'GroupNotFound') });

/** The users named by -Name (wildcards), -InputObject or the pipeline. */
function namedUsers(r: Run, cmdlet: string): WinUser[] {
  const all = Object.values(users(r.game));
  const fromInput = (r.input ?? []).concat(values(r.p.InputObject)).map((x) => (isObject(x) && x.type === 'LocalUser' ? (x.data as WinUser).name : text(x)));
  const names = [...arr(r.p.Name), ...fromInput];
  if (!names.length && r.p.SID === undefined) return cmdlet === 'GetLocalUser' ? all.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase())) : [];
  const out: WinUser[] = [];
  for (const n of names) {
    const found = /[*?]/.test(n) ? all.filter((u) => wildcard(n).test(u.name)) : [findUser(r.game, n)].filter((u): u is WinUser => !!u);
    if (!found.length && !/[*?]/.test(n)) userNotFound(r, cmdlet, n);
    out.push(...found);
  }
  for (const sid of arr(r.p.SID)) {
    const u = all.find((x) => `${machineSid(r.game)}-${x.rid}`.toLowerCase() === sid.toLowerCase());
    if (u) out.push(u);
    else userNotFound(r, cmdlet, sid);
  }
  return out;
}

function getLocalUser(r: Run): unknown[] {
  return namedUsers(r, 'GetLocalUser').map((u) => userObject(r.game, u));
}

/** A SecureString parameter's text (the binding already refused a plain string). */
const secret = (v: unknown) => (v instanceof PSSecureString ? v.plain : null);

function newLocalUser(r: Run): unknown[] {
  const name = str(r.p.Name);
  const all = users(r.game);
  if (findUser(r.game, name)) {
    r.fail({ message: `User ${name} already exists.`, category: 'ResourceExists', target: `${name}:String`, exception: 'UserExistsException', id: fq('NewLocalUser', 'UserExists') });
    return [];
  }
  if (name.length > 20 || /["/\\[\]:;|=,+*?<>@]/.test(name)) {
    r.fail({ message: `The name ${name} is not valid.`, category: 'InvalidArgument', target: `${name}:String`, exception: 'InvalidNameException', id: fq('NewLocalUser', 'InvalidName') });
    return [];
  }
  const password = secret(r.p.Password);
  if (password === null && !r.p.NoPassword) {
    r.fail({ message: `Cannot process command because of one or more missing mandatory parameters: Password.`, category: 'InvalidArgument', target: ':', exception: 'ParameterBindingException', id: fq('NewLocalUser', 'MissingMandatoryParameter') });
    return [];
  }
  if (password !== null && passwordProblem(r.game, name, password)) {
    r.fail({ message: 'Unable to update the password. The value provided for the new password does not meet the length, complexity, or history requirements of the domain.', category: 'InvalidOperation', target: `${name}:String`, exception: 'InvalidPasswordException', id: fq('NewLocalUser', 'InvalidPassword') });
    return [];
  }
  if (!r.should('Create Local User', name)) return [];
  const rid = Math.max(1000, ...Object.values(all).map((u) => u.rid + 1));
  const u: WinUser = { name, fullName: str(r.p.FullName), description: str(r.p.Description), enabled: !r.p.Disabled, rid, passwordLastSet: password === null ? null : windows(r.game).clock, neverExpires: !!r.p.PasswordNeverExpires, mayChange: !r.p.UserMayNotChangePassword, lastLogon: null };
  all[name] = u;
  if (password !== null) windows(r.game).passwords[name] = password;
  syncAccounts(r.game);
  return [userObject(r.game, u)];
}

function setLocalUser(r: Run): unknown[] {
  for (const u of namedUsers(r, 'SetLocalUser')) {
    if (!r.should('Modify local user', u.name)) continue;
    const password = secret(r.p.Password);
    if (password !== null) {
      if (passwordProblem(r.game, u.name, password)) {
        r.fail({ message: 'Unable to update the password. The value provided for the new password does not meet the length, complexity, or history requirements of the domain.', category: 'InvalidOperation', target: `${u.name}:String`, exception: 'InvalidPasswordException', id: fq('SetLocalUser', 'InvalidPassword') });
        continue;
      }
      setPassword(r.game, u, password);
    }
    if (r.p.Description !== undefined) u.description = str(r.p.Description);
    if (r.p.FullName !== undefined) u.fullName = str(r.p.FullName);
    if (r.p.PasswordNeverExpires !== undefined) u.neverExpires = !!r.p.PasswordNeverExpires;
    if (r.p.UserMayChangePassword !== undefined) u.mayChange = !!r.p.UserMayChangePassword;
  }
  return [];
}

function enableUser(r: Run, enabled: boolean): unknown[] {
  for (const u of namedUsers(r, enabled ? 'EnableLocalUser' : 'DisableLocalUser')) {
    if (!r.should(enabled ? 'Enable local user' : 'Disable local user', u.name)) continue;
    u.enabled = enabled;
  }
  syncAccounts(r.game);
  return [];
}

function removeLocalUser(r: Run): unknown[] {
  for (const u of namedUsers(r, 'RemoveLocalUser')) {
    if (!r.should('Remove local user', u.name)) continue;
    delete users(r.game)[u.name];
    for (const g of Object.values(groups(r.game))) g.members = g.members.filter((m) => canonical(r.game, m).toLowerCase() !== `${windows(r.game).computer}\\${u.name}`.toLowerCase());
    delete r.game.accounts.users[u.name];
    delete windows(r.game).passwords[u.name];
  }
  return [];
}

/** The groups named by -Name, -Group, -InputObject or the pipeline. */
function namedGroups(r: Run, cmdlet: string, param = 'Name'): WinGroup[] {
  const all = Object.values(groups(r.game));
  const fromInput = (param === 'Name' ? r.input ?? [] : []).concat(values(r.p.InputObject)).map((x) => (isObject(x) && x.type === 'LocalGroup' ? (x.data as WinGroup).name : text(x)));
  const names = [...arr(r.p[param]), ...fromInput];
  if (!names.length) return cmdlet === 'GetLocalGroup' ? all.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase())) : [];
  const out: WinGroup[] = [];
  for (const n of names) {
    const found = /[*?]/.test(n) ? all.filter((g) => wildcard(n).test(g.name)) : [findGroup(r.game, n)].filter((g): g is WinGroup => !!g);
    if (!found.length && !/[*?]/.test(n)) groupNotFound(r, cmdlet, n);
    out.push(...found);
  }
  return out;
}

function newLocalGroup(r: Run): unknown[] {
  const name = str(r.p.Name);
  if (findGroup(r.game, name) || findUser(r.game, name)) {
    r.fail({ message: `Group ${name} already exists.`, category: 'ResourceExists', target: `${name}:String`, exception: 'GroupExistsException', id: fq('NewLocalGroup', 'GroupExists') });
    return [];
  }
  if (!r.should('Create Local Group', name)) return [];
  const all = groups(r.game);
  const rid = Math.max(1000, ...Object.values(users(r.game)).map((u) => u.rid + 1), ...Object.values(all).filter((g) => !g.builtin).map((g) => g.rid + 1));
  const g: WinGroup = { name, description: str(r.p.Description), rid, members: [] };
  all[name] = g;
  syncAccounts(r.game);
  return [groupObject(r.game, g)];
}

function memberObject(game: Shell, id: string): PSObject {
  const p = principal(game, id);
  const name = p?.name ?? id;
  const kind = p?.kind === 'User' ? 'User' : 'Group';
  return { type: 'LocalPrincipal', fullType: 'Microsoft.PowerShell.Commands.LocalPrincipal', text: name, props: { ObjectClass: kind, Name: name, PrincipalSource: p?.source ?? 'Unknown', SID: p?.sid ?? '' } };
}

function getLocalGroupMember(r: Run): unknown[] {
  const out: unknown[] = [];
  for (const g of namedGroups(r, 'GetLocalGroupMember', 'Group')) {
    const filter = arr(r.p.Member);
    out.push(...g.members.map((m) => memberObject(r.game, m)).filter((m) => !filter.length || filter.some((f) => wildcard(f).test(String(m.props.Name)) || wildcard(f).test(String(m.props.Name).replace(/^.*\\/, '')))));
  }
  return out;
}

function changeMembers(r: Run, add: boolean): unknown[] {
  const cmdlet = add ? 'AddLocalGroupMember' : 'RemoveLocalGroupMember';
  const members = [...values(r.p.Member), ...(r.input ?? [])].map((x) => (isObject(x) ? text(x.props.Name ?? x.text) : text(x)));
  for (const g of namedGroups(r, cmdlet, 'Group')) {
    for (const m of members) {
      const p = principal(r.game, m);
      if (!p) {
        r.fail({ message: `Principal ${m} was not found.`, category: 'ObjectNotFound', target: `${m}:String`, exception: 'PrincipalNotFoundException', id: fq(cmdlet, 'PrincipalNotFound') });
        continue;
      }
      const there = g.members.some((x) => canonical(r.game, x) === p.name);
      if (add && there) {
        r.fail({ message: `${p.name} is already a member of group ${g.name}.`, category: 'ResourceExists', target: `${g.name}:String`, exception: 'MemberExistsException', id: fq(cmdlet, 'MemberExists') });
        continue;
      }
      if (!add && !there) {
        r.fail({ message: `Member ${p.name} was not found in group ${g.name}.`, category: 'ObjectNotFound', target: `${p.name}:String`, exception: 'MemberNotFoundException', id: fq(cmdlet, 'MemberNotFound') });
        continue;
      }
      if (!r.should(add ? 'Add member' : 'Remove member', `${p.name} ${add ? 'to' : 'from'} ${g.name}`)) continue;
      if (add) g.members.push(p.name);
      else g.members = g.members.filter((x) => canonical(r.game, x) !== p.name);
    }
  }
  syncAccounts(r.game);
  return [];
}

function convertToSecureString(r: Run): unknown[] {
  const plain = str(r.p.String) || (r.input ?? []).map(text).join('');
  if (!r.p.AsPlainText) {
    r.fail({ message: 'Input string was not in a correct format.', category: 'InvalidArgument', target: ':', exception: 'FormatException', id: 'ImportSecureString_InvalidArgument,Microsoft.PowerShell.Commands.ConvertToSecureStringCommand' });
    return [];
  }
  if (!r.p.Force) {
    r.fail({ message: 'The system cannot protect plain text input. To suppress this warning and convert the plain text to a SecureString, reissue the command specifying the Force parameter. For more information ,type: get-help ConvertTo-SecureString.', category: 'InvalidArgument', target: ':', exception: 'ArgumentException', id: 'ImportSecureString_InvalidArgument,Microsoft.PowerShell.Commands.ConvertToSecureStringCommand' });
    return [];
  }
  return [new PSSecureString(plain)];
}

const NAME = { name: 'Name', list: true };
const SECURE = { name: 'Password', type: 'System.Security.SecureString' };

export const ACCOUNT_CMDLETS: Cmdlet[] = [
  { name: 'Get-LocalUser', module: LOCAL, version: '1.0.0.0', positional: ['Name'], params: [NAME, { name: 'SID', list: true }], run: getLocalUser },
  {
    name: 'New-LocalUser', module: LOCAL, version: '1.0.0.0', writes: true, positional: ['Name'],
    params: [{ name: 'Name', type: 'System.String' }, SECURE, { name: 'NoPassword', switch: true }, { name: 'FullName', type: 'System.String' }, { name: 'Description', type: 'System.String' }, { name: 'Disabled', switch: true }, { name: 'PasswordNeverExpires', switch: true }, { name: 'UserMayNotChangePassword', switch: true }, { name: 'AccountNeverExpires', switch: true }],
    run: newLocalUser,
  },
  {
    name: 'Set-LocalUser', module: LOCAL, version: '1.0.0.0', writes: true, positional: ['Name'],
    params: [NAME, { name: 'InputObject', type: 'Microsoft.PowerShell.Commands.LocalUser' }, SECURE, { name: 'FullName', type: 'System.String' }, { name: 'Description', type: 'System.String' }, { name: 'PasswordNeverExpires', type: 'System.Boolean' }, { name: 'UserMayChangePassword', type: 'System.Boolean' }, { name: 'AccountNeverExpires', switch: true }],
    run: setLocalUser,
  },
  { name: 'Enable-LocalUser', module: LOCAL, version: '1.0.0.0', writes: true, positional: ['Name'], params: [NAME, { name: 'InputObject', type: 'Microsoft.PowerShell.Commands.LocalUser[]' }], run: (r) => enableUser(r, true) },
  { name: 'Disable-LocalUser', module: LOCAL, version: '1.0.0.0', writes: true, positional: ['Name'], params: [NAME, { name: 'InputObject', type: 'Microsoft.PowerShell.Commands.LocalUser[]' }], run: (r) => enableUser(r, false) },
  { name: 'Remove-LocalUser', module: LOCAL, version: '1.0.0.0', writes: true, positional: ['Name'], params: [NAME, { name: 'InputObject', type: 'Microsoft.PowerShell.Commands.LocalUser[]' }], run: removeLocalUser },
  { name: 'Get-LocalGroup', module: LOCAL, version: '1.0.0.0', positional: ['Name'], params: [NAME], run: (r) => namedGroups(r, 'GetLocalGroup').map((g) => groupObject(r.game, g)) },
  { name: 'New-LocalGroup', module: LOCAL, version: '1.0.0.0', writes: true, positional: ['Name'], params: [{ name: 'Name', type: 'System.String' }, { name: 'Description', type: 'System.String' }], run: newLocalGroup },
  { name: 'Get-LocalGroupMember', module: LOCAL, version: '1.0.0.0', positional: ['Group', 'Member'], params: [{ name: 'Group', type: 'System.String', aliases: ['Name'] }, { name: 'Member', type: 'System.String' }], run: getLocalGroupMember },
  { name: 'Add-LocalGroupMember', module: LOCAL, version: '1.0.0.0', writes: true, positional: ['Group', 'Member'], params: [{ name: 'Group', type: 'System.String', aliases: ['Name'] }, { name: 'Member', list: true, type: 'Microsoft.PowerShell.Commands.LocalPrincipal[]' }], run: (r) => changeMembers(r, true) },
  { name: 'Remove-LocalGroupMember', module: LOCAL, version: '1.0.0.0', writes: true, positional: ['Group', 'Member'], params: [{ name: 'Group', type: 'System.String', aliases: ['Name'] }, { name: 'Member', list: true, type: 'Microsoft.PowerShell.Commands.LocalPrincipal[]' }], run: (r) => changeMembers(r, false) },
  {
    name: 'ConvertTo-SecureString', module: 'Microsoft.PowerShell.Security', version: '3.0.0.0', positional: ['String'],
    params: [{ name: 'String', type: 'System.String' }, { name: 'AsPlainText', switch: true }, { name: 'Force', switch: true }, { name: 'Key', type: 'System.Byte[]' }],
    run: convertToSecureString,
  },
];

export const ACCOUNT_VIEWS: Record<string, View> = {
  LocalUser: { columns: ['Name', 'Enabled', 'Description'].map((n) => ({ label: n, value: (o: PSObject) => o.props[n], right: false })) },
  LocalGroup: { columns: ['Name', 'Description'].map((n) => ({ label: n, value: (o: PSObject) => o.props[n] })) },
  LocalPrincipal: { columns: ['ObjectClass', 'Name', 'PrincipalSource'].map((n) => ({ label: n, value: (o: PSObject) => o.props[n] })) },
};

// ——— net user, net localgroup, net accounts ———

const OK = 'The command completed successfully.\n';
const columns = (names: string[]) => {
  const rows: string[] = [];
  for (let i = 0; i < names.length; i += 3) rows.push(names.slice(i, i + 3).map((n, k) => (k < 2 ? n.padEnd(25) : n)).join('').trimEnd());
  return rows;
};
const yesNo = (b: boolean) => (b ? 'Yes' : 'No');
const when = (ms: number | null, never = 'Never') => (ms === null ? never : longDate(ms));

function netUser(game: Shell, args: string[]) {
  const w = windows(game);
  ensureAccounts(game);
  const [name, ...rest] = args;
  if (!name) {
    const names = Object.keys(users(game)).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    return { out: ['', `User accounts for \\\\${w.computer}`, '', '-'.repeat(79), ...columns(names), OK].join('\n'), code: 0 };
  }
  const u = findUser(game, name);
  const add = rest.some((a) => a.toLowerCase() === '/add');
  if (add) {
    if (u) return { out: '', err: 'The account already exists.\n\nMore help is available by typing NET HELPMSG 2224.\n', code: 2 };
    const password = rest.find((a) => !a.startsWith('/')) ?? '';
    if (passwordProblem(game, name, password)) return { out: '', err: 'The password does not meet the password policy requirements. Check the minimum password length, password complexity and password history requirements.\n\nMore help is available by typing NET HELPMSG 2245.\n', code: 2 };
    const all = users(game);
    all[name] = { name, fullName: '', description: '', enabled: true, rid: Math.max(1000, ...Object.values(all).map((x) => x.rid + 1)), passwordLastSet: w.clock, lastLogon: null };
    w.passwords[name] = password;
    groups(game).Users?.members.push(`${w.computer}\\${name}`);
    syncAccounts(game);
    return { out: OK, code: 0 };
  }
  if (!u) return { out: '', err: 'The user name could not be found.\n\nMore help is available by typing NET HELPMSG 2221.\n', code: 2 };
  if (rest.length) {
    for (const a of rest) {
      const m = /^\/active:(yes|no)$/i.exec(a);
      if (m) u.enabled = m[1].toLowerCase() === 'yes';
      else if (/^\/delete$/i.test(a)) {
        delete users(game)[u.name];
        delete w.passwords[u.name];
      } else if (!a.startsWith('/')) {
        if (a === '*') return { out: '', err: game.t('net-password-prompt'), code: 1 };
        if (passwordProblem(game, u.name, a)) return { out: '', err: 'The password does not meet the password policy requirements. Check the minimum password length, password complexity and password history requirements.\n\nMore help is available by typing NET HELPMSG 2245.\n', code: 2 };
        setPassword(game, u, a);
      }
    }
    syncAccounts(game);
    return { out: OK, code: 0 };
  }
  const local = Object.values(groups(game)).filter((g) => g.members.some((m) => canonical(game, m) === `${w.computer}\\${u.name}`))
    .map((g) => `*${g.name}`)
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  const pad = (k: string, v: string) => `${k.padEnd(29)}${v}`.trimEnd();
  const lines = [
    pad('User name', u.name),
    pad('Full Name', u.fullName),
    pad('Comment', u.description),
    pad("User's comment", ''),
    pad('Country/region code', '000 (System Default)'),
    pad('Account active', yesNo(u.enabled)),
    pad('Account expires', 'Never'),
    '',
    pad('Password last set', when(u.passwordLastSet)),
    pad('Password expires', when(passwordExpires(game, u))),
    pad('Password changeable', when(u.passwordLastSet === null ? null : u.passwordLastSet + DAY)),
    pad('Password required', yesNo(!['Guest', 'DefaultAccount', 'WDAGUtilityAccount'].includes(u.name))),
    pad('User may change password', yesNo(u.mayChange !== false)),
    '',
    pad('Workstations allowed', 'All'),
    pad('Logon script', ''),
    pad('User profile', ''),
    pad('Home directory', ''),
    pad('Last logon', when(u.lastLogon)),
    '',
    pad('Logon hours allowed', 'All'),
    '',
    pad('Local Group Memberships', local.map((g, i) => (i % 2 ? g : g.padEnd(21))).join('').trimEnd()),
    pad('Global Group memberships', '*None'),
    OK,
  ];
  return { out: lines.join('\n'), code: 0 };
}

function netLocalgroup(game: Shell, args: string[]) {
  const w = windows(game);
  ensureAccounts(game);
  const [name, ...rest] = args;
  if (!name) {
    const names = Object.keys(groups(game)).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())).map((g) => `*${g}`);
    return { out: ['', `Aliases for \\\\${w.computer}`, '', '-'.repeat(79), ...names, OK].join('\n'), code: 0 };
  }
  const g = findGroup(game, name);
  if (!g) return { out: '', err: 'The specified local group does not exist.\n\nMore help is available by typing NET HELPMSG 3780.\n', code: 2 };
  const op = rest.find((a) => /^\/(add|delete)$/i.test(a))?.toLowerCase();
  const members = rest.filter((a) => !a.startsWith('/'));
  if (op) {
    for (const m of members) {
      const p = principal(game, m);
      if (!p) return { out: '', err: 'There is no such global user or group: ' + m + '.\n\nMore help is available by typing NET HELPMSG 3783.\n', code: 2 };
      const there = g.members.some((x) => canonical(game, x) === p.name);
      if (op === '/add' && there) return { out: '', err: `System error 1378 has occurred.\n\nThe specified account name is already a member of the group.\n`, code: 2 };
      if (op === '/delete' && !there) return { out: '', err: `System error 1377 has occurred.\n\nThe specified account name is not a member of the group.\n`, code: 2 };
      if (op === '/add') g.members.push(p.name);
      else g.members = g.members.filter((x) => canonical(game, x) !== p.name);
    }
    syncAccounts(game);
    return { out: OK, code: 0 };
  }
  const shown = g.members.map((m) => {
    const c = canonical(game, m);
    return c.toLowerCase().startsWith(`${w.computer.toLowerCase()}\\`) ? c.slice(w.computer.length + 1) : c;
  });
  return { out: [`Alias name     ${g.name}`, `Comment        ${g.description}`, '', 'Members', '', '-'.repeat(79), ...shown, OK].join('\n'), code: 0 };
}

function netAccounts(game: Shell) {
  const p = windows(game).policy ?? { maxAge: 42, minLength: 0, complexity: true };
  const pad = (k: string, v: string) => `${k.padEnd(54)}${v}`;
  return {
    out: [
      pad('Force user logoff how long after time expires?:', 'Never'),
      pad('Minimum password age (days):', '0'),
      pad('Maximum password age (days):', p.maxAge ? String(p.maxAge) : 'Unlimited'),
      pad('Minimum password length:', String(p.minLength)),
      pad('Length of password history maintained:', 'None'),
      pad('Lockout threshold:', 'Never'),
      pad('Lockout duration (minutes):', '10'),
      pad('Lockout observation window (minutes):', '10'),
      pad('Computer role:', 'SERVER'),
      OK,
    ].join('\n'),
    code: 0,
  };
}

/** net: user, localgroup, accounts, start, stop, share, helpmsg (the services' part comes from windows-services.ts). */
export function netAccountsPart(game: Shell, args: string[]) {
  const [sub, ...rest] = args;
  switch (sub?.toLowerCase()) {
    case 'user':
    case 'users':
      return netUser(game, rest);
    case 'localgroup':
      return netLocalgroup(game, rest);
    case 'accounts':
      return netAccounts(game);
  }
  return null;
}

// ——— whoami ———

function whoami(game: Shell, args: string[]) {
  const w = windows(game);
  const me = `${w.computer.toLowerCase()}\\${game.who}`;
  if (!args.length) return { out: me, code: 0 };
  const a = args[0].toLowerCase();
  const u = findUser(game, game.who);
  const sid = u ? `${machineSid(game)}-${u.rid}` : 'S-1-5-18';
  if (a === '/user')
    return { out: ['', 'USER INFORMATION', '----------------', '', `${'User Name'.padEnd(me.length)} SID`, `${'='.repeat(me.length)} ${'='.repeat(sid.length)}`, `${me} ${sid}`].join('\n'), code: 0 };
  if (a === '/groups') {
    const ids = [...token(game, game.who)].filter((x) => !x.toLowerCase().endsWith(`\\${game.who.toLowerCase()}`));
    const rows = ids.map((id) => {
      const wk = WELL_KNOWN.find((x) => x.name === id);
      const b = /^BUILTIN\\(.+)$/.exec(id);
      const s = wk?.sid ?? (b ? `S-1-5-32-${BUILTIN_RIDS[b[1]]?.[0] ?? groups(game)[b[1]]?.rid}` : (principal(game, id)?.sid ?? ''));
      const type = wk ? 'Well-known group' : b ? 'Alias' : 'Alias';
      return [id, type, s, 'Mandatory group, Enabled by default, Enabled group'];
    });
    const width = [0, 1, 2].map((i) => Math.max(['Group Name', 'Type', 'SID'][i].length, ...rows.map((r) => r[i].length)));
    const line = (r: string[]) => r.map((c, i) => (i < 3 ? c.padEnd(width[i]) : c)).join(' ').trimEnd();
    return { out: ['', 'GROUP INFORMATION', '-----------------', '', line(['Group Name', 'Type', 'SID', 'Attributes']), line(width.map((n) => '='.repeat(n)).concat('='.repeat(50))), ...rows.map(line)].join('\n'), code: 0 };
  }
  return { out: '', err: `ERROR: Invalid argument/option - '${args[0]}'.\nType "WHOAMI /?" for usage.`, code: 1 };
}

export const ACCOUNT_NATIVES: Native[] = [{ name: 'whoami.exe', run: (game, args) => whoami(game, args) }];

export { groupId };
