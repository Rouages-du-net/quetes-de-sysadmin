// wg et wg-quick (wireguard-tools), sur le routeur simulé (../wireguard.ts).
// Sorties en anglais, comme les vrais outils.
// Sources : https://man7.org/linux/man-pages/man8/wg.8.html,
// https://man7.org/linux/man-pages/man8/wg-quick.8.html

import type { Shell } from '../shell';
import { inside, lan } from '../lan';
import { confFor, remoteConf, unmountWg, tunnelState, generateKey, readConfWg, mountWg, isPublic, wg, type Remote, type InterfaceWg } from '../wireguard';
import { systemd } from '../systemd';
import { modeWithMask } from '../tools';
import type { Command } from './index';

const NOT_ROOT = 'Unable to access interface: Operation not permitted';

// Le nom public d'un routeur (en anglais dans toutes les langues, comme les sites publics).
const PUBLIC_NAMES: Record<string, string> = { ruche: 'hive.example' };

/** L'adresse publique du routeur (eth0) et ses noms, pour l'Endpoint des pairs. */
export const publicFields = (game: Shell) => ({
  publicAddress: lan(game)?.interfaces.eth0?.addresses[0]?.split('/')[0] ?? '',
  names: [game.host, game.hostName, PUBLIC_NAMES[game.host] ?? `${game.host}.example`],
});

// La poignée de main a-t-elle eu lieu (le routeur et le pair se sont reconnus) ?
const serre = (e: string) => ['autorisees', 'route', 'transfert', 'ok'].includes(e);

function show(game: Shell, name: string, i: InterfaceWg): string[] {
  const lines = [`interface: ${name}`];
  if (i.conf.key) lines.push(`  public key: ${isPublic(i.conf.key)}`, '  private key: (hidden)');
  if (i.conf.port) lines.push(`  listening port: ${i.conf.port}`);
  const remotes: Remote[] = lan(game)?.remotes ?? [];
  for (const p of i.conf.peers) {
    lines.push('', `peer: ${p.key}`);
    const d = remotes.find((x) => x.key === p.key);
    const e = d ? tunnelState(game, d, publicFields(game)) : null;
    const enabled = !!e && e.name === name && serre(e.state);
    if (enabled) lines.push(`  endpoint: ${d!.address}:41414`);
    else if (p.endpoint) lines.push(`  endpoint: ${p.endpoint}`);
    lines.push(`  allowed ips: ${p.allowed.length ? p.allowed.join(', ') : '(none)'}`);
    if (enabled) {
      lines.push('  latest handshake: 7 seconds ago');
      lines.push(e!.state === 'ok' ? '  transfer: 48.62 KiB received, 312.07 KiB sent' : '  transfer: 2.18 KiB received, 1.02 KiB sent');
    }
    if (p.keepalive) lines.push(`  persistent keepalive: every ${p.keepalive} seconds`);
  }
  return lines;
}

function wgCommand(game: Shell, args: string[], input: string | null): string {
  const [action = 'show', ...rest] = args;
  if (action === 'genkey' || action === 'genpsk') {
    // Comme wg : un avertissement si la clé part dans un fichier que tout le monde peut lire.
    if (game.outputTo) {
      const n = game.find(game.outputTo);
      const mode = n?.mode ?? (n ? 'rw-r--r--' : modeWithMask(false, game.mask));
      if (/r|w|x/.test(mode.slice(6, 9)))
        game.error('Warning: writing to world accessible file.\nConsider setting the umask to 077 and trying again.', 0);
    }
    return generateKey(game);
  }
  if (action === 'pubkey') {
    const p = isPublic((input ?? '').trim());
    if (!p) return game.error('pubkey: Key is not the correct length or format', 1);
    return p;
  }
  if (action === 'show' || action === 'showconf') {
    if (game.who !== 'root') return game.error(NOT_ROOT, 1);
    const all = wg(game);
    const target = rest[0];
    if (action === 'showconf') {
      if (!target) return game.error('Usage: wg showconf <interface>', 1);
      const i = all[target];
      if (!i) return game.error(`Unable to access interface: No such device`, 1);
      return [
        '[Interface]',
        ...(i.conf.port ? [`ListenPort = ${i.conf.port}`] : []),
        ...(i.conf.key ? [`PrivateKey = ${i.conf.key}`] : []),
        ...i.conf.peers.flatMap((p) => [
          '',
          '[Peer]',
          `PublicKey = ${p.key}`,
          ...(p.allowed.length ? [`AllowedIPs = ${p.allowed.join(', ')}`] : []),
          ...(p.endpoint ? [`Endpoint = ${p.endpoint}`] : []),
        ]),
      ].join('\n');
    }
    if (target === 'interfaces') return Object.keys(all).join(' ');
    if (target && target !== 'all') {
      if (!all[target]) return game.error(`Unable to access interface: No such device`, 1);
      return show(game, target, all[target]).join('\n');
    }
    return Object.entries(all)
      .map(([name, i]) => show(game, name, i).join('\n'))
      .join('\n\n');
  }
  if (action === 'set' || action === 'setconf' || action === 'addconf' || action === 'syncconf') return game.error(game.t('wg-set-non-simule'), 1);
  return game.error(`Invalid subcommand: \`${action}'\n${game.t('wg-usage')}`, 1);
}

function wgQuick(game: Shell, args: string[]): string {
  const [action, name] = args;
  if (!action || !['up', 'down', 'strip', 'save'].includes(action) || !name) return game.error(game.t('wg-quick-usage'), 1);
  if (game.who !== 'root') return game.error(`wg-quick must be run as root.`, 1);
  if (action === 'strip') {
    const text = game.read(confFor(name));
    if (text === null) return game.error(`wg-quick: \`${confFor(name)}' does not exist`, 1);
    return text
      .split('\n')
      .filter((l) => !/^\s*(Address|DNS|MTU|Table|PreUp|PostUp|PreDown|PostDown|SaveConfig)\s*=/i.test(l))
      .join('\n');
  }
  if (action === 'save') return game.error(game.t('wg-set-non-simule'), 1);
  if (action === 'down') {
    const e = unmountWg(game, name);
    if (e) return game.error(e, 1);
    return `[#] ip link delete dev ${name}`;
  }
  const warning = worldMode(game, confFor(name)) ? [`Warning: \`${confFor(name)}' is world accessible`] : [];
  const { lines, error } = mountWg(game, name, false);
  if (error !== null) {
    if (error) return game.error(error, 1);
    game.error([...warning, ...lines].join('\n'), 1);
    return '';
  }
  if (warning.length) game.error(warning[0], 0);
  return lines.join('\n');
}

// Le fichier est-il accessible aux autres (comme le teste wg-quick : stat -c '0%#a', & 0007) ?
const worldMode = (game: Shell, path: string) => {
  const n = game.find(path);
  if (!n) return false;
  const mode = n.mode ?? 'rw-r--r--';
  return /[rwx]/.test(mode.slice(6, 9));
};

/** Le service wg-quick@NOM : monte l'interface d'après son fichier, au démarrage s'il est activé. */
export function serviceWg(name: string) {
  return {
    description: `WireGuard via wg-quick(8) for ${name}`,
    active: false,
    state: 'inactive' as const,
    executable: 'wg-quick',
    activeRest: true,
    processus: [],
    check: (j: Parameters<typeof mountWg>[0]) => {
      if (j.state.wg?.[name]) return [`wg-quick: \`${name}' already exists`];
      if (j.read(confFor(name)) === null) return [`wg-quick: \`${confFor(name)}' does not exist`];
      const c = readConfWg(j.read(confFor(name))!);
      return c.errors.length
        ? [`[#] ip link add ${name} type wireguard`, `[#] wg setconf ${name} /dev/fd/63`, ...c.errors, `[#] ip link delete dev ${name}`]
        : null;
    },
    load: (j: Parameters<typeof mountWg>[0]) => {
      const { lines } = mountWg(j, name, true);
      const sd = systemd(j);
      if (sd)
        for (const l of lines)
          sd.log.push({
            time: sd.clock,
            boot: sd.boot,
            unit: `wg-quick@${name}.service`,
            ident: 'wg-quick',
            pid: 2210,
            message: l,
            priority: 6,
          });
    },
    stop: (j: Parameters<typeof mountWg>[0]) => {
      unmountWg(j, name);
    },
  };
}

export const WIREGUARD: Record<string, Command> = {
  wg: { section: 8, ownOptions: true, launch: ({ args, game, input }) => wgCommand(game, args, input) },
  'wg-quick': { section: 8, ownOptions: true, launch: ({ args, game }) => wgQuick(game, args) },
};

/** ping vers une adresse derrière un tunnel : « sans-pair » (aucun pair n'a cette adresse), « perdu » ou « ok ». */
export function pingTunnel(game: Shell, ip: string): 'sans-pair' | 'perdu' | 'ok' {
  for (const [name, i] of Object.entries(wg(game))) {
    const p = i.conf.peers.find((x) => x.allowed.some((a) => inside(ip, a)));
    if (!p) continue;
    const d = lan(game)?.remotes?.find((x) => x.key === p.key);
    const e = d && tunnelState(game, d, publicFields(game));
    if (!d || !e || e.name !== name || !serre(e.state)) return 'perdu';
    const client = remoteConf(game, d);
    if (client.addresses[0]?.split('/')[0] === ip) return 'ok';
    // Un appareil du site derrière ce pair : seulement si le passage reste ouvert dans sa box.
    return d.network && inside(ip, d.network) && (!d.behindNat || client.peers[0]?.keepalive) ? 'ok' : 'perdu';
  }
  return 'sans-pair';
}
