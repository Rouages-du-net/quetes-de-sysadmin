// ufw (Uncomplicated Firewall), d'après https://manpages.ubuntu.com/manpages/noble/man8/ufw.8.html :
// status [verbose|numbered], enable, disable, default, allow, deny, reject,
// limit, delete, app list. Les règles vivent dans etat.ufw (../parefeu.ts).
// ufw est traduit : ses messages suivent la langue du système (textes .ftl),
// sauf les noms d'actions (ALLOW, DENY…), qu'il n'affiche qu'en anglais.

import type { Shell } from '../shell';
import { APPLICATIONS, SERVICES, type Action, type Firewall, type Policy, type Rule } from '../firewall';
import type { Command } from './index';

const ACTIONS = ['allow', 'deny', 'reject', 'limit'];

// « 22 », « 22/tcp », « ssh », « OpenSSH », ou « from X [to any port N] [proto P] ».
function readRule(game: Shell, action: Action, words: string[]): Rule | null {
  if (words.length === 1) {
    const [spec] = words;
    if (APPLICATIONS[spec]) return { action, to: spec, ports: APPLICATIONS[spec], forEachOf: null };
    if (SERVICES[spec]) return { action, to: `${SERVICES[spec].ports[0]}/${SERVICES[spec].proto}`, ports: SERVICES[spec].ports, forEachOf: null };
    const m = /^(\d{1,5})(?:\/(tcp|udp))?$/.exec(spec);
    return m ? { action, to: spec, ports: [Number(m[1])], forEachOf: null } : null;
  }
  let forEachOf: string | null = null;
  let port: string | null = null;
  let proto: string | null = null;
  for (let i = 0; i < words.length; i++) {
    const [word, value] = [words[i], words[i + 1]];
    if (word === 'from' && value) (forEachOf = value === 'any' ? null : value), i++;
    else if (word === 'to' && value === 'any') i++;
    else if (word === 'port' && value && /^\d+$/.test(value)) (port = value), i++;
    else if (word === 'proto' && (value === 'tcp' || value === 'udp')) (proto = value), i++;
    else return null;
  }
  if (forEachOf !== null && !/^\d+\.\d+\.\d+\.\d+(\/\d+)?$/.test(forEachOf)) return null;
  const to = port ? (proto ? `${port}/${proto}` : port) : game.t('ufw-everywhere');
  return { action, to, ports: port ? [Number(port)] : [], forEachOf };
}

const sameRule = (a: Rule, b: Rule) => a.action === b.action && a.to === b.to && a.forEachOf === b.forEachOf;
const ruleText = (r: Rule) => (r.forEachOf ? `${r.action} from ${r.forEachOf}${r.ports.length ? ` to any port ${r.to}` : ''}` : `${r.action} ${r.to}`);

// Le tableau de ufw status : une ligne par règle, plus sa jumelle (v6).
function grid(game: Shell, pf: Firewall, sens: string, numbers: boolean): string[] {
  const everywhere = game.t('ufw-everywhere');
  const lines: [string, string, string][] = [];
  for (const r of pf.rules) {
    const action = r.action.toUpperCase() + sens;
    lines.push([r.to, action, r.forEachOf ?? everywhere]);
    if (!r.forEachOf) lines.push([r.to === everywhere ? r.to : `${r.to} (v6)`, action, `${everywhere} (v6)`]);
  }
  const header = (numbers ? '     ' : '') + `${game.t('ufw-to').padEnd(27)}${game.t('ufw-action').padEnd(12)}${game.t('ufw')}`;
  const traits = (numbers ? '     ' : '') + `${'-'.repeat(game.t('ufw-to').length).padEnd(27)}${'-'.repeat(game.t('ufw-action').length).padEnd(12)}${'-'.repeat(game.t('ufw').length)}`;
  return [header, traits, ...lines.map(([v, a, d], i) => (numbers ? `[${String(i + 1).padStart(2)}] ` : '') + `${v.padEnd(27)}${a.padEnd(12)}${d}`)];
}

export const UFW: Record<string, Command> = {
  ufw: {
    ownOptions: true,
    launch: ({ args, game }) => {
      const pf: Firewall | undefined = game.state.ufw;
      const [action, ...rest] = args;
      if (!action || action === '--help') return game.error(game.t('ufw-usage'));
      if (game.who !== 'root') return game.error(game.t('ufw-root'));
      if (!pf) return game.error(game.t('ufw-missing'));
      const v6 = (key: string) => `${game.t(key)}\n${game.t(key)} (v6)`;
      if (action === 'status') {
        if (!pf.enabled) return game.t('ufw-idle');
        const detail = rest[0] === 'verbose';
        const header = [game.t('ufw-status-active')];
        if (detail)
          header.push(
            game.t('ufw-journalisation'),
            game.t('ufw-defaults', { entrant: pf.incoming, sortant: pf.outgoing }),
            game.t('ufw-profiles'),
          );
        if (!pf.rules.length) return header.join('\n');
        return [...header, '', ...grid(game, pf, detail || rest[0] === 'numbered' ? ' IN' : '', rest[0] === 'numbered')].join('\n');
      }
      if (action === 'enable') {
        if (pf.enabled) return game.t('ufw-already-active');
        game.ask(game.t('ufw-question'), (r) => {
          if (!/^(y|yes|o|oui)$/i.test(r)) return game.t('ufw-abandon');
          pf.enabled = true;
          pf.activationAlConnections = game.state.connections ?? 1;
          return game.t('ufw-active');
        });
        return '';
      }
      if (action === 'disable') {
        pf.enabled = false;
        return game.t('ufw-disabled');
      }
      if (action === 'default') {
        const [policy, sens = 'incoming'] = rest;
        if (!['allow', 'deny', 'reject'].includes(policy) || !['incoming', 'outgoing'].includes(sens)) return game.error(game.t('ufw-syntax'));
        if (sens === 'incoming') pf.incoming = policy as Policy;
        else pf.outgoing = policy as Policy;
        return game.t(sens === 'incoming' ? 'ufw-default-incoming' : 'ufw-default-outgoing', { politique: policy });
      }
      if (action === 'app' && rest[0] === 'list') return [game.t('ufw-applications'), ...Object.keys(APPLICATIONS).sort().map((a) => `  ${a}`)].join('\n');
      if (action === 'delete') {
        if (rest.length === 1 && /^\d+$/.test(rest[0])) {
          // La numérotation de ufw status numbered compte aussi les lignes (v6).
          const lines = pf.rules.flatMap((r) => (r.forEachOf ? [r] : [r, r]));
          const r = lines[Number(rest[0]) - 1];
          if (!r) return game.error(game.t('ufw-number', { numero: rest[0] }));
          game.ask(game.t('ufw-question-deletion', { regle: ruleText(r) }), (rep) => {
            if (!/^(y|yes|o|oui)$/i.test(rep)) return game.t('ufw-abandon');
            pf.rules = pf.rules.filter((q) => q !== r);
            return r.forEachOf ? game.t('ufw-rule-deleted') : v6('ufw-rule-deleted');
          });
          return '';
        }
        const r = ACTIONS.includes(rest[0]) ? readRule(game, rest[0] as Action, rest.slice(1)) : null;
        if (!r) return game.error(game.t('ufw-syntax'));
        const existing = pf.rules.find((q) => sameRule(q, r));
        if (!existing) return game.error(game.t('ufw-nonexistent'));
        pf.rules = pf.rules.filter((q) => q !== existing);
        return r.forEachOf ? game.t('ufw-rule-deleted') : v6('ufw-rule-deleted');
      }
      if (ACTIONS.includes(action)) {
        const r = readRule(game, action as Action, rest);
        if (!r) return game.error(game.t('ufw-syntax'));
        if (pf.rules.some((q) => sameRule(q, r))) return r.forEachOf ? game.t('ufw-existing') : v6('ufw-existing');
        pf.rules.push(r);
        return r.forEachOf ? game.t('ufw-rules-updates') : v6('ufw-rules-updates');
      }
      return game.error(game.t('ufw-syntax'));
    },
  },
};
