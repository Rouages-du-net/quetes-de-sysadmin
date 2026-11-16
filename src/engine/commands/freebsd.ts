// FreeBSD's administration commands, on the model of ../freebsd.ts: service
// and sysrc (rc.conf), pkg, sockstat, pfctl, freebsd-version. Messages after
// FreeBSD 14's rc.subr(8), service(8), sysrc(8), pkg(8), sockstat(1) and
// pfctl(8) (https://man.freebsd.org/). Outputs in English (none of these
// tools is translated).

import type { Shell } from '../shell';
import type { Command } from './index';
import {
  enabled, hasScript, installed, isBsd, parsePf, pf, pkgState, rcConf, rcState, setRc, startService, stopService, unsetRc, type PfState, type RcService,
} from '../freebsd';
import type { Listening } from './ss';

const RELEASE = '14.2-RELEASE';
const notOnLinux = (game: Shell, cmd: string) => {
  game.status = 127;
  return game.error(`-bash: ${cmd}: command not found`);
};

// ——— service ———

function service(game: Shell, args: string[]): string {
  if (args[0] === '-e') {
    const rc = rcState(game);
    return Object.keys(rc.services)
      .filter((n) => enabled(game, n) && hasScript(game, n))
      .map((n) => `${game.exists(`/etc/rc.d/${n}`) ? '/etc/rc.d' : '/usr/local/etc/rc.d'}/${n}`)
      .join('\n');
  }
  const [name, action] = args;
  if (!name || !action) return game.error('usage: service [-j <jail name or id>] -e\n       service [-j <jail name or id>] -R\n       service [-j <jail name or id>] -l | -r\n       service [-j <jail name or id>] -v <rc.d script> start|stop|etc.\n       service -h', 1);
  const rc = rcState(game);
  const s: RcService | undefined = rc.services[name];
  if (!s || !hasScript(game, name))
    return game.error(`${name} does not exist in /etc/rc.d or the local startup\ndirectories (/usr/local/etc/rc.d), or is not executable`, 1);
  const root = () => (game.who === 'root' ? null : game.error(`${name}: Permission denied`, 1));
  const one = action.startsWith('one');
  const verb = one ? action.slice(3) : action;
  const running = rc.running[name] !== undefined;
  // enable / disable: the rc.conf line (service(8), since FreeBSD 12).
  if (verb === 'enable' || verb === 'disable') {
    const e = root();
    if (e !== null) return e;
    if (verb === 'enable') setRc(game, `${name}_enable`, 'YES');
    else unsetRc(game, `${name}_enable`);
    return `${name} ${verb}d in /etc/rc.conf`;
  }
  if (verb === 'status') {
    if (s.status) return s.status(game);
    if (!enabled(game, name) && !one) return game.error(`Cannot 'status' ${name}. Set ${name}_enable to YES in /etc/rc.conf or use 'onestatus' instead of 'status'.`, 1);
    if (!running) return game.error(`${name} is not running.`, 1);
    return `${name} is running as pid ${rc.running[name]}.`;
  }
  if (!['start', 'stop', 'restart', 'reload'].includes(verb)) return game.error(`/usr/local/etc/rc.d/${name}: unknown directive '${action}'.\nUsage: /usr/local/etc/rc.d/${name} [fast|force|one|quiet](start|stop|restart|rcvar|enable|disable|delete|enabled|describe|extracommands|configtest|reload|status|poll)`, 1);
  // Without NAME_enable="YES", rc.subr refuses (except with onestart, which doesn't survive a reboot).
  if (!one && !enabled(game, name))
    return game.error(`Cannot '${verb}' ${name}. Set ${name}_enable to YES in /etc/rc.conf or use 'one${verb}' instead of '${verb}'.`, 1);
  const e = root();
  if (e !== null) return e;
  const out: string[] = [];
  if (verb === 'stop' || verb === 'restart') {
    if (!running) {
      if (verb === 'stop') return game.error(`${name} not running? (check /var/run/${name}.pid).`, 1);
    } else {
      const pid = rc.running[name];
      out.push(`Stopping ${name}.`);
      stopService(game, name);
      if (pid) out.push(`Waiting for PIDS: ${pid}.`);
    }
    if (verb === 'stop') return out.join('\n');
  }
  if (verb === 'reload') {
    if (!running) return game.error(`${name} not running? (check /var/run/${name}.pid).`, 1);
    const errors = s.check?.(game);
    if (errors) return game.error(errors.join('\n'), 1);
    return s.start?.slice(0, -1).join('\n') ?? '';
  }
  if (running && verb === 'start') return game.error(`${name} already running? (pid=${rc.running[name]}).`, 1);
  const errors = startService(game, name);
  if (errors && errors.length) return game.error([...out, ...errors].join('\n'), 1);
  out.push(...(s.start ?? [`Starting ${name}.`]));
  return out.join('\n');
}

// ——— sysrc ———

function sysrc(game: Shell, args: string[]): string {
  const remove = args[0] === '-x';
  const words = remove ? args.slice(1) : args.filter((a) => a !== '-f' && a !== RC_FILE);
  if (args[0] === '-a') {
    const conf = rcConf(game);
    return Object.entries(conf).map(([k, v]) => `${k}: ${v}`).join('\n');
  }
  if (!words.length) return game.error('usage: sysrc [OPTIONS] {name[[+|-]=value] ...}', 1);
  const out: string[] = [];
  for (const w of words) {
    const m = /^([A-Za-z_]\w*)(?:=(.*))?$/.exec(w);
    if (!m) {
      game.error(`sysrc: ${w}: name contains characters not allowed in shell`);
      continue;
    }
    const [, name, value] = m;
    if (remove || value !== undefined) {
      if (game.who !== 'root') {
        game.error(`sysrc: cannot create /etc/rc.conf: Permission denied`, 1);
        continue;
      }
      if (remove) {
        if (!unsetRc(game, name)) game.error(`sysrc: ${name}: not currently set`, 1);
        continue;
      }
      const v = value!.replace(/^["']|["']$/g, '');
      const before = setRc(game, name, v);
      out.push(`${name}: ${before ?? ''} -> ${v}`);
    } else {
      const conf = rcConf(game);
      if (conf[name] === undefined) game.error(`sysrc: unknown variable '${name}'`, 1);
      else out.push(`${name}: ${conf[name]}`);
    }
  }
  return out.join('\n');
}
const RC_FILE = '/etc/rc.conf';

// ——— pkg ———

function pkg(game: Shell, args: string[]): string {
  const [verb, ...rest] = args;
  const st = pkgState(game);
  const yes = rest.includes('-y') || rest.includes('--yes');
  const names = rest.filter((a) => !a.startsWith('-'));
  if (verb === 'info') {
    if (names.length) {
      const p = st.catalogue[names[0]];
      if (!p || !installed(game, names[0])) return game.error(`pkg: No package(s) matching ${names[0]}`, 1);
      return `${names[0]}-${p.version}\nName           : ${names[0]}\nVersion        : ${p.version}\nComment        : ${p.comment}\nFlat size      : ${p.size}`;
    }
    return st.installed.map((n) => `${`${n}-${st.catalogue[n]?.version ?? ''}`.padEnd(32)}${st.catalogue[n]?.comment ?? ''}`).join('\n');
  }
  if (verb === 'search') {
    const q = names[0] ?? '';
    const found = Object.entries(st.catalogue).filter(([n]) => n.includes(q));
    if (!found.length) return game.error('', 1);
    return found.map(([n, p]) => `${`${n}-${p.version}`.padEnd(32)}${p.comment}`).join('\n');
  }
  if (verb === 'install' || verb === 'delete' || verb === 'remove') {
    if (game.who !== 'root') return game.error(`pkg: Insufficient privileges to ${verb === 'install' ? 'install' : 'delete'} packages`, 77);
    if (!names.length) return game.error(`Usage: pkg ${verb} [-AfIMnFqRUy] [-r reponame] [-Cgix] <pkg-name> ...\n\nFor more information see 'pkg help ${verb}'.`, 64);
    if (verb !== 'install') {
      const n = names[0];
      if (!installed(game, n)) return game.error(`No packages matched for pattern '${n}'\n\nChecking integrity... done (0 conflicting)\n1 packages requested for removal: 0 locked, 1 missing`, 1);
      st.installed = st.installed.filter((x) => x !== n);
      for (const f of Object.keys(st.catalogue[n]?.files ?? {})) game.erase(f);
      return `Checking integrity... done (0 conflicting)\nDeinstallation has been requested for the following 1 packages:\n\nInstalled packages to be REMOVED:\n\t${n}: ${st.catalogue[n]?.version}\n\n[1/1] Deinstalling ${n}-${st.catalogue[n]?.version}...`;
    }
    const head = ['Updating FreeBSD repository catalogue...', 'FreeBSD repository is up to date.', 'All repositories are up to date.'];
    const missing = names.find((n) => !st.catalogue[n]);
    if (missing) return game.error([...head, `pkg: No packages available to install matching '${missing}' have been found in the repositories`].join('\n'), 1);
    const fresh = names.filter((n) => !installed(game, n));
    if (!fresh.length) return [...head, 'Checking integrity... done (0 conflicting)', 'The most recent versions of packages are already installed'].join('\n');
    const plan = [
      ...head,
      'The following 1 package(s) will be affected (of 0 checked):'.replace('1', String(fresh.length)),
      '',
      'New packages to be INSTALLED:',
      ...fresh.map((n) => `\t${n}: ${st.catalogue[n].version}`),
      '',
      `Number of packages to be installed: ${fresh.length}`,
      '',
    ];
    const install = () => {
      const out: string[] = [];
      fresh.forEach((n, i) => {
        const p = st.catalogue[n];
        out.push(`[${i + 1}/${fresh.length}] Fetching ${n}-${p.version}.pkg: 100%`);
      });
      out.push('Checking integrity... done (0 conflicting)');
      fresh.forEach((n, i) => {
        const p = st.catalogue[n];
        out.push(`[${i + 1}/${fresh.length}] Installing ${n}-${p.version}...`, `[${i + 1}/${fresh.length}] Extracting ${n}-${p.version}: 100%`);
        for (const [path, text] of Object.entries(p.files)) {
          const parts = path.split('/').filter(Boolean);
          let at = '';
          for (const d of parts.slice(0, -1)) {
            at += `/${d}`;
            if (!game.exists(at)) game.place('pkg', at, { type: 'directory', children: {}, owner: 'root' });
          }
          game.place('pkg', path, { type: 'file', content: text, lines: true, owner: 'root', mode: path.includes('/rc.d/') || path.includes('/bin/') ? 'rwxr-xr-x' : 'rw-r--r--' });
        }
        st.installed.push(n);
      });
      for (const n of fresh) {
        const m = st.catalogue[n].message;
        if (m) out.push('=====', `Message from ${n}-${st.catalogue[n].version}:`, '', '--', m);
      }
      return out.join('\n');
    };
    if (yes) return [...plan, install()].join('\n');
    game.ask('Proceed with this action? [y/N]: ', (response) => {
      if (!/^y(es)?$/i.test(response)) return '';
      const before = game.who;
      game.who = 'root';
      try {
        return install();
      } finally {
        game.who = before;
      }
    });
    return plan.join('\n');
  }
  if (verb === 'update') return 'Updating FreeBSD repository catalogue...\nFreeBSD repository is up to date.\nAll repositories are up to date.';
  if (verb === 'version' || verb === 'upgrade') return 'Updating FreeBSD repository catalogue...\nFreeBSD repository is up to date.\nAll repositories are up to date.\nChecking for upgrades (0 candidates): 100%\nYour packages are up to date.';
  return game.error(`Usage: pkg [-v] [-d] [-l] [-N] [-j <jail name or id>|-c <chroot path>|-r <rootdir>] [-C <configuration file>] [-R <repo config dir>] [-o var=value] [-4|-6] <command> [<args>]\n\nFor more information on available commands and options see 'pkg help'.`, 1);
}

// ——— sockstat ———

function sockstat(game: Shell, args: string[]): string {
  const letters = new Set(args.filter((a) => /^-\w+$/.test(a)).flatMap((a) => [...a.slice(1)]));
  const listening = ((game.state.listening ?? []) as Listening[]).filter((l) => !letters.has('6') || l.address.includes(':'));
  const rows = [['USER', 'COMMAND', 'PID', 'FD', 'PROTO', 'LOCAL ADDRESS', 'FOREIGN ADDRESS']];
  for (const l of listening) {
    const v6 = l.address.includes(':') || l.address === '[::]';
    if (letters.has('4') && v6) continue;
    const local = `${l.address === '0.0.0.0' || l.address === '[::]' ? '*' : l.address}:${l.port}`;
    rows.push([l.process === 'sshd' || l.process === 'nginx' ? 'root' : l.process, l.process, String(l.pid), '4', `${l.proto}${v6 ? '6' : '4'}`, local, '*:*']);
  }
  const widths = rows[0].map((_, i) => Math.max(...rows.map((r) => r[i].length)));
  return rows.map((r) => r.map((c, i) => (i === r.length - 1 ? c : c.padEnd(widths[i]))).join(' ')).join('\n');
}

// ——— pfctl ———

const PF_CONF = '/etc/pf.conf';

function pfctl(game: Shell, args: string[]): string {
  if (game.who !== 'root') return game.error('pfctl: /dev/pf: Permission denied', 1);
  const state = (game.state.pf ??= { enabled: false, rules: [], skip: [] }) as PfState;
  const out: string[] = [];
  let parseOnly = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-n') parseOnly = true;
    else if (a === '-nf' || a === '-f') {
      if (a === '-nf') parseOnly = true;
      const file = args[++i];
      if (!file) return game.error('pfctl: option requires an argument -- f', 1);
      const text = game.read(file);
      if (text === null) return game.error(`pfctl: ${file}: No such file or directory`, 1);
      const r = parsePf(text, file);
      if ('errors' in r) return game.error([...r.errors, 'pfctl: Syntax error in config file: pf rules not loaded'].join('\n'), 1);
      if (!parseOnly) {
        state.rules = r.rules;
        state.skip = r.skip;
      }
    } else if (a === '-e') {
      if (state.enabled) return game.error('pfctl: pf already enabled', 1);
      state.enabled = true;
      out.push('pf enabled');
    } else if (a === '-d') {
      if (!state.enabled) return game.error('pfctl: pf not enabled', 1);
      state.enabled = false;
      out.push('pf disabled');
    } else if (a === '-sr' || (a === '-s' && args[i + 1] === 'rules')) {
      if (a === '-s') i++;
      out.push(...state.rules.map((r) => r.text));
    } else if (a === '-si' || (a === '-s' && args[i + 1] === 'info')) {
      if (a === '-s') i++;
      out.push(`Status: ${state.enabled ? 'Enabled' : 'Disabled'} for 0 days 00:00:12           Debug: Urgent`);
    } else if (a === '-F' && args[i + 1] === 'rules') {
      i++;
      state.rules = [];
      out.push('rules cleared');
    } else return game.error(`pfctl: illegal option -- ${a.replace(/^-/, '').charAt(0)}\nusage: pfctl [-AdeghMmNnOPqRrvz] [-a anchor] [-D macro=value] [-F modifier]\n\t[-f file] [-i interface] [-K host | network]\n\t[-k host | network | gateway | label | id] [-o level] [-p device]\n\t[-s modifier] [-t table -T command [address ...]] [-x level]`, 1);
  }
  return out.join('\n');
}

/** pf as an rc service: service pf start reads /etc/pf.conf and enables it. */
export const pfService = (): RcService => ({
  program: '',
  listening: [],
  onStart: (game) => {
    const text = game.read(PF_CONF);
    if (text === null) return `/etc/rc.d/pf: WARNING: /etc/pf.conf is not readable.`;
    const r = parsePf(text, PF_CONF);
    if ('errors' in r) return [...r.errors, 'pfctl: Syntax error in config file: pf rules not loaded'].join('\n');
    game.state.pf = { enabled: true, rules: r.rules, skip: r.skip };
    return null;
  },
  onStop: (game) => {
    const p = pf(game);
    if (p) p.enabled = false;
    return '';
  },
  start: ['Enabling pf.'],
  status: (game) => `Status: ${pf(game)?.enabled ? 'Enabled' : 'Disabled'} for 0 days 00:00:12           Debug: Urgent`,
});

export const FREEBSD: Record<string, Command> = {
  service: { section: 8, ownOptions: true, launch: ({ args, game }) => (isBsd(game) ? service(game, args) : notOnLinux(game, 'service')) },
  sysrc: { section: 8, ownOptions: true, launch: ({ args, game }) => (isBsd(game) ? sysrc(game, args) : notOnLinux(game, 'sysrc')) },
  pkg: { section: 8, ownOptions: true, launch: ({ args, game }) => (isBsd(game) ? pkg(game, args) : notOnLinux(game, 'pkg')) },
  sockstat: { ownOptions: true, launch: ({ args, game }) => (isBsd(game) ? sockstat(game, args) : notOnLinux(game, 'sockstat')) },
  pfctl: { section: 8, ownOptions: true, launch: ({ args, game }) => (isBsd(game) ? pfctl(game, args) : notOnLinux(game, 'pfctl')) },
  'rc.conf': { section: 5, launch: () => '' },
  'pf.conf': { section: 5, launch: () => '' },
  'freebsd-version': { ownOptions: true, launch: ({ game }) => (isBsd(game) ? RELEASE : notOnLinux(game, 'freebsd-version')) },
};
