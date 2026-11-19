// Group Policy (the domain's GPOs are in state.ad.gpos, windows-ad.ts):
//   - a GPO: name, id, status (a half can be disabled), settings for the
//     computer or the user (a firewall rule, a firewall profile, a drive
//     mapped at logon, a logon script, a user right such as "deny log on
//     locally", the account policies, a registry value), its permissions
//     (security filtering: who has Apply Group Policy, Authenticated Users
//     by default);
//   - links on the domain and on OUs (enabled, enforced, link order),
//     inheritance blocked on an OU;
//   - the resulting policy of a user or a computer, from its place in the
//     tree (LSDOU: the domain, then each OU down to its own; within a
//     container the GPO of link order 1 last, so it wins; a blocked OU drops
//     what comes from above unless enforced; enforced links win over the
//     ones below them), each GPO applied or filtered out (Disabled (Link),
//     Disabled (GPO), Denied (Security), Not Applied (Empty));
//   - its application on a machine of the domain, by gpupdate, at logon:
//     the GPOs' firewall rules replace the previous ones (PolicyStoreSource
//     GroupPolicy), drives are mapped, gpresult reads what was applied.
// Sources (Microsoft Learn): "Group Policy processing" and precedence
// (https://learn.microsoft.com/previous-versions/windows/desktop/policy/group-policy-hierarchy),
// "Group Policy inheritance, enforcement and block inheritance"
// (https://learn.microsoft.com/previous-versions/windows/it-pro/windows-server-2008-R2-and-2008/cc731076(v=ws.11)),
// security filtering (https://learn.microsoft.com/troubleshoot/windows-server/group-policy/apply-group-policy-objects-users-computers),
// gpupdate (https://learn.microsoft.com/windows-server/administration/windows-commands/gpupdate),
// gpresult (https://learn.microsoft.com/windows-server/administration/windows-commands/gpresult),
// GroupPolicy module (https://learn.microsoft.com/powershell/module/grouppolicy/).
// Simplifications (docs/SCENARIOS.md): no sites, no local policy, no WMI
// filters, no loopback processing, no slow-link detection, a small set of
// settings; a policy is applied at once (no background refresh every 90
// minutes: gpupdate, logon).

import type { Game, Shell } from './shell';
import { windows } from './windows';
import { token } from './windows-acl';
import { LOGON_HOOKS } from './windows-accounts';
import { accountName, byDn, below, computerObject, domainDn, domainOf, findAccount, parentDn, settingSide, type AdObject, type Domain, type Gpo, type GpLink, type GpoSetting } from './windows-ad';
import { firewall, PROFILES, type FwRule } from './windows-firewall';

export type Side = 'user' | 'computer';

export interface GpEntry {
  gpo: Gpo;
  link: GpLink;
  // The container it is linked to.
  som: string;
}

export interface GpResult {
  // Applied, highest precedence first; filtered out, with gpresult's reason.
  applied: string[];
  filtered: { name: string; reason: string }[];
  // The object's DN, when it was applied, by which domain controller, its groups.
  dn: string;
  at: number;
  from: string;
  groups: string[];
}

export interface AppliedPolicy {
  computer?: GpResult;
  user?: GpResult;
  // The user's mapped drives (from Drive Maps).
  drives?: { letter: string; path: string; label?: string; gpo: string }[];
  // User rights, logon scripts, registry values: what the settings asked.
  settings?: { side: Side; gpo: string; setting: GpoSetting }[];
}

export const gpoById = (ad: Domain, id: string) => ad.gpos.find((g) => g.id.toLowerCase() === id.toLowerCase().replace(/[{}]/g, ''));
export const gpoByName = (ad: Domain, name: string) => ad.gpos.find((g) => g.name.toLowerCase() === name.toLowerCase());

/** The containers above an object that can carry links (the domain, its OUs), top first; the object's own if it is an OU. */
export function somChain(ad: Domain, dn: string, includeSelf = false): AdObject[] {
  const out: AdObject[] = [];
  let at = includeSelf ? dn : parentDn(dn);
  const base = domainDn(ad.dns);
  while (at && below(at, base)) {
    const o = byDn(ad, at);
    if (o && (o.cls === 'organizationalUnit' || o.cls === 'domainDNS')) out.unshift(o);
    if (at.toLowerCase() === base.toLowerCase()) break;
    at = parentDn(at);
  }
  return out;
}

/**
 * The links that reach an object, in the order they apply (lowest
 * precedence first): non-enforced links from the domain down (inside a
 * container, link order n down to 1), dropped above a container that blocks
 * inheritance; then the enforced links, from the lowest container up (the
 * domain's enforced GPO applied last: it wins).
 */
export function linksInOrder(ad: Domain, dn: string, includeSelf = false): GpEntry[] {
  let normal: GpEntry[] = [];
  const enforced: GpEntry[][] = [];
  for (const som of somChain(ad, dn, includeSelf)) {
    if (som.blockInheritance) normal = [];
    const here: GpEntry[] = [];
    for (const link of [...(som.gpLinks ?? [])].reverse()) {
      const gpo = gpoById(ad, link.gpo);
      if (!gpo) continue;
      if (link.enforced) here.push({ gpo, link, som: som.dn });
      else normal.push({ gpo, link, som: som.dn });
    }
    enforced.push(here);
  }
  return [...normal, ...enforced.reverse().flat()];
}

/** Does this token get Apply Group Policy on the GPO (security filtering)? */
export function applies(game: Game, gpo: Gpo, ids: Set<string>): boolean {
  const has = (p: Gpo['permissions'][number]) => ids.has(p.trustee) || [...ids].some((id) => id.toLowerCase() === p.trustee.toLowerCase());
  if (gpo.permissions.some((p) => p.denied && p.permission === 'GpoApply' && has(p))) return false;
  return gpo.permissions.some((p) => !p.denied && p.permission === 'GpoApply' && has(p));
}

/** The resulting policy of one side for an object (its DN) and its token. */
export function resultant(game: Game, ad: Domain, dn: string, side: Side, ids: Set<string>): { applied: GpEntry[]; filtered: { name: string; reason: string }[] } {
  const applied: GpEntry[] = [];
  const filtered: { name: string; reason: string }[] = [];
  const disabled = (g: Gpo) => g.status === 'AllSettingsDisabled' || (side === 'user' ? g.status === 'UserSettingsDisabled' : g.status === 'ComputerSettingsDisabled');
  for (const e of linksInOrder(ad, dn)) {
    if (!e.link.enabled) filtered.push({ name: e.gpo.name, reason: 'Disabled (Link)' });
    else if (disabled(e.gpo)) filtered.push({ name: e.gpo.name, reason: 'Disabled (GPO)' });
    else if (!applies(game, e.gpo, ids)) filtered.push({ name: e.gpo.name, reason: 'Denied (Security)' });
    else if (!e.gpo.settings.some((s) => settingSide(s) === side)) filtered.push({ name: e.gpo.name, reason: 'Not Applied (Empty)' });
    else applied.push(e);
  }
  return { applied, filtered: [{ name: 'Local Group Policy', reason: 'Not Applied (Empty)' }, ...filtered] };
}

/** The machine's applied policy (gpresult reads it). */
export const appliedPolicy = (game: Game): AppliedPolicy => (windows(game).gp ??= {}) as AppliedPolicy;

/**
 * Applies the domain's policy on this machine (gpupdate, a logon): the
 * computer's side from its computer object, the user's from the session's
 * account; the firewall rules of the applied GPOs replace the previous ones.
 * False when the machine has no domain (nothing to apply).
 */
export function applyPolicy(game: Game, target: 'both' | Side = 'both', user = (game as Shell).who): boolean {
  const d = domainOf(game);
  if (!d) return false;
  const { ad } = d;
  const now = windows(game).clock;
  const from = `${ad.dc.toLowerCase()}.${ad.dns}`;
  const gp = appliedPolicy(game);
  const settings = (gp.settings ??= []);
  const result = (dn: string, side: Side, principal: string) => {
    const ids = token(game, principal, false);
    const r = resultant(game, ad, dn, side, ids);
    settings.splice(0, settings.length, ...settings.filter((s) => s.side !== side));
    for (const e of r.applied) for (const s of e.gpo.settings.filter((x) => settingSide(x) === side)) settings.push({ side, gpo: e.gpo.name, setting: s });
    const res: GpResult = { applied: r.applied.map((e) => e.gpo.name).reverse(), filtered: r.filtered, dn, at: now, from, groups: [...ids].filter((x) => x !== principal) };
    return { r, res };
  };
  if (target !== 'user') {
    const me = computerObject(game);
    if (me) {
      const { r, res } = result(me.dn, 'computer', accountName(ad, me));
      gp.computer = res;
      // The firewall: the GPOs' rules (later GPOs win on a same name), their profiles' state.
      const fw = firewall(game);
      fw.rules = fw.rules.filter((x) => !x.gpo);
      for (const e of r.applied)
        for (const s of e.gpo.settings) {
          if (s.kind === 'firewallRule') {
            const rule: FwRule = { name: s.name ?? `${e.gpo.id}-${s.display}`, display: s.display, group: '', description: '', enabled: true, direction: s.direction ?? 'Inbound', action: s.action, profiles: [...PROFILES], protocol: s.protocol, localPort: s.localPort, remotePort: ['Any'], remoteAddress: s.remoteAddress ?? ['Any'], gpo: e.gpo.name };
            fw.rules = [...fw.rules.filter((x) => !(x.gpo && x.name === rule.name)), rule];
          }
          if (s.kind === 'firewallProfile') fw.profiles[s.profile].enabled = s.enabled;
        }
    }
  }
  if (target !== 'computer') {
    const account = findAccount(ad, user) ?? findAccount(ad, `${ad.netbios}\\${user}`);
    if (account && account.cls === 'user') {
      const { r, res } = result(account.dn, 'user', accountName(ad, account));
      gp.user = res;
      gp.drives = r.applied.flatMap((e) => e.gpo.settings.filter((s): s is Extract<GpoSetting, { kind: 'driveMap' }> => s.kind === 'driveMap').map((s) => ({ letter: s.letter.toUpperCase().replace(/:$/, ''), path: s.path, label: s.label, gpo: e.gpo.name })));
    }
  }
  return true;
}

/** The settings of a kind applied on the machine (a story reads them: user rights, logon scripts). */
export function appliedSettings<K extends GpoSetting['kind']>(game: Game, kind: K): Extract<GpoSetting, { kind: K }>[] {
  return (appliedPolicy(game).settings ?? []).map((s) => s.setting).filter((s): s is Extract<GpoSetting, { kind: K }> => s.kind === kind);
}

// A logon on a machine of the domain applies its policy (computer and user).
LOGON_HOOKS.afterLogin = (game) => {
  if (domainOf(game)) applyPolicy(game);
};
