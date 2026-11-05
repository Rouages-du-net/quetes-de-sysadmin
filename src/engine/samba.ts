// Samba: a machine's SMB shares (smbd). /etc/samba/smb.conf is read like
// Samba reads it (sections, "name = value", case and spaces ignored in the
// names, synonyms such as writable = writeable = read only = no), each time
// a client connects (smbd forks a process per connection that loads the
// current configuration, so a change applies to new connections without a
// restart). The users' Samba passwords are separate from their Unix
// passwords (smbpasswd -a, state.samba.passdb). A user who connects acts as
// their Unix account on the files (force user / force group change that),
// and new files get the share's create mask and directory mask.
// Sources: https://www.samba.org/samba/docs/current/man-html/smb.conf.5.html,
// https://www.samba.org/samba/docs/current/man-html/testparm.1.html,
// https://www.samba.org/samba/docs/current/man-html/smbpasswd.8.html,
// https://www.samba.org/samba/docs/current/man-html/smbclient.1.html
// Simplifications: a standalone server (security = user); no printers, no
// domain, no ACLs (inherit permissions, vfs objects), no hosts allow.

import type { Shell } from './shell';

export const SMB_CONF = '/etc/samba/smb.conf';

export interface Share {
  name: string;
  // The parameters, by canonical name (lower case, no spaces).
  params: Record<string, string>;
}
export interface SmbConfig {
  global: Record<string, string>;
  shares: Share[];
  // testparm's complaints.
  unknown: string[];
}
export interface SambaState {
  // Samba's own passwords (tdbsam), by Unix account.
  passdb: Record<string, string>;
}

export const samba = (j: Shell): SambaState => (j.state.samba ??= { passdb: {} });

// Synonyms, as smb.conf(5) lists them.
const SYNONYMS: Record<string, string> = {
  writeable: 'writable',
  writeok: 'writable',
  public: 'guestok',
  browsable: 'browseable',
  createmode: 'createmask',
  directorymode: 'directorymask',
  directory: 'path',
};
const KNOWN = new Set([
  'workgroup', 'serverstring', 'serverrole', 'security', 'maptoguest', 'logfile', 'maxlogsize', 'logging', 'panicaction',
  'obeypamrestrictions', 'unixpasswordsync', 'passwdprogram', 'passwdchat', 'pampasswordchange', 'usershareallowguests',
  'path', 'comment', 'validusers', 'invalidusers', 'readonly', 'writable', 'guestok', 'guestonly', 'browseable', 'forceuser',
  'forcegroup', 'createmask', 'directorymask', 'forcecreatemode', 'forcedirectorymode', 'printable', 'readlist', 'writelist',
  'interfaces', 'bindinterfacesonly', 'hostsallow', 'hostsdeny', 'printing', 'printcapname', 'loadprinters', 'serverminprotocol',
]);

const canonical = (name: string) => {
  const c = name.toLowerCase().replace(/[\s_]+/g, '');
  return SYNONYMS[c] ?? c;
};

/** smb.conf as smbd and testparm read it. */
export function readConfig(j: Shell): SmbConfig {
  const config: SmbConfig = { global: {}, shares: [], unknown: [] };
  let section: Record<string, string> | null = null;
  for (const raw of (j.read(SMB_CONF) ?? '').split('\n')) {
    const l = raw.trim();
    if (!l || l.startsWith('#') || l.startsWith(';')) continue;
    const s = /^\[([^\]]+)\]$/.exec(l);
    if (s) {
      if (s[1].toLowerCase() === 'global') section = config.global;
      else {
        const share: Share = { name: s[1], params: {} };
        config.shares.push(share);
        section = share.params;
      }
      continue;
    }
    const m = /^([^=]+?)\s*=\s*(.*)$/.exec(l);
    if (!m || !section) continue;
    const name = canonical(m[1]);
    if (!KNOWN.has(name)) {
      config.unknown.push(m[1].trim());
      continue;
    }
    section[name] = m[2].trim();
  }
  return config;
}

const yes = (v: string | undefined) => v !== undefined && /^(yes|true|1|on)$/i.test(v);
const no = (v: string | undefined) => v !== undefined && /^(no|false|0|off)$/i.test(v);

/** Is the share writable (read only = no, or writable = yes)? */
export function writable(share: Share): boolean {
  if (share.params.writable !== undefined) return yes(share.params.writable);
  if (share.params.readonly !== undefined) return no(share.params.readonly);
  return false;
}
export const guestOk = (share: Share) => yes(share.params.guestok);
export const mask = (share: Share, which: 'createmask' | 'directorymask') => parseInt(share.params[which] ?? (which === 'createmask' ? '0744' : '0755'), 8);

/** May this Unix account use this share (valid users, invalid users)? */
export function allowed(j: Shell, share: Share, user: string): boolean {
  const list = (v: string | undefined) => (v ?? '').split(/[\s,]+/).filter(Boolean);
  const member = (entry: string) =>
    entry.startsWith('@') || entry.startsWith('+') ? j.groupsFor(user).includes(entry.replace(/^[@+&]+/, '')) : entry === user;
  if (list(share.params.invalidusers).some(member)) return false;
  const valid = list(share.params.validusers);
  return !valid.length || valid.some(member);
}

/** The share a client asks for ([homes] serves the user's home directory). */
export function shareFor(config: SmbConfig, name: string, user: string | null): Share | null {
  const found = config.shares.find((s) => s.name.toLowerCase() === name.toLowerCase());
  if (found) return found;
  const homes = config.shares.find((s) => s.name.toLowerCase() === 'homes');
  if (homes && user && name.toLowerCase() === user.toLowerCase()) return { name: user, params: { ...homes.params, path: `/home/${user}` } };
  return null;
}

/** The mode a new file or directory gets through this share (mask, then force … mode). */
export function modeFor(share: Share, directory: boolean): string {
  const requested = directory ? 0o777 : 0o666;
  const m = mask(share, directory ? 'directorymask' : 'createmask');
  const forced = parseInt(share.params[directory ? 'forcedirectorymode' : 'forcecreatemode'] ?? '0', 8);
  const bits = (requested & m) | forced;
  const triplet = (v: number) => `${v & 4 ? 'r' : '-'}${v & 2 ? 'w' : '-'}${v & 1 ? 'x' : '-'}`;
  return triplet((bits >> 6) & 7) + triplet((bits >> 3) & 7) + triplet(bits & 7);
}

/** testparm's dump of a section ("\tpath = /srv/photos"), in the order written. */
export function dump(j: Shell): string {
  const raw = (j.read(SMB_CONF) ?? '').split('\n');
  const out: string[] = [];
  for (const r of raw) {
    const l = r.trim();
    if (!l || l.startsWith('#') || l.startsWith(';')) continue;
    if (/^\[.*\]$/.test(l)) {
      if (out.length) out.push('');
      out.push(l);
      continue;
    }
    const m = /^([^=]+?)\s*=\s*(.*)$/.exec(l);
    if (m && KNOWN.has(canonical(m[1]))) out.push(`\t${m[1].trim().toLowerCase()} = ${m[2].trim()}`);
  }
  return out.join('\n');
}
