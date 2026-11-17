// NTFS permissions from PowerShell and cmd: Get-Acl (the owner, the entries
// with their rights, type, identity, inheritance, as Format-List and the
// table show them; AccessToString, Sddl), Set-Acl with an ACL changed by
// its methods (SetAccessRule, AddAccessRule, RemoveAccessRule,
// RemoveAccessRuleAll, PurgeAccessRules, SetAccessRuleProtection, SetOwner)
// and New-Object System.Security.AccessControl.FileSystemAccessRule;
// icacls (display, /grant[:r], /deny, /remove[:g|:d], /inheritance:e|d|r,
// /setowner, /reset, /T, /C, /Q) and takeown (/F, /A, /R).
// Sources (Microsoft Learn): Get-Acl, Set-Acl
// (https://learn.microsoft.com/powershell/module/microsoft.powershell.security/get-acl?view=powershell-5.1),
// FileSystemAccessRule (https://learn.microsoft.com/dotnet/api/system.security.accesscontrol.filesystemaccessrule),
// FileSystemSecurity methods (https://learn.microsoft.com/dotnet/api/system.security.accesscontrol.filesystemsecurity),
// icacls (https://learn.microsoft.com/windows-server/administration/windows-commands/icacls),
// takeown (https://learn.microsoft.com/windows-server/administration/windows-commands/takeown).
// Differences (docs/SCENARIOS.md): no SACL (Audit stays empty), icacls'
// exit code for an unknown account (1332) and its /save and /restore are
// not simulated.

import type { Shell } from '../shell';
import type { NtfsAce } from '../world';
import { resolveWindows, toWindows, windows } from '../windows';
import {
  R, accessLine, canonical, canNtfs, descriptor, icaclsLines, inheritanceFlags, ownAcl, parseGrant, principal, propagationFlags, rightsFromName, rightsName, sddl, token, type Descriptor,
} from '../windows-acl';
import { MethodError, arr, isObject, text, wildcard, type Cmdlet, type Native, type PSObject, type Run, type View } from '../powershell';
import { locate } from './windows-files';

const SECURITY = 'Microsoft.PowerShell.Security';
const SYNC = R.Synchronize;

/** A FileSystemAccessRule object. */
export function ruleObject(a: NtfsAce & { inherited?: boolean }): PSObject {
  return {
    type: 'FileSystemAccessRule',
    fullType: 'System.Security.AccessControl.FileSystemAccessRule',
    data: a,
    props: {
      FileSystemRights: rightsName(a.mask),
      AccessControlType: a.deny ? 'Deny' : 'Allow',
      IdentityReference: a.id,
      IsInherited: !!a.inherited,
      InheritanceFlags: inheritanceFlags(a),
      PropagationFlags: propagationFlags(a),
    },
  };
}

interface AclData {
  path: string;
  owner: string;
  protected: boolean;
  explicit: NtfsAce[];
  inherited: (NtfsAce & { inherited: boolean })[];
}

const sameFlags = (a: NtfsAce, b: NtfsAce) => !!a.oi === !!b.oi && !!a.ci === !!b.ci && !!a.io === !!b.io && !!a.np === !!b.np;

/** The ACL object of Get-Acl, whose methods change a working copy (applied by Set-Acl). */
function aclObject(game: Shell, path: string, d: Descriptor): PSObject {
  const data: AclData = { path, owner: d.owner, protected: d.protected, explicit: d.aces.filter((a) => !a.inherited).map(({ inherited: _i, from: _f, ...a }) => a), inherited: d.aces.filter((a) => a.inherited) };
  const win = toWindows(path);
  const node = game.find(path)!;
  const o: PSObject = { type: 'FileSecurity', fullType: node.type === 'directory' ? 'System.Security.AccessControl.DirectorySecurity' : 'System.Security.AccessControl.FileSecurity', group: toWindows(path.replace(/\/[^/]+$/, '') || '/'), data, props: {}, text: node.type === 'directory' ? 'System.Security.AccessControl.DirectorySecurity' : 'System.Security.AccessControl.FileSecurity' };
  const refresh = () => {
    const all = [...data.explicit.map((a) => ({ ...a, inherited: false })), ...(data.protected ? [] : data.inherited)];
    const desc: Descriptor = { owner: data.owner, protected: data.protected, aces: all };
    o.props = {
      Path: `Microsoft.PowerShell.Core\\FileSystem::${win}`,
      Owner: data.owner,
      Group: `${windows(game).computer}\\None`,
      Access: all.map(ruleObject),
      Audit: '',
      Sddl: sddl(game, desc),
      AccessToString: all.map(accessLine).join('\n'),
      PSChildName: win.split('\\').filter(Boolean).at(-1) ?? win,
    };
  };
  const ruleOf = (v: unknown): NtfsAce => {
    if (!isObject(v) || v.type !== 'FileSystemAccessRule') throw new MethodError('Cannot convert argument "rule", with value: "' + text(v) + '", for "SetAccessRule" to type "System.Security.AccessControl.FileSystemAccessRule"', 'MethodArgumentConversionInvalidCastArgument');
    const a = v.data as NtfsAce;
    const p = principal(game, a.id);
    if (!p) throw new MethodError('Some or all identity references could not be translated.', 'IdentityNotMappedException');
    return { ...a, id: p.name };
  };
  o.methods = {
    setaccessrule: ([v]) => {
      const a = ruleOf(v);
      data.explicit = [...data.explicit.filter((x) => x.id !== a.id || !!x.deny !== !!a.deny), a];
      refresh();
      return null;
    },
    addaccessrule: ([v]) => {
      const a = ruleOf(v);
      const same = data.explicit.find((x) => x.id === a.id && !!x.deny === !!a.deny && sameFlags(x, a));
      if (same) same.mask |= a.mask;
      else data.explicit.push(a);
      refresh();
      return null;
    },
    removeaccessrule: ([v]) => {
      const a = ruleOf(v);
      let removed = false;
      for (const x of data.explicit)
        if (x.id === a.id && !!x.deny === !!a.deny && sameFlags(x, a) && x.mask & a.mask & ~SYNC) {
          x.mask &= ~(a.mask & ~SYNC);
          removed = true;
        }
      data.explicit = data.explicit.filter((x) => x.mask & ~SYNC);
      refresh();
      return removed;
    },
    removeaccessruleall: ([v]) => {
      const a = ruleOf(v);
      data.explicit = data.explicit.filter((x) => !(x.id === a.id && !!x.deny === !!a.deny));
      refresh();
      return null;
    },
    purgeaccessrules: ([v]) => {
      const id = canonical(game, isObject(v) ? text(v.props.Value ?? v.text) : text(v));
      data.explicit = data.explicit.filter((x) => x.id !== id);
      refresh();
      return null;
    },
    setaccessruleprotection: ([isProtected, preserve]) => {
      const was = data.protected;
      data.protected = !!isProtected;
      if (!was && data.protected && preserve) data.explicit.push(...data.inherited.filter((a) => !a.io || a.oi || a.ci).map(({ inherited: _i, ...a }) => ({ ...a })));
      refresh();
      return null;
    },
    setowner: ([v]) => {
      const p = principal(game, isObject(v) ? text(v.props.Value ?? v.text) : text(v));
      if (!p) throw new MethodError('Some or all identity references could not be translated.', 'IdentityNotMappedException');
      data.owner = p.name;
      refresh();
      return null;
    },
    getowner: () => data.owner,
    getaccessrules: () => o.props.Access,
    areaccessrulesprotected: () => data.protected,
  };
  refresh();
  return o;
}

function getAcl(r: Run): unknown[] {
  const out: unknown[] = [];
  const paths = arr(r.p.Path).length ? arr(r.p.Path) : (r.input ?? []).map((x) => (isObject(x) ? text(x.props.FullName ?? x.props.PSPath) : text(x)));
  for (const typed of paths.length ? paths : ['.']) {
    const w = locate(r.game, typed);
    if (w.kind !== 'fs' || !w.exists) {
      r.fail({ message: `Cannot find path '${w.win}' because it does not exist.`, category: 'ObjectNotFound', target: `${w.win}:String`, exception: 'ItemNotFoundException', id: 'GetAcl_PathNotFound_Exception,Microsoft.PowerShell.Commands.GetAclCommand' });
      continue;
    }
    if (!canNtfs(r.game, w.path, 'read') && !hasRight(r.game, w.path, R.ReadPermissions)) {
      r.fail({ message: 'Attempted to perform an unauthorized operation.', category: 'NotSpecified', target: ':', exception: 'UnauthorizedAccessException', id: 'System.UnauthorizedAccessException,Microsoft.PowerShell.Commands.GetAclCommand' });
      continue;
    }
    const d = descriptor(r.game, w.path) ?? { owner: 'BUILTIN\\Administrators', aces: [{ id: 'Everyone', mask: 0x1f01ff, inherited: false }], protected: false };
    out.push(aclObject(r.game, w.path, d));
  }
  return out;
}

const hasRight = (game: Shell, path: string, mask: number) => {
  const d = descriptor(game, path);
  if (!d) return true;
  const ids = token(game, game.who);
  if (ids.has(d.owner)) return true;
  return d.aces.some((a) => !a.io && !a.deny && ids.has(a.id) && (a.mask & mask) === mask);
};

/** Applies an ACL object's owner, protection and explicit entries to a path. */
function applyAcl(game: Shell, path: string, data: AclData): void {
  const acl = ownAcl(game, path);
  acl.owner = data.owner;
  acl.protected = data.protected;
  acl.aces = data.explicit.map((a) => ({ ...a }));
}

function setAcl(r: Run): unknown[] {
  const obj = r.p.AclObject;
  if (!isObject(obj) || !obj.data) {
    r.stop({ message: `Cannot bind parameter 'AclObject'. Cannot convert the "${text(obj)}" value of type "${typeof obj}" to type "System.Security.AccessControl.ObjectSecurity".`, category: 'InvalidArgument', target: ':', exception: 'ParameterBindingException', id: 'CannotConvertArgumentNoMessage,Microsoft.PowerShell.Commands.SetAclCommand' });
    return [];
  }
  const data = obj.data as AclData;
  const paths = arr(r.p.Path).length ? arr(r.p.Path) : [toWindows(data.path)];
  for (const typed of paths) {
    const w = locate(r.game, typed);
    if (w.kind !== 'fs' || !w.exists) {
      r.fail({ message: `Cannot find path '${w.win}' because it does not exist.`, category: 'ObjectNotFound', target: `${w.win}:String`, exception: 'ItemNotFoundException', id: 'SetAcl_PathNotFound_Exception,Microsoft.PowerShell.Commands.SetAclCommand' });
      continue;
    }
    const d = descriptor(r.game, w.path);
    const ids = token(r.game, r.game.who);
    const ownerChange = d && d.owner !== data.owner;
    const admin = ids.has('BUILTIN\\Administrators');
    if (!canNtfs(r.game, w.path, 'permissions') || (ownerChange && !admin && !(ids.has(data.owner) && hasRight(r.game, w.path, R.TakeOwnership)))) {
      r.fail({ message: 'Attempted to perform an unauthorized operation.', category: 'PermissionDenied', target: `${w.win}:String`, exception: 'UnauthorizedAccessException', id: 'System.UnauthorizedAccessException,Microsoft.PowerShell.Commands.SetAclCommand' });
      continue;
    }
    if (ownerChange && !admin && !ids.has(data.owner)) {
      r.fail({ message: 'The security identifier is not allowed to be the owner of this object.', category: 'InvalidOperation', target: `${w.win}:String`, exception: 'InvalidOperationException', id: 'System.InvalidOperationException,Microsoft.PowerShell.Commands.SetAclCommand' });
      continue;
    }
    if (!r.should('Set-Acl', w.win)) continue;
    applyAcl(r.game, w.path, data);
  }
  return r.p.Passthru ? [obj] : [];
}

/** New-Object System.Security.AccessControl.FileSystemAccessRule(identity, rights, [inheritance, propagation,] type). */
export function newRule(r: Run, args: unknown[]): PSObject | null {
  const [idArg, rightsArg, ...rest] = args;
  const type = text(rest.length >= 3 ? rest[2] : rest[0] ?? 'Allow');
  const inherit = rest.length >= 3 ? text(rest[0]) : 'None';
  const propagate = rest.length >= 3 ? text(rest[1]) : 'None';
  const id = isObject(idArg) ? text(idArg.props.Value ?? idArg.text) : text(idArg);
  const mask = typeof rightsArg === 'number' ? rightsArg : rightsFromName(text(rightsArg));
  const bad = (what: string) =>
    r.stop({ message: `Exception calling ".ctor" with "${args.length}" argument(s): "${what}"`, category: 'InvalidOperation', target: ':', exception: 'MethodInvocationException', id: 'ConstructorInvokedThrowException,Microsoft.PowerShell.Commands.NewObjectCommand' });
  if (mask === null) bad(`Cannot convert value "${text(rightsArg)}" to type "System.Security.AccessControl.FileSystemRights".`);
  if (!/^(allow|deny)$/i.test(type)) bad(`Cannot convert value "${type}" to type "System.Security.AccessControl.AccessControlType".`);
  const flags = inherit.toLowerCase();
  const deny = /^deny$/i.test(type);
  const ace: NtfsAce = {
    id: canonical(r.game, id),
    mask: deny ? mask! & ~SYNC : (mask! | SYNC) >>> 0,
    deny,
    oi: flags.includes('objectinherit'),
    ci: flags.includes('containerinherit'),
    io: /inheritonly/i.test(propagate),
    np: /nopropagateinherit/i.test(propagate),
  };
  return ruleObject(ace);
}

/** New-Object System.Security.Principal.NTAccount("CABINET\alice") or ("CABINET", "alice"). */
export function newAccount(_r: Run, args: unknown[]): PSObject {
  const value = args.length > 1 ? `${text(args[0])}\\${text(args[1])}` : text(args[0]);
  return { type: 'NTAccount', fullType: 'System.Security.Principal.NTAccount', props: { Value: value }, text: value };
}

export const ACL_TYPES: Record<string, (r: Run, args: unknown[]) => unknown> = {
  'security.accesscontrol.filesystemaccessrule': newRule,
  'security.principal.ntaccount': newAccount,
};

export const ACL_CMDLETS: Cmdlet[] = [
  { name: 'Get-Acl', module: SECURITY, version: '3.0.0.0', positional: ['Path'], params: [{ name: 'Path', list: true }, { name: 'Audit', switch: true }], run: getAcl },
  { name: 'Set-Acl', module: SECURITY, version: '3.0.0.0', writes: true, positional: ['Path', 'AclObject'], params: [{ name: 'Path', list: true }, { name: 'AclObject', type: 'System.Object' }, { name: 'Passthru', switch: true }], run: setAcl },
];

export const ACL_VIEWS: Record<string, View> = {
  FileSecurity: {
    group: (o) => `    Directory: ${o.group}`,
    columns: [
      { label: 'Path', value: (o) => o.props.PSChildName },
      { label: 'Owner', value: (o) => o.props.Owner },
      { label: 'Access', value: (o) => String(o.props.AccessToString) },
    ],
    listProps: ['Path', 'Owner', 'Group', 'Access', 'Audit', 'Sddl'],
    listValues: { Access: (o) => String(o.props.AccessToString) },
  },
  NTAccount: { columns: [{ label: 'Value', value: (o) => o.props.Value }] },
};

// ——— icacls ———

interface Change {
  apply: (game: Shell, path: string) => string | null;
}

function icacls(game: Shell, args: string[]) {
  if (!args.length || args[0] === '/?') return { out: game.t('icacls-usage'), code: 0 };
  const [target, ...opts] = args;
  const out: string[] = [];
  let recurse = false;
  let quiet = false;
  let goOn = false;
  const changes: Change[] = [];
  const invalid = (a: string) => ({ out: '', err: `Invalid parameter "${a}"`, code: 87 });
  for (let i = 0; i < opts.length; i++) {
    const o = opts[i];
    const low = o.toLowerCase();
    if (low === '/t') recurse = true;
    else if (low === '/q') quiet = true;
    else if (low === '/c') goOn = true;
    else if (low === '/l') continue;
    else if (/^\/(grant(:r)?|deny)$/.test(low)) {
      const replace = low === '/grant:r';
      const deny = low === '/deny';
      const specs: string[] = [];
      while (i + 1 < opts.length && !opts[i + 1].startsWith('/')) specs.push(opts[++i]);
      if (!specs.length) return invalid(o);
      for (const spec of specs) {
        const m = /^(.+?):((?:\([^)]*\))*[A-Za-z,]*(?:\([^)]*\))*)$/.exec(spec);
        if (!m) return invalid(spec);
        const g = parseGrant(m[2]);
        if (!g) return invalid(spec);
        const who = m[1];
        changes.push({
          apply: (gm, path) => {
            const p = principal(gm, who);
            if (!p) return `${who}: No mapping between account names and security IDs was done.`;
            const acl = ownAcl(gm, path);
            const ace: NtfsAce = { id: p.name, mask: deny ? g.mask & ~SYNC : (g.mask | (g.mask & 0xf0000000 ? 0 : SYNC)) >>> 0, deny, ...g.flags };
            if (replace) acl.aces = acl.aces.filter((a) => !(a.id === p.name && !a.deny));
            const same = acl.aces.find((a) => a.id === p.name && !!a.deny === deny && sameFlags(a, ace));
            if (same && !replace) same.mask = (same.mask | ace.mask) >>> 0;
            else acl.aces.push(ace);
            return null;
          },
        });
      }
    } else if (/^\/remove(:[gd])?$/.test(low)) {
      const which = low.endsWith(':g') ? 'g' : low.endsWith(':d') ? 'd' : '';
      const ids: string[] = [];
      while (i + 1 < opts.length && !opts[i + 1].startsWith('/')) ids.push(opts[++i]);
      if (!ids.length) return invalid(o);
      for (const who of ids)
        changes.push({
          apply: (gm, path) => {
            const p = principal(gm, who);
            if (!p) return `${who}: No mapping between account names and security IDs was done.`;
            const acl = ownAcl(gm, path);
            acl.aces = acl.aces.filter((a) => !(a.id === p.name && (which === '' || (which === 'g' ? !a.deny : a.deny))));
            return null;
          },
        });
    } else if (/^\/inheritance:[edr]$/.test(low)) {
      const mode = low.at(-1);
      changes.push({
        apply: (gm, path) => {
          const before = descriptor(gm, path);
          const acl = ownAcl(gm, path);
          if (mode === 'e') acl.protected = false;
          else {
            if (mode === 'd' && before && !acl.protected) acl.aces.push(...before.aces.filter((a) => a.inherited).map(({ inherited: _i, from: _f, ...a }) => ({ ...a })));
            acl.protected = true;
          }
          return null;
        },
      });
    } else if (low === '/setowner') {
      const who = opts[++i];
      if (!who) return invalid(o);
      changes.push({
        apply: (gm, path) => {
          const p = principal(gm, who);
          if (!p) return `${who}: No mapping between account names and security IDs was done.`;
          if (!token(gm, gm.who).has('BUILTIN\\Administrators')) return `${toWindows(path)}: Access is denied.`;
          ownAcl(gm, path).owner = p.name;
          return null;
        },
      });
    } else if (low === '/reset')
      changes.push({
        apply: (gm, path) => {
          const acl = ownAcl(gm, path);
          acl.aces = [];
          acl.protected = false;
          return null;
        },
      });
    else return invalid(o);
  }
  // The files: a wildcard in the last part, /T for everything below.
  const last = target.split(/[\\/]/).at(-1) ?? '';
  const base = resolveWindows(game, /[*?]/.test(last) ? target.slice(0, target.length - last.length) || '.' : target);
  const start = base.exists ? game.find(base.path) : null;
  if (!start) {
    const err = `${toWindows(base.path)}${/[*?]/.test(last) ? `\\${last}` : ''}: The system cannot find the ${/[*?]/.test(last) ? 'file' : 'file'} specified.`;
    return { out: '', err: `${err}\nSuccessfully processed 0 files; Failed processing 1 files`, code: 2 };
  }
  const paths: string[] = [];
  const walk = (path: string, top: boolean) => {
    const n = game.find(path)!;
    if (!top || !/[*?]/.test(last)) paths.push(path);
    if (n.type === 'directory' && (recurse || (top && /[*?]/.test(last))))
      for (const c of Object.keys(n.children).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))) {
        if (top && /[*?]/.test(last) && !wildcard(last).test(c)) continue;
        if (!recurse) paths.push(`${path}/${c}`);
        else walk(`${path}/${c}`, false);
      }
  };
  walk(base.path, true);
  let ok = 0;
  let failed = 0;
  const errors: string[] = [];
  for (const path of paths) {
    const win = toWindows(path);
    if (!changes.length) {
      const d = descriptor(game, path);
      if (!canNtfs(game, path, 'read') && !hasRight(game, path, R.ReadPermissions)) {
        errors.push(`${win}: Access is denied.`);
        failed++;
        continue;
      }
      out.push(...(d ? icaclsLines(game, win, d) : [`${win} Everyone:(OI)(CI)(F)`]), '');
      ok++;
      continue;
    }
    if (!canNtfs(game, path, 'permissions')) {
      errors.push(`${win}: Access is denied.`);
      failed++;
      if (!goOn) break;
      continue;
    }
    let error: string | null = null;
    for (const c of changes) {
      error = c.apply(game, path);
      if (error) break;
    }
    if (error) {
      errors.push(error);
      failed++;
      if (!goOn) break;
      continue;
    }
    if (!quiet) out.push(`processed file: ${win}`);
    ok++;
  }
  const summary = `Successfully processed ${ok} files; Failed processing ${failed} files`;
  return { out: [...out, summary].join('\n'), err: errors.length ? errors.join('\n') : undefined, code: failed ? (errors.some((e) => e.includes('No mapping')) ? 1332 : errors.some((e) => e.includes('denied')) ? 5 : 1) : 0 };
}

// ——— takeown ———

function takeown(game: Shell, args: string[]) {
  if (!args.length || args[0] === '/?') return { out: game.t('takeown-usage'), code: 0 };
  const value = (f: string) => {
    const i = args.findIndex((a) => a.toLowerCase() === f);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const file = value('/f');
  if (!file) return { out: '', err: 'ERROR: Invalid syntax. Mandatory option /F is missing.\nType "TAKEOWN /?" for usage.', code: 1 };
  const group = args.some((a) => a.toLowerCase() === '/a');
  const recurse = args.some((a) => a.toLowerCase() === '/r');
  const where = resolveWindows(game, file);
  const n = where.exists ? game.find(where.path) : null;
  if (!n) return { out: '', err: `ERROR: The system cannot find the file specified.`, code: 1 };
  const ids = token(game, game.who);
  if (!ids.has('BUILTIN\\Administrators') && !hasRight(game, where.path, R.TakeOwnership)) return { out: '', err: 'ERROR: Access is denied.', code: 1 };
  const owner = group ? 'BUILTIN\\Administrators' : `${windows(game).computer}\\${game.who}`;
  const out: string[] = [];
  const take = (path: string) => {
    ownAcl(game, path).owner = owner;
    out.push(group ? `SUCCESS: The file (or folder): "${toWindows(path)}" now owned by the administrators group.` : `SUCCESS: The file (or folder): "${toWindows(path)}" now owned by user "${owner}".`);
    const x = game.find(path)!;
    if (recurse && x.type === 'directory') for (const c of Object.keys(x.children)) take(`${path}/${c}`);
  };
  take(where.path);
  return { out: `\n${out.join('\n\n')}`, code: 0 };
}

export const ACL_NATIVES: Native[] = [
  { name: 'icacls.exe', page: 'icacls', run: (game, args) => icacls(game, args) },
  { name: 'takeown.exe', page: 'takeown', run: (game, args) => takeown(game, args) },
];

/** For tests and stories: the effective rights of an account on a path, as Get-Acl names them. */
export const rightsOf = (game: Shell, path: string, user: string) => {
  const d = descriptor(game, path);
  if (!d) return 'FullControl';
  const ids = token(game, user);
  let granted = 0;
  let denied = 0;
  for (const a of d.aces) {
    if (a.io || !ids.has(a.id)) continue;
    if (a.deny) denied |= a.mask & ~granted;
    else granted |= a.mask & ~denied;
  }
  return rightsName(granted);
};
