// ssh : se connecter à une autre machine du réseau simulé (machines.ts).
// Comme OpenSSH (https://man.openbsd.org/ssh, https://man.openbsd.org/ssh_config) :
//   1. ~/.ssh/config (Host, HostName, User, Port, IdentityFile) ;
//   2. résolution du nom par /etc/hosts ;
//   3. connexion au port : ceux où écoute le sshd d'en face (22 par défaut) ;
//   4. clé d'hôte : vérifiée dans ~/.ssh/known_hosts, sinon question
//      « yes/no/[fingerprint] » (confiance à la première connexion) ; sur un
//      autre port que 22, l'hôte est noté « [nom]:port » ; une clé
//      différente de celle qu'on connaît arrête tout (machine réinstallée,
//      ou quelqu'un qui se fait passer pour elle) ;
//   5. authentification par clé uniquement (comme PasswordAuthentication no) ;
//      une clé privée lisible par d'autres est ignorée, comme le vrai ssh.
// La session elle-même est ouverte par la console (console.ts).
// Écarts : pas d'agent, pas de mot de passe, pas de commande à distance ;
// message d'usage raccourci. OpenSSH n'est pas traduit : ses messages
// restent en anglais.

import type { File } from '../world';
import type { Shell } from '../shell';
import { hostKey, privateKey, condensed, fingerprint, keyFingerprint, machineByAddress, machineName, WORKSTATION, type Machine } from '../machines';
import { allowed, methods, portsSshd } from '../sshd';
import { KEYS_BY_DEFAULT, configuration, pass, generateKey, prepare } from '../access';
import { verdict, type Firewall } from '../firewall';
import type { Command } from './index';

const USAGE = 'usage: ssh [-i identity_file] [-p port] destination [command [argument ...]]';

interface Destination {
  user: string;
  host: string;
  port: string;
  identities: string[];
  // Le nom sous lequel known_hosts connaît l'hôte : « nom », ou « [nom]:port » hors du port 22.
  known: string;
}

function resolve(game: Shell, host: string): string | null {
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return host;
  for (const line of (game.read('/etc/hosts') ?? '').split('\n')) {
    const [address, ...names] = line.replace(/#.*/, '').trim().split(/\s+/);
    if (names.includes(host)) return address;
  }
  return null;
}

// Mode « rw------- » → « 0600 ».
const octal = (mode: string) =>
  '0' + [0, 3, 6].map((i) => (mode[i] === 'r' ? 4 : 0) + (mode[i + 1] === 'w' ? 2 : 0) + (mode[i + 2] === 'x' ? 1 : 0)).join('');

function authenticate(game: Shell, d: Destination, m: Machine): string {
  const output: string[] = [];
  const identities = [...new Set([...d.identities, ...KEYS_BY_DEFAULT])];
  let accepted = false;
  for (const path of identities) {
    const n = game.find(path);
    const absolute = game.resolve(path);
    if (!n || n.type !== 'fichier') {
      if (d.identities.includes(path)) output.push(`Warning: Identity file ${path} not accessible: No such file or directory.`);
      continue;
    }
    const mode = n.mode ?? 'rw-r--r--';
    if (mode.slice(3) !== '------') {
      output.push(
        '@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@',
        '@         WARNING: UNPROTECTED PRIVATE KEY FILE!          @',
        '@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@',
        `Permissions ${octal(mode)} for '${absolute}' are too open.`,
        'It is required that your private key files are NOT accessible by others.',
        'This private key will be ignored.',
        `Load key "${absolute}": bad permissions`,
      );
      continue;
    }
    if (d.user === game.player && (n as File).content === privateKey(m)) {
      accepted = true;
      break;
    }
  }
  // La configuration appliquée par le serveur d'en face (sshd_config).
  const config: Record<string, string> | null = game.state.sshdDistant?.(m.name) ?? null;
  const refuse = accepted && config !== null && !allowed(config, d.user);
  if (accepted && !refuse) {
    game.connectionRequest = m.name;
    game.state.portConnexion = Number(d.port);
  } else output.push(`${d.user}@${d.host}: Permission denied (${config ? methods(config) : 'publickey'}).`);
  // La bonne clé, mais un serveur qui refuse le compte : on s'est enfermé dehors.
  if (refuse && d.user === game.player) output.push(game.t('ssh-enferme', { machine: machineName(game.t, m.name) }));
  return output.join('\n');
}

// La génération de clé d'hôte de la machine d'en face (machines.ts).
const generation = (game: Shell, m: Machine): string => game.state.cleDistante?.(m.name) ?? '';

function addKnownHost(game: Shell, d: Destination, m: Machine) {
  const line = `${d.known} ${hostKey(m, generation(game, m))}`;
  const n = game.find('~/.ssh/known_hosts');
  if (n?.type === 'fichier') n.content = [game.read('~/.ssh/known_hosts'), line].filter(Boolean).join('\n');
  else game.place('ssh', '~/.ssh/known_hosts', { type: 'fichier', content: line, lines: true });
}

// Question de la première connexion : yes, no, ou l'empreinte elle-même.
function confirmer(game: Shell, d: Destination, m: Machine, prompt: string) {
  game.ask(prompt, (response) => {
    if (response === 'yes' || response === fingerprint(m, generation(game, m))) {
      addKnownHost(game, d, m);
      return [`Warning: Permanently added '${d.known}' (ED25519) to the list of known hosts.`, authenticate(game, d, m)].filter(Boolean).join('\n');
    }
    if (response === 'no') return 'Host key verification failed.';
    confirmer(game, d, m, "Please type 'yes', 'no' or the fingerprint:");
    return '';
  });
}

// La clé envoyée par le serveur n'est pas celle de known_hosts : OpenSSH
// refuse (StrictHostKeyChecking), et dit comment retirer l'ancienne.
function changedKey(game: Shell, d: Destination, m: Machine, line: number): string {
  const file = game.resolve('~/.ssh/known_hosts');
  const cadre = '@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@';
  return [
    cadre,
    '@    WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!     @',
    cadre,
    'IT IS POSSIBLE THAT SOMEONE IS DOING SOMETHING NASTY!',
    'Someone could be eavesdropping on you right now (man-in-the-middle attack)!',
    'It is also possible that a host key has just been changed.',
    'The fingerprint for the ED25519 key sent by the remote host is',
    `${fingerprint(m, generation(game, m))}.`,
    'Please contact your system administrator.',
    `Add correct host key in ${file} to get rid of this message.`,
    `Offending ED25519 key in ${file}:${line}`,
    '  remove with:',
    `  ssh-keygen -f '${file}' -R '${d.known}'`,
    `Host key for ${d.known} has changed and you have requested strict checking.`,
    'Host key verification failed.',
    game.t('ssh-cle-changee', { machine: machineName(game.t, m.name), empreinte: fingerprint(m, generation(game, m)) }),
  ].join('\n');
}

// La machine d'histoire visée gère-t-elle ses clés (authorized_keys, mot de passe) ? Ou faut-il rebondir ?
function trueSsh(game: Shell, target: string): boolean {
  const alias = target.includes('@') ? target.split('@', 2)[1] : target;
  // Un rebond demandé par ~/.ssh/config (ProxyJump).
  const hop = configuration(game, alias).proxyjump?.[0];
  if (hop && hop !== 'none') return true;
  const address = resolve(game, (configuration(game, alias).hostname?.[0] ?? alias).toLowerCase());
  const m = address ? machineByAddress(address) : undefined;
  return !!m && m !== WORKSTATION && !!(game.state.sessionDistante?.(m.name) as Shell | undefined)?.state.sshReel;
}

interface OptionsSsh {
  identities: string[];
  port: string;
  hop?: string;
  tunnels: string[];
  withoutSession: boolean;
  planBack: boolean;
}

/** -L [adresse:]port:hôte:port → le tunnel ; null si la forme est fausse. */
function readTunnel(text: string): { port: number; host: string; remotePort: number } | null {
  const m = /^(?:[^:]+:)?(\d+):([^:]+):(\d+)$/.exec(text);
  return m ? { port: Number(m[1]), host: m[2], remotePort: Number(m[3]) } : null;
}

function completeSsh(game: Shell, target: string, command: string[], o: OptionsSsh): string {
  for (const t of o.tunnels) if (!readTunnel(t)) return game.error(`Bad local forwarding specification '${t}'`);
  const jumps = prepare(game, target, { identities: o.identities, port: o.port, hop: o.hop });
  if (typeof jumps === 'string') return game.error(jumps);
  const last = jumps.at(-1)!;
  return pass(game, jumps, () => {
    // Les tunnels : un port de cette machine mène à un service vu depuis la machine d'en face.
    for (const t of o.tunnels.map(readTunnel)) {
      const to = t!.host === 'localhost' || t!.host === '127.0.0.1' ? last.shell : null;
      const address = to ? null : resolve(last.shell, t!.host);
      const internal = address ? last.shell.internal_().find((h) => h.address === address) : null;
      const shell = to ?? (internal ? last.shell.internal(internal.name) : null);
      if (!shell) continue;
      // Le tunnel vit tant que ce processus ssh tourne (kill le ferme).
      const pid = 4100 + (game.state.tunnels?.length ?? 0) * 7;
      // En passant par une autre adresse que localhost, un service qui n'écoute que sur 127.0.0.1 reste injoignable.
      (game.state.tunnels ??= []).push({ port: t!.port, shell, remotePort: t!.remotePort, machine: last.machine.name, pid, loop: !!to });
      (game.state.processus ??= []).push({
        pid,
        user: game.who,
        cpu: 0,
        mem: 0.1,
        command:
          `ssh ${['-f', '-N'].filter((x) => (x === '-f' ? o.planBack : o.withoutSession)).join(' ')} -L ${o.tunnels.join(' -L ')} ${target}`.replace(
            /\s+/g,
            ' ',
          ),
      });
    }
    // Une commande à distance : elle tourne sous le compte d'en face, sa sortie revient ici.
    if (command.length) {
      const before = last.shell.who;
      last.shell.who = last.user;
      try {
        const r = last.shell.underCommand(command.join(' '), last.shell.home);
        game.status = r.code;
        return r.output;
      } finally {
        last.shell.who = before;
      }
    }
    if (o.withoutSession) return o.planBack ? '' : game.t('ssh-sans-arriere-plan');
    if (jumps.length === 1 && last.story) game.connectionRequest = last.story;
    else game.sessionRequest = { shell: last.shell, domain: last.machine.domain, address: last.machine.address, via: jumps[0].story };
    return '';
  });
}

// ssh -G : les options qui s'appliqueraient (un extrait, dans l'ordre d'OpenSSH), sans se connecter.
function configurationEffective(game: Shell, target: string, o: { identities: string[]; port: string; hop?: string }): string {
  const [user, alias] = target.includes('@') ? target.split('@', 2) : [null, target];
  const c = configuration(game, alias);
  const hop = o.hop ?? c.proxyjump?.[0];
  const identities = [...o.identities, ...(c.identityfile ?? [])];
  return [
    `host ${alias}`,
    `user ${user ?? c.user?.[0] ?? game.who}`,
    `hostname ${(c.hostname?.[0] ?? alias).toLowerCase()}`,
    `port ${o.port || c.port?.[0] || '22'}`,
    ...(hop ? [`proxyjump ${hop}`] : []),
    ...(identities.length ? identities : KEYS_BY_DEFAULT).map((i) => `identityfile ${i}`),
  ].join('\n');
}

// L'image de la clé (randomart), comme ssh-keygen : l'« évêque ivre » part
// du centre d'un plateau de 17 × 9 et se déplace en diagonale selon chaque
// paire de bits de l'empreinte ; plus une case est visitée, plus son
// caractère est dense. S : le départ, E : l'arrivée.
function randomart(emp: string): string[] {
  const [L, H] = [17, 9];
  const visits = Array.from({ length: H }, () => Array<number>(L).fill(0));
  let [x, y] = [8, 4];
  // Les 32 octets de l'empreinte (tirés d'elle, toujours les mêmes).
  for (let o = 0; o < 32; o++)
    for (let b = parseInt(condensed(emp + o).slice(0, 2), 16), k = 0; k < 4; k++, b >>= 2) {
      x = Math.max(0, Math.min(L - 1, x + (b & 1 ? 1 : -1)));
      y = Math.max(0, Math.min(H - 1, y + (b & 2 ? 1 : -1)));
      visits[y][x]++;
    }
  const symbols = ' .o+=*BOX@%&#/^';
  return visits.map(
    (line, j) =>
      `|${line.map((n, i) => (i === 8 && j === 4 ? 'S' : i === x && j === y ? 'E' : symbols[Math.min(n, symbols.length - 1)])).join('')}|`,
  );
}

// ssh-keygen sans -R/-F/-l : une nouvelle paire de clés (ed25519), comme
// ssh-keygen -t ed25519 [-C commentaire] [-N phrase] [-f fichier]. Les
// questions (fichier, phrase de passe) ne sont posées que pour ce qui manque.
function generate(game: Shell, args: string[]): string {
  const value = (o: string) => (args.includes(o) ? args[args.indexOf(o) + 1] : undefined);
  const type = value('-t') ?? 'ed25519';
  if (type !== 'ed25519') return game.error(game.t('ssh-keygen-type', { type }));
  const comment = value('-C') ?? `${game.who}@${game.hostName}`;
  const byDefault = `${game.resolve('~')}/.ssh/id_ed25519`;
  const lines = ['Generating public/private ed25519 key pair.'];
  const write = (file: string, phrase: string): string => {
    const path = game.resolve(file.replace(/^~/, game.home));
    const directory = path.replace(/\/[^/]+$/, '');
    if (!game.exists(directory)) {
      if (directory !== `${game.resolve('~')}/.ssh`) return `Saving key "${path}" failed: No such file or directory`;
      game.place('ssh-keygen', directory, { type: 'dossier', children: {}, owner: game.who, mode: 'rwx------' });
      lines.push(`Created directory '${directory}'.`);
    }
    const n = (game.state.clesGenerees = ((game.state.clesGenerees as number | undefined) ?? 0) + 1);
    const key = generateKey(`${game.host}:${game.who}:${path}:${n}`, comment);
    for (const [c, content, mode] of [
      [path, key.isPrivate, 'rw-------'],
      [`${path}.pub`, key.isPublic, 'rw-r--r--'],
    ] as const) {
      const old = game.find(c);
      if (old?.type === 'fichier') Object.assign(old, { content, mode, lines: true, size: undefined });
      else {
        const e = game.place('ssh-keygen', c, { type: 'fichier', content, lines: true, owner: game.who, mode });
        if (e) return `Saving key "${path}" failed: Permission denied`;
      }
    }
    if (phrase) (game.state.phrasesDePasse ??= {})[path] = phrase;
    else if (game.state.phrasesDePasse) delete game.state.phrasesDePasse[path];
    const emp = keyFingerprint(key.isPublic);
    const art = randomart(emp);
    return [
      ...lines,
      `Your identification has been saved in ${path}`,
      `Your public key has been saved in ${path}.pub`,
      'The key fingerprint is:',
      `${emp} ${comment}`,
      "The key's randomart image is:",
      '+--[ED25519 256]--+',
      ...art,
      '+----[SHA256]-----+',
    ].join('\n');
  };
  // La phrase de passe (deux fois), sauf si -N la donne.
  const phrase = (file: string): string => {
    const data = value('-N');
    if (data !== undefined) return write(file, data);
    game.ask(
      'Enter passphrase (empty for no passphrase):',
      (first) => {
        game.ask(
          'Enter same passphrase again:',
          (seconde) => (seconde === first ? write(file, first) : 'Passphrases do not match.  Try again.'),
          true,
        );
        return '';
      },
      true,
    );
    return '';
  };
  // Le fichier : -f, sinon la question ; s'il existe, on demande avant d'écraser.
  const file = (path: string): string => {
    if (!game.exists(path)) return phrase(path);
    game.ask(`${game.resolve(path)} already exists.\nOverwrite (y/n)?`, (r) => (r.trim().toLowerCase().startsWith('y') ? phrase(path) : ''));
    return '';
  };
  const f = value('-f');
  if (f) return [lines.shift(), file(f)].filter(Boolean).join('\n');
  game.ask(`Enter file in which to save the key (${byDefault}):`, (r) => file(r.trim() || byDefault));
  return lines.shift()!;
}

export const SSH: Record<string, Command> = {
  ssh: {
    launch: ({ args, game }) => {
      const identities: string[] = [];
      let port = '';
      let hop: string | undefined;
      const tunnels: string[] = [];
      let withoutSession = false;
      let planBack = false;
      const rest: string[] = [];
      for (let i = 0; i < args.length; i++) {
        if (['-i', '-p', '-J', '-L'].includes(args[i])) {
          const value = args[++i];
          if (value === undefined) return game.error(`option requires an argument -- ${args[i - 1].slice(1)}\n${USAGE}`);
          if (args[i - 1] === '-i') identities.push(value);
          else if (args[i - 1] === '-p') port = value;
          else if (args[i - 1] === '-J') hop = value;
          else tunnels.push(value);
        } else if (args[i] === '-G') {
          continue;
        } else if (/^-[Nf]+$/.test(args[i])) {
          if (args[i].includes('N')) withoutSession = true;
          if (args[i].includes('f')) planBack = true;
        } else if (rest.length === 0 && /^-./.test(args[i])) return game.error(`unknown option -- ${args[i].slice(1)}\n${USAGE}`);
        else rest.push(args[i]);
      }
      const [target, ...command] = rest;
      if (!target) return game.error(USAGE);
      if (args.includes('-G')) return configurationEffective(game, target, { identities, port, hop });
      // Le « vrai » ssh (acces.ts) : rebonds, tunnels, réseau interne, machines où l'on gère ses clés.
      if (game.host !== 'desk' || hop || tunnels.length || withoutSession || trueSsh(game, target))
        return completeSsh(game, target, command, { identities, port, hop, tunnels, withoutSession, planBack });
      const [givesUser, alias] = target.includes('@') ? target.split('@', 2) : [null, target];
      const config = configuration(game, alias);
      const host = (config.hostname?.[0] ?? alias).toLowerCase();
      const targetsPort = port || config.port?.[0] || '22';
      const d: Destination = {
        user: givesUser ?? config.user?.[0] ?? game.who,
        host,
        port: targetsPort,
        identities: [...identities, ...(config.identityfile ?? [])],
        known: targetsPort === '22' ? host : `[${host}]:${targetsPort}`,
      };
      const address = resolve(game, d.host);
      if (!address) return game.error(`ssh: Could not resolve hostname ${d.host}: Name or service not known`);
      const m = machineByAddress(address);
      // Le poste n'a pas de serveur SSH ; les machines écoutent sur les ports de leur sshd.
      if (m === WORKSTATION || address.startsWith('127.')) return game.error(`ssh: connect to host ${d.host} port ${d.port}: Connection refused`);
      const listening = m ? portsSshd(game.state.sshdDistant?.(m.name)) : [];
      if (m && !listening.includes(Number(d.port)))
        return game.error(
          `ssh: connect to host ${d.host} port ${d.port}: Connection refused` +
            // Un serveur qu'on a soi-même déplacé : rappeler où il écoute.
            (listening.join() !== '22' ? `\n${game.t('ssh-autre-port', { machine: machineName(game.t, m.name), port: d.port, ports: listening.join(', ') })}` : ''),
        );
      if (!m) return game.error(`ssh: connect to host ${d.host} port ${d.port}: No route to host`);
      // fail2ban d'en face a banni le poste : sur Debian, l'action par défaut
      // rejette (REJECT) les paquets de l'adresse vers les ports de la prison.
      if ((game.state.bannisDistant?.(m.name, Number(d.port)) ?? []).includes(WORKSTATION.address))
        return game.error(
          `ssh: connect to host ${d.host} port ${d.port}: Connection refused\n` + game.t('ssh-banni', { machine: machineName(game.t, m.name), adresse: WORKSTATION.address }),
        );
      // Le pare-feu d'en face : deny laisse attendre (timeout), reject refuse tout de suite.
      const pf: Firewall | null = game.state.pareFeuDistant?.(m.name) ?? null;
      const pass = pf ? verdict(pf, Number(d.port), WORKSTATION.address) : 'accepte';
      if (pass !== 'accepte')
        return game.error(
          `ssh: connect to host ${d.host} port ${d.port}: ${pass === 'bloque' ? 'Connection timed out' : 'Connection refused'}\n` +
            game.t('ssh-pare-feu', { machine: machineName(game.t, m.name) }),
        );
      const remarque = command.length ? game.t('ssh-commande-distante') + '\n' : '';
      const lines = (game.read('~/.ssh/known_hosts') ?? '').split('\n');
      const key = hostKey(m, generation(game, m));
      const number = lines.findIndex((l) => l.split(' ')[0].split(',').includes(d.known));
      if (number >= 0) {
        if (lines[number].endsWith(` ${key}`)) return remarque + authenticate(game, d, m);
        return game.error(changedKey(game, d, m, number + 1));
      }
      // La même clé déjà connue sous un autre nom (le même hôte, sur le port 22) : OpenSSH le signale.
      const other = lines.map((l, i) => [l, i + 1] as const).filter(([l]) => l.endsWith(` ${key}`));
      const file = game.resolve('~/.ssh/known_hosts');
      confirmer(game, d, m, 'Are you sure you want to continue connecting (yes/no/[fingerprint])?');
      return [
        remarque.trim(),
        `The authenticity of host '${d.known} (${d.port === '22' ? address : `[${address}]:${d.port}`})' can't be established.`,
        `ED25519 key fingerprint is ${fingerprint(m, generation(game, m))}.`,
        ...(other.length
          ? ['This host key is known by the following other names/addresses:', ...other.map(([l, i]) => `    ${file}:${i}: ${l.split(' ')[0]}`)]
          : ['This key is not known by any other names.']),
      ]
        .filter(Boolean)
        .join('\n');
    },
  },
  // ssh-keygen (https://man.openbsd.org/ssh-keygen) : seulement la gestion
  // de known_hosts (-R, -F) et les empreintes (-l). Écart : il ne crée pas
  // de clés (le jeu les donne).
  'ssh-keygen': {
    ownOptions: true,
    launch: ({ args, game }) => {
      const usage = 'usage: ssh-keygen [-t ed25519] [-C comment] [-N passphrase] [-f file] ; ssh-keygen [-l] [-f file] [-F hostname] [-R hostname]';
      let file = '~/.ssh/known_hosts';
      let action: 'R' | 'F' | 'l' | null = null;
      let host = '';
      for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a === '-t' || a === '-C' || a === '-N' || a === '-b') {
          if (args[++i] === undefined) return game.error(`ssh-keygen: option requires an argument -- ${a.slice(1)}\n${usage}`);
        } else if (a === '-f' || a === '-R' || a === '-F') {
          const value = args[++i];
          if (value === undefined) return game.error(`ssh-keygen: option requires an argument -- ${a.slice(1)}\n${usage}`);
          if (a === '-f') file = value;
          else [action, host] = [a.slice(1) as 'R' | 'F', value];
        } else if (a === '-l') action ??= 'l';
        else if (a.startsWith('-')) return game.error(`ssh-keygen: illegal option -- ${a.slice(1, 2)}\n${usage}`);
        else return game.error(usage);
      }
      if (!action) return generate(game, args);
      const path = game.resolve(file);
      const n = game.find(file);
      if (!n || n.type !== 'fichier') return game.error(`${path}: No such file or directory`);
      if (!game.can(n, 'r')) return game.error(`${path}: Permission denied`);
      const lines = (game.read(file) ?? '').split('\n').filter(Boolean);
      if (action === 'l')
        return lines
          .map((l) => {
            const [name, ...key] = l.split(' ');
            // Une ligne de known_hosts commence par le nom ; une clé .pub finit par un commentaire.
            return name.startsWith('ssh-')
              ? `256 ${keyFingerprint(l)} ${key.slice(1).join(' ') || 'no comment'} (ED25519)`
              : `256 ${keyFingerprint(key.join(' '))} ${name} (ED25519)`;
          })
          .join('\n');
      const found = lines.map((l, i) => [l, i + 1] as const).filter(([l]) => l.split(' ')[0].split(',').includes(host));
      if (action === 'F') {
        if (!found.length) return '';
        return found.flatMap(([l, i]) => [`# Host ${host} found: line ${i}`, l]).join('\n');
      }
      if (!found.length) return game.error(`Host ${host} not found in ${path}`);
      if (!game.can(n, 'w')) return game.error(`${path}: Permission denied`);
      game.place('ssh-keygen', `${file}.old`, { ...n, read: undefined });
      n.content = lines.filter((l) => !found.some(([t]) => t === l)).join('\n');
      return [
        ...found.map(([, i]) => `# Host ${host} found: line ${i}`),
        `${path} updated.`,
        `Original contents retained as ${path}.old`,
      ].join('\n');
    },
  },
  // exit est intégré au shell (shell.ts) ; cette entrée sert au manuel.
  exit: { launch: () => '' },
};
